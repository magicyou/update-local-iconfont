const fs = require('fs')
const fsp = require('fs').promises
const path = require('path')

/**
 * 判断路径是否存在
 * @param {string} targetPath 路径
 * @returns {Promise<boolean>} true:存在;false:不存在
 */
async function existDir (targetPath) {
  return fsp.stat(targetPath).then(() => true).catch(() => false)
}

/**
 * 删除目录和目录下的所有文件
 * @param {string} folderPath 目录路径
 * @returns {Promise<void>}
 */
async function deleteFolderRecursive (folderPath) {
  await fsp.rm(folderPath, { recursive: true, force: true })
}

/**
 * 判断单个 zip 条目路径是否安全（防 zip-slip 目录穿越）
 * @param {string} name zip 内条目名称
 * @returns {boolean} true:安全;false:包含绝对路径或 .. 穿越
 */
function isSafeZipEntryName (name) {
  const normalized = String(name).replace(/\\/g, '/')
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    return false
  }
  return !normalized.split('/').some(segment => segment === '..')
}

/**
 * 读取 zip 中央目录，返回全部条目名称
 * 仅做安全校验用：解析失败（如 zip64、非标准 zip）时返回 null，交由解压环节兜底，保证向下兼容
 * @param {string} zipPath zip 文件路径
 * @returns {Promise<string[]|null>} 条目名称列表;无法解析时返回 null
 */
async function readZipEntryNames (zipPath) {
  let buf
  try {
    buf = await fsp.readFile(zipPath)
  } catch (_) {
    return null
  }

  const EOCD_SIG = 0x06054b50
  const CEN_SIG = 0x02014b50
  const EOCD_MIN_LEN = 22

  if (buf.length < EOCD_MIN_LEN) {
    return null
  }

  // 从文件尾部回溯查找 End of Central Directory 记录（最多回溯 65557 字节）
  let eocd = -1
  const scanFrom = Math.max(EOCD_MIN_LEN - 1, buf.length - 65557)
  for (let i = buf.length - EOCD_MIN_LEN; i >= scanFrom; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i
      break
    }
  }
  if (eocd < 0) {
    return null
  }

  const total = buf.readUInt16LE(eocd + 10)
  const cenOffset = buf.readUInt32LE(eocd + 16)
  // zip64 特征值：超出本校验能力，返回 null 跳过校验（不影响正常解压）
  if (total === 0xffff || cenOffset === 0xffffffff) {
    return null
  }

  const names = []
  let p = cenOffset
  for (let i = 0; i < total; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== CEN_SIG) {
      return null
    }
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    if (p + 46 + nameLen > buf.length) {
      return null
    }
    names.push(buf.toString('utf8', p + 46, p + 46 + nameLen))
    p += 46 + nameLen + extraLen + commentLen
  }
  return names
}

/**
 * 校验 zip 全部条目名称是否安全
 * @param {string} zipPath zip 文件路径
 * @returns {Promise<{safe: boolean, reason: string|null}>} 校验结果
 */
async function checkZipSafe (zipPath) {
  const names = await readZipEntryNames(zipPath)
  if (names === null) {
    // 无法解析时不做拦截，保持与旧版本一致的兼容行为
    return { safe: true, reason: null }
  }
  const bad = names.find(name => !isSafeZipEntryName(name))
  if (bad !== undefined) {
    return { safe: false, reason: bad }
  }
  return { safe: true, reason: null }
}

/**
 * 从 iconfont 错误页跳转地址中提取错误信息
 * iconfont 会把接口错误统一跳转到 /errors?...&data=<url编码的json>
 * @param {string} url 响应最终地址（跳转后）
 * @returns {object|null} 解析出的错误对象;无法解析返回 null
 */
function extractErrorPayload (url) {
  try {
    const data = new URL(url).searchParams.get('data')
    if (!data) {
      return null
    }
    const payload = JSON.parse(data)
    return payload && typeof payload === 'object' ? payload : null
  } catch (_) {
    return null
  }
}

/**
 * 诊断下载失败原因，返回可区分、可操作的错误提示
 * @param {object} info 下载响应信息
 * @param {number} info.status HTTP 状态码
 * @param {string} info.url 响应最终地址（跳转后）
 * @param {string} info.contentType 响应 Content-Type
 * @param {Buffer} info.body 响应内容
 * @returns {string} 错误提示文案
 */
function diagnoseDownloadFailure ({ status = 200, url = '', contentType = '', body = Buffer.alloc(0) } = {}) {
  const PREFIX = 'iconfont 下载失败'

  // 1. HTTP 层错误
  if (status === 401 || status === 403) {
    return `${PREFIX}: HTTP ${status}，cookie 无效或已过期，请重新登录 iconfont 后复制完整 cookie`
  }
  if (status === 404) {
    return `${PREFIX}: HTTP 404，下载地址不正确，请从 iconfont 项目页重新复制「下载至本地」的完整 url`
  }
  if (status < 200 || status >= 300) {
    return `${PREFIX}: HTTP ${status}，请检查下载地址与 cookie`
  }

  // 2. iconfont 统一错误页 payload（精确区分 url / cookie 问题）
  const payload = extractErrorPayload(url)
  if (payload) {
    const code = payload.code
    const errorCode = String(payload.error_code || '')
    const msg = String(payload.message || errorCode || '')
    if (/LOGIN/i.test(errorCode) || /LOGIN/i.test(msg) || code === 401 || code === 403) {
      return `${PREFIX}: cookie 无效或已过期（接口返回 ${errorCode || msg || 'LOGIN REQUIRED'}），请重新登录 iconfont 后复制完整 cookie`
    }
    if (code === 404) {
      return `${PREFIX}: 下载地址不正确（接口返回 404: ${msg || '找不到这个项目'}），请从 iconfont 项目页重新复制「下载至本地」的完整 url`
    }
    return `${PREFIX}: 接口返回错误（${[code, msg].filter(Boolean).join(': ')}）`
  }

  // 3. 被重定向到登录页
  if (/\/login/i.test(url)) {
    return `${PREFIX}: 请求被重定向到登录页，cookie 无效或已过期，请重新登录 iconfont 后复制完整 cookie`
  }

  // 4. JSON 响应体
  if (/json/i.test(contentType)) {
    const text = body.toString('utf8').trim().replace(/\s+/g, ' ')
    return `${PREFIX}: 接口返回错误（${text.slice(0, 120)}），请检查下载地址与 cookie`
  }

  // 5. 网页内容兜底：无错误 payload 的 HTML（常见于 url 路径写错，接口不存在）
  const text = body.toString('utf8')
  if (/html/i.test(contentType) || /^\s*(<!doctype|<html)/i.test(text)) {
    return `${PREFIX}: 下载内容不是 zip 文件（接口返回了网页内容），请检查 url 是否完整正确（应为 iconfont「下载至本地」的接口地址）、cookie 是否有效`
  }

  // 6. 其它内容兜底
  return `${PREFIX}: 下载内容不是 zip 文件（content-type: ${contentType || '未知'}），请检查下载地址与 cookie 是否正确`
}

module.exports = {
  existDir,
  deleteFolderRecursive,
  isSafeZipEntryName,
  readZipEntryNames,
  checkZipSafe,
  extractErrorPayload,
  diagnoseDownloadFailure,
  // 兼容旧版本内部使用
  isFile: async filePath => fs.promises.stat(filePath).then(stat => stat.isFile()).catch(() => false),
}
