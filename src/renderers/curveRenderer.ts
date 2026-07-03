"use strict";

import { CurveData, CurveHistoryPoint, CurveReferences, DataValue, VisualPalette } from "../types";
import { createElement, decimal, numberValue, svgElement, text } from "../utils/format";

type SeriesKey = "PV" | "EV" | "AC";

interface PlotArea {
    left: number;
    top: number;
    width: number;
    height: number;
}

interface PointCoordinate {
    x: number;
    y: number;
    week: number;
    value: number;
}

const viewBox = { width: 980, height: 520 };
const plot: PlotArea = { left: 96, top: 62, width: 750, height: 348 };
const series: Array<{ key: SeriesKey; label: string; className: string }> = [
    { key: "PV", label: "PV (Valor Planificado)", className: "pv" },
    { key: "EV", label: "EV (Valor Ganado)", className: "ev" },
    { key: "AC", label: "AC (Costo Actual)", className: "ac" }
];

export function renderCurve(curve: CurveData, palette: VisualPalette): HTMLElement {
    const card = createElement("section", "evm-card evm-curve-card");
    const title = createElement("div", "evm-section-title", "Curva S - Desempeno del Proyecto (EVM)");
    const wrap = createElement("div", "evm-curve-svg-wrap");
    const svg = svgElement("svg");
    svg.setAttribute("viewBox", `0 0 ${viewBox.width} ${viewBox.height}`);
    svg.classList.add("evm-curve-svg");
    svg.replaceChildren();

    if (!curve.history.length) {
        addText(svg, "Sin datos de curva S", viewBox.width / 2, viewBox.height / 2, "middle", "evm-empty-svg");
    } else {
        drawCurve(svg, curve, palette);
    }

    wrap.appendChild(svg);
    card.appendChild(title);
    card.appendChild(wrap);
    card.appendChild(renderCurveSummary(curve));
    return card;
}

function drawCurve(svg: SVGSVGElement, curve: CurveData, palette: VisualPalette): void {
    const points = curve.history;
    const references = curve.references;
    const currentPoint = curve.current;
    const sacWeek = numberValue(references.SAC);
    const eacWeek = numberValue(references.EACT);
    const allWeeks = points.map((point) => numberValue(point.SemanaProyecto)).filter((week): week is number => week !== null);
    const scalarMaxWeek = maxNumber([eacWeek, sacWeek]);
    const rawMaxCurveWeek = allWeeks.length ? Math.max(...allWeeks) : null;
    const maxCurveWeek = scalarMaxWeek !== null && rawMaxCurveWeek !== null ? Math.min(rawMaxCurveWeek, scalarMaxWeek) : rawMaxCurveWeek;
    const axisMaxWeek = Math.max(eacWeek ?? 0, sacWeek ?? 0, maxCurveWeek ?? 0, 1);
    const visiblePoints = [...points]
        .filter((point) => {
            const week = numberValue(point.SemanaProyecto);
            return week !== null && week <= axisMaxWeek;
        })
        .sort((a, b) => (numberValue(a.SemanaProyecto) ?? 0) - (numberValue(b.SemanaProyecto) ?? 0));
    const pointsToDraw = visiblePoints.length ? visiblePoints : points;
    const yMax = paddedMax(pointsToDraw, currentPoint, references);
    const xScale = (week: number): number => plot.left + (week / axisMaxWeek) * plot.width;
    const yScale = (value: number): number => plot.top + plot.height - (value / yMax) * plot.height;

    console.debug("Curve roles read", {
        curvaSAC: sacWeek,
        curvaEACT: eacWeek,
        curvaAT: numberValue(references.AT),
        curvaES: numberValue(references.ES),
        xMax: axisMaxWeek,
        source: "curve-only"
    });
    drawAxes(svg, axisMaxWeek, yMax, xScale, yScale);
    drawBacLine(svg, references, yScale);
    drawEacCostLine(svg, references, xScale, yScale);
    drawEsLine(svg, references, xScale);
    drawSacLine(svg, references, xScale);

    const seriesLayer = svgElement("g");
    seriesLayer.setAttribute("class", "evm-series-layer");
    seriesLayer.replaceChildren();
    series.forEach((item) => {
        const coordinates = coordinatesFor(pointsToDraw, item.key, xScale, yScale);
        drawSegmentedLine(seriesLayer, coordinates, `evm-line ${item.className}`);
        drawDots(seriesLayer, coordinates, `evm-dot ${item.className}`);
    });
    svg.appendChild(seriesLayer);

    drawEacTimeLine(svg, references, xScale, yScale);
    drawCurrentValueLabels(svg, currentPoint, xScale, yScale);
    drawCurrentLine(svg, references, xScale);
    drawVacCost(svg, references, xScale, yScale);
    drawVacTime(svg, references, xScale);
}

