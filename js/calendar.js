/* ================= AGENDA (GOOGLE CALENDAR) =================
   Legge gli impegni già programmati e li traduce in incasso atteso:
   ore dell'evento × tariffa oraria del cliente riconosciuto dal titolo.
   Gli eventi restano sul dispositivo: nulla viene inviato altrove. */

/* --- normalizzazione per il riconoscimento del cliente --- */
function calNorm(s){
  return String(s||"").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")   // via gli accenti: Fòrema -> forema
    .replace(/[^a-z0-9 ]/g," ")
    .replace(/\s+/g," ").trim();
}

/* Versione senza spazi: fa combaciare "ENJOYOURJOB" con "Enjoy Your Job". */
const calSquash=s=>calNorm(s).replace(/ /g,"");

/* Cerca il cliente dentro un testo (etichetta o titolo).
   A parità di corrispondenza vince il nome più lungo, così "Manpower TS"
   prevale su "Manpower". */
function rateForTitle(text){
  const t=calNorm(text), ts=calSquash(text);
  if(!t)return null;
  let best=null,bestLen=0;
  (S.rates||[]).forEach(r=>{
    const keys=[r.name].concat(String(r.keywords||"").split(",").map(x=>x.trim()).filter(Boolean));
    keys.forEach(k=>{
      const n=calNorm(k), ns=calSquash(k);
      if(!n)return;
      if((t.includes(n)||(ns&&ts.includes(ns)))&&n.length>bestLen){best=r;bestLen=n.length;}
    });
  });
  return best;
}

/* Parole che escludono un impegno anche se sta in un calendario di lavoro
   (es. il compleanno di una collega salvato nel calendario del cliente). */
function eventSkipped(ev){
  const words=String(S.calSkipWords||"").split(",").map(x=>calNorm(x)).filter(Boolean);
  if(!words.length)return false;
  const t=calNorm(ev&&ev.title||"");
  return words.some(x=>t.includes(x));
}

/* Riconoscimento di un evento: conta SOLO il calendario in cui è salvato, perché è
   una classificazione voluta dall'utente. Un evento nel calendario personale non
   diventa lavoro solo perché cita un cliente nel titolo. */
function rateForEvent(ev){
  if(!ev)return null;
  if(eventSkipped(ev))return null;
  return rateForTitle(ev.cal);   // conta solo il calendario di appartenenza
}
function matchSource(ev){
  return rateForEvent(ev)?"etichetta":null;
}

/* etichette (calendari) presenti negli impegni letti */
function rateColor(r){
  if(r&&r.color)return r.color;
  /* colore stabile ricavato dal nome, se non ne è stato scelto uno */
  const n=calNorm(r&&r.name||"");
  let h=0;for(let i=0;i<n.length;i++)h=(h*31+n.charCodeAt(i))%CAT_PALETTE.length;
  return CAT_PALETTE[h];
}
function calLabels(){
  const set=new Set();
  (S.calEvents||[]).forEach(e=>{if(e.cal)set.add(String(e.cal).trim());});
  return [...set].sort();
}

/* Un'attività si considera "lunga" (e quindi con pausa) oltre queste ore lorde. */
const BREAK_MIN_HOURS=6;

function parseHM(s,def){
  const m=String(s||"").match(/^(\d{1,2}):(\d{2})$/);
  if(!m)return def;
  return {h:Math.max(0,Math.min(23,+m[1])),m:Math.max(0,Math.min(59,+m[2]))};
}

/* Ore di sovrapposizione fra l'attività e la fascia di pausa, giorno per giorno. */
function breakOverlapHours(a,b){
  const bs=parseHM(S.calBreakStart,{h:13,m:0});
  const be=parseHM(S.calBreakEnd,{h:14,m:0});
  let tot=0,guard=0;
  const day=new Date(a.getFullYear(),a.getMonth(),a.getDate());
  const last=new Date(b.getFullYear(),b.getMonth(),b.getDate());
  while(day<=last&&guard++<40){
    const s=new Date(day.getFullYear(),day.getMonth(),day.getDate(),bs.h,bs.m).getTime();
    const e=new Date(day.getFullYear(),day.getMonth(),day.getDate(),be.h,be.m).getTime();
    if(e>s){
      const ov=Math.min(b.getTime(),e)-Math.max(a.getTime(),s);
      if(ov>0)tot+=ov/3600000;
    }
    day.setDate(day.getDate()+1);
  }
  return tot;
}

/* Ore effettive di un impegno, con il dettaglio di come ci si è arrivati:
   dalle ore lorde si toglie la pausa (solo per le attività lunghe) e si applica
   l'eventuale limite massimo per attività. */
