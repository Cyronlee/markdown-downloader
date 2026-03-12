# Contributing

## Development

```bash
npm install
npm test
npm run build
```

## Pull Requests

- 保持改动聚焦，避免把无关格式化混入同一个 PR
- 新增或修改提取逻辑时，优先补充 `tests/` 中的 fixture 测试
- 提交前至少运行一次 `npm test` 和 `npm run build`

## Scope

当前仓库只接受与微信公众号 Markdown 导出链路直接相关的改进，包括：

- 页面提取与清洗
- Markdown 转换
- 图片下载与打包
- Chrome 扩展体验与稳定性
