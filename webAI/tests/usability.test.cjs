const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function subject(){const c={window:{},document:{addEventListener(){}},URLSearchParams};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../wwwroot/js/workspace-ui.js'),'utf8'),c);return c.window.RecruitUX}
test('search URL round-trip preserves all filters and safely encodes Vietnamese and special characters',()=>{
 const ux=subject(),state={q:'C# & SQL',city:'Hà Nội',category:'Dữ liệu',modes:['Từ xa','Tại văn phòng'],salary:'20',experience:'2–4 năm',sort:'salary',urgent:true};
 const query=ux.searchQuery(state);assert.ok(query.includes('C%23'));assert.deepEqual(JSON.parse(JSON.stringify(ux.searchState(new URLSearchParams(query)))),state);
 assert.equal(ux.searchQuery({q:'',city:'',modes:[],salary:'0',sort:'newest'}),'');
});
test('inbox filters combine JD, status and accent-insensitive search over the entire list without mutation',()=>{
 const ux=subject(),rows=Array.from({length:25},(_,i)=>({id:i+1,jobId:i%2?26:25,status:i%3?'Submitted':'Interview',fullName:i===24?'Đỗ Minh':'Người '+i,email:'x'+i+'@example.test',title:'Lập trình'}));
 assert.deepEqual(Array.from(ux.matchesApplications(rows,{q:'do minh',job:'25',status:'Submitted'}),r=>r.id),[]);
 assert.deepEqual(Array.from(ux.matchesApplications(rows,{q:'do minh',job:'25',status:'Interview'}),r=>r.id),[25]);assert.equal(rows.length,25);
});
test('Vietnamese search handles accented/unaccented text, capital Đ and Unicode combining accents',()=>{
 const ux=subject();for(const [text,query]of [['Đặng Thùy Dương','dang thuy duong'],['THIẾT KẾ','thiet ke'],['Dữ liệu','DU LIEU'],['Đỗ Minh.pdf','do minh.pdf'],['Nguyễn'.normalize('NFD'),'nguyen']])assert.ok(ux.normalize(text).includes(ux.normalize(query)));
 const rows=[{id:1,jobId:25,fullName:'Đặng Ánh',email:'anh@example.test',title:'Thiết kế'},{id:2,jobId:26,fullName:'Đặng Ánh',email:'anh2@example.test',title:'Thiết kế'}];assert.deepEqual(Array.from(ux.matchesApplications(rows,{job:25,q:'THIET KE'}),r=>r.id),[1]);assert.equal(rows[0].fullName,'Đặng Ánh');
});
test('job presentation derives expiry without rewriting SQL status',()=>{
 const ux=subject(),job={status:'Published',deadline:'2020-01-01'};assert.equal(ux.jobState(job,Date.now()),'Expired');assert.equal(job.status,'Published');assert.equal(ux.jobState({status:'Draft',deadline:job.deadline}),'Draft');
});
test('server errors attach safe inline text and focus the matching field',()=>{
 const ux=subject(),added=[],attributes={};let focused=false;const input={id:'jobTitle',name:'jobTitle',setAttribute:(k,v)=>attributes[k]=v,closest:()=>({append:n=>added.push(n)}),focus:()=>focused=true};
 // The helper uses the caller's DOM; evaluate in a small controlled DOM environment.
 const c={window:{},document:{addEventListener(){},createElement:()=>({dataset:{}})},URLSearchParams};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../wwwroot/js/workspace-ui.js'),'utf8'),c);
 const form={id:'jobForm',querySelectorAll:s=>s==='input,select,textarea'?[input]:[]};assert.equal(c.window.RecruitUX.fieldErrors(form,{Title:['<b>Lỗi</b>']}),true);
 assert.equal(added[0].textContent,'<b>Lỗi</b>');assert.equal(attributes['aria-invalid'],'true');assert.equal(focused,true);
});
test('field bounds match API and numeric limits are prepared',()=>{
 const ux=subject();assert.equal(ux.limits.authEmail,150);assert.equal(ux.limits.phone,30);assert.equal(ux.limits.companyWebsite,300);
});
