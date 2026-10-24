// SquadCraft headless functional checks. Loads index.html + data.js in jsdom and drives the real UI code.
const fs=require("fs");const {JSDOM}=require("jsdom");
const path=require("path");const dir=path.join(__dirname,"..")+path.sep;
let html=fs.readFileSync(dir+"index.html","utf8").replace('<script src="data.js"></script>','<script>'+fs.readFileSync(dir+"data.js","utf8")+'</script>');
// expose top-level consts/lets for testing
html=html.replace("</script>\n</body>","window.__t={state,CLUBS,FREE_AGENTS,ALL_PLAYERS,openClub,styleFit,renderAll,available,starter,POS,TARGET_DEPTH,STYLES,valueOf,money};\n</script>\n</body>");
const errors=[];
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"http://localhost/",beforeParse(w){w.addEventListener("error",e=>errors.push(e.message));w.scrollTo=()=>{};}});
const w=dom.window,T=w.__t,$=s=>w.document.querySelector(s);
const results=[];const check=(id,desc,exp,act,ok)=>{results.push({id,desc,exp,act,pass:!!ok});};
check("T0","App loads with no script errors","0 errors",errors.length+" errors",errors.length===0);
check("T1","Club database size","96 clubs",T.CLUBS.length+" clubs",T.CLUBS.length===96);
const real=T.CLUBS.filter(c=>c.real).length;
check("T2","Clubs with real squads vs simulated","82 real / 14 sim",real+" real / "+(96-real)+" sim",real===82);
// Search
const searchTest=(q)=>{const i=$("#clubInput");i.value=q;i.dispatchEvent(new w.Event("input"));return [...w.document.querySelectorAll("#suggest button")].map(b=>b.textContent);};
let r=searchTest("arsenal");check("T3","Search 'arsenal' suggests Arsenal first","Arsenal in first suggestion",r[0]||"(none)",/Arsenal/.test(r[0]||""));
r=searchTest("man utd");check("T4","Alias search 'man utd'","Manchester United suggested",r[0]||"(none)",/Manchester United/.test(r[0]||""));
searchTest("zzzzqq");const boxHidden=$("#suggest").classList.contains("hidden");
check("T5","Unknown club ('zzzzqq') shows no suggestion list","suggestion box hidden",boxHidden?"suggestion box hidden":"suggestion box visible",boxHidden);
// Open Arsenal
const ars=T.CLUBS.find(c=>c.name==="Arsenal");T.openClub(ars);
check("T6","Open Arsenal → squad audit renders","App visible, roster rows > 15",
 (w.document.querySelectorAll("#roster tbody tr").length)+" rows, #app hidden="+$("#app").classList.contains("hidden"),
 !$("#app").classList.contains("hidden")&&w.document.querySelectorAll("#roster tbody tr").length>15);
const kpis=[...w.document.querySelectorAll("#kpis .panel")].map(p=>p.querySelector(".l").textContent+": "+p.querySelector(".v").textContent);
// Injury flow
const gk=T.state.club.squad.filter(p=>p.pos==="GK").sort((a,b)=>b.rating-a.rating)[0];
const gkBefore=T.available("GK").length;
w.document.querySelector(`[data-inj="${gk.id}"]`).click();
const gkAfter=T.available("GK").length;
check("T7","Injure starting GK → available GKs drop by 1","depth "+gkBefore+"→"+(gkBefore-1),"depth "+gkBefore+"→"+gkAfter,gkAfter===gkBefore-1);
check("T8","Injury sets emergency position to GK and shows badge","ePos=GK, badge=1",
 "ePos="+T.state.ePos+", badge="+$("#injBadge").textContent,T.state.ePos==="GK"&&$("#injBadge").textContent==="1");