function calHoursDetail(ev){
  if(ev.allDay){
    const raw=Number(S.calDayHours)||8;
    return {hours:capHours(raw),raw,pausa:0,capped:capHours(raw)<raw,allDay:true};
  }
  const a=new Date(ev.start),b=new Date(ev.end);
  const raw=(b-a)/3600000;
  if(!(isFinite(raw)&&raw>0))return {hours:0,raw:0,pausa:0,capped:false,allDay:false};
  const pausa=raw>=BREAK_MIN_HOURS?breakOverlapHours(a,b):0;
  const netta=Math.max(0,raw-pausa);
  const finale=capHours(netta);
  return {hours:finale,raw,pausa,capped:finale<netta,allDay:false};
}
function capHours(h){
  const max=Number(S.calMaxHours);
  return (max>0&&h>max)?max:h;
}
/* Durata in ore usata per i calcoli. */
function calEventHours(ev){
  return calHoursDetail(ev).hours;
}

/* Calendari che non devono essere letti (es. quello personale). */
function calIsIgnored(id){return (S.calIgnored||[]).indexOf(id)>=0;}
function calToggleIgnore(id,nome){
  if(!Array.isArray(S.calIgnored))S.calIgnored=[];
  if(calIsIgnored(id)){
    S.calIgnored=S.calIgnored.filter(x=>x!==id);
    S.notice="«"+nome+"» sarà letto al prossimo aggiornamento agenda.";
  }else{
    S.calIgnored=S.calIgnored.concat([id]);
    /* via subito i suoi impegni, senza aspettare una nuova lettura */
    S.calEvents=(S.calEvents||[]).filter(e=>e.calId?e.calId!==id:e.cal!==nome);
    S.calList=(S.calList||[]).map(x=>x.id===id?{...x,count:0}:x);
    S.notice="«"+nome+"» escluso dal conteggio.";
  }
  persist();render();
}

/* --- lettura da Google Calendar --- */
async function calSync(silent){
  if(!gTokenValid()){
    if(!silent){S.error="Accedi prima a Google per leggere l'agenda.";render();}
    return;
  }
  if(!silent){S.busy="Lettura agenda…";render();}
  try{
    const now=new Date();
    /* si parte dall'anno scorso per poter rivedere anche i mesi passati */
    const timeMin=new Date(now.getFullYear()-1,0,1).toISOString();
    const timeMax=new Date(now.getFullYear()+1,11,31).toISOString();

    const rl=await gFetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?fields=items(id,summary,summaryOverride,selected,primary,accessRole)");
    const jl=await rl.json();
    if(jl.error)throw new Error(jl.error.message||"elenco calendari non disponibile");
    /* si leggono TUTTI i calendari, anche quelli deselezionati o nascosti */
    const cals=(jl.items||[]);

    const out=[],list=[];
    for(const c of cals){
      const url="https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(c.id)+
        "/events?singleEvents=true&orderBy=startTime&maxResults=2500"+
        "&timeMin="+encodeURIComponent(timeMin)+"&timeMax="+encodeURIComponent(timeMax)+
        "&fields=items(id,summary,start,end,status)";
      const nome=c.summaryOverride||c.summary||c.id;   // il nome scelto in Google vince
      let letti=0,err=null;
      if(calIsIgnored(c.id)){
        list.push({id:c.id,name:nome,count:0,error:null,ignorato:true,
          nascosto:c.selected===false,principale:!!c.primary,
          iscritto:c.accessRole==="reader"&&!c.primary});
        continue;
      }
      try{
        const r=await gFetch(url);
        const j=await r.json();
        if(j.error){err=j.error.message||"non leggibile";}
        else{
          (j.items||[]).forEach(ev=>{
            if(ev.status==="cancelled")return;
            const allDay=!!(ev.start&&ev.start.date);
            const start=allDay?ev.start.date+"T00:00:00":(ev.start&&ev.start.dateTime);
            const end=allDay?(ev.end&&ev.end.date)+"T00:00:00":(ev.end&&ev.end.dateTime);
            if(!start)return;
            out.push({id:ev.id,title:ev.summary||"",start,end:end||start,allDay,cal:nome,calId:c.id});
            letti++;
          });
        }
      }catch(e){ err=(e&&e.message)?e.message:"errore di lettura"; }
      list.push({id:c.id,name:nome,count:letti,error:err,ignorato:false,
        nascosto:c.selected===false,principale:!!c.primary,
        iscritto:c.accessRole==="reader"&&!c.primary});
    }
    S.calEvents=out;
    S.calList=list;
    S.calLastSync=Date.now();
    S.busy="";
    const matched=out.filter(e=>rateForEvent(e)).length;
    const ign=list.filter(x=>x.ignorato).length;
    const nl=list.length-ign;
    S.notice=nl+(nl===1?" calendario letto":" calendari letti")+
      (ign?" ("+ign+" esclus"+(ign===1?"o":"i")+")":"")+" · "+
      out.length+(out.length===1?" impegno":" impegni")+", "+matched+" con tariffa.";
    persist();render();
  }catch(err){
    S.busy="";
    if(!silent){S.error="Lettura agenda non riuscita ("+(err&&err.message?err.message:"errore")+").";}
    render();
  }
}