function drawAxes(svg: SVGSVGElement, maxWeek: number, maxValue: number, xScale: (week: number) => number, yScale: (value: number) => number): void {
    addText(svg, "Costo (S/)", plot.left - 75, plot.top - 20, "start", "evm-axis-title");

    for (let index = 0; index <= 4; index++) {
        const value = (maxValue / 4) * index;
        const y = yScale(value);
        drawLine(svg, plot.left, y, plot.left + plot.width, y, index === 0 ? "evm-axis-line" : "evm-grid-line");
        addText(svg, fullCurrency(value), plot.left - 18, y + 4, "end", "evm-axis-label");
    }

    drawLine(svg, plot.left, plot.top, plot.left, plot.top + plot.height, "evm-axis-line");
    drawLine(svg, plot.left, plot.top + plot.height, plot.left + plot.width, plot.top + plot.height, "evm-axis-line");

    const interval = tickInterval(maxWeek);
    for (let week = 0; week <= maxWeek; week += interval) {
        const x = xScale(week);
        drawLine(svg, x, plot.top + plot.height, x, plot.top + plot.height + 6, "evm-axis-tick");
        addText(svg, formatWeek(week), x, plot.top + plot.height + 25, "middle", "evm-axis-label");
    }
    if (maxWeek % interval !== 0) {
        const x = xScale(maxWeek);
        drawLine(svg, x, plot.top + plot.height, x, plot.top + plot.height + 6, "evm-axis-tick");
        addText(svg, formatWeek(maxWeek), x, plot.top + plot.height + 25, "middle", "evm-axis-label");
    }
    addText(svg, "Semanas", plot.left + plot.width / 2, plot.top + plot.height + 55, "middle", "evm-axis-title");
}

function drawBacLine(svg: SVGSVGElement, references: CurveReferences, yScale: (value: number) => number): void {
    const bac = numberValue(references.BAC);
    if (bac === null) {
        return;
    }
    const y = yScale(bac);
    drawLine(svg, plot.left, y, plot.left + plot.width, y, "evm-bac-line");
    addText(svg, `BAC = ${fullCurrency(bac)}`, plot.left + 8, y - 10, "start", "evm-target-label");
}

function drawSacLine(svg: SVGSVGElement, references: CurveReferences, xScale: (week: number) => number): void {
    const sac = numberValue(references.SAC);
    if (sac === null) {
        return;
    }
    const x = xScale(sac);
    drawLine(svg, x, plot.top, x, plot.top + plot.height, "evm-sac-line-vertical");
    addText(svg, "SAC", x, plot.top + plot.height + 42, "middle", "evm-axis-label");
    addText(svg, formatWeek(sac), x, plot.top + plot.height + 58, "middle", "evm-axis-label");
}

function drawEsLine(svg: SVGSVGElement, references: CurveReferences, xScale: (week: number) => number): void {
    const es = numberValue(references.ES);
    if (es === null) {
        return;
    }
    const x = xScale(es);
    addText(svg, "ES", x, plot.top + plot.height + 42, "middle", "evm-es-label");
    addText(svg, formatWeek(es), x, plot.top + plot.height + 58, "middle", "evm-es-label");
}

function coordinatesFor(points: CurveHistoryPoint[], key: SeriesKey, xScale: (week: number) => number, yScale: (value: number) => number): Array<PointCoordinate | null> {
    return points.map((point) => {
        const week = numberValue(point.SemanaProyecto);
        const value = numberValue(point[key]);
        if (week === null || value === null) {
            return null;
        }
        return { x: xScale(week), y: yScale(value), week, value };
    });
}

function drawSegmentedLine(svg: SVGSVGElement | SVGGElement, coordinates: Array<PointCoordinate | null>, className: string): void {
    const commands: string[] = [];
    let segment: PointCoordinate[] = [];
    const flush = (): void => {
        if (segment.length > 1) {
            commands.push(segment.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" "));
        }
        segment = [];
    };

    coordinates.forEach((point) => {
        if (point === null) {
            flush();
            return;
        }
        segment.push(point);
    });
    flush();

    if (!commands.length) {
        return;
    }

    const path = svgElement("path");
    path.setAttribute("d", commands.join(" "));
    path.setAttribute("class", className);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-width", "2.5");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("filter", "none");
    svg.appendChild(path);
}