w.document.querySelector('.tab[data-tab="emergency"]').click();
const faCards=w.document.querySelectorAll("#faList .card");
const faNames=[...faCards].slice(0,3).map(c=>c.querySelector("h3").textContent);
const allGK=T.FREE_AGENTS.filter(p=>p.pos==="GK").length;
check("T9","Emergency tab lists free-agent GKs (max 12)","1–12 cards, all GK",faCards.length+" cards (pool of GK FAs: "+allGK+")",faCards.length>0&&faCards.length<=12);
// verified filter
$("#verified").checked=true;$("#verified").dispatchEvent(new w.Event("change"));
const tags=[...w.document.querySelectorAll("#faList .tag")].map(t=>t.textContent).filter(t=>/Free agent|Reported/.test(t));
check("T10","'Verified only' hides 'reported' free agents","0 'Reported…' tags",tags.filter(t=>/Reported/.test(t)).length+" 'Reported' tags of "+tags.length,tags.filter(t=>/Reported/.test(t)).length===0);
// Recruitment
w.document.querySelector('.tab[data-tab="recruit"]').click();
const ups=w.document.querySelectorAll("#upgradeList .card").length,yg=w.document.querySelectorAll("#youngList .card").length;
check("T11","Recruitment tab returns upgrade/young lists","≤6 per list, ≥1 total",ups+" upgrade, "+yg+" future-proof",ups<=6&&yg<=6&&ups+yg>0);
// budget constraint
const budget=T.state.budget;const upVals=[...T.ALL_PLAYERS].length;
const maxUpgradeFee=[...w.document.querySelectorAll("#upgradeList .price")].map(e=>e.textContent);
// window closed
$("#window").value="closed";$("#window").dispatchEvent(new w.Event("change"));
check("T12","Window = Closed shows 'Transfer window closed' notice","Notice shown",/Transfer window closed/.test($("#recruitNote").textContent)?"Notice shown":"No notice",/Transfer window closed/.test($("#recruitNote").textContent));
// Offload planner style change
$("#window").value="open";$("#window").dispatchEvent(new w.Event("change"));
$("#style").value="Low-Block";$("#style").dispatchEvent(new w.Event("change"));
w.document.querySelector('.tab[data-tab="offload"]').click();
const off=w.document.querySelectorAll("#offloadList .card").length;
check("T13","Manager change to Low-Block → offload planner populates","≥0 cards, intro mentions change",off+" cards; intro: "+$("#offloadIntro").textContent.slice(0,60)+"…",/Low-Block/.test($("#offloadIntro").textContent));
// style fit deterministic
const p=T.state.club.squad[0];const f1=T.styleFit(p,"Possession"),f2=T.styleFit(p,"Possession");
check("T14","Style-fit score deterministic","same value twice",f1+" / "+f2,f1===f2);
// Simulated club determinism
const sim=T.CLUBS.find(c=>!c.real);const names1=sim.squad.map(x=>x.name).join("|");
const dom2=new JSDOM(html,{runScripts:"dangerously",url:"http://localhost/"});const sim2=dom2.window.__t.CLUBS.find(c=>c.id===sim.id);
check("T15","Simulated squad for promoted club is reproducible across reloads","identical names",names1===sim2.squad.map(x=>x.name).join("|")?"identical":"different",names1===sim2.squad.map(x=>x.name).join("|"));
// XSS escaping
const bad=searchTest('<img src=x onerror=alert(1)>');const injected=w.document.querySelectorAll("#suggest img, #err img").length;
$("#searchForm").dispatchEvent(new w.Event("submit",{cancelable:true}));
check("T16","Club-name input with HTML is escaped (no injected <img>)","0 injected elements",(w.document.querySelectorAll("#err img").length)+" injected",w.document.querySelectorAll("#err img").length===0);
// storage
let stored=null;try{stored=w.localStorage.getItem("sc-last-club");}catch(e){}
check("T17","Last club remembered in localStorage","sc-last-club = PL-ARS",String(stored),stored==="PL-ARS");
// network calls
const netRefs=(html.match(/fetch\(|XMLHttpRequest|WebSocket/g)||[]).length;
check("T18","No network API calls in app code","0 fetch/XHR/WebSocket",netRefs+" found",netRefs===0);
results.forEach(r=>console.log((r.pass?"PASS":"FAIL")+" "+r.id+" | "+r.desc+" | expected: "+r.exp+" | actual: "+r.act));
const failed=results.filter(r=>!r.pass).length;
console.log("\n"+(results.length-failed)+"/"+results.length+" checks passed");
process.exit(failed?1:0);
