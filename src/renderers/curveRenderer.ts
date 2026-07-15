"use strict";

import { CurveHistoryPoint, CurveReferences, DataValue, RenderCurveData, VisualPalette } from "../types";
import { createElement, decimal, numberValue, svgElement, text } from "../utils/format";

type SeriesKey = "PV" | "EV" | "AC";
type TimelineMarkerKey = "at" | "es" | "sac" | "eac";

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

interface SeriesCallout {
    label: string;
    className: string;
    point: PointCoordinate;
    labelY: number;
}

interface LineSegment {
    className: string;
    start: PointCoordinate;
    end: PointCoordinate;
}

interface LabelBounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

interface TimelineMarker {
    key: TimelineMarkerKey;
    label: string;
    className: string;
    priority: number;
    week: number;
    x: number;
}

interface CurveLayout {
    width: number;
    height: number;
    plot: PlotArea;
}

interface AxisDomain {
    min: number;
    max: number;
}

let plot: PlotArea = { left: 104, top: 66, width: 760, height: 430 };
const series: Array<{ key: SeriesKey; label: string; className: string }> = [
    { key: "PV", label: "PV (Valor Planificado)", className: "pv" },
    { key: "EV", label: "EV (Valor Ganado)", className: "ev" },
    { key: "AC", label: "AC (Costo Actual)", className: "ac" }
];

export function renderCurve(curve: RenderCurveData, palette: VisualPalette): HTMLElement {
    const card = createElement("section", "evm-card evm-curve-card");
    const title = createElement("div", "evm-section-title", "Curva S - Desempeno del Proyecto (EVM)");
    const wrap = createElement("div", "evm-curve-svg-wrap");
    const svg = svgElement("svg");
    svg.classList.add("evm-curve-svg");

    const render = (): void => {
        const rect = wrap.getBoundingClientRect();
        const layout = curveLayout(rect.width, rect.height);
        plot = layout.plot;
        svg.replaceChildren();
        svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);

        if (!curve.history.length) {
            addText(svg, "Sin datos de curva S", layout.width / 2, layout.height / 2, "middle", "evm-empty-svg");
        } else {
            drawCurve(svg, curve, palette);
        }
    };

    wrap.appendChild(svg);
    card.appendChild(title);
    card.appendChild(wrap);
    card.appendChild(renderCurveSummary(curve));
    render();
    if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(() => {
            if (!wrap.isConnected) {
                observer.disconnect();
                return;
            }
            render();
        });
        observer.observe(wrap);
    }
    return card;
}

function curveLayout(rawWidth: number, rawHeight: number): CurveLayout {
    const width = Math.max(920, Math.round(rawWidth || 980));
    const height = Math.max(560, Math.round(rawHeight || 620));
    const left = 128;
    const top = 54;
    const right = 172;
    const bottom = 102;
    return {
        width,
        height,
        plot: {
            left,
            top,
            width: Math.max(690, width - left - right),
            height: Math.max(450, height - top - bottom)
        }
    };
}

