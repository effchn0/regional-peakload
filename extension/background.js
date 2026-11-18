"use strict";
const SRC="http://control.egat.co.th/gpddwebsite/MonthlyRequirementNonCoPage.aspx";
const COLLECT_TIMEOUT_MS=60000;
let active=false;
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function inject(tabId,func,args=[]){
 const result=await chrome.scripting.executeScript({target:{tabId},func,args});
 return result?.[0]?.result;
}
async function waitComplete(tabId,ms=12000){
 const end=Date.now()+ms;
 while(Date.now()<end){
  const tab=await chrome.tabs.get(tabId);
  if(tab.status==="complete")return;
  await wait(350);
 }
 throw Error("EGAT popup load timeout");
}
function selectMonthYear(year,month){
 if(location.hostname!=="control.egat.co.th")throw Error("Unexpected EGAT origin");
 const form=document.querySelector("form");
 const m=document.querySelector('[name="ctl00$ContentPlaceHolder1$monthList"]');
 const y=document.querySelector('[name="ctl00$ContentPlaceHolder1$YearList"]');
 const submit=document.querySelector('[name="ctl00$ContentPlaceHolder1$btnOk"]');
 if(!form||!m||!y||!submit)throw Error("Missing EGAT month/year form fields");
 function set(select,value){
  const option=[...select.options].find(o=>String(o.value)===String(value)||String(o.textContent).trim()===String(value));
  if(!option)throw Error("EGAT option unavailable: "+value);
  select.value=option.value;
  select.dispatchEvent(new Event("change",{bubbles:true}));
 }
 set(m,String(month).padStart(2,"0"));set(y,String(year));
 // Use actual EGAT submit control and ASP.NET WebForms client events.
 submit.click();
 return {submitted:true};
}
function getTable(year,month){
 if(location.hostname!=="control.egat.co.th")throw Error("Unexpected origin");
 const m=document.querySelector('[name="ctl00$ContentPlaceHolder1$monthList"]');
 const y=document.querySelector('[name="ctl00$ContentPlaceHolder1$YearList"]');
 const pickedMonth=m?.value,pickedYear=y?.value;
 if(pickedMonth&&Number(pickedMonth)!==month)throw Error("EGAT month selection mismatch");
 if(pickedYear&&Number(pickedYear)!==year)throw Error("EGAT year selection mismatch");
 const table=document.getElementById("ContentPlaceHolder1_tblReq");
 if(!table)throw Error("EGAT data table not present");
 const grid=[];
 [...table.querySelectorAll("tr")].slice(0,120).forEach((tr,ri)=>{
  const row=grid[ri]||[];grid[ri]=row;let ci=0;
  [...tr.children].filter(x=>/^(TD|TH)$/.test(x.tagName)).forEach(el=>{
   while(row[ci]!==undefined)ci++;
   const rs=Math.min(60,Math.max(1,Number(el.getAttribute("rowspan"))||1));
   const cs=Math.min(25,Math.max(1,Number(el.getAttribute("colspan"))||1));
   const value=String(el.innerText||el.textContent||"").replace(/\s+/g," ").trim();
   for(let r=ri;r<ri+rs;r++){grid[r]||=[];for(let c=ci;c<ci+cs;c++)grid[r][c]=value}
   ci+=cs;
  });
 });
 const pad=n=>String(n).padStart(2,"0");
 function date(v){
  const match=String(v||"").match(/^(\d{1,2})(?:[\/\-.]\s*(\d{1,2})(?:[\/\-.]\s*(\d{4}))?)?$/);
  if(!match)return null;
  const day=+match[1],mo=match[2]?+match[2]:month,yr=match[3]?(+match[3]>2400?+match[3]-543:+match[3]):year;
  const chk=new Date(Date.UTC(year,month-1,day));
  if(yr!==year||mo!==month||chk.getUTCDate()!==day||chk.getUTCMonth()!==month-1)throw Error("Invalid EGAT date: "+v);
  return year+"-"+pad(month)+"-"+pad(day);
 }
 const na=/^(?:-|–|—|na|n\/a|)$/i;
 function n(v){const s=String(v??"").trim().replace(/,/g,"");if(na.test(s))return null;if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s))throw Error("Invalid numeric cell: "+s);return Number(s)}
 function t(v){const s=String(v??"").trim();if(na.test(s))return null;const z=s.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);if(!z||+z[1]>23||+z[2]>59)throw Error("Invalid peak time: "+s);return pad(z[1])+":"+z[2]}
 const rows=[],seen=new Set();
 for(const c of grid){
  const d=date(c[0]);if(!d)continue;
  if(c.length<19)throw Error("Expected 19 EGAT table columns");
  if(seen.has(d))throw Error("Duplicate EGAT date "+d);
  seen.add(d);
  rows.push({date:d,
   metro:{time:t(c[1]),demand:n(c[2])},
   central:{time:t(c[3]),generation:n(c[4]),export:n(c[5]),demand:n(c[6])},
   northeast:{time:t(c[7]),generation:n(c[8]),export:n(c[9]),demand:n(c[10])},
   south:{time:t(c[11]),generation:n(c[12]),export:n(c[13]),demand:n(c[14])},
   north:{time:t(c[15]),demand:n(c[16])},
   total:{time:t(c[17]),demand:n(c[18])}});
 }
 if(!rows.length)throw Error("EGAT data table has no daily rows");
 rows.sort((a,b)=>a.date.localeCompare(b.date));
 return {schemaVersion:1,source:"EGAT Monthly Requirement",year,month,unit:"MW",
 unitBasis:"project-configuration",collectedAt:new Date().toISOString(),isMock:false,
 transport:"browser-extension",connectionStatus:"collected",rows};
}
async function collect(year,month){
 if(active)throw Error("Another EGAT collection is running");
 active=true;let popupId=null;
 try{
  const popup=await chrome.windows.create({url:SRC,type:"popup",width:1080,height:760,focused:true});
  popupId=popup.id;
  const tabId=popup.tabs?.[0]?.id;
  if(!tabId)throw Error("Could not open EGAT popup");
  await waitComplete(tabId,18000);
  try{
   await inject(tabId,selectMonthYear,[year,month]);
  }catch(e){
   // The form's synchronous submit may unload the frame before executeScript responds.
   // Treat only frame/navigation teardown as expected, not missing field/permission errors.
   if(!/frame|context|destroy|navigation|receiving end/i.test(String(e?.message)))throw e;
  }
  // WebForms may do a full navigation or an async postback.
  const end=Date.now()+COLLECT_TIMEOUT_MS;
  let lastError="";
  await wait(1200);
  while(Date.now()<end){
   try{
    const doc=await inject(tabId,getTable,[year,month]);
    if(doc?.rows?.length)return doc;
    lastError="No daily rows";
   }catch(e){lastError=e.message}
   await wait(700);
  }
  throw Error("Timed out reading EGAT table: "+lastError);
 }finally{
  if(popupId!==null){try{await chrome.windows.remove(popupId)}catch{}}
  active=false;
 }
}
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 const u=sender.tab?.url||sender.url||"";
 if(!u.startsWith("https://effchn0.github.io/regional-peakload/"))return;
 if(message?.action==="ping"){sendResponse({ok:true,version:chrome.runtime.getManifest().version});return}
 if(message?.action!=="collect")return;
 const year=Number(message.year),month=Number(message.month);
 if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(month)||month<1||month>12){
  sendResponse({ok:false,error:"Invalid year/month"});return;
 }
 collect(year,month).then(document=>sendResponse({ok:true,document})).catch(e=>sendResponse({ok:false,error:e.message}));
 return true;
});