function drawDots(svg: SVGSVGElement | SVGGElement, coordinates: Array<PointCoordinate | null>, className: string): void {
    coordinates.forEach((point) => {
        if (!point) {
            return;
        }
        const dot = svgElement("circle");
        dot.setAttribute("cx", String(point.x));
        dot.setAttribute("cy", String(point.y));
        dot.setAttribute("r", "3.5");
        dot.setAttribute("class", className);
        svg.appendChild(dot);
    });
}

function drawEacCostLine(svg: SVGSVGElement, references: CurveReferences, xScale: (week: number) => number, yScale: (value: number) => number): void {
    const eacWeek = numberValue(references.EACT);
    const eacCost = numberValue(references.EACC);
    if (eacWeek === null || eacCost === null) {
        return;
    }
    const x2 = xScale(eacWeek);
    const y2 = yScale(eacCost);
    drawLine(svg, plot.left, y2, x2, y2, "evm-eac-cost-line");

    const dot = svgElement("circle");
    dot.setAttribute("cx", String(x2));
    dot.setAttribute("cy", String(y2));
    dot.setAttribute("r", "4");
    dot.setAttribute("class", "evm-dot eac");
    svg.appendChild(dot);

    addText(svg, `EAC(c) = ${fullCurrency(eacCost)}`, Math.min(x2 - 8, plot.left + plot.width - 6), y2 - 18, "end", "evm-eac-label");
}

function drawEacTimeLine(svg: SVGSVGElement, references: CurveReferences, xScale: (week: number) => number, yScale: (value: number) => number): void {
    const eacWeek = numberValue(references.EACT);
    const eacCost = numberValue(references.EACC);
    if (eacWeek === null) {
        return;
    }
    const x = xScale(eacWeek);
    const yEnd = eacCost === null ? plot.top + plot.height : yScale(eacCost);
    drawLine(svg, x, plot.top, x, plot.top + plot.height, "evm-eac-time-line");
    if (eacCost !== null) {
        drawLine(svg, x, yEnd, x + 28, yEnd, "evm-eac-cost-guide");
    }
    addText(svg, "EAC(t)", x, plot.top + plot.height + 42, "middle", "evm-eac-label");
    addText(svg, formatWeek(eacWeek), x, plot.top + plot.height + 58, "middle", "evm-eac-label");
}

function drawCurrentValueLabels(svg: SVGSVGElement, currentPoint: CurveHistoryPoint, xScale: (week: number) => number, yScale: (value: number) => number): void {
    const week = numberValue(currentPoint.SemanaProyecto);
    if (week === null) {
        return;
    }
    const x = xScale(week);
    [
        { label: "PV", value: currentPoint.PV, className: "pv", offset: -34 },
        { label: "AC", value: currentPoint.AC, className: "ac", offset: 0 },
        { label: "EV", value: currentPoint.EV, className: "ev", offset: 34 }
    ].forEach((item) => {
        const value = numberValue(item.value);
        if (value === null) {
            return;
        }
        drawValueLabel(svg, `${item.label} = ${fullCurrency(value)}`, Math.min(x + 14, plot.left + plot.width - 146), yScale(value) + item.offset, item.className);
    });
}

function drawValueLabel(svg: SVGSVGElement, label: string, x: number, rawY: number, className: string): void {
    const y = Math.max(plot.top + 20, Math.min(rawY, plot.top + plot.height - 20));
    const background = svgElement("rect");
    background.setAttribute("x", String(x - 4));
    background.setAttribute("y", String(y - 19));
    background.setAttribute("width", "154");
    background.setAttribute("height", "30");
    background.setAttribute("rx", "4");
    background.setAttribute("class", "evm-final-label-bg");
    svg.appendChild(background);
    addText(svg, label, x, y, "start", `evm-final-label ${className}`);
}

function drawCurrentLine(svg: SVGSVGElement, references: CurveReferences, xScale: (week: number) => number): void {
    const week = numberValue(references.AT);
    if (week === null) {
        return;
    }
    const x = xScale(week);
    addText(svg, "Fecha de Estado", x, plot.top - 15, "middle", "evm-status-label");
    addText(svg, "AT", x, plot.top + plot.height + 42, "middle", "evm-current-week-label");
    addText(svg, formatWeek(week), x, plot.top + plot.height + 58, "middle", "evm-current-week-label");
}

