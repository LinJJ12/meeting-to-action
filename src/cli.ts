import "dotenv/config";
import {validateAnalysis} from "./core/analysis.js";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { normalizeTranscript } from "./core/normalize.js";
import { analyzeMeeting } from "./core/analyze.js";
import { renderMarkdown } from "./render/markdown.js";
import { OpenAICompatibleProvider } from "./providers/openai-compatible.js";

function usage(): never {
  console.error([
    "Usage:",
    "  meeting-to-action inspect <transcript.txt|transcript.md> [--out normalized.json]",
    "  meeting-to-action analyze <transcript.txt|transcript.md> [--out report.md]",
    "  meeting-to-action report <normalized.json> --analysis <analysis.json> [--out report.md]",
    "",
    "Environment for analyze:",
    "  OPENAI_API_KEY (required)",
    "  OPENAI_MODEL (required)",
    "  OPENAI_BASE_URL (optional; defaults to https://api.openai.com/v1)",
    "  OPENAI_TIMEOUT_MS (optional; defaults to 60000)",
    "  OPENAI_VERBOSE_ERRORS (optional; set 1 to include a redacted provider response excerpt in errors)",
  ].join("\n"));
  process.exit(2);
}

const [command, input, ...args] = process.argv.slice(2);
if (!command || !input || !["inspect", "analyze", "report"].includes(command)) usage();

let outputPath: string | undefined;
let analysisPath: string | undefined;
const seen=new Set<string>();
for (let index=0;index<args.length;index+=2){
 const key=args[index]!,value=args[index+1];
 if(!value||value.startsWith("--")||seen.has(key))usage();
 seen.add(key);
 if(key==="--out")outputPath=value;
 else if(key==="--analysis"&&command==="report")analysisPath=value;
 else usage();
}
if(command==="report"&&!analysisPath)usage();
async function readJson(path:string):Promise<unknown>{
 const raw=await readFile(path,"utf8");
 try{return JSON.parse(raw);}catch{throw new Error("INPUT_JSON_INVALID");}
}

try {
  const absoluteInput = resolve(input);
  if(command==="report"){
    const analysis=validateAnalysis(await readJson(absoluteInput),await readJson(resolve(analysisPath!)));
    const report=renderMarkdown(analysis);
    if(outputPath){await writeFile(resolve(outputPath),report,{encoding:"utf8",flag:"wx"});console.log("Wrote "+resolve(outputPath));}
    else process.stdout.write(report);
  }else{
  const transcript = await readFile(absoluteInput, "utf8");
  const meeting = normalizeTranscript(transcript, basename(absoluteInput));

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
  console.error(error instanceof Error && error.name==="ZodError" ? "INPUT_SCHEMA_INVALID" : error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
