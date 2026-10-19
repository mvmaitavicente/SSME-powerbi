const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(path) {
    const context = { exports: {}, require: () => ({}) };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText, context);
    return context.exports;
}

const { NavigatorProjectIndex } = load('src/controllers/NavigatorProjectIndex.ts');
const { Visual } = load('src/visual.ts');

test('a refreshed catalog removes unavailable projects and secondary-index entries', () => {
    const index = new NavigatorProjectIndex(p => p.IdIntervencion);
    index.add([{ IdIntervencion: 'A', Region: 'Lima' }]);
    index.values();
    const revision = index.revision;
    index.add([{ IdIntervencion: 'B', Region: 'Cusco' }]);
    assert.equal(index.get('A'), undefined);
    assert.equal(index.values().length, 1);
    assert.equal(index.candidates([{ key: 'Region', value: 'Lima' }]).length, 0);
    assert.ok(index.revision > revision);
    index.add([]);
    assert.equal(index.values().length, 0);
});

function selection(available) {
    const visual = Object.create(Visual.prototype);
    const calls = [];
    Object.assign(visual, {
        filterState: { selectedProjectId: 'A', lastNavigableProjectId: 'A' },
        navigatorProjectsForOptions: () => available,
        projectOptions: projects => projects,
        clearInternalFilter: name => calls.push(['clear', name]),
        applyProjectFilter: id => calls.push(['project', id]),
        clearGeneralNavigationFilters: () => calls.push(['clearNavigation']),
        applyLevelFilter: level => calls.push(['level', level])
    });
    visual.reconcileProjectSelection();
    return { visual, calls };
}

test('unavailable project is replaced only with an available option', () => {
    const { visual, calls } = selection([{ value: 'B' }]);
    assert.equal(visual.filterState.selectedProjectId, 'B');
    assert.equal(visual.pendingProjectSelectionId, 'B');
    assert.deepEqual(calls, [['clear', 'projectFilter'], ['project', 'B']]);
});

test('no available project clears both project filter paths and remembered selection', () => {
    const { visual, calls } = selection([]);
    assert.equal(visual.filterState.selectedProjectId, null);
    assert.equal(visual.filterState.lastNavigableProjectId, null);
    assert.deepEqual(calls, [['clear', 'projectFilter'], ['clearNavigation'], ['level', 'PRONIED']]);
});

test('a still-available selection does not trigger another query', () => {
    assert.deepEqual(selection([{ value: 'A' }]).calls, []);
});
