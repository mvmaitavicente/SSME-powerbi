"use strict";

import { DataValue, PerformanceData } from "../types";
import { createElement, currency, date, decimalUpTo, numberValue, svgElement } from "../utils/format";

type PerformanceIcon = "clock" | "calendar" | "check" | "money" | "coins" | "chart"
    | "hourglass" | "speed" | "balance" | "calendarArrow" | "costChange" | "target";

const iconColors: Record<PerformanceIcon, string> = {
    clock: "#1D4DFF",
    calendar: "#18A64A",
    check: "#8B4BEF",
    money: "#FF7A00",
    coins: "#FF7A00",
    chart: "#001B8E",
    hourglass: "#1D4DFF",
    speed: "#18A64A",
    balance: "#8B4BEF",
    calendarArrow: "#001B8E",
    costChange: "#FF7A00",
    target: "#FF7A00"
};

export function renderPerformance(data: PerformanceData): HTMLElement {
    const card = createElement("section", "evm-card evm-performance-card");
    card.appendChild(createElement("div", "evm-section-title", "Desempeno del Proyecto"));

    card.appendChild(metricPair("clock", "SAC", weeks(data.SAC), "ETC (t)", weeks(data.ETCT)));
    card.appendChild(metricPair("calendar", "VAC (t)", weeks(data.VACT), "SPI (t)", ratioValue(data.SPIT)));
    card.appendChild(metricPair("check", "SV (t)", weeks(data.SVT), "SV (w)", currency(data.SVW)));
    card.appendChild(metricPair("chart", "TSPI (t)", ratioValue(data.TSPIT), "IETC (t)", date(data.IETCT)));
    card.appendChild(metricPair("money", "BAC", currency(data.BAC), "CV", currency(data.CV)));
    card.appendChild(metricPair("coins", "ETC (c)", currency(data.ETCC), "VAC (c)", currency(data.VACC)));

    return card;
}

function progressRow(icon: PerformanceIcon, leftLabel: string, pctValue: DataValue, pctText: string, rightLabel: string, rightValue: string): HTMLElement {
    const row = createElement("div", "evm-performance-row");
    const progressBlock = createElement("div", `evm-progress-block ${icon}`);
    progressBlock.appendChild(createElement("span", "performance-label", leftLabel));
    const progress = createElement("div", `evm-progress ${icon}`);
    const fill = createElement("i");
    if (isProgressOverrun(pctValue)) {
        progress.classList.add("overrun");
    }
    fill.style.width = `${progressWidthPct(pctValue)}%`;
    progress.appendChild(fill);
    progressBlock.appendChild(progress);
    progressBlock.appendChild(createElement("strong", undefined, pctText));

    const right = createElement("div");
    right.appendChild(createElement("span", "performance-label", rightLabel));
    right.appendChild(createElement("strong", undefined, rightValue));
    row.appendChild(renderPerformanceIcon(icon));
    row.appendChild(progressBlock);
    row.appendChild(right);
    return row;
}

function progressPercentText(value: DataValue): string {
    const parsed = numberValue(value);
    if (parsed === null) {
        return "—";
    }
    return `${(parsed * 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}%`;
}

function progressWidthPct(value: DataValue): number {
    const parsed = numberValue(value);
    if (parsed === null) {
        return 0;
    }
    return Math.max(0, Math.min(100, parsed * 100));
}

function isProgressOverrun(value: DataValue): boolean {
    const parsed = numberValue(value);
    return parsed !== null && parsed > 1;
}

function weeks(value: DataValue): string {
    return `${decimalUpTo(value)} sem.`;
}

