# Output contract: analysis-schema@1.0

The generated `analysis.schema.json` in this folder describes the full payload accepted by Core's report command. It is exported from `src/domain/schema.ts` by `npm run skill:schema`; update it with Core changes. Unknown nested properties are rejected.

Required envelope: schemaVersion (literal "1.0"), meetingId (copy normalized input), generatedAt (UTC ISO timestamp), summary (string array), topics, decisions, actionItems, risks, openQuestions, conflicts. All arrays must be present; unused arrays are empty.

Required item fields:

| Array | Fields |
|---|---|
| topics | title, summary, evidence |
| decisions | id, statement, status, confidence, evidence |
| actionItems | id, title, status, confidence, evidence; optional description, assignee, dueDate |
| risks | id, description, severity, evidence |
| openQuestions | id, question, evidence |
| conflicts | id, description, evidence |

Decision status: confirmed, proposed, rejected, superseded, unclear. Action status: proposed, accepted, in_progress, done, blocked, unknown. Confidence: high, medium, low. Severity: low, medium, high, critical, unknown. IDs must be unique within each item category.

Each item's evidence array must be nonempty. Prefer `{sourceId, segmentId, lineStart, lineEnd, quote}` copied from the normalized input. Bounds are positive integers inclusive, must be supplied together and fall within the cited segment. A quote must occur within the cited lines. Segment and source must match. Unknown optional values are omitted, never null or invented.

Textual support does not prove an interpretation is true. Historical comparisons, recommendations and issue drafts are separate narrative artifacts, not additional fields in this contract.

Export headers such as `Demo User(00:01:37):` can populate optional speaker/timestamp fields. Evidence metadata, when supplied, must match its cited normalized segment. Reports show these as source labels and timestamps; a label does not verify the actual speaker or task owner.
