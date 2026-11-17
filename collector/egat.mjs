import { load } from "cheerio";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { resolve, join } from "node:path";

export const SOURCE_URL = "http://control.egat.co.th/gpddwebsite/MonthlyRequirementNonCoPage.aspx";
export const TIMEOUT_MS = 20000;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const pad=n=>String(n).padStart(2,"0");
const clean=s=>String(s??"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim();
const NA=/^(?:-|–|—|n\/a|na|)$/i;
const fields=["metro","central","northeast","south","north","total"];
function numeric(input){
 const s=clean(input).replace(/,/g,"");if(NA.test(s))return null;
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s))throw Error("Invalid numeric cell: "+s.slice(0,50));
 return Number(s);
}
function peakTime(input){
 const s=clean(input);if(NA.test(s))return null;
 const m=s.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);
 if(!m||Number(m[1])>23||Number(m[2])>59)throw Error("Invalid peak time "+s);
 return pad(m[1])+":"+m[2];
}
function parseDate(input,year,month){
 const s=clean(input),m=s.match(/^(\d{1,2})(?:[\/\-.]\s*(\d{1,2})(?:[\/\-.]\s*(\d{4}))?)?$/);
 if(!m)return null;
 const d=Number(m[1]),mm=m[2]?Number(m[2]):month;
 let yy=m[3]?Number(m[3]):year;if(yy>2400)yy-=543;
 if(mm!==month||yy!==year)throw Error("Wrong month/year in row: "+s);
 const test=new Date(Date.UTC(year,month-1,d));
 if(test.getUTCFullYear()!==year||test.getUTCMonth()+1!==month||test.getUTCDate()!==d)throw Error("Invalid date: "+s);
 return year+"-"+pad(month)+"-"+pad(d);
}
function gridForTable($,table){
 const grid=[];
 $(table).find("tr").each((ri,tr)=>{
  const row=grid[ri]||[];grid[ri]=row;
  let ci=0;
  $(tr).children("td,th").each((_,el)=>{
   while(row[ci]!==undefined)ci++;
   const v=clean($(el).text());
   const rs=Math.max(1,Number($(el).attr("rowspan")||1)),cs=Math.max(1,Number($(el).attr("colspan")||1));
   for(let r=ri;r<ri+rs;r++){grid[r] ||= [];for(let c=ci;c<ci+cs;c++){grid[r][c]=v}}
   ci+=cs;
  });
 });
 return grid;
}
export function parseMonthlyHtml(html,year,month){
 const $=load(html);
 const table=$("#ContentPlaceHolder1_tblReq");if(table.length!==1)throw Error("EGAT requirement table not found");
 const grid=gridForTable($,table[0]),rows=[],seen=new Set();
 for(const cells of grid){
  if(!cells.length)continue;
  let date=parseDate(cells[0],year,month);if(!date)continue;
  if(cells.length<19)throw Error("Expected 19 columns, got "+cells.length+" on "+date);
  if(seen.has(date))throw Error("Duplicate date "+date);seen.add(date);
  const row={date,
   metro:{time:peakTime(cells[1]),demand:numeric(cells[2])},
   central:{time:peakTime(cells[3]),generation:numeric(cells[4]),export:numeric(cells[5]),demand:numeric(cells[6])},
   northeast:{time:peakTime(cells[7]),generation:numeric(cells[8]),export:numeric(cells[9]),demand:numeric(cells[10])},
   south:{time:peakTime(cells[11]),generation:numeric(cells[12]),export:numeric(cells[13]),demand:numeric(cells[14])},
   north:{time:peakTime(cells[15]),demand:numeric(cells[16])},
   total:{time:peakTime(cells[17]),demand:numeric(cells[18])}
  };rows.push(row);
 }
 if(!rows.length)throw Error("No data rows found in requirement table");
 rows.sort((a,b)=>a.date.localeCompare(b.date));
 return rows;
}
function pageState(html){
 const $=load(html),hidden=new URLSearchParams();
 $('input[type="hidden"][name]').each((_,x)=>{let name=$(x).attr("name");if(name.startsWith("__"))hidden.set(name,$(x).val()??"")});
 for(const required of ["__VIEWSTATE","__VIEWSTATEGENERATOR","__EVENTVALIDATION"]){if(!hidden.has(required))throw Error("Missing "+required)}
 return hidden;
}
async function request(url,opts={}){
 const response=await fetch(url,{...opts,signal:AbortSignal.timeout(TIMEOUT_MS),redirect:"manual"});
 if(!response.ok)throw Error("EGAT HTTP "+response.status);
 return response;
}
function cookiesFromResponse(response){
 const cookies=response.headers.getSetCookie?.()||[response.headers.get("set-cookie")].filter(Boolean);
 return cookies.map(s=>s.split(";")[0]).filter(Boolean).join("; ");
}
export async function collectMonth(year,month,{root=process.cwd(),force=false,cacheMs=15*60*1000}={}){
 if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(month)||month<1||month>12)throw Error("Invalid month/year");
 const folder=resolve(root,"data"),dest=join(folder,year+"-"+pad(month)+".json");
 if(!force){try{let cached=JSON.parse(await readFile(dest,"utf8"));let age=Date.now()-Date.parse(cached.collectedAt);if(age>=0&&age<cacheMs&&cached.schemaVersion===1)return {file:dest,rows:cached.rows.length,cached:true}}catch{}}
 // Fresh GET for every POST; do not persist cookies or hidden form data.
 const get=await request(SOURCE_URL,{method:"GET"});
 const cookie=cookiesFromResponse(get),hidden=pageState(await get.text());
 hidden.set("__EVENTTARGET","");hidden.set("__EVENTARGUMENT","");
 hidden.set("ctl00$ContentPlaceHolder1$monthList",pad(month));
 hidden.set("ctl00$ContentPlaceHolder1$YearList",String(year));
 hidden.set("ctl00$ContentPlaceHolder1$btnOk","ตกลง");
 const headers={"Content-Type":"application/x-www-form-urlencoded"};
 if(cookie)headers.Cookie=cookie;
 const post=await request(SOURCE_URL,{method:"POST",headers,body:hidden.toString()});
 const rows=parseMonthlyHtml(await post.text(),year,month);
 const document={schemaVersion:1,source:"EGAT Monthly Requirement",year,month,unit:"MW",unitBasis:"project-configuration",collectedAt:new Date().toISOString(),isMock:false,rows};
 await mkdir(folder,{recursive:true});
 const temp=dest+".tmp-"+process.pid;await writeFile(temp,JSON.stringify(document,null,2)+"\n",{mode:0o600});await rename(temp,dest);
 return {file:dest,rows:rows.length,cached:false};
}
export async function collectRange(year,fromMonth,toMonth,opts={}){
 if(!Number.isInteger(year)||!Number.isInteger(fromMonth)||!Number.isInteger(toMonth)||fromMonth<1||toMonth>12||fromMonth>toMonth)throw Error("Invalid month range");
 const result=[];for(let month=fromMonth;month<=toMonth;month++){result.push(await collectMonth(year,month,opts));if(month<toMonth)await delay(500)}return result;
}