/* --- incasso già impegnato in un dato mese --- */
function committedForMonth(y,m){
  const res={total:0,hours:0,items:[],unmatched:0,hidden:0};
  (S.calEvents||[]).forEach(ev=>{
    const d=new Date(ev.start);
    if(isNaN(d)||d.getFullYear()!==y||d.getMonth()!==m)return;
    const ov=evOverride(ev.id);
    if(ov&&ov.hidden){res.hidden++;return;}
    const a=activityFor(ev);
    if(!a){ if(calEventHours(ev)>0)res.unmatched++; return; }
    res.total+=a.amount;res.hours+=a.hours;
    res.items.push({id:ev.id,title:ev.title,date:ev.start,hours:a.hours,
      rate:Number(a.rate.rate)||0,amount:a.amount,client:a.rate.name,corretta:a.corretta});
  });
  res.items.sort((a,b)=>a.date<b.date?-1:1);
  return res;
}
/* Correzioni locali: l'agenda è in sola lettura, quindi modifiche ed esclusioni
   restano nell'app e sopravvivono ai successivi aggiornamenti. */
function evOverride(id){return (S.calOverrides||{})[id]||null;}
function setOverride(id,patch){
  if(!S.calOverrides||typeof S.calOverrides!=="object")S.calOverrides={};
  S.calOverrides={...S.calOverrides,[id]:{...(S.calOverrides[id]||{}),...patch}};
}
function clearOverride(id){
  if(!S.calOverrides)return;
  const o={...S.calOverrides};delete o[id];S.calOverrides=o;
}

/* Attività retribuita corrispondente a un impegno, tenendo conto delle correzioni.
   Restituisce null se l'impegno non è lavoro o è stato escluso a mano. */
function activityFor(ev){
  const ov=evOverride(ev.id);
  if(ov&&ov.hidden)return null;
  let rate=rateForEvent(ev);
  if(ov&&ov.rateId){
    const r=(S.rates||[]).find(x=>x.id===ov.rateId);
    if(r)rate=r;
  }
  if(!rate)return null;
  const det=calHoursDetail(ev);
  const hours=(ov&&ov.hours!=null&&ov.hours!=="")?Number(ov.hours):det.hours;
  return {ev,rate,hours,amount:hours*(Number(rate.rate)||0),det,
    corretta:!!(ov&&(ov.hours!=null||ov.rateId))};
}

/* attività retribuite di un singolo giorno */
function agendaForDay(y,m,day){
  const out=[];
  (S.calEvents||[]).forEach(ev=>{
    const d=new Date(ev.start);
    if(isNaN(d)||d.getFullYear()!==y||d.getMonth()!==m||d.getDate()!==day)return;
    const a=activityFor(ev);
    if(a)out.push(a);
  });
  return out.sort((a,b)=>a.ev.start<b.ev.start?-1:1);
}
/* impegni esclusi a mano nel mese */
function agendaHidden(y,m){
  return (S.calEvents||[]).filter(ev=>{
    const d=new Date(ev.start);
    const ov=evOverride(ev.id);
    return !isNaN(d)&&d.getFullYear()===y&&d.getMonth()===m&&ov&&ov.hidden;
  });
}
/* impegni del mese senza tariffa riconosciuta (solo per informazione) */
function agendaUnmatched(y,m){
  return (S.calEvents||[]).filter(ev=>{
    const d=new Date(ev.start);
    return !isNaN(d)&&d.getFullYear()===y&&d.getMonth()===m&&!rateForEvent(ev);
  }).length;
}
function committedForYear(y){
  let t=0;for(let m=0;m<12;m++)t+=committedForMonth(y,m).total;
  return t;
}
function calHasData(){return (S.calEvents||[]).length>0&&(S.rates||[]).length>0;}

