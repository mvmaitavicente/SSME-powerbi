"use strict";

import { MilestoneItem } from "../types";
import { createElement, date, numberValue, svgElement, text } from "../utils/format";

interface TimelinePosition {
    x: number;
    y: number;
    row: number;
}

const timeline = {
    width: 960,
    startX: 96,
    endX: 864,
    firstRowY: 62,
    rowGap: 222,
    rowContainerX: 16,
    rowContainerTopOffset: 58,
    rowContainerWidth: 928,
    rowContainerHeight: 210,
    orderOffset: 28,
    connectorEndOffset: 48,
    nameOffset: 68,
    nameLineGap: 30,
    dateOffset: 118,
    bottomPadding: 18
};

export function renderMilestones(milestones: MilestoneItem[]): HTMLElement {
    const card = createElement("section", "evm-card evm-milestone-card milestone-card");
    card.appendChild(createElement("div", "evm-section-title evm-milestone-title", "Hitos Principales del Proyecto"));

    const ordered = [...milestones].sort((a, b) => (numberValue(a.OrdenHito) ?? 0) - (numberValue(b.OrdenHito) ?? 0));
    const wrap = createElement("div", "milestone-svg-wrap");
    const svg = svgElement("svg");
    svg.classList.add("evm-timeline-svg");

    if (!ordered.length) {
        svg.setAttribute("viewBox", `0 0 ${timeline.width} 220`);
        addText(svg, "Sin hitos", timeline.width / 2, 110, "middle", "evm-empty-svg");
    } else {
        svg.setAttribute("viewBox", `0 0 ${timeline.width} ${timelineHeight(ordered.length)}`);
        drawTimeline(svg, ordered);
    }

    wrap.appendChild(svg);
    card.appendChild(wrap);
    card.appendChild(renderMilestoneLegend());
    return card;
}

function renderMilestoneLegend(): HTMLElement {
    const legend = createElement("div", "evm-milestone-legend");
    legend.appendChild(createElement("div", "evm-milestone-legend-title", "Leyenda de estados"));

    const items = [
        { className: "done", title: "Completado" },
        { className: "active", title: "En ejecucion" },
        { className: "late", title: "Retrasado" },
        { className: "pending", title: "Pendiente" }
    ];

    const grid = createElement("div", "evm-milestone-legend-grid");
    items.forEach((item) => {
        const node = createElement("div", "evm-milestone-legend-item");
        const copy = createElement("div", "evm-milestone-legend-copy");
        const title = createElement("strong", item.className);
        title.appendChild(createElement("span", `evm-milestone-legend-icon ${item.className}`));
        title.appendChild(document.createTextNode(item.title));
        copy.appendChild(title);
        node.appendChild(copy);
        grid.appendChild(node);
    });

    legend.appendChild(grid);
    return legend;
}

function drawTimeline(svg: SVGSVGElement, milestones: MilestoneItem[]): void {
    const positions = milestones.map((_, index) => milestonePosition(index, milestones.length));
    drawRowContainers(svg, milestones, positions);
    drawRowLines(svg, milestones, positions);

    milestones.forEach((milestone, index) => {
        const position = positions[index];
        const stateClass = milestoneClass(milestone.EstadoHito);
        drawOrderBadge(svg, milestone, index, position, stateClass);
        drawMilestoneConnector(svg, position, stateClass);
        drawMarker(svg, position.x, position.y, stateClass);
        drawMilestoneLabel(svg, milestone, position, stateClass);
    });
}

function milestonePosition(index: number, count: number): TimelinePosition {
    const firstRowCount = Math.ceil(count / 2);
    const row = index < firstRowCount ? 0 : 1;
    const positionInRow = row === 0 ? index : index - firstRowCount;
    const columnsInRow = row === 0 ? firstRowCount : count - firstRowCount;
    const step = columnsInRow > 1 ? (timeline.endX - timeline.startX) / (columnsInRow - 1) : 0;
    const x = columnsInRow > 1 ? timeline.startX + step * positionInRow : timeline.width / 2;
    const y = timeline.firstRowY + row * timeline.rowGap;
    return {
        x,
        y,
        row
    };
}

function timelineHeight(count: number): number {
    const rows = count > 1 ? 2 : 1;
    return timeline.firstRowY + (rows - 1) * timeline.rowGap + timeline.dateOffset + timeline.bottomPadding;
}

