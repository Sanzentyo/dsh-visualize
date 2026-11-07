// 修正済みプロファイル client.js からフェンスページを組み立てる(Mac 検証用)。
const { readFileSync, writeFileSync } = require('node:fs')
const client = readFileSync('C:/Users/sanze/.dsh/profiles/reveng/node_modules/dsh-visualize/client.js', 'utf8')

/**
 * テンプレートリテラルの本体を走査で取り出す。
 * エスケープされたバッククォートを読み飛ばし、生のバッククォートで終端とする。
 */
function scan(text, name) {
  const marker = `const ${name} = \``
  const start = text.indexOf(marker) + marker.length
  let i = start
  let out = ''
  while (i < text.length) {
    const c = text[i]
    if (c === '\\') { out += text.slice(i, i + 2); i += 2; continue }
    if (c === '`') return out
    out += c
    i++
  }
  return null
}

const rt = scan(client, 'FRAME_RUNTIME')
const ch = scan(client, 'FRAME_CHART')
console.log('runtime:', rt ? rt.length : 'null', '/ chart:', ch ? ch.length : 'null')
if (!rt || !ch) process.exit(1)

const page = '<!doctype html><html><head><meta charset="utf-8">'
  + '<style>:root { --vz-text:#e8e8e8; --vz-dim:#8a8a8a; --vz-surface:#1e1e1e; --vz-border:#3a3a3a; --vz-accent:#3b82f6; --vz-font-size:14px; --viz-series-1:#3b82f6; }'
  + ' body { margin: 24px; background: #141414; color: var(--vz-text); }</style></head><body>'
  + '<div id="chart"></div>'
  + '<script>' + rt + ';\n' + ch + '</script>'
  + '<script>viz.chart(document.getElementById("chart"), { type: "bar", columns: ["項目", "値"], rows: [["A", 10], ["B", 20], ["C", 30]], yLabel: "値", height: 200 })</script>'
  + '</body></html>'

writeFileSync('C:/Users/sanze/Documents/RevEng/_session_read/fence_page.html', page, 'utf8')
console.log('written: fence_page.html,', page.length, 'bytes')
