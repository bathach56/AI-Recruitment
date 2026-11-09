const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=process.env.TEST_BASE_URL||'http://localhost:5132';
class Session{
 cookies=new Map();token='';
 async send(url,method='GET',body,csrf=true){const headers={Cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ')};if(csrf&&method!=='GET')headers['X-CSRF-TOKEN']=this.token;if(body&&!(body instanceof FormData))headers['Content-Type']='application/json';const r=await fetch(base+url,{method,headers,body:body?body instanceof FormData?body:JSON.stringify(body):undefined,redirect:'manual'});for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0],i=pair.indexOf('=');this.cookies.set(pair.slice(0,i),pair.slice(i+1))}return r}
 async login(email,password){this.token=(await(await this.send('/api/account/session')).json()).token;assert.equal((await this.send('/api/account/login','POST',{email,password})).status,200);this.token=(await(await this.send('/api/account/session')).json()).token}
}
test('review selection, persistence, Excel routes and permission boundaries', {skip:!process.env.TEST_RECRUITER_PASSWORD||!process.env.TEST_CANDIDATE_PASSWORD},async()=>{
 const guest=new Session(),recruiter=new Session(),candidate=new Session();
 assert.equal((await guest.send('/api/recruiter/reviews')).status,401);
 assert.equal((await guest.send('/ReviewResults')).status,302);
 await recruiter.login('congty@recruitai.test',process.env.TEST_RECRUITER_PASSWORD);
 await candidate.login(process.env.TEST_CANDIDATE_EMAIL||'backend1@recruitai.test',process.env.TEST_CANDIDATE_PASSWORD);
 assert.equal((await candidate.send('/api/recruiter/reviews')).status,403);
 assert.equal((await candidate.send('/ReviewResults')).status,403);
 const page=await recruiter.send('/ReviewResults');assert.equal(page.status,200);assert.match(await page.text(),/review-results\.js/);
 const template=await recruiter.send('/api/recruiter/reviews/excel-template');assert.equal(template.status,200);assert.match(template.headers.get('content-type'),/spreadsheetml/);assert.equal(Buffer.from(await template.arrayBuffer()).subarray(0,2).toString(),'PK');
 const badExcel=new FormData();badExcel.append('file',new Blob(['not xlsx']),'bad.xlsx');assert.equal((await recruiter.send('/api/recruiter/reviews/import-excel','POST',badExcel)).status,400);
 const own=await(await recruiter.send('/api/workspace/applications')).json();assert.ok(own.length);
 const scoped=await recruiter.send('/api/workspace/applications?jobId='+own[0].jobId);assert.equal(scoped.status,200);const scopedRows=await scoped.json();assert.ok(scopedRows.length);assert.ok(scopedRows.every(a=>a.jobId===own[0].jobId));
 assert.equal((await recruiter.send('/api/workspace/applications?jobId=2147483647')).status,404);
 const config={job_title:'[Kiểm thử API] Đợt xét CV',job_description:'C# ASP.NET SQL Server developer',model_type:'TF-IDF'};
 function form(ids,external=true,upload=false){const data=new FormData();data.append('requestJson',JSON.stringify({jobId:own[0].jobId,configuration:config,applicationIds:ids,externalRows:external?[{name:'[Kiểm thử] CV văn bản',email:'fixture@example.test',cvText:'C# ASP.NET Core SQL Server. Total experience: 3 years.'}]:[]}));if(upload)data.append('files',new Blob([fs.readFileSync(path.join(__dirname,'../../data/sample_cvs/CV_LeHoangLong_Fresher_DotNet.docx'))]),'fixture-upload.docx');return data}
 assert.equal((await recruiter.send('/api/recruiter/reviews','POST',form([2147483647]))).status,400);
 assert.equal((await recruiter.send('/api/recruiter/reviews','POST',form([],false))).status,400);
 assert.equal((await recruiter.send('/api/recruiter/reviews','POST',form([own[0].id]),false)).status,400);
 const created=await recruiter.send('/api/recruiter/reviews','POST',form([own[0].id],true,true));assert.equal(created.status,200);const {id}=await created.json();
 let batch=await(await recruiter.send('/api/recruiter/reviews/'+id)).json();assert.equal(batch.items.length,3);assert.ok(batch.items.every(i=>i.score===null));assert.deepEqual(new Set(batch.items.map(i=>i.source)),new Set(['Application','ExcelOrText','Upload']));
 const jobs=await(await recruiter.send('/api/workspace/jobs')).json(),posted=jobs.find(j=>j.id===own[0].jobId);assert.ok(posted);
 assert.equal(batch.configuration.job_id,posted.id);assert.equal(batch.configuration.job_title,posted.title);
 assert.ok(batch.configuration.job_description.includes(posted.description));assert.notEqual(batch.configuration.job_description,config.job_description,'client JD must not replace stored JD');
 const otherJob=jobs.find(j=>j.id!==posted.id);
 if(otherJob){const mismatched=form([own[0].id]);const input=JSON.parse(mismatched.get('requestJson'));input.jobId=otherJob.id;mismatched.set('requestJson',JSON.stringify(input));assert.equal((await recruiter.send('/api/recruiter/reviews','POST',mismatched)).status,400)}
 const missingJob=form([own[0].id]);const input=JSON.parse(missingJob.get('requestJson'));delete input.jobId;missingJob.set('requestJson',JSON.stringify(input));assert.equal((await recruiter.send('/api/recruiter/reviews','POST',missingJob)).status,400);
 const analyzed=await recruiter.send(`/api/recruiter/reviews/${id}/items/${batch.items[0].id}/analyze`,'POST');assert.equal(analyzed.status,200);const result=await analyzed.json();assert.ok(['Complete','Incomplete','Error'].includes(result.state));if(result.state==='Error'){assert.equal(result.score,null);assert.equal(result.result,null)}
 batch=await(await recruiter.send('/api/recruiter/reviews/'+id)).json();assert.equal(batch.items.find(i=>i.id===result.id).state,result.state,'reloading must preserve state');
 const byState=await(await recruiter.send(`/api/recruiter/reviews/${id}?state=${result.state}`)).json();assert.equal(byState.items.length,1);
 const exported=await recruiter.send(`/api/recruiter/reviews/${id}/excel?state=${result.state}`);assert.equal(exported.status,200);assert.match(exported.headers.get('content-type'),/spreadsheetml/);assert.match(exported.headers.get('content-disposition'),/\.xlsx/);assert.equal(Buffer.from(await exported.arrayBuffer()).subarray(0,2).toString(),'PK');
 assert.equal((await candidate.send(`/api/recruiter/reviews/${id}/excel`)).status,403);
 assert.equal((await recruiter.send('/api/recruiter/reviews/00000000-0000-0000-0000-000000000000')).status,404);
 const list=await(await recruiter.send('/api/recruiter/reviews')).json();assert.ok(list.some(b=>b.id===id));
});