/* --- tariffe: proposta automatica dai clienti già presenti nelle fatture --- */
function knownClients(){
  const set=new Set();
  S.incomes.forEach(i=>{if(i.source==="excel"&&i.desc)set.add(String(i.desc).trim());});
  return [...set].sort();
}
function missingRateClients(){
  const names=[...new Set(knownClients().concat(calLabels()))];
  return names.filter(c=>!rateForTitle(c));
}

/* ================= VISTA TARIFFE E AGENDA ================= */
function renderTariffe(){
  const now=new Date();
  const y=(S.agY==null?now.getFullYear():S.agY);
  const m=(S.agM==null?now.getMonth():S.agM);
  const mese=committedForMonth(y,m);
  const rates=S.rates||[];
  const lastTxt=S.calLastSync?new Date(S.calLastSync).toLocaleString("it-IT"):"mai";
  const evs=(S.calEvents||[]).length;
  const matched=(S.calEvents||[]).filter(e=>rateForEvent(e)).length;

  /* guadagno per cliente nel mese mostrato */
  const perCliente={};
  mese.items.forEach(x=>{perCliente[x.client]=(perCliente[x.client]||0)+x.amount;});
  const voci=Object.entries(perCliente).map(([k,v])=>({k,v})).sort((a,b)=>b.v-a.v);

  const donut=voci.length?`
  <div class="card">
    <span class="label">Guadagno dalle attività programmate</span>
    <div class="donut-wrap"><canvas id="chart-agenda" width="190" height="190"></canvas>
      <div class="donut-center"><div class="n">${eurShort(mese.total)}</div><div class="l">${MESI[m]}</div></div></div>
    <div class="legend" id="agenda-legend"></div>
  </div>`:`
  <div class="card"><div class="empty">${icon("cal",34)}
    Nessuna attività retribuita in ${MESI_FULL[m]}.<br>
    ${evs?"Assegna una tariffa alle etichette dei clienti.":"Aggiorna l'agenda per iniziare."}</div></div>`;

  return `
  ${donut}

  ${renderAgendaCalendar()}

  <div class="card" style="padding:14px">
    <button class="btn btn-primary" data-act="rate-new" style="width:100%">+ Nuova tariffa</button>
  </div>

  <div class="card">
    <span class="label">Tariffe orarie</span>
    ${rates.length?rates.map(r=>{
      const n=(S.calEvents||[]).filter(e=>{const x=rateForEvent(e);return x&&x.id===r.id;}).length;
      return '<div class="row">'+
        '<span style="width:13px;height:13px;border-radius:4px;background:'+rateColor(r)+';flex-shrink:0"></span>'+
        '<div class="rdesc"><div class="rtitle">'+esc(r.name)+'</div>'+
        '<div class="rmeta">'+(Number(r.rate)>0?eur(r.rate)+'/ora':'<span style="color:#C46A4E">tariffa da impostare</span>')+
          (n?' · '+n+(n===1?" impegno":" impegni"):"")+
          (r.keywords?' · anche: '+esc(r.keywords):'')+'</div></div>'+
        '<button class="iconbtn" aria-label="Modifica tariffa" data-act="rate-edit" data-id="'+r.id+'">'+icon("pencil",18)+'</button>'+
        '<button class="iconbtn" aria-label="Elimina tariffa" data-act="rate-del" data-id="'+r.id+'">'+icon("x",18)+'</button>'+
      '</div>';
    }).join(""):'<div class="empty">'+icon("euro",34)+'Nessuna tariffa impostata.<br>Aggiungine una per iniziare.</div>'}
  </div>

  <div class="card">
    <span class="label">Agenda Google</span>
    <div class="small" style="margin-bottom:12px">
      Un impegno conta come lavoro se si trova nel calendario del cliente: il riconoscimento
      avviene dall'etichetta del calendario.
      <br>Ultima lettura: <b>${esc(lastTxt)}</b>${evs?" · "+evs+" impegni, "+matched+" con tariffa":""}
    </div>
    <button class="btn btn-primary" data-act="cal-sync" style="width:100%">Aggiorna agenda</button>
    <div class="small" style="margin-top:10px">
      Gli impegni restano sul dispositivo. Le impostazioni di calendari, clienti e orari
      sono nell'ingranaggio in alto.
    </div>
  </div>`;
}

