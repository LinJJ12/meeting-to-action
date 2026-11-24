import {EvidenceRefSchema,MeetingInputSchema,type EvidenceRef,type MeetingInput} from "../domain/schema.js";
export function evidenceForSegment(input:MeetingInput,segmentId:string):EvidenceRef {
 MeetingInputSchema.parse(input);
 const s=input.segments.find(x=>x.id===segmentId);
 if(!s)throw new Error("EVIDENCE_REFERENCE_INVALID: "+segmentId);
 return {sourceId:s.sourceId,segmentId,lineStart:s.lineStart,lineEnd:s.lineEnd,quote:s.text.slice(0,240)};
}
export function validateEvidence(input:MeetingInput,refs:EvidenceRef[]):string[] {
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
  const candidates=segment?[segment]:input.segments.filter(x=>x.sourceId===ref.sourceId);
  const selected=candidates.filter(x=>start===undefined||end===undefined||(x.lineStart<=start&&x.lineEnd>=end));
  if(start!==undefined&&!selected.length){errors.push("Evidence lines outside segment bounds");continue;}
  if(!segment&&start===undefined){errors.push("Evidence requires a segment or line range");continue;}
  if(ref.quote!==undefined&&!selected.some(x=>{
   const text=start===undefined||end===undefined?x.text:x.text.split("\n").slice(start-x.lineStart,end-x.lineStart+1).join("\n");
   return text.includes(ref.quote!);
  }))errors.push("Evidence quote does not match cited text");
 }
 return errors;
}
