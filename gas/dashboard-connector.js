(()=>{"use strict";
const ORIGIN=location.origin, GAS_URL="https://script.google.com/macros/s/AKfycbysxp3VVJLpWYNFjUaj4A1JAi9XJd-ghMHjn79pJrJlyF53ryJJzSoO2d1OQTsus66tEA/exec";
const box=document.createElement("section");
box.id="egatGasConnector";
box.style.cssText="position:fixed;right:12px;bottom:36px;z-index:1050;background:white;color:#1a3651;border:1px solid #b7ccdd;box-shadow:0 5px 24px #173e5940;border-radius:10px;padding:10px;max-width:340px;font:12px/1.6 system-ui,'Noto Sans Thai',sans-serif";
box.innerHTML='<strong>Google Apps Script • EGAT Backend</strong><div style="display:flex;gap:6px;margin:7px 0;flex-wrap:wrap"><button id="gasTest" style="padding:5px;border-radius:6px">ทดสอบ EGAT</button><button id="gasCollect" style="padding:5px;border-radius:6px">Collect เดือนที่เลือก</button><a target="_blank" rel="noopener" href="'+GAS_URL+'" style="padding:5px">เปิด Apps Script</a></div><div id="gasStatus" role="status">ยังไม่ได้ทดสอบ /exec</div><button type="button" id="gasHide" style="font-size:11px;margin-top:4px">ซ่อน</button>';
document.body.append(box);
const $=id=>document.getElementById(id);
$("gasHide").onclick=()=>{box.style.display="none"};
const iframe=document.createElement("iframe");iframe.title="Authorized EGAT Apps Script";iframe.src=GAS_URL;
iframe.style.cssText="width:1px;height:1px;position:absolute;left:-5000px;top:0;border:0";document.body.append(iframe);
let ready=false;const pending=new Map();let seq=0;
window.addEventListener("message",ev=>{
 if(ev.source!==iframe.contentWindow)return;
 const m=ev.data;if(!m||m.channel!=="EGAT_GAS_BRIDGE"||m.from!=="gas")return;
 if(m.action==="ready"){ready=true;$("gasStatus").textContent="Apps Script ตอบกลับแล้ว • ทดสอบการเข้าถึง EGAT ได้";return}
 const p=pending.get(m.id);if(!p)return;
 pending.delete(m.id);clearTimeout(p.timer);
 if(m.ok)p.resolve(m.result);else p.reject(Error(m.error||"Google Apps Script error"));
});
function send(action,year,month){
 return new Promise((resolve,reject)=>{
  if(!ready)return reject(Error("ยังเชื่อม Apps Script ใน iframe ไม่ได้ • เปิด /exec โดยตรงเพื่อตรวจ Login / Deploy"));
  const id="gas-"+(++seq)+"-"+Date.now();
  const timer=setTimeout(()=>{pending.delete(id);reject(Error("Apps Script ไม่ตอบใน 45 วินาที"))},45000);
  pending.set(id,{resolve,reject,timer});
  iframe.contentWindow.postMessage({channel:"EGAT_GAS_BRIDGE",from:"dashboard",id,action,year,month},"*");
 });
}
function status(s){$("gasStatus").textContent=s}
$("gasTest").onclick=async()=>{
 status("กำลังให้ Google Server ทดลอง GET เว็บไซต์ EGAT…");
 try{const x=await send("probe");status((x.sourceReachable?"GET สำเร็จ":"GET ไม่สำเร็จ")+" • "+x.message+" • "+(x.httpStatus??"ไม่มี HTTP status")+" • "+x.at)}
 catch(e){status("ยังทดสอบไม่ได้: "+e.message)}
};
$("gasCollect").onclick=async()=>{
 const selects=[...document.querySelectorAll("select")].filter(x=>x.id!=="egatAutoMonth");
 const selectedMonth=selects.find(x=>Number(x.value)>=1&&Number(x.value)<=12&&x.options?.length===12);
 const candidateYear=[...document.querySelectorAll("input[type=number],select")].find(x=>Number(x.value)>=2000&&Number(x.value)<=2100&&x.id!=="egatAutoYear");
 const month=Number(selectedMonth?.value??new Date().getMonth()+1),year=Number(candidateYear?.value??new Date().getFullYear());
 status("กำลัง Collect "+year+"-"+String(month).padStart(2,"0")+" ผ่าน Apps Script…");
 try{
  const doc=await send("collect",year,month);
  if(doc?.isMock!==false||doc.year!==year||doc.month!==month||!doc.rows?.length)throw Error("ข้อมูลที่ตอบกลับไม่ตรงเดือน/ปี");
  const key="egat.extension."+year+"-"+String(month).padStart(2,"0");
  const raw=JSON.stringify(doc);localStorage.setItem(key,raw);
  status("Collect สำเร็จ "+doc.rows.length+" วัน • เก็บใน Browser • กดแสดงข้อมูล/รีเฟรชหน้า");
 }catch(e){status("Collect ไม่สำเร็จ: "+e.message)}
};
})();