/* ================= FISCO =================
   Gestisce il prospetto di rateizzazione della commercialista: scadenze reali
   con date e importi, ripartizione per natura (contributi, imposta, IRPEF),
   aliquota effettiva ricavata dai dati veri e proiezione dell'anno successivo.

   Nota: gli acconti non sono una stima ma una funzione dell'anno precedente.
   È questo che rende attendibile la proiezione. */

/* --- classificazione dei codici tributo --- */
const TRIBUTI={
  "1790":{nat:"imposta",  tipo:"acconto", lbl:"Imposta sostitutiva · acconto 1ª rata"},
  "1791":{nat:"imposta",  tipo:"acconto", lbl:"Imposta sostitutiva · acconto 2ª rata"},
  "1792":{nat:"imposta",  tipo:"saldo",   lbl:"Imposta sostitutiva · saldo"},
  "1668":{nat:"interessi",tipo:"interessi",lbl:"Interessi rateizzazione"},
  "4001":{nat:"irpef",    tipo:"saldo",   lbl:"IRPEF · saldo"},
  "4033":{nat:"irpef",    tipo:"acconto", lbl:"IRPEF · acconto 1ª rata"},
  "4034":{nat:"irpef",    tipo:"acconto", lbl:"IRPEF · acconto 2ª rata"},
  "3801":{nat:"addizionale",tipo:"saldo", lbl:"Addizionale regionale"},
  "3805":{nat:"interessi",tipo:"interessi",lbl:"Interessi tributi regionali"},
  "PXX" :{nat:"inps",     tipo:"acconto", lbl:"INPS Gestione Separata · 2° acconto"},
  "PXXR":{nat:"inps",     tipo:"misto",   lbl:"INPS Gestione Separata · rate"},
  "DPPI":{nat:"interessi",tipo:"interessi",lbl:"Interessi rate INPS"},
};
const NATURE={
  inps:       {lbl:"Contributi INPS",     col:"#5A7D8C", reddito:"forfettario"},
  imposta:    {lbl:"Imposta sostitutiva", col:"#0FA36B", reddito:"forfettario"},
  irpef:      {lbl:"IRPEF",               col:"#B0793A", reddito:"altri"},
  addizionale:{lbl:"Addizionale regionale",col:"#C46A4E", reddito:"altri"},
  interessi:  {lbl:"Interessi",           col:"#8B887C", reddito:"—"},
};
function tributoInfo(code){
  const c=String(code||"").toUpperCase().trim();
  if(TRIBUTI[c])return {...TRIBUTI[c],code:c};
  return {nat:"altro",tipo:"altro",lbl:"Codice "+c,code:c};
}
function naturaLbl(n){return (NATURE[n]||{lbl:"Altro"}).lbl;}
function naturaCol(n){return (NATURE[n]||{col:"#8B887C"}).col;}

/* --- lettura del prospetto ---------------------------------------------
   Le righe arrivano ricostruite per posizione (vedi fiscoLinesFromPdf):
   CODICE - descrizione  ANNO  [RATA]  IMPORTO                              */
const RE_DATA=/^\s*(\d{2})\/(\d{2})\/(\d{4})\s*$/;
const RE_VOCE=/^\s*([A-Z0-9]{3,4})\s*[-–]\s*(.*?)\s+(\d{4})\s+(?:(\d{1,2})\s+)?(-?[\d.]*\d,\d{2})\s*$/i;
const RE_TOT =/^\s*Totale\s+(-?[\d.]*\d,\d{2})\s*$/i;
const RE_NETTO=/Netto da versare\s+(-?[\d.]*\d,\d{2})/i;

