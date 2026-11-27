简体中文（主版） | [English](INDEX.en.md)

# 文档索引与维护约定

首次使用从[项目 README](../README.md)开始。docs/ 按主题分四个子目录，本文件是全部文档的导航与维护约定。

## 文档目录结构

```text
docs/
├── INDEX.md / INDEX.en.md   # 本文件：导航与维护约定
├── guides/                  # 安装与使用
├── contracts/               # 契约与技术参考
├── design/                  # 产品与设计资料
└── community/               # 根目录文件的英文变体
```

## 文档语言规范

- 中文是项目主语言：核心文档主版为中文、无后缀；英文变体加 `.en.md` 后缀（变体文件名 = 主版文件名 + `.en.md`），顶部有语言切换链接。docs/ 内文档的变体与主版同目录；根目录主版的英文变体统一在 `docs/community/`。双语对现覆盖：README、CONTRIBUTING、INDEX（本文件）、PLUGIN-INSTALL、CLIENT-SETUP、MCP、CLI-ERRORS、CHANGELOG、SECURITY（根目录报告政策）、CODE_OF_CONDUCT。
- 变体不与根目录主版并排的原因：GitHub 社区标准按 `.github/` → 根目录 → `docs/` 顺序取第一个命中的文件，其中行为准则类文件匹配宽松——根目录若同时存在 `CODE_OF_CONDUCT.md` 与 `CODE_OF_CONDUCT.en.md`，GitHub 会把英文变体识别为唯一行为准则（实测 API 返回）。根目录只保留中文主版后，GitHub 社区标准全部展示中文版。
- 英文变体在页首注明中文主版为权威版本；两份内容不一致时，以中文主版为准。
- **改动主版内容必须同步对应英文变体**；契约类变更仍按 [CONTRIBUTING.md](../CONTRIBUTING.md) 的流程同步契约文档。
- 面向 AI 协助者的内容（`skills/meeting-to-action/`、`AGENTS.md`）保持单语言，不做翻译；`LICENSE` 为法律文本不做变体；`.github/` 模板内部直接双语。其余单语言文档在下表「语言」列标注。

## 安装与使用（guides/）

| 文档 | 语言 | 用途 |
|---|---|---|
| [PLUGIN-INSTALL.md](guides/PLUGIN-INSTALL.md) / [English](guides/PLUGIN-INSTALL.en.md) | 双语 | 本地插件构建、安装、检查与更新 |
| [CLIENT-SETUP.md](guides/CLIENT-SETUP.md) / [English](guides/CLIENT-SETUP.en.md) | 双语 | 项目级 Skill + MCP 安装、冲突处理及客户端验收 |
| [MCP.md](guides/MCP.md) / [English](guides/MCP.en.md) | 双语 | 当前五个工具、手动配置、限制与错误 |
| [CLI-ERRORS.md](guides/CLI-ERRORS.md) / [English](guides/CLI-ERRORS.en.md) | 双语 | CLI 退出码与完整错误码表 |
| [ANALYSIS-ENGINE.md](guides/ANALYSIS-ENGINE.md) | English | 可选独立 Provider 分析模式 |

## 契约与技术参考（contracts/）

| 文档 | 语言 | 用途 |
|---|---|---|
| [ARCHITECTURE.md](contracts/ARCHITECTURE.md) | English | 当前模块布局、数据流及信任边界 |
| [DATA-SCHEMA.md](contracts/DATA-SCHEMA.md) | English | 契约说明；权威定义为 src/domain/schema.ts |
| [MINUTES-CONTRACT.md](contracts/MINUTES-CONTRACT.md) | 中文 | minutes-contract@1.0 展示契约：阅读模式、claim 类型与校验规则；权威定义为 src/domain/minutes.ts |
| [SECURITY.md](contracts/SECURITY.md) | English | 隐私、密钥、不可信内容与外部写入原则 |

## 产品与设计资料（design/）

| 文档 | 语言 | 状态与用途 |
|---|---|---|
| [PRD.md](design/PRD.md) | English | 产品目标与验收要求，含未实现的集成目标 |
| [ROADMAP.md](design/ROADMAP.md) | 中文 | Roadmap 3.0 对齐、第一期收尾状态、范围决议与公开数据集政策 |
| [AGENT-TOOLKIT.md](design/AGENT-TOOLKIT.md) | English | Agent 工作流设计与分阶段交付要求 |
| [MEETING-REPORT-DESIGN.md](design/MEETING-REPORT-DESIGN.md) | 中文 | 简洁纪要的设计依据、实现分工和读者验收目标 |
| [MEETING-MINUTES-RESEARCH.md](design/MEETING-MINUTES-RESEARCH.md) | 中文 | 上述设计的一手调研依据 |

## 协作规范

| 文档 | 语言 | 用途 |
|---|---|---|
| [CONTRIBUTING.md](../CONTRIBUTING.md) / [English](community/CONTRIBUTING.en.md) | 双语 | 多人协作唯一权威来源：环境、代码风格、测试与验证、提交与 PR 流程 |
| [AGENTS.md](../AGENTS.md) | 中文 | 面向 Codex / Cursor 等 AI 协助者的精简规则，指向 CONTRIBUTING.md；面向 AI，不翻译 |

## 社区与合规

