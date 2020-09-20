const DB = "water_meter";

function zip(arr1, arr2) {
  return arr1.map((a1, i) => [a1, arr2[i]]);
}

async function query(q) {
  const resp = await fetch(`http://localhost:8086/query?db=${DB}&q=${q}`, {
    method: "POST",
  });
  const json = await resp.json();
  console.log(json);
  return json["results"].map((result) =>
    result.series
      ? result.series[0].values.map((row) =>
          Object.fromEntries(zip(result.series[0].columns, row))
        )
      : []
  );
}

async function main() {
  let [values] = await query("SELECT * FROM water WHERE time>=now()-24h");
  let [historic] = await query(
    "SELECT sum(litres) FROM water GROUP BY time(1h)"
  );

  console.log({ values, historic });

  let lastTime_ms = -Infinity;
  for (const val of values) {
    const time_ms = Date.parse(val.time);
    const litresPerSecond = (val.litres * 1000) / (time_ms - lastTime_ms);
    val.litresPerHour = litresPerSecond * 3600;
    lastTime_ms = time_ms;
  }
  console.log(values);

  const vl = {
    // autosize: "pad",
    height: "container",
    width: "container",
    data: {
      values: values,
    },
    mark: {
      type: "line",
      interpolate: "step-before",
      // interpolate: "monotone",
    },
    encoding: {
      x: {
        field: "time",
        type: "temporal",
        // timeUnit: "datehoursminutes",
        // timeUnit: "date",
      },
      y: {
        field: "litresPerHour",
        // field: "litres",
        type: "quantitative",
        // aggregate: "sum",
      },
    },
  };
  vegaEmbed("#graph-day", vl);
  vegaEmbed("#graph-week", vl);
}
main();
