"use strict";

import { DataValue, RiskItem } from "../types";
import { createElement, numberValue, percent, text } from "../utils/format";

export function renderRisks(risks: RiskItem[]): HTMLElement {
    const card = createElement("section", "evm-card evm-risk-card");
    card.appendChild(createElement("div", "evm-section-title", "Matriz de Riesgos"));

    const cards = createElement("div", "evm-risk-summary");
    const orderedRisks = completeRiskLevels(orderRisks(risks));
    const totals = riskTotals(orderedRisks);
    orderedRisks.forEach((risk) => {
        const item = createRiskCard(risk, detailsForRisk(risk), riskSummaryLabel(risk.NivelRiesgo));
        item.appendChild(createElement("strong", undefined, integer(risk.CantidadRiesgos)));
        item.appendChild(createElement("span", undefined, riskSummaryLabel(risk.NivelRiesgo)));
        cards.appendChild(item);
    });
    if (orderedRisks.length) {
        const totalCard = createRiskCard(undefined, orderedRisks.flatMap(detailsForRisk), "Totales");
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
    [
        ["Nivel de", "Riesgo"],
        ["Cantidad"],
        ["% del", "Total"],
        ["Impacto en", "Plazo"],
        ["Impacto en", "Costo"]
    ].forEach((lines) => {
        const header = document.createElement("th");
        lines.forEach((line) => header.appendChild(createElement("span", undefined, line)));
        headRow.appendChild(header);
    });
    head.appendChild(headRow);
    const body = document.createElement("tbody");
    orderedRisks.forEach((risk) => {
        const row = document.createElement("tr");
        const riskLevelClass = riskClass(risk.NivelRiesgo);
        const level = createElement("td", `evm-risk-level ${riskLevelClass}`);
        level.appendChild(createElement("span", `evm-risk-dot ${riskLevelClass}`));
        level.appendChild(document.createTextNode(riskLevelLabel(risk.NivelRiesgo)));
        row.appendChild(level);
        row.appendChild(createElement("td", undefined, integer(risk.CantidadRiesgos)));
        row.appendChild(createElement("td", undefined, riskPercent(risk, totals.quantity)));
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
    card.appendChild(renderRiskLegend());
    return card;
}

function createRiskCard(risk: RiskItem | undefined, details: RiskItem[], title: string): HTMLButtonElement {
    const item = createElement("button", `evm-risk-mini ${risk ? riskClass(risk.NivelRiesgo) : "total"}`) as HTMLButtonElement;
    item.type = "button";
    item.title = `Ver detalle de riesgos ${title.toLowerCase()}`;
    item.setAttribute("aria-label", `Ver detalle de riesgos ${title.toLowerCase()}`);
    item.addEventListener("click", () => openRiskModal(title, details));
    return item;
}

function openRiskModal(title: string, details: RiskItem[]): void {
    document.querySelector(".evm-risk-detail-modal-overlay")?.remove();
    const overlay = createElement("div", "evm-risk-detail-modal-overlay");
    const modal = createElement("section", "evm-risk-detail-modal");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", `Detalle de riesgos ${title}`);
    modal.style.height = `${Math.min(window.innerHeight - 12, Math.max(460, 220 + (details.length + 1) * 74))}px`;

    const header = createElement("header", "evm-risk-detail-modal-header");
    const heading = createElement("div");
    heading.appendChild(createElement("span", undefined, "RIESGOS"));
    heading.appendChild(createElement("h2", undefined, "MATRIZ DE RIESGOS"));
    heading.appendChild(createElement("strong", undefined, title));
    const close = createElement("button", "evm-risk-detail-modal-close", "×") as HTMLButtonElement;
    close.type = "button";
    close.setAttribute("aria-label", "Cerrar detalle de riesgos");
    header.append(heading, close);

    const body = createElement("div", "evm-risk-detail-modal-body");
    if (!details.length) {
        body.appendChild(createElement("div", "evm-risk-detail-modal-empty", "No hay riesgos para este nivel."));
    } else {
        body.appendChild(renderRiskDetailTable(details));
    }

    const closeModal = (): void => overlay.remove();
    close.addEventListener("click", closeModal);
    modal.addEventListener("click", (event) => event.stopPropagation());
    overlay.addEventListener("click", closeModal);
    modal.append(header, body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function renderRiskDetailTable(details: RiskItem[]): HTMLElement {
    const wrap = createElement("div", "evm-risk-detail-modal-table-wrap");
    const table = createElement("table", "evm-risk-detail-modal-table");
    const columns: Array<[string, string, (risk: RiskItem) => string]> = [
        ["ID", "id", (risk) => text(risk.IdRiesgo)],
        ["Fecha Registro", "date", (risk) => formatRiskDate(risk.FechaRegistro)],
        ["Descripción", "description", (risk) => text(risk.Descripcion)],
        ["Categoría", "category", (risk) => text(risk.Categoria)],
        ["Responsable", "responsible", (risk) => text(risk.Responsable)],
        ["¿Tiene Plan de Respuesta?", "response-plan", (risk) => responsePlanLabel(risk.PlanRespuesta)],
        ["Impacto", "impact", (risk) => text(risk.Impacto)],
        ["Probabilidad", "probability", (risk) => text(risk.Probabilidad)],
        ["Nivel", "level", (risk) => riskLevelLabel(risk.NivelRiesgo)],
        ["Impacto en Plazo", "schedule", (risk) => signedWeeks(risk.ImpactoPlazoSemanas)],
        ["Impacto en Costo", "cost", (risk) => currencyFull(risk.ImpactoCosto)],
        ["Cantidad", "quantity", (risk) => integer(risk.CantidadRiesgos)]
    ];
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    columns.forEach(([label, className]) => headRow.appendChild(createElement("th", `evm-risk-detail-col-${className}`, label)));
    head.appendChild(headRow);
    const body = document.createElement("tbody");
    orderRisksBySeverity(details).forEach((risk) => {
        const row = document.createElement("tr");
        columns.forEach(([label, className, getValue]) => {
            const levelClass = label === "Nivel" ? ` evm-risk-detail-level ${riskClass(risk.NivelRiesgo)}` : "";
            const cell = createElement("td", `evm-risk-detail-col-${className}${levelClass}`, getValue(risk));
            row.appendChild(cell);
        });
        body.appendChild(row);
    });
    const totals = riskTotals(details);
    const totalRow = document.createElement("tr");
    totalRow.className = "evm-risk-detail-total-row";
    columns.forEach(([label, className], index) => {
        const value = label === "Impacto en Plazo"
            ? signedWeeks(totals.scheduleImpact)
            : label === "Impacto en Costo"
                ? currencyFull(totals.costImpact)
                : label === "Cantidad"
                    ? integer(totals.quantity)
                    : index === 0 ? "TOTAL" : "";
        totalRow.appendChild(createElement("td", `evm-risk-detail-col-${className}`, value));
    });
    body.appendChild(totalRow);
    table.append(head, body);
    wrap.appendChild(table);
    return wrap;
}

function detailsForRisk(risk: RiskItem): RiskItem[] {
    return risk.Details?.length ? risk.Details : (numberValue(risk.CantidadRiesgos) === 0 ? [] : [risk]);
}

function orderRisksBySeverity(risks: RiskItem[]): RiskItem[] {
    const severityRank = (risk: RiskItem): number => {
        const level = riskClass(risk.NivelRiesgo);
        if (level === "high") {
            return 0;
        }
        if (level === "medium") {
            return 1;
        }
        if (level === "low") {
            return 2;
        }
        return 3;
    };
    return [...risks].sort((left, right) => severityRank(left) - severityRank(right));
}

function responsePlanLabel(value?: string): string {
    const clean = text(value, "").trim();
    if (!clean) {
        return "No";
    }
    const normalized = clean.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (["no", "false", "0"].includes(normalized)) {
        return "No";
    }
    if (["si", "true", "1"].includes(normalized)) {
        return "Sí";
    }
    return clean;
}

function formatRiskDate(value: DataValue): string {
    if (value === null || value === undefined || value === "") {
        return text(value);
    }
    const raw = String(value);
    const datePart = raw.includes("T") ? raw.split("T")[0] : raw.split(" ")[0];
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(datePart);
    if (isoMatch) {
        return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        const day = String(parsed.getDate()).padStart(2, "0");
        const month = String(parsed.getMonth() + 1).padStart(2, "0");
        return `${day}/${month}/${parsed.getFullYear()}`;
    }
    return raw;
}

function renderRiskLegend(): HTMLElement {
    const legend = createElement("div", "evm-risk-legend");
    legend.appendChild(createElement("div", "evm-risk-legend-title", "Leyenda"));
    const grid = createElement("div", "evm-risk-legend-grid");
    [
        ["low", "Impacto menor"],
        ["medium", "Impacto moderado"],
        ["high", "Impacto significativo"]
    ].forEach(([className, label]) => {
        const item = createElement("span", `evm-risk-legend-item ${className}`);
        item.appendChild(createElement("i", `evm-risk-dot ${className}`));
        item.appendChild(document.createTextNode(label));
        grid.appendChild(item);
    });
    legend.appendChild(grid);
    return legend;
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

function completeRiskLevels(risks: RiskItem[]): RiskItem[] {
    if (!risks.length) {
        return risks;
    }
    const levels = [
        { className: "low", label: "Bajo" },
        { className: "medium", label: "Medio" },
        { className: "high", label: "Alto" }
    ];
    const completed = [...risks];
    levels.forEach(({ className, label }) => {
        if (!completed.some((risk) => riskClass(risk.NivelRiesgo) === className)) {
            completed.push({
                NivelRiesgo: label,
                CantidadRiesgos: 0,
                PorcentajeRiesgos: 0,
                ImpactoPlazoSemanas: 0,
                ImpactoCosto: 0
            });
        }
    });
    return orderRisks(completed);
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

function riskLevelLabel(level?: string): string {
    const itemClass = riskClass(level);
    if (itemClass === "low") {
        return "Bajo";
    }
    if (itemClass === "medium") {
        return "Medio";
    }
    if (itemClass === "high") {
        return "Alto";
    }
    return text(level);
}

function integer(value: DataValue): string {
    const numeric = numberValue(value);
    return numeric === null ? "0" : numeric.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function riskPercent(risk: RiskItem, totalQuantity: number): string {
    const supplied = numberValue(risk.PorcentajeRiesgos);
    if (supplied !== null) {
        return percent(supplied);
    }
    const quantity = numberValue(risk.CantidadRiesgos);
    return quantity === null || totalQuantity === 0 ? "—" : percent(quantity / totalQuantity);
}

function signedWeeks(value: DataValue): string {
    const numeric = numberValue(value);
    if (numeric === null) {
        return "—";
    }
    const sign = numeric > 0 ? "+" : "";
    return `${sign}${numeric.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} sem.`;
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
