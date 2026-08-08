"use strict";

import { RiskDashboardData, RiskDashboardRow } from "../types";

const NS = "http://www.w3.org/2000/svg";
const colors = { low: "#22A559", medium: "#E9A300", high: "#D92D20", blue: "#1769E8", navy: "#001B8E", gray: "#98A2B3" };

export function renderRiskDashboard(data: RiskDashboardData | null): HTMLElement {
    const main = el("main", "evm-main evm-main--risk-dashboard");
    main.appendChild(el("h1", "evm-risk-dashboard-title", "TABLERO DE RIESGOS"));
    if (!data) {
        main.appendChild(el("div", "evm-risk-dashboard-empty", "No se recibió información del tablero de riesgos."));
        return main;
    }

    main.appendChild(renderKpis(data.summary[0] ?? {}));
    const row2 = el("section", "evm-risk-dashboard-row2");
    row2.append(renderLine(data.evolution), renderHorizontalBars(data.categories));
    main.appendChild(row2);
    const row3 = el("section", "evm-risk-dashboard-row3");
    const center = el("div", "evm-risk-dashboard-center-charts");
    center.append(renderVerticalBars(data.units, "RIESGOS POR UNIDAD GERENCIAL"), renderVerticalBars(data.responsible, "RIESGOS POR RESPONSABLE"));
    row3.append(renderHeatmap(data), center, renderDonut(data.response));
    main.appendChild(row3);
    return main;
}

function renderKpis(row: RiskDashboardRow): HTMLElement {
    const wrap = el("section", "evm-risk-dashboard-kpis");
    const total = num(get(row, ["RiesgosTotales", "TotalRiesgos", "Total"]));
    const items: Array<[string, string[], string, string]> = [
        ["RIESGOS TOTALES", ["RiesgosTotales", "TotalRiesgos", "Total"], "blue", "♢"],
        ["RIESGOS ALTOS", ["RiesgosAltos", "Alto", "Altos"], "high", "△"],
        ["RIESGOS MEDIOS", ["RiesgosMedios", "Medio", "Medios"], "medium", "!"],
        ["RIESGOS BAJOS", ["RiesgosBajos", "Bajo", "Bajos"], "low", "✓"],
        ["RIESGOS MATERIALIZADOS", ["RiesgosMaterializados", "Materializados"], "materialized", "▥"],
        ["ESTADO GENERAL", ["EstadoGeneral", "Estado", "NivelGeneral"], "status", "▲"]
    ];
    items.forEach(([label, keys, tone, icon], index) => {
        const card = el("article", `evm-risk-kpi ${tone}`);
        const value = get(row, keys);
        card.title = `${label}: ${display(value)}`;
        const iconNode = el("span", "evm-risk-kpi-icon", icon);
        const copy = el("div", "evm-risk-kpi-copy");
        copy.append(el("span", "evm-risk-kpi-label", label), el("strong", "", display(value)));
        const numeric = num(value);
        const footer = index === 0 ? "100% del total" : index === 5 ? display(get(row, ["Mensaje", "Atencion", "Descripción"])) : `${formatPct(total ? numeric / total : 0)} del total`;
        copy.appendChild(el("small", "", footer === "—" ? "Atención requerida" : footer));
        card.append(iconNode, copy);
        wrap.appendChild(card);
    });
    return wrap;
}

