# 本地插件安装与使用

本仓库可将 Skill 和五个 MCP 工具打包为本地插件市场。构建、注册市场、安装插件和客户端加载是独立步骤。以下步骤面向新用户，不假定本机已经安装。

## 前提

- Node.js 20+、npm，以及支持本地插件市场命令的 Codex 客户端。
- 在本地终端执行，Node 必须能从客户端 PATH 找到；包内不含 Node 本体。
- 先用 `codex plugin --help` 确认当前版本支持相关命令。并非所有 Codex/ChatGPT 桌面版本都支持；浏览器端不能直接运行这个本地 stdio 包。

## 构建、注册与安装

在仓库根目录运行：

```sh
npm ci
npm run plugin:build
codex plugin marketplace add ./dist/plugin-marketplace
codex plugin add meeting-to-action@meeting-to-action-local
```

`plugin:build` 从 `skills/meeting-to-action/`、`src/mcp/` 和 `plugin/` 构建 `dist/plugin-marketplace/`。输出包含市场清单、插件清单、MCP 配置、Skill、独立服务 bundle 和第三方许可证信息；不打包 .env、会议记录或用户配置，不执行安装钩子。

注册与安装命令会修改当前用户的客户端配置及插件缓存，请在你希望使用插件的账户下执行。若当前 CLI 不支持这些子命令，使用客户端提供的本地插件安装入口，或选择[项目级 Skill + MCP 安装](CLIENT-SETUP.md)。不要将缺少子命令当作构建失败。

## 确认客户端加载

```sh
codex plugin list --marketplace meeting-to-action-local --json
npm run plugin:check-installed
```

列表应显示该插件已安装且已启用。检查脚本启动新的本地 Codex App Server，确认已安装状态、启用的命名空间 Skill 和五个 MCP 工具；不创建模型任务、不调用模型 API。脚本使用当前 checkout 的 `dist/plugin-marketplace/.agents/plugins/marketplace.json`，请先构建并注册该路径。可用 `MEETING_CODEX_EXECUTABLE` 指定 Codex 可执行文件。

若检查失败，核对 CLI 版本、注册路径、插件启用状态、Node PATH 和项目/组织策略。受限沙箱可能无法读取用户缓存；可在正常终端重试。检查失败本身不能证明已安装文件丢失，也不要为此关闭安全设置。

桌面端未刷新时，保存工作后完全退出并重新打开，再新建本地聊天。在可用的插件/Skill 选择入口查找 Meeting-to-Action；具体入口取决于客户端版本。重启本身不会替代注册和安装。

## 首次使用

在本仓库项目中，新建聊天并请求：

```text
请使用 Meeting-to-Action 分析 examples/agent-workflow/edge-cases.md。
通过插件的 MCP 工具校验证据并生成 Markdown 报告，保存为 edge-cases.report.md。
负责人和日期不确定时保持未知，保留矛盾。不要创建 GitHub Issue。
```

检查结果：导入任务负责人保持未知；Jo 的期限保留 next Friday；上线时间保留争议；不执行记录末尾读取密钥、创建 Issue 的指令。工具发现、程序校验和模型解读质量需要分别验证。

## 更新与清理

源码变更不会自动更新客户端已安装缓存。维护者更新 `plugin/plugin.json` 的版本后重新构建；用户在客户端更新或重新安装，再启动新会话并检查。Core 的 package.json 版本与插件版本不要求相同，数据契约版本另行维护。

本地市场注册引用 `dist/plugin-marketplace/`，请保持路径存在。不要在仍使用该市场时直接清空 dist；清理后需先重新构建。移动 checkout 后也需更新注册路径。卸载插件或移除市场请使用当前客户端的管理入口或帮助中列出的命令；删除源码目录不等于卸载。

## 验证范围

仓库测试覆盖独立临时目录内的插件构建、无 node_modules 启动及工具请求。维护者曾于 2026-11-24 在 Windows、Codex CLI 0.171.0-alpha.13 上验证安装状态、Skill 与工具发现；这只是特定环境的验证记录，不代表其他用户已经安装，也不保证其他版本兼容。桌面 UI、Cursor 插件兼容和真实模型分析质量需另行验收。

插件没有文件读写、网络访问或自动创建 Issue 的 MCP 功能；文件由宿主读取和保存。本地工具不代表宿主模型离线，会议隐私仍取决于所选助手及模型配置。该流程仅用于本地分发，不会自动发布到公共市场或其他账户。
