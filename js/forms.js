/* ================= FORM ================= */
function openForm(pre){
  const f=pre||{desc:"",amount:"",categoryId:"altro",date:todayISO(),recurring:false,freq:"mensile"};
  document.getElementById("form-title").textContent=S.editId?"Modifica spesa":"Nuova spesa";
  document.getElementById("btn-save").textContent=S.editId?"Salva modifiche":"Aggiungi spesa";
  document.getElementById("f-desc").value=f.desc;
  document.getElementById("f-amount").value=f.amount;
  document.getElementById("f-date").value=f.date;
  document.getElementById("f-rec").checked=!!f.recurring;
  document.getElementById("f-rec-toggle").classList.toggle("on",!!f.recurring);
  document.getElementById("f-freq-wrap").style.display=f.recurring?"block":"none";
  document.getElementById("f-var-wrap").style.display=f.recurring?"block":"none";
  document.getElementById("f-var").checked=!!f.variable;
  document.getElementById("f-var-toggle").classList.toggle("on",!!f.variable);
  document.getElementById("f-date-label").textContent=f.recurring?"Prima scadenza":"Data";
  document.getElementById("f-cats").innerHTML=S.categories.map(c=>
    '<button class="chip '+(f.categoryId===c.id?"active":"")+'" data-fcat="'+c.id+'">'+esc(c.name)+'</button>').join("");
  document.getElementById("f-rate").value=(f.rateTot?f.rateTot:"");
  document.getElementById("f-freqs").innerHTML=FREQS.map(x=>
    '<button class="chip '+(f.freq===x.id?"active":"")+'" data-ffreq="'+x.id+'">'+x.label+'</button>').join("");
  document.getElementById("form-overlay").classList.add("open");
}
function closeForm(){S.editId=null;document.getElementById("form-overlay").classList.remove("open");}
function saveForm(){
  const desc=document.getElementById("f-desc").value.trim();
  const amount=euroNum(document.getElementById("f-amount").value);
  const rec=document.getElementById("f-rec").checked;
  const isVar=rec&&document.getElementById("f-var").checked;
  if(!desc)return;
  if(!isVar&&(!amount||amount<=0))return;
  const catBtn=document.querySelector("#f-cats .chip.active");
  const rt=document.getElementById("f-rate").value.trim();
  const rateTotV=rec&&rt!==""?Math.max(1,Math.floor(euroNum(rt)||0)):0;
  const freqBtn=document.querySelector("#f-freqs .chip.active");
  const prev=S.editId?S.expenses.find(x=>x.id===S.editId):null;
  const record={
    id:S.editId||uid("e"),desc,
    amount:isVar?(amount>0?amount:null):amount,
    variable:isVar,
    history:prev&&prev.history?prev.history:[],
    categoryId:catBtn?catBtn.dataset.fcat:"altro",
    date:document.getElementById("f-date").value||todayISO(),
    recurring:rec,freq:rec?(freqBtn?freqBtn.dataset.ffreq:"mensile"):null,
    rateTot:rateTotV||null,
  };
  if(S.editId)S.expenses=S.expenses.map(e=>e.id===S.editId?record:e);
  else S.expenses.unshift(record);
  closeForm();persist();render();
}

