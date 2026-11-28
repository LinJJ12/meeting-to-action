# 会议纪要展示契约 minutes-contract@1.0

独立、带版本号的展示契约：它只描述「怎么读」，不拥有事实。负责人、期限、状态、严重度等事实一律来自 `analysis-schema@1.0` 的 `decisions`、`actionItems`、`risks`、`openQuestions`、`conflicts`。

- 运行时契约：`src/domain/minutes.ts`（Zod，`.strict()`）；校验器：`validateMinutes(input, analysis, minutes)`（`src/core/minutes.ts`）；渲染器：`renderMinutesDocument(input, analysis, minutes, {mode?, appendix?})`（`src/render/minutes.ts`）。
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
| `sections[]` | `{ id, heading, claims[] }` | 是 | 阅读顺序的议题分节。五类可引用条目都为空时可用 `[]` |
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
6. **任务全覆盖**：`analysis.actionItems` 的每个 `id` 至少被某条 claim 的 `refs` 引用一次 → `MINUTES_ACTION_COVERAGE`。覆盖只统计语义明确的引用：`followup` 一律算；`progress` 在 id 未被其它分组共用时才算（跨组同名 id 时请改用 `followup` 或唯一 id，否则按未覆盖拒绝）
7. 结构必须严格符合 Zod 契约（未知字段拒绝、`claims`/`refs` 非空、版本文档字面量等）。存在可引用条目时 `sections` 不能为空；`claim.id` 必须在整份纪要中唯一。违反时返回 `MINUTES_SCHEMA_INVALID`。

规则 4 与 5 共用 `MINUTES_KIND_MISMATCH`：两者都是「claim 与所引事实条目的语义类型不符」，拆开写只是为了让「类型匹配」和「状态子集」两件事分别可读。

## 错误码

| code | 触发条件 |
| --- | --- |
| `MINUTES_SCHEMA_INVALID` | 结构不符合契约（规则 7），消息含字段路径与违规处数 |
| `MINUTES_CONTRACT_UNSUPPORTED` | `contractVersion` 不是受支持版本（规则 2） |
| `MINUTES_MEETING_MISMATCH` | `meetingId` 与 analysis 不一致（规则 1） |
| `MINUTES_REF_UNKNOWN` | `refs` 指向 analysis 中不存在的条目（规则 3） |
| `MINUTES_KIND_MISMATCH` | `kind` 与条目类型不匹配，或 `progress` 的 status 不在允许子集内（规则 4、5） |
| `MINUTES_ACTION_COVERAGE` | 存在未被任何 claim 明确引用的 actionItem（规则 6），消息列出缺失 id |

接线层另有两个入口错误码，不属于 `validateMinutes` 的契约错误：`MINUTES_MISSING`（要求 `minutes`/`actions` 模式但未提供 minutes 编辑稿）与 `RENDER_MODE_INVALID`（渲染器收到非法模式值）。CLI 直接以 `<code>: <message>` 写入 stderr 并 exit 1；MCP 把两者映射为 `isError: true` 的稳定码。

## 渲染与接线（阶段 B）

`renderMinutesDocument` 的 `mode` 有三档，`appendix` 默认 `true`：

| mode | 输出 |
| --- | --- |
| `minutes` | 主稿（标题、要点、分节 claim、行动清单）+ 溯源附录 |
| `actions` | 仅行动清单 |
| `evidence` | 直接委托 `renderMarkdown`，与改造前的报告逐字节一致 |

CLI：

```sh
npm run dev -- report normalized.json --analysis analysis.json \
  [--minutes minutes.json] [--mode minutes|actions|evidence] [--no-appendix] [--out report.md]
```

- `npm run dev` 即 `tsx src/cli.ts`；构建后的等价入口是 `node dist/cli.js`。仓库不发布 npm 包，因此不存在名为 `meeting-to-action` 的可执行文件。
- 三个新参数只对 `report` 有效，出现在 `inspect`/`analyze` 上按用法错误处理。
- 默认模式：给了 `--minutes` 是 `minutes`，否则 `evidence`（既有输出不变）。
- `--mode minutes|actions` 但缺 `--minutes` → `MINUTES_MISSING`；未知 `--mode` 值 → 用法错误 exit 1。
- `--minutes` 读取或 JSON 解析失败 → `INPUT_JSON_INVALID`（不回显宿主路径）；契约校验失败 → `MINUTES_*` 码。提供 `--minutes` 时即使 `--mode evidence` 也会先校验该编辑稿。
- `--out` 仍是单文件、`flag: "wx"` 拒绝覆盖。

MCP `render_report`：

- 新增可选参数 `minutes`（JSON 字符串，受 2 MiB 内容上限约束）、`mode`（枚举）与 `appendix`（布尔），对象仍拒绝未知字段。
- 默认模式规则与 CLI 相同；缺编辑稿却要求 `minutes`/`actions` 返回 `MINUTES_MISSING`；非法 `mode` 在 Schema 层即被拒绝为 `INPUT_INVALID`。
- 渲染前顺序固定：`validateAnalysis`（既有）→ `validateMinutes`（有 minutes 时）→ 渲染；返回 `{markdown}`。
- 错误码白名单新增 6 个契约码（含 `MINUTES_KIND_MISMATCH`）、接线层的 `MINUTES_MISSING` 与渲染器的 `RENDER_MODE_INVALID`。

## 与 analysis-schema@1.0 的关系

- 不新增、不修改 `analysis-schema@1.0` 的字段与版本；minutes 是叠加在事实之上的展示层契约。
- analysis 是事实唯一来源；minutes 只持有编辑性文字和 id 引用。渲染层负责把 id 解析回事实并显示中文状态；阶段 B 已把渲染接入 CLI `report` 与 MCP `render_report`（见上节），未提供 minutes 的路径保持原 evidence 输出。
- 校验器签名 `validateMinutes(input, analysis, minutes)`：`input`（规范化转写）当前保留未使用，供后续 evidence 交叉校验扩展；`analysis` 是事实基准；返回解析后的 `MinutesDocument`。

## 产品决策默认结论

1. **默认阅读模式**：提供 `--minutes` 时用 minutes 模式，否则保持 evidence（现有默认输出）——不静默改变既有行为。
2. **默认产物**：主稿 + 同文件附录（溯源表）为默认；双文件为可选配置。附录保证任务不丢、可复核。
3. **minutes 来源**：本阶段 minutes 由宿主模型/人工提供；`analyze` 不自动生成 minutes，避免语义归并进入确定性管线。
4. **标题**：允许宿主模型命名，但标注「编辑标题，非事实断言」，不得作为事实依据。
5. **语言**：主稿默认中文；`--lang en` 留待后续。
6. **插件默认交付**：普通会议分析、报告或保留证据的请求，Skill 生成纪要编辑稿并交付主稿与溯源附录。明确要求独立证据报告或仅执行清单时选择相应模式。CLI 和 MCP 直接调用仍按上文规则选择模式。
7. **栏目顺序**：各议题统一按已确认决定、进展、后续、待确认展示。兼容旧编辑稿时，提议、已否决、已作废显示在进展之后、后续之前。空栏目跳过，同一栏目内保留编辑稿顺序。
8. **纯汇报**：当五类可引用条目都为空时，可提供 `sections: []`。正文从分析议题生成，缺少议题时使用分析摘要。
9. **附录覆盖**：附录包含正文引用、全部议题证据和其余可引用条目的证据。要点与引文的语义一致性由宿主核对。
