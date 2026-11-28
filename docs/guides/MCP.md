简体中文（主版） | [English](../en/guides/MCP.md)

# 本地 stdio MCP

本仓库提供五个无状态工具，基于官方 [TypeScript MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x)。需要 Node.js 20+。不需要模型凭据，也不需要部署服务端。本 MCP 不调用独立模型 Provider。

## 构建与验证

```sh
npm ci
npm run typecheck
npm test
npm run mcp:smoke
```

冒烟命令会构建运行时产物，用 SDK 客户端启动 `dist/mcp/server.js`，发现全部五个工具并演练完整流程（含拒绝路径）。它不修改客户端配置，也不调用模型。客户端子进程命令使用 `node /absolute/path/to/meeting-to-action/dist/mcp/server.js`。直接运行该文件只会等待协议输入，不是交互式 CLI。

不要把 `npm run mcp` 用作客户端命令：npm 可能向 stdout 打印横幅。请直接启动 Node。仅开发用入口：`npm run mcp:dev`。

## 客户端配置示例

以下是示例，不代表本仓库已在你的客户端中启用。请替换其中的运行时绝对路径；若客户端 PATH 中没有 Node，改用 Node 可执行文件的实际路径。无需 shell、npx 下载或任何凭据。

Codex MCP 配置条目：

```toml
[mcp_servers.meeting_to_action]
command = "node"
args = ["C:/path/to/meeting-to-action/dist/mcp/server.js"]
```

Cursor 项目 `.cursor/mcp.json` 条目：

```json
{
  "mcpServers": {
    "meeting-to-action": {
      "command": "node",
      "args": ["C:/path/to/meeting-to-action/dist/mcp/server.js"]
    }
  }
}
```

