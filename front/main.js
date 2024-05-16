const DB = "water_meter";
const LOG = true;
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

async function query() {
  const resp = await fetch(`/query`, { method: "POST" });
  const json = await resp.json();
  if (LOG)
    console.log({ json });
  return json
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
  return {
    ...base_graph(),
    data: {
      name: 'source',
    },
    mark: {
      type: "line",
      interpolate: "monotone",
      clip: true,
      tooltip: true,
    },
    encoding: {
      x: {
        field: "time",
        type: "temporal",
        title: x_title,
        scale: {
          domain: domain(period),
        },
      },
      y: {
        field: "litres",
        type: "quantitative",
        title: "Litres",
      },
      color: { field: "name", type: "nominal" },
    },
  }
}

async function create_graph(element, { period, x_title, merge_spec }) {
  const spec = spec_graph(period, x_title)
  return await vegaEmbed(element, merge(spec, merge_spec), { actions: false })
}

async function main() {
  const graph_day = await create_graph('#graph-day', {
    period: 'day',
    x_title: 'Consommation par 30 minutes, sur 1 jour',
    merge_spec: { encoding: { x: { axis: { format: '%-H' } } } },
  })
  const graph_week = await create_graph('#graph-week', {
    period: 'week',
    x_title: 'Consommation par 2 heures, sur 1 semaine',
    merge_spec: { encoding: { x: { axis: { format: '%-H' } } } },
  })
  const graph_month = await create_graph('#graph-month', {
    period: 'month',
    x_title: 'Consommation par jour, sur 1 mois',
    merge_spec: { encoding: { x: { axis: { format: '%-d' } } } },
  })
  const graph_year = await create_graph('#graph-year', {
    period: 'year',
    x_title: 'Consommation par mois, sur 1 an',
    merge_spec: { mark: { type: "bar" }, encoding: { x: { timeUnit: "month", scale: undefined } } },
  })

  async function update() {
    const results = await query()
    update_counter(results.total)

    const to_update = [
      [graph_day, results.day],
      [graph_week, results.week],
      [graph_month, results.month],
      [graph_year, results.year],
    ]

    for (const [graph, data] of to_update) {
      const rows = [
        ...data.prev.map(([ts, litres]) => ({ time: ts * 1000, litres, name: "Précédent" })),
        ...data.curr.map(([ts, litres]) => ({ time: ts * 1000, litres, name: "Actuel" })),
      ]
      graph.view.data('source', rows).run()
    }
  }

  await update()
  setInterval(() => update(), 5000)
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

function update_counter(total) {
  const date = new Intl.DateTimeFormat(navigator.language, { dateStyle: 'long', timeStyle: 'medium' }).format(new Date())
  document.getElementById('date').innerHTML = date + ` - ${total} L`
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