function drawVacCost(svg: SVGSVGElement, references: CurveReferences, xScale: (week: number) => number, yScale: (value: number) => number): void {
    const bac = numberValue(references.BAC);
    const eacCost = numberValue(references.EACC);
    const eacWeek = numberValue(references.EACT);
    if (bac === null || eacCost === null || eacWeek === null) {
        return;
    }
    const x = Math.min(xScale(eacWeek) + 26, plot.left + plot.width - 60);
    const y1 = yScale(bac);
    const y2 = yScale(eacCost);
    drawLine(svg, x, y1, x, y2, "evm-vac-line");
    drawLine(svg, x - 5, y1, x + 5, y1, "evm-vac-line");
    drawLine(svg, x - 5, y2, x + 5, y2, "evm-vac-line");
    addText(svg, "VAC(c)", x + 22, Math.min(y1, y2) + 12, "start", "evm-vac-label");
    addText(svg, "Sobre Costo", x + 22, Math.min(y1, y2) + 30, "start", "evm-vac-label");
    addText(svg, "Proyectado", x + 22, Math.min(y1, y2) + 45, "start", "evm-vac-label");
    addText(svg, fullCurrency(references.VACC), x + 22, Math.min(y1, y2) + 64, "start", "evm-vac-label");
}

function drawVacTime(svg: SVGSVGElement, references: CurveReferences, xScale: (week: number) => number): void {
    const sac = numberValue(references.SAC);
    const eacWeek = numberValue(references.EACT);
    if (sac === null || eacWeek === null) {
        return;
    }
    const y = plot.top + plot.height - 72;
    const x1 = xScale(sac);
    const x2 = xScale(eacWeek);
    drawLine(svg, x1, y, x2, y, "evm-vac-line");
    drawLine(svg, x1, y - 5, x1, y + 5, "evm-vac-line");
    drawLine(svg, x2, y - 5, x2, y + 5, "evm-vac-line");
    addText(svg, "VAC(t)", (x1 + x2) / 2, y - 16, "middle", "evm-vac-label");
    addText(svg, "Retraso Proyectado", (x1 + x2) / 2, y + 20, "middle", "evm-vac-label");
    addText(svg, `${text(references.VACT)} semanas`, (x1 + x2) / 2, y + 36, "middle", "evm-vac-label");
}

function drawLine(svg: SVGSVGElement, x1: number, y1: number, x2: number, y2: number, className: string): SVGLineElement {
    const line = svgElement("line");
    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
    line.setAttribute("class", className);
    svg.appendChild(line);
    return line;
}

function addText(svg: SVGSVGElement, label: string, x: number, y: number, anchor: "start" | "middle" | "end", className: string): SVGTextElement {
    const item = svgElement("text");
    item.setAttribute("x", String(x));
    item.setAttribute("y", String(y));
    item.setAttribute("text-anchor", anchor);
    item.setAttribute("class", className);
    item.textContent = label;
    svg.appendChild(item);
    return item;
}

function renderCurveSummary(curve: CurveData): HTMLElement {
    const row = createElement("div", "evm-summary-grid");
    const currentPoint = curve.current;
    const references = curve.references;
    [
        ["BAC", fullCurrency(references.BAC)],
        ["PV", fullCurrency(currentPoint.PV)],
        ["EV", fullCurrency(currentPoint.EV)],
        ["AC", fullCurrency(currentPoint.AC)],
        ["TSPI(t)", decimal(references.TSPIT)],
        ["SPI(t)", decimal(references.SPIT)],
        ["EAC(c)", fullCurrency(references.EACC)],
        ["EAC(t)", text(references.EACT)],
        ["VAC(c)", fullCurrency(references.VACC)],
        ["VAC(t)", `${text(references.VACT)} sem.`]
    ].forEach(([label, value]) => {
        const cell = createElement("div", "evm-key-cell");
        cell.appendChild(createElement("span", undefined, label));
        cell.appendChild(createElement("strong", undefined, value));
        row.appendChild(cell);
    });
    return row;
}

function paddedMax(points: CurveHistoryPoint[], currentPoint: CurveHistoryPoint, references: CurveReferences): number {
    const values = points
        .flatMap((point) => [point.PV, point.EV, point.AC])
        .concat([references.BAC, currentPoint.PV, currentPoint.EV, currentPoint.AC, references.EACC])
        .map((value) => numberValue(value))
        .filter((value): value is number => value !== null);
    const max = Math.max(...values, 1);
    return max * 1.1;
}

function maxNumber(values: Array<number | null>): number | null {
    const parsed = values.filter((value): value is number => value !== null);
    return parsed.length ? Math.max(...parsed) : null;
}

function tickInterval(maxWeek: number): number {
    if (maxWeek > 40) {
        return 5;
    }
    if (maxWeek > 16) {
        return 2;
    }
    return 1;
}

function fullCurrency(value: DataValue): string {
    const parsed = numberValue(value);
    if (parsed === null) {
        return text(null);
    }
    const hasDecimals = Math.abs(parsed % 1) > 0;
    return `S/ ${parsed.toLocaleString("en-US", { minimumFractionDigits: hasDecimals ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function formatWeek(value: number): string {
    return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}
