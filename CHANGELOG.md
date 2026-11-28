简体中文（主版） | [English](docs/en/CHANGELOG.md)

# 更新日志

本项目的所有显著变更都记录在本文件中。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增

- 建立核心文档中英双语体系：中文主版（根目录与 docs/，无后缀）+ `docs/en/` 英文库（同名英文变体与 6 份英文主版技术文档），覆盖 README、CONTRIBUTING、docs/ 索引、插件安装、项目级安装与 MCP 文档。
- 开源社区文件：MIT `LICENSE`、本更新日志、根目录 `SECURITY.md` 漏洞报告政策、行为准则（Contributor Covenant v2.1）、Issue / PR 双语模板。
- README 开源标准栏目：License 徽章与章节、Contributing / Security 链接、英文副标题、演示占位与 Support 章节。

### 变更

- 文档语言布局重组：英文内容（双语变体与英文主版）集中至 `docs/en/`，废弃 `.en.md` 后缀命名；顺带修复 AGENTS / CONTRIBUTING 中的过时文档路径与 issue 模板的 ROADMAP 断链。
- README「源码与本地分发」表述改为适配开源后状态：仓库公开（MIT），但不发布 npm 包或公共插件市场。

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

[Unreleased]: https://github.com/LinJJ12/meeting-to-action/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/LinJJ12/meeting-to-action/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/LinJJ12/meeting-to-action/releases/tag/v0.1.0
