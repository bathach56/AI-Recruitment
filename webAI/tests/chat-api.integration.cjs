const test = require('node:test');
const http = require('node:http');
const assert = require('node:assert/strict');

const base = process.env.CHAT_TEST_URL || 'http://127.0.0.1:5133';
const question = { role: 'user', content: 'TF-IDF và Sentence-BERT khác nhau thế nào?' };

function post(payload, url = base) {
  return fetch(new URL('/api/chat', url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

test('chat validates messages, rejects CV context and refuses non-local hosts', async () => {
  for (const payload of [
    { messages: [] },
    { messages: [null] },
    { messages: [{ ...question, content: '   ' }] },
    { messages: [{ ...question, content: 'x'.repeat(1201) }] },
    { messages: [{ ...question, role: 'system' }] },
    { messages: [question, { role: 'assistant', content: 'test' }] },
    { messages: Array(11).fill(question) },
    { messages: [question], cvId: 'synthetic' },
    { messages: [{ ...question, cvText: 'synthetic' }] }
  ]) {
    assert.equal((await post(payload)).status, 400, JSON.stringify(payload).slice(0, 100));
  }
  const body = JSON.stringify({ messages: [question] });
  const status = await new Promise((resolve, reject) => {
    const request = http.request(new URL('/api/chat', base), {
      method: 'POST',
      headers: {
        Host: 'recruit.example',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, response => {
      response.resume();
      resolve(response.statusCode);
    });
    request.on('error', reject);
    request.end(body);
  });
  assert.equal(status, 403);
});

test('configured local model returns a bounded reply', async () => {
  const response = await post({ messages: [question] });
  assert.equal(response.status, 200);
  const { reply } = await response.json();
  assert.equal(typeof reply, 'string');
  assert.ok(reply.trim().length > 0 && reply.length <= 4000);
});

test('unconfigured chat returns a service error', {
  skip: !process.env.CHAT_DISABLED_TEST_URL
}, async () => {
  const response = await post({ messages: [question] }, process.env.CHAT_DISABLED_TEST_URL);
  assert.equal(response.status, 503);
  assert.match((await response.json()).message, /chưa được cấu hình/);
});

test('isolated test provider exercises malformed replies, provider failure, timeout and rate limiting', {
  skip: !process.env.CHAT_FAILURE_TEST_URL,
  timeout: 65000
}, async () => {
  const url = process.env.CHAT_FAILURE_TEST_URL;
  const send = content => post({ messages: [{ role: 'user', content }] }, url);
  const timeout = send('delay');
  assert.equal((await send('bad-json')).status, 502);
  assert.equal((await send('unavailable')).status, 503);
  for (let index = 0; index < 9; index++)
    assert.equal((await send('unavailable')).status, 503);
  assert.equal((await send('unavailable')).status, 429);
  assert.equal((await timeout).status, 504);
});
