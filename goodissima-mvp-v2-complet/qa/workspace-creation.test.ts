import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { loadTestModule } from "./helpers/load-test-module.ts";
import * as spatial from "../lib/spatial-navigation.ts";

const active = { id: "w-a", ownerId: "a", status: "ACTIVE", name: "Contentieux", slug: "contentieux", category: "PROJECT", portfolio: null };
const workspaces = [active, { ...active, id: "w-b", ownerId: "b" }, { ...active, id: "archived", status: "ARCHIVED" }];
function findWorkspace(q: any) { return workspaces.find(row => Object.entries(q.where).every(([key,value]) => (row as any)[key] === value)) ?? null; }
const context = loadTestModule("lib/workspace-creation-context.ts", { "@/lib/prisma": { prisma: { workspace: { findFirst: async (q: any) => findWorkspace(q) } } }, "@/lib/spatial-navigation": spatial });
const common = { "react/jsx-runtime": jsx, "next/link": ({ children, ...props }: any) => jsx.jsx("a",{...props,children}),
  "next/navigation": { notFound: () => { throw Error("NOT_FOUND"); } },
  "@/lib/auth": { getCurrentPrismaUser: async () => ({ id:"a",name:"Compte",email:"a@example.test" }) },
  "@/lib/workspace-creation-context": context, "@/lib/spatial-navigation": spatial,
  "@/components/SpatialNavigationContext": { PageNavigationContext: ({ items }: any) => jsx.jsx("p",{children:items.map((i:any)=>i.label).join(" > ")}) },
};
function journeyPage() { return loadTestModule("app/(connected)/gouvernance/nouveau/page.tsx", {...common,
  "@/app/(connected)/gouvernance/nouveau/GovernanceJourneyAssistant": { GovernanceJourneyAssistant: ({initialWorkspaceId}:any) => jsx.jsx("span",{"data-initial-workspace":initialWorkspaceId}) },
  "@/lib/governance-journey-actions": { createGovernedJourneyAction: () => {} },
  "@/lib/governance-workspace-repository": { getGovernanceWorkspaceOptions: async () => [{...active,categoryLabel:"Projet",kindLabel:"Gouvernance"}], workspaceCategoryLabels:{} },
  "./GovernedJourneyEducationalPreview": { GovernedJourneyEducationalPreview: () => null },
}); }
function linkPage() { return loadTestModule("app/(connected)/links/simple/page.tsx", {...common,
  "./simple-link-builder": { SimpleLinkBuilder: ({workspaceId}:any) => jsx.jsx("span",{"data-initial-workspace":workspaceId}) },
}); }
test("both creation pages preselect the authorized Workspace and retain its breadcrumb",async()=>{
  for(const page of [journeyPage(),linkPage()]) {
    const html=renderToStaticMarkup(await page.default({searchParams:{workspaceId:"w-a"}}));
    assert.ok(html.includes('data-initial-workspace="w-a"'));
    assert.ok(html.includes("Accueil &gt; Mes espaces &gt; Contentieux &gt; Créer"));
    assert.ok(html.includes('href="/gouvernance/workspaces/w-a"'));
    for(const id of ["w-b","archived","unknown",""]) await assert.rejects(page.default({searchParams:{workspaceId:id}}),/NOT_FOUND/);
    assert.ok(await page.default({}));
  }
  const html=renderToStaticMarkup(await journeyPage().default({searchParams:{workspaceId:"w-a"}}));
  assert.match(html, /<option value="w-a" selected="">/);
});
function journeyMutation(owner: string | null = "a") {
  const writes:any[]=[];const invalidated:string[]=[];
  const tx = { workspace:{findFirst:async(q:any)=>findWorkspace(q),upsert:async()=>{throw Error("Unexpected fallback");}},
    relationTemplate:{create:async(q:any)=>{writes.push(q);return{id:"journey",...q.data};}},
    formTemplate:{create:async(q:any)=>{writes.push(q);return{id:"form",...q.data};}},
    formField:{createMany:async(q:any)=>{writes.push(q);}},templateVersion:{create:async(q:any)=>{writes.push(q);}},
  };
  const module=loadTestModule("lib/governance-journey-actions.ts", {
    "@/lib/auth":{getCurrentPrismaUser:async()=>{if(!owner)throw Error("LOGIN");return{id:owner};}},
    "@/lib/prisma":{prisma:{relationTemplate:{findUnique:async()=>null},$transaction:async(fn:any)=>fn(tx)}},
    "next/navigation":{redirect:(path:string)=>{throw Error(`REDIRECT ${path}`);}},"next/cache":{revalidatePath:(p:string)=>invalidated.push(p)},
  });
  return {create:module.createGovernedJourneyAction,writes,invalidated};
}
function form(id:string){const data=new FormData();data.set("workspaceId",id);data.set("name","Parcours réel");data.set("initialNeed","Organiser une relation gouvernée");return data;}
test("real journey mutation checks owner and ACTIVE, creates the direct journey and keeps cockpit redirect",async()=>{
  const s=journeyMutation();await assert.rejects(s.create(form("w-a")),/REDIRECT \/gouvernance\/parcours\/form\/pilotage/);
  assert.equal(s.writes[0].data.workspaceId,"w-a");
  assert.equal(s.writes[3].data.snapshot.metadata.workspaceId,"w-a");
  assert.equal(s.writes[3].data.snapshot.metadata.automaticContact,false);
  assert.deepEqual(s.invalidated,["/gouvernance/workspaces/w-a"]);
  for(const id of ["w-b","archived","unknown"]) {const denied=journeyMutation();await assert.rejects(denied.create(form(id)),/Workspace introuvable/);assert.equal(denied.writes.length,0);}
  await assert.rejects(journeyMutation(null).create(form("w-a")),/LOGIN/);
});
function linkMutation(owner:string|null="a") {
  const writes:any[]=[];const invalidated:string[]=[];
  const tx={workspace:{findFirst:async(q:any)=>findWorkspace(q)},relationTemplate:{create:async(q:any)=>{writes.push({model:"template",...q});return{id:"template"};}},formTemplate:{create:async(q:any)=>{writes.push({model:"form",...q});return{id:"form"};}},gLink:{create:async(q:any)=>{writes.push({model:"link",...q});return{id:"link",...q.data};}}};
  const api=loadTestModule("app/api/links/simple/route.ts",{
    "next/server":{NextResponse:{json:(body:any,options:any)=>({body,status:options.status})}},
    "next/cache":{revalidatePath:(p:string)=>invalidated.push(p)},
    "@/lib/auth":{getCurrentPrismaUser:async()=>{if(!owner)throw Error("LOGIN");return{id:owner};}},
    "@/lib/prisma":{prisma:{$transaction:async(fn:any)=>fn(tx)}},"@/lib/slug":{slugify:()=>"lien"},
    "@/lib/public-app-url":{buildPublicAppUrl:(p:string)=>`https://example.test${p}`},
    "@/lib/simple-link-fields":{isSimpleLinkRelationalEmailField:()=>false},
  });
  return{post:(workspaceId?:unknown,humanValidated=true)=>api.POST({json:async()=>({title:"Lien réel",fields:[{label:"Question",type:"TEXT"}],workspaceId,humanValidated})}),writes,invalidated};
}
test("simple link attaches only the new GLink, validates the Workspace in transaction and preserves confirmation",async()=>{
  const s=linkMutation();const result=await s.post("w-a");assert.equal(result.status,201);
  assert.equal(s.writes[2].data.workspaceId,"w-a");assert.equal(s.writes[0].data.workspaceId,undefined);
  assert.equal(s.writes[2].data.ownerId,"a");assert.ok(s.invalidated.includes("/gouvernance/workspaces/w-a"));
  for(const id of ["w-b","archived","unknown"]) {const denied=linkMutation();assert.equal((await denied.post(id)).status,404);assert.equal(denied.writes.length,0);}
  for(const id of ["",null,[],{}])assert.equal((await linkMutation().post(id)).status,400);
  const unconfirmed=linkMutation();assert.equal((await unconfirmed.post("w-a",false)).status,400);assert.equal(unconfirmed.writes.length,0);
  const generic=linkMutation();assert.equal((await generic.post()).status,201);assert.equal(generic.writes[2].data.workspaceId,undefined);
  await assert.rejects(linkMutation(null).post("w-a"),/LOGIN/);
});
test("archiving after page preselection is refused by both mutations",async()=>{
  assert.ok(await context.getWorkspaceCreationContext("a","w-a"));
  active.status="ARCHIVED";
  try{await assert.rejects(journeyMutation().create(form("w-a")),/Workspace introuvable/);assert.equal((await linkMutation().post("w-a")).status,404);}finally{active.status="ACTIVE";}
});
test("Nouveau contains only contextual journey and simple link destinations",()=>{
  const {WorkspaceCreateActions}=loadTestModule("components/WorkspaceCreateActions.tsx",{react:React,"react/jsx-runtime":jsx,"next/link":common["next/link"]});
  const html=renderToStaticMarkup(jsx.jsx(WorkspaceCreateActions,{workspaceId:"w-a"}));
  assert.ok(html.includes('href="/gouvernance/nouveau?workspaceId=w-a"'));
  assert.ok(html.includes('href="/links/simple?workspaceId=w-a"'));
  assert.equal((html.match(/<a /g)??[]).length,2);
});
test("Explorer retains Open only; archived Workspace does not mount creation actions",()=>{
  const source=readFileSync(new URL("../components/WorkspaceDetailView.tsx",import.meta.url),"utf8");
  assert.ok(source.includes('workspace.status === "ACTIVE" ? <WorkspaceCreateActions'));
  assert.ok(!/Archiver|Supprimer|Déplacer|Détacher|Renommer|Restaurer/.test(source));
});
