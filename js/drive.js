/* ================= GOOGLE DRIVE SYNC ================= */
let gTokenObj=null,gTC=null,pushTimer=null;
function gTokenValid(){return gTokenObj&&gTokenObj.exp>Date.now();}
function gEnsureClient(){
  if(!S.gClientId)return null;
  if(!(window.google&&google.accounts&&google.accounts.oauth2))return null;
  if(!gTC){
    gTC=google.accounts.oauth2.initTokenClient({
      client_id:S.gClientId,
      scope:"https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.readonly",
      callback:(resp)=>{
        if(resp&&resp.access_token){
          gTokenObj={token:resp.access_token,exp:Date.now()+((resp.expires_in||3600)-60)*1000};
          syncNow();
        }else{S.error="Accesso Google non riuscito.";render();}
      },
    });
  }
  return gTC;
}
function gAutoSync(){
  const tc=gEnsureClient();
  if(!tc)return;
  if(gTokenValid()){syncNow();return;}
  // prompt:"none" => no popup; succeeds only if already consented this browser
  try{tc.requestAccessToken({prompt:"none"});}catch(e){}
}
function gSync(){
  const tc=gEnsureClient();
  if(!tc){S.error=S.gClientId?"Libreria Google non ancora caricata: riprova tra qualche secondo.":"Inserisci e salva prima il Client ID.";render();return;}
  if(gTokenValid()){syncNow();return;}
  tc.requestAccessToken({prompt:""});
}
async function gFetch(url,opt){
  opt=opt||{};
  opt.headers=Object.assign({},opt.headers,{Authorization:"Bearer "+gTokenObj.token});
  const r=await fetch(url,opt);
  if(!r.ok)throw new Error("Google Drive "+r.status);
  return r;
}
async function driveFind(){
  const r=await gFetch("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)&q="+
    encodeURIComponent("name='registro-spese.json'"));
  const j=await r.json();
  return (j.files&&j.files[0])||null;
}
function drivePayload(){
  return JSON.stringify({expenses:S.expenses,categories:S.categories,apiKey:S.apiKey,
    templates:S.templates,incomes:S.incomes,incCategories:S.incCategories,goals:S.goals,taxRate:S.taxRate,taxSaved:S.taxSaved,savedAt:S.savedAt||0});
}
async function drivePush(fileId){
  const body=drivePayload();
  if(fileId){
    await gFetch("https://www.googleapis.com/upload/drive/v3/files/"+fileId+"?uploadType=media",
      {method:"PATCH",headers:{"Content-Type":"application/json"},body});
  }else{
    const meta={name:"registro-spese.json",parents:["appDataFolder"]};
    const bd="rsb"+Date.now();
    const mp="--"+bd+"\r\nContent-Type: application/json\r\n\r\n"+JSON.stringify(meta)+
      "\r\n--"+bd+"\r\nContent-Type: application/json\r\n\r\n"+body+"\r\n--"+bd+"--";
    await gFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {method:"POST",headers:{"Content-Type":"multipart/related; boundary="+bd},body:mp});
  }
}
async function syncNow(){
  try{
    const f=await driveFind();
    if(f){
      const r=await gFetch("https://www.googleapis.com/drive/v3/files/"+f.id+"?alt=media");
      const remote=await r.json();
      const rAt=Number(remote.savedAt||0),lAt=Number(S.savedAt||0);
      if(rAt>lAt){
        if(Array.isArray(remote.expenses))S.expenses=remote.expenses;
        if(Array.isArray(remote.categories)&&remote.categories.length)S.categories=remote.categories;
        if(Array.isArray(remote.templates)&&remote.templates.length)S.templates=remote.templates;
        if(typeof remote.apiKey==="string"&&remote.apiKey&&!S.apiKey)S.apiKey=remote.apiKey;
        if(Array.isArray(remote.incomes))S.incomes=remote.incomes;
        if(Array.isArray(remote.incCategories)&&remote.incCategories.length)S.incCategories=remote.incCategories;
        if(Array.isArray(remote.goals))S.goals=remote.goals;
        if(typeof remote.taxRate==="number")S.taxRate=remote.taxRate;
        if(Array.isArray(remote.taxSaved))S.taxSaved=remote.taxSaved;
        S.savedAt=rAt;
        S.notice="Dati aggiornati da Google Drive (versione più recente).";
      }else{
        await drivePush(f.id);
        S.notice="Dati salvati su Google Drive.";
      }
    }else{
      await drivePush(null);
      S.notice="Primo backup creato su Google Drive.";
    }
    S.lastSync=Date.now();
    await persistLocal();
    syncInvoices(true);
  }catch(err){
    S.error="Sincronizzazione non riuscita ("+(err&&err.message?err.message:"errore")+").";
  }
  render();
}
function schedulePush(){
  if(!gTokenValid())return;
  clearTimeout(pushTimer);
  pushTimer=setTimeout(async()=>{
    try{
      const f=await driveFind();
      await drivePush(f&&f.id);
      S.lastSync=Date.now();
      await persistLocal();
    }catch(e){}
  },1500);
}

