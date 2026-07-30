"use strict";

import { DataValue, PortfolioSummaryData } from "../types";
import { createElement, numberValue, shortCurrency } from "../utils/format";
import { renderCompactCard, renderHorizontalCard, renderPrimaryCard } from "./KPICard";
import { portfolioClasses } from "./styles";

function integer(value: DataValue): string {
    const parsed = numberValue(value);
    if (parsed === null) {
        return "—";
    }
    const rounded = Math.round(parsed);
    return (Object.is(rounded, -0) ? 0 : rounded).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function percentage(value: DataValue, signed: boolean): string {
    const parsed = numberValue(value);
    if (parsed === null) {
        return "—";
    }
    const normalized = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
    const sign = signed && normalized > 0 ? "+" : "";
    return `${sign}${normalized.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

export function renderPortfolioDashboard(summary: PortfolioSummaryData | null): HTMLElement {
    const panel = createElement("section", `evm-card evm-performance-card ${portfolioClasses.panel}`);
    panel.appendChild(createElement("div", "evm-section-title", "Resumen General"));
    if (!summary) {
        panel.appendChild(createElement("div", "evm-empty", "No se encontraron datos del resumen general."));
        return panel;
    }

    const grid = createElement("div", portfolioClasses.grid);
    grid.appendChild(renderPrimaryCard("blue", "building", integer(summary.ProyectosActivos), "Proyectos Activos", undefined, [
        [integer(summary.CantidadProyectos), "Proyectos"],
        [integer(summary.CantidadIntervenciones), "Intervenciones"]
    ]));
    grid.appendChild(renderPrimaryCard("green", "budget", shortCurrency(summary.PresupuestoInstitucional), "Presupuesto Institucional", "(BAC y PIM)", [
        [shortCurrency(summary.PresupuestoProyectos), "Proyectos"],
        [shortCurrency(summary.PresupuestoIntervenciones), "Intervenciones"]
    ]));
    const deviations = createElement("div", "evm-portfolio-summary-deviations");
    deviations.appendChild(renderHorizontalCard("blue", "schedule", percentage(summary.DesviacionPlazoPct, true), "Desviación del Portafolio", "(Plazo)"));
    deviations.appendChild(renderHorizontalCard("orange", "cost", percentage(summary.DesviacionCostoPct, true), "Desviación del Portafolio", "(Costo)"));
    grid.appendChild(deviations);
    const bottom = createElement("div", portfolioClasses.bottom);
    bottom.appendChild(renderCompactCard("orange", "critical", integer(summary.IntervencionesCriticas), "Intervenciones Críticas"));
    bottom.appendChild(renderCompactCard("red", "risk", percentage(summary.RiesgoPortafolioPct, false), "Riesgo del Portafolio"));
    grid.appendChild(bottom);
    panel.appendChild(grid);
    return panel;
}
