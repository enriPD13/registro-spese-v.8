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

/* Riconoscimento di un evento: l'etichetta del calendario ha la precedenza sul
   titolo, perché è una classificazione voluta da te e quindi più affidabile. */
function rateForEvent(ev){
  if(!ev)return null;
  return rateForTitle(ev.cal)||rateForTitle(ev.title);
}
function matchSource(ev){
  if(!ev)return null;
  if(rateForTitle(ev.cal))return "etichetta";
  if(rateForTitle(ev.title))return "titolo";
  return null;
}

/* etichette (calendari) presenti negli impegni letti */
function calLabels(){
  const set=new Set();
  (S.calEvents||[]).forEach(e=>{if(e.cal)set.add(String(e.cal).trim());});
  return [...set].sort();
}

/* Durata in ore: dagli orari dell'evento, o giornata intera convenzionale. */
function calEventHours(ev){
  if(ev.allDay)return Number(S.calDayHours)||8;
  const a=new Date(ev.start),b=new Date(ev.end);
  const h=(b-a)/3600000;
  return (isFinite(h)&&h>0)?h:0;
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
    const timeMin=new Date(now.getFullYear(),now.getMonth(),1).toISOString();
    const timeMax=new Date(now.getFullYear()+1,11,31).toISOString();

    const rl=await gFetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?fields=items(id,summary,selected)");
    const jl=await rl.json();
    const cals=(jl.items||[]).filter(c=>c.selected!==false);

    const out=[];
    for(const c of cals){
      const url="https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(c.id)+
        "/events?singleEvents=true&orderBy=startTime&maxResults=2500"+
        "&timeMin="+encodeURIComponent(timeMin)+"&timeMax="+encodeURIComponent(timeMax)+
        "&fields=items(id,summary,start,end,status)";
      let r;
      try{ r=await gFetch(url); }catch(e){ continue; }   // calendario non leggibile: si salta
      const j=await r.json();
      (j.items||[]).forEach(ev=>{
        if(ev.status==="cancelled")return;
        const allDay=!!(ev.start&&ev.start.date);
        const start=allDay?ev.start.date+"T00:00:00":(ev.start&&ev.start.dateTime);
        const end=allDay?(ev.end&&ev.end.date)+"T00:00:00":(ev.end&&ev.end.dateTime);
        if(!start)return;
        out.push({id:ev.id,title:ev.summary||"",start,end:end||start,allDay,cal:c.summary||""});
      });
    }
    S.calEvents=out;
    S.calLastSync=Date.now();
    S.busy="";
    const matched=out.filter(e=>rateForEvent(e)).length;
    S.notice=out.length+(out.length===1?" impegno letto":" impegni letti")+
      ", "+matched+" con tariffa riconosciuta.";
    persist();render();
  }catch(err){
    S.busy="";
    if(!silent){S.error="Lettura agenda non riuscita ("+(err&&err.message?err.message:"errore")+").";}
    render();
  }
}

