import sqlite3
from datetime import date, datetime, time, timedelta
from typing import Annotated, Literal

from dateutil.relativedelta import relativedelta
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
    # adjustments.total_litres is a the beginning of the day
    db.execute(
        '''
        CREATE TABLE IF NOT EXISTS adjustments (
            date INTEGER PRIMARY KEY,
            total_litres REAL
        )'''
    )
    db.commit()
    return app.state.db


def db_litres_by_period(
    db: sqlite3.Connection, start: datetime, end: datetime, period_s: int
) -> list[tuple[int, float]]:
    assert period_s < 24 * 3600, f"Use db_litres_by_day, {period_s=}"
    raw = db.execute(
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
    by_period = dict(raw)
    dt = start
    while dt < end:
        by_period.setdefault(int(dt.timestamp()), 0)
        dt += timedelta(seconds=period_s)
    return list(by_period.items())


def db_litres_by_day(db: sqlite3.Connection, start: datetime, end: datetime) -> list[tuple[int, float]]:
    raw = db.execute(
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
    by_day = dict(raw)
    dt = start
    while dt < end:
        by_day.setdefault(int(dt.timestamp()), 0)
        dt += timedelta(days=1)
    return list(by_day.items())


def db_litres_by_month(db: sqlite3.Connection, start: datetime, end: datetime) -> list[tuple[str, float]]:
    raw = db.execute(
        '''
        SELECT
            unixepoch(strftime('%Y-%m-01', date, 'unixepoch')) AS month,
            sum(litres)
        FROM litres_by_day
        WHERE date BETWEEN unixepoch(:start) AND unixepoch(:end)
        GROUP BY month
        ORDER BY month
        ''',
        {'start': start, 'end': end},
    ).fetchall()
    by_month = dict(raw)
    dt = start
    while dt < end:
        by_month.setdefault(int(dt.timestamp()), 0)
        if dt.month == 12:
            dt = dt.replace(year=dt.year + 1, month=1)
        else:
            dt = dt.replace(month=dt.month + 1)
    return list(by_month.items())


def close_db(app: Litestar) -> None:
    if db := getattr(app.state, 'db', None):
        db.close()


@post('/query', sync_to_thread=False)
def query(state: State) -> dict:
    today = datetime.combine(date.today(), time())
    start_week = today - timedelta(days=today.weekday())
    start_month = today.replace(day=1)
    start_year = today.replace(month=1, day=1)
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
            'curr': db_litres_by_day(state.db, start=start_month, end=start_month + relativedelta(months=1)),
            'prev': db_litres_by_day(state.db, start=start_month + relativedelta(months=-1), end=start_month),
            'period': '1d',
        },
        'year': {
            'curr': db_litres_by_month(state.db, start=start_year, end=today + relativedelta(years=1)),
            'prev': db_litres_by_month(state.db, start=start_year + relativedelta(years=-1), end=start_year),
            'period': '1d',
        },
        'total': state.db.execute(
            '''
            SELECT a.total_litres + (SELECT sum(litres) FROM litres_by_day WHERE date >= a.date)
            FROM adjustments a ORDER BY date DESC LIMIT 1'''
        ).fetchone()[0],
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
