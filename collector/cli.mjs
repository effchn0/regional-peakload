import { collectRange } from "./egat.mjs";
const year=Number(process.argv[2]),fromMonth=Number(process.argv[3]),toMonth=Number(process.argv[4]??process.argv[3]);
if(!Number.isInteger(year)||!Number.isInteger(fromMonth)||!Number.isInteger(toMonth)){
 console.error("Usage: npm run collect -- 2026 1 11");process.exit(2);
}
try{
 const results=await collectRange(year,fromMonth,toMonth,{root:process.cwd(),force:process.argv.includes("--force")});
 for(const r of results)console.log(r.file+" ("+r.rows+" rows"+(r.cached?", cached":"")+")");
 console.log("Review data/*.json before committing/pushing. No cookies or session data are stored.");
}catch(e){console.error("Collect failed: "+e.message);process.exitCode=1}
