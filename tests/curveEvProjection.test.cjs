const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('src/renderers/curveRenderer.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
function element() {
    return { attributes: {}, children: [], setAttribute(k, v) { this.attributes[k] = v; },
        appendChild(child) { this.children.push(child); } };
}
const context = { exports: {}, require: () => ({ svgElement: element,
    numberValue: v => v == null ? null : Number(v) }) };
vm.createContext(context);
vm.runInContext(source, context);
function render(refs = {}, current = {}) {
    const svg = element();
    const segments = context.drawEvProjection(svg, { SemanaProyecto: 11, EV: 1800, ...current },
        { AT: 11, EACT: 12.39, BAC: 2160, ...refs }, w => w * 10, v => 500 - v / 10);
    return { svg, segments };
}
test('EV projects exactly from selected EV to BAC at fractional EAC(t), with no extra markers', () => {
    const { svg, segments } = render();
    assert.equal(segments.length, 1);
    assert.equal(segments[0].start.week, 11);
    assert.equal(segments[0].start.value, 1800);
    assert.equal(segments[0].end.week, 12.39);
    assert.equal(segments[0].end.value, 2160);
    const path = svg.children[0].children[0];
    assert.equal(path.attributes.d, 'M 110 320 L 123.9 284');
    assert.equal(svg.children[0].children.length, 1);
    assert.match(path.attributes.class, /evm-ev-projection/);
});
test('no backward, completed or unavailable EV projection', () => {
    for (const refs of [{ EACT: 11 }, { EACT: 10 }, { EACT: null }, { BAC: null }, { Finalizado: 1 }]) {
        assert.equal(render(refs).svg.children.length, 0);
    }
    for (const EV of [null, 2160, 2200]) assert.equal(render({}, { EV }).segments.length, 0);
});
test('selected week takes precedence over a stale AT reference', () => {
    assert.equal(render({ AT: 9 }).segments[0].start.week, 11);
});
