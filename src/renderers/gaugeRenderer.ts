"use strict";

import { DataValue, GaugeData, VisualPalette } from "../types";
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
    sparkY: number;
    sparkH: number;
}

export function renderGaugeGrid(gauges: GaugeData[], palette: VisualPalette): HTMLElement {
    const grid = createElement("section", "evm-gauge-grid");
    gauges.forEach((metric) => grid.appendChild(renderGauge(metric, palette)));
    return grid;
}

export function renderGauge(data: GaugeData, palette: VisualPalette): HTMLElement {
    const card = createElement("article", "evm-card evm-gauge-card");
    card.title = `${data.title}: ${text(data.value)} | Estado: ${text(data.status)}`;

    const svg = svgElement("svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `${data.title} ${displayDecimal(data.value)}`);
    svg.classList.add("evm-gauge-svg");
    card.appendChild(svg);

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

function gaugeLayout(width: number, height: number): GaugeLayout {
    const topPad = Math.max(28, height * 0.1);
    const bottomPad = Math.max(22, height * 0.075);
    const centerX = width / 2;
    const radius = Math.min(width * 0.31, height * 0.39, 118);
    const stroke = Math.max(18, Math.min(24, radius * 0.2));
    const centerY = topPad + radius + 2;
    const valueY = centerY + 47;
    const badgeH = Math.max(30, Math.min(36, height * 0.11));
    const statusY = valueY + 39;
    const sparkH = Math.max(28, Math.min(38, height * 0.13));
    const sparkY = Math.min(height - bottomPad - sparkH, statusY + badgeH / 2 + 16);
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
        badgeH,
        sparkY,
        sparkH
    };
}

function drawGauge(svg: SVGSVGElement, data: GaugeData, palette: VisualPalette, layout: GaugeLayout): void {
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    drawTitle(svg, data.title, layout);
    appendGroup(svg, "backgroundArc", (group) => drawArc(group, -90, 90, "#EEF2F7", layout.stroke + 2, layout));
    appendGroup(svg, "redArc", (group) => drawArc(group, -90, -58, palette.red, layout.stroke, layout));
    appendGroup(svg, "orangeArc", (group) => drawArc(group, -58, 24, palette.orange, layout.stroke, layout));
    appendGroup(svg, "greenArc", (group) => drawArc(group, 24, 90, palette.green, layout.stroke, layout));
    appendGroup(svg, "arcSeparators", (group) => drawArcSeparators(group, layout));
    appendGroup(svg, "labels", (group) => drawLabels(group, data, layout));
    appendGroup(svg, "needle", (group) => drawNeedle(group, data, palette.blue, layout));
    appendGroup(svg, "value", (group) => drawValue(group, data, layout));
    appendGroup(svg, "status", (group) => drawStatus(group, data, palette, layout));
    appendGroup(svg, "sparkline", (group) => drawSparkline(group, data, palette, layout));
    appendGroup(svg, "variation", (group) => drawVariation(group, data, palette, layout));
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

function drawArcSeparators(group: SVGGElement, layout: GaugeLayout): void {
    [-58, 0, 24].forEach((angle) => {
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

function drawNeedle(group: SVGGElement, data: GaugeData, color: string, layout: GaugeLayout): void {
    if (numberValue(data.value) === null) {
        return;
    }
    const angle = valueToAngle(data.value, data.min, data.max, data.target);
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

function drawStatus(group: SVGGElement, data: GaugeData, palette: VisualPalette, layout: GaugeLayout): void {
    const status = numberValue(data.value) === null ? "SIN DATO" : text(data.status, "Sin estado").toUpperCase();
    const className = statusClass(status);
    const badgeW = Math.max(142, layout.width * 0.27);
    const badgeH = layout.badgeH;
    const badge = svgElement("rect");
    badge.setAttribute("x", String(layout.centerX - badgeW / 2));
    badge.setAttribute("y", String(layout.statusY - badgeH / 2));
    badge.setAttribute("width", String(badgeW));
    badge.setAttribute("height", String(badgeH));
    badge.setAttribute("rx", String(badgeH / 2));
    badge.setAttribute("class", `evm-gauge-status-bg ${className}`);
    group.appendChild(badge);

    const label = svgText(status, layout.centerX, layout.statusY + 5.5, "middle", `evm-gauge-status-text ${className}`);
    label.setAttribute("fill", statusColor(className, palette));
    group.appendChild(label);
}

function drawSparkline(group: SVGGElement, data: GaugeData, palette: VisualPalette, layout: GaugeLayout): void {
    const box = {
        x: Math.max(22, layout.width * 0.055),
        y: layout.sparkY,
        width: Math.max(170, layout.width * 0.54),
        height: layout.sparkH
    };
    const points = data.sparkline;
    if (!points.length) {
        return;
    }
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min;
    const step = points.length > 1 ? box.width / (points.length - 1) : box.width;
    const coordinates = points.map((item, index) => {
        const x = points.length > 1 ? box.x + step * index : box.x + box.width;
        const y = range === 0 ? box.y + box.height / 2 : box.y + box.height - ((item - min) / range) * box.height;
        return { x, y, command: `${index === 0 ? "M" : "L"} ${x} ${y}` };
    });
    if (points.length === 1) {
        coordinates.unshift({ x: box.x, y: box.y + box.height / 2, command: `M ${box.x} ${box.y + box.height / 2}` });
    }

    const area = svgElement("path");
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    area.setAttribute("d", `${coordinates.map((item) => item.command).join(" ")} L ${last.x} ${box.y + box.height} L ${first.x} ${box.y + box.height} Z`);
    area.setAttribute("class", "evm-gauge-spark-area");
    group.appendChild(area);

    const line = svgElement("path");
    line.setAttribute("d", coordinates.map((item) => item.command).join(" "));
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", palette.red);
    line.setAttribute("stroke-width", "2.7");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("stroke-linejoin", "round");
    group.appendChild(line);

    coordinates.forEach((point) => {
        const dot = svgElement("circle");
        dot.setAttribute("cx", String(point.x));
        dot.setAttribute("cy", String(point.y));
        dot.setAttribute("r", "3.8");
        dot.setAttribute("class", "evm-gauge-spark-dot");
        group.appendChild(dot);
    });
}

function drawVariation(group: SVGGElement, data: GaugeData, palette: VisualPalette, layout: GaugeLayout): void {
    const variation = numberValue(data.variation);
    const x = Math.min(layout.width - 60, layout.centerX + layout.width * 0.31);
    const y = layout.sparkY + layout.sparkH * 0.52;
    if (variation !== null) {
        drawVariationArrow(group, variation >= 0, palette.red, x - 38, y);
    }
    const value = svgText(variation === null ? "\u2014" : signedDecimal(data.variation), x, y + 2, "middle", "evm-gauge-variation-value");
    value.setAttribute("fill", palette.red);
    group.appendChild(value);
    group.appendChild(svgText("vs semana anterior", x - 4, y + 18, "middle", "evm-gauge-variation-caption"));
}

function drawVariationArrow(group: SVGGElement, isUp: boolean, color: string, x: number, y: number): void {
    const path = svgElement("path");
    path.setAttribute("d", isUp ? `M ${x} ${y + 8} L ${x + 15} ${y - 7} M ${x + 15} ${y - 7} L ${x + 15} ${y + 4} M ${x + 15} ${y - 7} L ${x + 4} ${y - 7}` : `M ${x} ${y - 7} L ${x + 15} ${y + 8} M ${x + 15} ${y + 8} L ${x + 15} ${y - 3} M ${x + 15} ${y + 8} L ${x + 4} ${y + 8}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", "4");
    path.setAttribute("stroke-linecap", "butt");
    path.setAttribute("stroke-linejoin", "miter");
    group.appendChild(path);
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
    const value = (status ?? "").toLowerCase();
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

function statusColor(className: string, palette: VisualPalette): string {
    if (className === "success") {
        return palette.green;
    }
    if (className === "warning" || className === "danger") {
        return palette.red;
    }
    return palette.blue;
}
