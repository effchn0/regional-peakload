// Build a pixel-equivalent static mirror of the existing ChatGPT Site's public frontend.
// This task fetches PUBLIC frontend assets only. It does not fetch EGAT or publish
// internal data files. Fail deployment if the upstream assets are unavailable.
import {mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
const SOURCE="https://effchn-peakload.chalermphol-ko132.chatgpt.site";
const LEGACY_API=SOURCE;
const OUT=resolve("published");
const assets=["index.html","monthly.html","monthly.js","theme.css","thailand-regions.png"];
const timeout=ms=>AbortSignal.timeout(ms);
const req=async file=>{
 const response=await fetch(SOURCE+"/"+file,{signal:timeout(30000),redirect:"follow"});
 if(!response.ok)throw Error("Site asset "+file+" HTTP "+response.status);
 if(file.endsWith(".png")){const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length<10000)throw Error("Site map incomplete");return bytes}
 const body=await response.text();
 const marker=file==="index.html"?"High Alarm Event Log":file==="monthly.html"?"EGAT Monthly Requirement":file==="monthly.js"?"function render":file==="theme.css"?"background":null;
 if(body.length<500||marker&&!body.includes(marker))throw Error("Unexpected Site response for "+file);
 return body;
};
const helper="async function fetchMonthly(year,month,{signal}={}){\n const gateway=(localStorage.getItem(\"egat.gateway.url\")||\"\").trim().replace(/\\/$/,\"\");\n const name=year+\"-\"+String(month).padStart(2,\"0\");\n let error=null;\n if(gateway){\n  if(!/^https:\\/\\//i.test(gateway))throw Error(\"EGAT Collector Gateway ต้องเป็น HTTPS\");\n  try{\n   const r=await fetch(gateway+\"/monthly?year=\"+year+\"&month=\"+month,{signal,cache:\"no-store\",credentials:\"omit\"});\n   if(!r.ok){const e=await r.json().catch(()=>({}));throw Error(e.error||\"Gateway HTTP \"+r.status)}\n   return r;\n  }catch(e){error=\"EGAT Gateway: \"+e.message;}\n }\n const archive=\"./data/\"+name+\".json\";\n try{const r=await fetch(archive,{signal,cache:\"no-store\"});if(r.ok&&r.headers.get(\"content-type\")?.includes(\"json\")){\n  const doc=await r.json();return new Response(JSON.stringify({...doc,transport:doc.transport||\"published-snapshot\",connectionStatus:doc.connectionStatus||\"stored\"}),{status:200,headers:{\"content-type\":\"application/json\"}});\n }}catch{}\n try{\n  const r=await fetch(\"https://effchn-peakload.chalermphol-ko132.chatgpt.site/monthly?year=\"+year+\"&month=\"+month,{signal,cache:\"no-store\",credentials:\"omit\"});\n  if(!r.ok)throw Error(\"Site เดิม HTTP \"+r.status);\n  return r;\n }catch(e){throw Error((error?error+\" • \":\"\")+\"ไม่มีข้อมูลที่โหลดได้: Site เดิมอาจไม่อนุญาต CORS และยังไม่มี Snapshot • \"+e.message);}\n}\nfunction setupGateway(){\n const field=document.getElementById(\"egatGatewayUrl\"),save=document.getElementById(\"egatGatewaySave\"),state=document.getElementById(\"egatGatewayState\");\n if(!field||!save)return;\n field.value=localStorage.getItem(\"egat.gateway.url\")||\"\";\n save.addEventListener(\"click\",()=>{\n  const raw=field.value.trim().replace(/\\/$/,\"\");\n  if(raw&&!/^https:\\/\\//i.test(raw)){state.textContent=\"ต้องเป็น URL HTTPS ของ Gateway ภายใน EGAT\";return;}\n  localStorage.setItem(\"egat.gateway.url\",raw);\n  state.textContent=raw?\"บันทึก Gateway แล้ว • กด โหลดข้อมูล เพื่อ Collect\":\"ยกเลิก Gateway แล้ว • จะใช้เฉพาะข้อมูลย้อนหลัง\";\n });\n}\nif(document.readyState===\"loading\")document.addEventListener(\"DOMContentLoaded\",setupGateway);else setupGateway();";
const badgeStyle='<style>.code-stamp{position:fixed;bottom:12px;right:12px;z-index:100;background:#14253fd9;color:#fff;padding:5px 9px;border-radius:7px;font:10px system-ui,sans-serif;pointer-events:none;box-shadow:0 2px 10px #14253f22}</style>';
function adjust(file,body){
 let s=body.replaceAll('href="/"','href="./index.html"').replaceAll('href="/','href="./').replaceAll('src="/','src="./');
 if(file==="index.html"){
  const old="const response=await fetch('/api/egat/monthly?year='+year+'&month='+month,{signal:AbortSignal.timeout(35000)});";
  if(!s.includes(old))throw Error("Unexpected legacy index.js fetch; leaving site unchanged is unsafe");
  s=s.replace(old,"const response=await fetchMonthly(year,month,{signal:AbortSignal.timeout(35000)});");
  const pos=s.indexOf("async function loadCollected()");
  if(pos<0)throw Error("Missing loadCollected()");
  s=s.slice(0,pos)+helper+s.slice(pos);
 }else if(file==="monthly.js"){
  const old="const r=await fetch(`/api/egat/monthly?year=${year}&month=${month}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(35000)])});";
  if(!s.includes(old))throw Error("Unexpected monthly.js fetch");
  s=helper+s.replace(old,"const r=await fetchMonthly(year,month,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(35000)])});");
  s=s.replace("state.transport==='internal-snapshot'?'● ข้อมูลจริงจาก Collector ภายใน EGAT • สำเนาที่เก็บไว้ ไม่ใช่ Live'",
    "state.transport==='egat-internal-gateway'?(state.cacheHit?'● EGAT Gateway • Cache ที่เก็บไว้':'● Collect จาก EGAT Gateway สำเร็จ • '+state.rows.length+' วัน'):state.transport==='published-snapshot'?'● ข้อมูลที่เผยแพร่ไว้ • ไม่ใช่ Live':state.transport==='internal-snapshot'?'● ข้อมูลจริงจาก Collector ภายใน EGAT • สำเนาที่เก็บไว้ ไม่ใช่ Live'");
  s=s.replace("$('warning').textContent='ยังไม่มีข้อมูลสำหรับเดือนที่เลือก สามารถรับ JSON จาก Collector ภายใน EGAT หรือเลือกโหมดข้อมูลทดสอบได้';",
    "$('warning').textContent='ไม่สามารถโหลดข้อมูลจริง: ตรวจสอบ HTTPS Gateway หรือ CORS ของ API เดิม • ไม่มีการใช้ Mock อัตโนมัติ';");

 }
 if(file==="monthly.html"){
  const gatewayUi='<div class="box" style="padding:10px 15px;margin-bottom:12px"><div class="section" style="gap:8px;flex-wrap:wrap"><label for="egatGatewayUrl" style="font-size:12px">EGAT Collector Gateway (HTTPS ภายใน)</label><input id="egatGatewayUrl" type="url" style="flex:1;min-width:220px" placeholder="https://collector.example.egat"><button type="button" id="egatGatewaySave" class="btn">บันทึก</button></div><div class="muted" id="egatGatewayState">เครื่องใน EGAT ใช้ Gateway กลางที่ได้รับอนุญาต • หากไม่มีจะใช้ Snapshot ที่เผยแพร่แล้ว ไม่ใช่ Live</div></div>';
  s=s.replace("</form>","</form>"+gatewayUi);
 }
 if(file==="index.html"||file==="monthly.html"){
  s=s.replace("</head>",badgeStyle+"</head>");
  s=s.replace("</body>",'<div id="codeStamp" class="code-stamp">lost code : –</div><script src="./version.js"></script></body>');
 }
 return s;
}
await mkdir(OUT,{recursive:true});
for(const file of assets){
 const data=await req(file);
 await writeFile(resolve(OUT,file),Buffer.isBuffer(data)?data:adjust(file,data));
 console.log("prepared",file,typeof data==="string"?data.length:data.byteLength);
}
await writeFile(resolve(OUT,".nojekyll"),"");
const stamp=new Date().toISOString();
await writeFile(resolve(OUT,"version.js"),'document.getElementById("codeStamp").textContent="lost code : "+new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Bangkok",dateStyle:"short",timeStyle:"medium"}).format(new Date('+JSON.stringify(stamp)+'));');
console.log("Published frontend matches original Site layout. No EGAT JSON republished.");
