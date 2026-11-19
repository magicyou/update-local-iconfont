'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { diagnoseDownloadFailure, extractErrorPayload } = require('../lib/utils')

// —— 以下 URL / 响应体为真实探测 iconfont 接口获得的样本 ——

// 场景①：url 错误（坏 pid）+ cookie 正确 → 跳转 /errors，payload 404
const ERRORS_URL_404 = 'https://www.iconfont.cn/errors?path=%2Fapi%2Fproject%2Fdownload.zip&data=%7B%22code%22%3A404%2C%22message%22%3A%22%E6%89%BE%E4%B8%8D%E5%88%B0%E8%BF%99%E4%B8%AA%E9%A1%B9%E7%9B%AE%22%7D'
// 场景②④：cookie 错误 / 缺失 → 跳转 /errors，payload LOGIN REQUIRED
const ERRORS_URL_LOGIN = 'https://www.iconfont.cn/errors?path=%2Fapi%2Fproject%2Fdownload.zip&data=%7B%22code%22%3A500%2C%22error_code%22%3A%22LOGIN%20REQUIRED%22%2C%22message%22%3A%22LOGIN%20REQUIRED%22%7D'
// 场景③：url 路径写错 → 不跳转，返回 HTML 壳
const PLAIN_HTML_URL = 'https://www.iconfont.cn/api/project/download.zip2?pid=3849745&ctoken=null'
const HTML_BODY = Buffer.from('<!DOCTYPE html><html lang="en"><head> <meta charset="UTF-8"> <title>iconfont-阿里巴巴矢量图标库</title>')
const HTML_TYPE = 'text/html; charset=utf-8'

test('extractErrorPayload: 解析 /errors 页 data 参数', () => {
  assert.deepStrictEqual(extractErrorPayload(ERRORS_URL_404), { code: 404, message: '找不到这个项目' })
  assert.deepStrictEqual(extractErrorPayload(ERRORS_URL_LOGIN), { code: 500, error_code: 'LOGIN REQUIRED', message: 'LOGIN REQUIRED' })
  assert.strictEqual(extractErrorPayload(PLAIN_HTML_URL), null)
  assert.strictEqual(extractErrorPayload('not a url'), null)
})

test('诊断①：url 错误（坏 pid）→ 提示下载地址不正确，含接口原始信息', () => {
  const msg = diagnoseDownloadFailure({ status: 200, url: ERRORS_URL_404, contentType: HTML_TYPE, body: HTML_BODY })
  assert.match(msg, /下载地址不正确/)
  assert.match(msg, /找不到这个项目/)
  assert.doesNotMatch(msg, /cookie 无效/)
})

test('诊断②：cookie 错误 → 提示 cookie 无效或已过期', () => {
  const msg = diagnoseDownloadFailure({ status: 200, url: ERRORS_URL_LOGIN, contentType: HTML_TYPE, body: HTML_BODY })
  assert.match(msg, /cookie 无效或已过期/)
  assert.match(msg, /LOGIN REQUIRED/)
  assert.doesNotMatch(msg, /下载地址不正确/)
})

test('诊断④：无 cookie 与 cookie 错误一致 → 提示 cookie 问题', () => {
  const msg = diagnoseDownloadFailure({ status: 200, url: ERRORS_URL_LOGIN, contentType: HTML_TYPE, body: HTML_BODY })
  assert.match(msg, /cookie/)
})

test('诊断③：url 路径写错（HTML 壳无 payload）→ 提示检查 url', () => {
  const msg = diagnoseDownloadFailure({ status: 200, url: PLAIN_HTML_URL, contentType: HTML_TYPE, body: HTML_BODY })
  assert.match(msg, /不是 zip 文件/)
  assert.match(msg, /检查 url 是否完整正确/)
})

test('两种错误提示必须可区分（用户反馈的核心诉求）', () => {
  const urlErr = diagnoseDownloadFailure({ status: 200, url: ERRORS_URL_404, contentType: HTML_TYPE, body: HTML_BODY })
  const cookieErr = diagnoseDownloadFailure({ status: 200, url: ERRORS_URL_LOGIN, contentType: HTML_TYPE, body: HTML_BODY })
  assert.notStrictEqual(urlErr, cookieErr)
  assert.match(urlErr, /url/i)
  assert.match(cookieErr, /cookie/i)
})

test('诊断：HTTP 404 → url 问题；HTTP 401/403 → cookie 问题', () => {
  assert.match(diagnoseDownloadFailure({ status: 404 }), /下载地址不正确/)
  assert.match(diagnoseDownloadFailure({ status: 401 }), /cookie 无效或已过期/)
  assert.match(diagnoseDownloadFailure({ status: 403 }), /cookie 无效或已过期/)
  assert.match(diagnoseDownloadFailure({ status: 502 }), /HTTP 502/)
})

test('诊断：重定向到登录页 → cookie 问题', () => {
  const msg = diagnoseDownloadFailure({ status: 200, url: 'https://www.iconfont.cn/login?redirect=%2Fapi', contentType: HTML_TYPE, body: HTML_BODY })
  assert.match(msg, /cookie 无效或已过期/)
})

test('诊断：JSON 响应体 → 展示接口错误内容', () => {
  const msg = diagnoseDownloadFailure({
    status: 200,
    url: 'https://www.iconfont.cn/api/project/download.zip',
    contentType: 'application/json; charset=utf-8',
    body: Buffer.from(JSON.stringify({ code: 500, message: '服务繁忙' })),
  })
  assert.match(msg, /服务繁忙/)
})

test('诊断：未知二进制内容 → 兜底提示', () => {
  const msg = diagnoseDownloadFailure({
    status: 200,
    url: 'https://www.iconfont.cn/api/project/download.zip',
    contentType: 'application/octet-stream',
    body: Buffer.from([0x00, 0x01, 0x02]),
  })
  assert.match(msg, /不是 zip 文件/)
  assert.match(msg, /application\/octet-stream/)
})
