import sqlite3
from datetime import date, timedelta
from typing import Annotated, Literal

from litestar import Litestar, post
from litestar.datastructures import State
from litestar.enums import RequestEncodingType
from litestar.params import Body
from litestar.static_files import create_static_files_router


def get_db(app: Litestar) -> sqlite3.Connection:
    if hasattr(app.state, 'db'):
        return app.state.db
    db = sqlite3.connect('water_meter.db')
    app.state.db = db
    db.execute(
        '''CREATE TABLE IF NOT EXISTS litres_ts (
            ts INTEGER PRIMARY KEY,
            litres REAL
        )'''
    )
    db.execute(
        '''
        CREATE TABLE IF NOT EXISTS litres_by_day (
            date INTEGER PRIMARY KEY,
            litres REAL
        )'''
    )
    db.commit()
    return app.state.db


def db_litres_by_period(db: sqlite3.Connection, start: date, end: date, period_s: int) -> list[tuple[int, float]]:
    assert period_s < 24 * 3600, f"Use db_litres_by_day, {period_s=}"
    return db.execute(
        '''
        SELECT
            ts / :period_s * :period_s AS t,
            sum(litres)
        FROM litres_ts
        WHERE ts BETWEEN unixepoch(:start) AND unixepoch(:end)
        GROUP BY t
        ORDER BY t
        ''',
        {'start': start, 'end': end, 'period_s': period_s},
    ).fetchall()


def db_litres_by_day(db: sqlite3.Connection, start: date, end: date) -> list[tuple[int, float]]:
    return db.execute(
        '''
        SELECT
            date,
            litres
        FROM litres_by_day
        WHERE date BETWEEN unixepoch(:start) AND unixepoch(:end)
        ORDER BY date
        ''',
        {'start': start, 'end': end},
    ).fetchall()


def db_litres_by_month(db: sqlite3.Connection, start: date, end: date) -> list[tuple[int, float]]:
    return db.execute(
        '''
        SELECT
            unixepoch(strftime('%Y-%m-01', date)) AS month,
            sum(litres)
        FROM litres_by_day
        WHERE date BETWEEN unixepoch(:start) AND unixepoch(:end)
        GROUP BY month
        ORDER BY month
        ''',
        {'start': start, 'end': end},
    ).fetchall()


def close_db(app: Litestar) -> None:
    if db := getattr(app.state, 'db', None):
        db.close()


@post('/query', sync_to_thread=False)
def query(db: Literal['water_meter'], q: str, state: State) -> dict:
    assert db == 'water_meter'
    today = date.today()
    start_week = today - timedelta(days=today.weekday())
    _1d = timedelta(days=1)
    _7d = timedelta(days=7)

    return {
        'today': {
            'curr': db_litres_by_period(state.db, start=today, end=today + _1d, period_s=30 * 60),
            'prev': db_litres_by_period(state.db, start=today - _1d, end=today, period_s=30 * 60),
            'period': '30m',
        },
        'week': {
            'curr': db_litres_by_period(state.db, start=start_week, end=start_week + _7d, period_s=2 * 3600),
            'prev': db_litres_by_period(state.db, start=start_week - _7d, end=start_week, period_s=2 * 3600),
            'period': '2h',
        },
        'month': {
            'curr': db_litres_by_day(state.db, start=today.replace(day=1), end=today + _1d),
            'prev': db_litres_by_day(state.db, start=(today - _1d).replace(day=1), end=today),
            'period': '1d',
        },
        'year': {
            'curr': db_litres_by_month(state.db, start=today.replace(month=1, day=1), end=today + _1d),
            'prev': db_litres_by_month(state.db, start=(today - _1d).replace(month=1, day=1), end=today),
            'period': '1d',
        },
    }


@post('/write', sync_to_thread=False)
def write(
    db: Literal['water_meter'],
    precision: Literal['ms'],
    data: Annotated[dict[str, str], Body(media_type=RequestEncodingType.URL_ENCODED)],
    state: State,
) -> None:
    assert db == 'water_meter'
    assert precision == 'ms'
    print(f"POST /write data={data}")
    val = float(data['water litres'])
    state.db.execute(
        '''INSERT INTO litres_ts (ts, litres) VALUES (unixepoch(), :val)
            ON CONFLICT (ts) DO UPDATE SET litres = litres + :val''',
        {'val': val},
    )
    state.db.execute(
        '''INSERT INTO litres_by_day (date, litres) VALUES (unixepoch('now', 'start of day'), :val)
            ON CONFLICT (date) DO UPDATE SET litres = litres + :val''',
        {'val': val},
    )
    state.db.commit()


app = Litestar(
    [create_static_files_router('/', ['../front'], html_mode=True), query, write],
    on_startup=[get_db],
    on_shutdown=[close_db],
)
