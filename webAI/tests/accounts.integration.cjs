// Run against a local server with TEST_CANDIDATE_PASSWORD / TEST_RECRUITER_PASSWORD.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const base=process.env.TEST_BASE_URL||'http://localhost:5132';
const candidateEmail=process.env.TEST_CANDIDATE_EMAIL||'backend1@recruitai.test';
class Browser {
 cookies=new Map(); token='';
 async request(path,method='GET',body,csrf=true){
  const headers={Cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ')};
  if(csrf&&this.token)headers['X-CSRF-TOKEN']=this.token;
  if(body!==undefined&&!(body instanceof FormData))headers['Content-Type']='application/json';
  const response=await fetch(base+path,{method,headers,body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body),redirect:'manual'});
  for(const cookie of response.headers.getSetCookie()){const [pair]=cookie.split(';');const pos=pair.indexOf('=');this.cookies.set(pair.slice(0,pos),pair.slice(pos+1))}
  return response;
 }
 async session(){const r=await this.request('/api/account/session');assert.equal(r.status,200);const s=await r.json();this.token=s.token;return s}
 async login(email,password){await this.session();const r=await this.request('/api/account/login','POST',{email,password,role:'Admin'});assert.equal(r.status,200);await this.session()}
}
test('anonymous access, real logins, CSRF, role separation, persistence and logout',
 {skip:!process.env.TEST_CANDIDATE_PASSWORD||!process.env.TEST_RECRUITER_PASSWORD},async()=>{
 const guest=new Browser();
 assert.equal((await guest.request('/api/jobs')).status,200);
 for(const page of ['/Candidate','/Recruiter','/Matching','/Admin']){
  const r=await guest.request(page);assert.equal(r.status,302,page);assert.match(r.headers.get('location'),/Login/);
 }
 for(const api of ['/api/workspace/profile','/api/workspace/jobs','/api/matching/health'])assert.equal((await guest.request(api)).status,401);
 await guest.session();
 assert.equal((await guest.request('/api/account/login','POST',{email:'ungvien@recruitai.test',password:'WrongPassword!'})).status,401);
 assert.equal((await guest.request('/api/account/register','POST',{email:'admin@recruitai.test',password:'WrongPassword!',name:'Test Admin',role:'Admin'})).status,400);
 assert.equal((await guest.request('/api/account/login','POST',{email:'ungvien@recruitai.test',password:'WrongPassword!'},false)).status,400);
 const candidate=new Browser(),recruiter=new Browser();
 await candidate.login(candidateEmail,process.env.TEST_CANDIDATE_PASSWORD);
 await recruiter.login('congty@recruitai.test',process.env.TEST_RECRUITER_PASSWORD);
 assert.equal((await candidate.session()).role,'Candidate');assert.equal((await recruiter.session()).role,'Recruiter');
 assert.equal((await candidate.request('/Candidate')).status,200);
 assert.equal((await candidate.request('/Recruiter')).status,403);
 assert.equal((await candidate.request('/Matching')).status,403);
 assert.equal((await recruiter.request('/Candidate')).status,403);
 assert.equal((await recruiter.request('/Recruiter')).status,200);
 const matchingPage=await recruiter.request('/Matching');assert.equal(matchingPage.status,200);
 const matchingHtml=await matchingPage.text();assert.match(matchingHtml,/workspace-refresh\.css/);assert.match(matchingHtml,/matching-studio/);
 const candidateHtml=await (await candidate.request('/Candidate?tab=applications')).text();
 assert.match(candidateHtml,/data-nav="applications"/);assert.match(candidateHtml,/id="notificationToggle"/);
 for(const route of ['/','/Login','/Register']){const page=await guest.request(route);assert.equal(page.status,200);assert.match(await page.text(),/workspace-refresh\.css/)}
 const resultsPage=await candidate.request('/Results');assert.equal(resultsPage.status,200);assert.match(await resultsPage.text(),/workspace-refresh\.css/);
 const deniedPage=await candidate.request('/Recruiter');assert.equal(deniedPage.status,403);assert.match(await deniedPage.text(),/class="status-code">403/);
 const missingPage=await guest.request('/this-page-does-not-exist');assert.equal(missingPage.status,404);assert.match(await missingPage.text(),/workspace-refresh\.css/);
 const template=await guest.request('/partials/matching-workspace.html');assert.equal(template.status,200);assert.match(await template.text(),/id="batchRows"/);
 const notifications=await (await candidate.request('/api/workspace/notifications')).json();assert.ok(Array.isArray(notifications));
 assert.ok(notifications.every(n=>Object.hasOwn(n,'readAt')));
 assert.equal((await candidate.request('/api/workspace/notifications/2147483647/read','POST')).status,404);
 assert.equal((await candidate.request('/api/workspace/notifications/read-all','POST',undefined,false)).status,400);
 // Do not mark any real unread messages during this integration check.
 if(!notifications.some(n=>!n.readAt))assert.equal((await candidate.request('/api/workspace/notifications/read-all','POST')).status,200);
 if(notifications.length)assert.equal((await recruiter.request('/api/workspace/notifications/'+notifications[0].id+'/read','POST')).status,404);
 assert.equal((await recruiter.request('/api/workspace/profile')).status,403);
 assert.equal((await candidate.request('/api/workspace/jobs')).status,403);
 const profile=await (await candidate.request('/api/workspace/profile')).json();
 assert.equal((await candidate.request('/api/workspace/profile','PUT',profile)).status,200);
 assert.equal((await candidate.request('/api/workspace/profile','PUT',profile,false)).status,400);
 const jobs=await (await guest.request('/api/jobs')).json();assert.ok(jobs.length);
 const savedBefore=await (await candidate.request('/api/workspace/saved')).json();
 assert.equal((await candidate.request('/api/workspace/saved/'+jobs[0].id,'POST')).status,200);
 assert.equal((await candidate.request('/api/workspace/saved/'+jobs[0].id,'POST')).status,200);
 assert.ok((await (await candidate.request('/api/workspace/saved')).json()).some(j=>j.id===jobs[0].id));
 if(!savedBefore.some(j=>j.id===jobs[0].id))assert.equal((await candidate.request('/api/workspace/saved/'+jobs[0].id,'DELETE')).status,200);
 assert.equal((await candidate.request('/api/workspace/jobs','POST',{})).status,403);
 const draft={title:'Bản nháp kiểm tra tài khoản',city:'Hồ Chí Minh',description:'Kiểm tra lưu nháp tuyển dụng.',requirements:'Kiểm tra chức năng tài khoản.',deadline:new Date(Date.now()+86400000*7).toISOString(),vacancies:1,publish:true};
 const company=await(await recruiter.request('/api/workspace/company')).json();
 if(company.verificationStatus!=='Verified')assert.equal((await recruiter.request('/api/workspace/jobs','POST',draft)).status,403,'unverified company cannot publish');
 const created=await recruiter.request('/api/workspace/jobs','POST',{...draft,publish:false});assert.equal(created.status,200);
 const id=(await created.json()).id;
 assert.ok((await (await recruiter.request('/api/workspace/jobs')).json()).some(j=>j.id===id&&j.status==='Draft'));
 assert.ok(!(await (await guest.request('/api/jobs')).json()).some(j=>j.id===id),'draft must remain private');
 const foreign=jobs.find(j=>j.isDemo);assert.ok(foreign);
 assert.equal((await recruiter.request('/api/workspace/jobs/'+foreign.id+'/status','PUT',{status:'Closed'})).status,404,'cannot change another company job');
 assert.equal((await candidate.request('/api/workspace/jobs/'+foreign.id+'/applications','POST',{resumeId:1})).status,400,'demo jobs cannot receive applications');
 assert.equal((await candidate.request('/api/workspace/resumes/2147483647')).status,404);
 const invalid=new FormData();invalid.append('file',new Blob(['not a PDF']),'invalid.pdf');
 assert.equal((await candidate.request('/api/workspace/resumes','POST',invalid)).status,400);
 const fs=require('node:fs'),path=require('node:path');
 const bytes=fs.readFileSync(path.join(__dirname,'../../data/sample_cvs/CV_LeHoangLong_Fresher_DotNet.docx'));
 for(const name of ['batch_sample_1.docx','batch_sample_2.docx']){
  const body=new FormData();body.append('file',new Blob([bytes]),name);
  body.append('request_json',JSON.stringify({job_description:'C# ASP.NET SQL Server developer',model_type:'TF-IDF'}));
  const result=await recruiter.request('/api/matching/analyze-file','POST',body);
  assert.ok([200,503].includes(result.status),'AI either returns real output or reports unavailable');
  const data=await result.json();
  if(result.status===503)assert.equal(data.overall_score,undefined,'unavailable AI must not invent a score');
  else{assert.equal(data.success,true);assert.equal(data.model_used,'TF-IDF')}
 }
 const upload=new FormData();upload.append('file',new Blob([bytes]),'CV_kiem_tra.docx');
 const uploaded=await candidate.request('/api/workspace/resumes','POST',upload);assert.equal(uploaded.status,200);
 const resumeId=(await uploaded.json()).id;
 const download=await candidate.request('/api/workspace/resumes/'+resumeId);assert.equal(download.status,200);
 assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);
 assert.equal((await recruiter.request('/api/workspace/resumes/'+resumeId)).status,404,'company cannot read an unsubmitted CV');
 assert.equal((await guest.request('/api/workspace/resumes/'+resumeId)).status,401);
 assert.equal((await guest.request('/App_Data/documents/')).status,404);
 assert.equal((await guest.request('/api/account/register','POST',{email:' '+candidateEmail.toUpperCase()+' ',password:'WrongPassword!',name:'Duplicate',role:'Candidate'})).status,409);
 assert.equal((await guest.request('/api/account/register','POST',{email:candidateEmail.toUpperCase(),password:'WrongPassword!',name:'Duplicate',role:'Candidate'})).status,409);
 assert.equal((await candidate.request('/api/account/logout','POST')).status,200);
 assert.equal((await candidate.request('/api/workspace/profile')).status,401);
 assert.equal((await candidate.session()).authenticated,false);
});
