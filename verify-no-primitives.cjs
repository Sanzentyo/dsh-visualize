// 新しいプラグインクライアントが primitives に依存していないことを確認する。
const { readFileSync } = require('node:fs')
const src = readFileSync('client.js', 'utf8')
console.log('requires primitives:', src.includes('@deepseek-ai/dsh-client-ui-primitives'))
console.log('FRAME_SCRIPT defined:', src.includes('const FRAME_SCRIPT'))
console.log('uses FRAME_SCRIPT in srcDoc:', src.includes('${FRAME_SCRIPT}'))
console.log('client.js bytes:', src.length)
