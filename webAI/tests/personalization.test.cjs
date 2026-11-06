const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../wwwroot/js/personalization.js'), 'utf8');
function client(initial, blocked = false) {
    let value = initial;
    const context = vm.createContext({
        localStorage: {
            getItem() { if (blocked) throw new Error('Storage unavailable'); return value; },
            setItem(key, next) { if (blocked) throw new Error('Storage unavailable'); value = next; }
        },
        window: { dispatchEvent() {} },
        document: { addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; } },
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }
    });
    vm.runInContext(source, context);
    return { api: context.window.RecruitAIPreferences, stored: () => JSON.parse(value) };
}
test('Malformed preferences and unexpected roles do not become a user identity', () => {
    for (const initial of ['broken', 'null', '[]', '{"role":"admin","name":32}']) {
        const data = client(initial).api.get();
        assert.equal(data.role, ''); assert.equal(data.name, '');
    }
});
test('Only chosen display name, target title and UI role are stored, never contact details or CV', () => {
    const data = client('{}');
    assert.equal(data.api.save({ name: '  Người kiểm thử  ', title: 'Backend', role: 'candidate', email: 'test@example.com', phone: '123', cv: 'private' }), true);
    assert.deepEqual(data.stored(), { role: 'candidate', name: 'Người kiểm thử', title: 'Backend' });
});
test('Storage denial preserves a usable in-memory profile and reports failure to persist', () => {
    const data = client(null, true);
    assert.equal(data.api.save({ name: 'Test', title: 'Developer' }), false);
    assert.equal(data.api.get().name, 'Test');
});
test('Saved text is bounded and callers cannot mutate the profile through get()', () => {
    const data = client('{}');
    data.api.save({ name: 'a'.repeat(500), title: 'b'.repeat(500), role: 'admin' });
    assert.equal(data.api.get().name.length, 150);
    assert.equal(data.api.get().title.length, 200);
    assert.equal(data.api.get().role, '');
    data.api.get().name = 'Changed';
    assert.equal(data.api.get().name.length, 150);
});
