简体中文（主版） | [English](SECURITY.en.md)

# 安全政策

## 适用范围

本政策覆盖本仓库交付的全部本地组件：

- stdio MCP 服务器（`src/mcp/`，`dist/mcp/server.js`）
- CLI（`inspect` / `report` / `analyze`）
- 项目级安装器 `setup:client`
- 插件打包与本地插件市场产物（`scripts/build-plugin.mjs` 输出）

## 报告漏洞

**请不要用公开 issue 报告安全问题**——公开细节可能在使用者修复之前被利用。

请使用 GitHub 的私密漏洞报告渠道：

1. 打开仓库的 **Security** 标签页 → **Report a vulnerability**（私密漏洞报告）。
2. 若该入口不可用，通过 GitHub 私信联系维护者 [@LinJJ12](https://github.com/LinJJ12)。

私密漏洞报告仅对**公开仓库**开放：仓库公开后，维护者在 Settings → Code security（部分界面版本显示为 Advanced Security）设置页把 **Private vulnerability reporting** 置为 Enable。私有仓库看不到该开关属正常现象。

### 报告内容请包含

- 受影响组件与版本（`npm run dev -- --version` 或插件版本号）
- 复现步骤；能附最小复现输入最好
- 观察到的行为与预期行为的差异

### 隐私红线

- **报告中一律不得包含真实会议内容、个人信息或凭据。**
- 请使用仓库自带的虚构样例（`examples/sample-meeting.md`、`examples/agent-workflow/`）复现问题。

## 响应预期

- 本项目由个人维护者业余维护，尽力在收到报告后 7 天内确认并给出初步评估，但无法承诺 7×24 响应。
- 确认后按严重程度安排修复；修复发布时会在 [CHANGELOG](CHANGELOG.md) 中记录，并在征得报告者同意后致谢。

## 安全设计基线

本工具的安全与隐私设计原则（本地 stdio、不监听网络、不持久化、日志默认不含原始逐字稿文本等）见 [docs/SECURITY.md](docs/SECURITY.md)；工具边界的权威描述见 [docs/MCP.md](docs/MCP.md)。这些原则本身是设计承诺，不是漏洞；对它们的建议属于功能讨论，请用普通 issue。
