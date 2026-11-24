import {EvidenceRefSchema,MeetingInputSchema,type EvidenceRef,type MeetingInput} from "../domain/schema.js";

/**
 * Evidence 校验的严格程度。
 *
 * - `fragment`（默认）：允许省略 segmentId、允许段内子区间。用于宿主/Agent 撰写的
 *   分析与 split_transcript 产出的分块坐标。
 * - `strict`：必须给出已知 segmentId，且行号必须与 segment 边界完全一致。用于要求
 *   逐段精确引用的场景（例如未来的强约束模式）。
 *
 * 两种模式都校验 speaker / timestamp 等元数据必须与所引 segment 一致——这是
 * 「引用不可伪造」的底线，不得因为放宽行号而放弃。
 */
export type EvidenceMode="fragment"|"strict";

export function evidenceForSegment(input:MeetingInput,segmentId:string):EvidenceRef {
 MeetingInputSchema.parse(input);
 const s=input.segments.find(x=>x.id===segmentId);
 if(!s)throw new Error("EVIDENCE_REFERENCE_INVALID: "+segmentId);
 return {sourceId:s.sourceId,segmentId,lineStart:s.lineStart,lineEnd:s.lineEnd,quote:s.text.slice(0,240),...(s.speaker?{speaker:s.speaker}:{}),...(s.timestamp?{timestamp:s.timestamp}:{})};
}

export function validateEvidence(input:MeetingInput,refs:EvidenceRef[],mode:EvidenceMode="fragment"):string[] {
 const errors:string[]=[];
 if(!MeetingInputSchema.safeParse(input).success)return ["Invalid meeting input"];
 for(const ref of refs){
  if(!EvidenceRefSchema.safeParse(ref).success){errors.push("Invalid evidence reference");continue;}
  if(!input.sources.some(x=>x.id===ref.sourceId)){errors.push("Unknown source: "+ref.sourceId);continue;}
  const segment=ref.segmentId===undefined?undefined:input.segments.find(x=>x.id===ref.segmentId);
  if(ref.segmentId!==undefined&&!segment){errors.push("Unknown segment: "+ref.segmentId);continue;}
  if(segment&&segment.sourceId!==ref.sourceId){errors.push("Evidence source does not match segment");continue;}
  const start=ref.lineStart,end=ref.lineEnd;
  if((start===undefined)!==(end===undefined)){errors.push("Evidence requires both line bounds");continue;}
  if(start!==undefined&&end!==undefined&&end<start){errors.push("Evidence lineEnd precedes lineStart");continue;}
  if(mode==="strict"){
   if(!segment){errors.push("Evidence requires a known segmentId in strict mode");continue;}
   if(start===undefined||end===undefined){errors.push("Evidence requires complete line bounds in strict mode");continue;}
   if(start!==segment.lineStart||end!==segment.lineEnd){errors.push("Evidence line bounds must match the cited segment in strict mode");continue;}
  }
  const candidates=segment?[segment]:input.segments.filter(x=>x.sourceId===ref.sourceId);
  const selected=candidates.filter(x=>start===undefined||end===undefined||(x.lineStart<=start&&x.lineEnd>=end));
  if(start!==undefined&&!selected.length){errors.push("Evidence lines outside segment bounds");continue;}
  if(!segment&&start===undefined){errors.push("Evidence requires a segment or line range");continue;}
  if((ref.speaker!==undefined||ref.timestamp!==undefined)&&!selected.some(x=>(ref.speaker===undefined||x.speaker===ref.speaker)&&(ref.timestamp===undefined||x.timestamp===ref.timestamp)))errors.push("Evidence metadata does not match cited segment");
  if(ref.quote!==undefined&&!selected.some(x=>{
   const text=start===undefined||end===undefined?x.text:x.text.split("\n").slice(start-x.lineStart,end-x.lineStart+1).join("\n");
   return text.includes(ref.quote!);
  }))errors.push("Evidence quote does not match cited text");
 }
 return errors;
}