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

需要 Node.js 20+ 和 npm（Windows 上使用项目级安装器时推荐 Node.js 22+，原因见[项目级安装](#项目级安装)）。在仓库根目录执行：

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

安装器在预检和每次写入前都用 `realpath` 对项目根和目标路径做包含性校验：`..` 越界、UNC/设备路径/ADS 形式分别以 `SETUP_PATH_ESCAPE`、`SETUP_PATH_INVALID` 拒绝，解析后指向项目外的 junction/symlink 以 `SETUP_LINK_REJECTED` 拒绝，预检失败不会产生部分写入。该防护不再依赖 `lstat` 的符号链接判断，因此 Node 20 与 Node 22 行为一致；Windows 上仍推荐 Node 22+，因为 Node 20 的 `lstat` 会把目录 junction 误报为普通目录（Node 22 已修正），其他依赖该标记的脚本可能因此误判。

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

需要更紧凑的中文纪要或行动清单时，在已校验的 analysis 之上再提供一份 minutes 编辑稿（`minutes-contract@1.0`，见[会议纪要展示契约](docs/MINUTES-CONTRACT.md)）：

```sh
npm run dev -- report normalized.json --analysis analysis.json --minutes minutes.json --out minutes.md
```

`--minutes` 存在时默认渲染 minutes 模式（主稿 + 溯源附录）；`--mode` 可选 `minutes`、`actions`（仅行动清单）、`evidence`（原证据报告）；`--no-appendix` 去掉溯源附录。缺 `--minutes` 时仍输出原来的 evidence 报告，既有脚本行为不变；要求 `minutes`/`actions` 模式却没给编辑稿会以 `MINUTES_MISSING` 失败。MCP 的 `render_report` 接受同样的可选参数（`minutes` 为 JSON 字符串），详见 [MCP 文档](docs/MCP.md)。

### 可选：独立模型分析

复制 `.env.example` 为 `.env`，填写 `OPENAI_API_KEY` 和 `OPENAI_MODEL`，按需配置 `OPENAI_BASE_URL`，然后执行：

```sh
npm run dev -- analyze examples/sample-meeting.md --out report.md
```

CLI 只在 `analyze --env <path>` 显式指定时读取环境文件，否则仅使用 shell 环境变量——工作目录下的 `.env` 不会被隐式加载。此模式会将记录发送给所配置的模型服务，可能产生费用；不要提交密钥或私有会议资料。当前适配器使用兼容 Chat Completions 的 JSON 模式：JSON/schema 解析失败默认自动重试 1 次（`0-5` 次可调，`0` 关闭），每次重试都会把逐字稿再次发送给 provider；证据校验失败不重试；尚无长文分块、限流退避和 token 预算。`analyze` 对逐字稿有 2 MiB UTF-8 上限：文件超过上限时在读入内存前以 `INPUT_SIZE_LIMIT` 拒绝；`report` 虽然不调用模型，但同样按文件大小先行拒绝超过 2 MiB 的 normalized JSON 与超过 4 MiB 的 analysis JSON，解析后的输入还要满足 2 MiB / 10,000 段上限；`inspect` 不设该上限。详见[分析引擎](docs/ANALYSIS-ENGINE.md)。

### CLI 错误码与退出码

退出码：`0` 成功；`1` 运行错误（含非法 `--mode` 取值）；`2` 用法错误（未知参数、缺参数、非 analyze 命令使用 analyze 专属旗标）。

| 错误码 | 含义 |
|---|---|
| `CONFIG_MISSING` | `analyze` 缺 `OPENAI_API_KEY` / `OPENAI_MODEL` |
| `CONFIG_INVALID` | 环境文件不可读、`OPENAI_TIMEOUT_MS` 越界、`OPENAI_BASE_URL` scheme 不合法（非 https 且非 loopback 明文 http） |
| `INPUT_UNSUPPORTED` / `INPUT_EMPTY` | 逐字稿扩展名不支持 / 内容为空 |
| `INPUT_SIZE_LIMIT` | 输入超过 2 MiB（analysis 4 MiB）或超过 10,000 段 |
| `INPUT_SEGMENT_LIMIT` | 归一化时段数超限 |
| `INPUT_JSON_INVALID` | normalized / analysis / minutes JSON 文件读取或解析失败 |
| `OUT_PATH_INVALID` | `--out` 为 UNC/设备命名空间/盘符相对/备用数据流形态 |
| `INPUT_SCHEMA_INVALID` | normalized JSON 不符合 schema（report 输入） |
| `ANALYSIS_MEETING_MISMATCH` / `ANALYSIS_DUPLICATE_ID` / `ANALYSIS_EVIDENCE_INVALID` | analysis 与输入会议身份不符 / 条目 ID 重复 / 证据校验失败 |
| `ANALYSIS_INVALID_JSON` / `ANALYSIS_SCHEMA_INVALID` | 模型输出不可解析为 JSON / JSON 合法但不符合 schema（重试耗尽后） |
| `MINUTES_MISSING` / `MINUTES_*` / `RENDER_MODE_INVALID` | minutes 契约与渲染模式错误（见[展示契约](docs/MINUTES-CONTRACT.md)） |
| `HTTP_ERROR` / `REQUEST_FAILED` / `REQUEST_TIMEOUT` / `REQUEST_ABORTED` | provider 返回非 2xx / 网络失败 / 超时 / 外部中止 |
| `RESPONSE_TOO_LARGE` / `BODY_READ_FAILED` / `INVALID_JSON` / `EMPTY_COMPLETION` / `PROVIDER_RESPONSE_INVALID` | provider 响应体超限 / 读取失败 / 非 JSON / 空 completion / 形状不合法 |
| `SETUP_*` | `setup:client` 安装器错误（路径形态、越界、冲突、缺构建产物等） |

## 能力与边界

- 标准化记录，保留 SHA-256 校验和、行号、片段 ID，以及受支持导出格式中的发言标签和时间码。
- 使用版本化 Zod 契约校验结构、引用位置与逐字引文；标签不能证明真实身份或任务归属。
- 五个 MCP 工具：`prepare_meeting`、`split_transcript`、`get_meeting_schema`、`validate_analysis`、`render_report`。参数为内联数据，不接受文件路径；读文件和保存报告由宿主完成。
- 未知负责人/日期保持未知；记录内的指令作为不可信数据处理。
- 校验通过证明结构与引用符合规则，不能证明解释正确。摘要目前没有逐项证据字段，报告仍需人工审阅。
- MCP 不调用模型、不读写任意文件、不访问 GitHub，也不自动创建 Issue。宿主模型是否联网及数据如何处理取决于宿主设置。
- 跨会议持久化、GitHub 集成与公共发布仍属后续计划；简洁纪要渲染已接入 CLI `report` 与 MCP `render_report`（见[会议纪要展示契约](docs/MINUTES-CONTRACT.md)）。

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

完整导航与维护约定见[文档索引](docs/README.md)。`dist/` 为构建输出，`node_modules/` 为依赖，均不纳入版本控制。包版本单一来源是 `src/version.ts` 的 `APP_VERSION`（CLI `--version`、MCP `serverInfo.version` 与插件清单一致，`node scripts/version-sync.mjs <ver>` 一键同步）；数据契约 `schemaVersion` 独立演进，与包版本无关。

## 开发验证

```sh
npm run typecheck
npm test
npm run mcp:smoke
npm run plugin:build
```

契约变更后执行 `npm run skill:schema` 并检查差异。`npm run build` 只编译运行时；`plugin:build` 独立打包插件。`plugin:check-installed` 是可选的本机客户端发现检查，需要先构建并安装插件，不是通用单元测试。
