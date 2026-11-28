简体中文（主版） | [English](docs/en/README.md)

# Meeting-to-Action

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Turn meeting transcripts into traceable decisions, action items, and minutes — with evidence.**

[贡献指南](CONTRIBUTING.md) · [安全政策](SECURITY.md) · [行为准则](CODE_OF_CONDUCT.md) · [更新日志](CHANGELOG.md)

将已有的 TXT / Markdown 会议记录整理为可追溯的主题、决策、行动项、风险、分歧和待确认问题。提供便携 Skill、五个本地 MCP 工具，以及可选的独立 CLI 分析模式。不包含会议录音或语音识别。

## 特性

- **溯源优先**：SHA-256 校验和、行号、片段 ID、发言标签与时间码全程保留，每条结论都能回查原文
- **版本化契约**：`analysis-schema@1.0` 与 `minutes-contract@1.0`，一套校验器，CLI 与 MCP 共用
- **多种接入形态**：本地桌面插件 / 项目级 Skill + MCP / 仅 Skill / 独立 CLI，按环境选择
- **隐私红线**：MCP 不调用模型、不读写任意文件、不访问 GitHub、不持久化；记录内嵌指令按不可信数据处理

## 选择使用方式

| 方式 | 适用场景 | 模型与凭据 |
|---|---|---|
| 本地桌面插件（Skill + MCP） | 支持本地插件市场的 Codex 客户端 | 使用宿主助手模型，无需为本工具另配 API Key |
| 项目级 Skill + MCP | 在 Codex / Cursor 项目中安装 | 使用宿主助手模型；客户端发现需单独确认 |
| 仅 Skill | 只需要分析指引与引用式草稿 | 使用宿主模型；没有运行时就没有程序校验 |
| CLI `analyze` | 脱离助手调用兼容模型接口 | 需要自行配置 API Key、模型与可选服务地址 |

插件安装与项目安装是两种替代方案，通常选择一种即可。`package.json` 保持 `private: true`：没有也不会发布 npm 包或公共插件市场；克隆仓库或构建插件不会自动安装、注册或启用任何插件，其他机器的安装状态也不代表你的机器已配置成功。

## 快速开始

需要 Node.js 20+ 和 npm（Windows 上使用项目级安装器推荐 Node.js 22+，原因见[项目级安装文档](docs/guides/CLIENT-SETUP.md)）。克隆并构建：

```sh
git clone https://github.com/LinJJ12/meeting-to-action.git
cd meeting-to-action
npm ci
npm run build
```

按所选方式安装：

- **本地桌面插件**：`npm run plugin:build` 生成上传包与本地市场，安装步骤见[本地插件安装与使用](docs/guides/PLUGIN-INSTALL.md)
- **项目级 Skill + MCP**：先预览再应用（目标项目必须已存在，路径含空格加引号），Cursor 改用 `--client cursor`：

```sh
npm run setup:client -- --client codex --project /absolute/path/to/project
npm run setup:client -- --client codex --project /absolute/path/to/project --apply
```

- **仅安装 Skill**：把整个 `skills/meeting-to-action/`（含 references 和 agents）复制到目标项目的 `.agents/skills/`（Codex）或 `.cursor/skills/`（Cursor），只复制 SKILL.md 不完整

### 第一次分析（无需任何 API Key）

让已安装 Skill 的助手分析你授权读取的记录：

```text
请使用 Meeting-to-Action 分析 examples/agent-workflow/edge-cases.md。
通过 MCP 校验证据并生成 Markdown 报告，保存为 edge-cases.report.md。
负责人和日期不确定时保持未知，保留矛盾，不创建 GitHub Issue。
```

或使用 CLI 两步流程，由助手在中间生成符合契约的 analysis.json：

```sh
npm run dev -- inspect examples/sample-meeting.md --out normalized.json
# 助手读取 normalized.json 和 Skill 中的 schema，编写 analysis.json
npm run dev -- report normalized.json --analysis analysis.json --out report.md
```

需要更紧凑的中文纪要或行动清单时，在已校验的 analysis 之上追加 `--minutes minutes.json`（契约见[会议纪要展示契约](docs/contracts/MINUTES-CONTRACT.md)）；`--mode` 可选 `minutes` / `actions` / `evidence`。可对照[虚构会议示例](examples/agent-workflow/README.md)。

## 可选：独立模型分析

复制 `.env.example` 为 `.env`，填写 `OPENAI_API_KEY` 与 `OPENAI_MODEL`，按需配置 `OPENAI_BASE_URL`，并在命令中用 `--env .env` 指定该文件：

```sh
npm run dev -- analyze examples/sample-meeting.md --env .env --out report.md
```