function numIt(s){
  const n=Number(String(s).replace(/\./g,"").replace(",","."));
  return isNaN(n)?0:n;
}
function parseProspetto(lines){
  const out={scadenze:[],crediti:[],netto:null,errori:[]};
  let corrente=null;         // scadenza in costruzione
  let inCrediti=false;

  lines.forEach(raw=>{
    const line=String(raw||"").replace(/\s+$/,"");
    if(!line.trim())return;

    if(/crediti disponibili/i.test(line)){inCrediti=true;corrente=null;return;}

    const md=line.match(RE_DATA);
    if(md){
      inCrediti=false;
      const date=md[3]+"-"+md[2]+"-"+md[1];
      /* la stessa data può ripetersi a cavallo di un salto di pagina:
         in quel caso si riprende la scadenza già aperta invece di sdoppiarla */
      const gia=out.scadenze.find(s=>s.date===date);
      if(gia){corrente=gia;return;}
      corrente={date,voci:[],totale:null};
      out.scadenze.push(corrente);
      return;
    }

    const mv=line.match(RE_VOCE);
    if(mv){
      const voce={code:mv[1].toUpperCase(),desc:mv[2].trim().replace(/\s+/g," "),
        anno:Number(mv[3]),rata:mv[4]?Number(mv[4]):null,importo:numIt(mv[5])};
      if(inCrediti||voce.importo<0)out.crediti.push(voce);
      else if(corrente)corrente.voci.push(voce);
      else out.errori.push("voce fuori da una scadenza: "+line.trim().slice(0,60));
      return;
    }

    const mt=line.match(RE_TOT);
    if(mt&&corrente)corrente.totale=numIt(mt[1]);
    if(mt&&!corrente&&inCrediti)out.totaleCrediti=numIt(mt[1]);

    const mn=line.match(RE_NETTO);
    if(mn)out.netto=numIt(mn[1]);
  });

  /* verifica: la somma delle voci deve coincidere col totale dichiarato */
  out.scadenze.forEach(s=>{
    s.somma=Math.round(s.voci.reduce((a,v)=>a+v.importo,0)*100)/100;
    s.quadra=(s.totale==null)||Math.abs(s.somma-s.totale)<0.02;
    if(!s.quadra)out.errori.push("la scadenza "+s.date+" non quadra col totale del documento");
  });
  out.totale=Math.round(out.scadenze.reduce((a,s)=>a+s.somma,0)*100)/100;
  out.quadra=(out.netto==null)||Math.abs(out.totale-out.netto)<0.05;
  return out;
}

/* Ricostruisce le righe dai frammenti di testo del PDF, raggruppando per
   riga (coordinata verticale) e ordinando per posizione orizzontale. */
function fiscoLinesFromPdf(items){
  const righe=new Map();
  items.forEach(it=>{
    const y=Math.round((it.y||0)*2)/2;          // tolleranza di mezzo punto
    if(!righe.has(y))righe.set(y,[]);
    righe.get(y).push(it);
  });
  return [...righe.entries()]
    .sort((a,b)=>b[0]-a[0])                     // dall'alto verso il basso
    .map(([,frammenti])=>frammenti.sort((a,b)=>a.x-b.x).map(f=>f.s).join(" ")
      .replace(/\s+/g," ").trim());
}

/* --- aggregazioni ------------------------------------------------------ */
function fiscoScadenze(){return (S.fisco&&S.fisco.scadenze)||[];}
function fiscoAttivo(){return fiscoScadenze().length>0;}

function fiscoPerNatura(scadenze){
  const acc={};
  (scadenze||fiscoScadenze()).forEach(s=>s.voci.forEach(v=>{
    const n=tributoInfo(v.code).nat;
    acc[n]=(acc[n]||0)+v.importo;
  }));
  return Object.entries(acc).map(([nat,val])=>({nat,val,lbl:naturaLbl(nat),col:naturaCol(nat)}))
    .sort((a,b)=>b.val-a.val);
}
function fiscoTotale(){
  return fiscoScadenze().reduce((a,s)=>a+s.voci.reduce((x,v)=>x+v.importo,0),0);
}
function fiscoAnnoRiferimento(){
  /* l'anno in cui cadono le scadenze */
  const anni={};
  fiscoScadenze().forEach(s=>{const y=Number(s.date.slice(0,4));anni[y]=(anni[y]||0)+1;});
  const k=Object.keys(anni).sort((a,b)=>anni[b]-anni[a]);
  return k.length?Number(k[0]):new Date().getFullYear();
}
/* Tutte le scadenze non ancora saldate, comprese quelle già scadute:
   una scadenza passata e non pagata resta dovuta. */
