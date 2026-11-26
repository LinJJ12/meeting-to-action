import { MeetingInputSchema, type MeetingInput } from "../domain/schema.js";

export type TranscriptFragment = {
  sourceId: string;
  segmentId: string;
  lineStart: number;
  lineEnd: number;
  text: string;
};
export type TranscriptChunk = { fragments: TranscriptFragment[]; charCount: number };

/** Count UTF-16 characters, including one separator between fragments. Never rewrite source IDs. */
export function splitTranscript(input: MeetingInput, maxChars: number): TranscriptChunk[] {
  MeetingInputSchema.parse(input);
  if (!Number.isInteger(maxChars) || maxChars < 1) throw new Error("CHUNK_LIMIT_INVALID");
  const chunks: TranscriptChunk[] = [];
  let chunk: TranscriptChunk = { fragments: [], charCount: 0 };
  const flush = () => {
    if (chunk.fragments.length) chunks.push(chunk);
    chunk = { fragments: [], charCount: 0 };
  };
  for (const segment of input.segments) {
    const lines = segment.text.split("\n");
    if (lines.length !== segment.lineEnd - segment.lineStart + 1)
      throw new Error("SEGMENT_LINE_COUNT_INVALID");
    let offset = 0;
    while (offset < lines.length) {
      if (lines[offset]!.length > maxChars) throw new Error("CHUNK_LINE_TOO_LONG");
      const separator = chunk.fragments.length ? 1 : 0;
      if (chunk.charCount + separator + lines[offset]!.length > maxChars) {
        flush();
        continue;
      }
      const start = offset;
      let text = lines[offset++]!;
      while (
        offset < lines.length &&
        chunk.charCount + separator + text.length + 1 + lines[offset]!.length <= maxChars
      )
        text += "\n" + lines[offset++]!;
      chunk.fragments.push({
        sourceId: segment.sourceId,
        segmentId: segment.id,
        lineStart: segment.lineStart + start,
        lineEnd: segment.lineStart + offset - 1,
        text,
      });
      chunk.charCount += separator + text.length;
    }
  }
  flush();
  return chunks;
}
