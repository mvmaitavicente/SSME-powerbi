"use strict";

import { DataValue, PortfolioSummary } from "../types";
import { createElement, numberValue, shortCurrency, svgElement } from "../utils/format";

type SummaryIcon = "portfolio" | "budget" | "schedule" | "cost" | "critical" | "risk";

export function renderPortfolioSummary(data: PortfolioSummary | null): HTMLElement {
    const panel = createElement("section", "evm-card pronied-portfolio-summary");
    const header = createElement("header", "portfolio-summary-header");
    header.appendChild(createElement("div", "evm-section-title", "RESUMEN GENERAL"));
    panel.appendChild(header);

    if (!data) {
        panel.appendChild(createElement("div", "evm-empty portfolio-summary-empty", "No hay información de resumen disponible."));
        return panel;
    }

    const mainGrid = createElement("div", "portfolio-summary-main-grid");
    mainGrid.appendChild(mainCard(
        "projects",
        "portfolio",
        integer(data.activeProjects),
        "Proyectos Activos",
        [["Proyectos", integer(data.projects)], ["Intervenciones", integer(data.interventions)]]
    ));
    mainGrid.appendChild(mainCard(
        "budget",
        "budget",
        shortCurrency(data.institutionalBudget),
        "Presupuesto Institucional (BAC y PIM)",
        [["Proyectado", shortCurrency(data.projectedBudget)], ["Intervenciones", shortCurrency(data.interventionBudget)]]
    ));
    panel.appendChild(mainGrid);

    const deviationGrid = createElement("div", "portfolio-summary-metric-grid");
    deviationGrid.appendChild(metricCard("schedule", "schedule", signedPercent(data.scheduleDeviation), "Desviación del Portafolio (Plazo)"));
    deviationGrid.appendChild(metricCard("cost", "cost", signedPercent(data.costDeviation), "Desviación del Portafolio (Costo)"));
    panel.appendChild(deviationGrid);

    const riskGrid = createElement("div", "portfolio-summary-risk-grid");
    riskGrid.appendChild(metricCard("critical", "critical", integer(data.criticalInterventions), "Intervenciones Críticas"));
    riskGrid.appendChild(metricCard("risk", "risk", unsignedPercent(data.portfolioRisk), "Riesgo del Portafolio"));
    panel.appendChild(riskGrid);
    return panel;
}

function mainCard(accent: string, icon: SummaryIcon, value: string, label: string, details: Array<[string, string]>): HTMLElement {
    const card = createElement("article", `portfolio-summary-card portfolio-summary-card--${accent}`);
    const primary = createElement("div", "portfolio-summary-primary");
    primary.appendChild(renderIcon(icon, label));
    const copy = createElement("div", "portfolio-summary-copy");
    copy.appendChild(createElement("strong", undefined, value));
    copy.appendChild(createElement("span", undefined, label));
    primary.appendChild(copy);
    card.appendChild(primary);

    const detailGrid = createElement("div", "portfolio-summary-details");
    details.forEach(([detailLabel, detailValue]) => {
        const detail = createElement("div", "portfolio-summary-detail");
        detail.appendChild(createElement("strong", undefined, detailValue));
        detail.appendChild(createElement("span", undefined, detailLabel));
        detailGrid.appendChild(detail);
    });
    card.appendChild(detailGrid);
    return card;
}

function metricCard(accent: string, icon: SummaryIcon, value: string, label: string): HTMLElement {
    const card = createElement("article", `portfolio-summary-card portfolio-summary-compact portfolio-summary-card--${accent}`);
    card.appendChild(renderIcon(icon, label));
    const copy = createElement("div", "portfolio-summary-copy");
    copy.appendChild(createElement("strong", undefined, value));
    copy.appendChild(createElement("span", undefined, label));
    card.appendChild(copy);
    return card;
}

function integer(value: DataValue): string {
    const parsed = numberValue(value);
    return parsed === null ? "—" : Math.round(parsed).toLocaleString("en-US");
}

function signedPercent(value: DataValue): string {
    const parsed = numberValue(value);
    if (parsed === null) {
        return "—";
    }
    const percentage = parsed * 100;
    return `${percentage > 0 ? "+" : ""}${percentage.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function unsignedPercent(value: DataValue): string {
    const parsed = numberValue(value);
    return parsed === null
        ? "—"
        : `${(parsed * 100).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function renderIcon(icon: SummaryIcon, label: string): HTMLElement {
    const wrapper = createElement("div", `portfolio-summary-icon ${icon}`);
    wrapper.setAttribute("role", "img");
    wrapper.setAttribute("aria-label", label);
    wrapper.setAttribute("title", label);
    const svg = svgElement("svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");

    const paths: Record<SummaryIcon, string[]> = {
        portfolio: ["M4 20V8h6v12", "M10 20V4h7v16", "M17 20v-9h3v9", "M2 20h20", "M7 11h.01M7 15h.01M13 8h1M13 12h1M13 16h1"],
        budget: ["M8 7c0-2 1.7-4 4-4s4 2 4 4", "M7 8h10l3 5c1.2 4.2-1.5 8-5.5 8h-5C5.5 21 2.8 17.2 4 13l3-5Z", "M12 10v7M14 12c-.5-.5-1.1-.7-2-.7-1 0-1.7.5-1.7 1.2 0 .8.8 1 1.8 1.3 1 .3 1.7.6 1.7 1.4 0 .9-.8 1.4-1.9 1.4-.8 0-1.5-.2-2-.7"],
        schedule: ["M5 5h14v15H5z", "M8 3v4M16 3v4M5 9h14", "M12 12v3l2 1"],
        cost: ["M4 19l6-6 4 3 6-8", "M16 8h4v4", "M7 7h5", "M9.5 4.5v5"],
        critical: ["M7 4h10v3h2v14H5V7h2z", "M9 12h6M9 16h4", "M10 4h4"],
        risk: ["M12 3 2.8 20h18.4L12 3Z", "M12 9v5", "M12 17h.01"]
    };
    paths[icon].forEach((definition) => {
        const path = svgElement("path");
        path.setAttribute("d", definition);
        svg.appendChild(path);
    });
    wrapper.appendChild(svg);
    return wrapper;
}
