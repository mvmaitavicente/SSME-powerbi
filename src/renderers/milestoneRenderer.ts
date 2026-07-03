"use strict";

import { MilestoneItem } from "../types";
import { createElement, date, numberValue, svgElement, text } from "../utils/format";

interface TimelinePosition {
    x: number;
    y: number;
    labelY: number;
    isTop: boolean;
}

const timeline = {
    width: 900,
    height: 210,
    startX: 70,
    endX: 830,
    baseY: 70
};

export function renderMilestones(milestones: MilestoneItem[]): HTMLElement {
    const card = createElement("section", "evm-card evm-milestone-card milestone-card");
    card.appendChild(createElement("div", "evm-section-title evm-milestone-title", "Hitos Principales del Proyecto"));

    const ordered = [...milestones].sort((a, b) => (numberValue(a.OrdenHito) ?? 0) - (numberValue(b.OrdenHito) ?? 0));
    const wrap = createElement("div", "milestone-svg-wrap");
    const svg = svgElement("svg");
    svg.setAttribute("viewBox", `0 0 ${timeline.width} ${timeline.height}`);
    svg.classList.add("evm-timeline-svg");

    if (!ordered.length) {
        addText(svg, "Sin hitos", timeline.width / 2, timeline.height / 2, "middle", "evm-empty-svg");
    } else {
        drawTimeline(svg, ordered);
    }

    wrap.appendChild(svg);
    card.appendChild(wrap);
    return card;
}

function drawTimeline(svg: SVGSVGElement, milestones: MilestoneItem[]): void {
    drawLine(svg, timeline.startX, timeline.baseY, timeline.endX, timeline.baseY, "evm-timeline-base");
    drawArrow(svg);

    milestones.forEach((milestone, index) => {
        const position = milestonePosition(index, milestones.length);
        const stateClass = milestoneClass(milestone.EstadoHito);
        const connectorEnd = position.isTop ? position.y - 22 : position.y + 22;
        drawLine(svg, position.x, position.y, position.x, connectorEnd, `evm-milestone-tick ${stateClass}`);
        drawMarker(svg, position.x, position.y, stateClass);
        drawMilestoneLabel(svg, milestone, position, stateClass);
    });
}

function milestonePosition(index: number, count: number): TimelinePosition {
    const x = count === 1 ? (timeline.startX + timeline.endX) / 2 : timeline.startX + ((timeline.endX - timeline.startX) / (count - 1)) * index;
    const shouldAlternate = count > 8;
    const isTop = shouldAlternate && index % 2 === 1;
    return {
        x,
        y: timeline.baseY,
        labelY: isTop ? 12 : 106,
        isTop
    };
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
    const title = addWrappedText(svg, fullName, position.x, position.labelY, `evm-milestone-name ${stateClass}`, position.isTop);
    title.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "title")).textContent = fullName;
    const statusY = position.isTop ? position.labelY + 38 : position.labelY + 38;
    const dateY = position.isTop ? position.labelY + 57 : position.labelY + 57;
    addText(svg, text(milestone.EstadoHito), position.x, statusY, "middle", `evm-milestone-state ${stateClass}`);
    addDateBadge(svg, date(milestone.FechaHitoReal || milestone.FechaHitoPlan), position.x, dateY, stateClass);
}

function addWrappedText(svg: SVGSVGElement, label: string, x: number, y: number, className: string, isTop: boolean): SVGTextElement {
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

    if (isTop) {
        node.setAttribute("transform", `translate(0 0)`);
    }
    svg.appendChild(node);
    return node;
}

function addDateBadge(svg: SVGSVGElement, label: string, x: number, y: number, stateClass: string): void {
    const badge = svgElement("rect");
    badge.setAttribute("x", String(x - 31));
    badge.setAttribute("y", String(y - 11));
    badge.setAttribute("width", "62");
    badge.setAttribute("height", "17");
    badge.setAttribute("rx", "4");
    badge.setAttribute("class", `evm-milestone-date-bg ${stateClass}`);
    svg.appendChild(badge);
    addText(svg, label, x, y + 2, "middle", "evm-milestone-date-text");
}

function drawArrow(svg: SVGSVGElement): void {
    const arrow = svgElement("path");
    arrow.setAttribute("d", `M ${timeline.endX} ${timeline.baseY} L ${timeline.endX - 10} ${timeline.baseY - 5} L ${timeline.endX - 10} ${timeline.baseY + 5} Z`);
    arrow.setAttribute("class", "evm-timeline-arrow");
    svg.appendChild(arrow);
}

function drawLine(svg: SVGSVGElement, x1: number, y1: number, x2: number, y2: number, className: string): void {
    const line = svgElement("line");
    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
    line.setAttribute("class", className);
    svg.appendChild(line);
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
