/* ================= RENDER ================= */
const TAB_TITLES={
  riepilogo:"Riepilogo",calendario:"Calendario",spese:"Spese",scadenze:"Scadenze",
  entrate:"Entrate",risparmi:"Risparmi",previsioni:"Previsioni",tariffe:"Tariffe e agenda","agenda-config":"Impostazioni agenda",categorie:"Categorie spese",
  "cat-entrate":"Categorie entrate",impostazioni:"Impostazioni",
};
function render(){
  charts.forEach(c=>c.destroy());charts=[];
  const tEl=document.getElementById("app-title");
  if(tEl)tEl.textContent=TAB_TITLES[S.tab]||"Registro Spese";
  paintHeaderButton();
  renderTabs();
  const fn={riepilogo:renderRiepilogo,calendario:renderCalendario,spese:renderSpese,
    scadenze:renderScadenze,categorie:renderCategorie,impostazioni:renderImpostazioni,
    entrate:renderEntrate,"cat-entrate":renderCatEntrate,risparmi:renderRisparmi,previsioni:renderPrevisioni,tariffe:renderTariffe,"agenda-config":renderAgendaConfig}[S.tab];
  document.getElementById("main").innerHTML='<div class="view">'+banners()+fn()+'</div>';
  afterRender();
}
function banners(){
  let h="";
  if(S.busy)h+='<div class="card notice" style="display:flex;align-items:center;gap:11px">'+
    '<span class="mini-spin" aria-hidden="true"></span><span>'+esc(S.busy)+'</span></div>';
  if(store.mode==="none")h+='<div class="card notice">Il salvataggio persistente non è disponibile in questo ambiente: i dati restano finché l\'app è aperta. Aprendo l\'app in Safari sul telefono, il salvataggio funziona.</div>';
  if(S.notice)h+='<div class="card notice banner"><span>'+esc(S.notice)+'</span><button class="iconbtn" data-act="clear-notice">'+icon("x",17)+'</button></div>';
  if(S.error)h+='<div class="card error banner"><span>'+esc(S.error)+'</span><button class="iconbtn" data-act="clear-error" style="color:var(--danger)">'+icon("x",17)+'</button></div>';
  return h;
}
function renderTabs(){
  const urgent=S.expenses.filter(e=>e.recurring&&daysTo(nextDue(e))<=7).length;
  const inAltro=S.tab==="categorie"||S.tab==="impostazioni"||S.tab==="entrate"||S.tab==="cat-entrate"||S.tab==="risparmi"||S.tab==="previsioni"||S.tab==="tariffe"||S.tab==="agenda-config";
  const tabs=[
    ["riepilogo","Riepilogo","pie"],
    ["calendario","Calendario","cal"],
    ["spese","Spese","list"],
    ["scadenze","Scadenze","clock"],
    ["altro","Altro","dots"],
  ];
  document.getElementById("tabs").innerHTML=tabs.map(([id,l,ic])=>{
    const active=id==="altro"?inAltro:S.tab===id;
    const badge=id==="scadenze"&&urgent?'<span class="badge">'+urgent+'</span>':"";
    return '<button class="tab '+(active?"active":"")+'" data-act="tab" data-id="'+id+'">'+badge+icon(ic)+'<span>'+l+'</span></button>';
  }).join("");
}

