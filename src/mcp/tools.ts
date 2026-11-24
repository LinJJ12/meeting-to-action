import {z} from "zod";
import {MeetingInputSchema,MeetingAnalysisSchema} from "../domain/schema.js";
import {normalizeTranscript} from "../core/normalize.js";
import {splitTranscript} from "../core/split.js";
import {validateAnalysis} from "../core/analysis.js";
import {renderMarkdown} from "../render/markdown.js";
import {MAX_CONTENT_BYTES,MAX_REQUEST_BYTES,MAX_SEGMENTS} from "../core/limits.js";

// 上限常量与 CLI 共用同一来源（src/core/limits.ts），这里保留导出以免破坏既有引用。
export {MAX_CONTENT_BYTES,MAX_REQUEST_BYTES,MAX_SEGMENTS};
const content=z.string().max(MAX_CONTENT_BYTES);
const input=z.unknown(); // Full relational checks run inside the handler, with redacted errors.
const definitions={
 prepare_meeting:{description:"Normalize supplied TXT/Markdown content locally. No filesystem reads or model calls.",schema:z.object({content,fileName:z.string().min(1).max(1024),title:z.string().min(1).max(1024).optional()}).strict()},
 split_transcript:{description:"Split normalized content on line boundaries, preserving source segment IDs and line ranges. maxChars counts UTF-16 characters including fragment separators.",schema:z.object({input,maxChars:z.number().int().min(1).max(MAX_CONTENT_BYTES)}).strict()},
 get_meeting_schema:{description:"Return JSON Schemas for analysis-schema@1.0.",schema:z.object({contractVersion:z.literal("1.0")}).strict()},
 validate_analysis:{description:"Validate analysis structure, meeting identity and evidence against supplied normalized content.",schema:z.object({input,analysis:z.unknown()}).strict()},
 render_report:{description:"Validate supplied analysis against its source and return escaped Markdown. Does not write a file.",schema:z.object({input,analysis:z.unknown()}).strict()},
};
export const toolList=Object.entries(definitions).map(([name,tool])=>({name,description:tool.description,inputSchema:z.toJSONSchema(tool.schema),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}));
function boundedInput(value:unknown){
 const meeting=MeetingInputSchema.parse(value);
 if(meeting.segments.length>MAX_SEGMENTS)throw new Error("INPUT_SEGMENT_LIMIT");
 if(meeting.segments.reduce((sum,s)=>sum+Buffer.byteLength(s.text,"utf8"),0)>MAX_CONTENT_BYTES)throw new Error("INPUT_SIZE_LIMIT");
 return meeting;
}
const codes=new Set(["INPUT_EMPTY","INPUT_UNSUPPORTED","INPUT_SEGMENT_LIMIT","INPUT_SIZE_LIMIT","CHUNK_LINE_TOO_LONG","SEGMENT_LINE_COUNT_INVALID","ANALYSIS_MEETING_MISMATCH","ANALYSIS_DUPLICATE_ID","ANALYSIS_EVIDENCE_INVALID"]);
export function callTool(name:string,args:unknown):{content:{type:"text";text:string}[];isError?:boolean}{
 try{
  if(Buffer.byteLength(JSON.stringify(args)??"","utf8")>MAX_REQUEST_BYTES)throw new Error("INPUT_SIZE_LIMIT");
  let result:unknown;
  switch(name){
   case "prepare_meeting":{
    const a=definitions.prepare_meeting.schema.parse(args);
    if(Buffer.byteLength(a.content,"utf8")>MAX_CONTENT_BYTES)throw new Error("INPUT_SIZE_LIMIT");
    result=boundedInput(normalizeTranscript(a.content,a.fileName,{...(a.title?{title:a.title}:{}),maxSegments:MAX_SEGMENTS}));break;
   }
   case "get_meeting_schema":{
    definitions.get_meeting_schema.schema.parse(args);
    result={contractVersion:"1.0",input:z.toJSONSchema(MeetingInputSchema),analysis:z.toJSONSchema(MeetingAnalysisSchema)};break;
   }
   case "split_transcript":{
    const a=definitions.split_transcript.schema.parse(args);
    result={chunks:splitTranscript(boundedInput(a.input),a.maxChars)};break;
   }
   case "validate_analysis":case "render_report":{
    const a=definitions[name].schema.parse(args);
    const analysis=validateAnalysis(boundedInput(a.input),a.analysis);
    result=name==="validate_analysis"?{valid:true,analysis}:{markdown:renderMarkdown(analysis)};break;
   }
   default:return {isError:true,content:[{type:"text",text:"TOOL_UNKNOWN"}]};
  }
  return {content:[{type:"text",text:JSON.stringify(result)}]};
 }catch(error){
  const candidate=error instanceof Error?error.message.split(":")[0]!:"";
  return {isError:true,content:[{type:"text",text:codes.has(candidate)?candidate:"INPUT_INVALID"}]};
 }
}
