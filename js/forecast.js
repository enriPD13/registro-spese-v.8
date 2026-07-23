/* ================= PREVISIONI DI CASSA =================
   Il modello si basa sulle abitudini reali di incasso ricavate dallo storico
   fatture: per ogni anno completo si misura quanto pesa ciascun mese sul totale
   dell'anno (profilo stagionale). Da come sta andando l'anno in corso nei mesi
   già chiusi si proietta il totale annuo, che viene poi ridistribuito sui mesi
   ancora da venire secondo lo stesso profilo.
   Le voci certe (entrate e spese ricorrenti) non vengono stimate: si calcolano. */

/* --- storico fatture --- */
function invoiceMonthlyTotals(y){
  const arr=Array(12).fill(0);
  S.incomes.forEach(i=>{
    if(i.source!=="excel")return;
    const d=new Date(i.date+"T00:00:00");
    if(d.getFullYear()===y)arr[d.getMonth()]+=Number(i.amount)||0;
  });
  return arr;
}
function invoiceYears(){
  const set=new Set();
  S.incomes.forEach(i=>{
    if(i.source!=="excel")return;
    const y=new Date(i.date+"T00:00:00").getFullYear();
    if(!isNaN(y))set.add(y);
  });
  return [...set].sort((a,b)=>a-b);
}
/* anni completi = anni con fatture precedenti a quello in corso */
function completeInvoiceYears(){
  const cur=new Date().getFullYear();
  return invoiceYears().filter(y=>y<cur&&invoiceMonthlyTotals(y).some(v=>v>0));
}

/* --- ponderazione degli anni ---
   Gli anni recenti pesano di più: ogni anno più vecchio vale il 60% del successivo.
   Serve a seguire i cambiamenti reali dell'attività (mix di clienti, volumi) senza
   buttare via lo storico. Con 3 anni la ripartizione è circa 51% / 31% / 18%. */
const YEAR_DECAY=0.6;
function yearWeights(years){
  const n=years.length,w={};
  years.forEach((y,i)=>{w[y]=Math.pow(YEAR_DECAY,n-1-i);});   // years in ordine crescente
  return w;
}

/* --- profilo stagionale: quota di ciascun mese sul totale annuo, pesata --- */
function seasonalProfile(){
  const years=completeInvoiceYears();
  const w=yearWeights(years);
  const acc=Array(12).fill(0);
  let wsum=0;
  years.forEach(y=>{
    const m=invoiceMonthlyTotals(y);
    const tot=m.reduce((a,b)=>a+b,0);
    if(tot<=0)return;
    const ww=w[y];
    for(let k=0;k<12;k++)acc[k]+=(m[k]/tot)*ww;
    wsum+=ww;
  });
  if(!wsum)return {shares:Array(12).fill(1/12),years:0,weights:w};
  let shares=acc.map(v=>v/wsum);
  const s=shares.reduce((a,b)=>a+b,0);
  if(s>0)shares=shares.map(v=>v/s);
  return {shares,years:years.length,weights:w};
}

/* --- tendenza: rilevata automaticamente dalle variazioni annuali ---
   Media ponderata delle variazioni consecutive (le recenti pesano di più),
   con un limite prudenziale per non estrapolare crescite estreme sugli anni futuri. */
const TREND_CAP=0.5, TREND_FLOOR=-0.4;
/* La crescita non si ripete uguale ogni anno: viene smorzata (si dimezza a ogni
   anno proiettato). Chi vende il proprio tempo ha un limite fisico di giornate,
   quindi una crescita composta all'infinito non è realistica. */
