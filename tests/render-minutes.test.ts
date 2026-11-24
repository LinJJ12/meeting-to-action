import {it,expect} from "vitest";
import {MeetingInputSchema,MeetingAnalysisSchema,type MeetingAnalysis} from "../src/domain/schema.js";
import {MinutesDocumentSchema,type MinutesDocument} from "../src/domain/minutes.js";
import {MinutesContractError} from "../src/core/minutes.js";
import {renderMarkdown} from "../src/render/markdown.js";
import {renderMinutesDocument,renderTraceAppendix} from "../src/render/minutes.js";

type EvidenceExtra={speaker?:string;timestamp?:string;quote?:string};
const ev=(segmentId:string,lineStart:number,lineEnd:number,extra:EvidenceExtra={})=>({sourceId:"s1",segmentId,lineStart,lineEnd,...extra});

const inputFixture=()=>MeetingInputSchema.parse({
  schemaVersion:"1.0",
  meeting:{id:"meeting-star",title:"星河手账周会",date:"2026-11-24",participants:["林舟","苏禾","陈屿"]},
  sources:[{id:"s1",kind:"transcript",format:"txt",fileName:"transcript.txt"}],
  segments:[
    {id:"seg1",sourceId:"s1",text:"登录改造的回归已经跑完了。",lineStart:1,lineEnd:1,speaker:"林舟",timestamp:"10:00"},
    {id:"seg2",sourceId:"s1",text:"灰度名单我来整理，周五之前给到。",lineStart:2,lineEnd:3,speaker:"苏禾",timestamp:"10:02"},
    {id:"seg3",sourceId:"s1",text:"支付回调的监控还没补。",lineStart:4,lineEnd:4,speaker:"林舟",timestamp:"10:05"},
    {id:"seg4",sourceId:"s1",text:"发布窗口定在下周三。",lineStart:5,lineEnd:5,speaker:"陈屿",timestamp:"10:08"},
    {id:"seg5",sourceId:"s1",text:"灰度比例还要再确认。",lineStart:6,lineEnd:6,speaker:"苏禾",timestamp:"10:10"}
  ]
});

const analysisFixture=():MeetingAnalysis=>MeetingAnalysisSchema.parse({
  schemaVersion:"1.0",
  meetingId:"meeting-star",
  summary:["登录改造回归完成，计划下周三小范围灰度。"],
  topics:[{title:"登录改造",summary:"回归完成，准备灰度",evidence:[ev("seg1",1,1,{speaker:"林舟",timestamp:"10:00",quote:"登录改造的回归已经跑完了。"})]}],
  decisions:[{id:"d1",statement:"发布窗口定在下周三。",status:"confirmed",evidence:[ev("seg4",5,5,{speaker:"陈屿",timestamp:"10:08",quote:"发布窗口定在下周三。"})],confidence:"high"}],
  actionItems:[
    {id:"a1",title:"整理灰度名单",assignee:"苏禾",dueDate:"周五",status:"in_progress",evidence:[ev("seg2",2,3,{speaker:"苏禾",timestamp:"10:02",quote:"灰度名单我来整理，周五之前给到。"})],confidence:"high"},
    {id:"a2",title:"补充支付回调监控",status:"proposed",evidence:[ev("seg3",4,4,{speaker:"林舟",timestamp:"10:05",quote:"支付回调的监控还没补。"})],confidence:"medium"},
    {id:"a3",title:"确认灰度比例",assignee:"陈屿",status:"blocked",evidence:[ev("seg5",6,6,{speaker:"苏禾",timestamp:"10:10",quote:"灰度比例还要再确认。"})],confidence:"low"}
  ],
  risks:[{id:"r1",description:"支付回调失败率不可见",severity:"high",evidence:[ev("seg3",4,4,{speaker:"林舟",timestamp:"10:05",quote:"支付回调的监控还没补。"})]}],
  openQuestions:[{id:"q1",question:"灰度比例是 5% 还是 10%？",evidence:[ev("seg5",6,6,{speaker:"苏禾",timestamp:"10:10",quote:"灰度比例还要再确认。"})]}],
  conflicts:[{id:"cf1",description:"对灰度比例存在分歧",evidence:[ev("seg5",6,6,{speaker:"苏禾",timestamp:"10:10",quote:"灰度比例还要再确认。"})]}],
  generatedAt:"2026-11-24T08:00:00.000Z"
});

