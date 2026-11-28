简体中文（主版） | [English](docs/en/CONTRIBUTING.md)

# 贡献指南

本文档是多人协作的唯一权威来源：代码风格、目录职责、测试与验证、提交与 PR 流程都以这里为准。面向 AI 协助者的精简版见 [AGENTS.md](AGENTS.md)，两者冲突时以本文档为准。

本项目的协作约定源于 issue #32。规范自该 issue 定稿起对新代码生效；修改本文档请走 PR，不在评论里做口头变更。

## 环境要求

- Node.js ≥ 20（与 `package.json` 的 `engines` 一致），npm
- 插件打包及其回归测试需要系统 `tar`；格式化及其他测试由仓库内依赖提供

## 快速开始

```sh
npm ci
npm run preflight
```

`preflight` 是本仓库唯一的完整门禁，依次执行：

| 步骤 | 命令 | 作用 |
|---|---|---|
| 1 | `npm run typecheck` | TypeScript 严格编译（`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`） |
| 2 | `npm run build` | 构建 `dist/` |
| 3 | `npm test` | vitest 全量测试 |
| 4 | `npm run mcp:smoke` | 编译产物上的 stdio MCP 冒烟 |
| 5 | `npm run plugin:build` | 构建单插件上传包和本地插件市场 |
| 6 | `npm run format:check` | Prettier 格式检查（`src tests scripts`） |

提交前必须跑完整 preflight。CI 会在 push 与 PR 上运行同一套六步（Node 20/22 矩阵），以 CI 通过为准；PR 的「验证」段同时贴本地 preflight 结果。

单独使用某个脚本时：`npm run format` 自动格式化，`npm run skill:schema` 重新生成 Skill 内的契约 schema，`npm run plugin:check-installed` 在本地 Codex 上验证插件安装。

## 代码风格

- 缩进 2 空格、UTF-8、LF、文件末尾保留换行；行宽软上限 100 字符（由 `.editorconfig` 与 `.prettierrc.json` 规定）
- **格式由 Prettier 强制**：`src`、`tests`、`scripts` 必须通过 `format:check`；不要手写「看起来像 Prettier」的代码绕过检查
- 双引号、语句末尾分号
- 不做大范围格式重排：修改既有文件时只格式化自己改动的行；如果确实需要整文件格式化，把它作为**独立的 format commit**（历史已用 `.git-blame-ignore-revs` 保护 blame）
- 注释以中文为主，解释「为什么」（取舍、原因、边界），不复述代码；代码标识符用英文
- 公共契约模块（schema、limits、错误处理）必须有说明用途与边界的注释

### TypeScript

- `tsconfig.json` 的严格选项不得放宽
- 只用具名导出，不新增 `export default`
- ESM 相对导入必须带 `.js` 后缀（NodeNext 要求）
- `!` 非空断言仅当不变量在局部可证时使用；生产代码优先显式 guard，测试中允许
- 对外错误遵循 `稳定错误码: 一行细节`，细节不得回显用户字段值；**新增错误码必须同步 `docs/guides/MCP.md` 与其 `docs/en/guides/` 英文变体**

### 命名

| 对象 | 约定 |
|---|---|
| 文件名 | kebab-case |
| 类型 / 类 | PascalCase |
| 常量 | SCREAMING_SNAKE_CASE |
| 函数 / 变量 | camelCase |

## 生成物与依赖边界

- 不手改 `dist/`、`skills/meeting-to-action/references/*.schema.json` 等生成物
- 改动 `MeetingAnalysisSchema` / `MinutesDocumentSchema` 后必须运行 `npm run skill:schema`，把重新生成的 schema 随**同一个 PR** 提交
- 插件产物只通过 `npm run plugin:build` 生成；`plugin/` 下的清单才是源码
- 新增运行时/开发依赖必须在 PR 中说明理由并检查许可证
- 不引入：数据库、网络监听、持久化存储、自研模型调用链路。需要新模型 Provider 时先开 issue 讨论，并复用 `src/providers/` 的抽象

## 测试数据与隐私红线

- **含真实会议内容或个人信息的样本一律不得提交进仓库**（tests fixtures、examples、docs 示例都算）
- issue / PR 中的验证记录只贴汇总数字（如「12 份中 10 份完整保留」），不贴逐字稿原文片段
- 第三方数据集入库前必须核查许可证与授权用途；无入库授权的数据只在本地验证
- fixtures 与示例不得包含凭据、密钥、真实账号

## 测试与验证

- 任何行为改动必须带测试；纯重构必须证明测试零改动（或仅位置移动）
- 契约改动（`analysis-schema@1.0` / `minutes-contract@1.0`、`src/domain/schema.ts`、错误码集合）必须：
  - 同步 `docs/en/contracts/DATA-SCHEMA.md` / `docs/contracts/MINUTES-CONTRACT.md` / `docs/guides/MCP.md`
  - 涉及 `MeetingAnalysisSchema` / `MinutesDocumentSchema` 时重跑 `npm run skill:schema`
  - 在 PR 标题中注明契约影响
- 提交前跑完整 `npm run preflight`；PR 的「验证」段贴本地结果（tsc / vitest 汇总行 / build / smoke / format:check）
- CI 恢复后以 CI 结果为准，本地证据仅作过渡

## 文档规范

- 区分「当前已实现」与「未来计划」，不把计划写成现有功能
- 行为或契约变化必须同步对应文档（DATA-SCHEMA / MINUTES-CONTRACT / MCP / PLUGIN-INSTALL / CLIENT-SETUP 等，按影响范围选择）
- 用户向核心文档为中英双语对：中文主版（根目录或 docs/，无后缀）+ `docs/en/` 下同名英文变体，**改动主版内容必须同步英文变体**；命名与权威版本约定见 [docs/INDEX.md](docs/INDEX.md) 的「文档语言规范」
- 新增文档必须登记进 [docs/INDEX.md](docs/INDEX.md) 索引
- 目录职责见 [docs/INDEX.md](docs/INDEX.md) 的「文件结构约定」；架构与交付计划见 [docs/en/design/AGENT-TOOLKIT.md](docs/en/design/AGENT-TOOLKIT.md)

## 分支、提交与 PR

- 分支：`<type>/<短主题>`，常用 type：`feat` / `fix` / `docs` / `style` / `test` / `improve` / `integration` / `project`；一个分支只做一个主题
- 提交：`<type>(<scope>): <主题>`，scope 用模块名（`core` / `mcp` / `plugin` / `normalize` / `cli` 等）；模块级改动必须带 scope；跨模块行为修复带 issue 引用（如 `fix(mcp): ... (#24)`）
- PR 使用四段结构：**做了什么 / 改动 / 验证 / 范围**；「范围」段明确「不做什么」
- 至少一名维护者 approve 后合并；保持 merge commit 方式

## 提交前检查清单

- [ ] `npm run preflight` 全部通过
- [ ] 行为改动带测试；契约改动同步了文档与生成的 schema
- [ ] 没有提交真实会议内容、个人信息、凭据或未授权数据
- [ ] 没有手改 `dist/` 与生成的 schema
- [ ] PR 标题、body 四段结构与 issue 引用完整
