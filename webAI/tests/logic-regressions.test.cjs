const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../wwwroot/js/career.js'),'utf8');
function setup(tab='notifications'){
 const location=new URL('http://localhost/Recruiter?tab='+tab),root={innerHTML:'CURRENT_PANEL'};
 const context={URL,URLSearchParams,location,document:{querySelector:s=>s==='#workspaceContent'?root:null,querySelectorAll:()=>[]},window:{addEventListener(){}},console};
 vm.createContext(context);
 vm.runInContext(source.replace(/ start\(\)\.catch\(error=>\{app\.innerHTML=notice\(esc\(error.message\)\)\}\);/,`globalThis.subject={coreWorkflow,workspaceTabUrl,loginDestination,normalizeExperience,recruiterPanel,candidatePanel,setApi:value=>api=value};`),context);
 return {subject:context.subject,root,location};
}
test('login returns to exact role route, preserving JD/batch/application and rejecting external or similar prefix paths',()=>{
 const {subject:s}=setup();
 for(const [role,url]of [['Recruiter','/Matching?job=25'],['Recruiter','/ReviewResults?batch=abc'],['Admin','/Admin'],['Candidate','/Candidate?tab=applications&application=112']])assert.equal(s.loginDestination(role,url),url);
 for(const url of ['//example.com','https://example.com','/RecruiterFake','/Recruiter/../Admin','/Candidate','/\\example.com'])assert.equal(s.loginDestination('Recruiter',url),'/Recruiter');
});
test('stale mutation refresh never clears the newly selected recruiter or candidate panel',async()=>{
 const {subject:s,root}=setup();let requests=0;s.setApi(async()=>{requests++;return {}});
 await s.recruiterPanel('jobs');await s.candidatePanel('resumes');assert.equal(root.innerHTML,'CURRENT_PANEL');assert.equal(requests,0);
});
test('older request cannot overwrite a second request for the same tab',async()=>{
 const {subject:s,root}=setup('jobs');let firstResolve,calls=0;
 s.setApi(()=>++calls===1?new Promise(resolve=>firstResolve=resolve):Promise.reject(new Error('LATEST')));
 const first=s.recruiterPanel('jobs');await s.recruiterPanel('jobs');const latest=root.innerHTML;assert.ok(latest.includes('LATEST'));firstResolve({});await first;assert.equal(root.innerHTML,latest);
});
test('core screening journey links five working destinations and preserves JD context only in feedback',()=>{
 const {subject:s,location}=setup('notifications');const html=s.coreWorkflow();assert.equal((html.match(/<li>/g)||[]).length,5);for(const href of ['/Recruiter?tab=jobs','/Matching','/ReviewResults','/Recruiter?tab=notifications'])assert.ok(html.includes('href="'+href+'"'));
 location.search='?tab=notifications&job=25';assert.equal(s.workspaceTabUrl('notifications'),'/Recruiter?tab=notifications&job=25');assert.equal(s.workspaceTabUrl('overview'),'/Recruiter?tab=overview');
 location.search='?tab=notifications&job=invalid';assert.equal(s.workspaceTabUrl('notifications'),'/Recruiter?tab=notifications');
});
test('experience normalization preserves database labels while equating range dash variants',()=>{
 const s=setup().subject;assert.equal(s.normalizeExperience(' 2 - 4 năm '),'2–4 năm');assert.equal(s.normalizeExperience('1–2 năm'),'1–2 năm');assert.equal(s.normalizeExperience('Dưới 1 năm'),'Dưới 1 năm');
});
