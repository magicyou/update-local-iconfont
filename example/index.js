const UpdateIconfont = require('../index')
const path = require('path')

const update = new UpdateIconfont(
  {
  url: '',
  cookie:
    '',
  output: path.join(__dirname, './src/assets/iconfont'),
  runDir: path.join(__dirname, './'),
  }
)
update.main()