function fiscoDaPagare(){
  return fiscoScadenze().filter(s=>!s.pagata).sort((a,b)=>a.date<b.date?-1:1);
}
function fiscoProssime(){return fiscoDaPagare();}
function fiscoScadute(){
  const oggi=todayISO();
  return fiscoDaPagare().filter(s=>s.date<oggi);
}
function fiscoResiduo(){
  return fiscoDaPagare().reduce((a,s)=>a+s.voci.reduce((x,v)=>x+v.importo,0),0);
}
/* quanto serve entro una certa data */
function fiscoDovutoEntro(dataISO){
  return fiscoScadenze().filter(s=>!s.pagata&&s.date<=dataISO)
    .reduce((a,s)=>a+s.voci.reduce((x,v)=>x+v.importo,0),0);
}

/* --- acconti versati nell'anno di riferimento, per natura --- */
function accontiVersati(anno){
  const acc={};
  fiscoScadenze().forEach(s=>s.voci.forEach(v=>{
    const t=tributoInfo(v.code);
    if(t.nat==="interessi")return;
    /* un acconto è tale se riferito all'anno in corso */
    const isAcconto=(t.tipo==="acconto")||(t.tipo==="misto"&&v.anno===anno);
    if(isAcconto&&v.anno===anno)acc[t.nat]=(acc[t.nat]||0)+v.importo;
  }));
  return acc;
}
/* saldi dell'anno precedente presenti nel prospetto */
function saldiPrecedenti(anno){
  const acc={};
  fiscoScadenze().forEach(s=>s.voci.forEach(v=>{
    const t=tributoInfo(v.code);
    if(t.nat==="interessi")return;
    if(v.anno<anno)acc[t.nat]=(acc[t.nat]||0)+v.importo;
  }));
  return acc;
}

/* --- percentuali di acconto (modificabili) --- */
function accontoPct(nat){
  const p=(S.fiscoAcconti||{})[nat];
  if(p!=null&&p!=="")return Number(p)/100;
  return nat==="inps"?0.80:1.00;      // predefiniti di uso comune
}

/* Dovuto dell'anno precedente ricavato all'indietro dagli acconti:
   acconto = percentuale × dovuto dell'anno prima. */
function dovutoPrecedente(anno){
  const acc=accontiVersati(anno),out={};
  Object.keys(acc).forEach(n=>{
    const p=accontoPct(n);
    if(p>0)out[n]=acc[n]/p;
  });
  return out;
}

/* --- proiezione dell'anno successivo -----------------------------------
   dovuto(anno) stimato dai ricavi, oppure pari a quello ricavato dal
   prospetto se i ricavi sono stabili.
   uscita(anno+1) = saldo(anno) + acconti(anno+1)
                  = [dovuto(anno) − acconti già versati(anno)] + %×dovuto(anno) */
function proiezioneFiscale(){
  const anno=fiscoAnnoRiferimento();
  const acc=accontiVersati(anno);
  const dovutoPrec=dovutoPrecedente(anno);
  const nature=[...new Set([...Object.keys(acc),...Object.keys(dovutoPrec)])];

  /* rapporto fra i ricavi previsti dell'anno e quelli dell'anno prima:
     se il fatturato cambia, cambia proporzionalmente anche il dovuto */
  let fattore=1,base="ricavi stabili",ricPrec=0,ricCorr=0;
  /* Si confrontano grandezze omogenee: compensi da fattura contro compensi da
     fattura. Sono quelli che generano imposta sostitutiva e contributi. */
  if(typeof invoiceMonthlyTotals==="function"&&typeof projectInvoiceYear==="function"){
    ricPrec=invoiceMonthlyTotals(anno-1).reduce((a,b)=>a+b,0);
    const pr=projectInvoiceYear(anno);
    ricCorr=(pr&&pr.confidence!=="nulla")?(pr.total||0):0;
    if(ricPrec>0&&ricCorr>0){
      fattore=ricCorr/ricPrec;
      base="compensi previsti "+anno+" rispetto a "+(anno-1);
    }
  }
  /* prudenza: variazioni oltre il ±40% non vengono estrapolate per intero */
  const fattoreUsato=Math.max(0.6,Math.min(1.4,fattore));

  const righe=nature.map(n=>{
    const dPrec=dovutoPrec[n]||0;
    const dCorr=dPrec*fattoreUsato;              // dovuto sull'anno in corso
    const versato=acc[n]||0;
    const saldo=dCorr-versato;                   // da versare l'anno prossimo
    const acconto=dCorr*accontoPct(n);           // acconti dell'anno prossimo
    return {nat:n,lbl:naturaLbl(n),col:naturaCol(n),
      dovutoPrec:dPrec,dovutoCorr:dCorr,versato,saldo,acconto,totale:saldo+acconto};
  }).filter(r=>Math.abs(r.totale)>0.5).sort((a,b)=>b.totale-a.totale);

  return {anno,annoProssimo:anno+1,righe,fattore,fattoreUsato,base,ricPrec,ricCorr,
    totale:righe.reduce((a,r)=>a+r.totale,0),
    totaleCorrente:fiscoTotale()};
}

