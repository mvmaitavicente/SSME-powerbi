"use strict";

import { DataValue, PerformanceData } from "../types";
import { createElement, currency, date, percent, percentRatio, text } from "../utils/format";

export function renderPerformance(data: PerformanceData): HTMLElement {
    const card = createElement("section", "evm-card evm-performance-card");
    card.appendChild(createElement("div", "evm-section-title", "Desempeno del Proyecto"));

    card.appendChild(progressRow("Plazo Consumido", data.PlazoConsumidoPct, `${percent(data.PlazoConsumidoPct)}`, "Plazo Restante", `${text(data.PlazoRestanteSemanas)} sem.`));
    card.appendChild(metricPair("Plazo Programado Total", `${text(data.PlazoProgramadoTotalSemanas)} semanas`, "Plazo Proyectado", `${text(data.PlazoProyectadoSemanas)} semanas`));
    card.appendChild(metricPair("Retraso Proyectado", `${text(data.RetrasoProyectadoSemanas)} semanas`, "Termino Proyectado", date(data.TerminoProyectado), true));
    card.appendChild(progressRow("Presupuesto Consumido", data.PresupuestoConsumidoPct, `${percent(data.PresupuestoConsumidoPct)}`, "Presupuesto Restante", currency(data.PresupuestoRestante)));
    card.appendChild(metricPair("Presupuesto Programado (BAC)", currency(data.PresupuestoProgramadoBAC), "Costo Estimado al Termino (EAC)", currency(data.CostoEstimadoTerminoEAC)));
    card.appendChild(metricSingle("Sobre Costo Proyectado", `${currency(data.SobreCostoProyectadoVAC)} (${percent(data.SobreCostoProyectadoPct)})`, true));

    return card;
}

function progressRow(leftLabel: string, pctValue: DataValue, pctText: string, rightLabel: string, rightValue: string): HTMLElement {
    const row = createElement("div", "evm-performance-row");
    const progressBlock = createElement("div", "evm-progress-block");
    progressBlock.appendChild(createElement("span", "performance-label", leftLabel));
    const progress = createElement("div", "evm-progress");
    const fill = createElement("i");
    fill.style.width = `${percentRatio(pctValue)}%`;
    progress.appendChild(fill);
    progressBlock.appendChild(progress);
    progressBlock.appendChild(createElement("strong", undefined, pctText));

    const right = createElement("div");
    right.appendChild(createElement("span", "performance-label", rightLabel));
    right.appendChild(createElement("strong", undefined, rightValue));
    row.appendChild(progressBlock);
    row.appendChild(right);
    return row;
}

function metricPair(leftLabel: string, leftValue: string, rightLabel: string, rightValue: string, alert: boolean = false): HTMLElement {
    const row = createElement("div", `evm-performance-row${alert ? " alert" : ""}`);
    row.appendChild(metric(leftLabel, leftValue));
    row.appendChild(metric(rightLabel, rightValue));
    return row;
}

function metricSingle(label: string, value: string, alert: boolean = false): HTMLElement {
    const row = createElement("div", `evm-performance-row single${alert ? " alert" : ""}`);
    row.appendChild(metric(label, value));
    return row;
}

function metric(label: string, value: string): HTMLElement {
    const wrapper = createElement("div");
    wrapper.appendChild(createElement("span", "performance-label", label));
    wrapper.appendChild(createElement("strong", undefined, value));
    return wrapper;
}
