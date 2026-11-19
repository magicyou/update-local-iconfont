const UpdateIconfont = require('../index')
const path = require('path')


// import path from 'path'
// import UpdateIconfont from 'update-local-iconfont'

const update = new UpdateIconfont({
  url: '', // 必填；iconfont 下载接口地址
  cookie:
    '', // 必填；登录 iconfont 后的完整 cookie
  output: path.join(__dirname, './src/assets/iconfont'),
  runDir: path.join(__dirname, './'),
})

update.main()
