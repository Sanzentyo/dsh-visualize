import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolve } from 'node:path'
import { assertHtml, assertMode, assertTitle, destination, MAX_BYTES } from '../lib/validate.js'

describe('assertTitle', () => {
  it('accepts a lowercase slug', () => {
    assert.equal(assertTitle('cache-hit-rate'), 'cache-hit-rate')
    assert.equal(assertTitle('  a1  '), 'a1')
  })

  it('rejects anything that cannot be a file name', () => {
    for (const bad of ['', 'Upper', 'has space', 'has_underscore', 'a/b', '../x', '-lead', 'x'.repeat(65)]) {
      assert.throws(() => assertTitle(bad), /lowercase ASCII slug/, `expected ${JSON.stringify(bad)} to be rejected`)
    }
  })
})

describe('assertHtml', () => {
  it('accepts a fragment', () => {
    const html = '<div id="viz"><canvas></canvas></div>'
    assert.equal(assertHtml(html), html)
  })

  it('rejects an empty fragment', () => {
    assert.throws(() => assertHtml('   '), /html is empty/)
    assert.throws(() => assertHtml(undefined), /html is empty/)
  })

  it('rejects a whole document', () => {
    for (const bad of ['<!doctype html><div></div>', '<html><div></div>', '<head></head>', '<body></body>']) {
      assert.throws(() => assertHtml(bad), /fragment only/, `expected ${JSON.stringify(bad)} to be rejected`)
    }
  })

  it('rejects an oversized fragment', () => {
    assert.throws(() => assertHtml('x'.repeat(MAX_BYTES + 1)), /exceeds/)
  })

  it('measures bytes, not code units', () => {
    // Three-byte characters: 400k of them is over the limit even though the
    // string is shorter than MAX_BYTES code units.
    const wide = 'あ'.repeat(Math.ceil(MAX_BYTES / 3) + 1)
    assert.ok(wide.length < MAX_BYTES)
    assert.throws(() => assertHtml(wide), /exceeds/)
  })
})

describe('assertMode', () => {
  it('defaults to regular', () => {
    assert.equal(assertMode(undefined), 'regular')
  })

  it('accepts the two declared modes', () => {
    assert.equal(assertMode('regular'), 'regular')
    assert.equal(assertMode('wide'), 'wide')
  })

  it('rejects anything else', () => {
    assert.throws(() => assertMode('fullscreen'), /mode must be one of/)
  })
})

describe('destination', () => {
  it('defaults into the store directory', () => {
    assert.equal(destination('/home/.dsh/visualize', 'chart', undefined), resolve('/home/.dsh/visualize', 'chart.html'))
  })

  it('resolves a relative path against the store', () => {
    assert.equal(destination('/home/.dsh/visualize', 'chart', 'out/a.html'), resolve('/home/.dsh/visualize', 'out/a.html'))
  })

  it('keeps an absolute path', () => {
    const absolute = resolve('/elsewhere/b.html')
    assert.equal(destination('/home/.dsh/visualize', 'chart', absolute), absolute)
  })

  it('falls back to the store for a blank path', () => {
    assert.equal(destination('/home/.dsh/visualize', 'chart', '   '), resolve('/home/.dsh/visualize', 'chart.html'))
  })
})
