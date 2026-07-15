"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./styles/visual.less";

import { parseDashboardData, parseDashboardJsonData } from "./dataParser";
import { renderCurve } from "./renderers/curveRenderer";
import { renderGaugeGrid } from "./renderers/gaugeRenderer";
import { renderHeader, renderSidebar } from "./renderers/headerRenderer";
import { renderMilestones } from "./renderers/milestoneRenderer";
import { renderPerformance } from "./renderers/performanceRenderer";
import { renderRisks } from "./renderers/riskRenderer";
import { VisualFormattingSettingsModel } from "./settings";
import { GaugeChartPoint, GaugeChartSeries, GaugeHistoryRow, GaugeMetricKey, ParsedDashboardData, VisualPalette } from "./types";
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

const gaugeMetricColors: Record<GaugeMetricKey, string> = {
    CPI: "#F97316",
    "SPI (w)": "#2563EB",
    TCPI: "#16A34A",
    "TSPI (w)": "#DC2626"
};

export class Visual implements IVisual {
    private readonly events: IVisualEventService;
    private readonly target: HTMLElement;
    private formattingSettings: VisualFormattingSettingsModel = new VisualFormattingSettingsModel();
    private readonly formattingSettingsService: FormattingSettingsService;
    private rootElement: HTMLElement | null = null;
    private currentDashboardData: ParsedDashboardData | null = null;
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

            this.currentDashboardData = parseDashboardJsonData(dataView);
            const dashboard = parseDashboardData(dataView);
            const root = document.createElement("div");
            root.className = "evm-dashboard";
            root.style.width = `${options.viewport.width}px`;
            root.style.height = `${options.viewport.height}px`;
            this.rootElement = root;

            root.appendChild(renderSidebar());

            const main = document.createElement("main");
            main.className = "evm-main";
            main.appendChild(renderHeader(dashboard.header));
            main.appendChild(renderGaugeGrid(dashboard.gauges, palette, (key) => this.openGaugeHistoryModal(key)));

            main.appendChild(this.renderBodyCarousel(dashboard));
            root.appendChild(main);

            if (!dashboard.hasData) {
                const empty = document.createElement("div");
                empty.className = "evm-no-data";
                empty.textContent = "Asigne columnas o medidas al visual para ver el dashboard EVM.";
                root.appendChild(empty);
            }

            this.target.appendChild(root);
            if (this.isGaugeHistoryModalOpen) {
                this.renderGaugeHistoryModal();
            }
            this.events.renderingFinished(options);
        } catch (error) {
            this.events.renderingFailed(options, String(error));
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    private renderBodyCarousel(dashboard: ReturnType<typeof parseDashboardData>): HTMLElement {
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
        const riskLeft = document.createElement("div");
        riskLeft.className = "evm-left-column";
        riskLeft.appendChild(renderMilestones(dashboard.milestones));
        const riskRight = document.createElement("div");
        riskRight.className = "evm-right-column";
        riskRight.appendChild(renderRisks(dashboard.risks));
        riskPage.appendChild(riskLeft);
        riskPage.appendChild(riskRight);

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
        carousel.appendChild(this.renderCarouselDots(pages));
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
    }

    private updateCarouselDots(dots: HTMLElement): void {
        Array.from(dots.children).forEach((dot, index) => {
            dot.classList.toggle("active", index === this.bodyCarouselIndex);
        });
    }

    private openGaugeHistoryModal(selectedGaugeKey?: GaugeMetricKey): void {
        if (!this.currentDashboardData?.gauges.length) {
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

        if (!this.rootElement || !this.currentDashboardData?.gauges.length) {
            return;
        }

        const series = this.buildGaugeHistorySeries(this.currentDashboardData.gauges);
        console.debug("Gauge history modal", {
            selectedGaugeKey: this.selectedGaugeKey,
            gaugeRows: this.currentDashboardData.gauges.length,
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
        title.textContent = "Histórico de indicadores del proyecto";
        const subtitle = document.createElement("p");
        subtitle.className = "gauge-history-modal-subtitle";
        subtitle.textContent = this.currentDashboardData?.project?.NombreIntervencion || this.currentDashboardData?.idIntervencion || "Proyecto sin nombre";
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
