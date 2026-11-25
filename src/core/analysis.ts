import {MeetingInputSchema,MeetingAnalysisSchema,type MeetingAnalysis} from "../domain/schema.js";
import {buildEvidenceIndex,validateEvidenceWithIndex} from "./evidence.js";

/** Validate model-authored data against the exact normalized transcript. */
export interface ValidateAnalysisOptions {
  /** 绝对截止时间（Date.now() 毫秒）。超过后抛 WORK_LIMIT_EXCEEDED。 */
  deadline?: number;
}

export function validateAnalysis(input:unknown,draft:unknown,options:ValidateAnalysisOptions={}):MeetingAnalysis {
 const source=MeetingInputSchema.parse(input);
 const analysis=MeetingAnalysisSchema.parse(draft);
 if(analysis.meetingId!==source.meeting.id)throw new Error("ANALYSIS_MEETING_MISMATCH");
 // 证据索引按整份 analysis 只建一次：分析条目很多时避免每条目重复扫描 segments。
 const evidenceIndex=buildEvidenceIndex(source);
 const groups=[analysis.topics,analysis.decisions,analysis.actionItems,analysis.risks,analysis.openQuestions,analysis.conflicts];
 for(const group of groups){
  const ids=new Set<string>();
  for(const item of group){
   if(options.deadline!==undefined&&Date.now()>options.deadline)throw new Error("WORK_LIMIT_EXCEEDED");
   if("id" in item){if(ids.has(item.id))throw new Error("ANALYSIS_DUPLICATE_ID");ids.add(item.id);}
   const evidenceErrors=validateEvidenceWithIndex(evidenceIndex,item.evidence,"fragment",options.deadline);
   // 保留错误码前缀（MCP 仍按 ":" 拆出 ANALYSIS_EVIDENCE_INVALID），同时带上具体原因便于 CLI 定位。
   if(evidenceErrors.length)throw new Error("ANALYSIS_EVIDENCE_INVALID: "+evidenceErrors.join("; "));
  }
 }
 return analysis;
}
