# Data Contracts

Initial design baseline; not a frozen API. All exchanged/persisted payloads carry a schema version.

```ts
export type EvidenceRef = {
  sourceId: string;
  segmentId?: string;
  speaker?: string;
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
- Missing evidence means unverified, not confirmed.
- A speaker label alone does not establish task ownership.
- Unknown owners and dates remain absent.

## Runtime validation

`src/domain/schema.ts` is the authoritative runtime contract. Material claim arrays require at least one evidence reference per item; unknown nested fields are rejected. Input source and segment IDs must be unique, segment sources must exist, and line ranges must be ordered.

Call `validateEvidence(input, refs)` for all claim evidence before accepting analysis. It checks source/segment relationships, paired line bounds within a segment, and exact quotes within the cited text. A source ID alone is insufficient. Line-only references currently must fit within one segment. This verifies textual support, not the semantic truth of an interpretation.

`renderMarkdown` validates analysis structure, escapes untrusted Markdown/HTML, and preserves topics and evidence. It does not have the source input and cannot verify evidence against original text. The `report` command verifies meetingId, duplicate item IDs and evidence through `validateAnalysis` before rendering. Summary strings currently have no evidence field and remain unverified narrative.
