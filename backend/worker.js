// Cloudflare Worker with KV binding LOAD_KV and secret WRITE_TOKEN.
// Never store EGAT credentials, Session cookies or ASP.NET hidden fields here.
const ALLOWED_ORIGIN = "https://effchn0.github.io";
const REGIONS = new Set(["ภาคเหนือ","ภาคตะวันออกเฉียงเหนือ","ภาคกลาง","ภาคตะวันออก","ภาคตะวันตก","ภาคใต้"]);
function headers(origin) {
 const h={"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin"};
 if(origin===ALLOWED_ORIGIN){h["Access-Control-Allow-Origin"]=origin;h["Access-Control-Allow-Methods"]="GET,POST,OPTIONS";h["Access-Control-Allow-Headers"]="Content-Type,Authorization";}
 return h;
}
const reply=(data,status,origin)=>new Response(JSON.stringify(data),{status,headers:headers(origin)});
export default {async fetch(request,env){
 const u=new URL(request.url),origin=request.headers.get("Origin")||"";
 if(u.pathname!=="/api/data")return reply({error:"Not found"},404,origin);
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:headers(origin)});
 if(request.method==="GET"){
  const rows=JSON.parse(await env.LOAD_KV.get("rows")||"[]");
  return reply({rows},200,origin);
 }
 if(request.method!=="POST")return reply({error:"Method not allowed"},405,origin);
 if(!env.WRITE_TOKEN || request.headers.get("Authorization")!=="Bearer "+env.WRITE_TOKEN)return reply({error:"Unauthorized"},401,origin);
 let body;try{body=await request.json()}catch{return reply({error:"Invalid JSON"},400,origin)}
 if(!Array.isArray(body.rows)||body.rows.length>50000)return reply({error:"rows array required (max 50000)"},400,origin);
 const map=new Map((JSON.parse(await env.LOAD_KV.get("rows")||"[]")).map(r=>[r.date+"|"+r.region,r]));
 for(const r of body.rows){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date||"")||!REGIONS.has(r.region)||!(r.load===null||typeof r.load==="number"&&Number.isFinite(r.load)&&r.load>=0))return reply({error:"Invalid data row"},400,origin);
  map.set(r.date+"|"+r.region,{date:r.date,region:r.region,load:r.load});
 }
 const rows=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.region.localeCompare(b.region));
 await env.LOAD_KV.put("rows",JSON.stringify(rows));
 return reply({count:body.rows.length,total:rows.length},200,origin);
}};