function drawCurve(svg: SVGSVGElement, curve: RenderCurveData, palette: VisualPalette): void {
    const points = curve.history;
    const references = curve.references;
    const currentPoint = curve.current;
    const sacWeek = numberValue(references.SAC);
    const eacWeek = numberValue(references.EACT);
    const atWeek = numberValue(references.AT);
    const allWeeks = points.map((point) => numberValue(point.SemanaProyecto)).filter((week): week is number => week !== null);
    const scalarMaxWeek = maxNumber([eacWeek, sacWeek]);
    const rawMaxCurveWeek = allWeeks.length ? Math.max(...allWeeks) : null;
    const maxCurveWeek = scalarMaxWeek !== null && rawMaxCurveWeek !== null ? Math.min(rawMaxCurveWeek, scalarMaxWeek) : rawMaxCurveWeek;
    const axisMinWeek = Math.max(0, (atWeek ?? 0) - 5);
    const rawAxisMaxWeek = Math.max(eacWeek ?? 0, sacWeek ?? 0, atWeek ?? 0, maxCurveWeek ?? 0, axisMinWeek + 1);
    const axisMaxWeek = Math.max(rawAxisMaxWeek, axisMinWeek + 1);
    const axisSpan = axisMaxWeek - axisMinWeek;
    const visiblePoints = [...points]
        .filter((point) => {
            const week = numberValue(point.SemanaProyecto);
            return week !== null && week >= axisMinWeek && week <= axisMaxWeek;
        })
        .sort((a, b) => (numberValue(a.SemanaProyecto) ?? 0) - (numberValue(b.SemanaProyecto) ?? 0));
    const pointsToDraw = visiblePoints.length ? visiblePoints : points;
    const yDomain = chartDomain(pointsToDraw, currentPoint, references);
    const xScale = (week: number): number => plot.left + ((week - axisMinWeek) / axisSpan) * plot.width;
    const yScale = (value: number): number => plot.top + plot.height - ((value - yDomain.min) / (yDomain.max - yDomain.min)) * plot.height;

    console.debug("Curve roles read", {
        curvaSAC: sacWeek,
        curvaEACT: eacWeek,
        curvaAT: atWeek,
        curvaES: numberValue(references.ES),
        xMin: axisMinWeek,
        xMax: axisMaxWeek,
        yMin: yDomain.min,
        yMax: yDomain.max,
        source: "curve-only"
    });
    drawAxes(svg, axisMinWeek, axisMaxWeek, yDomain, xScale, yScale);
    drawBacLine(svg, references, yScale);
    drawEacCostLine(svg, references, xScale, yScale);
    drawSacLine(svg, references, xScale);

    const seriesLayer = svgElement("g");
    seriesLayer.setAttribute("class", "evm-series-layer");
    seriesLayer.replaceChildren();
    const visualOffsets = seriesVisualOffsets(pointsToDraw, yScale);
    const segments: LineSegment[] = [];
    series.forEach((item) => {
        const coordinates = coordinatesFor(pointsToDraw, item.key, xScale, yScale, visualOffsets[item.key]);
        segments.push(...lineSegmentsFor(coordinates, item.className));
        drawSegmentedLine(seriesLayer, coordinates, `evm-line ${item.className}`);
        drawDots(seriesLayer, coordinates, `evm-dot ${item.className}`);
    });
    svg.appendChild(seriesLayer);

    drawEacTimeLine(svg, references, xScale, yScale);
    drawCurrentValueLabels(svg, pointsToDraw, xScale, yScale, visualOffsets, segments);
    drawCurrentLine(svg, references, xScale);
    drawTimelineMarkerLabels(svg, references, xScale);
    drawVacCost(svg, references, xScale, yScale);
    drawVacTime(svg, references, xScale);
}

function drawAxes(svg: SVGSVGElement, minWeek: number, maxWeek: number, yDomain: AxisDomain, xScale: (week: number) => number, yScale: (value: number) => number): void {
    addText(svg, "Costo (S/)", plot.left - 86, plot.top - 18, "start", "evm-axis-title");

    for (let index = 0; index <= 4; index++) {
        const value = yDomain.min + ((yDomain.max - yDomain.min) / 4) * index;
        const y = yScale(value);
        drawLine(svg, plot.left, y, plot.left + plot.width, y, index === 0 ? "evm-axis-line" : "evm-grid-line");
        addText(svg, wholeNumber(value), plot.left - 20, y + 7, "end", "evm-axis-label");
    }

    drawLine(svg, plot.left, plot.top, plot.left, plot.top + plot.height, "evm-axis-line");
    drawLine(svg, plot.left, plot.top + plot.height, plot.left + plot.width, plot.top + plot.height, "evm-axis-line");

    const interval = tickInterval(maxWeek - minWeek);
    const drawnTicks = new Set<string>();
    const addXTick = (week: number): void => {
        const key = formatWeek(week);
        if (drawnTicks.has(key)) {
            return;
        }
        drawnTicks.add(key);
        const x = xScale(week);
        drawLine(svg, x, plot.top + plot.height, x, plot.top + plot.height + 8, "evm-axis-tick");
        addText(svg, formatWeek(week), x, plot.top + plot.height + 32, "middle", "evm-axis-label");
    };

    addXTick(minWeek);
    const firstTick = Math.ceil(minWeek / interval) * interval;
    for (let week = firstTick; week <= maxWeek; week += interval) {
        addXTick(week);
    }
    addXTick(maxWeek);
    addText(svg, "Tiempo (Sem.)", xScale(minWeek), plot.top + plot.height + 68, "middle", "evm-axis-title");
}