/* ================= IMPOSTAZIONI AGENDA (ingranaggio) ================= */
function renderAgendaConfig(){
  const list=S.calList||[];
  const labs=calLabels();
  const missing=missingRateClients();

  const cardCalendari=list.length?`
  <div class="card">
    <span class="label">Calendari trovati su Google</span>
    <div class="small" style="margin-bottom:10px">I calendari che il tuo account Google espone. Con ✕ escludi quelli che non riguardano il lavoro: i loro impegni non vengono conteggiati.</div>
    ${list.map(c=>{
      const r=rateForTitle(c.name);
      const off=c.ignorato||calIsIgnored(c.id);
      const stato=off?'<span style="opacity:.7">escluso dal conteggio</span>'
        :(c.error?'<span style="color:#C46A4E">'+esc(c.error)+'</span>'
        :(c.count+(c.count===1?" impegno":" impegni")+
          (c.iscritto?" · iscritto (ritardo di aggiornamento)":"")+
          (c.nascosto?" · nascosto":"")));
      return '<div class="row"'+(off?' style="opacity:.55"':'')+'>'+
        '<span style="width:11px;height:11px;border-radius:4px;flex-shrink:0;background:'+
          (off?"var(--line)":(r?rateColor(r):"var(--line)"))+'"></span>'+
        '<div class="rdesc"><div class="rtitle">'+esc(c.name)+(c.principale?' <span class="rtag tag-var">principale</span>':'')+'</div>'+
        '<div class="rmeta">'+stato+'</div></div>'+
        (!off&&r?'<span class="small" style="color:var(--accent-text);font-weight:800">'+eur(r.rate)+'/ora</span>':'')+
        (!off&&!r?'<button class="btn btn-ghost" style="padding:7px 12px;font-size:12.5px" data-act="rate-from" data-id="'+esc(c.name)+'">Tariffa</button>':'')+
        '<button class="iconbtn" aria-label="'+(off?"Includi":"Escludi")+' calendario" data-act="cal-ignore" data-id="'+esc(c.id)+'" data-n="'+esc(c.name)+'">'+
          icon(off?"plus":"x",18)+'</button>'+
      '</div>';
    }).join("")}
  </div>`:`
  <div class="card"><div class="empty">${icon("cal",34)}Nessun calendario letto.<br>Premi "Aggiorna agenda" nella pagina precedente.</div></div>`;

  const cardEtichette=labs.length?`
  <div class="card">
    <span class="label">Etichette in agenda</span>
    <div class="small" style="margin-bottom:10px">Se un'etichetta corrisponde a una tariffa, tutti i suoi impegni vengono riconosciuti qualunque sia il titolo.</div>
    ${labs.map(l=>{
      const r=rateForTitle(l);
      const n=(S.calEvents||[]).filter(e=>e.cal===l).length;
      return '<div class="row"><div class="rdesc"><div class="rtitle">'+esc(l)+'</div>'+
        '<div class="rmeta">'+n+(n===1?" impegno":" impegni")+'</div></div>'+
        (r?'<span class="small" style="color:var(--accent-text);font-weight:800">'+eur(r.rate)+'/ora</span>'
          :'<button class="btn btn-ghost" style="padding:7px 13px;font-size:12.5px" data-act="rate-from" data-id="'+esc(l)+'">Imposta</button>')+
      '</div>';
    }).join("")}
  </div>`:"";

  const cardMancanti=missing.length?`
  <div class="card">
    <span class="label">Clienti senza tariffa</span>
    <div class="small" style="margin-bottom:10px">Compaiono nelle tue fatture o in agenda ma non hanno ancora una tariffa oraria.</div>
    ${missing.map(c=>'<div class="row"><div class="rdesc rtitle">'+esc(c)+'</div>'+
      '<button class="btn btn-ghost" style="padding:7px 13px;font-size:12.5px" data-act="rate-from" data-id="'+esc(c)+'">Imposta</button></div>').join("")}
  </div>`:"";

  return `
  ${cardCalendari}
  ${cardEtichette}
  ${cardMancanti}

  <div class="card">
    <span class="label">Ore e pause</span>
    <div class="small" style="margin-bottom:12px">
      Nelle attività lunghe (oltre ${BREAK_MIN_HOURS} ore) la pausa viene tolta in automatico:
      un impegno 9–18 conta ${(()=>{const bs=parseHM(S.calBreakStart,{h:13,m:0}),be=parseHM(S.calBreakEnd,{h:14,m:0});
        const p=Math.max(0,(be.h*60+be.m-bs.h*60-bs.m)/60);return fmtOre(Math.max(0,capHours(9-p)));})()} ore, non 9.
    </div>
    <div class="frow mb">
      <div style="flex:1"><label class="label">Pausa dalle</label>
        <input class="input" id="brk-start" type="time" value="${esc(S.calBreakStart||"13:00")}"></div>
      <div style="flex:1"><label class="label">alle</label>
        <input class="input" id="brk-end" type="time" value="${esc(S.calBreakEnd||"14:00")}"></div>
    </div>
    <div class="frow mb">
      <div style="flex:1"><label class="label">Massimo ore per attività</label>
        <input class="input" id="maxhours" type="number" inputmode="decimal" min="0" max="24" step="0.5"
          value="${S.calMaxHours||8}" placeholder="nessun limite"></div>
      <div style="flex:1"><label class="label">Giornata intera</label>
        <input class="input" id="dayhours" type="number" inputmode="decimal" min="1" max="24" step="0.5"
          value="${S.calDayHours||8}"></div>
    </div>
    <button class="btn btn-ghost" data-act="hours-save" style="width:100%">Salva</button>
  </div>

  <div class="card">
    <span class="label">Parole che escludono un impegno</span>
    <div class="small" style="margin-bottom:10px">
      Un impegno il cui titolo contiene una di queste parole non viene conteggiato,
      nemmeno dentro un calendario di lavoro. Separate da virgola.
    </div>
    <div class="frow">
      <input class="input" id="skipwords" placeholder="Es. compleanno, ferie, permesso"
        value="${esc(S.calSkipWords||"")}" style="flex:2">
      <button class="btn btn-ghost" data-act="skipwords-save" style="flex:1">Salva</button>
    </div>
  </div>`;
}

