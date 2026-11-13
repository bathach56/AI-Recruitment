// Local synthetic scenario only; no notifications or hiring responses are sent.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),reportPath=path.join(root,'webAI/App_Data/queue-check.json'),base=process.env.TEST_BASE_URL||'http://localhost:5132';
async function main(){
 const cookies=new Map();let token='';
 async function send(url,method='GET',body){const form=body instanceof FormData,r=await fetch(base+url,{method,headers:{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),'X-CSRF-TOKEN':token,...(form?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:form?body:JSON.stringify(body)});for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');cookies.set(p.slice(0,i),p.slice(i+1))}assert.equal(r.status,200,`${url}: ${r.status===200?'':await r.text()}`);return r.json()}
 token=(await send('/api/account/session')).token;await send('/api/account/login','POST',{email:'congty@recruitai.test',password:process.env.TEST_RECRUITER_PASSWORD});token=(await send('/api/account/session')).token;
 let report;
 if(process.argv.includes('--prepare')){
  const jobs=await send('/api/workspace/jobs'),job=jobs.find(j=>j.status==='Published'),apps=await send('/api/workspace/applications?jobId='+job.id);assert.ok(apps.length);
  const body=new FormData();body.append('requestJson',JSON.stringify({jobId:job.id,runInBackground:true,configuration:{model_type:'Hybrid'},applicationIds:apps.map(a=>a.id)}));
  const batch=await send('/api/recruiter/reviews','POST',body);report={batchId:batch.id,jobId:job.id,total:apps.length,createdAt:new Date().toISOString()};
  assert.ok(['Queued','Running','Complete'].includes((await send('/api/recruiter/reviews/'+batch.id)).queueState));report.atomicEnqueueVerified=true;
  await send('/api/recruiter/reviews/'+batch.id+'/queue','POST');await send('/api/recruiter/reviews/'+batch.id+'/pause','POST');
  assert.equal((await send('/api/recruiter/reviews/'+batch.id)).queueState,'Paused');report.pauseVerified=true;
 }else{
  report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
  if(process.argv.includes('--resume')){const before=await send('/api/recruiter/reviews/'+report.batchId);assert.equal(before.queueState,'Paused');report.pauseSurvivedRestart=true;await send('/api/recruiter/reviews/'+report.batchId+'/queue','POST');report.resumeRequestedAt=new Date().toISOString();}
  else {const batch=await send('/api/recruiter/reviews/'+report.batchId);assert.equal(batch.queueState,'Complete');assert.equal(batch.completed,report.total);assert.equal(batch.errors,0);assert.ok(batch.items.every(i=>i.state==='Complete'&&typeof i.score==='number'));report.completedWithoutClientPolling=true;report.completedAt=new Date().toISOString();}
 }
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log('PASS: '+JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exitCode=1});
