"use strict";

import { MilestoneItem } from "../types";
import { createElement, date, numberValue, svgElement, text } from "../utils/format";

interface TimelinePosition {
    x: number;
    y: number;
    labelY: number;
    row: number;
}

const timeline = {
    width: 900,
    columnsPerRow: 4,
    startX: 86,
    endX: 814,
    firstRowY: 72,
    rowGap: 162,
    bottomPadding: 108
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
        { className: "done", title: "Completado", description: "Hito finalizado correctamente." },
        { className: "active", title: "En ejecución", description: "Hito en desarrollo." },
        { className: "late", title: "Retrasado", description: "Hito no cumplido a la fecha programada." },
        { className: "pending", title: "Pendiente", description: "Hito aún no iniciado." }
    ];

    const grid = createElement("div", "evm-milestone-legend-grid");
    items.forEach((item) => {
        const node = createElement("div", "evm-milestone-legend-item");
        node.appendChild(createElement("span", `evm-milestone-legend-icon ${item.className}`));
        const copy = createElement("div", "evm-milestone-legend-copy");
        copy.appendChild(createElement("strong", item.className, item.title));
        copy.appendChild(createElement("span", undefined, item.description));
        node.appendChild(copy);
        grid.appendChild(node);
    });

    legend.appendChild(grid);
    return legend;
}

function drawTimeline(svg: SVGSVGElement, milestones: MilestoneItem[]): void {
    const positions = milestones.map((_, index) => milestonePosition(index));
    appendArrowMarker(svg);
    drawPath(svg, positions);

    milestones.forEach((milestone, index) => {
        const position = positions[index];
        const stateClass = milestoneClass(milestone.EstadoHito);
        drawMarker(svg, position.x, position.y, stateClass);
        drawMilestoneLabel(svg, milestone, position, stateClass);
    });
}

function milestonePosition(index: number): TimelinePosition {
    const row = Math.floor(index / timeline.columnsPerRow);
    const positionInRow = index % timeline.columnsPerRow;
    const isReverseRow = row % 2 === 1;
    const visualColumn = isReverseRow
        ? timeline.columnsPerRow - 1 - positionInRow
        : positionInRow;
    const step = (timeline.endX - timeline.startX) / (timeline.columnsPerRow - 1);
    const x = timeline.startX + step * visualColumn;
    const y = timeline.firstRowY + row * timeline.rowGap;
    return {
        x,
        y,
        labelY: y + 40,
        row
    };
}

function timelineHeight(count: number): number {
    const rows = Math.ceil(count / timeline.columnsPerRow);
    return timeline.firstRowY + Math.max(0, rows - 1) * timeline.rowGap + timeline.bottomPadding;
}

function drawPath(svg: SVGSVGElement, positions: TimelinePosition[]): void {
    if (!positions.length) {
        return;
    }

    const commands: string[] = [`M ${positions[0].x} ${positions[0].y}`];
    for (let index = 1; index < positions.length; index++) {
        const previous = positions[index - 1];
        const current = positions[index];
        if (previous.row === current.row) {
            commands.push(`L ${current.x} ${current.y}`);
            continue;
        }

        const curveOffset = previous.x >= (timeline.startX + timeline.endX) / 2 ? 46 : -46;
        commands.push(`C ${previous.x + curveOffset} ${previous.y} ${current.x + curveOffset} ${current.y} ${current.x} ${current.y}`);
    }

    const path = svgElement("path");
    path.setAttribute("d", commands.join(" "));
    path.setAttribute("class", "evm-timeline-base");
    path.setAttribute("marker-end", "url(#evm-timeline-arrowhead)");
    svg.appendChild(path);
}

function appendArrowMarker(svg: SVGSVGElement): void {
    const defs = svgElement("defs");
    const marker = svgElement("marker");
    marker.setAttribute("id", "evm-timeline-arrowhead");
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refX", "8");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "5");
    marker.setAttribute("markerHeight", "5");
    marker.setAttribute("orient", "auto-start-reverse");
    const arrow = svgElement("path");
    arrow.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    arrow.setAttribute("class", "evm-timeline-arrow");
    marker.appendChild(arrow);
    defs.appendChild(marker);
    svg.appendChild(defs);
}

function drawMarker(svg: SVGSVGElement, x: number, y: number, stateClass: string): void {
    const marker = svgElement("circle");
    marker.setAttribute("cx", String(x));
    marker.setAttribute("cy", String(y));
    marker.setAttribute("r", "14");
    marker.setAttribute("class", `evm-milestone-dot ${stateClass}`);
    svg.appendChild(marker);

    if (stateClass === "done") {
        const check = svgElement("path");
        check.setAttribute("d", `M ${x - 7} ${y} L ${x - 2} ${y + 5} L ${x + 8} ${y - 7}`);
        check.setAttribute("class", "evm-milestone-icon light");
        svg.appendChild(check);
        return;
    }

    if (stateClass === "late") {
        addText(svg, "!", x, y + 5, "middle", "evm-milestone-alert");
        return;
    }

    const inner = svgElement("circle");
    inner.setAttribute("cx", String(x));
    inner.setAttribute("cy", String(y));
    inner.setAttribute("r", stateClass === "pending" ? "6" : "5");
    inner.setAttribute("class", `evm-milestone-inner ${stateClass}`);
    svg.appendChild(inner);
}

function drawMilestoneLabel(svg: SVGSVGElement, milestone: MilestoneItem, position: TimelinePosition, stateClass: string): void {
    const fullName = text(milestone.NombreHito);
    const title = addWrappedText(svg, fullName, position.x, position.labelY, `evm-milestone-name ${stateClass}`);
    title.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "title")).textContent = fullName;
    const dateY = position.labelY + 43;
    addDateBadge(svg, date(milestone.FechaHitoReal || milestone.FechaHitoPlan), position.x, dateY, stateClass);
}

function addWrappedText(svg: SVGSVGElement, label: string, x: number, y: number, className: string): SVGTextElement {
    const node = svgElement("text");
    node.setAttribute("x", String(x));
    node.setAttribute("y", String(y));
    node.setAttribute("text-anchor", "middle");
    node.setAttribute("class", className);

    wrapText(label, 14, 2).forEach((line, index) => {
        const tspan = svgElement("tspan");
        tspan.setAttribute("x", String(x));
        tspan.setAttribute("dy", index === 0 ? "0" : "12");
        tspan.textContent = line;
        node.appendChild(tspan);
    });

    svg.appendChild(node);
    return node;
}

function addDateBadge(svg: SVGSVGElement, label: string, x: number, y: number, stateClass: string): void {
    const badge = svgElement("rect");
    badge.setAttribute("x", String(x - 42));
    badge.setAttribute("y", String(y - 13));
    badge.setAttribute("width", "84");
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
