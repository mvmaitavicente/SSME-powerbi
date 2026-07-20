"use strict";

import { DataValue, GaugeData, GaugeMetricKey, VisualPalette } from "../types";
import { createElement, decimal, numberValue, signedDecimal, svgElement, text } from "../utils/format";

interface GaugeLayout {
    width: number;
    height: number;
    centerX: number;
    centerY: number;
    radius: number;
    stroke: number;
    titleY: number;
    topPad: number;
    valueY: number;
    statusY: number;
    badgeH: number;
}

interface GaugeSegment {
    start: number;
    end: number;
    color: string;
}

const gaugeRangeBlue = "#168BFF";

export function renderGaugeGrid(gauges: GaugeData[], palette: VisualPalette, onHistoryOpen?: (key: GaugeMetricKey) => void): HTMLElement {
    const grid = createElement("section", "evm-gauge-grid");
    gauges.forEach((metric) => grid.appendChild(renderGauge(metric, palette, onHistoryOpen)));
    return grid;
}

export function renderGauge(data: GaugeData, palette: VisualPalette, onHistoryOpen?: (key: GaugeMetricKey) => void): HTMLElement {
    const card = createElement("article", "evm-card evm-gauge-card");
    card.title = `${data.title}: ${text(data.value)} | Estado: ${text(data.status)}`;

    const svg = svgElement("svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `${data.title} ${displayDecimal(data.value)}`);
    svg.classList.add("evm-gauge-svg");
    card.appendChild(svg);
    card.appendChild(renderHistoryCard(data, onHistoryOpen));

    const render = (): void => {
        const svgRect = svg.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const width = Math.max(320, Math.min(380, Math.round(svgRect.width || cardRect.width - 48)));
        const height = Math.max(285, Math.round(svgRect.height || cardRect.height - 40));
        drawGauge(svg, data, palette, gaugeLayout(width, height));
    };

    render();
    if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(() => {
            if (!card.isConnected) {
                observer.disconnect();
                return;
            }
            render();
        });
        observer.observe(card);
    }

    return card;
}

function renderHistoryCard(data: GaugeData, onHistoryOpen?: (key: GaugeMetricKey) => void): HTMLElement {
    const historyCard = createElement("div", "gauge-history-card");
    const metricKey = gaugeMetricKey(data.key);

    if (data.sparkline.length === 0) {
        historyCard.classList.add("gauge-history-card--disabled");
        historyCard.setAttribute("aria-label", `Histórico de ${data.title} sin datos`);
        historyCard.textContent = "Sin datos";
        return historyCard;
    }

    historyCard.appendChild(renderHistorySparkline(data));
    historyCard.appendChild(renderHistoryVariation(data));
    historyCard.style.setProperty("--gauge-color", gaugeRangeColor(data));

    if (!onHistoryOpen) {
        historyCard.setAttribute("aria-label", `Histórico de ${data.title}`);
        return historyCard;
    }

    historyCard.appendChild(createElement("span", "gauge-history-card-action", "Ver histórico"));

    historyCard.setAttribute("role", "button");
    historyCard.setAttribute("tabindex", "0");
    historyCard.setAttribute("aria-label", `Ver histórico de ${data.title}`);

    historyCard.addEventListener("click", () => {
        onHistoryOpen(metricKey);
    });

    historyCard.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onHistoryOpen(metricKey);
        }
    });

    return historyCard;
}

function renderHistorySparkline(data: GaugeData): HTMLElement {
    const wrapper = createElement("div", "gauge-history-sparkline");
    const svg = svgElement("svg");
    svg.setAttribute("viewBox", "0 0 260 50");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const points = data.sparkline;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min;
    const coordinates = points.map((value, index) => {
        const x = points.length > 1 ? 2 + (index / (points.length - 1)) * 256 : 258;
        const y = range === 0 ? 25 : 46 - ((value - min) / range) * 42;
        return { x, y };
    });
    const area = svgElement("path");
    const line = svgElement("path");
    const commands = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    area.setAttribute("d", `${commands} L ${last.x} 49 L ${first.x} 49 Z`);
    area.setAttribute("class", "gauge-history-spark-area");
    line.setAttribute("d", commands);
    line.setAttribute("class", "gauge-history-spark-line");
    svg.appendChild(area);
    svg.appendChild(line);

    coordinates.forEach((point, index) => {
        const dot = svgElement("circle");
        const isLast = index === coordinates.length - 1;
        dot.setAttribute("cx", String(point.x));
        dot.setAttribute("cy", String(point.y));
        dot.setAttribute("r", isLast ? "6.2" : "5.6");
        dot.setAttribute("class", isLast ? "gauge-history-spark-point gauge-history-last-point" : "gauge-history-spark-point");
        svg.appendChild(dot);
    });

    wrapper.appendChild(svg);
    return wrapper;
}

