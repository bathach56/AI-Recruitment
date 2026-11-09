const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../wwwroot/js/career.js'),'utf8');
class Node {
 constructor(dataset={}){this.dataset=dataset;this.attributes={};this.textContent='';this.innerHTML='';this.hidden=false;this.classes=new Set();this.classList={toggle:(key,on)=>on?this.classes.add(key):this.classes.delete(key)}}
 setAttribute(k,v){this.attributes[k]=v} removeAttribute(k){delete this.attributes[k]}
}
function page(url){
 const location=new URL(url);
 const nodes=new Map(['#careerApp','#notificationToggle','#notificationCount','#notificationAnnouncement','#readAllNotifications','#notificationPreview','.page-heading h1','.page-heading>p'].map(id=>[id,new Node()]));
 const nav=['home','candidate','applications','recruiter','matching','reviews'].map(key=>new Node({nav:key}));
 const context={URLSearchParams,location,window:{addEventListener(){}},document:{querySelector:s=>nodes.get(s)||null,querySelectorAll:s=>s==='[data-nav]'?nav:[]},console};
 vm.createContext(context);
 const instrumented=source.replace(/ start\(\)\.catch\(error=>\{app\.innerHTML=notice\(esc\(error.message\)\)\}\);/,`globalThis.subject={syncMainNav,renderNotifications,setNotifications:value=>notifications=value};`);
 vm.runInContext(instrumented,context);
 return {nodes,nav,subject:context.subject,location};
}
test('applications has its own selected top navigation and updates when returning to profile',()=>{
 const p=page('http://localhost/Candidate?tab=applications');p.subject.syncMainNav();
 assert.equal(p.nav.find(n=>n.classes.has('active')).dataset.nav,'applications');
 assert.equal(p.nav.find(n=>n.dataset.nav==='candidate').attributes['aria-current'],undefined);
 p.location.search='?tab=profile';p.subject.syncMainNav();
 assert.equal(p.nav.find(n=>n.classes.has('active')).dataset.nav,'candidate');
 assert.equal(p.nav.find(n=>n.dataset.nav==='applications').attributes['aria-current'],undefined);
 p.location.search='?tab=notifications';p.subject.syncMainNav();
 assert.equal(p.nav.filter(n=>n.classes.has('active')).length,0);
});
test('matching navigation belongs to the AI workspace, not candidate profile',()=>{
 const p=page('http://localhost/Matching');p.subject.syncMainNav();
 assert.equal(p.nav.find(n=>n.classes.has('active')).dataset.nav,'matching');
});
test('saved review results has a separate selected navigation item',()=>{
 const p=page('http://localhost/ReviewResults?batch=test');p.subject.syncMainNav();
 assert.equal(p.nav.find(n=>n.classes.has('active')).dataset.nav,'reviews');
});
test('notification badge counts unread records, announces context and escapes content',()=>{
 const p=page('http://localhost/Candidate');
 p.subject.setNotifications([{id:1,title:'<img src=x>',content:'<script>bad</script>',createdAt:'2026-11-09T00:00:00Z',readAt:null},{id:2,title:'Read',content:'Read already',createdAt:'2026-11-09T00:00:00Z',readAt:'2026-11-09T00:00:00Z'}]);
 p.subject.renderNotifications();
 assert.equal(p.nodes.get('#notificationCount').textContent,'1');
 assert.equal(p.nodes.get('#notificationToggle').attributes['aria-label'],'Thông báo: 1 thông báo chưa đọc');
 assert.match(p.nodes.get('#notificationPreview').innerHTML,/&lt;img/);
 assert.ok(!p.nodes.get('#notificationPreview').innerHTML.includes('<script>'));
 p.subject.setNotifications([]);p.subject.renderNotifications();
 assert.equal(p.nodes.get('#notificationCount').hidden,true);
 assert.equal(p.nodes.get('#readAllNotifications').disabled,true);
 assert.equal(p.nodes.get('#notificationAnnouncement').textContent,'Không có thông báo chưa đọc');
});

test('AI input steps switch both panels, selected state and keyboard tab order',()=>{
 const matching=fs.readFileSync(path.join(__dirname,'../wwwroot/js/matching.js'),'utf8');
 const body=matching.match(/const showStep = id => \{([\s\S]*?)\n        \};/)[1];
 const nodes=Object.fromEntries(['jobStepTab','cvStepTab','jobStepPane','cvStepPane'].map(id=>[id,new Node()]));
 Object.values(nodes).forEach(n=>n.scrollIntoView=()=>{n.scrolled=true});
 const context={$:id=>nodes[id],window:{matchMedia:()=>({matches:true})}};
 vm.createContext(context);vm.runInContext('globalThis.showStep=id=>{'+body+'}',context);
 context.showStep('cvStepTab');
 assert.equal(nodes.cvStepTab.attributes['aria-selected'],'true');
 assert.equal(nodes.jobStepTab.attributes['aria-selected'],'false');
 assert.equal(nodes.jobStepTab.tabIndex,-1);assert.equal(nodes.cvStepTab.tabIndex,0);
 assert.ok(nodes.cvStepPane.classes.has('active'));assert.ok(!nodes.jobStepPane.classes.has('active'));
 context.showStep('jobStepTab');
 assert.ok(nodes.jobStepPane.classes.has('active'));assert.ok(!nodes.cvStepPane.classes.has('active'));
});
