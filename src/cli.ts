import "dotenv/config";
import {validateAnalysis} from "./core/analysis.js";
import {validateMinutes} from "./core/minutes.js";
import {MeetingInputSchema} from "./domain/schema.js";
import type {MinutesDocument} from "./domain/minutes.js";
import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { normalizeTranscript } from "./core/normalize.js";
import { analyzeMeeting } from "./core/analyze.js";
import { renderMarkdown } from "./render/markdown.js";
import { isReadingMode, renderMinutesDocument, resolveReadingMode, type ReadingMode } from "./render/minutes.js";
import { OpenAICompatibleProvider } from "./providers/openai-compatible.js";
import { ProviderError } from "./providers/types.js";
import { MAX_ANALYSIS_BYTES, MAX_CONTENT_BYTES, MAX_SEGMENTS, assertMeetingInputWithinLimits } from "./core/limits.js";

const USAGE=[
  "Usage:",
  "  meeting-to-action inspect <transcript.txt|transcript.md> [--out normalized.json]",
  "  meeting-to-action analyze <transcript.txt|transcript.md> [--out report.md]",
  "  meeting-to-action report <normalized.json> --analysis <analysis.json> [--minutes <minutes.json>] [--mode minutes|actions|evidence] [--no-appendix] [--out report.md]",
  "",
  "Report modes:",
  "  with --minutes, the default mode is minutes; without it, the evidence report is rendered.",
  "  --no-appendix omits the trace appendix from minutes output (the appendix is on by default).",
  "",
  "Environment for analyze:",
  "  OPENAI_API_KEY (required)",
  "  OPENAI_MODEL (required)",
  "  OPENAI_BASE_URL (optional; defaults to https://api.openai.com/v1)",
  "  OPENAI_TIMEOUT_MS (optional; defaults to 60000)",
  "  OPENAI_VERBOSE_ERRORS (optional; set 1 to include a best-effort redacted provider error excerpt; may still contain sensitive content)",
].join("\n");

function usage(): never {
  console.error(USAGE);
  process.exit(2);
}

/** 非法 --mode 取值是参数错误：打印用法并 exit 1（其他结构性用法错误保持 exit 2）。 */
function invalidMode(value: string): never {
  console.error("Unsupported --mode value: " + value + "\n\n" + USAGE);
  process.exit(1);
}

const [command, input, ...args] = process.argv.slice(2);
if (!command || !input || !["inspect", "analyze", "report"].includes(command)) usage();

let outputPath: string | undefined;
let analysisPath: string | undefined;
let minutesPath: string | undefined;
let modeOption: ReadingMode | undefined;
let appendix = true;
const seen=new Set<string>();
for (let index=0;index<args.length;index++){
 const key=args[index]!;
 if(seen.has(key))usage();
 seen.add(key);
 if(key==="--no-appendix"){
  if(command!=="report")usage();
  appendix=false;
  continue;
 }
 const value=args[index+1];
 if(!value||value.startsWith("--"))usage();
 index++;
 if(key==="--out")outputPath=value;
 else if(command==="report"&&key==="--analysis")analysisPath=value;
 else if(command==="report"&&key==="--minutes")minutesPath=value;
 else if(command==="report"&&key==="--mode"){
  if(!isReadingMode(value))invalidMode(value);
  modeOption=value;
 }
 else usage();
}
if(command==="report"&&!analysisPath)usage();
/**
 * report 的 input/analysis 都来自本地文件：先按 stat 大小拒绝超大文件，绝不整读。
 * stat 与读取之间文件可能变化，按实际读到的 Buffer 字节数复核一次。
 */