const minutesFixture=():MinutesDocument=>MinutesDocumentSchema.parse({
  schemaVersion:"1.0",
  contractVersion:"1.0",
  meetingId:"meeting-star",
  generatedAt:"2026-11-24T08:05:00.000Z",
  title:"星河手账 11 月第 4 周例会纪要",
  meta:{date:"2026-11-24",participants:["林舟","苏禾","陈屿"]},
  highlights:["登录改造回归完成，准备小范围灰度","支付回调监控待补充"],
  actionNote:"以下任务来自会议原文提取，负责人与期限以原文确认为准。",
  sections:[
    {id:"sec1",heading:"登录改造",claims:[
      {id:"c1",kind:"progress",text:"登录改造回归已完成，准备灰度",detail:"灰度比例尚未确认",refs:["a1","d1"]},
      {id:"c2",kind:"followup",text:"补充支付回调监控",refs:["a2"]}
    ]},
    {id:"sec2",heading:"发布安排",claims:[
      {id:"c3",kind:"decision",text:"发布窗口定在下周三",refs:["d1"]},
      {id:"c4",kind:"followup",text:"确认灰度比例",refs:["a3"]}
    ]},
    {id:"sec3",heading:"待确认",claims:[
      {id:"c5",kind:"open",text:"灰度比例与监控缺口待确认",detail:"需要先补监控再决定放量比例",refs:["q1","r1","cf1"]}
    ]}
  ]
});

type RenderOptions={mode?:"minutes"|"actions"|"evidence";appendix?:boolean};
const render=(options?:RenderOptions)=>renderMinutesDocument(inputFixture(),analysisFixture(),minutesFixture(),options);

it("renders the minutes title, meta line, highlights and topic sections",()=>{
  const md=render();
  expect(md.startsWith("# 星河手账 11 月第 4 周例会纪要\n\n日期：2026-11-24 ｜ 参会：林舟、苏禾、陈屿\n")).toBe(true);
  expect(md).toContain("## 会议要点\n- 登录改造回归完成，准备小范围灰度\n- 支付回调监控待补充");
  expect(md).toContain("## 按议题整理\n### 登录改造\n- **进展：**登录改造回归已完成，准备灰度");
  expect(md).toContain("### 发布安排");
  expect(md).toContain("### 待确认");
});

it("labels all four claim kinds in reading order",()=>{
  const body=render().split("## 集中待办")[0]!;
  const labels=["**进展：**","**后续：**","**已确认决定：**","**待确认：**"];
  const positions=labels.map(label=>body.indexOf(label));
  expect(positions.every(position=>position>=0)).toBe(true);
  expect([...positions].sort((left,right)=>left-right)).toEqual(positions);
});

it("renders claim details as indented explanatory lines",()=>{
  const md=render();
  expect(md).toContain("- **进展：**登录改造回归已完成，准备灰度\n  - 灰度比例尚未确认");
  expect(md).toContain("- **待确认：**灰度比例与监控缺口待确认\n  - 需要先补监控再决定放量比例");
});

it("omits empty highlight and open-question sections",()=>{
  const draft:any=structuredClone(minutesFixture());
  draft.highlights=[];
  draft.sections=[draft.sections[0],draft.sections[1]];
  const md=renderMinutesDocument(inputFixture(),analysisFixture(),draft);
  expect(md).not.toContain("## 会议要点");
  expect(md).not.toContain("## 关键未决事项");
  expect(md).toContain("## 按议题整理");
});

it("adds the meta line only when date or participants are present",()=>{
  const withoutMeta:any=structuredClone(minutesFixture());
  withoutMeta.meta={};
  const bare=renderMinutesDocument(inputFixture(),analysisFixture(),withoutMeta);
  expect(bare).not.toContain("日期：");
  expect(bare).not.toContain("参会：");
  expect(bare.split("\n\n")[1]!.startsWith("## 会议要点")).toBe(true);

  const dateOnly:any=structuredClone(minutesFixture());
  dateOnly.meta={date:"2026-12-01"};
  const dateText=renderMinutesDocument(inputFixture(),analysisFixture(),dateOnly);
  expect(dateText).toContain("日期：2026-12-01");
  expect(dateText).not.toContain("参会：");

  const peopleOnly:any=structuredClone(minutesFixture());
  peopleOnly.meta={participants:["甲","乙"]};
  const peopleText=renderMinutesDocument(inputFixture(),analysisFixture(),peopleOnly);
  expect(peopleText).toContain("参会：甲、乙");
  expect(peopleText).not.toContain("日期：");
});

