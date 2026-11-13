const {test}=require('node:test'),assert=require('node:assert/strict');
const base=process.env.TEST_BASE_URL||'http://localhost:5132';
class Session{
 cookies=new Map();token='';
 async get(path,method='GET',body){const r=await fetch(new URL(path,base),{method,redirect:'manual',headers:{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),'X-CSRF-TOKEN':this.token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');this.cookies.set(p.slice(0,i),p.slice(i+1))}return r}
 async login(){this.token=(await(await this.get('/api/account/session')).json()).token;assert.equal((await this.get('/api/account/login','POST',{email:'congty@recruitai.test',password:process.env.TEST_RECRUITER_PASSWORD})).status,200);this.token=(await(await this.get('/api/account/session')).json()).token}
}
async function checkPages(session,pages){
 const seen=new Set();
 async function asset(value,from){if(value.startsWith('data:')||value.startsWith('#'))return;const url=new URL(value,from);assert.equal(url.origin,new URL(base).origin,'External runtime asset: '+url.href);if(seen.has(url.href))return;seen.add(url.href);const r=await session.get(url.href);assert.equal(r.status,200,url.pathname);const bytes=await r.arrayBuffer();assert.ok(bytes.byteLength>0,url.pathname);
  if(url.pathname.endsWith('.css')){const css=new TextDecoder().decode(bytes);for(const m of css.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g))await asset(m[1],url)}
 }
 for(const page of pages){const r=await session.get(page);assert.equal(r.status,200,page);const html=await r.text();for(const m of html.matchAll(/<(?:link|script)\b[^>]*(?:href|src)="([^"]+)"[^>]*>/g))await asset(m[1],new URL(page,base))}
 return seen.size;
}
test('public pages use only available local CSS/JS/fonts, including nested font files',async()=>{assert.ok(await checkPages(new Session(),['/','/Login','/Register','/Jobs/25'])>10)});
test('recruiter pages have no CDN runtime dependency; analyzed JD editing is blocked',{skip:!process.env.TEST_RECRUITER_PASSWORD},async()=>{const s=new Session();await s.login();assert.ok(await checkPages(s,['/Recruiter','/Matching','/ReviewResults'])>15);const r=await s.get('/api/workspace/jobs/25');assert.equal(r.status,200);const data=await r.json();assert.equal(data.canEdit,false);assert.ok(data.reason);const before=data.job;const result=await s.get('/api/workspace/jobs/25','PUT',{...before,publish:false});assert.equal(result.status,409);const after=await(await s.get('/api/workspace/jobs/25')).json();assert.equal(after.job.description,before.description)});
