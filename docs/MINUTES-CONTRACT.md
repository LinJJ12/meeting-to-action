# 会议纪要展示契约 minutes-contract@1.0

独立、带版本号的展示契约：它只描述「怎么读」，不拥有事实。负责人、期限、状态、严重度等事实一律来自 `analysis-schema@1.0` 的 `decisions`、`actionItems`、`risks`、`openQuestions`、`conflicts`。

- 运行时契约：`src/domain/minutes.ts`（Zod，`.strict()`）；校验器：`validateMinutes(input, analysis, minutes)`（`src/core/minutes.ts`）。
- 导出产物：`skills/meeting-to-action/references/minutes.schema.json`，由 `npm run skill:schema` 生成；`tests/minutes-schema.test.ts` 对拍确保产物与运行时契约一致。
- 确定性代码只做「结构 + id 映射」校验；议题归并、措辞压缩、标题命名由宿主模型或人工完成。
- 校验失败抛 `MinutesContractError`，`error.code` 为下文 6 个错误码之一，`error.message` 以错误码开头并附中文细节。

## 字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `schemaVersion` | `"1.0"` | 是 | 数据结构版本 |
| `contractVersion` | `"1.0"` | 是 | 展示契约版本；当前仅支持 1.0 |
| `meetingId` | string | 是 | 必须等于所引用 analysis 的 `meetingId` |
| `generatedAt` | ISO 8601 datetime | 是 | 生成时间 |
| `title` | string | 是 | 编辑标题，非事实断言（允许模型命名） |
| `meta.date` | string | 否 | 展示用会议日期 |
| `meta.participants` | string[] | 否 | 展示用参会人，不建立任务归属 |
| `highlights` | string[] | 是 | 要点摘录；可为空数组，元素须为非空串 |
| `sections[]` | `{ id, heading, claims[] }` | 是 | 阅读顺序的议题分节；至少 1 节 |
| `sections[].claims[]` | `{ id, kind, text, detail?, refs[] }` | 是 | 每节至少 1 条；`kind` 见下 |
| `actionNote` | string | 否 | 行动清单前的说明 |

`claim.kind` 语义与可选引用类型：

- `progress`：进展/已完成事项 → `actionItems`（status 为 `done`/`in_progress`/`blocked`）或 `decisions`
- `decision`：已确认决定 → `decisions`
- `followup`：后续动作 → `actionItems`
- `open`：待确认/风险/分歧 → `openQuestions`、`risks`、`conflicts`

`refs` 至少 1 条，必须指向 analysis 中真实存在的条目 `id`。`detail` 是可选的编辑性补充。契约中**没有任何事实字段**：`assignee`、`dueDate`、`status` 等若出现在 claim 上会被 `.strict()` 拒绝。

## 校验规则（7 条，违反即拒绝）

1. `minutes.meetingId === analysis.meetingId` → `MINUTES_MEETING_MISMATCH`
2. `contractVersion` 必须受支持（当前为 `1.0`）→ `MINUTES_CONTRACT_UNSUPPORTED`（优先于结构检查）
3. 所有 `refs` 必须命中 analysis 五类事实条目（decisions / actionItems / risks / openQuestions / conflicts）的 `id` → `MINUTES_REF_UNKNOWN`
4. `kind` 与所引条目类型匹配（见上表）→ `MINUTES_KIND_MISMATCH`
5. `progress` 引用行动项时，其 status 必须属于 `done` / `in_progress` / `blocked`；否则同样 → `MINUTES_KIND_MISMATCH`
6. **任务全覆盖**：`analysis.actionItems` 的每个 `id` 至少被某条 claim 的 `refs` 引用一次 → `MINUTES_ACTION_COVERAGE`
7. 结构必须严格符合 Zod 契约（未知字段拒绝、`sections`/`claims`/`refs` 非空、版本文档字面量等）→ `MINUTES_SCHEMA_INVALID`（附首个违规字段路径）

规则 4 与 5 共用 `MINUTES_KIND_MISMATCH`：两者都是「claim 与所引事实条目的语义类型不符」，拆开写只是为了让「类型匹配」和「状态子集」两件事分别可读。

## 错误码

| code | 触发条件 |
| --- | --- |
| `MINUTES_SCHEMA_INVALID` | 结构不符合契约（规则 7），消息含字段路径与违规处数 |
| `MINUTES_CONTRACT_UNSUPPORTED` | `contractVersion` 不是受支持版本（规则 2） |
| `MINUTES_MEETING_MISMATCH` | `meetingId` 与 analysis 不一致（规则 1） |
| `MINUTES_REF_UNKNOWN` | `refs` 指向 analysis 中不存在的条目（规则 3） |
| `MINUTES_KIND_MISMATCH` | `kind` 与条目类型不匹配，或 `progress` 的 status 不在允许子集内（规则 4、5） |
| `MINUTES_ACTION_COVERAGE` | 存在未被任何 claim 引用的 actionItem（规则 6），消息列出缺失 id |

## 与 analysis-schema@1.0 的关系

- 不新增、不修改 `analysis-schema@1.0` 的字段与版本；minutes 是叠加在事实之上的展示层契约。
- analysis 是事实唯一来源；minutes 只持有编辑性文字和 id 引用。渲染层（阶段 B）负责把 id 解析回事实并显示中文状态，本阶段不实现渲染、不接 CLI/MCP。
- 校验器签名 `validateMinutes(input, analysis, minutes)`：`input`（规范化转写）当前保留未使用，供后续 evidence 交叉校验扩展；`analysis` 是事实基准；返回解析后的 `MinutesDocument`。

## 产品决策默认结论

1. **默认阅读模式**：提供 `--minutes` 时用 minutes 模式，否则保持 evidence（现有默认输出）——不静默改变既有行为。
2. **默认产物**：主稿 + 同文件附录（溯源表）为默认；双文件为可选配置。附录保证任务不丢、可复核。
3. **minutes 来源**：本阶段 minutes 由宿主模型/人工提供；`analyze` 不自动生成 minutes，避免语义归并进入确定性管线。
4. **标题**：允许宿主模型命名，但标注「编辑标题，非事实断言」，不得作为事实依据。
5. **语言**：主稿默认中文；`--lang en` 留待后续。