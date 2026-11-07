/**
 * Pure CSV parsing, aggregation and chart-fragment generation for the
 * `visualize_csv` tool.
 *
 * Kept free of DSH imports so it can be unit-tested without a running
 * Harness, and so the tool body stays a thin shell around it.
 */

/** Largest CSV accepted. */
export const MAX_CSV_BYTES = 8 * 1024 * 1024

/** Aggregation functions the tool understands. */
export const FUNCS = ['sum', 'avg', 'count', 'min', 'max']

/** Chart types the generated fragment can draw. */
export const CHART_TYPES = ['bar', 'line', 'pie']

/** Delimiters auto-detection considers, in first-line count order. */
const DELIMITERS = [',', '\t', ';']

/**
 * Parse RFC-4180-ish delimited text: quoted fields, escaped quotes, CRLF, BOM.
 * The delimiter is auto-detected from the header line unless given.
 * @param text - raw CSV/TSV text.
 * @param delimiter - one of `,` `\t` `;`, or undefined for auto-detection.
 * @returns { header: string[], rows: Array<Object<string,string>>, delimiter: string }
 */
export function parseCsv(text, delimiter) {
  const clean = String(text ?? '').replace(/^\uFEFF/, '')
  let d = delimiter
  if (d === undefined || d === 'auto') {
    const firstLine = clean.slice(0, clean.indexOf('\n') === -1 ? clean.length : clean.indexOf('\n'))
    d = DELIMITERS[0]
    let best = 0
    for (const candidate of DELIMITERS) {
      const n = firstLine.split(candidate).length - 1
      if (n > best) { best = n; d = candidate }
    }
  }
  const records = []
  let field = ''
  let record = []
  let inQuotes = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === d) {
      record.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++
      record.push(field); field = ''
      if (record.length > 1 || record[0] !== '') records.push(record)
      record = []
    } else field += c
  }
  record.push(field)
  if (record.length > 1 || record[0] !== '') records.push(record)
  if (records.length === 0) throw new Error('visualize_csv: csv has no header row')
  const header = records[0].map(h => h.trim())
  if (header.some(h => h === '')) throw new Error('visualize_csv: csv header has an empty column name')
  const rows = records.slice(1).map(cells => {
    const row = {}
    header.forEach((h, i) => { row[h] = (cells[i] ?? '').trim() })
    return row
  })
  return { header, rows, delimiter: d }
}

/**
 * Group rows by one column and aggregate another.
 * @param rows - parsed rows.
 * @param groupBy - column name to group by.
 * @param aggregate - column name to aggregate, or '' with count.
 * @param func - one of FUNCS.
 * @returns Array<{ key: string, value: number, count: number }> sorted by key.
 */