/* --- ciambella del guadagno programmato --- */
function drawAgendaDonut(){
  const el=document.getElementById("chart-agenda");
  if(!el||typeof Chart==="undefined")return;
  const now=new Date();
  const y=(S.agY==null?now.getFullYear():S.agY);
  const m=(S.agM==null?now.getMonth():S.agM);
  const mese=committedForMonth(y,m);
  const per={};
  mese.items.forEach(x=>{per[x.client]=(per[x.client]||0)+x.amount;});
  const voci=Object.entries(per).map(([k,v])=>({k,v})).sort((a,b)=>b.v-a.v);
  if(!voci.length)return;
  const col=k=>{const r=(S.rates||[]).find(x=>x.name===k);return r?rateColor(r):"#8B887C";};
  charts.push(new Chart(el,{type:"doughnut",
    data:{labels:voci.map(v=>v.k),datasets:[{data:voci.map(v=>v.v),
      backgroundColor:voci.map(v=>col(v.k)),borderWidth:0,spacing:2,borderRadius:5}]},
    options:{cutout:"70%",responsive:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{label:c=>" "+eur(c.raw)}}}}}));
  const leg=document.getElementById("agenda-legend");
  if(leg)leg.innerHTML=voci.map(v=>'<div class="row"><span class="dot" style="background:'+col(v.k)+'"></span>'+
    '<div class="rdesc rtitle" style="font-weight:600;font-size:14px">'+esc(v.k)+'</div>'+
    '<span class="ramount" style="font-size:14px">'+eur(v.v)+'</span>'+
    '<span class="pct">'+(mese.total?Math.round(v.v/mese.total*100):0)+'%</span></div>').join("");
}

/* --- editor tariffa --- */
let rateEditId=null;
function rateColorsHtml(){
  return CAT_PALETTE.map(col=>
    '<span class="swatch" data-rcolor="'+col+'" style="display:inline-block;width:36px;height:36px;border-radius:11px;'+
      'background:'+col+';cursor:pointer;box-sizing:border-box;'+
      'border:3px solid '+(rateColorSel===col?"var(--ink)":"transparent")+';box-shadow:0 0 0 1px var(--line)"></span>').join("");
}
let rateColorSel=null;
function openRate(id,presetName){
  const r=id?(S.rates||[]).find(x=>x.id===id):null;
  rateEditId=id||null;
  rateColorSel=r?rateColor(r):CAT_PALETTE[((S.rates||[]).length)%CAT_PALETTE.length];
  document.getElementById("r-colors").innerHTML=rateColorsHtml();
  document.getElementById("rate-title").textContent=r?"Modifica tariffa":"Nuova tariffa";
  document.getElementById("r-name").value=r?r.name:(presetName||"");
  document.getElementById("r-rate").value=r?r.rate:"";
  document.getElementById("r-keys").value=r&&r.keywords?r.keywords:"";
  document.getElementById("rate-overlay").classList.add("open");
}
function closeRate(){rateEditId=null;document.getElementById("rate-overlay").classList.remove("open");}
function saveRate(){
  const name=document.getElementById("r-name").value.trim();
  const rate=euroNum(document.getElementById("r-rate").value);
  const keywords=document.getElementById("r-keys").value.trim();
  if(!name||isNaN(rate)||rate<0)return;
  if(!Array.isArray(S.rates))S.rates=[];
  if(rateEditId)S.rates=S.rates.map(x=>x.id===rateEditId?{...x,name,rate,keywords,color:rateColorSel}:x);
  else S.rates.push({id:uid("r"),name,rate,keywords,color:rateColorSel});
  closeRate();persist();render();
}

