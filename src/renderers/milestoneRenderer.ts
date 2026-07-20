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
    startX: 70,
    endX: 890,
    firstRowY: 35,
    connectorEndOffset: 48,
    nameOffset: 78,
    nameLineGap: 30,
    dateOffset: 135,
    bottomPadding: 18
};

export function renderMilestones(milestones: MilestoneItem[]): HTMLElement {
    const card = createElement("section", "evm-card evm-milestone-card milestone-card");
    const title = createElement("div", "evm-section-title evm-milestone-title", "Hitos Principales del Proyecto");

    const ordered = [...milestones].sort((a, b) => (numberValue(a.OrdenHito) ?? 0) - (numberValue(b.OrdenHito) ?? 0));
    const wrap = createElement("div", "milestone-svg-wrap");
    const svg = svgElement("svg");
    svg.classList.add("evm-timeline-svg");

    if (!ordered.length) {
        svg.setAttribute("viewBox", `0 0 ${timeline.width} 220`);
        addText(svg, "Sin hitos", timeline.width / 2, 110, "middle", "evm-empty-svg");
    } else {
        svg.setAttribute("viewBox", `0 0 ${timeline.width} ${timelineHeight()}`);
        drawTimeline(svg, ordered);
    }

    wrap.appendChild(svg);
    const content = createElement("div", "evm-milestone-content");
    const timelineColumn = createElement("div", "evm-milestone-timeline-column");
    timelineColumn.appendChild(title);
    timelineColumn.appendChild(wrap);
    content.appendChild(timelineColumn);
    content.appendChild(renderMilestoneLegend());
    card.appendChild(content);
    return card;
}

function renderMilestoneLegend(): HTMLElement {
    const legend = createElement("div", "evm-milestone-legend");
    legend.appendChild(createElement("div", "evm-milestone-legend-title", "Leyenda de estados"));

    const items = [
        { className: "done", title: "Completado", description: "Hito finalizado correctamente." },
        { className: "active", title: "En ejecución", description: "Hito en desarrollo." },
        { className: "late", title: "Retrasado", description: "Hito no cumplido a la fecha programada." },
        { className: "pending", title: "Pendiente", description: "Hito aún no iniciado." }
    ];

    const grid = createElement("div", "evm-milestone-legend-grid");
    items.forEach((item) => {
        const node = createElement("div", "evm-milestone-legend-item");
        const copy = createElement("div", "evm-milestone-legend-copy");
        const title = createElement("strong", item.className);
        title.appendChild(createElement("span", `evm-milestone-legend-icon ${item.className}`));
        title.appendChild(document.createTextNode(item.title));
        copy.appendChild(title);
        copy.appendChild(createElement("span", undefined, item.description));
        node.appendChild(copy);
        grid.appendChild(node);
    });

    legend.appendChild(grid);
    return legend;
}

function drawTimeline(svg: SVGSVGElement, milestones: MilestoneItem[]): void {
    const positions = milestones.map((_, index) => milestonePosition(index, milestones.length));
    drawRowLines(svg, milestones, positions);

    milestones.forEach((milestone, index) => {
        const position = positions[index];
        const stateClass = milestoneClass(milestone.EstadoHito);
        drawMilestoneConnector(svg, position, stateClass);
        drawMarker(svg, position.x, position.y, stateClass);
        drawMilestoneLabel(svg, milestone, position, stateClass);
    });
}

function milestonePosition(index: number, count: number): TimelinePosition {
    const step = count > 1 ? (timeline.endX - timeline.startX) / (count - 1) : 0;
    const x = count > 1 ? timeline.startX + step * index : timeline.width / 2;
    return {
        x,
        y: timeline.firstRowY,
        row: 0
    };
}

function timelineHeight(): number {
    return 198;
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
    line.setAttribute("y1", String(position.y + 15));
    line.setAttribute("x2", String(position.x));
    line.setAttribute("y2", String(position.y + timeline.connectorEndOffset - 8));
    line.setAttribute("class", `evm-milestone-connector ${stateClass}`);
    svg.appendChild(line);

    const dot = svgElement("circle");
    dot.setAttribute("cx", String(position.x));
    dot.setAttribute("cy", String(position.y + timeline.connectorEndOffset));
    dot.setAttribute("r", "5");
    dot.setAttribute("class", `evm-milestone-small-dot ${stateClass}`);
    svg.appendChild(dot);
}

function drawMarker(svg: SVGSVGElement, x: number, y: number, stateClass: string): void {
    if (stateClass === "done") {
        drawCircleMarker(svg, x, y, stateClass, true);
        const check = svgElement("path");
        check.setAttribute("d", `M ${x - 6} ${y} L ${x - 2.5} ${y + 3.5} L ${x + 8} ${y - 6}`);
        check.setAttribute("class", "evm-milestone-icon light");
        svg.appendChild(check);
        return;
    }

    if (stateClass === "late") {
        const triangle = svgElement("polygon");
        triangle.setAttribute("points", `${x},${y - 14} ${x + 15},${y + 13} ${x - 15},${y + 13}`);
        triangle.setAttribute("class", "evm-milestone-triangle late");
        svg.appendChild(triangle);
        addText(svg, "!", x, y + 8, "middle", "evm-milestone-alert");
        return;
    }

    drawCircleMarker(svg, x, y, stateClass, false);
}

function drawCircleMarker(svg: SVGSVGElement, x: number, y: number, stateClass: string, filled: boolean): void {
    const halo = svgElement("circle");
    halo.setAttribute("cx", String(x));
    halo.setAttribute("cy", String(y));
    halo.setAttribute("r", "15.5");
    halo.setAttribute("class", `evm-milestone-halo ${stateClass}`);
    svg.appendChild(halo);

    const marker = svgElement("circle");
    marker.setAttribute("cx", String(x));
    marker.setAttribute("cy", String(y));
    marker.setAttribute("r", filled ? "11" : "9.5");
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
    badge.setAttribute("x", String(x - 33));
    badge.setAttribute("y", String(y - 9));
    badge.setAttribute("width", "66");
    badge.setAttribute("height", "17");
    badge.setAttribute("rx", "4");
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
