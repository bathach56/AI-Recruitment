const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function subject(){const c={window:{},URL};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../wwwroot/js/candidate-applications.js'),'utf8'),c);return c.window.CandidateApplications}
const statuses={Submitted:'Đã nộp',Offered:'Trúng tuyển',Rejected:'Không trúng tuyển'};
function attachModal(root){const closeButton={},events={},modal={open:false,querySelector:()=>closeButton,addEventListener:(name,fn)=>events[name]=fn,showModal(){this.open=true},close(){this.open=false;events.close?.()}};const query=root.querySelector;root.querySelector=s=>s==='#candidateApplicationDialog'?modal:query(s);root.testModal=modal;root.testClose=closeButton;return root}
test('candidate applications clearly separate pending, successful and unsuccessful outcomes',()=>{
 const s=subject();assert.equal(s.outcome('Offered'),'Trúng tuyển');assert.equal(s.outcome('Rejected'),'Không trúng tuyển');assert.match(s.outcome('Submitted'),/Chưa có/);
 const html=s.listMarkup([{id:4,title:'Backend',companyName:'Company <script>x</script>',city:'Hà Nội',status:'Offered',submittedAt:'2026-11-09T00:00:00Z'},{id:5,title:'Frontend',companyName:'Another company',status:'Submitted'}],statuses);
 assert.match(html,/data-application-detail="4"/);assert.match(html,/application-compact-row/);assert.match(html,/Trúng tuyển/);assert.match(html,/&lt;script&gt;/);assert.ok(!html.includes('<script>x'));assert.match(html,/<dialog id="candidateApplicationDialog"/);assert.match(html,/data-close-application/);
 const single=s.listMarkup([{id:4,title:'Backend',status:'Offered'}],statuses);assert.ok(!single.includes('id="applicationChoice"'));assert.match(single,/id="candidateApplicationDetail"/);
});
test('application detail shows actual company, CV, outcome and full response with safe text/URLs',()=>{
 const s=subject(),detail={application:{id:4,jobId:25,title:'Backend',status:'Rejected',submittedAt:'2026-11-09T00:00:00Z',company:{name:'Example company',industry:'Software',website:'javascript:alert(1)'},job:{city:'Hà Nội',description:'<script>JD</script>',requirements:'SQL',benefits:'Training'}},responses:[{id:1,title:'Kết quả',content:'Full reply <script>bad</script>\nNext line',createdAt:'2026-11-09T00:00:00Z'}]};
 const html=s.detailMarkup(detail,statuses);assert.match(html,/Example company/);assert.match(html,/Không trúng tuyển/);assert.match(html,/Full reply &lt;script&gt;/);assert.match(html,/data-application-cv/);assert.ok(!html.includes('href="javascript:'));assert.ok(!html.includes('<script>JD'));
 detail.responses=[];assert.match(s.detailMarkup(detail,statuses),/chưa gửi nội dung phản hồi/);
});

test('notification deep link automatically opens the right application and marks only the visible replies read',async()=>{
 const location={search:'?tab=applications&application=9'},handlers={},cvButton={},responseList={},panel={hidden:true,innerHTML:'',querySelector:s=>s==='[data-application-cv]'?cvButton:responseList,scrollIntoView(){this.scrolled=true}},link={dataset:{applicationDetail:'9'}},root={isConnected:true,querySelector:()=>panel,querySelectorAll:()=>[link],addEventListener:(name,fn)=>handlers[name]=fn};
 let currentPage=1,refreshes=0,openedCv;
 const c={window:{history:{replaceState:(_,__,url)=>location.search=new URL(url,'http://localhost').search},RecruitPagination:{slice:(_,rows)=>rows.slice((currentPage-1)*10,currentPage*10),refresh(){}}},URL,URLSearchParams,location,AbortController};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../wwwroot/js/candidate-applications.js'),'utf8'),c);
 const detail={application:{id:9,jobId:25,resumeId:7,title:'Backend',status:'Offered',submittedAt:'2026-11-09T00:00:00Z',company:{name:'Test company'},job:{}},responses:Array.from({length:14},(_,i)=>({id:100+i,title:'Result',content:'Reply '+i,createdAt:'2026-11-09T00:00:00Z'}))},calls=[];
 await c.window.CandidateApplications.mount(attachModal(root),{statuses,toast:()=>{},openCvDetail:a=>openedCv=a,refreshNotifications:async()=>refreshes++,api:async(path,method)=>{calls.push({path,method});if(path==='workspace/applications')return [{id:9,title:'Backend',status:'Offered',companyName:'Test company',submittedAt:'2026-11-09T00:00:00Z'}];if(path==='workspace/applications/9')return detail;return {}}});
 assert.equal(panel.hidden,false);assert.equal(root.testModal.open,true);assert.match(panel.innerHTML,/Test company/);assert.match(panel.innerHTML,/Reply 0/);assert.equal(calls.filter(c=>c.method==='POST').length,10);assert.equal(refreshes,1);
 cvButton.onclick();assert.equal(openedCv.resumeId,7);
 currentPage=2;handlers.paginationchange({target:{id:'candidateResponseList'}});await new Promise(r=>setTimeout(r,0));assert.equal(calls.filter(c=>c.method==='POST').length,14);assert.equal(refreshes,2);
 assert.equal(location.search,'?tab=applications&application=9');
});

test('applications initially show compact rows and load details only when a row is selected',async()=>{
 const location={search:'?tab=applications'},link={dataset:{applicationDetail:'8'}},button={},panel={innerHTML:'',querySelector:()=>button,scrollIntoView(){}},root={isConnected:true,querySelector:s=>s==='#applicationChoice'?null:panel,querySelectorAll:()=>[link],addEventListener(){}};
 const c={window:{history:{replaceState:(_,__,url)=>location.search=new URL(url,'http://localhost').search}},URL,URLSearchParams,location,AbortController};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../wwwroot/js/candidate-applications.js'),'utf8'),c);
 const list=[{id:7,title:'Backend',companyName:'First company',status:'Submitted'},{id:8,title:'Frontend',companyName:'Second company',status:'Offered'}],calls=[];
 await c.window.CandidateApplications.mount(attachModal(root),{statuses,toast(){},openCvDetail(){},refreshNotifications:async()=>{},api:async url=>{calls.push(url);if(url==='workspace/applications')return list;const id=Number(url.split('/').pop()),a=list.find(a=>a.id===id);return {application:{...a,jobId:id,submittedAt:'2026-11-09T00:00:00Z',company:{name:a.companyName},job:{}},responses:[]}}});
 assert.equal(panel.hidden,true);assert.equal(calls.length,1);assert.ok(!calls.includes('workspace/applications/7'));
 await link.onclick({preventDefault(){}});assert.match(panel.innerHTML,/Second company/);assert.match(panel.innerHTML,/Trúng tuyển/);assert.equal(location.search,'?tab=applications&application=8');
 assert.ok(root.innerHTML.includes('application-compact-row'));
 assert.equal(root.testModal.open,true);root.testClose.onclick();assert.equal(root.testModal.open,false);assert.equal(location.search,'?tab=applications');
});