it("builds the task table from analysis facts, not from minutes prose",()=>{
  const analysis=analysisFixture();
  const minutes:any=structuredClone(minutesFixture());
  minutes.sections[0].claims[0].text="登录改造回归已完成（纪要草稿）";
  analysis.actionItems[0]!.title="整理灰度名单（事实）";
  analysis.actionItems[0]!.assignee="苏禾（事实）";
  analysis.actionItems[0]!.dueDate="周五（事实）";
  analysis.actionItems[0]!.status="done";
  const md=renderMinutesDocument(inputFixture(),analysis,minutes);
  expect(md).toContain("| 整理灰度名单（事实） | 苏禾（事实） | 周五（事实） | 已完成 |");
  expect(md).toContain("登录改造回归已完成（纪要草稿）");
  expect(md.indexOf("以下任务来自会议原文提取")).toBeLessThan(md.indexOf("| 任务 | 负责人 | 期限 | 状态 |"));
});

it("explains missing owners and deadlines centrally instead of repeating TBD per cell",()=>{
  const base=render();
  expect(base).not.toContain("负责人未在原文确认");
  expect(base).not.toContain("期限未在原文确认");
  expect(base).toContain("| 补充支付回调监控 | — | — | 提议 |");

  const analysis=analysisFixture();
  const strip=(item:any)=>{const {assignee,dueDate,...rest}=item;return rest;};
  analysis.actionItems=analysis.actionItems.map(strip);
  const md=renderMinutesDocument(inputFixture(),analysis,minutesFixture());
  expect(md).toContain("负责人未在原文确认");
  expect(md).toContain("期限未在原文确认");
  expect(md.indexOf("负责人未在原文确认")).toBeLessThan(md.indexOf("| 任务 |"));
  expect(md.indexOf("期限未在原文确认")).toBeLessThan(md.indexOf("| 任务 |"));
});

it("renders every analysis status as its Chinese label",()=>{
  const statuses=[["proposed","提议"],["accepted","已接受"],["in_progress","进行中"],["done","已完成"],["blocked","受阻"],["unknown","未确认"]] as const;
  const items=statuses.map(([status],index)=>({id:"s"+(index+1),title:"任务"+(index+1),status,evidence:[ev("seg"+(index+1),index+1,index+1)],confidence:"high" as const}));
  const analysis=MeetingAnalysisSchema.parse({...analysisFixture(),actionItems:items});
  const minutes=MinutesDocumentSchema.parse({...minutesFixture(),sections:[{id:"sec1",heading:"任务",claims:items.map((item,index)=>({id:"c"+(index+1),kind:"followup",text:item.title,refs:[item.id]}))}]});
  const md=renderMinutesDocument(inputFixture(),analysis,minutes);
  for(const [,label] of statuses)expect(md).toContain("| "+label+" |");
});

it("keeps a shaped table and no central caveats when the analysis has no action items",()=>{
  const analysis=MeetingAnalysisSchema.parse({...analysisFixture(),actionItems:[]});
  const minutes=MinutesDocumentSchema.parse({...minutesFixture(),sections:[{id:"sec1",heading:"进展",claims:[{id:"c1",kind:"progress",text:"登录改造回归已完成",refs:["d1"]}]}]});
  const md=renderMinutesDocument(inputFixture(),analysis,minutes);
  expect(md).toContain("| — | — | — | — |");
  expect(md).not.toContain("负责人未在原文确认");
  expect(md).not.toContain("期限未在原文确认");
});

it("maps every action item to the claims that reference it in the appendix",()=>{
  const md=render();
  expect(md).toContain("## 溯源附录");
  expect(md).toContain("### 任务映射");
  const rows=[["a1","整理灰度名单","c1"],["a2","补充支付回调监控","c2"],["a3","确认灰度比例","c4"]] as const;
  for(const [id,title,claims] of rows)expect(md).toContain("| "+id+" | "+title+" | "+claims+" |");
});