/* ---------- Riepilogo ---------- */
function renderRiepilogo(){
  const ex=monthExpenses(S.viewY,S.viewM);
  const av=e=>amountFor(e,S.viewY,S.viewM).val||0;
  const anyEst=ex.some(e=>e.variable&&amountFor(e,S.viewY,S.viewM).est);
  const tot=ex.reduce((s,e)=>s+av(e),0);
  const rec=ex.filter(e=>e.recurring).reduce((s,e)=>s+av(e),0);
  const byCat={};ex.forEach(e=>{byCat[e.categoryId]=(byCat[e.categoryId]||0)+av(e);});
  const cats=Object.entries(byCat).map(([id,t])=>({c:catById(id),t})).sort((a,b)=>b.t-a.t);
  const totIn=monthIncomes(S.viewY,S.viewM).reduce((s,i)=>s+Number(i.amount),0);
  const saldo=totIn-tot;
  const legend=cats.map(x=>{
    const p=tot?Math.round(x.t/tot*100):0;
    return '<div class="row"><span class="dot" style="background:'+x.c.color+'"></span>'+
      '<div class="rdesc rtitle" style="font-weight:600;font-size:14px">'+esc(x.c.name)+'</div>'+
      '<span class="ramount" style="font-size:14px">'+eur(x.t)+'</span><span class="pct">'+p+'%</span></div>';
  }).join("");
  return `
  <div class="hero">
    <div class="hero-top">
      <span class="hero-month">${MESI_FULL[S.viewM].toUpperCase()} ${S.viewY}</span>
      <div class="hero-nav">
        <button class="hero-chip" data-act="month" data-d="-1">${icon("chev-l",19)}</button>
        <button class="hero-chip" data-act="month" data-d="1">${icon("chev-r",19)}</button>
      </div>
    </div>
    <div class="hero-total" id="hero-total" data-tot="${tot}">${anyEst?"~":""}${eur(tot)}</div>
    <div class="hero-sub">Ricorrenti <b>${eur(rec)}</b> · Una tantum <b>${eur(tot-rec)}</b></div>
    <div class="hero-sub" style="margin-top:8px;padding-top:10px;border-top:1px solid rgba(255,255,255,.22)">Entrate <b>${eur(totIn)}</b> · Saldo <b style="${saldo<0?"color:#FFD3C7":""}">${saldo>=0?"+":"−"}${eur(Math.abs(saldo))}</b></div>
    ${anyEst?'<div class="hero-note">~ include importi stimati sulle bollette non ancora registrate</div>':""}
  </div>
  <div class="card"><span class="label">Per categoria</span>
    ${cats.length?`<div class="donut-wrap"><canvas id="chart-cat" width="190" height="190"></canvas>
      <div class="donut-center"><div class="n">${eurShort(tot)}</div><div class="l">${MESI[S.viewM]}</div></div></div>
      <div class="legend">${legend}</div>`
    :`<div class="empty">${icon("pie",34)}Nessuna spesa in questo mese.<br>Usa il pulsante + per iniziare.</div>`}
  </div>
  ${renderInsights()}
  <div class="chips scroll" style="margin-bottom:2px">
    ${[3,6,12,24].map(n=>'<button class="chip '+(S.chartRange===n?"active":"")+'" data-act="range" data-n="'+n+'">'+(n<12?n+" mesi":(n/12)+(n===12?" anno":" anni"))+'</button>').join("")}
  </div>
  <div class="card"><span class="label">Entrate vs uscite — ultimi ${S.chartRange} mesi</span>
    <canvas id="chart-inout" height="185"></canvas>
  </div>
  <div class="card"><span class="label">Uscite vs anno scorso</span>
    <canvas id="chart-yoy" height="185"></canvas>
  </div>
  <div class="card"><span class="label">Entrate vs anno scorso</span>
    <canvas id="chart-yoy-in" height="185"></canvas>
  </div>`;
}
/* Approfondimenti generati dai dati: confronti utili senza chiedere nulla. */
function buildInsights(){
  const out=[];
  const y=S.viewY,m=S.viewM;
  const curTot=monthExpenses(y,m).reduce((s,e)=>s+(amountFor(e,y,m).val||0),0);
  // media dei 3 mesi precedenti
  let sum=0,n=0;
  for(let i=1;i<=3;i++){
    const d=new Date(y,m-i,1);
    const t=monthExpenses(d.getFullYear(),d.getMonth()).reduce((s,e)=>s+(amountFor(e,d.getFullYear(),d.getMonth()).val||0),0);
    if(t>0){sum+=t;n++;}
  }
  if(n>0&&curTot>0){
    const avg=sum/n;
    const diff=Math.round((curTot-avg)/avg*100);
    if(Math.abs(diff)>=10){
      out.push({ic:diff>0?"trend-up":"trend-down",tone:diff>0?"warn":"good",
        txt:"Questo mese hai speso il <b>"+Math.abs(diff)+"% "+(diff>0?"in più":"in meno")+"</b> rispetto alla media dei 3 mesi precedenti."});
    }
  }
  // categoria in crescita rispetto al mese scorso
  const pd=new Date(y,m-1,1),py=pd.getFullYear(),pm=pd.getMonth();
  const byCat=(yy,mm)=>{const o={};monthExpenses(yy,mm).forEach(e=>{o[e.categoryId]=(o[e.categoryId]||0)+(amountFor(e,yy,mm).val||0);});return o;};
  const a=byCat(y,m),b=byCat(py,pm);
  let worst=null;
  Object.keys(a).forEach(k=>{
    const prev=b[k]||0;
    if(prev>0&&a[k]>prev){
      const d=Math.round((a[k]-prev)/prev*100);
      if(d>=20&&(!worst||d>worst.d))worst={k,d,delta:a[k]-prev};
    }
  });
  if(worst)out.push({ic:"trend-up",tone:"warn",
    txt:"<b>"+esc(catById(worst.k).name)+"</b> è cresciuta del <b>"+worst.d+"%</b> sul mese scorso (+"+eur(worst.delta)+")."});
  // saldo del mese
  const inc=monthIncomes(y,m).reduce((s,i)=>s+Number(i.amount),0);
  if(inc>0||curTot>0){
    const bal=inc-curTot;
    out.push({ic:bal>=0?"trend-down":"trend-up",tone:bal>=0?"good":"warn",
      txt:bal>=0?"Saldo del mese positivo: <b>"+eur(bal)+"</b> di margine.":"Questo mese le uscite superano le entrate di <b>"+eur(-bal)+"</b>."});
  }
  // fondo tasse
  const due=taxDue(y),saved=taxSavedTotal(y);
  if(due>0){
    const gap=due-saved;
    if(gap>0)out.push({ic:"piggy",tone:"warn",txt:"Per il fondo tasse "+y+" mancano <b>"+eur(gap)+"</b> sui "+eur(due)+" previsti."});
    else out.push({ic:"piggy",tone:"good",txt:"Fondo tasse "+y+" completo: hai accantonato tutto il previsto."});
  }
  // scadenze imminenti
  const soon=S.expenses.filter(e=>e.recurring&&daysTo(nextDue(e))<=7).length;
  if(soon>0)out.push({ic:"clock",tone:"warn",txt:"<b>"+soon+"</b> "+(soon===1?"scadenza":"scadenze")+" nei prossimi 7 giorni."});
  return out.slice(0,4);
}
function renderInsights(){
  const items=buildInsights();
  if(!items.length)return "";
  return '<div class="card"><span class="label">In evidenza</span>'+
    items.map(i=>'<div style="display:flex;gap:11px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--line)">'+
      '<span style="color:'+(i.tone==="good"?"var(--accent-text)":"#C46A4E")+';display:flex;flex-shrink:0;margin-top:1px">'+icon(i.ic,18)+'</span>'+
      '<div style="font-size:13.5px;line-height:1.5">'+i.txt+'</div></div>').join("")+
    '<div style="height:2px"></div></div>';
}

