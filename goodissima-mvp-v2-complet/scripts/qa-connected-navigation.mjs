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
const homeOnly = process.argv.includes("--home-only");
const require = createRequire(import.meta.url);
const output = fs.mkdtempSync(path.join(os.tmpdir(), "goodissima-navigation-"));
const chrome = process.env.GOODISSIMA_CHROME || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/chromium", "/usr/bin/google-chrome",
].find(file => fs.existsSync(file));
assert.ok(chrome, "Set GOODISSIMA_CHROME to a Chromium browser executable");

execFileSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "app/globals.css", "-o", path.join(output, "styles.css")], { stdio: "pipe" });
const files = ["ObjectActionRow", "FactualAttentionList", "DashboardHome", "ConnectedShell", "PlatformNavigation", "ActiveOrganizationBadge", "LanguageSwitcher", "LogoutButton", "ToastProvider", "GlobalLanguageSwitcher", "SpatialNavigationContext", "SpatialNavigationBar", "WorkspaceDetailView", "WorkspacePilotageView", "WorkspaceCreateActions", "SpacesTreeView", "SpacesCreateActions", "WorkspaceRow", "PortfolioExplorerView", "PortfolioOrganize", "WorkspaceCreationForm"];
const sources = Object.fromEntries(files.map(name => [`@/components/${name}`, `components/${name}.tsx`]));
sources["@/lib/boussole/navigation-disclosure"] = "lib/boussole/navigation-disclosure.ts";
sources["@/lib/spatial-navigation"] = "lib/spatial-navigation.ts";
sources["@/lib/boussole/portfolio-disclosure"] = "lib/boussole/portfolio-disclosure.ts";
sources["@/lib/object-creation"] = "lib/object-creation.ts";
sources["@/lib/connected-history"] = "lib/connected-history.ts";
const factories = Object.entries(sources).map(([id, file]) => `${JSON.stringify(id)}: function(module,exports,require) {\n${ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText}\n}`).join(",\n");
const react = fs.readFileSync(path.join(path.dirname(require.resolve("react")), "umd/react.development.js"), "utf8");
const reactDom = fs.readFileSync(path.join(path.dirname(require.resolve("react-dom")), "umd/react-dom.development.js"), "utf8");
const logo = `data:image/png;base64,${fs.readFileSync("public/logo-goodissima.png").toString("base64")}`;
const fixture = `
window.__qa = { path: location.pathname, navigations: [], errors: [], signOuts: 0, contexts: {} };
window.addEventListener('error', event => __qa.errors.push(event.message));
window.addEventListener('unhandledrejection', event => __qa.errors.push(String(event.reason)));
const h = React.createElement;
const LanguageContext = React.createContext(null);
function LanguageProvider({children}) {
  const [locale,setLocale] = React.useState('fr');
  return h(LanguageContext.Provider,{value:{locale,setLocale,t:key=>({'language.label':'Langue','language.fr':'FR','language.en':'EN','auth.logout':locale==='fr'?'Se déconnecter':'Sign out','auth.loggingOut':'…'})[key] || key}},children);
}
__qa.navigate = href => { __qa.navigations.push(href); history.pushState({fixture:true},'',href); __qa.path=location.pathname; dispatchEvent(new Event('qa-route')); };
addEventListener('popstate',()=>{__qa.path=location.pathname;dispatchEvent(new Event('qa-route'));});
const modules = {
  '@/lib/governance-workspace-actions': { createWorkspaceAction: '/qa-create-workspace' },
  '@/lib/governance-workspace-repository': { workspaceCategoryLabels: { PROFESSIONAL:'Professionnel', PRIVATE:'Prive', FAMILY:'Famille', ASSOCIATION:'Association', PROJECT:'Projet', CLIENT:'Client', OTHER:'Autre' }, workspaceKindLabels: { GOVERNANCE:'Gouvernance', RELATION:'Relation', MIXED:'Mixte' } },
  '@/lib/governance-portfolio-actions': { attachWorkspaceToPortfolioAction: '/qa-attach', detachWorkspaceFromPortfolioAction: '/qa-detach' },
  'react': React,
  'react-dom': ReactDOM,
  'react/jsx-runtime': { jsx:(type,props,key)=>h(type,{...props,key}), jsxs:(type,props,key)=>h(type,{...props,key}), Fragment:React.Fragment },
  'next/link': ({href,children,onClick,...props})=>h('a',{...props,href,onClick:event=>{onClick?.(event);event.preventDefault();__qa.navigate(href);}},children),
  'next/image': ({priority,...props})=>h('img',{...props,src:${JSON.stringify(logo)}}),
  'next/navigation': {
    usePathname:()=>React.useSyncExternalStore(callback=>{addEventListener('qa-route',callback);return()=>removeEventListener('qa-route',callback);},()=>__qa.path,()=>__qa.path),
    useSelectedLayoutSegment:()=>'(connected)',
    useRouter:()=>({refresh(){},replace:__qa.navigate,back:()=>history.back(),forward:()=>history.forward()})
  },
  '@/components/I18nProvider': {useI18n:()=>React.useContext(LanguageContext)},
  '@/lib/i18n-core': {supportedLocales:['fr','en']},
  '@/lib/supabase/client': {createClient:()=>({auth:{signOut:async()=>{__qa.signOuts++;}}})},
  '@/components/ContextualBoussole': {ContextualBoussole:()=>null}
};
const factories = {${factories}};
function require(id) { if(id in modules)return modules[id];if(!factories[id])throw Error('Unmapped module '+id);const module={exports:{}};modules[id]=module.exports;factories[id](module,module.exports,require);return module.exports; }
const {ConnectedShell}=require('@/components/ConnectedShell');
const {ToastProvider,useToast}=require('@/components/ToastProvider');
const {GlobalLanguageSwitcher}=require('@/components/GlobalLanguageSwitcher');
__qa.disclosure=require('@/lib/boussole/navigation-disclosure');
__qa.spatial=require('@/lib/spatial-navigation');
const {PageNavigationContext}=require('@/components/SpatialNavigationContext');
function WorkspaceFixture(){
  const href=React.useSyncExternalStore(callback=>{addEventListener('qa-route',callback);return()=>removeEventListener('qa-route',callback);},()=>location.href);
  const pilotage=h(require('@/components/WorkspacePilotageView').WorkspacePilotageView,{counts:{journeys:2,links:1,cases:1},data:{attention:[{type:'ACTION',label:'1 intervention humaine requise'}],signals:[{id:'signal',title:'Participant sans accès actif',subject:'Participant attendu pour une réunion avec un libellé métier particulièrement long',journey:'Parcours Contentieux',reason:'La participation nécessite un accès actif à vérifier dans le parcours.',actionLabel:'Ouvrir le parcours',href:'/gouvernance/parcours/technical-object-id/pilotage'}],upcoming:[{id:'meeting',title:'Réunion de suivi du parcours',context:'Parcours : Contentieux',scheduledAt:new Date('2026-10-01T12:00:00Z'),updatedAt:new Date('2026-09-06T12:00:00Z'),status:'PREPARED_NOT_STARTED',href:'/gouvernance/parcours/technical-object-id/pilotage'}],recent:[{id:'recent',title:'Communication récente',context:'Dossier : Contexte du dossier',updatedAt:new Date('2026-09-06T12:00:00Z'),status:'COMPLETED',href:'/cases/case'}]}});
  return h(require('@/components/WorkspaceDetailView').WorkspaceDetailView,{pilotage,explorer:new URL(href).searchParams.get('view')==='explorer',workspace:{id:'technical-workspace-id',ownerId:'owner',name:'Workspace Contentieux avec un nom volontairement très long pour vérifier la lecture sur mobile',description:'Description du contexte de travail',category:'PROJECT',kind:'GOVERNANCE',status:'ACTIVE',portfolio:{id:'technical-portfolio-id',name:'Portfolio Europe',ownerId:'owner'},relationTemplates:[{id:'journey',name:'Parcours',status:'DRAFT',formTemplates:[{id:'technical-object-id',name:'Parcours avec un titre particulièrement long pour vérifier le retour à la ligne'}]},{id:'unopenable',name:'Parcours sans formulaire',status:'DRAFT',formTemplates:[]}],links:[{id:'link',title:'Lien '+ 'X'.repeat(120),status:'ACTIVE'}],relationCases:[{id:'case',candidateName:'Candidat',status:'WAITING_CANDIDATE',gLink:{title:'Lien du dossier'}}]}});
}

__qa.portfolioDisclosure=require('@/lib/boussole/portfolio-disclosure');
function SpacesFixture(){
 const workspace={id:'spaces-workspace',name:'Workspace accompagnement des projets internationaux et des dossiers clients '.repeat(2),status:'ACTIVE',_count:{relationTemplates:2,links:3,relationCases:4}};
 const data={portfolios:Array.from({length:6},(_,i)=>({id:'spaces-portfolio-'+i,name:'Portfolio '+i+' suivi des projets internationaux et des dossiers clients '.repeat(2),status:i===2?'ARCHIVED':'ACTIVE',workspaces:i===1?[workspace]:[]})),roots:[{...workspace,id:'spaces-root',name:'Workspace personnel'}],unavailableParentCount:0};
 return h('main',{className:'mx-auto min-w-0 max-w-6xl px-4 py-8 sm:px-6'},h('h1',{className:'text-3xl font-bold'},'Mes espaces'),h(require('@/components/SpacesCreateActions').SpacesCreateActions),h(require('@/components/SpacesTreeView').SpacesTreeView,{data}));
}


function PortfolioFixture(){
 const workspace={id:'portfolio-child',name:'Workspace accompagnement des projets internationaux '.repeat(3),status:'ACTIVE',_count:{relationTemplates:1,links:2,relationCases:3,communicationSessions:4}};
 const portfolio={id:'portfolio-explorer-test',name:'Portfolio Europe projets internationaux '.repeat(3),status:'ACTIVE',kind:'PROJECT',slug:'europe-'+'x'.repeat(140),createdAt:new Date('2026-01-01'),description:'Description du Portfolio',workspaces:[workspace,{...workspace,id:'portfolio-child-two',status:'ARCHIVED'}]};
 const organize=h(require('@/components/PortfolioOrganize').PortfolioOrganize,{portfolio,available:[{id:'available-workspace',name:'Workspace disponible '.repeat(8)}]});
 return h(require('@/components/PortfolioExplorerView').PortfolioExplorerView,{portfolio,kindLabel:'Projet',organize});
}

function WorkspaceCreationFixture(){
 const href=React.useSyncExternalStore(callback=>{addEventListener('qa-route',callback);return()=>removeEventListener('qa-route',callback);},()=>location.href,()=>location.href);
 const portfolio=new URL(href).searchParams.has('portfolioId')?{id:'portfolio-explorer-test',name:'Portfolio Europe accompagnement des projets internationaux '.repeat(3)}:null;
 return h(require('@/components/WorkspaceCreationForm').WorkspaceCreationForm,{portfolio});
}
function Content(){const toast=useToast();const pathname=modules['next/navigation'].usePathname();if(pathname==='/dashboard' && location.search.includes('home='))return h(require('@/components/DashboardHome').DashboardHome,{favorites:location.search.includes('home=populated')?Array.from({length:5},(_,i)=>({objectKind:'PORTFOLIO',objectId:'p-'+i,label:'Portfolio',title:'Un favori '+ 'X'.repeat(160),href:'/gouvernance/portfolios/p-'+i})):[],attention:{items:location.search.includes('home=populated')?Array.from({length:3},(_,i)=>({id:'c-'+i,type:'WAITING_OWNER',object:'Dossier',label:'Un dossier '+ 'X'.repeat(100),reason:'En attente propriétaire',href:'/cases/c-'+i})):[],hasMore:false},activity:location.search.includes('home=populated')?Array.from({length:5},(_,i)=>({id:'event-'+i,label:['Lien créé','Dossier ouvert','Document déposé'][i%3],context:'Un contexte métier '+ 'X'.repeat(160),date:new Date('2026-09-01T12:00:00Z'),href:i===0?'/links/real-link':'/cases/real-case'})):[]});if(pathname==='/gouvernance/workspaces/nouveau')return h(WorkspaceCreationFixture);if(pathname==='/gouvernance/portfolios/portfolio-explorer-test')return h(PortfolioFixture);if(pathname==='/gouvernance')return h(SpacesFixture);if(pathname==='/gouvernance/workspaces/technical-workspace-id')return h(WorkspaceFixture);return h('main',{className:'px-4 py-8'},__qa.contexts[pathname]?h(PageNavigationContext,{pathname,items:__qa.contexts[pathname]}):null,h('h1',null,'Contenu métier'),h('button',{id:'toast-test',onClick:()=>toast.success('Notification de test')},'Tester la notification'));}
function App(){const pathname=modules['next/navigation'].usePathname();return __qa.spatial.isConnectedPathname(pathname)?h(ConnectedShell,{organizationName:'Organisation Goodissima avec un nom volontairement très long pour vérifier la troncature'},h(Content)):h('main',null,'Surface exclue');}
ReactDOM.createRoot(document.getElementById('root')).render(h(LanguageProvider,null,h(ToastProvider,null,h(App),h(GlobalLanguageSwitcher))));
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
    const event = { key: name, code, windowsVirtualKeyCode: { Enter: 13, Escape: 27, Tab: 9, " ": 32 }[name] };
    await send("Input.dispatchKeyEvent", { ...event, type: text ? "keyDown" : "rawKeyDown", text, unmodifiedText: text }, sessionId);
    await send("Input.dispatchKeyEvent", { ...event, type: "keyUp" }, sessionId);
  };
  const pause = () => new Promise(resolve => setTimeout(resolve, 80));
  const results = [];
  for (const width of [320, 375, 768, 1024, 1440]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    await send("Page.navigate", { url: `${origin}/dashboard` }, sessionId);
    for (let tries = 0; tries < 50 && !(await evaluate("Boolean(document.querySelector('nav'))")); tries++) await pause();
    await pause();
    const metrics = await evaluate(`(() => {const header=document.querySelector('header'),nav=document.querySelector('nav');return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,headerHeight:header.getBoundingClientRect().height,navigations:document.querySelectorAll('nav[aria-label="Navigation principale"]').length,doors:[...nav.querySelectorAll('a')].map(a=>({href:a.getAttribute('href'),visible:a.checkVisibility(),fits:a.scrollWidth<=a.clientWidth})),userVisible:document.querySelector('summary').checkVisibility()}})()`);
    assert.equal(metrics.scrollWidth, width, "document overflow");
    assert.equal(metrics.navigations, 1);
    assert.ok(metrics.headerHeight <= (width >= 1024 ? 70 : 120), "header must fit one desktop row / two mobile rows");
    assert.ok(metrics.userVisible);
    assert.deepEqual(metrics.doors.map(x => x.href), ["/boussole/decouverte", "/annuaire", "/gouvernance"]);
    assert.ok(metrics.doors.every(x => x.visible && x.fits), JSON.stringify(metrics));

    if (homeOnly) {
      for (const [href, label] of [["/favoris", "Favoris"], ["/recherche", "Recherche Goodissima"]]) {
        await evaluate(`document.querySelector('a[aria-label="${label}"]').focus()`);
        assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineStyle"), "solid");
        await key("Enter"); await pause();
        assert.equal(await evaluate("location.pathname"), href);
      }
      await evaluate("__qa.navigate('/dashboard')"); await pause();
      await evaluate("document.querySelector('summary').focus()");
      await key("Enter"); await pause();
      assert.equal(await evaluate("document.querySelector('details').open"), true);
      await key("Tab");
      assert.equal(await evaluate("document.activeElement.getAttribute('href')"), "/identity");
      assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineStyle"), "solid");
      const menu = await evaluate(`(()=>{const m=document.querySelector('[aria-label="Compte"]');const r=m.getBoundingClientRect();return {text:m.textContent,links:[...m.querySelectorAll('a')].map(a=>a.getAttribute('href')),left:r.left,right:r.right}})()`);
      assert.deepEqual(menu.links, ["/identity", "/administration"]);
      assert.ok(menu.text.includes("Mon profil") && !menu.text.includes("Autres accès"));
      assert.ok(menu.left >= 0 && menu.right <= width);
      await key("Escape");
      assert.equal(await evaluate("!document.querySelector('details').open && document.activeElement===document.querySelector('summary')"), true);
      for (const state of ["empty", "populated"]) {
        await send("Page.navigate", { url: `${origin}/dashboard?home=${state}` }, sessionId);
        for (let tries=0; tries<50 && !(await evaluate("Boolean(document.querySelector('#dashboard-favorites-title'))")); tries++) await pause();
        await pause();
        const home = await evaluate(`(()=>{const f=document.querySelector('[aria-labelledby="dashboard-favorites-title"]'),a=document.querySelector('[aria-labelledby="dashboard-attention-title"]');return {overflow:document.documentElement.scrollWidth>innerWidth,favorites:f.querySelectorAll('li').length,alerts:a.querySelectorAll('li').length,text:document.querySelector('main').textContent,headings:[...document.querySelectorAll('main h2')].map(h=>h.textContent),all:[...document.querySelectorAll('main a')].every(a=>a.getAttribute('href').startsWith('/'))}})()`);
        assert.equal(home.overflow, false);
        assert.equal(home.favorites, state==="empty"?0:5);
        assert.equal(home.alerts, state==="empty"?0:3);
        assert.ok(home.all);
        assert.ok(home.text.includes("Bien démarrer"));
        if(state==="empty") assert.ok(home.text.includes("Rien ne nécessite actuellement votre attention.") && home.text.includes("menu •••"));
        assert.ok(home.headings[1].includes("À votre attention") && home.headings[2].includes("Favoris"));
        const shot = await send("Page.captureScreenshot", {format:"png", captureBeyondViewport:true}, sessionId);
        fs.writeFileSync(path.join(output, `${width}-home-${state}.png`), Buffer.from(shot.data,"base64"));
        assert.deepEqual(await evaluate("__qa.errors"), []);
      }
      results.push({width, home:"passed", keyboard:"passed", menu:"passed"});
      continue;
    }

    const historyState = () => evaluate(`({back:!document.querySelector('button[aria-label^="Retour"]').disabled,forward:!document.querySelector('button[aria-label^="Suivant"]').disabled})`);
    const go = async href => { await evaluate(`__qa.navigate(${JSON.stringify(href)})`); await pause(); };
    const traverse = async label => { await evaluate(`document.querySelector('button[aria-label^="${label}"]').click()`); await pause(); };
    assert.deepEqual(await historyState(), { back: false, forward: false }, "direct arrival");
    await go("/annuaire");
    assert.deepEqual(await historyState(), { back: true, forward: false });
    await traverse("Retour");
    assert.equal(await evaluate("location.pathname"), "/dashboard");
    assert.deepEqual(await historyState(), { back: false, forward: true });
    await traverse("Suivant");
    assert.equal(await evaluate("location.pathname"), "/annuaire");
    await traverse("Retour");
    await go("/gouvernance");
    assert.deepEqual(await historyState(), { back: true, forward: false }, "branch after back");
    await go("/dashboard");

    // Real keyboard activation of the native user disclosure, then Escape.
    await evaluate("document.querySelector('summary').focus()");
    await key("Enter");
    await pause();
    assert.equal(await evaluate("document.querySelector('details').open"), true, await evaluate("JSON.stringify({active:document.activeElement.outerHTML,focus:document.hasFocus(),errors:__qa.errors})"));
    assert.equal(await evaluate("document.querySelector('a[href=\"/identity\"]').checkVisibility()"), true);
    await key("Tab");
    assert.equal(await evaluate("document.activeElement.getAttribute('href')"), "/identity");
    assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineStyle"), "solid");
    await key("Escape");
    assert.equal(await evaluate("!document.querySelector('details').open && document.activeElement===document.querySelector('summary')"), true);
    await key(" ", "Space");
    await pause();
    assert.equal(await evaluate("document.querySelector('details').open"), true);
    assert.equal(await evaluate("[...document.querySelectorAll('details a')].length"), 2);
    assert.equal(await evaluate("[...document.querySelectorAll('details a')].every(a=>a.checkVisibility())"), true);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), true);
    const menuBounds = await evaluate("(()=>{const r=document.querySelector('[aria-label=\"Compte et autres accès\"]').getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom}})()");
    assert.ok(menuBounds.left >= 0 && menuBounds.right <= width && menuBounds.bottom <= 900);
    const menuScreenshot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
    fs.writeFileSync(path.join(output, `${width}-menu.png`), Buffer.from(menuScreenshot.data, "base64"));

    // Selecting the profile closes the simplified account panel.
    await evaluate("document.querySelector('a[href=\"/identity\"]').click()");
    await pause();
    assert.equal(await evaluate("__qa.path"), "/identity");
    assert.equal(await evaluate("document.querySelector('details').open"), false);

    // Boussole opens only presentation disclosures around the real link.
    assert.equal(await evaluate("__qa.disclosure.isInClosedNavigationDisclosure(document.querySelector('a[href=\"/identity\"]'))"), true);
    const navigationCount = await evaluate("__qa.navigations.length");
    await evaluate("__qa.disclosure.revealNavigationDisclosure(document.querySelector('a[href=\"/identity\"]'))");
    assert.equal(await evaluate("[...document.querySelectorAll('details')].every(d=>d.open)"), true);
    assert.equal(await evaluate("__qa.navigations.length"), navigationCount);
    await key("Escape");

    for (const href of ["/boussole/decouverte", "/annuaire", "/gouvernance", "/dashboard"]) {
      await evaluate(`document.querySelector('a[href="${href}"]').click()`);
      await pause();
      assert.equal(await evaluate("__qa.path"), href);
    }
    await evaluate("document.querySelector('summary').click()");
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='EN').click()");
    await pause();
    assert.equal(await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent==='Sign out')"), true);
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Sign out').click()");
    await pause();
    assert.equal(await evaluate("__qa.signOuts"), 1);
    assert.equal(await evaluate("__qa.path"), "/login");
    assert.equal(await evaluate("document.querySelector('[aria-label=\"Navigation spatiale\"]')"), null);
    await evaluate("__qa.navigate('/dashboard')");
    await pause();
    assert.deepEqual(await historyState(), { back: false, forward: false }, "return from an excluded surface");
    await evaluate("document.querySelector('#toast-test').click()");
    await pause();
    assert.equal(await evaluate("document.querySelector('[role=status]').getBoundingClientRect().bottom <= document.querySelector('header').getBoundingClientRect().top"), true);
    assert.deepEqual(await evaluate("__qa.errors"), []);
    const screenshot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
    fs.writeFileSync(path.join(output, `${width}.png`), Buffer.from(screenshot.data, "base64"));

    const objectPath = "/gouvernance/parcours/technical-object-id/pilotage";
    await evaluate(`__qa.contexts[${JSON.stringify(objectPath)}]=__qa.spatial.objectBreadcrumb({name:'Parcours Martin avec un titre métier volontairement très long pour éprouver le fil d’Ariane sur mobile',fallback:'Parcours gouverné',objectId:'technical-object-id',ownerId:'owner',workspace:{id:'technical-workspace-id',name:'Workspace Contentieux',ownerId:'owner',portfolio:{id:'technical-portfolio-id',name:'Portfolio Europe',ownerId:'owner'}}});__qa.contexts['/gouvernance/portfolios/technical-portfolio-id']=__qa.spatial.portfolioBreadcrumb({id:'technical-portfolio-id',name:'Portfolio Europe'})`);
    await go(objectPath);
    assert.equal(await evaluate("document.querySelector('a[aria-label^=\"Remonter\"]').getAttribute('href')"), "/gouvernance/workspaces/technical-workspace-id");
    const crumbText = await evaluate("document.querySelector('nav[aria-label=\"Fil d’Ariane\"]').textContent");
    assert.ok(crumbText.includes("Portfolio Europe") && crumbText.includes("Workspace Contentieux") && crumbText.includes("Parcours Martin"));
    assert.ok(!crumbText.includes("technical-"));
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), true);
    assert.equal(await evaluate("document.querySelector('nav[aria-label=\"Fil d’Ariane\"] [aria-current=page]').textContent.startsWith('Parcours Martin')"), true);
    if (width < 768) {
      await evaluate("document.querySelector('summary[aria-label=\"Afficher les niveaux intermédiaires\"]').click()");
      assert.equal(await evaluate("document.querySelector('nav[aria-label=\"Fil d’Ariane\"] details a').checkVisibility()"), true);
      assert.equal(await evaluate("document.querySelector('nav[aria-label=\"Fil d’Ariane\"] details').textContent.includes('Workspace Contentieux')"), true);
      await evaluate("document.querySelector('nav[aria-label=\"Fil d’Ariane\"] summary').focus()");
      await key("Escape");
      assert.equal(await evaluate("document.querySelector('nav[aria-label=\"Fil d’Ariane\"] details').open"), false);
    }
    const spatialHeight = await evaluate("document.querySelector('[aria-label=\"Navigation spatiale\"]').getBoundingClientRect().height");
    assert.ok(spatialHeight <= (width >= 1024 ? 65 : 100));
    const objectScreenshot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
    fs.writeFileSync(path.join(output, `${width}-breadcrumb.png`), Buffer.from(objectScreenshot.data, "base64"));
    await evaluate("document.querySelector('a[aria-label^=\"Remonter\"]').click()");
    await pause();
    assert.equal(await evaluate("location.pathname"), "/gouvernance/workspaces/technical-workspace-id");
    assert.equal(await evaluate("document.querySelector('a[aria-label^=\"Remonter\"]').getAttribute('href')"), "/gouvernance/portfolios/technical-portfolio-id");
    assert.ok(await evaluate("document.querySelector('main').textContent.includes('À examiner')"));
    assert.ok(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), "Workspace Piloter overflow");
    await evaluate("document.querySelector('[data-workspace-create] summary').focus()");
    await key("Enter"); await pause();
    assert.equal(await evaluate("document.querySelector('[data-workspace-create]').open"), true);
    assert.ok(await evaluate("[...document.querySelectorAll('[data-workspace-create] a')].every(a=>a.checkVisibility() && a.getBoundingClientRect().right<=innerWidth)"));
    await key("Tab");
    assert.equal(await evaluate("document.activeElement.getAttribute('href')"), "/links/simple?workspaceId=technical-workspace-id");
    assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineStyle"), "solid");
    await key("Escape"); await pause();
    assert.equal(await evaluate("!document.querySelector('[data-workspace-create]').open && document.activeElement===document.querySelector('[data-workspace-create] summary')"), true);
    await key("Enter"); await pause();
    await evaluate("document.querySelector('h1').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
    assert.equal(await evaluate("document.querySelector('[data-workspace-create]').open"), false);
    await evaluate("document.querySelector('[data-workspace-create] summary').click()");
    await evaluate("document.querySelector('[data-workspace-create] a').focus()");
    await key("Enter"); await pause();
    assert.equal(await evaluate("location.pathname+location.search"), "/links/simple?workspaceId=technical-workspace-id");
    await traverse("Retour");
    assert.equal(await evaluate("location.pathname"), "/gouvernance/workspaces/technical-workspace-id");
    assert.ok(await evaluate("[...document.querySelectorAll('main a:not([data-workspace-create] a)')].every(a=>a.checkVisibility() && a.getBoundingClientRect().right<=innerWidth)"));
    await evaluate("document.querySelector('#attention a').focus()");
    assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineStyle"), "solid");
    const pilotageScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, sessionId);
    fs.writeFileSync(path.join(output, `${width}-pilotage.png`), Buffer.from(pilotageScreenshot.data, "base64"));
    await evaluate("document.querySelector('nav[aria-label=\"Vues du Workspace\"] a[href*=explorer]').click()");
    await pause();
    assert.equal(await evaluate("location.search"), "?view=explorer");
    assert.equal(await evaluate("document.querySelectorAll('section[aria-label=\"Objets directement rattachés\"] li').length"), 4);
    assert.ok(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), "Workspace Explorer overflow");
    assert.ok(await evaluate("[...document.querySelectorAll('main a:not([data-workspace-create] a)')].every(a=>a.checkVisibility() && a.getBoundingClientRect().right<=innerWidth)"));
    const workspaceScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, sessionId);
    fs.writeFileSync(path.join(output, `${width}-workspace.png`), Buffer.from(workspaceScreenshot.data, "base64"));
    await traverse("Retour");
    assert.equal(await evaluate("location.search"), "");
    assert.ok(await evaluate("document.querySelector('main').textContent.includes('À examiner')"));
    await traverse("Suivant");
    assert.equal(await evaluate("location.search"), "?view=explorer");
    await evaluate("document.querySelector('a[href=\"/gouvernance/parcours/technical-object-id/pilotage\"]').click()");
    await pause();
    assert.equal(await evaluate("location.pathname"), objectPath);
    await evaluate("document.querySelector('a[aria-label=\"Accueil Goodissima\"]').click()");
    await pause();
    assert.equal(await evaluate("location.pathname"), "/dashboard");
    for (const excluded of ["/secure/token-not-to-store", "/l/technical-slug", "/l/technical-slug/confirmation", "/gouvernance/invitation/token-not-to-store"]) {
      await go(excluded);
      assert.equal(await evaluate("document.querySelector('[data-connected-shell]')"), null);
      await go("/dashboard");
      assert.deepEqual(await historyState(), { back: false, forward: false });
    }

    await go('/gouvernance');
    assert.equal(await evaluate("document.querySelector('h1').textContent"), 'Mes espaces');
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), true, 'Spaces overflow');
    const branchButton = "document.querySelectorAll('[data-boussole-portfolio] button')[1]";
    const startNavigations = await evaluate('__qa.navigations.length');
    assert.equal(await evaluate(branchButton+".getAttribute('aria-expanded')"), 'false');
    await evaluate(branchButton+'.focus()'); await key('Enter'); await pause();
    assert.equal(await evaluate(branchButton+".getAttribute('aria-expanded')"), 'true');
    assert.equal(await evaluate('getComputedStyle(document.activeElement).outlineStyle'), 'solid');
    await key('Enter'); await pause();
    assert.equal(await evaluate(branchButton+".getAttribute('aria-expanded')"), 'false');
    assert.equal(await evaluate('__qa.navigations.length'), startNavigations);
    assert.equal(await evaluate("__qa.portfolioDisclosure.isInClosedPortfolio(document.querySelector('[data-boussole-id=governance-first-workspace]'))"), true);
    await evaluate("__qa.portfolioDisclosure.revealPortfolio(document.querySelector('[data-boussole-id=governance-first-workspace]'))");
    assert.equal(await evaluate(branchButton+".getAttribute('aria-expanded')"), 'true');
    assert.equal(await evaluate("document.querySelector('[data-boussole-id=governance-first-workspace]').checkVisibility()"), true);
    assert.equal(await evaluate('__qa.navigations.length'), startNavigations);
    await evaluate("document.querySelector('[data-spaces-create] summary').focus()"); await key('Enter'); await pause();
    assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-spaces-create] a')].map(a=>a.getAttribute('href'))"), ['/gouvernance/portfolios/nouveau','/gouvernance/workspaces/nouveau','/links/simple','/opportunities/new','/gouvernance/nouveau']);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), true);
    await key('Tab'); assert.equal(await evaluate("document.activeElement.getAttribute('href')"), '/gouvernance/portfolios/nouveau');
    await key('Escape'); assert.equal(await evaluate("document.querySelector('[data-spaces-create]').open"), false);
    const spacesScreenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true},sessionId);
    fs.writeFileSync(path.join(output, width+'-spaces.png'),Buffer.from(spacesScreenshot.data,'base64'));
    await evaluate("document.querySelector('a[href=\"/gouvernance/workspaces/spaces-workspace\"]').click()"); await pause();
    assert.equal(await evaluate('location.pathname'), '/gouvernance/workspaces/spaces-workspace');
    await traverse('Retour'); assert.equal(await evaluate('location.pathname'), '/gouvernance');
    await evaluate("document.querySelector('a[href=\"/gouvernance/portfolios/spaces-portfolio-0\"]').click()"); await pause();
    assert.equal(await evaluate('location.pathname'), '/gouvernance/portfolios/spaces-portfolio-0');
    await traverse('Retour'); await go('/dashboard');


    await go('/gouvernance/portfolios/portfolio-explorer-test');
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, 'Portfolio closed overflow');
    assert.equal(await evaluate("document.querySelector('[data-portfolio-organize]').open"), false);
    assert.equal(await evaluate("document.querySelector('[data-portfolio-information]').open"), false);
    const portfolioHistory = await evaluate('__qa.navigations.length');
    await evaluate("window.__qa.portfolioSubmits=0;document.addEventListener('submit',event=>{event.preventDefault();__qa.portfolioSubmits++;});document.querySelector('[data-portfolio-organize] summary').focus()");
    await key('Enter'); await pause();
    assert.equal(await evaluate("document.querySelector('[data-portfolio-organize]').open"), true);
    assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineStyle"), 'solid');
    assert.equal(await evaluate("document.querySelectorAll('[data-portfolio-organize] form').length"), 3);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, 'Portfolio Organiser overflow');
    assert.equal(await evaluate('__qa.navigations.length'), portfolioHistory);
    assert.equal(await evaluate('__qa.portfolioSubmits'), 0);
    await key('Enter'); await pause();
    await evaluate("document.querySelector('[data-portfolio-information] summary').focus()");await key('Enter');await pause();
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, 'Portfolio information overflow');
    await key('Enter'); await pause();
    const portfolioScreenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true},sessionId);
    fs.writeFileSync(path.join(output,width+'-portfolio.png'),Buffer.from(portfolioScreenshot.data,'base64'));
    await evaluate("document.querySelector('a[href=\"/gouvernance/workspaces/portfolio-child\"]').click()");await pause();
    assert.equal(await evaluate('location.pathname'),'/gouvernance/workspaces/portfolio-child');
    await traverse('Retour');
    await evaluate("document.querySelector('[data-boussole-id=portfolio-open-pilotage]').click()");await pause();
    assert.equal(await evaluate('location.pathname'),'/gouvernance/portfolios/portfolio-explorer-test/pilotage');
    await traverse('Retour');await go('/dashboard');


    await go('/gouvernance/portfolios/portfolio-explorer-test');
    await evaluate("document.querySelector('[data-spaces-create] summary').focus()"); await key('Enter');await pause();
    assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-spaces-create] a')].map(a=>a.getAttribute('href'))"), ['/gouvernance/workspaces/nouveau?portfolioId=portfolio-explorer-test']);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, 'Portfolio create menu overflow');
    await key('Tab'); await key('Enter');await pause();
    assert.equal(await evaluate('location.pathname+location.search'), '/gouvernance/workspaces/nouveau?portfolioId=portfolio-explorer-test');
    assert.equal(await evaluate("document.querySelector('input[name=portfolioId]').value"), 'portfolio-explorer-test');
    assert.equal(await evaluate("document.querySelector('section[aria-label=Portfolio]').textContent.includes('Portfolio Europe')"), true);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, 'Contextual form overflow');
    assert.equal(await evaluate("document.querySelector('input[name=name]').checkValidity()"), false);
    await evaluate("document.querySelector('input[name=name]').focus()");await key('Tab');
    assert.equal(await evaluate('document.activeElement.name'),'description');
    await evaluate("document.querySelector('input[name=name]').value='Nouveau Workspace';window.__qa.createdForm=null;document.addEventListener('submit',event=>{event.preventDefault();if(event.target.getAttribute('action')==='/qa-create-workspace')__qa.createdForm=Object.fromEntries(new FormData(event.target));});document.querySelector('form button[type=submit]').focus()");
    const formScreenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true},sessionId);
    fs.writeFileSync(path.join(output,width+'-workspace-create.png'),Buffer.from(formScreenshot.data,'base64'));
    await key('Enter');await pause();
    assert.equal(await evaluate('__qa.createdForm.portfolioId'), 'portfolio-explorer-test');
    assert.equal(await evaluate('__qa.createdForm.name'), 'Nouveau Workspace');
    await go('/gouvernance/workspaces/nouveau');
    assert.equal(await evaluate("document.querySelector('input[name=portfolioId]')===null"), true);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, 'Global form overflow');
    await go('/dashboard');

    for (const state of ['empty','populated']) {
      await send('Page.navigate',{url:origin+'/dashboard?home='+state},sessionId);
      for(let retry=0;retry<50 && !(await evaluate("Boolean(document.querySelector('nav[aria-label=\"Choisir une destination\"]'))"));retry++)await pause();
      await pause();
      const home=await evaluate(`(() => {const main=document.querySelector('main');return {title:main.querySelector('h1').textContent,overflow:document.documentElement.scrollWidth>innerWidth,events:main.querySelectorAll('time').length,doors:[...main.querySelectorAll('nav a')].map(a=>a.getAttribute('href')),scrolling:[...main.querySelectorAll('*')].some(e=>['auto','scroll'].includes(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight)}})()`);
      assert.equal(home.title,'Accueil');assert.equal(home.overflow,false);assert.equal(home.scrolling,false);
      assert.equal(home.events,state==='empty'?0:5);
      assert.deepEqual(home.doors,['/boussole/decouverte','/annuaire','/gouvernance']);
      await evaluate("document.querySelector('main nav a').focus()");await key('Tab');
      assert.equal(await evaluate("document.activeElement.getAttribute('href')"),'/annuaire');
      assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineStyle !== 'none'"),true);
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true},sessionId);
      fs.writeFileSync(path.join(output,width+'-home-'+state+'.png'),Buffer.from(shot.data,'base64'));
      await key('Enter');await pause();assert.equal(await evaluate('location.pathname'),'/annuaire');
      assert.deepEqual(await evaluate('__qa.errors'),[]);
    }
    results.push({ dashboardHome: "pass", workspaceCreation: "pass", portfolio: "pass", spaces: "pass", ...metrics, spatialHeight, keyboard: "pass", disclosures: "pass", navigation: "pass", nativeHistory: "pass", breadcrumb: "pass", exclusions: "pass", languageAndLogout: "pass", toast: "pass" });
  }
  if (!homeOnly) {
  const newTab = await send("Target.createTarget", { url: `${origin}/annuaire?token=never-show-this` });
  const attached = await send("Target.attachToTarget", { targetId: newTab.targetId, flatten: true });
  let tabResult;
  for (let retry = 0; retry < 50; retry++) {
    tabResult = await send("Runtime.evaluate", { expression: `document.querySelector('[aria-label="Navigation spatiale"]') ? {disabled:[...document.querySelectorAll('[aria-label="Déplacements"] button')].every(button=>button.disabled),text:document.querySelector('nav[aria-label="Fil d’Ariane"]').textContent} : null`, returnByValue: true }, attached.sessionId);
    if (tabResult.result.value) break;
    await pause();
  }
  assert.ok(tabResult.result.value.disabled, "new tab does not know a back or forward entry");
  assert.ok(!tabResult.result.value.text.includes("never-show-this"));
  await send("Target.closeTarget", { targetId: newTab.targetId });
  }
  fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ output, results }, null, 2));
  await send("Browser.close");
} finally {
  socket?.close();
  proc.kill();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  console.log(`Browser artifacts: ${output}`);
}
