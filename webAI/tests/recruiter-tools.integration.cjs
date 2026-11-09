const {test}=require('node:test'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE_URL||'http://localhost:5132';
class Session{
 cookies=new Map();token='';
 async send(url,method='GET',body){const r=await fetch(base+url,{method,redirect:'manual',headers:{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),'X-CSRF-TOKEN':this.token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');this.cookies.set(p.slice(0,i),p.slice(i+1))}return r}
 async login(email,password){this.token=(await(await this.send('/api/account/session')).json()).token;assert.equal((await this.send('/api/account/login','POST',{email,password})).status,200);this.token=(await(await this.send('/api/account/session')).json()).token}
}
test('live CV preview, AI per CV/JD and batch permission/atomic rejection without sending messages',{skip:!process.env.TEST_RECRUITER_PASSWORD||!process.env.TEST_CANDIDATE_PASSWORD},async()=>{
 const r=new Session(),c=new Session(),guest=new Session();await r.login('congty@recruitai.test',process.env.TEST_RECRUITER_PASSWORD);await c.login(process.env.TEST_CANDIDATE_EMAIL||'backend1@recruitai.test',process.env.TEST_CANDIDATE_PASSWORD);
 const apps=await(await r.send('/api/workspace/applications')).json();assert.ok(apps.length);
 const assessmentResponse=await r.send('/api/workspace/applications/assessments');assert.equal(assessmentResponse.status,200);const assessments=await assessmentResponse.json();
 assert.equal(assessments.length,apps.length);for(const row of assessments){const app=apps.find(a=>a.id===row.applicationId);assert.ok(app);if(row.assessment)assert.equal(row.assessment.result.job_id,app.jobId)}
 const previewResponse=await r.send('/api/workspace/resumes/'+apps[0].resumeId+'/preview');assert.equal(previewResponse.status,200);const preview=await previewResponse.json();assert.equal(preview.kind,'pdf');
 const pdf=await r.send(preview.url);assert.equal(pdf.status,200);assert.match(pdf.headers.get('content-type'),/application\/pdf/);assert.ok(!pdf.headers.get('content-disposition')?.includes('attachment'));assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
 assert.equal((await guest.send('/api/workspace/resumes/'+apps[0].resumeId+'/preview')).status,401);
 assert.equal((await c.send('/api/workspace/applications/assessments')).status,403);
 assert.equal((await c.send('/api/workspace/applications/responses/batch','POST',{applicationIds:[apps[0].id],status:'Rejected',title:'Must not send',content:'Must not send'})).status,403);
 const before=await(await r.send('/api/workspace/applications/'+apps[0].id+'/responses')).json();
 const rejected=await r.send('/api/workspace/applications/responses/batch','POST',{applicationIds:[apps[0].id,2147483647],status:'Rejected',title:'Must not send',content:'Atomic rejection test'});assert.equal(rejected.status,404);
 const after=await(await r.send('/api/workspace/applications/'+apps[0].id+'/responses')).json();assert.deepEqual(after,before);
 const page=await(await r.send('/Recruiter?tab=notifications')).text();assert.match(page,/pagination\.js/);assert.match(page,/recruiter-feedback\.js/);
});
