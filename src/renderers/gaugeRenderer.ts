"use strict";

import { DataValue, GaugeData, VisualPalette } from "../types";
import { createElement, decimal, numberValue, signedDecimal, svgElement, text } from "../utils/format";

const viewBox = {
    width: 320,
    height: 190,
    centerX: 160,
    centerY: 96,
    radius: 76,
    stroke: 15
};

export function renderGaugeGrid(gauges: GaugeData[], palette: VisualPalette): HTMLElement {
    const grid = createElement("section", "evm-gauge-grid");
    gauges.forEach((metric) => grid.appendChild(renderGauge(metric, palette)));
    return grid;
}

export function renderGauge(data: GaugeData, palette: VisualPalette): HTMLElement {
    const card = createElement("article", "evm-card evm-gauge-card");
    card.title = `${data.title}: ${text(data.value)} | Estado: ${text(data.status)}`;

    const svg = svgElement("svg");
    svg.setAttribute("viewBox", `0 0 ${viewBox.width} ${viewBox.height}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `${data.title} ${displayDecimal(data.value)}`);
    svg.classList.add("evm-gauge-svg");

    drawTitle(svg, data.title);
    appendGroup(svg, "backgroundArc", (group) => drawArc(group, -90, 90, "#EEF2F7", viewBox.stroke + 2));
    appendGroup(svg, "redArc", (group) => drawArc(group, -90, -58, palette.red, viewBox.stroke));
    appendGroup(svg, "orangeArc", (group) => drawArc(group, -58, 24, palette.orange, viewBox.stroke));
    appendGroup(svg, "greenArc", (group) => drawArc(group, 24, 90, palette.green, viewBox.stroke));
    appendGroup(svg, "labels", (group) => drawLabels(group, data));
    appendGroup(svg, "needle", (group) => drawNeedle(group, data, palette.blue));
    appendGroup(svg, "value", (group) => drawValue(group, data));
    appendGroup(svg, "status", (group) => drawStatus(group, data, palette));
    appendGroup(svg, "sparkline", (group) => drawSparkline(group, data, palette));
    appendGroup(svg, "variation", (group) => drawVariation(group, data, palette));

    card.appendChild(svg);
    return card;
}

function drawTitle(svg: SVGSVGElement, title: string): void {
    const group = svgElement("g");
    group.setAttribute("class", "title");
    const help = svgElement("circle");
    help.setAttribute("cx", "294");
    help.setAttribute("cy", "20");
    help.setAttribute("r", "8");
    help.setAttribute("class", "evm-gauge-help");
    group.appendChild(svgText(title, 18, 24, "start", "evm-gauge-title"));
    group.appendChild(help);
    group.appendChild(svgText("?", 294, 24, "middle", "evm-gauge-help-text"));
    svg.appendChild(group);
}

function appendGroup(svg: SVGSVGElement, className: string, draw: (group: SVGGElement) => void): void {
    const group = svgElement("g");
    group.setAttribute("class", className);
    draw(group);
    svg.appendChild(group);
}

function drawArc(group: SVGGElement, startAngle: number, endAngle: number, color: string, width: number): void {
    const path = svgElement("path");
    path.setAttribute("d", arcPath(startAngle, endAngle));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", String(width));
    path.setAttribute("stroke-linecap", "butt");
    group.appendChild(path);
}

function drawNeedle(group: SVGGElement, data: GaugeData, color: string): void {
    if (numberValue(data.value) === null) {
        return;
    }
    const angle = valueToAngle(data.value, data.min, data.max, data.target);
    group.setAttribute("transform", `rotate(${angle} ${viewBox.centerX} ${viewBox.centerY})`);

    const needle = svgElement("path");
    needle.setAttribute("d", `M ${viewBox.centerX - 4} ${viewBox.centerY} L ${viewBox.centerX} ${viewBox.centerY - viewBox.radius * 0.75} L ${viewBox.centerX + 4} ${viewBox.centerY} Z`);
    needle.setAttribute("fill", color);
    group.appendChild(needle);

    const pivot = svgElement("circle");
    pivot.setAttribute("cx", String(viewBox.centerX));
    pivot.setAttribute("cy", String(viewBox.centerY));
    pivot.setAttribute("r", "8");
    pivot.setAttribute("fill", color);
    group.appendChild(pivot);
}

function drawLabels(group: SVGGElement, data: GaugeData): void {
    group.appendChild(svgText(formatScale(data.min), 63, viewBox.centerY + 18, "middle", "evm-gauge-scale-label"));
    group.appendChild(svgText(formatScale(data.target), 160, 47, "middle", "evm-gauge-scale-label"));
    group.appendChild(svgText(formatScale(data.max), 257, viewBox.centerY + 18, "middle", "evm-gauge-scale-label"));
}

function drawValue(group: SVGGElement, data: GaugeData): void {
    group.appendChild(svgText(displayDecimal(data.value), viewBox.centerX, 128, "middle", "evm-gauge-main-value"));
}

function drawStatus(group: SVGGElement, data: GaugeData, palette: VisualPalette): void {
    const status = numberValue(data.value) === null ? "SIN DATO" : text(data.status, "Sin estado").toUpperCase();
    const className = statusClass(status);
    const badge = svgElement("rect");
    badge.setAttribute("x", "110");
    badge.setAttribute("y", "137");
    badge.setAttribute("width", "100");
    badge.setAttribute("height", "21");
    badge.setAttribute("rx", "10.5");
    badge.setAttribute("class", `evm-gauge-status-bg ${className}`);
    group.appendChild(badge);

    const label = svgText(status, 160, 152, "middle", `evm-gauge-status-text ${className}`);
    label.setAttribute("fill", statusColor(className, palette));
    group.appendChild(label);
}

function drawSparkline(group: SVGGElement, data: GaugeData, palette: VisualPalette): void {
    const box = { x: 18, y: 166, width: 154, height: 15 };
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
    line.setAttribute("stroke-width", "2");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("stroke-linejoin", "round");
    group.appendChild(line);

    coordinates.forEach((point) => {
        const dot = svgElement("circle");
        dot.setAttribute("cx", String(point.x));
        dot.setAttribute("cy", String(point.y));
        dot.setAttribute("r", "3");
        dot.setAttribute("class", "evm-gauge-spark-dot");
        group.appendChild(dot);
    });
}

function drawVariation(group: SVGGElement, data: GaugeData, palette: VisualPalette): void {
    const variation = numberValue(data.variation);
    if (variation !== null) {
        drawVariationArrow(group, variation >= 0, palette.red);
    }
    const value = svgText(variation === null ? "\u2014" : signedDecimal(data.variation), 265, 174, "middle", "evm-gauge-variation-value");
    value.setAttribute("fill", palette.red);
    group.appendChild(value);
    group.appendChild(svgText("vs semana anterior", 250, 187, "middle", "evm-gauge-variation-caption"));
}

function drawVariationArrow(group: SVGGElement, isUp: boolean, color: string): void {
    const path = svgElement("path");
    path.setAttribute("d", isUp ? "M 224 175 L 237 162 M 237 162 L 237 171 M 237 162 L 228 162" : "M 224 163 L 237 176 M 237 176 L 237 167 M 237 176 L 228 176");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", "4");
    path.setAttribute("stroke-linecap", "butt");
    path.setAttribute("stroke-linejoin", "miter");
    group.appendChild(path);
}

function arcPath(startAngle: number, endAngle: number): string {
    const start = pointOnGauge(startAngle);
    const end = pointOnGauge(endAngle);
    const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? "1" : "0";
    return `M ${start.x} ${start.y} A ${viewBox.radius} ${viewBox.radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function pointOnGauge(angle: number): { x: number; y: number } {
    const radians = (angle * Math.PI) / 180;
    return {
        x: viewBox.centerX + viewBox.radius * Math.sin(radians),
        y: viewBox.centerY - viewBox.radius * Math.cos(radians)
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