function timelineMarkers(references: CurveReferences, xScale: (week: number) => number): TimelineMarker[] {
    const rawMarkers: TimelineMarker[] = [
        { key: "at", label: "AT", className: "evm-current-week-label", priority: 0, week: numberValue(references.AT) ?? NaN, x: 0 },
        { key: "es", label: "ES", className: "evm-es-label", priority: 1, week: numberValue(references.ES) ?? NaN, x: 0 },
        { key: "sac", label: "SAC", className: "evm-axis-label", priority: 2, week: numberValue(references.SAC) ?? NaN, x: 0 },
        { key: "eac", label: "EAC(t)", className: "evm-eac-label", priority: 3, week: numberValue(references.EACT) ?? NaN, x: 0 }
    ];
    return rawMarkers
        .filter((marker) => Number.isFinite(marker.week))
        .map((marker) => ({ ...marker, x: xScale(marker.week) }));
}

function drawTimelineMarkerLabels(svg: SVGSVGElement, references: CurveReferences, xScale: (week: number) => number): void {
    const markers = timelineMarkers(references, xScale);
    const groups = new Map<string, TimelineMarker[]>();
    markers.forEach((marker) => {
        const key = formatWeek(marker.week);
        groups.set(key, [...(groups.get(key) ?? []), marker]);
    });

    [...groups.values()]
        .map((group) => [...group].sort((a, b) => a.priority - b.priority))
        .sort((a, b) => a[0].x - b[0].x)
        .forEach((group) => {
            const x = group[0].x;
            const labelY = plot.top + plot.height + 50;
            const valueY = plot.top + plot.height + 74;
            drawGroupedMarkerLabel(svg, group, x, labelY);
            addText(svg, formatWeek(group[0].week), x, valueY, "middle", group[0].className);
        });
}

function drawGroupedMarkerLabel(svg: SVGSVGElement, group: TimelineMarker[], x: number, y: number): void {
    if (group.length === 1) {
        addText(svg, group[0].label, x, y, "middle", group[0].className);
        return;
    }

    const textItem = svgElement("text");
    textItem.setAttribute("x", String(x));
    textItem.setAttribute("y", String(y));
    textItem.setAttribute("text-anchor", "middle");
    textItem.setAttribute("class", "evm-timeline-group-label");
    group.forEach((marker, index) => {
        if (index > 0) {
            const separator = svgElement("tspan");
            separator.setAttribute("class", "evm-axis-label");
            separator.textContent = " | ";
            textItem.appendChild(separator);
        }
        const label = svgElement("tspan");
        label.setAttribute("class", marker.className);
        label.textContent = marker.label;
        textItem.appendChild(label);
    });
    svg.appendChild(textItem);
}

function drawBacLine(svg: SVGSVGElement, references: CurveReferences, yScale: (value: number) => number): void {
    const bac = numberValue(references.BAC);
    if (bac === null) {
        return;
    }
    const y = yScale(bac);
    drawLine(svg, plot.left, y, plot.left + plot.width + 34, y, "evm-bac-line");
    addText(svg, `BAC = ${fullCurrency(bac)}`, plot.left + 8, y - 10, "start", "evm-target-label");
}

function drawSacLine(svg: SVGSVGElement, references: CurveReferences, xScale: (week: number) => number): void {
    const sac = numberValue(references.SAC);
    if (sac === null) {
        return;
    }
    const x = xScale(sac);
    drawLine(svg, x, plot.top, x, plot.top + plot.height, "evm-sac-line-vertical");
}

