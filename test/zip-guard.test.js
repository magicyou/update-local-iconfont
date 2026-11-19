'use strict'

const test = require('node:test')
const assert = require('node:assert')
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { createStoredZip } = require('./helpers')
const {
  isSafeZipEntryName,
  readZipEntryNames,
  checkZipSafe,
} = require('../lib/utils')

function tmpZipFile (buf) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uli-zip-test-'))
  const file = path.join(dir, 'test.zip')
  fs.writeFileSync(file, buf)
  return file
}

test('isSafeZipEntryName: 正常路径', () => {
  assert.strictEqual(isSafeZipEntryName('iconfont_abc/iconfont.css'), true)
  assert.strictEqual(isSafeZipEntryName('iconfont.css'), true)
  assert.strictEqual(isSafeZipEntryName('a/b/c/d.png'), true)
})

test('isSafeZipEntryName: 拒绝目录穿越与绝对路径', () => {
  assert.strictEqual(isSafeZipEntryName('../evil.txt'), false)
  assert.strictEqual(isSafeZipEntryName('a/../../evil.txt'), false)
  assert.strictEqual(isSafeZipEntryName('a\\..\\evil.txt'), false)
  assert.strictEqual(isSafeZipEntryName('/etc/passwd'), false)
  assert.strictEqual(isSafeZipEntryName('C:\\Windows\\evil.txt'), false)
})

test('readZipEntryNames: 解析条目名称', async () => {
  const buf = createStoredZip([
    { name: 'iconfont_abc/iconfont.css', data: 'body{}' },
    { name: 'iconfont_abc/iconfont.woff', data: Buffer.from([1, 2, 3]) },
    { name: 'iconfont_abc/demo_index.html', data: '<html></html>' },
  ])
  const names = await readZipEntryNames(tmpZipFile(buf))
  assert.deepStrictEqual(names, [
    'iconfont_abc/iconfont.css',
    'iconfont_abc/iconfont.woff',
    'iconfont_abc/demo_index.html',
  ])
})

test('readZipEntryNames: 非 zip 内容返回 null', async () => {
  const names = await readZipEntryNames(tmpZipFile(Buffer.from('<html>login</html>')))
  assert.strictEqual(names, null)
})

test('checkZipSafe: 安全包通过', async () => {
  const buf = createStoredZip([
    { name: 'iconfont_abc/iconfont.css', data: 'body{}' },
  ])
  const res = await checkZipSafe(tmpZipFile(buf))
  assert.deepStrictEqual(res, { safe: true, reason: null })
})

test('checkZipSafe: 含穿越条目被拦截', async () => {
  const buf = createStoredZip([
    { name: 'iconfont_abc/iconfont.css', data: 'body{}' },
    { name: '../evil.txt', data: 'hacked' },
  ])
  const res = await checkZipSafe(tmpZipFile(buf))
  assert.strictEqual(res.safe, false)
  assert.strictEqual(res.reason, '../evil.txt')
})

test('checkZipSafe: 无法解析时放行（保持兼容）', async () => {
  const res = await checkZipSafe(tmpZipFile(Buffer.from('not a zip')))
  assert.deepStrictEqual(res, { safe: true, reason: null })
})