it("resolves every claim reference to its analysis evidence in the appendix",()=>{
  const md=render();
  expect(md).toContain("### 条目证据");
  expect(md).toContain("- **c1**（进展）：登录改造回归已完成，准备灰度");
  expect(md).toContain("a1（行动项）：整理灰度名单");
  expect(md).toContain("s1 / seg2 / 行 2–3 / 10:02 / “灰度名单我来整理，周五之前给到。”");
  expect(md).toContain("d1（决定）：发布窗口定在下周三。");
  expect(md).toContain("s1 / seg4 / 行 5 / 10:08 / “发布窗口定在下周三。”");
  expect(md).toContain("- **c5**（待确认）：灰度比例与监控缺口待确认");
  expect(md).toContain("q1（待确认问题）：灰度比例是 5% 还是 10%？");
  expect(md).toContain("r1（风险）：支付回调失败率不可见");
  expect(md).toContain("cf1（分歧）：对灰度比例存在分歧");
  expect(md).not.toContain("不可达");
});

it("truncates appendix quotes to 200 characters with an ellipsis",()=>{
  const longQuote="引".repeat(250);
  const analysis=analysisFixture();
  analysis.decisions[0]!.evidence[0]!.quote=longQuote;
  const md=renderMinutesDocument(inputFixture(),analysis,minutesFixture());
  expect(md).toContain("“"+"引".repeat(200)+"…”");
  expect(md).not.toContain("引".repeat(201));
});

it("marks unreachable references defensively in the appendix",()=>{
  const minutes:any=structuredClone(minutesFixture());
  minutes.sections.push({id:"secx",heading:"附加",claims:[{id:"cx",kind:"open",text:"未知引用",refs:["missingFact"]}]});
  const appendix=renderTraceAppendix(analysisFixture(),minutes);
  expect(appendix).toContain("missingFact");
  expect(appendix).toContain("未解析到分析条目");
  expect(appendix).toContain("不可达");

  const analysis=analysisFixture();
  const extended=MeetingAnalysisSchema.parse({...analysis,actionItems:[...analysis.actionItems,{id:"a9",title:"待补任务",status:"proposed",evidence:[ev("seg1",1,1)],confidence:"low"}]});
  const mapped=renderTraceAppendix(extended,minutesFixture());
  expect(mapped).toContain("| a9 | 待补任务 | —（未映射） |");
});

it("ends the minutes with the appendix disclaimer and can omit the appendix",()=>{
  const md=render();
  expect(md.trimEnd().endsWith("标题与正文为编辑性整理，非事实断言；事实与证据以上述条目为准。")).toBe(true);
  const withoutAppendix=render({appendix:false});
  expect(withoutAppendix).not.toContain("## 溯源附录");
  expect(withoutAppendix).not.toContain("标题与正文为编辑性整理");
  expect(withoutAppendix).toContain("## 集中待办");
});

it("keeps machine ids, confidence and raw citations out of the minutes body",()=>{
  const body=render().split("## 溯源附录")[0]!;
  for(const marker of ["a1","a2","a3","c1","seg2","confidence","10:02"])expect(body).not.toContain(marker);
  expect(body).toContain("## 集中待办");
});

it("escapes untrusted text so titles, headings and tables cannot be injected",()=>{
  const analysis:any=analysisFixture();
  const minutes:any=structuredClone(minutesFixture());
  minutes.title="<script>alert(1)</script> | 纪要\n第二行";
  minutes.highlights=["[x](y)","`code` & <b>bold</b>"];
  minutes.sections[0].heading="登录|附录\n伪造标题";
  minutes.sections[0].claims[0].text="<img src=x onerror=alert(1)> 与 [链接](https://x)";
  minutes.sections[0].claims[0].detail="第一行\n第二行<em>";
  analysis.actionItems[0].title="整理|名单<script>";
  analysis.actionItems[0].assignee="甲|乙";
  analysis.actionItems[0].dueDate="周五\n或下周";
  analysis.actionItems[0].evidence[0].quote="<script>alert(1)</script>\n下一行";
  const md=renderMinutesDocument(inputFixture(),analysis,minutes);
  expect(md.split("\n")[0]).toBe("# &lt;script&gt;alert(1)&lt;/script&gt; \\| 纪要 第二行");
  expect(md).toContain("- \\[x\\](y)");
  expect(md).toContain("\\`code\\` &amp; &lt;b&gt;bold&lt;/b&gt;");
  expect(md).toContain("### 登录\\|附录 伪造标题");
  expect(md).toContain("&lt;img src=x onerror=alert(1)&gt;");
  expect(md).toContain("  - 第一行 第二行&lt;em&gt;");
  expect(md).toContain("| 整理\\|名单&lt;script&gt; | 甲\\|乙 | 周五 或下周 | 进行中 |");
  expect(md).not.toContain("<script");
  expect(md).not.toContain("<img");
  expect(md).not.toContain("[x](");
  const tableLines=md.split("\n").filter(line=>line.startsWith("|"));
  expect(tableLines).toHaveLength(10);
  expect(tableLines.every(line=>line.endsWith("|"))).toBe(true);
  expect(tableLines.map(line=>(line.match(/(?<!\\)\|/g)??[]).length).every(count=>count===4||count===5)).toBe(true);
});

