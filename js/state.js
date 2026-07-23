/* ================= ICONS ================= */
function icon(n,s){
  s=s||22;
  const P={
    "pie":'<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6.5 6.2"/>',
    "cal":'<rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    "list":'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none"/>',
    "clock":'<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2.5"/>',
    "dots":'<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    "plus":'<path d="M12 5v14M5 12h14"/>',
    "camera":'<rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.6"/><path d="M8.5 7l1.6-2.5h3.8L15.5 7"/>',
    "pencil":'<path d="M4 20l4.2-1 10.6-10.6a1.8 1.8 0 0 0 0-2.6l-.6-.6a1.8 1.8 0 0 0-2.6 0L5 15.8 4 20z"/>',
    "x":'<path d="M6 6l12 12M18 6L6 18"/>',
    "chev-l":'<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    "chev-r":'<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
    "tag":'<path d="M12.6 3H5a2 2 0 0 0-2 2v7.6a2 2 0 0 0 .6 1.4l7.4 7.4a2 2 0 0 0 2.8 0l7.6-7.6a2 2 0 0 0 0-2.8L14 3.6A2 2 0 0 0 12.6 3z"/><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/>',
    "sliders":'<path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h13M21 17h-1"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="19" cy="17" r="2"/>',
    "euro":'<path d="M17 6.5A6.5 6.5 0 0 0 6.6 12 6.5 6.5 0 0 0 17 17.5M4 10.3h8M4 13.7h8"/>',
    "piggy":'<path d="M4 12.5c0-3 2.7-5 6-5 1 0 1.9.2 2.7.5L16 6.5l-.4 3c1 .8 1.7 1.9 1.9 3.2h1.6v3.2h-1.9c-.5.9-1.3 1.6-2.2 2v1.6h-2.4v-1h-2.8v1H7.4v-1.6C5.4 18.3 4 15.6 4 12.5z"/><circle cx="8.5" cy="12" r=".9" fill="currentColor" stroke="none"/>',
    "search":'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.9-3.9"/>',
    "trend-up":'<path d="M3.5 17.5L10 11l4 4 6.5-6.5M15 8.5h5.5V14"/>',
    "trend-down":'<path d="M3.5 8.5L10 15l4-4 6.5 6.5M15 17.5h5.5V12"/>',
    "target":'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
    "camera-big":'<rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.6"/><path d="M8.5 7l1.6-2.5h3.8L15.5 7"/>',
  }[n]||"";
  const size=n==="camera-big"?42:s;
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+P+'</svg>';
}
function mountStaticIcons(){
  document.querySelectorAll("[data-ic]").forEach(el=>{el.innerHTML=icon(el.dataset.ic);});
  paintHeaderButton();
  document.getElementById("btn-add").innerHTML=icon("plus",26);
}
/* Il pulsante in alto a destra cambia con la scheda: ingranaggio in
   "Tariffe e agenda", freccia di ritorno nelle sue impostazioni, altrove fotocamera. */
function paintHeaderButton(){
  const hb=document.getElementById("btn-scan");
  if(!hb)return;
  if(S.tab==="tariffe"){hb.innerHTML=icon("sliders");hb.title="Impostazioni agenda";}
  else if(S.tab==="agenda-config"){hb.innerHTML=icon("chev-l");hb.title="Torna a Tariffe e agenda";}
  else{hb.innerHTML=icon("camera");hb.title="Scansiona una spesa";}
}

