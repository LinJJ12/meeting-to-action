简体中文（主版） | [English](../en/guides/CLI-ERRORS.md)

# CLI 错误码与退出码参考

适用于 CLI 的 `analyze` / `inspect` / `report` 与 `setup:client` 安装器。MCP 侧的工具边界、限额与 Known codes 清单见 [MCP 文档](MCP.md)；minutes 相关错误码的校验规则详见[会议纪要展示契约](../contracts/MINUTES-CONTRACT.md)；`analyze` 的重试与输入限额语义见[分析引擎](../en/guides/ANALYSIS-ENGINE.md)。

## 退出码

- `0` 成功
- `1` 运行错误（含非法 `--mode` 取值）
- `2` 用法错误（未知参数、缺参数、非 analyze 命令使用 analyze 专属旗标）

## 错误码

| 错误码 | 含义 |
|---|---|
| `CONFIG_MISSING` | `analyze` 缺 `OPENAI_API_KEY` / `OPENAI_MODEL` |
| `CONFIG_INVALID` | 环境文件不可读、`OPENAI_TIMEOUT_MS` 越界、`OPENAI_BASE_URL` scheme 不合法（非 https 且非 loopback 明文 http） |
| `INPUT_UNSUPPORTED` / `INPUT_EMPTY` | 逐字稿扩展名不支持 / 内容为空 |
| `INPUT_SIZE_LIMIT` | 输入超过 2 MiB（analysis 4 MiB） |
| `INPUT_SEGMENT_LIMIT` | 归一化后段数超过 10,000 |
| `INPUT_JSON_INVALID` | normalized / analysis / minutes JSON 文件读取或解析失败 |
| `OUT_PATH_INVALID` | `--out` 为 UNC/设备命名空间/盘符相对/备用数据流形态 |
| `INPUT_SCHEMA_INVALID` | normalized JSON、analysis JSON 或 minutes JSON 不符合 schema |
| `ANALYSIS_MEETING_MISMATCH` / `ANALYSIS_DUPLICATE_ID` / `ANALYSIS_EVIDENCE_INVALID` | analysis 与输入会议身份不符 / 条目 ID 重复 / 证据校验失败 |
| `ANALYSIS_INVALID_JSON` / `ANALYSIS_SCHEMA_INVALID` | 模型输出不可解析为 JSON / JSON 合法但不符合 schema（重试耗尽后） |
| `MINUTES_MISSING` / `MINUTES_*` / `RENDER_MODE_INVALID` | minutes 契约与渲染模式错误（见[展示契约](../contracts/MINUTES-CONTRACT.md)） |
| `HTTP_ERROR` / `REQUEST_FAILED` / `REQUEST_TIMEOUT` / `REQUEST_ABORTED` | provider 返回非 2xx / 网络失败 / 超时 / 外部中止 |
| `RESPONSE_TOO_LARGE` / `BODY_READ_FAILED` / `INVALID_JSON` / `EMPTY_COMPLETION` / `PROVIDER_RESPONSE_INVALID` | provider 响应体超限 / 读取失败 / 非 JSON / 空 completion / 形状不合法 |
| `SETUP_*` | `setup:client` 安装器错误（路径形态、越界、冲突、缺构建产物等） |

新增错误码时必须同步本文件与 `docs/guides/MCP.md` 的 Known codes 行（由 `tests/docs-consistency.test.ts` 双向把关）。
