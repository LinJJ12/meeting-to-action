import {it,expect} from "vitest";
import {MeetingAnalysisSchema} from "../src/domain/schema.js";
import {renderMarkdown} from "../src/render/markdown.js";
const fixture=()=>({schemaVersion:"1.0" as const,meetingId:"meeting",summary:["<img src=x onerror=alert(1)>","[click](https://example.com)"],topics:[{title:"Plan",summary:"Discussed",evidence:[{sourceId:"source",segmentId:"seg-1",quote:"defer"}]}],decisions:[],actionItems:[],risks:[],openQuestions:[],conflicts:[],generatedAt:"2026-01-01T00:00:00Z"});
it("renders topics, evidence and escaped untrusted text",()=>{const md=renderMarkdown(fixture());expect(md).toContain("## Topics");expect(md).toContain("defer");expect(md).toContain("Evidence:");expect(md).not.toContain("<img");expect(md).not.toContain("[click](");});
it("rejects evidence-free claims and unexpected nested properties",()=>{const x=fixture();expect(MeetingAnalysisSchema.safeParse({...x,topics:[{...x.topics[0],evidence:[]}]}).success).toBe(false);expect(MeetingAnalysisSchema.safeParse({...x,topics:[{...x.topics[0],unexpected:true}]}).success).toBe(false);});