/* ================= CONSTANTS ================= */
const APP_V="8.13";
const FREQS=[
  {id:"mensile",label:"Mensile",months:1},
  {id:"bimestrale",label:"Bimestrale",months:2},
  {id:"trimestrale",label:"Trimestrale",months:3},
  {id:"quadrimestrale",label:"Quadrimestrale",months:4},
  {id:"semestrale",label:"Semestrale",months:6},
  {id:"annuale",label:"Annuale",months:12},
];
const DEFAULT_CATS=[
  {id:"casa",name:"Casa",color:"#3E4A3A"},
  {id:"utenze",name:"Utenze",color:"#8A9B7E"},
  {id:"trasporti",name:"Auto & Moto",color:"#C4682F"},
  {id:"abbonamenti",name:"Abbonamenti",color:"#B0793A"},
  {id:"lavoro",name:"Lavoro",color:"#5C6E54"},
  {id:"altro",name:"Altro",color:"#8B887C"},
];
const CAT_COLORS=["#3E4A3A","#8A9B7E","#C4682F","#B0793A","#5C6E54","#8B887C","#A65D57","#6B7A8F"];
const CAT_PALETTE=[
  "#3E4A3A","#5C6E54","#6E8060","#8A9B7E","#4F6D4A","#6B8E5A",
  "#2F5D50","#3E7C6A","#4A6670","#5A7D8C","#6B7A8F","#3D5A80",
  "#C4682F","#B0793A","#D89B4A","#A65D57","#C0504D","#8C4A3F",
  "#8C5A8C","#6D5B97","#A67C52","#7A6A4F","#8B887C","#5A5750"];
