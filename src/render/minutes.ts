import type {EvidenceRef,MeetingAnalysis,MeetingInput} from "../domain/schema.js";
import type {MinutesClaim,MinutesDocument,MinutesMeta} from "../domain/minutes.js";
import {validateMinutes} from "../core/minutes.js";
import {escapeMarkdownText as text} from "./escape.js";
import {renderMarkdown} from "./markdown.js";

export type ReadingMode="minutes"|"actions"|"evidence";
export interface RenderMinutesOptions{mode?:ReadingMode;appendix?:boolean;}

type ActionItem=MeetingAnalysis["actionItems"][number];
type ActionStatus=ActionItem["status"];
type FactKind="decision"|"action"|"risk"|"openQuestion"|"conflict";
interface AnalysisFact{kind:FactKind;summary:string;evidence:EvidenceRef[];}

const READING_MODES:readonly string[]=["minutes","actions","evidence"];
const CLAIM_KIND_LABELS:Record<MinutesClaim["kind"],string>={progress:"进展",decision:"已确认决定",followup:"后续",open:"待确认"};
const ACTION_STATUS_LABELS:Record<ActionStatus,string>={proposed:"提议",accepted:"已接受",in_progress:"进行中",done:"已完成",blocked:"受阻",unknown:"未确认"};
const FACT_KIND_LABELS:Record<FactKind,string>={decision:"决定",action:"行动项",risk:"风险",openQuestion:"待确认问题",conflict:"分歧"};
const APPENDIX_QUOTE_LIMIT=200;
const ACTION_LOCATOR_QUOTE_LIMIT=80;
const DISCLAIMER="标题与正文为编辑性整理，非事实断言；事实与证据以上述条目为准。";

/**
 * Render a minutes document for one reading mode. `minutes` and `actions` modes
 * validate the contract first (failures surface as MinutesContractError);
 * `evidence` mode is exactly the existing evidence report.
 */
export function renderMinutesDocument(input:MeetingInput,analysis:MeetingAnalysis,minutes:MinutesDocument,options:RenderMinutesOptions={}):string {
 const mode:string=options.mode??"minutes";
 if(!READING_MODES.includes(mode))throw new Error("RENDER_MODE_INVALID: "+mode);
 if(mode==="evidence")return renderMarkdown(analysis);
 const document=validateMinutes(input,analysis,minutes);
 return mode==="actions"?renderActionChecklist(analysis,document):renderMinutesText(analysis,document,options.appendix!==false);
}

function renderMinutesText(analysis:MeetingAnalysis,document:MinutesDocument,appendix:boolean):string {
 const blocks:string[]=["# "+text(document.title)];
 const metaLine=renderMetaLine(document.meta);
 if(metaLine!==undefined)blocks.push(metaLine);
 if(document.highlights.length)blocks.push(renderHighlights(document.highlights));
 blocks.push(renderSections(document));
 blocks.push(renderTaskSection(analysis,document.actionNote));
 const open=renderOpenClaims(document);
 if(open!==undefined)blocks.push(open);
 if(appendix)blocks.push(renderTraceAppendix(analysis,document));
 return blocks.join("\n\n")+"\n";
}

function renderMetaLine(meta:MinutesMeta):string|undefined {
 const parts:string[]=[];
 if(meta.date!==undefined)parts.push("日期："+text(meta.date));
 if(meta.participants!==undefined&&meta.participants.length)parts.push("参会："+meta.participants.map(participant=>text(participant)).join("、"));
 return parts.length?parts.join(" ｜ "):undefined;
}

function renderHighlights(highlights:string[]):string {
 return "## 会议要点\n"+highlights.map(highlight=>"- "+text(highlight)).join("\n");
}

