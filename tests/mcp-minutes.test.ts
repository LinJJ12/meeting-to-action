import {describe,expect,it} from "vitest";
import {callTool,MAX_CONTENT_BYTES,toolErrorCode,toolList} from "../src/mcp/tools.js";
import {validateAnalysis} from "../src/core/analysis.js";
import {renderMarkdown} from "../src/render/markdown.js";
import {renderMinutesDocument} from "../src/render/minutes.js";
import {analysisFixture,inputFixture,minutesFixture,mutatedMinutes} from "./support/minutes-fixtures.js";

const input=inputFixture();
const analysis=analysisFixture();
const minutes=minutesFixture();
const evidenceMarkdown=renderMarkdown(validateAnalysis(input,analysis));
const minutesText=()=>JSON.stringify(minutes);
const renderReport=(extra:Record<string,unknown>={})=>callTool("render_report",{input,analysis,...extra});
const parseOk=(result:ReturnType<typeof callTool>)=>{expect(result.isError).not.toBe(true);return JSON.parse(result.content[0]!.text);};
const errorCode=(result:ReturnType<typeof callTool>)=>{expect(result.isError).toBe(true);return result.content[0]!.text;};

describe("render_report minutes wiring",()=>{
 it("keeps the evidence-default output byte-identical without minutes",()=>{
  expect(parseOk(renderReport()).markdown).toBe(evidenceMarkdown);
  expect(parseOk(renderReport({mode:"evidence"})).markdown).toBe(evidenceMarkdown);
 });

 it("defaults to minutes mode when a minutes document is supplied",()=>{
  expect(parseOk(renderReport({minutes:minutesText()})).markdown).toBe(renderMinutesDocument(input,analysis,minutes));
 });

 it("renders the actions checklist with mode=actions",()=>{
  const markdown=parseOk(renderReport({minutes:minutesText(),mode:"actions"})).markdown;
  expect(markdown).toBe(renderMinutesDocument(input,analysis,minutes,{mode:"actions"}));
  expect(markdown.startsWith("# 执行清单")).toBe(true);
 });

 it("supports mode=evidence with minutes and still validates the minutes document",()=>{
  expect(parseOk(renderReport({minutes:minutesText(),mode:"evidence"})).markdown).toBe(evidenceMarkdown);
  const badRefs=mutatedMinutes(draft=>{draft.sections[0].claims[0].refs=["not-a-fact"];});
  const result=renderReport({minutes:JSON.stringify(badRefs),mode:"evidence"});
  expect(errorCode(result)).toBe("MINUTES_REF_UNKNOWN");
 });

 it("passes appendix:false through to the minutes renderer",()=>{
  const markdown=parseOk(renderReport({minutes:minutesText(),appendix:false})).markdown;
  expect(markdown).toBe(renderMinutesDocument(input,analysis,minutes,{appendix:false}));
  expect(markdown).not.toContain("## 溯源附录");
 });

 it("requires minutes for minutes/actions modes",()=>{
  for(const mode of ["minutes","actions"]){
   expect(errorCode(renderReport({mode}))).toBe("MINUTES_MISSING");
  }
 });

 it("rejects malformed arguments at the schema boundary",()=>{
  expect(errorCode(renderReport({minutes:{...minutes}}))).toBe("INPUT_INVALID");
  expect(errorCode(renderReport({minutes:minutesText(),appendix:"no"}))).toBe("INPUT_INVALID");
  expect(errorCode(renderReport({minutes:minutesText(),extra:true}))).toBe("INPUT_INVALID");
  expect(errorCode(renderReport({minutes:minutesText(),mode:"summary"}))).toBe("INPUT_INVALID");
 });

 it("maps malformed minutes JSON to INPUT_INVALID without echoing content",()=>{
  const result=renderReport({minutes:'{"confidential text'});
  expect(errorCode(result)).toBe("INPUT_INVALID");
  expect(JSON.stringify(result)).not.toContain("confidential");
 });

 it("enforces the content byte limit on the minutes string",()=>{
  expect(errorCode(renderReport({minutes:" ".repeat(MAX_CONTENT_BYTES+1)}))).toBe("INPUT_SIZE_LIMIT");
 });

 it("maps minutes contract failures to their machine codes",()=>{
  const cases:[unknown,string][]=[
   [mutatedMinutes(draft=>{draft.sections[0].claims[0].refs=["not-a-fact"];}),"MINUTES_REF_UNKNOWN"],
   [mutatedMinutes(draft=>{draft.sections[1].claims[0].kind="open";}),"MINUTES_KIND_MISMATCH"],
   [mutatedMinutes(draft=>{draft.meetingId="other-meeting";}),"MINUTES_MEETING_MISMATCH"],
   [mutatedMinutes(draft=>{draft.contractVersion="2.0";}),"MINUTES_CONTRACT_UNSUPPORTED"],
   [mutatedMinutes(draft=>{delete draft.title;}),"MINUTES_SCHEMA_INVALID"],
   [mutatedMinutes(draft=>{draft.sections[0].claims=draft.sections[0].claims.filter((claim:any)=>claim.id!=="c2");}),"MINUTES_ACTION_COVERAGE"]
  ];
  for(const [draft,code] of cases)expect(errorCode(renderReport({minutes:JSON.stringify(draft)})),code).toBe(code);
 });

 it("keeps validateAnalysis ahead of minutes rendering",()=>{
  const fabricated:any=structuredClone(analysis);
  fabricated.decisions[0].evidence[0].quote="PRIVATE fabricated quote";
  const result=callTool("render_report",{input,analysis:fabricated,minutes:minutesText()});
  expect(errorCode(result)).toBe("ANALYSIS_EVIDENCE_INVALID");
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
 });

 it("advertises the new parameters in the tool schema",()=>{
  const tool=toolList.find(entry=>entry.name==="render_report")!;
  const properties:any=(tool.inputSchema as any).properties;
  expect(Object.keys(properties).sort()).toEqual(["analysis","appendix","input","minutes","mode"]);
  expect(properties.mode.enum).toEqual(["minutes","actions","evidence"]);
  expect(properties.appendix.type).toBe("boolean");
  expect(properties.minutes.type).toBe("string");
 });
});

describe("tool error code mapping",()=>{
 it("maps renderer-originated mode errors to RENDER_MODE_INVALID",()=>{
  expect(toolErrorCode(new Error("RENDER_MODE_INVALID: summary"))).toBe("RENDER_MODE_INVALID");
 });
 it("maps published contract codes and falls back for unknown errors",()=>{
  expect(toolErrorCode(new Error("MINUTES_KIND_MISMATCH: c3 -> a1"))).toBe("MINUTES_KIND_MISMATCH");
  expect(toolErrorCode(new Error("SOMETHING_ELSE: detail"))).toBe("INPUT_INVALID");
 });
});