/* --- aliquote effettive ricavate dai dati veri --- */
function aliquoteEffettive(){
  const anno=fiscoAnnoRiferimento();
  const dp=dovutoPrecedente(anno);
  const annoRedditi=anno-1;
  const out={anno:annoRedditi,voci:[],fatturato:0,altri:0};

  if(typeof S==="undefined"||!Array.isArray(S.incomes))return out;

  /* compensi da fattura (forfettario) e altri redditi (locazioni) */
  let fatt=0,altri=0;
  S.incomes.forEach(i=>{
    const y=new Date(i.date+"T00:00:00").getFullYear();
    if(y!==annoRedditi)return;
    if(i.source==="excel")fatt+=Number(i.amount)||0;
    else altri+=Number(i.amount)||0;
  });
  out.fatturato=fatt;out.altri=altri;

  const forf=(dp.inps||0)+(dp.imposta||0);
  const alt=(dp.irpef||0)+(dp.addizionale||0);
  if(fatt>0&&forf>0)out.voci.push({tipo:"Compensi da fattura",base:fatt,dovuto:forf,
    pct:forf/fatt*100,dettaglio:"contributi "+(dp.inps?(dp.inps/fatt*100).toFixed(1):"0")+
    "% + imposta "+(dp.imposta?(dp.imposta/fatt*100).toFixed(1):"0")+"%"});
  if(altri>0&&alt>0)out.voci.push({tipo:"Altri redditi",base:altri,dovuto:alt,
    pct:alt/altri*100,dettaglio:"IRPEF e addizionale regionale"});
  return out;
}