/* ---------- Calendario ---------- */
function renderCalendario(){
  const y=S.calY,m=S.calM;
  const first=new Date(y,m,1);
  const startOffset=(first.getDay()+6)%7;
  const daysInMonth=new Date(y,m+1,0).getDate();
  const today=new Date();
  const showIn=S.calFilter!=="out", showOut=S.calFilter!=="in";
  const monthOut=monthExpenses(y,m).reduce((s,e)=>s+(amountFor(e,y,m).val||0),0);
  const monthIn=monthIncomes(y,m).reduce((s,i)=>s+Number(i.amount),0);
  let headSum;
  if(S.calFilter==="in")headSum='<span style="color:var(--accent-text)">+'+eur(monthIn)+'</span>';
  else if(S.calFilter==="out")headSum='<span style="color:var(--danger)">−'+eur(monthOut)+'</span>';
  else headSum='<span style="color:var(--accent-text)">+'+eurShort(monthIn)+'</span> · <span style="color:var(--danger)">−'+eurShort(monthOut)+'</span>';
  let cells=GIORNI.map(g=>'<div class="cal-head">'+g+'</div>').join("");
  for(let i=0;i<startOffset;i++)cells+='<div></div>';
  for(let d=1;d<=daysInMonth;d++){
    const ex=showOut?dayExpenses(y,m,d):[];
    const inc=showIn?dayIncomes(y,m,d):[];
    const totOut=ex.reduce((s,e)=>s+(amountFor(e,y,m).val||0),0);
    const totIn=inc.reduce((s,i)=>s+Number(i.amount),0);
    const isToday=today.getFullYear()===y&&today.getMonth()===m&&today.getDate()===d;
    const dots=[
      ...(inc.length?['<span class="cal-dot" style="background:var(--accent)"></span>']:[]),
      ...[...new Set(ex.map(e=>catById(e.categoryId).color))].slice(0,3)
        .map(c=>'<span class="cal-dot" style="background:'+c+'"></span>')
    ].join("");
    const amts=(totIn?'<span class="cal-amt" style="color:var(--accent-text)">+'+eurShort(totIn)+'</span>':"")+
               (totOut?'<span class="cal-amt" style="color:var(--danger)">−'+eurShort(totOut)+'</span>':"");
    cells+='<div class="cal-day '+(isToday?"today":"")+' '+(S.selDay===d?"sel":"")+'" data-act="cal-day" data-d="'+d+'">'+
      '<span class="cal-num">'+d+'</span>'+amts+
      '<span class="cal-dots">'+dots+'</span></div>';
  }
  let detail="";
  if(S.selDay){
    const ex=showOut?dayExpenses(y,m,S.selDay):[];
    const inc=showIn?dayIncomes(y,m,S.selDay):[];
    const tOut=ex.reduce((s,e)=>s+(amountFor(e,y,m).val||0),0);
    const tIn=inc.reduce((s,i)=>s+Number(i.amount),0);
    let sumLine="";
    if(tIn&&tOut)sumLine='<span style="color:var(--accent-text)">+'+eur(tIn)+'</span> · <span style="color:var(--danger)">−'+eur(tOut)+'</span>';
    else if(tIn)sumLine='<span style="color:var(--accent-text)">+'+eur(tIn)+'</span>';
    else if(tOut)sumLine='<span style="color:var(--danger)">−'+eur(tOut)+'</span>';
    const body=(inc.map(incomeRow).join(""))+(ex.map(e=>expenseRow(e,y,m)).join(""));
    detail='<div class="card"><span class="label">'+S.selDay+' '+MESI_FULL[m]+' '+y+' — '+sumLine+'</span>'+
      (body||'<div class="empty">Nessun movimento in questo giorno.</div>')+'</div>';
  }
  const fbtn=(id,l)=>'<button class="chip '+(S.calFilter===id?"active":"")+'" data-act="cal-filter" data-id="'+id+'">'+l+'</button>';
  return `
  <div class="chips" style="margin-bottom:12px">
    ${fbtn("all","Tutto")}${fbtn("in","Entrate")}${fbtn("out","Uscite")}
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <button class="iconbtn" data-act="cal-month" data-d="-1" style="color:var(--ink)">${icon("chev-l")}</button>
      <div style="text-align:center">
        <div style="font-weight:800;font-size:16.5px;letter-spacing:-.02em">${MESI_FULL[m]} ${y}</div>
        <div class="small">${headSum}</div>
      </div>
      <button class="iconbtn" data-act="cal-month" data-d="1" style="color:var(--ink)">${icon("chev-r")}</button>
    </div>
    <div class="cal">${cells}</div>
    <div class="small" style="margin-top:12px">Verde = entrate, rosso = uscite. Tocca un giorno per il dettaglio; ricorrenti mostrate alla loro data.</div>
  </div>${detail}`;
}

/* ---------- Spese ---------- */
function expenseRow(e,y,m){
  const c=catById(e.categoryId);
  const f=FREQS.find(x=>x.id===e.freq);
  return '<div class="row">'+
    '<span class="dot" style="background:'+c.color+'"></span>'+
    '<div class="rdesc">'+
      '<div class="rtitle">'+esc(e.desc)+
        (e.recurring?'<span class="rtag tag-rec">'+(f?f.label:"Ricorrente")+'</span>':"")+
        (e.variable?'<span class="rtag tag-var">Variabile</span>':"")+'</div>'+
      '<div class="rmeta">'+esc(c.name)+' · '+new Date(e.date+"T00:00:00").toLocaleDateString("it-IT")+'</div>'+
    '</div>'+
    '<div class="ramount">'+amountLabel(e,y,m)+'</div>'+
    '<button class="iconbtn" aria-label="Modifica spesa" data-act="edit" data-id="'+e.id+'">'+icon("pencil",18)+'</button>'+
    '<button class="iconbtn" aria-label="Elimina spesa" data-act="del" data-id="'+e.id+'">'+icon("x",18)+'</button>'+
  '</div>';
}
function renderSpese(){
  const q=(S.search||"").trim().toLowerCase();
  let list=S.expenses.filter(e=>S.filterCat==="all"||e.categoryId===S.filterCat);
  if(q){
    list=list.filter(e=>{
      const c=catById(e.categoryId);
      return String(e.desc).toLowerCase().includes(q)
        || String(c.name).toLowerCase().includes(q)
        || String(e.amount).includes(q);
    });
  }
  list=list.slice().sort((a,b)=>a.date<b.date?1:-1);
  const tot=list.reduce((s,e)=>s+(Number(e.amount)||0),0);
  return `
  <div class="card" style="padding:12px 14px;margin-bottom:12px">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="color:var(--muted);display:flex">${icon("search",18)}</span>
      <input class="input" id="search-box" placeholder="Cerca per nome, categoria o importo"
        value="${esc(S.search||"")}" aria-label="Cerca tra le spese"
        style="border:none;padding:6px 0;background:none;flex:1">
      ${q?'<button class="iconbtn" data-act="search-clear" aria-label="Cancella ricerca">'+icon("x",18)+'</button>':""}
    </div>
  </div>
  <div class="chips scroll">
    <button class="chip ${S.filterCat==="all"?"active":""}" data-act="filter" data-id="all">Tutte</button>
    ${S.categories.map(c=>'<button class="chip '+(S.filterCat===c.id?"active":"")+'" data-act="filter" data-id="'+c.id+'">'+esc(c.name)+'</button>').join("")}
  </div>
  ${(q||S.filterCat!=="all")&&list.length?'<div class="small" style="margin:2px 4px 10px">'+list.length+(list.length===1?" voce":" voci")+' · '+eur(tot)+'</div>':""}
  <div class="card">${list.length?list.map(e=>expenseRow(e)).join(""):'<div class="empty">'+icon("list",34)+(q?"Nessun risultato per «"+esc(S.search)+"».":"Nessuna spesa registrata.")+'</div>'}</div>`;
}

/* ---------- Scadenze ---------- */
function renderScadenze(){
  const up=S.expenses.filter(e=>e.recurring).map(e=>({...e,due:nextDue(e)})).sort((a,b)=>a.due-b.due);
  return '<div class="card"><span class="label">Prossime scadenze ricorrenti</span>'+
  (up.length?up.map(e=>{
    const d=daysTo(e.due);const urg=d<=7;
    const f=FREQS.find(x=>x.id===e.freq);
    return '<div class="row">'+
      '<div class="duebox '+(urg?"urgent":"")+'">'+
        '<div class="dueday">'+e.due.getDate()+'</div>'+
        '<div class="duemon">'+MESI[e.due.getMonth()]+'</div>'+
      '</div>'+
      '<div class="rdesc">'+
        '<div class="rtitle">'+esc(e.desc)+'</div>'+
        '<div class="rmeta" style="'+(urg?"color:var(--danger);font-weight:700":"")+'">'+
          (d===0?"Scade oggi":d===1?"Scade domani":"Tra "+d+" giorni")+' · '+(f?f.label:"")+'</div>'+
      '</div>'+
      '<div style="text-align:right">'+
        '<div class="ramount">'+amountLabel(e,e.due.getFullYear(),e.due.getMonth())+'</div>'+
        (e.variable?'<button class="chip" data-act="bill" data-id="'+e.id+'" style="margin-top:6px;padding:6px 12px;font-size:12px">Registra</button>':"")+
      '</div>'+
    '</div>';}).join("")
  :'<div class="empty">'+icon("clock",34)+'Nessuna spesa ricorrente.<br>Aggiungi una spesa e attiva "Ricorrente".</div>')+'</div>';
}

