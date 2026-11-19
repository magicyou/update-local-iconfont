const path = require('path')
const os = require('os')
const fs = require('fs')
const fsp = require('fs').promises
const compressing = require('compressing')
const { existDir, deleteFolderRecursive, checkZipSafe, diagnoseDownloadFailure } = require('./utils')
const { copyDir } = require('./syncDir')
const message = require('./message')

/**
 * 是文件
 * @param {string} filePath 文件路径
 * @returns {Promise<boolean>} true:是;false:不是或不存在
 */
const isFile = async filePath => await fsp.stat(filePath).then(stat => stat.isFile()).catch(_ => false)

/**
 * 判断 buffer 是否是 zip 文件（本地文件头签名 PK\x03\x04 或空包 PK\x05\x06）
 * @param {Buffer} buf 文件内容
 * @returns {boolean}
 */
const isZipBuffer = buf => buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05) && (buf[3] === 0x04 || buf[3] === 0x06)

class UpdateIconfont {
  /**
   * 构造函数
   * @param {any} url iconfont 下载链接
   * @param {any} cookie iconfont登录后的cookie
   * @param {any} output iconfont输出目录
   * @param {any} runDir 当前运行目录（选填）
   * @param {any} timeout 下载超时时间，毫秒（选填，默认 120 秒）
   * @returns {any}
   */
  constructor ({ url = '', cookie = '', output = './', runDir = '', timeout = 120 * 1000 } = {}) {
    // 根目录：默认取项目根目录（node_modules/update-local-iconfont/lib 的上三级）
    const defaultRoot = path.join(__dirname, '../../../')
    if (!runDir) {
      this.rootPath = defaultRoot
    } else if (fs.existsSync(runDir)) {
      this.rootPath = path.resolve(runDir)
    } else {
      message.warning('runDir 不存在，已回退到默认运行目录: ' + defaultRoot)
      this.rootPath = defaultRoot
    }

    // 输出目录：已存在的目录直接使用；不存在时解析路径（后续自动创建）
    if (!output) {
      this.output = './'
      this.outputDir = path.resolve(this.rootPath, this.output)
    } else if (fs.existsSync(output)) {
      this.output = output
      this.outputDir = path.resolve(output)
    } else {
      // 相对路径基于 rootPath 解析；绝对路径直接使用（path.join 拼接绝对路径会产生错误路径）
      this.output = path.resolve(this.rootPath, output)
      this.outputDir = this.output
    }

    this.url = url
    this.cookie = cookie
    this.timeout = timeout
    // 临时文件统一放到系统临时目录下（避免写入 node_modules，兼容 pnpm / 只读安装）
    this.tempDir = path.join(os.tmpdir(), 'update-local-iconfont', `${process.pid}-${Math.random().toString(36).slice(2, 10)}`)
    this.downloadFile = path.join(this.tempDir, 'iconfont.zip')
    this.downloadFileDir = path.join(this.tempDir, 'iconfont')
  }

  /**
   * 删除临时目录和文件
   * @returns {Promise<void>}
   */
  async delTmp () {
    if (await existDir(this.tempDir)) {
      await deleteFolderRecursive(this.tempDir)
    }
    // 父目录为空时一并移除；有并发运行实例时不为空则忽略
    await fsp.rmdir(path.dirname(this.tempDir)).catch(() => {})
  }

  /**
   * 读取下载目录
   * @returns {Promise<string[]|false>} 目录内容;失败返回 false
   */
  async readdir () {
    try {
      return await fsp.readdir(this.downloadFileDir)
    } catch (_) {
      return false
    }
  }

  /**
   * 打印下载目录
   * @returns {Promise<void>}
   */
  async printdir () {
    const resReaddir = await this.readdir()
    if (!resReaddir || !resReaddir.length) {
      throw new Error('iconfont 目录读取失败')
    }
    const rootName = resReaddir[0]
    const dir = await fsp.readdir(path.join(this.downloadFileDir, rootName)).catch(() => [])
    message.info('|_ ' + rootName)
    for (let i = 0; i < dir.length; i++) {
      message.info('  |- ' + dir[i])
    }
  }

