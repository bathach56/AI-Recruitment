// End-to-end local scenario: real authentication, private upload, applications and AI.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),privateRoot=path.join(root,'webAI/App_Data');
const base=process.env.TEST_BASE_URL||'http://localhost:5132';
const scenario=JSON.parse(fs.readFileSync(path.join(__dirname,'scenario.json'),'utf8'));
const credentials=JSON.parse(fs.readFileSync(path.join(privateRoot,'scenario-accounts.json'),'utf8'));
class Session{
 cookies=new Map();token='';
 async send(url,method='GET',body){
  const headers={Cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; '),'X-CSRF-TOKEN':this.token};
  if(body!==undefined&&!(body instanceof FormData))headers['Content-Type']='application/json';
  const r=await fetch(base+url,{method,headers,body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});
  for(const c of r.headers.getSetCookie()){const [pair]=c.split(';'),i=pair.indexOf('=');this.cookies.set(pair.slice(0,i),pair.slice(i+1))}return r;
 }
 async json(url,method='GET',body){const r=await this.send(url,method,body);assert.equal(r.status,200,`${method} ${url}: ${await (r.status===200?Promise.resolve(''):r.text())}`);return r.json()}
 async login(email,password){this.token=(await this.json('/api/account/session')).token;await this.json('/api/account/login','POST',{email,password});this.token=(await this.json('/api/account/session')).token}
}
async function main(){
 const recruiter=new Session();await recruiter.login('congty@recruitai.test',process.env.TEST_RECRUITER_PASSWORD);
 const jobs=await recruiter.json('/api/workspace/jobs');assert.equal(jobs.filter(j=>j.status==='Published').length,3);
 if(process.argv.includes('--submit')){
  for(const c of scenario.candidates){
   const account=credentials.find(a=>a.Email===c.email),s=new Session();await s.login(c.email,account.password);
   const job=jobs.find(j=>j.title.toLowerCase().startsWith(c.group));assert.ok(job);
   const existing=await s.json('/api/workspace/applications');if(existing.some(a=>a.jobId===job.id))continue;
   const form=new FormData();form.append('file',new Blob([fs.readFileSync(path.join(privateRoot,'scenario-cvs',c.email.split('@')[0]+'.pdf'))],{type:'application/pdf'}),c.email.split('@')[0]+'.pdf');
   const resume=await s.json('/api/workspace/resumes','POST',form);
   const applied=await s.send(`/api/workspace/jobs/${job.id}/applications`,'POST',{resumeId:resume.id,coverLetter:'Hồ sơ giả lập để kiểm thử đối chiếu đúng nhóm '+c.group+'.'});assert.equal(applied.status,200);
   console.log(`Submitted ${c.email} to JD ${job.id}`);
  }
 }
 const grouped=[];
 for(const job of jobs.filter(j=>j.status==='Published')){
  const apps=await recruiter.json('/api/workspace/applications?jobId='+job.id);assert.equal(apps.length,2,job.title);assert.ok(apps.every(a=>a.jobId===job.id));
  grouped.push({job,apps});
 }
 const publicJobs=await recruiter.json('/api/jobs');assert.equal(publicJobs.length,8);assert.equal(new Set(publicJobs.map(j=>j.company.id)).size,6);
 const foreign=publicJobs.find(j=>j.isDemo);assert.equal((await recruiter.send('/api/workspace/applications?jobId='+foreign.id)).status,404);
 const invalid=new FormData();invalid.append('requestJson',JSON.stringify({jobId:grouped[0].job.id,configuration:{model_type:'Hybrid'},applicationIds:[grouped[1].apps[0].id]}));assert.equal((await recruiter.send('/api/recruiter/reviews','POST',invalid)).status,400);
 console.log('Verified 2 CVs per JD, 8 public jobs across 6 companies, foreign JD denied and cross-job CV selection rejected.');
 if(!process.argv.includes('--analyze'))return;
 const health=await recruiter.send('/api/matching/health');assert.equal(health.status,200,'AI must be genuinely available');
 const report={createdAt:new Date().toISOString(),scenario:'local-recruitment-v1',note:'Synthetic functional test; matching scores are not accuracy or research evaluation metrics.',weights:{semantic_weight:.5,skill_weight:.3,experience_weight:.2},groups:[]};
 for(const {job,apps} of grouped){
  const form=new FormData();form.append('requestJson',JSON.stringify({jobId:job.id,configuration:{model_type:'Hybrid',weights:report.weights},applicationIds:apps.map(a=>a.id)}));
  const batch=await recruiter.json('/api/recruiter/reviews','POST',form),detail=await recruiter.json('/api/recruiter/reviews/'+batch.id);
  const results=[];
  for(const item of detail.items){
   const start=performance.now(),result=await recruiter.json(`/api/recruiter/reviews/${batch.id}/items/${item.id}/analyze`,'POST');
   assert.equal(result.state,'Complete',JSON.stringify(result));assert.equal(typeof result.score,'number');assert.equal(result.result.model_used,'Hybrid');
   results.push({name:result.name,email:result.email,score:result.score,semantic:result.semanticScore,skills:result.skillScore,experience:result.experienceScore,elapsedMs:Math.round(performance.now()-start)});
  }
  const sorted=await recruiter.json(`/api/recruiter/reviews/${batch.id}?sort=desc`);assert.ok(sorted.items[0].score>=sorted.items[1].score);
  const filtered=await recruiter.json(`/api/recruiter/reviews/${batch.id}?min=${sorted.items[0].score}`);assert.ok(filtered.items.every(i=>i.score>=sorted.items[0].score));
  const excel=await recruiter.send(`/api/recruiter/reviews/${batch.id}/excel?sort=desc`);assert.equal(excel.status,200);
  const bytes=Buffer.from(await excel.arrayBuffer());assert.equal(bytes.subarray(0,2).toString(),'PK');
  fs.writeFileSync(path.join(privateRoot,job.title.split(' ')[0]+'-results.xlsx'),bytes);
  const baseline=[];
  for(const method of ['TF-IDF','Sentence-BERT']){
   const f=new FormData(),cv=await recruiter.send('/api/workspace/resumes/'+apps[0].resumeId);assert.equal(cv.status,200);
   f.append('file',new Blob([await cv.arrayBuffer()],{type:'application/pdf'}),'sample.pdf');
   f.append('request_json',JSON.stringify({...detail.configuration,model_type:method}));
   const start=performance.now(),r=await recruiter.json('/api/matching/analyze-file','POST',f);assert.equal(r.success,true);assert.equal(r.model_used,method);assert.equal(typeof r.overall_score,'number');baseline.push({method,score:r.overall_score,elapsedMs:Math.round(performance.now()-start)});
  }
  report.groups.push({jobId:job.id,title:job.title,batchId:batch.id,results,baseline});console.log(JSON.stringify(report.groups.at(-1)));
  fs.writeFileSync(path.join(privateRoot,'scenario-ai-report.json'),JSON.stringify(report,null,2));
 }
 console.log('Real AI passed for all 6 application PDFs; sorting, minimum-score filtering and XLSX export verified.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