/* ================= CATEGORY EDITOR ================= */
let catEditId=null,catColorSel=null,catMode="exp";
function openCat(id,mode){
  catMode=mode||"exp";
  const arr=catMode==="inc"?S.incCategories:S.categories;
  const c=id?arr.find(x=>x.id===id):null;
  catEditId=id||null;
  catColorSel=c?c.color:CAT_PALETTE[arr.length%CAT_PALETTE.length];
  document.getElementById("cat-title").textContent=c?"Modifica categoria":(catMode==="inc"?"Nuova categoria entrata":"Nuova categoria");
  document.getElementById("c-name").value=c?c.name:"";
  const rw=document.getElementById("c-rate-wrap");
  rw.style.display=catMode==="inc"?"block":"none";
  document.getElementById("c-rate").value=(catMode==="inc"&&c&&c.taxRate!=null&&c.taxRate!=="")?c.taxRate:"";
  renderCatColors();
  document.getElementById("cat-overlay").classList.add("open");
}
function renderCatColors(){
  document.getElementById("c-colors").innerHTML=CAT_PALETTE.map(col=>
    '<span class="swatch" data-ccolor="'+col+'" style="display:inline-block;width:36px;height:36px;border-radius:11px;'+
      'background:'+col+';cursor:pointer;box-sizing:border-box;transition:transform .12s;'+
      'border:3px solid '+(catColorSel===col?"var(--ink)":"transparent")+';box-shadow:0 0 0 1px var(--line)"></span>').join("");
}
function closeCat(){catEditId=null;document.getElementById("cat-overlay").classList.remove("open");}
function saveCat(){
  const name=document.getElementById("c-name").value.trim();
  if(!name)return;
  if(catMode==="inc"){
    const rv=document.getElementById("c-rate").value;
    const taxRate=(rv===""||rv==null)?null:euroNum(rv);
    if(catEditId)S.incCategories=S.incCategories.map(c=>c.id===catEditId?{...c,name,color:catColorSel,taxRate}:c);
    else S.incCategories.push({id:uid("ic"),name,color:catColorSel,taxRate});
  }else{
    if(catEditId)S.categories=S.categories.map(c=>c.id===catEditId?{...c,name,color:catColorSel}:c);
    else S.categories.push({id:uid("c"),name,color:catColorSel});
  }
  closeCat();persist();render();
}

