"use strict";

import { CurveHistoryPoint, CurveReferences, DataValue, RenderCurveData, VisualPalette } from "../types";
import { createElement, decimal, decimalUpTo, numberValue, svgElement, text } from "../utils/format";

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
    side?: "left" | "right";
    placement?: "above" | "below";
}

interface CurveRenderOptions {
    portfolio?: boolean;
    showYearBracket?: boolean;
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

export function renderCurve(curve: RenderCurveData, palette: VisualPalette, options: CurveRenderOptions = {}): HTMLElement {
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
            drawCurve(svg, curve, palette, options);
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
    const bottom = 130;
    return {
        width,
        height,
        plot: {
            left,
            top,
            width: Math.max(690, width - left - right),
            height: Math.max(360, height - top - bottom)
        }
    };
}

function drawCurve(svg: SVGSVGElement, curve: RenderCurveData, palette: VisualPalette, options: CurveRenderOptions): void {
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
    const referenceXScale = spacedReferenceXScale(xScale, sacWeek, eacWeek);
    const yScale = (value: number): number => plot.top + plot.height - ((value - yDomain.min) / (yDomain.max - yDomain.min)) * plot.height;
    const referenceYScale = options.portfolio ? spacedEacCostYScale(yScale, references) : yScale;

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
    drawAxes(svg, axisMinWeek, axisMaxWeek, yDomain, xScale, referenceXScale, yScale, eacWeek, references, Boolean(options.showYearBracket));
    drawCurrentLine(svg, references, xScale);
    drawBacLine(svg, references, yScale);
    drawAcProjection(svg, currentPoint, references, referenceXScale, yScale, referenceYScale);
    drawEacCostLine(svg, references, referenceXScale, referenceYScale);
    drawSacLine(svg, references, referenceXScale);

    const seriesLayer = svgElement("g");
    seriesLayer.setAttribute("class", "evm-series-layer");
    seriesLayer.replaceChildren();
    const visualOffsets = seriesVisualOffsets(pointsToDraw, yScale);
    const segments: LineSegment[] = [];
    series.forEach((item) => {
        const rawCoordinates = coordinatesFor(pointsToDraw, item.key, xScale, yScale, visualOffsets[item.key]);
        const coordinates = options.portfolio && item.key === "PV"
            ? emphasizeSubtlePortfolioPvTrend(rawCoordinates)
            : rawCoordinates;
        const dotCoordinates = options.portfolio && item.key === "PV"
            ? coordinates.map((point) => point && Math.abs(point.week - 52) < 0.000001 ? null : point)
            : coordinates;
        segments.push(...lineSegmentsFor(coordinates, item.className));
        drawSegmentedLine(seriesLayer, coordinates, `evm-line ${item.className}`);
        drawDots(seriesLayer, dotCoordinates, `evm-dot ${item.className}`);
    });
    svg.appendChild(seriesLayer);

    drawEacTimeLine(svg, references, referenceXScale, referenceYScale);
    drawCurrentValueLabels(svg, pointsToDraw, references, xScale, referenceXScale, yScale, referenceYScale, visualOffsets, segments, atWeek, options);
    drawTimelineMarkerLabels(svg, references, referenceXScale, true);
    drawVacCost(svg, references, xScale, yScale, referenceYScale);
    drawVacTime(svg, references, referenceXScale);
}

function spacedReferenceXScale(xScale: (week: number) => number, sacWeek: number | null, eacWeek: number | null): (week: number) => number {
    if (sacWeek === null || eacWeek === null || Math.abs(sacWeek - eacWeek) < 0.000001) {
        return xScale;
    }
    const sacX = xScale(sacWeek);
    const eacX = xScale(eacWeek);
    const minimumGap = 68;
    if (Math.abs(sacX - eacX) >= minimumGap) {
        return xScale;
    }
    const spacedEacX = sacX + (eacWeek < sacWeek ? -minimumGap : minimumGap);
    return (week: number): number => Math.abs(week - eacWeek) < 0.000001 ? spacedEacX : xScale(week);
}

function spacedEacCostYScale(yScale: (value: number) => number, references: CurveReferences): (value: number) => number {
    const bac = numberValue(references.BAC);
    const eacCost = numberValue(references.EACC);
    if (bac === null || eacCost === null || Math.abs(bac - eacCost) < 0.000001) {
        return yScale;
    }
    const bacY = yScale(bac);
    const eacY = yScale(eacCost);
    const minimumGap = 40;
    if (Math.abs(eacY - bacY) >= minimumGap) {
        return yScale;
    }
    const spacedEacY = bacY + (eacCost < bac ? minimumGap : -minimumGap);
    return (value: number): number => Math.abs(value - eacCost) < 0.000001 ? spacedEacY : yScale(value);
}

function drawAxes(svg: SVGSVGElement, minWeek: number, maxWeek: number, yDomain: AxisDomain, xScale: (week: number) => number, referenceXScale: (week: number) => number, yScale: (value: number) => number, eacWeek: number | null, references: CurveReferences, showYearBracket: boolean): void {
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
        const isReferenceWeek = timelineMarkers(references, xScale)
            .some((marker) => Math.abs(marker.week - week) < 0.000001);
        if (shouldHideTickBeforeFractionalProjection(week, eacWeek) && !isReferenceWeek) {
            return;
        }
        const key = formatWeek(week);
        if (drawnTicks.has(key)) {
            return;
        }
        drawnTicks.add(key);
        const x = xScale(week);
        drawLine(svg, x, plot.top + plot.height, x, plot.top + plot.height + 8, "evm-axis-tick");
        const referenceMarker = timelineMarkers(references, xScale)
            .find((marker) => Math.abs(marker.week - week) < 0.000001);
        const tickClass = referenceMarker?.className ?? "evm-axis-label";
        addText(svg, formatWeek(week), x, plot.top + plot.height + 32, "middle", tickClass);
    };