function renderHistoryVariation(data: GaugeData): HTMLElement {
    const wrapper = createElement("div", "gauge-history-variation");
    const variation = numberValue(data.variation);
    const value = createElement("span", `gauge-history-variation-value ${variation === null ? "neutral" : variation >= 0 ? "positive" : "negative"}`);
    value.appendChild(createElement("i", undefined, variation === null ? "–" : variation >= 0 ? "↗" : "↘"));
    value.appendChild(document.createTextNode(variation === null ? "—" : signedDecimal(variation)));
    wrapper.appendChild(value);
    wrapper.appendChild(createElement("span", "gauge-history-variation-label", "vs semana anterior"));
    return wrapper;
}

function gaugeMetricKey(key: GaugeData["key"]): GaugeMetricKey {
    if (key === "SPIW") {
        return "SPI (w)";
    }
    if (key === "TSPIW") {
        return "TSPI (w)";
    }
    return key;
}

const mainGaugeRangePalette: VisualPalette = {
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

function gaugeLayout(width: number, height: number): GaugeLayout {
    const topPad = Math.max(28, height * 0.1);
    const centerX = width / 2;
    const radius = Math.min(width * 0.31, height * 0.39, 118);
    const stroke = Math.max(18, Math.min(24, radius * 0.2));
    const centerY = topPad + radius + 2;
    const valueY = centerY + 47;
    const badgeH = Math.max(30, Math.min(36, height * 0.11));
    const statusY = valueY + 39;
    return {
        width,
        height,
        centerX,
        centerY,
        radius,
        stroke,
        titleY: topPad * 0.76,
        topPad,
        valueY,
        statusY,
        badgeH
    };
}

function drawGauge(svg: SVGSVGElement, data: GaugeData, palette: VisualPalette, layout: GaugeLayout): void {
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    drawTitle(svg, data.title, layout);
    appendGroup(svg, "backgroundArc", (group) => drawArc(group, -90, 90, "#EEF2F7", layout.stroke + 2, layout));
    appendGroup(svg, "rangeArcs", (group) => drawGaugeSegments(group, data, palette, layout));
    appendGroup(svg, "arcSeparators", (group) => drawArcSeparators(group, data, palette, layout));
    appendGroup(svg, "labels", (group) => drawLabels(group, data, layout));
    appendGroup(svg, "needle", (group) => drawNeedle(group, data, palette.blue, layout));
    appendGroup(svg, "value", (group) => drawValue(group, data, layout));
    appendGroup(svg, "status", (group) => drawStatus(group, data, layout));
}

function drawGaugeSegments(group: SVGGElement, data: GaugeData, palette: VisualPalette, layout: GaugeLayout): void {
    gaugeSegments(data, palette).forEach((segment) => {
        drawArc(group, segmentValueToAngle(data, segment.start), segmentValueToAngle(data, segment.end), segment.color, layout.stroke, layout);
    });
}

function gaugeSegments(data: GaugeData, palette: VisualPalette): GaugeSegment[] {
    if (data.key === "CPI" || data.key === "SPIW") {
        return [
            { start: 0, end: 0.9, color: palette.red },
            { start: 0.9, end: 1, color: palette.orange },
            { start: 1, end: 1.2, color: palette.green },
            { start: 1.2, end: 1.5, color: gaugeRangeBlue }
        ];
    }

    return [
        { start: 0, end: 1.01, color: palette.green },
        { start: 1.01, end: 1.11, color: palette.orange },
        { start: 1.11, end: 1.5, color: palette.red }
    ];
}

function drawTitle(svg: SVGSVGElement, title: string, layout: GaugeLayout): void {
    const group = svgElement("g");
    group.setAttribute("class", "title");
    const helpX = layout.width - 28;
    const help = svgElement("circle");
    help.setAttribute("cx", String(helpX));
    help.setAttribute("cy", String(layout.titleY - 4));
    help.setAttribute("r", "9");
    help.setAttribute("class", "evm-gauge-help");
    group.appendChild(svgText(title, 22, layout.titleY, "start", "evm-gauge-title"));
    group.appendChild(help);
    group.appendChild(svgText("?", helpX, layout.titleY + 1, "middle", "evm-gauge-help-text"));
    svg.appendChild(group);
}

function appendGroup(svg: SVGSVGElement, className: string, draw: (group: SVGGElement) => void): void {
    const group = svgElement("g");
    group.setAttribute("class", className);
    draw(group);
    svg.appendChild(group);
}

function drawArc(group: SVGGElement, startAngle: number, endAngle: number, color: string, width: number, layout: GaugeLayout): void {
    const path = svgElement("path");
    path.setAttribute("d", arcPath(startAngle, endAngle, layout));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", String(width));
    path.setAttribute("stroke-linecap", "butt");
    group.appendChild(path);
}

function drawArcSeparators(group: SVGGElement, data: GaugeData, palette: VisualPalette, layout: GaugeLayout): void {
    gaugeSegments(data, palette).slice(1).map((segment) => segmentValueToAngle(data, segment.start)).forEach((angle) => {
        const inner = pointOnGaugeRadius(angle, layout, layout.radius - layout.stroke * 0.62);
        const outer = pointOnGaugeRadius(angle, layout, layout.radius + layout.stroke * 0.62);
        const line = svgElement("line");
        line.setAttribute("x1", String(inner.x));
        line.setAttribute("y1", String(inner.y));
        line.setAttribute("x2", String(outer.x));
        line.setAttribute("y2", String(outer.y));
        line.setAttribute("stroke", "#FFFFFF");
        line.setAttribute("stroke-width", "4");
        line.setAttribute("stroke-linecap", "round");
        group.appendChild(line);
    });
}

function segmentValueToAngle(data: GaugeData, value: number): number {
    if ((data.key === "CPI" || data.key === "SPIW") && value <= 1) {
        if (value <= 0.9) {
            return -90 + (value / 0.9) * 72;
        }
        return -18 + ((value - 0.9) / 0.1) * 18;
    }
    if (data.key === "TCPI" || data.key === "TSPIW") {
        if (value <= 0.9) {
            return -90 + (value / 0.9) * 72;
        }
        if (value <= 1.01) {
            return -18 + ((value - 0.9) / 0.11) * 18;
        }
        if (value <= 1.11) {
            return ((value - 1.01) / 0.1) * 18;
        }
        return 18 + ((value - 1.11) / 0.39) * 72;
    }
    return valueToAngle(value, data.min, data.max, data.target);
}

function drawNeedle(group: SVGGElement, data: GaugeData, color: string, layout: GaugeLayout): void {
    const value = numberValue(data.value);
    if (value === null) {
        return;
    }
    const clamped = Math.max(data.min, Math.min(data.max, value));
    const angle = segmentValueToAngle(data, clamped);
    group.setAttribute("transform", `rotate(${angle} ${layout.centerX} ${layout.centerY})`);

    const halfWidth = Math.max(5.4, layout.radius * 0.058);
    const needle = svgElement("path");
    needle.setAttribute("d", `M ${layout.centerX - halfWidth} ${layout.centerY} L ${layout.centerX} ${layout.centerY - layout.radius * 0.78} L ${layout.centerX + halfWidth} ${layout.centerY} Z`);
    needle.setAttribute("fill", color);
    group.appendChild(needle);

    const pivot = svgElement("circle");
    pivot.setAttribute("cx", String(layout.centerX));
    pivot.setAttribute("cy", String(layout.centerY));
    pivot.setAttribute("r", String(Math.max(9.5, layout.radius * 0.09)));
    pivot.setAttribute("fill", color);
    group.appendChild(pivot);
}

function drawLabels(group: SVGGElement, data: GaugeData, layout: GaugeLayout): void {
    group.appendChild(svgText(formatScale(data.min), layout.centerX - layout.radius, layout.centerY + layout.radius * 0.3, "middle", "evm-gauge-scale-label"));
    group.appendChild(svgText(formatScale(data.target), layout.centerX, layout.centerY - layout.radius - 14, "middle", "evm-gauge-scale-label"));
    group.appendChild(svgText(formatScale(data.max), layout.centerX + layout.radius, layout.centerY + layout.radius * 0.3, "middle", "evm-gauge-scale-label"));
}

function drawValue(group: SVGGElement, data: GaugeData, layout: GaugeLayout): void {
    group.appendChild(svgText(displayDecimal(data.value), layout.centerX, layout.valueY, "middle", "evm-gauge-main-value"));
}

function drawStatus(group: SVGGElement, data: GaugeData, layout: GaugeLayout): void {
    const status = numberValue(data.value) === null ? "SIN DATO" : text(data.status, "Sin estado").toUpperCase();
    const className = gaugeRangeClass(data);
    const badgeW = Math.max(96, Math.min(148, status.length * 10.8 + 30));
    const badgeH = Math.min(30, layout.badgeH);
    const badge = svgElement("rect");
    badge.setAttribute("x", String(layout.centerX - badgeW / 2));
    badge.setAttribute("y", String(layout.statusY - badgeH / 2));
    badge.setAttribute("width", String(badgeW));
    badge.setAttribute("height", String(badgeH));
    badge.setAttribute("rx", String(badgeH / 2));
    badge.setAttribute("class", `evm-gauge-status-bg ${className}`);
    group.appendChild(badge);

    const label = svgText(status, layout.centerX, layout.statusY + 6, "middle", `evm-gauge-status-text ${className}`);
    group.appendChild(label);
}

function arcPath(startAngle: number, endAngle: number, layout: GaugeLayout): string {
    const start = pointOnGauge(startAngle, layout);
    const end = pointOnGauge(endAngle, layout);
    const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? "1" : "0";
    return `M ${start.x} ${start.y} A ${layout.radius} ${layout.radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function pointOnGauge(angle: number, layout: GaugeLayout): { x: number; y: number } {
    return pointOnGaugeRadius(angle, layout, layout.radius);
}

function pointOnGaugeRadius(angle: number, layout: GaugeLayout, radius: number): { x: number; y: number } {
    const radians = (angle * Math.PI) / 180;
    return {
        x: layout.centerX + radius * Math.sin(radians),
        y: layout.centerY - radius * Math.cos(radians)
    };
}

function valueToAngle(value: DataValue, min: number, max: number, target: number): number {
    const parsed = numberValue(value) ?? target;
    const clamped = Math.max(min, Math.min(max, parsed));
    if (clamped <= target) {
        const leftRange = target - min || 1;
        return -90 + ((clamped - min) / leftRange) * 90;
    }
    const rightRange = max - target || 1;
    return ((clamped - target) / rightRange) * 90;
}

function displayDecimal(value: DataValue): string {
    return numberValue(value) === null ? "\u2014" : decimal(value);
}

function gaugeRangeColor(data: GaugeData): string {
    const value = numberValue(data.value);
    if (value === null) {
        return mainGaugeRangePalette.blue;
    }
    const segment = gaugeSegments(data, mainGaugeRangePalette).find((item) => value >= item.start && value <= item.end);
    return segment?.color ?? mainGaugeRangePalette.blue;
}

function gaugeRangeClass(data: GaugeData): string {
    const color = gaugeRangeColor(data);
    if (color === gaugeRangeBlue) {
        return "blue";
    }
    if (color === mainGaugeRangePalette.green) {
        return "success";
    }
    if (color === mainGaugeRangePalette.orange) {
        return "warning";
    }
    if (color === mainGaugeRangePalette.red) {
        return "danger";
    }
    return "neutral";
}

function svgText(label: string, x: number, y: number, anchor: "start" | "middle" | "end", className: string): SVGTextElement {
    const node = svgElement("text");
    node.setAttribute("x", String(x));
    node.setAttribute("y", String(y));
    node.setAttribute("text-anchor", anchor);
    node.setAttribute("class", className);
    node.textContent = label;
    return node;
}

function formatScale(value: number): string {
    return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusClass(status?: string): string {
    const value = (status ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (value.includes("estable")) {
        return "success";
    }
    if (value.includes("en riesgo") || value.includes("riesgo")) {
        return "warning";
    }
    if (value.includes("critico")) {
        return "danger";
    }
    if (value.includes("crit") || value.includes("alto")) {
        return "danger";
    }
    if (value.includes("riesgo") || value.includes("medio")) {
        return "warning";
    }
    if (value.includes("salud") || value.includes("ok") || value.includes("normal") || value.includes("bajo")) {
        return "success";
    }
    return "neutral";
}