/* ================= VISTA FISCO ================= */
function renderFisco(){
  if(!fiscoAttivo())return `
  <div class="card" style="padding:14px">
    <button class="btn btn-primary" data-act="fisco-import" style="width:100%">Carica il prospetto (PDF)</button>
  </div>
  <div class="card"><div class="empty">${icon("doc",34)}
    Nessun prospetto caricato.<br>
    Carica il PDF della commercialista: l'app ne ricava scadenze, importi<br>
    e la proiezione dell'anno prossimo.</div></div>
  <div class="card" style="padding:14px">
    <button class="btn btn-ghost" data-act="fisco-new" style="width:100%">Inserisci una scadenza a mano</button>
  </div>`;

  const anno=fiscoAnnoRiferimento();
  const nature=fiscoPerNatura();
  const tot=fiscoTotale();
  const residuo=fiscoResiduo();
  const pross=fiscoProssime();
  const next=pross[0];

  /* fondo tasse già accantonato, per il confronto */
  const fondo=(typeof taxSavedTotal==="function")?taxSavedTotal(anno):0;
  const copertura=residuo>0?Math.min(100,Math.round(fondo/residuo*100)):100;

  return `
  <div class="hero">
    <div class="hero-top"><span class="hero-month">DA VERSARE ${anno}</span></div>
    <div class="hero-total">${eur(residuo)}</div>
    <div class="hero-sub">${pross.length?pross.length+(pross.length===1?" scadenza rimanente":" scadenze rimanenti")+" · totale anno "+eur(tot):"Tutte le scadenze sono state segnate come pagate"}</div>
    ${(()=>{const sc=fiscoScadute();
      if(sc.length)return '<div class="hero-sub" style="margin-top:8px">⚠ <b>'+sc.length+
        (sc.length===1?" scadenza già passata":" scadenze già passate")+'</b> non ancora segnate come pagate</div>';
      return next?'<div class="hero-sub" style="margin-top:8px">Prossima: <b>'+fmtData(next.date)+
        '</b> · '+eur(next.voci.reduce((a,v)=>a+v.importo,0))+'</div>':"";})()}
  </div>

  ${residuo>0?`<div class="card">
    <span class="label">Copertura con il fondo tasse</span>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
      <span style="font-weight:800;font-size:20px;font-variant-numeric:tabular-nums">${eur(fondo)}</span>
      <span class="small">di ${eur(residuo)} · ${copertura}%</span>
    </div>
    <div style="height:9px;border-radius:99px;background:var(--soft);overflow:hidden;margin-bottom:10px">
      <div style="height:100%;width:${copertura}%;background:${copertura>=100?"var(--accent)":"#D9836B"};border-radius:99px;transition:width .4s"></div>
    </div>
    <div class="small">${copertura>=100
      ? "✓ Il fondo copre tutte le scadenze rimanenti."
      : "Mancano <b>"+eur(residuo-fondo)+"</b> per coprire le scadenze già note."}</div>
  </div>`:""}

  <div class="card">
    <span class="label">Composizione</span>
    <div class="donut-wrap"><canvas id="chart-fisco" width="190" height="190"></canvas>
      <div class="donut-center"><div class="n">${eurShort(tot)}</div><div class="l">${anno}</div></div></div>
    <div class="legend">
      ${nature.map(n=>'<div class="row"><span class="dot" style="background:'+n.col+'"></span>'+
        '<div class="rdesc rtitle" style="font-weight:600;font-size:14px">'+esc(n.lbl)+'</div>'+
        '<span class="ramount" style="font-size:14px">'+eur(n.val)+'</span>'+
        '<span class="pct">'+(tot?Math.round(n.val/tot*100):0)+'%</span></div>').join("")}
    </div>
  </div>

  <div class="card">
    <span class="label">Scadenze</span>
    ${fiscoScadenze().slice().sort((a,b)=>a.date<b.date?-1:1).map(s=>{
      const t=s.voci.reduce((a,v)=>a+v.importo,0);
      const scaduta=!s.pagata&&s.date<todayISO();
      const gg=daysTo(new Date(s.date+"T00:00:00"));
      const urgente=!s.pagata&&gg>=0&&gg<=15;
      return '<div class="row"'+(s.pagata?' style="opacity:.5"':'')+'>'+
        '<span class="dot" style="background:'+(s.pagata?"var(--line)":((urgente||scaduta)?"#C46A4E":"var(--accent)"))+'"></span>'+
        '<div class="rdesc"><div class="rtitle">'+fmtData(s.date)+
          (s.pagata?' <span class="rtag tag-var">pagata</span>'
            :(scaduta?'<span class="rtag tag-rec">scaduta</span>'
            :(urgente?'<span class="rtag tag-rec">tra '+gg+' gg</span>':'')))+'</div>'+
        '<div class="rmeta">'+s.voci.length+(s.voci.length===1?" voce":" voci")+
          (!s.quadra?' · <span style="color:#C46A4E">non quadra</span>':'')+'</div></div>'+
        '<div class="ramount">'+eur(t)+'</div>'+
        '<button class="iconbtn" aria-label="'+(s.pagata?"Segna da pagare":"Segna pagata")+'" data-act="fisco-pay" data-id="'+s.date+'">'+
          icon(s.pagata?"x":"check",18)+'</button>'+
        '<button class="iconbtn" aria-label="Dettaglio" data-act="fisco-detail" data-id="'+s.date+'">'+icon("chev-r",18)+'</button>'+
      '</div>';
    }).join("")}
  </div>

  ${renderAliquote()}
  ${renderProiezione()}

  <div class="card" style="padding:14px">
    <div class="frow">
      <button class="btn btn-ghost" style="flex:1" data-act="fisco-import">Ricarica PDF</button>
      <button class="btn btn-ghost" style="flex:1" data-act="fisco-clear">Azzera</button>
    </div>
  </div>`;
}

