// EGAT Monthly Requirement shared gateway (Node.js 20+).
// Run once on an organization-approved machine with access to EGAT.
// Place behind an authenticated HTTPS reverse proxy reachable only via EGAT network/VPN.
// This HTTP service intentionally listens on loopback: reverse proxy connects locally.
// No EGAT Cookie, Session or ASP.NET hidden fields are ever sent to browser.
import http from "node:http";
import { collectRange } from "../collector/egat.mjs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const HOST="127.0.0.1";
const PORT=Number(process.env.PORT||8765);
const ORIGIN="https://effchn0.github.io";
const ROOT=resolve(process.env.COLLECTOR_DATA_DIR||process.cwd());
let busy=false;
function reply(res,code,data){
 res.writeHead(code,{"Content-Type":"application/json; charset=utf-8",
 "Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Methods":"GET,POST,OPTIONS",
 "Access-Control-Allow-Headers":"Content-Type","Cache-Control":"no-store","Vary":"Origin"});
 res.end(code===204?"":JSON.stringify(data));
}
http.createServer(async(req,res)=>{
 // Browser Origin restriction is not authentication; the HTTPS reverse proxy
 // MUST restrict access to authenticated EGAT users on the approved network.
 if(req.headers.origin && req.headers.origin!==ORIGIN)return reply(res,403,{error:"Origin not allowed"});
 if(req.method==="OPTIONS")return reply(res,204,{});
 if(req.url==="/health" && req.method==="GET")return reply(res,200,{ready:true,mode:"egat-internal-gateway"});
 if(req.url!=="/collect"||req.method!=="POST")return reply(res,404,{error:"Not found"});
 if(busy)return reply(res,409,{error:"Collect already running"});
 busy=true;
 try{
  let body="";for await(const chunk of req){body+=chunk;if(body.length>4096)throw Error("Request too large")}
  const arg=JSON.parse(body);
  const year=Number(arg.year),fromMonth=Number(arg.fromMonth),toMonth=Number(arg.toMonth);
  if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(fromMonth)||!Number.isInteger(toMonth)||fromMonth<1||toMonth>12||fromMonth>toMonth)throw Error("Invalid requested year/months");
  const output=await collectRange(year,fromMonth,toMonth,{root:ROOT});
  const documents=await Promise.all(output.map(async x=>{
   const raw=JSON.parse(await readFile(x.file,"utf8"));
   const {schemaVersion,source,year,month,unit,unitBasis,collectedAt,isMock,rows}=raw;
   return {schemaVersion,source,year,month,unit,unitBasis,collectedAt,isMock,rows};
  }));
  reply(res,200,{documents,months:documents.length,count:documents.reduce((n,d)=>n+d.rows.length,0),published:false});
 }catch(e){reply(res,503,{error:e.message})}finally{busy=false}
}).listen(PORT,HOST,()=>console.log("Approved internal gateway (HTTP loopback) listening at "+HOST+":"+PORT));
