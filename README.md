# update-local-iconfont

[![npm version](https://img.shields.io/npm/v/update-local-iconfont.svg)](https://www.npmjs.com/package/update-local-iconfont)
[![node](https://img.shields.io/node/v/update-local-iconfont.svg)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/update-local-iconfont.svg)](https://github.com/magicyou/update-local-iconfont/blob/master/LICENSE)

一键更新本地项目里的阿里 iconfont 字体文件：下载 → 解压 → 覆盖到指定目录，一条命令完成。

- 🚀 一条命令同步 iconfont 到本地
- 📦 零配置自动创建输出目录
- 🔒 内置 zip-slip 安全防护
- 🩺 失败原因精确提示（url 错误 / cookie 过期 一目了然）
- 🧹 临时文件自动清理，不污染 `node_modules`
- ✅ 兼容 Node 20 / 22 / 24 / 26

## 安装

```bash
npm i update-local-iconfont -D
```

## 快速开始

### 1. 获取 url 和 cookie

1. 登录 [iconfont.cn](https://www.iconfont.cn)，进入你的图标项目页
2. 按 `F12` 打开开发者工具，切到 **Network（网络）** 面板
3. 点击项目页的 **「下载至本地」** 按钮
4. 在 Network 列表中找到 `download.zip` 这条请求，点击查看详情：
   - **url**：请求地址（含 `?spm=...&pid=...` 等完整 query 参数）
   - **cookie**：请求头（Request Headers）里的 `Cookie` 完整值

> 💡 两个都要复制**完整**内容。cookie 会过期，过期后按上面步骤重新复制即可，
> 工具会在 cookie 失效时给出明确提示。

### 2. 新建运行脚本

在项目下新建 `update-iconfont.js`：

```javascript
const UpdateIconfont = require('update-local-iconfont')
const path = require('path')

const update = new UpdateIconfont({
  url: '', // 必填；iconfont 下载接口地址（见上方「获取 url 和 cookie」）
  cookie: '', // 必填；登录 iconfont 后的完整 cookie
  output: path.join(__dirname, './src/assets/iconfont'), // 必填；输出目录（不存在会自动创建）
  runDir: path.join(__dirname, './'), // 选填；当前运行目录，默认项目根目录
  // timeout: 120000 // 选填；下载超时（毫秒），默认 120 秒
})

update.main()
```

> ✅ 用法与 1.x 完全一致，从旧版本直接升级即可，无需修改任何配置。
> ESM 项目可使用 `import UpdateIconfont from 'update-local-iconfont'`，用法相同。

### 3. 添加 npm 脚本

在 `package.json` 的 `scripts` 中新增：

```json
{
  "scripts": {
    "update:iconfont": "node update-iconfont.js"
  }
}
```

### 4. 运行

```bash
npm run update:iconfont
```

成功输出：

```
[SUCCESS] iconfont 下载完毕
[SUCCESS] iconfont 解压完成
[SUCCESS] iconfont 目录读取成功
[INFO] ****** iconfont 目录 ******
[INFO] |_ font_3849745_xxxxxxxxxxx
[INFO]   |- iconfont.css
[INFO]   |- iconfont.woff2
[INFO]   |- ...
[INFO] ***************************
[SUCCESS] iconfont已更新
```

## 配置参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `url` | `string` | 是 | - | iconfont「下载至本地」接口地址，需含完整 query 参数 |
| `cookie` | `string` | 是 | - | 登录 iconfont 后的完整 cookie |
| `output` | `string` | 是 | - | 输出目录，推荐绝对路径；**不存在时自动创建** |
| `runDir` | `string` | 否 | 项目根目录 | 当前运行目录，相对路径基于它解析 |
| `timeout` | `number` | 否 | `120000` | 下载超时时间（毫秒） |

## 返回值

`update.main()` 返回 `Promise<boolean>`：

- `true`：更新成功
- `false`：更新失败（具体原因见终端 `[ERROR]` 输出，失败不会抛异常）

可在脚本中判断结果，让 CI 正确感知失败：

```javascript
update.main().then(ok => {
  if (!ok) process.exit(1)
})
```

## 报错排查

失败时会给出可区分、可操作的错误提示：

| 报错提示 | 原因 | 处理 |
|------|------|------|
| `下载地址不正确（接口返回 404: 找不到这个项目）` | url 不对 / 项目 id 失效 | 从 iconfont 项目页重新复制「下载至本地」的完整 url |
| `cookie 无效或已过期（接口返回 LOGIN REQUIRED）` | cookie 错误、过期或未登录 | 重新登录 iconfont 后复制完整 cookie |
| `下载内容不是 zip 文件（接口返回了网页内容）…` | url 路径写错（接口不存在） | 检查 url 是否完整正确 |
| `HTTP 401/403，cookie 无效或已过期` | 网关层鉴权失败 | 更新 cookie |
| `HTTP 404，下载地址不正确` | 接口地址不存在 | 重新复制 url |
| `iconfont 输出目录异常: EEXIST ...` | `output` 路径被同名文件占用 | 修改 `output` 或删除同名文件 |

## 实现说明

- 下载使用 Node 原生 `fetch`，解压使用 [`compressing`](https://github.com/node-modules/compressing)，仅 1 个运行时依赖
- 临时文件使用系统临时目录（`os.tmpdir()`），运行结束自动清理
- 解压前校验 zip 条目路径，拦截 zip-slip 目录穿越
- 下载内容非 zip 时（如 cookie 过期返回登录页）提前识别并给出明确报错

## 版本与兼容性

| 版本 | Node 版本要求 | 说明 |
|------|---------------|------|
| 1.2.0 | `^20` | - |
| 1.3.0 | `^22` | - |
| 1.4.0 | `>=20` | 20 / 22 / 24 / 26 全部通过测试；配置与入口向下兼容 |

## License

ISC