将条目合并进现有配置，不要整体替换。请以你安装的客户端对应的最新 [Codex MCP 文档](https://developers.openai.com/codex/mcp)与 [Cursor MCP 文档](https://cursor.com/docs/mcp)为准。在宣称客户端兼容之前，先记录客户端/版本并确认五个工具都能被发现。这些手工示例本身不会修改用户级全局设置。插件注册是另一种安装方式，见[本地插件安装](PLUGIN-INSTALL.md)。

## 工具与流程

所有参数均为内联 JSON，不接受文件系统路径。对象遇到未知字段会拒绝。

| 工具 | 参数 | JSON 文本结果 |
|---|---|---|
| prepare_meeting | content, fileName, 可选 title | 规范化后的 MeetingInput |
| split_transcript | input, maxChars | `{chunks: [{fragments, charCount}]}` |
| get_meeting_schema | contractVersion: "1.0" | contractVersion、输入 JSON Schema、analysis JSON Schema |
| validate_analysis | input, analysis | `{valid: true, analysis}` |
| render_report | input, analysis；可选 minutes、mode（"minutes"\|"actions"\|"evidence"）、appendix（布尔） | 完整校验通过后返回 `{markdown}`；提供 `minutes` 时按 minutes-contract 阅读模式渲染，否则输出证据报告 |

1. 宿主读取用户选择的文件，将其文本与受支持的 TXT/Markdown 文件名传给 prepare_meeting。
2. 先获取契约；宿主模型使用返回的 ID 编写完整 analysis JSON。MCP 内不发生第二次模型调用。
3. 内容较长时，split_transcript 返回按行切分的片段。每个片段都保留原 sourceId 与 segmentId；不要对各片段单独做规范化，也不要新造 ID。maxChars 按 UTF-16 字符计数，片段之间的换行分隔符计入其中。超过该预算的单行会被拒绝。校验仍需完整原始输入。
4. 以原始输入与 analysis 调用 validate_analysis 或 render_report。后者独立完成校验，因此渲染无法绕过校验。`isError` 结果代表失败，不是报告。`render_report` 接受可选 `minutes` 参数（JSON 编码的 minutes-contract 文档，见[纪要展示契约](../contracts/MINUTES-CONTRACT.md)）；提供 `minutes` 时 `mode` 默认为 "minutes"，否则默认为 "evidence"；`appendix: false` 表示省略溯源附录。提供 `mode: "minutes"` 或 `"actions"` 但缺 `minutes` 会以 MINUTES_MISSING 拒绝；即使处于 evidence 模式，提供的 minutes 文档仍会被校验。
5. 宿主只把 Markdown 保存到用户指定的位置。本 MCP 没有写入工具。

对于没有决策、行动项、风险、待确认问题或分歧的简报，传 `sections: []` 的 minutes 草稿即可。渲染器会用 analysis 的主题或摘要填充正文。claim ID 必须在全文档内唯一。空小节但存在可引用事实、以及重复的 claim ID，都会返回 `MINUTES_SCHEMA_INVALID`。纪要附录包含未进入编辑正文的主题证据与 analysis 事实。

JSON Schema 只描述形状；跨字段身份、重复 ID、来源关系与引文由运行时代码校验。规范化输入本身由客户端提供；证据匹配成功并不证明输入或解读真实可信。

## 限制与错误

- 单条请求行（UTF-8 字节，不含 CRLF 结尾）与序列化工具参数的最大体积：4 MiB。
- 逐字稿/合并段文本：2 MiB UTF-8，最多 10,000 段。限额按 UTF-8 字节计数，因此超限的 ASCII 与中日韩内容都会一致地以 INPUT_SIZE_LIMIT 拒绝，并报告实际字节数与限额。
- 同一来源内的段行区间不得重叠：段是规范、互斥的时间线发言，部分重叠、嵌套与完全相同的区间会在证据校验之前的 schema 阶段（schema 错误码）被拒绝。
- 本地 `report` 命令读取文件前先 `stat` 检查：normalized 输入 JSON 按 2 MiB、analysis JSON 按 4 MiB 限制。超限文件以 INPUT_SIZE_LIMIT 直接拒绝、不加载；解析后的输入同样受上述 2 MiB / 10,000 段约束。
- 证据资源上限：每个 analysis 条目最多 200 条引用，每条引文最多 4,000 字符。任一超限返回 ANALYSIS_EVIDENCE_INVALID，消息中包含实际限额。证据校验为每个 analysis 按来源各建一个索引，而不是对每条引用重扫全部段。
- 所有工具调用共享 5,000 ms CPU 预算（`MAX_TOOL_WORK_MS`）。超限会以 WORK_LIMIT_EXCEEDED 结束调用，而不是阻塞事件循环；正常与超大有界输入的完成时间远低于该预算。
- maxChars：1 到 2,097,152 的整数。段行数不一致会被切分阶段拒绝。
- 超过 4 MiB 的请求行会收到 JSON-RPC 错误 `-32600`，消息为 `INPUT_SIZE_LIMIT: request line exceeds 4 MiB (bytes=N)`；该行剩余内容被丢弃，服务器继续处理后续请求。传输层 stdin/stdout 失败会向 stderr 记录 `MCP_STDIN_ERROR`/`MCP_STDOUT_ERROR` 并优雅关闭。其他工具校验失败返回 `isError: true` 与稳定错误码，不回显参数。
- 可选的 `minutes` 参数是 JSON 编码的纪要文档，同样受 2 MiB UTF-8 内容限额约束；JSON 不合法以 INPUT_INVALID 拒绝。渲染 minutes 草稿永远不会跳过 analysis 校验。
- Known codes include INPUT_EMPTY, INPUT_UNSUPPORTED, INPUT_INVALID, INPUT_SIZE_LIMIT, INPUT_SEGMENT_LIMIT, CHUNK_LINE_TOO_LONG, SEGMENT_LINE_COUNT_INVALID, ANALYSIS_MEETING_MISMATCH, ANALYSIS_DUPLICATE_ID, ANALYSIS_EVIDENCE_INVALID, WORK_LIMIT_EXCEEDED, MINUTES_MISSING, MINUTES_SCHEMA_INVALID, MINUTES_CONTRACT_UNSUPPORTED, MINUTES_MEETING_MISMATCH, MINUTES_REF_UNKNOWN, MINUTES_KIND_MISMATCH, MINUTES_ACTION_COVERAGE, RENDER_MODE_INVALID and TOOL_UNKNOWN. Schema-level failures (for example an unknown enum value or a non-string `minutes`) are reported as `INPUT_INVALID` followed by the first field path and a short reason; the path lets the host correct arguments without guessing, and field values are never echoed. The CLI prints the same detail behind its schema-error code.

默认不持久化、不任意读写磁盘、不访问 GitHub、不调用模型、不开网络监听。stdout 只承载协议；stderr 只包含通用诊断码（`MCP_PROTOCOL_ERROR`、`MCP_STDIN_ERROR`、`MCP_STDOUT_ERROR`）。逐字稿内容按请求返回给调用方宿主，因此宿主的隐私设置仍然适用。本阶段不发布 npm 包、历史存储、HTTP 传输或客户端插件。

## 验证状态

本地 SDK 源码/编译产物子进程测试全部通过。真实的 Codex CLI/App Server Skill 与五工具发现也已通过；[验收细节与项目级安装](CLIENT-SETUP.md)区分了调用级覆盖与受信任的项目配置加载。Cursor UI 验证按 2026-11-27 第一期范围决议（仅 Codex）延后；模型层行为是独立的发布检查项。服务端与本地插件包均已实现。公开发布与完整的客户端/模型验收仍未完成。
