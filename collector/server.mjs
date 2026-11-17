// Node.js >=20. Run only on an authorized EGAT-network computer.
// Environment variables: SERVER_API_URL, SERVER_WRITE_TOKEN, EGAT_DATA_URL.
// EGAT_DATA_URL must be an approved API returning {rows:[{date,region,load}]}.
// Do not put any credentials in the public GitHub Pages frontend.
import http from "node:http";
const HOST="127.0.0.1", PORT=Number(process.env.PORT||8765);
const ORIGIN="https://effchn0.github.io";
const API=(process.env.SERVER_API_URL||"").replace(/\/$/,"");
const TOKEN=process.env.SERVER_WRITE_TOKEN||"";
const SOURCE=process.env.EGAT_DATA_URL||"";
const MONTHS=Array.from({length:12},(_,i)=>i+1);
const output=(res,status,data)=>{res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Private-Network":"true","Cache-Control":"no-store","Vary":"Origin"});res.end(JSON.stringify(data))};
function requireValidURL(value,requireHttps){let u=new URL(value);if(requireHttps&&u.protocol!=="https:")throw Error("HTTPS URL required");return u}
async function runCollect(payload){
 if(!API||!TOKEN||!SOURCE)throw Error("Collector ยังไม่ตั้งค่า SERVER_API_URL, SERVER_WRITE_TOKEN, EGAT_DATA_URL");
 const {year,fromMonth,toMonth}=payload;
 if(!Number.isInteger(year)||year<2000||year>2100||!MONTHS.includes(fromMonth)||!MONTHS.includes(toMonth)||fromMonth>toMonth)throw Error("Invalid month/year range");
 const target=requireValidURL(SOURCE,true);
 let all=[];
 for(let m=fromMonth;m<=toMonth;m++){
   target.searchParams.set("year",String(year));target.searchParams.set("month",String(m));
   // Authorization to the EGAT API, if required, must be implemented here using
   // a securely managed local credential; no Session/Hidden Fields forwarded.
   let resp=await fetch(target,{signal:AbortSignal.timeout(30000)});
   if(!resp.ok)throw Error("EGAT data source HTTP "+resp.status+" month="+m);
   const json=await resp.json();
   if(!Array.isArray(json.rows))throw Error("EGAT source adapter must return JSON {rows:[...]}");
   all.push(...json.rows);
 }
 let result=await fetch(API+"/api/data",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+TOKEN},body:JSON.stringify({rows:all}),signal:AbortSignal.timeout(30000)});
 let body=await result.json().catch(()=>({}));
 if(!result.ok)throw Error("Server storage failed: "+(body.error||result.status));
 return {count:all.length,saved:body.total};
}
http.createServer(async(req,res)=>{
 if(req.method==="OPTIONS"){if(req.headers.origin && req.headers.origin!==ORIGIN)return output(res,403,{error:"Origin not permitted"});return output(res,204,{})}
 if(req.headers.origin && req.headers.origin!==ORIGIN)return output(res,403,{error:"Origin not permitted"});
 if(req.url==="/health"&&req.method==="GET")return output(res,200,{ready:Boolean(API&&TOKEN&&SOURCE),configured:{server:Boolean(API),writeToken:Boolean(TOKEN),egatSource:Boolean(SOURCE)}});
 if(req.url!=="/collect"||req.method!=="POST")return output(res,404,{error:"Not found"});
 try{
  let data="";for await(const chunk of req){data+=chunk;if(data.length>8192)throw Error("Payload too large")}
  const result=await runCollect(JSON.parse(data));
  output(res,200,result);
 }catch(e){output(res,503,{error:e.message})}
}).listen(PORT,HOST,()=>console.log("Collector listening at http://"+HOST+":"+PORT));
