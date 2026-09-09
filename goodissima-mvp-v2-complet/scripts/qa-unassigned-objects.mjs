import { objectActionRow, organizationPanel } from "../qa/helpers/object-action-row.ts";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTestModule } from "../qa/helpers/load-test-module.ts";
import * as pagination from "../lib/unassigned-pagination.ts";

// Real server component and CSS, isolated repository/action fixtures; no business writes.
const output = fs.mkdtempSync(path.join(os.tmpdir(), "goodissima-organize-"));
const chrome = process.env.GOODISSIMA_CHROME || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
assert.ok(chrome, "A Chromium browser is required");
execFileSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "app/globals.css", "-o", path.join(output, "styles.css")], { stdio: "pipe" });
async function markup(empty = false, noWorkspace = false) {
  const title = "Un objet avec un titre très long " + "X".repeat(180);
  const item = { id: "fixture", formTemplateId: "fixture-form", title, createdAt: new Date("2026-09-01"), href: "/links/fixture", gLinkTitle: title };
  const page = items => ({ items: empty ? [] : items, hasMore: !empty });
  const component = loadTestModule("components/SpacesExistingAttachments.tsx", {
    "react/jsx-runtime": jsx, "@/components/ObjectActionRow": objectActionRow, "@/components/OrganizationPanel": organizationPanel,
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "@/lib/unassigned-pagination": pagination,
    "@/lib/governance-workspace-actions": { attachGLinkToWorkspaceAction: "/fixture-link", attachRelationCaseToWorkspaceAction: "/fixture-case", attachGovernedJourneyToWorkspaceAction: "/fixture-journey" },
    "@/lib/governance-workspace-repository": {
      getGovernanceWorkspaceOptions: async () => noWorkspace ? [] : Array.from({ length:21 }, (_,i) => ({ id:`w${i}`, name:title, categoryLabel:"Projet" })),
      getUnassignedGLinkSummaries: async () => page([{...item, objectLabel:"Lien simple"}, {...item,id:"opportunity",objectLabel:"Opportunité"}]),
      getUnassignedRelationCaseSummaries: async () => page([{...item,href:"/cases/fixture"}]),
      getUnassignedGovernedJourneySummaries: async () => page([{...item,href:"/gouvernance/parcours/fixture-form/pilotage"}]),
    },
  });
  return renderToStaticMarkup(await component.SpacesExistingAttachments({ ownerId:"fixture-owner" }));
}
const pages = { populated:await markup(), empty:await markup(true), noWorkspace:await markup(false,true) };
const server = createServer((request,response) => {
  if (request.url.includes("styles.css")) { response.setHeader("Content-Type","text/css"); response.end(fs.readFileSync(path.join(output,"styles.css"))); return; }
  const state = request.url.includes("empty") ? "empty" : request.url.includes("noWorkspace") ? "noWorkspace" : "populated";
  response.setHeader("Content-Type","text/html; charset=utf-8");
  response.end(`<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><main class="mx-auto min-w-0 max-w-6xl px-4 py-8 sm:px-6">${pages[state]}</main><script>window.submissions=[];document.addEventListener('submit',e=>{e.preventDefault();submissions.push({action:e.target.getAttribute('action'),data:Object.fromEntries(new FormData(e.target))})});</script></body></html>`);
});
await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const proc = spawn(chrome,["--headless","--disable-gpu","--no-first-run","--no-default-browser-check","--remote-debugging-port=0",`--user-data-dir=${path.join(output,"profile")}`],{windowsHide:true,stdio:["ignore","ignore","pipe"]});
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let stderr = "";
    const timer = setTimeout(() => reject(Error("Browser startup timeout")), 15000);
    proc.once("error", reject);
    proc.stderr.on("data", chunk => { stderr += chunk; const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
  });
  socket = new WebSocket(endpoint);
  await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", event => { const result = JSON.parse(event.data); if (result.id) { const item = pending.get(result.id); pending.delete(result.id); result.error ? item.reject(result.error) : item.resolve(result.result); } });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, sessionId })); });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.bringToFront", {}, sessionId);
  await send("Emulation.setFocusEmulationEnabled", { enabled: true }, sessionId);
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
    assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const key = async (name, code = name) => {
    const text = name === "Enter" ? "\r" : name === " " ? " " : undefined;
    const event = { key: name, code, windowsVirtualKeyCode: { Enter: 13, Escape: 27, Tab: 9, " ": 32 }[name] };
    await send("Input.dispatchKeyEvent", { ...event, type: text ? "keyDown" : "rawKeyDown", text, unmodifiedText: text }, sessionId);
    await send("Input.dispatchKeyEvent", { ...event, type: "keyUp" }, sessionId);
  };
  const pause = () => new Promise(resolve => setTimeout(resolve, 80));
  const results = [];
  for (const width of [320,375,768,1024,1440]) {
    await send("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:false},sessionId);
    for (const state of ["populated","empty","noWorkspace"]) {
      await send("Page.navigate",{url:`${origin}/${state}`},sessionId);
      for(let i=0;i<50 && !(await evaluate("Boolean(document.querySelector('#a-organiser'))"));i++) await pause();
      await pause();
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"),true,`${width}/${state}: overflow`);
      assert.equal(await evaluate("Boolean(document.querySelector('[class*=amber]'))"),false);
      if(state !== "empty") assert.equal(await evaluate("document.querySelectorAll('article a').length"),4);
      if(state !== "populated") { assert.equal(await evaluate("document.querySelectorAll('form').length"),0); continue; }
      assert.equal(await evaluate("[...document.querySelectorAll('select')].every(s=>s.labels.length===1 && s.required && s.options.length===21)"),true);
      assert.equal(await evaluate("[...document.querySelectorAll('button,select')].every(e=>e.getBoundingClientRect().height>=44)"),true);
      assert.equal(await evaluate("[...document.querySelectorAll('a')].every(a=>!a.href.includes('/secure/'))"),true);
      // Keyboard: native select, Tab to submit, Enter. The destination change alone does nothing.
      await evaluate("document.querySelector('select').focus();document.querySelector('select').value='w0'");
      assert.equal(await evaluate("submissions.length"),0);
      await key("Tab");
      assert.equal(await evaluate("document.activeElement.tagName"),"BUTTON");
      assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineStyle"),"solid");
      await key("Enter"); await pause();
      assert.equal(await evaluate("submissions.length"),1);
      // Mouse and touch use real browser input on separate attachment forms.
      for(const [index,mode] of [[1,"mouse"],[3,"touch"]]) {
        const point = await evaluate(`(()=>{const form=document.querySelectorAll('form')[${index}];form.querySelector('select').value='w0';const b=form.querySelector('button');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
        if(mode === "mouse") {
          await send("Input.dispatchMouseEvent",{type:"mousePressed",...point,button:"left",clickCount:1},sessionId);
          await send("Input.dispatchMouseEvent",{type:"mouseReleased",...point,button:"left",clickCount:1},sessionId);
        } else {
          await send("Emulation.setTouchEmulationEnabled",{enabled:true},sessionId);
          await send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[point]},sessionId);
          await send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]},sessionId);
        }
        await pause();
      }
      const submitted = await evaluate("submissions");
      assert.equal(submitted.length,3);
      assert.deepEqual(submitted.map(s=>s.action),["/fixture-journey","/fixture-link","/fixture-case"]);
      assert.ok(submitted.every(s=>s.data.attachmentMode === "unassigned" && s.data.workspaceId === "w0" && !s.data.attachUnassignedCases));
      await evaluate("scrollTo(0,0)");
      fs.writeFileSync(path.join(output,`${width}.png`),Buffer.from((await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:true},sessionId)).data,"base64"));
    }
    results.push({width,states:3,keyboard:true,mouse:true,touch:true,overflow:false});
  }
  fs.writeFileSync(path.join(output,"results.json"),JSON.stringify(results,null,2));
  console.log(JSON.stringify({output,results},null,2));
  await send("Browser.close");
} finally {
  socket?.close(); proc.kill(); server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  console.log(`Browser artifacts: ${output}`);
}
