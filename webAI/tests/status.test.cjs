const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../wwwroot/js/status.js'), 'utf8');
class Element {
    constructor(tag = 'div') { this.tag = tag; this.children = []; this.dataset = {}; this.attrs = {}; }
    append(...items) { this.children.push(...items); }
    prepend(item) { this.children.unshift(item); }
    replaceChildren(...items) { this.children = items; }
    querySelector(tag) { return this.children.flatMap(child => child.children).find(child => child.tag === tag); }
    setAttribute(name, value) { this.attrs[name] = value; }
}
function dashboard() {
    let listener;
    const nodes = new Map();
    const document = {
        addEventListener(name, handler) { listener = handler; },
        getElementById(id) { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); },
        createElement(tag) { return new Element(tag); }, createElementNS(ns, tag) { return new Element(tag); }
    };
    vm.runInNewContext(source, { document, Date });
    return { get: id => document.getElementById(id), emit: data => listener({ detail: { source: 'serviceStatus', ...data } }) };
}
test('Unavailable AI shows no latency or invented chart even when the web responds', () => {
    const page = dashboard();
    page.emit({ reachable: true, connected: false, elapsed: 1820 });
    assert.equal(page.get('healthLatency').textContent, '—');
    assert.equal(page.get('webApiStatus').dataset.state, 'ready');
    assert.equal(page.get('aiApiStatus').dataset.state, 'offline');
    assert.equal(page.get('latencyChart').children.length, 0);
});
test('Two successful health measurements produce a chart labelled with the measured values', () => {
    const page = dashboard();
    page.emit({ reachable: true, connected: true, elapsed: 120 });
    assert.equal(page.get('latencyChart').children.length, 0);
    page.emit({ reachable: true, connected: true, elapsed: 240 });
    const chart = page.get('latencyChart').children[0];
    assert.equal(chart.tag, 'svg');
    assert.equal(chart.attrs['aria-label'], 'Thời gian kiểm tra theo thứ tự: 120, 240 ms');
    assert.equal(page.get('healthLatency').textContent, '240 ms');
});
test('Unrelated health events cannot change the system dashboard', () => {
    const page = dashboard();
    page.emit({ source: 'connectionStatus', reachable: true, connected: true, elapsed: 5 });
    assert.equal(page.get('healthLog').children.length, 0);
});
