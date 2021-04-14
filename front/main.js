const DB = "water_meter";
dayjs.locale('fr');

function zip(arr1, arr2) {
  return arr1.map((a1, i) => [a1, arr2[i]]);
}

function merge(a, b) {
  return Object.entries(b).reduce((o, [k, v]) => {
    o[k] = v && typeof v === 'object'
      ? merge(o[k] = o[k] || (Array.isArray(v) ? [] : {}), v)
      : v;
    return o
  }, a)
}

async function query(q) {
  const encoded_q = encodeURIComponent(q);
  const resp = await fetch(`http://10.0.0.1:8086/query?db=${DB}&q=${encoded_q}`, {
    method: "POST",
  });
  const json = await resp.json();
  console.log({ json });
  return json["results"].map((result) =>
    result.series
      ? result.series[0].values.map((row) =>
        Object.fromEntries(zip(result.series[0].columns, row))
      )
      : []
  );
}

function domain(unit) {
  return [dayjs().startOf(unit).valueOf(), dayjs().endOf(unit).valueOf()];
}

function base_graph() {
  return {
    autosize: {
      type: "fit",
      contains: "padding"
    },
    height: "container",
    width: "container",
    // padding: "10",
  }
}


async function create_bar_graph(period, group_period, x_title) {
  const start = dayjs().startOf(period).toISOString()
  const prev = dayjs().startOf(period).subtract(1, period).toISOString()
  const [current, previous] = await query(
    `SELECT sum(litres) FROM water WHERE time>='${start}' GROUP BY time(${group_period}) fill(0);` +
    `SELECT sum(litres) FROM water WHERE time>='${prev}' AND time<'${start}' GROUP BY time(${group_period}) fill(0);`
  )
  console.log({ period, start, group_period, current, domain: domain(period) })
  return {
    ...base_graph(),
    data: {
      values: current,
    },
    mark: {
      type: "line",
      // interpolate: "step",
      interpolate: "monotone",
      clip: true,
    },
    encoding: {
      x: {
        field: "time",
        type: "temporal",
        // timeUnit: "dayhours",
        title: x_title,
        scale: {
          domain: domain(period),
        },
      },
      y: {
        field: "sum",
        type: "quantitative",
        title: "Litres",
      },
    },
  }
}

async function main() {
  const day2 = dayjs().startOf('day').subtract(1, 'day').toISOString()
  let values, total
  try {
    [values, total] = await query(
      `SELECT * FROM water WHERE time>='${day2}';`
      + 'SELECT sum(litres) FROM water;'
    )
  }
  catch (error) {
    document.getElementById('errors').innerHTML = (
      "Problème de connexion à la base de données."
      + " Rechargez la page ou redémarrez le Raspberry Pi."
      + "<br><br>Détails :" + (new Option(error.toString()).innerHTML))
  }
  const counter_total = total[0].sum

  console.log({ values, total });

  let lastTime_ms = -Infinity;
  for (const val of values) {
    const time_ms = Date.parse(val.time);
    const litresPerSecond = (val.litres * 1000) / (time_ms - lastTime_ms);
    val.litresPerHour = litresPerSecond * 3600;
    lastTime_ms = time_ms;
  }
  console.log({ values });

  const graph_day = {
    ...base_graph(),
    data: {
      values: values,
    },
    mark: {
      type: "line",
      interpolate: "step-before",
      // interpolate: "monotone",
      clip: true,
    },
    encoding: {
      x: {
        field: "time",
        type: "temporal",
        // timeUnit: "hoursminutes",
        // timeUnit: "date",
        title: "Consommation directe, aujourd'hui",
        scale: {
          domain: domain('day'),
        },
      },
      y: {
        field: "litresPerHour",
        type: "quantitative",
        title: "Litres par Heure",
      },
    },
  };
  // vegaEmbed("#graph-day", graph_day);
  vegaEmbed("#graph-day", merge(
    await create_bar_graph('day', '10m', 'Consommation par 10 minutes, sur 1 jour'),
    // { encoding: { x: { timeUnit: 'hours' } } },
    { encoding: { x: { axis: { format: '%H' } } } },
  ));

  vegaEmbed("#graph-week", merge(
    await create_bar_graph('week', '1h', 'Consommation par heure, sur 1 semaine'),
    // { encoding: { x: { timeUnit: 'day' } } },
    { encoding: { x: { axis: { format: '%A' } } } },
  ));
  vegaEmbed("#graph-month", merge(
    await create_bar_graph('month', '1d', 'Consommation par jour, sur 1 mois'),
    { encoding: { x: { axis: { format: '%e' } } } },
  ));
  const graph = merge(
    await create_bar_graph('year', '1d', 'Consommation par mois, sur 1 an'),
    { mark: { type: "bar" }, encoding: { x: { timeUnit: "month", scale: undefined }, y: { aggregate: 'sum' } } }
  )
  console.log({ graph })
  vegaEmbed("#graph-year", graph);

  document.getElementById('date').innerHTML = new Intl.DateTimeFormat(navigator.language, { dateStyle: 'long', timeStyle: 'medium' }).format(new Date()) + ` - ${counter_total}`
}

vega.defaultLocale({
  "decimal": ",",
  "thousands": "\u00a0",
  "grouping": [3],
  "currency": ["", "\u00a0€"],
  "percent": "\u202f%"
}, {
  "dateTime": "%A %e %B %Y à %X",
  "date": "%d/%m/%Y",
  "time": "%H:%M:%S",
  "periods": ["", "PM"],
  "days": ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
  "shortDays": ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."],
  "months": ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  "shortMonths": ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
})
main();
setInterval(() => {
  main();
}, 5000);
