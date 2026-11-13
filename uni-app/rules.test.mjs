import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeCount,
  normalizeExtensions,
  isPdfOnly,
  extensionOf,
  fileMatches,
  sanitizeFileName,
  displayNameFor,
  resolveMime,
  buildStoredName,
  selectFiles
} from './rules.mjs'

test('normalizeCount defaults and floors', () => {
  assert.equal(normalizeCount(undefined), 1)
  assert.equal(normalizeCount(null), 1)
  assert.equal(normalizeCount(0), 1)
  assert.equal(normalizeCount(-2), 1)
  assert.equal(normalizeCount(Number.NaN), 1)
  assert.equal(normalizeCount(2.8), 2)
})

test('normalizeExtensions strips dots and empties', () => {
  assert.deepEqual(normalizeExtensions(['.PDF', ' Docx ', '.', null]), ['pdf', 'docx'])
  assert.deepEqual(normalizeExtensions(undefined), [])
})

test('isPdfOnly', () => {
  assert.equal(isPdfOnly(['.pdf']), true)
  assert.equal(isPdfOnly(['pdf', 'PDF']), true)
  assert.equal(isPdfOnly([]), false)
  assert.equal(isPdfOnly(['.pdf', '.doc']), false)
})

test('extensionOf and fileMatches', () => {
  assert.equal(extensionOf('a.B.Pdf'), 'pdf')
  assert.equal(extensionOf('noext'), '')
  assert.equal(fileMatches('a.pdf', '', ['pdf']), true)
  assert.equal(fileMatches('a.doc', '', ['pdf']), false)
  assert.equal(fileMatches('plain', 'application/pdf', ['pdf']), true)
  assert.equal(fileMatches('plain', 'text/plain', ['pdf']), false)
  assert.equal(fileMatches('any.bin', 'x', []), true)
})

test('sanitizeFileName and displayNameFor', () => {
  assert.equal(sanitizeFileName('a/b:c*.pdf'), 'a_b_c_.pdf')
  assert.equal(sanitizeFileName('my file.pdf'), 'my file.pdf')
  assert.equal(sanitizeFileName('a\u0001b.pdf'), 'a_b.pdf')
  assert.equal(displayNameFor('  report.pdf ', ''), 'report.pdf')
  assert.equal(displayNameFor('', 'application/pdf'), '附件.pdf')
  assert.equal(displayNameFor('', ''), '附件')
})

test('resolveMime and buildStoredName', () => {
  assert.equal(resolveMime('a.pdf', 'text/plain'), 'application/pdf')
  assert.equal(resolveMime('a.bin', 'image/png'), 'image/png')
  assert.equal(resolveMime('a.bin', ''), 'application/octet-stream')
  assert.equal(buildStoredName(10, 0, 'x.pdf', ''), '10-0-x.pdf')
})

test('selectFiles truncate success and filter miss', () => {
  const sources = [
    { name: 'a.pdf', mime: 'application/pdf', uri: '1' },
    { name: 'b.pdf', mime: 'application/pdf', uri: '2' },
    { name: 'c.doc', mime: 'application/msword', uri: '3' }
  ]
  const ok = selectFiles(sources, 1, ['.pdf'], (source, index) => ({
    name: source.name,
    path: '/cache/' + source.name,
    size: 1,
    mime: 'application/pdf'
  }))
  assert.equal(ok.ok, true)
  assert.equal(ok.files.length, 1)
  assert.equal(ok.truncated, true)

  const miss = selectFiles(sources, 2, ['.xlsx'], () => null)
  assert.equal(miss.ok, false)
  assert.equal(miss.errCode, 9010004)
})

test('selectFiles keeps extensionless names when mime is application/pdf', () => {
  const sources = [
    { name: 'Report', mime: 'application/pdf', uri: '1' },
    { name: 'Notes', mime: '', uri: '2' }
  ]
  const ok = selectFiles(sources, 2, ['.pdf'], (source) => ({
    name: source.name,
    path: '/cache/' + source.name,
    size: 1,
    mime: source.mime
  }))
  assert.equal(ok.ok, true)
  assert.equal(ok.files.length, 1)
  assert.equal(ok.files[0].name, 'Report')
  assert.equal(ok.files[0].mime, 'application/pdf')
})

test('selectFiles copy-all-fail is 9010003', () => {
  const sources = [{ name: 'a.pdf', mime: 'application/pdf', uri: '1' }]
  const fail = selectFiles(sources, 1, ['.pdf'], () => null)
  assert.equal(fail.ok, false)
  assert.equal(fail.errCode, 9010003)
})
