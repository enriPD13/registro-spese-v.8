/* ================= EVENTS ================= */
document.addEventListener("click",ev=>{
  const t=ev.target.closest("[data-act],[data-fcat],[data-ffreq],[data-ifreq],[data-icat],[data-tcat],[data-tfreq],[data-ccolor],[data-gcolor],[data-rcolor]");
  if(!t)return;
  if(t.dataset.fcat!==undefined){
    document.querySelectorAll("#f-cats .chip").forEach(x=>x.classList.remove("active"));
    t.classList.add("active");return;
  }
  if(t.dataset.ffreq!==undefined){
    document.querySelectorAll("#f-freqs .chip").forEach(x=>x.classList.remove("active"));
    t.classList.add("active");return;
  }
  if(t.dataset.ifreq!==undefined){
    document.querySelectorAll("#i-freqs .chip").forEach(x=>x.classList.remove("active"));
    t.classList.add("active");return;
  }
  if(t.dataset.icat!==undefined){
    document.querySelectorAll("#i-cats .chip").forEach(x=>x.classList.remove("active"));
    t.classList.add("active");return;
  }
  if(t.dataset.tcat!==undefined){
    document.querySelectorAll("#t-cats .chip").forEach(x=>x.classList.remove("active"));
    t.classList.add("active");return;
  }
  if(t.dataset.tfreq!==undefined){
    document.querySelectorAll("#t-freqs .chip").forEach(x=>x.classList.remove("active"));
    t.classList.add("active");return;
  }
  if(t.dataset.ccolor!==undefined){
    catColorSel=t.dataset.ccolor;renderCatColors();return;
  }
  if(t.dataset.rcolor!==undefined){
    rateColorSel=t.dataset.rcolor;
    document.getElementById("r-colors").innerHTML=rateColorsHtml();return;
  }
  if(t.dataset.gcolor!==undefined){
    goalColorSel=t.dataset.gcolor;document.getElementById("g-colors").innerHTML=goalColorsHtml();return;
  }
  const act=t.dataset.act;
  if(act==="tab"){
    const id=t.dataset.id;
    if(id==="altro"){document.getElementById("altro-overlay").classList.add("open");return;}
    S.tab=id;S.selDay=null;render();
  }
  else if(act==="go"){
    document.getElementById("altro-overlay").classList.remove("open");
    S.tab=t.dataset.id;render();
  }
  else if(act==="month"){const d=new Date(S.viewY,S.viewM+Number(t.dataset.d),1);S.viewY=d.getFullYear();S.viewM=d.getMonth();render();}
  else if(act==="cal-month"){const d=new Date(S.calY,S.calM+Number(t.dataset.d),1);S.calY=d.getFullYear();S.calM=d.getMonth();S.selDay=null;render();}
  else if(act==="cal-day"){S.selDay=Number(t.dataset.d);render();}
  else if(act==="cal-filter"){S.calFilter=t.dataset.id;render();}
  else if(act==="range"){S.chartRange=Number(t.dataset.n);render();}
  else if(act==="fc-mode"){S.fcMode=t.dataset.id;render();}
  else if(act==="cal-sync"){calSync(false);}
  else if(act==="cal-ignore"){calToggleIgnore(t.dataset.id,t.dataset.n||"");}
  else if(act==="ag-month"){
    const now=new Date();
    let y=(S.agY==null?now.getFullYear():S.agY), m=(S.agM==null?now.getMonth():S.agM);
    const d=new Date(y,m+Number(t.dataset.d),1);
    S.agY=d.getFullYear();S.agM=d.getMonth();S.agSelDay=null;render();
  }
  else if(act==="ag-day"){
    const n=Number(t.dataset.d);
    S.agSelDay=(S.agSelDay===n?null:n);render();
  }
  else if(act==="ag-all"){S.agSelDay=null;render();}
  else if(act==="rate-new"){openRate(null);}
  else if(act==="rate-edit"){openRate(t.dataset.id);}
  else if(act==="rate-from"){openRate(null,t.dataset.id);}
  else if(act==="rate-del"){deleteWithUndo(()=>S.rates,a=>S.rates=a,t.dataset.id,"Tariffa");}
  else if(act==="hours-save"){
    const dh=euroNum(document.getElementById("dayhours").value);
    const mh=euroNum(document.getElementById("maxhours").value);
    const bs=document.getElementById("brk-start").value;
    const be=document.getElementById("brk-end").value;
    if(dh>0&&dh<=24)S.calDayHours=dh;
    S.calMaxHours=(isNaN(mh)||mh<=0)?0:Math.min(24,mh);
    if(bs)S.calBreakStart=bs;
    if(be)S.calBreakEnd=be;
    S.notice="Impostazioni ore aggiornate.";
    persist();render();
  }
  else if(act==="fc-ceiling"){
    document.getElementById("ceil-val").value=S.fcCeiling!=null?S.fcCeiling:"";
    document.getElementById("ceil-overlay").classList.add("open");
  }
  else if(act==="filter"){S.filterCat=t.dataset.id;render();}
  else if(act==="search-clear"){S.search="";render();}
  else if(act==="edit"){const e=S.expenses.find(x=>x.id===t.dataset.id);if(e){S.editId=e.id;openForm({...e,amount:e.amount!=null?String(e.amount):"",freq:e.freq||"mensile"});}}
  else if(act==="del"){deleteWithUndo(()=>S.expenses,a=>S.expenses=a,t.dataset.id,"Spesa");}
  else if(act==="cat-new"){openCat(null,"exp");}
  else if(act==="cat-edit"){openCat(t.dataset.id,"exp");}
  else if(act==="goal-new"){openGoal(null);}
  else if(act==="goal-edit"){openGoal(t.dataset.id);}
  else if(act==="goal-del"){deleteWithUndo(()=>S.goals,a=>S.goals=a,t.dataset.id,"Obiettivo");}
  else if(act==="goal-add-money"){openMove(t.dataset.id,1);}
  else if(act==="goal-take-money"){openMove(t.dataset.id,-1);}
  else if(act==="tax-settings"){openTax();}
  else if(act==="tax-add"){openTaxMove();}
  else if(act==="icat-new"){openCat(null,"inc");}
  else if(act==="icat-edit"){openCat(t.dataset.id,"inc");}
  else if(act==="icat-del"){
    const id=t.dataset.id;const c=incCatById(id);
    askConfirm("Eliminare la categoria \""+c.name+"\"? Le entrate collegate passeranno ad \"Altro\".",()=>{
      S.incomes=S.incomes.map(i=>i.categoryId===id?{...i,categoryId:"ic-altro"}:i);
      S.incCategories=S.incCategories.filter(c=>c.id!==id);persist();closeConfirm();render();
    });
  }
  else if(act==="delcat"){
    const id=t.dataset.id;const c=catById(id);
    askConfirm("Eliminare la categoria \""+c.name+"\"? Le spese collegate passeranno ad \"Altro\".",()=>{
      S.expenses=S.expenses.map(e=>e.categoryId===id?{...e,categoryId:"altro"}:e);
      S.categories=S.categories.filter(c=>c.id!==id);persist();closeConfirm();render();
    });
  }
  else if(act==="savekey"){S.apiKey=document.getElementById("apikey").value.trim();S.notice="Chiave API salvata.";persist();render();}
  else if(act==="g-save"){S.gClientId=document.getElementById("gclientid").value.trim();gTC=null;S.notice="Client ID salvato. Ora premi \"Sincronizza\".";persistLocal();render();}
  else if(act==="g-sync"){gSync();}
  else if(act==="templates"){openTpl();}
  else if(act==="tpl-edit"){openTpe(t.dataset.id);}
  else if(act==="tpl-del"){const tp=S.templates.find(x=>x.id===t.dataset.id);askConfirm("Rimuovere la voce \""+(tp?tp.desc:"")+"\" dal catalogo?",()=>{S.templates=S.templates.filter(x=>x.id!==t.dataset.id);persist();closeConfirm();openTpl();});}
  else if(act==="tpl-new"){openTpe(null);}
  else if(act==="year"){S.viewY+=Number(t.dataset.d);render();}
  else if(act==="inc-drive"){syncInvoices(false);}
  else if(act==="inc-new"){openInc(null);}
  else if(act==="inc-edit"){openInc(t.dataset.id);}
  else if(act==="inc-del"){deleteWithUndo(()=>S.incomes,a=>S.incomes=a,t.dataset.id,"Entrata");}
  else if(act==="imp-excel"){document.getElementById("xls-input").click();}
  else if(act==="bill"){openBill(t.dataset.id);}
  else if(act==="update"){forceUpdate();}
  else if(act==="dedup-incomes"){
    const seen=new Set();const kept=[];
    S.incomes.forEach(i=>{
      const k=i.date+"|"+i.amount+"|"+String(i.desc).toLowerCase()+"|"+(i.recurring?"r":"o");
      if(seen.has(k))return;seen.add(k);kept.push(i);
    });
    const removed=S.incomes.length-kept.length;
    S.incomes=kept;
    S.notice=removed+(removed===1?" duplicato rimosso.":" duplicati rimossi.");
    persist();render();
  }
  else if(act==="clear-invoices"){
    const before=S.incomes.filter(i=>i.source==="excel").length;
    askConfirm("Azzerare tutte le "+before+" fatture importate da Excel? Le entrate manuali restano. Potrai reimportarle con \"Aggiorna da Drive\".",()=>{
      S.incomes=S.incomes.filter(i=>i.source!=="excel");
      S.notice=before+(before===1?" fattura rimossa.":" fatture rimosse.")+" Usa \"Aggiorna da Drive\".";
      persist();closeConfirm();render();
    });
  }
  else if(act==="export")exportBackup();
  else if(act==="snap-restore"){
    const day=t.dataset.id;
    const snap=snapshots.restore(day);
    if(!snap){S.error="Copia non trovata.";render();return;}
    const dl=new Date(day+"T00:00:00").toLocaleDateString("it-IT",{day:"numeric",month:"long"});
    askConfirm("Ripristinare i dati del "+dl+"? Le modifiche fatte dopo quella data andranno perse.",()=>{
      if(Array.isArray(snap.expenses))S.expenses=snap.expenses;
      if(Array.isArray(snap.categories)&&snap.categories.length)S.categories=snap.categories;
      if(Array.isArray(snap.templates)&&snap.templates.length)S.templates=snap.templates;
      if(Array.isArray(snap.incomes))S.incomes=snap.incomes;
      if(Array.isArray(snap.incCategories)&&snap.incCategories.length)S.incCategories=snap.incCategories;
      if(Array.isArray(snap.goals))S.goals=snap.goals;
      if(typeof snap.taxRate==="number")S.taxRate=snap.taxRate;
      if(Array.isArray(snap.taxSaved))S.taxSaved=snap.taxSaved;
      S.notice="Dati ripristinati alla copia del "+dl+".";
      persist();closeConfirm();render();
    },"Ripristina");
  }
  else if(act==="import")document.getElementById("import-input").click();
  else if(act==="clear-notice"){S.notice="";render();}
  else if(act==="clear-error"){S.error="";render();}
});
document.getElementById("btn-add").addEventListener("click",()=>{
  if(S.tab==="entrate"){openInc(null);}
  else{S.editId=null;openForm();}
});
document.getElementById("btn-scan").addEventListener("click",()=>document.getElementById("scan-input").click());
document.getElementById("scan-input").addEventListener("change",ev=>{
  const f=ev.target.files&&ev.target.files[0];ev.target.value="";scan(f);
});
document.getElementById("btn-cancel").addEventListener("click",closeForm);
document.getElementById("btn-save").addEventListener("click",saveForm);
document.getElementById("form-overlay").addEventListener("click",ev=>{
  if(ev.target.id==="form-overlay")closeForm();
});
document.getElementById("f-rec-toggle").addEventListener("click",()=>{
  const cb=document.getElementById("f-rec");cb.checked=!cb.checked;
  document.getElementById("f-rec-toggle").classList.toggle("on",cb.checked);
  document.getElementById("f-freq-wrap").style.display=cb.checked?"block":"none";
  document.getElementById("f-var-wrap").style.display=cb.checked?"block":"none";
  document.getElementById("f-date-label").textContent=cb.checked?"Prima scadenza":"Data";
});
document.getElementById("f-var-toggle").addEventListener("click",()=>{
  const cb=document.getElementById("f-var");cb.checked=!cb.checked;
  document.getElementById("f-var-toggle").classList.toggle("on",cb.checked);
});
document.getElementById("cat-cancel").addEventListener("click",closeCat);
document.getElementById("cat-save").addEventListener("click",saveCat);
document.getElementById("cat-overlay").addEventListener("click",ev=>{
  if(ev.target.id==="cat-overlay")closeCat();
});
document.getElementById("tpl-cancel").addEventListener("click",closeTpl);
document.getElementById("tpl-add").addEventListener("click",addTemplates);
document.getElementById("tpl-overlay").addEventListener("click",ev=>{
  if(ev.target.id==="tpl-overlay")closeTpl();
});
document.getElementById("tpe-cancel").addEventListener("click",closeTpe);
document.getElementById("tpe-save").addEventListener("click",saveTpe);
document.getElementById("tpe-overlay").addEventListener("click",ev=>{
  if(ev.target.id==="tpe-overlay")closeTpe();
});
document.getElementById("i-rec-toggle").addEventListener("click",()=>{
  const cb=document.getElementById("i-rec");cb.checked=!cb.checked;
  document.getElementById("i-rec-toggle").classList.toggle("on",cb.checked);
  document.getElementById("i-freq-wrap").style.display=cb.checked?"block":"none";
  document.getElementById("i-date-label").textContent=cb.checked?"Prima data":"Data";
});
document.getElementById("inc-cancel").addEventListener("click",closeInc);
document.getElementById("inc-save").addEventListener("click",saveInc);
document.getElementById("inc-overlay").addEventListener("click",ev=>{
  if(ev.target.id==="inc-overlay")closeInc();
});
document.getElementById("imp-cancel").addEventListener("click",()=>{pendingImport=null;document.getElementById("imp-overlay").classList.remove("open");});
document.getElementById("imp-confirm").addEventListener("click",confirmImport);
document.getElementById("imp-overlay").addEventListener("click",ev=>{
  if(ev.target.id==="imp-overlay"){pendingImport=null;document.getElementById("imp-overlay").classList.remove("open");}
});
document.getElementById("goal-cancel").addEventListener("click",closeGoal);
document.getElementById("goal-save").addEventListener("click",saveGoal);
document.getElementById("goal-overlay").addEventListener("click",ev=>{if(ev.target.id==="goal-overlay")closeGoal();});
document.getElementById("move-cancel").addEventListener("click",closeMove);
document.getElementById("move-save").addEventListener("click",saveMove);
document.getElementById("move-overlay").addEventListener("click",ev=>{if(ev.target.id==="move-overlay")closeMove();});
document.getElementById("tax-cancel").addEventListener("click",closeTax);
document.getElementById("tax-save").addEventListener("click",saveTax);
document.getElementById("tax-overlay").addEventListener("click",ev=>{if(ev.target.id==="tax-overlay")closeTax();});
document.getElementById("txmove-cancel").addEventListener("click",closeTaxMove);
document.getElementById("txmove-save").addEventListener("click",saveTaxMove);
document.getElementById("txmove-overlay").addEventListener("click",ev=>{if(ev.target.id==="txmove-overlay")closeTaxMove();});
document.getElementById("rate-cancel").addEventListener("click",closeRate);
document.getElementById("rate-save").addEventListener("click",saveRate);
document.getElementById("rate-overlay").addEventListener("click",ev=>{if(ev.target.id==="rate-overlay")closeRate();});
document.getElementById("ceil-cancel").addEventListener("click",()=>document.getElementById("ceil-overlay").classList.remove("open"));
document.getElementById("ceil-save").addEventListener("click",()=>{
  const v=document.getElementById("ceil-val").value.trim();
  S.fcCeiling=v===""?null:(euroNum(v)||null);
  document.getElementById("ceil-overlay").classList.remove("open");
  persist();render();
});
document.getElementById("ceil-overlay").addEventListener("click",ev=>{if(ev.target.id==="ceil-overlay")document.getElementById("ceil-overlay").classList.remove("open");});
document.getElementById("confirm-no").addEventListener("click",closeConfirm);
document.getElementById("confirm-yes").addEventListener("click",()=>{if(confirmCb)confirmCb();});
document.getElementById("confirm-overlay").addEventListener("click",ev=>{if(ev.target.id==="confirm-overlay")closeConfirm();});
document.getElementById("toast-action").addEventListener("click",()=>{if(undoCb)undoCb();});
document.getElementById("bill-cancel").addEventListener("click",closeBill);
document.getElementById("bill-save").addEventListener("click",saveBill);
document.getElementById("bill-overlay").addEventListener("click",ev=>{
  if(ev.target.id==="bill-overlay")closeBill();
});
document.getElementById("altro-overlay").addEventListener("click",ev=>{
  if(ev.target.id==="altro-overlay")document.getElementById("altro-overlay").classList.remove("open");
});
document.addEventListener("change",ev=>{
  if(ev.target.id==="import-input"){
    const f=ev.target.files&&ev.target.files[0];ev.target.value="";
    if(f)importBackup(f);
  }
  if(ev.target.id==="xls-input"){
    const f=ev.target.files&&ev.target.files[0];ev.target.value="";
    if(f)importExcel(f);
  }
});