/* ---------- Entrate ---------- */
function incomeRow(i){
  const f=FREQS.find(x=>x.id===i.freq);
  const cat=i.categoryId?incCatById(i.categoryId):null;
  const dotc=(cat&&cat.id!=="?")?cat.color:"var(--accent)";
  return '<div class="row">'+
    '<span class="dot" style="background:'+dotc+'"></span>'+
    '<div class="rdesc"><div class="rtitle">'+esc(i.desc)+
      (i.recurring?'<span class="rtag tag-rec">'+(f?f.label:"Ricorrente")+'</span>':"")+
      (i.source==="excel"?'<span class="rtag tag-var">Excel</span>':"")+'</div>'+
    '<div class="rmeta">'+new Date(i.date+"T00:00:00").toLocaleDateString("it-IT")+'</div></div>'+
    '<div class="ramount" style="color:var(--accent-text)">+'+eur(i.amount)+'</div>'+
    '<button class="iconbtn" aria-label="Modifica entrata" data-act="inc-edit" data-id="'+i.id+'">'+icon("pencil",18)+'</button>'+
    '<button class="iconbtn" aria-label="Elimina entrata" data-act="inc-del" data-id="'+i.id+'">'+icon("x",18)+'</button>'+
  '</div>';
}
function renderEntrate(){
  const Y=S.viewY;
  const totYear=yearIncome(Y);
  const monthsElapsed=(Y===now.getFullYear())?now.getMonth()+1:12;
  const avg=totYear/Math.max(1,monthsElapsed);
  const monthList=monthIncomes(Y,S.viewM).slice().sort((a,b)=>a.date<b.date?1:-1);
  const totMonth=monthList.reduce((s,i)=>s+Number(i.amount),0);
  const drive=S.gClientId?'<button class="btn btn-ghost" data-act="inc-drive" style="flex:1">Aggiorna da Drive</button>':'';
  const lastInv=S.lastInvoiceSync?"Ultimo aggiornamento fatture: "+new Date(S.lastInvoiceSync).toLocaleString("it-IT"):"Le fatture si aggiornano da sole all'accesso Google, oppure col pulsante.";
  return `
  <div class="hero">
    <div class="hero-top"><span class="hero-month">ENTRATE ${Y}</span>
      <div class="hero-nav">
        <button class="hero-chip" data-act="year" data-d="-1">${icon("chev-l",19)}</button>
        <button class="hero-chip" data-act="year" data-d="1">${icon("chev-r",19)}</button>
      </div>
    </div>
    <div class="hero-total">${eur(totYear)}</div>
    <div class="hero-sub">Media mensile <b>${eur(avg)}</b> · ${monthsElapsed} ${monthsElapsed===1?"mese":"mesi"}</div>
  </div>
  <div class="card" style="padding:14px">
    <div class="frow">
      <button class="btn btn-primary" data-act="inc-new" style="flex:1">+ Aggiungi</button>
      ${drive}
      <button class="btn btn-ghost" data-act="imp-excel" style="flex:1">File…</button>
    </div>
    <input type="file" id="xls-input" accept=".xlsx,.xls,.csv" style="display:none">
    <div class="small" style="margin-top:10px">${lastInv}</div>
  </div>
  <div class="card"><span class="label">Entrate per mese</span>
    <canvas id="chart-inc-month" height="185"></canvas></div>
  <div class="card"><span class="label">Andamento cumulato ${Y}</span>
    <canvas id="chart-inc-cum" height="175"></canvas></div>
  <div class="card"><span class="label">Voci di entrata</span>
    <div class="donut-wrap"><canvas id="chart-inc-ente" width="190" height="190"></canvas>
      <div class="donut-center"><div class="n">${eurShort(totYear)}</div><div class="l">${Y}</div></div></div>
    <div class="legend" id="inc-ente-legend"></div></div>
  <div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <span class="label" style="margin:0">Dettaglio — ${MESI_FULL[S.viewM]}</span>
      <div style="display:flex;gap:4px">
        <button class="iconbtn" data-act="month" data-d="-1" style="color:var(--ink)">${icon("chev-l",20)}</button>
        <button class="iconbtn" data-act="month" data-d="1" style="color:var(--ink)">${icon("chev-r",20)}</button>
      </div>
    </div>
    <div style="font-weight:800;font-size:20px;color:var(--accent-text);margin-bottom:6px">+${eur(totMonth)}</div>
    ${monthList.length?monthList.map(incomeRow).join(""):'<div class="empty">'+icon("euro",30)+'Nessuna entrata in questo mese.</div>'}
  </div>`;
}
function drawIncomeCharts(){
  const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const Y=S.viewY;
  const perMonth=Array(12).fill(0),cum=[];
  for(let m=0;m<12;m++)perMonth[m]=monthIncomes(Y,m).reduce((s,i)=>s+Number(i.amount),0);
  let run=0;perMonth.forEach(v=>{run+=v;cum.push(run);});
  const mEl=document.getElementById("chart-inc-month");
  if(mEl)charts.push(new Chart(mEl,{type:"bar",
    data:{labels:MESI,datasets:[{data:perMonth,backgroundColor:cssv("--accent"),borderRadius:6,barPercentage:.72}]},
    options:{responsive:true,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>" "+eur(c.raw)}}},
      scales:{y:{ticks:{callback:v=>eurShort(v),color:cssv("--muted"),font:{family:"Inter",size:10}},grid:{color:cssv("--line")},border:{display:false}},
        x:{ticks:{color:cssv("--muted"),font:{family:"Inter",size:10,weight:"700"}},grid:{display:false},border:{display:false}}}}}));
  const cEl=document.getElementById("chart-inc-cum");
  if(cEl)charts.push(new Chart(cEl,{type:"line",
    data:{labels:MESI,datasets:[{data:cum,borderColor:cssv("--accent"),backgroundColor:"transparent",
      tension:.32,pointRadius:3,fill:false}]},
    options:{responsive:true,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>" "+eur(c.raw)}}},
      scales:{y:{ticks:{callback:v=>eurShort(v),color:cssv("--muted"),font:{family:"Inter",size:10}},grid:{color:cssv("--line")},border:{display:false}},
        x:{ticks:{color:cssv("--muted"),font:{family:"Inter",size:10,weight:"700"}},grid:{display:false},border:{display:false}}}}}));
  const byVoce={};
  for(let m=0;m<12;m++)monthIncomes(Y,m).forEach(i=>{
    const key=i.source==="excel"?i.desc:(i.categoryId?incCatById(i.categoryId).name:"Altro");
    byVoce[key]=(byVoce[key]||0)+Number(i.amount);
  });
  const ents=Object.entries(byVoce).map(([k,v])=>({k,v})).sort((a,b)=>b.v-a.v);
  const pal=["#0FA36B","#0B5E4A","#5A7D8C","#C4682F","#B0793A","#6D5B97","#8B887C","#3E7C6A","#A65D57"];
  const eEl=document.getElementById("chart-inc-ente");
  if(eEl&&ents.length){
    charts.push(new Chart(eEl,{type:"doughnut",
      data:{labels:ents.map(e=>e.k),datasets:[{data:ents.map(e=>e.v),backgroundColor:ents.map((e,i)=>pal[i%pal.length]),borderWidth:0,spacing:2,borderRadius:5}]},
      options:{cutout:"70%",responsive:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>" "+eur(c.raw)}}}}}));
    const totY=ents.reduce((s,e)=>s+e.v,0);
    const leg=document.getElementById("inc-ente-legend");
    if(leg)leg.innerHTML=ents.map((e,i)=>'<div class="row"><span class="dot" style="background:'+pal[i%pal.length]+'"></span>'+
      '<div class="rdesc rtitle" style="font-weight:600;font-size:14px">'+esc(e.k)+'</div>'+
      '<span class="ramount" style="font-size:14px">'+eur(e.v)+'</span><span class="pct">'+(totY?Math.round(e.v/totY*100):0)+'%</span></div>').join("");
  }
}
let incEditId=null;
function openInc(id){
  const i=id?S.incomes.find(x=>x.id===id):null;
  incEditId=id||null;
  document.getElementById("inc-title").textContent=i?"Modifica entrata":"Nuova entrata";
  document.getElementById("i-desc").value=i?i.desc:"";
  document.getElementById("i-amount").value=i?i.amount:"";
  document.getElementById("i-date").value=i?i.date:todayISO();
  const rec=i?!!i.recurring:false, freq=i&&i.freq?i.freq:"mensile";
  document.getElementById("i-rec").checked=rec;
  document.getElementById("i-rec-toggle").classList.toggle("on",rec);
  document.getElementById("i-freq-wrap").style.display=rec?"block":"none";
  document.getElementById("i-date-label").textContent=rec?"Prima data":"Data";
  document.getElementById("i-freqs").innerHTML=FREQS.map(x=>
    '<button class="chip '+(freq===x.id?"active":"")+'" data-ifreq="'+x.id+'">'+x.label+'</button>').join("");
  const icat=i&&i.categoryId?i.categoryId:(S.incCategories[0]&&S.incCategories[0].id);
  document.getElementById("i-cats").innerHTML=S.incCategories.map(c=>
    '<button class="chip '+(icat===c.id?"active":"")+'" data-icat="'+c.id+'">'+esc(c.name)+'</button>').join("");
  document.getElementById("i-rate").value=(i&&i.taxRate!=null&&i.taxRate!=="")?i.taxRate:"";
  document.getElementById("inc-overlay").classList.add("open");
}
function closeInc(){incEditId=null;document.getElementById("inc-overlay").classList.remove("open");}
function saveInc(){
  const desc=document.getElementById("i-desc").value.trim();
  const amount=euroNum(document.getElementById("i-amount").value);
  const date=document.getElementById("i-date").value||todayISO();
  const rec=document.getElementById("i-rec").checked;
  const freqBtn=document.querySelector("#i-freqs .chip.active");
  const freq=rec?(freqBtn?freqBtn.dataset.ifreq:"mensile"):null;
  const catBtn=document.querySelector("#i-cats .chip.active");
  const categoryId=catBtn?catBtn.dataset.icat:(S.incCategories[0]&&S.incCategories[0].id);
  const rv=document.getElementById("i-rate").value;
  const taxRate=(rv===""||rv==null)?null:euroNum(rv);
  if(incEditId)S.incomes=S.incomes.map(x=>x.id===incEditId?{...x,desc,amount,date,recurring:rec,freq,categoryId,taxRate}:x);
  else S.incomes.unshift({id:uid("i"),desc,amount,date,source:"manual",recurring:rec,freq,categoryId,taxRate});
  closeInc();persist();render();
}
/* --- excel import --- */
let pendingImport=null;
function parseAmount(v){
  if(typeof v==="number")return v;
  if(v==null)return NaN;
  let s=String(v).replace(/[€\s]/g,"");
  if(s.includes(",")&&s.includes("."))s=s.replace(/\./g,"").replace(",",".");
  else if(s.includes(","))s=s.replace(",",".");
  return Number(s);
}
function parseDateCell(v){
  if(v instanceof Date&&!isNaN(v))return v;
  if(typeof v==="string"){
    let m=v.trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if(m){let y=Number(m[3]);if(y<100)y+=2000;return new Date(y,Number(m[2])-1,Number(m[1]));}
    m=v.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
  }
  return null;
}
function importExcel(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const wb=XLSX.read(reader.result,{type:"array",cellDates:true});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
      const KW={date:["data","date","emissione","incasso","pagamento","scadenza"],
        amount:["totale","importo","lordo","compenso","imponibile","amount"]};
      const DESC_PRIORITY=["cliente","committente","azienda","ragione sociale","denominazione","oggetto","descrizione","causale"];
      let hIdx=-1,ci={date:-1,amount:-1,desc:-1};
      for(let r=0;r<Math.min(rows.length,10);r++){
        const row=rows[r]||[];
        const found={date:-1,amount:-1};
        row.forEach((cell,c)=>{
          if(typeof cell!=="string")return;
          const s=cell.toLowerCase();
          for(const k in KW){if(found[k]===-1&&KW[k].some(w=>s.includes(w)))found[k]=c;}
        });
        if(found.date>-1&&found.amount>-1){
          hIdx=r;ci={date:found.date,amount:found.amount,desc:-1};
          // pick description column by priority order, not first match
          for(const w of DESC_PRIORITY){
            const idx=row.findIndex(cell=>typeof cell==="string"&&cell.toLowerCase().includes(w));
            if(idx>-1&&idx!==ci.date&&idx!==ci.amount){ci.desc=idx;break;}
          }
          break;
        }
      }
      if(hIdx===-1)throw new Error("non trovo le colonne Data e Importo nell'intestazione");
      const items=[];
      for(let r=hIdx+1;r<rows.length;r++){
        const row=rows[r]||[];
        let dv=row[ci.date];
        if(typeof dv==="number"&&dv>20000&&dv<80000)dv=new Date(Math.round((dv-25569)*86400000));
        const d=parseDateCell(dv);
        const a=parseAmount(row[ci.amount]);
        if(!d||isNaN(d.getTime())||!a||a<=0)continue;
        const desc=ci.desc>-1&&row[ci.desc]!=null?String(row[ci.desc]).trim():"Fattura";
        const iso=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
        items.push({desc:desc||"Fattura",amount:a,date:iso});
      }
      const existing=new Set(S.incomes.map(i=>i.date+"|"+i.amount+"|"+i.desc.toLowerCase()));
      const fresh=items.filter(i=>!existing.has(i.date+"|"+i.amount+"|"+i.desc.toLowerCase()));
      pendingImport={items:fresh};
      const colName=c=>c>-1&&rows[hIdx][c]!=null?String(rows[hIdx][c]):"—";
      document.getElementById("imp-info").innerHTML=
        '<div class="small" style="margin-bottom:10px">Colonne riconosciute — Data: <b>'+esc(colName(ci.date))+'</b> · Importo: <b>'+esc(colName(ci.amount))+'</b> · Descrizione: <b>'+esc(colName(ci.desc))+'</b></div>'+
        '<div class="small">Righe valide nel file: '+items.length+' · Nuove da importare: <b>'+fresh.length+'</b>'+(items.length>fresh.length?' (le altre sono già presenti)':'')+'</div>'+
        (fresh.length?'<div class="legend" style="margin-top:10px">'+fresh.slice(0,4).map(i=>
          '<div class="row" style="padding:8px 0"><div class="rdesc rtitle" style="font-size:13.5px;font-weight:600">'+esc(i.desc)+'</div><span class="small">'+i.date+'</span><span class="ramount" style="font-size:13.5px">'+eur(i.amount)+'</span></div>').join("")+
          (fresh.length>4?'<div class="small" style="text-align:center;padding-top:6px">… e altre '+(fresh.length-4)+'</div>':"")+'</div>':"");
      const btn=document.getElementById("imp-confirm");
      btn.disabled=!fresh.length;
      btn.textContent=fresh.length?"Importa "+fresh.length+(fresh.length===1?" entrata":" entrate"):"Niente da importare";
      document.getElementById("imp-overlay").classList.add("open");
    }catch(err){
      S.error="Importazione non riuscita ("+(err&&err.message?err.message:"file non leggibile")+").";render();
    }
  };
  reader.readAsArrayBuffer(file);
}
function confirmImport(){
  if(!pendingImport||!pendingImport.items.length)return;
  pendingImport.items.forEach(i=>{
    S.incomes.unshift({id:"i"+Date.now()+Math.random().toString(36).slice(2,6),desc:i.desc,amount:i.amount,date:i.date,source:"excel"});
  });
  S.notice=pendingImport.items.length+" entrate importate dall'Excel.";
  pendingImport=null;
  document.getElementById("imp-overlay").classList.remove("open");
  persist();render();
}

