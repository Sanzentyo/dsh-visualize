// client.js から FRAME_RUNTIME / FRAME_CHART のリテラル本体を取り出す。
// テンプレートリテラル内にネストしたバッククォートがあるため、
// インデックス走査で開始位置から対応する閉じクォートを探す。
const { readFileSync, writeFileSync } = require('node:fs')

const client = readFileSync('C:/Users/sanze/.dsh/profiles/reveng/node_modules/dsh-visualize/client.js', 'utf8')

/**
 * 開始位置からテンプレートリテラルの閉じクォートを見つける。
 * エスケープ (\`) を読み飛ばし、生のバッククォートで終端とする。
 * @param text - 検索対象のソース。
 * @param start - リテラル開始バッククォートの位置。
 * @returns リテラル本体と、閉じクォートの次の位置。
 */
function scanLiteral(text, start) {
  let i = start + 1 // 開始バッククォートの次
  let out = ''
  while (i < text.length) {
    const c = text[i]
    if (c === '\\') { out += text.slice(i, i + 2); i += 2; continue }
    if (c === '`') return { body: out, end: i + 1 }
    out += c
    i++
  }
  throw new Error('closing backtick not found')
}

function grab(name) {
  const marker = `const ${name} = \``
  const start = client.indexOf(marker)
  if (start < 0) { console.error(`${name}: NOT FOUND`); return null }
  const { body } = scanLiteral(client, start + marker.length - 1)
  return body
}

const rt = grab('FRAME_RUNTIME')
const ch = grab('FRAME_CHART')
console.log('FRAME_RUNTIME:', rt ? `${rt.length} chars` : 'null')
console.log('FRAME_CHART:', ch ? `${ch.length} chars` : 'null')

if (rt && ch) {
  const page = `<!doctype html>
<html><head><meta charset="utf-8">
<style>
:root { --vz-text:#e8e8e8; --vz-dim:#8a8a8a; --vz-surface:#1e1e1e; --vz-border:#3a3a3a; --vz-accent:#3b82f6; --vz-font-size:14px; --viz-series-1:#3b82f6; }
body { margin: 24px; background: #141414; color: var(--vz-text); font-family: system-ui, sans-serif; }
</style></head>
<body>
<div id="chart"></div>
<script>${rt}
${ch}</script>
<script>
viz.chart(document.getElementById('chart'), {
  type: 'bar',
  columns: ['項目', '値'],
  rows: [['A', 10], ['B', 20], ['C', 30]],
  yLabel: '値',
  height: 200
})
</script>
</body></html>`
  writeFileSync('C:/Users/sanze/Documents/RevEng/_session_read/fence_page.html', page, 'utf8')
  console.log('written: fence_page.html,', page.length, 'bytes')
}
