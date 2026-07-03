"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./styles/visual.less";

import { parseDashboardData } from "./dataParser";
import { renderCurve } from "./renderers/curveRenderer";
import { renderGaugeGrid } from "./renderers/gaugeRenderer";
import { renderHeader, renderSidebar } from "./renderers/headerRenderer";
import { renderMilestones } from "./renderers/milestoneRenderer";
import { renderPerformance } from "./renderers/performanceRenderer";
import { renderRisks } from "./renderers/riskRenderer";
import { VisualFormattingSettingsModel } from "./settings";
import { VisualPalette } from "./types";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualEventService = powerbi.extensibility.IVisualEventService;

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

export class Visual implements IVisual {
    private readonly events: IVisualEventService;
    private readonly target: HTMLElement;
    private formattingSettings: VisualFormattingSettingsModel = new VisualFormattingSettingsModel();
    private readonly formattingSettingsService: FormattingSettingsService;

    constructor(options: VisualConstructorOptions) {
        this.events = options.host.eventService;
        this.target = options.element;
        this.formattingSettingsService = new FormattingSettingsService();
        this.target.classList.add("evm-visual-host");
    }

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);

        try {
            const dataView = options.dataViews?.[0];
            this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, dataView);
            this.target.replaceChildren();

            const dashboard = parseDashboardData(dataView);
            const root = document.createElement("div");
            root.className = "evm-dashboard";
            root.style.width = `${options.viewport.width}px`;
            root.style.height = `${options.viewport.height}px`;

            root.appendChild(renderSidebar());

            const main = document.createElement("main");
            main.className = "evm-main";
            main.appendChild(renderHeader(dashboard.header));
            main.appendChild(renderGaugeGrid(dashboard.gauges, palette));

            const body = document.createElement("section");
            body.className = "evm-body-grid";
            const leftColumn = document.createElement("div");
            leftColumn.className = "evm-left-column";
            leftColumn.appendChild(renderCurve(dashboard.curve, palette));
            if (dashboard.milestones.length) {
                leftColumn.appendChild(renderMilestones(dashboard.milestones));
            }

            const rightColumn = document.createElement("div");
            rightColumn.className = "evm-right-column";
            rightColumn.appendChild(renderPerformance(dashboard.performance));
            rightColumn.appendChild(renderRisks(dashboard.risks));

            body.appendChild(leftColumn);
            body.appendChild(rightColumn);
            main.appendChild(body);
            root.appendChild(main);

            if (!dashboard.hasData) {
                const empty = document.createElement("div");
                empty.className = "evm-no-data";
                empty.textContent = "Asigne columnas o medidas al visual para ver el dashboard EVM.";
                root.appendChild(empty);
            }

            this.target.appendChild(root);
            this.events.renderingFinished(options);
        } catch (error) {
            this.events.renderingFailed(options, String(error));
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
