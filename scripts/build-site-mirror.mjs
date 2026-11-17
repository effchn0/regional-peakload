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
const helper=`async function fetchMonthly(year,month,{signal}={}){
 const archive="./data/"+year+"-"+String(month).padStart(2,"0")+".json";
 try{const r=await fetch(archive,{signal,cache:"no-store"});if(r.ok&&r.headers.get("content-type")?.includes("json"))return r;}catch{}
 return fetch("${LEGACY_API}/monthly?year="+year+"&month="+month,{signal,cache:"no-store",credentials:"omit"});
}
`;
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
await writeFile(resolve(OUT,"version.js"),'document.getElementById("codeStamp").textContent="lost code : "+new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Bangkok",dateStyle:"short",timeStyle:"medium"}).format(new Date('+JSON.stringify(new Date().toISOString())+'));');
console.log("Published frontend matches original Site layout. No EGAT JSON republished.");
