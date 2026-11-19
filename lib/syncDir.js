const fs = require('fs')
const fsp = require('fs').promises
const path = require('path')

/**
 * 递归拷贝目录
 * @param {string} src 源目录
 * @param {string} dst 目标目录（不存在时自动创建）
 * @returns {Promise<boolean>} true:拷贝完成
 */
async function copyDir (src, dst) {
  await fsp.mkdir(dst, { recursive: true })
  const entries = await fsp.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const dstPath = path.join(dst, entry.name)
    if (entry.isDirectory()) {
      await copyDir(srcPath, dstPath)
    } else if (entry.isFile()) {
      await fsp.copyFile(srcPath, dstPath)
    } else if (entry.isSymbolicLink()) {
      // 软链只复制链接本身，避免越界拷贝
      const link = await fsp.readlink(srcPath)
      await fsp.rm(dstPath, { force: true })
      await fsp.symlink(link, dstPath)
    }
  }
  return true
}

module.exports = {
  copyDir,
}