function drawRowContainers(svg: SVGSVGElement, milestones: MilestoneItem[], positions: TimelinePosition[]): void {
    const rows = new Set(positions.map((position) => position.row));
    rows.forEach((row) => {
        const y = timeline.firstRowY + row * timeline.rowGap - timeline.rowContainerTopOffset;
        const container = svgElement("rect");
        container.setAttribute("x", String(timeline.rowContainerX));
        container.setAttribute("y", String(y));
        container.setAttribute("width", String(timeline.rowContainerWidth));
        container.setAttribute("height", String(timeline.rowContainerHeight));
        container.setAttribute("rx", "10");
        container.setAttribute("class", `evm-milestone-row-container ${rowStateClass(row, milestones, positions)}`);
        svg.appendChild(container);
    });
}

function rowStateClass(row: number, milestones: MilestoneItem[], positions: TimelinePosition[]): string {
    const counts = new Map<string, number>();
    positions.forEach((position, index) => {
        if (position.row !== row) {
            return;
        }

        const stateClass = milestoneClass(milestones[index].EstadoHito);
        counts.set(stateClass, (counts.get(stateClass) ?? 0) + 1);
    });

    return ["done", "pending", "active", "late"].reduce((selected, stateClass) => {
        const selectedCount = counts.get(selected) ?? 0;
        const candidateCount = counts.get(stateClass) ?? 0;
        return candidateCount > selectedCount ? stateClass : selected;
    }, "done");
}

function drawRowLines(svg: SVGSVGElement, milestones: MilestoneItem[], positions: TimelinePosition[]): void {
    for (let index = 0; index < positions.length - 1; index++) {
        const current = positions[index];
        const next = positions[index + 1];
        if (current.row !== next.row) {
            continue;
        }

        const midpoint = (current.x + next.x) / 2;
        drawTimelineSegment(svg, current.x, midpoint, current.y, milestoneClass(milestones[index].EstadoHito));
        drawTimelineSegment(svg, midpoint, next.x, current.y, milestoneClass(milestones[index + 1].EstadoHito));
    }
}

function drawOrderBadge(svg: SVGSVGElement, milestone: MilestoneItem, index: number, position: TimelinePosition, stateClass: string): void {
    const order = text(milestone.OrdenHito, String(index + 1));
    const x = position.x - 36;
    const y = position.y - timeline.orderOffset;
    const badge = svgElement("rect");
    badge.setAttribute("x", String(x - 13));
    badge.setAttribute("y", String(y - 13));
    badge.setAttribute("width", "26");
    badge.setAttribute("height", "26");
    badge.setAttribute("rx", "6");
    badge.setAttribute("class", `evm-milestone-order-bg ${stateClass}`);
    svg.appendChild(badge);
    addText(svg, order, x, y + 5, "middle", `evm-milestone-order-text ${stateClass}`);
}

function drawTimelineSegment(svg: SVGSVGElement, x1: number, x2: number, y: number, stateClass: string): void {
    const segment = svgElement("line");
    segment.setAttribute("x1", String(x1));
    segment.setAttribute("y1", String(y));
    segment.setAttribute("x2", String(x2));
    segment.setAttribute("y2", String(y));
    segment.setAttribute("class", `evm-timeline-segment ${stateClass}`);
    svg.appendChild(segment);
}

function drawMilestoneConnector(svg: SVGSVGElement, position: TimelinePosition, stateClass: string): void {
    const line = svgElement("line");
    line.setAttribute("x1", String(position.x));
    line.setAttribute("y1", String(position.y + 17));
    line.setAttribute("x2", String(position.x));
    line.setAttribute("y2", String(position.y + timeline.connectorEndOffset - 8));
    line.setAttribute("class", `evm-milestone-connector ${stateClass}`);
    svg.appendChild(line);

    const dot = svgElement("circle");
    dot.setAttribute("cx", String(position.x));
    dot.setAttribute("cy", String(position.y + timeline.connectorEndOffset));
    dot.setAttribute("r", "7");
    dot.setAttribute("class", `evm-milestone-small-dot ${stateClass}`);
    svg.appendChild(dot);
}

function drawMarker(svg: SVGSVGElement, x: number, y: number, stateClass: string): void {
    if (stateClass === "done") {
        drawCircleMarker(svg, x, y, stateClass, true);
        const check = svgElement("path");
        check.setAttribute("d", `M ${x - 7} ${y} L ${x - 3} ${y + 4} L ${x + 9} ${y - 7}`);
        check.setAttribute("class", "evm-milestone-icon light");
        svg.appendChild(check);
        return;
    }

    if (stateClass === "late") {
        const triangle = svgElement("polygon");
        triangle.setAttribute("points", `${x},${y - 18} ${x + 19},${y + 16} ${x - 19},${y + 16}`);
        triangle.setAttribute("class", "evm-milestone-triangle late");
        svg.appendChild(triangle);
        addText(svg, "!", x, y + 9, "middle", "evm-milestone-alert");
        return;
    }

    drawCircleMarker(svg, x, y, stateClass, false);
}

