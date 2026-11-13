const {test}=require('node:test'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE_URL||'http://localhost:5132';
class Session{
 cookies=new Map();token='';
 async send(path,method='GET',body){const r=await fetch(new URL(path,base),{method,redirect:'manual',headers:{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),'X-CSRF-TOKEN':this.token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');this.cookies.set(p.slice(0,i),p.slice(i+1))}return r}
 async login(){this.token=(await(await this.send('/api/account/session')).json()).token;assert.equal((await this.send('/api/account/login','POST',{email:'congty@recruitai.test',password:process.env.TEST_RECRUITER_PASSWORD})).status,200)}
}
test('live review picker, title search and frozen document preview are authorized and read-only',{skip:!process.env.TEST_RECRUITER_PASSWORD},async()=>{
 const s=new Session(),guest=new Session();await s.login();const page=await s.send('/ReviewResults');assert.equal(page.status,200);const html=await page.text();for(const id of ['batchSearchForm','batchQuery','batchFrom','batchTo','reviewSelectionStatus','reviewJDText'])assert.ok(html.includes('id="'+id+'"'));assert.match(html,/id="reviewDetail"[^>]*hidden/);
 const batches=await(await s.send('/api/recruiter/reviews')).json();assert.ok(batches.length);const chosen=batches[0],detail=await(await s.send('/api/recruiter/reviews/'+chosen.id)).json();assert.ok(detail.items.length);
 const search=await(await s.send('/api/recruiter/reviews?q='+encodeURIComponent(chosen.title))).json();assert.ok(search.some(b=>b.id===chosen.id));assert.ok(search.every(b=>b.title.includes(chosen.title)));
 const plain=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase();const plainSearch=await(await s.send('/api/recruiter/reviews?q='+encodeURIComponent(plain(chosen.title)))).json();assert.ok(plainSearch.some(b=>b.id===chosen.id));
 const item=detail.items.find(i=>i.fileName)||detail.items[0],path='/api/recruiter/reviews/'+chosen.id+'/items/'+item.id;
 const matched=await(await s.send('/api/recruiter/reviews/'+chosen.id+'?q='+encodeURIComponent(plain(item.name)))).json();assert.ok(matched.items.some(i=>i.id===item.id));
 assert.equal((await guest.send(path+'/preview')).status,401);const preview=await s.send(path+'/preview');assert.equal(preview.status,200);const result=await preview.json();assert.ok(['pdf','text'].includes(result.kind));
 if(item.fileName){const file=await s.send(path+'/document');assert.equal(file.status,200);const bytes=Buffer.from(await file.arrayBuffer());assert.ok(bytes.length>0);if(result.kind==='pdf')assert.equal(bytes.subarray(0,5).toString(),'%PDF-')}
 if(batches.length>1)assert.equal((await s.send('/api/recruiter/reviews/'+batches[1].id+'/items/'+item.id+'/preview')).status,404);
 assert.equal((await s.send('/api/recruiter/reviews?from=2026-11-12T00:00:00Z&to=2026-11-11T00:00:00Z')).status,400);
});
