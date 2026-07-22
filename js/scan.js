/* ================= AI SCAN ================= */
function normalizeImage(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{
      try{
        const MAX=1568;let w=img.width,h=img.height;
        if(w>MAX||h>MAX){const s=MAX/Math.max(w,h);w=Math.round(w*s);h=Math.round(h*s);}
        const cv=document.createElement("canvas");cv.width=w;cv.height=h;
        cv.getContext("2d").drawImage(img,0,0,w,h);
        const du=cv.toDataURL("image/jpeg",0.85);
        URL.revokeObjectURL(url);resolve(du.split(",")[1]);
      }catch(e){URL.revokeObjectURL(url);reject(e);}
    };
    img.onerror=()=>{
      URL.revokeObjectURL(url);
      const r=new FileReader();
      r.onload=()=>resolve(r.result.split(",")[1]);
      r.onerror=()=>reject(new Error("Formato immagine non leggibile"));
      r.readAsDataURL(file);
    };
    img.src=url;
  });
}
function scanPrompt(){
  const catNames=S.categories.map(c=>c.name).join(", ");
  return "Analizza questa immagine di una spesa (scontrino, fattura, screenshot di pagamento, bonifico o addebito). "+
  "Rispondi SOLO con un oggetto JSON valido, senza testo aggiuntivo e senza backtick, con questi campi:\n"+
  '{"desc":"descrizione breve (es. nome esercente o servizio)",'+
  '"amount":numero (importo totale in euro, punto come separatore decimale),'+
  '"date":"YYYY-MM-DD" oppure null se non leggibile,'+
  '"category":"la più adatta tra: '+catNames+'",'+
  '"recurring":true o false (true solo se è chiaramente un abbonamento o canone periodico),'+
  '"freq":"mensile","bimestrale","trimestrale","quadrimestrale","semestrale","annuale" oppure null}\n'+
  "Se un dato non è leggibile, usa null. Non inventare valori.";
}
const GROQ_VISION_MODELS=["qwen/qwen3.6-27b","meta-llama/llama-4-maverick-17b-128e-instruct"];
async function callGroq(b64){
  let lastErr=null;
  for(const model of GROQ_VISION_MODELS){
    try{
      const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+S.apiKey},
        body:JSON.stringify({
          model,max_completion_tokens:2048,temperature:0,
          response_format:{type:"json_object"},
          messages:[{role:"user",content:[
            {type:"image_url",image_url:{url:"data:image/jpeg;base64,"+b64}},
            {type:"text",text:scanPrompt()}
          ]}]
        })
      });
      const data=await r.json();
      if(!r.ok||data.error)throw new Error(data.error&&data.error.message?data.error.message:"Errore Groq "+r.status);
      return data.choices[0].message.content;
    }catch(err){lastErr=err;}
  }
  throw lastErr||new Error("Nessun modello vision disponibile");
}
async function callClaude(b64){
  const r=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,
      messages:[{role:"user",content:[
        {type:"image",source:{type:"base64",media_type:"image/jpeg",data:b64}},
        {type:"text",text:scanPrompt()}]}]})
  });
  const data=await r.json();
  if(!r.ok||data.error)throw new Error(data.error&&data.error.message?data.error.message:"Errore API "+r.status);
  return (data.content||[]).filter(i=>i.type==="text").map(i=>i.text).join("\n");
}
async function scan(file){
  if(!file)return;
  S.error="";document.getElementById("spin").classList.add("open");
  try{
    const b64=await normalizeImage(file);
    let text=S.apiKey?await callGroq(b64):await callClaude(b64);
    text=String(text||"").replace(/<think>[\s\S]*?<\/think>/g,"");
    const a=text.indexOf("{"),b=text.lastIndexOf("}");
    if(a===-1||b===-1)throw new Error("Risposta senza JSON");
    const p=JSON.parse(text.slice(a,b+1));
    const cat=S.categories.find(c=>p.category&&c.name.toLowerCase()===String(p.category).toLowerCase())
      ||S.categories.find(c=>c.id==="altro")||S.categories[0];
    S.editId=null;
    openForm({
      desc:p.desc?String(p.desc):"",
      amount:p.amount!=null&&!isNaN(Number(p.amount))?String(p.amount):"",
      categoryId:cat.id,
      date:p.date&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)?p.date:todayISO(),
      recurring:p.recurring===true,
      freq:FREQS.some(f=>f.id===p.freq)?p.freq:"mensile",
    });
  }catch(err){
    S.error="Scansione non riuscita ("+(err&&err.message?err.message:"errore sconosciuto")+"). "+
      (S.apiKey?"Verifica la chiave Groq nelle Impostazioni.":"Su smartphone serve la chiave API Groq: inseriscila nelle Impostazioni.");
    render();
  }finally{
    document.getElementById("spin").classList.remove("open");
  }
}
