"use strict";

import { DataValue, RiskItem } from "../types";
import { createElement, numberValue, percent, text } from "../utils/format";

export function renderRisks(risks: RiskItem[]): HTMLElement {
    const card = createElement("section", "evm-card evm-risk-card");
    card.appendChild(createElement("div", "evm-section-title", "Matriz de Riesgos"));

    const cards = createElement("div", "evm-risk-summary");
    const orderedRisks = orderRisks(risks);
    const totals = riskTotals(orderedRisks);
    orderedRisks.forEach((risk) => {
        const item = createElement("div", `evm-risk-mini ${riskClass(risk.NivelRiesgo)}`);
        item.appendChild(createElement("strong", undefined, integer(risk.CantidadRiesgos)));
        item.appendChild(createElement("span", undefined, riskSummaryLabel(risk.NivelRiesgo)));
        cards.appendChild(item);
    });
    if (orderedRisks.length) {
        const totalCard = createElement("div", "evm-risk-mini total");
        totalCard.appendChild(createElement("strong", undefined, integer(totals.quantity)));
        totalCard.appendChild(createElement("span", undefined, "Totales"));
        cards.appendChild(totalCard);
    }
    if (!risks.length) {
        cards.appendChild(createElement("div", "evm-empty", "Sin riesgos"));
    }

    const table = createElement("table", "evm-risk-table");
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Nivel de Riesgo", "Cantidad", "% del Total", "Impacto en Plazo", "Impacto en Costo"].forEach((label) => headRow.appendChild(createElement("th", undefined, label)));
    head.appendChild(headRow);
    const body = document.createElement("tbody");
    orderedRisks.forEach((risk) => {
        const row = document.createElement("tr");
        const riskLevelClass = riskClass(risk.NivelRiesgo);
        const level = createElement("td", `evm-risk-level ${riskLevelClass}`);
        level.appendChild(createElement("span", `evm-risk-dot ${riskLevelClass}`));
        level.appendChild(document.createTextNode(text(risk.NivelRiesgo)));
        row.appendChild(level);
        row.appendChild(createElement("td", undefined, integer(risk.CantidadRiesgos)));
        row.appendChild(createElement("td", undefined, percent(risk.PorcentajeRiesgos)));
        row.appendChild(createElement("td", undefined, signedWeeks(risk.ImpactoPlazoSemanas)));
        row.appendChild(createElement("td", undefined, currencyFull(risk.ImpactoCosto)));
        body.appendChild(row);
    });
    if (orderedRisks.length) {
        const totalRow = document.createElement("tr");
        totalRow.className = "evm-risk-total-row";
        totalRow.appendChild(createElement("td", undefined, "TOTAL"));
        totalRow.appendChild(createElement("td", undefined, integer(totals.quantity)));
        totalRow.appendChild(createElement("td", undefined, "100%"));
        totalRow.appendChild(createElement("td", undefined, signedWeeks(totals.scheduleImpact)));
        totalRow.appendChild(createElement("td", undefined, currencyFull(totals.costImpact)));
        body.appendChild(totalRow);
    }
    table.appendChild(head);
    table.appendChild(body);

    card.appendChild(cards);
    card.appendChild(table);
    return card;
}

function orderRisks(risks: RiskItem[]): RiskItem[] {
    const rank = (risk: RiskItem): number => {
        const level = riskClass(risk.NivelRiesgo);
        if (level === "low") {
            return 0;
        }
        if (level === "medium") {
            return 1;
        }
        if (level === "high") {
            return 2;
        }
        return 3;
    };
    return [...risks].sort((a, b) => rank(a) - rank(b));
}

function riskTotals(risks: RiskItem[]): { quantity: number; scheduleImpact: number; costImpact: number } {
    return risks.reduce((total, risk) => ({
        quantity: total.quantity + (numberValue(risk.CantidadRiesgos) ?? 0),
        scheduleImpact: total.scheduleImpact + (numberValue(risk.ImpactoPlazoSemanas) ?? 0),
        costImpact: total.costImpact + (numberValue(risk.ImpactoCosto) ?? 0)
    }), { quantity: 0, scheduleImpact: 0, costImpact: 0 });
}

function riskSummaryLabel(level?: string): string {
    const itemClass = riskClass(level);
    if (itemClass === "low") {
        return "Bajos";
    }
    if (itemClass === "medium") {
        return "Medios";
    }
    if (itemClass === "high") {
        return "Altos";
    }
    return "Totales";
}

function integer(value: DataValue): string {
    const numeric = numberValue(value);
    return numeric === null ? "0" : numeric.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function signedWeeks(value: DataValue): string {
    const numeric = numberValue(value);
    if (numeric === null) {
        return "—";
    }
    const sign = numeric > 0 ? "+" : "";
    return `${sign}${numeric.toLocaleString("en-US", { maximumFractionDigits: 0 })} sem.`;
}

function currencyFull(value: DataValue): string {
    const numeric = numberValue(value);
    if (numeric === null) {
        return "—";
    }
    return `S/ ${numeric.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function riskClass(level?: string): string {
    const value = (level ?? "").toLowerCase();
    if (value.includes("alto")) {
        return "high";
    }
    if (value.includes("medio")) {
        return "medium";
    }
    if (value.includes("bajo")) {
        return "low";
    }
    return "total";
}