async function readJsonWithinLimit(path:string,maxBytes:number,label:string):Promise<unknown>{
 const assertSize=(bytes:number):void=>{
  if(bytes>maxBytes)throw new Error(`INPUT_SIZE_LIMIT: ${label} ${path} is ${bytes} bytes, limit is ${maxBytes}`);
 };
 assertSize((await stat(path)).size);
 const raw=await readFile(path);
 assertSize(raw.byteLength);
 try{return JSON.parse(raw.toString("utf8").replace(/^\uFEFF/,""));}catch{throw new Error("INPUT_JSON_INVALID");}
}
/** `--minutes` 是可选编辑稿：读取或 JSON 解析失败统一收敛，且不回显宿主路径。 */
async function readMinutesJson(path:string):Promise<unknown>{
 try{return await readJsonWithinLimit(path,MAX_ANALYSIS_BYTES,"minutes");}
 catch(error){
  // 大小限制保留原错误码；其余（读取失败/JSON 解析失败）统一收敛为 INPUT_JSON_INVALID。
  if(error instanceof Error&&error.message.startsWith("INPUT_SIZE_LIMIT"))throw error;
  throw new Error("INPUT_JSON_INVALID");
 }
}
function assertTranscriptSize(bytes:number,path:string):void{
 if(bytes>MAX_CONTENT_BYTES)throw new Error(`INPUT_SIZE_LIMIT: transcript ${path} is ${bytes} bytes, limit is ${MAX_CONTENT_BYTES}`);
}
/** analyze 会把整份逐字稿发给模型：先按 stat 大小拒绝，超大文件永远不读进内存。inspect 属于本地查看工具，保持无上限。 */
async function readTranscriptForAnalyze(path:string):Promise<string>{
 assertTranscriptSize((await stat(path)).size,path);
 const raw=await readFile(path);
 // stat 与读取之间文件可能变化，按实际读到的 Buffer 字节数复核一次。
 assertTranscriptSize(raw.byteLength,path);
 // Windows 记事本等工具会写 UTF-8 BOM：剥掉，避免首行说话人被识别错。
 return raw.toString("utf8").replace(/^\uFEFF/,"");
}

try {
  const absoluteInput = resolve(input);
  if(command==="report"){
    const mode=resolveReadingMode(modeOption,minutesPath!==undefined);
    const meeting=MeetingInputSchema.parse(await readJsonWithinLimit(absoluteInput,MAX_CONTENT_BYTES,"meeting input"));
    // report 不调用模型，但仍要让病态输入（段数/总文本）在渲染与证据校验前被明确拒绝。
    assertMeetingInputWithinLimits(meeting);
    const analysis=validateAnalysis(meeting,await readJsonWithinLimit(resolve(analysisPath!),MAX_ANALYSIS_BYTES,"analysis"));
    let minutes:MinutesDocument|undefined;
    if(minutesPath!==undefined)minutes=validateMinutes(meeting,analysis,await readMinutesJson(resolve(minutesPath)));
    const report=minutes===undefined?renderMarkdown(analysis):renderMinutesDocument(meeting,analysis,minutes,{mode,appendix});
    if(outputPath){await writeFile(resolve(outputPath),report,{encoding:"utf8",flag:"wx"});console.log("Wrote "+resolve(outputPath));}
    else process.stdout.write(report);
  }else{
  const transcript = (command === "analyze" ? await readTranscriptForAnalyze(absoluteInput) : await readFile(absoluteInput, "utf8")).replace(/^\uFEFF/,"");
  const meeting = normalizeTranscript(
    transcript,
    basename(absoluteInput),
    command === "analyze" ? { maxSegments: MAX_SEGMENTS } : {},
  );

  let output: string;
  if (command === "inspect") {
    output = JSON.stringify(meeting, null, 2) + "\n";
  } else {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL;
    if (!apiKey || !model) {
      throw new Error("CONFIG_MISSING: set OPENAI_API_KEY and OPENAI_MODEL before running analyze");
    }
    const timeout = Number(process.env.OPENAI_TIMEOUT_MS ?? "60000");
    if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 300000) {
      throw new Error("CONFIG_INVALID: OPENAI_TIMEOUT_MS must be an integer between 1000 and 300000");
    }
    const provider = new OpenAICompatibleProvider({
      apiKey,
      model,
      ...(process.env.OPENAI_BASE_URL ? { baseUrl: process.env.OPENAI_BASE_URL } : {}),
      timeoutMs: timeout,
      // 默认不把上游响应体带进错误：错误响应可能回显会议逐字稿。
      ...(process.env.OPENAI_VERBOSE_ERRORS === "1" ? { verboseErrors: true } : {}),
    });
    const analysis = await analyzeMeeting(meeting, provider);
    output = renderMarkdown(analysis);
  }

  if (outputPath) {
    await writeFile(resolve(outputPath), output, { encoding: "utf8", flag: "wx" });
    console.log("Wrote " + resolve(outputPath));
  } else process.stdout.write(output);
  }
} catch (error) {
  // ProviderError 的 code 是稳定机器可读标识：打印出来，脚本排障时不必解析英文消息。
  if (error instanceof ProviderError) {
    console.error(error.code ? `${error.code}: ${error.message}` : error.message);
  } else {
    console.error(error instanceof Error && error.name==="ZodError" ? "INPUT_SCHEMA_INVALID" : error instanceof Error ? error.message : String(error));
  }
  process.exitCode = 1;
}