export function groupAggregate(rows, groupBy, aggregate, func) {
  if (!FUNCS.includes(func)) {
    throw new Error(`visualize_csv: func must be one of ${FUNCS.join(', ')}`)
  }
  const groups = new Map()
  for (const row of rows) {
    const key = String(row[groupBy] ?? '')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const out = []
  for (const [key, group] of groups) {
    const numeric = aggregate === ''
      ? []
      : group.map(r => Number.parseFloat(r[aggregate])).filter(v => Number.isFinite(v))
    if (func !== 'count' && numeric.length === 0) {
      throw new Error(`visualize_csv: group "${key}" has no numeric "${aggregate}" values (no data rows)`)
    }
    let value
    switch (func) {
      case 'sum': value = numeric.reduce((a, b) => a + b, 0); break
      case 'avg': value = numeric.reduce((a, b) => a + b, 0) / numeric.length; break
      case 'count': value = group.length; break
      case 'min': value = Math.min(...numeric); break
      case 'max': value = Math.max(...numeric); break
    }
    out.push({ key, value, count: group.length })
  }
  return out.sort((a, b) => String(a.key).localeCompare(String(b.key), undefined, { numeric: true }))
}

/**
 * Build a self-contained chart fragment from aggregated rows.
 *
 * The data is inlined as JSON and drawn by inline JS with SVG; colours come
 * from the --viz-series-* custom properties the client injects, so the chart
 * follows the light/dark theme.
 * @param title - chart heading shown above the plot.
 * @param data - aggregated rows from groupAggregate.
 * @param chartType - one of CHART_TYPES.
 * @param yLabel - axis label for the value.
 * @returns an HTML fragment string.
 */
export function chartFragment(title, data, chartType = 'bar', yLabel = '') {
  if (!CHART_TYPES.includes(chartType)) {
    throw new Error(`visualize_csv: chart_type must be one of ${CHART_TYPES.join(', ')}`)
  }
  const payload = JSON.stringify({ title, data, chartType, yLabel })
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028|\u2029/g, '')
  return `<div class="viz-stack" id="viz-csv-chart">
  <h2>${escapeHtml(title)}</h2>
  <div id="viz-csv-plot"></div>
  <p class="muted text-small" id="viz-csv-caption"></p>
  <script>window.__VIZ_DATA__=${payload};</script>
  <script>
(function () {
  var cfg = window.__VIZ_DATA__
  var el = document.getElementById('viz-csv-plot')
  var rows = cfg.data
  var cap = document.getElementById('viz-csv-caption')
  var NS = 'http://www.w3.org/2000/svg'

  function svg(tag, attrs, text) {
    var node = document.createElementNS(NS, tag)
    for (var k in attrs) node.setAttribute(k, attrs[k])
    if (text !== undefined) node.textContent = text
    return node
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  var W = 760, H = 320, L = 64, R = 16, T = 18, B = 96
  var PW = W - L - R, PH = H - T - B
  var max = 0
  for (var i = 0; i < rows.length; i++) if (rows[i].value > max) max = rows[i].value
  if (max <= 0) max = 1
  function fmt(v) {
    var abs = Math.abs(v)
    if (abs >= 1e9) return (v / 1e9).toFixed(1) + 'G'
    if (abs >= 1e6) return (v / 1e6).toFixed(1) + 'M'
    if (abs >= 1e3) return (v / 1e3).toFixed(1) + 'K'
    return String(Math.round(v * 100) / 100)
  }
  function niceMax(v) {
    var exp = Math.pow(10, Math.floor(Math.log(v) / Math.LN10))
    var f = v / exp
    var n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
    return n * exp
  }
  var top = niceMax(max)

  var plot = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, style: 'width:100%;height:auto' })

  // 縦軸：1-2-5 刻みの目盛りとグリッド
  var ticks = []
  for (var t = 0; t <= 4; t++) ticks.push(top * t / 4)
  ticks.forEach(function (v) {
    var y = T + PH * (1 - v / top)
    plot.appendChild(svg('line', { x1: L, y1: y, x2: L + PW, y2: y, stroke: 'var(--vz-border)', 'stroke-width': 1 }))
    plot.appendChild(svg('text', { x: L - 8, y: y + 4, 'font-size': 11, fill: 'var(--vz-dim)', 'text-anchor': 'end' }, fmt(v)))
  })
  plot.appendChild(svg('text', { x: L, y: T + PH + 58, 'font-size': 11, fill: 'var(--vz-dim)' }, cfg.yLabel ? esc(cfg.yLabel) : ''))

  if (cfg.chartType === 'pie') {
    var total = 0
    for (var i = 0; i < rows.length; i++) total += rows[i].value
    var cx = W / 2, cy = T + PH / 2, r = Math.min(PW, PH) / 2 - 8
    var angle = -Math.PI / 2
    rows.forEach(function (row, i) {
      var slice = total > 0 ? row.value / total : 0
      var next = angle + slice * Math.PI * 2
      var large = slice > 0.5 ? 1 : 0
      var x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle)
      var x2 = cx + r * Math.cos(next), y2 = cy + r * Math.sin(next)
      if (slice >= 0.9999) {
        plot.appendChild(svg('circle', { cx: cx, cy: cy, r: r, fill: 'var(--viz-series-' + (i % 6 + 1) + ')', stroke: 'var(--vz-surface)', 'stroke-width': 2 }))
      } else if (slice > 0) {
        plot.appendChild(svg('path', {
          d: 'M' + cx + ',' + cy + ' L' + x1.toFixed(2) + ',' + y1.toFixed(2) + ' A' + r + ',' + r + ' 0 ' + large + ' 1 ' + x2.toFixed(2) + ',' + y2.toFixed(2) + ' Z',
          fill: 'var(--viz-series-' + (i % 6 + 1) + ')', stroke: 'var(--vz-surface)', 'stroke-width': 2,
        }))
      }
      angle = next
    })
    var lx = W - 150
    rows.slice(0, 10).forEach(function (row, i) {
      var ly = T + 14 + i * 18
      plot.appendChild(svg('rect', { x: lx, y: ly - 8, width: 11, height: 11, fill: 'var(--viz-series-' + (i % 6 + 1) + ')' }))
      plot.appendChild(svg('text', { x: lx + 16, y: ly + 2, 'font-size': 11, fill: 'var(--vz-text)' }, esc(row.key) + '  ' + fmt(row.value)))
    })
  } else {
    var n = rows.length
    var barW = cfg.chartType === 'bar' ? Math.max(2, PW / n * 0.72) : 0
    var pts = []
    rows.forEach(function (row, i) {
      var cx = L + PW * (n === 1 ? 0.5 : i / (n - 1))
      var y = T + PH * (1 - row.value / top)
      if (cfg.chartType === 'bar') {
        plot.appendChild(svg('rect', {
          x: cx - barW / 2, y: y, width: barW, height: T + PH - y,
          fill: 'var(--viz-series-' + (i % 6 + 1) + ')',
        }))
      } else {
        pts.push(cx.toFixed(1) + ',' + y.toFixed(1))
      }
      var label = String(row.key)
      if (label.length > 12) label = label.slice(0, 11) + '…'
      var step = Math.ceil(n / Math.max(4, Math.floor(PW / 46)))
      if (i % step === 0 || n <= 8) {
        plot.appendChild(svg('text', {
          x: cx, y: T + PH + 16, 'font-size': 10.5, fill: 'var(--vz-dim)', 'text-anchor': 'end',
          transform: 'rotate(-38 ' + cx.toFixed(1) + ' ' + (T + PH + 16) + ')',
        }, esc(label)))
      }
    })
    if (cfg.chartType === 'line') {
      plot.appendChild(svg('polyline', { points: pts.join(' '), fill: 'none', stroke: 'var(--viz-series-1)', 'stroke-width': 2, 'stroke-linejoin': 'round' }))
      rows.forEach(function (row, i) {
        var cx = L + PW * (n === 1 ? 0.5 : i / (n - 1))
        var y = T + PH * (1 - row.value / top)
        plot.appendChild(svg('circle', { cx: cx.toFixed(1), cy: y.toFixed(1), r: 2.5, fill: 'var(--viz-series-1)' }))
      })
    }
  }

  el.appendChild(plot)
  cap.textContent = rows.length + ' グループ / 集計: ' + cfg.chartType
})()
  </script>
</div>`
}

