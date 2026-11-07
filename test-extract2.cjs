// client.js からのリテラル抽出をテストする。
const { readFileSync } = require('node:fs')
const client = readFileSync('C:/Users/sanze/.dsh/profiles/reveng/node_modules/dsh-visualize/client.js', 'utf8')

// 1) 改行+バッククォート の出現位置を数える
const positions = []
let idx = 0
while ((idx = client.indexOf('\n`', idx)) !== -1) { positions.push(idx); idx++ }
console.log('newline+backtick occurrences:', positions.length)
console.log('last one at:', positions[positions.length - 1], '/ file length:', client.length)

// 2) 正規表現で抽出を試す
const m = client.match(/const FRAME_RUNTIME = `([\s\S]*?)\n`/)
console.log('regex match:', m ? `yes, ${m[1].length} chars` : 'NO')

// 3) 開始位置から「改行+バッククォート」までを単純に切り出す
const start = client.indexOf('const FRAME_RUNTIME = `') + 'const FRAME_RUNTIME = `'.length
const end = client.indexOf('\n`', start)
console.log('slice approach:', start, '->', end, '=', end > start ? `${end - start} chars` : 'FAILED')
if (end > start) {
  const body = client.slice(start, end)
  console.log('body starts with:', JSON.stringify(body.slice(0, 60)))
  console.log('body ends with:', JSON.stringify(body.slice(-60)))
}
