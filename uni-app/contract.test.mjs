import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))

test('dispatcher exports chooseNativeFile and avoids uni_modules plugin', () => {
  const index = readFileSync(join(root, 'index.ts'), 'utf8')
  assert.match(index, /export\s+function\s+chooseNativeFile|export\s+const\s+chooseNativeFile/)
  assert.doesNotMatch(index, /uni_modules\/yelo-u-file-picker/)
  assert.match(index, /APP-PLUS/)
  assert.match(index, /getSystemInfoSync\(\)\.platform/)
})

test('types declare required success fields and error codes', () => {
  const types = readFileSync(join(root, 'types.ts'), 'utf8')
  assert.match(types, /tempFiles/)
  assert.match(types, /tempFilePaths/)
  assert.match(types, /truncated/)
  assert.match(types, /9010001/)
  assert.match(types, /9010002/)
  assert.match(types, /9010003/)
  assert.match(types, /9010004/)
})

test('android copy never routes file bytes through a bridged byte[] buffer', () => {
  const android = readFileSync(join(root, 'android.ts'), 'utf8')
  assert.doesNotMatch(android, /reflect\.Array/)
  assert.doesNotMatch(android, /\.read\(\s*buffer/)
  assert.match(android, /android\.os\.FileUtils/)
})

test('ios opens the system file picker through plus.io.chooseFile', () => {
  const ios = readFileSync(join(root, 'ios.ts'), 'utf8')
  assert.match(ios, /chooseFile/)
  assert.match(ios, /chooseFile\(\s*\{/)
  assert.match(ios, /filetypes: pdfOnly \? \['pdf'\]/)
  assert.doesNotMatch(ios, /UIDocumentPickerViewController/)
  assert.doesNotMatch(ios, /presentViewController/)
  assert.match(ios, /setTimeout\(/)
  assert.match(ios, /9010001/)
})

test('drill form imports local native-file, not uni_modules picker', () => {
  const form = readFileSync(join(root, '../form/index.vue'), 'utf8')
  assert.match(form, /from ['"]\.\.\/native-file['"]/)
  assert.doesNotMatch(form, /uni_modules\/yelo-u-file-picker/)
  assert.match(form, /APP-PLUS/)
  assert.doesNotMatch(form, /APP-ANDROID|APP-IOS/)
  assert.match(form, /extension:\s*\[\s*['"]\.pdf['"]\s*\]/)
  assert.match(form, /errCode === 9010001/)
})
