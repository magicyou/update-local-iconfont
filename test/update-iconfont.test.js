'use strict'

const test = require('node:test')
const assert = require('node:assert')
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { createIconfontZip } = require('./helpers')
const UpdateIconfont = require('../index')

const COOKIE = 'test-cookie-value'

/**
 * 启动一个模拟 iconfont 下载接口的本地服务
 * @param {Buffer} body 响应内容
 * @param {object} opts 选项
 * @returns {Promise<import('http').Server>}
 */
function startServer (body, { status = 200, checkCookie = true } = {}) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      if (checkCookie && req.headers.cookie !== COOKIE) {
        res.writeHead(401)
        res.end('please login')
        return
      }
      res.writeHead(status, { 'Content-Type': 'application/octet-stream' })
      res.end(status === 200 ? body : 'error')
    })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

/**
 * 创建测试用目录
 * @returns {{root: string, output: string}} 测试目录
 */
function makeDirs () {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uli-test-'))
  const output = path.join(root, 'src', 'assets', 'iconfont')
  fs.mkdirSync(output, { recursive: true })
  return { root, output }
}

/**
 * 构造实例
 */
function makeInstance (server, dirs, overrides = {}) {
  return new UpdateIconfont({
    url: `http://127.0.0.1:${server.address().port}/download`,
    cookie: COOKIE,
    output: dirs.output,
    runDir: dirs.root,
    ...overrides,
  })
}

test('入口保持向下兼容：module.exports 是构造函数', () => {
  assert.strictEqual(typeof UpdateIconfont, 'function')
  assert.strictEqual(UpdateIconfont.UpdateIconfont, UpdateIconfont)
  assert.strictEqual(UpdateIconfont.default, UpdateIconfont)
})

test('main() 完整流程：下载 -> 解压 -> 拷贝 -> 清理临时目录', async () => {
  const files = {
    'iconfont.css': '.icon-home:before { content: "\\e001"; }',
    'iconfont.woff': Buffer.from([0x77, 0x4f, 0x46, 0x46]),
    'iconfont.ttf': Buffer.from([0x00, 0x01, 0x00, 0x00]),
    'demo_index.html': '<html>demo</html>',
  }
  const zip = createIconfontZip('iconfont_abc123', files)
  const server = await startServer(zip)
  const dirs = makeDirs()

  try {
    const update = makeInstance(server, dirs)
    const result = await update.main()
    assert.strictEqual(result, true)

    for (const [name, content] of Object.entries(files)) {
      const target = path.join(dirs.output, name)
      assert.ok(fs.existsSync(target), `缺少文件: ${name}`)
      const actual = fs.readFileSync(target)
      assert.deepStrictEqual(actual, Buffer.isBuffer(content) ? content : Buffer.from(content))
    }
    // 临时目录已清理
    assert.strictEqual(fs.existsSync(update.tempDir), false)
  } finally {
    server.close()
    fs.rmSync(dirs.root, { recursive: true, force: true })
  }
})

test('main() 多文件拷贝完整性（拷贝竞态回归）', async () => {
  const files = {}
  for (let i = 0; i < 30; i++) {
    files[`f-${i}.css`] = `.icon-${i} { content: "${i}"; }`
  }
  files['sub/nested.txt'] = 'nested content'
  const zip = createIconfontZip('iconfont_multi', files)
  const server = await startServer(zip)
  const dirs = makeDirs()

  try {
    const result = await makeInstance(server, dirs).main()
    assert.strictEqual(result, true)
    for (const [name, content] of Object.entries(files)) {
      const target = path.join(dirs.output, name)
      assert.ok(fs.existsSync(target), `缺少文件: ${name}`)
      assert.strictEqual(fs.readFileSync(target, 'utf8'), content)
    }
  } finally {
    server.close()
    fs.rmSync(dirs.root, { recursive: true, force: true })
  }
})

