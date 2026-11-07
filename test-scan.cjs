// FRAME_RUNTIME リテラルの閉じバッククォートを走査で見つける。
const { readFileSync } = require('node:fs')
const client = readFileSync('C:/Users/sanze/.dsh/profiles/reveng/node_modules/dsh-visualize/client.js', 'utf8')

const start = client.indexOf('const FRAME_RUNTIME = `')
console.log('literal starts at:', start)
let i = start + 'const FRAME_RUNTIME = `'.length // 開始バッククォートの次
let out = ''
let closedAt = -1
while (i < client.length) {
  const c = client[i]
  if (c === '\\') { out += client.slice(i, i + 2); i += 2; continue }
  if (c === '`') { closedAt = i; break }
  out += c
  i++
}
console.log('closed at:', closedAt)
console.log('body length:', out.length)
console.log('body first 80:', JSON.stringify(out.slice(0, 80)))
console.log('body last 80:', JSON.stringify(out.slice(-80)))