    addXTick(minWeek);
    const firstTick = Math.ceil(minWeek / interval) * interval;
    for (let week = firstTick; week <= maxWeek; week += interval) {
        addXTick(week);
    }
    addXTick(maxWeek);
    if (eacWeek !== null && !drawnTicks.has(formatWeek(eacWeek))) {
        const x = referenceXScale(eacWeek);
        drawLine(svg, x, plot.top + plot.height, x, plot.top + plot.height + 8, "evm-axis-tick");
        addText(svg, formatWeek(eacWeek), x, plot.top + plot.height + 32, "middle", "evm-eac-label");
    }
    if (showYearBracket) {
        const yearCenter = plot.left + (plot.width / 2);
        const yearLineY = plot.top + plot.height + 68;
        const yearLineStart = plot.left + 8;
        const yearLineEnd = plot.left + plot.width - 8;
        drawLine(svg, yearLineStart, yearLineY, yearLineEnd, yearLineY, "evm-axis-year-line");
        drawLine(svg, yearLineStart, yearLineY, yearLineStart, yearLineY + 18, "evm-axis-year-boundary");
        drawLine(svg, yearLineEnd, yearLineY, yearLineEnd, yearLineY + 18, "evm-axis-year-boundary");
        addText(svg, "Tiempo (Sem.)", yearLineStart, yearLineY + 39, "start", "evm-axis-time-caption");
        addText(svg, "2026", yearCenter, yearLineY + 39, "middle", "evm-axis-year");
    } else {
        addText(svg, "Tiempo (Sem.)", xScale(minWeek), plot.top + plot.height + 68, "middle", "evm-axis-title");
    }
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

function drawTimelineMarkerLabels(svg: SVGSVGElement, references: CurveReferences, xScale: (week: number) => number, alignWithReferenceLines: boolean = false): void {
    const markers = timelineMarkers(references, xScale);
    const groups = new Map<string, TimelineMarker[]>();
    markers.forEach((marker) => {
        const key = formatWeek(marker.week);
        groups.set(key, [...(groups.get(key) ?? []), marker]);
    });

    const orderedGroups = [...groups.values()]
        .map((group) => [...group].sort((a, b) => a.priority - b.priority))
        .sort((a, b) => a[0].x - b[0].x);
    const labelPositions = alignWithReferenceLines
        ? new Map(orderedGroups.map((group) => [group, group[0].x]))
        : timelineLabelPositions(orderedGroups);
    orderedGroups
        .forEach((group) => {
            const x = labelPositions.get(group) ?? group[0].x;
            const labelY = plot.top + plot.height + 50;
            drawGroupedMarkerLabel(svg, group, x, labelY);
        });
}

function timelineLabelPositions(groups: TimelineMarker[][]): Map<TimelineMarker[], number> {
    const positions = new Map<TimelineMarker[], number>();
    groups.forEach((group) => positions.set(group, group[0].x));
    const sacGroup = groups.find((group) => group.some((marker) => marker.key === "sac"));
    const eacGroup = groups.find((group) => group.some((marker) => marker.key === "eac"));
    if (!sacGroup || !eacGroup || sacGroup === eacGroup || Math.abs(sacGroup[0].x - eacGroup[0].x) >= 80) {
        return positions;
    }

    const sacWeek = sacGroup.find((marker) => marker.key === "sac")?.week ?? sacGroup[0].week;
    const eacWeek = eacGroup.find((marker) => marker.key === "eac")?.week ?? eacGroup[0].week;
    const midpoint = (sacGroup[0].x + eacGroup[0].x) / 2;
    const lowerGroup = eacWeek < sacWeek ? eacGroup : sacGroup;
    const higherGroup = eacWeek < sacWeek ? sacGroup : eacGroup;
    positions.set(lowerGroup, Math.max(plot.left + 34, midpoint - 48));
    positions.set(higherGroup, Math.min(plot.left + plot.width + 78, midpoint + 48));
    return positions;
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

function emphasizeSubtlePortfolioPvTrend(coordinates: Array<PointCoordinate | null>): Array<PointCoordinate | null> {
    const adjusted = coordinates.map((point) => point ? { ...point } : null);
    const validIndexes = adjusted
        .map((point, index) => point ? index : -1)
        .filter((index) => index >= 0);
    if (validIndexes.length < 3) {
        return adjusted;
    }

    let startPosition = validIndexes.length - 1;
    while (startPosition > 0) {
        const current = adjusted[validIndexes[startPosition]];
        const previous = adjusted[validIndexes[startPosition - 1]];
        if (!current || !previous || current.value < previous.value || Math.abs(current.y - previous.y) > 2) {
            break;
        }
        startPosition -= 1;
    }

    const tailIndexes = validIndexes.slice(startPosition);
    if (tailIndexes.length < 3) {
        return adjusted;
    }
    const first = adjusted[tailIndexes[0]];
    const last = adjusted[tailIndexes[tailIndexes.length - 1]];
    if (!first || !last) {
        return adjusted;
    }

    const valueSpan = last.value - first.value;
    if (valueSpan <= 0.000001) {
        return adjusted;
    }
    const actualSpan = Math.max(0, first.y - last.y);
    const visibleSpan = Math.min(24, Math.max(actualSpan, (tailIndexes.length - 1) * 3));
    tailIndexes.forEach((index) => {
        const point = adjusted[index];
        if (!point) {
            return;
        }
        const progress = clamp((point.value - first.value) / valueSpan, 0, 1);
        point.y = last.y + visibleSpan * (1 - progress);
    });
    return adjusted;
}

function drawAcProjection(svg: SVGSVGElement, currentPoint: CurveHistoryPoint, references: CurveReferences, xScale: (week: number) => number, yScale: (value: number) => number, referenceYScale: (value: number) => number): void {
    const atWeek = numberValue(references.AT);
    const currentAc = numberValue(currentPoint.AC);
    const eacWeek = numberValue(references.EACT);
    const eacCost = numberValue(references.EACC);
    if (atWeek === null || currentAc === null || eacWeek === null || eacCost === null || eacWeek <= atWeek) {
        return;
    }

    const remainingTime = eacWeek - atWeek;
    const remainingCost = eacCost - currentAc;
    const weeklyIncrement = remainingCost / remainingTime;
    const projection: PointCoordinate[] = [{ x: xScale(atWeek), y: yScale(currentAc), week: atWeek, value: currentAc }];

    for (let elapsed = 1; elapsed < remainingTime; elapsed += 1) {
        const week = atWeek + elapsed;
        if (Math.abs(eacWeek - Math.round(eacWeek)) >= 0.000001 && Math.abs(week - Math.floor(eacWeek)) < 0.000001) {
            continue;
        }
        const value = currentAc + weeklyIncrement * elapsed;
        projection.push({ x: xScale(week), y: yScale(value), week, value });
    }
    projection.push({ x: xScale(eacWeek), y: referenceYScale(eacCost), week: eacWeek, value: eacCost });

    const layer = svgElement("g");
    layer.setAttribute("class", "evm-ac-projection-layer");
    drawSegmentedLine(layer, projection, "evm-line ac evm-ac-projection");
    projection.slice(1, -1).forEach((point) => {
        const dot = svgElement("circle");
        dot.setAttribute("cx", String(point.x));
        dot.setAttribute("cy", String(point.y));
        dot.setAttribute("r", "4.5");
        dot.setAttribute("class", "evm-dot ac evm-ac-projection-dot");
        layer.appendChild(dot);
    });
    svg.appendChild(layer);
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
    dot.setAttribute("class", "evm-dot ac");
    svg.appendChild(dot);

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

function drawCurrentValueLabels(svg: SVGSVGElement, points: CurveHistoryPoint[], references: CurveReferences, xScale: (week: number) => number, referenceXScale: (week: number) => number, yScale: (value: number) => number, referenceYScale: (value: number) => number, visualOffsets: Record<SeriesKey, number>, segments: LineSegment[], cutoffWeek: number | null, options: CurveRenderOptions): void {
    const items = [
        { key: "AC" as SeriesKey, label: "AC", className: "ac" },
        { key: "EV" as SeriesKey, label: "EV", className: "ev" },
        { key: "PV" as SeriesKey, label: "PV", className: "pv" }
    ];
    const callouts: SeriesCallout[] = items
        .map((item): SeriesCallout | null => {
            const point = lastSeriesPoint(
                points,
                item.key,
                xScale,
                yScale,
                visualOffsets[item.key],
                item.key === "PV" ? cutoffWeek : null
            );
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
        .filter((item): item is SeriesCallout => item !== null);

    const bac = numberValue(references.BAC);
    const bacPoint = lastSeriesPoint(points, "PV", xScale, yScale, visualOffsets.PV);
    if (bac !== null && bacPoint) {
        callouts.push({
            label: options.portfolio ? `BAC =\n${fullCurrency(bac)}` : `BAC = ${fullCurrency(bac)}`,
            className: "pv",
            point: bacPoint,
            labelY: bacPoint.y - (options.portfolio ? 34 : 28),
            side: options.portfolio ? "right" : "left",
            placement: options.portfolio ? "above" : undefined
        });
    }

    const eacWeek = numberValue(references.EACT);
    const eacCost = numberValue(references.EACC);
    if (eacWeek !== null && eacCost !== null) {
        const eacPoint = { x: referenceXScale(eacWeek), y: referenceYScale(eacCost), week: eacWeek, value: eacCost };
        callouts.push({
            label: `EAC(c) = ${fullCurrency(eacCost)}`,
            className: "ac",
            point: eacPoint,
            labelY: eacPoint.y - (options.portfolio ? 58 : 28),
            placement: options.portfolio ? "above" : undefined
        });
    }

    applyCoincidentPointOffsets(callouts);
    callouts.sort((a, b) => a.labelY - b.labelY);
    distributeCalloutLabels(callouts, segments);
    callouts.forEach((item) => drawLeaderLabel(svg, item));
}

function lastSeriesPoint(points: CurveHistoryPoint[], key: SeriesKey, xScale: (week: number) => number, yScale: (value: number) => number, yOffset: number = 0, maxWeek: number | null = null): PointCoordinate | null {
    for (let index = points.length - 1; index >= 0; index--) {
        const week = numberValue(points[index].SemanaProyecto);
        const value = numberValue(points[index][key]);
        if (week !== null && value !== null && (maxWeek === null || week <= maxWeek)) {
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
    const pointYs = callouts.map((item) => item.labelY);
    const gapCandidates = gapLabelCandidates(pointYs, topLimit, bottomLimit);
    const candidates = callouts.map((item) => {
        const available = labelCandidates(item.labelY, gapCandidates, topLimit, bottomLimit);
        if (item.placement === "below") {
            const below = available.filter((value) => value >= item.point.y + 24);
            return below.length ? below : [clamp(item.point.y + 24, topLimit, bottomLimit)];
        }
        if (item.placement === "above") {
            const above = available.filter((value) => value <= item.point.y - 24);
            return above.length ? above : [clamp(item.point.y - 24, topLimit, bottomLimit)];
        }
        return available;
    });
    let states: Array<{ values: number[]; score: number }> = [{ values: [], score: 0 }];
    const beamWidth = 48;
    candidates.forEach((options, index) => {
        const partialCallouts = callouts.slice(0, index + 1);
        const expanded: Array<{ values: number[]; score: number }> = [];
        states.forEach((state) => {
            options.forEach((candidate) => {
                const values = [...state.values, candidate];
                expanded.push({
                    values,
                    score: scoreLabelDistribution(partialCallouts, values, minGap, segments)
                });
            });
        });
        expanded.sort((a, b) => a.score - b.score);
        states = expanded.slice(0, beamWidth);
    });
    const bestYs = states[0]?.values ?? callouts.map((item) => item.point.y);
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
        const naturalY = callouts[index].labelY;
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
    if (callout.side === "right") {
        return Math.min(callout.point.x + 82, plot.left + plot.width + 54);
    }
    return Math.max(plot.left + 116, Math.min(callout.point.x - 82, plot.left + plot.width - 150));
}

function labelBounds(callout: SeriesCallout, labelY: number): LabelBounds {
    const textX = labelTextX(callout);
    const lines = callout.label.split("\n");
    const textWidth = Math.max(76, ...lines.map((line) => line.length * 8.7));
    return {
        left: callout.side === "right" ? textX - 8 : textX - textWidth - 8,
        right: callout.side === "right" ? textX + textWidth + 8 : textX + 8,
        top: labelY - 19,
        bottom: labelY + 7 + (lines.length - 1) * 19
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
        ac: { x: 0, y: -4 },
        ev: { x: 0, y: 0 },
        pv: { x: 0, y: 4 }
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
    const isRight = callout.side === "right";
    const leaderEndX = callout.point.x + (isRight ? 10 : -10);
    const leaderMidX = isRight
        ? Math.max(textX - 28, leaderEndX + 18)
        : Math.min(textX + 28, leaderEndX - 18);
    const leaderStartX = textX + (isRight ? -8 : 8);
    const path = svgElement("path");
    path.setAttribute("d", `M ${leaderStartX} ${callout.labelY - 4} L ${leaderMidX} ${callout.labelY - 4} L ${leaderEndX} ${callout.point.y}`);
    path.setAttribute("class", `evm-callout-line ${callout.className}`);
    path.setAttribute("fill", "none");
    svg.appendChild(path);
    drawOverlapDot(svg, callout.point.x, callout.point.y, callout.className);
    const text = addMultilineText(svg, callout.label, textX, callout.labelY, isRight ? "start" : "end", `evm-final-label ${callout.className}`);
    addTextBackground(svg, text, "evm-callout-label-bg", 6, 4);
}

function addMultilineText(svg: SVGSVGElement, label: string, x: number, y: number, anchor: "start" | "middle" | "end", className: string): SVGTextElement {
    const item = svgElement("text");
    item.setAttribute("x", String(x));
    item.setAttribute("y", String(y));
    item.setAttribute("text-anchor", anchor);
    item.setAttribute("class", className);
    item.style.fontSize = "16px";
    label.split("\n").forEach((line, index) => {
        const span = svgElement("tspan");
        span.setAttribute("x", String(x));
        span.setAttribute("dy", index === 0 ? "0" : "19");
        span.textContent = line;
        item.appendChild(span);
    });
    svg.appendChild(item);
    return item;
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

function drawVacCost(svg: SVGSVGElement, references: CurveReferences, xScale: (week: number) => number, yScale: (value: number) => number, referenceYScale: (value: number) => number): void {
    const bac = numberValue(references.BAC);
    const eacCost = numberValue(references.EACC);
    const vacCost = numberValue(references.VACC);
    if (bac === null || eacCost === null) {
        return;
    }
    const axisEndX = plot.left + plot.width;
    const x = axisEndX + 17;
    const labelX = axisEndX + 44;
    const y1 = yScale(bac);
    const y2 = referenceYScale(eacCost);
    const isBreakEven = vacCost !== null && Math.abs(vacCost) < 0.000001;
    const isSavings = vacCost !== null && vacCost < 0;
    const projectionLabel = isBreakEven ? "Punto de" : (isSavings ? "Ahorro" : "Sobre Costo");
    const statusClass = isBreakEven ? " neutral" : (isSavings ? " favorable" : "");
    const labelClass = `evm-vac-label${statusClass}`;
    drawDoubleArrow(svg, x, y1, y2, `evm-vac-line${statusClass}`, `evm-vac-arrowhead${statusClass}`);
    addText(svg, "VAC(c)", labelX, Math.min(y1, y2) + 16, "start", labelClass);
    addText(svg, projectionLabel, labelX, Math.min(y1, y2) + 39, "start", labelClass);
    addText(svg, isBreakEven ? "Equilibrio" : "Proyectado", labelX, Math.min(y1, y2) + 59, "start", labelClass);
    addText(svg, fullCurrency(vacCost !== null && vacCost < 0 ? Math.abs(vacCost) : references.VACC), labelX, Math.min(y1, y2) + 84, "start", labelClass);
}

function drawVacTime(svg: SVGSVGElement, references: CurveReferences, xScale: (week: number) => number): void {
    const sac = numberValue(references.SAC);
    const eacWeek = numberValue(references.EACT);
    const vacTime = numberValue(references.VACT);
    if (sac === null || eacWeek === null) {
        return;
    }
    const y = plot.top + plot.height - 92;
    const x1 = xScale(sac);
    const x2 = xScale(eacWeek);
    const isBreakEven = vacTime !== null && Math.abs(vacTime) < 0.000001;
    const isAhead = vacTime !== null && vacTime < 0;
    const statusClass = isBreakEven ? " neutral" : (isAhead ? " favorable" : "");
    const lineClass = `evm-vac-line${statusClass}`;
    const arrowClass = `evm-vac-arrowhead${statusClass}`;
    const labelClass = `evm-vac-label${statusClass}`;
    const timeLabel = vacTime === null ? text(null) : Math.abs(vacTime).toLocaleString("en-US", { maximumFractionDigits: 2 });
    drawHorizontalDoubleArrow(svg, x1, x2, y, lineClass, arrowClass);
    addText(svg, "VAC(t)", (x1 + x2) / 2, y - 22, "middle", labelClass);
    addText(svg, isBreakEven ? "Punto de Equilibrio" : (isAhead ? "Adelanto Proyectado" : "Retraso Proyectado"), (x1 + x2) / 2, y + 28, "middle", labelClass);
    addText(svg, `${timeLabel} semanas`, (x1 + x2) / 2, y + 50, "middle", labelClass);
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
    const textLines = Array.from(textElement.querySelectorAll("tspan")).map((span) => span.textContent ?? "");
    const fallbackLines = textLines.length ? textLines : [textElement.textContent ?? ""];
    const fallbackWidth = Math.max(64, ...fallbackLines.map((line) => line.length * 9));
    const fallbackHeight = 19 * fallbackLines.length;
    const textAnchor = textElement.getAttribute("text-anchor");
    let x = Number(textElement.getAttribute("x")) - (textAnchor === "start" ? 0 : fallbackWidth);
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
        ["EAC(t)", decimalUpTo(references.EACT), "blue"],
        ["VAC(c)", fullCurrency(references.VACC), "red"],
        ["VAC(t)", `${decimalUpTo(references.VACT)} sem.`, "red"]
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
    const isInteger = Math.abs(value - Math.round(value)) < 0.000001;
    return value.toLocaleString("en-US", {
        minimumFractionDigits: isInteger ? 0 : 2,
        maximumFractionDigits: isInteger ? 0 : 2
    });
}

function shouldHideTickBeforeFractionalProjection(week: number, eacWeek: number | null): boolean {
    if (eacWeek === null || Math.abs(eacWeek - Math.round(eacWeek)) < 0.000001) {
        return false;
    }
    return Math.abs(week - Math.floor(eacWeek)) < 0.000001;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
}

function uniqueNumbers(values: number[]): number[] {
    return [...new Set(values.map((value) => Math.round(value)))];
}
