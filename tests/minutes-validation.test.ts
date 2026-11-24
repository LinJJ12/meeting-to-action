import {it,expect} from "vitest";
import {MeetingAnalysisSchema} from "../src/domain/schema.js";
import {validateMinutes,MinutesContractError} from "../src/core/minutes.js";
type ActionStatus="proposed"|"accepted"|"in_progress"|"done"|"blocked"|"unknown";
const evidence=[{sourceId:"s1",segmentId:"seg-1",lineStart:1,lineEnd:2}];
const analysisDraft=(a3Status:ActionStatus="accepted")=>({schemaVersion:"1.0",meetingId:"meeting-1",summary:["完成登录链路回归"],topics:[{title:"登录",summary:"回归完成",evidence}],decisions:[{id:"d1",statement:"下周切换新网关",status:"confirmed",evidence,confidence:"high"}],actionItems:[{id:"a1",title:"回归回复链路",status:"in_progress",evidence,confidence:"medium"},{id:"a2",title:"补充监控",status:"done",evidence,confidence:"high"},{id:"a3",title:"整理接入材料",status:a3Status,evidence,confidence:"low"}],risks:[{id:"r1",description:"云端环境未验证",severity:"high",evidence}],openQuestions:[{id:"q1",question:"发布时间？",evidence}],conflicts:[{id:"cf1",description:"对截止时间存在分歧",evidence}],generatedAt:"2026-11-24T08:00:00.000Z"});
const makeAnalysis=(a3Status:ActionStatus="accepted")=>MeetingAnalysisSchema.parse(analysisDraft(a3Status));
const makeMinutes=()=>({schemaVersion:"1.0",contractVersion:"1.0",meetingId:"meeting-1",generatedAt:"2026-11-24T08:05:00.000Z",title:"账号与回复链路",meta:{date:"2026-11-24",participants:["甲","乙"]},highlights:["登录链路回归完成","新网关切换待发布"],sections:[{id:"sec-1",heading:"账号与回复链路",claims:[{id:"c-progress",kind:"progress",text:"登录链路回归已完成",detail:"云端环境尚未验证",refs:["a1","a2"]},{id:"c-followup",kind:"followup",text:"整理接入材料",refs:["a3"]}]},{id:"sec-2",heading:"已确认决定",claims:[{id:"c-decision",kind:"decision",text:"下周切换新网关",refs:["d1"]}]},{id:"sec-3",heading:"待确认",claims:[{id:"c-open",kind:"open",text:"云端验证与发布时间待确认",refs:["q1","r1","cf1"]}]}]});
const mutate=(change:(document:any)=>void)=>{const document:any=makeMinutes();change(document);return document;};
const run=(document:any,analysis=makeAnalysis())=>{try{validateMinutes({},analysis,document);}catch(error){return error as MinutesContractError;}return undefined;};
it("accepts a fully mapped minutes document and returns the parsed copy",()=>{
 const document=validateMinutes({},makeAnalysis(),makeMinutes());
 expect(document.title).toBe("账号与回复链路");
 expect(document.sections).toHaveLength(3);
 expect(document.sections[0]!.claims[0]!.detail).toBe("云端环境尚未验证");
});
it.each<[string,(document:any)=>void]>([
 ["MINUTES_MEETING_MISMATCH",document=>{document.meetingId="meeting-2";}],
 ["MINUTES_CONTRACT_UNSUPPORTED",document=>{document.contractVersion="2.0";}],
 ["MINUTES_REF_UNKNOWN",document=>{document.sections[0].claims[1]!.refs.push("missing-item");}],
 ["MINUTES_KIND_MISMATCH",document=>{document.sections[1].claims[0]!.refs=["a1"];}],
 ["MINUTES_ACTION_COVERAGE",document=>{document.sections[0].claims[1]!.refs=["a1"];}],
 ["MINUTES_SCHEMA_INVALID",document=>{delete document.title;}],
])("rejects with %s",(code,change)=>{
 const error=run(mutate(change));
 expect(error).toBeInstanceOf(MinutesContractError);
 expect(error).toBeInstanceOf(Error);
 expect(error!.code).toBe(code);
 expect(error!.message).toContain(code);
});
it("reports both meeting ids on MINUTES_MEETING_MISMATCH",()=>{
 const error=run(mutate(document=>{document.meetingId="meeting-2";}));
 expect(error?.message).toContain("meeting-2");
 expect(error?.message).toContain("meeting-1");
});
it("reports unsupported contract versions before structural problems",()=>{
 const error=run(mutate(document=>{document.contractVersion="3.1";delete document.title;}));
 expect(error?.code).toBe("MINUTES_CONTRACT_UNSUPPORTED");
});
it("keeps the offending field path in MINUTES_SCHEMA_INVALID",()=>{
 const error=run(mutate(document=>{delete document.sections[1].heading;}));
 expect(error?.code).toBe("MINUTES_SCHEMA_INVALID");
 expect(error?.message).toContain("sections.1.heading");
});
it("never lets claims carry task facts",()=>{
 const error=run(mutate(document=>{document.sections[0].claims[0].assignee="甲";}));
 expect(error?.code).toBe("MINUTES_SCHEMA_INVALID");
});
it("rejects references to items missing from the analysis",()=>{
 for(const kind of ["decision","followup","progress","open"]){
  const error=run(mutate(document=>{document.sections.push({id:"sec-extra",heading:"附加",claims:[{id:"c-extra",kind,text:"附加条目",refs:["missing-item"]}]});}));
  expect(error?.code).toBe("MINUTES_REF_UNKNOWN");
  expect(error?.message).toContain("missing-item");
 }
});
it.each<[string,string]>([
 ["decision","d1"],["followup","a1"],["progress","a1"],["progress","a2"],["progress","d1"],["open","q1"],["open","r1"],["open","cf1"],
])("accepts kind=%s referencing %s",(kind,ref)=>{
 const document=mutate(value=>{value.sections.push({id:"sec-extra",heading:"附加",claims:[{id:"c-extra",kind,text:"附加条目",refs:[ref]}]});});
 expect(run(document)).toBeUndefined();
});
it.each<[string,string]>([
 ["decision","a1"],["decision","q1"],["decision","cf1"],["followup","d1"],["followup","cf1"],["open","a1"],["open","d1"],["open","a2"],["progress","r1"],["progress","cf1"],
])("rejects kind=%s referencing %s",(kind,ref)=>{
 const document=mutate(value=>{value.sections.push({id:"sec-extra",heading:"附加",claims:[{id:"c-extra",kind,text:"附加条目",refs:[ref]}]});});
 const error=run(document);
 expect(error?.code).toBe("MINUTES_KIND_MISMATCH");
 expect(error?.message).toContain(kind);
});
it.each<[ActionStatus,boolean]>([
 ["done",true],["in_progress",true],["blocked",true],["proposed",false],["accepted",false],["unknown",false],
])("treats progress on an action item with status=%s as valid=%s",(status,valid)=>{
 const document=mutate(value=>{value.sections[0].claims[1].kind="progress";});
 const error=run(document,makeAnalysis(status));
 if(valid)expect(error).toBeUndefined();
 else expect(error?.code).toBe("MINUTES_KIND_MISMATCH");
});
it("fails action coverage when an action item is never referenced",()=>{
 const error=run(mutate(document=>{document.sections[0].claims[0].refs=["a1"];}));
 expect(error?.code).toBe("MINUTES_ACTION_COVERAGE");
 expect(error?.message).toContain("a2");
});
it("passes action coverage when every action item is referenced",()=>{
 expect(run(makeMinutes())).toBeUndefined();
});
it("passes action coverage when the analysis has no action items",()=>{
 const analysis:any={...makeAnalysis(),actionItems:[]};
 const document=mutate(value=>{value.sections[0].claims=[{id:"c-progress",kind:"progress",text:"回归已完成",refs:["d1"]}];});
 expect(run(document,analysis)).toBeUndefined();
});