| 文档 | 语言 | 用途 |
|---|---|---|
| [LICENSE](../LICENSE) | English | MIT 许可证文本（法律文本，无变体） |
| [CHANGELOG.md](../CHANGELOG.md) / [English](community/CHANGELOG.en.md) | 双语 | Keep a Changelog 格式的版本变更记录，版本号与 `APP_VERSION` 有测试防漂移 |
| [SECURITY.md](../SECURITY.md) / [English](community/SECURITY.en.md) | 双语 | 根目录漏洞报告政策：GitHub 私密漏洞报告渠道与隐私红线；产品安全原则另见上表 contracts/SECURITY.md |
| [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) / [English](community/CODE_OF_CONDUCT.en.md) | 双语 | Contributor Covenant v2.1 行为准则 |
| `.github/ISSUE_TEMPLATE/` 与 `.github/PULL_REQUEST_TEMPLATE.md` | 内部双语 | bug / feature 表单式 issue 模板与 PR 四段结构模板；不入 docs 索引逐份登记 |

## 文件结构约定

- `src/` 按职责分层；`tests/` 保留对应的单元、集成及打包测试。
- `skills/meeting-to-action/` 是唯一 Skill 源；不要编辑 dist 或客户端缓存作为源码。其 analysis.schema.json 由 `npm run skill:schema` 生成，需要随契约提交。
- `plugin/` 保留可复用清单；`scripts/` 只放可复用维护脚本。
- `examples/` 只放可公开的虚构数据。agent-workflow 下的 normalized.json、analysis.json、report.md 是完整流程样例和测试依赖，不是应清除的临时输出。
- `docs/` 按主题分 `guides/`（安装使用）、`contracts/`（契约参考）、`design/`（设计规划）、`community/`（根目录文件英文变体）四组，顶层只有本索引对。新增文档先选组再登记进本文件。
- `dist/`、`node_modules/`、coverage 和缓存不入库。已注册的本地插件市场可能依赖 dist 路径，清理前需考虑安装关系。
- `.local-client-check/` 为忽略的本地验收区，不是运行时依赖。私有会议及报告不纳入仓库，也不自动删除；一次性协议文件与临时客户端项目可以清理。
- 保留 package-lock.json 用于可复现安装；`.env.example` 只保留占位配置。

### 目录职责地图

| 位置 | 职责 | 关键约定 |
|---|---|---|
| `src/core/` | 确定性业务逻辑：解析、规范化、证据校验、限额、minutes 校验、错误细节 | 不做模型调用，不做平台操作 |
| `src/domain/` | 版本化契约：`schema.ts` = `analysis-schema@1.0`；`minutes.ts` = `minutes-contract@1.0` | 契约改动按 CONTRIBUTING.md 的契约流程执行 |
| `src/render/` | 报告 / 纪要 / 转义等输出渲染 | 纯函数，无 IO |
| `src/mcp/` | stdio MCP 协议层：五个工具、行守护、协议错误 | stdout 只走协议，诊断只走 stderr |
| `src/providers/` | 模型调用抽象与类型 | 仅在 `analyze --env` 显式指定时读环境文件 |
| `src/cli.ts`、`src/setup.ts`、`src/integrations/setup.ts` | CLI 入口；客户端安装器入口与实现 | 安装器带路径包含性校验 |
| `src/version.ts` | 唯一版本书写点 `APP_VERSION` | 改版本用 `node scripts/version-sync.mjs <semver>` |
| `tests/` | 单元 / 集成 / 打包测试，命名 `<区域>-<主题>.test.ts` | `stdio-harness.ts` 是共享测试设施；`support/` 放 fixture 工具 |
| `scripts/` | 可复用维护脚本：build-plugin / check-installed-plugin / export-skill-schema / smoke-mcp / version-sync | 不放一次性脚本 |
| `skills/meeting-to-action/` | 唯一 Skill 源：SKILL.md + agents/openai.yaml + references/ | `references/*.schema.json` 是生成物，随契约提交 |
| `plugin/` | 插件源清单（plugin.json / mcp.json） | 产物 `dist/plugin-marketplace/` 不入库 |
| `examples/` | 可公开的虚构数据：sample-meeting.md + agent-workflow 完整流程样例 | agent-workflow 是测试依赖，不是临时输出 |
| `docs/guides/` | 安装与使用文档（PLUGIN-INSTALL / CLIENT-SETUP / MCP / CLI-ERRORS / ANALYSIS-ENGINE） | 英文变体与主版同目录 |
| `docs/contracts/` | 契约与技术参考（ARCHITECTURE / DATA-SCHEMA / MINUTES-CONTRACT / SECURITY） | 契约改动同步 DATA-SCHEMA / MINUTES-CONTRACT / guides/MCP |
| `docs/design/` | 产品与设计资料（PRD / ROADMAP / AGENT-TOOLKIT / MEETING-*） | 区分当前与计划，不把规划写成现有功能 |
| `docs/community/` | 根目录文件（README / CONTRIBUTING / SECURITY / CHANGELOG / CODE_OF_CONDUCT）的英文变体 | 主版变更必须同步变体 |
| `.github/workflows/ci.yml` | CI（Node 20/22 矩阵；因 billing 暂停，本地 preflight 为准） | 恢复计费后先手动 workflow_dispatch 一次，再启用自动触发 |
| `.env.example`、`.gitignore`、`.gitattributes`、`.editorconfig`、`.prettierrc.json`、`.prettierignore`、`.git-blame-ignore-revs`、`vitest.config.ts`、`tsconfig.json`、`package-lock.json` | 环境占位 / 忽略规则 / LF 强制 / 格式配置与忽略 / 格式提交的 blame 忽略 / 测试配置 / 严格编译 / 可复现安装 | `.env` 永不入库 |

变更能力时同步 README、相关使用文档和路线图。使用文档为双语对的，主版变更必须同步英文变体。客户端验证必须注明环境与验证范围，不把维护者机器的安装状态写成读者前置条件。历史测试数量不作为长期有效的质量声明，以当前验证结果为准。