/* --- incasso già impegnato in un dato mese --- */
function committedForMonth(y,m){
  const res={total:0,hours:0,items:[],unmatched:0};
  (S.calEvents||[]).forEach(ev=>{
    const d=new Date(ev.start);
    if(isNaN(d)||d.getFullYear()!==y||d.getMonth()!==m)return;
    const r=rateForEvent(ev);
    const h=calEventHours(ev);
    if(!r){ if(h>0)res.unmatched++; return; }
    const amount=h*(Number(r.rate)||0);
    res.total+=amount;res.hours+=h;
    res.items.push({title:ev.title,date:ev.start,hours:h,rate:Number(r.rate)||0,
      amount,client:r.name,via:matchSource(ev)});
  });
  res.items.sort((a,b)=>a.date<b.date?-1:1);
  return res;
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

/* ================= VISTA TARIFFE ================= */
function renderTariffe(){
  const rates=S.rates||[];
  const missing=missingRateClients();
  const lastTxt=S.calLastSync?new Date(S.calLastSync).toLocaleString("it-IT"):"mai";
  const evs=(S.calEvents||[]).length;
  const matched=(S.calEvents||[]).filter(e=>rateForEvent(e)).length;

  return `
  <div class="card">
    <span class="label">Agenda Google</span>
    <div class="small" style="margin-bottom:12px">
      Gli impegni già programmati diventano incasso previsto: ore dell'evento × tariffa del cliente.
      Il cliente è riconosciuto prima dall'<b>etichetta del calendario</b>, poi dal titolo dell'evento.
      <br>Ultima lettura: <b>${esc(lastTxt)}</b>${evs?" · "+evs+" impegni, "+matched+" con tariffa":""}
    </div>
    <button class="btn btn-primary" data-act="cal-sync" style="width:100%">Aggiorna agenda</button>
    <div class="small" style="margin-top:10px">
      Gli impegni restano sul dispositivo. Serve aver attivato l'API Calendar su Google Cloud
      e aver sincronizzato il calendario Apple con Google.
    </div>
  </div>

  <div class="card" style="padding:14px">
    <button class="btn btn-primary" data-act="rate-new" style="width:100%">+ Nuova tariffa</button>
  </div>

  <div class="card">
    <span class="label">Tariffe orarie</span>
    ${rates.length?rates.map(r=>{
      const n=(S.calEvents||[]).filter(e=>{const x=rateForEvent(e);return x&&x.id===r.id;}).length;
      return '<div class="row">'+
        '<div class="rdesc"><div class="rtitle">'+esc(r.name)+'</div>'+
        '<div class="rmeta">'+(Number(r.rate)>0?eur(r.rate)+'/ora':'<span style="color:#C46A4E">tariffa da impostare</span>')+(n?' · '+n+(n===1?" impegno":" impegni"):"")+
          (r.keywords?' · anche: '+esc(r.keywords):'')+'</div></div>'+
        '<button class="iconbtn" aria-label="Modifica tariffa" data-act="rate-edit" data-id="'+r.id+'">'+icon("pencil",18)+'</button>'+
        '<button class="iconbtn" aria-label="Elimina tariffa" data-act="rate-del" data-id="'+r.id+'">'+icon("x",18)+'</button>'+
      '</div>';
    }).join(""):'<div class="empty">'+icon("euro",34)+'Nessuna tariffa impostata.<br>Aggiungine una per iniziare.</div>'}
  </div>

  ${(()=>{
    const labs=calLabels();
    if(!labs.length)return "";
    return '<div class="card"><span class="label">Etichette in agenda</span>'+
      '<div class="small" style="margin-bottom:10px">I calendari letti da Google. Se un\'etichetta corrisponde a una tariffa, tutti i suoi impegni vengono riconosciuti qualunque sia il titolo.</div>'+
      labs.map(l=>{
        const r=rateForTitle(l);
        const n=(S.calEvents||[]).filter(e=>e.cal===l).length;
        return '<div class="row"><div class="rdesc"><div class="rtitle">'+esc(l)+'</div>'+
          '<div class="rmeta">'+n+(n===1?" impegno":" impegni")+'</div></div>'+
          (r?'<span class="small" style="color:var(--accent-text);font-weight:800">'+eur(r.rate)+'/ora</span>'
            :'<button class="btn btn-ghost" style="padding:7px 13px;font-size:12.5px" data-act="rate-from" data-id="'+esc(l)+'">Imposta</button>')+
        '</div>';
      }).join("")+'</div>';
  })()}

  ${missing.length?`<div class="card">
    <span class="label">Clienti senza tariffa</span>
    <div class="small" style="margin-bottom:10px">Compaiono nelle tue fatture o in agenda ma non hanno ancora una tariffa oraria.</div>
    ${missing.map(c=>'<div class="row"><div class="rdesc rtitle">'+esc(c)+'</div>'+
      '<button class="btn btn-ghost" style="padding:7px 13px;font-size:12.5px" data-act="rate-from" data-id="'+esc(c)+'">Imposta</button></div>').join("")}
  </div>`:""}

  <div class="card">
    <span class="label">Giornata intera</span>
    <div class="small" style="margin-bottom:10px">Ore attribuite a un impegno senza orario (evento "tutto il giorno").</div>
    <div class="frow">
      <input class="input" id="dayhours" type="number" inputmode="decimal" min="1" max="24" step="0.5"
        value="${S.calDayHours||8}" style="flex:2">
      <button class="btn btn-ghost" data-act="dayhours-save" style="flex:1">Salva</button>
    </div>
  </div>`;
}

/* --- editor tariffa --- */
let rateEditId=null;
function openRate(id,presetName){
  const r=id?(S.rates||[]).find(x=>x.id===id):null;
  rateEditId=id||null;
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
  if(rateEditId)S.rates=S.rates.map(x=>x.id===rateEditId?{...x,name,rate,keywords}:x);
  else S.rates.push({id:uid("r"),name,rate,keywords});
  closeRate();persist();render();
}
