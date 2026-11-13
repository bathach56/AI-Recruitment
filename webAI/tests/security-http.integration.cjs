// Run against a local build only. Does not create accounts or application data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const base = process.env.SECURITY_TEST_URL || 'http://127.0.0.1:5133';
  const address = new URL(base);
  assert(['127.0.0.1', 'localhost'].includes(address.hostname), 'Local testing only');
  const session = await fetch(base + '/api/account/session');
  assert.equal(session.status, 200);
  assert.equal(session.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(session.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(session.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.match(session.headers.get('content-security-policy'), /frame-ancestors 'self'/);
  assert.match(session.headers.get('cache-control'), /\bno-store\b/);
  assert.equal(session.headers.get('server'), null);
  const token = (await session.json()).token;
  const cookie = session.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  for (const url of ['/api/workspace/profile', '/api/recruiter/reviews']) {
    assert.equal((await fetch(base + url)).status, 401);
    assert.equal((await fetch(base + url, { headers: { Cookie: '.AspNetCore.Cookies=forged-admin-image', 'X-Role': 'Admin' } })).status, 401);
  }
  const admin = await fetch(base + '/Admin', { redirect: 'manual', headers: { 'X-Role': 'Admin' } });
  assert.equal(admin.status, 302); assert.match(admin.headers.get('location'), /\/Login/);
  assert.equal((await fetch(base + '/api/account/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'nobody@example.test', password: 'Unused-Fixture-Only' }) })).status, 400);
  const forbiddenRole = await fetch(base + '/api/account/register', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-TOKEN': token }, body: JSON.stringify({ email: 'never-created@example.test', password: 'Unused-Fixture-Only', name: 'Security fixture', role: 'Admin' }) });
  assert.equal(forbiddenRole.status, 400); assert.match((await forbiddenRole.json()).message, /Vai trò/);
  const file = new FormData(); file.set('file', new Blob(['not an admin identity']), 'admin.png');
  assert.equal((await fetch(base + '/api/workspace/resumes', { method: 'POST', body: file })).status, 401);
  if (process.env.SECURITY_TEST_PRODUCTION === '1') {
    // Local fixture credentials are never printed or committed.
    const accounts = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../App_Data/scenario-accounts.json'), 'utf8'));
    const account = accounts.find(a => a.role === 'Candidate');
    assert(account, 'Missing local candidate fixture');
    const login = await fetch(base + '/api/account/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-TOKEN': token }, body: JSON.stringify({ email: account.email, password: account.password }) });
    assert.equal(login.status, 200);
    const authCookie = login.headers.getSetCookie().find(c => c.startsWith('.AspNetCore.Cookies='));
    assert(authCookie); assert.match(authCookie, /; secure/i); assert.match(authCookie, /; httponly/i); assert.match(authCookie, /samesite=lax/i);
  }
  console.log('PASS: HTTP security headers, anonymous and forged-cookie denial, Admin registration denial, CSRF and unauthenticated image upload denial' + (process.env.SECURITY_TEST_PRODUCTION === '1' ? ', production Secure/HttpOnly cookie.' : '.'));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