const TREND_DAMP=0.5;
/* Sotto questa soglia le variazioni sono rumore: le entrate si considerano stabili. */
const PLATEAU_BAND=0.05;
function detectTrend(){
  const years=completeInvoiceYears();
  const totals=years.map(y=>({y,tot:invoiceMonthlyTotals(y).reduce((a,b)=>a+b,0)})).filter(t=>t.tot>0);
  const out={growth:null,raw:null,clamped:false,pairs:[],totals,method:"",recent:null,older:null,shift:null};
  if(totals.length<2){
    out.method=totals.length?"un solo anno completo: tendenza non calcolabile":"nessun anno completo";
    return out;
  }
  const pairs=[];
  for(let i=1;i<totals.length;i++){
    if(totals[i-1].tot>0)pairs.push({from:totals[i-1].y,to:totals[i].y,g:totals[i].tot/totals[i-1].tot-1});
  }
  out.pairs=pairs;
  let num=0,den=0;
  pairs.forEach((p,i)=>{const ww=Math.pow(YEAR_DECAY,pairs.length-1-i);num+=p.g*ww;den+=ww;});
  const raw=den?num/den:0;
  out.raw=raw;
  let g=raw;
  if(g>TREND_CAP){g=TREND_CAP;out.clamped=true;}
  if(g<TREND_FLOOR){g=TREND_FLOOR;out.clamped=true;}
  out.growth=g;
  out.method=pairs.length===1?"variazione fra i due anni completi"
    :"media ponderata delle variazioni annuali, con più peso alle recenti";
  /* stabilizzazione: variazione ponderata dentro la banda di rumore */
  if(Math.abs(g)<PLATEAU_BAND){
    out.plateau=true;
    out.growthPrePlateau=g;
    out.growth=0;
    out.method="entrate stabilizzate: le variazioni recenti sono minime, nessuna tendenza estrapolata";
  }
  /* cambio di passo: la variazione più recente rispetto alle precedenti */
  if(pairs.length>=2){
    out.recent=pairs[pairs.length-1].g;
    out.older=pairs.slice(0,-1).reduce((s,p)=>s+p.g,0)/(pairs.length-1);
    if(Math.abs(out.recent-out.older)>=0.10)out.shift=out.recent-out.older;
  }
  return out;
}

/* --- tetto di capacità ---
   Il massimo realisticamente raggiungibile in un anno. Di norma si ricava dal
   miglior anno mai realizzato (compresa la proiezione dell'anno in corso), con un
   piccolo margine per adeguamenti di tariffa. Può essere impostato a mano. */
const CEILING_MARGIN=0.05;
function capacityCeiling(){
  if(S.fcCeiling!=null&&Number(S.fcCeiling)>0)
    return {value:Number(S.fcCeiling),source:"impostato da te",manual:true};
  let best=0,bestYear=null;
  completeInvoiceYears().forEach(y=>{
    const t=invoiceMonthlyTotals(y).reduce((a,b)=>a+b,0);
    if(t>best){best=t;bestYear=y;}
  });
  const cur=new Date().getFullYear();
  const p=projectInvoiceYear(cur);
  if(p&&p.confidence!=="nulla"&&p.total>best){best=p.total;bestYear=cur;}
  if(best<=0)return {value:0,source:"dati insufficienti",manual:false};
  return {value:best*(1+CEILING_MARGIN),source:"stimato dal tuo anno migliore ("+bestYear+") più un margine del "+
    Math.round(CEILING_MARGIN*100)+"%",manual:false,bestYear,best};
}

/* --- livello di base: ogni anno riportato al livello dell'ultimo anno completo
   usando la tendenza, poi media pesata. Robusto agli anni anomali. --- */
function trendedBase(){
  const t=detectTrend();
  const totals=t.totals;
  if(!totals.length)return {base:0,trend:t};
  const last=totals[totals.length-1].y;
  const g=t.growth==null?0:t.growth;
  const w=yearWeights(totals.map(x=>x.y));
  let num=0,den=0;
  totals.forEach(x=>{
    const ww=w[x.y];
    num+=x.tot*Math.pow(1+g,last-x.y)*ww;
    den+=ww;
  });
  return {base:den?num/den:0,lastYear:last,trend:t};
}

