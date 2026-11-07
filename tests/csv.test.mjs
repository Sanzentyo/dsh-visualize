/**
 * Tests for lib/csv.js — the pure CSV/TSV parsing and aggregation half of the
 * `visualize_csv` pipeline. Run with `node --test tests/csv.test.mjs`.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv, groupAggregate, chartFragment, buildCsvChart, MAX_CSV_BYTES } from '../lib/csv.js'

const CSV = [
  'name,region,sales',
  '"A社",関東,120',
  '"B社",関西,80',
  '"C社",九州,45',
].join('\n')

test('parseCsv: plain comma CSV', () => {
  const { header, rows } = parseCsv(CSV)
  assert.deepEqual(header, ['name', 'region', 'sales'])
  assert.equal(rows.length, 3)
  assert.equal(rows[0].name, 'A社')
  assert.equal(rows[0].region, '関東')
  assert.equal(rows[0].sales, '120')
})

test('parseCsv: quoted fields with commas inside', () => {
  const csv = ['name,region,sales', '"A社","関東",120', '"B社","関西",80'].join('\n')
  const { rows } = parseCsv(csv)
  assert.equal(rows[0].name, 'A社')
  assert.equal(rows[0].region, '関東')
  assert.equal(rows[1].sales, '80')
})

test('parseCsv: escaped quotes inside a quoted field', () => {
  const csv = ['name,note', '"A社","""特別""",1'].join('\n')
  const { rows } = parseCsv(csv)
  assert.equal(rows[0].note, '"特別"')
})

test('parseCsv: CRLF line endings', () => {
  const csv = 'name,region,sales\r\n"A社",関東,120\r\n"B社",関西,80'
  const { rows } = parseCsv(csv)
  assert.equal(rows.length, 2)
  assert.equal(rows[1].sales, '80')
})

test('parseCsv: BOM is stripped', () => {
  const csv = '\uFEFF' + CSV
  const { rows } = parseCsv(csv)
  assert.equal(rows[0].name, 'A社')
})

test('parseCsv: TSV (tab delimiter)', () => {
  const tsv = ['name\tregion\tsales', 'A社\t関東\t120', 'B社\t関西\t80'].join('\n')
  const { rows } = parseCsv(tsv)
  assert.equal(rows[0].sales, '120')
  assert.equal(rows[1].region, '関西')
})

test('parseCsv: semicolon delimiter', () => {
  const csv = 'name;region;sales\nA社;関東;120\nB社;関西;80'
  const { rows } = parseCsv(csv)
  assert.equal(rows[1].sales, '80')
})

test('groupAggregate: sum / avg / count / min / max', () => {
  const rows = [
    { name: 'A社', region: '関東', sales: '120' },
    { name: 'B社', region: '関西', sales: '80' },
    { name: 'C社', region: '九州', sales: '45' },
  ]
  const sum = groupAggregate(rows, 'region', 'sales', 'sum')
  assert.deepEqual(sum.map(r => r.key), ['関西', '関東', '九州'])
  assert.equal(sum.find(r => r.key === '関東').value, 120)
  const avg = groupAggregate(rows, 'region', 'sales', 'avg')
  assert.equal(avg.find(r => r.key === '関東').value, 120)
  const cnt = groupAggregate(rows, 'region', 'sales', 'count')
  assert.equal(cnt.find(r => r.key === '関東').value, 1)
  const mn = groupAggregate(rows, 'region', 'sales', 'min')
  assert.equal(mn.find(r => r.key === '九州').value, 45)
  const mx = groupAggregate(rows, 'region', 'sales', 'max')
  assert.equal(mx.find(r => r.key === '関東').value, 120)
})

test('groupAggregate: missing column throws', () => {
  const rows = [{ name: 'A社', region: '関東' }]
  assert.throws(() => groupAggregate(rows, 'area', 'sales', 'sum'), /no numeric/)
})

test('buildCsvChart: missing column throws', () => {
  assert.throws(
    () => buildCsvChart('name,region\nA社,関東\n', { title: 'x', groupBy: 'region', aggregate: 'sales', func: 'sum' }),
    /not in header/,
  )
})

test('groupAggregate: empty rows return an empty list', () => {
  assert.deepEqual(groupAggregate([], 'region', 'sales', 'sum'), [])
})

test('buildCsvChart: empty csv throws', () => {
  assert.throws(
    () => buildCsvChart('name,region,sales\n', { title: 'x', groupBy: 'region', aggregate: 'sales', func: 'sum' }),
    /no data rows/,
  )
})

test('chartFragment: rejects an unknown chart type', () => {
  assert.throws(() => chartFragment('x', [], 'heatmap'), /chart_type must be one of/)
})
