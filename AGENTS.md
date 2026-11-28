# AGENTS.md — 面向 AI 协助者的规则

本文件是给 Codex / Cursor 等 AI 协助者的精简规则；完整规范见 [CONTRIBUTING.md](CONTRIBUTING.md)，两者冲突时以 CONTRIBUTING.md 为准。架构与交付计划见 [docs/en/design/AGENT-TOOLKIT.md](docs/en/design/AGENT-TOOLKIT.md)，不要在这里重复。

## 开始前

1. 读 [docs/INDEX.md](docs/INDEX.md)（文档索引与目录职责）与相关契约文档：`docs/en/contracts/DATA-SCHEMA.md`、`docs/contracts/MINUTES-CONTRACT.md`、`docs/guides/MCP.md`。
2. 涉及产品方向的问题先看相关 issue（#26 / #36 / #39），不要自行扩大范围。
3. 不确定的需求先问，不把猜测写成实现。

## 必须遵守

- **验证门禁**：提交前跑 `npm run preflight`（typecheck → lint → build → test → mcp:smoke → plugin:build → format:check）。CI 在 push 与 PR 上运行同一套七步（Node 20/22 矩阵），以 CI 通过为准；PR 的「验证」段同时贴本地结果。
- **不手改生成物**：`dist/`、`skills/meeting-to-action/references/*.schema.json` 由脚本生成。改动 `MeetingAnalysisSchema` / `MinutesDocumentSchema` 后运行 `npm run skill:schema` 并随同一个 PR 提交；插件产物用 `npm run plugin:build`。
- **隐私红线**：真实会议内容、个人信息、凭据一律不得写入仓库、示例、测试 fixture 或 issue/PR 正文。验证记录只贴汇总数字，不贴逐字稿片段。第三方数据集先查许可证。
- **格式**：Prettier 强制（`npm run format`），2 空格、双引号、分号、LF、行宽 100；不要顺手重排无关代码。
- **TypeScript**：严格选项不放宽；只用具名导出；ESM 相对导入带 `.js`；新错误码同步 `docs/guides/MCP.md`；错误细节不回显字段值。
- **依赖**：新增依赖需说明理由并检查许可证；不引入数据库、网络监听、持久化存储或自研模型链路；新 Provider 复用 `src/providers/`。
- **测试**：行为改动带测试；契约改动同步文档、重跑 `skill:schema`，并在 PR 标题注明契约影响；核心双语文档改动同步 `docs/en/` 下同名英文变体。
- **提交**：分支 `<type>/<topic>`；提交 `<type>(<scope>): <主题>`；PR 四段结构（做了什么 / 改动 / 验证 / 范围），「范围」段写清不做什么。

## 建议工作方式

- 小步提交，单一主题；先写失败的测试再实现。
- 改动前先 grep 现有实现与测试，避免重复造轮子或破坏既有契约。
- 涉及渲染或纪要质量时，用本地样本自测（样本与评测脚本不入库）。
- 不要主动 push 到他人分支、不改仓库设置、不触发外部副作用操作。
