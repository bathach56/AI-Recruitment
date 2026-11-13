// Read-only checks; never submits applications or creates AI results.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),privateRoot=path.join(root,'webAI/App_Data'),base=process.env.TEST_BASE_URL||'http://localhost:5132';
const accounts=JSON.parse(fs.readFileSync(path.join(privateRoot,'scenario-accounts.json'),'utf8')),manifest=JSON.parse(fs.readFileSync(path.join(privateRoot,'five-sector-reset.json'),'utf8'));
class Session{
 cookies=new Map();token='';
 async send(url,method='GET',body){const r=await fetch(base+url,{redirect:'manual',method,headers:{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),'X-CSRF-TOKEN':this.token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0],i=pair.indexOf('=');this.cookies.set(pair.slice(0,i),pair.slice(i+1))}return r}
 async json(url){const r=await this.send(url);assert.equal(r.status,200,url);return r.json()}
 async login(a){this.token=(await this.json('/api/account/session')).token;assert.equal((await this.send('/api/account/login','POST',{email:a.email,password:a.password})).status,200,'Login failed: '+a.email);const session=await this.json('/api/account/session');assert.equal(session.role,a.role);this.token=session.token}
}
async function main(){
 assert.equal(accounts.length,10);assert.equal(new Set(accounts.map(a=>a.email)).size,10);assert.equal(manifest.entries.length,5);
 const guest=new Session(),jobs=await guest.json('/api/jobs');assert.equal(jobs.length,5);assert.equal(new Set(jobs.map(j=>j.category)).size,5);assert.equal(new Set(jobs.map(j=>j.company.id)).size,5);
 for(const entry of manifest.entries){
  const candidate=accounts.find(a=>a.email===entry.candidateEmail),recruiter=accounts.find(a=>a.email===entry.companyEmail),c=new Session(),r=new Session();await c.login(candidate);await r.login(recruiter);
  const profile=await c.json('/api/workspace/profile');assert.equal(profile.email,entry.candidateEmail);const resumes=await c.json('/api/workspace/resumes');assert.equal(resumes.length,1);assert.equal(resumes[0].id,entry.resumeId);
  const bytes=await(await c.send('/api/workspace/resumes/'+entry.resumeId)).arrayBuffer();assert.equal(Buffer.from(bytes).subarray(0,5).toString(),'%PDF-');assert.equal(require('node:crypto').createHash('sha256').update(Buffer.from(bytes)).digest('hex').toUpperCase(),entry.pdfSha256);
  const other=manifest.entries.find(e=>e.candidateEmail!==entry.candidateEmail);assert.equal((await c.send('/api/workspace/resumes/'+other.resumeId)).status,404);
  const owned=await r.json('/api/workspace/jobs');assert.equal(owned.length,1);assert.equal(owned[0].id,entry.jobId);assert.equal((await r.send('/api/workspace/jobs/'+other.jobId)).status,404);assert.equal((await r.send('/api/workspace/resumes/'+entry.resumeId)).status,404,'CV must not be visible before application');
  const job=await guest.json('/api/jobs/'+entry.jobId);assert.equal(job.canApply,true);assert.equal(job.category,entry.sector);assert.ok(job.description.length>200&&job.requirements.length>100);assert.equal(job.company.id,entry.companyId);
  assert.equal((await c.json('/api/workspace/applications')).length,0);assert.equal((await r.json('/api/workspace/applications')).length,0);assert.equal((await r.json('/api/recruiter/reviews')).length,0);
  console.log('PASS: '+entry.sector+' — both accounts, own JD, unique PDF and access isolation.');
 }
 const oldPath=path.join(root,'.local-run/old-session-test.json');if(fs.existsSync(oldPath)){const old=JSON.parse(fs.readFileSync(oldPath,'utf8'));const session=await(await fetch(base+'/api/account/session',{headers:{Cookie:old.cookie}})).json();assert.equal(session.authenticated,false);assert.equal((await fetch(base+'/api/workspace/company',{headers:{Cookie:old.cookie},redirect:'manual'})).status,401);console.log('PASS: deleted account cookie is revoked.');}
 fs.writeFileSync(path.join(privateRoot,'five-sector-check.json'),JSON.stringify({checkedAt:new Date().toISOString(),passed:true,accounts:10,companies:5,jobs:5,pdfs:5,readOnly:true},null,2));
 console.log('PASS: fresh scenario remains empty of applications, reviews and feedback.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
