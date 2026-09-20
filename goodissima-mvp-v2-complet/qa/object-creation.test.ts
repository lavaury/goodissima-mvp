import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";
import * as preview from "../lib/secure-link-preview.ts";
import * as creation from "../lib/object-creation.ts";
import { loadTestModule } from "./helpers/load-test-module.ts";

// Real handlers and access guards; only persistence/session/external effects are doubled.
function setup() {
  const workspaces = [
    { id: "WA", ownerId: "A", status: "ACTIVE", name: "Travail", slug: "travail" },
    { id: "WB", ownerId: "B", status: "ACTIVE", name: "Autre" },
    { id: "archived", ownerId: "A", status: "ARCHIVED", name: "Archives" },
  ];
  const writes: any[] = [], effects: string[] = [];
  let template: any = null, snapshot: any = null;
  const findWorkspace = async ({ where }: any) => workspaces.find(row => Object.entries(where).every(([k,v]) => (row as any)[k] === v)) ?? null;
  const proof = () => template && ({ ...template, workspace: workspaces.find(w => w.id === template.workspaceId) ?? null, generations: [], versions: snapshot ? [{ snapshot }] : [] });
  const prisma: any = {
    workspace: { findFirst: findWorkspace, create() { throw Error("ARTIFICIAL_WORKSPACE"); }, upsert() { throw Error("ARTIFICIAL_WORKSPACE"); }, update() { throw Error("REASSIGNMENT"); } },
    relationTemplate: {
      findUnique: async ({ where }: any) => where.key ? null : where.id === "system" ? { id:"system", key:"DEFAULT_SECURE_CONVERSATION", status:"DRAFT", workspaceId:"WA", workspace:{ownerId:"A"}, versions:[],generations:[] } : proof(),
      findMany: async () => template ? [proof()] : [],
      create: async ({ data }: any) => { template = { id:"relation", workspaceId:null, ...data }; writes.push({model:"template",data}); return template; },
    },
    formTemplate: {
      findUnique: async () => template ? { id:"form", relationTemplate:proof() } : null,
      create: async ({data}: any) => { writes.push({model:"form",data}); return {id:"form",...data}; },
    },
    formField: { createMany: async ({data}:any) => { writes.push({model:"fields",data}); } },
    templateVersion: { create: async ({data}:any) => {snapshot=data.snapshot; writes.push({model:"version",data});} },
    gLink: { create: async ({data}:any) => { writes.push({model:"link",data}); return {id:"link",workspaceId:null,...data}; } },
    $transaction: async (fn:any) => fn(prisma),
  };
  const dependencies: any = {
    "@/lib/prisma": { prisma }, "@/lib/object-creation": creation,
    "@/lib/auth": { getCurrentPrismaUser: async () => ({id:"A",email:"a@example.test"}) },
    "next/server": { NextResponse: { json: Response.json } },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(path:string) { throw Error(`REDIRECT ${path}`); } },
    "@/lib/slug": { slugify: () => "objet" },
    "@/lib/public-app-url": { buildPublicAppUrl:(p:string)=>`https://example.test${p}` },
    "@/lib/secure-link-admission": { parseSecureLinkAdmissionMode:()=>"OPEN" },
    "@/lib/simple-link-fields": { isSimpleLinkRelationalEmailField:()=>false },
    "@/lib/template-snapshots": { getActiveTemplateVersion:async()=>null },
    "@/lib/audit": { auditLog:async()=>{effects.push("audit");} },
    "@/lib/email": { sendSecureLinkCreatedEmail:async()=>{effects.push("email");} },
  };
  const access = loadTestModule<any>("lib/relation-template-access.ts", dependencies);
  dependencies["@/lib/relation-template-access"] = access;
  dependencies["@/lib/workspace-creation-context"] = { getWorkspaceCreationContext: async (ownerId:string,id:unknown) => typeof id === "string" && id.trim() ? findWorkspace({where:{id,ownerId,status:"ACTIVE"}}) : null };
  const simple = loadTestModule<any>("app/api/links/simple/route.ts", dependencies);
  const opportunity = loadTestModule<any>("app/api/links/route.ts", dependencies);
  const governed = loadTestModule<any>("lib/governance-journey-actions.ts", dependencies);
  async function create(kind:string, workspaceId?:unknown) {
    if(kind === "governed") {
      const form = new FormData(); form.set("name","Parcours réel"); form.set("initialNeed","Organiser le travail");
      form.set("createdById","B"); form.set("workspaceName","Archives");
      if(workspaceId !== undefined) form.set("workspaceId",workspaceId as string);
      return governed.createGovernedJourneyAction(form);
    }
    return (kind === "simple" ? simple : opportunity).POST({json:async()=>({ title:"Objet réel", fields:[{label:"Question",type:"TEXT"}], humanValidated:true, templateId:"system", workspaceId, ownerId:"B", suppressNotification:true })});
  }
  return { create, writes, effects, workspaces, access, dependencies, proof, governed };
}

