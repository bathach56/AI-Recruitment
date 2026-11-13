const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
class Element{
 constructor(tag='DIV'){this.tagName=tag.toUpperCase();this.children=[];this.attrs=new Map();this.isConnected=true;this.value='';this.textContent=''}
 append(...children){this.children.push(...children)}replaceChildren(...children){this.children=children}
 setAttribute(k,v){this.attrs.set(k,v)}toggleAttribute(k,v){v?this.attrs.set(k,''):this.attrs.delete(k)}
 hasAttribute(k){return this.attrs.has(k)}
 matches(selector){return selector==='tr'?this.tagName==='TR':this.tagName==='ARTICLE'}
 closest(){return this.host||null}insertAdjacentElement(_,node){this.nav=node}dispatchEvent(){}scrollIntoView(){}remove(){}
}
function subject(){const c={window:{},document:{addEventListener(){},createElement:t=>new Element(t)},CustomEvent:class{}};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../wwwroot/js/pagination.js'),'utf8'),c);return c.window.RecruitPagination}
test('filtering excludes hidden rows from page counts and reset returns to the first matching page',()=>{
 const p=subject(),list=new Element();list.children=Array.from({length:25},()=>new Element('article'));const state=p.bind(list,'article');state.current=3;state.refresh();
 list.children.forEach((node,index)=>node.toggleAttribute('data-filter-hidden',index<12));p.reset(list);assert.equal(state.current,1);assert.equal(list.nav.children[0].textContent,'1–10 / 13 mục');
 assert.equal(list.children.slice(12).filter(n=>!n.hasAttribute('data-page-hidden')).length,10);
});
test('pagination clamps pages, keeps 10 rows and never mutates input',()=>{
 const p=subject(),items=Array.from({length:25},(_,i)=>i);assert.equal(p.page(items).items.length,10);assert.equal(p.page(items,2).items.join(','),'10,11,12,13,14,15,16,17,18,19');assert.equal(p.page(items,999).items.length,5);assert.equal(p.page(items,-1).current,1);assert.equal(p.page([],3).current,1);assert.equal(items.length,25);
});
test('real pager controls move forward/back, jump pages and preserve checked rows',()=>{
 const p=subject(),list=new Element();list.children=Array.from({length:25},()=>new Element('article'));list.children[0].checked=true;p.bind(list,'article');
 const visible=()=>list.children.filter(n=>!n.attrs.has('data-page-hidden'));assert.equal(visible().length,10);
 list.nav.children.find(n=>n.textContent==='Sau').onclick();assert.equal(visible()[0],list.children[10]);assert.equal(list.children[0].checked,true);
 const select=list.nav.children.at(-1).children[0];select.value='3';select.onchange();assert.equal(visible().length,5);
 list.nav.children.find(n=>n.textContent==='Trước').onclick();assert.equal(visible()[0],list.children[10]);
 list.children.splice(3);p.bind(list,'article');assert.equal(visible().length,3);assert.equal(list.nav.hidden,true);
});
test('home shows five jobs per page while table lists keep ten',()=>{
 const p=subject(),rows=new Element('tbody');rows.host=new Element('div');rows.children=Array.from({length:21},()=>new Element('tr'));p.bind(rows,'tr');assert.ok(rows.host.nav);assert.equal(rows.children.filter(n=>!n.attrs.has('data-page-hidden')).length,10);
 const home=new Element();home.id='jobList';home.children=Array.from({length:8},()=>new Element('article'));p.bind(home,'article');
 assert.equal(home.children.filter(n=>!n.attrs.has('data-page-hidden')).length,5);assert.equal(home.nav.hidden,false);assert.equal(home.nav.children[0].textContent,'1–5 / 8 mục');
 home.nav.children.find(n=>n.textContent==='Sau').onclick();assert.equal(home.children.filter(n=>!n.attrs.has('data-page-hidden')).length,3);assert.equal(home.nav.children[0].textContent,'6–8 / 8 mục');
 home.nav.children.find(n=>n.textContent==='Trước').onclick();assert.equal(home.children.filter(n=>!n.attrs.has('data-page-hidden')).length,5);
});
test('AI feedback summary preserves zero/null and escapes evidence',()=>{
 const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../wwwroot/js/recruiter-feedback.js'),'utf8'),c);const summary=c.window.RecruiterFeedback.assessmentMarkup;
 assert.match(summary(null),/Chưa có kết quả AI/);assert.match(summary(null,'Network failed'),/Chưa tải được đánh giá AI/);
 const html=summary({score:0,model:'Hybrid',state:'Incomplete',analyzedAt:'2026-11-09T00:00:00Z',semanticScore:0,result:{explanation:{skills:{requirements:[{status:'not_found',requirement:'<script>x</script>'}]}}}});
 assert.match(html,/0.0 \/ 100/);assert.match(html,/Thiếu dữ liệu/);assert.match(html,/&lt;script&gt;/);assert.ok(!html.includes('<script>x'));
});