function drawCircleMarker(svg: SVGSVGElement, x: number, y: number, stateClass: string, filled: boolean): void {
    const halo = svgElement("circle");
    halo.setAttribute("cx", String(x));
    halo.setAttribute("cy", String(y));
    halo.setAttribute("r", "20");
    halo.setAttribute("class", `evm-milestone-halo ${stateClass}`);
    svg.appendChild(halo);

    const marker = svgElement("circle");
    marker.setAttribute("cx", String(x));
    marker.setAttribute("cy", String(y));
    marker.setAttribute("r", filled ? "14.5" : "12.5");
    marker.setAttribute("class", `evm-milestone-dot ${stateClass}`);
    svg.appendChild(marker);
}

function drawMilestoneLabel(svg: SVGSVGElement, milestone: MilestoneItem, position: TimelinePosition, stateClass: string): void {
    const fullName = text(milestone.NombreHito);
    const title = addWrappedText(svg, fullName, position.x, position.y + timeline.nameOffset, `evm-milestone-name ${stateClass}`, 15, 2);
    title.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "title")).textContent = fullName;
    drawNameDateConnector(svg, position, stateClass, title.querySelectorAll("tspan").length);
    addDateBadge(svg, date(milestone.FechaHitoReal || milestone.FechaHitoPlan), position.x, position.y + timeline.dateOffset, stateClass);
}

function drawNameDateConnector(svg: SVGSVGElement, position: TimelinePosition, stateClass: string, titleLineCount: number): void {
    const startY = position.y + timeline.nameOffset + 8 + Math.max(0, titleLineCount - 1) * 16;
    const endY = position.y + timeline.dateOffset - 13;
    if (endY <= startY) {
        return;
    }

    const line = svgElement("line");
    line.setAttribute("x1", String(position.x));
    line.setAttribute("y1", String(startY));
    line.setAttribute("x2", String(position.x));
    line.setAttribute("y2", String(endY));
    line.setAttribute("class", `evm-milestone-name-date-connector ${stateClass}`);
    svg.appendChild(line);
}

function addWrappedText(svg: SVGSVGElement, label: string, x: number, y: number, className: string, maxChars: number, maxLines: number): SVGTextElement {
    const node = svgElement("text");
    node.setAttribute("x", String(x));
    node.setAttribute("y", String(y));
    node.setAttribute("text-anchor", "middle");
    node.setAttribute("class", className);

    wrapText(label, maxChars, maxLines).forEach((line, index) => {
        const tspan = svgElement("tspan");
        tspan.setAttribute("x", String(x));
        tspan.setAttribute("dy", index === 0 ? "0" : "16");
        tspan.textContent = line;
        node.appendChild(tspan);
    });

    svg.appendChild(node);
    return node;
}

function addDateBadge(svg: SVGSVGElement, label: string, x: number, y: number, stateClass: string): void {
    const badge = svgElement("rect");
    badge.setAttribute("x", String(x - 40));
    badge.setAttribute("y", String(y - 12));
    badge.setAttribute("width", "80");
    badge.setAttribute("height", "21");
    badge.setAttribute("rx", "5");
    badge.setAttribute("class", `evm-milestone-date-bg ${stateClass}`);
    svg.appendChild(badge);
    addText(svg, label, x, y + 2, "middle", "evm-milestone-date-text");
}

function addText(svg: SVGSVGElement, label: string, x: number, y: number, anchor: "middle", className: string): SVGTextElement {
    const node = svgElement("text");
    node.setAttribute("x", String(x));
    node.setAttribute("y", String(y));
    node.setAttribute("text-anchor", anchor);
    node.setAttribute("class", className);
    node.textContent = label;
    svg.appendChild(node);
    return node;
}

function wrapText(label: string, maxChars: number, maxLines: number): string[] {
    const words = label.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";

    words.forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length <= maxChars) {
            current = candidate;
            return;
        }
        if (current) {
            lines.push(current);
        }
        current = word.length > maxChars ? word.slice(0, maxChars - 1) : word;
    });

    if (current) {
        lines.push(current);
    }

    const trimmed = lines.slice(0, maxLines);
    if (lines.length > maxLines && trimmed.length) {
        trimmed[trimmed.length - 1] = `${trimmed[trimmed.length - 1].slice(0, Math.max(0, maxChars - 3))}...`;
    }
    return trimmed.length ? trimmed : ["-"];
}

function milestoneClass(status?: string): string {
    const value = (status ?? "").toLowerCase().replace(/\s/g, "");
    if (value.includes("complet")) {
        return "done";
    }
    if (value.includes("retras") || value.includes("crit")) {
        return "late";
    }
    if (value.includes("enejecucion") || value.includes("ejec")) {
        return "active";
    }
    return "pending";
}