/* --- proiezione del totale fatture dell'anno in corso --- */
function projectInvoiceYear(y){
  const prof=seasonalProfile();
  const now=new Date();
  const isCur=(y===now.getFullYear());
  const monthly=invoiceMonthlyTotals(y);
  if(!isCur){
    const t=monthly.reduce((a,b)=>a+b,0);
    return {total:t,method:"storico",confidence:"alta",profile:prof,ytd:t,lastComplete:11};
  }
  /* si usano solo i mesi già chiusi: il mese corrente è ancora in corso */
  const lastComplete=now.getMonth()-1;
  const ytd=lastComplete>=0?monthly.slice(0,lastComplete+1).reduce((a,b)=>a+b,0):0;
  const elapsedShare=lastComplete>=0?prof.shares.slice(0,lastComplete+1).reduce((a,b)=>a+b,0):0;
  const tb=trendedBase();
  const priorAvg=tb.base;

  let total,method,confidence;
  if(elapsedShare>=0.12&&ytd>0){
    total=ytd/elapsedShare;
    method="andamento dell'anno riproporzionato sulla stagionalità";
    confidence=prof.years>=2?(elapsedShare>=0.4?"alta":"media"):(elapsedShare>=0.4?"media":"bassa");
  }else if(priorAvg>0){
    /* pochi mesi chiusi: si parte dal livello storico proiettato con la tendenza */
    const g=tb.trend.growth==null?0:tb.trend.growth;
    const gap=y-(tb.lastYear||y);
    total=priorAvg*Math.pow(1+g,Math.max(0,gap));
    method=tb.trend.growth==null
      ? "livello storico ponderato (anno in corso ancora troppo breve)"
      : "livello storico ponderato con tendenza applicata (anno in corso ancora troppo breve)";
    confidence="bassa";
  }else{
    total=monthly.reduce((a,b)=>a+b,0);
    method="dati insufficienti per una proiezione";
    confidence="nulla";
  }
  return {total,method,confidence,profile:prof,ytd,lastComplete,priorAvg};
}

/* --- componenti certe e medie --- */
function recurringIncomeFor(y,m){
  let t=0;
  S.incomes.forEach(i=>{
    if(i.source==="excel"||!i.recurring)return;
    if(incDueInMonth(i,y,m))t+=Number(i.amount)||0;
  });
  return t;
}
/* media mensile delle entrate manuali occasionali sugli ultimi 12 mesi chiusi */
function avgOtherIncome(){
  const now=new Date();
  let tot=0;
  for(let k=1;k<=12;k++){
    const d=new Date(now.getFullYear(),now.getMonth()-k,1);
    S.incomes.forEach(i=>{
      if(i.source==="excel"||i.recurring)return;
      const id=new Date(i.date+"T00:00:00");
      if(id.getFullYear()===d.getFullYear()&&id.getMonth()===d.getMonth())tot+=Number(i.amount)||0;
    });
  }
  return tot/12;
}
/* media mensile delle spese una tantum sugli ultimi 6 mesi chiusi */
function avgOneOffExpense(){
  const now=new Date();
  let tot=0,n=0;
  for(let k=1;k<=6;k++){
    const d=new Date(now.getFullYear(),now.getMonth()-k,1);
    const yy=d.getFullYear(),mm=d.getMonth();
    S.expenses.forEach(e=>{
      if(e.recurring)return;
      const ed=new Date(e.date+"T00:00:00");
      if(ed.getFullYear()===yy&&ed.getMonth()===mm)tot+=Number(e.amount)||0;
    });
    n++;
  }
  return n?tot/n:0;
}
function recurringExpenseFor(y,m){
  let t=0;
  S.expenses.forEach(e=>{
    if(!e.recurring)return;
    if(dueInMonth(e,y,m))t+=amountFor(e,y,m).val||0;
  });
  return t;
}

