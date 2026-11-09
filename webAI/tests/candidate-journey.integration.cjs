const {test}=require('node:test'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE_URL||'http://localhost:5132';
class Session{
 cookies=new Map();token='';
 async get(p){return this.send(p)}
 async send(p,method='GET',body){const r=await fetch(base+p,{method,redirect:'manual',headers:{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),'X-CSRF-TOKEN':this.token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');this.cookies.set(p.slice(0,i),p.slice(i+1))}return r}
 async login(email,password){this.token=(await(await this.get('/api/account/session')).json()).token;assert.equal((await this.send('/api/account/login','POST',{email,password})).status,200);this.token=(await(await this.get('/api/account/session')).json()).token}
}
test('candidate owns CV/application details; notifications only summarize and identify the correct application',{skip:!process.env.TEST_CANDIDATE_PASSWORD||!process.env.TEST_OTHER_CANDIDATE_PASSWORD},async()=>{
 const candidate=new Session(),other=new Session(),guest=new Session();await candidate.login('backend1@recruitai.test',process.env.TEST_CANDIDATE_PASSWORD);await other.login('backend2@recruitai.test',process.env.TEST_OTHER_CANDIDATE_PASSWORD);
 const applications=await(await candidate.get('/api/workspace/applications')).json();assert.ok(applications.length);assert.ok(applications[0].companyName);
 const result=await candidate.get('/api/workspace/applications/'+applications[0].id);assert.equal(result.status,200);const detail=await result.json();assert.equal(detail.application.id,applications[0].id);assert.equal(detail.application.company.name,applications[0].companyName);assert.ok(Array.isArray(detail.responses));
 const resumes=await(await candidate.get('/api/workspace/resumes')).json();assert.ok(resumes.some(r=>r.id===detail.application.resumeId));assert.equal((await candidate.get('/api/workspace/resumes/'+detail.application.resumeId+'/preview')).status,200);
 assert.equal((await other.get('/api/workspace/applications/'+applications[0].id)).status,404);assert.equal((await other.get('/api/workspace/resumes/'+detail.application.resumeId+'/preview')).status,404);assert.equal((await guest.get('/api/workspace/applications/'+applications[0].id)).status,401);
 const notices=await(await candidate.get('/api/workspace/notifications')).json();for(const n of notices){assert.ok(!Object.hasOwn(n,'content'));if(n.applicationId){const app=applications.find(a=>a.id===n.applicationId);assert.ok(app);assert.equal(n.companyName,app.companyName)}}
 const page=await candidate.get('/Candidate?tab=applications&application='+applications[0].id);assert.equal(page.status,200);assert.match(await page.text(),/candidate-applications\.js/);
});
