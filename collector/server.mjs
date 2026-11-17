// Node 20+; localhost only. Run from repository root with: npm run collector:server
import http from "node:http";
import { collectRange } from "./egat.mjs";
const HOST="127.0.0.1",PORT=Number(process.env.PORT||8765);
const ORIGIN="https://effchn0.github.io", ROOT=process.cwd();
let busy=false;
function response(res,status,obj){
 res.writeHead(status,{"Content-Type":"application/json; charset=utf-8",
 "Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Methods":"GET,POST,OPTIONS",
 "Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Private-Network":"true",
 "Cache-Control":"no-store","Vary":"Origin"});res.end(JSON.stringify(obj));
}
http.createServer(async(req,res)=>{
 if(req.headers.host!==HOST+":"+PORT&&req.headers.host!=="localhost:"+PORT)return response(res,403,{error:"Invalid Host"});
 if(req.headers.origin&&req.headers.origin!==ORIGIN)return response(res,403,{error:"Origin not allowed"});
 if(req.method==="OPTIONS")return response(res,204,{});
 if(req.url==="/health"&&req.method==="GET")return response(res,200,{ready:true,mode:"local-files",publishRequired:true});
 if(req.url!=="/collect"||req.method!=="POST")return response(res,404,{error:"Not found"});
 if(busy)return response(res,409,{error:"Collector is already running"});
 busy=true;
 try{
  let body="";for await(const chunk of req){body+=chunk;if(body.length>4096)throw Error("Request too large")}
  const payload=JSON.parse(body),year=Number(payload.year),fromMonth=Number(payload.fromMonth),toMonth=Number(payload.toMonth);
  const result=await collectRange(year,fromMonth,toMonth,{root:ROOT,force:Boolean(payload.force)});
  response(res,200,{count:result.reduce((a,r)=>a+r.rows,0),months:result.length,files:result.map(r=>({name:r.file.split(/[/\\]/).pop(),rows:r.rows,cached:r.cached})),published:false,message:"สร้าง JSON ใน Local Repository แล้ว ต้องตรวจสอบและ Push เฉพาะไฟล์ data/ ไป GitHub จึงจะปรากฏบนเว็บไซต์"});
 }catch(e){response(res,503,{error:e.message})}finally{busy=false}
}).listen(PORT,HOST,()=>console.log("EGAT collector on http://"+HOST+":"+PORT+" (local files only)"));
