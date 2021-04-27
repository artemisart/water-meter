const DB = "water_meter";
const LOG = false;
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
  if (LOG)
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


function spec_graph(period, x_title) {
  // console.log({ period, start, domain: domain(period) })
  return {
    ...base_graph(),
    data: {
      name: 'source',
      // values: current,
    },
    mark: {
      type: "line",
      // interpolate: "step",
      interpolate: "monotone",
      clip: true,
      tooltip: true,
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

async function create_graph(element, { period, group_period, x_title, merge_spec }) {
  function run_query() {
    const start = dayjs().startOf(period).toISOString()
    const prev = dayjs().startOf(period).subtract(1, period).toISOString()
    return query(
      `SELECT sum(litres) FROM water WHERE time>='${start}' GROUP BY time(${group_period}) fill(0);` +
      `SELECT sum(litres) FROM water WHERE time>='${prev}' AND time<'${start}' GROUP BY time(${group_period}) fill(0);`
    )
  }
  const spec = spec_graph(period, x_title)
  const graph = await vegaEmbed(element, merge(spec, merge_spec), { actions: false })
  const [current, previous] = await run_query()
  graph.view.data('source', current).run()
  setInterval(async () => {
    const [current] = await run_query()
    graph.view.data('source', current).run()
  }, 5000);
}

async function main() {
  // update_counter()

  create_graph('#graph-day', {
    period: 'day',
    group_period: '30m',
    x_title: 'Consommation par 30 minutes, sur 1 jour',
    merge_spec: { encoding: { x: { axis: { format: '%-H' } } } },
    // merge_spec: { encoding: { x: { timeUnit: 'hours' } } },
  })
  create_graph('#graph-week', {
    period: 'week',
    group_period: '2h',
    x_title: 'Consommation par 2h, sur 1 semaine',
    merge_spec: { encoding: { x: { axis: { format: '%A' } } } },
    // merge_spec: { encoding: { x: { timeUnit: 'day' } } },
  })
  create_graph("#graph-month", {
    period: 'month',
    group_period: '1d',
    x_title: 'Consommation par jour, sur 1 mois',
    merge_spec: { encoding: { x: { axis: { format: '%e' } } } },
  })
  create_graph("#graph-year", {
    period: 'year',
    group_period: '1d',  // grouping by month is done with vega
    x_title: 'Consommation par mois, sur 1 an',
    merge_spec: { mark: { type: "bar" }, encoding: { x: { timeUnit: "month", scale: undefined }, y: { aggregate: 'sum' } } }
  });

  update_counter()
  setInterval(() => update_counter(), 5000);
  // force vega to compute the correct graph size
  setTimeout(() => window.dispatchEvent(new Event('resize')), 300)
  setTimeout(() => window.dispatchEvent(new Event('resize')), 1000)
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

async function update_counter() {
  let total
  try {
    [total] = await query('SELECT sum(litres) FROM water;')
    document.getElementById('errors').innerHTML = ""
  }
  catch (error) {
    document.getElementById('errors').innerHTML = (
      "Problème de connexion à la base de données."
      + " Rechargez la page ou redémarrez le Raspberry Pi."
      + "<br><br>Détails :" + (new Option(error.toString()).innerHTML))
  }
  const counter_total = total[0].sum

  document.getElementById('date').innerHTML = new Intl.DateTimeFormat(navigator.language, { dateStyle: 'long', timeStyle: 'medium' }).format(new Date()) + ` - ${counter_total}`
}

function show(button, element) {
  const buttons = document.querySelectorAll('button')
  for (const button of buttons) {
    button.style.backgroundColor = ''
  }
  button.style.backgroundColor = 'lightblue'
  const graphs = document.querySelectorAll('[id^=graph]')
  if (element === undefined) {
    for (const graph of graphs) {
      graph.style.display = ''
    }
  }
  else {
    for (const graph of graphs) {
      graph.style.display = 'none'
    }
    document.querySelector(element).style.display = ''
  }
  window.dispatchEvent(new Event('resize'))
}

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  }
  else {
    document.exitFullscreen()
  }
}

main()
