const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('src/renderers/curveRenderer.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
function element() {
    return { attributes: {}, children: [], style: {}, setAttribute(k, v) { this.attributes[k] = v; },
        appendChild(child) { this.children.push(child); } };
}
function render(eac, finalized = 0) {
    const context = { exports: {}, require: () => ({ svgElement: element,
        numberValue: v => v == null ? null : Number(v) }) };
    vm.createContext(context);
    vm.runInContext(source, context);
    const svg = element();
    const refs = { AT: 9, ES: 8.8, SAC: 13, EACT: eac, Finalizado: finalized };
    const scale = week => 104 + week / Math.max(13, eac) * 760;
    context.drawAxes(svg, 0, Math.max(13, eac), { min: 0, max: 3000 }, scale, scale, v => v, eac, refs, false);
    context.drawTimelineMarkerLabels(svg, finalized ? { ...refs, EACT: null } : refs, scale, true);
    return svg.children;
}
const content = node => (node.textContent || '') + node.children.map(content).join('');
for (const week of [12.62, 13, 13.01, 14, 20, 9]) {
    test(`EAC(t) retains its value at week ${week}`, () => {
        const nodes = render(week);
        const value = week.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(week) ? 0 : 2, maximumFractionDigits: 2 });
        const label = nodes.find(n => content(n).includes(`EAC(t) = ${value}`));
        assert.ok(label);
        assert.ok(Number(label.attributes.y) > 496 + 32);
        if (week !== 13 && Math.abs(week - 13) < 1) {
            const sac = nodes.find(n => content(n) === 'SAC');
            assert.ok(Number(label.attributes.y) - Number(sac.attributes.y) >= 24);
        }
    });
}
test('finalized projects retain the projection tick without an active EAC label', () => {
    const nodes = render(12.62, 1);
    assert.ok(nodes.some(n => content(n) === '12.62'));
    assert.ok(!nodes.some(n => content(n).includes('EAC(t)')));
});

test('nearby ES and EAC labels face outward on the same row; distant labels stay centered', () => {
    for (const week of [8.7, 9, 12.62]) {
        const nodes = render(week);
        const es = nodes.find(n => content(n).startsWith('ES ='));
        const eac = nodes.find(n => content(n).startsWith('EAC(t) ='));
        assert.equal(es.attributes.y, eac.attributes.y);
        if (week === 12.62) {
            assert.equal(es.attributes['text-anchor'], 'middle');
            assert.equal(eac.attributes['text-anchor'], 'middle');
        } else {
            const [left, right] = Number(es.attributes.x) < Number(eac.attributes.x) ? [es, eac] : [eac, es];
            assert.equal(left.attributes['text-anchor'], 'end');
            assert.equal(right.attributes['text-anchor'], 'start');
            assert.ok(Number(right.attributes.x) - Number(left.attributes.x) >= 16);
        }
    }
});
