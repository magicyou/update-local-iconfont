const path = require('path')
const fs = require('fs')
const request = require('request')
const compressing = require('compressing')
const { existDir, deleteFolderRecursive } = require('./utils')
const { copyDir } = require('./syncDir')
const message = require('./message')



/**
 * 是文件
 * @param filePath 文件路径
 * @returns {Promise<boolean>} true:是;false:不是或不存在
 */
const isFile = async filePath => await fs.promises.stat(filePath).then(stat => stat.isFile()).catch(_ => false)

class UpdateIconfont {
  /**
   * 构造函数
   * @param {any} url iconfont 下载链接
   * @param {any} cookie iconfont登录后的cookie
   * @param {any} output iconfont输出目录
   * @returns {any}
   */
  constructor ({ url = '', cookie = '', output = './', runDir = '' }) {

    if (!runDir) {
      runDir = path.join(__dirname, '../../../')
      this.rootPath = runDir
    } else if (runDir) {
      if (fs.existsSync(runDir)) {
        this.rootPath = runDir
      } else {
        this.rootPath = path.join(__dirname, output)
      }
    }

    if (!output) {
      this.output = './'
      this.outputDir = path.join(this.rootPath, this.output)
    } else if (output) {
      if (fs.existsSync(output)) {
        this.output = output
        this.outputDir = output
      } else {
        this.output = path.join(this.rootPath, output)
        this.outputDir = this.output
      }
    }
    
    
    this.url = url
    this.cookie = cookie
    this.tempDir = path.join(__dirname, '../temp')
    this.downloadFile = path.join(__dirname, '../temp/iconfont.zip')
    this.downloadFileDir = path.join(__dirname, '../temp/iconfont')
  }

  /**
   * 删除临时目录和文件
   * @returns {any}
   */
  async delTmp () {
    const resExist = await existDir(this.downloadFileDir)
    if (resExist) {
      deleteFolderRecursive(this.downloadFileDir)
    }

    const resDownloadFile = await isFile(this.downloadFile)
    if (resDownloadFile) {
      fs.unlinkSync(this.downloadFile)
    }
  }

  /**
   * 读取下载目录
   * @returns {any}
   */
  readdir () {
    return new Promise((resolve, reject) => {
      fs.readdir(this.downloadFileDir, async (err, data) => {
        if (err) {
          resolve(false)
        } else {
          resolve(data)
        }
      })
    }).catch(() => {
      return false
    })
  }

  /**
   * 打印下载目录
   * @returns {any}
   */
  async printdir () {
    const resReaddir = await this.readdir()
    if (!resReaddir) {
      return Promise.reject('iconfont 目录读取失败')
    }
    const dir = fs.readdirSync(this.downloadFileDir + '/' + resReaddir[0])
    message.info('|_ ' + resReaddir[0])
    if (dir && dir.length) {
      for (let i = 0; i< dir.length; i++) {
        message.info('  |- ' + dir[i])
      }
    }
  }

  /**
   * 从远端下载文件
   * @returns {any}
   */
  downloadOrigin () {
    
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir)
    }
    return new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(this.downloadFile)
      request({
        url: this.url,
        method: 'get',
        json: true,
        headers: {
          'content-type': 'application/json',
          Cookie: this.cookie
        }
      }).pipe(stream).on('close', async () => {
        resolve(true)
      })
    }).catch(() => {
      return false
    })
  }

  /**
   * 主函数
   * @returns {any}
   */
  async main () {
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

    if (!fs.existsSync(this.outputDir)) {
      message.error('iconfont 输出目录异常')
      return false
    }

    await this.delTmp()
    const downloadFinish = await this.downloadOrigin()
    if (downloadFinish) {
      message.success('iconfont 下载完毕')
    }
    await compressing.zip.uncompress(this.downloadFile, this.downloadFileDir)
    message.success('iconfont 解压完成')

    const resReaddir = await this.readdir()
    if (!resReaddir) {
      message.error('iconfont 目录读取失败')
      return false
    }
    message.success('iconfont 目录读取成功')
    message.info('****** iconfont 目录 ******')
    await this.printdir()
    message.info('***************************')

    const cpRes = await copyDir(this.downloadFileDir+'/'+[resReaddir[0]], this.outputDir)
    if (!cpRes) {
      message.error('更新iconfont出错, 排查output')
    } else {
      message.success('iconfont已更新')
      await this.delTmp()
    }
  }
}

module.exports = UpdateIconfont;