"use strict";

import { RiskItem } from "../types";
import { createElement, currency, percent, text } from "../utils/format";

export function renderRisks(risks: RiskItem[]): HTMLElement {
    const card = createElement("section", "evm-card evm-risk-card");
    card.appendChild(createElement("div", "evm-section-title", "Matriz de Riesgos"));

    const cards = createElement("div", "evm-risk-summary");
    risks.forEach((risk) => {
        const item = createElement("div", `evm-risk-mini ${riskClass(risk.NivelRiesgo)}`);
        item.appendChild(createElement("strong", undefined, text(risk.CantidadRiesgos, "0")));
        item.appendChild(createElement("span", undefined, text(risk.NivelRiesgo, "Riesgo")));
        cards.appendChild(item);
    });
    if (!risks.length) {
        cards.appendChild(createElement("div", "evm-empty", "Sin riesgos"));
    }

    const table = createElement("table", "evm-risk-table");
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Nivel", "Cantidad", "% Total", "Impacto Plazo", "Impacto Costo"].forEach((label) => headRow.appendChild(createElement("th", undefined, label)));
    head.appendChild(headRow);
    const body = document.createElement("tbody");
    risks.forEach((risk) => {
        const row = document.createElement("tr");
        const level = createElement("td");
        level.appendChild(createElement("span", `evm-risk-dot ${riskClass(risk.NivelRiesgo)}`));
        level.appendChild(document.createTextNode(text(risk.NivelRiesgo)));
        row.appendChild(level);
        row.appendChild(createElement("td", undefined, text(risk.CantidadRiesgos)));
        row.appendChild(createElement("td", undefined, percent(risk.PorcentajeRiesgos)));
        row.appendChild(createElement("td", undefined, `${text(risk.ImpactoPlazoSemanas)} sem.`));
        row.appendChild(createElement("td", undefined, currency(risk.ImpactoCosto)));
        body.appendChild(row);
    });
    table.appendChild(head);
    table.appendChild(body);

    card.appendChild(cards);
    card.appendChild(table);
    return card;
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