function renderAliquote(){
  const a=aliquoteEffettive();
  if(!a.voci.length)return "";
  return `
  <div class="card">
    <span class="label">Aliquota reale sui redditi ${a.anno}</span>
    <div class="small" style="margin-bottom:10px">
      Ricavata dividendo quanto risulta dovuto per quanto hai incassato: è la
      percentuale da usare nel fondo tasse al posto di una stima.
    </div>
    ${a.voci.map(v=>'<div class="row">'+
      '<div class="rdesc"><div class="rtitle">'+esc(v.tipo)+'</div>'+
      '<div class="rmeta">su '+eur(v.base)+' · '+esc(v.dettaglio)+'</div></div>'+
      '<div class="ramount" style="color:var(--accent-text)">'+v.pct.toFixed(1).replace(".",",")+'%</div>'+
      '<button class="iconbtn" aria-label="Applica" data-act="fisco-apply-rate" data-p="'+v.pct.toFixed(1)+'" data-t="'+esc(v.tipo)+'">'+icon("check",18)+'</button>'+
    '</div>').join("")}
    <div class="small" style="padding-top:8px">
      Il segno di spunta imposta questa percentuale nella categoria entrata corrispondente.
    </div>
  </div>`;
}

function renderProiezione(){
  const p=proiezioneFiscale();
  if(!p.righe.length)return "";
  const diff=p.totale-p.totaleCorrente;
  return `
  <div class="card">
    <span class="label">Proiezione ${p.annoProssimo}</span>
    <div style="font-weight:800;font-size:26px;font-variant-numeric:tabular-nums;margin:2px 0 4px">${eur(p.totale)}</div>
    <div class="small" style="margin-bottom:12px">
      ${Math.abs(diff)<50?"in linea con il "+p.anno
        :(diff<0?"<b style=\"color:var(--accent-text)\">"+eur(-diff)+" in meno</b> rispetto al "+p.anno
                :"<b style=\"color:#C46A4E\">"+eur(diff)+" in più</b> rispetto al "+p.anno)}
    </div>
    ${p.righe.map(r=>'<div style="padding:10px 0;border-bottom:1px solid var(--line)">'+
      '<div style="display:flex;justify-content:space-between;align-items:baseline">'+
        '<span style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px">'+
          '<span class="dot" style="background:'+r.col+'"></span>'+esc(r.lbl)+'</span>'+
        '<b style="font-variant-numeric:tabular-nums">'+eur(r.totale)+'</b></div>'+
      '<div class="small" style="margin-top:3px">'+
        (r.saldo>=0?'saldo '+eur(r.saldo):'<span style="color:var(--accent-text)">credito '+eur(-r.saldo)+'</span>')+
        ' + acconti '+eur(r.acconto)+'</div>'+
    '</div>').join("")}
    <div class="small" style="padding-top:12px">
      Gli acconti dell'anno prossimo non sono una stima: si calcolano su quanto risulta
      dovuto per il ${p.anno}. Varia solo il saldo, che dipende dall'incasso finale.
      ${p.ricPrec>0&&p.ricCorr>0?"<br>Base di calcolo: "+esc(p.base)+" ("+(p.fattoreUsato>=1?"+":"")+
        ((p.fattoreUsato-1)*100).toFixed(1).replace(".",",")+"%)."
        :"<br>Calcolata a parità di incassi: senza storico fatture non è possibile pesare la variazione."}
      <br><span style="opacity:.75">Percentuali di acconto usate: contributi ${Math.round(accontoPct("inps")*100)}%, imposta ${Math.round(accontoPct("imposta")*100)}%. Da confrontare con la commercialista.</span>
    </div>
  </div>`;
}

function fmtData(iso){
  const d=new Date(iso+"T00:00:00");
  return d.toLocaleDateString("it-IT",{day:"numeric",month:"long",year:"numeric"});
}

