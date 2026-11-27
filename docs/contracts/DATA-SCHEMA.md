# Data Contracts

Initial design baseline; not a frozen API. All exchanged/persisted payloads carry a schema version.

```ts
export type EvidenceRef = {
  sourceId: string;
  segmentId?: string;
  speaker?: string;
  timestamp?: string;
  lineStart?: number;
  lineEnd?: number;
  quote?: string;
};

export type MeetingInput = {
  schemaVersion: "1.0";
  meeting: {
    id: string;
    title: string;
    date?: string;
    participants?: string[];
    language?: string;
  };
  sources: Array<{
    id: string;
    kind: "transcript" | "notes";
    format: "txt" | "markdown";
    fileName?: string;
    checksum?: string;
    transcriptFormat?:
      | "speaker-header"
      | "speaker-inline"
      | "timestamp-first"
      | "speaker-colon"
      | "speaker-bracket"
      | "mixed";
  }>;
  segments: Array<{
    id: string;
    sourceId: string;
    text: string;
    speaker?: string;
    timestamp?: string;
    lineStart: number;
    lineEnd: number;
  }>;
};

export type Decision = {
  id: string;
  statement: string;
  status: "confirmed" | "proposed" | "rejected" | "superseded" | "unclear";
  evidence: EvidenceRef[];
  confidence: "high" | "medium" | "low";
};

export type ActionItem = {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
  status: "proposed" | "accepted" | "in_progress" | "done" | "blocked" | "unknown";
  evidence: EvidenceRef[];
  confidence: "high" | "medium" | "low";
};

export type MeetingAnalysis = {
  schemaVersion: "1.0";
  meetingId: string;
  summary: string[];
  topics: Array<{ title: string; summary: string; evidence: EvidenceRef[] }>;
  decisions: Decision[];
  actionItems: ActionItem[];
  risks: Array<{
    id: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical" | "unknown";
    evidence: EvidenceRef[];
  }>;
  openQuestions: Array<{ id: string; question: string; evidence: EvidenceRef[] }>;
  conflicts: Array<{ id: string; description: string; evidence: EvidenceRef[] }>;
  generatedAt: string;
};
```

## Transcript input formats

`normalizeTranscript` accepts `.txt` / `.md` / `.markdown` and recognizes these line formats (including mixed files):

| `sources[].transcriptFormat` | example line | speaker | timestamp |
|---|---|---|---|
| `speaker-header` | `张三 (00:05:32)：` on its own line; text on following lines | 张三 | `00:05:32` |
| `speaker-time` | `说话人1 00:00` on its own line (optional role in parentheses, e.g. `说话人1（质量管理部部长） 00:25`); text on following lines | 说话人1 | `00:00:00` |
| `speaker-inline` | `说话人1 00:05:32 内容` | 说话人1 | `00:05:32` |
| `timestamp-first` | `00:05 说话人1 内容` | 说话人1 | `00:00:05` |
| `speaker-colon` | `说话人1：内容` | 说话人1 | absent |
| `speaker-bracket` | `【说话人1】内容` | 说话人1 | absent |

Rules:

- A new turn starts only at a complete export header, a line that begins with a timestamp, or a recognized anonymous speaker label (`说话人N` / `发言人N` / `参与者N` / `嘉宾` / `主持人` / `Speaker N`). Ordinary prose such as `Decision: defer launch.` is never guessed into a speaker.
- `speaker-inline` labels are also rejected when they look like dates, document titles, or paths (`年月日`, `《》`, `/`, `\`, `%`, or no letters at all). Real exports contain title lines such as `4月20日 11:15 B1录音`; attaching them as a speaker would make evidence point at the wrong person.
- `MM:SS` timestamps are normalized to `HH:MM:SS` (`00:05` → `00:00:05`); existing `HH:MM:SS` values are kept as-is. Missing timestamps stay absent (`timestamp` omitted and rendered as `—`): no time is invented, and no relative date is resolved.
- Segment `text` keeps the original source line(s) unchanged, so evidence quotes stay exact and line ranges map back to the file.
- `transcriptFormat` is `mixed` when one file combines several formats, and omitted when no speaker metadata was recognized (plain text).

## Evidence rules

- Material decisions, actions, risks, topics, and conflicts cite source evidence.
- Quotes are short and exact when included.
- Resource limits: at most 200 evidence references per entry and at most 4,000 characters per quote. Exceeding either is rejected as ANALYSIS_EVIDENCE_INVALID with the actual limit.
- Missing evidence means unverified, not confirmed.
- Speaker labels and timestamps are optional metadata. When supplied, they must equal the cited segment's own metadata; a mismatched label is rejected rather than rendered.
- A speaker label alone does not establish task ownership.
- Unknown owners and dates remain absent.

## Runtime validation

`src/domain/schema.ts` is the authoritative runtime contract. Material claim arrays require at least one evidence reference per item; unknown nested fields are rejected. Input source and segment IDs must be unique, segment sources must exist, and line ranges must be ordered and pairwise non-overlapping within one source: segments are canonical, disjoint timeline turns, so partially overlapping, nested and identical ranges are rejected. `normalizeTranscript` output satisfies this by construction.

> History: 2026-11 — as the closing item of the #13 resource-amplification fix, same-source segment line ranges must now be disjoint, enforced at the schema stage and surfaced as a schema error (`INPUT_INVALID` on MCP, the CLI schema-error code). Inputs produced by `normalizeTranscript` were already compliant, so only hand-crafted inputs can be affected. Rejection cases are covered by `tests/integrity.test.ts`, and the normalizer invariant is pinned by `tests/normalize.test.ts`.

**There is exactly one evidence validator: `validateEvidence(input, refs, mode)` in `src/core/evidence.ts`.** Every entry point calls it — the standalone `analyze` provider path, the `report` CLI command, and the MCP `validate_analysis` / `render_report` tools. It checks source and segment relationships, paired line bounds, exact quotes within the cited text, and speaker/timestamp metadata against the cited segment. Validation builds one per-source segment index per analysis and reuses it across entries, so cost grows with segments plus references rather than their product.

The `mode` argument selects how strict the reference shape must be:

| mode | segmentId | line bounds | used by |
|---|---|---|---|
| `fragment` (default) | optional | may be a sub-range inside the cited segment | `report`, MCP tools, `analyze` |
| `strict` | required | must equal the cited segment's boundaries exactly | available for callers that require exact per-segment citations |

Metadata (`speaker`, `timestamp`) and quotes are validated identically in both modes: relaxing the line range never relaxes "the citation cannot be fabricated". A source ID alone is insufficient in either mode. This verifies textual support, not the semantic truth of an interpretation.

> History: before this was unified, the `analyze` path used its own close-but-different checker. That checker ignored `speaker`/`timestamp` (fabricated labels passed) while demanding exactly-equal line bounds, so the same analysis could be accepted by `analyze` and rejected by `report`. Both directions are now covered by `tests/evidence-consistency.test.ts`.

`renderMarkdown` validates analysis structure, escapes untrusted Markdown/HTML, and preserves topics and evidence. It does not have the source input and cannot verify evidence against original text. The `report` command verifies meetingId, duplicate item IDs and evidence through `validateAnalysis` before rendering. Summary strings currently have no evidence field and remain unverified narrative.

## Minutes display contract

`minutes-contract@1.0` is a separate, versioned display contract for readable minutes (`src/domain/minutes.ts`; exported JSON Schema at `skills/meeting-to-action/references/minutes.schema.json`). It owns headings, claims, and id references only — never task facts such as assignee, dueDate, or status, which remain authoritative in analysis-schema@1.0. `validateMinutes(input, analysis, minutes)` deterministically enforces meeting id, contract version, known refs, kind/type match, and full action-item coverage, and fails with `MINUTES_*` codes. See [MINUTES-CONTRACT.md](MINUTES-CONTRACT.md) for fields, all seven rules, error codes, and the default product decisions.