/* ================= TEMPLATES ================= */
function openTpl(){
  const groups=[];
  S.templates.forEach(t=>{
    const g=groups.find(x=>x.name===t.group);
    if(g)g.items.push(t);else groups.push({name:t.group||"Personalizzate",items:[t]});
  });
  document.getElementById("tpl-list").innerHTML=groups.map(g=>
    '<div class="label" style="margin-top:14px">'+esc(g.name)+'</div>'+
    g.items.map(t=>{
      const exists=S.expenses.some(e=>e.desc.toLowerCase()===t.desc.toLowerCase());
      const f=FREQS.find(x=>x.id===t.freq);
      const c=catById(t.cat);
      return '<div class="row" style="'+(exists?"opacity:.45":"")+'">'+
        '<input type="checkbox" class="tpl-check" data-tid="'+t.id+'" '+(exists?"disabled":"checked")+
          ' style="width:19px;height:19px;accent-color:var(--accent);flex-shrink:0">'+
        '<div class="rdesc">'+
          '<div class="rtitle" style="font-size:14.5px">'+esc(t.desc)+(exists?' <span class="small">(già presente)</span>':"")+'</div>'+
          '<div class="rmeta">'+esc(c.name)+' · '+(f?f.label:"")+' · '+(t.variable?"variabile":"fisso"+(t.amount?" "+eur(t.amount):""))+'</div>'+
        '</div>'+
        '<button class="iconbtn" data-act="tpl-edit" data-id="'+t.id+'">'+icon("pencil",18)+'</button>'+
        '<button class="iconbtn" data-act="tpl-del" data-id="'+t.id+'">'+icon("x",18)+'</button>'+
      '</div>';
    }).join("")
  ).join("")+'<button class="btn btn-ghost" data-act="tpl-new" style="width:100%;margin-top:16px">+ Nuova voce personalizzata</button>';
  document.getElementById("tpl-overlay").classList.add("open");
}
function closeTpl(){document.getElementById("tpl-overlay").classList.remove("open");}
function addTemplates(){
  const checks=[...document.querySelectorAll(".tpl-check")];
  const chosen=checks.filter(c=>c.checked&&!c.disabled)
    .map(c=>S.templates.find(t=>t.id===c.dataset.tid)).filter(Boolean);
  if(!chosen.length){closeTpl();return;}
  if(chosen.some(t=>t.cat==="fisco")&&!S.categories.some(c=>c.id==="fisco")){
    S.categories.push({id:"fisco",name:"Fisco & Contributi",color:"#6B7A8F"});
  }
  chosen.forEach(t=>{
    S.expenses.unshift({
      id:"e"+Date.now()+Math.random().toString(36).slice(2,6),
      desc:t.desc,amount:t.amount>0?Number(t.amount):null,
      variable:!!t.variable,history:[],
      categoryId:t.cat,date:todayISO(),recurring:true,freq:t.freq,
    });
  });
  S.notice=chosen.length+(chosen.length===1?" spesa aggiunta":" spese aggiunte")+". Apri ciascuna con la matita per impostare la data della prima scadenza.";
  closeTpl();persist();S.tab="spese";render();
}
/* --- template editor --- */
let tpeId=null;
function openTpe(id){
  const t=id?S.templates.find(x=>x.id===id):null;
  tpeId=id||null;
  document.getElementById("tpe-title").textContent=t?"Modifica voce":"Nuova voce personalizzata";
  document.getElementById("t-desc").value=t?t.desc:"";
  document.getElementById("t-amount").value=t&&t.amount?t.amount:"";
  const cat=t?t.cat:"altro",freq=t?t.freq:"mensile",isVar=t?!!t.variable:true;
  document.getElementById("t-cats").innerHTML=S.categories.map(c=>
    '<button class="chip '+(cat===c.id?"active":"")+'" data-tcat="'+c.id+'">'+esc(c.name)+'</button>').join("");
  document.getElementById("t-freqs").innerHTML=FREQS.map(x=>
    '<button class="chip '+(freq===x.id?"active":"")+'" data-tfreq="'+x.id+'">'+x.label+'</button>').join("");
  document.getElementById("t-var").checked=isVar;
  document.getElementById("t-var-toggle").classList.toggle("on",isVar);
  document.getElementById("tpe-overlay").classList.add("open");
}
function closeTpe(){tpeId=null;document.getElementById("tpe-overlay").classList.remove("open");}
function saveTpe(){
  const desc=document.getElementById("t-desc").value.trim();
  const amount=euroNum(document.getElementById("t-amount").value);
  const isVar=document.getElementById("t-var").checked;
  if(!desc)return;
  if(!isVar&&(!amount||amount<=0))return;
  const catBtn=document.querySelector("#t-cats .chip.active");
  const freqBtn=document.querySelector("#t-freqs .chip.active");
  const prev=tpeId?S.templates.find(x=>x.id===tpeId):null;
  const rec={
    id:tpeId||uid("t"),
    group:prev?prev.group:"Personalizzate",
    desc,cat:catBtn?catBtn.dataset.tcat:"altro",
    freq:freqBtn?freqBtn.dataset.tfreq:"mensile",
    variable:isVar,amount:amount>0?amount:null,
  };
  if(tpeId)S.templates=S.templates.map(x=>x.id===tpeId?rec:x);
  else S.templates.push(rec);
  closeTpe();persist();openTpl();
}

/* ================= BILL REGISTRATION ================= */
let billId=null;
function openBill(id){
  const e=S.expenses.find(x=>x.id===id);if(!e)return;
  billId=id;
  document.getElementById("bill-name").textContent=e.desc+" — l'importo registrato sostituisce la stima per il mese della data scelta.";
  document.getElementById("b-amount").value="";
  document.getElementById("b-date").value=todayISO();
  document.getElementById("bill-overlay").classList.add("open");
}
function closeBill(){billId=null;document.getElementById("bill-overlay").classList.remove("open");}
function saveBill(){
  const amount=euroNum(document.getElementById("b-amount").value);
  const date=document.getElementById("b-date").value||todayISO();
  if(!billId||!amount||amount<=0)return;
  const d=new Date(date+"T00:00:00");
  S.expenses=S.expenses.map(e=>{
    if(e.id!==billId)return e;
    const hist=(e.history||[]).filter(h=>{
      const hd=new Date(h.date+"T00:00:00");
      return !(hd.getFullYear()===d.getFullYear()&&hd.getMonth()===d.getMonth());
    });
    hist.push({date,amount});
    return {...e,history:hist};
  });
  S.notice="Importo registrato.";
  closeBill();persist();render();
}
