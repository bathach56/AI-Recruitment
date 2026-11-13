const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
class Node{
 constructor(){this.value='';this.textContent='';this.children=[];this.disabled=false;this.hidden=false;this.classList={add(){},remove(){}};this.open=false}
 append(...nodes){this.children.push(...nodes)}replaceChildren(...nodes){this.children=[...nodes]}setAttribute(){}
 click(){}
 addEventListener(){}showModal(){this.open=true}
}
test('review UI queues work on server, pauses it and polls progress without driving per-item analysis',async()=>{
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id)};
 get('reviewState').value='all';get('reviewOrder').value='desc';let poll;const requests=[];
 let batch={id:'batch',title:'JD',model:'Hybrid',configuration:{job_id:25},queueState:'Idle',total:1,completed:0,errors:0,items:[{id:1,name:'CV',email:'',source:'Application',state:'Queued',score:null}]};
 const context={URLSearchParams,location:{search:'?batch=batch'},document:{hidden:false,getElementById:get,createElement:()=>new Node()},window:{history:{replaceState(){}},addEventListener(){}},setInterval:callback=>(poll=callback,1),clearInterval(){},console,
 fetch:async(url,options={})=>{requests.push([url,options.method||'GET']);let value;
  if(url==='/api/account/session')value={token:'fixture'};
  else if(url.endsWith('/queue')){batch={...batch,queueState:'Queued'};value={message:'Đã xếp hàng'}}
  else if(url.endsWith('/pause')){batch={...batch,queueState:'Paused'};value={message:'Đã dừng'}}
  else if(url==='/api/recruiter/reviews')value=[{id:'batch',title:'JD',model:'Hybrid',completed:0,total:1,createdAt:'2026-11-11'}];
  else value=batch;
  return {ok:true,json:async()=>value};
 }};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../wwwroot/js/review-results.js'),'utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));await get('resumeReview').onclick();
 assert.equal(get('reviewFeedbackLink').href,'/Recruiter?tab=notifications&job=25');
 assert.ok(requests.some(([url,method])=>url.endsWith('/queue')&&method==='POST'));assert.ok(!requests.some(([url])=>url.includes('/analyze')));
 assert.equal(get('resumeReview').disabled,true);assert.equal(get('pauseReview').disabled,false);
 await get('pauseReview').onclick();assert.equal(get('pauseReview').disabled,true);assert.ok(get('reviewMeta').textContent.includes('Đã tạm dừng'));
 await get('resumeReview').onclick();batch={...batch,queueState:'Complete',completed:1,items:[{...batch.items[0],state:'Complete',score:0}]};await poll();
 assert.ok(get('reviewMeta').textContent.includes('1/1'));assert.equal(get('resumeReview').disabled,true);
 let downloaded;context.Blob=Blob;context.URL={createObjectURL:blob=>(downloaded=blob,'blob:fixture'),revokeObjectURL(){}};context.setTimeout=callback=>callback();
 await get('exportReviewJson').onclick();const exported=JSON.parse(await downloaded.text());assert.equal(exported.items[0].score,0);assert.equal(exported.id,'batch');
});