/** Minimal HTML escaping for text that lands inside a fragment. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * One call of the `visualize_csv` pipeline: parse, validate, aggregate, build
 * the fragment. The tool's execute reads the file, calls this, and writes the
 * result — all decisions live here so they are testable without a Harness.
 * @param text - raw CSV/TSV text.
 * @param options - { title, groupBy, aggregate, func, chartType, yLabel, maxGroups }.
 * @returns { header, rowCount, delimiter, data, html }
 */
export function buildCsvChart(text, options = {}) {
  const {
    title = 'csv chart',
    groupBy,
    aggregate = '',
    func = 'sum',
    chartType = 'bar',
    yLabel = '',
    maxGroups = 512,
  } = options

  if (typeof groupBy !== 'string' || groupBy.trim() === '') {
    throw new Error('visualize_csv: group_by is required')
  }
  const f = FUNCS.includes(func) ? func : undefined
  if (f === undefined) throw new Error(`visualize_csv: func must be one of ${FUNCS.join(', ')}`)
  const agg = f === 'count' ? '' : String(aggregate ?? '').trim()
  if (f !== 'count' && agg === '') {
    throw new Error(`visualize_csv: aggregate column is required for ${f}`)
  }

  const { header, rows, delimiter } = parseCsv(text)
  if (rows.length === 0) throw new Error('visualize_csv: csv has no data rows')
  const missing = [groupBy.trim(), agg].filter(c => c !== '' && !header.includes(c))
  if (missing.length > 0) {
    throw new Error(`visualize_csv: column(s) not in header [${header.join(', ')}]: ${missing.join(', ')}`)
  }

  const data = groupAggregate(rows, groupBy.trim(), agg, f)
  if (data.length === 0) throw new Error('visualize_csv: aggregation produced no rows')
  if (data.length > maxGroups) {
    throw new Error(`visualize_csv: ${data.length} groups would not stay legible; bin or filter the csv first`)
  }

  const html = chartFragment(String(title), data, chartType, yLabel)
  return { header, rowCount: rows.length, delimiter, data, html }
}