/* ---------- Categorie ---------- */
function renderCategorie(){
  return `
  <div class="card" style="padding:14px">
    <button class="btn btn-primary" data-act="cat-new" style="width:100%">+ Nuova categoria</button>
  </div>
  <div class="card">
    ${S.categories.map(c=>{
      const n=S.expenses.filter(e=>e.categoryId===c.id).length;
      return '<div class="row">'+
        '<span style="width:15px;height:15px;border-radius:5px;background:'+c.color+';flex-shrink:0"></span>'+
        '<div class="rdesc rtitle">'+esc(c.name)+'</div>'+
        '<span class="small">'+n+' '+(n===1?"spesa":"spese")+'</span>'+
        '<button class="iconbtn" aria-label="Modifica categoria" data-act="cat-edit" data-id="'+c.id+'">'+icon("pencil",18)+'</button>'+
        (c.id!=="altro"?'<button class="iconbtn" data-act="delcat" data-id="'+c.id+'">'+icon("x",18)+'</button>':"")+
      '</div>';}).join("")}
    <div class="small" style="padding-top:10px">Tocca la matita per rinominare o cambiare colore. Eliminando una categoria, le sue spese passano ad "Altro".</div>
  </div>`;
}

/* ---------- Risparmi ---------- */
function effRate(i){
  const num=v=>{const n=Number(v);return isNaN(n)?null:n;};
  let r=(i.taxRate!=null&&i.taxRate!=="")?num(i.taxRate):null;
  if(r==null&&i.categoryId){const c=S.incCategories.find(x=>x.id===i.categoryId);if(c)r=(c.taxRate!=null&&c.taxRate!=="")?num(c.taxRate):null;}
  if(r==null)r=num(S.taxRate);
  return r==null?0:r;
}
function taxDue(y){
  let due=0;
  S.incomes.forEach(i=>{
    const rate=effRate(i)/100;
    if(i.recurring){for(let m=0;m<12;m++)if(incDueInMonth(i,y,m))due+=Number(i.amount)*rate;}
    else if(new Date(i.date+"T00:00:00").getFullYear()===y)due+=Number(i.amount)*rate;
  });
  return due;
}
function yearIncome(y){
  let t=0;
  S.incomes.forEach(i=>{
    if(i.recurring){for(let m=0;m<12;m++)if(incDueInMonth(i,y,m))t+=Number(i.amount);}
    else if(new Date(i.date+"T00:00:00").getFullYear()===y)t+=Number(i.amount);
  });
  return t;
}
function taxSavedTotal(y){return S.taxSaved.filter(t=>t.year===y).reduce((s,t)=>s+Number(t.amount),0);}
function renderRisparmi(){
  const y=S.viewY;
  const due=taxDue(y), saved=taxSavedTotal(y), gap=due-saved;
  const pct=due>0?Math.min(100,Math.round(saved/due*100)):0;
  const goalsHtml=S.goals.length?S.goals.map(g=>{
    const has=Number(g.saved||0), tgt=Number(g.target||0);
    const p=tgt>0?Math.min(100,Math.round(has/tgt*100)):0;
    return '<div class="card">'+
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'+
        '<span style="width:13px;height:13px;border-radius:4px;background:'+g.color+';flex-shrink:0"></span>'+
        '<div style="flex:1;font-weight:800;font-size:16px">'+esc(g.name)+'</div>'+
        '<button class="iconbtn" aria-label="Modifica obiettivo" data-act="goal-edit" data-id="'+g.id+'">'+icon("pencil",18)+'</button>'+
        '<button class="iconbtn" aria-label="Elimina obiettivo" data-act="goal-del" data-id="'+g.id+'">'+icon("x",18)+'</button>'+
      '</div>'+
      '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">'+
        '<span style="font-weight:800;font-size:20px;font-variant-numeric:tabular-nums">'+eur(has)+'</span>'+
        (tgt>0?'<span class="small">di '+eur(tgt)+' · '+p+'%</span>':'<span class="small">nessun traguardo</span>')+
      '</div>'+
      (tgt>0?'<div style="height:9px;border-radius:99px;background:var(--soft);overflow:hidden;margin-bottom:12px">'+
        '<div style="height:100%;width:'+p+'%;background:'+g.color+';border-radius:99px;transition:width .4s"></div></div>':'<div style="height:4px"></div>')+
      '<div class="frow">'+
        '<button class="btn btn-ghost" data-act="goal-add-money" data-id="'+g.id+'" style="flex:1">+ Versa</button>'+
        '<button class="btn btn-ghost" data-act="goal-take-money" data-id="'+g.id+'" style="flex:1">− Preleva</button>'+
      '</div>'+
    '</div>';
  }).join(""):'<div class="card"><div class="empty">'+icon("target",34)+'Nessun obiettivo ancora.<br>Crea il tuo primo salvadanaio.</div></div>';
  return `
  <div class="hero">
    <div class="hero-top"><span class="hero-month">FONDO TASSE ${y}</span>
      <div class="hero-nav">
        <button class="hero-chip" data-act="year" data-d="-1">${icon("chev-l",19)}</button>
        <button class="hero-chip" data-act="year" data-d="1">${icon("chev-r",19)}</button>
      </div>
    </div>
    <div class="hero-total">${eur(saved)}</div>
    <div class="hero-sub">Da accantonare <b>${eur(due)}</b>${(()=>{const inc=yearIncome(y);const ar=inc>0?Math.round(due/inc*100):S.taxRate;return " · ~"+ar+"% di "+eur(inc);})()}</div>
    <div style="height:9px;border-radius:99px;background:rgba(255,255,255,.22);overflow:hidden;margin-top:12px">
      <div style="height:100%;width:${pct}%;background:#fff;border-radius:99px;transition:width .4s"></div>
    </div>
    <div class="hero-sub" style="margin-top:8px">${gap<=0?"✓ Sei in regola, surplus di "+eur(-gap):"Ancora da mettere via <b style=\"color:#FFD3C7\">"+eur(gap)+"</b>"}</div>
  </div>
  <div class="card" style="padding:14px">
    <div class="frow">
      <button class="btn btn-primary" data-act="tax-add" style="flex:1">Registra versamento</button>
      <button class="btn btn-ghost" data-act="tax-settings" style="flex:1">Imposta %</button>
    </div>
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between;margin:4px 4px 10px">
    <span class="label" style="margin:0">Obiettivi di risparmio</span>
    <button class="btn btn-primary" data-act="goal-new" style="padding:8px 14px;font-size:13px">+ Nuovo</button>
  </div>
  ${goalsHtml}`;
}
let goalEditId=null,goalColorSel=null;
function goalColorsHtml(){
  return CAT_PALETTE.map(col=>
    '<span class="swatch" data-gcolor="'+col+'" style="display:inline-block;width:36px;height:36px;border-radius:11px;'+
      'background:'+col+';cursor:pointer;box-sizing:border-box;'+
      'border:3px solid '+(goalColorSel===col?"var(--ink)":"transparent")+';box-shadow:0 0 0 1px var(--line)"></span>').join("");
}
function openGoal(id){
  const g=id?S.goals.find(x=>x.id===id):null;
  goalEditId=id||null;
  goalColorSel=g?g.color:CAT_PALETTE[S.goals.length%CAT_PALETTE.length];
  document.getElementById("goal-title").textContent=g?"Modifica obiettivo":"Nuovo obiettivo";
  document.getElementById("g-name").value=g?g.name:"";
  document.getElementById("g-target").value=g&&g.target?g.target:"";
  document.getElementById("g-saved").value=g&&g.saved?g.saved:"";
  document.getElementById("g-colors").innerHTML=goalColorsHtml();
  document.getElementById("goal-overlay").classList.add("open");
}
function closeGoal(){goalEditId=null;document.getElementById("goal-overlay").classList.remove("open");}
function saveGoal(){
  const name=document.getElementById("g-name").value.trim();
  if(!name)return;
  const target=euroNum(document.getElementById("g-target").value)||0;
  const saved=euroNum(document.getElementById("g-saved").value)||0;
  if(goalEditId)S.goals=S.goals.map(g=>g.id===goalEditId?{...g,name,target,saved,color:goalColorSel}:g);
  else S.goals.push({id:uid("g"),name,target,saved,color:goalColorSel});
  closeGoal();persist();render();
}
let moveId=null,moveDir=1;
function openMove(id,dir){
  const g=S.goals.find(x=>x.id===id);if(!g)return;
  moveId=id;moveDir=dir;
  document.getElementById("move-title").textContent=dir>0?"Versa nel salvadanaio":"Preleva dal salvadanaio";
  document.getElementById("move-name").textContent=g.name+" · saldo attuale "+eur(g.saved||0);
  document.getElementById("mv-amount").value="";
  document.getElementById("move-overlay").classList.add("open");
}
function closeMove(){moveId=null;document.getElementById("move-overlay").classList.remove("open");}
function saveMove(){
  const amt=euroNum(document.getElementById("mv-amount").value);
  if(!moveId||!amt||amt<=0)return;
  S.goals=S.goals.map(g=>{
    if(g.id!==moveId)return g;
    let ns=Number(g.saved||0)+moveDir*amt;if(ns<0)ns=0;
    return {...g,saved:ns};
  });
  closeMove();persist();render();
}
function openTax(){document.getElementById("tx-rate").value=S.taxRate;document.getElementById("tax-overlay").classList.add("open");}
function closeTax(){document.getElementById("tax-overlay").classList.remove("open");}
function saveTax(){
  const r=euroNum(document.getElementById("tx-rate").value);
  if(isNaN(r)||r<0||r>100)return;
  S.taxRate=r;closeTax();persist();render();
}
function openTaxMove(){document.getElementById("txm-amount").value="";document.getElementById("txmove-overlay").classList.add("open");}
function closeTaxMove(){document.getElementById("txmove-overlay").classList.remove("open");}
function saveTaxMove(){
  const amt=euroNum(document.getElementById("txm-amount").value);
  if(!amt)return;
  S.taxSaved.push({year:S.viewY,amount:amt,date:todayISO()});
  closeTaxMove();persist();render();
}