function renderLine(rows: RiskDashboardRow[]): HTMLElement {
    const card = chartCard("EVOLUCIÓN DEL RIESGO");
    const svg = svgEl("svg", { viewBox: "0 0 800 300", role: "img", "aria-label": "Evolución del riesgo" });
    const series = [
        { keys: ["Bajo", "RiesgoBajo", "RiesgosBajos", "CantidadBajo", "CantidadRiesgoBajo"], term: "bajo", color: colors.low, label: "Bajo" },
        { keys: ["Medio", "RiesgoMedio", "RiesgosMedios", "CantidadMedio", "CantidadRiesgoMedio"], term: "medio", color: colors.medium, label: "Medio" },
        { keys: ["Alto", "RiesgoAlto", "RiesgosAltos", "CantidadAlto", "CantidadRiesgoAlto"], term: "alto", color: colors.high, label: "Alto" }
    ];
    const seriesValue = (row: RiskDashboardRow, keys: string[], term: string): unknown => get(row, keys) ?? semantic(row, [term], true);
    const values = rows.flatMap(r => series.map(s => num(seriesValue(r, s.keys, s.term))));
    const rawMax = Math.max(1, ...values);
    const step = rawMax <= 10 ? 2 : rawMax <= 30 ? 5 : rawMax <= 60 ? 10 : Math.ceil(rawMax / 5 / 10) * 10;
    const max = Math.max(step, Math.ceil(rawMax / step) * step);
    const plot = { x: 54, y: 48, width: 724, height: 188 };
    for (let tick = 0; tick <= max; tick += step) {
        const y = plot.y + plot.height - tick / max * plot.height;
        svg.appendChild(svgEl("line", { x1: plot.x, y1: y, x2: plot.x + plot.width, y2: y, stroke: "#DCE4EF", "stroke-width": "1" }));
        const tickLabel = svgEl("text", { x: plot.x - 12, y: y + 4, "text-anchor": "end", class: "axis-tick" }); tickLabel.textContent = String(tick); svg.appendChild(tickLabel);
    }
    series.forEach((s, seriesIndex) => {
        const points = rows.map((r, i) => ({ x: plot.x + (rows.length < 2 ? plot.width / 2 : i * plot.width / (rows.length - 1)), y: plot.y + plot.height - num(seriesValue(r, s.keys, s.term)) * plot.height / max, row: r }));
        svg.appendChild(svgEl("polyline", { points: points.map(p => `${p.x},${p.y}`).join(" "), fill: "none", stroke: s.color, "stroke-width": "3" }));
        points.forEach((p, i) => {
            const dot = svgEl("circle", { cx: p.x, cy: p.y, r: "4.5", fill: s.color, stroke: "#fff", "stroke-width": "1.2", tabindex: "0" });
            title(dot, `${label(p.row, i)} · ${s.label}: ${display(seriesValue(p.row, s.keys, s.term))}`);
            svg.appendChild(dot);
            const labelOffset = seriesIndex === 0 ? 15 : seriesIndex === 1 ? -9 : -10;
            const valueLabel = svgEl("text", { x: p.x, y: p.y + labelOffset, "text-anchor": "middle", class: "point-label", fill: "#00145C" });
            valueLabel.textContent = display(seriesValue(p.row, s.keys, s.term)); svg.appendChild(valueLabel);
        });
    });
    renderEvolutionLegend(svg, series.map(s => [s.label, s.color]));
    renderPeriodAxis(svg, rows, plot.x, plot.y + plot.height, plot.width);
    card.appendChild(svg);
    return card;
}

function renderHorizontalBars(rows: RiskDashboardRow[]): HTMLElement {
    const card = chartCard("DISTRIBUCIÓN POR CATEGORÍA");
    const list = el("div", "evm-risk-hbars");
    const values = rows.map(r => num(get(r, ["Cantidad", "Total", "Riesgos", "Valor"])));
    const total = values.reduce((a, b) => a + b, 0);
    const max = Math.max(1, ...values);
    rows.forEach((row, i) => {
        const value = values[i];
        const pctRaw = get(row, ["Porcentaje", "Pct", "PorcentajeRiesgos"]);
        const pct = pctRaw === undefined || pctRaw === null ? (total ? value / total : 0) : percentage(pctRaw);
        const item = el("div", "evm-risk-hbar");
        item.title = `${label(row, i)}: ${display(value)} (${formatPct(pct)})`;
        item.append(el("span", "", label(row, i)));
        const track = el("div", "evm-risk-hbar-track");
        const fill = el("i", ""); fill.style.width = `${value / max * 100}%`; track.appendChild(fill);
        item.append(track, el("strong", "", `${display(value)} · ${formatPct(pct)}`));
        list.appendChild(item);
    });
    card.appendChild(list);
    return card;
}

