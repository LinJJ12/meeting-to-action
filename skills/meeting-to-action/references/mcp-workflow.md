# MCP-enhanced workflow

Use these tools only when actually present in the host's tool inventory. Client prefixes may vary; identify the server by its meeting tool descriptions. Do not invent calls or assume MCP was installed just because this Skill was copied.

1. Read the selected transcript through the host's authorized file tools. `prepare_meeting` accepts inline content and fileName; it cannot read a path. Keep the returned full normalized input.
2. Call `get_meeting_schema` with contractVersion "1.0". Check compatibility with this Skill. If incompatible, stop strict JSON processing and explain the mismatch rather than relabel the version.
3. For a large meeting use `split_transcript` with input and a suitable maxChars budget. Read all returned fragments or disclose omissions; retain original IDs and line coordinates. Do not normalize fragments as new meetings. An oversized single line must be handled explicitly instead of silently truncated.
4. Apply analysis-rules.md and author the complete analysis JSON. The host model does interpretation; these tools do not call a separate model or need another API key.
5. For a normal report request, author the minutes draft and call `render_report` with full input, analysis, the JSON-encoded `minutes`, `mode: "minutes"` and `appendix: true`. Use the standalone evidence or actions mode when explicitly requested. The tool checks schema and evidence before returning Markdown. `validate_analysis` is available for intermediate checking. When rendering fails, correct the draft and retry it in the requested mode.
6. Save returned Markdown through the host only if requested/authorized. The MCP does not save reports or create external issues. If tools are absent, use Core or the Markdown fallback from SKILL.md.

Limits: 2 MiB UTF-8 meeting text, 10,000 segments, 4 MiB serialized request. Smaller chunks do not remove the full-input validation limit. For inputs exceeding the supported limit disclose it and use a clearly marked fallback or ask for a scoped subset.
