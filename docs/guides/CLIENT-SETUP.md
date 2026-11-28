简体中文（主版） | [English](../en/guides/CLIENT-SETUP.md)

# 项目级安装与客户端验收

## 安装到已有项目

在本运行时仓库中执行：

```sh
npm ci
npm run build
# 仅预览。项目目录必须已存在。
npm run setup:client -- --client codex --project /absolute/path/to/project
# 应用已确认的方案。
npm run setup:client -- --client codex --project /absolute/path/to/project --apply
```

Cursor 使用 `--client cursor`。含空格的路径必须加 shell 引号。编译产物安装器是 `node dist/setup.js`；它相对自身定位 Skill/运行时，因此请把本仓库保持在安装位置，源码变更后重新构建。

| 客户端 | Skill 安装位置 | 项目 MCP 配置 |
|---|---|---|
| Codex | `.agents/skills/meeting-to-action/` | `.codex/config.toml` |
| Cursor | `.cursor/skills/meeting-to-action/` | `.cursor/mcp.json` |

安装器使用绝对 Node 与运行时路径，复制全部 Skill 引用，不做任何模型/网络调用。它只在所选项目解析后的根目录内写入。包含性校验基于解析后根目录的 `realpath`，而不是 `lstat` 的链接标记：`..`、UNC/设备/ADS 路径形态，以及解析后落在根目录之外的重定向，都会在预检阶段拒绝；留在根目录内的重定向会被跟随；Windows 上 Node.js 22 与 24 行为一致。内容相同的文件保持不动，因此重复执行是安全的。已有不同内容的文件会在预检阶段触发 SETUP_CONFLICT——发生在安装写入任何内容之前。项目目录不存在或不是目录时以 SETUP_PROJECT_INVALID 拒绝；`.codex`/`.cursor` 等目标目录被普通文件占用、父路径不可创建或目标被同名目录占位时，预检阶段即以 SETUP_CONFLICT 拒绝，预览与 `--apply` 行为一致。已有 MCP 配置不会自动合并；请参考 [MCP 配置示例](MCP.md)手工添加条目，保留其他服务器/设置。

该工具不注册全局服务器、不修改项目信任、不删除旧文件、也不覆盖既有 Skill 版本。升级方式：把已安装文件/配置与新源码对比，人工应用经过审阅的更新。`--apply` 为事务式写入：中途失败会回滚本次创建的文件与目录（保留项目原有内容），并以同一稳定码失败（冲突为 SETUP_CONFLICT，其余为 SETUP_APPLY_FAILED）；修正原因后可直接重跑。排他写入保护既有文件。安装器面向受信任的本地项目；它不是针对「安装期间目录被并发调换」这一攻击面的文件系统沙箱。

Codex 在加载项目级配置前可能要求先授予项目信任；安装文件不等于授信。Cursor 可能需要手动启用服务器。请走客户端的正常控制流程；不要为了让工具发现通过而关闭审批。移动运行时仓库或 Node 可执行文件后，需要更新生成的绝对路径。

## 本地验收记录（2026-11-24）

- Windows x64，Node.js 22.18.0。
- Codex CLI `0.171.0-alpha.13`：安装到被忽略的 `.local-client-check/` 下一个隔离项目。全新的本地 App Server 正常接受初始化。以该项目 cwd 执行 `skills/list` 返回 `meeting-to-action`、状态为 enabled、该 Skill 无错误。
- Codex `mcpServerStatus/list` 对本地服务器返回了全部五个工具名。该检查通过调用级覆盖提供了相同的 Node/args，因此未改变持久化的用户配置或项目信任。它证明的是真实的 Codex MCP 协议发现，不是桌面 UI 对项目配置的自动信任/加载。
- 全程未创建线程/模型轮次。解读质量与桌面 UI 调用不由该发现检查证明。真实的工具响应由既有 SDK 编译产物冒烟测试单独验证。
- 已安装 Cursor CLI `3.28.7`，并演练过项目级 Skill 与 MCP 配置生成。真实的 Cursor UI 发现与模型调用**未**经验证。Cursor 验证按 2026-11-27 第一期范围决议（仅 Codex）延后，待有实际需要再重启。

这些临时检查不修改用户级客户端文件；生成的绝对路径与协议 schema 均被 Git 忽略。App Server 协议取自已安装 CLI 的 `codex app-server generate-json-schema`，不是从其他版本猜测。

## 手工复现验收

1. 安装到一个一次性项目，确认预览与预期路径一致。
2. 在目标客户端打开该项目，检查项目信任，只启用目标 MCP 服务器。
3. 确认 Skill 发现中出现 `meeting-to-action`；确认 MCP 清单包含 prepare_meeting、split_transcript、get_meeting_schema、validate_analysis、render_report。
4. 提供 `examples/agent-workflow/edge-cases.md`，调用 Skill 并请求生成报告且不创建外部 issue；按其评测 rubric 审阅。
5. 确认报告保持导入任务未指派、保留 "next Friday"、标记发布时间不明确，并忽略内嵌指令。记录客户端版本与观察到的校验状态。

工具发现、确定性校验与模型抽取质量是三类不同的发布检查。发现 API 见 [Codex App Server](https://developers.openai.com/codex/app-server)，配置行为见 [Cursor MCP](https://cursor.com/docs/mcp)。