for(const kind of ["simple","opportunity","governed"]) for(const [context, id, allowed] of [
  ["global",undefined,true], ["owned active","WA",true], ["foreign","WB",false], ["archived","archived",false], ["missing","missing",false], ["empty","",false],
] as const) test(`${kind}: ${context}`,async()=>{
  const s=setup();
  if(kind === "governed") {
    await assert.rejects(s.create(kind,id),allowed ? /REDIRECT \/gouvernance\/parcours\/form\/pilotage/ : /Workspace/);
    if(allowed) {
      assert.equal(s.writes[0].data.workspaceId,id ?? null);
      const version=s.writes.find(w=>w.model==="version").data;
      assert.equal(version.version,1); assert.equal(version.snapshot.metadata.source,"governance-v1-minimal-create");
      assert.equal(version.snapshot.metadata.createdById,"A");
      assert.ok(await s.access.getTemplateReadAccess({id:"A"},"form"));
      assert.equal(await s.access.getTemplateReadAccess({id:"B"},"form"),null);
      assert.deepEqual(await s.access.getAccessibleRelationTemplateIds("A"),["relation"]);
      assert.deepEqual(await s.access.getAccessibleRelationTemplateIds("B"),[]);
      assert.equal(version.snapshot.metadata.automaticContact,false);
    }
  } else {
    const response=await s.create(kind,id);
    assert.equal(response.status,allowed ? kind === "simple" ? 201 : 200 : id === "" ? 400 : 404);
    if(allowed) {
      const link=s.writes.find(w=>w.model==="link").data;
      assert.equal(link.workspaceId ?? null,id ?? null); assert.equal(link.ownerId,"A");
      assert.equal(creation.linkObjectLabel(link.rules),kind === "simple" ? "Lien simple" : "Opportunité");
      if(kind === "simple") {
        // The support template has no independent creator proof or Workspace:
        // it never appears as an orphan governed journey through READ projection.
        assert.equal(s.proof().workspaceId,null);
        assert.deepEqual(await s.access.getAccessibleRelationTemplateIds("A"),[]);
      }
    }
  }
  if(!allowed) assert.equal(s.writes.length,0);
  assert.ok(!s.effects.includes("email"));
});

test("archiving the context before submission refuses all three final creations",async()=>{
  for(const kind of ["simple","opportunity","governed"]) {
    const s=setup(); s.workspaces[0].status="ARCHIVED";
    if(kind === "governed") await assert.rejects(s.create(kind,"WA"),/Workspace/);
    else assert.equal((await s.create(kind,"WA")).status,404);
    assert.equal(s.writes.length,0);
  }
});

test("malformed JSON contexts cannot become a global creation",async()=>{
  for(const kind of ["simple","opportunity"]) for(const id of [null,[],{},42]) {
    const s=setup(); assert.equal((await s.create(kind,id)).status,400); assert.equal(s.writes.length,0);
  }
  const s=setup(); const form=new FormData();form.set("name","Parcours");form.append("workspaceId","WA");form.append("workspaceId","WB");
  await assert.rejects(s.governed.createGovernedJourneyAction(form),/Workspace/);assert.equal(s.writes.length,0);
});

for(const file of ["app/api/templates/ai-generate/route.ts","app/api/templates/ai-generate/[generationId]/revise/route.ts","app/api/templates/ai-generate/[generationId]/validate/route.ts","app/api/gouvernance/journey-ai-generate/route.ts"]) test(`${file}: invalid context refuses before AI or persistence`,async()=>{
  const s=setup(); const imports=Object.fromEntries(ts.preProcessFile(readFileSync(file,"utf8")).importedFiles.map(i=>[i.fileName,{}]));
  const route=loadTestModule<any>(file,{...imports,...s.dependencies});
  for(const workspaceId of ["WB","archived","missing","",null,[],{}]) {
    const response=await route.POST({json:async()=>({workspaceId,humanValidated:true})},{params:{generationId:"generation"}});
    assert.equal(response.status,404); assert.equal(s.writes.length,0); assert.deepEqual(s.effects,[]);
  }
});