test('main() 参数缺失时返回 false 且不抛异常', async () => {
  const dirs = makeDirs()
  try {
    assert.strictEqual(await new UpdateIconfont({ cookie: COOKIE, output: dirs.output, runDir: dirs.root }).main(), false)
    assert.strictEqual(await new UpdateIconfont({ url: 'http://x', output: dirs.output, runDir: dirs.root }).main(), false)
  } finally {
    fs.rmSync(dirs.root, { recursive: true, force: true })
  }
})

test('main() output 目录不存在时自动创建（绝对路径，用户真实用法）', async () => {
  const zip = createIconfontZip('iconfont_abc', { 'iconfont.css': 'body{}' })
  const server = await startServer(zip)
  // 模拟全新项目：src/assets/iconfont 尚未创建，output 为绝对路径
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uli-test-'))
  const output = path.join(root, 'src', 'assets', 'iconfont')
  assert.strictEqual(fs.existsSync(output), false)

  try {
    const update = makeInstance(server, { root, output })
    const { result, text } = await withCapturedLogs(() => update.main())
    assert.strictEqual(result, true)
    assert.strictEqual(fs.statSync(output).isDirectory(), true)
    assert.ok(fs.existsSync(path.join(output, 'iconfont.css')))
    assert.match(text, /已自动创建/)
  } finally {
    server.close()
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('main() output 为相对路径且不存在时基于 runDir 自动创建', async () => {
  const zip = createIconfontZip('iconfont_abc', { 'iconfont.css': 'body{}' })
  const server = await startServer(zip)
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uli-test-'))
  try {
    const update = new UpdateIconfont({
      url: `http://127.0.0.1:${server.address().port}/download`,
      cookie: COOKIE,
      output: 'src/assets/iconfont',
      runDir: root,
    })
    assert.strictEqual(await update.main(), true)
    assert.ok(fs.existsSync(path.join(root, 'src', 'assets', 'iconfont', 'iconfont.css')))
  } finally {
    server.close()
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('main() output 路径被同名文件占用时返回 false', async () => {
  const zip = createIconfontZip('iconfont_abc', { 'iconfont.css': 'body{}' })
  const server = await startServer(zip)
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uli-test-'))
  const output = path.join(root, 'src', 'assets', 'iconfont')
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, 'i am a file, not a dir')

  try {
    const update = makeInstance(server, { root, output })
    const { result, text } = await withCapturedLogs(() => update.main())
    assert.strictEqual(result, false)
    assert.match(text, /输出目录异常/)
  } finally {
    server.close()
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('main() 下载失败（HTTP 500）返回 false 且不残留临时目录', async () => {
  const server = await startServer(Buffer.alloc(0), { status: 500 })
  const dirs = makeDirs()
  try {
    const update = makeInstance(server, dirs)
    assert.strictEqual(await update.main(), false)
    assert.strictEqual(fs.existsSync(update.tempDir), false)
  } finally {
    server.close()
    fs.rmSync(dirs.root, { recursive: true, force: true })
  }
})

test('main() cookie 校验失败返回 false', async () => {
  const zip = createIconfontZip('iconfont_abc', { 'a.css': 'a{}' })
  const server = await startServer(zip)
  const dirs = makeDirs()
  try {
    const update = makeInstance(server, dirs, { cookie: 'wrong-cookie' })
    assert.strictEqual(await update.main(), false)
  } finally {
    server.close()
    fs.rmSync(dirs.root, { recursive: true, force: true })
  }
})

test('main() 响应不是 zip（cookie 过期返回登录页）返回 false 且不残留临时目录', async () => {
  const server = await startServer(Buffer.from('<html>login</html>'), { checkCookie: false })
  const dirs = makeDirs()
  try {
    const update = makeInstance(server, dirs)
    assert.strictEqual(await update.main(), false)
    assert.strictEqual(fs.existsSync(update.tempDir), false)
  } finally {
    server.close()
    fs.rmSync(dirs.root, { recursive: true, force: true })
  }
})

test('main() 拦截 zip-slip 恶意压缩包，不落盘到目标外', async () => {
  const { createStoredZip } = require('./helpers')
  const zip = createStoredZip([
    { name: 'iconfont_abc/iconfont.css', data: 'body{}' },
    { name: '../evil.txt', data: 'hacked' },
  ])
  const server = await startServer(zip)
  const dirs = makeDirs()
  try {
    const result = await makeInstance(server, dirs).main()
    assert.strictEqual(result, false)
    assert.strictEqual(fs.existsSync(path.join(dirs.root, 'evil.txt')), false)
    assert.strictEqual(fs.existsSync(path.join(path.dirname(dirs.output), 'evil.txt')), false)
  } finally {
    server.close()
    fs.rmSync(dirs.root, { recursive: true, force: true })
  }
})

/**
 * 捕获 message 输出（console.log），返回执行结果与全部日志文本
 */
async function withCapturedLogs (fn) {
  const logs = []
  const orig = console.log
  console.log = (...args) => logs.push(args.map(String).join(' '))
  try {
    const result = await fn()
    return { result, text: logs.join('\n') }
  } finally {
    console.log = orig
  }
}

/**
 * 模拟 iconfont 真实错误协议：302 跳转到 /errors?...&data=<json>，返回 HTML 错误页
 */
function startIconfontErrorServer (payload) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      if (req.url.startsWith('/errors')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<!DOCTYPE html><html><head><title>iconfont</title></head><body></body></html>')
        return
      }
      const data = encodeURIComponent(JSON.stringify(payload))
      res.writeHead(302, { Location: `/errors?path=%2Fapi%2Fproject%2Fdownload.zip&data=${data}` })
      res.end()
    })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

test('真实协议：url 错误（404: 找不到这个项目）→ 提示下载地址不正确', async () => {
  const server = await startIconfontErrorServer({ code: 404, message: '找不到这个项目' })
  const dirs = makeDirs()
  try {
    const update = makeInstance(server, dirs)
    const { result, text } = await withCapturedLogs(() => update.main())
    assert.strictEqual(result, false)
    assert.match(text, /下载地址不正确/)
    assert.match(text, /找不到这个项目/)
    assert.doesNotMatch(text, /cookie 无效/)
  } finally {
    server.close()
    fs.rmSync(dirs.root, { recursive: true, force: true })
  }
})

test('真实协议：cookie 错误（LOGIN REQUIRED）→ 提示 cookie 无效或已过期', async () => {
  const server = await startIconfontErrorServer({ code: 500, error_code: 'LOGIN REQUIRED', message: 'LOGIN REQUIRED' })
  const dirs = makeDirs()
  try {
    const update = makeInstance(server, dirs)
    const { result, text } = await withCapturedLogs(() => update.main())
    assert.strictEqual(result, false)
    assert.match(text, /cookie 无效或已过期/)
    assert.match(text, /LOGIN REQUIRED/)
    assert.doesNotMatch(text, /下载地址不正确/)
  } finally {
    server.close()
    fs.rmSync(dirs.root, { recursive: true, force: true })
  }
})

test('main() 不产生 unhandledRejection', async () => {
  let unhandled = 0
  const onUnhandled = () => { unhandled++ }
  process.on('unhandledRejection', onUnhandled)
  const dirs = makeDirs()
  try {
    // 触发 printdir/readdir 失败分支：空 zip 无法构造解压目录，直接用不可达地址
    const update = new UpdateIconfont({
      url: 'http://127.0.0.1:1/not-reachable',
      cookie: COOKIE,
      output: dirs.output,
      runDir: dirs.root,
      timeout: 1000,
    })
    assert.strictEqual(await update.main(), false)
    await new Promise(resolve => setImmediate(resolve))
    assert.strictEqual(unhandled, 0)
  } finally {
    process.off('unhandledRejection', onUnhandled)
    fs.rmSync(dirs.root, { recursive: true, force: true })
  }
})