/* --- grafico composizione --- */
function drawFiscoDonut(){
  const el=document.getElementById("chart-fisco");
  if(!el||typeof Chart==="undefined")return;
  const n=fiscoPerNatura();
  if(!n.length)return;
  charts.push(new Chart(el,{type:"doughnut",
    data:{labels:n.map(x=>x.lbl),datasets:[{data:n.map(x=>x.val),
      backgroundColor:n.map(x=>x.col),borderWidth:0,spacing:2,borderRadius:5}]},
    options:{cutout:"70%",responsive:false,plugins:{legend:{display:false},
      tooltip:{callbacks:{label:c=>" "+eur(c.raw)}}}}}));
}

/* --- azioni --- */
function fiscoTogglePagata(date){
  S.fisco={...S.fisco,scadenze:fiscoScadenze().map(s=>s.date===date?{...s,pagata:!s.pagata}:s)};
  persist();render();
}
function fiscoAzzera(){
  askConfirm("Rimuovere il prospetto caricato? Le scadenze fiscali spariranno dall'app.",()=>{
    S.fisco={scadenze:[],crediti:[],lastImport:0};
    closeConfirm();persist();render();
  });
}
function fiscoApplicaAliquota(pct,tipo){
  /* imposta la percentuale sulla categoria entrata pertinente */
  const target=/fattura/i.test(tipo)?"ic-fatture":null;
  if(target){
    if(typeof ensureFattureCat==="function")ensureFattureCat();
    S.incCategories=S.incCategories.map(c=>c.id==="ic-fatture"?{...c,taxRate:Number(pct)}:c);
    S.notice="Categoria «Fatture» impostata al "+String(pct).replace(".",",")+"%.";
  }else{
    S.taxRate=Number(pct);
    S.notice="Percentuale predefinita impostata al "+String(pct).replace(".",",")+"%.";
  }
  persist();render();
}

/* ================= IMPORTAZIONE DAL PDF =================
   pdf.js viene caricato solo quando serve: è una libreria pesante e non
   deve rallentare l'avvio dell'app. */
const PDFJS_URL="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
let pdfjsPronto=null;
function caricaPdfJs(){
  if(pdfjsPronto)return pdfjsPronto;
  pdfjsPronto=new Promise((ris,rif)=>{
    if(window.pdfjsLib){
      window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;return ris(window.pdfjsLib);
    }
    const s=document.createElement("script");
    s.src=PDFJS_URL;
    s.onload=()=>{
      if(!window.pdfjsLib)return rif(new Error("libreria non disponibile"));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;
      ris(window.pdfjsLib);
    };
    s.onerror=()=>rif(new Error("impossibile scaricare il lettore PDF"));
    document.head.appendChild(s);
  });
  return pdfjsPronto;
}

async function fiscoImportPdf(file){
  if(!file)return;
  S.busy="Lettura del prospetto…";render();
  try{
    const lib=await caricaPdfJs();
    const buf=await file.arrayBuffer();
    const pdf=await lib.getDocument({data:buf}).promise;
    let righe=[];
    for(let p=1;p<=pdf.numPages;p++){
      const pag=await pdf.getPage(p);
      const tc=await pag.getTextContent();
      const items=tc.items.filter(i=>String(i.str).trim()).map(i=>({
        s:i.str, x:i.transform[4], y:i.transform[5]
      }));
      righe=righe.concat(fiscoLinesFromPdf(items));
    }
    const p=parseProspetto(righe);
    S.busy="";
    if(!p.scadenze.length){
      S.error="Nel PDF non ho trovato scadenze riconoscibili. Puoi inserirle a mano.";
      render();return;
    }
    /* si conservano le scadenze già segnate come pagate */
    const pagate=new Set(fiscoScadenze().filter(s=>s.pagata).map(s=>s.date));
    S.fisco={
      scadenze:p.scadenze.map(s=>({...s,pagata:pagate.has(s.date)})),
      crediti:p.crediti, netto:p.netto, lastImport:Date.now()
    };
    const avvisi=p.errori.length?" ("+p.errori.length+" da verificare)":"";
    S.notice=p.scadenze.length+" scadenze lette per "+eur(p.totale)+avvisi+".";
    if(!p.quadra)S.error="Il totale calcolato non coincide con quello del documento: controlla le voci.";
    persist();render();
  }catch(err){
    S.busy="";
    S.error="Lettura del PDF non riuscita ("+(err&&err.message?err.message:"errore")+"). Puoi inserire le scadenze a mano.";
    render();
  }
}

