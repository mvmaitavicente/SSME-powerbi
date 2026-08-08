"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { BasicFilter } from "powerbi-models";
import "./styles/visual.less";

import { adaptJsonDashboardData, parseDashboardJsonData } from "./dataParser";
import { renderCurve } from "./renderers/curveRenderer";
import { renderGaugeGrid } from "./renderers/gaugeRenderer";
import { renderHeader, renderSidebar } from "./renderers/headerRenderer";
import { renderMilestones } from "./renderers/milestoneRenderer";
import { renderPerformance } from "./renderers/performanceRenderer";
import { renderRisks } from "./renderers/riskRenderer";
import { renderRiskDashboard } from "./renderers/riskDashboardRenderer";
import { renderPortfolioDashboard } from "./portfolioSummary/Dashboard";
import { VisualFormattingSettingsModel } from "./settings";
import { AggregateCurveData, AggregateGaugeData, CurveData, CurveHistoryPoint, CurveReferences, DashboardData, DashboardLevel, DataValue, GaugeChartPoint, GaugeChartSeries, GaugeData, GaugeHistoryRow, GaugeMetricKey, NavigatorProject, ParsedDashboardData, PortfolioSummaryData, ProjectHeader, RenderCurveData, RiskItem, SummaryData, UnitProjectSummaryData, UnitSummaryData, VisualPalette } from "./types";
import { createElement, currency, date, decimal, numberValue, shortCurrency, text } from "./utils/format";
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
    private formattingSettings: VisualFormattingSettingsModel = new VisualFormattingSettingsModel();
    private readonly formattingSettingsService: FormattingSettingsService;
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
    private readonly appliedFilterValues: { [propertyName: string]: string | null } = {};
    private navigatorProjectCatalog: NavigatorProject[] = [];
    private navigationDebugHidden: boolean = false;
    private readonly navigationDebugPanelEnabled: boolean = false;
    private pendingNavigationLevel: DashboardLevel | null = null;
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
    private bodyCarouselIndex: number = 0;
    private selectedGaugeKey: GaugeMetricKey | null = null;
    private visibleGaugeSeries: GaugeMetricKey[] = ["CPI", "SPI (w)", "TCPI", "TSPI (w)"];
    private readonly handleGaugeModalKeydown = (event: KeyboardEvent): void => {
        if (event.key === "Escape" && this.isGaugeHistoryModalOpen) {
            this.closeGaugeHistoryModal();
        }
    };

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.target = options.element;
        this.formattingSettingsService = new FormattingSettingsService();
        this.target.classList.add("evm-visual-host");
    }

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);
        const jsonFilters = this.readUpdateJsonFilters(options);
        this.navigationDebug.updateCount += 1;
        this.navigationDebug.lastAction = "Power BI ejecutó update()";
        this.navigationDebug.jsonFilterCount = jsonFilters.length;
        this.navigationDebug.lastFilterJson = JSON.stringify(jsonFilters);
        this.navigationDebug.activeJsonFilters = JSON.stringify(jsonFilters, null, 2);
        this.navigationDebug.activeFilterSummary = this.summarizeJsonFilters(jsonFilters);
        this.navigationDebug.timestamp = new Date().toISOString();
        console.debug("[UPDATE] Visual actualizado", {
            updateType: options.type,
            jsonFilters,
            dataViews: options.dataViews?.length ?? 0
        });

        try {
            const dataView = options.dataViews?.[0];
            this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, dataView);
            this.target.replaceChildren();

            const dashboard = parseDashboardJsonData(dataView);
            console.debug("[UPDATE] Contexto recibido", {
                level: dashboard?.context?.Level,
                unit: dashboard?.context?.Unit,
                projectId: dashboard?.context?.ProjectId
            });
            this.navigationDebug.receivedLevel = dashboard?.context?.Level ?? null;
            this.navigationDebug.receivedUnit = dashboard?.context?.Unit ?? null;
            this.navigationDebug.receivedProjectId = dashboard?.context?.ProjectId ?? null;
            if (dashboard?.context?.Level === this.pendingNavigationLevel) {
                this.pendingNavigationLevel = null;
            }
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
            this.currentDashboardData = dashboard;
            if (dashboard) {
                this.rememberNavigatorProjects(dashboard.navigator?.projects ?? dashboard.projects);
            }
            const root = document.createElement("div");
            root.className = "evm-dashboard";
            root.style.width = `${options.viewport.width}px`;
            root.style.height = `${options.viewport.height}px`;
            root.style.position = "relative";
            this.rootElement = root;

            if (dashboard) {
                this.syncFilterStateFromDashboard(dashboard);
                const sidebarUnit = this.resolveUnitForNavigation(dashboard);
                const sidebarProject = this.resolveProjectForNavigation(dashboard);
                console.debug("Update posterior a navegación", {
                    receivedLevel: dashboard.context.Level,
                    receivedUnit: dashboard.context.Unit,
                    receivedProject: dashboard.context.ProjectId,
                    sidebarUnit,
                    sidebarProject
                });
                root.appendChild(renderSidebar({
                    activeLevel: dashboard.context.Level,
                    projectViewActive: this.bodyCarouselIndex === 1 ? "milestones" : "summary",
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
                    onProjectView: (view) => this.openProjectView(view),
                    onOpenFilters: () => this.openFilterPanel()
                }));
                root.appendChild(this.renderCurrentDashboard(dashboard, options.viewport));
                if (this.filterPanelOpen) {
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
            if (this.isGaugeHistoryModalOpen) {
                this.renderGaugeHistoryModal();
            }
            this.events.renderingFinished(options);
        } catch (error) {
            this.navigationDebug.lastAction = "Error al interpretar JSON Dashboard";
            this.navigationDebug.lastError = error instanceof Error ? error.message : String(error);
            this.navigationDebug.timestamp = new Date().toISOString();
            this.renderNavigationDebugPanel();
            this.events.renderingFailed(options, String(error));
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
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
            console.debug("[NAV] Click detectado", level);
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
        this.navigationDebug.renderedLevel = dashboard.context.Level;
        console.debug("Dashboard render target", {
            level: dashboard.context.Level,
            axisType: dashboard.context.AxisType,
            summary: dashboard.summary,
            units: dashboard.context.Level === "PRONIED" ? dashboard.units.length : undefined,
            projects: dashboard.context.Level === "UNIDAD" ? dashboard.projects.length : undefined,
            gaugeRows: dashboard.context.Level === "PROYECTO" ? dashboard.gauges.length : dashboard.aggregateGauges.length,
            curveRows: dashboard.context.Level === "PROYECTO" ? dashboard.curve.length : dashboard.aggregateCurve.length
        });

        switch (dashboard.context.Level) {
            case "PRONIED":
                return this.renderProniedDashboard(dashboard, viewport);
            case "UNIDAD":
                return this.renderUnitDashboard(dashboard, viewport);
            case "PROYECTO":
                return this.renderProjectDashboard(dashboard, viewport);
            case "RIESGOS":
                return renderRiskDashboard(dashboard.riskDashboard);
            default:
                return this.renderDashboardError(`Nivel no reconocido: ${dashboard.context.Level}`);
        }
    }

    private renderProjectDashboard(dashboard: ParsedDashboardData, viewport: powerbi.IViewport): HTMLElement {
        const projectDashboard = adaptJsonDashboardData(dashboard);
        const main = document.createElement("main");
        main.className = "evm-main evm-main--project";
        main.classList.toggle("evm-main--project-details", this.bodyCarouselIndex === 1);
        main.style.minWidth = `${Math.min(780, Math.max(0, viewport.width - 92))}px`;
        main.appendChild(renderHeader(projectDashboard.header));
        const gaugeGrid = renderGaugeGrid(projectDashboard.gauges, palette, (key) => this.openGaugeHistoryModal(key));
        gaugeGrid.classList.add("evm-project-gauge-grid");
        main.appendChild(gaugeGrid);
        main.appendChild(this.renderBodyCarousel(projectDashboard, dashboard.curve));
        return main;
    }

    private renderProniedDashboard(dashboard: ParsedDashboardData, viewport: powerbi.IViewport): HTMLElement {
        const main = createElement("main", "evm-main evm-main--pronied");
        main.classList.toggle("evm-main--portfolio-details", this.bodyCarouselIndex === 1);
        main.style.minWidth = `${Math.min(780, Math.max(0, viewport.width - 92))}px`;
        main.appendChild(renderHeader(
            this.portfolioHeaderData("TABLERO EJECUTIVO - PORTAFOLIO INSTITUCIONAL", dashboard),
            {
                titleLabel: null,
                subtitle: "Sistema de Seguimiento, Monitoreo y Evaluación - SSME",
                stateLabel: "Estado del Portafolio"
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

        const summaryPage = createElement("div", "evm-body-carousel-page evm-body-carousel-page--evm");
        const left = createElement("div", "evm-left-column");
        const curveCard = renderCurve(this.buildAggregateRenderCurve(dashboard), palette);
        curveCard.classList.add("evm-portfolio-curve-card");
        const curveTitle = curveCard.querySelector(".evm-section-title");
        if (curveTitle instanceof HTMLElement) {
            curveTitle.textContent = "CURVA S - PORTAFOLIO INSTITUCIONAL";
            curveTitle.insertAdjacentElement("afterend", this.renderPortfolioCurveLegend());
        }
        left.appendChild(curveCard);
        const right = createElement("div", "evm-right-column");
        right.appendChild(renderPortfolioDashboard(dashboard.portfolioSummary));
        summaryPage.appendChild(left);
        summaryPage.appendChild(right);

        const unitsPage = createElement("div", "evm-body-carousel-page evm-body-carousel-page--portfolio-units");
        unitsPage.appendChild(this.renderUnitProgressPanel(dashboard.units));
        unitsPage.appendChild(this.renderPortfolioRiskSection(dashboard.risks));

        const pages = [summaryPage, unitsPage];
        pages.forEach((page, index) => {
            page.classList.toggle("active", index === this.bodyCarouselIndex);
            page.setAttribute("aria-hidden", index === this.bodyCarouselIndex ? "false" : "true");
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
        heading.appendChild(createElement("div", "evm-section-title", "AVANCE POR UNIDAD GERENCIAL"));
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
        header.appendChild(this.renderUnitProgressHeader("Unidad Gerencial", "unit"));
        header.appendChild(this.renderUnitProgressHeader("Proyectos", "projects"));
        header.appendChild(this.renderUnitProgressHeader("% Avance", "advance"));
        header.appendChild(this.renderUnitProgressHeader("SPI", "spi"));
        header.appendChild(this.renderUnitProgressHeader("CPI", "cpi"));
        header.appendChild(this.renderUnitProgressHeader("Estado", "status"));
        table.appendChild(header);

        const progressRows = units.slice(0, 12).map((unit) => {
            const calculatedAdvance = unit.BAC && unit.EV !== null ? Math.max(0, unit.EV / unit.BAC) : 0;
            const advancePct = Math.round(unit.Avance ?? calculatedAdvance * 100);
            return { unit, advancePct };
        });
        progressRows.forEach(({ unit, advancePct }) => {
            const isTotal = unit.UnidadGerencial.trim().toLowerCase() === "portafolio pronied";
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
            row.appendChild(createElement("strong", "evm-unit-progress-projects", this.formatInteger(unit.CantidadProyectos)));

            const isOverTarget = advancePct > 100;
            const progressCell = createElement("div", `evm-unit-progress-value${isOverTarget ? " is-over-target" : ""}`);
            const progress = document.createElement("progress");
            progress.className = `evm-unit-progress-track${isOverTarget ? " is-over-target" : ""}`;
            progress.max = 100;
            progress.value = Math.min(advancePct, 100);
            progressCell.appendChild(progress);
            progressCell.appendChild(createElement("strong", undefined, `${advancePct}%`));
            row.appendChild(progressCell);
            row.appendChild(createElement("span", "evm-unit-progress-index", decimal(spi)));
            row.appendChild(createElement("span", "evm-unit-progress-index", decimal(cpi)));
            const statusCell = createElement("span", `evm-unit-progress-status ${status.className}`);
            statusCell.appendChild(createElement("i"));
            statusCell.appendChild(document.createTextNode(status.label));
            row.appendChild(statusCell);
            table.appendChild(row);
        });

        const body = createElement("div", "evm-unit-progress-body");
        body.appendChild(table);
        body.appendChild(legend);
        section.appendChild(body);
        return section;
    }

    private renderPortfolioRiskSection(risks: RiskItem[]): HTMLElement {
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
            { label: "UNIDAD GERENCIAL", className: "unit" },
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
                rowLabel.appendChild(this.renderUnitProgressIcon(risk.UnidadGerencial ?? ""));
                const rawUnitName = risk.UnidadGerencial?.trim() ?? "—";
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
        const main = createElement("main", "evm-main");
        main.style.minWidth = `${Math.min(780, Math.max(0, viewport.width - 92))}px`;
        const unitName = text(dashboard.context.Unit, "UGEO");
        main.appendChild(renderHeader(this.portfolioHeaderData(`${unitName} \u2014 Portafolio ${unitName}`, dashboard), { titleLabel: null }));
        main.appendChild(this.renderPortfolioGaugeSection(dashboard));
        main.appendChild(this.renderPortfolioBody(this.buildAggregateRenderCurve(dashboard), this.renderProjectsPanel(dashboard.projects)));
        return main;
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

    private renderPortfolioBody(curve: RenderCurveData, sidePanel: HTMLElement): HTMLElement {
        const carousel = createElement("section", "evm-body-carousel");
        const viewport = createElement("div", "evm-body-carousel-viewport");
        const page = createElement("div", "evm-body-carousel-page evm-body-carousel-page--evm active");
        const left = createElement("div", "evm-left-column");
        const right = createElement("div", "evm-right-column");

        left.appendChild(renderCurve(curve, palette));
        right.appendChild(sidePanel);
        page.appendChild(left);
        page.appendChild(right);
        viewport.appendChild(page);
        carousel.appendChild(viewport);
        return carousel;
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

    private renderPortfolioGaugeSection(dashboard: ParsedDashboardData): HTMLElement {
        const rows = this.windowAggregateGaugeRows(dashboard);
        const gauges = this.buildAggregateGauges(rows);
        if (!gauges.length) {
            const empty = createElement("section", "evm-card evm-portfolio-empty-section");
            empty.appendChild(createElement("div", "evm-section-title", "Desempeno consolidado"));
            empty.appendChild(createElement("div", "evm-empty", "No hay indicadores de desempeno disponibles para los filtros seleccionados."));
            return empty;
        }

        return renderGaugeGrid(gauges, palette, (key) => this.openGaugeHistoryModal(key));
    }

    private windowAggregateGaugeRows(dashboard: ParsedDashboardData): AggregateGaugeData[] {
        const orderedRows = [...dashboard.aggregateGauges].sort((a, b) => a.OrdenSemana - b.OrdenSemana);
        const curve = this.buildAggregateRenderCurve(dashboard);
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
        const orderedRows = [...rows].sort((a, b) => a.OrdenSemana - b.OrdenSemana);

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
            return "Estable";
        }
        if (value <= 1) {
            return "Estable";
        }
        if (value <= 1.1) {
            return "En riesgo";
        }
        return "Critico";
    }

    private buildAggregateRenderCurve(dashboard: ParsedDashboardData): RenderCurveData {
        const orderedRows = [...dashboard.aggregateCurve].sort((a, b) => a.OrdenSemana - b.OrdenSemana);
        const history: CurveHistoryPoint[] = orderedRows.map((row) => ({
            SemanaProyecto: row.OrdenSemana,
            PV: row.PV,
            EV: row.EV,
            AC: row.AC
        }));
        const references: CurveReferences = {
            BAC: this.lastAggregateValue(orderedRows, (row) => row.BAC),
            SAC: this.lastAggregateValue(orderedRows, (row) => row.SAC),
            AT: this.lastAggregateValue(orderedRows, (row) => row.AT),
            ES: this.lastAggregateValue(orderedRows, (row) => row.ES),
            EACC: this.lastAggregateValue(orderedRows, (row) => row.EACC),
            EACT: this.lastAggregateValue(orderedRows, (row) => row.EACT),
            VACC: this.lastAggregateValue(orderedRows, (row) => row.VACC),
            VACT: this.lastAggregateValue(orderedRows, (row) => row.VACT),
            SPIT: this.lastAggregateValue(orderedRows, (row) => numberValue(row["SPI (t)"] as DataValue) ?? numberValue(row.SPIT as DataValue)),
            TSPIT: this.lastAggregateValue(orderedRows, (row) => row.TSPIT),
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
                console.debug("Click tarjeta unidad", {
                    unit: unit.UnidadGerencial
                });
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

        const evmPage = document.createElement("div");
        evmPage.className = "evm-body-carousel-page evm-body-carousel-page--evm";
        const evmLeft = document.createElement("div");
        evmLeft.className = "evm-left-column";
        evmLeft.appendChild(renderCurve(dashboard.curve, palette));
        const evmRight = document.createElement("div");
        evmRight.className = "evm-right-column";
        evmRight.appendChild(renderPerformance(dashboard.performance));
        evmPage.appendChild(evmLeft);
        evmPage.appendChild(evmRight);

        const riskPage = document.createElement("div");
        riskPage.className = "evm-body-carousel-page evm-body-carousel-page--risk";
        riskPage.appendChild(this.renderProjectCurveMatrix(curveRows));
        const lowerRow = createElement("div", "evm-project-details-lower-row");
        lowerRow.appendChild(renderRisks(dashboard.risks));
        lowerRow.appendChild(renderMilestones(dashboard.milestones));
        riskPage.appendChild(lowerRow);

        const pages = [evmPage, riskPage];
        pages.forEach((page, index) => {
            page.classList.toggle("active", index === this.bodyCarouselIndex);
            page.setAttribute("aria-hidden", index === this.bodyCarouselIndex ? "false" : "true");
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

    private renderProjectCurveMatrix(curveRows: CurveData[]): HTMLElement {
        const card = createElement("section", "evm-card evm-project-curve-matrix-card");
        type MatrixField = { key: keyof CurveData; label: string; title: string; kind: "week" | "money" | "index" | "time" };
        const weekField: MatrixField = { key: "Semana", label: "SEMANA", title: "Semana del proyecto", kind: "week" };
        const groups: Array<{ name: string; className: string; fields: MatrixField[] }> = [
            {
                name: "BASE",
                className: "base",
                fields: [
                    weekField,
                    { key: "BAC", label: "BAC", title: "Presupuesto a la conclusión", kind: "money" },
                    { key: "SAC", label: "SAC", title: "Duración planificada", kind: "time" },
                    { key: "ES", label: "ES", title: "Cronograma ganado", kind: "time" },
                    { key: "AT", label: "AT", title: "Tiempo actual", kind: "time" },
                    { key: "PV", label: "PV", title: "Valor planificado", kind: "money" },
                    { key: "EV", label: "EV", title: "Valor ganado", kind: "money" },
                    { key: "AC", label: "AC", title: "Costo actual", kind: "money" },
                    { key: "CV", label: "CV", title: "Variación del costo", kind: "money" }
                ]
            },
            {
                name: "ÍNDICES",
                className: "indices",
                fields: [
                    weekField,
                    { key: "CPI", label: "CPI", title: "Índice de desempeño del costo", kind: "index" },
                    { key: "SPI (w)", label: "SPI(W)", title: "Índice de desempeño del cronograma por valor", kind: "index" },
                    { key: "SPI (t)", label: "SPI(T)", title: "Índice de desempeño del cronograma por tiempo", kind: "index" },
                    { key: "TCPI", label: "TCPI", title: "Índice de desempeño requerido del costo", kind: "index" },
                    { key: "TSPI (w)", label: "TSPI(W)", title: "Índice de desempeño requerido del cronograma por valor", kind: "index" },
                    { key: "TSPI (t)", label: "TSPI(T)", title: "Índice de desempeño requerido del cronograma por tiempo", kind: "index" }
                ]
            },
            {
                name: "PROYECCIONES",
                className: "projections",
                fields: [
                    weekField,
                    { key: "EAC (c)", label: "EAC(C)", title: "Estimado de costo a la conclusión", kind: "money" },
                    { key: "EAC (t)", label: "EAC(T)", title: "Estimado de tiempo a la conclusión", kind: "time" },
                    { key: "IEAC (t)", label: "IEAC(T)", title: "Estimado independiente de tiempo a la conclusión", kind: "time" },
                    { key: "VAC (c)", label: "VAC(C)", title: "Variación de costo a la conclusión", kind: "money" },
                    { key: "VAC (t)", label: "VAC(T)", title: "Variación de tiempo a la conclusión", kind: "time" }
                ]
            },
            {
                name: "VARIACIONES",
                className: "variations",
                fields: [
                    weekField,
                    { key: "SV (w)", label: "SV(W)", title: "Variación del cronograma por valor", kind: "money" },
                    { key: "SV (t)", label: "SV(T)", title: "Variación del cronograma por tiempo", kind: "time" },
                    { key: "ETC (c)", label: "ETC(C)", title: "Costo restante estimado", kind: "money" },
                    { key: "ETC (t)", label: "ETC(T)", title: "Tiempo restante estimado", kind: "time" }
                ]
            }
        ];
        const title = createElement("div", "evm-section-title", "MATRIZ DE EVM");
        const heading = createElement("div", "evm-project-curve-matrix-heading");
        heading.appendChild(title);
        card.appendChild(heading);

        const tableWrap = createElement("div", "evm-project-curve-matrix-wrap");
        const visibleRows = [...curveRows]
            .filter((row) => (numberValue(row.Semana) ?? 0) >= 1)
            .sort((a, b) => (numberValue(a.Semana) ?? 0) - (numberValue(b.Semana) ?? 0));
        const table = createElement("table", "evm-project-curve-matrix");
        const head = document.createElement("thead");
        const headRow = document.createElement("tr");
        groups.forEach((group, groupIndex) => {
            group.fields.forEach((field, fieldIndex) => {
                if (groupIndex > 0 && fieldIndex === 0) {
                    return;
                }
                const th = createElement("th", undefined, field.label);
                th.title = field.title;
                headRow.appendChild(th);
            });
        });
        head.appendChild(headRow);
        table.appendChild(head);
        const body = document.createElement("tbody");
        visibleRows.forEach((row, rowIndex) => {
            const tr = document.createElement("tr");
            if (rowIndex === visibleRows.length - 1) {
                tr.className = "current";
            }
            groups.forEach((group, groupIndex) => {
                group.fields.forEach((field, fieldIndex) => {
                    if (groupIndex > 0 && fieldIndex === 0) {
                        return;
                    }
                    const value = numberValue(row[field.key] as DataValue);
                    let formatted = "—";
                    if (value !== null) {
                        formatted = field.kind === "money"
                            ? `S/ ${Math.round(value).toLocaleString("en-US")}`
                            : field.kind === "week"
                                ? this.formatInteger(value)
                                : value.toLocaleString("en-US", { minimumFractionDigits: field.kind === "index" ? 2 : 0, maximumFractionDigits: 2 });
                    }
                    const td = createElement("td", undefined, formatted);
                    td.title = value === null ? "Sin dato" : `${field.title}: ${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
                    tr.appendChild(td);
                });
            });
            body.appendChild(tr);
        });
        table.appendChild(body);
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
            this.bodyCarouselIndex = (this.bodyCarouselIndex + step + pages.length) % pages.length;
            this.updateCarouselPages(pages);
        });
        return button;
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
                this.bodyCarouselIndex = index;
                this.updateCarouselPages(pages);
            });
            dots.appendChild(dot);
        });
        this.updateCarouselDots(dots);
        return dots;
    }

    private updateCarouselPages(pages: HTMLElement[]): void {
        pages.forEach((page, index) => {
            const active = index === this.bodyCarouselIndex;
            page.classList.toggle("active", active);
            page.setAttribute("aria-hidden", active ? "false" : "true");
        });
        const dots = pages[0]?.parentElement?.parentElement?.querySelector(".evm-carousel-dots");
        if (dots instanceof HTMLElement) {
            this.updateCarouselDots(dots);
        }
        const carousel = pages[0]?.parentElement?.parentElement;
        if (carousel instanceof HTMLElement) {
            this.updateCarouselButtons(carousel);
            const main = carousel.closest(".evm-main");
            main?.classList.toggle("evm-main--project-details", main.classList.contains("evm-main--project") && this.bodyCarouselIndex === 1);
            main?.classList.toggle("evm-main--portfolio-details", main.classList.contains("evm-main--pronied") && this.bodyCarouselIndex === 1);
        }
    }

    private updateCarouselDots(dots: HTMLElement): void {
        Array.from(dots.children).forEach((dot, index) => {
            dot.classList.toggle("active", index === this.bodyCarouselIndex);
        });
    }

    private updateCarouselButtons(carousel: HTMLElement): void {
        const isPortfolio = carousel.classList.contains("evm-body-carousel--portfolio");
        const tooltip = isPortfolio
            ? (this.bodyCarouselIndex === 0 ? "Ver avance por unidad" : "Volver al resumen")
            : (this.bodyCarouselIndex === 0 ? "Ver Hitos & Riesgos" : "Volver a Desempeno");
        carousel.querySelectorAll(".evm-carousel-button").forEach((button) => {
            button.setAttribute("aria-label", tooltip);
            button.setAttribute("title", tooltip);
            button.setAttribute("data-tooltip", tooltip);
        });
    }

    private syncFilterStateFromDashboard(dashboard: ParsedDashboardData): void {
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

        return this.currentDashboardData?.navigator?.projects.find((project) => this.navigatorText(project.IdIntervencion) === cleanProjectId)
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
        this.navigationDebug.clickedProjectObject = JSON.stringify(project, null, 2);
        this.navigationDebug.clickedProjectKeys = Object.keys(projectRecord).join(", ");
        this.navigationDebug.clickedProjectId = projectId;
        this.navigationDebug.clickedProjectIdType = projectId === null ? null : typeof projectId;
        this.navigationDebug.requestedProjectId = projectId;

        this.openProjectDashboard(navigatorProject);
    }

    private openProniedDashboard(): void {
        console.debug("Navegando a PRONIED");
        this.filterState.level = "PRONIED";
        this.filterState.selectedUnit = null;
        this.filterState.selectedProjectId = null;
        this.pendingNavigationLevel = "PRONIED";
        this.clearGeneralNavigationFilters();
        this.applyLevelFilter("PRONIED");
    }

    private openRiskDashboard(): void {
        console.debug("Navegando a RIESGOS");
        this.filterState.level = "RIESGOS";
        this.filterState.selectedUnit = null;
        this.filterState.selectedProjectId = null;
        this.pendingNavigationLevel = "RIESGOS";
        this.clearGeneralNavigationFilters();
        this.applyLevelFilter("RIESGOS");
    }

    private openUnitDashboard(unit?: string): void {
        const selectedUnit = unit ?? this.resolveUnitForNavigation();
        if (!selectedUnit) {
            console.warn("No hay Unidad Gerencial seleccionada.");
            this.openFilterPanel("unit");
            return;
        }

        console.debug("Solicitando navegación", {
            level: "UNIDAD",
            unit: selectedUnit
        });
        this.filterState.level = "UNIDAD";
        this.filterState.selectedUnit = selectedUnit;
        this.filterState.lastNavigableUnit = selectedUnit;
        this.filterState.selectedProjectId = null;
        this.pendingNavigationLevel = "UNIDAD";
        this.clearGeneralNavigationFilters();
        this.applyLevelFilter("UNIDAD");
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
            this.navigationDebug.lastError = "IdIntervencion vacío";
            this.renderNavigationDebugPanel();
            return;
        }

        console.debug("Solicitando navegación", {
            level: "PROYECTO",
            projectId
        });
        this.navigationDebug.requestedLevel = "PROYECTO";
        this.navigationDebug.clickedProjectId = projectId;
        this.navigationDebug.clickedProjectIdType = typeof projectId;
        this.navigationDebug.requestedProjectId = projectId;
        this.navigationDebug.lastAction = "Aplicando filtro de proyecto";
        this.navigationDebug.externalProjectFilterApplied = false;
        this.navigationDebug.selfProjectFilterApplied = false;
        this.navigationDebug.lastError = null;
        this.filterState.selectedProjectId = projectId;
        this.filterState.lastNavigableProjectId = projectId;
        this.navigationDebug.applyJsonFilterCalled = true;
        this.navigationDebug.lastFilterJson = JSON.stringify({
            filter: "Dim_Intervenciones[IdIntervencion]",
            projectId
        });
        this.renderNavigationDebugPanel();

        this.applyProjectFilter(projectId);
        this.navigationDebug.externalProjectFilterApplied = true;
        this.navigationDebug.selfProjectFilterApplied = true;
        this.navigationDebug.lastAction = "Filtro de proyecto enviado";
        this.navigationDebug.lastError = null;
        this.navigationDebug.timestamp = new Date().toISOString();
        this.renderNavigationDebugPanel();
    }

    private openProjectView(view: "summary" | "milestones" | "risks"): void {
        if (this.currentDashboardData?.context.Level !== "PROYECTO") {
            return;
        }
        this.bodyCarouselIndex = view === "summary" ? 0 : 1;
        const pages = Array.from(this.rootElement?.querySelectorAll(".evm-body-carousel-page") ?? [])
            .filter((element): element is HTMLElement => element instanceof HTMLElement);
        if (pages.length) {
            this.updateCarouselPages(pages);
        }
    }

    private openProjectSelector(): void {
        this.openFilterPanel("project");
    }

    private openFilterPanel(focus: "unit" | "project" | null = null): void {
        this.filterPanelOpen = true;
        this.filterFocus = focus;
        this.renderFilterPanelIntoRoot();
    }

    private closeFilterPanel(): void {
        this.filterPanelOpen = false;
        this.filterFocus = null;
        this.rootElement?.querySelector(".evm-filter-panel")?.remove();
    }

    private renderFilterPanelIntoRoot(): void {
        if (!this.rootElement || !this.currentDashboardData) {
            return;
        }
        this.rootElement.querySelector(".evm-filter-panel")?.remove();
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

        const projects = this.filteredNavigatorProjects();
        panel.appendChild(this.renderFilterSelect("Unidad Gerencial", "unit", this.uniqueNavigatorValues("UnidadGerencial"), this.filterState.selectedUnit, (value) => {
            this.filterState.selectedUnit = value;
            this.filterState.selectedProjectId = null;
            value ? this.applyBasicFilter("Dim_Intervenciones", "UnidadGerencial", [value], "unitFilter") : this.clearInternalFilter("unitFilter");
            this.clearInternalFilter("projectFilter");
        }));
        panel.appendChild(this.renderFilterSelect("Región", "region", this.uniqueFromProjects(projects, "Region"), this.filterState.region, (value) => {
            this.filterState.region = value;
            value ? this.applyBasicFilter("Dim_Intervenciones", "Region", [value], "regionFilter") : this.clearInternalFilter("regionFilter");
        }));
        panel.appendChild(this.renderFilterSelect("Provincia", "province", this.uniqueFromProjects(projects, "Provincia"), this.filterState.province, (value) => {
            this.filterState.province = value;
            value ? this.applyBasicFilter("Dim_Intervenciones", "Provincia", [value], "provinceFilter") : this.clearInternalFilter("provinceFilter");
        }));
        panel.appendChild(this.renderFilterSelect("Distrito", "district", this.uniqueFromProjects(projects, "Distrito"), this.filterState.district, (value) => {
            this.filterState.district = value;
            value ? this.applyBasicFilter("Dim_Intervenciones", "Distrito", [value], "districtFilter") : this.clearInternalFilter("districtFilter");
        }));
        panel.appendChild(this.renderFilterSelect("Estado", "status", this.uniqueFromProjects(projects, "EstadoProyecto"), this.filterState.status, (value) => {
            this.filterState.status = value;
            value ? this.applyBasicFilter("Dim_Intervenciones", "EstadoProyecto", [value], "statusFilter") : this.clearInternalFilter("statusFilter");
        }));
        const allProjects = this.navigatorProjectCatalog.length
            ? this.navigatorProjectCatalog
            : this.currentDashboardData?.navigator?.projects ?? this.currentDashboardData?.projects ?? [];
        panel.appendChild(this.renderFilterSelect("Proyecto", "project", this.projectOptions(allProjects), this.filterState.selectedProjectId, (value) => {
            if (!value) {
                return;
            }
            this.clearProjectDimensionFilters();
            this.filterState.selectedProjectId = value;
            this.filterState.lastNavigableProjectId = value;
            this.applyProjectFilter(value);
            this.applyBasicFilter("Dim_Intervenciones", "IdIntervencion", [value], "projectFilter");
        }, false));

        const clear = createElement("button", "evm-filter-clear", "Limpiar filtros");
        clear.type = "button";
        clear.addEventListener("click", () => this.clearAllInteractiveFilters());
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

    private renderFilterSelect(
        label: string,
        key: string,
        options: Array<{ value: string; label: string }>,
        selectedValue: string | null,
        onChange: (value: string | null) => void,
        allowAll: boolean = true
    ): HTMLElement {
        const field = createElement("label", "evm-filter-field");
        field.appendChild(createElement("span", undefined, label));
        const select = createElement("select");
        select.setAttribute("data-filter-key", key);
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
        const projects = this.currentDashboardData?.navigator?.projects ?? [];
        return projects.filter((project) => {
            return this.matchesFilter(project.UnidadGerencial, this.filterState.selectedUnit)
                && this.matchesFilter(project.Region, this.filterState.region)
                && this.matchesFilter(project.Provincia, this.filterState.province)
                && this.matchesFilter(project.Distrito, this.filterState.district)
                && this.matchesFilter(project.EstadoProyecto, this.filterState.status);
        });
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
            .filter((option) => option.value.length > 0);
    }

    private rememberNavigatorProjects(projects: NavigatorProject[]): void {
        const catalog = new Map<string, NavigatorProject>();
        [...this.navigatorProjectCatalog, ...projects].forEach((project) => {
            const projectId = this.getProjectId(project);
            if (projectId) {
                catalog.set(projectId, project);
            }
        });
        this.navigatorProjectCatalog = Array.from(catalog.values());
    }

    private matchesFilter(value: unknown, filter: string | null): boolean {
        return !filter || this.navigatorText(value) === filter;
    }

    private navigatorText(value: unknown): string {
        return value === null || value === undefined ? "" : String(value);
    }

    private handleNavigationClick(level: "PRONIED" | "UNIDAD" | "PROYECTO", unit: string | null = null, projectId: string | null = null): void {
        console.debug("[NAV] Click detectado", level);
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

            console.debug("[NAV] Aplicando nivel", {
                level
            });
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

    private applyLevelFilter(level: DashboardLevel): void {
        const filter = new BasicFilter(
            {
                table: "Dim_NivelDashboard",
                column: "Nivel"
            },
            "In",
            [level]
        );

        const filterJson = filter.toJSON();

        this.host.applyJsonFilter(filterJson as powerbi.IFilter, "general", "filter", powerbi.FilterAction.merge);
        this.host.applyJsonFilter(filterJson as powerbi.IFilter, "general", "selfFilter", powerbi.FilterAction.merge);
    }

    private clearGeneralNavigationFilters(): void {
        this.host.applyJsonFilter(null as unknown as powerbi.IFilter, "general", "filter", powerbi.FilterAction.remove);
        this.host.applyJsonFilter(null as unknown as powerbi.IFilter, "general", "selfFilter", powerbi.FilterAction.remove);
    }

    private applyProjectFilter(projectId: string): void {
        const cleanProjectId = projectId.trim();
        if (!cleanProjectId) {
            this.navigationDebug.lastError = "IdIntervencion vacío";
            this.navigationDebug.lastAction = "Navegación cancelada";
            this.renderNavigationDebugPanel();
            return;
        }

        const projectFilter = new BasicFilter(
            {
                table: "Dim_Intervenciones",
                column: "IdIntervencion"
            },
            "In",
            [cleanProjectId]
        );
        const projectFilterJson = projectFilter.toJSON();

        this.host.applyJsonFilter(projectFilterJson as powerbi.IFilter, "general", "filter", powerbi.FilterAction.merge);
        this.host.applyJsonFilter(projectFilterJson as powerbi.IFilter, "general", "selfFilter", powerbi.FilterAction.merge);
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

    private applyBasicFilter(table: string, column: string, values: Array<string | number>, propertyName: string): void {
        const nextValue = values[0] ?? null;
        if (this.isSameFilterValue(this.appliedFilterValues[propertyName] ?? null, nextValue === null ? null : String(nextValue))) {
            console.debug("Filtro omitido por valor idéntico", {
                table,
                column,
                values,
                propertyName
            });
            return;
        }

        const filter = {
            $schema: ["http", "://powerbi.com/product/schema#basic"].join(""),
            filterType: 1,
            target: { table, column },
            operator: "In",
            values
        } as unknown as powerbi.IFilter;

        console.debug("Aplicando filtro", {
            table,
            column,
            values,
            propertyName,
            filter
        });
        this.host.applyJsonFilter(filter, "internalFilters", propertyName, powerbi.FilterAction.merge);
        this.host.applyJsonFilter(filter, "internalFilters", this.selfFilterPropertyName(propertyName), powerbi.FilterAction.merge);
        this.appliedFilterValues[propertyName] = nextValue === null ? null : String(nextValue);
    }

    private clearInternalFilter(propertyName: string, force: boolean = true): void {
        if (!force && this.appliedFilterValues[propertyName] === null) {
            return;
        }
        console.debug("Limpiando filtro", {
            propertyName
        });
        this.host.applyJsonFilter(null as unknown as powerbi.IFilter, "internalFilters", propertyName, powerbi.FilterAction.remove);
        this.host.applyJsonFilter(
            null as unknown as powerbi.IFilter,
            "internalFilters",
            this.selfFilterPropertyName(propertyName),
            powerbi.FilterAction.remove
        );
        this.appliedFilterValues[propertyName] = null;
    }

    private selfFilterPropertyName(propertyName: string): string {
        return propertyName === "projectFilter"
            ? "selfProjectFilter"
            : propertyName.replace(/Filter$/, "SelfFilter");
    }

    private clearAllInteractiveFilters(): void {
        this.host.applyJsonFilter(null as unknown as powerbi.IFilter, "general", "filter", powerbi.FilterAction.remove);
        this.host.applyJsonFilter(null as unknown as powerbi.IFilter, "general", "selfFilter", powerbi.FilterAction.remove);
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

    private isSameFilterValue(current: string | null, next: string | null): boolean {
        return current === next;
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
        this.target.ownerDocument.addEventListener("keydown", this.handleGaugeModalKeydown);
    }

    private closeGaugeHistoryModal(): void {
        this.isGaugeHistoryModalOpen = false;
        this.removeExistingGaugeHistoryModal();
        this.target.ownerDocument.removeEventListener("keydown", this.handleGaugeModalKeydown);
    }

    private renderGaugeHistoryModal(): void {
        this.removeExistingGaugeHistoryModal();

        const dashboard = this.currentDashboardData;
        const hasRows = dashboard?.context.Level === "PROYECTO"
            ? Boolean(dashboard.gauges.length)
            : Boolean(dashboard?.aggregateGauges.length);
        if (!this.rootElement || !dashboard || !hasRows) {
            return;
        }

        const aggregateRows = dashboard.context.Level === "PROYECTO" ? [] : this.windowAggregateGaugeRows(dashboard);
        const rawSeries = dashboard.context.Level === "PROYECTO"
            ? this.buildGaugeHistorySeries(dashboard.gauges)
            : this.buildAggregateGaugeHistorySeries(aggregateRows);
        const weekRange = this.gaugeHistoryWeekRange(dashboard, rawSeries);
        const series = rawSeries.map((item) => ({
            ...item,
            points: item.points.filter((point) => point.week >= weekRange.min && point.week <= weekRange.max)
        }));
        console.debug("Gauge history modal", {
            selectedGaugeKey: this.selectedGaugeKey,
            level: dashboard.context.Level,
            gaugeRows: dashboard.context.Level === "PROYECTO" ? dashboard.gauges.length : aggregateRows.length,
            series
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
        modal.appendChild(this.renderGaugeHistoryBody(series, weekRange));
        overlay.appendChild(modal);
        this.rootElement.appendChild(overlay);
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

        hitbox.addEventListener("mousemove", (event: MouseEvent) => {
            const pointer = this.svgPointer(svg, event, width, height);
            const clampedX = Math.min(plot.left + plot.width, Math.max(plot.left, pointer.x));
            const week = weeks.reduce((nearest, candidate) => {
                return Math.abs(xScale(candidate) - clampedX) < Math.abs(xScale(nearest) - clampedX) ? candidate : nearest;
            }, weeks[0]);
            const x = xScale(week);
            hoverLine.setAttribute("x1", String(x));
            hoverLine.setAttribute("x2", String(x));
            hoverLine.setAttribute("visibility", "visible");
            this.showGaugeWeekTooltip(tooltip, series, week, (x / width) * 100, (pointer.y / height) * 100);
        });

        hitbox.addEventListener("mouseleave", () => {
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
        this.renderGaugeHistoryModal();
    }

    private buildGaugeHistorySeries(rows: GaugeHistoryRow[]): GaugeChartSeries[] {
        const orderedRows = [...rows].sort((a, b) => a.Semana - b.Semana);
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
        const orderedRows = [...rows].sort((a, b) => a.OrdenSemana - b.OrdenSemana);
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

    private showGaugeWeekTooltip(tooltip: HTMLElement, series: GaugeChartSeries[], week: number, xPercent: number, yPercent: number): void {
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
        tooltip.style.left = `${Math.min(86, Math.max(10, xPercent))}%`;
        tooltip.style.top = `${Math.min(82, Math.max(12, yPercent))}%`;
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
