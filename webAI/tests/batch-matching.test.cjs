// Fixtures test queue behavior only; these scores are not research results.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../wwwroot/js/matching.js'),'utf8');
function subject(){const c={window:{},document:{addEventListener(){}},AbortController,FormData,setTimeout,clearTimeout};vm.createContext(c);vm.runInContext(source,c);return c.window.RecruitAI.batch}
const file=(name,size=10,lastModified=1)=>({name,size,lastModified});
test('company job dropdown has visible option labels and selects only returned own jobs',async()=>{
 const start=source.indexOf("request('/api/workspace/jobs').then(data=>{"),end=source.indexOf('\n        const showError',start);
 const select={children:[],value:'',replaceChildren(){this.children=[]},append(node){this.children.push(node)}};
 const context={postedJobs:[],location:{search:'?job=90'},URLSearchParams,request:async()=>[{id:25,title:'Backend Developer',status:'Published'}],$:id=>id==='postedJob'?select:{textContent:''},element:(tag,cls,text)=>({tag,className:cls,textContent:text||''}),updateRecruiterContext(){},loadApplicationsForJob(){}};
 vm.createContext(context);await vm.runInContext(source.slice(start,end),context);
 assert.equal(select.children[0].textContent,'Chọn tin tuyển dụng…');
 assert.equal(select.children[1].textContent,'Backend Developer · JD #25 · Đang tuyển');
 assert.equal(select.children[1].value,'25');assert.equal(select.value,'25','foreign query id must never be used');
});
test('select-all checkbox survives bubbling input before its change handler',()=>{
 const start=source.indexOf("$('matchingForm').addEventListener('input', event => {");
 const end=source.indexOf("$('matchingForm').addEventListener('change'",start);
 assert.ok(start>0&&end>start);
 let onInput;const context={busy:false,$:()=>({addEventListener:(_,fn)=>onInput=fn}),invalidateResults:()=>{},updateSourceCount:()=>{throw Error('checkbox reset before change')}};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 for(const id of ['selectAllApplications','selectAllExcel','selectAllUploadFiles']){
  const target={id,type:'checkbox',checked:true};onInput({target});assert.equal(target.checked,true);
 }
});
test('job-specific fetch clears old selections and ignores out-of-order responses',async()=>{
 assert.ok(!source.includes("request('/api/workspace/applications')"),'matching must not fetch the whole company inbox');
 const start=source.indexOf('async function loadApplicationsForJob(){'),end=source.indexOf('\n        function updateSourceCount',start);
 assert.ok(start>0&&end>start);
 let job={id:10};const pending=new Map(),nodes=new Map();
 const context={applications:[{id:99,jobId:9}],applicationRequestVersion:0,selectedApplications:new Set([99]),selectedJob:()=>job,renderApplications:()=>{},$:id=>{if(!nodes.has(id))nodes.set(id,{textContent:''});return nodes.get(id)},request:url=>new Promise(resolve=>pending.set(url,resolve))};
 vm.createContext(context);vm.runInContext(source.slice(start,end)+';globalThis.load=loadApplicationsForJob;',context);
 const oldRequest=context.load();assert.equal(context.selectedApplications.size,0);assert.equal(context.applications.length,0);
 job={id:20};const newRequest=context.load();
 pending.get('/api/workspace/applications?jobId=20')([{id:2,jobId:20}]);await newRequest;
 pending.get('/api/workspace/applications?jobId=10')([{id:1,jobId:10}]);await oldRequest;
 assert.equal(context.applications[0].jobId,20,'old request replaced current job results');
 job=null;await context.load();assert.equal(context.applications.length,0);
});
test('matching uses a posted job without editable JD fields and only shows its applications',()=>{
 const template=fs.readFileSync(path.join(__dirname,'../wwwroot/partials/matching-workspace.html'),'utf8');
 assert.match(template,/id="postedJob"/);
 for(const id of ['jobTitle','jobDescription','requiredSkills','optionalSkills','requiredYears'])assert.ok(!template.includes(`id="${id}"`));
 for(const id of ['modelType','semanticWeight','skillWeight','experienceWeight'])assert.ok(template.includes(`id="${id}"`));
 const body=source.match(/function visibleApplications\(\)\{([^\n]+)\}/)[1];
 let selected=null,query='';const context={applications:[{id:1,jobId:10,fullName:'Alice',title:'Developer'},{id:2,jobId:20,fullName:'Bob',title:'Developer'}],$:()=>({value:query}),selectedJob:()=>selected};
 vm.createContext(context);vm.runInContext('globalThis.filter=()=>{'+body+'}',context);
 assert.equal(context.filter().length,0);selected={id:10};assert.equal(context.filter().map(a=>a.id).join(','),'1');selected={id:20};assert.equal(context.filter().map(a=>a.id).join(','),'2');query='Alice';assert.equal(context.filter().length,0);
});
test('file selection accumulates, deduplicates, rejects unsupported or oversized batches without modifying the old list',()=>{
 const b=subject(),old=[file('first.pdf')];
 assert.equal(b.mergeFiles(old,[file('first.pdf'),file('second.docx')]).length,2);
 assert.equal(old.length,1);
 for(const incoming of [[file('bad.exe')],[file('empty.pdf',0)],[file('large.pdf',10485761)],Array.from({length:50},(_,i)=>file(i+'.pdf'))])assert.throws(()=>b.mergeFiles(old,incoming));
 assert.throws(()=>b.mergeFiles([],Array.from({length:11},(_,i)=>file(i+'.pdf',10485760))));
 assert.equal(b.mergeFiles([],Array.from({length:50},(_,i)=>file(i+'.pdf'))).length,50);
});
test('ranking preserves genuine zero, puts incomplete scores after computed scores and does not mutate inputs',()=>{
 const b=subject(),entries=[{index:0,name:'null',data:{overall_score:null}},{index:1,name:'zero',data:{overall_score:0}},{index:2,name:'high',data:{overall_score:80}},{index:3,name:'error',error:'failure'}];
 assert.equal(b.sorted(entries).map(x=>x.name).join(','),'high,zero,null,error');
 assert.equal(entries[0].name,'null');assert.equal(b.sorted(entries,'original')[0].name,'null');
});
test('a batch runs sequentially, continues after one failure, and never fabricates a score',async()=>{
 const b=subject(),entries=Array.from({length:3},(_,index)=>({index,state:'queued'}));let active=0,maxActive=0,updates=0;
 await b.run(entries,async e=>{active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,1));active--;if(e.index===1)throw Error('bad document');return {overall_score:e.index}},()=>updates++,()=>false);
 assert.equal(maxActive,1);assert.equal(entries.map(e=>e.state).join(','),'complete,error,complete');assert.equal(entries[1].data,undefined);assert.equal(entries[1].error,'bad document');assert.equal(entries[0].data.overall_score,0);assert.equal(updates,6);
});
test('stopping retains completed results and retry only runs queued entries',async()=>{
 const b=subject(),entries=Array.from({length:3},(_,index)=>({index,state:'queued'}));let stop=false,calls=[];
 await b.run(entries,async e=>{calls.push(e.index);stop=true;return {overall_score:1}},()=>{},()=>stop);
 assert.equal(entries.map(e=>e.state).join(','),'complete,stopped,stopped');
 entries.filter(e=>e.state==='stopped').forEach(e=>e.state='queued');
 await b.run(entries,async e=>{calls.push(e.index);return {overall_score:2}},()=>{},()=>false);
 assert.equal(calls.join(','),'0,1,2');assert.equal(entries[0].data.overall_score,1);
});
