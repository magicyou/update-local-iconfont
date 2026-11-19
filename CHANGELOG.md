# 更新记录

## [1.4.0]

- 适配 node@20 ~ node@26（CI 增加多版本测试矩阵），`engines` 调整为 `>=20`
- 移除 axios 依赖，下载改用 Node 原生 fetch；保留 compressing 解压，运行时依赖仅 1 个
- 修复目录拷贝竞态：旧版拷贝未完成即返回，可能漏拷文件（copyDir 全面改为 async/await 顺序拷贝）
- 修复临时目录删除的 setTimeout 竞态 hack，改用 fs.rm
- 修复 printdir 失败导致 unhandled rejection 使进程崩溃的问题，main() 统一返回 Promise<boolean> 且不抛未捕获异常
- 临时文件改到系统临时目录（os.tmpdir()），兼容 pnpm / 只读 node_modules 场景，结束自动清理
- 新增 zip-slip 目录穿越防护；下载内容非 zip（如 cookie 过期返回登录页）时明确报错
- 优化失败反馈：区分「url 错误（404: 找不到这个项目）」「cookie 失效（LOGIN REQUIRED）」「url 路径写错」等场景，给出可操作的排查提示
- output 输出目录不存在时自动创建（含多级目录），修复全新项目首次运行报「iconfont 输出目录异常」的问题
- 修复 output 为绝对路径且不存在时路径解析错误（`runDir + 绝对路径` 错误拼接）的问题
- 新增下载超时配置 `timeout`（选填，默认 120 秒）
- 补充 node:test 测试用例；配置 `exports` 字段，兼容 ESM 引入
- 用法与配置完全向下兼容，1.x 用户直接升级即可

## [1.3.2]

- 修改说明文档

## [1.3.1]

- 添加变更记录

## [1.3.0]

- 适配node@22
