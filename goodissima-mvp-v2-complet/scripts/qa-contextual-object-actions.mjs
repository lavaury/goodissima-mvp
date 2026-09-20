import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import ts from "typescript";

// Browser contract test: actual React components and Tailwind CSS, local auth/router
// doubles. No application server, account, business data or network is required.
const require = createRequire(import.meta.url);
const output = fs.mkdtempSync(path.join(os.tmpdir(), "goodissima-context-actions-"));
const chrome = process.env.GOODISSIMA_CHROME || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/chromium", "/usr/bin/google-chrome",
].find(file => fs.existsSync(file));
assert.ok(chrome, "Set GOODISSIMA_CHROME to a Chromium browser executable");

execFileSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "app/globals.css", "-o", path.join(output, "styles.css")], { stdio: "pipe" });
const files = ["OrganizationPanel", "ObjectActionRow", "WorkspaceRow", "SpacesTreeView", "WorkspaceDetailView", "SpacesExistingAttachments"];
const sources = Object.fromEntries(files.map(name => [`@/components/${name}`, `components/${name}.tsx`]));
sources["@/lib/boussole/navigation-disclosure"] = "lib/boussole/navigation-disclosure.ts";
sources["@/lib/spatial-navigation"] = "lib/spatial-navigation.ts";
sources["@/lib/object-creation"] = "lib/object-creation.ts";
sources["@/lib/unassigned-pagination"] = "lib/unassigned-pagination.ts";
const factories = Object.entries(sources).map(([id, file]) => `${JSON.stringify(id)}: function(module,exports,require) {\n${ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText}\n}`).join(",\n");
const react = fs.readFileSync(path.join(path.dirname(require.resolve("react")), "umd/react.development.js"), "utf8");
const reactDom = fs.readFileSync(path.join(path.dirname(require.resolve("react-dom")), "umd/react-dom.development.js"), "utf8");
const fixture = `
window.__qa={navigations:[],submissions:[],errors:[],favorites:{},favoriteChanges:[]};
addEventListener('error',e=>__qa.errors.push(e.message));
addEventListener('unhandledrejection',e=>__qa.errors.push(String(e.reason)));
document.addEventListener('submit',e=>{e.preventDefault();__qa.submissions.push(Object.fromEntries(new FormData(e.target)))});
const h=React.createElement;
const title='Objet avec un nom long '+ 'X'.repeat(120);
const workspace={id:'workspace',name:title,status:'ACTIVE',_count:{relationTemplates:1,links:1,relationCases:1}};
const date=new Date('2026-09-01');
const baseItem={id:'fixture',title,createdAt:date,href:'/links/fixture',gLinkTitle:'Lien parent de test'};
const page=items=>({items,hasMore:false});
const modules={
 'react':React,'react-dom':ReactDOM,
 'next/navigation':{useRouter:()=>({refresh(){}})},
 '@/lib/personal-favorites-actions':{
 getFavoriteState:async t=>({available:true,saved:Boolean(__qa.favorites[JSON.stringify(t)])}),
 addFavorite:async t=>{__qa.favorites[JSON.stringify(t)]=true;__qa.favoriteChanges.push(['add',t]);return {ok:true}},
 removeFavorite:async t=>{delete __qa.favorites[JSON.stringify(t)];__qa.favoriteChanges.push(['remove',t]);return {ok:true}}},
 'react/jsx-runtime':{jsx:(type,props,key)=>h(type,{...props,key}),jsxs:(type,props,key)=>h(type,{...props,key}),Fragment:React.Fragment},
 'next/link':({href,children,onClick,...props})=>h('a',{...props,href,onClick:e=>{onClick?.(e);e.preventDefault();__qa.navigations.push(href)}},children),
 '@/components/SpacesCreateActions':{SpacesCreateActions:()=>null},
 '@/components/WorkspaceCreateActions':{WorkspaceCreateActions:()=>null},
 '@/components/SpatialNavigationContext':{PageNavigationContext:()=>null},
 '@/lib/governance-portfolio-actions':{attachWorkspaceToPortfolioAction:'/fixture-portfolio'},
 '@/lib/governance-workspace-actions':{attachGLinkToWorkspaceAction:'/fixture-link',attachGovernedJourneyToWorkspaceAction:'/fixture-journey',attachRelationCaseToWorkspaceAction:'/fixture-case'},
 '@/lib/governance-workspace-repository':{
 getGovernanceWorkspaceOptions:async()=>location.search.includes('noWorkspace')?[]:[{id:'destination',name:'Destination active',categoryLabel:'Projet'}],
 getUnassignedGLinkSummaries:async()=>page([{...baseItem,id:'simple',objectLabel:'Lien simple'},{...baseItem,id:'opportunity',objectLabel:'Opportunité'}]),
 getUnassignedGovernedJourneySummaries:async()=>page([{...baseItem,relationTemplateId:'relation-journey',formTemplateId:'journey',href:'/gouvernance/parcours/journey/pilotage'}]),
 getUnassignedRelationCaseSummaries:async()=>page([{...baseItem,id:'case',href:'/cases/case'}])}
};
const factories={${factories}};
function require(id){if(modules[id])return modules[id];if(!factories[id])throw Error('Unknown dependency '+id);const m={exports:{}};factories[id](m,m.exports,require);return modules[id]=m.exports;}
(async()=>{
 const {SpacesTreeView}=require('@/components/SpacesTreeView');
 const {WorkspaceDetailView}=require('@/components/WorkspaceDetailView');
 const {SpacesExistingAttachments}=require('@/components/SpacesExistingAttachments');
 const unassigned=await SpacesExistingAttachments({ownerId:'fixture-owner'});
 const tree={portfolios:[{id:'portfolio',name:title,status:'ACTIVE',workspaces:[workspace]}],roots:[{...workspace,id:'root'}],unavailableParentCount:0};
 const detail={...workspace,ownerId:'fixture-owner',category:'PROJECT',kind:'MIXED',portfolio:null,description:null,
 relationTemplates:[{id:'template',name:title,status:'DRAFT',formTemplates:[{id:'form',name:title}]},{id:'no-form',name:'Sans formulaire',status:'DRAFT',formTemplates:[]}],
 links:[{id:'link',title,status:'ACTIVE',rules:{simpleLink:true}}],relationCases:[{id:'case',candidateName:title,status:'NEW',gLink:{title:'Lien'}}]};
 ReactDOM.createRoot(document.getElementById('root')).render(h('div',null,h('div',{id:'outside',tabIndex:0},'Hors des lignes'),h('main',{className:'mx-auto max-w-6xl px-4'},h(SpacesTreeView,{data:tree}),unassigned),h(WorkspaceDetailView,{workspace:detail,explorer:true})));
})();
`;
fs.writeFileSync(path.join(output, "fixture.html"), `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="styles.css"></head><body><div id="root"></div><script>${react}\n${reactDom}\n${fixture.replaceAll("</script", "<\\/script")}</script></body></html>`);