function coordinatesFor(points: CurveHistoryPoint[], key: SeriesKey, xScale: (week: number) => number, yScale: (value: number) => number, yOffset: number = 0): Array<PointCoordinate | null> {
    return points.map((point) => {
        const week = numberValue(point.SemanaProyecto);
        const value = numberValue(point[key]);
        if (week === null || value === null) {
            return null;
        }
        return { x: xScale(week), y: yScale(value) + yOffset, week, value };
    });
}

function lineSegmentsFor(coordinates: Array<PointCoordinate | null>, className: string): LineSegment[] {
    const segments: LineSegment[] = [];
    let previous: PointCoordinate | null = null;
    coordinates.forEach((point) => {
        if (!point) {
            previous = null;
            return;
        }
        if (previous) {
            segments.push({ className, start: previous, end: point });
        }
        previous = point;
    });
    return segments;
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
    path.setAttribute("stroke-width", "3.2");
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
        dot.setAttribute("r", "5");
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
    dot.setAttribute("r", "5.5");
    dot.setAttribute("class", "evm-dot eac");
    svg.appendChild(dot);

    addText(svg, `EAC(c) = ${fullCurrency(eacCost)}`, Math.min(x2 - 10, plot.left + plot.width - 8), y2 - 24, "end", "evm-eac-label");
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
        drawLine(svg, x, yEnd, x + 34, yEnd, "evm-eac-cost-guide");
    }
}

function drawCurrentValueLabels(svg: SVGSVGElement, points: CurveHistoryPoint[], xScale: (week: number) => number, yScale: (value: number) => number, visualOffsets: Record<SeriesKey, number>, segments: LineSegment[]): void {
    const items = [
        { key: "AC" as SeriesKey, label: "AC", className: "ac" },
        { key: "EV" as SeriesKey, label: "EV", className: "ev" },
        { key: "PV" as SeriesKey, label: "PV", className: "pv" }
    ];
    const callouts = items
        .map((item): SeriesCallout | null => {
            const point = lastSeriesPoint(points, item.key, xScale, yScale, visualOffsets[item.key]);
            if (!point) {
                return null;
            }
            return {
                label: `${item.label} = ${fullCurrency(point.value)}`,
                className: item.className,
                point,
                labelY: point.y
            };
        })
        .filter((item): item is SeriesCallout => item !== null)
        .sort((a, b) => a.labelY - b.labelY);

    applyCoincidentPointOffsets(callouts);
    distributeCalloutLabels(callouts, segments);
    callouts.forEach((item) => drawLeaderLabel(svg, item));
}

function lastSeriesPoint(points: CurveHistoryPoint[], key: SeriesKey, xScale: (week: number) => number, yScale: (value: number) => number, yOffset: number = 0): PointCoordinate | null {
    for (let index = points.length - 1; index >= 0; index--) {
        const week = numberValue(points[index].SemanaProyecto);
        const value = numberValue(points[index][key]);
        if (week !== null && value !== null) {
            return { x: xScale(week), y: yScale(value) + yOffset, week, value };
        }
    }
    return null;
}

function seriesVisualOffsets(points: CurveHistoryPoint[], yScale: (value: number) => number): Record<SeriesKey, number> {
    const overlaps: Record<SeriesKey, boolean> = { PV: false, EV: false, AC: false };
    const pairs: Array<[SeriesKey, SeriesKey]> = [["PV", "EV"], ["PV", "AC"], ["EV", "AC"]];
    const thresholdPx = 4;
    points.forEach((point) => {
        pairs.forEach(([first, second]) => {
            const firstValue = numberValue(point[first]);
            const secondValue = numberValue(point[second]);
            if (firstValue === null || secondValue === null) {
                return;
            }
            if (Math.abs(yScale(firstValue) - yScale(secondValue)) <= thresholdPx) {
                overlaps[first] = true;
                overlaps[second] = true;
            }
        });
    });
    return {
        PV: overlaps.PV ? 4 : 0,
        EV: overlaps.EV ? 0 : 0,
        AC: overlaps.AC ? -4 : 0
    };
}