function renderSections(document:MinutesDocument):string {
 const lines:string[]=["## 按议题整理"];
 for(const section of document.sections) {
  lines.push("### "+text(section.heading));
  for(const claim of section.claims) {
   lines.push("- **"+CLAIM_KIND_LABELS[claim.kind]+"：**"+text(claim.text));
   if(claim.detail!==undefined)lines.push("  - "+text(claim.detail));
  }
 }
 return lines.join("\n");
}

function renderOpenClaims(document:MinutesDocument):string|undefined {
 const claims=document.sections.flatMap(section=>section.claims).filter(claim=>claim.kind==="open");
 if(!claims.length)return undefined;
 const lines:string[]=["## 关键未决事项"];
 for(const claim of claims) {
  lines.push("- "+text(claim.text));
  if(claim.detail!==undefined)lines.push("  - "+text(claim.detail));
 }
 return lines.join("\n");
}

function renderTaskSection(analysis:MeetingAnalysis,actionNote?:string):string {
 const lines:string[]=["## 集中待办"];
 const intro:string[]=[];
 if(actionNote!==undefined)intro.push(text(actionNote));
 intro.push(...taskCaveats(analysis));
 if(intro.length)lines.push(...intro);
 lines.push("",...renderTaskTable(analysis));
 return lines.join("\n");
}

function renderActionChecklist(analysis:MeetingAnalysis,document:MinutesDocument):string {
 const blocks:string[]=["# 执行清单"];
 const intro:string[]=[];
 if(document.actionNote!==undefined)intro.push(text(document.actionNote));
 intro.push(...taskCaveats(analysis));
 if(intro.length)blocks.push(intro.join("\n"));
 blocks.push(renderTaskTable(analysis).join("\n"));
 const locators=analysis.actionItems.map(item=>"- "+text(item.title)+"："+formatEvidenceLocator(item.evidence[0],ACTION_LOCATOR_QUOTE_LIMIT,false));
 if(locators.length)blocks.push(locators.join("\n"));
 return blocks.join("\n\n")+"\n";
}

function renderTaskTable(analysis:MeetingAnalysis):string[] {
 const rows=analysis.actionItems.map(item=>"| "+tableCell(item.title)+" | "+tableCell(item.assignee)+" | "+tableCell(item.dueDate)+" | "+actionStatusLabel(item.status)+" |");
 const body=rows.length?rows:["| — | — | — | — |"];
 return ["| 任务 | 负责人 | 期限 | 状态 |","|---|---|---|---|",...body];
}

function actionStatusLabel(status:ActionStatus):string {
 const label=ACTION_STATUS_LABELS[status] as string|undefined;
 return label??text(status);
}

/**
 * Missing owner/deadline stay unknown once for the whole table instead of
 * repeating a placeholder in every row.
 */
function taskCaveats(analysis:MeetingAnalysis):string[] {
 if(!analysis.actionItems.length)return [];
 const lines:string[]=[];
 if(analysis.actionItems.every(item=>!item.assignee))lines.push("负责人未在原文确认。");
 if(analysis.actionItems.every(item=>!item.dueDate))lines.push("期限未在原文确认。");
 return lines;
}

/**
 * Same-file trace appendix: task-to-claim mapping plus every claim reference
 * resolved back to its analysis fact and source evidence. Exposed for tests so
 * unreachable-reference branches can be pinned; callers should render through
 * renderMinutesDocument instead.
 */
export function renderTraceAppendix(analysis:MeetingAnalysis,document:MinutesDocument):string {
 const facts=indexAnalysisFacts(analysis);
 const claimIndex=indexActionItemClaims(document);
 const mappingRows=analysis.actionItems.map(item=>{
  const claimIds=claimIndex.get(item.id)??[];
  return "| "+tableCell(item.id)+" | "+tableCell(item.title)+" | "+tableCell(claimIds.length?claimIds.join("、"):"—（未映射）")+" |";
 });
 const mappingLines=["| 任务 ID | 任务 | 引用条目 |","|---|---|---|",...(mappingRows.length?mappingRows:["| — | — | — |"])];
 const claims=document.sections.flatMap(section=>section.claims);
 const evidenceLines=claims.map(claim=>renderClaimEvidence(claim,facts));
 const evidenceBlock=evidenceLines.length?evidenceLines.join("\n"):"- 无条目。";
 return ["## 溯源附录","### 任务映射",mappingLines.join("\n"),"### 条目证据",evidenceBlock,DISCLAIMER].join("\n\n");
}