/* ---------- Categorie entrate ---------- */
function renderCatEntrate(){
  return `
  <div class="card" style="padding:14px">
    <button class="btn btn-primary" data-act="icat-new" style="width:100%">+ Nuova categoria entrata</button>
  </div>
  <div class="card">
    ${S.incCategories.map(c=>{
      const n=S.incomes.filter(i=>i.categoryId===c.id).length;
      const rate=(c.taxRate!=null&&c.taxRate!=="")?c.taxRate+"%":"—";
      return '<div class="row">'+
        '<span style="width:15px;height:15px;border-radius:5px;background:'+c.color+';flex-shrink:0"></span>'+
        '<div class="rdesc"><div class="rtitle">'+esc(c.name)+'</div><div class="rmeta">Fondo tasse: '+rate+'</div></div>'+
        '<span class="small">'+n+'</span>'+
        '<button class="iconbtn" aria-label="Modifica categoria" data-act="icat-edit" data-id="'+c.id+'">'+icon("pencil",18)+'</button>'+
        (c.id!=="ic-altro"?'<button class="iconbtn" data-act="icat-del" data-id="'+c.id+'">'+icon("x",18)+'</button>':"")+
      '</div>';}).join("")}
    <div class="small" style="padding-top:10px">La % di categoria alimenta il fondo tasse. Le fatture importate sono in "Fatture". Eliminando una categoria, le entrate collegate passano ad "Altro".</div>
  </div>`;
}

