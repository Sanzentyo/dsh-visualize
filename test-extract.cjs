// client.js の FRAME_RUNTIME リテラル抽出を直接テストする。
const { readFileSync } = require('node:fs')
const client = readFileSync('C:/Users/sanze/.dsh/profiles/reveng/node_modules/dsh-visualize/client.js', 'utf8')

const i = client.indexOf('const FRAME_RUNTIME')
console.log('start at:', i)
console.log('context:', JSON.stringify(client.slice(i, i + 40)))

// 閉じを探す: 改行 + バッククォート(セミコロン有無両方)
const re = /const FRAME_RUNTIME = `([\s\S]*?)\n`/
const m = client.match(re)
console.log('regex match:', m ? `yes, ${m[1].length} chars` : 'NO')

const re2 = /const FRAME_RUNTIME = `([\s\S]*?)\n`[;\n]/
const m2 = client.match(re2)
console.log('regex2 match:', m2 ? `yes, ${m2[1].length} chars` : 'NO')
