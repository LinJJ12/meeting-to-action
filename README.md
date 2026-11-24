# Meeting-to-Action

将已有的 TXT / Markdown 会议记录整理为可追溯的主题、决策、行动项、风险、分歧和待确认问题。提供便携 Skill、五个本地 MCP 工具，以及可选的独立 CLI 分析模式。不包含会议录音或语音识别。

## 选择使用方式

| 方式 | 适用场景 | 模型与凭据 |
|---|---|---|
| 本地桌面插件（Skill + MCP） | 支持本地插件市场的 Codex 客户端 | 使用宿主助手模型，无需为本工具另配 API Key |
| 项目级 Skill + MCP | 在 Codex / Cursor 项目中安装 | 使用宿主助手模型；客户端发现需单独确认 |
| 仅 Skill | 只需要分析指引与引用式草稿 | 使用宿主模型；没有运行时就没有程序校验 |
| CLI `analyze` | 脱离助手调用兼容模型接口 | 需要自行配置 API Key、模型与可选服务地址 |

本仓库目前是源码和本地分发项目，`package.json` 标记为 private。没有公开 npm 包或公共插件市场发布。克隆仓库或构建插件不会自动安装、注册或启用插件；其他机器的安装状态也不代表你的机器已配置成功。

## 从源码开始

需要 Node.js 20+ 和 npm。在仓库根目录执行：

```sh
npm ci
npm run build
```

### 本地桌面插件

```sh
npm run plugin:build
```

构建输出为 `dist/plugin-marketplace/`，包含 Skill、MCP bundle 和第三方许可证。接下来按[本地插件安装与使用](docs/PLUGIN-INSTALL.md)注册市场、安装并验证。该方式依赖支持相关命令的本地 Codex 客户端；构建成功不等于客户端兼容或模型分析质量已经验证。

### 项目级安装

先预览，再应用（目标项目必须已存在，路径含空格时加引号）：

```sh
npm run setup:client -- --client codex --project /absolute/path/to/project
npm run setup:client -- --client codex --project /absolute/path/to/project --apply
```

Cursor 改用 `--client cursor`。已有不同配置会报告冲突，不会自动合并。参见[项目安装说明](docs/CLIENT-SETUP.md)和[手工 MCP 配置](docs/MCP.md)。插件安装与项目安装是两种替代方案，通常选择一种即可，避免重复加载工具。

仅安装 Skill 时，将整个 `skills/meeting-to-action/`（包括 references 和 agents）复制到目标项目的 `.agents/skills/`（Codex）或 `.cursor/skills/`（Cursor）。仅复制 SKILL.md 不完整。发现行为取决于客户端版本；也可明确要求助手读取该文件。

### 无额外 API Key 的分析流程

让已安装 Skill 的助手分析你授权读取的记录，例如：

```text
请使用 Meeting-to-Action 分析 examples/agent-workflow/edge-cases.md。
通过 MCP 校验证据并生成 Markdown 报告，保存为 edge-cases.report.md。
负责人和日期不确定时保持未知，保留矛盾，不创建 GitHub Issue。
```

也可使用 CLI，由助手在两步之间生成符合契约的 analysis.json：

```sh
npm run dev -- inspect examples/sample-meeting.md --out normalized.json
# 助手读取 normalized.json 和 Skill 中的 schema，编写 analysis.json
npm run dev -- report normalized.json --analysis analysis.json --out report.md
```

不调用模型的现成校验示例（输出到终端）：

```sh
npm run dev -- report examples/agent-workflow/normalized.json --analysis examples/agent-workflow/analysis.json
```

`inspect` 和 `report` 不调用模型。`report` 校验会议 ID、结构、分类内重复 ID 及证据后再渲染。带 `--out` 的 CLI 命令拒绝覆盖已有文件。

### 可选：独立模型分析

复制 `.env.example` 为 `.env`，填写 `OPENAI_API_KEY` 和 `OPENAI_MODEL`，按需配置 `OPENAI_BASE_URL`，然后执行：

```sh
npm run dev -- analyze examples/sample-meeting.md --out report.md
```

CLI 会加载本地 `.env`，也可使用 shell 环境变量。此模式会将记录发送给所配置的模型服务，可能产生费用；不要提交密钥或私有会议资料。当前适配器使用兼容 Chat Completions 的 JSON 模式，尚无自动长文分析、重试和限流退避。详见[分析引擎](docs/ANALYSIS-ENGINE.md)。

## 能力与边界

- 标准化记录，保留 SHA-256 校验和、行号、片段 ID，以及受支持导出格式中的发言标签和时间码。
- 使用版本化 Zod 契约校验结构、引用位置与逐字引文；标签不能证明真实身份或任务归属。
- 五个 MCP 工具：`prepare_meeting`、`split_transcript`、`get_meeting_schema`、`validate_analysis`、`render_report`。参数为内联数据，不接受文件路径；读文件和保存报告由宿主完成。
- 未知负责人/日期保持未知；记录内的指令作为不可信数据处理。
- 校验通过证明结构与引用符合规则，不能证明解释正确。摘要目前没有逐项证据字段，报告仍需人工审阅。
- MCP 不调用模型、不读写任意文件、不访问 GitHub，也不自动创建 Issue。宿主模型是否联网及数据如何处理取决于宿主设置。
- 跨会议持久化、GitHub 集成、公共发布和新的简洁纪要渲染模式仍属后续计划。

## 目录与文档

```text
src/         TypeScript Core、CLI、MCP、Provider 与项目安装器
skills/      权威 Skill 源码、工作流引用及生成的 JSON Schema
plugin/      本地插件清单与 MCP 配置模板
scripts/     构建、schema 导出及验证脚本
tests/       自动化测试
examples/    可公开的虚构输入及完整分析/报告样例
docs/        安装、技术契约、设计与路线图
.github/     CI 工作流
```

完整导航与维护约定见[文档索引](docs/README.md)。`dist/` 为构建输出，`node_modules/` 为依赖，均不纳入版本控制。Core 包、插件包和数据契约独立版本化，以各自清单为准。

## 开发验证

```sh
npm run typecheck
npm test
npm run mcp:smoke
npm run plugin:build
```

契约变更后执行 `npm run skill:schema` 并检查差异。`npm run build` 只编译运行时；`plugin:build` 独立打包插件。`plugin:check-installed` 是可选的本机客户端发现检查，需要先构建并安装插件，不是通用单元测试。
