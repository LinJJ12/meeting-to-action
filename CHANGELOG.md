简体中文（主版） | [English](docs/en/CHANGELOG.md)

# 更新日志

本项目的所有显著变更都记录在本文件中。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

（空）

## [0.1.2] - 2026-11-28

### 新增

- 建立核心文档中英双语体系：中文主版（根目录与 docs/，无后缀）+ `docs/en/` 英文库（同名英文变体与 6 份英文主版技术文档），覆盖 README、CONTRIBUTING、docs/ 索引、插件安装、项目级安装与 MCP 文档。
- 开源社区文件：MIT `LICENSE`、本更新日志、根目录 `SECURITY.md` 漏洞报告政策、行为准则（Contributor Covenant v2.1）、Issue / PR 双语模板。
- README 开源标准栏目：License 徽章与章节、Contributing / Security 链接、英文副标题、演示占位与 Support 章节。
- ESLint 正确性门禁接入：`npm run lint`（`@eslint/js` + typescript-eslint 推荐集 + 两条 type-aware 规则）成为 `preflight` 第二步，`#36`。

### 变更

- 支持口径升级：CI 矩阵与 `engines` 从 Node 20/22（20 已于 2026-04 EOL）推进到 Node 22/24，README / CONTRIBUTING / AGENTS / MCP / PLUGIN-INSTALL / CLIENT-SETUP 双语口径同步；CI action 升级到 node24 运行时版本（checkout v5.1.0、setup-node v6.5.0，钉 SHA）。
- CI 改为 Ubuntu/Windows × Node 20/22 四 job 矩阵，补 `permissions`、`concurrency`、`timeout` 与 action SHA 固定；PR 模板与 README / CLIENT-SETUP 的 Node 版本口径对齐；`package.json` 补 `description` / `license` / `repository` 元数据。
- 文档语言布局重组：英文内容（双语变体与英文主版）集中至 `docs/en/`，废弃 `.en.md` 后缀命名；顺带修复 AGENTS / CONTRIBUTING 中的过时文档路径与 issue 模板的 ROADMAP 断链。
- README「源码与本地分发」表述改为适配开源后状态：仓库公开（MIT），但不发布 npm 包或公共插件市场。

### 修复

- 修复：MCP 请求行限额按字节计入 CR，堵住用 CR 填充绕过 4 MiB 上限的通道。
- 修复：`tools/call` 参数形状不合法时返回 JSON-RPC `-32602`，不再把 SDK 序列化的 Zod 错误当作内部错误返回。
- 修复：`normalizeTranscript` 保留每行原始空白，逐字引用不再因归一化 trim 被误拒；证据与渲染截断改按 Unicode 码点进行，不再切断 emoji。
- 修复：CLI 输入文件读取/解析失败、`--out` 冲突与 `--version` 混用改为稳定错误码（`INPUT_JSON_INVALID` / `OUT_PATH_UNUSABLE` / exit 2），错误不再回显用户字段值；minutes 与 MCP 统一为 2 MiB 上限。
- 修复：`setup:client` 引入预检与事务式回滚（`SETUP_PROJECT_INVALID` / `SETUP_CONFLICT` / `SETUP_APPLY_FAILED`），`--apply` 失败只回滚本次新建内容。
- 修复：`version-sync` 写前预检、写后校验；插件归档字节可复现（固定 mtime、权限与成员顺序）；`smoke-mcp` 精确断言工具契约而不是只数工具个数。
- CI 恢复自动运行后，同步修正 AGENTS / CONTRIBUTING / docs 索引 / PRD 中「CI 因计费无法运行」的过时说明；CI 工作流补上 `format:check` 与 `lint`，与 `npm run preflight` 的七步保持一致。
- README「演示」栏目去掉「待开源发布时补充」的过时占位；SECURITY 说明仓库已公开且私密漏洞报告已启用。

## [0.1.1] - 2026-11-27

### 新增

- 插件：面向 Codex 桌面端的单插件上传包 `meeting-to-action-v<版本>.tar.gz`，含 Skill、MCP bundle 与第三方许可证信息。

### 修复

- 契约：同一来源内的段行区间互斥检查，拒绝部分重叠、嵌套与相同区间（#13 收尾，契约收紧）。
- 插件：修复纪要交付与溯源契约相关问题（#41、#42、#43）。

### 文档

- ROADMAP 对齐 Roadmap 3.0，记录第一期收尾状态。
- 同步插件纪要交付说明与示例验收。

## [0.1.0] - 2026-11-26

首个带标签的发布。

### 新增

- 便携 Skill（`skills/meeting-to-action/`）与五个本地 stdio MCP 工具：`prepare_meeting`、`split_transcript`、`get_meeting_schema`、`validate_analysis`、`render_report`。
- CLI：`inspect` / `report` 确定性两步流程与可选的 `analyze` 独立模型分析。
- 版本化契约：`analysis-schema@1.0` 与 `minutes-contract@1.0`（含纪要渲染、行动清单与溯源附录）。
- 逐字稿格式支持：腾讯会议、飞书妙记、独立发言人 + MM:SS 标题行、行内发言人格式，并保留 SHA-256 校验和与行号溯源。
- 项目级安装器 `setup:client`（Codex / Cursor），带 `realpath` 包含性校验与冲突预检。
- 本地插件市场构建与 `plugin:check-installed` 发现检查。

### 安全加固

- 显式 `--env` 环境文件加载、仅允许 https 端点（loopback 明文 http 除外）、禁用重定向。
- 终端转义序列剥离；`--out` 拒绝 UNC/设备命名空间/ADS 等不安全路径形态。
- 工具调用 CPU 预算（`MAX_TOOL_WORK_MS`），超限以 `WORK_LIMIT_EXCEEDED` 结束。

### 变更

- 协作规范落地：CONTRIBUTING.md / AGENTS.md，preflight 门禁接入 `format:check`。
- Schema 错误细节附带首个字段路径，便于宿主修正参数（#26）。

[Unreleased]: https://github.com/LinJJ12/meeting-to-action/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/LinJJ12/meeting-to-action/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/LinJJ12/meeting-to-action/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/LinJJ12/meeting-to-action/releases/tag/v0.1.0