/* --- previsione mensile: dal mese corrente fino a dicembre --- */
function forecastMonths(){
  const now=new Date();
  const y=S.fcYear||now.getFullYear();
  const proj=projectInvoiceYear(y);
  const monthly=invoiceMonthlyTotals(y);
  const otherAvg=avgOtherIncome();
  const oneOffAvg=avgOneOffExpense();
  const isCur=(y===now.getFullYear());
  const firstFuture=isCur?now.getMonth():0;   // il mese corrente è già "da prevedere"

  const rows=[];
  for(let m=0;m<12;m++){
    const past=isCur&&m<firstFuture;
    const stat=past?monthly[m]:proj.total*proj.profile.shares[m];
    /* impegni già in agenda: sono lavoro confermato, non una stima */
    const comm=(typeof committedForMonth==="function")?committedForMonth(y,m):{total:0,hours:0,items:[]};
    /* la statistica dice quanto ci si aspetta in media; l'agenda dice quanto è
       già fissato. Se l'agenda supera la media, è lei ad avere ragione. */
    const invoice=past?monthly[m]:Math.max(stat,comm.total);
    const recIn=recurringIncomeFor(y,m);
    const other=past?0:otherAvg;
    const income=past?(monthIncomes(y,m).reduce((s,i)=>s+(Number(i.amount)||0),0)):(invoice+recIn+other);
    const expRec=recurringExpenseFor(y,m);
    const expOne=past?0:oneOffAvg;
    const expense=past?(monthExpenses(y,m).reduce((s,e)=>s+(amountFor(e,y,m).val||0),0)):(expRec+expOne);
    rows.push({y,m,past,invoice,stat,comm,recIn,other,income,expense,net:income-expense});
  }
  let cum=0;
  rows.forEach(r=>{cum+=r.net;r.cum=cum;});
  return {rows,proj,otherAvg,oneOffAvg,firstFuture,isCur};
}

/* --- previsione annuale: usa SOLO gli anni completi, mai quello in corso --- */
function forecastYears(howMany){
  const tb=trendedBase();
  const t=tb.trend;
  const totals=t.totals;
  const out={base:totals,rows:[],growth:t.growth,raw:t.raw,clamped:t.clamped,
    shift:t.shift,recent:t.recent,older:t.older,method:t.method,pairs:t.pairs,
    weights:totals.length?yearWeights(totals.map(x=>x.y)):{},baseLevel:tb.base};
  if(!totals.length){out.method="Nessun anno completo disponibile.";return out;}

  const lastYear=tb.lastYear;
  const g=t.growth==null?0:t.growth;
  const now=new Date().getFullYear();
  const n=howMany||3;
  const ceil=capacityCeiling();
  out.ceiling=ceil;
  out.plateau=!!t.plateau;
  out.damped=(g!==0);
  let level=tb.base;
  for(let k=1;k<=n;k++){
    const yy=lastYear+k;
    /* crescita smorzata: al primo anno vale g, poi si dimezza a ogni passo */
    const gk=g*Math.pow(TREND_DAMP,k-1);
    level=level*(1+gk);
    let capped=false;
    if(ceil.value>0&&level>ceil.value){level=ceil.value;capped=true;}
    if(yy<now)continue;                    /* non mostrare anni già passati */
    let rec=0;for(let m=0;m<12;m++)rec+=recurringIncomeFor(yy,m);
    out.rows.push({y:yy,invoice:level,rec,total:level+rec,gk,capped});
  }
  return out;
}

/* ================= VISTA PREVISIONI ================= */
function renderPrevisioni(){
  const mode=S.fcMode||"mesi";
  const btn=(id,l)=>'<button class="chip '+(mode===id?"active":"")+'" data-act="fc-mode" data-id="'+id+'">'+l+'</button>';
  const head=`<div class="chips" style="margin-bottom:12px">${btn("mesi","Mesi")}${btn("anni","Anni")}</div>`;
  return head+(mode==="mesi"?fcMonthsView():fcYearsView());
}

const fcPct=g=>(g>=0?"+":"")+(g*100).toFixed(1).replace(".",",")+"%";
function fcConfidenceBadge(c){
  const map={alta:["Affidabilità alta","var(--accent-text)"],media:["Affidabilità media","#B0793A"],
    bassa:["Affidabilità bassa","#C46A4E"],nulla:["Dati insufficienti","var(--muted)"]};
  const v=map[c]||map.nulla;
  return '<span style="font-size:11px;font-weight:800;color:'+v[1]+'">'+v[0]+'</span>';
}