function ratioValue(value: DataValue): string {
    const parsed = numberValue(value);
    return parsed === null ? "—" : parsed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function metricPair(icon: PerformanceIcon, leftLabel: string, leftValue: string, rightLabel: string, rightValue: string, tone: "alert" | "favorable" | null = null): HTMLElement {
    const row = createElement("div", `evm-performance-row${tone ? ` ${tone}` : ""}`);
    row.classList.add("evm-performance-row--pair");
    const leftMetric = metric(leftLabel, leftValue);
    leftMetric.classList.add("evm-performance-metric--with-icon");
    leftMetric.prepend(renderPerformanceIcon(icon));
    row.appendChild(leftMetric);
    const rightIcons: Record<string, PerformanceIcon> = {
        "ETC (t)": "hourglass",
        "SPI (t)": "speed",
        "SV (w)": "balance",
        "IETC (t)": "calendarArrow",
        "CV": "costChange",
        "VAC (c)": "target"
    };
    const rightMetric = metric(rightLabel, rightValue);
    rightMetric.classList.add("evm-performance-metric--with-icon");
    rightMetric.prepend(renderPerformanceIcon(rightIcons[rightLabel] ?? icon));
    row.appendChild(rightMetric);
    return row;
}

function metricSingle(icon: PerformanceIcon, label: string, value: string, tone: "alert" | "favorable" | null = null): HTMLElement {
    const row = createElement("div", `evm-performance-row single${tone ? ` ${tone}` : ""}`);
    const singleMetric = metric(label, value);
    singleMetric.classList.add("evm-performance-main");
    row.appendChild(renderPerformanceIcon(icon));
    row.appendChild(singleMetric);
    return row;
}

function metric(label: string, value: string): HTMLElement {
    const wrapper = createElement("div", "evm-performance-metric");
    const tooltip = performanceTooltip(label);
    if (tooltip) {
        wrapper.setAttribute("aria-label", tooltip);
        wrapper.tabIndex = 0;
    }
    wrapper.appendChild(metricLabel(label));
    wrapper.appendChild(createElement("strong", undefined, value));
    if (tooltip) {
        const tooltipNode = createElement("span", "evm-performance-tooltip", tooltip);
        tooltipNode.setAttribute("role", "tooltip");
        wrapper.appendChild(tooltipNode);
    }
    return wrapper;
}

function performanceTooltip(label: string): string | null {
    const tooltips: Record<string, string> = {
        "SAC": "CRONOGRAMA APROBADO - (SAC)",
        "ETC (t)": "ESTIMACION PARA COMPLETAR DE TIEMPO - ETC (t)",
        "VAC (t)": "VARIACION A LA CONCLUSION DE TIEMPO - VAC (t)",
        "SPI (t)": "INDICE DE RENDIMIENTO DEL TIEMPO - SPI (t)",
        "SV (t)": "VARIACION DEL CRONOGRAMA DE TIEMPO - SV (t)",
        "SV (w)": "VARIACION DEL CRONOGRAMA DE TRABAJO - SV (w)",
        "TSPI (t)": "INDICE DE RENDIMIENTO DEL TIEMPO POR COMPLETAR - TSPI (t)",
        "IETC (t)": "ESTIMACION INDEPENDIENTE DEL TIEMPO PARA COMPLETAR - IETC (t)",
        "BAC": "PRESUPUESTO APROBADO - (BAC)",
        "CV": "VARIACION DE COSTOS - CV",
        "ETC (c)": "ESTIMACION PARA COMPLETAR - ETC (c)",
        "VAC (c)": "VARIACION A LA CONCLUSION DE COSTO - VAC (c)"
    };
    return tooltips[label] ?? null;
}

function metricLabel(label: string): HTMLElement {
    const forcedBreaks: Record<string, [string, string]> = {
        "Presupuesto Programado (BAC)": ["Presupuesto Programado", "(BAC)"],
        "Costo Estimado al Termino (EAC)": ["Costo Estimado al", "Termino (EAC)"]
    };
    const parts = forcedBreaks[label];
    if (!parts) {
        return createElement("span", "performance-label", label);
    }

    const item = createElement("span", "performance-label two-line");
    item.appendChild(document.createTextNode(parts[0]));
    item.appendChild(document.createElement("br"));
    item.appendChild(document.createTextNode(parts[1]));
    return item;
}

function renderPerformanceIcon(icon: PerformanceIcon): HTMLElement {
    const wrapper = createElement("div", `evm-performance-icon ${icon}`);
    const svg = svgElement("svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", iconColors[icon]);
    svg.setAttribute("stroke-width", "2.3");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");

    if (icon === "hourglass") {
        appendSvg(svg, path("M6 3h12M6 21h12M7 3v4l5 5-5 5v4M17 3v4l-5 5 5 5v4M9 18h6"));
    } else if (icon === "speed") {
        appendSvg(svg, path("M4 18a9 9 0 1 1 16 0M12 12l5-5M5 12H3M12 5V3M19 12h2"), circle(12, 12, 2));
    } else if (icon === "balance") {
        appendSvg(svg, path("M12 3v18M8 21h8M4 7h16M5 7l-3 7h6L5 7M19 7l-3 7h6l-3-7M2 14q3 5 6 0M16 14q3 5 6 0"));
    } else if (icon === "calendarArrow") {
        appendSvg(svg, rect(3, 5, 18, 16, 2), path("M7 3v4M17 3v4M3 10h18M8 15h8M13 12l3 3-3 3"));
    } else if (icon === "costChange") {
        appendSvg(svg, path("M4 7h15l-3-3M20 17H5l3 3M12 8v8M15 10h-4a2 2 0 0 0 0 4h2a2 2 0 0 0 0-4"));
    } else if (icon === "target") {
        appendSvg(svg, circle(11, 13, 8), circle(11, 13, 4), path("M11 13l9-9M16 4h4v4"));
    } else if (icon === "clock") {
        appendSvg(svg, circle(12, 12, 9), path("M12 7v5l3 2"));
    } else if (icon === "calendar") {
        appendSvg(svg, rect(4, 5, 16, 15, 2), path("M8 3v4M16 3v4M4 10h16"), path("M8 14h2M12 14h2M16 14h.01M8 17h2M12 17h2M16 17h.01"));
    } else if (icon === "check") {
        appendSvg(svg, circle(12, 12, 9), path("M7.8 12.4l2.7 2.7 5.8-6.1"));
    } else if (icon === "money") {
        appendSvg(svg, circle(12, 12, 9), path("M12 6v12M15.2 8.4c-.7-.6-1.7-1-3-1-1.6 0-2.7.8-2.7 2 0 1.4 1.4 1.8 2.8 2.2 1.5.4 3 .8 3 2.4 0 1.3-1.2 2.2-3.1 2.2-1.4 0-2.5-.4-3.4-1.2"));
    } else if (icon === "coins") {
        appendSvg(svg, ellipse(12, 6, 6.5, 2.5), path("M5.5 6v4c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V6"), path("M5.5 10v4c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-4"), path("M5.5 14v4c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-4"));
    } else {
        appendSvg(svg, path("M4 18h16"), path("M6 15l3-3 3 2 5-7"), path("M6 18v-3M12 18v-4M18 18v-7"));
    }

    wrapper.appendChild(svg);
    return wrapper;
}

function appendSvg(svg: SVGSVGElement, ...children: SVGElement[]): void {
    children.forEach((child) => svg.appendChild(child));
}

function path(d: string): SVGPathElement {
    const item = svgElement("path");
    item.setAttribute("d", d);
    return item;
}

function circle(cx: number, cy: number, r: number): SVGCircleElement {
    const item = svgElement("circle");
    item.setAttribute("cx", String(cx));
    item.setAttribute("cy", String(cy));
    item.setAttribute("r", String(r));
    return item;
}

function rect(x: number, y: number, width: number, height: number, rx: number): SVGRectElement {
    const item = svgElement("rect");
    item.setAttribute("x", String(x));
    item.setAttribute("y", String(y));
    item.setAttribute("width", String(width));
    item.setAttribute("height", String(height));
    item.setAttribute("rx", String(rx));
    return item;
}

function ellipse(cx: number, cy: number, rx: number, ry: number): SVGEllipseElement {
    const item = svgElement("ellipse");
    item.setAttribute("cx", String(cx));
    item.setAttribute("cy", String(cy));
    item.setAttribute("rx", String(rx));
    item.setAttribute("ry", String(ry));
    return item;
}
