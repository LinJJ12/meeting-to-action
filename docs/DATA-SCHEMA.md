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

## Evidence rules

- Material decisions, actions, risks, topics, and conflicts cite source evidence.
- Quotes are short and exact when included.
- Resource limits: at most 200 evidence references per entry and at most 4,000 characters per quote. Exceeding either is rejected as ANALYSIS_EVIDENCE_INVALID with the actual limit.
- Missing evidence means unverified, not confirmed.
- Speaker labels and timestamps are optional metadata. When supplied, they must equal the cited segment's own metadata; a mismatched label is rejected rather than rendered.
- A speaker label alone does not establish task ownership.
- Unknown owners and dates remain absent.

## Runtime validation

`src/domain/schema.ts` is the authoritative runtime contract. Material claim arrays require at least one evidence reference per item; unknown nested fields are rejected. Input source and segment IDs must be unique, segment sources must exist, and line ranges must be ordered.

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
