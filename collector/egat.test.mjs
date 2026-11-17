import test from "node:test";
import assert from "node:assert/strict";
import {parseMonthlyHtml} from "./egat.mjs";
const cells=[
 "1/1/2569","18:20","2,150.5",
 "19:10","2,300","10","2,290",
 "18:00","1,100","–","1,080",
 "20:30","2,700","30","2,670",
 "18:45","1,500",
 "19:20","9,690"
];
const html=(parts)=>`<table id="ContentPlaceHolder1_tblReq"><tr><th rowspan="2">วันที่</th><th colspan="18">หัวตาราง</th></tr><tr><th colspan="18">ข้อมูล</th></tr><tr>${parts.map(x=>"<td><font>"+x+"</font></td>").join("")}</tr></table>`;
test("parses rowspan/colspan header and nested font cells",()=>{
 const a=parseMonthlyHtml(html(cells),2026,1);
 assert.equal(a.length,1);assert.equal(a[0].date,"2026-01-01");
 assert.equal(a[0].metro.demand,2150.5);
 assert.equal(a[0].central.generation,2300);
 assert.equal(a[0].northeast.export,null);
 assert.equal(a[0].south.time,"20:30");
 assert.equal(a[0].total.demand,9690);
});
test("does not synthesize total from regional values",()=>{
 const a=parseMonthlyHtml(html(cells),2026,1);
 assert.equal(a[0].total.demand,9690);
 assert.notEqual(a[0].total.demand,[a[0].metro,a[0].central,a[0].northeast,a[0].south,a[0].north].reduce((n,x)=>n+x.demand,0));
});
test("rejects date from wrong month",()=>{
 const a=[...cells];a[0]="2/2/2569";
 assert.throws(()=>parseMonthlyHtml(html(a),2026,1),/Wrong month/);
});
test("rejects duplicate dates",()=>{
 const row=cells.map(x=>"<td>"+x+"</td>").join("");
 assert.throws(()=>parseMonthlyHtml('<table id="ContentPlaceHolder1_tblReq"><tr>'+row+'</tr><tr>'+row+'</tr></table>',2026,1),/Duplicate date/);
});
test("keeps missing values null, actual zero numeric",()=>{
 const a=[...cells];a[2]="–";a[4]="0";
 const row=parseMonthlyHtml(html(a),2026,1)[0];
 assert.equal(row.metro.demand,null);assert.equal(row.central.generation,0);
});