function fcWeightsTxt(weights){
  if(!weights)return "";
  const ys=Object.keys(weights).map(Number).sort((a,b)=>b-a);
  const tot=ys.reduce((s,y)=>s+weights[y],0);
  if(!tot)return "";
  return ys.map(y=>y+" "+Math.round(weights[y]/tot*100)+"%").join(" · ");
}
function fcMonthsView(){
  const f=forecastMonths();
  const {rows,proj}=f;
  const now=new Date();
  const future=rows.filter(r=>!r.past);
  const totIn=future.reduce((s,r)=>s+r.income,0);
  const totOut=future.reduce((s,r)=>s+r.expense,0);
  const endCum=rows.length?rows[rows.length-1].cum:0;
  const yearEnd=rows.reduce((s,r)=>s+r.income,0);
  const taxRate=S.taxRate||0;

  /* Senza storico fatture la previsione può comunque partire dagli impegni
     già in agenda: sono lavoro certo, non una stima. */
  const hasAgenda=(typeof calHasData==="function")&&calHasData()&&
    rows.some(r=>!r.past&&r.comm&&r.comm.total>0);
  if(proj.confidence==="nulla"&&!hasAgenda){
    return '<div class="card"><div class="empty">'+icon("trend-up",34)+
      'Servono alcuni mesi di fatture, oppure impegni in agenda con una tariffa,<br>'+
      'per costruire una previsione.</div></div>';
  }
  const soloAgenda=(proj.confidence==="nulla"&&hasAgenda);

  const bars=future.map(r=>{
    const max=Math.max(...future.map(x=>Math.max(x.income,x.expense)),1);
    const wi=Math.round(r.income/max*100),we=Math.round(r.expense/max*100);
    return '<div style="padding:11px 0;border-bottom:1px solid var(--line)">'+
      '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px">'+
        '<span style="font-weight:800;font-size:14px">'+MESI_FULL[r.m]+'</span>'+
        '<span style="font-size:13px;font-weight:800;font-variant-numeric:tabular-nums;color:'+
          (r.net>=0?"var(--accent-text)":"#C46A4E")+'">'+(r.net>=0?"+":"")+eur(r.net)+'</span>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'+
        '<span class="small" style="width:52px;flex-shrink:0">entrate</span>'+
        '<div style="flex:1;height:7px;border-radius:99px;background:var(--soft);overflow:hidden">'+
          '<div style="height:100%;width:'+wi+'%;background:var(--accent);border-radius:99px"></div></div>'+
        '<span class="small" style="width:64px;text-align:right;font-variant-numeric:tabular-nums">'+eurShort(r.income)+'</span>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:8px">'+
        '<span class="small" style="width:52px;flex-shrink:0">uscite</span>'+
        '<div style="flex:1;height:7px;border-radius:99px;background:var(--soft);overflow:hidden">'+
          '<div style="height:100%;width:'+we+'%;background:#D9836B;border-radius:99px"></div></div>'+
        '<span class="small" style="width:64px;text-align:right;font-variant-numeric:tabular-nums">'+eurShort(r.expense)+'</span>'+
      '</div>'+
      (r.comm&&r.comm.total>0?'<div class="small" style="margin-top:6px;display:flex;align-items:center;gap:6px">'+
        '<span style="color:var(--accent-text);display:flex">'+icon("cal",14)+'</span>'+
        'già in agenda <b>'+eur(r.comm.total)+'</b> ('+
        (r.comm.hours%1===0?r.comm.hours:r.comm.hours.toFixed(1))+' ore)'+
        (r.comm.total>=r.stat?' — supera la media, previsione alzata':'')+
      '</div>':"")+
    '</div>';
  }).join("");

  return `
  <div class="hero">
    <div class="hero-top"><span class="hero-month">PREVISIONE ${proj.lastComplete>=0?"A FINE":""} ${S.fcYear||now.getFullYear()}</span></div>
    <div class="hero-total">${eur(yearEnd)}</div>
    <div class="hero-sub">Entrate totali stimate · di cui ${eur(proj.ytd)} già incassati</div>
    <div class="hero-sub" style="margin-top:8px">
      Restano da incassare <b>${eur(totIn)}</b> nei prossimi mesi
    </div>
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span class="label" style="margin:0">Come è calcolata</span>${fcConfidenceBadge(proj.confidence)}
    </div>
    <div class="small">
      ${soloAgenda?"Previsione basata <b>solo sugli impegni in agenda</b>: non c'è ancora storico fatture sufficiente per una stima statistica.<br>":""}
      Metodo: ${esc(proj.method)}.<br>
      Profilo stagionale ricavato da <b>${proj.profile.years||0}</b> ${proj.profile.years===1?"anno completo":"anni completi"} di fatture.
      ${proj.profile.years>=2?"<br>Gli anni recenti pesano di più: "+fcWeightsTxt(proj.profile.weights)+".":""}
      ${proj.profile.years===0?"<br>Senza anni completi la distribuzione è uniforme: importa lo storico per una stima realistica.":""}
      ${(()=>{const t=detectTrend();
        if(t.plateau)return "<br>Entrate <b>stabilizzate</b>: nessuna crescita estrapolata.";
        return t.growth!=null
          ? "<br>Tendenza rilevata: <b>"+fcPct(t.growth)+" l'anno</b>"+(t.clamped?" (limitata per prudenza)":"")+"."
          : "";})()}
      ${f.otherAvg>0?"<br>Incluse altre entrate occasionali per "+eur(f.otherAvg)+"/mese (media)."  :""}
      ${f.oneOffAvg>0?"<br>Incluse spese una tantum per "+eur(f.oneOffAvg)+"/mese (media)."  :""}
      ${(()=>{
        if(typeof calHasData!=="function"||!calHasData())return "";
        const y0=S.fcYear||new Date().getFullYear();
        let tot=0;for(let k=f.firstFuture;k<12;k++)tot+=committedForMonth(y0,k).total;
        return tot>0?"<br>Impegni già in agenda nei mesi a venire: <b>"+eur(tot)+"</b>, usati come base minima.":"";
      })()}
      <br><span style="opacity:.75">Sull'anno in corso la tendenza non viene sommata: l'andamento reale dei mesi già chiusi la contiene già.</span>
    </div>
  </div>

  <div class="card">
    <span class="label">Mesi da venire</span>
    ${bars||'<div class="empty">Anno concluso.</div>'}
    <div style="display:flex;justify-content:space-between;padding-top:12px;font-size:13px">
      <span class="small">Saldo previsto a fine anno</span>
      <b style="font-variant-numeric:tabular-nums;color:${endCum>=0?"var(--accent-text)":"#C46A4E"}">${eur(endCum)}</b>
    </div>
  </div>

  <div class="card">
    <span class="label">Andamento previsto</span>
    <canvas id="chart-forecast" height="185"></canvas>
  </div>

  ${taxRate>0?`<div class="card">
    <span class="label">Impatto fiscale stimato</span>
    <div class="small">Sulle entrate previste per l'intero anno andrebbero accantonati circa
      <b>${eur(taxDue(S.fcYear||now.getFullYear())/Math.max(yearIncome(S.fcYear||now.getFullYear()),1)*yearEnd)}</b>,
      applicando le aliquote per categoria che hai impostato.</div>
  </div>`:""}`;
}

