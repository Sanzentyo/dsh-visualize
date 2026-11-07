// client.js のベンダリング済みリテラルを検証する。
const { readFileSync } = require('node:fs')
const src = readFileSync('client.js', 'utf8')

function grab(name) {
  const re = new RegExp(`const ${name} = \`([\\s\\S]*?)\``)
  const m = src.match(re)
  return m ? m[1] : null
}

const css = grab('FRAME_CSS')
const rt = grab('FRAME_RUNTIME')
const ch = grab('FRAME_CHART')

console.log('FRAME_CSS length:', css ? css.length : 'MISSING')
console.log('FRAME_RUNTIME length:', rt ? rt.length : 'MISSING')
console.log('FRAME_CHART length:', ch ? ch.length : 'MISSING')
console.log('runtime defines viz =', rt ? (rt.includes('window.viz') || rt.includes('viz.')) : false)
console.log('chart defines viz.chart =', ch ? ch.includes('viz.chart') : false)
