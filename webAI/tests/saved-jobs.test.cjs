const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function subject(api){
 const buttons=Array.from({length:2},()=>{const b={dataset:{save:'5'},attrs:{},classes:new Set(),label:{textContent:''},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},querySelector(){return this.label}};b.classList={toggle:(k,on)=>on?b.classes.add(k):b.classes.delete(k)};return b});
 const c={window:{addEventListener(){}},location:{search:''},URLSearchParams,document:{querySelector:s=>s==='#toast'?{}:null,querySelectorAll:s=>s==='[data-save]'?buttons:[]},setTimeout:()=>0,clearTimeout(){}};vm.createContext(c);
 const source=fs.readFileSync(path.join(__dirname,'../wwwroot/js/career.js'),'utf8').replace(/ start\(\)\.catch\(error=>\{app\.innerHTML=notice\(esc\(error.message\)\)\}\);/,"globalThis.subject={toggleSavedJob,saveButton,loadSavedJobs,setApi:f=>api=f}; session={authenticated:true,role:'Candidate'};");
 vm.runInContext(source,c);c.subject.setApi(api);return {...c.subject,buttons};
}
test('save highlights every icon, second click removes it, and persisted state restores on load',async()=>{
 const calls=[],s=subject(async(p,method='GET')=>{calls.push(method);return method==='GET'?[]:{}});
 await s.toggleSavedJob(5);assert.deepEqual(calls,['GET','POST']);for(const b of s.buttons){assert.ok(b.classes.has('is-saved'));assert.equal(b.attrs['aria-pressed'],'true')}
 assert.match(s.saveButton({id:5,title:'Backend'}),/Đã lưu/);
 await s.toggleSavedJob(5);assert.equal(calls.at(-1),'DELETE');for(const b of s.buttons){assert.ok(!b.classes.has('is-saved'));assert.equal(b.attrs['aria-pressed'],'false');assert.equal(b.disabled,false)}
 s.setApi(async()=>[{id:5}]);await s.loadSavedJobs();assert.match(s.saveButton({id:5,title:'Backend'},true),/is-saved/);
});
test('failed un-save preserves the saved icon and concurrent clicks do not send duplicate mutations',async()=>{
 let release,posts=0;const s=subject(async(p,m='GET')=>m==='GET'?[]:new Promise(r=>{posts++;release=r}));
 const pending=s.toggleSavedJob(5);await new Promise(setImmediate);assert.ok(s.buttons[0].disabled);await s.toggleSavedJob(5);assert.equal(posts,1);release({});await pending;
 s.setApi(async()=>{throw Error('Offline')});await s.toggleSavedJob(5);assert.ok(s.buttons[0].classes.has('is-saved'));assert.equal(s.buttons[0].disabled,false);
});