function fcYearsView(){
  const f=forecastYears(3);
  if(!f.rows.length){
    return '<div class="card"><div class="empty">'+icon("trend-up",34)+
      'Per la previsione annuale serve almeno un anno completo di fatture.<br>'+
      (f.base.length?"":"Importa lo storico da Drive.")+'</div></div>';
  }
  const growthTxt=f.growth==null?"nessuna tendenza calcolabile":fcPct(f.growth)+" l'anno";
  const wTot=Object.values(f.weights||{}).reduce((a,b)=>a+b,0)||1;

  return `
  <div class="card">
    <span class="label">Base di calcolo</span>
    <div class="small" style="margin-bottom:10px">
      La previsione annuale usa <b>solo gli anni completi</b>: l'anno in corso è escluso
      perché parziale e falserebbe la media. Gli anni recenti pesano di più.
    </div>
    ${f.base.map(b=>{
      const p=Math.round((f.weights[b.y]||0)/wTot*100);
      return '<div class="row"><div class="rdesc"><div class="rtitle">'+b.y+'</div>'+
        '<div class="rmeta">peso '+p+'%</div></div>'+
        '<div class="ramount">'+eur(b.tot)+'</div></div>';
    }).join("")}
    ${f.pairs&&f.pairs.length?'<div class="small" style="padding-top:10px">Variazioni: '+
      f.pairs.map(p=>p.from+"→"+p.to+" "+fcPct(p.g)).join(" · ")+'</div>':""}
    <div class="small" style="padding-top:8px">
      Tendenza applicata: <b>${growthTxt}</b> — ${esc(f.method)}.
      ${f.plateau?'<br><b>Entrate stabilizzate:</b> le variazioni recenti rientrano nel margine di oscillazione normale, quindi non viene estrapolata alcuna crescita.':""}
      ${(!f.plateau&&f.growth)?'<br>La crescita viene <b>smorzata</b>: si dimezza a ogni anno proiettato, perché una crescita composta all\'infinito non è realistica per chi vende il proprio tempo.':""}
      ${f.clamped?'<br><span style="color:#C46A4E">La variazione grezza ('+fcPct(f.raw)+') è stata limitata: estrapolare crescite estreme su più anni è poco affidabile.</span>':""}
      ${f.shift!=null?'<br><b>Cambio di passo:</b> l\'ultima variazione ('+fcPct(f.recent)+') si discosta dalle precedenti (media '+fcPct(f.older)+'). La ponderazione dà già più peso a quella recente.':""}
    </div>
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <span class="label" style="margin:0">Tetto di capacità</span>
      <button class="btn btn-ghost" style="padding:7px 13px;font-size:12.5px" data-act="fc-ceiling">Modifica</button>
    </div>
    <div style="font-weight:800;font-size:22px;font-variant-numeric:tabular-nums;margin-bottom:6px">
      ${f.ceiling&&f.ceiling.value>0?eur(f.ceiling.value):"—"}</div>
    <div class="small">
      Il massimo che puoi realisticamente fatturare in un anno: le proiezioni non lo superano.
      ${f.ceiling&&f.ceiling.value>0?"<br>"+esc(f.ceiling.source)+".":""}
      ${f.ceiling&&f.ceiling.manual?"":"<br>Se sai che il tuo limite è diverso, impostalo a mano: la previsione ne terrà conto."}
    </div>
  </div>

  <div class="card">
    <span class="label">Anni futuri</span>
    ${f.rows.map(r=>{
      const isCur=r.y===new Date().getFullYear();
      let cmp="";
      if(isCur){
        /* confronto: cosa dice la tendenza storica vs come sta andando davvero */
        const real=projectInvoiceYear(r.y);
        if(real.confidence!=="nulla"&&real.total>0){
          const diff=Math.round((real.total-r.invoice)/r.invoice*100);
          cmp='<div class="small" style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--line)">'+
            'Andamento reale in corso: <b>'+eur(real.total)+'</b>'+
            (Math.abs(diff)>=3?' ('+(diff>0?"+":"")+diff+'% rispetto alla tendenza)':' (in linea con la tendenza)')+
          '</div>';
        }
      }
      return '<div style="padding:12px 0;border-bottom:1px solid var(--line)">'+
        '<div style="display:flex;justify-content:space-between;align-items:baseline">'+
          '<span style="font-weight:800;font-size:16px">'+r.y+
            (isCur?'<span class="rtag tag-var" style="margin-left:7px">in corso</span>':'')+'</span>'+
          '<span style="font-weight:800;font-size:18px;font-variant-numeric:tabular-nums">'+eur(r.total)+'</span>'+
        '</div>'+
        '<div class="small" style="margin-top:3px">fatture stimate '+eur(r.invoice)+
          (r.rec>0?' · ricorrenti certe '+eur(r.rec):'')+
          (r.capped?' · <b>al tetto di capacità</b>':(r.gk?' · '+fcPct(r.gk)+' sull\'anno prima':''))+'</div>'+
        cmp+
      '</div>';
    }).join("")}
    <div class="small" style="padding-top:12px">
      Le entrate ricorrenti che hai già registrato sono calcolate con esattezza;
      la parte fatture è una proiezione statistica.
    </div>
  </div>

  <div class="card">
    <span class="label">Confronto anni</span>
    <canvas id="chart-forecast-years" height="185"></canvas>
  </div>`;
}

