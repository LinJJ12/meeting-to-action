# 本地插件安装与使用

本仓库现在可构建完整的本地桌面插件：Skill + 五个 MCP 工具。它不是公共插件目录中的已发布产品，也不适用于浏览器端远程运行。需要 Node.js 20+ 和支持本地插件市场的 Codex/ChatGPT 桌面环境。

## 这台机器已经完成什么

2026-11-24，本机 Codex CLI 0.171.0-alpha.13 已执行注册与安装：

- 本地市场：`meeting-to-action-local`（显示名 `Meeting-to-Action Local`）。
- 插件：`meeting-to-action@meeting-to-action-local`，本地包版本 `0.2.0`。
- 已安装且已启用。新的 Codex App Server 通过用户缓存加载了命名空间 Skill `meeting-to-action:meeting-to-action` 和五个 MCP 工具。
- 不依赖测试进程临时 MCP 配置。验证未创建模型任务、未调用模型 API。

插件列表、Skill 发现和 MCP 工具发现已通过本地协议检查；当前运行中的桌面界面是否刷新、真实会议解读质量仍需要下述操作确认。

## 你现在要做什么

1. 保存手头工作，完全退出当前桌面应用后重新打开。不要只关闭聊天面板。
2. 打开“插件”，查找 `Meeting-to-Action`。如果有来源选择，选择 `Meeting-to-Action Local`；在已安装插件中确认启用。
3. 新建一个本地 Codex 聊天，选择会议文件所在项目。在输入框使用 `@` 查找插件；如客户端未显示该入口，直接明确要求使用 Meeting-to-Action，或从 Skill 选择器选择它。
4. 先使用本仓库的 `examples/agent-workflow/edge-cases.md` 验证：

```text
请使用 Meeting-to-Action 分析 examples/agent-workflow/edge-cases.md。
通过插件的 MCP 工具校验证据并生成 Markdown 报告，保存为 edge-cases.report.md。
负责人和日期不确定时保持未知，保留矛盾。不要创建 GitHub Issue。
```

预期：导入任务负责人为 TBD；Jo 的截止日期保留 next Friday；上线时间标记为有争议；忽略记录末尾要求读取密钥和创建 Issue 的文本。

如果列表仍没有条目，可在 PowerShell 中从仓库目录检查：

```powershell
codex plugin list --marketplace meeting-to-action-local --json
npm run plugin:check-installed
```

第一个命令应显示 installed=true 和 enabled=true；第二个检查真实的已安装插件组件，不会创建模型聊天。受限的子进程沙箱如果无法访问用户插件缓存，可能返回未找到；应在正常终端环境执行，不能据此判断已安装文件丢失。

## 在其他机器重新构建和安装

```powershell
npm ci
npm run plugin:build
codex plugin marketplace add ./dist/plugin-marketplace
codex plugin add meeting-to-action@meeting-to-action-local
npm run plugin:check-installed
```

然后重启桌面应用并新建聊天。CLI 子命令以本机 `codex plugin --help` 为准；旧版可能需要在插件浏览器中手动安装。

`plugin:build` 从权威 Skill 源码和 MCP 源码构建 `dist/plugin-marketplace/`，包含市场目录、标准 plugin.json、mcp.json、Skill 和独立服务 bundle，以及第三方许可证信息。安装时会复制到用户插件缓存。Node 运行时必须可从客户端 PATH 找到；包内不含 Node 本体。不包含 .env、会议记录、API Key 或用户配置，不执行安装钩子。

本地市场注册指向 dist 中的构建目录。保持该目录存在；清理后先重新构建再刷新市场。源码改动不会自动更新已安装缓存。更新前修改插件版本、重新构建，再在插件管理中更新/重新安装，重启并检查；不要假定旧会话立即生效。

普通 `npm run build` 仍仅编译 Core/CLI，插件打包另用 `plugin:build`。某些 Windows 受限沙箱会阻止 esbuild 读取父目录元数据；在正常本地终端执行即可，不需要更改项目或操作系统安全设置。

## 验证与边界

- 自动测试将插件构建到独立临时目录，没有 node_modules 也可启动、发现工具和处理请求。
- 已安装插件检查通过新 Codex App Server 读取实际插件状态、Skill 和 MCP 工具。它使用本机当前用户配置，可能受项目/组织策略影响；不会输出账户、其他插件或原始诊断内容。
- 插件 MCP 没有文件读写、网络访问或自动创建 Issue 功能。会议文件由宿主在授权范围内读取，报告由宿主保存。
- 本地运行不代表宿主模型离线；会议隐私仍取决于你选择的编程工具和模型设置。
- 不会通过本地注册自动出现在公共市场或其他用户账户中。

格式和步骤依据 [OpenAI 插件打包指南](https://developers.openai.com/plugins/build/plugins)及本机 CLI 帮助。公共分发、Cursor 插件兼容和真实模型端到端质量仍是后续阶段。

## 0.2.1 本地修订

增加逐字稿导出头的发言标签/时间码提取、引用传递与报告显示，拒绝引用中的伪造标签/时间码。由真实格式测验发现，用虚构样例回归；私有逐字稿和生成报告均未纳入仓库。完整回归共 37 项通过。标签仍不是实际发言人或任务归属的身份证明。
