"use strict";

import powerbi from "powerbi-visuals-api";
import "./styles/visual.less";

import { adaptJsonDashboardData, parseDashboardJsonData } from "./dataParser";
import { renderCurve } from "./renderers/curveRenderer";
import { renderGaugeGrid } from "./renderers/gaugeRenderer";
import { renderHeader, renderSidebar } from "./renderers/headerRenderer";
import { renderMilestones } from "./renderers/milestoneRenderer";
import { renderPerformance } from "./renderers/performanceRenderer";
import { renderRisks } from "./renderers/riskRenderer";
import { mountRiskDashboardPage, renderRiskDashboard } from "./renderers/riskDashboardRenderer";
import { renderPortfolioDashboard } from "./portfolioSummary/Dashboard";
import { AggregateCurveData, AggregateGaugeData, CriticalIntervention, CurveData, CurveHistoryPoint, CurveReferences, DashboardData, DashboardLevel, DataValue, GaugeChartPoint, GaugeChartSeries, GaugeData, GaugeHistoryRow, GaugeMetricKey, NavigatorProject, ParsedDashboardData, PortfolioSummaryData, ProjectHeader, RenderCurveData, RiskItem, SummaryData, UnitProjectSummaryData, UnitSummaryData, VisualPalette } from "./types";
import { createElement, currency, date, decimal, numberValue, shortCurrency, text } from "./utils/format";
import { debounceInput } from "./utils/interaction";
import { NavigationFilterController } from "./controllers/NavigationFilterController";
import { NavigatorProjectIndex } from "./controllers/NavigatorProjectIndex";
import { InternalFilterController } from "./controllers/InternalFilterController";
import { ViewLifecycle } from "./controllers/ViewLifecycle";
import { LazyCarouselView } from "./views/LazyCarouselView";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualEventService = powerbi.extensibility.IVisualEventService;

interface NavigationDebugState {
    clickCount: number;
    updateCount: number;
    lastAction: string;
    requestedLevel: string | null;
    requestedUnit: string | null;
    requestedProjectId: string | null;
    clickedProjectKeys: string;
    clickedProjectObject: string;
    clickedProjectId: string | null;
    clickedProjectIdType: string | null;
    applyJsonFilterCalled: boolean;
    externalProjectFilterApplied: boolean;
    selfProjectFilterApplied: boolean;
    receivedLevel: string | null;
    receivedUnit: string | null;
    receivedProjectId: string | null;
    rawContextLevel: string | null;
    normalizedContextLevel: string | null;
    contextLevelAfterParse: string | null;
    rawDashboardLength: number | null;
    rawDashboardPreview: string;
    directContextObject: string;
    directRawLevel: string | null;
    directNormalizedLevel: string | null;
    contextAfterParse: string;
    beforeLegacyLevel: string | null;
    legacyParsedLevel: string | null;
    legacyContextLevel: string | null;
    legacyParsedObject: string;
    finalContextLevel: string | null;
    finalParsedPreview: string;
    parserUsed: string | null;
    fallbackUsed: boolean;
    cachedDashboardUsed: boolean;
    jsonDashboardRoleIndex: number | null;
    jsonDashboardDisplayName: string | null;
    jsonDashboardQueryName: string | null;
    navigatorRoleIndex: number | null;
    dataViewRowCount: number | null;
    rowIndexUsed: number | null;
    renderedLevel: string | null;
    jsonFilterCount: number;
    lastFilterJson: string;
    activeJsonFilters: string;
    activeFilterSummary: string;
    lastError: string | null;
    timestamp: string;
}

const palette: VisualPalette = {
    blue: "#001B8E",
    red: "#FF1E1E",
    orange: "#FF9800",
    green: "#16A34A",
    purple: "#5B21B6",
    background: "#F7F9FC",
    card: "#FFFFFF",
    text: "#00145C",
    muted: "#667085",
    border: "#DDE3F0"
};

const gaugeMetricColors: Record<GaugeMetricKey, string> = {
    CPI: "#F97316",
    "SPI (w)": "#2563EB",
    TCPI: "#16A34A",
    "TSPI (w)": "#DC2626"
};