/* --- grafici della previsione --- */
function drawForecastChart(){
  const el=document.getElementById("chart-forecast");
  if(!el||typeof Chart==="undefined")return;
  const f=forecastMonths();
  const labels=f.rows.map(r=>MESI[r.m]);
  const inc=f.rows.map(r=>Math.round(r.income));
  const exp=f.rows.map(r=>Math.round(r.expense));
  const sep=f.firstFuture;
  charts.push(new Chart(el,{
    type:"bar",
    data:{labels,datasets:[
      {label:"Entrate",data:inc,backgroundColor:f.rows.map((r,i)=>i<sep?cssv("--line"):cssv("--accent")),
        borderRadius:7,barPercentage:.85,categoryPercentage:.55},
      {label:"Uscite",data:exp,backgroundColor:f.rows.map((r,i)=>i<sep?cssv("--line"):"#D9836B"),
        borderRadius:7,barPercentage:.85,categoryPercentage:.55},
    ]},
    options:{responsive:true,
      plugins:{legend:{position:"bottom",labels:{color:cssv("--muted"),boxWidth:10,boxHeight:10,
        borderRadius:5,useBorderRadius:true,font:{family:"Inter",size:11,weight:"700"}}},
        tooltip:{callbacks:{label:ctx=>{
          const past=ctx.dataIndex<sep;
          return " "+ctx.dataset.label+": "+eur(ctx.raw)+(past?" (effettivo)":" (previsto)");
        }}}},
      scales:{y:{ticks:{callback:v=>eurShort(v),color:cssv("--muted"),font:{family:"Inter",size:10.5}},
        grid:{color:cssv("--line")},border:{display:false}},
        x:{ticks:{color:cssv("--muted"),font:{family:"Inter",size:11,weight:"700"}},
        grid:{display:false},border:{display:false}}}}
  }));
}
function drawForecastYearsChart(){
  const el=document.getElementById("chart-forecast-years");
  if(!el||typeof Chart==="undefined")return;
  const f=forecastYears(3);
  const labels=f.base.map(b=>String(b.y)).concat(f.rows.map(r=>String(r.y)));
  const data=f.base.map(b=>Math.round(b.tot)).concat(f.rows.map(r=>Math.round(r.total)));
  const colors=f.base.map(()=>cssv("--line")).concat(f.rows.map(()=>cssv("--accent")));
  charts.push(new Chart(el,{
    type:"bar",
    data:{labels,datasets:[{label:"Entrate",data,backgroundColor:colors,borderRadius:8,barPercentage:.7}]},
    options:{responsive:true,
      plugins:{legend:{display:false},
        tooltip:{callbacks:{label:ctx=>{
          const isPast=ctx.dataIndex<f.base.length;
          return " "+eur(ctx.raw)+(isPast?" (effettivo)":" (previsto)");
        }}}},
      scales:{y:{ticks:{callback:v=>eurShort(v),color:cssv("--muted"),font:{family:"Inter",size:10.5}},
        grid:{color:cssv("--line")},border:{display:false}},
        x:{ticks:{color:cssv("--muted"),font:{family:"Inter",size:11,weight:"700"}},
        grid:{display:false},border:{display:false}}}}
  }));
}
