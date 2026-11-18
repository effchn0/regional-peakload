"use strict";
const ALLOWED= "https://effchn0.github.io";
if(location.origin===ALLOWED&&location.pathname.startsWith("/regional-peakload/")){
 window.addEventListener("message",event=>{
  if(event.source!==window||event.origin!==ALLOWED)return;
  const m=event.data;
  if(!m||m.channel!=="EGAT_REGIONAL_BRIDGE"||m.from!=="dashboard"||typeof m.id!=="string"||m.id.length>80)return;
  if(m.action!=="ping"&&m.action!=="collect")return;
  const year=Number(m.year),month=Number(m.month);
  if(m.action==="collect"&&(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(month)||month<1||month>12))return;
  chrome.runtime.sendMessage({action:m.action,year,month},response=>{
   const error=chrome.runtime.lastError?.message;
   window.postMessage({channel:"EGAT_REGIONAL_BRIDGE",from:"extension",id:m.id,
     ok:!error&&Boolean(response?.ok),error:error||response?.error||null,
     document:response?.document||null},ALLOWED);
  });
 });
}
