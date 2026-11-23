# Data Contracts

Initial design baseline; not a frozen API. All exchanged/persisted payloads carry a schema version.

```ts
export type EvidenceRef = {
  sourceId: string;
  segmentId?: string;
  speaker?: string;
  startMs?: number;
  endMs?: number;
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
    startMs?: number;
    endMs?: number;
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
  dependencies?: string[];
  evidence: EvidenceRef[];
  confidence: "high" | "medium" | "low";
};

export type MeetingAnalysis = {
  schemaVersion: "1.0";
  meetingId: string;
  summary: string[];
  decisions: Decision[];
  actionItems: ActionItem[];
  risks: Array<{
    id: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical" | "unknown";
    evidence: EvidenceRef[];
  }>;
  openQuestions: Array<{ id: string; question: string; evidence: EvidenceRef[] }>;
  conflicts: Array<{ description: string; evidence: EvidenceRef[] }>;
  generatedAt: string;
};
```

## Evidence rules

- Material decisions, actions, risks, topics, and conflicts cite source evidence.
- Quotes are short and exact when included.
- Missing evidence means unverified, not confirmed.
- A speaker label alone does not establish task ownership.
- Unknown owners and dates remain absent.