function distributeCalloutLabels(callouts: SeriesCallout[], segments: LineSegment[]): void {
    const minGap = 24;
    const topLimit = plot.top + 18;
    const bottomLimit = plot.top + plot.height - 18;
    if (!callouts.length) {
        return;
    }
    const pointYs = callouts.map((item) => item.point.y);
    const gapCandidates = gapLabelCandidates(pointYs, topLimit, bottomLimit);
    const candidates = callouts.map((item) => labelCandidates(item.point.y, gapCandidates, topLimit, bottomLimit));
    let bestScore = Number.POSITIVE_INFINITY;
    let bestYs = callouts.map((item) => item.point.y);

    const search = (index: number, selected: number[]): void => {
        if (index === callouts.length) {
            const score = scoreLabelDistribution(callouts, selected, minGap, segments);
            if (score < bestScore) {
                bestScore = score;
                bestYs = [...selected];
            }
            return;
        }
        candidates[index].forEach((candidate) => search(index + 1, [...selected, candidate]));
    };

    search(0, []);
    callouts.forEach((item, index) => {
        item.labelY = bestYs[index];
    });
}

function labelCandidates(naturalY: number, gapCandidates: number[], topLimit: number, bottomLimit: number): number[] {
    const candidates = [
        naturalY,
        naturalY - 14,
        naturalY + 14,
        naturalY - 26,
        naturalY + 26,
        naturalY - 40,
        naturalY + 40,
        naturalY - 60,
        naturalY + 60,
        naturalY - 82,
        naturalY + 82,
        ...gapCandidates
    ];
    return uniqueNumbers(candidates.map((value) => clamp(value, topLimit, bottomLimit)));
}

function gapLabelCandidates(pointYs: number[], topLimit: number, bottomLimit: number): number[] {
    const sorted = [...pointYs].sort((a, b) => a - b);
    const candidates: number[] = [];
    for (let index = 1; index < sorted.length; index++) {
        const gap = sorted[index] - sorted[index - 1];
        if (gap >= 30) {
            candidates.push((sorted[index] + sorted[index - 1]) / 2);
        }
    }
    candidates.push(sorted[0] - 26, sorted[sorted.length - 1] + 26);
    return candidates.map((value) => clamp(value, topLimit, bottomLimit));
}

function scoreLabelDistribution(callouts: SeriesCallout[], selectedYs: number[], minGap: number, segments: LineSegment[]): number {
    let score = 0;
    selectedYs.forEach((candidateY, index) => {
        const naturalY = callouts[index].point.y;
        const bounds = labelBounds(callouts[index], candidateY);
        score += Math.abs(candidateY - naturalY) * 1.25;
        callouts.forEach((other, otherIndex) => {
            const pointY = other.point.y;
            const distance = Math.abs(candidateY - pointY);
            if (otherIndex === index) {
                if (distance < 12) {
                    score += (12 - distance) * 38;
                }
                return;
            }
            if (distance < 16) {
                score += (16 - distance) * 115;
            } else if (distance < 24) {
                score += (24 - distance) * 18;
            }
        });
        if (Math.abs(candidateY - naturalY) < 6) {
            score += 90;
        }
        if (Math.abs(candidateY - naturalY) > 56) {
            score += (Math.abs(candidateY - naturalY) - 56) * 7;
        }
        segments.forEach((segment) => {
            const penalty = lineLabelOverlapPenalty(bounds, segment);
            if (!penalty) {
                return;
            }
            score += penalty * (segment.className === callouts[index].className ? 0.35 : 1);
        });
    });

    for (let i = 0; i < selectedYs.length; i++) {
        for (let j = i + 1; j < selectedYs.length; j++) {
            const labelDistance = Math.abs(selectedYs[i] - selectedYs[j]);
            if (labelDistance < minGap) {
                score += 10000 + (minGap - labelDistance) * 100;
            }
            const pointOrder = callouts[i].point.y - callouts[j].point.y;
            const labelOrder = selectedYs[i] - selectedYs[j];
            if (pointOrder * labelOrder < 0) {
                score += 180;
            }
        }
    }
    return score;
}

