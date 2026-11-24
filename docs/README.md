# 文档索引与维护约定

首次使用从[项目 README](../README.md)开始。以下区分当前使用说明与未来设计，避免将计划当作现有功能。

## 使用与维护

| 文档 | 用途 |
|---|---|
| [PLUGIN-INSTALL.md](PLUGIN-INSTALL.md) | 本地插件构建、安装、检查与更新 |
| [CLIENT-SETUP.md](CLIENT-SETUP.md) | 项目级 Skill + MCP 安装、冲突处理及客户端验收 |
| [MCP.md](MCP.md) | 当前五个工具、手动配置、限制与错误 |
| [ANALYSIS-ENGINE.md](ANALYSIS-ENGINE.md) | 可选独立 Provider 分析模式 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 当前模块布局、数据流及信任边界 |
| [DATA-SCHEMA.md](DATA-SCHEMA.md) | 契约说明；权威定义为 src/domain/schema.ts |
| [SECURITY.md](SECURITY.md) | 隐私、密钥、不可信内容与外部写入原则 |

## 产品与设计资料

| 文档 | 状态与用途 |
|---|---|
| [PRD.md](PRD.md) | 产品目标与验收要求，含未实现的集成目标 |
| [ROADMAP.md](ROADMAP.md) | 已完成能力与后续计划 |
| [AGENT-TOOLKIT.md](AGENT-TOOLKIT.md) | Agent 工作流设计与分阶段交付要求 |
| [MEETING-REPORT-DESIGN.md](MEETING-REPORT-DESIGN.md) | 简洁纪要设计稿，未改变当前默认渲染器 |
| [MEETING-MINUTES-RESEARCH.md](MEETING-MINUTES-RESEARCH.md) | 上述设计的一手调研依据 |

## 文件结构约定

- `src/` 按职责分层；`tests/` 保留对应的单元、集成及打包测试。
- `skills/meeting-to-action/` 是唯一 Skill 源；不要编辑 dist 或客户端缓存作为源码。其 analysis.schema.json 由 `npm run skill:schema` 生成，需要随契约提交。
- `plugin/` 保留可复用清单；`scripts/` 只放可复用维护脚本。
- `examples/` 只放可公开的虚构数据。agent-workflow 下的 normalized.json、analysis.json、report.md 是完整流程样例和测试依赖，不是应清除的临时输出。
- `dist/`、`node_modules/`、coverage 和缓存不入库。已注册的本地插件市场可能依赖 dist 路径，清理前需考虑安装关系。
- `.local-client-check/` 为忽略的本地验收区，不是运行时依赖。私有会议及报告不纳入仓库，也不自动删除；一次性协议文件与临时客户端项目可以清理。
- 保留 package-lock.json 用于可复现安装；`.env.example` 只保留占位配置。

变更能力时同步 README、相关使用文档和路线图。客户端验证必须注明环境与验证范围，不把维护者机器的安装状态写成读者前置条件。历史测试数量不作为长期有效的质量声明，以当前验证结果为准。