function renderHeatmap(data: RiskDashboardData): HTMLElement {
    const card = chartCard("MAPA DE CALOR DE RIESGOS (Probabilidad vs Impacto)", "evm-risk-heatmap-card");
    const body = el("div", "evm-risk-heatmap-body");
    const svg = svgEl("svg", { viewBox: "0 0 520 330", role: "img", "aria-label": "Mapa de calor de probabilidad e impacto" });
    const defs = svgEl("defs", {}); const gradient = svgEl("linearGradient", { id: "evm-risk-heat-gradient", x1: "0", y1: "1", x2: "0", y2: "0" });
    [["0%", "#6BCB3C"], ["45%", "#FFF100"], ["72%", "#FF8A00"], ["100%", "#F32020"]].forEach(([offset, color]) => gradient.appendChild(svgEl("stop", { offset, "stop-color": color })));
    defs.appendChild(gradient); svg.appendChild(defs);
    const x0 = 48, y0 = 14, width = 445, height = 270, cellX = width / 5, cellY = height / 5;
    svg.appendChild(svgEl("rect", { x: x0, y: y0, width, height, fill: "url(#evm-risk-heat-gradient)" }));
    for (let i = 0; i <= 5; i++) { svg.appendChild(svgEl("line", { x1: x0 + i * cellX, y1: y0, x2: x0 + i * cellX, y2: y0 + height, stroke: "#ffffff55" })); svg.appendChild(svgEl("line", { x1: x0, y1: y0 + i * cellY, x2: x0 + width, y2: y0 + i * cellY, stroke: "#ffffff55" })); }
    data.heatmap.forEach((row, i) => {
        const probability = clamp(num(get(row, ["Probabilidad", "Probability", "P"])), 1, 5);
        const impact = clamp(num(get(row, ["Impacto", "Impact", "I"])), 1, 5);
        const count = num(get(row, ["Cantidad", "Total", "Riesgos", "Valor"])) || 1;
        const point = svgEl("circle", { cx: x0 + (probability - .5) * cellX, cy: y0 + (5.5 - impact) * cellY, r: Math.min(11, 3 + Math.sqrt(count)), fill: "#0046A8", stroke: "#fff", "stroke-width": "1", opacity: ".92", tabindex: "0" });
        title(point, `${label(row, i)} · Probabilidad ${probability}, Impacto ${impact}, Cantidad ${count}`);
        svg.appendChild(point);
    });
    const xt = svgEl("text", { x: x0 + width / 2, y: 320, "text-anchor": "middle", class: "axis-title" }); xt.textContent = "PROBABILIDAD"; svg.appendChild(xt);
    const yt = svgEl("text", { x: 14, y: y0 + height / 2, transform: `rotate(-90 14 ${y0 + height / 2})`, "text-anchor": "middle", class: "axis-title" }); yt.textContent = "IMPACTO"; svg.appendChild(yt);
    body.appendChild(svg);
    const stats = el("div", "evm-risk-levels");
    const summary = data.summary[0] ?? {};
    const total = num(get(summary, ["RiesgosTotales", "TotalRiesgos", "Total"]));
    [["Alto", "high"], ["Medio", "medium"], ["Bajo", "low"]].forEach(([name, tone]) => {
        const value = num(get(summary, [`Riesgos${name}s`, name, `${name}s`]));
        stats.appendChild(el("span", tone, `${name}: ${display(value)} · ${formatPct(total ? value / total : 0)}`));
    });
    stats.appendChild(el("strong", "", `Exposición total: ${display(get(summary, ["ExposicionTotal", "ExposiciónTotal", "Exposicion"]))}`));
    body.appendChild(stats); card.appendChild(body);
    return card;
}

function renderVerticalBars(rows: RiskDashboardRow[], heading: string): HTMLElement {
    const card = chartCard(heading, "evm-risk-vbar-card");
    const plot = el("div", "evm-risk-vbars");
    const values = rows.map(r => num(get(r, ["Cantidad", "Total", "Riesgos", "Valor"])));
    const max = Math.max(1, ...values);
    rows.forEach((row, i) => {
        const item = el("div", "evm-risk-vbar"); item.title = `${label(row, i)}: ${display(values[i])}`;
        const bar = el("i", ""); bar.style.height = `${values[i] / max * 100}%`;
        item.append(el("strong", "", display(values[i])), bar, el("span", "", label(row, i)));
        plot.appendChild(item);
    });
    card.appendChild(plot);
    return card;
}