/* ================= CALENDARIO DELLE ATTIVITÀ ================= */
function renderAgendaCalendar(){
  if(!(S.calEvents||[]).length)return "";
  const now=new Date();
  const y=(S.agY==null?now.getFullYear():S.agY);
  const m=(S.agM==null?now.getMonth():S.agM);
  const first=new Date(y,m,1);
  const startOffset=(first.getDay()+6)%7;
  const daysInMonth=new Date(y,m+1,0).getDate();

  const monthTot=committedForMonth(y,m);
  const senza=agendaUnmatched(y,m);

  let cells=GIORNI.map(g=>'<div class="cal-head">'+g+'</div>').join("");
  for(let i=0;i<startOffset;i++)cells+='<div></div>';
  for(let d=1;d<=daysInMonth;d++){
    const items=agendaForDay(y,m,d);
    const tot=items.reduce((s,x)=>s+x.amount,0);
    const isToday=now.getFullYear()===y&&now.getMonth()===m&&now.getDate()===d;
    const dots=[...new Set(items.map(x=>rateColor(x.rate)))].slice(0,4)
      .map(col=>'<span class="cal-dot" style="background:'+col+'"></span>').join("");
    cells+='<div class="cal-day '+(isToday?"today":"")+' '+(S.agSelDay===d?"sel":"")+'" data-act="ag-day" data-d="'+d+'">'+
      '<span class="cal-num">'+d+'</span>'+
      (tot?'<span class="cal-amt" style="color:var(--accent-text)">'+eurShort(tot)+'</span>':"")+
      '<span class="cal-dots">'+dots+'</span></div>';
  }

  /* dettaglio: giorno selezionato, oppure tutte le attività del mese */
  const sel=S.agSelDay?agendaForDay(y,m,S.agSelDay):null;
  let detail="";
  if(sel){
    const t=sel.reduce((s,x)=>s+x.amount,0);
    detail='<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'+
      '<span class="label" style="margin:0">'+S.agSelDay+' '+MESI_FULL[m]+'</span>'+
      '<button class="btn btn-ghost" style="padding:6px 12px;font-size:12.5px" data-act="ag-all">Tutto il mese</button></div>'+
      (sel.length?sel.map(agendaRow).join("")+
        '<div style="display:flex;justify-content:space-between;padding-top:10px;font-size:13px">'+
        '<span class="small">Totale del giorno</span><b style="font-variant-numeric:tabular-nums">'+eur(t)+'</b></div>'
        :'<div class="empty">Nessuna attività retribuita in questo giorno.</div>')+
    '</div>';
  }else{
    const all=[];
    for(let d=1;d<=daysInMonth;d++)agendaForDay(y,m,d).forEach(x=>all.push(x));
    detail='<div class="card"><span class="label">Attività del mese</span>'+
      (all.length?all.map(agendaRow).join(""):'<div class="empty">Nessuna attività retribuita in questo mese.</div>')+
      (senza?'<div class="small" style="padding-top:10px">'+senza+(senza===1?" impegno senza tariffa":" impegni senza tariffa")+
        ' non conteggiati: sono eventi il cui cliente non è riconosciuto.</div>':"")+
      (()=>{const hid=agendaHidden(y,m);
        return hid.length?'<div class="small" style="padding-top:8px">'+hid.length+
          (hid.length===1?" attività esclusa a mano":" attività escluse a mano")+
          ' · <button class="btn btn-ghost" style="padding:5px 11px;font-size:12px" data-act="act-restore-all" data-y="'+y+'" data-m="'+m+'">Ripristina</button></div>':"";})()+
    '</div>';
  }

  return `
  <div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <button class="iconbtn" aria-label="Mese precedente" data-act="ag-month" data-d="-1" style="color:var(--ink)">${icon("chev-l")}</button>
      <div style="text-align:center">
        <div style="font-weight:800;font-size:16.5px;letter-spacing:-.02em">${MESI_FULL[m]} ${y}</div>
        <div class="small">${monthTot.total>0
          ? '<b style="color:var(--accent-text)">'+eur(monthTot.total)+'</b> · '+
            (monthTot.hours%1===0?monthTot.hours:monthTot.hours.toFixed(1))+' ore programmate'
          : "nessuna attività retribuita"}</div>
      </div>
      <button class="iconbtn" aria-label="Mese successivo" data-act="ag-month" data-d="1" style="color:var(--ink)">${icon("chev-r")}</button>
    </div>
    <div class="cal">${cells}</div>
    <div class="small" style="margin-top:12px">Tocca un giorno per vedere le attività e il compenso di ciascuna.</div>
  </div>${detail}`;
}

