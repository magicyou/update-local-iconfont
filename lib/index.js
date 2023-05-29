const path = require('path')
const fs = require('fs')
const request = require('request')
const compressing = require('compressing')
const { existDir, deleteFolderRecursive } = require('./utils')

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
      this.rootPath = path.join(__dirname, '../../../')
    }
    this.rootPath = runDir
    this.url = url
    this.cookie = cookie
    this.output = output
    this.outputDir = path.join(this.rootPath, output)
    this.downloadFile = path.join(__dirname, '../temp/iconfont.zip')
    this.downloadFileDir = path.join(__dirname, '../temp/iconfont')
  }

  /**
   * 删除临时目录和文件
   * @returns {any}
   */
  async delTmp () {
    const resExist = await existDir(this.downloadFile)
    if (resExist) {
      fs.unlinkSync(this.downloadFile)
    }
    deleteFolderRecursive(this.downloadFileDir)
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
   * 从远端下载文件
   * @returns {any}
   */
  downloadOrigin () {
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
    await this.delTmp()
    const downloadFinish = await this.downloadOrigin()
    if (downloadFinish) {
      console.info('===== iconfont 下载完毕')
    }
    await compressing.zip.uncompress(this.downloadFile, this.downloadFileDir)
    console.log('===== iconfont 解压完成')

    const resReaddir = await this.readdir()
    if (!resReaddir) {
      console.info('===== iconfont 目录读取失败')
      return false
    }
    console.log('===== iconfont 目录读取成功')
    console.log('===== iconfont 目录 =====')
    console.log(resReaddir)
    console.log('=========================')
    const resExist = await existDir(this.outputDir)
    if (resExist) {
      deleteFolderRecursive(this.outputDir)
    }

    fs.rename(path.join(this.downloadFileDir, resReaddir[0]), this.outputDir, (err) => {
      if (err) {
        console.info('===== 更新iconfont出错, 排查output')
      } else {
        console.log('===== iconfont已更新')
        this.delTmp()
      }
    })
  }
}

module.exports = UpdateIconfont;