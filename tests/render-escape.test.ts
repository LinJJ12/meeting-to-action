import {it,expect} from "vitest";
import {renderMarkdown} from "../src/render/markdown.js";
import {escapeMarkdownInline,escapeMarkdownText} from "../src/render/escape.js";
import {MeetingAnalysisSchema,MeetingInputSchema} from "../src/domain/schema.js";
import {validateMinutes} from "../src/core/minutes.js";
import {renderMinutesDocument} from "../src/render/minutes.js";

/** 产出包含典型终端转义注入的 analysis fixture（#23：CWE-150）。 */
function fixture(){
 return MeetingAnalysisSchema.parse({
  schemaVersion:"1.0",meetingId:"meeting",summary:["\u001B[2J\u001B[31mRED summary\u001B[0m"],
  topics:[{title:"Plan",summary:"Discussed",evidence:[{sourceId:"src",segmentId:"seg-1",lineStart:1,lineEnd:1,quote:"\u001B]8;;http://evil.example\u001B\\click \u001B[31mme\u001B[0m"}]}],
  decisions:[],actionItems:[],risks:[],openQuestions:[],conflicts:[],generatedAt:"2026-01-01T00:00:00Z",
 });
}

function assertNoControlBytes(md:string):void{
 for(const ch of md){
  const code=ch.charCodeAt(0);
  expect(code===0x1b||code===0x9b||(code<0x20&&code!==0x09&&code!==0x0a)||(code>=0x7f&&code<=0x9f)).toBe(false);
 }
}

it("报告剥离 ANSI/OSC 序列与裸控制字符，保留可读文本",()=>{
 const md=renderMarkdown(fixture());
 assertNoControlBytes(md);
 expect(md).not.toContain("[2J");
 expect(md).not.toContain("http://evil.example");
 expect(md).not.toContain("[31m");
 expect(md).toContain("RED summary");
 expect(md).toContain("click me");
});

it("minutes 渲染同样剥离（标题/正文/表格三条通道）",()=>{
 const input=MeetingInputSchema.parse({schemaVersion:"1.0",meeting:{id:"meeting",title:"t"},sources:[{id:"src",kind:"transcript",format:"txt",fileName:"x.txt",checksum:"c"}],segments:[{id:"seg-1",sourceId:"src",text:"hello",lineStart:1,lineEnd:1}]});
 const analysis=MeetingAnalysisSchema.parse({...fixture(),meetingId:"meeting"});
 const minutes=JSON.parse(JSON.stringify({
  schemaVersion:"1.0",contractVersion:"1.0",meetingId:"meeting",generatedAt:"2026-01-01T00:00:00Z",
  title:"\u009B31mInjected \u0007heading",
  meta:{},highlights:["\u001B]0;title\u0007kept"],
  sections:[{id:"s1",heading:"Topic",claims:[{id:"c1",kind:"followup",text:"\u001B[1mworking\u001B[0m",refs:["a1"]}]}],
  actionNote:"note",
 }));
 const analysisWithActions=MeetingAnalysisSchema.parse({...analysis,actionItems:[{id:"a1",title:"task",status:"proposed",confidence:"medium",evidence:[{sourceId:"src",segmentId:"seg-1",lineStart:1,lineEnd:1,quote:"hello"}]}]});
 validateMinutes(input,analysisWithActions,minutes);
 const md=renderMinutesDocument(input,analysisWithActions,minutes,{mode:"minutes"});
 assertNoControlBytes(md);
 expect(md).not.toContain("\u001B");
 expect(md).toContain("Injected heading");
 expect(md).toContain("kept");
 expect(md).toContain("working");
});

it("转义函数本身对孤立/未闭合 ESC 也不放行",()=>{
 // 未闭合 CSI：ESCa 和参数一起被序列匹配吃掉，不留 "[3" 残尾
 expect(escapeMarkdownInline("a\u001B[3b")).toBe("ab");
 expect(escapeMarkdownInline("a\u009B2Jb")).toBe("ab");
 // 未闭合 OSC（缺 BEL/ST 终止符）：与 strip-ansi 语义一致——ESC 字节必须消失，
 // 可打印残尾允许保留为纯文本（不再构成链接/控制序列）
 const unterminated=escapeMarkdownText("a\u001B]8;;http://xb");
 expect(unterminated).not.toContain("\u001B");
 expect(unterminated).not.toContain("\u009B");
 // 保留制表符与普通文本
 expect(escapeMarkdownInline("a\tb")).toBe("a\tb");
 expect(escapeMarkdownInline("2026-11-24 v0.2")).toBe("2026-11-24 v0.2");
});