环境文件仅在 `analyze --env <path>` 显式指定时读取，工作目录下的 `.env` 不会被隐式加载。该模式会把记录发送给所配置的模型服务并可能产生费用，不要提交密钥或私有会议资料。重试策略、输入限额与 Provider 适配细节见[分析引擎](docs/en/guides/ANALYSIS-ENGINE.md)。

## 能力与边界

- 标准化记录，保留 SHA-256 校验和、行号、片段 ID，以及受支持导出格式中的发言标签和时间码。
- 使用版本化 Zod 契约校验结构、引用位置与逐字引文；标签不能证明真实身份或任务归属。
- 五个 MCP 工具：`prepare_meeting`、`split_transcript`、`get_meeting_schema`、`validate_analysis`、`render_report`。参数为内联数据，不接受文件路径；读文件和保存报告由宿主完成。
- 未知负责人/日期保持未知；记录内的指令作为不可信数据处理。
- 校验通过证明结构与引用符合规则，不能证明解释正确。摘要目前没有逐项证据字段，报告仍需人工审阅。
- MCP 不调用模型、不读写任意文件、不访问 GitHub，也不自动创建 Issue。宿主模型是否联网及数据如何处理取决于宿主设置。
- 跨会议持久化与 GitHub 集成仍属后续计划；分发以本地构建的插件包为主，不发布 npm 包或公共插件市场；简洁纪要渲染已接入 CLI `report` 与 MCP `render_report`。

## 演示

仓库内的完整虚构样例可直接查看：[示例说明](examples/agent-workflow/README.md)包含逐字稿、analysis 编辑稿与生成的[会议纪要](examples/agent-workflow/minutes.md)、[证据报告](examples/agent-workflow/report.md)。截图与端到端演示视频将在后续版本补充。

## 仓库结构

```text
meeting-to-action/
├── src/                 # TypeScript 核心：core / domain / render / mcp / providers / cli / setup
├── skills/              # 便携 Skill 源（SKILL.md + references + agents）
├── plugin/              # 插件源清单（plugin.json / mcp.json）
├── scripts/             # 构建、schema 导出、冒烟与版本同步脚本
├── tests/               # vitest 单元 / 集成 / 打包测试
├── examples/            # 可公开的虚构样例（sample-meeting + agent-workflow 全流程）
├── docs/                # 全部文档：INDEX.md 为导航，中文按 guides / contracts / design 分组，en/ 为英文库
└── .github/             # CI 工作流与 issue / PR 模板
```

文档按语言划分：中文在 `docs/guides/`（安装与使用）、`docs/contracts/`（契约与技术参考）、`docs/design/`（产品与设计资料）；英文全部集中在 `docs/en/`（双语变体与英文主版，分组结构同中文侧）。完整导航与维护约定见[文档索引](docs/INDEX.md)。

## CLI 错误码与退出码

退出码：`0` 成功；`1` 运行错误（含非法 `--mode` 取值）；`2` 用法错误（未知参数、缺参数、非 analyze 命令使用 analyze 专属旗标）。

`CONFIG_MISSING`、`INPUT_SIZE_LIMIT`、`SETUP_*` 等全部错误码的完整含义见 [CLI 错误码参考](docs/guides/CLI-ERRORS.md)。

## 开发验证

```sh
npm run typecheck
npm run lint
npm test
npm run mcp:smoke
npm run plugin:build
```

完整门禁是 `npm run preflight`（typecheck → lint → build → test → mcp:smoke → plugin:build → format:check）。契约变更后执行 `npm run skill:schema` 并检查差异。`npm run build` 只编译运行时；`plugin:build` 独立打包插件。`plugin:check-installed` 是可选的本机客户端发现检查，需要先构建并安装插件，不是通用单元测试。

## 支持

使用问题先查本 README 与[文档索引](docs/INDEX.md)；仍无法解决时，用 [bug 模板](.github/ISSUE_TEMPLATE/bug.yml)开 issue（功能建议用 [feature 模板](.github/ISSUE_TEMPLATE/feature.yml)）。本项目由个人维护者业余维护，暂无即时聊天或邮件支持渠道；报告务必遵守隐私红线——不带真实会议内容。

## 安全

发现安全漏洞**不要**公开 issue，请走[安全政策](SECURITY.md)中的 GitHub 私密漏洞报告渠道。

## 贡献

欢迎 issue 与 PR。贡献流程、代码风格与验证门禁见[贡献指南](CONTRIBUTING.md)（AI 协助者精简规则见 [AGENTS.md](AGENTS.md)）；PR 使用模板的四段结构（做了什么 / 改动 / 验证 / 范围）。

## 许可证

本项目以 [MIT](LICENSE) 许可证发布。