function labelTextX(callout: SeriesCallout): number {
    return Math.max(plot.left + 116, Math.min(callout.point.x - 82, plot.left + plot.width - 150));
}

function labelBounds(callout: SeriesCallout, labelY: number): LabelBounds {
    const textX = labelTextX(callout);
    const textWidth = Math.max(76, callout.label.length * 8.7);
    return {
        left: textX - textWidth - 8,
        right: textX + 8,
        top: labelY - 19,
        bottom: labelY + 7
    };
}

function lineLabelOverlapPenalty(bounds: LabelBounds, segment: LineSegment): number {
    const left = Math.min(segment.start.x, segment.end.x);
    const right = Math.max(segment.start.x, segment.end.x);
    if (right < bounds.left - 10 || left > bounds.right + 10) {
        return 0;
    }

    let penalty = 0;
    const samples = 10;
    for (let index = 0; index <= samples; index++) {
        const ratio = index / samples;
        const x = segment.start.x + (segment.end.x - segment.start.x) * ratio;
        const y = segment.start.y + (segment.end.y - segment.start.y) * ratio;
        if (x < bounds.left - 8 || x > bounds.right + 8) {
            continue;
        }
        if (y >= bounds.top && y <= bounds.bottom) {
            penalty += 8500;
            continue;
        }
        const distance = y < bounds.top ? bounds.top - y : y - bounds.bottom;
        if (distance < 10) {
            penalty += (10 - distance) * 360;
        } else if (distance < 18) {
            penalty += (18 - distance) * 70;
        }
    }
    return penalty;
}

function applyCoincidentPointOffsets(callouts: SeriesCallout[]): void {
    const offsets: Record<string, { x: number; y: number }> = {
        ac: { x: 4, y: -4 },
        ev: { x: 0, y: 0 },
        pv: { x: -4, y: 4 }
    };
    const closeThreshold = 4;
    callouts.forEach((item, index) => {
        const hasCoincidentPoint = callouts.some((other, otherIndex) => {
            if (index === otherIndex) {
                return false;
            }
            return Math.abs(item.point.x - other.point.x) <= closeThreshold && Math.abs(item.point.y - other.point.y) <= closeThreshold;
        });
        if (!hasCoincidentPoint) {
            return;
        }
        const offset = offsets[item.className] ?? { x: 0, y: 0 };
        item.point = {
            ...item.point,
            x: item.point.x + offset.x,
            y: item.point.y + offset.y
        };
    });
}

function drawLeaderLabel(svg: SVGSVGElement, callout: SeriesCallout): void {
    const textX = labelTextX(callout);
    const leaderEndX = callout.point.x - 10;
    const leaderMidX = Math.min(textX + 28, leaderEndX - 18);
    const path = svgElement("path");
    path.setAttribute("d", `M ${textX + 8} ${callout.labelY - 4} L ${leaderMidX} ${callout.labelY - 4} L ${leaderEndX} ${callout.point.y}`);
    path.setAttribute("class", `evm-callout-line ${callout.className}`);
    path.setAttribute("fill", "none");
    svg.appendChild(path);
    drawOverlapDot(svg, callout.point.x, callout.point.y, callout.className);
    const text = addText(svg, callout.label, textX, callout.labelY, "end", `evm-final-label ${callout.className}`);
    addTextBackground(svg, text, "evm-callout-label-bg", 6, 4);
}

function drawOverlapDot(svg: SVGSVGElement, x: number, y: number, className: string): void {
    const dot = svgElement("circle");
    dot.setAttribute("cx", String(x));
    dot.setAttribute("cy", String(y));
    dot.setAttribute("r", "5.8");
    dot.setAttribute("class", `evm-dot evm-dot-overlap ${className}`);
    svg.appendChild(dot);
}

function drawCurrentLine(svg: SVGSVGElement, references: CurveReferences, xScale: (week: number) => number): void {
    const week = numberValue(references.AT);
    if (week === null) {
        return;
    }
    const x = xScale(week);
    drawLine(svg, x, plot.top, x, plot.top + plot.height, "evm-at-line");
    addText(svg, "Fecha de Estado", x, plot.top - 16, "middle", "evm-status-label");
}