function renderDonut(rows: RiskDashboardRow[]): HTMLElement {
    const card = chartCard("ESTADO DEL PLAN DE RESPUESTA", "evm-risk-donut-card");
    const values = rows.map(r => num(get(r, ["Cantidad", "Total", "Riesgos", "Valor"])));
    const total = values.reduce((a, b) => a + b, 0);
    const palette = rows.map((row, index) => responseColor(responseLabel(row, index), index));
    const svg = svgEl("svg", { viewBox: "0 0 240 240", role: "img", "aria-label": "Estado del plan de respuesta" });
    let offset = 0;
    rows.forEach((row, i) => {
        const pct = total ? values[i] / total : 0;
        const circle = svgEl("circle", { cx: "120", cy: "120", r: "76", fill: "none", stroke: palette[i], "stroke-width": "34", "stroke-dasharray": `${pct * 477.5} 477.5`, "stroke-dashoffset": `${-offset * 477.5}`, transform: "rotate(-90 120 120)", tabindex: "0" });
        title(circle, `${responseLabel(row, i)}: ${display(values[i])} (${formatPct(pct)})`); svg.appendChild(circle); offset += pct;
    });
    const center = svgEl("text", { x: "120", y: "126", "text-anchor": "middle", class: "donut-total" }); center.textContent = display(total); svg.appendChild(center);
    card.append(svg, legend(rows.map((r, i) => [`${responseLabel(r, i)} · ${display(values[i])} (${formatPct(total ? values[i] / total : 0)})`, palette[i]])));
    return card;
}

