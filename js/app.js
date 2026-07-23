/* ================= INIT ================= */
(async function(){
  mountStaticIcons();
  await store.init();
  const data=await store.load();
  if(data){
    if(Array.isArray(data.expenses))S.expenses=data.expenses;
    if(Array.isArray(data.categories)&&data.categories.length)S.categories=data.categories;
    if(typeof data.apiKey==="string")S.apiKey=data.apiKey;
    if(Array.isArray(data.templates)&&data.templates.length)S.templates=data.templates;
    if(typeof data.gClientId==="string")S.gClientId=data.gClientId;
    if(data.lastSync)S.lastSync=data.lastSync;
    if(data.savedAt)S.savedAt=data.savedAt;
    if(Array.isArray(data.incomes))S.incomes=data.incomes;
    if(data.lastInvoiceSync)S.lastInvoiceSync=data.lastInvoiceSync;
    if(Array.isArray(data.incCategories)&&data.incCategories.length)S.incCategories=data.incCategories;
    if(Array.isArray(data.goals))S.goals=data.goals;
    if(typeof data.taxRate==="number")S.taxRate=data.taxRate;
    if(Array.isArray(data.taxSaved))S.taxSaved=data.taxSaved;
    if(data.fcCeiling!=null)S.fcCeiling=Number(data.fcCeiling)||null;
    if(Array.isArray(data.rates))S.rates=data.rates;
    if(Array.isArray(data.calEvents))S.calEvents=data.calEvents;
    if(Array.isArray(data.calList))S.calList=data.calList;
    if(data.calLastSync)S.calLastSync=data.calLastSync;
    if(data.calDayHours)S.calDayHours=Number(data.calDayHours)||8;
    if(data.calBreakStart)S.calBreakStart=data.calBreakStart;
    if(data.calBreakEnd)S.calBreakEnd=data.calBreakEnd;
    if(data.calMaxHours!=null)S.calMaxHours=Number(data.calMaxHours)||0;
  }
  if(!S.templates.length)S.templates=DEFAULT_TEMPLATES.map(t=>({...t}));
  render();
  if("serviceWorker" in navigator&&location.protocol==="https:"){
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  }
  // Silent Drive sync on startup if a Client ID is configured (waits for the GIS lib).
  if(S.gClientId){
    let tries=0;
    const t=setInterval(()=>{
      tries++;
      if(window.google&&google.accounts&&google.accounts.oauth2){
        clearInterval(t);
        try{gAutoSync();}catch(e){}
      }else if(tries>30){clearInterval(t);}
    },400);
  }
})();
