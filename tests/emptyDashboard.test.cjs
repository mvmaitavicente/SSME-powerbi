const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('empty filter intersection keeps navigation and selection, then restores fresh content', () => {
    let parsed = null;
    let sidebarLevel;
    let emptyLevel;
    const element = () => ({ style: {}, children: [], classList: { toggle() {} }, appendChild(child) { this.children.push(child); } });
    const context = { exports: {}, document: { createElement: element }, require: name => {
        if (name === 'powerbi-visuals-api') return { default: { VisualUpdateType: { Resize: 4, ResizeEnd: 32 }, FilterAction: { remove: 0 } } };
        if (name === './dataParser') return { parseDashboardJsonData: () => parsed };
        if (name === './renderers/headerRenderer') return { renderSidebar: options => { sidebarLevel = options.activeLevel; return 'sidebar'; } };
        return {};
    } };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/visual.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText, context);
    const visual = Object.create(context.exports.Visual.prototype);
    const dashboard = { context: { Level: 'PROYECTO', ProjectId: 'A' }, projects: [] };
    const filterState = { selectedProjectId: 'B', selectedUnit: 'UGM' };
    let syncs = 0;
    Object.assign(visual, {
        currentDashboardData: dashboard, dashboardHasData: true, filterState,
        pendingProjectSelectionId: 'B',
        events: { renderingStarted() {}, renderingFinished() {}, renderingFailed(_options, error) { throw new Error(error); } },
        target: { replaceChildren() {}, appendChild() {} }, viewLifecycle: { reset() {} },
        readUpdateJsonFilters: () => [], closeCriticalInterventionsModal() {},
        navigatorText: value => value || '', resolveUnitForNavigation: () => 'UGM', resolveProjectForNavigation: () => 'B',
        renderEmptyDashboard: data => { emptyLevel = data.context.Level; return 'empty'; }, renderCurrentDashboard: () => 'report',
        renderNavigationDebugPanel() {}, finishFilterLoading() {},
        initializePreferredProject() { throw new Error('must not auto-select on empty response'); },
        syncFilterStateFromDashboard() { syncs++; }, rememberNavigatorProjects() {},
        clearAllInteractiveFilters() { throw new Error('must preserve filters'); }
    });
    const options = { type: 2, viewport: { width: 1000, height: 700 }, dataViews: [{ table: { columns: [{ roles: { jsonDashboard: true } }], rows: [[null]] } }] };
    visual.update(options);
    assert.deepEqual(visual.rootElement.children, ['sidebar', 'empty']);
    assert.equal(visual.currentDashboardData, dashboard);
    assert.equal(visual.filterState, filterState);
    assert.equal(visual.pendingProjectSelectionId, 'B');
    assert.equal(syncs, 0);
    // Even the same parsed object must repaint after an empty response.
    parsed = dashboard;
    visual.pendingProjectSelectionId = null;
    visual.initializePreferredProject = () => {};
    visual.update(options);
    assert.deepEqual(visual.rootElement.children, ['sidebar', 'report']);

    // A cold start has no cached dashboard and may have persisted host filters.
    parsed = null;
    visual.currentDashboardData = null;
    visual.pendingNavigationLevel = null;
    visual.startupRecoveryAttempted = false;
    const removed = [];
    let resets = 0;
    visual.navigationFilters = { clear: force => { assert.equal(force, true); resets++; } };
    visual.host = { applyJsonFilter: (filter, object, property) => {
        assert.equal(filter, null);
        assert.equal(object, 'internalFilters');
        removed.push(property);
    } };
    visual.applyLevelFilter = level => assert.equal(level, 'PRONIED');
    visual.update(options);
    assert.equal(resets, 1);
    assert.ok(removed.includes('combinedSelfFilter'));
    assert.ok(removed.includes('selfProjectFilter'));
    assert.equal(sidebarLevel, 'PRONIED');
    assert.equal(emptyLevel, 'PRONIED');
    assert.deepEqual(visual.rootElement.children, ['sidebar', 'empty']);
    visual.update(options);
    assert.equal(resets, 1, 'do not loop when page filters legitimately have no data');
    parsed = dashboard;
    visual.update(options);
    assert.equal(syncs, 2);

    // Navigate from a project to a unit while the page filters still return no data.
    parsed = null;
    const appliedUnits = [];
    visual.applyUnitDashboardFilters = unit => { appliedUnits.push(unit); visual.pendingProjectSelectionId = null; };
    visual.openUnitDashboard('UGM');
    visual.update(options);
    assert.deepEqual(appliedUnits, ['UGM']);
    assert.equal(sidebarLevel, 'UNIDAD');
    assert.equal(emptyLevel, 'UNIDAD');
    assert.equal(visual.currentDashboardData.context.Unit, 'UGM');
    assert.equal(visual.currentDashboardData.context.ProjectId, null);
    assert.equal(visual.pendingNavigationLevel, 'UNIDAD');
    // Further empty updates keep the requested section, then real unit data resolves it.
    visual.update(options);
    assert.equal(sidebarLevel, 'UNIDAD');
    parsed = { context: { Level: 'UNIDAD', Unit: 'UGM', ProjectId: null }, projects: [] };
    visual.update(options);
    assert.equal(visual.pendingNavigationLevel, null);
    assert.deepEqual(visual.rootElement.children, ['sidebar', 'report']);
});
