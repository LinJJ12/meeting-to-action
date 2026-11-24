import {MeetingInputSchema,MeetingAnalysisSchema,type MeetingAnalysis} from "../domain/schema.js";
import {validateEvidence} from "./evidence.js";

/** Validate model-authored data against the exact normalized transcript. */
export function validateAnalysis(input:unknown,draft:unknown):MeetingAnalysis {
 const source=MeetingInputSchema.parse(input);
 const analysis=MeetingAnalysisSchema.parse(draft);
 if(analysis.meetingId!==source.meeting.id)throw new Error("ANALYSIS_MEETING_MISMATCH");
 const groups=[analysis.topics,analysis.decisions,analysis.actionItems,analysis.risks,analysis.openQuestions,analysis.conflicts];
 for(const group of groups){
  const ids=new Set<string>();
  for(const item of group){
   if("id" in item){if(ids.has(item.id))throw new Error("ANALYSIS_DUPLICATE_ID");ids.add(item.id);}
   if(validateEvidence(source,item.evidence).length)throw new Error("ANALYSIS_EVIDENCE_INVALID");
  }
 }
 return analysis;
}
