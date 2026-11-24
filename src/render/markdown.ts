import type {MeetingAnalysis,EvidenceRef} from "../domain/schema.js";
import {MeetingAnalysisSchema} from "../domain/schema.js";
// Escape untrusted text before placing it in Markdown or HTML-capable viewers.
const text=(value:string)=>value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/([\\`*_{}\[\]()#+.!|~-])/g,"\\$1").replace(/[\r\n]+/g," ");
const cell=(value?:string)=>text(value??"TBD");
const evidence=(refs:EvidenceRef[])=>refs.map(ref=>"  - Evidence: "+text(ref.sourceId)+(ref.segmentId?" / "+text(ref.segmentId):"")+(ref.lineStart!==undefined?" lines "+ref.lineStart+"–"+(ref.lineEnd??ref.lineStart):"")+(ref.quote?" — “"+text(ref.quote)+"”":""));
export function renderMarkdown(value:MeetingAnalysis):string {
 const d=MeetingAnalysisSchema.parse(value);
 return ["# Meeting report: "+text(d.meetingId),"","## Summary",...(d.summary.length?d.summary.map(x=>"- "+text(x)):["- No summary supplied."]),
 "","## Topics",...(d.topics.length?d.topics.flatMap(x=>["- **"+text(x.title)+"**: "+text(x.summary),...evidence(x.evidence)]):["- None extracted."]),
 "","## Decisions",...(d.decisions.length?d.decisions.flatMap(x=>["- **["+x.status+"]** "+text(x.statement)+" (confidence: "+x.confidence+")",...evidence(x.evidence)]):["- None extracted."]),
 "","## Action items","| Task | Owner | Deadline | Status | Confidence |","|---|---|---|---|---|",...(d.actionItems.length?d.actionItems.map(x=>"| "+cell(x.title)+" | "+cell(x.assignee)+" | "+cell(x.dueDate)+" | "+x.status+" | "+x.confidence+" |"):["| None extracted | — | — | — | — |"]),
 ...d.actionItems.flatMap(x=>["","- Task: "+text(x.title),...(x.description?["  - "+text(x.description)]:[]),...evidence(x.evidence)]),
 "","## Risks",...(d.risks.length?d.risks.flatMap(x=>["- ["+x.severity+"] "+text(x.description),...evidence(x.evidence)]):["- None extracted."]),
 "","## Open questions",...(d.openQuestions.length?d.openQuestions.flatMap(x=>["- "+text(x.question),...evidence(x.evidence)]):["- None extracted."]),
 "","## Conflicts",...(d.conflicts.length?d.conflicts.flatMap(x=>["- "+text(x.description),...evidence(x.evidence)]):["- None extracted."]),"","_Generated: "+d.generatedAt+"_",""].join("\n");
}
