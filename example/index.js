const UpdateIconfont = require('../index')
const path = require('path')

const update = new UpdateIconfont(
  {
    url: 'https://www.iconfont.cn/api/project/download.zip?spm=a313x.7781069.1998910419.d7543c303&pid=3647633&ctoken=rAjSk22DfprV5TN3fwz-MaZC',
    cookie: '',
    output: path.join(__dirname, './src/assets/iconfont' ),
    runDir: path.join(__dirname, './')
  }
)
update.main()
