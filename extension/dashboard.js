(()=>{
"use strict";
const ORIGIN="https://effchn0.github.io";
const $=id=>document.getElementById(id);
const root=document.createElement("section");
root.id="egatAutoPanel";
root.style.cssText="position:fixed;right:14px;top:72px;z-index:1000;max-width:min(380px,calc(100vw - 25px));background:#fff;color:#19344e;border:1px solid #b9cddd;box-shadow:0 5px 24px #10283a40;border-radius:12px;padding:12px;font:13px/1.5 system-ui,'Noto Sans Thai',sans-serif";
const now=new Date();
root.innerHTML='<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><strong style="font-size:14px">EGAT Collect อัตโนมัติ</strong><button type="button" id="egatAutoToggle" style="font-size:12px">ย่อ</button></div>'+
'<div id="egatAutoBody"><div style="display:flex;gap:7px;align-items:end;flex-wrap:wrap;margin-top:8px"><label>เดือน<br><select id="egatAutoMonth" style="padding:5px;border:1px solid #abc;border-radius:6px"></select></label><label>ปี (ค.ศ.)<br><input id="egatAutoYear" type="number" min="2000" max="2100" style="width:92px;padding:5px;border:1px solid #abc;border-radius:6px"></label><button type="button" id="egatAutoCollect" style="background:#176eb8;border:0;color:white;border-radius:6px;padding:7px 12px;cursor:pointer">Collect Data</button></div>'+
'<div id="egatAutoStatus" role="status" style="font-size:12px;padding:7px 0">กำลังตรวจ Extension…</div>'+
'<div style="font-size:11px"><a id="egatAutoInstall" href="./egat-collector-extension.zip" download>ติดตั้ง Extension (ZIP)</a> • <a href="./extension-guide.html">วิธีติดตั้ง</a></div>'+
'<button type="button" id="egatAutoReload" style="display:none;margin-top:7px">อัปเดตกราฟบนหน้า Monthly</button></div>';
document.body.append(root);
const months=["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
months.forEach((label,i)=>{const op=document.createElement("option");op.value=String(i+1);op.textContent=label;$("egatAutoMonth").append(op)});
$("egatAutoMonth").value=String(now.getMonth()+1);$("egatAutoYear").value=String(now.getFullYear());
$("egatAutoToggle").onclick=()=>{const el=$("egatAutoBody"),hidden=el.style.display==="none";el.style.display=hidden?"":"none";$("egatAutoToggle").textContent=hidden?"ย่อ":"ขยาย"};
let pending=new Map();
window.addEventListener("message",event=>{
 if(event.source!==window||event.origin!==ORIGIN)return;
 const message=event.data;
 if(message?.channel!=="EGAT_REGIONAL_BRIDGE"||message.from!=="extension"||!pending.has(message.id))return;
 const p=pending.get(message.id);pending.delete(message.id);
 if(message.ok)p.resolve(message.document||{installed:true});else p.reject(Error(message.error||"Extension request failed"));
});
function command(action,year,month,timeout=80000){
 const id="collect-"+Date.now()+"-"+Math.random().toString(36).slice(2);
 return new Promise((resolve,reject)=>{
  let timer=setTimeout(()=>{pending.delete(id);reject(Error("ไม่ได้รับการตอบกลับจาก Extension — ตรวจสอบการติดตั้งและสิทธิ์ Browser"))},timeout);
  pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});
  window.postMessage({channel:"EGAT_REGIONAL_BRIDGE",from:"dashboard",id,action,year,month},ORIGIN);
 });
}
function status(msg,bad=false){$("egatAutoStatus").textContent=msg;$("egatAutoStatus").style.color=bad?"#a92b1f":"#254b67"}
async function check(){
 try{await command("ping",0,0,1400);status("Extension พร้อมใช้งาน • เลือกเดือน/ปี แล้วกด Collect Data");return true}
 catch{status("ยังไม่พบ Extension • ดาวน์โหลด ZIP ติดตั้งครั้งเดียวก่อน Collect",true);return false}
}
$("egatAutoCollect").onclick=async()=>{
 const year=Number($("egatAutoYear").value),month=Number($("egatAutoMonth").value),btn=$("egatAutoCollect");
 if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(month)||month<1||month>12){status("เดือนหรือปีไม่ถูกต้อง",true);return}
 btn.disabled=true;status("กำลังเปิด EGAT Popup และ Collect ข้อมูล (ไม่ต้องทำอะไรใน Popup)…");
 try{
  const doc=await command("collect",year,month);
  if(doc?.year!==year||doc?.month!==month||doc?.isMock!==false||!Array.isArray(doc?.rows)||!doc.rows.length)throw Error("EGAT ตอบข้อมูลผิดเดือน/ปี หรือไม่มีข้อมูล");
  const key="egat.extension."+year+"-"+String(month).padStart(2,"0");
  const raw=JSON.stringify(doc);
  localStorage.setItem(key,raw);
  sessionStorage.setItem(key,raw);
  status("Collect สำเร็จ "+doc.rows.length+" วัน • ปิด EGAT Popup แล้ว • ข้อมูลเก็บใน Browser เท่านั้น");
  $("egatAutoReload").style.display="inline-block";
  $("egatAutoReload").onclick=()=>location.reload();
  // Refresh the original page only when the currently selected month/year matches.
  const select=[...document.querySelectorAll("select")].find(e=>e.id!=="egatAutoMonth"&&Number(e.value)===month&&e.options?.length>=12&&e.options.length<=13);
  const yr=[...document.querySelectorAll("input[type=number],select")].find(e=>e.id!=="egatAutoYear"&&Number(e.value)===year);
  if(select&&yr){try{select.dispatchEvent(new Event("change",{bubbles:true}));yr.dispatchEvent(new Event("change",{bubbles:true}));}catch{}}
 }catch(e){status("Collect ไม่สำเร็จ: "+e.message,true)}
 finally{btn.disabled=false}
};
$("egatAutoReload").onclick=()=>location.reload();
check();
})();
