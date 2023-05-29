const UpdateIconfont = require('../index')
const path = require('path')

const update = new UpdateIconfont(
  {
    url: '',
    cookie: '',
    output: './src/assets/iconfont',
    runDir: path.join(__dirname, './')
  }
)
update.main()
