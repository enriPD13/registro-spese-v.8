/* ================= UTILS ================= */
const eur=n=>new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(n||0);
// Parse a user-typed amount tolerating Italian comma decimals and thousands dots.
const euroNum=v=>{
  if(v==null)return NaN;
  let s=String(v).trim().replace(/[€\s]/g,"");
  if(s==="")return NaN;
  if(s.includes(",")&&s.includes(".")){ // 1.234,56 -> 1234.56
    s=s.replace(/\./g,"").replace(",",".");
  }else if(s.includes(",")){ // 12,50 -> 12.50
    s=s.replace(",",".");
  }
  const n=Number(s);
  return isNaN(n)?NaN:n;
};
const uid=p=>(p||"x")+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const eurShort=n=>n>=1000?(n/1000).toFixed(1).replace(".",",")+"k":Math.round(n)+"€";
const todayISO=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
/* legge una variabile colore del tema (usata dai grafici) */
const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const catById=id=>S.categories.find(c=>c.id===id)||{name:"—",color:"#8B887C",id:"?"};
const incCatById=id=>S.incCategories.find(c=>c.id===id)||{name:"—",color:"#0FA36B",id:"?"};
function monthsDiff(a,b){return (b.getFullYear()-a.getFullYear())*12+(b.getMonth()-a.getMonth());}
/* Numero di rate previste: 0 significa senza termine. */
function rateTot(e){const n=Number(e&&e.rateTot);return n>0?Math.floor(n):0;}

/* Quale rata cade nel mese indicato (1 = la prima). 0 se in quel mese non ricorre. */
function rataNum(e,y,m){
  const st=new Date(e.date+"T00:00:00");
  const d=monthsDiff(new Date(st.getFullYear(),st.getMonth(),1),new Date(y,m,1));
  if(d<0)return 0;
  const f=FREQS.find(x=>x.id===e.freq);
  const step=f?f.months:1;
  return (d%step===0)?(d/step+1):0;
}
function dueInMonth(e,y,m){
  const n=rataNum(e,y,m);
  if(!n)return false;
  const tot=rateTot(e);
  return tot?(n<=tot):true;      // con un termine, si ferma all'ultima rata
}

/* Data dell'ultima rata, solo per le spese con un termine. */
function lastDue(e){
  const tot=rateTot(e);
  if(!tot)return null;
  const f=FREQS.find(x=>x.id===e.freq);const step=f?f.months:1;
  const st=new Date(e.date+"T00:00:00");
  return new Date(st.getFullYear(),st.getMonth()+step*(tot-1),Math.min(st.getDate(),28));
}
/* Rate già scadute e rate ancora da pagare. */
function rateFatte(e){
  const tot=rateTot(e);
  const f=FREQS.find(x=>x.id===e.freq);const step=f?f.months:1;
  const st=new Date(e.date+"T00:00:00");
  const oggi=new Date();oggi.setHours(0,0,0,0);
  let n=monthsDiff(new Date(st.getFullYear(),st.getMonth(),1),
                   new Date(oggi.getFullYear(),oggi.getMonth(),1))/step;
  n=Math.floor(n)+1;
  if(oggi.getDate()<Math.min(st.getDate(),28)&&rataNum(e,oggi.getFullYear(),oggi.getMonth()))n--;
  n=Math.max(0,n);
  return tot?Math.min(n,tot):n;
}
function rateResidue(e){
  const tot=rateTot(e);
  return tot?Math.max(0,tot-rateFatte(e)):null;
}
function expFinita(e){
  const tot=rateTot(e);
  return tot?rateFatte(e)>=tot:false;
}
function dueDayInMonth(e,y,m){
  const st=new Date(e.date+"T00:00:00");
  return Math.min(st.getDate(),new Date(y,m+1,0).getDate());
}
/* Prossima scadenza. Restituisce null se la rateizzazione è conclusa. */
function nextDue(e){
  const f=FREQS.find(x=>x.id===e.freq);const step=f?f.months:1;
  const st=new Date(e.date+"T00:00:00");
  const t=new Date();t.setHours(0,0,0,0);
  let d=new Date(st),guard=0;
  while(d<t&&guard++<2000){d=new Date(d.getFullYear(),d.getMonth()+step,Math.min(st.getDate(),28));}
  const L=lastDue(e);
  if(L&&d>L)return null;         // tutte le rate sono state pagate
  return d;
}
const daysTo=d=>Math.round((d-new Date().setHours(0,0,0,0))/86400000);
function monthExpenses(y,m){
  return S.expenses.filter(e=>{
    if(e.recurring)return dueInMonth(e,y,m);
    const d=new Date(e.date+"T00:00:00");
    return d.getFullYear()===y&&d.getMonth()===m;
  });
}
function incDueInMonth(i,y,m){
  const st=new Date(i.date+"T00:00:00");
  const d=monthsDiff(new Date(st.getFullYear(),st.getMonth(),1),new Date(y,m,1));
  if(d<0)return false;
  const f=FREQS.find(x=>x.id===i.freq);
  return d%(f?f.months:1)===0;
}
function incDueDay(i,y,m){
  const st=new Date(i.date+"T00:00:00");
  return Math.min(st.getDate(),new Date(y,m+1,0).getDate());
}
function monthIncomes(y,m){
  return S.incomes.filter(i=>{
    if(i.recurring)return incDueInMonth(i,y,m);
    const d=new Date(i.date+"T00:00:00");return d.getFullYear()===y&&d.getMonth()===m;
  });
}
function dayIncomes(y,m,day){
  return S.incomes.filter(i=>{
    if(i.recurring)return incDueInMonth(i,y,m)&&incDueDay(i,y,m)===day;
    const d=new Date(i.date+"T00:00:00");
    return d.getFullYear()===y&&d.getMonth()===m&&d.getDate()===day;
  });
}
function dayExpenses(y,m,day){
  return S.expenses.filter(e=>{
    if(e.recurring)return dueInMonth(e,y,m)&&dueDayInMonth(e,y,m)===day;
    const d=new Date(e.date+"T00:00:00");
    return d.getFullYear()===y&&d.getMonth()===m&&d.getDate()===day;
  });
}
function amountFor(e,y,m){
  if(!e.variable)return{val:Number(e.amount),est:false};
  const hist=e.history||[];
  const inMonth=(h,yy,mm)=>{const d=new Date(h.date+"T00:00:00");return d.getFullYear()===yy&&d.getMonth()===mm;};
  const actual=hist.find(h=>inMonth(h,y,m));
  if(actual)return{val:Number(actual.amount),est:false};
  const lastYear=hist.find(h=>inMonth(h,y-1,m));
  if(lastYear)return{val:Number(lastYear.amount),est:true};
  const before=hist.filter(h=>new Date(h.date+"T00:00:00")<new Date(y,m,1))
    .sort((a,b)=>a.date<b.date?1:-1)[0];
  if(before)return{val:Number(before.amount),est:true};
  if(e.amount)return{val:Number(e.amount),est:true};
  return{val:null,est:true};
}
function amountLabel(e,y,m){
  if(!e.variable)return eur(e.amount);
  let a;
  if(y!=null)a=amountFor(e,y,m);
  else{
    const hist=(e.history||[]).slice().sort((x,z)=>x.date<z.date?1:-1);
    a=hist.length?{val:Number(hist[0].amount),est:true}
      :(e.amount?{val:Number(e.amount),est:true}:{val:null,est:true});
  }
  if(a.val==null)return "—";
  return (a.est?"~":"")+eur(a.val);
}