export class Visual implements IVisual {
    private readonly host: powerbi.extensibility.visual.IVisualHost;
    private readonly events: IVisualEventService;
    private readonly target: HTMLElement;
    private rootElement: HTMLElement | null = null;
    private currentDashboardData: ParsedDashboardData | null = null;
    private filterPanelOpen: boolean = false;
    private filterFocus: "unit" | "project" | null = null;
    private readonly filterState: {
        level: DashboardLevel;
        selectedUnit: string | null;
        selectedProjectId: string | null;
        lastNavigableUnit: string | null;
        lastNavigableProjectId: string | null;
        region: string | null;
        province: string | null;
        district: string | null;
        status: string | null;
    } = {
        level: "PRONIED",
        selectedUnit: null,
        selectedProjectId: null,
        lastNavigableUnit: null,
        lastNavigableProjectId: null,
        region: null,
        province: null,
        district: null,
        status: null
    };
    private readonly navigationFilters: NavigationFilterController;
    private readonly internalFilters: InternalFilterController;
    private readonly navigatorIndex: NavigatorProjectIndex;
    private readonly filteredProjectsCache = new Map<string, NavigatorProject[]>();
    private readonly viewLifecycle = new ViewLifecycle();
    private navigationDebugHidden: boolean = false;
    private readonly navigationDebugPanelEnabled: boolean = false;
    private pendingNavigationLevel: DashboardLevel | null = null;
    private pendingProjectSelectionId: string | null = null;
    private defaultProjectId: string | null = null;
    private preferredProjectInitialized: boolean = false;
    private readonly preferredProjectCui: string = "254895";
    private navigationDebug: NavigationDebugState = {
        clickCount: 0,
        updateCount: 0,
        lastAction: "Visual inicializado",
        requestedLevel: null,
        requestedUnit: null,
        requestedProjectId: null,
        clickedProjectKeys: "",
        clickedProjectObject: "",
        clickedProjectId: null,
        clickedProjectIdType: null,
        applyJsonFilterCalled: false,
        externalProjectFilterApplied: false,
        selfProjectFilterApplied: false,
        receivedLevel: null,
        receivedUnit: null,
        receivedProjectId: null,
        rawContextLevel: null,
        normalizedContextLevel: null,
        contextLevelAfterParse: null,
        rawDashboardLength: null,
        rawDashboardPreview: "",
        directContextObject: "",
        directRawLevel: null,
        directNormalizedLevel: null,
        contextAfterParse: "",
        beforeLegacyLevel: null,
        legacyParsedLevel: null,
        legacyContextLevel: null,
        legacyParsedObject: "",
        finalContextLevel: null,
        finalParsedPreview: "",
        parserUsed: null,
        fallbackUsed: false,
        cachedDashboardUsed: false,
        jsonDashboardRoleIndex: null,
        jsonDashboardDisplayName: null,
        jsonDashboardQueryName: null,
        navigatorRoleIndex: null,
        dataViewRowCount: null,
        rowIndexUsed: null,
        renderedLevel: null,
        jsonFilterCount: 0,
        lastFilterJson: "",
        activeJsonFilters: "",
        activeFilterSummary: "",
        lastError: null,
        timestamp: new Date().toISOString()
    };
    private isGaugeHistoryModalOpen: boolean = false;
    private sidebarExpanded: boolean = true;
    private filterLoading: boolean = false;
    private filterLoadingTimer: number | null = null;
    private filterLoadingSafetyTimer: number | null = null;
    private projectCarouselIndex: number = 0;
    private projectCurveExpanded: boolean = false;
    private portfolioCarouselIndex: number = 0;
    private riskCarouselIndex: number = 0;
    private readonly lazyCarousel = new LazyCarouselView();
    private matrixVisibleColumns: Set<keyof CurveData> | null = null;
    private matrixCostProjectionMethod: 1 | 2 | 3 | 4 = 1;
    private selectedGaugeKey: GaugeMetricKey | null = null;
    private visibleGaugeSeries: GaugeMetricKey[] = ["CPI", "SPI (w)", "TCPI", "TSPI (w)"];
    private readonly handleGaugeModalKeydown = (event: KeyboardEvent): void => {
        if (event.key === "Escape" && this.isGaugeHistoryModalOpen) {
            this.closeGaugeHistoryModal();
        }
    };
    private readonly handleCriticalModalKeydown = (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
            this.closeCriticalInterventionsModal();
        }
    };

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.target = options.element;
        this.navigationFilters = new NavigationFilterController(this.host, () => this.beginFilterLoading());
        this.internalFilters = new InternalFilterController(this.host, () => this.beginFilterLoading());
        this.navigatorIndex = new NavigatorProjectIndex((project) => this.getProjectId(project));
        this.target.classList.add("evm-visual-host");
    }

    private selectedProjectWeek: number | null = null;
    private weekFilterProjectId: string | null = null;
    private selectedUnitWeek: number | null = null;
    private weekFilterUnit: string | null = null;
    private lastWeekFilterUpdateOptions: VisualUpdateOptions | null = null;
    private forceWeekFilterRender = false;

    public update(options: VisualUpdateOptions): void {
        this.lastWeekFilterUpdateOptions = options;
        this.events.renderingStarted(options);
        const resizeMask = powerbi.VisualUpdateType.Resize | powerbi.VisualUpdateType.ResizeEnd;
        const isResizeOnly = Boolean(options.type & resizeMask) && (options.type & ~resizeMask) === 0;
        if (!this.forceWeekFilterRender && isResizeOnly && this.rootElement && this.currentDashboardData) {
            this.rootElement.style.width = `${options.viewport.width}px`;
            this.rootElement.style.height = `${options.viewport.height}px`;
            const main = this.rootElement.querySelector(".evm-main");
            if (main instanceof HTMLElement) {
                main.style.minWidth = `${Math.min(780, Math.max(0, options.viewport.width - 92))}px`;
            }
            this.events.renderingFinished(options);
            return;
        }
        const jsonFilters = this.readUpdateJsonFilters(options);
        if (this.navigationDebugPanelEnabled) {
            this.navigationDebug.updateCount += 1;
            this.navigationDebug.lastAction = "Power BI ejecutó update()";
            this.navigationDebug.jsonFilterCount = jsonFilters.length;
            this.navigationDebug.lastFilterJson = JSON.stringify(jsonFilters);
            this.navigationDebug.activeJsonFilters = JSON.stringify(jsonFilters, null, 2);
            this.navigationDebug.activeFilterSummary = this.summarizeJsonFilters(jsonFilters);
            this.navigationDebug.timestamp = new Date().toISOString();
        }

        try {
            const dataView = options.dataViews?.[0];
            const dashboard = parseDashboardJsonData(dataView);
            if (!this.forceWeekFilterRender && dashboard && dashboard === this.currentDashboardData && this.rootElement) {
                this.rootElement.style.width = `${options.viewport.width}px`;
                this.rootElement.style.height = `${options.viewport.height}px`;
                this.finishFilterLoading();
                this.events.renderingFinished(options);
                return;
            }
            this.closeCriticalInterventionsModal();
            this.viewLifecycle.reset();
            this.target.replaceChildren();
            if (dashboard?.context?.Level === this.pendingNavigationLevel) {
                this.pendingNavigationLevel = null;
            }
            if (this.navigationDebugPanelEnabled) {
                this.navigationDebug.receivedLevel = dashboard?.context?.Level ?? null;
                this.navigationDebug.receivedUnit = dashboard?.context?.Unit ?? null;
                this.navigationDebug.receivedProjectId = dashboard?.context?.ProjectId ?? null;
                this.navigationDebug.rawContextLevel = dashboard?.debug?.rawContextLevel ?? null;
                this.navigationDebug.normalizedContextLevel = dashboard?.debug?.normalizedContextLevel ?? null;
                this.navigationDebug.contextLevelAfterParse = dashboard?.debug?.contextLevelAfterParse ?? null;
                this.navigationDebug.rawDashboardLength = dashboard?.debug?.rawDashboardLength ?? null;
                this.navigationDebug.rawDashboardPreview = dashboard?.debug?.rawDashboardPreview ?? "";
                this.navigationDebug.directContextObject = dashboard?.debug?.directContextObject ?? "";
                this.navigationDebug.directRawLevel = dashboard?.debug?.directRawLevel ?? null;
                this.navigationDebug.directNormalizedLevel = dashboard?.debug?.directNormalizedLevel ?? null;
                this.navigationDebug.contextAfterParse = dashboard?.debug?.contextAfterParse ?? "";
                this.navigationDebug.beforeLegacyLevel = dashboard?.debug?.beforeLegacyLevel ?? null;
                this.navigationDebug.legacyParsedLevel = dashboard?.debug?.legacyParsedLevel ?? null;
                this.navigationDebug.legacyContextLevel = dashboard?.debug?.legacyContextLevel ?? null;
                this.navigationDebug.legacyParsedObject = dashboard?.debug?.legacyParsedObject ?? "";
                this.navigationDebug.finalContextLevel = dashboard?.debug?.finalContextLevel ?? null;
                this.navigationDebug.finalParsedPreview = dashboard?.debug?.finalParsedPreview ?? "";
                this.navigationDebug.parserUsed = dashboard?.debug?.parserUsed ?? null;
                this.navigationDebug.fallbackUsed = dashboard?.debug?.fallbackUsed ?? false;
                this.navigationDebug.cachedDashboardUsed = dashboard?.debug?.cachedDashboardUsed ?? false;
                this.navigationDebug.jsonDashboardRoleIndex = dashboard?.debug?.jsonDashboardRoleIndex ?? null;
                this.navigationDebug.jsonDashboardDisplayName = dashboard?.debug?.jsonDashboardDisplayName ?? null;
                this.navigationDebug.jsonDashboardQueryName = dashboard?.debug?.jsonDashboardQueryName ?? null;
                this.navigationDebug.navigatorRoleIndex = dashboard?.debug?.navigatorRoleIndex ?? null;
                this.navigationDebug.dataViewRowCount = dashboard?.debug?.dataViewRowCount ?? null;
                this.navigationDebug.rowIndexUsed = dashboard?.debug?.rowIndexUsed ?? null;
                this.navigationDebug.lastAction = "JSON Dashboard interpretado";
                this.navigationDebug.lastError = null;
                this.navigationDebug.timestamp = new Date().toISOString();
            }
            this.currentDashboardData = dashboard;
            if (dashboard) {
                this.rememberNavigatorProjects(dashboard.navigator?.projects ?? dashboard.projects);
            }
            const root = document.createElement("div");
            root.className = "evm-dashboard";
            root.classList.toggle("sidebar-expanded", this.sidebarExpanded);
            root.style.width = `${options.viewport.width}px`;
            root.style.height = `${options.viewport.height}px`;
            root.style.position = "relative";
            this.rootElement = root;

            if (dashboard) {
                const receivedProjectId = dashboard.context.ProjectId
                    ?? this.navigatorText(dashboard.project?.IdIntervencion)
                    ?? null;
                if (!this.pendingProjectSelectionId || receivedProjectId === this.pendingProjectSelectionId) {
                    this.pendingProjectSelectionId = null;
                    this.syncFilterStateFromDashboard(dashboard);
                }
                const sidebarUnit = this.resolveUnitForNavigation(dashboard);
                const sidebarProject = this.resolveProjectForNavigation(dashboard);
                root.appendChild(renderSidebar({
                    expanded: this.sidebarExpanded,
                    activeLevel: dashboard.context.Level,
                    portfolioViewActive: this.portfolioCarouselIndex === 0 ? "summary" : "matrix",
                    unitViewActive: this.unitMatrixPageActive ? "matrix" : "summary",
                    projectViewActive: this.projectCarouselIndex === 1 ? "milestones" : "summary",
                    riskViewActive: this.riskCarouselIndex === 1 ? "matrix" : "summary",
                    canOpenUnit: Boolean(sidebarUnit),
                    canOpenProject: Boolean(sidebarProject),
                    onOpenPronied: () => this.openProniedDashboard(),
                    onOpenRisks: () => this.openRiskDashboard(),
                    onOpenUnit: () => this.openUnitDashboard(sidebarUnit ?? undefined),
                    onOpenProject: () => {
                        const sidebarProjectItem = sidebarProject ? this.findNavigatorProjectById(sidebarProject) : null;
                        if (sidebarProjectItem) {
                            this.openProjectDashboard(sidebarProjectItem);
                            return;
                        }
                        this.disableProjectNavigation(sidebarProject ?? null);
                    },
                    onPortfolioView: (view) => this.openPortfolioView(view),
                    onUnitView: (view) => {
                        if (this.currentDashboardData?.context.Level === "UNIDAD") this.activateUnitPage?.(view === "matrix" ? 1 : 0);
                    },
                    onProjectView: (view) => this.openProjectView(view),
                    onRiskView: (view) => this.openRiskView(view),
                    onOpenFilters: () => this.openFilterPanel(),
                    onToggle: () => {
                        this.sidebarExpanded = !this.sidebarExpanded;
                        root.classList.toggle("sidebar-expanded", this.sidebarExpanded);
                        return this.sidebarExpanded;
                    }
                }));
                root.appendChild(this.renderCurrentDashboard(dashboard, options.viewport));
                if (this.filterPanelOpen && dashboard.context.Level !== "PROYECTO" && dashboard.context.Level !== "UNIDAD") {
                    root.appendChild(this.renderFilterPanel());
                }
            } else {
                const empty = document.createElement("div");
                empty.className = "evm-no-data";
                empty.textContent = "Asigne columnas o medidas al visual para ver el dashboard EVM.";
                root.appendChild(empty);
            }

            this.renderNavigationDebugPanel();
            this.target.appendChild(root);
            this.finishFilterLoading();
            this.initializePreferredProject(dashboard);
            if (this.isGaugeHistoryModalOpen) {
                this.renderGaugeHistoryModal();
            }
            this.events.renderingFinished(options);
        } catch (error) {
            this.finishFilterLoading();
            if (this.navigationDebugPanelEnabled) {
                this.navigationDebug.lastAction = "Error al interpretar JSON Dashboard";
                this.navigationDebug.lastError = error instanceof Error ? error.message : String(error);
                this.navigationDebug.timestamp = new Date().toISOString();
                this.renderNavigationDebugPanel();
            }
            this.events.renderingFailed(options, String(error));
        }
    }

    private renderNavigationDebugPanel(): void {
        if (!this.rootElement) {
            return;
        }

        if (!this.navigationDebugPanelEnabled) {
            this.rootElement.querySelector(".evm-navigation-debug-panel")?.remove();
            return;
        }

        this.rootElement.querySelector(".evm-navigation-debug-panel")?.remove();

        if (this.navigationDebugHidden) {
            const showButton = document.createElement("button");
            showButton.type = "button";
            showButton.className = "evm-navigation-debug-panel";
            showButton.textContent = "Debug nav";
            showButton.style.position = "absolute";
            showButton.style.top = "8px";
            showButton.style.right = "8px";
            showButton.style.zIndex = "9999";
            showButton.style.pointerEvents = "auto";
            showButton.style.fontSize = "11px";
            showButton.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.navigationDebugHidden = false;
                this.renderNavigationDebugPanel();
            });
            this.rootElement.appendChild(showButton);
            return;
        }

        const panel = document.createElement("section");
        panel.className = "evm-navigation-debug-panel";
        panel.setAttribute("aria-label", "Panel de depuración de navegación");
        panel.style.position = "absolute";
        panel.style.top = "8px";
        panel.style.right = "8px";
        panel.style.zIndex = "9999";
        panel.style.width = "720px";
        panel.style.maxWidth = "calc(100% - 16px)";
        panel.style.maxHeight = "calc(100% - 16px)";
        panel.style.overflow = "auto";
        panel.style.pointerEvents = "auto";
        panel.style.background = "#FFFFFF";
        panel.style.border = "1px solid #CBD5E1";
        panel.style.boxShadow = "0 12px 28px rgba(15, 23, 42, 0.18)";
        panel.style.borderRadius = "8px";
        panel.style.padding = "10px";
        panel.style.fontSize = "11px";
        panel.style.lineHeight = "1.35";
        panel.style.color = "#00145C";

        const header = document.createElement("div");
        header.style.display = "flex";
        header.style.alignItems = "center";
        header.style.justifyContent = "space-between";
        header.style.gap = "8px";
        const title = document.createElement("strong");
        title.textContent = "Debug navegación";
        const status = document.createElement("span");
        status.textContent = this.navigationDebugStatusLabel();
        status.style.padding = "3px 8px";
        status.style.borderRadius = "999px";
        status.style.color = "#FFFFFF";
        status.style.background = this.navigationDebugStatusColor();
        status.style.fontWeight = "700";
        header.appendChild(title);
        header.appendChild(status);
        panel.appendChild(header);

        const actions = document.createElement("div");
        actions.style.display = "grid";
        actions.style.gridTemplateColumns = "1fr 1fr 1fr";
        actions.style.gap = "6px";
        actions.style.margin = "8px 0";
        actions.appendChild(this.renderNavigationDebugButton("Ocultar", () => {
            this.navigationDebugHidden = true;
            this.renderNavigationDebugPanel();
        }));
        actions.appendChild(this.renderNavigationDebugButton("Copiar diagnóstico", () => this.copyNavigationDebug()));
        actions.appendChild(this.renderNavigationDebugButton("Limpiar diagnóstico", () => this.resetNavigationDebug()));
        panel.appendChild(actions);

        const testActions = document.createElement("div");
        testActions.style.display = "grid";
        testActions.style.gridTemplateColumns = "1fr 1fr 1fr";
        testActions.style.gap = "6px";
        testActions.style.marginBottom = "8px";
        testActions.appendChild(this.renderNavigationLevelTestButton("Probar PRONIED", "PRONIED"));
        testActions.appendChild(this.renderNavigationLevelTestButton("Probar UNIDAD", "UNIDAD"));
        testActions.appendChild(this.renderNavigationLevelTestButton("Probar nivel PROYECTO", "PROYECTO"));
        panel.appendChild(testActions);

        const projectTestActions = document.createElement("div");
        projectTestActions.style.display = "grid";
        projectTestActions.style.gridTemplateColumns = "1fr";
        projectTestActions.style.gap = "6px";
        projectTestActions.style.marginBottom = "8px";
        projectTestActions.appendChild(this.renderNavigationDebugButton("Probar proyecto WP 01", () => this.testProjectNavigationFilter("WP 01")));
        panel.appendChild(projectTestActions);

        const rows = document.createElement("div");
        rows.style.display = "grid";
        rows.style.gridTemplateColumns = "180px minmax(0, 1fr)";
        rows.style.gap = "4px 8px";
        this.appendNavigationDebugRow(rows, "Última acción", this.navigationDebug.lastAction);
        this.appendNavigationDebugRow(rows, "Clics", String(this.navigationDebug.clickCount));
        this.appendNavigationDebugRow(rows, "Updates", String(this.navigationDebug.updateCount));
        this.appendNavigationDebugRow(rows, "Nivel solicitado", this.navigationDebug.requestedLevel ?? "-");
        this.appendNavigationDebugRow(rows, "Unidad solicitada", this.navigationDebug.requestedUnit ?? "-");
        this.appendNavigationDebugRow(rows, "Proyecto solicitado", this.navigationDebug.requestedProjectId ?? "-");
        this.appendNavigationDebugRow(rows, "clickedProjectKeys", this.navigationDebug.clickedProjectKeys || "-");
        this.appendNavigationDebugRow(rows, "clickedProjectObject", this.navigationDebug.clickedProjectObject || "-");
        this.appendNavigationDebugRow(rows, "clickedProjectId", this.navigationDebug.clickedProjectId ?? "-");
        this.appendNavigationDebugRow(rows, "typeof clickedProjectId", this.navigationDebug.clickedProjectIdType ?? "-");
        this.appendNavigationDebugRow(rows, "applyJsonFilter ejecutado", this.navigationDebug.applyJsonFilterCalled ? "Sí" : "No");
        this.appendNavigationDebugRow(rows, "externalProjectFilterApplied", this.navigationDebug.externalProjectFilterApplied ? "Sí" : "No");
        this.appendNavigationDebugRow(rows, "selfProjectFilterApplied", this.navigationDebug.selfProjectFilterApplied ? "Sí" : "No");
        this.appendNavigationDebugRow(rows, "Nivel recibido", this.navigationDebug.receivedLevel ?? "-");
        this.appendNavigationDebugRow(rows, "Unidad recibida", this.navigationDebug.receivedUnit ?? "-");
        this.appendNavigationDebugRow(rows, "Proyecto recibido", this.navigationDebug.receivedProjectId ?? "-");
        this.appendNavigationDebugRow(rows, "rawContextLevel", this.navigationDebug.rawContextLevel ?? "-");
        this.appendNavigationDebugRow(rows, "normalizedContextLevel", this.navigationDebug.normalizedContextLevel ?? "-");
        this.appendNavigationDebugRow(rows, "rawDashboardLength", this.navigationDebug.rawDashboardLength === null ? "-" : String(this.navigationDebug.rawDashboardLength));
        this.appendNavigationDebugRow(rows, "rawDashboardPreview", this.navigationDebug.rawDashboardPreview || "-");
        this.appendNavigationDebugRow(rows, "directContextObject", this.navigationDebug.directContextObject || "-");
        this.appendNavigationDebugRow(rows, "directRawLevel", this.navigationDebug.directRawLevel ?? "-");
        this.appendNavigationDebugRow(rows, "directNormalizedLevel", this.navigationDebug.directNormalizedLevel ?? "-");
        this.appendNavigationDebugRow(rows, "contextAfterParse", this.navigationDebug.contextAfterParse || "-");
        this.appendNavigationDebugRow(rows, "contextLevelAfterParse", this.navigationDebug.contextLevelAfterParse ?? "-");
        this.appendNavigationDebugRow(rows, "beforeLegacyLevel", this.navigationDebug.beforeLegacyLevel ?? "-");
        this.appendNavigationDebugRow(rows, "legacyParsedLevel", this.navigationDebug.legacyParsedLevel ?? "-");
        this.appendNavigationDebugRow(rows, "legacyContextLevel", this.navigationDebug.legacyContextLevel ?? "-");
        this.appendNavigationDebugRow(rows, "legacyParsedObject", this.navigationDebug.legacyParsedObject || "-");
        this.appendNavigationDebugRow(rows, "finalContextLevel", this.navigationDebug.finalContextLevel ?? "-");
        this.appendNavigationDebugRow(rows, "finalParsedPreview", this.navigationDebug.finalParsedPreview || "-");
        this.appendNavigationDebugRow(rows, "parser utilizado", this.navigationDebug.parserUsed ?? "-");
        this.appendNavigationDebugRow(rows, "fallback utilizado", this.navigationDebug.fallbackUsed ? "Sí" : "No");
        this.appendNavigationDebugRow(rows, "caché utilizada", this.navigationDebug.cachedDashboardUsed ? "Sí" : "No");
        this.appendNavigationDebugRow(rows, "jsonDashboardRoleIndex", this.navigationDebug.jsonDashboardRoleIndex === null ? "-" : String(this.navigationDebug.jsonDashboardRoleIndex));
        this.appendNavigationDebugRow(rows, "jsonDashboardDisplayName", this.navigationDebug.jsonDashboardDisplayName ?? "-");
        this.appendNavigationDebugRow(rows, "jsonDashboardQueryName", this.navigationDebug.jsonDashboardQueryName ?? "-");
        this.appendNavigationDebugRow(rows, "navigatorRoleIndex", this.navigationDebug.navigatorRoleIndex === null ? "-" : String(this.navigationDebug.navigatorRoleIndex));
        this.appendNavigationDebugRow(rows, "dataViewRowCount", this.navigationDebug.dataViewRowCount === null ? "-" : String(this.navigationDebug.dataViewRowCount));
        this.appendNavigationDebugRow(rows, "rowIndexUsed", this.navigationDebug.rowIndexUsed === null ? "-" : String(this.navigationDebug.rowIndexUsed));
        this.appendNavigationDebugRow(rows, "renderedLevel", this.navigationDebug.renderedLevel ?? "-");
        this.appendNavigationDebugRow(rows, "Cantidad jsonFilters", String(this.navigationDebug.jsonFilterCount));
        this.appendNavigationDebugRow(rows, "Botones de nivel", "Solo prueban Dim_NivelDashboard[Nivel], no seleccionan proyecto");
        this.appendNavigationDebugRow(rows, "Filtros activos", this.navigationDebug.activeFilterSummary || "-");
        this.appendNavigationDebugRow(rows, "activeJsonFilters", this.navigationDebug.activeJsonFilters || "-");
        this.appendNavigationDebugRow(rows, "Último filtro", this.navigationDebug.lastFilterJson || "-");
        this.appendNavigationDebugRow(rows, "Último error", this.navigationDebug.lastError ?? "-");
        this.appendNavigationDebugRow(rows, "Hora", this.navigationDebug.timestamp);
        panel.appendChild(rows);

        this.rootElement.appendChild(panel);
    }

    private renderNavigationDebugButton(label: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.style.fontSize = "10px";
        button.style.padding = "5px 6px";
        button.style.border = "1px solid #CBD5E1";
        button.style.borderRadius = "5px";
        button.style.background = "#F8FAFC";
        button.style.color = "#00145C";
        button.style.cursor = "pointer";
        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            onClick();
        });
        return button;
    }

    private renderNavigationLevelTestButton(label: string, level: "PRONIED" | "UNIDAD" | "PROYECTO"): HTMLButtonElement {
        const button = this.renderNavigationDebugButton(label, () => {
            this.navigationDebug.clickCount += 1;
            this.navigationDebug.lastAction = `Click navegación ${level}`;
            this.navigationDebug.requestedLevel = level;
            this.navigationDebug.requestedUnit = null;
            this.navigationDebug.requestedProjectId = null;
            this.navigationDebug.applyJsonFilterCalled = false;
            this.navigationDebug.timestamp = new Date().toISOString();
            this.renderNavigationDebugPanel();
            this.navigateLevelForDebug(level);
        });
        return button;
    }

    private appendNavigationDebugRow(container: HTMLElement, labelText: string, valueText: string): void {
        const label = document.createElement("span");
        label.textContent = labelText;
        label.style.fontWeight = "700";
        const value = document.createElement("span");
        value.textContent = valueText;
        value.style.minWidth = "0";
        value.style.overflowWrap = "anywhere";
        container.appendChild(label);
        container.appendChild(value);
    }

    private navigationDebugStatusLabel(): string {
        if (this.navigationDebug.lastError) {
            return "Error";
        }
        if (this.navigationDebug.requestedLevel && this.navigationDebug.requestedLevel === this.navigationDebug.receivedLevel) {
            return "OK";
        }
        if (this.navigationDebug.updateCount > 0 && this.navigationDebug.requestedLevel && this.navigationDebug.receivedLevel && this.navigationDebug.requestedLevel !== this.navigationDebug.receivedLevel) {
            return "No coincide";
        }
        if (this.navigationDebug.applyJsonFilterCalled) {
            return "Filtro enviado";
        }
        if (this.navigationDebug.clickCount > 0) {
            return "Click";
        }
        return "Sin interacción";
    }

    private navigationDebugStatusColor(): string {
        if (this.navigationDebug.lastError) {
            return "#DC2626";
        }
        if (this.navigationDebug.requestedLevel && this.navigationDebug.requestedLevel === this.navigationDebug.receivedLevel) {
            return "#16A34A";
        }
        if (this.navigationDebug.updateCount > 0 && this.navigationDebug.requestedLevel && this.navigationDebug.receivedLevel && this.navigationDebug.requestedLevel !== this.navigationDebug.receivedLevel) {
            return "#F97316";
        }
        if (this.navigationDebug.applyJsonFilterCalled) {
            return "#F59E0B";
        }
        if (this.navigationDebug.clickCount > 0) {
            return "#2563EB";
        }
        return "#64748B";
    }

    private attachMatrixCopyMenu(matrix: HTMLElement, headerSelector: string, rowSelector: string, cellSelector: string, completeRows?: string[][]): void {
        const clearAltHover = (): void => matrix.classList.remove("evm-matrix-alt-active");
        matrix.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key === "Alt") {
                matrix.classList.add("evm-matrix-alt-active");
            }
        });
        matrix.addEventListener("keyup", (event: KeyboardEvent) => {
            if (event.key === "Alt") {
                clearAltHover();
            }
        });
        matrix.addEventListener("pointermove", clearAltHover);
        this.viewLifecycle.listen(window, "blur", clearAltHover, { once: true });
        matrix.addEventListener("contextmenu", (event: MouseEvent) => {
            const target = event.target instanceof Element ? event.target.closest(cellSelector) : null;
            if (!(target instanceof HTMLElement) || !matrix.contains(target)) return;
            const row = target.parentElement;
            if (!row || row.matches(headerSelector)) return;
            event.preventDefault();
            event.stopPropagation();
            const clean = (element: Element | null): string => {
                if (!element) return "";
                const raw = element.matches("th") && element.children.length
                    ? Array.from(element.children).map((child) => child.textContent ?? "").join(" ")
                    : element.textContent ?? "";
                return raw.trim().replace(/\s+/g, " ");
            };
            const copyValue = (element: Element | null): string => clean(element).replace(/^S\/\s*/i, "");
            const rows = Array.from(matrix.querySelectorAll(rowSelector));
            const rowValues = Array.from(row.children).map(copyValue);
            const columnIndex = Array.from(row.children).indexOf(target);
            const columnValues = completeRows
                ? completeRows.map((values) => values[columnIndex] ?? "")
                : rows.map((item) => copyValue(item.children[columnIndex] ?? null));
            const columnCount = rowValues.length;
            const headerRows = Array.from(matrix.querySelectorAll("thead tr"));
            const headerGrid: string[][] = headerRows.map(() => Array(columnCount).fill(""));
            headerRows.forEach((headerRow, headerRowIndex) => {
                let gridColumn = 0;
                Array.from(headerRow.children).forEach((cell) => {
                    while (gridColumn < columnCount && headerGrid[headerRowIndex][gridColumn]) gridColumn += 1;
                    const htmlCell = cell as HTMLTableCellElement;
                    const columnSpan = Math.max(1, htmlCell.colSpan || 1);
                    const rowSpan = Math.max(1, htmlCell.rowSpan || 1);
                    const value = clean(cell);
                    for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
                        for (let columnOffset = 0; columnOffset < columnSpan; columnOffset += 1) {
                            const targetRow = headerRowIndex + rowOffset;
                            const targetColumn = gridColumn + columnOffset;
                            if (targetRow < headerGrid.length && targetColumn < columnCount) {
                                headerGrid[targetRow][targetColumn] = value;
                            }
                        }
                    }
                    gridColumn += columnSpan;
                });
            });
            const groupHeaders = headerGrid[0] ?? Array(columnCount).fill("");
            const individualHeaders = headerGrid[headerGrid.length - 1] ?? groupHeaders;
            const hasGroupedHeaders = headerGrid.length > 1;
            const qualifiedHeaders = individualHeaders.map((individual, index) => {
                const group = groupHeaders[index] ?? "";
                return group && group !== individual ? `${group} > ${individual}` : individual || group;
            });
            const headerLines = hasGroupedHeaders
                ? [groupHeaders.join("\t"), individualHeaders.join("\t")]
                : [individualHeaders.join("\t")];
            const tableText = [
                ...headerLines,
                ...(completeRows ?? rows.map((item) => Array.from(item.children).map(copyValue))).map((values) => values.join("\t"))
            ].join("\n");
            const selectedHeader = qualifiedHeaders[columnIndex] ?? "";
            const columnHeaderLines = hasGroupedHeaders
                ? [groupHeaders[columnIndex] ?? "", individualHeaders[columnIndex] ?? ""]
                : [individualHeaders[columnIndex] ?? ""];
            const copyTableHtml = (selectedRow: Element | null = null): string => {
                const clone = matrix.cloneNode(true) as HTMLElement;
                const sourceHeaderCells = Array.from(matrix.querySelectorAll("thead th"));
                Array.from(clone.querySelectorAll("thead th")).forEach((headerCell, index) => {
                    headerCell.textContent = clean(sourceHeaderCells[index] ?? null);
                });
                const sourceRows = Array.from(matrix.querySelectorAll(rowSelector));
                Array.from(clone.querySelectorAll(rowSelector)).forEach((cloneRow, index) => {
                    if (selectedRow && sourceRows[index] !== selectedRow) {
                        cloneRow.remove();
                        return;
                    }
                    Array.from(cloneRow.children).forEach((cell) => {
                        cell.textContent = copyValue(cell);
                        cell.removeAttribute("title");
                        cell.removeAttribute("tabindex");
                    });
                });
                if (completeRows && !selectedRow) {
                    const cloneBody = clone.querySelector("tbody");
                    cloneBody?.replaceChildren(...completeRows.map((values) => {
                        const completeRow = document.createElement("tr");
                        values.forEach((value) => completeRow.appendChild(createElement("td", undefined, value)));
                        return completeRow;
                    }));
                }
                clone.removeAttribute("class");
                clone.querySelectorAll("*").forEach((element) => element.removeAttribute("class"));
                return clone.outerHTML;
            };
            const copyColumnHtml = (): string => {
                const copyTable = document.createElement("table");
                const copyHead = document.createElement("thead");
                columnHeaderLines.forEach((headerText) => {
                    const headerRow = document.createElement("tr");
                    headerRow.appendChild(createElement("th", undefined, headerText));
                    copyHead.appendChild(headerRow);
                });
                const copyBody = document.createElement("tbody");
                columnValues.forEach((value) => {
                    const valueRow = document.createElement("tr");
                    valueRow.appendChild(createElement("td", undefined, value));
                    copyBody.appendChild(valueRow);
                });
                copyTable.append(copyHead, copyBody);
                return copyTable.outerHTML;
            };
            const copySingleValueHtml = (): string => {
                const copyTable = document.createElement("table");
                const headerRow = document.createElement("tr");
                headerRow.appendChild(createElement("th", undefined, selectedHeader));
                const valueRow = document.createElement("tr");
                valueRow.appendChild(createElement("td", undefined, copyValue(target)));
                copyTable.append(headerRow, valueRow);
                return copyTable.outerHTML;
            };
            this.rootElement?.querySelector(".evm-matrix-copy-menu")?.remove();
            if (!this.rootElement) return;
            const menu = createElement("div", "evm-matrix-copy-menu");
            const actions: Array<{ label: string; text: string; html: string }> = [
                { label: "Copiar valor seleccionado", text: `${selectedHeader}\n${copyValue(target)}`, html: copySingleValueHtml() },
                { label: "Copiar fila", text: [...headerLines, rowValues.join("\t")].join("\n"), html: copyTableHtml(row) },
                { label: "Copiar columna", text: [...columnHeaderLines, ...columnValues].join("\n"), html: copyColumnHtml() },
                { label: "Copiar tabla", text: tableText, html: copyTableHtml() }
            ];
            actions.forEach((action) => {
                const button = createElement("button", undefined, action.label);
                button.type = "button";
                button.addEventListener("click", () => {
                    this.copyMatrixText(action.text, action.html);
                    menu.remove();
                });
                menu.appendChild(button);
            });
            const rootRect = this.rootElement.getBoundingClientRect();
            menu.style.left = `${Math.max(6, Math.min(event.clientX - rootRect.left, rootRect.width - 230))}px`;
            menu.style.top = `${Math.max(6, Math.min(event.clientY - rootRect.top, rootRect.height - 170))}px`;
            this.rootElement.appendChild(menu);
            const closeMenu = (): void => {
                menu.remove();
                document.removeEventListener("pointerdown", closeWhenOutside, true);
                document.removeEventListener("keydown", closeWithEscape, true);
            };
            const closeWhenOutside = (pointerEvent: PointerEvent): void => {
                if (pointerEvent.target instanceof Node && menu.contains(pointerEvent.target)) {
                    return;
                }
                closeMenu();
            };
            const closeWithEscape = (keyEvent: KeyboardEvent): void => {
                if (keyEvent.key !== "Escape") return;
                keyEvent.preventDefault();
                closeMenu();
                target.focus();
            };
            window.setTimeout(() => {
                document.addEventListener("pointerdown", closeWhenOutside, true);
                document.addEventListener("keydown", closeWithEscape, true);
            }, 0);
        });
    }

    public destroy(): void {
        this.closeCriticalInterventionsModal();
        this.viewLifecycle.reset();
    }

    private copyMatrixText(content: string, htmlContent?: string): void {
        if (htmlContent) {
            const richCopy = document.createElement("div");
            richCopy.contentEditable = "true";
            richCopy.style.position = "fixed";
            richCopy.style.left = "-9999px";
            richCopy.style.top = "0";
            const parsedCopy = new DOMParser().parseFromString(htmlContent, "text/html");
            Array.from(parsedCopy.body.childNodes).forEach((node) => {
                richCopy.appendChild(document.importNode(node, true));
            });
            document.body.appendChild(richCopy);
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(richCopy);
            selection?.removeAllRanges();
            selection?.addRange(range);
            let richCopied = false;
            try {
                richCopied = document.execCommand("copy");
            } catch {
                richCopied = false;
            }
            selection?.removeAllRanges();
            richCopy.remove();
            if (richCopied) {
                this.showMatrixCopyNotice("Copiado al portapapeles");
                return;
            }
        }
        const textarea = document.createElement("textarea");
        textarea.value = content;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        let copied = false;
        try {
            copied = document.execCommand("copy");
        } catch {
            copied = false;
        }
        textarea.remove();
        if (copied) {
            this.showMatrixCopyNotice("Copiado al portapapeles");
            return;
        }
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(content)
                .then(() => this.showMatrixCopyNotice("Copiado al portapapeles"))
                .catch(() => this.showMatrixCopyFallback(content));
            return;
        }
        this.showMatrixCopyFallback(content);
    }

    private showMatrixCopyNotice(message: string): void {
        if (!this.rootElement) return;
        this.rootElement.querySelector(".evm-matrix-copy-notice")?.remove();
        const notice = createElement("div", "evm-matrix-copy-notice", message);
        this.rootElement.appendChild(notice);
        window.setTimeout(() => notice.remove(), 1800);
    }

    private showMatrixCopyFallback(content: string): void {
        this.showNavigationDebugTextarea(content);
        this.showMatrixCopyNotice("Seleccione el texto y presione Ctrl+C");
    }

    private copyNavigationDebug(): void {
        const content = JSON.stringify(this.navigationDebug, null, 2);
        const clipboard = navigator.clipboard;
        if (clipboard?.writeText) {
            clipboard.writeText(content).catch(() => this.showNavigationDebugTextarea(content));
            return;
        }
        this.showNavigationDebugTextarea(content);
    }

    private showNavigationDebugTextarea(content: string): void {
        if (!this.rootElement) {
            return;
        }
        this.rootElement.querySelector(".evm-navigation-debug-copy")?.remove();
        const textarea = document.createElement("textarea");
        textarea.className = "evm-navigation-debug-copy";
        textarea.value = content;
        textarea.style.position = "absolute";
        textarea.style.top = "8px";
        textarea.style.right = "360px";
        textarea.style.zIndex = "10000";
        textarea.style.width = "320px";
        textarea.style.height = "220px";
        textarea.style.fontSize = "11px";
        this.rootElement.appendChild(textarea);
        textarea.focus();
        textarea.select();
    }

    private resetNavigationDebug(): void {
        this.navigationDebug = {
            clickCount: 0,
            updateCount: this.navigationDebug.updateCount,
            lastAction: "Diagnóstico limpiado",
            requestedLevel: null,
            requestedUnit: null,
            requestedProjectId: null,
            clickedProjectKeys: this.navigationDebug.clickedProjectKeys,
            clickedProjectObject: this.navigationDebug.clickedProjectObject,
            clickedProjectId: this.navigationDebug.clickedProjectId,
            clickedProjectIdType: this.navigationDebug.clickedProjectIdType,
            applyJsonFilterCalled: false,
            externalProjectFilterApplied: this.navigationDebug.externalProjectFilterApplied,
            selfProjectFilterApplied: this.navigationDebug.selfProjectFilterApplied,
            receivedLevel: this.currentDashboardData?.context.Level ?? null,
            receivedUnit: this.currentDashboardData?.context.Unit ?? null,
            receivedProjectId: this.currentDashboardData?.context.ProjectId ?? null,
            rawContextLevel: this.currentDashboardData?.debug?.rawContextLevel ?? null,
            normalizedContextLevel: this.currentDashboardData?.debug?.normalizedContextLevel ?? null,
            contextLevelAfterParse: this.currentDashboardData?.debug?.contextLevelAfterParse ?? null,
            rawDashboardLength: this.currentDashboardData?.debug?.rawDashboardLength ?? null,
            rawDashboardPreview: this.currentDashboardData?.debug?.rawDashboardPreview ?? "",
            directContextObject: this.currentDashboardData?.debug?.directContextObject ?? "",
            directRawLevel: this.currentDashboardData?.debug?.directRawLevel ?? null,
            directNormalizedLevel: this.currentDashboardData?.debug?.directNormalizedLevel ?? null,
            contextAfterParse: this.currentDashboardData?.debug?.contextAfterParse ?? "",
            beforeLegacyLevel: this.currentDashboardData?.debug?.beforeLegacyLevel ?? null,
            legacyParsedLevel: this.currentDashboardData?.debug?.legacyParsedLevel ?? null,
            legacyContextLevel: this.currentDashboardData?.debug?.legacyContextLevel ?? null,
            legacyParsedObject: this.currentDashboardData?.debug?.legacyParsedObject ?? "",
            finalContextLevel: this.currentDashboardData?.debug?.finalContextLevel ?? null,
            finalParsedPreview: this.currentDashboardData?.debug?.finalParsedPreview ?? "",
            parserUsed: this.currentDashboardData?.debug?.parserUsed ?? null,
            fallbackUsed: this.currentDashboardData?.debug?.fallbackUsed ?? false,
            cachedDashboardUsed: this.currentDashboardData?.debug?.cachedDashboardUsed ?? false,
            jsonDashboardRoleIndex: this.currentDashboardData?.debug?.jsonDashboardRoleIndex ?? null,
            jsonDashboardDisplayName: this.currentDashboardData?.debug?.jsonDashboardDisplayName ?? null,
            jsonDashboardQueryName: this.currentDashboardData?.debug?.jsonDashboardQueryName ?? null,
            navigatorRoleIndex: this.currentDashboardData?.debug?.navigatorRoleIndex ?? null,
            dataViewRowCount: this.currentDashboardData?.debug?.dataViewRowCount ?? null,
            rowIndexUsed: this.currentDashboardData?.debug?.rowIndexUsed ?? null,
            renderedLevel: this.currentDashboardData?.context.Level ?? null,
            jsonFilterCount: this.navigationDebug.jsonFilterCount,
            lastFilterJson: this.navigationDebug.lastFilterJson,
            activeJsonFilters: this.navigationDebug.activeJsonFilters,
            activeFilterSummary: this.navigationDebug.activeFilterSummary,
            lastError: null,
            timestamp: new Date().toISOString()
        };
        this.renderNavigationDebugPanel();
    }

    private renderCurrentDashboard(dashboard: ParsedDashboardData, viewport: powerbi.IViewport): HTMLElement {
        if (this.navigationDebugPanelEnabled) this.navigationDebug.renderedLevel = dashboard.context.Level;
        switch (dashboard.context.Level) {
            case "PRONIED":
                return this.renderProniedDashboard(dashboard, viewport);
            case "UNIDAD":
                return this.renderUnitDashboard(dashboard, viewport);
            case "PROYECTO":
                return this.renderProjectDashboard(dashboard, viewport);
            case "RIESGOS":
                return renderRiskDashboard(dashboard.riskDashboard, this.riskCarouselIndex, (index) => this.openRiskView(index === 0 ? "summary" : "matrix"));
            default:
                return this.renderDashboardError(`Nivel no reconocido: ${dashboard.context.Level}`);
        }
    }

    private projectFilterWeeks(dashboard: ParsedDashboardData): number[] {
        const at = dashboard.curve.map((row) => numberValue(row.AT)).find((value) => value !== null) ?? null;
        return Array.from(new Set(dashboard.curve.map((row) => row.Semana)
            .filter((week) => Number.isFinite(week) && week >= 1 && at !== null && week <= at)))
            .sort((a, b) => a - b);
    }

    private renderProjectDashboard(dashboard: ParsedDashboardData, viewport: powerbi.IViewport): HTMLElement {
        const projectId = dashboard.context.ProjectId ?? dashboard.idIntervencion;
        if (this.weekFilterProjectId !== projectId) {
            this.weekFilterProjectId = projectId;
            this.selectedProjectWeek = null;
        }
        const availableWeeks = this.projectFilterWeeks(dashboard);
        if (this.selectedProjectWeek === null || !availableWeeks.includes(this.selectedProjectWeek)) {
            this.selectedProjectWeek = availableWeeks[availableWeeks.length - 1] ?? null;
        }
        const projectDashboard = adaptJsonDashboardData(dashboard, this.selectedProjectWeek);
        const main = document.createElement("main");
        main.className = "evm-main evm-main--project";
        main.classList.toggle("evm-main--project-details", this.projectCarouselIndex === 1);
        main.classList.add("evm-main--project-filters-open");
        main.style.minWidth = `${Math.min(780, Math.max(0, viewport.width - 92))}px`;
        main.appendChild(renderHeader(projectDashboard.header, {
            titleLabel: "TABLERO PROYECTOS -",
            subtitle: "Sistema de Seguimiento, Monitoreo y Evaluación - SSME"
        }));
        const filterPanel = this.renderFilterPanel();
        filterPanel.classList.add("evm-filter-panel--project-inline");
        main.appendChild(filterPanel);
        const gaugeGrid = renderGaugeGrid(projectDashboard.gauges, palette, (key) => this.openGaugeHistoryModal(key), this.viewLifecycle);
        gaugeGrid.classList.add("evm-project-gauge-grid");
        main.appendChild(gaugeGrid);
        main.appendChild(this.renderBodyCarousel(projectDashboard, dashboard.curve));
        return main;
    }

    private renderProniedDashboard(dashboard: ParsedDashboardData, viewport: powerbi.IViewport): HTMLElement {
        const main = createElement("main", "evm-main evm-main--pronied");
        main.classList.toggle("evm-main--portfolio-details", this.portfolioCarouselIndex === 1);
        main.style.minWidth = `${Math.min(780, Math.max(0, viewport.width - 92))}px`;
        main.appendChild(renderHeader(
            this.portfolioHeaderData("TABLERO EJECUTIVO - PORTAFOLIO INSTITUCIONAL", dashboard),
            {
                titleLabel: null,
                subtitle: "Sistema de Seguimiento, Monitoreo y Evaluación - SSME",
                stateLabel: "Estado del Portafolio",
                weekOverride: 44
            }
        ));
        const gaugeSection = this.renderPortfolioGaugeSection(dashboard);
        gaugeSection.classList.add("evm-portfolio-gauge-grid");
        main.appendChild(gaugeSection);
        main.appendChild(this.renderProniedBodyCarousel(dashboard));
        return main;
    }

    private renderProniedBodyCarousel(dashboard: ParsedDashboardData): HTMLElement {
        const carousel = createElement("section", "evm-body-carousel evm-body-carousel--portfolio");
        const viewport = createElement("div", "evm-body-carousel-viewport");

        const summaryPage = this.createLazyCarouselPage("evm-body-carousel-page evm-body-carousel-page--evm", this.portfolioCarouselIndex === 0, (page) => {
            const left = createElement("div", "evm-left-column");
            const curveCard = renderCurve(this.buildAggregateRenderCurve(dashboard), palette, { portfolio: true, showYearBracket: true }, this.viewLifecycle);
            curveCard.classList.add("evm-portfolio-curve-card");
            const curveTitle = curveCard.querySelector(".evm-section-title");
            if (curveTitle instanceof HTMLElement) {
                curveTitle.textContent = "CURVA S - PORTAFOLIO INSTITUCIONAL";
                curveTitle.insertAdjacentElement("afterend", this.renderPortfolioCurveLegend());
            }
            left.appendChild(curveCard);
            const right = createElement("div", "evm-right-column");
            right.appendChild(renderPortfolioDashboard(
                dashboard.portfolioSummary,
                undefined,
                () => this.openCriticalInterventionsModal(dashboard.criticalInterventions)
            ));
            page.append(left, right);
        });

        const unitsPage = this.createLazyCarouselPage("evm-body-carousel-page evm-body-carousel-page--portfolio-units", this.portfolioCarouselIndex === 1, (page) => {
            const portfolioAt = this.lastAggregateValue(dashboard.aggregateCurve, (row) => row.AT);
            page.appendChild(this.renderUnitProgressPanel(this.unitsAtWeek(dashboard.units, portfolioAt)));
            page.appendChild(this.renderPortfolioRiskSection(dashboard.risks));
        });

        const pages = [summaryPage, unitsPage];
        pages.forEach((page, index) => {
            page.classList.toggle("active", index === this.portfolioCarouselIndex);
            page.setAttribute("aria-hidden", index === this.portfolioCarouselIndex ? "false" : "true");
            viewport.appendChild(page);
        });

        carousel.appendChild(viewport);
        carousel.appendChild(this.renderCarouselButton("prev", "‹", "Ver pantalla anterior", pages));
        carousel.appendChild(this.renderCarouselButton("next", "›", "Ver pantalla siguiente", pages));
        this.updateCarouselButtons(carousel);
        return carousel;
    }

    private renderPortfolioCurveLegend(): HTMLElement {
        const legend = createElement("div", "evm-portfolio-curve-legend");
        [
            { label: "PV (Valor Planificado)", className: "pv" },
            { label: "EV (Valor Ganado)", className: "ev" },
            { label: "AC (Costo Actual)", className: "ac" },
            { label: "EAC (Estimado al Término)", className: "eac" },
            { label: "SAC (Cronograma al Término)", className: "sac" }
        ].forEach((item) => {
            const entry = createElement("div", `evm-portfolio-curve-legend-item ${item.className}`);
            entry.appendChild(createElement("i"));
            entry.appendChild(createElement("span", undefined, item.label));
            legend.appendChild(entry);
        });
        return legend;
    }

    private renderUnitProgressPanel(units: UnitSummaryData[]): HTMLElement {
        const section = createElement("section", "evm-card evm-unit-progress-card");
        const heading = createElement("div", "evm-unit-progress-heading");
        heading.appendChild(createElement("div", "evm-section-title", "PORTAFOLIO DEL PRONIED"));
        const legend = createElement("div", "evm-unit-progress-range-legend");
        const legendTitle = createElement("div", "evm-unit-progress-range-title");
        legendTitle.appendChild(document.createTextNode("CRITERIO DE ESTADOS"));
        const infoIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        infoIcon.setAttribute("viewBox", "0 0 24 24");
        infoIcon.setAttribute("aria-hidden", "true");
        const infoCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        infoCircle.setAttribute("cx", "12");
        infoCircle.setAttribute("cy", "12");
        infoCircle.setAttribute("r", "9");
        const infoLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
        infoLine.setAttribute("d", "M12 10v6M12 7.25v.1");
        infoIcon.appendChild(infoCircle);
        infoIcon.appendChild(infoLine);
        legendTitle.appendChild(infoIcon);
        legend.appendChild(legendTitle);
        const legendItems = createElement("div", "evm-unit-progress-range-items");
        [
            {
                range: "1.00 – 1.19",
                label: "ESTABLE",
                description: "Ambos indicadores (CPI y SPI) se encuentran en el rango:",
                className: "stable"
            },
            {
                range: "0.90 – 0.99",
                label: "EN RIESGO",
                description: "Cualquiera de los indicadores (CPI o SPI) se encuentra en el rango:",
                className: "risk"
            },
            {
                range: "0.00 – 0.89",
                label: "CRÍTICO",
                description: "Cualquiera de los indicadores (CPI o SPI) se encuentra en el rango:",
                className: "critical"
            }
        ].forEach((item) => {
            const legendItem = createElement("div", `evm-unit-progress-range-item ${item.className}`);
            const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            icon.setAttribute("viewBox", "0 0 40 40");
            icon.setAttribute("aria-hidden", "true");
            const targetOuter = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            targetOuter.setAttribute("cx", "18");
            targetOuter.setAttribute("cy", "22");
            targetOuter.setAttribute("r", "12");
            const targetInner = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            targetInner.setAttribute("cx", "18");
            targetInner.setAttribute("cy", "22");
            targetInner.setAttribute("r", "7");
            const targetCenter = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            targetCenter.setAttribute("cx", "18");
            targetCenter.setAttribute("cy", "22");
            targetCenter.setAttribute("r", "2");
            const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
            arrow.setAttribute("d", "M18 22 33 7M26 7h7v7");
            icon.appendChild(targetOuter);
            icon.appendChild(targetInner);
            icon.appendChild(targetCenter);
            icon.appendChild(arrow);
            legendItem.appendChild(icon);
            const copy = createElement("span", "evm-unit-progress-range-copy");
            copy.appendChild(createElement("b", undefined, item.label));
            copy.appendChild(createElement("small", undefined, item.description));
            legendItem.appendChild(copy);
            legendItem.appendChild(createElement("strong", undefined, item.range));
            legendItems.appendChild(legendItem);
        });
        legend.appendChild(legendItems);
        section.appendChild(heading);

        if (!units.length) {
            section.appendChild(createElement("div", "evm-empty", "No se encontraron unidades para los filtros seleccionados."));
            return section;
        }

        const table = createElement("div", "evm-unit-progress-table");
        const header = createElement("div", "evm-unit-progress-row evm-unit-progress-header");
        header.appendChild(this.renderUnitProgressHeader("Unidad", "unit"));
        header.appendChild(this.renderUnitProgressHeader("% Avance", "advance"));
        header.appendChild(this.renderUnitProgressHeader("BAC", "cpi"));
        header.appendChild(this.renderUnitProgressHeader("PV", "cpi"));
        header.appendChild(this.renderUnitProgressHeader("EV", "cpi"));
        header.appendChild(this.renderUnitProgressHeader("AC", "cpi"));
        header.appendChild(this.renderUnitProgressHeader("CV", "cpi"));
        header.appendChild(this.renderUnitProgressHeader("CPI", "cpi"));
        header.appendChild(this.renderUnitProgressHeader("SV", "spi"));
        header.appendChild(this.renderUnitProgressHeader("SPI (w)", "spi"));
        header.appendChild(this.renderUnitProgressHeader("EAC (c)", "cpi"));
        header.appendChild(this.renderUnitProgressHeader("ETC (c)", "cpi"));
        header.appendChild(this.renderUnitProgressHeader("TCPI", "spi"));
        header.appendChild(this.renderUnitProgressHeader("VAC (c)", "cpi"));
        table.appendChild(header);

        const progressRows = units.slice(0, 12).map((unit) => {
            const calculatedAdvance = unit.BAC && unit.EV !== null ? Math.max(0, unit.EV / unit.BAC) : 0;
            const advancePct = Math.round(unit.Avance ?? calculatedAdvance * 100);
            return { unit, advancePct };
        });
        progressRows.forEach(({ unit, advancePct }) => {
            const normalizedUnit = unit.UnidadGerencial.trim().toLowerCase();
            const isTotal = normalizedUnit === "portafolio" || normalizedUnit === "portafolio pronied";
            const spi = unit.SPIW;
            const cpi = unit.CPI;
            const minimumIndex = Math.min(spi ?? 0, cpi ?? 0);
            const sourceStatus = unit.Estado.trim();
            const normalizedStatus = sourceStatus.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const status = sourceStatus
                ? {
                    label: sourceStatus,
                    className: normalizedStatus.includes("adecuad") || normalizedStatus.includes("estable")
                        ? "adequate"
                        : normalizedStatus.includes("riesgo") || normalizedStatus.includes("alerta")
                            ? "risk"
                            : "critical"
                }
                : minimumIndex >= 0.95
                    ? { label: "Adecuado", className: "adequate" }
                    : minimumIndex >= 0.85
                        ? { label: "En Riesgo", className: "risk" }
                        : { label: "Crítico", className: "critical" };

            const row = createElement("div", `evm-unit-progress-row${isTotal ? " evm-unit-progress-row--total" : ""}`);
            const unitCell = createElement("div", "evm-unit-progress-unit");
            if (!isTotal) {
                unitCell.appendChild(this.renderUnitProgressIcon(unit.UnidadGerencial));
                const rawUnitName = unit.UnidadGerencial.trim();
                const separatorIndex = rawUnitName.indexOf(" - ");
                const unitCode = separatorIndex >= 0 ? rawUnitName.slice(0, separatorIndex) : rawUnitName;
                const unitName = separatorIndex >= 0 ? rawUnitName.slice(separatorIndex + 3) : "";
                const unitCopy = createElement("span", "evm-unit-progress-unit-copy");
                unitCopy.appendChild(createElement("strong", "evm-unit-progress-unit-code", unitCode));
                if (unitName) {
                    unitCopy.appendChild(createElement("small", "evm-unit-progress-unit-name", unitName));
                }
                unitCell.appendChild(unitCopy);
            } else {
                unitCell.appendChild(createElement("strong", undefined, unit.UnidadGerencial));
            }
            row.appendChild(unitCell);

            const isOverTarget = advancePct > 100;
            const progressCell = createElement("div", `evm-unit-progress-value${isOverTarget ? " is-over-target" : ""}`);
            const progress = document.createElement("progress");
            progress.className = `evm-unit-progress-track${isOverTarget ? " is-over-target" : ""}`;
            progress.max = 100;
            progress.value = Math.min(advancePct, 100);
            progressCell.appendChild(progress);
            progressCell.appendChild(createElement("strong", undefined, `${advancePct}%`));
            row.appendChild(progressCell);
            row.appendChild(createElement("span", "evm-unit-progress-money", currency(unit.BAC)));
            row.appendChild(createElement("span", "evm-unit-progress-money", currency(unit.PV)));
            row.appendChild(createElement("span", "evm-unit-progress-money", currency(unit.EV)));
            row.appendChild(createElement("span", "evm-unit-progress-money", currency(unit.AC)));
            row.appendChild(createElement("span", "evm-unit-progress-money", currency(unit.CV)));
            row.appendChild(createElement("span", "evm-unit-progress-index", decimal(cpi)));
            row.appendChild(createElement("span", "evm-unit-progress-money", currency(unit.SV)));
            row.appendChild(createElement("span", "evm-unit-progress-index", decimal(spi)));
            row.appendChild(createElement("span", "evm-unit-progress-money", currency(unit.EACC)));
            row.appendChild(createElement("span", "evm-unit-progress-money", currency(unit.ETCC)));
            row.appendChild(createElement("span", "evm-unit-progress-index", decimal(unit.TCPI)));
            row.appendChild(createElement("span", "evm-unit-progress-money", currency(unit.VACC)));
            Array.from(row.children).forEach((cell) => {
                if (!(cell instanceof HTMLElement)) {
                    return;
                }
                cell.tabIndex = 0;
                cell.setAttribute("role", "gridcell");
                cell.setAttribute("aria-selected", "false");
                const toggleSelection = (): void => {
                    const wasSelected = cell.classList.contains("is-selected");
                    table.querySelectorAll(".is-selected").forEach((selected) => {
                        selected.classList.remove("is-selected");
                        if (selected.getAttribute("role") === "gridcell") {
                            selected.setAttribute("aria-selected", "false");
                        }
                    });
                    if (!wasSelected) {
                        row.classList.add("is-selected");
                        cell.classList.add("is-selected");
                        cell.setAttribute("aria-selected", "true");
                    }
                };
                cell.addEventListener("click", toggleSelection);
                cell.addEventListener("keydown", (event: KeyboardEvent) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleSelection();
                    }
                });
            });
            table.appendChild(row);
        });

        const body = createElement("div", "evm-unit-progress-body");
        body.appendChild(table);
        section.appendChild(body);
        this.attachMatrixCopyMenu(table, ".evm-unit-progress-header", ".evm-unit-progress-row:not(.evm-unit-progress-header)", ".evm-unit-progress-row > *");
        return section;
    }

    private renderPortfolioRiskSection(risks: RiskItem[], mode: "portfolio" | "unit" = "portfolio"): HTMLElement {
        const section = createElement("section", "evm-card evm-portfolio-risk-section");

        const matrixRows = risks.filter((risk) => Boolean(risk.UnidadGerencial));
        if (!matrixRows.length) {
            section.appendChild(createElement("div", "evm-empty", "No se encontraron datos de riesgos por unidad."));
            return section;
        }

        const totalSource = matrixRows.find((risk) => risk.UnidadGerencial?.trim().toLowerCase() === "total");
        const detailRows = matrixRows.filter((risk) => risk !== totalSource);
        const sum = (key: "Bajo" | "Medio" | "Alto"): number => {
            const explicit = numberValue(totalSource?.[key]);
            return explicit ?? detailRows.reduce((total, row) => total + (numberValue(row[key]) ?? 0), 0);
        };
        const totals = {
            bajo: sum("Bajo"),
            medio: sum("Medio"),
            alto: sum("Alto")
        };
        const grandTotal = numberValue(totalSource?.Total) ?? totals.bajo + totals.medio + totals.alto;

        const content = createElement("div", "evm-portfolio-risk-content");
        const distribution = createElement("div", "evm-portfolio-risk-panel evm-portfolio-risk-distribution");
        distribution.appendChild(createElement("h3", undefined, "DISTRIBUCIÓN DE RIESGOS"));
        const chartBody = createElement("div", "evm-portfolio-risk-chart-body");
        chartBody.appendChild(this.renderPortfolioRiskDonut(totals.bajo, totals.medio, totals.alto));
        distribution.appendChild(chartBody);
        content.appendChild(distribution);

        const matrix = createElement("div", "evm-portfolio-risk-panel evm-portfolio-risk-matrix");
        matrix.appendChild(createElement("h3", undefined, "MATRIZ DE RIESGOS"));
        const grid = createElement("div", "evm-portfolio-risk-grid");
        [
            { label: mode === "unit" ? "PROYECTO" : "UNIDAD GERENCIAL", className: "unit" },
            { label: "BAJO", className: "low" },
            { label: "MEDIO", className: "medium" },
            { label: "ALTO", className: "high" },
            { label: "TOTAL", className: "overall" }
        ].forEach(({ label, className }) => {
            const header = createElement("span", `header ${className}`);
            if (className !== "unit") {
                header.appendChild(createElement("i"));
            }
            header.appendChild(document.createTextNode(label));
            grid.appendChild(header);
        });
        [...detailRows, ...(totalSource ? [totalSource] : [])].forEach((risk) => {
            const isTotal = risk === totalSource;
            const rowLabel = createElement("strong", isTotal ? "row-label total" : "row-label");
            if (!isTotal) {
                rowLabel.appendChild(this.renderUnitProgressIcon(mode === "unit" ? String(risk.Cui ?? "") : risk.UnidadGerencial ?? ""));
                const rawUnitName = mode === "unit"
                    ? `${risk.Cui ? `${risk.Cui} - ` : ""}${risk.NombreIntervencion || risk.UnidadGerencial || "?"}`
                    : risk.UnidadGerencial?.trim() ?? "?";
                const separatorIndex = rawUnitName.indexOf(" - ");
                const unitCode = separatorIndex >= 0 ? rawUnitName.slice(0, separatorIndex) : rawUnitName;
                const unitName = separatorIndex >= 0 ? rawUnitName.slice(separatorIndex + 3) : "";
                const unitCopy = createElement("span", "evm-portfolio-risk-unit-copy");
                unitCopy.appendChild(createElement("span", "evm-portfolio-risk-unit-code", unitCode));
                if (unitName) {
                    unitCopy.appendChild(createElement("span", "evm-portfolio-risk-unit-name", unitName));
                }
                rowLabel.appendChild(unitCopy);
            } else {
                rowLabel.appendChild(document.createTextNode("Total"));
            }
            grid.appendChild(rowLabel);
            grid.appendChild(createElement("span", `cell low${isTotal ? " total" : ""}`, this.formatInteger(risk.Bajo)));
            grid.appendChild(createElement("span", `cell medium${isTotal ? " total" : ""}`, this.formatInteger(risk.Medio)));
            grid.appendChild(createElement("span", `cell high${isTotal ? " total" : ""}`, this.formatInteger(risk.Alto)));
            grid.appendChild(createElement("span", `cell overall${isTotal ? " total" : ""}`, this.formatInteger(risk.Total)));
        });
        matrix.appendChild(grid);
        content.appendChild(matrix);

        const indicators = createElement("div", "evm-portfolio-risk-panel evm-portfolio-risk-indicators");
        const interventionsAtRisk = numberValue(totalSource?.IntervencionesRiesgo) ?? totals.alto;
        const trendSource = numberValue(totalSource?.TendenciaRiesgosPct);
        const trendPct = trendSource === null
            ? null
            : (Math.abs(trendSource) <= 1 ? trendSource * 100 : trendSource);
        indicators.appendChild(this.renderPortfolioRiskIndicator(
            "shield",
            "Total Riesgos Activos",
            this.formatInteger(grandTotal),
            "",
            "blue"
        ));
        indicators.appendChild(this.renderPortfolioRiskIndicator(
            "high",
            "Intervenciones en Riesgo",
            this.formatInteger(interventionsAtRisk),
            "",
            "orange"
        ));
        indicators.appendChild(this.renderPortfolioRiskIndicator(
            "trend",
            "Tendencia de Riesgos",
            trendPct === null ? "—" : `${trendPct > 0 ? "+" : ""}${trendPct.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`,
            "vs semana anterior",
            "red"
        ));
        content.appendChild(indicators);
        section.appendChild(content);
        return section;
    }

    private renderPortfolioRiskIndicator(
        icon: "shield" | "high" | "trend",
        label: string,
        value: string,
        note: string,
        color: "blue" | "orange" | "red"
    ): HTMLElement {
        const item = createElement("div", `evm-portfolio-risk-indicator ${color}`);
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 40 40");
        svg.setAttribute("aria-hidden", "true");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", icon === "shield"
            ? "M20 3c5 4 10 5 15 5v10c0 9-6 15-15 20C11 33 5 27 5 18V8c5 0 10-1 15-5zM12 20l5 5 11-12"
            : "M5 31 16 18l7 7L35 9M27 9h8v8");
        svg.appendChild(path);
        item.appendChild(svg);
        const copy = createElement("div", "evm-portfolio-risk-indicator-copy");
        copy.appendChild(createElement("span", undefined, label));
        copy.appendChild(createElement("strong", undefined, value));
        if (note) {
            copy.appendChild(createElement("small", undefined, note));
        }
        item.appendChild(copy);
        return item;
    }

    private renderPortfolioRiskDonut(low: number, medium: number, high: number): SVGSVGElement {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 600 360");
        svg.setAttribute("aria-label", "Distribución de riesgos");
        svg.classList.add("evm-portfolio-risk-callout-chart");
        const total = low + medium + high;
        const circumference = 2 * Math.PI * 100;

        const base = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        base.setAttribute("cx", "300");
        base.setAttribute("cy", "190");
        base.setAttribute("r", "100");
        base.setAttribute("class", "track");
        svg.appendChild(base);

        let consumed = 0;
        [
            { value: low, className: "low" },
            { value: medium, className: "medium" },
            { value: high, className: "high" }
        ].forEach((item) => {
            const segment = total > 0 ? (item.value / total) * circumference : 0;
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", "300");
            circle.setAttribute("cy", "190");
            circle.setAttribute("r", "100");
            circle.setAttribute("class", item.className);
            const visibleSegment = Math.max(0, segment - 6);
            circle.setAttribute("stroke-dasharray", `${visibleSegment} ${circumference - visibleSegment}`);
            circle.setAttribute("stroke-dashoffset", String(-consumed));
            circle.setAttribute("transform", "rotate(-90 300 190)");
            svg.appendChild(circle);
            consumed += segment;
        });

        const centerTotal = document.createElementNS("http://www.w3.org/2000/svg", "text");
        centerTotal.setAttribute("x", "300");
        centerTotal.setAttribute("y", "202");
        centerTotal.setAttribute("class", "donut-center-total");
        centerTotal.textContent = this.formatInteger(total);
        svg.appendChild(centerTotal);

        const addCallout = (
            label: string,
            value: number,
            className: "low" | "medium" | "high",
            points: string,
            dotX: number,
            dotY: number,
            textX: number,
            titleY: number
        ): void => {
            const connector = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
            connector.setAttribute("points", points);
            connector.setAttribute("class", `connector ${className}`);
            svg.appendChild(connector);
            const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            dot.setAttribute("cx", String(dotX));
            dot.setAttribute("cy", String(dotY));
            dot.setAttribute("r", "5");
            dot.setAttribute("class", `callout-dot ${className}`);
            svg.appendChild(dot);
            const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
            title.setAttribute("x", String(textX));
            title.setAttribute("y", String(titleY));
            title.setAttribute("class", `callout-title ${className}`);
            title.textContent = label;
            svg.appendChild(title);
            const detail = document.createElementNS("http://www.w3.org/2000/svg", "text");
            detail.setAttribute("x", String(textX));
            detail.setAttribute("y", String(titleY + 34));
            detail.setAttribute("class", "callout-value");
            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
            detail.textContent = `${this.formatInteger(value)} (${percentage}%)`;
            svg.appendChild(detail);
        };

        addCallout("Alto", high, "high", "220,116 190,84 130,84", 130, 84, 30, 75);
        addCallout("Medio", medium, "medium", "215,232 182,260 125,260", 125, 260, 25, 250);
        addCallout("Bajo", low, "low", "405,220 430,194 455,194", 455, 194, 470, 185);
        return svg;
    }

    private renderUnitProgressHeader(label: string, icon: "unit" | "projects" | "advance" | "spi" | "cpi" | "status"): HTMLElement {
        const header = createElement("span", "evm-unit-progress-header-label");
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 32 32");
        svg.setAttribute("aria-hidden", "true");
        const path = (data: string): void => {
            const node = document.createElementNS("http://www.w3.org/2000/svg", "path");
            node.setAttribute("d", data);
            svg.appendChild(node);
        };
        const circle = (cx: number, cy: number, radius: number): void => {
            const node = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            node.setAttribute("cx", String(cx));
            node.setAttribute("cy", String(cy));
            node.setAttribute("r", String(radius));
            svg.appendChild(node);
        };

        if (icon === "unit") {
            path("M4 28V10l12-7 12 7v18M9 28V15h14v13M13 15v13M19 15v13M8 10h16");
        } else if (icon === "projects") {
            path("M9 4h14v24H9zM13 8h6M13 13h6M13 18h6M13 23h4M5 9h4M5 14h4M5 19h4M5 24h4");
        } else if (icon === "advance") {
            circle(15, 17, 11);
            circle(15, 17, 6);
            circle(15, 17, 1.5);
            path("M15 17 27 5M21 5h6v6");
        } else if (icon === "spi") {
            path("M4 27h24M6 27v-7h5v7M14 27V15h5v12M22 27V9h5v18M5 15l7-6 5 3 10-8M22 4h5v5");
        } else if (icon === "cpi") {
            path("M5 8c0-3 5-5 10-5s10 2 10 5v15c0 3-5 5-10 5S5 26 5 23zM5 8c0 3 5 5 10 5s10-2 10-5M5 15c0 3 5 5 10 5 2 0 4-.3 5-1");
            circle(24, 22, 6);
            path("M24 18v8M21.5 20h3.5a1.5 1.5 0 0 1 0 3h-2a1.5 1.5 0 0 0 0 3h3");
        } else {
            path("M11 3h10l4 4v18l-4 4H11l-4-4V7z");
            circle(16, 10, 2);
            circle(16, 16, 2);
            circle(16, 22, 2);
            path("M4 9h3M4 16h3M4 23h3M25 9h3M25 16h3M25 23h3");
        }

        header.appendChild(svg);
        header.appendChild(createElement("strong", undefined, label));
        return header;
    }

    private renderUnitProgressIcon(unitName: string): SVGSVGElement {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 32 32");
        svg.setAttribute("aria-hidden", "true");
        svg.classList.add("evm-unit-progress-unit-icon");

        const path = (data: string): void => {
            const node = document.createElementNS("http://www.w3.org/2000/svg", "path");
            node.setAttribute("d", data);
            svg.appendChild(node);
        };
        const circle = (cx: number, cy: number, radius: number): void => {
            const node = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            node.setAttribute("cx", String(cx));
            node.setAttribute("cy", String(cy));
            node.setAttribute("r", String(radius));
            svg.appendChild(node);
        };

        const unitCode = unitName.trim().split(/\s|-/)[0].toUpperCase();
        if (unitCode === "UGRD") {
            path("M3 13 16 3l13 10v16H3zM13 11l3 4-3 3 4 4-3 4");
        } else if (unitCode === "UGME") {
            path("M4 13 16 3l12 10v16H4z");
            circle(16, 14, 3);
            path("M11 25v-3c0-3 2-5 5-5s5 2 5 5v3");
        } else if (unitCode === "UGEO") {
            path("M9 7H5v22h19V7h-4M11 3h8v7h-8zM10 15l2 2 4-4M10 22l2 2 4-4M18 15h3M18 22h3");
        } else if (unitCode === "UGSC") {
            circle(11, 9, 5);
            path("M3 27v-4c0-5 3-8 8-8s8 3 8 8v4M19 19l3-3 3 3M17 25l3 3 3-3M22 16h3a4 4 0 0 1 4 4v1M20 28h-3a4 4 0 0 1-4-4v-1");
        } else if (unitCode === "UGM") {
            circle(10, 9, 5);
            path("M2 27v-4c0-5 3-8 8-8 3 0 5 1 7 3M21 17l8 8M24 14l-3 3 8 8-3 3-8-8 3-3M19 25l-4 4");
        } else {
            path("M4 29V11L16 3l12 8v18M2 29h28M10 29V17h12v12M11 12h2M19 12h2");
        }
        return svg;
    }

    private renderUnitDashboard(dashboard: ParsedDashboardData, viewport: powerbi.IViewport): HTMLElement {
        const main = createElement("main", "evm-main evm-main--unit");
        main.classList.toggle("evm-main--unit-matrix", this.unitMatrixPageActive);
        main.style.minWidth = `${Math.min(780, Math.max(0, viewport.width - 92))}px`;
        const unitName = text(this.resolveUnitForNavigation(dashboard), "UGEO");
        if (this.weekFilterUnit !== unitName) {
            this.weekFilterUnit = unitName;
            this.selectedUnitWeek = null;
        }
        const availableWeeks = this.unitFilterWeeks(dashboard);
        if (this.selectedUnitWeek === null || !availableWeeks.includes(this.selectedUnitWeek)) {
            this.selectedUnitWeek = availableWeeks[availableWeeks.length - 1] ?? null;
        }
        const unitHeader = renderHeader(
            this.portfolioHeaderData(`TABLERO UNIDAD GERENCIAL - ${unitName}`, dashboard),
            {
                titleLabel: null,
                subtitle: "Sistema de Seguimiento, Monitoreo y Evaluación - SSME",
                weekOverride: 44
            }
        );
        unitHeader.classList.add("evm-unit-dashboard-header");
        main.appendChild(unitHeader);
        main.appendChild(this.renderUnitInlineFilterPanel(dashboard, availableWeeks));
        main.appendChild(this.renderPortfolioGaugeSection(dashboard, this.selectedUnitWeek));
        main.appendChild(this.renderPortfolioBody(
            this.buildAggregateRenderCurve(dashboard, this.selectedUnitWeek),
            renderPortfolioDashboard(dashboard.portfolioSummary, unitName),
            unitName,
            dashboard.projects,
            dashboard.risks
        ));
        return main;
    }

    private unitFilterWeeks(dashboard: ParsedDashboardData): number[] {
        const terminalWeek = this.unitTerminalWeek(dashboard.aggregateCurve);
        return Array.from(new Set(dashboard.aggregateCurve
            .map((row) => row.OrdenSemana)
            .filter((week) => Number.isFinite(week) && week >= 1 && (terminalWeek === null || week <= terminalWeek))))
            .sort((a, b) => a - b);
    }

    private unitTerminalWeek(rows: AggregateCurveData[]): number | null {
        for (let index = rows.length - 1; index >= 0; index--) {
            const marker = numberValue(rows[index].SemanaPortafolio);
            if (marker === null || Math.abs(marker) < 0.000001) {
                continue;
            }
            return marker > 1 ? marker : rows[index].OrdenSemana;
        }
        return null;
    }

    private renderUnitInlineFilterPanel(dashboard: ParsedDashboardData, weeks: number[]): HTMLElement {
        const panel = createElement("aside", "evm-filter-panel evm-card evm-filter-panel--project-inline evm-filter-panel--unit-inline");
        const header = createElement("div", "evm-filter-panel-header");
        header.appendChild(createElement("strong", undefined, "Filtros"));
        panel.appendChild(header);
        panel.appendChild(this.renderFilterSelect("Semana", "unit-week", weeks.map((week) => ({
            value: String(week), label: String(week)
        })), this.selectedUnitWeek === null ? null : String(this.selectedUnitWeek), (value) => {
            this.selectedUnitWeek = value === null ? null : Number(value);
            if (this.lastWeekFilterUpdateOptions) {
                this.forceWeekFilterRender = true;
                try {
                    this.update(this.lastWeekFilterUpdateOptions);
                } finally {
                    this.forceWeekFilterRender = false;
                }
            }
        }, false, weeks.length === 0));
        const changeUnit = createElement("button", "evm-filter-clear");
        changeUnit.type = "button";
        changeUnit.appendChild(createElement("span", "evm-action-icon", "⇄"));
        changeUnit.appendChild(createElement("span", "evm-action-label", "Cambiar unidad"));
        changeUnit.addEventListener("click", () => this.openUnitSelectorModal(dashboard));
        panel.appendChild(changeUnit);
        return panel;
    }

    private openUnitSelectorModal(dashboard: ParsedDashboardData): void {
        const host = this.rootElement ?? this.target;
        host.querySelector(".evm-unit-selector-overlay")?.remove();
        const projects = this.navigatorProjectCatalog.length
            ? this.navigatorProjectCatalog
            : dashboard.navigator?.projects ?? dashboard.projects ?? [];
        const counts = new Map<string, number>();
        projects.forEach((project) => {
            const unit = this.navigatorText(project.UnidadGerencial).trim();
            if (unit) counts.set(unit, (counts.get(unit) ?? 0) + 1);
        });
        if (!counts.size) {
            dashboard.units.forEach((unit) => {
                const name = this.navigatorText(unit.UnidadGerencial).trim();
                if (name) counts.set(name, numberValue(unit.CantidadProyectos) ?? 0);
            });
        }
        const unitNames: Record<string, string> = {
            UGME: "Unidad Gerencial de Mobiliario y Equipamiento",
            UGEO: "Unidad Gerencial de Estudios y Obras",
            UGM: "Unidad Gerencial de Mantenimiento",
            UGSC: "Unidad Gerencial de Supervisión de Convenios",
            UGRD: "Unidad Gerencial de Riesgos frente a Desastres"
        };
        const unitColors: Record<string, string> = { UGME: "green", UGEO: "blue", UGM: "orange", UGSC: "purple", UGRD: "red" };
        let pendingUnit = dashboard.context.Unit ?? this.filterState.selectedUnit ?? Array.from(counts.keys())[0] ?? null;
        const overlay = createElement("div", "evm-unit-selector-overlay");
        const modal = createElement("section", "evm-unit-selector-modal");
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-label", "Cambiar Unidad Gerencial");
        const modalHeader = createElement("header", "evm-unit-selector-header");
        modalHeader.appendChild(createElement("span", "evm-unit-selector-building", "▥"));
        const headingCopy = createElement("div");
        headingCopy.appendChild(createElement("h2", undefined, "Cambiar Unidad Gerencial"));
        headingCopy.appendChild(createElement("p", undefined, "Selecciona la unidad gerencial para actualizar el tablero"));
        modalHeader.appendChild(headingCopy);
        const close = createElement("button", undefined, "×");
        close.type = "button";
        close.setAttribute("aria-label", "Cerrar");
        modalHeader.appendChild(close);
        modal.appendChild(modalHeader);
        const searchWrap = createElement("div", "evm-unit-selector-search");
        searchWrap.appendChild(createElement("span", undefined, "⌕"));
        const search = document.createElement("input");
        search.type = "search";
        search.placeholder = "Buscar unidad gerencial...";
        searchWrap.appendChild(search);
        modal.appendChild(searchWrap);
        const table = createElement("div", "evm-unit-selector-table");
        const tableHead = createElement("div", "evm-unit-selector-table-head");
        tableHead.appendChild(createElement("span", undefined, "UNIDAD GERENCIAL"));
        tableHead.appendChild(createElement("span", undefined, "PROYECTOS ACTIVOS"));
        table.appendChild(tableHead);
        const list = createElement("div", "evm-unit-selector-list");
        const renderUnits = (): void => {
            list.replaceChildren();
            const query = search.value.trim().toLocaleLowerCase("es");
            Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b)).forEach(([unit, count]) => {
                const code = unit.trim().split(/\s|-/)[0].toUpperCase();
                const fullName = unitNames[code] ?? unit;
                if (query && !`${unit} ${fullName}`.toLocaleLowerCase("es").includes(query)) return;
                const row = createElement("button", `evm-unit-selector-row${pendingUnit === unit ? " selected" : ""}`);
                row.type = "button";
                row.appendChild(createElement("span", "evm-unit-selector-radio", pendingUnit === unit ? "●" : ""));
                row.appendChild(createElement("span", `evm-unit-selector-code ${unitColors[code] ?? "blue"}`, code));
                row.appendChild(createElement("strong", undefined, fullName));
                row.appendChild(createElement("b", undefined, String(count)));
                row.addEventListener("click", () => { pendingUnit = unit; renderUnits(); });
                list.appendChild(row);
            });
        };
        table.appendChild(list);
        modal.appendChild(table);
        const footer = createElement("footer", "evm-unit-selector-footer");
        const totals = createElement("div", "evm-unit-selector-totals");
        totals.appendChild(createElement("span", undefined, `Total de proyectos\n${Array.from(counts.values()).reduce((sum, value) => sum + value, 0)}`));
        totals.appendChild(createElement("span", undefined, `Total de intervenciones\n${projects.length}`));
        footer.appendChild(totals);
        const actions = createElement("div", "evm-unit-selector-actions");
        const cancel = createElement("button", "secondary", "Cancelar");
        const apply = createElement("button", "primary", "Aplicar");
        actions.appendChild(cancel);
        actions.appendChild(apply);
        footer.appendChild(actions);
        modal.appendChild(footer);
        const closeModal = (): void => overlay.remove();
        close.addEventListener("click", closeModal);
        cancel.addEventListener("click", closeModal);
        overlay.addEventListener("click", (event) => { if (event.target === overlay) closeModal(); });
        search.addEventListener("input", debounceInput(renderUnits));
        apply.addEventListener("click", () => {
            if (!pendingUnit) return;
            const selectedCode = pendingUnit.trim().split(/\s|-/)[0].toUpperCase();
            this.filterState.selectedUnit = selectedCode;
            this.filterState.lastNavigableUnit = selectedCode;
            this.filterState.selectedProjectId = null;
            this.pendingNavigationLevel = "UNIDAD";
            // Power BI puede restaurar un filtro general de proyecto de una sesión
            // anterior aunque el estado local del visual ya no lo recuerde.
            this.applyUnitDashboardFilters(selectedCode);
            closeModal();
        });
        renderUnits();
        overlay.appendChild(modal);
        host.appendChild(overlay);
        window.setTimeout(() => search.focus(), 0);
    }

    private renderDashboardError(message: string): HTMLElement {
        const main = createElement("main", "evm-main evm-portfolio-main");
        const card = createElement("section", "evm-card evm-dashboard-error");
        card.appendChild(createElement("h1", undefined, "No se pudo renderizar el dashboard"));
        card.appendChild(createElement("p", undefined, message));
        main.appendChild(card);
        return main;
    }

    private renderPortfolioHeader(titleText: string, subtitleText: string, dashboard: ParsedDashboardData): HTMLElement {
        const header = createElement("section", "evm-card evm-portfolio-header");
        const titleGroup = createElement("div", "evm-portfolio-title");
        titleGroup.appendChild(this.renderBreadcrumb(dashboard));
        titleGroup.appendChild(createElement("h1", undefined, titleText));
        titleGroup.appendChild(createElement("p", undefined, this.contextSubtitle(subtitleText, dashboard)));
        header.appendChild(titleGroup);

        const cutoff = createElement("div", "evm-portfolio-cutoff");
        cutoff.appendChild(createElement("span", undefined, "Corte"));
        cutoff.appendChild(createElement("strong", undefined, date(dashboard.context.CutoffDate)));
        header.appendChild(cutoff);
        return header;
    }

    private renderBreadcrumb(dashboard: ParsedDashboardData): HTMLElement {
        const breadcrumb = createElement("div", "evm-breadcrumb");
        const pronied = createElement("button", undefined, "PRONIED");
        pronied.type = "button";
        pronied.addEventListener("click", () => this.openProniedDashboard());
        breadcrumb.appendChild(pronied);

        if (dashboard.context.Unit) {
            breadcrumb.appendChild(createElement("span", undefined, ">"));
            const unit = createElement("button", undefined, dashboard.context.Unit);
            unit.type = "button";
            unit.addEventListener("click", () => this.openUnitDashboard(dashboard.context.Unit ?? undefined));
            breadcrumb.appendChild(unit);
        }

        if (dashboard.context.ProjectId) {
            breadcrumb.appendChild(createElement("span", undefined, ">"));
            breadcrumb.appendChild(createElement("strong", undefined, dashboard.project?.NombreIntervencion || dashboard.context.ProjectId));
        }

        return breadcrumb;
    }

    private contextSubtitle(base: string, dashboard: ParsedDashboardData): string {
        const filters = [
            dashboard.context.Region ? `Región: ${dashboard.context.Region}` : "",
            dashboard.context.Province ? `Provincia: ${dashboard.context.Province}` : "",
            dashboard.context.District ? `Distrito: ${dashboard.context.District}` : "",
            dashboard.context.Status ? `Estado: ${dashboard.context.Status}` : ""
        ].filter((item) => item.length > 0);
        return filters.length ? `${base} · ${filters.join(" · ")}` : base;
    }

    private renderSummaryGrid(summary: SummaryData | null): HTMLElement {
        const grid = createElement("section", "evm-summary-strip");
        const items: Array<{ label: string; value: string }> = [
            { label: "Cantidad de Proyectos", value: this.formatInteger(summary?.CantidadProyectos) },
            { label: "BAC", value: shortCurrency(summary?.BAC) },
            { label: "PV", value: shortCurrency(summary?.PV) },
            { label: "EV", value: shortCurrency(summary?.EV) },
            { label: "AC", value: shortCurrency(summary?.AC) },
            { label: "CPI", value: decimal(summary?.CPI) },
            { label: "SPI", value: decimal(summary?.SPIW) },
            { label: "TCPI", value: decimal(summary?.TCPI) }
        ];

        items.forEach((item) => {
            const card = createElement("div", "evm-summary-card evm-card");
            card.appendChild(createElement("span", undefined, item.label));
            card.appendChild(createElement("strong", undefined, item.value));
            grid.appendChild(card);
        });
        return grid;
    }

    private renderPortfolioInsight(summary: SummaryData | null, count: number, label: string): HTMLElement {
        const card = createElement("aside", "evm-card evm-portfolio-insight");
        card.appendChild(createElement("span", undefined, "Resumen ejecutivo"));
        card.appendChild(createElement("strong", undefined, `${this.formatInteger(count)} ${label}`));
        card.appendChild(this.insightMetric("BAC", currency(summary?.BAC)));
        card.appendChild(this.insightMetric("EV", currency(summary?.EV)));
        card.appendChild(this.insightMetric("AC", currency(summary?.AC)));
        card.appendChild(this.insightMetric("CPI", decimal(summary?.CPI)));
        card.appendChild(this.insightMetric("SPI", decimal(summary?.SPIW)));
        return card;
    }

    private insightMetric(label: string, value: string): HTMLElement {
        const row = createElement("div", "evm-insight-metric");
        row.appendChild(createElement("span", undefined, label));
        row.appendChild(createElement("b", undefined, value));
        return row;
    }

    private portfolioHeaderData(title: string, dashboard: ParsedDashboardData): ProjectHeader {
        return {
            NombreIntervencion: title,
            UnidadGerencial: dashboard.context.Unit ?? "PRONIED",
            CUI: "",
            Region: dashboard.context.Region ?? "",
            Provincia: dashboard.context.Province ?? "",
            Distrito: dashboard.context.District ?? "",
            EstadoProyecto: dashboard.summary?.Estado ?? "",
            MensajeEjecutivo: dashboard.summary?.Mensaje ?? "",
            FechaEstado: dashboard.context.CutoffDate,
            SemanaActual: dashboard.summary?.SPIT ?? dashboard.summary?.SPIW ?? null
        };
    }

    private unitMatrixPageActive = false;
    private activateUnitPage: ((index: number) => void) | null = null;

    private renderPortfolioBody(curve: RenderCurveData, sidePanel: HTMLElement, unitName: string, projects: UnitProjectSummaryData[], risks: RiskItem[] = []): HTMLElement {
        const carousel = createElement("section", "evm-body-carousel");
        carousel.classList.add("evm-unit-body-carousel");
        const viewport = createElement("div", "evm-body-carousel-viewport");
        const page = createElement("div", "evm-body-carousel-page evm-body-carousel-page--evm active");
        const left = createElement("div", "evm-left-column");
        const right = createElement("div", "evm-right-column");

            const curveCard = renderCurve(curve, palette, {
                portfolio: true,
                unit: true,
                showYearBracket: true,
                visibleWeeksBack: numberValue(curve.references.Finalizado) === 1 ? 20 : 6
            }, this.viewLifecycle);
        curveCard.classList.add("evm-portfolio-curve-card");
        const curveTitle = curveCard.querySelector(".evm-section-title");
        if (curveTitle instanceof HTMLElement) {
            curveTitle.textContent = `CURVA S - ${unitName}`;
            curveTitle.insertAdjacentElement("afterend", this.renderPortfolioCurveLegend());
        }
        left.appendChild(curveCard);
        right.appendChild(sidePanel);
        page.appendChild(left);
        page.appendChild(right);
        viewport.appendChild(page);
        const matrixPage = createElement("div", "evm-body-carousel-page evm-unit-matrix-page");
        let matrixMounted = false;
        viewport.appendChild(matrixPage);
        const activate = (index: number): void => {
            this.unitMatrixPageActive = index === 1;
            carousel.closest(".evm-main--unit")?.classList.toggle("evm-main--unit-matrix", this.unitMatrixPageActive);
            if (index === 1 && !matrixMounted) {
                matrixPage.appendChild(this.renderUnitProjectsMatrix(projects, this.selectedUnitWeek));
                if (risks.length) {
                    matrixPage.appendChild(this.renderPortfolioRiskSection(risks, "unit"));
                }
                matrixMounted = true;
            }
            [page, matrixPage].forEach((item, itemIndex) => {
                item.classList.toggle("active", itemIndex === index);
                item.setAttribute("aria-hidden", String(itemIndex !== index));
                item.setAttribute("role", "region");
                item.setAttribute("aria-label", itemIndex === 0 ? "Resumen" : "Matriz EVM");
            });
            this.rootElement?.querySelectorAll<HTMLElement>('.evm-project-subtab[data-carousel-scope="unit"]').forEach((tab) => {
                tab.classList.toggle("active", tab.dataset.projectView === (index === 0 ? "summary" : "matrix"));
            });
            carousel.querySelectorAll<HTMLElement>(".evm-carousel-button").forEach((button) => {
                const label = index === 0 ? "Ver matriz de proyectos de la unidad" : "Volver al resumen de la unidad";
                button.setAttribute("aria-label", label);
                button.setAttribute("title", label);
                button.dataset.tooltip = label;
            });
        };
        carousel.appendChild(viewport);
        (["prev", "next"] as const).forEach((direction) => {
            const arrow = createElement("button", `evm-carousel-button evm-carousel-button--${direction}`, direction === "prev" ? "‹" : "›");
            arrow.type = "button";
            arrow.addEventListener("click", () => activate(this.unitMatrixPageActive ? 0 : 1));
            carousel.appendChild(arrow);
        });
        this.activateUnitPage = activate;
        activate(this.unitMatrixPageActive ? 1 : 0);
        return carousel;
    }

    private renderUnitProjectsMatrix(projects: UnitProjectSummaryData[], selectedWeek: number | null = null): HTMLElement {
        const card = createElement("section", "evm-card evm-project-curve-matrix-card evm-unit-projects-matrix-card");
        card.appendChild(createElement("div", "evm-section-title", "MATRIZ DE EVM - PROYECTOS DE LA UNIDAD"));
        const rows = this.unitProjectRowsForWeek(projects, selectedWeek);
        if (!rows.length) {
            card.appendChild(createElement("div", "evm-empty", "No se recibieron proyectos de la unidad."));
            return card;
        }
        const groups = [
            { fields: ["CUI", "Proyecto", "BAC", "SAC", "AT", "PV", "AC", "EV", "CV", "CPI", "SV", "SPI (w)", "EAC (c)", "ETC (c)", "TCPI", "VAC (c)"] }
        ];
        const aliases: Record<string, string[]> = {
            CUI: ["Cui", "CUI"], Proyecto: ["NombreIntervencion", "Proyecto"],
            "SPI (w)": ["SPI (w)", "SPIW"],
            SV: ["SV", "SV (w)"],
            "VAC (c)": ["VAC (c)", "VACC"],
            "EAC (c)": ["EAC (c)", "EACC"],
            "ETC (c)": ["ETC (c)", "ETCC"]
        };
        const moneyFields = new Set(["BAC", "PV", "EV", "AC", "CV", "SV", "VAC (c)", "EAC (c)", "ETC (c)"]);
        const wrap = createElement("div", "evm-project-curve-matrix-wrap");
        const table = createElement("table", "evm-project-curve-matrix evm-unit-projects-matrix");
        const head = document.createElement("thead");
        const fieldRow = document.createElement("tr");
        const decorate = (cell: HTMLElement, field: string): void => {
            if (field === "Proyecto") cell.classList.add("evm-unit-matrix-project-name");
        };
        groups.forEach((group) => {
            group.fields.forEach((field) => {
                const th = createElement("th", undefined, field);
                th.scope = "col";
                decorate(th, field);
                fieldRow.appendChild(th);
            });
        });
        head.appendChild(fieldRow);
        table.appendChild(head);
        const body = document.createElement("tbody");
        rows.forEach((project) => {
            const row = document.createElement("tr");
            groups.forEach((group) => group.fields.forEach((field) => {
                const keys = aliases[field] ?? [field, field.replace(/\s|[()]/g, "").toUpperCase()];
                const raw = keys.map((key) => project[key]).find((value) => value !== null && value !== undefined && value !== "");
                const numeric = numberValue(raw as DataValue);
                const formatted = raw === undefined ? "—" : ["CUI", "Proyecto"].includes(field)
                    ? String(raw) : numeric === null ? "—" : moneyFields.has(field)
                        ? `S/ ${Math.round(numeric).toLocaleString("en-US")}`
                        : numeric.toLocaleString("en-US", { minimumFractionDigits: field === "SAC" || field === "AT" ? 0 : 2, maximumFractionDigits: 2 });
                const cell = createElement("td", undefined, formatted);
                cell.title = `${field}: ${formatted}`;
                decorate(cell, field);
                row.appendChild(cell);
            }));
            body.appendChild(row);
        });
        table.appendChild(body);
        wrap.appendChild(table);
        card.appendChild(wrap);
        return card;
    }

    private unitProjectRowsForWeek(projects: UnitProjectSummaryData[], selectedWeek: number | null): UnitProjectSummaryData[] {
        if (selectedWeek === null || !projects.some((project) => numberValue(project.Semana) !== null)) {
            return projects;
        }
        const filtered = projects.filter((project) => numberValue(project.Semana) === selectedWeek);
        return filtered.length ? filtered : projects;
    }

    private renderUnitsPanel(units: UnitSummaryData[]): HTMLElement {
        const panel = createElement("section", "evm-card evm-performance-card evm-portfolio-side-panel");
        panel.appendChild(createElement("div", "evm-section-title", "Lista de Unidades"));
        if (!units.length) {
            panel.appendChild(createElement("div", "evm-empty", "No se encontraron unidades para los filtros seleccionados."));
            return panel;
        }

        units.slice(0, 12).forEach((unit) => {
            const item = createElement("button", "evm-portfolio-side-item");
            item.type = "button";
            item.addEventListener("click", () => this.openUnitDashboard(unit.UnidadGerencial));
            item.appendChild(createElement("strong", undefined, unit.UnidadGerencial));
            item.appendChild(createElement("span", undefined, `${this.formatInteger(unit.CantidadProyectos)} proyectos | CPI ${decimal(unit.CPI)} | SPI ${decimal(unit.SPIW)}`));
            panel.appendChild(item);
        });
        return panel;
    }

    private renderPortfolioSummary(summary: PortfolioSummaryData | null): HTMLElement {
        const panel = createElement("section", "evm-card evm-performance-card evm-portfolio-summary");
        panel.appendChild(createElement("div", "evm-section-title", "Resumen General"));
        if (!summary) {
            panel.appendChild(createElement("div", "evm-empty", "No se encontraron datos del resumen general."));
            return panel;
        }

        const grid = createElement("div", "evm-portfolio-summary-grid");
        grid.appendChild(this.portfolioCompositeCard(
            "building",
            this.formatInteger(summary.ProyectosActivos),
            "Proyectos Activos",
            [
                [this.formatInteger(summary.CantidadProyectos), "Proyectos"],
                [this.formatInteger(summary.CantidadIntervenciones), "Intervenciones"]
            ]
        ));
        grid.appendChild(this.portfolioCompositeCard(
            "budget",
            shortCurrency(summary.PresupuestoInstitucional),
            "Presupuesto Institucional",
            [
                [shortCurrency(summary.PresupuestoProyectos), "Proyectos"],
                [shortCurrency(summary.PresupuestoIntervenciones), "Intervenciones"]
            ]
        ));
        grid.appendChild(this.portfolioMetricCard("schedule", this.signedPortfolioPercent(summary.DesviacionPlazoPct), "Desviación del Portafolio", "(Plazo)"));
        grid.appendChild(this.portfolioMetricCard("cost", this.signedPortfolioPercent(summary.DesviacionCostoPct), "Desviación del Portafolio", "(Costo)"));
        const bottom = createElement("div", "evm-portfolio-summary-bottom");
        bottom.appendChild(this.portfolioMetricCard("critical", this.formatInteger(summary.IntervencionesCriticas), "Intervenciones Críticas"));
        bottom.appendChild(this.portfolioMetricCard("risk", this.portfolioPercent(summary.RiesgoPortafolioPct), "Riesgo Alto/Alto"));
        grid.appendChild(bottom);
        panel.appendChild(grid);
        return panel;
    }

    private portfolioCompositeCard(
        iconClass: string,
        value: string,
        label: string,
        details: Array<[string, string]>
    ): HTMLElement {
        const card = createElement("article", `evm-portfolio-summary-card evm-portfolio-summary-card--${iconClass}`);
        card.appendChild(this.portfolioIcon(iconClass));
        const main = createElement("div", "evm-portfolio-summary-main");
        main.appendChild(createElement("strong", undefined, value));
        main.appendChild(createElement("span", undefined, label));
        card.appendChild(main);
        const detail = createElement("div", "evm-portfolio-summary-detail");
        details.forEach(([detailValue, detailLabel]) => {
            const row = createElement("div");
            row.appendChild(createElement("b", undefined, detailValue));
            row.appendChild(createElement("span", undefined, detailLabel));
            detail.appendChild(row);
        });
        card.appendChild(detail);
        return card;
    }

    private portfolioMetricCard(iconClass: string, value: string, label: string, note?: string): HTMLElement {
        const card = createElement("article", `evm-portfolio-summary-card evm-portfolio-summary-card--${iconClass}`);
        card.appendChild(this.portfolioIcon(iconClass));
        const main = createElement("div", "evm-portfolio-summary-main");
        main.appendChild(createElement("strong", undefined, value));
        main.appendChild(createElement("span", undefined, label));
        if (note) {
            main.appendChild(createElement("small", undefined, note));
        }
        card.appendChild(main);
        return card;
    }

    private portfolioIcon(iconClass: string): SVGSVGElement {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 64 64");
        svg.setAttribute("aria-hidden", "true");
        svg.classList.add("evm-portfolio-summary-icon");
        const path = (d: string): void => {
            const node = document.createElementNS("http://www.w3.org/2000/svg", "path");
            node.setAttribute("d", d);
            svg.appendChild(node);
        };
        const line = (x1: number, y1: number, x2: number, y2: number): void => {
            const node = document.createElementNS("http://www.w3.org/2000/svg", "line");
            node.setAttribute("x1", String(x1));
            node.setAttribute("y1", String(y1));
            node.setAttribute("x2", String(x2));
            node.setAttribute("y2", String(y2));
            svg.appendChild(node);
        };

        if (iconClass === "building") {
            path("M9 54V27h14v27M23 54V12h19v42M42 54V25h13v29M5 54h54");
            path("M29 20h4v4h-4zM36 20h4v4h-4zM29 29h4v4h-4zM36 29h4v4h-4zM29 38h4v4h-4zM36 38h4v4h-4zM14 34h4v4h-4zM14 43h4v4h-4zM47 33h4v4h-4zM47 42h4v4h-4z");
        } else if (iconClass === "budget") {
            path("M21 16c5-5 17-5 22 0l-4 6H25zM25 22c-8 8-12 15-12 24 0 9 8 14 19 14s19-5 19-14c0-9-4-16-12-24");
            path("M36 34c-1-2-7-2-8 1-1 4 9 3 8 8-1 4-8 3-9 1M32 30v18");
        } else if (iconClass === "schedule") {
            path("M11 16h35v34H11zM11 25h35M18 10v12M38 10v12");
            path("M18 32h4v4h-4zM27 32h4v4h-4zM18 41h4v4h-4zM27 41h4v4h-4z");
            path("M40 37a13 13 0 1 0 0 26 13 13 0 0 0 0-26M40 43v8l5 3");
        } else if (iconClass === "cost") {
            path("M14 23a12 12 0 1 0 24 0 12 12 0 0 0-24 0M29 17c-1-2-7-2-8 1-1 4 9 3 8 8-1 4-8 3-9 1M25 13v20");
            path("M14 55l12-12 8 7 17-19M43 31h8v8");
        } else if (iconClass === "critical") {
            path("M20 13h24v43H12V13h8M24 9h16v9H24z");
            path("M19 29l2 2 4-5M19 39l2 2 4-5M19 49l2 2 4-5M30 29h9M30 39h9M30 49h9");
        } else {
            path("M32 8 57 55H7z");
            line(32, 23, 32, 41);
            line(32, 48, 32, 49);
        }
        return svg;
    }

    private signedPortfolioPercent(value: DataValue): string {
        const parsed = numberValue(value);
        if (parsed === null) {
            return "—";
        }
        const normalized = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
        const sign = normalized > 0 ? "+" : "";
        return `${sign}${normalized.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
    }

    private portfolioPercent(value: DataValue): string {
        const parsed = numberValue(value);
        if (parsed === null) {
            return "—";
        }
        const normalized = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
        return `${normalized.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
    }

    private renderProjectsPanel(projects: UnitProjectSummaryData[]): HTMLElement {
        const panel = createElement("section", "evm-card evm-performance-card evm-portfolio-side-panel");
        panel.appendChild(createElement("div", "evm-section-title", "Lista de Proyectos"));
        if (!projects.length) {
            panel.appendChild(createElement("div", "evm-empty", "No se encontraron proyectos para la Unidad y filtros seleccionados."));
            return panel;
        }

        projects.slice(0, 12).forEach((project) => {
            const item = createElement("button", "evm-portfolio-side-item");
            item.type = "button";
            item.addEventListener("click", (event) => this.handleProjectClick(event, project));
            item.appendChild(createElement("strong", undefined, project.NombreIntervencion));
            item.appendChild(createElement("span", undefined, `${project.IdIntervencion} | CPI ${decimal(project.CPI)} | SPI ${decimal(project.SPIW)}`));
            panel.appendChild(item);
        });
        return panel;
    }

    private renderPortfolioGaugeSection(dashboard: ParsedDashboardData, selectedWeek: number | null = null): HTMLElement {
        const rows = this.windowAggregateGaugeRows(dashboard, selectedWeek);
        const gauges = this.buildAggregateGauges(rows);
        if (!gauges.length) {
            const empty = createElement("section", "evm-card evm-portfolio-empty-section");
            empty.appendChild(createElement("div", "evm-section-title", "Desempeno consolidado"));
            empty.appendChild(createElement("div", "evm-empty", "No hay indicadores de desempeno disponibles para los filtros seleccionados."));
            return empty;
        }

        return renderGaugeGrid(gauges, palette, (key) => this.openGaugeHistoryModal(key), this.viewLifecycle);
    }

    private windowAggregateGaugeRows(dashboard: ParsedDashboardData, selectedWeek: number | null = null): AggregateGaugeData[] {
        const orderedRows = dashboard.aggregateGauges;
        const curve = this.buildAggregateRenderCurve(dashboard, selectedWeek);
        const currentWeek = numberValue(curve.current.SemanaProyecto);
        if (currentWeek === null) {
            return orderedRows;
        }

        const historyStartWeek = Math.max(0, currentWeek - 5);
        const filtered = orderedRows.filter((row) => row.OrdenSemana >= historyStartWeek && row.OrdenSemana <= currentWeek);
        return filtered.length ? filtered : orderedRows;
    }

    private buildAggregateGauges(rows: AggregateGaugeData[]): GaugeData[] {
        const definitions: Array<{ key: GaugeData["key"]; title: string; selector: (row: AggregateGaugeData) => number | null }> = [
            { key: "CPI", title: "CPI", selector: (row) => row.CPI },
            { key: "SPIW", title: "SPI (w)", selector: (row) => row.SPIW },
            { key: "TCPI", title: "TCPI", selector: (row) => row.TCPI },
            { key: "TSPIW", title: "TSPI (w)", selector: (row) => row.TSPIW ?? numberValue(row["TSPI (w)"] as DataValue) ?? numberValue(row.TSPI as DataValue) }
        ];
        const orderedRows = rows;

        return definitions.map((definition) => {
            const sparkline = orderedRows.map(definition.selector).filter((value): value is number => value !== null);
            const value = sparkline[sparkline.length - 1] ?? null;
            return {
                key: definition.key,
                title: definition.title,
                value,
                min: 0,
                max: 1.5,
                target: 1,
                variation: this.deltaFromHistory(sparkline),
                status: this.aggregateGaugeStatus(definition.key, value),
                sparkline
            };
        });
    }

    private deltaFromHistory(values: number[]): number | null {
        return values.length >= 2 ? values[values.length - 1] - values[values.length - 2] : null;
    }

    private aggregateGaugeStatus(key: GaugeData["key"], value: number | null): string {
        if (value === null) {
            return "Sin dato";
        }
        if (key === "CPI" || key === "SPIW") {
            if (value < 0.9) {
                return "Critico";
            }
            if (value < 1) {
                return "En riesgo";
            }
            if (value < 1.2) {
                return "Estable";
            }
            return "Sobredimensionado";
        }
        if (value <= 1) {
            return "Estable";
        }
        if (value <= 1.1) {
            return "En riesgo";
        }
        return "Critico";
    }

    private buildAggregateRenderCurve(dashboard: ParsedDashboardData, selectedWeek: number | null = null): RenderCurveData {
        const orderedRows = dashboard.aggregateCurve;
        const terminalWeek = dashboard.context.Level === "UNIDAD" ? this.unitTerminalWeek(orderedRows) : null;
        const curveRows = terminalWeek === null
            ? orderedRows
            : orderedRows.filter((row) => row.OrdenSemana <= terminalWeek);
        const history: CurveHistoryPoint[] = curveRows.map((row) => ({
            SemanaProyecto: row.OrdenSemana,
            PV: row.PV,
            EV: selectedWeek === null || row.OrdenSemana <= selectedWeek ? row.EV : null,
            AC: selectedWeek === null || row.OrdenSemana <= selectedWeek ? row.AC : null
        }));
        const selectedRow = selectedWeek === null ? null : curveRows.find((row) => row.OrdenSemana === selectedWeek) ?? null;
        const at = selectedWeek ?? this.lastAggregateValue(orderedRows, (row) => row.AT);
        const eacCostAt = this.aggregateValueAtWeek(orderedRows, at, (row) => row.EACC);
        const eacTimeAt = this.aggregateValueAtWeek(orderedRows, at, (row) => row.EACT);
        const vacCostAt = this.aggregateValueAtWeek(orderedRows, at, (row) => row.VACC);
        const vacTimeAt = this.aggregateValueAtWeek(orderedRows, at, (row) => row.VACT);
        const isUnitFinalWeek = dashboard.context.Level === "UNIDAD"
            && terminalWeek !== null
            && at !== null
            && Math.abs(at - terminalWeek) < 0.000001;
        const references: CurveReferences = {
            BAC: this.lastAggregateValue(orderedRows, (row) => row.BAC),
            SAC: terminalWeek ?? this.lastAggregateValue(orderedRows, (row) => row.SAC),
            AT: at,
            ES: selectedRow?.ES ?? this.lastAggregateValue(orderedRows, (row) => row.ES),
            EACC: eacCostAt,
            EACT: eacTimeAt,
            VACC: vacCostAt,
            VACT: vacTimeAt,
            Finalizado: isUnitFinalWeek ? 1 : null,
            SPIT: selectedRow === null
                ? this.lastAggregateValue(orderedRows, (row) => numberValue(row["SPI (t)"] as DataValue) ?? numberValue(row.SPIT as DataValue))
                : numberValue(selectedRow["SPI (t)"] as DataValue) ?? numberValue(selectedRow.SPIT as DataValue),
            TSPIT: selectedRow?.TSPIT ?? this.lastAggregateValue(orderedRows, (row) => row.TSPIT),
            FechaEstado: dashboard.context.CutoffDate
        };
        const current = this.currentAggregateCurvePoint(orderedRows, references, dashboard.context.CutoffDate);

        return {
            history,
            current,
            references
        };
    }

    private currentAggregateCurvePoint(rows: AggregateCurveData[], references: CurveReferences, cutoffDate: DataValue): CurveHistoryPoint {
        const at = numberValue(references.AT);
        const atRow = at === null ? null : rows.find((row) => row.OrdenSemana === at);
        const cutoffRow = atRow ?? this.findAggregateRowByCutoffDate(rows, cutoffDate);
        const fallbackRow = cutoffRow ?? [...rows].reverse().find((row) => row.PV !== null || row.EV !== null || row.AC !== null) ?? rows[rows.length - 1];

        if (!fallbackRow) {
            return {};
        }

        return {
            SemanaProyecto: fallbackRow.OrdenSemana,
            PV: fallbackRow.PV,
            EV: fallbackRow.EV,
            AC: fallbackRow.AC
        };
    }

    private findAggregateRowByCutoffDate(rows: AggregateCurveData[], cutoffDate: DataValue): AggregateCurveData | null {
        if (!cutoffDate) {
            return null;
        }
        const cutoffTime = new Date(cutoffDate as string).getTime();
        if (!Number.isFinite(cutoffTime)) {
            return null;
        }
        return rows.find((row) => {
            const start = row.FechaInicioSemana ? new Date(row.FechaInicioSemana).getTime() : NaN;
            const end = row.FechaFinSemana ? new Date(row.FechaFinSemana).getTime() : NaN;
            return Number.isFinite(start) && Number.isFinite(end) && cutoffTime >= start && cutoffTime <= end;
        }) ?? null;
    }

    private lastAggregateValue(rows: AggregateCurveData[], accessor: (row: AggregateCurveData) => number | null): number | null {
        for (let index = rows.length - 1; index >= 0; index--) {
            const value = accessor(rows[index]);
            if (value !== null && Number.isFinite(value)) {
                return value;
            }
        }
        return null;
    }

    private unitsAtWeek(units: UnitSummaryData[], at: number | null): UnitSummaryData[] {
        if (at === null || !units.some((unit) => unit.Semana !== null)) {
            return units;
        }
        const rowsAt = units.filter((unit) => unit.Semana !== null && Math.abs(unit.Semana - at) < 0.000001);
        if (!rowsAt.length) {
            return units;
        }

        const grouped = new Map<string, UnitSummaryData>();
        rowsAt.forEach((unit) => {
            const key = unit.UnidadGerencial.trim().toLowerCase();
            const existing = grouped.get(key);
            if (!existing) {
                grouped.set(key, { ...unit });
                return;
            }
            const merged = { ...existing } as UnitSummaryData;
            Object.entries(unit).forEach(([field, value]) => {
                if ((merged[field] === null || merged[field] === undefined || merged[field] === "") && value !== null && value !== undefined && value !== "") {
                    merged[field] = value;
                }
            });
            grouped.set(key, merged);
        });
        return [...grouped.values()];
    }

    private aggregateValueAtWeek(rows: AggregateCurveData[], week: number | null, accessor: (row: AggregateCurveData) => number | null): number | null {
        if (week === null) {
            return null;
        }
        const values = rows
            .filter((row) => Math.abs(row.OrdenSemana - week) < 0.000001)
            .map(accessor)
            .filter((value): value is number => value !== null && Number.isFinite(value));
        return values.find((value) => Math.abs(value) >= 0.000001) ?? values[0] ?? null;
    }

    private renderAggregateCurve(curve: AggregateCurveData[]): HTMLElement {
        const card = createElement("section", "evm-card evm-curve-card evm-aggregate-curve-card");
        card.appendChild(createElement("div", "evm-section-title", "Curva S - Desempeno Consolidado (EVM)"));
        if (!curve.length) {
            card.appendChild(createElement("div", "evm-empty", "Sin datos de curva agregada."));
            return card;
        }

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 920 360");
        svg.setAttribute("class", "evm-aggregate-curve-svg");
        this.drawAggregateCurveSvg(svg, curve);
        card.appendChild(svg);
        return card;
    }

    private drawAggregateCurveSvg(svg: SVGSVGElement, curve: AggregateCurveData[]): void {
        const plot = { left: 76, top: 34, width: 790, height: 250 };
        const values = curve.flatMap((row) => [row.BAC, row.PV, row.EV, row.AC]).filter((value): value is number => value !== null);
        const maxValue = Math.max(1, ...values) * 1.08;
        const xScale = (index: number): number => plot.left + (curve.length <= 1 ? 0 : (index / (curve.length - 1)) * plot.width);
        const yScale = (value: number): number => plot.top + plot.height - (value / maxValue) * plot.height;

        for (let i = 0; i <= 4; i++) {
            const y = plot.top + (plot.height / 4) * i;
            this.appendSvgLine(svg, plot.left, y, plot.left + plot.width, y, "evm-aggregate-grid");
        }
        this.appendSvgLine(svg, plot.left, plot.top, plot.left, plot.top + plot.height, "evm-aggregate-axis");
        this.appendSvgLine(svg, plot.left, plot.top + plot.height, plot.left + plot.width, plot.top + plot.height, "evm-aggregate-axis");

        [
            { key: "PV", color: "#2563EB" },
            { key: "EV", color: "#16A34A" },
            { key: "AC", color: "#FF1E1E" },
            { key: "BAC", color: "#001B8E" }
        ].forEach((series) => {
            const points = curve
                .map((row, index) => ({ x: xScale(index), value: row[series.key as keyof AggregateCurveData] }))
                .filter((point): point is { x: number; value: number } => typeof point.value === "number");
            if (!points.length) {
                return;
            }
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${yScale(point.value)}`).join(" "));
            path.setAttribute("class", "evm-aggregate-line");
            path.setAttribute("stroke", series.color);
            svg.appendChild(path);
            points.forEach((point) => {
                const marker = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                marker.setAttribute("cx", String(point.x));
                marker.setAttribute("cy", String(yScale(point.value)));
                marker.setAttribute("r", "4.5");
                marker.setAttribute("fill", series.color);
                svg.appendChild(marker);
            });
        });

        curve.forEach((row, index) => {
            const x = xScale(index);
            this.appendSvgText(svg, row.LabelSemana || String(row.OrdenSemana), x, plot.top + plot.height + 34, "middle", "evm-aggregate-label");
        });
        this.appendSvgText(svg, "Periodo", plot.left + plot.width / 2, 344, "middle", "evm-aggregate-title");
    }

    private renderUnitsSection(units: UnitSummaryData[]): HTMLElement {
        const section = createElement("section", "evm-card evm-entity-section");
        section.appendChild(createElement("div", "evm-section-title", "Unidades Gerenciales"));
        if (!units.length) {
            section.appendChild(createElement("div", "evm-empty", "No se encontraron unidades para los filtros seleccionados."));
            return section;
        }

        const grid = createElement("div", "evm-unit-grid");
        units.forEach((unit) => {
            const card = createElement("button", "evm-unit-card evm-card");
            card.type = "button";
            card.setAttribute("role", "button");
            card.setAttribute("tabindex", "0");
            card.addEventListener("click", () => {
                this.openUnitDashboard(unit.UnidadGerencial);
            });
            card.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    this.openUnitDashboard(unit.UnidadGerencial);
                }
            });
            card.appendChild(createElement("strong", undefined, unit.UnidadGerencial));
            card.appendChild(createElement("span", undefined, `${this.formatInteger(unit.CantidadProyectos)} proyectos`));
            card.appendChild(this.entityMetric("BAC", shortCurrency(unit.BAC)));
            card.appendChild(this.entityMetric("EV", shortCurrency(unit.EV)));
            card.appendChild(this.entityMetric("AC", shortCurrency(unit.AC)));
            card.appendChild(this.entityMetric("CPI", decimal(unit.CPI)));
            card.appendChild(this.entityMetric("SPI", decimal(unit.SPIW)));
            grid.appendChild(card);
        });
        section.appendChild(grid);
        return section;
    }

    private renderProjectsSection(projects: UnitProjectSummaryData[]): HTMLElement {
        const section = createElement("section", "evm-card evm-entity-section");
        section.appendChild(createElement("div", "evm-section-title", "Proyectos de la Unidad"));
        if (!projects.length) {
            section.appendChild(createElement("div", "evm-empty", "No se encontraron proyectos para la Unidad y filtros seleccionados."));
            return section;
        }

        const table = createElement("table", "evm-project-list-table");
        const head = document.createElement("thead");
        const headRow = document.createElement("tr");
        ["Proyecto", "CUI", "Ubicación", "Estado", "BAC", "EV", "AC", "CPI", "SPI", ""].forEach((label) => headRow.appendChild(createElement("th", undefined, label)));
        head.appendChild(headRow);
        const body = document.createElement("tbody");
        projects.slice(0, 100).forEach((project) => {
            const row = document.createElement("tr");
            row.className = "evm-project-list-row";
            row.tabIndex = 0;
            row.setAttribute("role", "button");
            row.addEventListener("click", (event) => this.handleProjectClick(event, project));
            row.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    this.handleProjectClick(event, project);
                }
            });
            row.appendChild(createElement("td", "evm-project-name-cell", project.NombreIntervencion));
            row.appendChild(createElement("td", undefined, text(project.Cui)));
            row.appendChild(createElement("td", undefined, [project.Region, project.Provincia, project.Distrito].filter(Boolean).join(" / ")));
            row.appendChild(createElement("td", undefined, text(project.EstadoProyecto)));
            row.appendChild(createElement("td", undefined, shortCurrency(project.BAC)));
            row.appendChild(createElement("td", undefined, shortCurrency(project.EV)));
            row.appendChild(createElement("td", undefined, shortCurrency(project.AC)));
            row.appendChild(createElement("td", undefined, decimal(project.CPI)));
            row.appendChild(createElement("td", undefined, decimal(project.SPIW)));
            const actionCell = createElement("td");
            const action = createElement("button", "evm-row-action", "Ver proyecto");
            action.type = "button";
            action.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.handleProjectClick(event, project);
            });
            actionCell.appendChild(action);
            row.appendChild(actionCell);
            body.appendChild(row);
        });
        table.appendChild(head);
        table.appendChild(body);
        section.appendChild(table);
        return section;
    }

    private entityMetric(label: string, value: string): HTMLElement {
        const metric = createElement("div", "evm-entity-metric");
        metric.appendChild(createElement("span", undefined, label));
        metric.appendChild(createElement("b", undefined, value));
        return metric;
    }

    private renderBodyCarousel(dashboard: DashboardData, curveRows: CurveData[]): HTMLElement {
        const carousel = document.createElement("section");
        carousel.className = "evm-body-carousel";

        const viewport = document.createElement("div");
        viewport.className = "evm-body-carousel-viewport";

        const evmPage = this.createLazyCarouselPage("evm-body-carousel-page evm-body-carousel-page--evm", this.projectCarouselIndex === 0, (page) => {
            const evmLeft = createElement("div", "evm-left-column");
            const curveCard = renderCurve(dashboard.curve, palette, {}, this.viewLifecycle);
            evmLeft.appendChild(curveCard);
            const evmRight = createElement("div", "evm-right-column");
            evmRight.appendChild(renderPerformance(dashboard.performance));
            page.append(evmLeft, evmRight);
            this.attachProjectCurveExpansion(page, curveCard, evmRight);
        });

        const riskPage = this.createLazyCarouselPage("evm-body-carousel-page evm-body-carousel-page--risk", this.projectCarouselIndex === 1, (page) => {
            page.appendChild(this.renderProjectCurveMatrix(curveRows));
            const lowerRow = createElement("div", "evm-project-details-lower-row");
            lowerRow.appendChild(renderRisks(dashboard.risks));
            lowerRow.appendChild(renderMilestones(dashboard.milestones));
            page.appendChild(lowerRow);
        });

        const pages = [evmPage, riskPage];
        pages.forEach((page, index) => {
            page.classList.toggle("active", index === this.projectCarouselIndex);
            page.setAttribute("aria-hidden", index === this.projectCarouselIndex ? "false" : "true");
            viewport.appendChild(page);
        });

        const previous = this.renderCarouselButton("prev", "‹", "Ver pantalla anterior", pages);
        const next = this.renderCarouselButton("next", "›", "Ver pantalla siguiente", pages);

        carousel.appendChild(viewport);
        carousel.appendChild(previous);
        carousel.appendChild(next);
        this.updateCarouselButtons(carousel);
        return carousel;
    }

    private attachProjectCurveExpansion(page: HTMLElement, curveCard: HTMLElement, performance: HTMLElement): void {
        curveCard.classList.add("evm-curve-card--expandable");
        const edge = createElement("div", "evm-curve-expand-edge");
        const button = createElement("button", "evm-curve-expand-button");
        button.type = "button";
        const sync = (): void => {
            const expanded = this.projectCurveExpanded;
            page.classList.toggle("evm-body-carousel-page--curve-expanded", expanded);
            performance.hidden = expanded;
            performance.setAttribute("aria-hidden", String(expanded));
            button.setAttribute("aria-expanded", String(expanded));
            button.setAttribute("aria-label", expanded ? "Contraer Curva S" : "Expandir Curva S a todo el ancho");
            button.title = expanded ? "Contraer Curva S" : "Expandir Curva S";
            button.textContent = expanded ? "↤" : "↦";
        };
        button.addEventListener("click", (event) => {
            event.stopPropagation();
            this.projectCurveExpanded = !this.projectCurveExpanded;
            sync();
        });
        page.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && this.projectCurveExpanded) {
                event.preventDefault();
                event.stopPropagation();
                this.projectCurveExpanded = false;
                sync();
                button.focus();
            }
        });
        edge.appendChild(button);
        curveCard.appendChild(edge);
        sync();
    }

    private renderProjectCurveMatrix(curveRows: CurveData[]): HTMLElement {
        const card = createElement("section", "evm-card evm-project-curve-matrix-card");
        type MatrixField = { key: keyof CurveData; label: string; title: string; kind: "week" | "money" | "index" | "time" | "date" };
        const weekField: MatrixField = { key: "Semana", label: "SEMANA", title: "Semana del proyecto", kind: "week" };
        const groups: Array<{ name: string; className: string; fields: MatrixField[] }> = [
            {
                name: "LÍNEA BASE",
                className: "base",
                fields: [
                    { key: "BAC", label: "BAC", title: "Presupuesto a la conclusión", kind: "money" },
                    { key: "SAC", label: "SAC", title: "Duración planificada", kind: "time" }
                ]
            },
            {
                name: "ESTADO ACTUAL",
                className: "current",
                fields: [
                    { key: "ES", label: "ES", title: "Cronograma ganado", kind: "time" },
                    { key: "AT", label: "AT", title: "Tiempo actual", kind: "time" },
                    { key: "PV", label: "PV", title: "Valor planificado", kind: "money" },
                    { key: "EV", label: "EV", title: "Valor ganado", kind: "money" },
                    { key: "AC", label: "AC", title: "Costo actual", kind: "money" },
                    { key: "CV", label: "CV", title: "Variación del costo", kind: "money" },
                    { key: "SV (w)", label: "SV (w)", title: "Variación del cronograma por valor", kind: "money" },
                    { key: "SV (t)", label: "SV (t)", title: "Variación del cronograma por tiempo", kind: "time" },
                    { key: "CPI", label: "CPI", title: "Índice de desempeño del costo", kind: "index" },
                    { key: "SPI (w)", label: "SPI (w)", title: "Índice de desempeño del cronograma por valor", kind: "index" },
                    { key: "SPI (w)(*)", label: "SPI (w)(*)", title: "SPI (w) cuando AT es mayor que SAC", kind: "index" },
                    { key: "SPI (t)", label: "SPI (t)", title: "Índice de desempeño del cronograma por tiempo", kind: "index" }
                ]
            },
            {
                name: "PRONÓSTICO",
                className: "forecast",
                fields: [
                    { key: "TCPI", label: "TCPI", title: "Índice de desempeño requerido del costo", kind: "index" },
                    { key: "TCPI Proy", label: "TCPI **", title: "TCPI proyectado", kind: "index" },
                    { key: "TSPI (w)", label: "TSPI (w)", title: "Índice de desempeño requerido del cronograma por valor", kind: "index" },
                    { key: "TSPI (t)", label: "TSPI (t)", title: "Índice de desempeño requerido del cronograma por tiempo", kind: "index" },
                    { key: "TSPI (w) Proy", label: "TSPI (w) ***", title: "TSPI por valor proyectado", kind: "index" },
                    { key: "TSPI (t) Proy", label: "TSPI (t) ***", title: "TSPI por tiempo proyectado", kind: "index" },
                    { key: "VAC (c)", label: "VAC (c)", title: "Variación de costo a la conclusión", kind: "money" },
                    { key: "EAC (c)", label: "EAC (c)", title: "Estimado de costo a la conclusión", kind: "money" },
                    { key: "ETC (c)", label: "ETC (c)", title: "Costo restante estimado", kind: "money" },
                    { key: "VAC (t)", label: "VAC (t)", title: "Variación de tiempo a la conclusión", kind: "time" },
                    { key: "EAC (t)", label: "EAC (t)", title: "Estimado de tiempo a la conclusión", kind: "time" },
                    { key: "ETC (t)", label: "ETC (t)", title: "Tiempo restante estimado", kind: "time" },
                    { key: "IEAC (c)", label: "IEAC (c)", title: "Estimado independiente de costo a la conclusión", kind: "money" },
                    { key: "IEAC (t)", label: "IEAC (t)", title: "Estimado independiente de tiempo a la conclusión", kind: "time" },
                    { key: "IETC", label: "IETC", title: "IETC", kind: "date" }
                ]
            }
        ];
        const allFields = Array.from(
            new Map([weekField, ...groups.flatMap((group) => group.fields)].map((field) => [field.key, field])).values()
        );
        const isColumnVisible = (field: MatrixField): boolean => (
            field.key === "Semana" || this.matrixVisibleColumns === null || this.matrixVisibleColumns.has(field.key)
        );
        const title = createElement("div", "evm-section-title", "MATRIZ DE EVM");
        const heading = createElement("div", "evm-project-curve-matrix-heading");
        heading.appendChild(title);
        const configureButton = document.createElement("button");
        configureButton.type = "button";
        configureButton.className = "evm-project-curve-configure-button evm-project-curve-configure-trigger";
        configureButton.textContent = "Columnas visibles";
        configureButton.addEventListener("click", () => {
            const overlayHost = this.rootElement ?? this.target;
            const existing = overlayHost.querySelector(".evm-project-curve-column-overlay");
            if (existing) {
                existing.remove();
                return;
            }

            const draft = new Set<keyof CurveData>(
                this.matrixVisibleColumns ?? allFields.filter((field) => field.key !== "Semana").map((field) => field.key)
            );
            const overlay = createElement("div", "evm-project-curve-column-overlay");
            const panel = createElement("section", "evm-project-curve-column-panel");
            panel.setAttribute("role", "dialog");
            panel.setAttribute("aria-label", "Configurar columnas de la matriz EVM");

            const panelHeader = createElement("header", "evm-project-curve-column-header");
            panelHeader.appendChild(createElement("strong", undefined, "Configurar columnas"));
            const closeButton = createElement("button", undefined, "×");
            closeButton.setAttribute("aria-label", "Cerrar");
            panelHeader.appendChild(closeButton);
            panel.appendChild(panelHeader);

            const search = document.createElement("input");
            search.type = "search";
            search.className = "evm-project-curve-column-search";
            search.placeholder = "Buscar columnas...";
            panel.appendChild(search);

            const actions = createElement("div", "evm-project-curve-column-actions");
            const selectAll = createElement("button", undefined, "Seleccionar todo");
            const clearSelection = createElement("button", undefined, "Limpiar selección");
            actions.appendChild(selectAll);
            actions.appendChild(clearSelection);
            panel.appendChild(actions);

            const list = createElement("div", "evm-project-curve-column-list");
            panel.appendChild(list);

            const renderOptions = (): void => {
                const query = search.value.trim().toLocaleLowerCase("es");
                list.replaceChildren();
                allFields
                    .filter((field) => !query || field.label.toLocaleLowerCase("es").includes(query))
                    .forEach((field) => {
                        const option = createElement("label", `evm-project-curve-column-option${field.key === "Semana" ? " mandatory" : ""}`);
                        const checkbox = document.createElement("input");
                        checkbox.type = "checkbox";
                        checkbox.checked = field.key === "Semana" || draft.has(field.key);
                        checkbox.disabled = field.key === "Semana";
                        checkbox.addEventListener("change", () => {
                            if (checkbox.checked) {
                                draft.add(field.key);
                            } else {
                                draft.delete(field.key);
                            }
                        });
                        option.appendChild(checkbox);
                        option.appendChild(createElement("span", undefined, field.label));
                        if (field.key === "Semana") {
                            option.appendChild(createElement("small", undefined, "Siempre visible"));
                        }
                        list.appendChild(option);
                    });
            };

            search.addEventListener("input", debounceInput(renderOptions));
            selectAll.addEventListener("click", () => {
                allFields.forEach((field) => {
                    if (field.key !== "Semana") draft.add(field.key);
                });
                renderOptions();
            });
            clearSelection.addEventListener("click", () => {
                draft.clear();
                renderOptions();
            });

            const footer = createElement("footer", "evm-project-curve-column-footer");
            const cancelButton = createElement("button", "secondary", "Cancelar");
            const applyButton = createElement("button", "primary", "Aplicar");
            footer.appendChild(cancelButton);
            footer.appendChild(applyButton);
            panel.appendChild(footer);

            const resizeHandle = createElement("div", "evm-project-curve-column-resize-handle");
            resizeHandle.title = "Arrastrar para cambiar el tamaño";
            resizeHandle.setAttribute("aria-label", "Cambiar tamaño del panel");
            resizeHandle.addEventListener("pointerdown", (event: PointerEvent) => {
                event.preventDefault();
                const startX = event.clientX;
                const startY = event.clientY;
                const startWidth = panel.getBoundingClientRect().width;
                const startHeight = panel.getBoundingClientRect().height;
                resizeHandle.setPointerCapture(event.pointerId);

                const resize = (moveEvent: PointerEvent): void => {
                    const maxWidth = Math.max(340, overlay.clientWidth - 28);
                    const maxHeight = Math.max(300, overlay.clientHeight - 12);
                    const width = Math.min(maxWidth, Math.max(340, startWidth + startX - moveEvent.clientX));
                    const height = Math.min(maxHeight, Math.max(300, startHeight + moveEvent.clientY - startY));
                    panel.style.width = `${width}px`;
                    panel.style.height = `${height}px`;
                };
                const stopResize = (): void => {
                    resizeHandle.removeEventListener("pointermove", resize);
                    resizeHandle.removeEventListener("pointerup", stopResize);
                    resizeHandle.removeEventListener("pointercancel", stopResize);
                };

                resizeHandle.addEventListener("pointermove", resize);
                resizeHandle.addEventListener("pointerup", stopResize);
                resizeHandle.addEventListener("pointercancel", stopResize);
            });
            panel.appendChild(resizeHandle);

            const closePanel = (): void => overlay.remove();
            closeButton.addEventListener("click", closePanel);
            cancelButton.addEventListener("click", closePanel);
            applyButton.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.matrixVisibleColumns = new Set(draft);
                const updatedCard = this.renderProjectCurveMatrix(curveRows);
                closePanel();
                card.replaceWith(updatedCard);
            });
            overlay.addEventListener("click", (event) => {
                if (event.target === overlay) closePanel();
            });

            renderOptions();
            overlay.appendChild(panel);
            overlayHost.appendChild(overlay);
            search.focus();
        });
        const downloadButton = document.createElement("button");
        downloadButton.type = "button";
        downloadButton.className = "evm-project-curve-configure-button evm-project-curve-download-button";
        const downloadIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        downloadIcon.setAttribute("viewBox", "0 0 24 24");
        downloadIcon.setAttribute("aria-hidden", "true");
        const downloadPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        downloadPath.setAttribute("d", "M12 3v12m0 0 4-4m-4 4-4-4M5 16v4h14v-4");
        downloadIcon.appendChild(downloadPath);
        downloadButton.appendChild(downloadIcon);
        downloadButton.appendChild(createElement("span", undefined, "Descargar Excel"));
        downloadButton.addEventListener("click", () => {
            const projectId = this.currentDashboardData?.context.ProjectId
                ?? this.navigatorText(this.currentDashboardData?.project?.IdIntervencion)
                ?? this.filterState.selectedProjectId
                ?? this.filterState.lastNavigableProjectId;
            if (!projectId) {
                console.warn("No se pudo descargar el Excel porque no hay una intervención seleccionada.");
                return;
            }

            const downloadUrl = "https://python-api-ssme-dng3a6ecgacfe5dc.centralus-01.azurewebsites.net/api/fn_descargar_excel"
                + `?idIntervencion=${encodeURIComponent(projectId)}`;
            this.host.launchUrl(downloadUrl);
        });
        const headingActions = createElement("div", "evm-project-curve-heading-actions");
        headingActions.appendChild(downloadButton);
        const optionsWrap = createElement("div", "evm-project-curve-options-wrap");
        const optionsButton = createElement("button", "evm-project-curve-options-button", "⋮");
        optionsButton.type = "button";
        optionsButton.setAttribute("aria-label", "Opciones de la matriz EVM");
        optionsButton.setAttribute("aria-expanded", "false");
        optionsButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const existing = optionsWrap.querySelector(".evm-project-curve-options-menu");
            if (existing) {
                existing.remove();
                optionsButton.setAttribute("aria-expanded", "false");
                return;
            }
            const menu = createElement("div", "evm-project-curve-options-menu");
            menu.setAttribute("role", "menu");
            const closeMenu = (): void => {
                menu.remove();
                optionsButton.setAttribute("aria-expanded", "false");
                document.removeEventListener("pointerdown", closeOutside, true);
                document.removeEventListener("keydown", closeEscape, true);
            };
            const closeOutside = (pointerEvent: PointerEvent): void => {
                if (pointerEvent.target instanceof Node && optionsWrap.contains(pointerEvent.target)) return;
                closeMenu();
            };
            const closeEscape = (keyEvent: KeyboardEvent): void => {
                if (keyEvent.key !== "Escape") return;
                keyEvent.preventDefault();
                closeMenu();
                optionsButton.focus();
            };
            const addOption = (icon: string, label: string, action: () => void): void => {
                const option = createElement("button", "evm-project-curve-options-item");
                option.type = "button";
                option.setAttribute("role", "menuitem");
                option.appendChild(createElement("span", "evm-project-curve-options-icon", icon));
                option.appendChild(document.createTextNode(label));
                option.addEventListener("click", () => {
                    closeMenu();
                    action();
                });
                menu.appendChild(option);
            };
            addOption("⚙", "Columnas visibles", () => configureButton.click());
            addOption("↶", "Restablecer columnas", () => {
                this.matrixVisibleColumns = null;
                card.replaceWith(this.renderProjectCurveMatrix(curveRows));
            });
            optionsWrap.appendChild(menu);
            optionsButton.setAttribute("aria-expanded", "true");
            window.setTimeout(() => {
                document.addEventListener("pointerdown", closeOutside, true);
                document.addEventListener("keydown", closeEscape, true);
                menu.querySelector<HTMLButtonElement>("button")?.focus();
            }, 0);
        });
        optionsWrap.appendChild(optionsButton);
        headingActions.appendChild(optionsWrap);
        heading.appendChild(headingActions);
        card.appendChild(heading);

        const tableWrap = createElement("div", "evm-project-curve-matrix-wrap");
        const matrixCutoffValues = curveRows
            .map((row) => numberValue(row.SemanaEstado))
            .filter((value): value is number => value !== null && value >= 1);
        const cutoffWeek = matrixCutoffValues.length ? Math.max(...matrixCutoffValues) : null;
        const visibleRows = curveRows
            .filter((row) => {
                const week = numberValue(row.Semana);
                return week !== null
                    && week >= 1
                    && (cutoffWeek === null || week <= cutoffWeek);
            });
        const table = createElement("table", "evm-project-curve-matrix");
        table.classList.add(`evm-matrix-projection-method-${this.matrixCostProjectionMethod}`);
        const visibleFields = [weekField, ...groups.flatMap((group) => group.fields.filter(isColumnVisible))];
        const sectionStartFields = new Set(groups.flatMap((group) => {
            const firstVisible = group.fields.find(isColumnVisible);
            return firstVisible ? [firstVisible.key] : [];
        }));
        const styleProjectionGroup = (element: HTMLElement, field: MatrixField): void => {
            const block = [
                ["VAC (c)", "EAC (c)", "ETC (c)"],
                ["VAC (t)", "EAC (t)", "ETC (t)"]
            ].find((keys) => keys.includes(String(field.key)));
            if (!block) return;
            const visibleBlock = block.filter((key) => visibleFields.some((item) => item.key === key));
            element.classList.add("evm-matrix-projection-group-cell");
            if (field.key === visibleBlock[0]) element.classList.add("evm-matrix-projection-group-start");
            if (field.key === visibleBlock[visibleBlock.length - 1]) element.classList.add("evm-matrix-projection-group-end");
        };
        const matrixFieldValue = (row: CurveData, field: MatrixField): number | null => {
            if (field.key === "AT") return numberValue(row.AT_Matriz);
            if (field.key === "VAC (c)" || field.key === "EAC (c)" || field.key === "ETC (c)") {
                return numberValue(row[`_${field.key}`] as DataValue);
            }
            return numberValue(row[field.key] as DataValue);
        };
        const matrixHeaderParts = (field: MatrixField): string[] => {
            if (field.key === "SPI (w)(*)") return ["SPI", "(w)", "*"];
            if (field.key === "TCPI Proy") return ["TCPI", "**"];
            if (field.key === "TSPI (w) Proy") return ["TSPI", "(w)", "***"];
            if (field.key === "TSPI (t) Proy") return ["TSPI", "(t)", "***"];
            const match = field.label.match(/^(.+?)\s+(\([^)]*\))$/);
            return match ? [match[1], match[2]] : [field.label];
        };
        type PreparedMatrixCell = { field: MatrixField; value: number | null; formatted: string; title: string; projectionMethod: string };
        const projectionMethodTooltip = (method: string | null | undefined): string => {
            const labels: Record<string, string> = {
                "1": "Si se espera que el CPI sea el mismo para el resto del proyecto",
                "2": "Si el trabajo futuro sera realizado al ritmo previsto",
                "3": "Si el plan inicial ya no es válido",
                "4": "Si tanto el CPI como el SPI influyen en el trabajo restante"
            };
            const text = String(method ?? "").trim();
            const key = text.match(/^\(?([1-4])\)?$/)?.[1];
            return key ? `Método de Proyección N.° ${key}\n\n${labels[key]}` : text;
        };
        const formatEarnedSchedule = (value: number): string => value.toLocaleString("en-US", {
            minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
            maximumFractionDigits: 2
        });
        const preparedRows: PreparedMatrixCell[][] = visibleRows.map((row) => visibleFields.map((field) => {
            const value = field.kind === "date" ? null : matrixFieldValue(row, field);
            const dateText = field.kind === "date" ? row.IETC : null;
            const formatted = field.kind === "date" ? dateText ?? "—" : value === null
                ? "—"
                : field.kind === "money"
                    ? `S/ ${Math.round(value).toLocaleString("en-US")}`
                    : field.kind === "week"
                        ? this.formatInteger(value)
                        : field.key === "ES"
                            ? formatEarnedSchedule(value)
                            : value.toLocaleString("en-US", { minimumFractionDigits: field.kind === "index" ? 2 : 0, maximumFractionDigits: 2 });
            return {
                field,
                value,
                formatted,
                projectionMethod: String(row.MetodoProyeccion ?? "").trim().match(/^\(?([1-4])\)?$/)?.[1] ?? "",
                title: field.key === "VAC (c)" || field.key === "EAC (c)" || field.key === "ETC (c)"
                    ? projectionMethodTooltip(row.MetodoProyeccion)
                    : field.kind === "date" ? dateText == null ? "Sin dato" : `${field.title}: ${dateText}`
                    : value === null ? "Sin dato" : `${field.title}: ${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}`
            };
        }));
        const colgroup = document.createElement("colgroup");
        visibleFields.forEach((field, fieldIndex) => {
            const headerParts = matrixHeaderParts(field);
            const headerLength = Math.max(...headerParts.map((part) => part.length));
            const contentLength = preparedRows.reduce((maximum, row) => Math.max(maximum, row[fieldIndex].formatted.length), headerLength);
            const minimumWidth = field.kind === "date" ? 110 : field.kind === "week" ? 56 : field.kind === "time" ? 58 : field.kind === "index" ? 68 : 78;
            const maximumWidth = field.kind === "date" ? 300 : field.kind === "money" ? 116 : field.kind === "time" ? 92 : field.kind === "index" ? 96 : 76;
            const col = document.createElement("col");
            col.style.width = `${Math.max(minimumWidth, Math.min(maximumWidth, contentLength * 9 + 18))}px`;
            colgroup.appendChild(col);
        });
        table.appendChild(colgroup);
        const head = document.createElement("thead");
        const groupHeadRow = document.createElement("tr");
        groupHeadRow.className = "evm-project-curve-matrix-group-row";
        const weekHead = createElement("th", "evm-project-curve-matrix-week-header", weekField.label);
        weekHead.rowSpan = 2;
        weekHead.title = weekField.title;
        groupHeadRow.appendChild(weekHead);
        groups.forEach((group) => {
            const visibleGroupFields = group.fields.filter(isColumnVisible);
            if (!visibleGroupFields.length) return;
            const groupHead = createElement("th", `evm-project-curve-matrix-group ${group.className}`, group.name);
            groupHead.classList.add("evm-matrix-section-start");
            groupHead.colSpan = visibleGroupFields.length;
            groupHeadRow.appendChild(groupHead);
        });
        head.appendChild(groupHeadRow);
        const fieldHeadRow = document.createElement("tr");
        groups.forEach((group) => {
            group.fields.forEach((field) => {
                if (!isColumnVisible(field)) {
                    return;
                }
                const th = createElement("th");
                styleProjectionGroup(th, field);
                if (sectionStartFields.has(field.key)) th.classList.add("evm-matrix-section-start");
                if (field.key === "VAC (c)") th.classList.add("evm-matrix-header-vac-cost");
                if (field.key === "VAC (t)" || field.key === "EAC (t)" || field.key === "ETC (t)") th.classList.add("evm-matrix-header-time-projection");
                if (field.key === "EAC (c)" || field.key === "ETC (c)") th.classList.add("evm-matrix-header-eac-cost");
                const headerParts = matrixHeaderParts(field);
                if (headerParts.length > 1) {
                    th.classList.add("evm-project-curve-matrix-header--stacked");
                    headerParts.forEach((part) => {
                        const partClass = /^\*+$/.test(part) ? "evm-project-curve-matrix-asterisks" : undefined;
                        th.appendChild(createElement("span", partClass, part));
                    });
                } else {
                    th.textContent = headerParts[0];
                }
                th.title = field.title;
                fieldHeadRow.appendChild(th);
            });
        });
        head.appendChild(fieldHeadRow);
        table.appendChild(head);
        const body = document.createElement("tbody");
        const populatePreparedRow = (tr: HTMLTableRowElement, row: PreparedMatrixCell[], rowIndex: number): void => {
            tr.className = rowIndex === preparedRows.length - 1 ? "current" : "";
            row.forEach((cell, cellIndex) => {
                    const td = tr.cells[cellIndex] ?? createElement("td");
                    td.textContent = cell.formatted;
                    td.className = "";
                    styleProjectionGroup(td, cell.field);
                    if (sectionStartFields.has(cell.field.key)) td.classList.add("evm-matrix-section-start");
                    if (rowIndex === preparedRows.length - 1 && td.classList.contains("evm-matrix-projection-group-cell")) {
                        td.classList.add("evm-matrix-projection-group-bottom");
                    }
                    if (cell.field.key === "VAC (c)" || cell.field.key === "EAC (c)" || cell.field.key === "ETC (c)") {
                        td.classList.add("evm-matrix-cell-cost-projection");
                    }
                    if (td.classList.contains("evm-matrix-cell-cost-projection")) {
                        td.removeAttribute("title");
                        td.dataset.projectionTooltip = cell.title;
                        td.dataset.projectionMethod = cell.projectionMethod;
                        td.setAttribute("aria-label", `${cell.field.title}: ${cell.formatted}. ${cell.title}`);
                    } else {
                        td.title = cell.title;
                        delete td.dataset.projectionTooltip;
                        delete td.dataset.projectionMethod;
                        td.removeAttribute("aria-label");
                    }
                    if (cell.field.key === "VAC (t)" || cell.field.key === "EAC (t)" || cell.field.key === "ETC (t)") {
                        td.classList.add("evm-matrix-cell-time-projection");
                    }
                    td.tabIndex = 0;
                    td.setAttribute("role", "gridcell");
                    td.setAttribute("aria-selected", "false");
                    if (!td.parentElement) tr.appendChild(td);
            });
        };
        const appendPreparedRow = (row: PreparedMatrixCell[], rowIndex: number): void => {
            const tr = document.createElement("tr");
            populatePreparedRow(tr, row, rowIndex);
            body.appendChild(tr);
        };
        const virtualThreshold = 160;
        const virtualRowHeight = 34;
        if (preparedRows.length <= virtualThreshold) {
            preparedRows.forEach(appendPreparedRow);
        } else {
            const overscan = 12;
            const visibleCount = Math.max(30, Math.ceil(tableWrap.clientHeight / virtualRowHeight));
            const poolSize = Math.min(preparedRows.length, visibleCount + overscan * 2);
            const spacerRow = (): HTMLTableRowElement => {
                const row = document.createElement("tr");
                row.className = "evm-virtual-spacer-row";
                const cell = document.createElement("td");
                cell.colSpan = visibleFields.length;
                row.appendChild(cell);
                return row;
            };
            const topSpacer = spacerRow();
            const bottomSpacer = spacerRow();
            const rowPool = Array.from({ length: poolSize }, () => document.createElement("tr"));
            body.append(topSpacer, ...rowPool, bottomSpacer);
            const setSpacerHeight = (row: HTMLTableRowElement, height: number): void => {
                row.style.display = height > 0 ? "" : "none";
                row.cells[0].style.height = `${height}px`;
            };
            const renderMatrixWindow = (): void => {
                const start = Math.max(0, Math.min(preparedRows.length - poolSize, Math.floor(tableWrap.scrollTop / virtualRowHeight) - overscan));
                const end = Math.min(preparedRows.length, start + poolSize);
                setSpacerHeight(topSpacer, start * virtualRowHeight);
                rowPool.forEach((row, poolIndex) => {
                    const sourceIndex = start + poolIndex;
                    row.style.display = sourceIndex < end ? "" : "none";
                    if (sourceIndex < end) populatePreparedRow(row, preparedRows[sourceIndex], sourceIndex);
                });
                setSpacerHeight(bottomSpacer, (preparedRows.length - end) * virtualRowHeight);
            };
            renderMatrixWindow();
            let virtualFrame: number | null = null;
            tableWrap.addEventListener("scroll", () => {
                if (virtualFrame !== null) return;
                virtualFrame = requestAnimationFrame(() => {
                    virtualFrame = null;
                    renderMatrixWindow();
                });
            }, { passive: true });
        }
        table.appendChild(body);
        const projectionTooltip = createElement("div", "evm-projection-tooltip");
        projectionTooltip.setAttribute("role", "tooltip");
        projectionTooltip.setAttribute("popover", "manual");
        projectionTooltip.hidden = true;
        card.appendChild(projectionTooltip);
        const hideProjectionTooltip = (): void => {
            if (projectionTooltip.matches(":popover-open")) projectionTooltip.hidePopover();
            projectionTooltip.hidden = true;
        };
        const showProjectionTooltip = (target: EventTarget | null): void => {
            const cell = target instanceof Element ? target.closest<HTMLElement>("[data-projection-tooltip]") : null;
            if (!cell || !table.contains(cell)) {
                hideProjectionTooltip();
                return;
            }
            const [title, ...description] = (cell.dataset.projectionTooltip ?? "").split("\n\n");
            projectionTooltip.dataset.method = cell.dataset.projectionMethod ?? "";
            projectionTooltip.replaceChildren(
                createElement("div", "evm-projection-tooltip-eyebrow", "PROYECCIÓN DE COSTOS"),
                createElement("strong", "evm-projection-tooltip-title", title),
                createElement("p", "evm-projection-tooltip-description", description.join("\n\n"))
            );
            const projectionFormulas: Record<string, string> = {
                "1": "EAC = BAC / CPI",
                "2": "EAC = AC + BAC − EV",
                "3": "EAC = AC + ETC reestimate",
                "4": "EAC = AC + [(BAC − EV) / (CPI × SPI)]"
            };
            const formula = projectionFormulas[projectionTooltip.dataset.method];
            if (formula) {
                const formulaBlock = createElement("div", "evm-projection-tooltip-formula");
                formulaBlock.append(
                    createElement("span", "evm-projection-tooltip-eyebrow", "FÓRMULA"),
                    createElement("strong", undefined, formula)
                );
                projectionTooltip.appendChild(formulaBlock);
            }
            projectionTooltip.hidden = false;
            if (typeof projectionTooltip.showPopover === "function" && !projectionTooltip.matches(":popover-open")) {
                projectionTooltip.showPopover();
            }
            const bounds = cell.getBoundingClientRect();
            const tooltipBounds = projectionTooltip.getBoundingClientRect();
            const left = Math.max(8, Math.min(bounds.left + bounds.width / 2 - tooltipBounds.width / 2, window.innerWidth - tooltipBounds.width - 8));
            const top = bounds.bottom + tooltipBounds.height + 10 <= window.innerHeight
                ? bounds.bottom + 8 : Math.max(8, bounds.top - tooltipBounds.height - 8);
            projectionTooltip.style.left = `${left}px`;
            projectionTooltip.style.top = `${top}px`;
        };
        table.addEventListener("pointerover", (event) => showProjectionTooltip(event.target));
        table.addEventListener("pointerleave", hideProjectionTooltip);
        table.addEventListener("focusin", (event) => showProjectionTooltip(event.target));
        table.addEventListener("focusout", hideProjectionTooltip);
        table.addEventListener("keydown", (event) => {
            if (event.key === "Escape") hideProjectionTooltip();
        });
        card.addEventListener("scroll", hideProjectionTooltip, true);
        let selectedCell: HTMLTableCellElement | null = null;
        const toggleMatrixSelection = (target: EventTarget | null): void => {
            const cell = target instanceof Element ? target.closest("tbody td") : null;
            if (!(cell instanceof HTMLTableCellElement) || !table.contains(cell)) return;
            const wasSelected = cell === selectedCell;
            if (selectedCell) {
                selectedCell.classList.remove("is-selected");
                selectedCell.setAttribute("aria-selected", "false");
                selectedCell.parentElement?.classList.remove("is-selected");
            }
            selectedCell = wasSelected ? null : cell;
            if (selectedCell) {
                selectedCell.classList.add("is-selected");
                selectedCell.setAttribute("aria-selected", "true");
                selectedCell.parentElement?.classList.add("is-selected");
            }
        };
        table.addEventListener("click", (event) => toggleMatrixSelection(event.target));
        table.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleMatrixSelection(event.target);
            }
        });
        this.attachMatrixCopyMenu(
            table,
            "thead tr",
            "tbody tr:not(.evm-virtual-spacer-row)",
            "th, td",
            preparedRows.map((row) => row.map((cell) => cell.formatted.replace(/^S\/\s*/i, "")))
        );
        tableWrap.appendChild(table);
        card.appendChild(tableWrap);
        return card;
    }

    private renderCarouselButton(direction: "prev" | "next", label: string, ariaLabel: string, pages: HTMLElement[]): HTMLButtonElement {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `evm-carousel-button evm-carousel-button--${direction}`;
        button.setAttribute("aria-label", ariaLabel);
        button.textContent = label;
        button.addEventListener("click", () => {
            const step = direction === "next" ? 1 : -1;
            const nextIndex = (this.getCarouselIndex(pages) + step + pages.length) % pages.length;
            this.setCarouselIndex(pages, nextIndex);
            this.updateCarouselPages(pages);
        });
        return button;
    }

    private createLazyCarouselPage(className: string, active: boolean, render: (page: HTMLElement) => void): HTMLElement {
        return this.lazyCarousel.create(className, active, render);
    }

    private mountCarouselPage(page: HTMLElement): void {
        this.lazyCarousel.mount(page);
    }

    private renderCarouselDots(pages: HTMLElement[]): HTMLElement {
        const dots = document.createElement("div");
        dots.className = "evm-carousel-dots";
        pages.forEach((_, index) => {
            const dot = document.createElement("button");
            dot.type = "button";
            dot.className = "evm-carousel-dot";
            dot.setAttribute("aria-label", `Ver pantalla ${index + 1}`);
            dot.addEventListener("click", () => {
                this.setCarouselIndex(pages, index);
                this.updateCarouselPages(pages);
            });
            dots.appendChild(dot);
        });
        this.updateCarouselDots(dots, this.getCarouselIndex(pages));
        return dots;
    }

    private updateCarouselPages(pages: HTMLElement[]): void {
        const carouselIndex = this.getCarouselIndex(pages);
        const activePage = pages[carouselIndex];
        if (activePage) this.mountCarouselPage(activePage);
        pages.forEach((page, index) => {
            const active = index === carouselIndex;
            page.classList.toggle("active", active);
            page.setAttribute("aria-hidden", active ? "false" : "true");
        });
        const dots = pages[0]?.parentElement?.parentElement?.querySelector(".evm-carousel-dots");
        if (dots instanceof HTMLElement) {
            this.updateCarouselDots(dots, carouselIndex);
        }
        const carousel = pages[0]?.parentElement?.parentElement;
        if (carousel instanceof HTMLElement) {
            this.updateCarouselButtons(carousel);
            const main = carousel.closest(".evm-main");
            main?.classList.toggle("evm-main--project-details", main.classList.contains("evm-main--project") && carouselIndex === 1);
            main?.classList.toggle("evm-main--portfolio-details", main.classList.contains("evm-main--pronied") && carouselIndex === 1);
        }
        const carouselScope = this.isPortfolioCarousel(pages) ? "portfolio" : "project";
        this.rootElement?.querySelectorAll(`.evm-project-subtab[data-carousel-scope="${carouselScope}"]`).forEach((tab) => {
                const view = (tab as HTMLElement).dataset.projectView;
                tab.classList.toggle("active", view === (carouselIndex === 0 ? "summary" : "matrix"));
        });
    }

    private updateCarouselDots(dots: HTMLElement, carouselIndex: number): void {
        Array.from(dots.children).forEach((dot, index) => {
            dot.classList.toggle("active", index === carouselIndex);
        });
    }

    private updateCarouselButtons(carousel: HTMLElement): void {
        const isPortfolio = carousel.classList.contains("evm-body-carousel--portfolio");
        const carouselIndex = isPortfolio ? this.portfolioCarouselIndex : this.projectCarouselIndex;
        const tooltip = isPortfolio
            ? (carouselIndex === 0 ? "Ver avance por unidad" : "Volver al resumen")
            : (carouselIndex === 0 ? "Ver Hitos & Riesgos" : "Volver a Desempeno");
        carousel.querySelectorAll(".evm-carousel-button").forEach((button) => {
            button.setAttribute("aria-label", tooltip);
            button.setAttribute("title", tooltip);
            button.setAttribute("data-tooltip", tooltip);
        });
    }

    private isPortfolioCarousel(pages: HTMLElement[]): boolean {
        return pages[0]?.parentElement?.parentElement?.classList.contains("evm-body-carousel--portfolio") ?? false;
    }

    private getCarouselIndex(pages: HTMLElement[]): number {
        return this.isPortfolioCarousel(pages) ? this.portfolioCarouselIndex : this.projectCarouselIndex;
    }

    private setCarouselIndex(pages: HTMLElement[], index: number): void {
        if (this.isPortfolioCarousel(pages)) {
            this.portfolioCarouselIndex = index;
        } else {
            this.projectCarouselIndex = index;
        }
    }

    private syncFilterStateFromDashboard(dashboard: ParsedDashboardData): void {
        const dashboardProjectId = dashboard.context.ProjectId ?? (this.navigatorText(dashboard.project?.IdIntervencion) || null);
        if (dashboard.context.Level === "PROYECTO" && !this.defaultProjectId && dashboardProjectId) {
            this.defaultProjectId = dashboardProjectId;
        }
        this.filterState.level = dashboard.context.Level;
        this.filterState.selectedUnit = dashboard.context.Unit ?? this.filterState.selectedUnit;
        this.filterState.selectedProjectId = dashboard.context.ProjectId ?? this.filterState.selectedProjectId;
        this.filterState.lastNavigableUnit = dashboard.context.Unit
            ?? dashboard.project?.UnidadGerencial
            ?? this.filterState.lastNavigableUnit;
        this.filterState.lastNavigableProjectId = dashboard.context.ProjectId
            ?? dashboard.project?.IdIntervencion
            ?? this.filterState.lastNavigableProjectId;
        this.filterState.region = dashboard.context.Region ?? this.filterState.region;
        this.filterState.province = dashboard.context.Province ?? this.filterState.province;
        this.filterState.district = dashboard.context.District ?? this.filterState.district;
        this.filterState.status = dashboard.context.Status ?? this.filterState.status;
    }

    private resolveUnitForNavigation(dashboard: ParsedDashboardData | null = this.currentDashboardData): string | null {
        if (!dashboard) {
            return this.filterState.selectedUnit ?? this.filterState.lastNavigableUnit;
        }

        return dashboard.context.Unit
            ?? dashboard.project?.UnidadGerencial
            ?? this.filterState.selectedUnit
            ?? this.filterState.lastNavigableUnit
            ?? dashboard.units.find((unit) => unit.UnidadGerencial)?.UnidadGerencial
            ?? this.firstNavigatorUnit();
    }

    private resolveProjectForNavigation(dashboard: ParsedDashboardData | null = this.currentDashboardData): string | null {
        if (!dashboard) {
            return this.filterState.selectedProjectId ?? this.filterState.lastNavigableProjectId;
        }

        return dashboard.context.ProjectId
            ?? dashboard.project?.IdIntervencion
            ?? this.filterState.selectedProjectId
            ?? this.filterState.lastNavigableProjectId
            ?? dashboard.projects.find((project) => project.IdIntervencion)?.IdIntervencion
            ?? this.firstNavigatorProject();
    }

    private firstNavigatorUnit(): string | null {
        const project = this.filteredNavigatorProjects().find((item) => this.navigatorText(item.UnidadGerencial));
        return project ? this.navigatorText(project.UnidadGerencial) : null;
    }

    private firstNavigatorProject(): string | null {
        const project = this.filteredNavigatorProjects().find((item) => this.navigatorText(item.IdIntervencion));
        return project ? this.navigatorText(project.IdIntervencion) : null;
    }

    private unitForProject(projectId: string): string | null {
        const indexedProject = this.navigatorIndex.get(projectId);
        const indexedUnit = this.navigatorText(indexedProject?.UnidadGerencial);
        if (indexedUnit) return indexedUnit;

        const currentProject = this.currentDashboardData?.projects.find((project) => project.IdIntervencion === projectId);
        if (currentProject?.UnidadGerencial) {
            return currentProject.UnidadGerencial;
        }

        const navigatorProject = this.currentDashboardData?.navigator?.projects.find((project) => this.navigatorText(project.IdIntervencion) === projectId);
        const unit = this.navigatorText(navigatorProject?.UnidadGerencial);
        return unit || null;
    }

    private findNavigatorProjectById(projectId: string): NavigatorProject | null {
        const cleanProjectId = projectId.trim();
        if (!cleanProjectId) {
            return null;
        }

        return this.navigatorIndex.get(cleanProjectId)
            ?? this.currentDashboardData?.navigator?.projects.find((project) => this.navigatorText(project.IdIntervencion) === cleanProjectId)
            ?? this.currentDashboardData?.projects.find((project) => this.navigatorText(project.IdIntervencion) === cleanProjectId)
            ?? null;
    }

    private getProjectId(project: NavigatorProject): string | null {
        const value =
            project.IdIntervencion ??
            project.ProjectId ??
            project.idIntervencion ??
            project.projectId ??
            project.ProyectoId ??
            project.IdProyecto;

        if (typeof value === "string" && value.trim() !== "") {
            return value.trim();
        }

        if (typeof value === "number" && Number.isFinite(value)) {
            return String(value);
        }

        return null;
    }

    private getProjectUnit(project: NavigatorProject): string | null {
        const unit = this.navigatorText(project.UnidadGerencial);
        if (unit) {
            return unit;
        }

        const projectId = this.getProjectId(project);
        return projectId ? this.unitForProject(projectId) : null;
    }

    private handleProjectClick(event: Event, project: UnitProjectSummaryData): void {
        event.preventDefault();
        event.stopPropagation();

        const navigatorProject = project as unknown as NavigatorProject;
        const projectRecord = navigatorProject as Record<string, unknown>;
        const projectId = this.getProjectId(navigatorProject);
        if (this.navigationDebugPanelEnabled) {
            this.navigationDebug.clickedProjectObject = JSON.stringify(project, null, 2);
            this.navigationDebug.clickedProjectKeys = Object.keys(projectRecord).join(", ");
        }
        if (this.navigationDebugPanelEnabled) {
            this.navigationDebug.clickedProjectId = projectId;
            this.navigationDebug.clickedProjectIdType = projectId === null ? null : typeof projectId;
            this.navigationDebug.requestedProjectId = projectId;
        }

        this.openProjectDashboard(navigatorProject);
    }

    private openProniedDashboard(): void {
        this.filterState.level = "PRONIED";
        this.filterState.selectedUnit = null;
        this.filterState.selectedProjectId = null;
        this.pendingNavigationLevel = "PRONIED";
        this.applyLevelFilter("PRONIED");
    }

    private openRiskDashboard(): void {
        this.filterState.level = "RIESGOS";
        this.filterState.selectedUnit = null;
        this.filterState.selectedProjectId = null;
        this.pendingNavigationLevel = "RIESGOS";
        this.applyLevelFilter("RIESGOS");
    }

    private openUnitDashboard(unit?: string): void {
        const selectedUnit = unit ?? this.resolveUnitForNavigation();
        if (!selectedUnit) {
            console.warn("No hay Unidad Gerencial seleccionada.");
            this.openFilterPanel("unit");
            return;
        }

        this.filterState.level = "UNIDAD";
        this.filterState.selectedUnit = selectedUnit;
        this.filterState.lastNavigableUnit = selectedUnit;
        this.filterState.selectedProjectId = null;
        this.pendingNavigationLevel = "UNIDAD";
        this.applyUnitDashboardFilters(selectedUnit);
    }

    private openRiskView(view: "summary" | "matrix"): void {
        if (this.currentDashboardData?.context.Level !== "RIESGOS") return;
        this.riskCarouselIndex = view === "summary" ? 0 : 1;
        const riskMain = this.rootElement?.querySelector(".evm-main--risk-dashboard");
        if (riskMain instanceof HTMLElement && this.currentDashboardData.riskDashboard) {
            mountRiskDashboardPage(riskMain, this.riskCarouselIndex, this.currentDashboardData.riskDashboard);
        }
        this.rootElement?.querySelectorAll(".evm-risk-carousel-page").forEach((page, index) => {
            page.classList.toggle("active", index === this.riskCarouselIndex);
        });
        this.rootElement?.querySelectorAll('.evm-project-subtab[data-carousel-scope="risk"]').forEach((tab) => {
            tab.classList.toggle("active", (tab as HTMLElement).dataset.projectView === view);
        });
    }

    /**
     * Nivel y unidad deben viajar en el mismo selfFilter. Power BI solo conserva
     * de forma fiable un filtro propio por visual; si se envían por separado,
     * la unidad (con un solo proyecto) puede hacer que el DAX resuelva PROYECTO.
     */
    private applyUnitDashboardFilters(unit: string): void {
        const cleanUnit = unit.trim().split(/\s|-/)[0].toUpperCase();
        if (!cleanUnit) return;

        this.clearInternalFilter("projectFilter", true);
        this.clearInternalFilter("unitFilter", true);

        this.navigationFilters.applyTuple(
            `unit:${cleanUnit}`,
            [
                { table: "Dim_NivelDashboard", column: "Nivel" },
                { table: "Dim_Intervenciones", column: "UnidadGerencial" }
            ],
            [["UNIDAD", cleanUnit]]
        );
    }

    private disableProjectNavigation(projectId: string | null): void {
        this.navigationDebug.requestedLevel = "PROYECTO";
        this.navigationDebug.requestedProjectId = projectId;
        this.navigationDebug.lastAction = "Navegación a Proyecto temporalmente deshabilitada";
        this.navigationDebug.lastError = "Navegación a Proyecto temporalmente deshabilitada";
        this.navigationDebug.applyJsonFilterCalled = false;
        this.navigationDebug.timestamp = new Date().toISOString();
        this.renderNavigationDebugPanel();
    }

    private openProjectDashboard(project: NavigatorProject): void {
        const projectId = this.getProjectId(project);
        if (!projectId) {
            console.warn("No hay proyecto seleccionado.");
            if (this.navigationDebugPanelEnabled) {
                this.navigationDebug.lastError = "IdIntervencion vacío";
                this.renderNavigationDebugPanel();
            }
            return;
        }

        if (this.navigationDebugPanelEnabled) {
            this.navigationDebug.requestedLevel = "PROYECTO";
            this.navigationDebug.clickedProjectId = projectId;
            this.navigationDebug.clickedProjectIdType = typeof projectId;
            this.navigationDebug.requestedProjectId = projectId;
            this.navigationDebug.lastAction = "Aplicando filtro de proyecto";
            this.navigationDebug.externalProjectFilterApplied = false;
            this.navigationDebug.selfProjectFilterApplied = false;
            this.navigationDebug.lastError = null;
            this.navigationDebug.applyJsonFilterCalled = true;
            this.navigationDebug.lastFilterJson = JSON.stringify({
                filter: "Dim_Intervenciones[IdIntervencion]",
                projectId
            });
            this.renderNavigationDebugPanel();
        }
        this.filterState.level = "PROYECTO";
        this.filterState.selectedProjectId = projectId;
        this.filterState.lastNavigableProjectId = projectId;
        this.pendingNavigationLevel = "PROYECTO";
        this.pendingProjectSelectionId = projectId;
        this.applyProjectDashboardFilters(projectId);
        if (this.navigationDebugPanelEnabled) {
            this.navigationDebug.externalProjectFilterApplied = true;
            this.navigationDebug.selfProjectFilterApplied = true;
            this.navigationDebug.lastAction = "Filtro de proyecto enviado";
            this.navigationDebug.lastError = null;
            this.navigationDebug.timestamp = new Date().toISOString();
            this.renderNavigationDebugPanel();
        }
    }

    private openProjectView(view: "summary" | "milestones" | "risks"): void {
        if (this.currentDashboardData?.context.Level !== "PROYECTO") {
            return;
        }
        this.projectCarouselIndex = view === "summary" ? 0 : 1;
        const pages = Array.from(this.rootElement?.querySelectorAll(".evm-body-carousel-page") ?? [])
            .filter((element): element is HTMLElement => element instanceof HTMLElement);
        if (pages.length) {
            this.updateCarouselPages(pages);
        }
    }

    private openPortfolioView(view: "summary" | "matrix"): void {
        if (this.currentDashboardData?.context.Level !== "PRONIED") {
            return;
        }
        this.portfolioCarouselIndex = view === "summary" ? 0 : 1;
        const pages = Array.from(this.rootElement?.querySelectorAll(".evm-body-carousel--portfolio .evm-body-carousel-page") ?? [])
            .filter((element): element is HTMLElement => element instanceof HTMLElement);
        if (pages.length) {
            this.updateCarouselPages(pages);
        }
    }

    private openProjectSelector(): void {
        this.openFilterPanel("project");
    }

    private openFilterPanel(focus: "unit" | "project" | null = null): void {
        if (this.currentDashboardData?.context.Level === "UNIDAD") {
            this.filterPanelOpen = false;
            this.filterFocus = focus;
            this.rootElement?.querySelectorAll(".evm-filter-panel:not(.evm-filter-panel--unit-inline)")
                .forEach((panel) => panel.remove());
            const selector = this.rootElement?.querySelector('[data-filter-key="unit-week"]');
            if (selector instanceof HTMLSelectElement) {
                selector.focus();
            }
            return;
        }
        this.filterPanelOpen = true;
        this.filterFocus = focus;
        this.renderFilterPanelIntoRoot();
    }

    private closeFilterPanel(): void {
        this.filterPanelOpen = false;
        this.filterFocus = null;
        this.rootElement?.querySelector(".evm-filter-panel")?.remove();
        this.rootElement?.querySelector(".evm-main--project")?.classList.remove("evm-main--project-filters-open");
    }

    private initializePreferredProject(dashboard: ParsedDashboardData | null): void {
        if (!dashboard || dashboard.context.Level !== "PROYECTO" || this.preferredProjectInitialized) {
            return;
        }
        const projects = this.navigatorProjectCatalog.length
            ? this.navigatorProjectCatalog
            : dashboard.navigator?.projects ?? dashboard.projects;
        const preferredProject = projects.find((project) => (
            this.navigatorText(project.Cui ?? project.CUI).trim() === this.preferredProjectCui
        ));
        if (!preferredProject) {
            return;
        }
        const preferredProjectId = this.getProjectId(preferredProject);
        if (!preferredProjectId) {
            return;
        }
        this.preferredProjectInitialized = true;
        this.defaultProjectId = preferredProjectId;
        const currentProjectId = dashboard.context.ProjectId
            ?? this.navigatorText(dashboard.project?.IdIntervencion)
            ?? this.filterState.selectedProjectId;
        if (currentProjectId === preferredProjectId) {
            this.filterState.selectedProjectId = preferredProjectId;
            return;
        }
        window.setTimeout(() => this.applyProjectFromAdvancedSearch(preferredProject), 0);
    }

    private beginFilterLoading(): void {
        if (this.filterLoading) {
            return;
        }
        this.filterLoading = true;
        this.rootElement?.setAttribute("aria-busy", "true");
        this.filterLoadingTimer = window.setTimeout(() => {
            if (!this.filterLoading || !this.rootElement?.isConnected) {
                return;
            }
            if (this.rootElement.querySelector(".evm-filter-loading")) {
                return;
            }
            const overlay = createElement("div", "evm-filter-loading");
            overlay.setAttribute("role", "status");
            overlay.setAttribute("aria-live", "polite");
            overlay.appendChild(createElement("span", "evm-filter-loading-spinner"));
            overlay.appendChild(createElement("strong", undefined, "Actualizando…"));
            this.rootElement.appendChild(overlay);
        }, 150);
        this.filterLoadingSafetyTimer = window.setTimeout(() => this.finishFilterLoading(), 15000);
    }

    private finishFilterLoading(): void {
        this.filterLoading = false;
        if (this.filterLoadingTimer !== null) {
            window.clearTimeout(this.filterLoadingTimer);
            this.filterLoadingTimer = null;
        }
        if (this.filterLoadingSafetyTimer !== null) {
            window.clearTimeout(this.filterLoadingSafetyTimer);
            this.filterLoadingSafetyTimer = null;
        }
        this.rootElement?.removeAttribute("aria-busy");
        this.rootElement?.querySelector(".evm-filter-loading")?.remove();
    }

    private renderFilterPanelIntoRoot(): void {
        if (!this.rootElement || !this.currentDashboardData) {
            return;
        }
        if (this.currentDashboardData.context.Level === "UNIDAD") {
            this.rootElement.querySelectorAll(".evm-filter-panel:not(.evm-filter-panel--unit-inline)")
                .forEach((panel) => panel.remove());
            return;
        }
        this.rootElement.querySelector(".evm-filter-panel")?.remove();
        if (this.currentDashboardData.context.Level === "PROYECTO") {
            const main = this.rootElement.querySelector(".evm-main--project");
            const header = main?.querySelector(":scope > .evm-header");
            if (main instanceof HTMLElement && header instanceof HTMLElement) {
                const panel = this.renderFilterPanel();
                panel.classList.add("evm-filter-panel--project-inline");
                header.insertAdjacentElement("afterend", panel);
                main.classList.add("evm-main--project-filters-open");
            }
            return;
        }
        this.rootElement.appendChild(this.renderFilterPanel());
    }

    private renderFilterPanel(): HTMLElement {
        const panel = createElement("aside", "evm-filter-panel evm-card");
        const header = createElement("div", "evm-filter-panel-header");
        header.appendChild(createElement("strong", undefined, "Filtros"));
        const close = createElement("button", undefined, "×");
        close.type = "button";
        close.setAttribute("aria-label", "Cerrar filtros");
        close.addEventListener("click", () => this.closeFilterPanel());
        header.appendChild(close);
        panel.appendChild(header);

        panel.appendChild(this.renderUnitProjectTreeFilter());
        const projectCatalog = this.navigatorProjectCatalog.length
            ? this.navigatorProjectCatalog
            : this.currentDashboardData?.navigator?.projects ?? this.currentDashboardData?.projects ?? [];
        const selectedProject = projectCatalog.find((project) => this.getProjectId(project) === this.filterState.selectedProjectId);
        const cuiOptions = Array.from(new Set(projectCatalog
            .map((project) => this.navigatorText(project.Cui ?? project.CUI))
            .filter(Boolean)))
            .sort((a, b) => a.localeCompare(b))
            .map((value) => ({ value, label: value }));
        panel.appendChild(this.renderFilterSelect("CUI", "cui", cuiOptions, this.navigatorText(selectedProject?.Cui ?? selectedProject?.CUI) || null, (value) => {
            const project = projectCatalog.find((item) => this.navigatorText(item.Cui ?? item.CUI) === value);
            if (project) {
                this.applyProjectFromAdvancedSearch(project);
            }
        }, false, true));
        panel.appendChild(this.renderFilterSelect("Región", "region", this.uniqueFromProjects(this.navigatorProjectsForOptions("region"), "Region"), this.filterState.region, (value) => {
            this.filterState.region = value;
            value ? this.applyBasicFilter("Dim_Intervenciones", "Region", [value], "regionFilter") : this.clearInternalFilter("regionFilter");
            this.reconcileProjectSelection();
        }, true, true));
        panel.appendChild(this.renderFilterSelect("Provincia", "province", this.uniqueFromProjects(this.navigatorProjectsForOptions("province"), "Provincia"), this.filterState.province, (value) => {
            this.filterState.province = value;
            value ? this.applyBasicFilter("Dim_Intervenciones", "Provincia", [value], "provinceFilter") : this.clearInternalFilter("provinceFilter");
            this.reconcileProjectSelection();
        }, true, true));
        panel.appendChild(this.renderFilterSelect("Distrito", "district", this.uniqueFromProjects(this.navigatorProjectsForOptions("district"), "Distrito"), this.filterState.district, (value) => {
            this.filterState.district = value;
            value ? this.applyBasicFilter("Dim_Intervenciones", "Distrito", [value], "districtFilter") : this.clearInternalFilter("districtFilter");
            this.reconcileProjectSelection();
        }, true, true));
        if (this.currentDashboardData?.context.Level === "PROYECTO") {
            const weeks = this.projectFilterWeeks(this.currentDashboardData);
            const weekField = this.renderFilterSelect("Semana", "week", weeks.map((week) => ({
                value: String(week), label: String(week)
            })), this.selectedProjectWeek === null ? null : String(this.selectedProjectWeek), (value) => {
                this.selectedProjectWeek = value === null ? null : Number(value);
                if (this.lastWeekFilterUpdateOptions) {
                    this.forceWeekFilterRender = true;
                    try {
                        this.update(this.lastWeekFilterUpdateOptions);
                    } finally {
                        this.forceWeekFilterRender = false;
                    }
                }
            }, false, weeks.length === 0);
            panel.appendChild(weekField);
        }
        const clear = createElement(
            "button",
            "evm-filter-clear",
            this.currentDashboardData?.context.Level === "PROYECTO" ? undefined : "Limpiar filtros"
        );
        clear.type = "button";
        if (this.currentDashboardData?.context.Level === "PROYECTO") {
            clear.appendChild(createElement("span", "evm-action-icon", "⇄"));
            clear.appendChild(createElement("span", "evm-action-label", "Cambiar proyecto"));
        }
        clear.addEventListener("click", () => {
            if (this.currentDashboardData?.context.Level === "PROYECTO") {
                this.openAdvancedProjectSearch();
            } else {
                this.clearAllInteractiveFilters();
            }
        });
        panel.appendChild(clear);

        if (this.filterFocus) {
            window.setTimeout(() => {
                const selector = panel.querySelector(`[data-filter-key="${this.filterFocus}"]`);
                if (selector instanceof HTMLSelectElement) {
                    selector.focus();
                }
            }, 0);
        }

        return panel;
    }

    private renderUnitProjectTreeFilter(): HTMLElement {
        const field = createElement("label", "evm-filter-field evm-unit-project-filter");
        field.appendChild(createElement("span", undefined, "UNIDAD GERENCIAL"));
        const control = createElement("div", "evm-unit-project-control");
        const projects = this.navigatorProjectCatalog.length
            ? this.navigatorProjectCatalog
            : this.currentDashboardData?.navigator?.projects ?? this.currentDashboardData?.projects ?? [];
        const selectedProject = projects.find((project) => this.getProjectId(project) === this.filterState.selectedProjectId);
        const trigger = createElement(
            "button",
            "evm-unit-project-trigger",
            selectedProject
                ? this.navigatorText(selectedProject.UnidadGerencial)
                : "Seleccione una Unidad Gerencial"
        );
        trigger.type = "button";
        const fixedProjectHeader = this.currentDashboardData?.context.Level === "PROYECTO";
        trigger.disabled = fixedProjectHeader;
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "false");

        const menu = createElement("div", "evm-unit-project-menu");
        menu.hidden = true;
        menu.setAttribute("role", "listbox");
        const search = document.createElement("input");
        search.type = "search";
        search.className = "evm-unit-project-search";
        search.placeholder = "Buscar unidad o proyecto...";
        search.setAttribute("aria-label", "Buscar unidad gerencial o proyecto");
        menu.appendChild(search);
        const grouped = new Map<string, NavigatorProject[]>();
        const searchableGroups: Array<{
            group: HTMLElement;
            children: HTMLElement;
            toggle: HTMLElement;
            unit: string;
            projects: Array<{ button: HTMLElement; label: string }>;
        }> = [];
        projects.forEach((project) => {
            const unit = this.navigatorText(project.UnidadGerencial) || "Sin Unidad Gerencial";
            const group = grouped.get(unit) ?? [];
            group.push(project);
            grouped.set(unit, group);
        });

        const selectProject = (project: NavigatorProject, unit: string): void => {
            const projectId = this.getProjectId(project);
            if (!projectId) {
                return;
            }
            this.filterState.selectedUnit = unit;
            this.filterState.selectedProjectId = projectId;
            this.filterState.lastNavigableUnit = unit;
            this.filterState.lastNavigableProjectId = projectId;
            this.filterState.region = this.navigatorText(project.Region) || null;
            this.filterState.province = this.navigatorText(project.Provincia) || null;
            this.filterState.district = this.navigatorText(project.Distrito) || null;
            this.filterState.status = this.navigatorText(project.EstadoProyecto) || null;
            this.pendingProjectSelectionId = projectId;
            ["unitFilter", "regionFilter", "provinceFilter", "districtFilter", "statusFilter"]
                .forEach((property) => this.clearInternalFilter(property));
            this.applyProjectFilter(projectId);
            menu.hidden = true;
            trigger.setAttribute("aria-expanded", "false");
            this.renderFilterPanelIntoRoot();
        };

        Array.from(grouped.entries())
            .sort(([unitA], [unitB]) => unitA.localeCompare(unitB))
            .forEach(([unit, unitProjects]) => {
                const group = createElement("div", "evm-unit-project-group");
                const groupHeader = createElement("div", "evm-unit-project-group-header");
                const toggle = createElement("button", "evm-unit-project-toggle", "⌄");
                toggle.type = "button";
                const unitSelected = unit === this.filterState.selectedUnit;
                const unitButton = createElement("button", "evm-unit-project-unit", `${unitSelected ? "◉" : "○"} ${unit}`);
                unitButton.type = "button";
                groupHeader.appendChild(toggle);
                groupHeader.appendChild(unitButton);
                group.appendChild(groupHeader);

                const children = createElement("div", "evm-unit-project-children");
                const searchableProjects: Array<{ button: HTMLElement; label: string }> = [];
                unitProjects
                    .sort((a, b) => this.navigatorText(a.NombreIntervencion).localeCompare(this.navigatorText(b.NombreIntervencion)))
                    .forEach((project) => {
                        const projectId = this.getProjectId(project);
                        if (!projectId) {
                            return;
                        }
                        const selected = projectId === this.filterState.selectedProjectId;
                        const projectButton = createElement(
                            "button",
                            `evm-unit-project-option${selected ? " selected" : ""}`,
                            `${selected ? "◉" : "○"} ${this.navigatorText(project.NombreIntervencion) || projectId}`
                        );
                        projectButton.type = "button";
                        projectButton.setAttribute("role", "option");
                        projectButton.setAttribute("aria-selected", selected ? "true" : "false");
                        projectButton.addEventListener("click", () => selectProject(project, unit));
                        children.appendChild(projectButton);
                        searchableProjects.push({
                            button: projectButton,
                            label: this.navigatorText(project.NombreIntervencion).toLocaleLowerCase("es")
                        });
                    });
                group.appendChild(children);
                toggle.addEventListener("click", () => {
                    children.hidden = !children.hidden;
                    toggle.textContent = children.hidden ? "›" : "⌄";
                });
                unitButton.addEventListener("click", () => {
                    const firstProject = unitProjects[0];
                    if (firstProject) selectProject(firstProject, unit);
                });
                menu.appendChild(group);
                searchableGroups.push({
                    group,
                    children,
                    toggle,
                    unit: unit.toLocaleLowerCase("es"),
                    projects: searchableProjects
                });
            });

        search.addEventListener("input", () => {
            const query = search.value.trim().toLocaleLowerCase("es");
            searchableGroups.forEach((item) => {
                const unitMatches = !query || item.unit.includes(query);
                let visibleProjects = 0;
                item.projects.forEach((project) => {
                    const visible = unitMatches || project.label.includes(query);
                    project.button.hidden = !visible;
                    if (visible) visibleProjects += 1;
                });
                item.group.hidden = visibleProjects === 0;
                if (query && visibleProjects > 0) {
                    item.children.hidden = false;
                    item.toggle.textContent = "⌄";
                }
            });
        });

        if (!grouped.size) {
            menu.appendChild(createElement("div", "evm-unit-project-empty", "No hay proyectos para los filtros seleccionados."));
        }
        trigger.addEventListener("click", () => {
            menu.hidden = !menu.hidden;
            trigger.setAttribute("aria-expanded", menu.hidden ? "false" : "true");
            if (!menu.hidden) {
                window.setTimeout(() => search.focus(), 0);
            }
        });
        control.addEventListener("focusout", (event: FocusEvent) => {
            if (!(event.relatedTarget instanceof Node) || !control.contains(event.relatedTarget)) {
                menu.hidden = true;
                trigger.setAttribute("aria-expanded", "false");
            }
        });
        control.appendChild(trigger);
        control.appendChild(menu);
        field.appendChild(control);
        return field;
    }

    private openAdvancedProjectSearch(): void {
        const host = this.rootElement;
        if (!host) {
            return;
        }
        host.querySelector(".evm-advanced-search-overlay")?.remove();
        const projects = this.navigatorProjectCatalog.length
            ? this.navigatorProjectCatalog
            : this.currentDashboardData?.navigator?.projects ?? this.currentDashboardData?.projects ?? [];
        let selectedProjectId = this.filterState.selectedProjectId;

        const overlay = createElement("div", "evm-advanced-search-overlay");
        const modal = createElement("section", "evm-advanced-search-modal evm-card");
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-label", "Buscador avanzado de proyectos");
        const header = createElement("header", "evm-advanced-search-header");
        header.appendChild(createElement("h2", undefined, "BUSCAR PROYECTO"));
        const close = createElement("button", undefined, "×");
        close.type = "button";
        close.setAttribute("aria-label", "Cerrar buscador avanzado");
        header.appendChild(close);
        modal.appendChild(header);

        const query = document.createElement("input");
        query.type = "search";
        query.className = "evm-advanced-search-query";
        query.placeholder = "Buscar por nombre de proyecto, CUI o código único...";
        modal.appendChild(query);
        modal.appendChild(createElement("div", "evm-advanced-search-subtitle", "⌕  FILTROS AVANZADOS"));

        const filterGrid = createElement("div", "evm-advanced-search-filters");
        const selectors: Record<string, HTMLSelectElement> = {};
        const dropdowns: Record<string, { sync: () => void; close: () => void }> = {};
        const addFilter = (label: string, key: string, field: keyof NavigatorProject): void => {
            const wrapper = createElement("label");
            wrapper.appendChild(createElement("span", undefined, label));
            const select = document.createElement("select");
            select.className = "evm-advanced-search-native-select";
            select.appendChild(new Option(label === "Unidad Gerencial" ? "Todas" : "Todos", ""));
            this.uniqueFromProjects(projects, field).forEach((option) => select.appendChild(new Option(option.label, option.value)));
            selectors[key] = select;
            wrapper.appendChild(select);
            const control = createElement("div", "evm-advanced-search-select");
            const trigger = createElement("button", "evm-advanced-search-select-trigger");
            trigger.type = "button";
            trigger.setAttribute("aria-haspopup", "listbox");
            trigger.setAttribute("aria-expanded", "false");
            const menu = createElement("div", "evm-advanced-search-select-menu");
            menu.hidden = true;
            menu.setAttribute("role", "listbox");
            const closeMenu = (): void => {
                menu.hidden = true;
                trigger.setAttribute("aria-expanded", "false");
            };
            const syncMenu = (): void => {
                const selectedOption = select.options[select.selectedIndex] ?? select.options[0];
                trigger.textContent = selectedOption?.text ?? "";
                menu.replaceChildren();
                Array.from(select.options).forEach((option) => {
                    const item = createElement("button", `evm-advanced-search-select-option${option.value === select.value ? " selected" : ""}`, option.text);
                    item.type = "button";
                    item.setAttribute("role", "option");
                    item.setAttribute("aria-selected", String(option.value === select.value));
                    item.addEventListener("click", (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        select.value = option.value;
                        syncMenu();
                        closeMenu();
                        select.dispatchEvent(new Event("change", { bubbles: true }));
                    });
                    menu.appendChild(item);
                });
            };
            trigger.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                const willOpen = menu.hidden;
                Object.values(dropdowns).forEach((dropdown) => dropdown.close());
                menu.hidden = !willOpen;
                trigger.setAttribute("aria-expanded", String(willOpen));
            });
            control.appendChild(trigger);
            control.appendChild(menu);
            wrapper.appendChild(control);
            dropdowns[key] = { sync: syncMenu, close: closeMenu };
            syncMenu();
            filterGrid.appendChild(wrapper);
        };
        addFilter("Unidad Gerencial", "unit", "UnidadGerencial");
        addFilter("Región", "region", "Region");
        addFilter("Provincia", "province", "Provincia");
        addFilter("Distrito", "district", "Distrito");
        addFilter("Estado", "status", "EstadoProyecto");
        const filterDefinitions: Array<{ key: string; field: keyof NavigatorProject; allLabel: string }> = [
            { key: "unit", field: "UnidadGerencial", allLabel: "Todas" },
            { key: "region", field: "Region", allLabel: "Todos" },
            { key: "province", field: "Provincia", allLabel: "Todos" },
            { key: "district", field: "Distrito", allLabel: "Todos" },
            { key: "status", field: "EstadoProyecto", allLabel: "Todos" }
        ];
        modal.appendChild(filterGrid);

        const toolbar = createElement("div", "evm-advanced-search-toolbar");
        const count = createElement("span");
        const clearFilters = createElement("button", "evm-advanced-search-clear", "Limpiar filtros");
        clearFilters.type = "button";
        toolbar.appendChild(count);
        toolbar.appendChild(clearFilters);
        modal.appendChild(toolbar);

        const results = createElement("div", "evm-advanced-search-results");
        const table = createElement("table");
        const head = document.createElement("thead");
        const headRow = document.createElement("tr");
        ["", "UNIDAD GERENCIAL", "CUI", "PROYECTO", "UBICACIÓN", "ESTADO"].forEach((label) => headRow.appendChild(createElement("th", undefined, label)));
        head.appendChild(headRow);
        table.appendChild(head);
        const body = document.createElement("tbody");
        table.appendChild(body);
        results.appendChild(table);
        modal.appendChild(results);

        const footer = createElement("footer", "evm-advanced-search-footer");
        const cancel = createElement("button", "secondary", "Cancelar");
        const apply = createElement("button", "primary", "Aplicar proyecto");
        cancel.type = "button";
        apply.type = "button";
        footer.appendChild(cancel);
        footer.appendChild(apply);
        modal.appendChild(footer);

        const renderResults = (): void => {
            const searchText = query.value.trim().toLocaleLowerCase("es");
            const filtered = projects.filter((project) => {
                const searchable = [project.NombreIntervencion, project.Cui, project.CUI, project.IdIntervencion]
                    .map((value) => this.navigatorText(value).toLocaleLowerCase("es"))
                    .join(" ");
                return (!searchText || searchable.includes(searchText))
                    && this.matchesFilter(project.UnidadGerencial, selectors.unit.value || null)
                    && this.matchesFilter(project.Region, selectors.region.value || null)
                    && this.matchesFilter(project.Provincia, selectors.province.value || null)
                    && this.matchesFilter(project.Distrito, selectors.district.value || null)
                    && this.matchesFilter(project.EstadoProyecto, selectors.status.value || null);
            });
            count.textContent = `${filtered.length} proyecto${filtered.length === 1 ? "" : "s"} encontrado${filtered.length === 1 ? "" : "s"}`;
            body.replaceChildren();
            filtered.forEach((project) => {
                const projectId = this.getProjectId(project);
                if (!projectId) return;
                const row = document.createElement("tr");
                row.classList.toggle("selected", projectId === selectedProjectId);
                const radioCell = document.createElement("td");
                const radio = document.createElement("input");
                radio.type = "radio";
                radio.name = "advanced-project-selection";
                radio.checked = projectId === selectedProjectId;
                radioCell.appendChild(radio);
                row.appendChild(radioCell);
                row.appendChild(createElement("td", undefined, this.navigatorText(project.UnidadGerencial)));
                row.appendChild(createElement("td", undefined, this.navigatorText(project.Cui ?? project.CUI) || "—"));
                row.appendChild(createElement("td", undefined, this.navigatorText(project.NombreIntervencion) || projectId));
                row.appendChild(createElement("td", undefined, [project.Region, project.Provincia, project.Distrito].map((value) => this.navigatorText(value)).filter(Boolean).join(" / ")));
                const statusCell = document.createElement("td");
                const statusLabel = this.navigatorText(project.EstadoProyecto) || "Sin estado";
                const normalizedStatus = statusLabel.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
                const statusTone = normalizedStatus.includes("critic")
                    ? "critical"
                    : normalizedStatus.includes("riesgo")
                        ? "risk"
                        : normalizedStatus.includes("estable")
                            ? "stable"
                            : "neutral";
                statusCell.appendChild(createElement("span", `evm-advanced-search-status ${statusTone}`, statusLabel));
                row.appendChild(statusCell);
                const selectRow = (): void => {
                    selectedProjectId = projectId;
                    renderResults();
                };
                radio.addEventListener("change", selectRow);
                row.addEventListener("click", (event) => {
                    if (event.target !== radio) selectRow();
                });
                body.appendChild(row);
            });
            apply.toggleAttribute("disabled", !selectedProjectId || !filtered.some((project) => this.getProjectId(project) === selectedProjectId));
        };

        const refreshSelectorOptions = (preferredKey?: string): void => {
            const orderedDefinitions = preferredKey
                ? [...filterDefinitions.filter((definition) => definition.key !== preferredKey), ...filterDefinitions.filter((definition) => definition.key === preferredKey)]
                : filterDefinitions;
            orderedDefinitions.forEach((definition) => {
                const select = selectors[definition.key];
                const currentValue = select.value;
                const compatibleProjects = projects.filter((project) => filterDefinitions.every((other) => (
                    other.key === definition.key || this.matchesFilter(project[other.field], selectors[other.key].value || null)
                )));
                const options = this.uniqueFromProjects(compatibleProjects, definition.field);
                select.replaceChildren(new Option(definition.allLabel, ""));
                options.forEach((option) => select.appendChild(new Option(option.label, option.value)));
                select.value = options.some((option) => option.value === currentValue) ? currentValue : "";
                dropdowns[definition.key].sync();
            });
        };

        const closeModal = (): void => overlay.remove();
        query.addEventListener("input", debounceInput(renderResults));
        filterDefinitions.forEach((definition) => selectors[definition.key].addEventListener("change", () => {
            refreshSelectorOptions(definition.key);
            renderResults();
        }));
        clearFilters.addEventListener("click", () => {
            query.value = "";
            Object.values(selectors).forEach((select) => { select.value = ""; });
            refreshSelectorOptions();
            renderResults();
        });
        close.addEventListener("click", closeModal);
        cancel.addEventListener("click", closeModal);
        overlay.addEventListener("click", (event) => {
            Object.values(dropdowns).forEach((dropdown) => dropdown.close());
            if (event.target === overlay) closeModal();
        });
        apply.addEventListener("click", () => {
            const project = projects.find((item) => this.getProjectId(item) === selectedProjectId);
            if (!project) return;
            this.applyProjectFromAdvancedSearch(project);
            closeModal();
        });

        refreshSelectorOptions();
        renderResults();
        overlay.appendChild(modal);
        host.appendChild(overlay);
        window.setTimeout(() => query.focus(), 0);
    }

    private applyProjectFromAdvancedSearch(project: NavigatorProject): void {
        const projectId = this.getProjectId(project);
        if (!projectId) return;
        const unit = this.navigatorText(project.UnidadGerencial) || null;
        this.filterState.selectedUnit = unit;
        this.filterState.selectedProjectId = projectId;
        this.filterState.lastNavigableUnit = unit ?? this.filterState.lastNavigableUnit;
        this.filterState.lastNavigableProjectId = projectId;
        this.filterState.region = this.navigatorText(project.Region) || null;
        this.filterState.province = this.navigatorText(project.Provincia) || null;
        this.filterState.district = this.navigatorText(project.Distrito) || null;
        this.filterState.status = this.navigatorText(project.EstadoProyecto) || null;
        this.pendingProjectSelectionId = projectId;
        ["unitFilter", "regionFilter", "provinceFilter", "districtFilter", "statusFilter"]
            .forEach((property) => this.clearInternalFilter(property));
        this.applyProjectFilter(projectId);
        this.renderFilterPanelIntoRoot();
    }

    private renderFilterSelect(
        label: string,
        key: string,
        options: Array<{ value: string; label: string }>,
        selectedValue: string | null,
        onChange: (value: string | null) => void,
        allowAll: boolean = true,
        disabled: boolean = false
    ): HTMLElement {
        const field = createElement("label", "evm-filter-field");
        field.appendChild(createElement("span", undefined, label));
        const select = createElement("select");
        select.setAttribute("data-filter-key", key);
        select.disabled = disabled;
        if (allowAll) {
            select.appendChild(new Option("Todos", ""));
        } else {
            select.required = true;
            select.setAttribute("aria-required", "true");
        }
        options.forEach((option) => select.appendChild(new Option(option.label, option.value)));
        const hasSelectedOption = Boolean(selectedValue) && options.some((option) => option.value === selectedValue);
        select.value = hasSelectedOption ? selectedValue as string : (allowAll ? "" : options[0]?.value ?? "");
        select.addEventListener("change", () => {
            onChange(select.value || null);
            this.renderFilterPanelIntoRoot();
        });
        field.appendChild(select);
        return field;
    }

    private filteredNavigatorProjects(): NavigatorProject[] {
        return this.navigatorProjectsForOptions(null);
    }

    private navigatorProjectsForOptions(excludedFilter: "unit" | "region" | "province" | "district" | "status" | null): NavigatorProject[] {
        const filterDefinitions: Array<{ name: "unit" | "region" | "province" | "district" | "status"; key: keyof NavigatorProject; value: string | null }> = [
            { name: "unit", key: "UnidadGerencial", value: this.filterState.selectedUnit },
            { name: "region", key: "Region", value: this.filterState.region },
            { name: "province", key: "Provincia", value: this.filterState.province },
            { name: "district", key: "Distrito", value: this.filterState.district },
            { name: "status", key: "EstadoProyecto", value: this.filterState.status }
        ];
        const activeFilters = filterDefinitions.filter((filter): filter is typeof filter & { value: string } => filter.name !== excludedFilter && Boolean(filter.value));
        const cacheKey = [
            this.navigatorIndex.revision,
            excludedFilter ?? "*",
            ...activeFilters.map((filter) => String(filter.key) + "=" + filter.value)
        ].join("|");
        const cached = this.filteredProjectsCache.get(cacheKey);
        if (cached) return cached;
        const indexedProjects = this.navigatorProjectCatalog;
        const projects = indexedProjects.length
            ? this.navigatorIndex.candidates(activeFilters.map(({ key, value }) => ({ key, value })))
            : this.currentDashboardData?.navigator?.projects ?? this.currentDashboardData?.projects ?? [];
        const filtered = projects.filter((project) => {
            return (excludedFilter === "unit" || this.matchesFilter(project.UnidadGerencial, this.filterState.selectedUnit))
                && (excludedFilter === "region" || this.matchesFilter(project.Region, this.filterState.region))
                && (excludedFilter === "province" || this.matchesFilter(project.Provincia, this.filterState.province))
                && (excludedFilter === "district" || this.matchesFilter(project.Distrito, this.filterState.district))
                && (excludedFilter === "status" || this.matchesFilter(project.EstadoProyecto, this.filterState.status));
        });
        this.filteredProjectsCache.set(cacheKey, filtered);
        if (this.filteredProjectsCache.size > 40) {
            const oldest = this.filteredProjectsCache.keys().next().value as string | undefined;
            if (oldest !== undefined) this.filteredProjectsCache.delete(oldest);
        }
        return filtered;
    }

    private reconcileProjectSelection(): void {
        const availableProjects = this.projectOptions(this.navigatorProjectsForOptions(null));
        const currentIsAvailable = availableProjects.some((project) => project.value === this.filterState.selectedProjectId);
        if (currentIsAvailable) {
            return;
        }

        const nextProject = availableProjects[0]?.value ?? null;
        this.filterState.selectedProjectId = nextProject;
        this.filterState.lastNavigableProjectId = nextProject ?? this.filterState.lastNavigableProjectId;
        if (nextProject) {
            this.applyProjectFilter(nextProject);
            this.applyBasicFilter("Dim_Intervenciones", "IdIntervencion", [nextProject], "projectFilter");
        } else {
            this.clearInternalFilter("projectFilter");
        }
    }

    private uniqueNavigatorValues(key: keyof NavigatorProject): Array<{ value: string; label: string }> {
        return this.uniqueFromProjects(this.currentDashboardData?.navigator?.projects ?? [], key);
    }

    private uniqueFromProjects(projects: NavigatorProject[], key: keyof NavigatorProject): Array<{ value: string; label: string }> {
        const values = new Set<string>();
        projects.forEach((project) => {
            const value = this.navigatorText(project[key]);
            if (value) {
                values.add(value);
            }
        });
        return Array.from(values).sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }));
    }

    private projectOptions(projects: NavigatorProject[]): Array<{ value: string; label: string }> {
        return projects
            .map((project) => ({
                value: this.navigatorText(project.IdIntervencion),
                label: this.navigatorText(project.NombreIntervencion) || this.navigatorText(project.IdIntervencion)
            }))
            .filter((option) => option.value.length > 0)
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    private rememberNavigatorProjects(projects: NavigatorProject[]): void {
        this.navigatorIndex.add(projects);
    }

    private get navigatorProjectCatalog(): NavigatorProject[] {
        return this.navigatorIndex.values();
    }

    private matchesFilter(value: unknown, filter: string | null): boolean {
        return !filter || this.navigatorText(value) === filter;
    }

    private navigatorText(value: unknown): string {
        return value === null || value === undefined ? "" : String(value);
    }

    private handleNavigationClick(level: "PRONIED" | "UNIDAD" | "PROYECTO", unit: string | null = null, projectId: string | null = null): void {
        this.navigationDebug.clickCount += 1;
        this.navigationDebug.lastAction = `Click navegación ${level}`;
        this.navigationDebug.requestedLevel = level;
        this.navigationDebug.requestedUnit = unit;
        this.navigationDebug.requestedProjectId = projectId;
        this.navigationDebug.applyJsonFilterCalled = false;
        this.navigationDebug.timestamp = new Date().toISOString();
        this.renderNavigationDebugPanel();
        this.navigateLevelForDebug(level);
    }

    private navigateLevelForDebug(
        level: "PRONIED" | "UNIDAD" | "PROYECTO"
    ): void {
        try {
            this.navigationDebug.applyJsonFilterCalled = true;
            this.navigationDebug.lastAction = "Ejecutando applyJsonFilter";
            this.navigationDebug.requestedLevel = level;
            this.navigationDebug.lastFilterJson = JSON.stringify({ level });
            this.navigationDebug.lastError = null;
            this.navigationDebug.timestamp = new Date().toISOString();

            this.renderNavigationDebugPanel();

            this.applyLevelFilter(level);
            this.navigationDebug.lastAction = "applyJsonFilter finalizó sin excepción";
            this.navigationDebug.timestamp = new Date().toISOString();
            this.renderNavigationDebugPanel();
        } catch (error) {
            this.navigationDebug.lastAction = "Error en applyJsonFilter";
            this.navigationDebug.lastError = error instanceof Error
                ? error.message
                : String(error);
            this.navigationDebug.timestamp = new Date().toISOString();
            this.renderNavigationDebugPanel();
        }
    }

    private applyLevelFilter(level: DashboardLevel, force: boolean = false): void {
        this.navigationFilters.applyBasic(`level:${level}`, { table: "Dim_NivelDashboard", column: "Nivel" }, [level], force);
    }

    private applyProjectDashboardFilters(projectId: string): void {
        const cleanProjectId = projectId.trim();
        if (!cleanProjectId) return;
        this.navigationFilters.applyTuple(
            `project-dashboard:${cleanProjectId}`,
            [
                { table: "Dim_NivelDashboard", column: "Nivel" },
                { table: "Dim_Intervenciones", column: "IdIntervencion" }
            ],
            [["PROYECTO", cleanProjectId]]
        );
    }

    private clearGeneralNavigationFilters(force: boolean = false): void {
        this.navigationFilters.clear(force);
    }

    private applyProjectFilter(projectId: string): void {
        const cleanProjectId = projectId.trim();
        if (!cleanProjectId) {
            if (this.navigationDebugPanelEnabled) {
                this.navigationDebug.lastError = "IdIntervencion vacío";
                this.navigationDebug.lastAction = "Navegación cancelada";
                this.renderNavigationDebugPanel();
            }
            return;
        }
        this.navigationFilters.applyBasic(
            `project:${cleanProjectId}`,
            { table: "Dim_Intervenciones", column: "IdIntervencion" },
            [cleanProjectId]
        );
    }

    private testProjectNavigationFilter(projectId: string): void {
        this.navigationDebug.clickCount += 1;
        this.navigationDebug.requestedLevel = "PROYECTO";
        this.navigationDebug.requestedProjectId = projectId;
        this.navigationDebug.clickedProjectId = projectId;
        this.navigationDebug.clickedProjectIdType = typeof projectId;
        this.navigationDebug.applyJsonFilterCalled = true;
        this.navigationDebug.externalProjectFilterApplied = false;
        this.navigationDebug.selfProjectFilterApplied = false;
        this.navigationDebug.lastAction = "Prueba temporal de proyecto";
        this.navigationDebug.lastFilterJson = JSON.stringify({ projectId });
        this.navigationDebug.timestamp = new Date().toISOString();
        this.renderNavigationDebugPanel();

        this.applyProjectFilter(projectId);
        this.navigationDebug.externalProjectFilterApplied = true;
        this.navigationDebug.selfProjectFilterApplied = true;
        this.navigationDebug.lastAction = "Filtro de proyecto enviado";
        this.navigationDebug.timestamp = new Date().toISOString();
        this.renderNavigationDebugPanel();
    }

    private readUpdateJsonFilters(options: VisualUpdateOptions): unknown[] {
        const candidate = options as VisualUpdateOptions & { jsonFilters?: unknown[] };
        return Array.isArray(candidate.jsonFilters) ? candidate.jsonFilters : [];
    }

    private summarizeJsonFilters(filters: unknown[]): string {
        if (!filters.length) {
            return "";
        }

        return filters.map((filter, index) => {
            const item = this.asRecord(filter);
            const target = this.asRecord(item?.target);
            const rawValues = item?.values;
            const operator = this.toDebugText(item?.operator);
            const values = Array.isArray(rawValues)
                ? rawValues.map((value) => this.toDebugText(value)).join(", ")
                : this.toDebugText(rawValues);
            const propertyName = this.toDebugText(item?.propertyName ?? item?.property ?? item?.propertyIdentifier);
            const table = this.toDebugText(target?.table);
            const column = this.toDebugText(target?.column);
            const targetLabel = table || column ? `${table || "?"}[${column || "?"}]` : "-";
            const propertyLabel = propertyName ? `propiedad ${propertyName}; ` : "";
            return `Filtro ${index + 1}: ${propertyLabel}${targetLabel}; operador ${operator || "-"}; valores ${values || "-"}`;
        }).join("\n");
    }

    private asRecord(value: unknown): Record<string, unknown> | null {
        return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
    }

    private toDebugText(value: unknown): string {
        if (value === null || value === undefined) {
            return "";
        }
        return typeof value === "string" ? value : JSON.stringify(value);
    }

    private applyBasicFilter(table: string, column: string, values: Array<string | number>, propertyName: string, force: boolean = false): void {
        const nextValue = values[0] ?? null;
        if (nextValue === null) {
            this.internalFilters.remove(propertyName);
            return;
        }
        this.internalFilters.set(propertyName, { table, column }, nextValue);
    }

    private clearInternalFilter(propertyName: string, _force: boolean = false): void {
        this.internalFilters.remove(propertyName);
    }

    private restoreDefaultProjectFilters(): void {
        const projectId = this.defaultProjectId;
        if (!projectId) {
            return;
        }
        const project = this.navigatorIndex.get(projectId)
            ?? this.currentDashboardData?.navigator?.projects.find((item) => this.getProjectId(item) === projectId)
            ?? null;
        if (!project) {
            return;
        }

        const unit = this.navigatorText(project.UnidadGerencial) || null;
        this.filterState.selectedUnit = unit;
        this.filterState.selectedProjectId = projectId;
        this.filterState.lastNavigableUnit = unit ?? this.filterState.lastNavigableUnit;
        this.filterState.lastNavigableProjectId = projectId;
        this.filterState.region = this.navigatorText(project.Region) || null;
        this.filterState.province = this.navigatorText(project.Provincia) || null;
        this.filterState.district = this.navigatorText(project.Distrito) || null;
        this.filterState.status = this.navigatorText(project.EstadoProyecto) || null;
        this.pendingProjectSelectionId = projectId;
        ["unitFilter", "regionFilter", "provinceFilter", "districtFilter", "statusFilter"]
            .forEach((property) => this.clearInternalFilter(property));
        this.applyProjectFilter(projectId);
        this.renderFilterPanelIntoRoot();
    }

    private clearAllInteractiveFilters(): void {
        this.navigationFilters.clear(true);
        ["unitFilter", "regionFilter", "provinceFilter", "districtFilter", "statusFilter", "projectFilter"]
            .forEach((property) => this.clearInternalFilter(property));
        this.filterState.level = "PRONIED";
        this.filterState.selectedUnit = null;
        this.filterState.selectedProjectId = null;
        this.filterState.region = null;
        this.filterState.province = null;
        this.filterState.district = null;
        this.filterState.status = null;
        this.closeFilterPanel();
    }

    private clearProjectDimensionFilters(): void {
        ["unitFilter", "regionFilter", "provinceFilter", "districtFilter", "statusFilter"]
            .forEach((property) => this.clearInternalFilter(property));
        this.filterState.selectedUnit = null;
        this.filterState.region = null;
        this.filterState.province = null;
        this.filterState.district = null;
        this.filterState.status = null;
    }

    private formatInteger(value: DataValue): string {
        const parsed = numberValue(value);
        return parsed === null ? "—" : parsed.toLocaleString("en-US", { maximumFractionDigits: 0 });
    }

    private openGaugeHistoryModal(selectedGaugeKey?: GaugeMetricKey): void {
        const dashboard = this.currentDashboardData;
        const hasRows = dashboard?.context.Level === "PROYECTO"
            ? Boolean(dashboard.gauges.length)
            : Boolean(dashboard?.aggregateGauges.length);
        if (!dashboard || !hasRows) {
            return;
        }

        this.selectedGaugeKey = selectedGaugeKey ?? this.selectedGaugeKey;
        this.visibleGaugeSeries = ["CPI", "SPI (w)", "TCPI", "TSPI (w)"];
        this.isGaugeHistoryModalOpen = true;
        this.renderGaugeHistoryModal();
        this.viewLifecycle.listen(this.target.ownerDocument, "keydown", this.handleGaugeModalKeydown);
    }

    private closeGaugeHistoryModal(): void {
        this.isGaugeHistoryModalOpen = false;
        this.removeExistingGaugeHistoryModal();
        this.target.ownerDocument.removeEventListener("keydown", this.handleGaugeModalKeydown);
    }

    private renderGaugeHistoryModal(): void {
        this.removeExistingGaugeHistoryModal();

        const renderData = this.gaugeHistoryRenderData();
        if (!this.rootElement || !renderData) {
            return;
        }

        this.rootElement.classList.add("evm-gauge-history-modal-open");
        this.rootElement.querySelectorAll(".evm-cpi-help.open").forEach((help) => help.classList.remove("open"));
        this.rootElement.querySelectorAll<HTMLButtonElement>(".evm-cpi-help-button").forEach((button) => {
            button.disabled = true;
            button.setAttribute("aria-expanded", "false");
        });

        const overlay = document.createElement("div");
        overlay.className = "gauge-history-modal-overlay";
        overlay.addEventListener("click", () => this.closeGaugeHistoryModal());

        const modal = document.createElement("section");
        modal.className = "gauge-history-modal";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.addEventListener("click", (event) => {
            event.stopPropagation();
        });

        modal.appendChild(this.renderGaugeHistoryHeader());
        modal.appendChild(this.renderGaugeHistoryBody(renderData.series, renderData.weekRange));
        overlay.appendChild(modal);
        this.rootElement.appendChild(overlay);
    }

    private openCriticalInterventionsModal(interventions: CriticalIntervention[]): void {
        const host = this.rootElement;
        if (!host || this.currentDashboardData?.context.Level !== "PRONIED") {
            return;
        }

        this.closeCriticalInterventionsModal();
        host.classList.add("evm-critical-modal-open");
        host.querySelectorAll(".evm-cpi-help.open").forEach((help) => help.classList.remove("open"));
        const overlay = createElement("div", "evm-critical-modal-overlay");
        const modal = createElement("section", "evm-critical-modal");
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-label", "Detalle de intervenciones críticas");

        const header = createElement("header", "evm-critical-modal-header");
        const heading = createElement("div");
        heading.appendChild(createElement("h2", undefined, "Intervenciones Críticas"));
        heading.appendChild(createElement(
            "p",
            undefined,
            `${interventions.length} ${interventions.length === 1 ? "intervención requiere atención" : "intervenciones requieren atención"}`
        ));
        const closeButton = createElement("button", "evm-critical-modal-close", "×") as HTMLButtonElement;
        closeButton.type = "button";
        closeButton.setAttribute("aria-label", "Cerrar");
        closeButton.addEventListener("click", () => this.closeCriticalInterventionsModal());
        header.append(heading, closeButton);

        const body = createElement("div", "evm-critical-modal-body");
        if (interventions.length === 0) {
            body.appendChild(createElement(
                "p",
                "evm-critical-modal-empty",
                "No se encontraron intervenciones críticas para el contexto seleccionado."
            ));
        } else {
            interventions.forEach((intervention) => body.appendChild(this.renderCriticalIntervention(intervention)));
        }

        modal.append(header, body);
        modal.addEventListener("click", (event) => event.stopPropagation());
        overlay.addEventListener("click", () => this.closeCriticalInterventionsModal());
        overlay.appendChild(modal);
        host.appendChild(overlay);
        document.addEventListener("keydown", this.handleCriticalModalKeydown);
        closeButton.focus();
    }

    private renderCriticalIntervention(intervention: CriticalIntervention): HTMLElement {
        const card = createElement("article", "evm-critical-detail-card");
        const meta = createElement("div", "evm-critical-detail-meta");
        meta.appendChild(this.renderCriticalMetaItem("Unidad Gerencial", intervention.ManagementUnit));
        meta.appendChild(this.renderCriticalMetaItem("CUI", intervention.CUI));
        if (intervention.Location !== undefined && intervention.Location !== null && String(intervention.Location).trim()) {
            meta.appendChild(this.renderCriticalMetaItem("Ubicación", intervention.Location));
        }
        const status = createElement("div", "evm-critical-detail-status");
        const badge = createElement("strong", "evm-critical-status-badge");
        badge.appendChild(createElement("i"));
        badge.appendChild(document.createTextNode(this.criticalText(intervention.Status)));
        status.appendChild(badge);
        status.appendChild(createElement("span", undefined, `Semana de corte: ${this.criticalText(intervention.CutoffWeek)}`));
        meta.appendChild(status);
        card.appendChild(meta);

        const project = createElement("div", "evm-critical-detail-project");
        project.appendChild(createElement("span", undefined, "Proyecto / Intervención"));
        project.appendChild(createElement("h3", undefined, this.criticalText(intervention.Project)));
        card.appendChild(project);

        const metrics = createElement("div", "evm-critical-detail-metrics");
        metrics.appendChild(this.renderCriticalMetricGroup(
            "Línea base",
            "baseline",
            [["BAC", intervention.BAC], ["SAC", intervention.SAC]]
        ));
        metrics.appendChild(this.renderCriticalMetricGroup(
            "Avance",
            "progress",
            [["PV", intervention.PV], ["EV", intervention.EV], ["AC", intervention.AC]]
        ));
        metrics.appendChild(this.renderCriticalMetricGroup(
            "Desempeño",
            "performance",
            [["CPI", intervention.CPI], ["SPI", intervention.SPI]]
        ));
        card.appendChild(metrics);
        return card;
    }

    private renderCriticalMetaItem(label: string, value: unknown): HTMLElement {
        const item = createElement("div", "evm-critical-meta-item");
        item.appendChild(createElement("span", undefined, label));
        item.appendChild(createElement("strong", undefined, this.criticalText(value)));
        return item;
    }

    private renderCriticalMetricGroup(
        title: string,
        tone: "performance" | "baseline" | "progress",
        values: Array<["CPI" | "SPI" | "BAC" | "SAC" | "PV" | "EV" | "AC", unknown]>
    ): HTMLElement {
        const group = createElement("section", `evm-critical-metric-group is-${tone}`);
        const header = createElement("header", "evm-critical-metric-group-header");
        header.appendChild(createElement("strong", undefined, title));
        group.appendChild(header);
        const grid = createElement("div", "evm-critical-metric-group-values");
        values.forEach(([key, value]) => {
            const metric = createElement("div", "evm-critical-detail-metric");
            metric.appendChild(createElement("span", undefined, key));
            metric.appendChild(createElement("strong", undefined, this.formatCriticalMetric(key, value)));
            grid.appendChild(metric);
        });
        group.appendChild(grid);
        return group;
    }

    private formatCriticalMetric(key: "CPI" | "SPI" | "BAC" | "SAC" | "PV" | "EV" | "AC", value: unknown): string {
        const parsed = numberValue(value as DataValue);
        if (parsed === null) return "—";
        if (key === "CPI" || key === "SPI") {
            return parsed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return parsed.toLocaleString("en-US", { maximumFractionDigits: 2 });
    }

    private criticalText(value: unknown): string {
        return value === null || value === undefined || String(value).trim() === "" ? "—" : String(value);
    }

    private closeCriticalInterventionsModal(): void {
        document.removeEventListener("keydown", this.handleCriticalModalKeydown);
        this.rootElement?.classList.remove("evm-critical-modal-open");
        this.rootElement?.querySelector(".evm-critical-modal-overlay")?.remove();
    }

    private gaugeHistoryRenderData(): { series: GaugeChartSeries[]; weekRange: { min: number; max: number } } | null {
        const dashboard = this.currentDashboardData;
        const hasRows = dashboard?.context.Level === "PROYECTO"
            ? Boolean(dashboard.gauges.length)
            : Boolean(dashboard?.aggregateGauges.length);
        if (!dashboard || !hasRows) return null;

        const aggregateRows = dashboard.context.Level === "PROYECTO" ? [] : this.windowAggregateGaugeRows(dashboard);
        const rawSeries = dashboard.context.Level === "PROYECTO"
            ? this.buildGaugeHistorySeries(dashboard.gauges)
            : this.buildAggregateGaugeHistorySeries(aggregateRows);
        const weekRange = this.gaugeHistoryWeekRange(dashboard, rawSeries);
        return {
            weekRange,
            series: rawSeries.map((item) => ({
                ...item,
                points: item.points.filter((point) => point.week >= weekRange.min && point.week <= weekRange.max)
            }))
        };
    }

    private renderGaugeHistoryHeader(): HTMLElement {
        const header = document.createElement("header");
        header.className = "gauge-history-modal-header";

        const icon = document.createElement("div");
        icon.className = "gauge-history-modal-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "↗";

        const titleGroup = document.createElement("div");
        titleGroup.className = "gauge-history-modal-heading";
        const title = document.createElement("h2");
        title.className = "gauge-history-modal-title";
        title.textContent = this.currentDashboardData?.context.Level === "PROYECTO"
            ? "Histórico de indicadores del proyecto"
            : "Histórico de indicadores consolidados";
        const subtitle = document.createElement("p");
        subtitle.className = "gauge-history-modal-subtitle";
        subtitle.textContent = this.gaugeHistorySubtitle();
        titleGroup.appendChild(title);
        titleGroup.appendChild(subtitle);

        const close = document.createElement("button");
        close.className = "gauge-history-modal-close";
        close.type = "button";
        close.setAttribute("aria-label", "Cerrar histórico de indicadores");
        close.textContent = "×";
        close.addEventListener("click", () => this.closeGaugeHistoryModal());

        header.appendChild(icon);
        header.appendChild(titleGroup);
        header.appendChild(close);
        return header;
    }

    private renderGaugeHistoryBody(series: GaugeChartSeries[], weekRange: { min: number; max: number }): HTMLElement {
        const body = document.createElement("div");
        body.className = "gauge-history-modal-body";

        const chartCard = document.createElement("div");
        chartCard.className = "gauge-history-chart-card";
        const chartWrap = document.createElement("div");
        chartWrap.className = "gauge-history-modal-chart";
        const tooltip = document.createElement("div");
        tooltip.className = "gauge-history-tooltip";
        chartWrap.appendChild(this.renderGaugeHistoryChart(series, tooltip, weekRange));
        chartWrap.appendChild(tooltip);
        chartCard.appendChild(chartWrap);
        chartCard.appendChild(this.renderGaugeHistoryBottomLegend(series));

        body.appendChild(chartCard);
        return body;
    }

    private renderGaugeHistoryChart(
        series: GaugeChartSeries[],
        tooltip: HTMLElement,
        weekRange: { min: number; max: number }
    ): SVGSVGElement {
        const width = 1220;
        const height = 760;
        const plot = { left: 92, top: 38, width: 1080, height: 610 };
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        svg.setAttribute("class", "gauge-history-chart-svg");

        const visibleSeries = series.filter((item) => this.visibleGaugeSeries.includes(item.key) && item.points.length);
        const allPoints = visibleSeries.flatMap((item) => item.points);
        const allValues = allPoints.map((point) => point.value);
        const minWeek = weekRange.min;
        const maxWeek = weekRange.max;
        const rawYMax = Math.max(1.5, ...allValues);
        const yMax = rawYMax <= 1.5 ? 1.5 : Math.ceil((rawYMax * 1.05) / 0.25) * 0.25;
        const xSpan = Math.max(1, maxWeek - minWeek);
        const xScale = (week: number): number => plot.left + ((week - minWeek) / xSpan) * plot.width;
        const yScale = (value: number): number => plot.top + plot.height - (value / yMax) * plot.height;

        this.drawGaugeChartAxes(svg, plot, minWeek, maxWeek, yMax, xScale, yScale);
        visibleSeries.forEach((item) => this.drawGaugeChartSeries(svg, item, xScale, yScale));
        this.appendGaugeChartHover(svg, visibleSeries, plot, xScale, width, height, tooltip);
        return svg;
    }

    private drawGaugeChartAxes(
        svg: SVGSVGElement,
        plot: { left: number; top: number; width: number; height: number },
        minWeek: number,
        maxWeek: number,
        yMax: number,
        xScale: (week: number) => number,
        yScale: (value: number) => number
    ): void {
        this.appendSvgLine(svg, plot.left, plot.top, plot.left, plot.top + plot.height, "gauge-history-axis");
        this.appendSvgLine(svg, plot.left, plot.top + plot.height, plot.left + plot.width, plot.top + plot.height, "gauge-history-axis");

        const tickStep = yMax > 1.75 ? 0.5 : 0.25;
        const tickMax = Math.ceil(yMax / tickStep) * tickStep;
        for (let value = 0; value <= tickMax + 0.001; value += tickStep) {
            const y = yScale(value);
            this.appendSvgLine(svg, plot.left, y, plot.left + plot.width, y, value === 0 ? "gauge-history-axis" : "gauge-history-grid");
            this.appendSvgText(svg, value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), plot.left - 14, y + 5, "end", "gauge-history-axis-label");
        }

        const firstWeek = Math.ceil(minWeek);
        const lastWeek = Math.floor(maxWeek);
        const weekTickStep = Math.max(1, Math.ceil((lastWeek - firstWeek) / 10));
        for (let week = firstWeek; week <= lastWeek; week += weekTickStep) {
            const x = xScale(week);
            this.appendSvgLine(svg, x, plot.top + plot.height, x, plot.top + plot.height + 12, "gauge-history-axis");
            this.appendSvgText(svg, `S-${week}`, x, plot.top + plot.height + 42, "middle", "gauge-history-axis-label");
        }

        this.appendSvgText(svg, "Indicador", plot.left - 72, plot.top - 16, "start", "gauge-history-axis-title");
        this.appendSvgText(svg, "Semana", plot.left + plot.width / 2, plot.top + plot.height + 84, "middle", "gauge-history-axis-title");
    }

    private drawGaugeChartSeries(
        svg: SVGSVGElement,
        series: GaugeChartSeries,
        xScale: (week: number) => number,
        yScale: (value: number) => number
    ): void {
        if (!series.points.length) {
            return;
        }

        const color = gaugeMetricColors[series.key];
        const selected = this.selectedGaugeKey === series.key;
        const dimmed = this.selectedGaugeKey !== null && !selected;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", series.points.map((point, index) => `${index === 0 ? "M" : "L"} ${xScale(point.week)} ${yScale(point.value)}`).join(" "));
        path.setAttribute("class", `gauge-history-line${selected ? " selected" : ""}${dimmed ? " dimmed" : ""}`);
        path.setAttribute("stroke", color);
        svg.appendChild(path);

        series.points.forEach((point, index) => {
            const x = xScale(point.week);
            const y = yScale(point.value);
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", String(x));
            circle.setAttribute("cy", String(y));
            circle.setAttribute("r", selected ? "8" : "6.5");
            circle.setAttribute("fill", color);
            circle.setAttribute("class", dimmed ? "gauge-history-point dimmed" : "gauge-history-point");
            svg.appendChild(circle);
        });
    }

    private appendGaugeChartHover(
        svg: SVGSVGElement,
        series: GaugeChartSeries[],
        plot: { left: number; top: number; width: number; height: number },
        xScale: (week: number) => number,
        width: number,
        height: number,
        tooltip: HTMLElement
    ): void {
        const weeks = Array.from(new Set(series.flatMap((item) => item.points.map((point) => point.week)))).sort((a, b) => a - b);
        if (!weeks.length) {
            return;
        }

        const hoverLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        hoverLine.setAttribute("y1", String(plot.top));
        hoverLine.setAttribute("y2", String(plot.top + plot.height));
        hoverLine.setAttribute("class", "gauge-history-hover-line");
        hoverLine.setAttribute("visibility", "hidden");
        svg.appendChild(hoverLine);

        const hitbox = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        hitbox.setAttribute("x", String(plot.left));
        hitbox.setAttribute("y", String(plot.top));
        hitbox.setAttribute("width", String(plot.width));
        hitbox.setAttribute("height", String(plot.height));
        hitbox.setAttribute("class", "gauge-history-hover-hitbox");

        let pendingFrame: number | null = null;
        let pendingEvent: MouseEvent | null = null;
        let lastWeek: number | null = null;
        const nearestWeek = (x: number): number => {
            let low = 0;
            let high = weeks.length - 1;
            while (low < high) {
                const middle = Math.floor((low + high) / 2);
                if (xScale(weeks[middle]) < x) low = middle + 1;
                else high = middle;
            }
            if (low === 0) return weeks[0];
            const previous = weeks[low - 1];
            return Math.abs(xScale(previous) - x) <= Math.abs(xScale(weeks[low]) - x) ? previous : weeks[low];
        };
        const updateHover = (event: MouseEvent): void => {
            const pointer = this.svgPointer(svg, event, width, height);
            const clampedX = Math.min(plot.left + plot.width, Math.max(plot.left, pointer.x));
            const week = nearestWeek(clampedX);
            const x = xScale(week);
            hoverLine.setAttribute("x1", String(x));
            hoverLine.setAttribute("x2", String(x));
            hoverLine.setAttribute("visibility", "visible");
            if (week !== lastWeek) {
                lastWeek = week;
                this.showGaugeWeekTooltip(tooltip, series, week);
            }
        };
        hitbox.addEventListener("mousemove", (event: MouseEvent) => {
            pendingEvent = event;
            if (pendingFrame !== null) return;
            pendingFrame = requestAnimationFrame(() => {
                pendingFrame = null;
                if (pendingEvent) updateHover(pendingEvent);
            });
        });

        hitbox.addEventListener("mouseleave", () => {
            pendingEvent = null;
            lastWeek = null;
            hoverLine.setAttribute("visibility", "hidden");
            this.hideGaugeTooltip(tooltip);
        });

        svg.appendChild(hitbox);
    }

    private renderGaugeHistoryLegend(series: GaugeChartSeries[]): HTMLElement {
        const legend = document.createElement("div");
        legend.className = "gauge-history-legend";

        series.forEach((item) => {
            const button = document.createElement("button");
            const active = this.visibleGaugeSeries.includes(item.key);
            button.type = "button";
            button.className = `gauge-history-legend-item${active ? " active" : " gauge-history-legend-item--inactive"}`;
            button.style.setProperty("--series-color", gaugeMetricColors[item.key]);
            button.textContent = item.label;
            button.addEventListener("click", () => {
                this.toggleGaugeSeries(item.key);
            });
            legend.appendChild(button);
        });

        return legend;
    }

    private renderGaugeHistoryInfo(): HTMLElement {
        const footer = document.createElement("div");
        footer.className = "gauge-history-side-panel";
        const lastWeek = this.lastGaugeWeek(this.currentDashboardData?.gauges ?? []);
        const info = document.createElement("div");
        info.className = "gauge-history-info-card";
        const infoIcon = document.createElement("span");
        infoIcon.textContent = "i";
        const text = document.createElement("p");
        text.textContent = "CPI y SPI: valores >= 1.00 son favorables. TCPI y TSPI: interpretar según el esfuerzo futuro requerido.";
        info.appendChild(infoIcon);
        info.appendChild(text);

        const definitions = document.createElement("div");
        definitions.className = "gauge-history-definition-list";
        this.gaugeDefinitionItems().forEach((item) => {
            const row = document.createElement("div");
            row.className = "gauge-history-definition-item";
            row.style.setProperty("--series-color", gaugeMetricColors[item.key]);
            const label = document.createElement("strong");
            label.textContent = item.label;
            const description = document.createElement("p");
            description.textContent = item.description;
            row.appendChild(label);
            row.appendChild(description);
            definitions.appendChild(row);
        });

        const update = document.createElement("div");
        update.className = "gauge-history-update-card";
        const updatedIcon = document.createElement("span");
        updatedIcon.textContent = "S";
        const updatedText = document.createElement("strong");
        updatedText.textContent = lastWeek === null ? "Sin semana de actualización" : `Datos actualizados a la Semana S-${lastWeek}`;
        update.appendChild(updatedIcon);
        update.appendChild(updatedText);
        footer.appendChild(info);
        footer.appendChild(definitions);
        footer.appendChild(update);
        return footer;
    }

    private renderGaugeHistoryUpdate(): HTMLElement {
        const lastWeek = this.lastGaugeWeek(this.currentDashboardData?.gauges ?? []);
        const update = document.createElement("div");
        update.className = "gauge-history-update-card gauge-history-update-card--compact";
        const updatedIcon = document.createElement("span");
        updatedIcon.textContent = "S";
        const updatedText = document.createElement("strong");
        updatedText.textContent = lastWeek === null ? "Sin semana de actualización" : `Datos actualizados a la Semana S-${lastWeek}`;
        update.appendChild(updatedIcon);
        update.appendChild(updatedText);
        return update;
    }

    private renderGaugeHistoryBottomLegend(series: GaugeChartSeries[]): HTMLElement {
        const legend = document.createElement("div");
        legend.className = "gauge-history-bottom-legend";
        series.forEach((item) => {
            const label = document.createElement("span");
            label.className = "gauge-history-bottom-legend-item";
            label.style.setProperty("--series-color", gaugeMetricColors[item.key]);
            label.textContent = this.shortGaugeLabel(item.key);
            legend.appendChild(label);
        });
        return legend;
    }

    private gaugeDefinitionItems(): Array<{ key: GaugeMetricKey; label: string; description: string }> {
        return [
            { key: "CPI", label: "CPI", description: "Índice de Desempeño de Costo" },
            { key: "SPI (w)", label: "SPI", description: "Índice de Desempeño de Plazo" },
            { key: "TCPI", label: "TCPI", description: "Rendimiento de los costos futuros requerido para completar el proyecto en el presupuesto base" },
            { key: "TSPI (w)", label: "TSPI", description: "Rendimiento del tiempo futuro requerido para completar el proyecto en el tiempo programado" }
        ];
    }

    private toggleGaugeSeries(key: GaugeMetricKey): void {
        const isVisible = this.visibleGaugeSeries.includes(key);
        if (isVisible && this.visibleGaugeSeries.length === 1) {
            return;
        }

        this.visibleGaugeSeries = isVisible
            ? this.visibleGaugeSeries.filter((item) => item !== key)
            : [...this.visibleGaugeSeries, key];
        const renderData = this.gaugeHistoryRenderData();
        const currentBody = this.rootElement?.querySelector(".gauge-history-modal-body");
        if (renderData && currentBody) {
            currentBody.replaceWith(this.renderGaugeHistoryBody(renderData.series, renderData.weekRange));
        }
    }

    private buildGaugeHistorySeries(rows: GaugeHistoryRow[]): GaugeChartSeries[] {
        const orderedRows = rows;
        const definitions: Array<{ key: GaugeMetricKey; label: string }> = [
            { key: "SPI (w)", label: "SPI" },
            { key: "CPI", label: "CPI" },
            { key: "TCPI", label: "TCPI" },
            { key: "TSPI (w)", label: "TSPI" }
        ];

        return definitions.map((definition) => ({
            key: definition.key,
            label: definition.label,
            points: orderedRows
                .map((row) => ({
                    week: row.Semana,
                    value: row[definition.key]
                }))
                .filter((point): point is GaugeChartPoint => typeof point.value === "number" && Number.isFinite(point.value))
        }));
    }

    private gaugeHistoryWeekRange(
        dashboard: ParsedDashboardData,
        series: GaugeChartSeries[]
    ): { min: number; max: number } {
        if (dashboard.context.Level === "PROYECTO") {
            const curve = adaptJsonDashboardData(dashboard).curve;
            const references = curve.references;
            const atWeek = numberValue(references.AT);
            const gaugeWeeks = series
                .flatMap((item) => item.points.map((point) => point.week))
                .filter((week) => week >= 1);
            const lastGaugeWeek = gaugeWeeks.length ? Math.max(...gaugeWeeks) : 1;
            const max = Math.max(1, atWeek ?? lastGaugeWeek);
            const min = Math.max(1, max - 5);
            return { min, max };
        }

        const weeks = series.flatMap((item) => item.points.map((point) => point.week)).filter((week) => week >= 1);
        const min = weeks.length ? Math.min(...weeks) : 1;
        const max = weeks.length ? Math.max(...weeks) : min + 1;
        return { min, max: Math.max(max, min + 1) };
    }

    private buildAggregateGaugeHistorySeries(rows: AggregateGaugeData[]): GaugeChartSeries[] {
        const orderedRows = rows;
        const definitions: Array<{ key: GaugeMetricKey; label: string; value: (row: AggregateGaugeData) => number | null }> = [
            { key: "SPI (w)", label: "SPI", value: (row) => row.SPIW },
            { key: "CPI", label: "CPI", value: (row) => row.CPI },
            { key: "TCPI", label: "TCPI", value: (row) => row.TCPI },
            { key: "TSPI (w)", label: "TSPI", value: (row) => row.TSPIW }
        ];

        return definitions.map((definition) => ({
            key: definition.key,
            label: definition.label,
            points: orderedRows
                .map((row) => ({ week: row.OrdenSemana, value: definition.value(row) }))
                .filter((point): point is GaugeChartPoint => typeof point.value === "number" && Number.isFinite(point.value))
        }));
    }

    private gaugeHistorySubtitle(): string {
        const dashboard = this.currentDashboardData;
        if (!dashboard) {
            return "Portafolio";
        }
        if (dashboard.context.Level === "PRONIED") {
            return "PRONIED — Portafolio General";
        }
        if (dashboard.context.Level === "UNIDAD") {
            const unitName = text(dashboard.context.Unit, "UGEO");
            return `${unitName} — Portafolio ${unitName}`;
        }
        return dashboard.project?.NombreIntervencion || dashboard.idIntervencion || "Proyecto sin nombre";
    }

    private lastGaugeWeek(rows: GaugeHistoryRow[]): number | null {
        const weeks = rows.map((row) => row.Semana).filter((week) => Number.isFinite(week));
        return weeks.length ? Math.max(...weeks) : null;
    }

    private removeExistingGaugeHistoryModal(): void {
        this.rootElement?.classList.remove("evm-gauge-history-modal-open");
        this.rootElement?.querySelectorAll<HTMLButtonElement>(".evm-cpi-help-button").forEach((button) => {
            button.disabled = false;
        });
        this.rootElement?.querySelector(".gauge-history-modal-overlay")?.remove();
    }

    private appendSvgLine(svg: SVGSVGElement, x1: number, y1: number, x2: number, y2: number, className: string): void {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(x1));
        line.setAttribute("y1", String(y1));
        line.setAttribute("x2", String(x2));
        line.setAttribute("y2", String(y2));
        line.setAttribute("class", className);
        svg.appendChild(line);
    }

    private appendSvgText(svg: SVGSVGElement, label: string, x: number, y: number, anchor: "start" | "middle" | "end", className: string): void {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", String(x));
        text.setAttribute("y", String(y));
        text.setAttribute("text-anchor", anchor);
        text.setAttribute("class", className);
        text.textContent = label;
        svg.appendChild(text);
    }

    private appendSvgChip(svg: SVGSVGElement, label: string, x: number, y: number): void {
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("class", "gauge-history-reference-chip");
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", String(x));
        rect.setAttribute("y", String(y));
        rect.setAttribute("width", "172");
        rect.setAttribute("height", "34");
        rect.setAttribute("rx", "17");
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", String(x + 86));
        text.setAttribute("y", String(y + 23));
        text.setAttribute("text-anchor", "middle");
        text.textContent = label;
        group.appendChild(rect);
        group.appendChild(text);
        svg.appendChild(group);
    }

    private showGaugeWeekTooltip(tooltip: HTMLElement, series: GaugeChartSeries[], week: number): void {
        tooltip.replaceChildren();
        tooltip.appendChild(this.tooltipLine(`Semana ${week}`, "title"));
        series.forEach((item) => {
            const pointIndex = item.points.findIndex((point) => point.week === week);
            const label = this.shortGaugeLabel(item.key);
            if (pointIndex === -1) {
                tooltip.appendChild(this.tooltipMetricRow(item.key, label, null, null));
                return;
            }

            const point = item.points[pointIndex];
            const previous = this.previousGaugePoint(item.points, pointIndex);
            const variation = previous ? point.value - previous.value : null;
            tooltip.appendChild(this.tooltipMetricRow(item.key, label, point.value, variation));
        });
        tooltip.classList.add("visible");
    }

    private hideGaugeTooltip(tooltip: HTMLElement): void {
        tooltip.classList.remove("visible");
    }

    private previousGaugePoint(points: GaugeChartPoint[], pointIndex: number): GaugeChartPoint | null {
        return pointIndex > 0 ? points[pointIndex - 1] : null;
    }

    private svgPointer(svg: SVGSVGElement, event: MouseEvent, width: number, height: number): { x: number; y: number } {
        const rect = svg.getBoundingClientRect();
        return {
            x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * width,
            y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * height
        };
    }

    private shortGaugeLabel(key: GaugeMetricKey): string {
        if (key === "SPI (w)") {
            return "SPI";
        }
        if (key === "TSPI (w)") {
            return "TSPI";
        }
        return key;
    }

    private tooltipLine(label: string, className?: string): HTMLElement {
        const line = document.createElement("span");
        if (className) {
            line.className = className;
        }
        line.textContent = label;
        return line;
    }

    private tooltipMetricRow(key: GaugeMetricKey, label: string, value: number | null, variation: number | null): HTMLElement {
        const row = document.createElement("div");
        row.className = "metric-row";
        row.style.setProperty("--series-color", gaugeMetricColors[key]);

        const name = document.createElement("span");
        name.className = "metric-name";
        name.textContent = label;

        const metricValue = document.createElement("strong");
        metricValue.className = "metric-value";
        metricValue.textContent = value === null ? "—" : this.formatDecimal(value);

        const delta = document.createElement("span");
        const tone = variation === null ? "neutral" : variation > 0 ? "positive" : variation < 0 ? "negative" : "neutral";
        delta.className = `metric-delta ${tone}`;
        delta.textContent = variation === null ? "—" : `${this.variationIcon(variation)} ${this.formatSignedDecimal(variation)}`;

        row.appendChild(name);
        row.appendChild(metricValue);
        row.appendChild(delta);
        return row;
    }

    private variationIcon(value: number): string {
        if (value > 0) {
            return "↗";
        }
        if (value < 0) {
            return "↘";
        }
        return "→";
    }

    private formatDecimal(value: number): string {
        return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    private formatSignedDecimal(value: number): string {
        const sign = value > 0 ? "+" : "";
        return `${sign}${this.formatDecimal(value)}`;
    }
}
