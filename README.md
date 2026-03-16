# 文章 Markdown 下载器

一个基于 Chrome Manifest V3 的浏览器扩展，用来把 `mp.weixin.qq.com` 的公众号文章、`zhuanlan.zhihu.com` 的知乎专栏文章与 `juejin.cn/post/*` 的掘金文章下载为：

- 一份 Markdown 文件
- 一个 `assets/` 目录，包含本地图片资源
- 一个最终导出的 ZIP 包

项目的抽取思路参考了 [kscript/markdown-download](https://github.com/kscript/markdown-download)，并针对不同平台页面结构做了清洗和导出链路。

## 功能特性

- 支持 `https://mp.weixin.qq.com/*`、`https://zhuanlan.zhihu.com/p/*` 与 `https://juejin.cn/post/*` 文章页
- 从页面 DOM 中提取标题、公众号名、作者、发布时间和正文
- 清洗平台特有的噪音节点、卡片占位和无意义属性
- 使用 `turndown` 生成 Markdown，并附带 YAML frontmatter
- 将正文图片打包为本地资源，Markdown 中引用本地路径
- 单张图片下载失败时自动回退为远程链接，不阻断整篇导出

## 本地开发

```bash
npm install
npm test
npm run build
```

构建完成后，Chrome 开发者模式加载 `dist/` 目录即可。

## 使用方式

1. 运行 `npm run build`
2. 打开 Chrome 的“扩展程序”
3. 开启“开发者模式”
4. 选择“加载已解压的扩展程序”
5. 选择本项目的 `dist/` 目录
6. 打开一篇支持的网站文章（微信公众号、知乎专栏或掘金）
7. 点击扩展图标，在弹窗中选择“下载 ZIP”

## 验证样例

开发和测试使用的样例文章（fixtures）：

- [Claude悄悄更新了Skills生成器，这绝对是一次史诗级升级。](https://mp.weixin.qq.com/s/vjMG8i7DwQ7R2B1C4AVQdA)

对应的离线 fixture 保存在 `tests/fixtures/weixin-article.html`、`tests/fixtures/zhihu-article.html` 与 `tests/fixtures/juejin-article.html`。

## 项目结构

```text
src/content/     页面内提取与站点适配器
src/popup/       扩展弹窗 UI 与下载流程
src/shared/      Markdown 构建、协议与通用工具
tests/           提取与转换测试
```

## 测试

```bash
npm test
```

当前测试覆盖：

- 元数据提取
- 正文清洗
- Markdown 转换

## 已知范围

- 微信仅支持公众号文章页，不支持视频号、小程序、企业微信后台页或其它微信生态域名
- 音视频、投票、商品卡片等复杂嵌入内容在 v1 中不会完整导出

## License

[MIT](./LICENSE)