  /**
   * 从远端下载文件
   * @returns {Promise<boolean>} true:下载成功;false:失败
   */
  async downloadOrigin () {
    let response
    try {
      response = await fetch(this.url, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Cookie: this.cookie
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(this.timeout)
      })
    } catch (err) {
      message.error('iconfont 下载失败: 网络请求异常（' + (err && err.message ? err.message : err) + '），请检查 url 是否可达')
      return false
    }

    const data = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || ''

    if (!data.length) {
      message.error('iconfont 下载失败: 响应内容为空，请检查下载地址是否正确')
      return false
    }

    // iconfont 下载内容应为 zip；否则根据响应精确诊断失败原因（url 错误 / cookie 失效等）
    if (!response.ok || !isZipBuffer(data)) {
      message.error(diagnoseDownloadFailure({
        status: response.status,
        url: response.url,
        contentType,
        body: data,
      }))
      return false
    }

    // 拿到有效数据后再创建临时目录，失败分支不留垃圾目录
    await fsp.mkdir(this.tempDir, { recursive: true })
    await fsp.writeFile(this.downloadFile, data)
    return true
  }

  /**
   * 主函数
   * @returns {Promise<boolean>} true:更新成功;false:失败
   */
  async main () {
    try {
      return await this.run()
    } catch (err) {
      // 兜底：任何异常都转成受控输出，避免 unhandled rejection 导致进程崩溃
      message.error('iconfont 更新异常: ' + (err && err.message ? err.message : err))
      return false
    }
  }

  /**
   * 主流程
   * @returns {Promise<boolean>} true:更新成功;false:失败
   */
  async run () {
    if (!this.url) {
      message.error('请完善 iconfont 下载地址')
      return false
    }

    if (!this.cookie) {
      message.error('请完善下载 iconfont 的cookie')
      return false
    }

    if (!fs.existsSync(this.rootPath)) {
      message.error('脚本运行目录异常')
      return false
    }

    // 输出目录不存在时自动创建
    let createdDir
    try {
      createdDir = await fsp.mkdir(this.outputDir, { recursive: true })
    } catch (err) {
      message.error('iconfont 输出目录异常: ' + (err && err.message ? err.message : err))
      return false
    }
    if (createdDir) {
      message.info('输出目录不存在，已自动创建: ' + this.outputDir)
    }

    await this.delTmp()
    const downloadFinish = await this.downloadOrigin()
    if (!downloadFinish) {
      // 具体失败原因已由 downloadOrigin 输出
      return false
    }
    message.success('iconfont 下载完毕')

    // 解压前做 zip-slip 安全校验（解析失败时跳过，保持兼容）
    const zipSafe = await checkZipSafe(this.downloadFile)
    if (!zipSafe.safe) {
      message.error('iconfont 压缩包包含非法路径，已终止: ' + zipSafe.reason)
      await this.delTmp()
      return false
    }

    try {
      await compressing.zip.uncompress(this.downloadFile, this.downloadFileDir)
    } catch (err) {
      message.error('iconfont 解压失败: ' + (err && err.message ? err.message : err))
      await this.delTmp()
      return false
    }
    message.success('iconfont 解压完成')

    const resReaddir = await this.readdir()
    if (!resReaddir || !resReaddir.length) {
      message.error('iconfont 目录读取失败')
      return false
    }
    message.success('iconfont 目录读取成功')
    message.info('****** iconfont 目录 ******')
    await this.printdir()
    message.info('***************************')

    const cpRes = await copyDir(path.join(this.downloadFileDir, resReaddir[0]), this.outputDir)
    if (!cpRes) {
      message.error('更新iconfont出错, 排查output')
      return false
    }
    message.success('iconfont已更新')
    await this.delTmp()
    return true
  }
}

module.exports = UpdateIconfont
// 兼容 ESM / 解构取值的用法
module.exports.UpdateIconfont = UpdateIconfont
module.exports.default = UpdateIconfont
