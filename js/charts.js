function drawCharts(){
  const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const ex=monthExpenses(S.viewY,S.viewM);
  const av=e=>amountFor(e,S.viewY,S.viewM).val||0;
  const byCat={};ex.forEach(e=>{byCat[e.categoryId]=(byCat[e.categoryId]||0)+av(e);});
  const cats=Object.entries(byCat).map(([id,t])=>({c:catById(id),t})).sort((a,b)=>b.t-a.t);
  const cEl=document.getElementById("chart-cat");
  if(cEl&&cats.length){
    charts.push(new Chart(cEl,{type:"doughnut",
      data:{labels:cats.map(x=>x.c.name),
        datasets:[{data:cats.map(x=>x.t),backgroundColor:cats.map(x=>x.c.color),
          borderWidth:0,spacing:2,borderRadius:5}]},
      options:{cutout:"70%",responsive:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>" "+eur(ctx.raw)}}}}}));
  }
  const RANGE=S.chartRange||6;
  const labels=[],cur=[],prev=[];
  for(let i=RANGE-1;i>=0;i--){
    const d=new Date(S.viewY,S.viewM-i,1);
    const yy=d.getFullYear(),mm=d.getMonth();
    labels.push(MESI[mm]+(RANGE>12?" "+String(yy).slice(2):""));
    cur.push(monthExpenses(yy,mm).reduce((s,e)=>s+(amountFor(e,yy,mm).val||0),0));
    prev.push(monthExpenses(yy-1,mm).reduce((s,e)=>s+(amountFor(e,yy-1,mm).val||0),0));
  }
  const ins=[],outs=[];
  for(let i=RANGE-1;i>=0;i--){
    const d=new Date(S.viewY,S.viewM-i,1);
    const yy=d.getFullYear(),mm=d.getMonth();
    ins.push(monthIncomes(yy,mm).reduce((s,x)=>s+Number(x.amount),0));
    outs.push(monthExpenses(yy,mm).reduce((s,e)=>s+(amountFor(e,yy,mm).val||0),0));
  }
  const ioEl=document.getElementById("chart-inout");
  if(ioEl){
    charts.push(new Chart(ioEl,{type:"bar",
      data:{labels,datasets:[
        {label:"Entrate",data:ins,backgroundColor:cssv("--accent"),borderRadius:7,barPercentage:.85,categoryPercentage:.55},
        {label:"Uscite",data:outs,backgroundColor:"#D9836B",borderRadius:7,barPercentage:.85,categoryPercentage:.55},
      ]},
      options:{responsive:true,
        plugins:{legend:{position:"bottom",labels:{color:cssv("--muted"),boxWidth:10,boxHeight:10,borderRadius:5,useBorderRadius:true,font:{family:"Inter",size:11,weight:"700"}}},
          tooltip:{callbacks:{label:ctx=>" "+ctx.dataset.label+": "+eur(ctx.raw)}}},
        scales:{y:{ticks:{callback:v=>eurShort(v),color:cssv("--muted"),font:{family:"Inter",size:10.5}},grid:{color:cssv("--line")},border:{display:false}},
          x:{ticks:{color:cssv("--muted"),font:{family:"Inter",size:11,weight:"700"}},grid:{display:false},border:{display:false}}}}}));
  }
  const insPrev=[];
  for(let i=RANGE-1;i>=0;i--){
    const d=new Date(S.viewY,S.viewM-i,1);
    const yy=d.getFullYear(),mm=d.getMonth();
    insPrev.push(monthIncomes(yy-1,mm).reduce((s,x)=>s+Number(x.amount),0));
  }
  const yInEl=document.getElementById("chart-yoy-in");
  if(yInEl){
    charts.push(new Chart(yInEl,{type:"bar",
      data:{labels,datasets:[
        {label:"Quest'anno",data:ins,backgroundColor:cssv("--accent"),borderRadius:7,barPercentage:.85,categoryPercentage:.55},
        {label:"Anno scorso",data:insPrev,backgroundColor:cssv("--line"),borderRadius:7,barPercentage:.85,categoryPercentage:.55},
      ]},
      options:{responsive:true,
        plugins:{legend:{position:"bottom",labels:{color:cssv("--muted"),boxWidth:10,boxHeight:10,borderRadius:5,useBorderRadius:true,font:{family:"Inter",size:11,weight:"700"}}},
          tooltip:{callbacks:{label:ctx=>" "+ctx.dataset.label+": "+eur(ctx.raw)}}},
        scales:{y:{ticks:{callback:v=>eurShort(v),color:cssv("--muted"),font:{family:"Inter",size:10.5}},grid:{color:cssv("--line")},border:{display:false}},
          x:{ticks:{color:cssv("--muted"),font:{family:"Inter",size:11,weight:"700"}},grid:{display:false},border:{display:false}}}}}));
  }
  const yEl=document.getElementById("chart-yoy");
  if(yEl){
    charts.push(new Chart(yEl,{type:"bar",
      data:{labels,datasets:[
        {label:"Quest'anno",data:cur,backgroundColor:"#D9836B",borderRadius:7,barPercentage:.85,categoryPercentage:.55},
        {label:"Anno scorso",data:prev,backgroundColor:cssv("--line"),borderRadius:7,barPercentage:.85,categoryPercentage:.55},
      ]},
      options:{responsive:true,
        plugins:{legend:{position:"bottom",labels:{color:cssv("--muted"),boxWidth:10,boxHeight:10,borderRadius:5,useBorderRadius:true,font:{family:"Inter",size:11,weight:"700"}}},
          tooltip:{callbacks:{label:ctx=>" "+ctx.dataset.label+": "+eur(ctx.raw)}}},
        scales:{y:{ticks:{callback:v=>eurShort(v),color:cssv("--muted"),font:{family:"Inter",size:10.5}},grid:{color:cssv("--line")},border:{display:false}},
          x:{ticks:{color:cssv("--muted"),font:{family:"Inter",size:11,weight:"700"}},grid:{display:false},border:{display:false}}}}}));
  }
}
function animateTotal(){
  const el=document.getElementById("hero-total");
  if(!el)return;
  if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const target=Number(el.dataset.tot)||0;
  const prefix=el.textContent.startsWith("~")?"~":"";
  const t0=performance.now(),dur=450;
  function step(t){
    const p=Math.min(1,(t-t0)/dur);
    const ease=1-Math.pow(1-p,3);
    el.textContent=prefix+eur(target*ease);
    if(p<1)requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
