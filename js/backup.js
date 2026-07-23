/* ================= BACKUP ================= */
function exportBackup(){
  const blob=new Blob([JSON.stringify({expenses:S.expenses,categories:S.categories,templates:S.templates,incomes:S.incomes,incCategories:S.incCategories,goals:S.goals,taxRate:S.taxRate,taxSaved:S.taxSaved,fcCeiling:S.fcCeiling,rates:S.rates,calDayHours:S.calDayHours,calBreakStart:S.calBreakStart,calBreakEnd:S.calBreakEnd,calMaxHours:S.calMaxHours},null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="registro-spese-backup-"+todayISO()+".json";
  a.click();URL.revokeObjectURL(a.href);
}
function importBackup(file){
  const r=new FileReader();
  r.onload=()=>{
    try{
      const d=JSON.parse(r.result);
      if(Array.isArray(d.expenses))S.expenses=d.expenses;
      if(Array.isArray(d.categories)&&d.categories.length)S.categories=d.categories;
      if(Array.isArray(d.templates)&&d.templates.length)S.templates=d.templates;
      if(Array.isArray(d.incomes))S.incomes=d.incomes;
      if(Array.isArray(d.incCategories)&&d.incCategories.length)S.incCategories=d.incCategories;
      if(Array.isArray(d.goals))S.goals=d.goals;
      if(typeof d.taxRate==="number")S.taxRate=d.taxRate;
      if(Array.isArray(d.taxSaved))S.taxSaved=d.taxSaved;
      if(d.fcCeiling!=null)S.fcCeiling=Number(d.fcCeiling)||null;
      if(Array.isArray(d.rates))S.rates=d.rates;
      if(d.calDayHours)S.calDayHours=Number(d.calDayHours)||8;
      if(d.calBreakStart)S.calBreakStart=d.calBreakStart;
      if(d.calBreakEnd)S.calBreakEnd=d.calBreakEnd;
      if(d.calMaxHours!=null)S.calMaxHours=Number(d.calMaxHours)||0;
      S.notice="Backup importato: "+S.expenses.length+" spese, "+S.incomes.length+" entrate.";
      persist();render();
    }catch(e){S.error="File di backup non valido.";render();}
  };
  r.readAsText(file);
}

/* ================= UPDATE ================= */
async function forceUpdate(){
  try{
    if("caches" in window){
      const keys=await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));
    }
    if("serviceWorker" in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister()));
    }
  }catch(e){}
  location.reload();
}
