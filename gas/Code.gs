/**
 * Regional Peak Load - EGAT Monthly Requirement Apps Script backend.
 * Existing Script ID: 1jp9c9JRZd2UIPb5LFhdhH56XA_KR-t5PeM2YMpNJ4lMKomouSXbfwsWB
 * Never publish any EGAT source data without organizational authorization.
 * Deploy to authorized users only, execute as user accessing (NOT anyone execute as owner).
 */
const EGAT_SOURCE = 'http://control.egat.co.th/gpddwebsite/MonthlyRequirementNonCoPage.aspx';
const GH_ORIGIN = 'https://effchn0.github.io';
const APPS_VERSION = '2026-11-18-gas-v1';
function doGet(e) {
 const page = HtmlService.createTemplateFromFile('Bridge');
 page.origin = GH_ORIGIN;
 page.version = APPS_VERSION;
 return page.evaluate().setTitle('EGAT Monthly Requirement API')
  .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function probeSource() {
 const at = new Date().toISOString();
 try {
  const r=UrlFetchApp.fetch(EGAT_SOURCE,{method:'get',muteHttpExceptions:true,
    followRedirects:false,validateHttpsCertificates:true});
  const body=r.getContentText()||'';
  const status=r.getResponseCode();
  return {at,version:APPS_VERSION,sourceReachable:status>=200&&status<300,
    httpStatus:status,hasWebForms:body.includes('__VIEWSTATE'),
    hasTable:body.includes('ContentPlaceHolder1_tblReq'),
    message:status>=200&&status<300?'Google Apps Script GET reached EGAT':'EGAT returned HTTP '+status};
 }catch(err){
  return {at,version:APPS_VERSION,sourceReachable:false,
    message:String(err?.message||err).slice(0,500)};
 }
}
function safe_(str) {
 return String(str==null?'':str).replace(/&nbsp;|&#160;/gi,' ')
  .replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
  .replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(Number(d)))
  .replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}
function inputValue_(html,name) {
 const escaped=name.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&');
 const re=new RegExp('<input\\b(?=[^>]*\\bname\\s*=\\s*["\\\']'+escaped+'["\\\'])[^>]*>', 'ig');
 const input=(re.exec(html)||[])[0];
 if(!input)throw Error('Missing field '+name);
 return ((input.match(/\bvalue\s*=\s*(?:"([^"]*)"|'([^']*)')/i)||[]).slice(1).find(x=>x!==undefined)||'')
   .replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&');
}
function rowGrid_(html) {
 const tb=(html.match(/<table\b[^>]*id\s*=\s*["']ContentPlaceHolder1_tblReq["'][^>]*>[\s\S]*?<\/table>/i)||[])[0];
 if(!tb)throw Error('EGAT requirement table not found');
 const grid=[],trs=tb.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)||[];
 trs.forEach((tr,ri)=>{
   const cells=tr.match(/<(?:td|th)\b[^>]*>[\s\S]*?<\/(?:td|th)>/gi)||[];
   const row=grid[ri]||[];grid[ri]=row;let col=0;
   cells.forEach(cell=>{
     while(row[col]!==undefined)col++;
     const m=cell.match(/^<\w+\b([^>]*)>/),attrs=m?m[1]:'';
     const rs=Math.min(80,Math.max(1,Number((attrs.match(/rowspan\s*=\s*["']?(\d+)/i)||[])[1]||1)));
     const cs=Math.min(25,Math.max(1,Number((attrs.match(/colspan\s*=\s*["']?(\d+)/i)||[])[1]||1)));
     const v=safe_(cell);
     for(let r=ri;r<ri+rs;r++){if(!grid[r])grid[r]=[];for(let c=col;c<col+cs;c++)grid[r][c]=v}
     col+=cs;
   });
 });
 return grid;
}
function parseRows_(html,year,month){
 const grid=rowGrid_(html),out=[],seen={};
 const pad=n=>('0'+n).slice(-2);
 function n(v){const s=String(v||'').replace(/,/g,'').trim();if(!s||/^[-–—]$/.test(s))return null;if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s))throw Error('Bad numeric cell '+s);return Number(s)}
 function t(v){const s=String(v||'').trim();if(!s||/^[-–—]$/.test(s))return null;const x=s.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);if(!x||+x[1]>23||+x[2]>59)throw Error('Bad time '+s);return pad(x[1])+':'+x[2]}
 grid.forEach(c=>{
  if(!c?.length)return;
  const m=String(c[0]).match(/^(\d{1,2})(?:[\/\-.]\s*(\d{1,2})(?:[\/\-.]\s*(\d{4}))?)?$/);
  if(!m)return;
  const day=+m[1],mo=m[2]?+m[2]:month,yy=m[3]?(+m[3]>2400?+m[3]-543:+m[3]):year;
  const test=new Date(Date.UTC(year,month-1,day));
  if(mo!==month||yy!==year||test.getUTCMonth()!==month-1||test.getUTCDate()!==day)throw Error('Bad EGAT date '+c[0]);
  if(c.length<19)throw Error('Expected 19 columns');
  const date=year+'-'+pad(month)+'-'+pad(day);
  if(seen[date])throw Error('Duplicate date '+date);seen[date]=true;
  out.push({date,metro:{time:t(c[1]),demand:n(c[2])},
   central:{time:t(c[3]),generation:n(c[4]),export:n(c[5]),demand:n(c[6])},
   northeast:{time:t(c[7]),generation:n(c[8]),export:n(c[9]),demand:n(c[10])},
   south:{time:t(c[11]),generation:n(c[12]),export:n(c[13]),demand:n(c[14])},
   north:{time:t(c[15]),demand:n(c[16])},total:{time:t(c[17]),demand:n(c[18])}});
 });
 if(!out.length)throw Error('No daily rows found');
 out.sort((a,b)=>a.date.localeCompare(b.date));
 return out;
}
function collectMonthly(year,month){
 year=Number(year);month=Number(month);
 if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(month)||month<1||month>12)throw Error('Invalid month/year');
 // Explicit administrative guard: keep disabled until EGAT collection/release is approved.
 if(PropertiesService.getScriptProperties().getProperty('ALLOW_EGAT_COLLECT')!=='true')
   throw Error('Collector is disabled. Administrator must authorize ALLOW_EGAT_COLLECT=true.');
 const opts={muteHttpExceptions:true,followRedirects:false};
 const first=UrlFetchApp.fetch(EGAT_SOURCE,{...opts,method:'get'});
 if(first.getResponseCode()!==200)throw Error('EGAT GET HTTP '+first.getResponseCode());
 const html=first.getContentText();
 const fields=['__VIEWSTATE','__VIEWSTATEGENERATOR','__EVENTVALIDATION'];
 const form={};
 fields.forEach(k=>{form[k]=inputValue_(html,k)});
 form.__EVENTTARGET='';form.__EVENTARGUMENT='';
 form['ctl00$ContentPlaceHolder1$monthList']=('0'+month).slice(-2);
 form['ctl00$ContentPlaceHolder1$YearList']=String(year);
 form['ctl00$ContentPlaceHolder1$btnOk']='ตกลง';
 const cookies=first.getAllHeaders()['Set-Cookie']||first.getAllHeaders()['set-cookie']||'';
 const cookie=(Array.isArray(cookies)?cookies:[cookies]).map(x=>String(x).split(';')[0]).filter(Boolean).join('; ');
 const headers={};if(cookie)headers.Cookie=cookie;
 const post=UrlFetchApp.fetch(EGAT_SOURCE,{...opts,method:'post',headers,payload:form});
 if(post.getResponseCode()!==200)throw Error('EGAT POST HTTP '+post.getResponseCode());
 const rows=parseRows_(post.getContentText(),year,month);
 return {schemaVersion:1,source:'EGAT Monthly Requirement',sourceUrl:EGAT_SOURCE,year,month,
  unit:'MW',unitBasis:'project-configuration',collectedAt:new Date().toISOString(),
  isMock:false,transport:'google-apps-script',connectionStatus:'collected',rows};
}

/** Run this from Apps Script editor to see actual EGAT connectivity result. */
function testProbeSource() {
 const result = probeSource();
 console.log(JSON.stringify(result, null, 2));
 return result;
}
