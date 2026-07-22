/* ================= CONFIRM + TOAST ================= */
let confirmCb=null;
function askConfirm(msg,onYes,yesLabel){
  confirmCb=onYes;
  document.getElementById("confirm-msg").textContent=msg;
  document.getElementById("confirm-yes").textContent=yesLabel||"Elimina";
  document.getElementById("confirm-overlay").classList.add("open");
}
function closeConfirm(){confirmCb=null;document.getElementById("confirm-overlay").classList.remove("open");}

let toastTimer=null,undoCb=null;
function showToast(msg,onUndo){
  undoCb=onUndo||null;
  const t=document.getElementById("toast");
  document.getElementById("toast-msg").textContent=msg;
  document.getElementById("toast-action").style.display=onUndo?"block":"none";
  t.style.opacity="1";t.style.transform="translateX(-50%) translateY(0)";t.style.pointerEvents="auto";
  clearTimeout(toastTimer);
  toastTimer=setTimeout(hideToast,4000);
}
function hideToast(){
  const t=document.getElementById("toast");
  t.style.opacity="0";t.style.transform="translateX(-50%) translateY(20px)";t.style.pointerEvents="none";
  undoCb=null;
}
// Delete an item from an array by id, with an undo toast that restores it at its position.
function deleteWithUndo(getArr,setArr,id,label){
  const arr=getArr();
  const idx=arr.findIndex(x=>x.id===id);
  if(idx===-1)return;
  const item=arr[idx];
  setArr(arr.filter(x=>x.id!==id));
  persist();render();
  showToast((label||"Elemento")+" eliminato",()=>{
    const cur=getArr();
    const restored=cur.slice();restored.splice(Math.min(idx,restored.length),0,item);
    setArr(restored);persist();render();hideToast();
  });
}
