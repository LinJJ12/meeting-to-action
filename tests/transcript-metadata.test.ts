import {it,expect} from "vitest";
import {normalizeTranscript} from "../src/core/normalize.js";
import {evidenceForSegment,validateEvidence} from "../src/core/evidence.js";
import {renderMarkdown} from "../src/render/markdown.js";
it("preserves exported speaker/time headers as metadata without changing source lines",()=>{
 const input=normalizeTranscript("演示用户(00:01:37):\n我会复查。\n\n另一标签(01:04:17)：\n待确认。","demo.md");
 expect(input.segments[0]).toMatchObject({speaker:"演示用户",timestamp:"00:01:37",lineStart:1,lineEnd:2,text:"演示用户(00:01:37):\n我会复查。"});
 expect(evidenceForSegment(input,"seg-2")).toMatchObject({speaker:"另一标签",timestamp:"01:04:17"});
});
it("does not infer metadata from ordinary prose or invalid timestamps",()=>{
 for(const content of ["Discuss user(00:00:00): inline text","用户(00:60:00):\n内容"]){const input=normalizeTranscript(content,"demo.txt");expect(input.segments[0]?.speaker).toBeUndefined();}
});
it("includes speaker labels and source timestamps in report citations",()=>{
 const input=normalizeTranscript("演示用户(00:01:37):\n提议复查。","demo.md");
 const draft={schemaVersion:"1.0" as const,meetingId:input.meeting.id,generatedAt:"2026-01-01T00:00:00Z",summary:[],topics:[{title:"复查",summary:"提议",evidence:[{...evidenceForSegment(input,"seg-1"),speaker:"演示用户",timestamp:"00:01:37",quote:"提议复查。"}]}],decisions:[],actionItems:[],risks:[],openQuestions:[],conflicts:[]};
 const md=renderMarkdown(draft);expect(md).toContain("00:01:37");expect(md).toContain("演示用户");
});

it("rejects invented speaker and timestamp metadata",()=>{
 const input=normalizeTranscript("演示用户(00:01:37):\n内容。","demo.md");
 const ref=evidenceForSegment(input,"seg-1");
 expect(validateEvidence(input,[{...ref,speaker:"另一人"}]).length).toBeGreaterThan(0);
 expect(validateEvidence(input,[{...ref,timestamp:"00:05:00"}]).length).toBeGreaterThan(0);
});
