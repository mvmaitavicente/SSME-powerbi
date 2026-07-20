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
import { VisualFormattingSettingsModel } from "./settings";
import { AggregateCurveData, AggregateGaugeData, CurveHistoryPoint, CurveReferences, DashboardData, DashboardLevel, DataValue, GaugeChartPoint, GaugeChartSeries, GaugeData, GaugeHistoryRow, GaugeMetricKey, NavigatorProject, ParsedDashboardData, ProjectHeader, RenderCurveData, SummaryData, UnitProjectSummaryData, UnitSummaryData, VisualPalette } from "./types";
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
    private navigationDebugHidden: boolean = false;
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
        main.appendChild(this.renderBodyCarousel(projectDashboard));
        return main;
    }

    private renderProniedDashboard(dashboard: ParsedDashboardData, viewport: powerbi.IViewport): HTMLElement {
        const main = createElement("main", "evm-main");
        main.style.minWidth = `${Math.min(780, Math.max(0, viewport.width - 92))}px`;
        main.appendChild(renderHeader(
            this.portfolioHeaderData("TABLERO EJECUTIVO - PORTAFOLIO INSTITUCIONAL", dashboard),
            {
                titleLabel: null,
                subtitle: "Sistema de Seguimiento, Monitoreo y Evaluación - SSME"
            }
        ));
        main.appendChild(this.renderPortfolioGaugeSection(dashboard));
        main.appendChild(this.renderPortfolioBody(this.buildAggregateRenderCurve(dashboard), this.renderUnitsPanel(dashboard.units)));
        return main;
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
            EstadoProyecto: "",
            MensajeEjecutivo: "",
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

    private renderBodyCarousel(dashboard: DashboardData): HTMLElement {
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
        riskPage.appendChild(renderMilestones(dashboard.milestones));
        const lowerRow = createElement("div", "evm-project-details-lower-row");
        lowerRow.appendChild(renderRisks(dashboard.risks));
        const stakeholders = createElement("section", "evm-card evm-stakeholder-card");
        stakeholders.appendChild(createElement("div", "evm-section-title", "PARTES INTERESADAS"));
        stakeholders.appendChild(createElement("div", "evm-empty", "Sin datos de partes interesadas."));
        lowerRow.appendChild(stakeholders);
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
            carousel.closest(".evm-main")?.classList.toggle("evm-main--project-details", this.bodyCarouselIndex === 1);
        }
    }

    private updateCarouselDots(dots: HTMLElement): void {
        Array.from(dots.children).forEach((dot, index) => {
            dot.classList.toggle("active", index === this.bodyCarouselIndex);
        });
    }

    private updateCarouselButtons(carousel: HTMLElement): void {
        const tooltip = this.bodyCarouselIndex === 0 ? "Ver Hitos & Riesgos" : "Volver a Desempeno";
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
        panel.appendChild(this.renderFilterSelect("Proyecto", "project", this.projectOptions(projects), this.filterState.selectedProjectId, (value) => {
            this.filterState.selectedProjectId = value;
        }));

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
        onChange: (value: string | null) => void
    ): HTMLElement {
        const field = createElement("label", "evm-filter-field");
        field.appendChild(createElement("span", undefined, label));
        const select = createElement("select");
        select.setAttribute("data-filter-key", key);
        select.appendChild(new Option("Todos", ""));
        options.forEach((option) => select.appendChild(new Option(option.label, option.value)));
        select.value = selectedValue ?? "";
        select.addEventListener("change", () => {
            onChange(select.value || null);
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
            .filter((option) => option.value.length > 0)
            .slice(0, 100);
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
        this.appliedFilterValues[propertyName] = null;
    }

    private clearAllInteractiveFilters(): void {
        this.host.applyJsonFilter(null as unknown as powerbi.IFilter, "general", "filter", powerbi.FilterAction.remove);
        this.host.applyJsonFilter(null as unknown as powerbi.IFilter, "general", "selfFilter", powerbi.FilterAction.remove);
        ["regionFilter", "provinceFilter", "districtFilter", "statusFilter"].forEach((property) => this.clearInternalFilter(property));
        this.filterState.level = "PRONIED";
        this.filterState.selectedUnit = null;
        this.filterState.selectedProjectId = null;
        this.filterState.region = null;
        this.filterState.province = null;
        this.filterState.district = null;
        this.filterState.status = null;
        this.closeFilterPanel();
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
        const series = dashboard.context.Level === "PROYECTO"
            ? this.buildGaugeHistorySeries(dashboard.gauges)
            : this.buildAggregateGaugeHistorySeries(aggregateRows);
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
        modal.appendChild(this.renderGaugeHistoryBody(series));
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

    private renderGaugeHistoryBody(series: GaugeChartSeries[]): HTMLElement {
        const body = document.createElement("div");
        body.className = "gauge-history-modal-body";

        const chartCard = document.createElement("div");
        chartCard.className = "gauge-history-chart-card";
        const chartWrap = document.createElement("div");
        chartWrap.className = "gauge-history-modal-chart";
        const tooltip = document.createElement("div");
        tooltip.className = "gauge-history-tooltip";
        chartWrap.appendChild(this.renderGaugeHistoryChart(series, tooltip));
        chartWrap.appendChild(tooltip);
        chartCard.appendChild(chartWrap);
        chartCard.appendChild(this.renderGaugeHistoryBottomLegend(series));

        body.appendChild(chartCard);
        return body;
    }

    private renderGaugeHistoryChart(series: GaugeChartSeries[], tooltip: HTMLElement): SVGSVGElement {
        const width = 1220;
        const height = 760;
        const plot = { left: 92, top: 38, width: 1080, height: 610 };
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        svg.setAttribute("class", "gauge-history-chart-svg");

        const visibleSeries = series.filter((item) => this.visibleGaugeSeries.includes(item.key) && item.points.length);
        const allPoints = visibleSeries.flatMap((item) => item.points);
        const allWeeks = allPoints.map((point) => point.week);
        const allValues = allPoints.map((point) => point.value);
        const minWeek = allWeeks.length ? Math.min(...allWeeks) : 0;
        const maxWeek = allWeeks.length ? Math.max(...allWeeks) : 1;
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

        const referenceY = yScale(1);
        this.appendSvgLine(svg, plot.left, referenceY, plot.left + plot.width, referenceY, "gauge-history-reference-line");
        this.appendSvgChip(svg, "Referencia 1.00", plot.left + plot.width - 184, referenceY - 34);

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
