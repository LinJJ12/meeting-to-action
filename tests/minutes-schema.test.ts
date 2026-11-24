import {it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {z} from "zod";
import {MinutesDocumentSchema,MINUTES_CONTRACT_VERSION} from "../src/domain/minutes.js";
const valid=()=>({schemaVersion:"1.0",contractVersion:MINUTES_CONTRACT_VERSION,meetingId:"meeting-1",generatedAt:"2026-11-24T08:05:00.000Z",title:"账号与回复链路",meta:{date:"2026-11-24",participants:["甲","乙"]},highlights:["登录链路回归完成"],sections:[{id:"sec-1",heading:"账号与回复链路",claims:[{id:"c-1",kind:"progress",text:"登录链路回归已完成",detail:"云端环境尚未验证",refs:["a1","a2"]}]}]});
it("parses a valid minutes document",()=>{
 const document=MinutesDocumentSchema.parse(valid());
 expect(document.title).toBe("账号与回复链路");
 expect(document.meta.date).toBe("2026-11-24");
 expect(document.sections[0]!.claims[0]!.refs).toEqual(["a1","a2"]);
});
it("keeps document-level optional fields optional",()=>{
 const document=MinutesDocumentSchema.parse({...valid(),meta:{},highlights:[]});
 expect(document.meta).toEqual({});
 expect(document.actionNote).toBeUndefined();
});
it.each(["top","meta","section","claim"] as const)("rejects unknown fields on %s",(scope)=>{
 const document:any=valid();
 if(scope==="top")document.unexpected="x";
 if(scope==="meta")document.meta.unexpected="x";
 if(scope==="section")document.sections[0].unexpected="x";
 if(scope==="claim")document.sections[0].claims[0].unexpected="x";
 expect(()=>MinutesDocumentSchema.parse(document)).toThrow(z.ZodError);
});
it("rejects task facts smuggled into claims",()=>{
 for(const field of ["assignee","dueDate","status"]){
  const document:any=valid();
  document.sections[0].claims[0][field]="甲";
  expect(()=>MinutesDocumentSchema.parse(document)).toThrow(z.ZodError);
 }
});
it("rejects unsupported schemaVersion and contractVersion",()=>{
 expect(()=>MinutesDocumentSchema.parse({...valid(),schemaVersion:"2.0"})).toThrow(z.ZodError);
 expect(()=>MinutesDocumentSchema.parse({...valid(),contractVersion:"2.0"})).toThrow(z.ZodError);
});
it("rejects missing required fields",()=>{
 for(const field of ["meetingId","generatedAt","title","meta","highlights","sections"]){
  const document:any=valid();
  delete document[field];
  expect(()=>MinutesDocumentSchema.parse(document)).toThrow(z.ZodError);
 }
});
it("rejects bad datetimes, empty containers and unknown claim kinds",()=>{
 expect(()=>MinutesDocumentSchema.parse({...valid(),generatedAt:"not-a-datetime"})).toThrow(z.ZodError);
 expect(()=>MinutesDocumentSchema.parse({...valid(),sections:[]})).toThrow(z.ZodError);
 const emptyClaims:any=valid();emptyClaims.sections[0].claims=[];
 expect(()=>MinutesDocumentSchema.parse(emptyClaims)).toThrow(z.ZodError);
 const emptyRefs:any=valid();emptyRefs.sections[0].claims[0].refs=[];
 expect(()=>MinutesDocumentSchema.parse(emptyRefs)).toThrow(z.ZodError);
 const badKind:any=valid();badKind.sections[0].claims[0].kind="done";
 expect(()=>MinutesDocumentSchema.parse(badKind)).toThrow(z.ZodError);
});
it("ships a Skill JSON Schema matching the runtime contract",()=>{
 const bundled=JSON.parse(readFileSync(new URL("../skills/meeting-to-action/references/minutes.schema.json",import.meta.url),"utf8"));
 expect(bundled).toEqual(z.toJSONSchema(MinutesDocumentSchema));
});