const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
class Element{
 constructor(tag='div'){this.tagName=tag;this.value='';this.textContent='';this.children=[];this.hidden=false;this.events={};this.open=false;this.classList={add(){},remove(){}}}
 append(...children){this.children.push(...children)}replaceChildren(...children){this.children=[...children]}setAttribute(name,value){this[name]=value}addEventListener(name,fn){this.events[name]=fn}showModal(){this.open=true}close(){this.open=false;this.events.close?.()}
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const batch=(id='a',name='Đợt A')=>({id,title:name,model:'TF-IDF',queueState:'Complete',createdAt:'2026-11-11T04:00:00Z',configuration:{job_id:25},completed:1,total:1,errors:0,items:[{id:7,name:'Nguyễn An',email:'an@example.test',source:'Application',fileName:'CV.pdf',state:'Complete',score:0}]});
function setup({search='',respond}={}){
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};get('reviewDetail').hidden=true;get('reviewState').value='all';get('reviewOrder').value='desc';
 const requests=[],location={search},context={URLSearchParams,location,document:{getElementById:get,createElement:tag=>new Element(tag),hidden:false},window:{history:{replaceState:(_,__,url)=>location.search=new URL(url,'http://localhost').search},addEventListener(){}},setInterval(){return 1},clearInterval(){},fetch:async(url,options)=>{requests.push(url);const result=await(respond?.(url,options)??(url==='/api/recruiter/reviews'?[batch(),batch('b','Đợt B')]:url.includes('/preview')?{kind:'pdf'}:batch(url.includes('/b?')?'b':'a')));return {ok:true,json:async()=>result}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../wwwroot/js/review-results.js'),'utf8'),context);
 return {get,requests,location,select:()=>get('reviewHistory').children[0].children[0]};
}
test('no automatic first selection; clearing selection hides results and keeps CV/AI actions separate',async()=>{
 const s=setup();await tick();assert.equal(s.get('reviewDetail').hidden,true);assert.deepEqual(s.requests,['/api/recruiter/reviews']);
 const select=s.select();assert.equal(select.value,'');select.value='a';await select.onchange();assert.equal(s.get('reviewDetail').hidden,false);
 const actions=s.get('reviewRows').children[0].children.at(-1).children[0].children;assert.equal(actions[0].textContent,'Xem CV');assert.equal(actions[1].textContent,'Xem đánh giá AI');
 await actions[0].onclick();assert.ok(s.requests.includes('/api/recruiter/reviews/a/items/7/preview'));assert.equal(s.get('mainDialog').open,true);assert.ok(s.get('dialogContent').children.some(n=>n.tagName==='iframe'&&n.src.endsWith('/items/7/document?inline=true')));
 select.value='';await select.onchange();assert.equal(s.get('reviewDetail').hidden,true);assert.equal(s.location.search,'');
});
test('rapid batch changes cannot display the previous company batch response under a new selection',async()=>{
 let release;const s=setup({respond:url=>url.includes('/a?')?new Promise(resolve=>release=resolve):url.includes('/b?')?batch('b','Đợt B'):undefined});await tick();const select=s.select();select.value='a';const first=select.onchange();select.value='b';await select.onchange();assert.equal(s.get('reviewTitle').textContent,'Đợt B');
 release(batch('a','STALE A'));await first;assert.equal(s.get('reviewTitle').textContent,'Đợt B');
});
test('batch search sends title, inclusive local date range and archive preference to the server',async()=>{
 const s=setup({respond:url=>url.startsWith('/api/recruiter/reviews?')?[]:undefined});await tick();s.get('batchQuery').value='Kỹ sư dữ liệu';s.get('batchFrom').value='2026-11-10';s.get('batchTo').value='2026-11-11';s.get('batchArchived').checked=true;
 await s.get('batchSearchForm').onsubmit({preventDefault(){}});const url=new URL(s.requests.at(-1),'http://localhost');assert.equal(url.searchParams.get('q'),'Kỹ sư dữ liệu');assert.equal(url.searchParams.get('includeArchived'),'true');assert.equal(new Date(url.searchParams.get('to'))-new Date(url.searchParams.get('from')),2*86400000);assert.match(s.get('batchSearchStatus').textContent,/Không có đợt/);
 const count=s.requests.length;s.get('batchFrom').value='2026-11-12';await s.get('batchSearchForm').onsubmit({preventDefault(){}});assert.equal(s.requests.length,count);assert.match(s.get('batchSearchStatus').textContent,/Ngày bắt đầu/);
});
test('direct batch URL opens saved results and text CV preview preserves input without inventing a file',async()=>{
 const value=batch();value.items[0]={id:8,name:'Hồ sơ Excel',email:'',source:'ExcelOrText',state:'Queued',score:null};
 const s=setup({search:'?batch=a',respond:url=>url.includes('/preview')?{kind:'text',text:'<script>CV nguyên văn</script>',note:'Nội dung nhập'}:url.includes('/a?')?value:undefined});await tick();assert.equal(s.get('reviewDetail').hidden,false);const actions=s.get('reviewRows').children[0].children.at(-1).children[0].children;await actions[0].onclick();const content=s.get('dialogContent').children;assert.ok(content.some(n=>n.tagName==='pre'&&n.textContent==='<script>CV nguyên văn</script>'));assert.ok(!content.some(n=>n.tagName==='a'));assert.ok(content.some(n=>n.textContent==='Email người gửi: Chưa cung cấp'));
});