const server = createServer((request, response) => {
  const css = request.url?.split("?")[0].endsWith("/styles.css");
  response.setHeader("Content-Type", css ? "text/css" : "text/html; charset=utf-8");
  response.end(fs.readFileSync(path.join(output, css ? "styles.css" : "fixture.html")));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const proc = spawn(chrome, ["--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${path.join(output, "profile")}`], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
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
    const event = { key: name, code, windowsVirtualKeyCode: { Enter: 13, Escape: 27, Tab: 9, ArrowDown: 40, ArrowUp: 38, Home: 36, End: 35, " ": 32 }[name] };
    await send("Input.dispatchKeyEvent", { ...event, type: text ? "keyDown" : "rawKeyDown", text, unmodifiedText: text }, sessionId);
    await send("Input.dispatchKeyEvent", { ...event, type: "keyUp" }, sessionId);
  };
  const pause = () => new Promise(resolve => setTimeout(resolve, 80));
  const results=[];
  const click = async (selector, right=false, touch=false) => {
    const point=await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:${right} ? r.left+8 : r.right-20,y:r.top+Math.min(20,r.height/2)}})()`);
    if(touch){await send('Emulation.setTouchEmulationEnabled',{enabled:true},sessionId);await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]},sessionId);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]},sessionId);}
    else {await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:right?'right':'left',clickCount:1},sessionId);await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:right?'right':'left',clickCount:1},sessionId);}
    await pause();
  };
  const contextOnly = process.argv.includes('--context-only');
  for(const width of contextOnly ? [375] : [320,375,768,1024,1440]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false},sessionId);
    await send('Page.navigate',{url:origin},sessionId);
    for(let i=0;i<50 && !(await evaluate("document.querySelectorAll('[data-object-action-row]').length===10"));i++)await pause();
    assert.equal(await evaluate("document.querySelectorAll('[data-object-action-row]').length"),10);
    await evaluate("document.querySelectorAll('[data-object-action-row]').forEach((el,i)=>el.id='row-'+i)");
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`${width}: overflow`);
    for(let index=0;index<10;index++){
      const trigger=`#row-${index} > button[aria-haspopup]`;
      assert.equal(await evaluate(`document.querySelector(${JSON.stringify(trigger)}).getBoundingClientRect().height>=44`),true);
      await click(trigger);
      const before=await evaluate("({id:document.querySelector('[role=menu]')?.id,items:[...document.querySelectorAll('[role=menuitem]')].map(el=>el.textContent),nav:__qa.navigations.length})");
      const isUnassigned=await evaluate(`document.querySelector('#row-${index}').tagName==='ARTICLE'`);
      assert.deepEqual(before.items,isUnassigned?['Ouvrir','Rattacher à un Workspace','Ajouter aux favoris']:index===1?['Ouvrir','Déplacer vers un autre Portfolio…','Ajouter aux favoris']:index===2?['Ouvrir','Rattacher à un Portfolio…','Ajouter aux favoris']:['Ouvrir','Ajouter aux favoris']);
      assert.equal(before.nav,0,'trigger must not open the object');
      assert.equal(await evaluate("document.activeElement.getAttribute('role')"),'menuitem');
      assert.equal(await evaluate("(()=>{const r=document.querySelector('[role=menu]').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()"),true);
      await key('Escape');
      assert.equal(await evaluate(`document.activeElement===document.querySelector(${JSON.stringify(trigger)})`),true);
      await click(`#row-${index}`,true);
      const after=await evaluate("({id:document.querySelector('[role=menu]')?.id,items:[...document.querySelectorAll('[role=menuitem]')].map(el=>el.textContent),nav:__qa.navigations.length})");
      assert.deepEqual(after,before,`row ${index}: right-click must open the identical menu`);
      await key('End');await key('Enter');await pause();
      assert.equal(await evaluate('__qa.favoriteChanges.at(-1)[0]'),'add');
      await click(trigger);await key('End');
      assert.equal(await evaluate('document.activeElement.textContent'),'Retirer des favoris');
      await key('Enter');await pause();
      assert.equal(await evaluate('__qa.favoriteChanges.at(-1)[0]'),'remove');
    }
    if (contextOnly) { console.log('Right-click and button: identical menus on all 10 rows'); break; }
    assert.equal(await evaluate("(()=>{const e=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});document.querySelector('#outside').dispatchEvent(e);return e.defaultPrevented})()"),false);
    // Compact rows: no confirmation controls until their contextual action.
    assert.equal(await evaluate("[...document.querySelectorAll('#a-organiser select')].every(el=>!el.checkVisibility())"),true);
    for (const target of ["workspace-portfolio-root","workspace-portfolio-workspace","attach-journey-journey","attach-link-simple","attach-link-opportunity"]) {
      const ownerRow=await evaluate(`document.getElementById('${target}').closest('[data-object-action-row]').id`);
      await click(`#${ownerRow} > button[aria-haspopup]`);
      await key('ArrowDown');await key('Enter');await pause();
      assert.equal(await evaluate(`document.getElementById('${target}').closest('details').open`),true);
      assert.equal(await evaluate(`document.activeElement.closest('form').id`),target);
      assert.equal(await evaluate('__qa.submissions.length'),0);
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
      await evaluate(`[...document.getElementById('${target}').closest('details').querySelectorAll('button')].find(b=>b.textContent==='Annuler').click()`);
      assert.equal(await evaluate(`document.getElementById('${target}').closest('details').open`),false);
    }
    // Existing Boussole targets still reveal presentation only, including closed panels.
    assert.equal(await evaluate("require('@/lib/boussole/navigation-disclosure').isInClosedNavigationDisclosure(document.querySelector('#attach-journey-journey select'))"),true);
    await evaluate("require('@/lib/boussole/navigation-disclosure').revealNavigationDisclosure(document.querySelector('#attach-journey-journey select'))");
    assert.equal(await evaluate("document.querySelector('#attach-journey-journey select').checkVisibility()"),true);
    await evaluate("document.querySelector('#attach-journey-journey').closest('details').open=false");
    // Keyboard navigation and attachment of the case: confirmation is still the existing form.
    const caseRow=await evaluate("document.querySelector('form[id^=attach-case]').closest('article').id");
    await evaluate(`document.querySelector('#${caseRow} > button[aria-haspopup]').focus()`);
    await key('Enter');await pause();await key('ArrowDown');
    assert.equal(await evaluate('document.activeElement.textContent'),'Rattacher à un Workspace');
    await key('Home');assert.equal(await evaluate('document.activeElement.textContent'),'Ouvrir');
    await key('End');await key('ArrowUp');await key('Enter');await pause();
    assert.equal(await evaluate("document.activeElement.closest('form').id"),'attach-case-case');
    assert.equal(await evaluate('__qa.submissions.length'),0);
    assert.equal(await evaluate("(()=>{const form=document.querySelector('#attach-case-case');const warning=form.previousElementSibling;return warning.textContent.includes('lien parent') && Boolean(warning.compareDocumentPosition(form)&Node.DOCUMENT_POSITION_FOLLOWING) && warning.checkVisibility()})()"),true);
    await evaluate("document.activeElement.value='destination'");await key('Tab');await key('Enter');await pause();
    assert.equal(await evaluate('__qa.submissions.length'),1);
    assert.equal(await evaluate('__qa.submissions[0].attachmentMode'),'unassigned');
    await click(`#${caseRow} > button[aria-haspopup]`,false,true);
    assert.equal(await evaluate("document.querySelectorAll('[role=menuitem]').length"),3);
    await key('Escape');
    // Open the existing internal destination through the same menu.
    await click('#row-0 > button[aria-haspopup]');await key('Enter');await pause();
    assert.deepEqual(await evaluate('__qa.navigations'),['/gouvernance/portfolios/portfolio']);
    assert.deepEqual(await evaluate('__qa.errors'),[]);
    await evaluate('scrollTo(0,0)');
    fs.writeFileSync(path.join(output,`${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'},sessionId)).data,'base64'));
    results.push({width,rows:10,sameMenu:true,keyboard:true,touch:true,cascadeConfirmation:true});
  }
  if (!contextOnly) {
  await send('Page.navigate',{url:origin+'/?noWorkspace'},sessionId);
  for(let i=0;i<50 && !(await evaluate("Boolean(document.querySelector('#organize-no-destination'))"));i++)await pause();
  await click('article > button[aria-haspopup]');await key('End');await key('ArrowUp');await key('Enter');await pause();
  assert.equal(await evaluate('document.activeElement.id'),'organize-no-destination');
  assert.equal(await evaluate('__qa.submissions.length'),0);
  }
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify({output,results},null,2));
  await send('Browser.close');
} finally {
  socket?.close();proc.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));console.log(`Browser artifacts: ${output}`);
}