function chartCard(heading: string, extra = ""): HTMLElement { const card = el("article", `evm-risk-chart-card ${extra}`); card.appendChild(el("h2", "", heading)); return card; }
function legend(items: string[][]): HTMLElement { const node = el("div", "evm-risk-chart-legend"); items.forEach(([name, color]) => { const item = el("span", "", name); const dot = el("i", ""); dot.style.background = color; item.prepend(dot); node.appendChild(item); }); return node; }
function renderEvolutionLegend(svg: SVGElement, items: string[][]): void {
    let x = 62;
    items.forEach(([name, color]) => {
        svg.appendChild(svgEl("line", { x1: x, y1: 23, x2: x + 20, y2: 23, stroke: color, "stroke-width": "2.5" }));
        svg.appendChild(svgEl("circle", { cx: x + 10, cy: 23, r: "3.5", fill: color }));
        const textNode = svgEl("text", { x: x + 27, y: 27, class: "evolution-legend-label" }); textNode.textContent = `Riesgo ${name}`; svg.appendChild(textNode);
        x += 125;
    });
}
function renderPeriodAxis(svg: SVGElement, rows: RiskDashboardRow[], x: number, y: number, width: number): void {
    const periods = rows.map((row, index) => periodParts(row, index));
    const pointX = (index: number): number => x + (rows.length < 2 ? width / 2 : index * width / (rows.length - 1));
    periods.forEach((period, index) => {
        const month = svgEl("text", { x: pointX(index), y: y + 24, "text-anchor": "middle", class: "axis-label evolution-month" });
        month.textContent = period.month; svg.appendChild(month);
    });
    let start = 0;
    while (start < periods.length) {
        const year = periods[start].year;
        let end = start;
        while (end + 1 < periods.length && periods[end + 1].year === year) end += 1;
        if (year) {
            if (start > 0) svg.appendChild(svgEl("line", { x1: (pointX(start - 1) + pointX(start)) / 2, y1: y + 7, x2: (pointX(start - 1) + pointX(start)) / 2, y2: y + 52, stroke: "#9AA9BE", "stroke-dasharray": "3 3" }));
            const yearLabel = svgEl("text", { x: (pointX(start) + pointX(end)) / 2, y: y + 45, "text-anchor": "middle", class: "evolution-year" });
            yearLabel.textContent = year; svg.appendChild(yearLabel);
        }
        start = end + 1;
    }
}
function periodParts(row: RiskDashboardRow, index: number): { month: string; year: string } {
    const rawPeriod = String(get(row, ["Periodo", "Período", "Fecha", "MesAnio", "MesAño", "Mes", "LabelPeriodo", "Etiqueta"]) ?? "").trim();
    const rawYear = String(get(row, ["Anio", "Año", "Year", "Ejercicio"]) ?? "").trim();
    const normalized = norm(rawPeriod);
    const monthNames: Array<[string[], string]> = [
        [["enero", "ene", "january", "jan"], "Ene"], [["febrero", "feb", "february"], "Feb"],
        [["marzo", "mar", "march"], "Mar"], [["abril", "abr", "april", "apr"], "Abr"],
        [["mayo", "may"], "May"], [["junio", "jun", "june"], "Jun"], [["julio", "jul", "july"], "Jul"],
        [["agosto", "ago", "august", "aug"], "Ago"], [["septiembre", "setiembre", "sep", "set"], "Sep"],
        [["octubre", "oct", "october"], "Oct"], [["noviembre", "nov", "november"], "Nov"],
        [["diciembre", "dic", "december", "dec"], "Dic"]
    ];
    let month = monthNames.find(([aliases]) => aliases.some(alias => normalized.includes(alias)))?.[1] ?? "";
    const isoMatch = rawPeriod.match(/(20\d{2})[-/]([01]?\d)/);
    if (!month && isoMatch) month = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][Number(isoMatch[2])] ?? "";
    const yearMatch = rawPeriod.match(/(?:19|20)\d{2}/);
    return { month: month || rawPeriod || String(index + 1), year: rawYear || yearMatch?.[0] || "" };
}
function label(row: RiskDashboardRow, index: number): string { return display(get(row, ["Categoria", "Categoría", "UnidadGerencial", "Unidad", "Responsable", "Estado", "Periodo", "Fecha", "Mes", "Nombre", "Etiqueta"])) || `${index + 1}`; }
function responseLabel(row: RiskDashboardRow, index: number): string {
    const known = get(row, ["EstadoPlanRespuesta", "EstadoPlan", "EstadoRespuesta", "PlanRespuesta", "Estado", "Respuesta"]);
    if (known !== undefined && known !== null && String(known).trim()) return String(known);
    const semanticState = semantic(row, ["estado", "plan"], false) ?? semantic(row, ["respuesta"], false);
    if (semanticState !== undefined && semanticState !== null && String(semanticState).trim()) return String(semanticState);
    const firstText = Object.values(row).find(value => typeof value === "string" && value.trim() !== "" && !Number.isFinite(Number(value)));
    return firstText === undefined ? `Estado ${index + 1}` : String(firstText);
}
function responseColor(value: string, index: number): string {
    const normalized = norm(value);
    if (normalized.includes("sinplan") || normalized.includes("sinrespuesta")) return colors.high;
    if (normalized.includes("proceso")) return colors.medium;
    if (normalized.includes("implementado") || normalized.includes("conplan")) return colors.low;
    return [colors.high, colors.medium, colors.low, colors.blue, colors.gray][index % 5];
}
function get(row: RiskDashboardRow, keys: string[]): unknown { const normalized = new Map(Object.keys(row).map(k => [norm(k), row[k]])); for (const key of keys) { const value = normalized.get(norm(key)); if (value !== undefined) return value; } return undefined; }
function semantic(row: RiskDashboardRow, terms: string[], numeric: boolean): unknown {
    const normalizedTerms = terms.map(norm);
    for (const [key, value] of Object.entries(row)) {
        const normalizedKey = norm(key);
        if (!normalizedTerms.every(term => normalizedKey.includes(term))) continue;
        if (!numeric || typeof value === "number" || Number.isFinite(Number(String(value).replace(",", ".")))) return value;
    }
    return undefined;
}
function norm(value: string): string { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase(); }
function num(value: unknown): number { if (typeof value === "number") return Number.isFinite(value) ? value : 0; const parsed = Number(String(value ?? "").replace(/%/g, "").replace(",", ".")); return Number.isFinite(parsed) ? parsed : 0; }
function percentage(value: unknown): number { const n = num(value); return Math.abs(n) > 1 ? n / 100 : n; }
function display(value: unknown): string { if (value === null || value === undefined || value === "") return "—"; return typeof value === "number" ? new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(value) : String(value); }
function formatPct(value: number): string { return new Intl.NumberFormat("es-PE", { style: "percent", maximumFractionDigits: 1 }).format(value); }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", content?: string): HTMLElementTagNameMap[K] { const node = document.createElement(tag); if (className) node.className = className; if (content !== undefined) node.textContent = content; return node; }
function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] { const node = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v))); return node; }
function title(node: SVGElement, value: string): void { const t = svgEl("title", {}); t.textContent = value; node.appendChild(t); }
