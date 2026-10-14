// API contract checks only. Fixture scores are not research results.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { File } = require('node:buffer');

const source = fs.readFileSync(path.join(__dirname, '../wwwroot/js/matching.js'), 'utf8');
function client(fetch) {
    const context = vm.createContext({
        window: {}, document: { addEventListener() {} },
        fetch, AbortController, FormData, setTimeout, clearTimeout
    });
    vm.runInContext(source, context);
    return context.window.RecruitAI.api;
}
const result = (model = 'Hybrid', score = null) => ({
    success: true, model_used: model, overall_score: score,
    status: score === null ? 'incomplete' : 'computed',
    breakdown: { semantic_score: 0, skill_score: null, experience_score: null }
});
const response = data => ({ ok: true, json: async () => data });

test('Text matching sends the existing endpoint and preserves incomplete/null scores', async () => {
    let call;
    const api = client(async (url, options) => { call = { url, options }; return response(result()); });
    const payload = { cv_text: 'Python', job_description: 'Python developer', model_type: 'Hybrid' };
    const data = await api.matchText(payload);
    assert.equal(call.url, '/api/matching/analyze');
    assert.equal(call.options.method, 'POST');
    assert.deepEqual(JSON.parse(call.options.body), payload);
    assert.equal(data.overall_score, null);
    assert.equal(data.breakdown.experience_score, null);
});

test('All model names and a genuine zero score are accepted without fallback', async () => {
    for (const model of ['Hybrid', 'Sentence-BERT', 'TF-IDF']) {
        const data = await client(async () => response(result(model, 0))).matchText({});
        assert.equal(data.model_used, model);
        assert.equal(data.overall_score, 0);
    }
});

test('Upload uses file/request_json multipart fields and lets fetch set the boundary', async () => {
    let options;
    const api = client(async (url, config) => {
        assert.equal(url, '/api/matching/analyze-file');
        options = config;
        return response(result());
    });
    const payload = { job_description: 'Developer', job_experience_years_required: null };
    await api.matchFile(new File(['fixture'], 'fixture.docx'), payload);
    assert.equal(options.body.get('file').name, 'fixture.docx');
    assert.deepEqual(JSON.parse(options.body.get('request_json')), payload);
    assert.equal(options.headers, undefined);
});

test('HTTP errors reject with useful messages and cannot turn into a score', async () => {
    for (const status of [400, 413, 415, 422, 500, 503, 504]) {
        const api = client(async () => ({ ok: false, status }));
        await assert.rejects(api.matchText({}), error => error.message.length > 20);
    }
});

test('Broken responses are rejected, including missing score, wrong type and contradictory status', async () => {
    const invalid = [
        {}, { ...result(), success: false }, { ...result(), overall_score: undefined },
        { ...result(), overall_score: '50' }, { ...result(), model_used: 'Unknown' },
        { ...result(), status: 'computed' }, { ...result(), overall_score: 0 },
        result('Hybrid', -1), result('Hybrid', 101), result('Hybrid', NaN)
    ];
    for (const data of invalid) await assert.rejects(client(async () => response(data)).matchText({}));
    await assert.rejects(client(async () => ({ ok: true, json: async () => { throw new Error('Bad JSON'); } })).matchText({}));
});

test('Network failure and abort reject rather than supplying a demo result', async () => {
    await assert.rejects(client(async () => { throw new TypeError('Network'); }).matchText({}));
    await assert.rejects(client(async () => { const error = new Error('Abort'); error.name = 'AbortError'; throw error; }).matchText({}));
});

test('Health uses the real endpoint and a separate timeout signal', async () => {
    await client(async (url, options) => {
        assert.equal(url, '/api/matching/health');
        assert.equal(options.signal instanceof AbortSignal, true);
        return response({ ai_service_connected: true });
    }).health();
});