const KEY="registro-spese-v2";
const DEFAULT_INC_CATS=[
  {id:"ic-fatture",name:"Fatture",color:"#0FA36B",taxRate:33},
  {id:"ic-formazione",name:"Formazione",color:"#5A7D8C",taxRate:null},
  {id:"ic-consulenze",name:"Consulenze",color:"#B0793A",taxRate:null},
  {id:"ic-altro",name:"Altro",color:"#8B887C",taxRate:null},
];
const DEFAULT_TEMPLATES=[
  {id:"t-luce",group:"Casa & Utenze",desc:"Bolletta luce",cat:"utenze",freq:"bimestrale",variable:true},
  {id:"t-gas",group:"Casa & Utenze",desc:"Bolletta gas",cat:"utenze",freq:"bimestrale",variable:true},
  {id:"t-acqua",group:"Casa & Utenze",desc:"Bolletta acqua",cat:"utenze",freq:"trimestrale",variable:true},
  {id:"t-tari",group:"Casa & Utenze",desc:"TARI",cat:"utenze",freq:"semestrale",variable:true},
  {id:"t-mutuo",group:"Casa & Utenze",desc:"Mutuo",cat:"casa",freq:"mensile",variable:true},
  {id:"t-caldaia",group:"Casa & Utenze",desc:"Manutenzione caldaia",cat:"casa",freq:"annuale",variable:true},
  {id:"t-imposta",group:"Fisco & Contributi (forfettario)",desc:"Imposta sostitutiva (acconto/saldo)",cat:"fisco",freq:"semestrale",variable:true},
  {id:"t-inps",group:"Fisco & Contributi (forfettario)",desc:"Contributi INPS Gestione Separata",cat:"fisco",freq:"semestrale",variable:true},
  {id:"t-carb",group:"Auto & Moto",desc:"Carburante",cat:"trasporti",freq:"mensile",variable:true},
  {id:"t-rcauto",group:"Auto & Moto",desc:"RC Auto",cat:"trasporti",freq:"annuale",variable:true},
  {id:"t-rcmoto",group:"Auto & Moto",desc:"RC Moto",cat:"trasporti",freq:"annuale",variable:true},
];
const MESI=["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
const MESI_FULL=["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const GIORNI=["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];

/* ================= STATE ================= */
const now=new Date();
const S={
  expenses:[],categories:DEFAULT_CATS.slice(),apiKey:"",
  tab:"riepilogo",viewY:now.getFullYear(),viewM:now.getMonth(),
  calY:now.getFullYear(),calM:now.getMonth(),selDay:null,
  filterCat:"all",calFilter:"all",chartRange:6,search:"",busy:"",fcMode:"mesi",fcYear:null,fcCeiling:null,rates:[],calEvents:[],calList:[],calIgnored:[],calOverrides:{},calSkipWords:"compleanno",calLastSync:0,calDayHours:8,calBreakStart:"13:00",calBreakEnd:"14:00",calMaxHours:8,agY:null,agM:null,agSelDay:null,editId:null,notice:"",error:"",
  templates:[],gClientId:"",lastSync:0,savedAt:0,
  incomes:[],lastInvoiceSync:0,incCategories:DEFAULT_INC_CATS.slice(),
  goals:[],taxRate:30,taxSaved:[],
};
let charts=[];

/* ================= STORAGE ================= */
/* Snapshot automatici: conserva le ultime SNAP_KEEP versioni dei dati,
   una al giorno. Rete di sicurezza contro cancellazioni o dati corrotti. */
const SNAP_KEY="registro-spese-snapshots";
const SNAP_KEEP=7;
const snapshots={
  list(){
    try{return JSON.parse(localStorage.getItem(SNAP_KEY)||"[]");}catch(e){return [];}
  },
  save(payload){
    try{
      const today=new Date().toISOString().slice(0,10);
      let arr=this.list();
      // una sola istantanea al giorno: sostituisce quella odierna se esiste
      arr=arr.filter(s=>s.day!==today);
      arr.push({day:today,at:Date.now(),data:payload});
      arr.sort((a,b)=>a.at-b.at);
      while(arr.length>SNAP_KEEP)arr.shift();
      localStorage.setItem(SNAP_KEY,JSON.stringify(arr));
      return true;
    }catch(e){return false;}   // quota piena: non blocca il salvataggio normale
  },
  restore(day){
    const s=this.list().find(x=>x.day===day);
    return s?s.data:null;
  }
};

const store={
  mode:"none",
  async init(){
    if(window.storage&&typeof window.storage.set==="function"){this.mode="claude";}
    else{try{localStorage.setItem("__t","1");localStorage.removeItem("__t");this.mode="local";}catch(e){this.mode="none";}}
  },
  async load(){
    try{
      if(this.mode==="claude"){const r=await window.storage.get(KEY);return r&&r.value?JSON.parse(r.value):null;}
      if(this.mode==="local"){const v=localStorage.getItem(KEY);return v?JSON.parse(v):null;}
    }catch(e){}
    return null;
  },
  async save(data){
    try{
      if(this.mode==="claude"){await window.storage.set(KEY,JSON.stringify(data));return true;}
      if(this.mode==="local"){localStorage.setItem(KEY,JSON.stringify(data));return true;}
    }catch(e){}
    return false;
  }
};
function snapshotPayload(){
  return {expenses:S.expenses,categories:S.categories,templates:S.templates,
    incomes:S.incomes,incCategories:S.incCategories,goals:S.goals,
    taxRate:S.taxRate,taxSaved:S.taxSaved};
}
async function persistLocal(){
  const ok=await store.save({expenses:S.expenses,categories:S.categories,apiKey:S.apiKey,
    templates:S.templates,gClientId:S.gClientId,lastSync:S.lastSync,savedAt:S.savedAt,incomes:S.incomes,lastInvoiceSync:S.lastInvoiceSync,incCategories:S.incCategories,goals:S.goals,taxRate:S.taxRate,taxSaved:S.taxSaved,fcCeiling:S.fcCeiling,rates:S.rates,calDayHours:S.calDayHours,calBreakStart:S.calBreakStart,calBreakEnd:S.calBreakEnd,calMaxHours:S.calMaxHours,calEvents:S.calEvents,calList:S.calList,calIgnored:S.calIgnored,calOverrides:S.calOverrides,calSkipWords:S.calSkipWords,calLastSync:S.calLastSync});
  if(!ok&&store.mode!=="none"){S.error="Salvataggio non riuscito: i dati restano in memoria per questa sessione.";}
  if(ok&&store.mode==="local")snapshots.save(snapshotPayload());
}
async function persist(){
  S.savedAt=Date.now();
  await persistLocal();
  schedulePush();
}