/* ---------- Impostazioni ---------- */
function renderImpostazioni(){
  const envTxt={claude:"artifact Claude",local:"salvataggio locale attivo",none:"solo sessione"}[store.mode];
  return `
  <div class="card">
    <span class="label">Chiave API Groq (per la scansione IA)</span>
    <input class="input" id="apikey" type="password" placeholder="gsk_…" value="${esc(S.apiKey)}">
    <div class="small" style="margin-top:8px">Si crea gratis su console.groq.com → API Keys. Resta salvata solo su questo dispositivo. Senza chiave, la scansione prova a usare l'IA di Claude (funziona solo dentro claude.ai su desktop).</div>
    <button class="btn btn-ghost" data-act="savekey" style="margin-top:12px">Salva chiave</button>
  </div>
  <div class="card">
    <span class="label">Account Google (sincronizzazione)</span>
    <div class="small" style="margin-bottom:10px">I dati vengono salvati in uno spazio privato del tuo Google Drive: mai più persi, e sincronizzati tra iPhone e PC.</div>
    <input class="input" id="gclientid" placeholder="Client ID (…apps.googleusercontent.com)" value="${esc(S.gClientId)}">
    <div class="frow" style="margin-top:12px">
      <button class="btn btn-ghost" data-act="g-save" style="flex:1">Salva ID</button>
      <button class="btn btn-primary" data-act="g-sync" style="flex:1" ${S.gClientId?"":"disabled"}>Sincronizza</button>
    </div>
    <div class="small" style="margin-top:10px">${S.lastSync?"Ultima sincronizzazione: "+new Date(S.lastSync).toLocaleString("it-IT"):"Mai sincronizzato."} Dopo l'accesso, ogni modifica viene salvata su Drive automaticamente.</div>
  </div>
  <div class="card">
    <span class="label">Spese suggerite</span>
    <div class="small" style="margin-bottom:12px">Catalogo di spese ricorrenti tipiche (utenze, fisco, assicurazioni) già configurate: le selezioni e le aggiungi in un colpo solo.</div>
    <button class="btn btn-ghost" data-act="templates">Apri il catalogo</button>
  </div>
  <div class="card">
    <span class="label">Backup dei dati</span>
    <div class="small" style="margin-bottom:12px">Esporta un file di backup per portare i dati su un altro dispositivo o conservarli al sicuro.</div>
    <div class="frow">
      <button class="btn btn-ghost" style="flex:1" data-act="export">Esporta</button>
      <button class="btn btn-ghost" style="flex:1" data-act="import">Importa</button>
    </div>
    ${(()=>{
      const snaps=snapshots.list();
      if(!snaps.length)return "";
      return '<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line)">'+
        '<div class="small" style="margin-bottom:10px"><b>Copie automatiche</b> — l\'app salva una copia al giorno degli ultimi '+
        SNAP_KEEP+' giorni. Se qualcosa va storto, puoi tornare indietro.</div>'+
        snaps.slice().reverse().map(s=>{
          const nSp=(s.data.expenses||[]).length,nIn=(s.data.incomes||[]).length;
          const d=new Date(s.day+"T00:00:00").toLocaleDateString("it-IT",{day:"numeric",month:"long"});
          return '<div class="row"><div class="rdesc"><div class="rtitle">'+d+'</div>'+
            '<div class="rmeta">'+nSp+' spese · '+nIn+' entrate</div></div>'+
            '<button class="btn btn-ghost" style="padding:7px 13px;font-size:12.5px" data-act="snap-restore" data-id="'+s.day+'">Ripristina</button></div>';
        }).join("")+'</div>';
    })()}
    <input type="file" id="import-input" accept=".json" style="display:none">
  </div>
  <div class="card">
    <span class="label">Aggiornamenti</span>
    <div class="small" style="margin-bottom:12px">Versione installata: v${APP_V} · ${envTxt}. Se sul repository c'è una versione più recente, questo pulsante svuota la cache e ricarica l'app. Dati e chiave API non vengono toccati.</div>
    <button class="btn btn-ghost" data-act="update">Cerca aggiornamenti</button>
  </div>
  <div class="card">
    <span class="label">Manutenzione entrate</span>
    ${(()=>{
      const tot=S.incomes.length;
      const xls=S.incomes.filter(i=>i.source==="excel").length;
      const man=tot-xls;
      const seen={},dups={};
      S.incomes.forEach(i=>{const k=i.date+"|"+i.amount+"|"+String(i.desc).toLowerCase();seen[k]=(seen[k]||0)+1;});
      let dupCount=0;Object.values(seen).forEach(n=>{if(n>1)dupCount+=n-1;});
      return '<div class="small" style="margin-bottom:12px">Totale entrate: <b>'+tot+'</b> · importate da Excel: <b>'+xls+'</b> · inserite a mano: <b>'+man+'</b> · duplicati esatti: <b>'+dupCount+'</b>.</div>';
    })()}
    <div class="frow" style="margin-bottom:8px">
      <button class="btn btn-ghost" style="flex:1" data-act="dedup-incomes">Rimuovi duplicati</button>
      <button class="btn btn-ghost" style="flex:1" data-act="clear-invoices">Azzera importate</button>
    </div>
    <div class="small">"Rimuovi duplicati" elimina le copie con stessa data, importo e descrizione, tenendone una. "Azzera importate" toglie tutte le fatture da Excel (poi usa "Aggiorna da Drive"). Le entrate manuali non vengono toccate da quest'ultimo.</div>
  </div>
  <div class="card">
    <span class="label">Usare l'app sull'iPhone</span>
    <div class="small">1. Apri l'indirizzo dell'app in Safari.<br>
    2. Tocca Condividi → "Aggiungi alla schermata Home": diventa un'app a schermo intero.<br>
    3. I dati e la chiave API restano salvati sul telefono.</div>
  </div>`;
}