it("renders an actions checklist without topic sections and with one locator per task",()=>{
  const md=render({mode:"actions"});
  expect(md.startsWith("# 执行清单\n\n")).toBe(true);
  expect(md).not.toContain("## 按议题整理");
  expect(md).not.toContain("### 登录改造");
  expect(md).not.toContain("## 会议要点");
  expect(md).toContain("| 任务 | 负责人 | 期限 | 状态 |");
  expect(md).toContain("| 整理灰度名单 | 苏禾 | 周五 | 进行中 |");
  expect(md).toContain("| 补充支付回调监控 | — | — | 提议 |");
  const locators=md.split("\n").filter(line=>line.startsWith("- ")&&line.includes("seg"));
  expect(locators).toHaveLength(3);
  expect(locators[0]).toContain("整理灰度名单");
  expect(locators[0]).toContain("s1 / seg2 / 行 2–3 / 10:02 / “灰度名单我来整理，周五之前给到。”");
});

it("delegates evidence mode byte for byte to renderMarkdown",()=>{
  const expected=renderMarkdown(analysisFixture());
  expect(render({mode:"evidence"})).toBe(expected);
  const broken:any=structuredClone(minutesFixture());
  broken.sections[1].claims=broken.sections[1].claims.filter((claim:any)=>claim.id!=="c4");
  expect(renderMinutesDocument(inputFixture(),analysisFixture(),broken,{mode:"evidence"})).toBe(expected);
});

it("rejects unknown reading modes with RENDER_MODE_INVALID",()=>{
  for(const mode of ["summary","","Minutes"]){
    let error:unknown;
    try{renderMinutesDocument(inputFixture(),analysisFixture(),minutesFixture(),{mode:mode as any});}catch(caught){error=caught;}
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(MinutesContractError);
    expect((error as Error).message).toContain("RENDER_MODE_INVALID: "+mode);
  }
});

it("propagates minutes validation failures before rendering",()=>{
  const broken:any=structuredClone(minutesFixture());
  broken.sections[1].claims=broken.sections[1].claims.filter((claim:any)=>claim.id!=="c4");
  for(const mode of ["minutes","actions"] as const){
    let error:unknown;
    try{renderMinutesDocument(inputFixture(),analysisFixture(),broken,{mode});}catch(caught){error=caught;}
    expect(error).toBeInstanceOf(MinutesContractError);
    expect((error as MinutesContractError).code).toBe("MINUTES_ACTION_COVERAGE");
    expect((error as MinutesContractError).message).toContain("a3");
  }
});

it("renders deterministically",()=>{
  for(const mode of ["minutes","actions","evidence"] as const)expect(render({mode})).toBe(render({mode}));
});

it("leaves ordinary punctuation unescaped while still neutralizing markdown syntax",()=>{
  const draft:any=structuredClone(minutesFixture());
  draft.title="v0.2 评审（2026-11-24）";
  draft.meta={date:"2026-11-24"};
  draft.highlights=["**加粗**与 [链接](https://example.com)"];
  const md=renderMinutesDocument(inputFixture(),analysisFixture(),draft);
  expect(md).toContain("# v0.2 评审（2026-11-24）");
  expect(md).toContain("日期：2026-11-24");
  expect(md).not.toContain("v0\\.2");
  expect(md).toContain("\\*\\*加粗\\*\\*");
  expect(md).toContain("\\[链接\\](https://example.com)");
});

it("keeps plain open questions out of the key-unresolved summary",()=>{
  const draft:any=structuredClone(minutesFixture());
  draft.sections.push({id:"sec4",heading:"附注",claims:[
    {id:"c6",kind:"open",text:"灰度比例数值待定",refs:["q1"]}
  ]});
  const md=renderMinutesDocument(inputFixture(),analysisFixture(),draft);
  const unresolved=(md.split("## 关键未决事项")[1]??"").split("\n## ")[0]??"";
  expect(unresolved).toContain("灰度比例与监控缺口待确认");
  expect(unresolved).not.toContain("灰度比例数值待定");
  expect(md).toContain("- **待确认：**灰度比例数值待定");
});