"use strict";

import { DataValue, PerformanceData } from "../types";
import { createElement, currency, date, percent, percentRatio, svgElement, text } from "../utils/format";

type PerformanceIcon = "clock" | "calendar" | "check" | "money" | "coins" | "chart";

const iconColors: Record<PerformanceIcon, string> = {
    clock: "#1D4DFF",
    calendar: "#18A64A",
    check: "#8B4BEF",
    money: "#FF7A00",
    coins: "#FF7A00",
    chart: "#001B8E"
};

export function renderPerformance(data: PerformanceData): HTMLElement {
    const card = createElement("section", "evm-card evm-performance-card");
    card.appendChild(createElement("div", "evm-section-title", "Desempeno del Proyecto"));

    card.appendChild(progressRow("clock", "Plazo Consumido", data.PlazoConsumidoPct, `${percent(data.PlazoConsumidoPct)}`, "Plazo Restante", `${text(data.PlazoRestanteSemanas)} sem.`));
    card.appendChild(metricPair("calendar", "Plazo Programado Total", `${text(data.PlazoProgramadoTotalSemanas)} semanas`, "Plazo Proyectado", `${text(data.PlazoProyectadoSemanas)} semanas`));
    card.appendChild(metricPair("check", "Retraso Proyectado", `${text(data.RetrasoProyectadoSemanas)} semanas`, "Termino Proyectado", date(data.TerminoProyectado), true));
    card.appendChild(progressRow("money", "Presupuesto Consumido", data.PresupuestoConsumidoPct, `${percent(data.PresupuestoConsumidoPct)}`, "Presupuesto Restante", currency(data.PresupuestoRestante)));
    card.appendChild(metricPair("coins", "Presupuesto Programado (BAC)", currency(data.PresupuestoProgramadoBAC), "Costo Estimado al Termino (EAC)", currency(data.CostoEstimadoTerminoEAC)));
    card.appendChild(metricSingle("chart", "Sobre Costo Proyectado", `${currency(data.SobreCostoProyectadoVAC)} (${percent(data.SobreCostoProyectadoPct)})`, true));

    return card;
}

function progressRow(icon: PerformanceIcon, leftLabel: string, pctValue: DataValue, pctText: string, rightLabel: string, rightValue: string): HTMLElement {
    const row = createElement("div", "evm-performance-row");
    const progressBlock = createElement("div", `evm-progress-block ${icon}`);
    progressBlock.appendChild(createElement("span", "performance-label", leftLabel));
    const progress = createElement("div", `evm-progress ${icon}`);
    const fill = createElement("i");
    fill.style.width = `${percentRatio(pctValue)}%`;
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

function metricPair(icon: PerformanceIcon, leftLabel: string, leftValue: string, rightLabel: string, rightValue: string, alert: boolean = false): HTMLElement {
    const row = createElement("div", `evm-performance-row${alert ? " alert" : ""}`);
    row.appendChild(renderPerformanceIcon(icon));
    row.appendChild(metric(leftLabel, leftValue));
    row.appendChild(metric(rightLabel, rightValue));
    return row;
}

function metricSingle(icon: PerformanceIcon, label: string, value: string, alert: boolean = false): HTMLElement {
    const row = createElement("div", `evm-performance-row single${alert ? " alert" : ""}`);
    const singleMetric = metric(label, value);
    singleMetric.classList.add("evm-performance-main");
    row.appendChild(renderPerformanceIcon(icon));
    row.appendChild(singleMetric);
    return row;
}

function metric(label: string, value: string): HTMLElement {
    const wrapper = createElement("div");
    wrapper.appendChild(metricLabel(label));
    wrapper.appendChild(createElement("strong", undefined, value));
    return wrapper;
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

    if (icon === "clock") {
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