/* ================= INSERIMENTO E MODIFICA A MANO ================= */
let fiscoEditDate=null;
function openFiscoScad(date){
  const s=date?fiscoScadenze().find(x=>x.date===date):null;
  fiscoEditDate=date||null;
  document.getElementById("fis-title").textContent=s?"Modifica scadenza":"Nuova scadenza";
  document.getElementById("fis-date").value=s?s.date:todayISO();
  document.getElementById("fis-voci").value=s
    ? s.voci.map(v=>[v.code,v.anno,v.rata||"",String(v.importo).replace(".",",")].join(" | ")).join("\n")
    : "";
  document.getElementById("fis-del").style.display=s?"block":"none";
  document.getElementById("fis-overlay").classList.add("open");
}
function closeFiscoScad(){fiscoEditDate=null;document.getElementById("fis-overlay").classList.remove("open");}
function saveFiscoScad(){
  const date=document.getElementById("fis-date").value;
  if(!date)return;
  const righe=String(document.getElementById("fis-voci").value||"").split("\n")
    .map(r=>r.trim()).filter(Boolean);
  const voci=[];
  righe.forEach(r=>{
    const p=r.split("|").map(x=>x.trim());
    if(p.length<2)return;
    const imp=euroNum(p[3]!=null&&p[3]!==""?p[3]:p[p.length-1]);
    if(isNaN(imp))return;
    const info=tributoInfo(p[0]);
    voci.push({code:String(p[0]).toUpperCase(),desc:info.lbl,
      anno:Number(p[1])||new Date().getFullYear(),
      rata:p[2]?Number(p[2]):null,importo:imp});
  });
  if(!voci.length){S.error="Nessuna voce valida: usa il formato CODICE | ANNO | RATA | IMPORTO.";render();return;}
  const somma=Math.round(voci.reduce((a,v)=>a+v.importo,0)*100)/100;
  const nuova={date,voci,totale:somma,somma,quadra:true,pagata:false};
  let sc=fiscoScadenze().slice();
  if(fiscoEditDate){
    const prec=sc.find(x=>x.date===fiscoEditDate);
    if(prec)nuova.pagata=!!prec.pagata;
    sc=sc.filter(x=>x.date!==fiscoEditDate);
  }
  sc=sc.filter(x=>x.date!==date).concat([nuova]).sort((a,b)=>a.date<b.date?-1:1);
  S.fisco={...(S.fisco||{}),scadenze:sc};
  closeFiscoScad();persist();render();
}
function deleteFiscoScad(){
  if(!fiscoEditDate)return;
  const d=fiscoEditDate;
  closeFiscoScad();
  askConfirm("Eliminare la scadenza del "+fmtData(d)+"?",()=>{
    S.fisco={...(S.fisco||{}),scadenze:fiscoScadenze().filter(x=>x.date!==d)};
    closeConfirm();persist();render();
  });
}

/* dettaglio di una scadenza */
function openFiscoDetail(date){
  const s=fiscoScadenze().find(x=>x.date===date);
  if(!s)return;
  const tot=s.voci.reduce((a,v)=>a+v.importo,0);
  document.getElementById("fdet-title").textContent=fmtData(s.date);
  document.getElementById("fdet-sub").textContent=eur(tot)+(s.pagata?" · già pagata":"");
  document.getElementById("fdet-body").innerHTML=s.voci.map(v=>{
    const t=tributoInfo(v.code);
    return '<div class="row"><span class="dot" style="background:'+naturaCol(t.nat)+'"></span>'+
      '<div class="rdesc"><div class="rtitle">'+esc(t.lbl)+'</div>'+
      '<div class="rmeta">cod. '+esc(v.code)+' · comp. '+v.anno+(v.rata?" · rata "+v.rata:"")+'</div></div>'+
      '<div class="ramount">'+eur(v.importo)+'</div></div>';
  }).join("");
  document.getElementById("fdet-edit").dataset.id=date;
  document.getElementById("fdet-overlay").classList.add("open");
}
function closeFiscoDetail(){document.getElementById("fdet-overlay").classList.remove("open");}
