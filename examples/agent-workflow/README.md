# 会议纪要示例

这是一份虚构的 API 规划会议。可以对照[测试逐字稿](edge-cases.md)和[生成的会议纪要](minutes.md)，查看行动项、相对期限、分歧和证据如何呈现。

纪要保留了三处容易误读的细节：有人被提到，但导入任务仍待认领；API 审查的原话是 `next Friday`，会议日期缺失；增加重试仍是提案，发布日期仍有分歧。逐字稿末尾的指令是用来测试宿主是否会把它当作普通会议内容的合成数据。

在仓库根目录安装依赖后，可用已提供的[规范化输入](normalized.json)、[事实分析](analysis.json)和[纪要编辑稿](minutes.json)复现报告：

```sh
npm run dev -- report examples/agent-workflow/normalized.json --analysis examples/agent-workflow/analysis.json --minutes examples/agent-workflow/minutes.json --mode minutes
```

此命令校验证据和引用后渲染纪要，无需模型 API Key。若要体验从逐字稿到纪要的完整流程，可让已安装插件的助手分析 `examples/agent-workflow/edge-cases.md` 并保留证据。