function fmtOre(h){return h%1===0?String(h):h.toFixed(1).replace(".",",");}
function agendaRow(x){
  const d=new Date(x.ev.start);
  const quando=x.ev.allDay
    ? d.toLocaleDateString("it-IT",{day:"numeric",month:"short"})+" · giornata"
    : d.toLocaleDateString("it-IT",{day:"numeric",month:"short"})+" · "+
      d.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"});
  const det=x.det||calHoursDetail(x.ev);
  const nota=x.corretta?' <span style="opacity:.8">(corretta)</span>'
    :(det.pausa>0?' <span style="opacity:.8">(−'+fmtOre(det.pausa)+'h pausa)</span>'
    :(det.capped?' <span style="opacity:.8">(max)</span>':''));
  return '<div class="row">'+
    '<span class="dot" style="background:'+rateColor(x.rate)+'"></span>'+
    '<div class="rdesc"><div class="rtitle">'+esc(x.ev.title||x.rate.name)+'</div>'+
    '<div class="rmeta">'+esc(quando)+' · '+fmtOre(x.hours)+'h'+nota+' × '+eur(x.rate.rate)+' · '+esc(x.rate.name)+'</div></div>'+
    '<div class="ramount" style="color:var(--accent-text)">'+eur(x.amount)+'</div>'+
    '<button class="iconbtn" aria-label="Modifica attività" data-act="act-edit" data-id="'+esc(x.ev.id)+'">'+icon("pencil",18)+'</button>'+
    '<button class="iconbtn" aria-label="Escludi attività" data-act="act-del" data-id="'+esc(x.ev.id)+'">'+icon("x",18)+'</button>'+
  '</div>';
}

/* --- editor di una singola attività --- */
let actEditId=null,actRateSel=null;
function actRatesHtml(){
  return (S.rates||[]).map(r=>'<button class="chip '+(actRateSel===r.id?"active":"")+'" data-arate="'+r.id+'">'+
    esc(r.name)+'</button>').join("");
}
function openAct(id){
  const ev=(S.calEvents||[]).find(e=>e.id===id);
  if(!ev)return;
  const a=activityFor(ev);
  const ov=evOverride(id);
  actEditId=id;
  actRateSel=(ov&&ov.rateId)?ov.rateId:(a?a.rate.id:((S.rates||[])[0]||{}).id);
  const d=new Date(ev.start);
  document.getElementById("act-title").textContent=ev.title||"Attività";
  document.getElementById("act-when").textContent=d.toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"})+
    (ev.allDay?" · giornata intera":" · "+d.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"}))+
    " · dal calendario "+(ev.cal||"—");
  document.getElementById("a-hours").value=a?fmtOre(a.hours).replace(",","."):"";
  document.getElementById("a-rates").innerHTML=actRatesHtml();
  document.getElementById("act-reset").style.display=ov?"block":"none";
  document.getElementById("act-overlay").classList.add("open");
}
function closeAct(){actEditId=null;document.getElementById("act-overlay").classList.remove("open");}
function saveAct(){
  if(!actEditId)return;
  const h=euroNum(document.getElementById("a-hours").value);
  const patch={};
  patch.hours=(isNaN(h)||h<0)?null:h;
  patch.rateId=actRateSel||null;
  setOverride(actEditId,patch);
  closeAct();persist();render();
}
function resetAct(){
  if(!actEditId)return;
  clearOverride(actEditId);
  closeAct();persist();render();
}
function hideAct(id){
  const ev=(S.calEvents||[]).find(e=>e.id===id);
  const prev=evOverride(id);
  setOverride(id,{hidden:true});
  persist();render();
  showToast((ev&&ev.title?ev.title:"Attività")+" esclusa",()=>{
    if(prev&&!prev.hidden)setOverride(id,{...prev,hidden:false});
    else clearOverride(id);
    persist();render();hideToast();
  });
}
function restoreHidden(y,m){
  agendaHidden(y,m).forEach(ev=>{
    const ov=evOverride(ev.id)||{};
    if(ov.hours!=null||ov.rateId)setOverride(ev.id,{...ov,hidden:false});
    else clearOverride(ev.id);
  });
  persist();render();
}