function drawVacCost(svg: SVGSVGElement, references: CurveReferences, xScale: (week: number) => number, yScale: (value: number) => number): void {
    const bac = numberValue(references.BAC);
    const eacCost = numberValue(references.EACC);
    if (bac === null || eacCost === null) {
        return;
    }
    const axisEndX = plot.left + plot.width;
    const x = axisEndX + 17;
    const labelX = axisEndX + 44;
    const y1 = yScale(bac);
    const y2 = yScale(eacCost);
    drawDoubleArrow(svg, x, y1, y2, "evm-vac-line", "evm-vac-arrowhead");
    addText(svg, "VAC(c)", labelX, Math.min(y1, y2) + 16, "start", "evm-vac-label");
    addText(svg, "Sobre Costo", labelX, Math.min(y1, y2) + 39, "start", "evm-vac-label");
    addText(svg, "Proyectado", labelX, Math.min(y1, y2) + 59, "start", "evm-vac-label");
    addText(svg, fullCurrency(references.VACC), labelX, Math.min(y1, y2) + 84, "start", "evm-vac-label");
}

function drawVacTime(svg: SVGSVGElement, references: CurveReferences, xScale: (week: number) => number): void {
    const sac = numberValue(references.SAC);
    const eacWeek = numberValue(references.EACT);
    if (sac === null || eacWeek === null) {
        return;
    }
    const y = plot.top + plot.height - 92;
    const x1 = xScale(sac);
    const x2 = xScale(eacWeek);
    drawHorizontalDoubleArrow(svg, x1, x2, y, "evm-vac-line", "evm-vac-arrowhead");
    addText(svg, "VAC(t)", (x1 + x2) / 2, y - 22, "middle", "evm-vac-label");
    addText(svg, "Retraso Proyectado", (x1 + x2) / 2, y + 28, "middle", "evm-vac-label");
    addText(svg, `${text(references.VACT)} semanas`, (x1 + x2) / 2, y + 50, "middle", "evm-vac-label");
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

function drawDoubleArrow(svg: SVGSVGElement, x: number, y1: number, y2: number, lineClassName: string, arrowClassName: string): void {
    const topY = Math.min(y1, y2);
    const bottomY = Math.max(y1, y2);
    const arrowSize = 7;
    drawLine(svg, x, topY + arrowSize, x, bottomY - arrowSize, lineClassName);
    drawTriangle(svg, x, topY, arrowSize, "up", arrowClassName);
    drawTriangle(svg, x, bottomY, arrowSize, "down", arrowClassName);
}

function drawHorizontalDoubleArrow(svg: SVGSVGElement, x1: number, x2: number, y: number, lineClassName: string, arrowClassName: string): void {
    const leftX = Math.min(x1, x2);
    const rightX = Math.max(x1, x2);
    const arrowSize = 7;
    drawLine(svg, leftX + arrowSize, y, rightX - arrowSize, y, lineClassName);
    drawTriangle(svg, leftX, y, arrowSize, "left", arrowClassName);
    drawTriangle(svg, rightX, y, arrowSize, "right", arrowClassName);
}

function drawTriangle(svg: SVGSVGElement, x: number, y: number, size: number, direction: "up" | "down" | "left" | "right", className: string): void {
    const pointsByDirection: Record<typeof direction, string> = {
        up: `${x},${y} ${x - size},${y + size} ${x + size},${y + size}`,
        down: `${x},${y} ${x - size},${y - size} ${x + size},${y - size}`,
        left: `${x},${y} ${x + size},${y - size} ${x + size},${y + size}`,
        right: `${x},${y} ${x - size},${y - size} ${x - size},${y + size}`
    };
    const triangle = svgElement("polygon");
    triangle.setAttribute("points", pointsByDirection[direction]);
    triangle.setAttribute("class", className);
    svg.appendChild(triangle);
}

function addText(svg: SVGSVGElement, label: string, x: number, y: number, anchor: "start" | "middle" | "end", className: string): SVGTextElement {
    const item = svgElement("text");
    item.setAttribute("x", String(x));
    item.setAttribute("y", String(y));
    item.setAttribute("text-anchor", anchor);
    item.setAttribute("class", className);
    if (className !== "evm-empty-svg") {
        item.style.fontSize = "16px";
    }
    item.textContent = label;
    svg.appendChild(item);
    return item;
}

function addTextBackground(svg: SVGSVGElement, textElement: SVGTextElement, className: string, paddingX: number, paddingY: number): void {
    const fallbackWidth = Math.max(64, textElement.textContent ? textElement.textContent.length * 9 : 64);
    const fallbackHeight = 19;
    let x = Number(textElement.getAttribute("x")) - fallbackWidth;
    let y = Number(textElement.getAttribute("y")) - fallbackHeight + 4;
    let width = fallbackWidth;
    let height = fallbackHeight;
    try {
        const box = textElement.getBBox();
        x = box.x;
        y = box.y;
        width = box.width;
        height = box.height;
    } catch {
        // Power BI can render before the SVG text box is measurable; fallback keeps labels legible.
    }

    const background = svgElement("rect");
    background.setAttribute("x", String(x - paddingX));
    background.setAttribute("y", String(y - paddingY));
    background.setAttribute("width", String(width + paddingX * 2));
    background.setAttribute("height", String(height + paddingY * 2));
    background.setAttribute("rx", "4");
    background.setAttribute("class", className);
    svg.insertBefore(background, textElement);
}

function renderCurveSummary(curve: RenderCurveData): HTMLElement {
    const row = createElement("div", "evm-summary-grid");
    const currentPoint = curve.current;
    const references = curve.references;
    [
        ["BAC", fullCurrency(references.BAC), "blue"],
        ["PV", fullCurrency(currentPoint.PV), "blue"],
        ["EV", fullCurrency(currentPoint.EV), "green"],
        ["AC", fullCurrency(currentPoint.AC), "red"],
        ["TSPI(t)", decimal(references.TSPIT), "blue"],
        ["SPI(t)", decimal(references.SPIT), "blue"],
        ["EAC(c)", fullCurrency(references.EACC), "blue"],
        ["EAC(t)", text(references.EACT), "blue"],
        ["VAC(c)", fullCurrency(references.VACC), "red"],
        ["VAC(t)", `${text(references.VACT)} sem.`, "red"]
    ].forEach(([label, value, tone]) => {
        const cell = createElement("div", `evm-key-cell evm-key-cell-${tone}`);
        cell.appendChild(createElement("span", undefined, label));
        cell.appendChild(createElement("strong", undefined, value));
        row.appendChild(cell);
    });
    return row;
}

function chartDomain(points: CurveHistoryPoint[], currentPoint: CurveHistoryPoint, references: CurveReferences): AxisDomain {
    const values = points
        .flatMap((point) => [point.PV, point.EV, point.AC])
        .concat([references.BAC, currentPoint.PV, currentPoint.EV, currentPoint.AC, references.EACC])
        .map((value) => numberValue(value))
        .filter((value): value is number => value !== null);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    return niceAxisDomain(min, max);
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
    return `S/ ${Math.round(parsed).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function wholeNumber(value: number): string {
    return Math.round(value).toLocaleString("en-US", { maximumFractionDigits: 0, useGrouping: true });
}

function niceAxisDomain(min: number, max: number): AxisDomain {
    const range = Math.max(max - min, 1);
    const roughStep = range / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const normalized = roughStep / magnitude;
    const stepMultiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
    const step = stepMultiplier * magnitude;
    const domainMin = min <= step ? 0 : Math.floor(min / step) * step;
    const domainMax = Math.ceil(max / step) * step;
    return {
        min: Math.min(domainMin, domainMax - step),
        max: domainMax
    };
}

function formatWeek(value: number): string {
    return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
}

function uniqueNumbers(values: number[]): number[] {
    return [...new Set(values.map((value) => Math.round(value)))];
}