test("positive labels leave historical unqualified GLinks generic and never duplicate a row",()=>{
  assert.equal(creation.linkObjectLabel(null),"Lien");
  assert.equal(creation.linkObjectLabel({requireEmail:true}),"Lien");
  assert.equal(creation.linkObjectLabel({simpleLink:true,creationSource:"opportunity"}),"Lien simple");
  assert.equal(creation.linkObjectLabel({creationSource:"opportunity"}),"Opportunité");
});

test("context URLs preserve existing query/hash and encode identifiers",()=>{
  assert.equal(creation.withCreationWorkspace("/templates/form?advanced=1#fields","a/b"),"/templates/form?advanced=1&workspaceId=a%2Fb#fields");
  assert.equal(creation.withCreationWorkspace("/links/new"),"/links/new");
});

function nodes(node: any): any[] {
  if(Array.isArray(node)) return node.flatMap(nodes);
  return node && typeof node === "object" ? [node, ...nodes(node.props?.children)] : [];
}

test("opportunity creation is global and no longer branches through a governed journey",async()=>{
  const s=setup(); const file="app/(connected)/opportunities/new/page.tsx";
  const page=loadTestModule<any>(file,{
    ...s.dependencies, "react/jsx-runtime":jsx, "next/link":"a",
    "@/components/OpportunityDraftCreator":{OpportunityDraftCreator:"creator"},
  });
  const tree=nodes(await page.default());
  assert.ok(tree.some(n=>n.type==="creator"));
  assert.ok(tree.some(n=>n.props?.href==="/opportunities"));
  assert.ok(tree.some(n=>n.props?.href==="/gouvernance"));
  assert.ok(!tree.some(n=>n.props?.href==="/links/new" || n.type==="designer"));
});

test("an explicit unavailable template on the final form gets 404, never a replacement",async()=>{
  const s=setup(); const file="app/(connected)/links/new/page.tsx";
  const imports=Object.fromEntries(ts.preProcessFile(readFileSync(file,"utf8")).importedFiles.map(i=>[i.fileName,{}]));
  const page=loadTestModule<any>(file,{
    ...imports,...s.dependencies, "react/jsx-runtime":jsx, "next/cache":{unstable_noStore(){}},
    "next/navigation":{notFound(){throw Error("404");}},
    "@/lib/i18n":{getI18n:()=>({locale:"fr",t:(x:string)=>x})},
  });
  for(const templateId of ["foreign","missing","",["system","foreign"]]) await assert.rejects(page.default({searchParams:{templateId}}),/404/);
});

for(const workspaceId of [undefined,"WA"]) test(`real final form sends ${workspaceId ?? "global"} and opens the owner destination`,async()=>{
  const requests:any[]=[], destinations:string[]=[], errors:string[]=[];
  const form=loadTestModule<any>("app/(connected)/links/new/NewLinkForm.tsx",{
    "react":{useState:(initial:any)=>[initial,()=>{}],useRef:()=>({current:null})},
    "react/jsx-runtime":jsx,
    "next/navigation":{useRouter:()=>({push:(p:string)=>destinations.push(p)})},
    "@/components/CopyLinkButton":{CopyLinkButton:()=>null},
    "@/components/I18nProvider":{useI18n:()=>({t:(s:string)=>s})},
    "@/components/ToastProvider":{useToast:()=>({success(){},error:(e:string)=>errors.push(e)})},
    "@/lib/secure-link-preview":preview,
    "@/lib/secure-link-admission":{SECURE_LINK_ADMISSION_LABELS:{OPEN:"Ouvert",VERIFIED_ONLY:"Vérifié"}},
  },{fetch:async(url:string,options:any)=>{requests.push({url,body:JSON.parse(options.body)});return{ok:true,json:async()=>({id:"created/link",publicUrl:"https://example.test/l/public"})};}});
  const template={id:"allowed",name:"Annonce",status:"PUBLISHED",photos:[],attachments:[],verifiedLinks:[],steps:[],rules:[],objectives:[],announcementTitle:"Annonce",announcementCity:"",announcementDescription:"",verificationRequired:false};
  const tree=nodes(form.NewLinkForm({templates:[template],defaultTemplateId:"allowed",workspaceId}));
  tree.find(n=>n.type==="button" && n.props.children==="Générer le lien sécurisé").props.onClick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests[0].url,"/api/links");
  assert.equal(requests[0].body.workspaceId,workspaceId);
  assert.equal(requests[0].body.suppressNotification,true);
  assert.equal(requests[0].body.templateId,"allowed");
  assert.deepEqual(destinations,["/links/created%2Flink"]); assert.deepEqual(errors,[]);
});
