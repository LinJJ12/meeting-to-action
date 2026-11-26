import {z} from "zod";
import {MeetingInputSchema,MeetingAnalysisSchema} from "../domain/schema.js";
import type {MinutesDocument} from "../domain/minutes.js";
import {normalizeTranscript} from "../core/normalize.js";
import {splitTranscript} from "../core/split.js";
import {validateAnalysis} from "../core/analysis.js";
import {validateMinutes} from "../core/minutes.js";
import {renderMarkdown} from "../render/markdown.js";
import {renderMinutesDocument,resolveReadingMode} from "../render/minutes.js";
import {assertContentWithinLimit,assertMeetingInputWithinLimits,MAX_CONTENT_BYTES,MAX_REQUEST_BYTES,MAX_SEGMENTS,MAX_TOOL_WORK_MS} from "../core/limits.js";
import {describeZodError} from "../core/zod-detail.js";

// 上限常量与 CLI 共用同一来源（src/core/limits.ts），这里保留导出以免破坏既有引用。
export {MAX_CONTENT_BYTES,MAX_REQUEST_BYTES,MAX_SEGMENTS};
// 不设字符数上限：Zod 的 max() 按 UTF-16 字符数计，会先于字节校验触发，
// 使 ASCII 超限报 INPUT_INVALID 而中文超限报 INPUT_SIZE_LIMIT。超限统一交给字节校验。
const content=z.string();
const input=z.unknown(); // Full relational checks run inside the handler, with redacted errors.
const definitions={
 prepare_meeting:{description:"Normalize supplied TXT/Markdown content locally. No filesystem reads or model calls.",schema:z.object({content,fileName:z.string().min(1).max(1024),title:z.string().min(1).max(1024).optional()}).strict()},
 split_transcript:{description:"Split normalized content on line boundaries, preserving source segment IDs and line ranges. maxChars counts UTF-16 characters including fragment separators.",schema:z.object({input,maxChars:z.number().int().min(1).max(MAX_CONTENT_BYTES)}).strict()},
 get_meeting_schema:{description:"Return JSON Schemas for analysis-schema@1.0.",schema:z.object({contractVersion:z.literal("1.0")}).strict()},
 validate_analysis:{description:"Validate analysis structure, meeting identity and evidence against supplied normalized content.",schema:z.object({input,analysis:z.unknown()}).strict()},
 render_report:{description:"Validate supplied analysis against its source and return escaped Markdown. When minutes is supplied the minutes-contract reading mode is used (default minutes, optional mode/appendix); otherwise the evidence report is returned. Does not write a file.",schema:z.object({input,analysis:z.unknown(),minutes:z.string().optional(),mode:z.enum(["minutes","actions","evidence"]).optional(),appendix:z.boolean().optional()}).strict()},
};
export const toolList=Object.entries(definitions).map(([name,tool])=>({name,description:tool.description,inputSchema:z.toJSONSchema(tool.schema),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}));
function boundedInput(value:unknown){
 const meeting=MeetingInputSchema.parse(value);
 // 与 CLI report 共用同一套已解析输入上限（段数 + segment 文本 UTF-8 总字节）。
 assertMeetingInputWithinLimits(meeting);
 return meeting;
}
const codes=new Set([
 "INPUT_EMPTY","INPUT_UNSUPPORTED","INPUT_SEGMENT_LIMIT","INPUT_SIZE_LIMIT","CHUNK_LINE_TOO_LONG","SEGMENT_LINE_COUNT_INVALID","ANALYSIS_MEETING_MISMATCH","ANALYSIS_DUPLICATE_ID","ANALYSIS_EVIDENCE_INVALID","WORK_LIMIT_EXCEEDED",
 "MINUTES_MISSING","MINUTES_SCHEMA_INVALID","MINUTES_CONTRACT_UNSUPPORTED","MINUTES_MEETING_MISMATCH","MINUTES_REF_UNKNOWN","MINUTES_KIND_MISMATCH","MINUTES_ACTION_COVERAGE","RENDER_MODE_INVALID",
]);
/** 把内部错误收敛成稳定的工具错误码；导出供接线测试固定未在入口暴露的渲染器错误码。 */
export function toolErrorCode(error:unknown):string{
 const candidate=error instanceof Error?error.message.split(":")[0]!:"";
 return codes.has(candidate)?candidate:"INPUT_INVALID";
}
/** 工具层稳定错误码全集（docs-consistency 测试以此为准核对 docs/MCP.md，防止文档漂移）。 */
export const toolErrorCodes:readonly string[]=[...codes];
function parseMinutesDocument(value:string):unknown{
 try{return JSON.parse(value);}catch{throw new Error("INPUT_INVALID: minutes must be a JSON-encoded minutes document");}
}
export function callTool(name:string,args:unknown):{content:{type:"text";text:string}[];isError?:boolean}{
 try{
  const requestBytes=Buffer.byteLength(JSON.stringify(args)??"","utf8");
  if(requestBytes>MAX_REQUEST_BYTES)throw new Error(`INPUT_SIZE_LIMIT: request is ${requestBytes} bytes, limit is ${MAX_REQUEST_BYTES}`);
  // handler 级 CPU 预算：所有工具共享同一截止时间，异常输入不能长期占住事件循环。
  const deadline=Date.now()+MAX_TOOL_WORK_MS;
  let result:unknown;
  switch(name){
   case "prepare_meeting":{
    const a=definitions.prepare_meeting.schema.parse(args);
    assertContentWithinLimit(a.content);
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
   case "validate_analysis":{
    const a=definitions.validate_analysis.schema.parse(args);
    result={valid:true,analysis:validateAnalysis(boundedInput(a.input),a.analysis,{deadline})};break;
   }
   case "render_report":{
    const a=definitions.render_report.schema.parse(args);
    const meeting=boundedInput(a.input);
    const analysis=validateAnalysis(meeting,a.analysis,{deadline});
    let document:MinutesDocument|undefined;
    if(a.minutes!==undefined){
     assertContentWithinLimit(a.minutes);
     document=validateMinutes(meeting,analysis,parseMinutesDocument(a.minutes));
    }
    const mode=resolveReadingMode(a.mode,document!==undefined);
    result={markdown:document===undefined?renderMarkdown(analysis):renderMinutesDocument(meeting,analysis,document,{mode,...(a.appendix===undefined?{}:{appendix:a.appendix})})};break;
   }
   default:return {isError:true,content:[{type:"text",text:"TOOL_UNKNOWN"}]};
  }
  if(Date.now()>deadline)throw new Error("WORK_LIMIT_EXCEEDED");
  return {content:[{type:"text",text:JSON.stringify(result)}]};
 }catch(error){
  // Zod 错误附带字段路径（不泄露值）：宿主模型能自助修正参数，而不是反复试错。
  const detail=describeZodError(error,"INPUT_INVALID");
  return {isError:true,content:[{type:"text",text:detail??toolErrorCode(error)}]};
 }
}
