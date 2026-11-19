'use strict'

/**
 * 测试辅助：手工构造 stored（不压缩）格式的 zip，用于确定性测试
 */

function crc32 (buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    let c = (crc ^ buf[i]) & 0xff
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * 生成 zip 文件内容
 * @param {Array<{name: string, data: Buffer|string}>} entries zip 内条目
 * @returns {Buffer} zip 文件内容
 */
function createStoredZip (entries) {
  const localParts = []
  const centralParts = []
  let offset = 0

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8')
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8')
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0) // 本地文件头签名
    local.writeUInt16LE(20, 4)         // version needed
    local.writeUInt16LE(0, 6)          // flags
    local.writeUInt16LE(0, 8)          // method: stored
    local.writeUInt16LE(0, 10)         // mod time
    local.writeUInt16LE(0x21, 12)      // mod date
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)         // extra len

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0) // 中央目录签名
    central.writeUInt16LE(20, 4)         // version made by
    central.writeUInt16LE(20, 6)         // version needed
    central.writeUInt16LE(0, 8)          // flags
    central.writeUInt16LE(0, 10)         // method
    central.writeUInt16LE(0, 12)         // mod time
    central.writeUInt16LE(0x21, 14)      // mod date
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30)         // extra len
    central.writeUInt16LE(0, 32)         // comment len
    central.writeUInt16LE(0, 34)         // disk number start
    central.writeUInt16LE(0, 36)         // internal attrs
    central.writeUInt32LE(0, 38)         // external attrs
    central.writeUInt32LE(offset, 42)    // local header offset

    localParts.push(local, nameBuf, data)
    centralParts.push(central, nameBuf)
    offset += local.length + nameBuf.length + data.length
  }

  const centralBuf = Buffer.concat(centralParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)         // End of Central Directory 签名
  eocd.writeUInt16LE(0, 4)                  // disk number
  eocd.writeUInt16LE(0, 6)                  // disk with central directory
  eocd.writeUInt16LE(entries.length, 8)     // 本磁盘条目数
  eocd.writeUInt16LE(entries.length, 10)    // 总条目数
  eocd.writeUInt32LE(centralBuf.length, 12) // central directory size
  eocd.writeUInt32LE(offset, 16)            // central directory offset
  eocd.writeUInt16LE(0, 20)                 // comment len

  return Buffer.concat([...localParts, centralBuf, eocd])
}

/**
 * 构造一个模拟 iconfont 下载包的 zip
 * @param {string} folderName 包内顶层目录名
 * @param {Record<string, string|Buffer>} files 文件名到内容的映射
 * @returns {Buffer} zip 文件内容
 */
function createIconfontZip (folderName, files) {
  return createStoredZip(
    Object.keys(files).map(name => ({
      name: folderName + '/' + name,
      data: files[name]
    }))
  )
}

module.exports = {
  crc32,
  createStoredZip,
  createIconfontZip,
}

// 自测：保证测试工具本身可用（仅当本文件被测试运行器直接执行时）
if (require.main === module) {
  const test = require('node:test')
  const assert = require('node:assert')

  test('helpers: crc32 与 zip 构造自测', () => {
    assert.strictEqual(crc32(Buffer.from('123456789')), 0xcbf43926)
    const buf = createIconfontZip('iconfont_x', { 'a.css': 'a{}' })
    assert.ok(buf.length > 30)
    assert.strictEqual(buf.readUInt32LE(0), 0x04034b50)
  })
}
