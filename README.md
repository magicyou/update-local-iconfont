# update-local-iconfont
方便更新本地项目阿里家的iconfont

## 安装
```
npm i update-local-iconfont -D
```

## 使用说明
1. 项目下新建一个运行js文件 ‘update-iconfont.js’
2. update-iconfont.js 示例内容如下：

```javascript
const UpdateIconfont = require('update-local-iconfont')
const path = require('path')
const update = new UpdateIconfont(
  {
    url: '',  // 必填；iconfont 下载接口，iconfont项目->‘下载至本地’按钮->从浏览器控制台获取没完整请求url，和完整cookie
    cookie: '',  // 必填；cookie
    output: path.join(__dirname, './src/assets/iconfont' ), // 必填；输出目录，推荐使用绝对路径
    runDir: path.join(__dirname, './') // 选填；当前运行目录，默认当前在项目根目录
  }
)
update.main()

```
3. 在package.json里面的script下新增脚本命令

```json
"script": {
    //...,    //其它脚本命令
    "update:iconfont": "node update-iconfont.js"
}
```

4. 在终端命令行执行 npm run update:iconfont 就可以将iconfont的css文件更新到本地了

```
npm run update:iconfont
```


## 版本说明
| 版本 | node版本要求 |
|------|-------|
|1.2.0|node@^20|
|1.3.0|node@^22|