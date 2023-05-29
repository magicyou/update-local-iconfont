const fs = require('fs') 
const path = require('path')

/**
 * 判断目录是否存在
 * @param {any} path
 * @returns {any}
 */
function existDir (path) {
  return new Promise((resolve, reject) => {
    fs.stat(path, (err, stats) => {
      if (err) {
        reject(err)
      } else {
        resolve(true)
      }
    })
  }).catch(() => {
    return false
  })
}

/**
 * 删除目录和目录下的所有文件
 * @param {any} 目录路径
 * @returns {any}
 */
function deleteFolderRecursive (folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file)
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath)
      } else {
        fs.unlinkSync(curPath)
      }
    })
    fs.rmdirSync(folderPath)
  }
}

module.exports ={
  existDir,
  deleteFolderRecursive,
};