/* ================= DRIVE: INVOICE FILE ================= */
function ensureFattureCat(){
  let c=S.incCategories.find(x=>x.id==="ic-fatture");
  if(!c){
    c={id:"ic-fatture",name:"Fatture",color:"#0FA36B",taxRate:33};
    S.incCategories.push(c);
  }
  return c.id;
}
const INVOICE_NAME="Riepilogo_2026.xlsx";
const INVOICE_RE=/^Riepilogo_(\d{4})\.xlsx$/i;
const MESE_IDX={GENNAIO:0,FEBBRAIO:1,MARZO:2,APRILE:3,MAGGIO:4,GIUGNO:5,LUGLIO:6,AGOSTO:7,SETTEMBRE:8,OTTOBRE:9,NOVEMBRE:10,DICEMBRE:11};
async function driveFindInvoices(){
  const q="name contains 'Riepilogo_' and mimeType!='application/vnd.google-apps.folder' and trashed=false";
  const r=await gFetch("https://www.googleapis.com/drive/v3/files?fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&q="+encodeURIComponent(q));
  const j=await r.json();
  return (j.files||[]).filter(f=>INVOICE_RE.test(f.name));
}
function isoFrom(v){
  if(v instanceof Date&&!isNaN(v))return v.getFullYear()+"-"+String(v.getMonth()+1).padStart(2,"0")+"-"+String(v.getDate()).padStart(2,"0");
  if(typeof v==="string"){const m=v.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return m[1]+"-"+m[2]+"-"+m[3];}
  if(typeof v==="number"&&v>20000&&v<80000){const d=new Date(Math.round((v-25569)*86400000));return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
  return null;
}
function parseInvoiceWorkbook(buf,fileYear){
  const wb=XLSX.read(buf,{type:"array",cellDates:true});
  const ws=wb.Sheets["Foglio1"]||wb.Sheets[wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
  if(!rows.length)return [];
  const head=rows[0].map(c=>String(c||"").trim().toUpperCase());
  const col=n=>head.findIndex(h=>h===n);
  const ci={num:col("NUMERO"),ente:col("ENTE"),mese:col("MESE"),imp:col("IMPORTO"),df:col("DATA FATTURA"),dp:col("DATA PAGAMENTO")};
  const yr=fileYear||2026;
  const forceYear=iso=>{ // keep month/day, force filename year
    if(!iso)return null;
    const m=iso.match(/^\d{4}-(\d{2})-(\d{2})/);
    return m?(yr+"-"+m[1]+"-"+m[2]):null;
  };
  const out=[];
  for(let r=1;r<rows.length;r++){
    const row=rows[r];if(!row)continue;
    const amount=Number(row[ci.imp]);
    if(!amount||amount<=0)continue;
    let iso=ci.df>-1?forceYear(isoFrom(row[ci.df])):null;
    if(!iso&&ci.mese>-1){const mi=MESE_IDX[String(row[ci.mese]||"").trim().toUpperCase()];if(mi!=null)iso=yr+"-"+String(mi+1).padStart(2,"0")+"-01";}
    if(!iso)continue;
    const ente=ci.ente>-1&&row[ci.ente]!=null?String(row[ci.ente]).trim():"Fattura";
    const num=ci.num>-1?row[ci.num]:null;
    const paid=ci.dp>-1?forceYear(isoFrom(row[ci.dp])):null;
    out.push({num,year:yr,desc:ente,amount,date:iso,paid});
  }
  return out;
}
async function syncInvoices(silent){
  if(!gTokenValid()){if(!silent){S.error="Accedi prima a Google (Sincronizza) per leggere le fatture.";render();}return;}
  if(!silent){S.busy="Lettura fatture da Drive…";render();}
  try{
    const files=await driveFindInvoices();
    if(!files.length){if(!silent){S.error="Non trovo nessun file \"Riepilogo_20XX.xlsx\" nel tuo Drive.";render();}return;}
    const keyOf=i=>(i.year!=null&&i.num!=null)?("y:"+i.year+":"+i.num):(i.date+"|"+i.amount+"|"+i.desc.toLowerCase());
    const have=new Set(S.incomes.map(i=>{
      if(i.source!=="excel")return null;
      if(i.invYear!=null&&i.invNum!=null)return "y:"+i.invYear+":"+i.invNum;
      return i.date+"|"+i.amount+"|"+i.desc.toLowerCase();
    }));
    let added=0,total=0;
    const years=files.map(f=>Number((f.name.match(INVOICE_RE)||[])[1])||2026);
    const fattureCat=ensureFattureCat();
    // Rebuild from scratch: drop ALL Excel-sourced incomes, then re-read every file.
    // Manual incomes (source!=="excel") are preserved.
    S.incomes=S.incomes.filter(i=>i.source!=="excel");
    for(const f of files){
      const yr=Number((f.name.match(INVOICE_RE)||[])[1])||2026;
      const r=await gFetch("https://www.googleapis.com/drive/v3/files/"+f.id+"?alt=media");
      const buf=await r.arrayBuffer();
      const items=parseInvoiceWorkbook(buf,yr);
      total+=items.length;
      const seen=new Set();
      items.forEach(i=>{
        const k=keyOf(i);
        if(seen.has(k))return;
        seen.add(k);
        S.incomes.unshift({id:"i"+Date.now()+Math.random().toString(36).slice(2,6),
          desc:i.desc,amount:i.amount,date:i.date,source:"excel",invNum:i.num,invYear:i.year,paidDate:i.paid,categoryId:fattureCat});
        added++;
      });
    }
    S.lastInvoiceSync=Date.now();
    S.busy="";
    S.notice=added+(added===1?" fattura":" fatture")+" da "+files.length+(files.length===1?" file ("+years[0]+")":" file")+".";
    persist();render();
  }catch(err){
    S.busy="";
    if(!silent){S.error="Lettura fatture non riuscita ("+(err&&err.message?err.message:"errore")+").";render();}
    else render();
  }
}