let searchTimer=null;
function afterRender(){
  if(S.tab==="riepilogo"){drawCharts();animateTotal();}
  if(S.tab==="entrate")drawIncomeCharts();
  if(S.tab==="previsioni"){
    if((S.fcMode||"mesi")==="mesi")drawForecastChart();
    else drawForecastYearsChart();
  }
  const sb=document.getElementById("search-box");
  if(sb){
    sb.addEventListener("input",ev=>{
      S.search=ev.target.value;
      clearTimeout(searchTimer);
      searchTimer=setTimeout(()=>{searchFocus=true;render();},260);
    });
    if(searchFocus){                 // ridà il fuoco e rimette il cursore in fondo
      searchFocus=false;
      sb.focus();
      const v=sb.value;sb.value="";sb.value=v;
    }
  }
}
let searchFocus=false;

/* ================= NATIVE-LIKE GESTURES ================= */
// Block pinch-zoom (Safari gesture events) and double-tap zoom
document.addEventListener("gesturestart",e=>e.preventDefault());
document.addEventListener("gesturechange",e=>e.preventDefault());
document.addEventListener("gestureend",e=>e.preventDefault());
let lastTouchEnd=0;
document.addEventListener("touchend",e=>{
  const now=Date.now();
  if(now-lastTouchEnd<=300)e.preventDefault();
  lastTouchEnd=now;
},{passive:false});
// Block multi-touch pinch
document.addEventListener("touchmove",e=>{if(e.touches.length>1)e.preventDefault();},{passive:false});