function indexAnalysisFacts(analysis:MeetingAnalysis):Map<string,AnalysisFact> {
 const facts=new Map<string,AnalysisFact>();
 const add=(kind:FactKind,id:string,summary:string,evidence:EvidenceRef[]):void=>{
  if(!facts.has(id))facts.set(id,{kind,summary,evidence});
 };
 for(const item of analysis.decisions)add("decision",item.id,item.statement,item.evidence);
 for(const item of analysis.actionItems)add("action",item.id,item.title,item.evidence);
 for(const item of analysis.risks)add("risk",item.id,item.description,item.evidence);
 for(const item of analysis.openQuestions)add("openQuestion",item.id,item.question,item.evidence);
 for(const item of analysis.conflicts)add("conflict",item.id,item.description,item.evidence);
 return facts;
}

function indexActionItemClaims(document:MinutesDocument):Map<string,string[]> {
 const index=new Map<string,string[]>();
 for(const section of document.sections)for(const claim of section.claims)for(const ref of claim.refs) {
  const claimIds=index.get(ref);
  if(claimIds) {
   if(!claimIds.includes(claim.id))claimIds.push(claim.id);
  } else index.set(ref,[claim.id]);
 }
 return index;
}

function renderClaimEvidence(claim:MinutesClaim,facts:Map<string,AnalysisFact>):string {
 const lines:string[]=["- **"+text(claim.id)+"**（"+CLAIM_KIND_LABELS[claim.kind]+"）："+text(claim.text)];
 for(const ref of claim.refs) {
  const fact=facts.get(ref);
  if(fact===undefined) {
   lines.push("  - "+text(ref)+"：未解析到分析条目（引用不可达）");
   continue;
  }
  lines.push("  - "+text(ref)+"（"+FACT_KIND_LABELS[fact.kind]+"）："+text(fact.summary));
  if(fact.evidence.length)for(const evidence of fact.evidence)lines.push("    - 证据："+formatEvidenceLocator(evidence,APPENDIX_QUOTE_LIMIT,true));
  else lines.push("    - 证据：—");
 }
 return lines.join("\n");
}

function formatEvidenceLocator(ref:EvidenceRef|undefined,quoteLimit:number,fillMissing:boolean):string {
 if(ref===undefined)return "—";
 const parts:string[]=[text(ref.sourceId)];
 if(ref.segmentId!==undefined)parts.push(text(ref.segmentId));
 else if(fillMissing)parts.push("—");
 const lineRange=formatLineRange(ref);
 if(lineRange!==undefined)parts.push(lineRange);
 else if(fillMissing)parts.push("行 —");
 if(ref.timestamp!==undefined)parts.push(text(ref.timestamp));
 else if(fillMissing)parts.push("—");
 if(ref.quote!==undefined)parts.push("“"+text(truncate(ref.quote,quoteLimit))+"”");
 else if(fillMissing)parts.push("—");
 return parts.join(" / ");
}

function formatLineRange(ref:EvidenceRef):string|undefined {
 if(ref.lineStart===undefined)return undefined;
 if(ref.lineEnd===undefined||ref.lineEnd===ref.lineStart)return "行 "+ref.lineStart;
 return "行 "+ref.lineStart+"–"+ref.lineEnd;
}

function truncate(value:string,limit:number):string {
 return value.length<=limit?value:value.slice(0,limit)+"…";
}

function tableCell(value:string|undefined):string {
 return value===undefined||value===""?"—":text(value);
}