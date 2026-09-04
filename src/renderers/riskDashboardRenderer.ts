"use strict";

import { RiskDashboardData, RiskDashboardRow } from "../types";

const NS = "http://www.w3.org/2000/svg";
const colors = { low: "#22A559", medium: "#E9A300", high: "#D92D20", blue: "#1769E8", navy: "#001B8E", gray: "#98A2B3" };

export function renderRiskDashboard(data: RiskDashboardData | null, pageIndex = 0, _onPageChange?: (index: number) => void): HTMLElement {
    const main = el("main", "evm-main evm-main--risk-dashboard");
    const header = el("header", "evm-risk-dashboard-header");
    header.appendChild(el("h1", undefined, "TABLERO DE RIESGOS"));
    header.appendChild(el("p", undefined, "Sistema de Seguimiento, Monitoreo y Evaluación - SSME"));
    main.appendChild(header);
    if (!data) {
        main.appendChild(el("div", "evm-risk-dashboard-empty", "No se recibió información del tablero de riesgos."));
        return main;
    }

    const carousel = el("section", "evm-risk-carousel");
    const summaryPage = el("div", `evm-risk-carousel-page evm-risk-summary-page${pageIndex === 0 ? " active" : ""}`);
    const matrixPage = el("div", `evm-risk-carousel-page evm-risk-matrix-page${pageIndex === 1 ? " active" : ""}`);
    carousel.append(summaryPage, matrixPage);
    main.appendChild(carousel);
    mountRiskDashboardPage(main, pageIndex, data);
    return main;
}

export function mountRiskDashboardPage(main: HTMLElement, pageIndex: number, data: RiskDashboardData): void {
    const pages = Array.from(main.querySelectorAll<HTMLElement>(".evm-risk-carousel-page"));
    const page = pages[pageIndex];
    if (!page || page.dataset.mounted === "true") return;
    page.dataset.mounted = "true";
    if (pageIndex === 1) {
        page.appendChild(renderRiskDetail(data.detail));
        return;
    }
    page.appendChild(renderKpis(data.summary[0] ?? {}));
    const row2 = el("section", "evm-risk-dashboard-row2");
    row2.append(renderLine(data.evolution), renderHorizontalBars(data.categories));
    page.appendChild(row2);
    const row3 = el("section", "evm-risk-dashboard-row3");
    const center = el("div", "evm-risk-dashboard-center-charts");
    center.append(renderVerticalBars(data.units, "RIESGOS POR UNIDAD GERENCIAL"), renderVerticalBars(data.responsible, "RIESGOS POR RESPONSABLE"));
    row3.append(renderHeatmap(data), center, renderDonut(data.response));
    page.appendChild(row3);
}

function renderRiskDetail(rows: RiskDashboardRow[]): HTMLElement {
    const card = chartCard("REGISTRO DE RIESGOS DEL PORTAFOLIO", "evm-risk-detail-card");
    const columns = ["Unidad Gerencial", "Intervención / Proyecto", "Descripción del Riesgo", "Categoria", "Nivel de Riesgo", "Responsable"];
    const scroller = el("div", "evm-risk-detail-scroll");
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    columns.forEach(column => { const th = document.createElement("th"); th.textContent = column; headerRow.appendChild(th); });
    thead.appendChild(headerRow); table.appendChild(thead);
    const tbody = document.createElement("tbody");
    const riskLevelOrder: Record<string, number> = { alto: 0, medio: 1, bajo: 2 };
    const preparedRows = rows
        .map((row, originalIndex) => ({
            originalIndex,
            values: columns.map(column => display(get(row, [column])))
        }))
        .sort((a, b) => {
            const aPriority = riskLevelOrder[norm(a.values[4])] ?? 3;
            const bPriority = riskLevelOrder[norm(b.values[4])] ?? 3;
            return aPriority - bPriority || a.originalIndex - b.originalIndex;
        })
        .map(item => item.values);
    const populateRow = (tr: HTMLTableRowElement, values: string[]): void => {
        columns.forEach((column, index) => {
            const td = tr.cells[index] ?? document.createElement("td");
            const value = values[index];
            td.className = "";
            if (column === "Nivel de Riesgo") {
                const badge = td.firstElementChild instanceof HTMLSpanElement ? td.firstElementChild : el("span");
                badge.className = `evm-risk-level-badge evm-risk-level-badge--${norm(value)}`;
                badge.textContent = value;
                td.replaceChildren(badge);
                td.className = "evm-risk-detail-level";
            } else {
                td.textContent = value;
            }
            if (!td.parentElement) tr.appendChild(td);
        });
    };
    const appendRow = (values: string[]): void => {
        const tr = document.createElement("tr");
        populateRow(tr, values);
        tbody.appendChild(tr);
    };
    const threshold = 250;
    const rowHeight = 42;
    if (preparedRows.length <= threshold) {
        preparedRows.forEach(appendRow);
    } else {
        const overscan = 15;
        const visibleCount = Math.max(25, Math.ceil(scroller.clientHeight / rowHeight));
        const poolSize = Math.min(preparedRows.length, visibleCount + overscan * 2);
        const spacer = (): HTMLTableRowElement => {
            const tr = document.createElement("tr");
            tr.className = "evm-virtual-spacer-row";
            const td = document.createElement("td");
            td.colSpan = columns.length;
            tr.appendChild(td);
            return tr;
        };
        const topSpacer = spacer();
        const bottomSpacer = spacer();
        const pool = Array.from({ length: poolSize }, () => document.createElement("tr"));
        tbody.append(topSpacer, ...pool, bottomSpacer);
        const renderWindow = (): void => {
            const start = Math.max(0, Math.min(preparedRows.length - poolSize, Math.floor(scroller.scrollTop / rowHeight) - overscan));
            const end = Math.min(preparedRows.length, start + poolSize);
            topSpacer.cells[0].style.height = `${start * rowHeight}px`;
            bottomSpacer.cells[0].style.height = `${(preparedRows.length - end) * rowHeight}px`;
            pool.forEach((tr, index) => {
                const sourceIndex = start + index;
                tr.style.display = sourceIndex < end ? "" : "none";
                if (sourceIndex < end) populateRow(tr, preparedRows[sourceIndex]);
            });
        };
        renderWindow();
        let frame: number | null = null;
        scroller.addEventListener("scroll", () => {
            if (frame !== null) return;
            frame = requestAnimationFrame(() => { frame = null; renderWindow(); });
        }, { passive: true });
    }
    table.appendChild(tbody); scroller.appendChild(table); card.appendChild(scroller);
    return card;
}

function renderKpis(row: RiskDashboardRow): HTMLElement {
    const wrap = el("section", "evm-risk-dashboard-kpis");
    const total = num(get(row, ["RiesgosTotales", "TotalRiesgos", "Total"]));
    const items: Array<[string, string[], string]> = [
        ["RIESGOS TOTALES", ["RiesgosTotales", "TotalRiesgos", "Total"], "blue"],
        ["RIESGOS ALTOS", ["RiesgosAltos", "Alto", "Altos"], "high"],
        ["RIESGOS MEDIOS", ["RiesgosMedios", "Medio", "Medios"], "medium"],
        ["RIESGOS BAJOS", ["RiesgosBajos", "Bajo", "Bajos"], "low"]
    ];
    items.forEach(([label, keys, tone], index) => {
        const card = el("article", `evm-risk-kpi ${tone}`);
        const value = get(row, keys);
        card.title = `${label}: ${display(value)}`;
        const iconNode = el("span", "evm-risk-kpi-icon");
        iconNode.appendChild(riskKpiIcon(tone));
        const copy = el("div", "evm-risk-kpi-copy");
        const numeric = num(value);
        const percent = index === 0 ? "100%" : formatPct(total ? numeric / total : 0);
        const metric = el("strong", "evm-risk-kpi-metric");
        metric.append(
            el("span", "evm-risk-kpi-value", display(value)),
            el("span", "evm-risk-kpi-percent", `(${percent})`)
        );
        copy.append(
            el("span", "evm-risk-kpi-label", label),
            metric
        );
        card.append(iconNode, copy);
        wrap.appendChild(card);
    });
    return wrap;
}

function riskKpiIcon(tone: string): SVGSVGElement {
    const svg = svgEl("svg", { viewBox: "0 0 48 48", "aria-hidden": "true" });
    svg.classList.add("evm-risk-kpi-svg");
    if (tone === "blue") {
        svg.append(
            svgEl("path", { d: "M24 4 40 10v12c0 10.5-6.4 18-16 22-9.6-4-16-11.5-16-22V10L24 4Z", fill: "none", stroke: "#1653A5", "stroke-width": "4", "stroke-linejoin": "round" }),
            svgEl("path", { d: "m17 23 5 5 9-11", fill: "none", stroke: "#1653A5", "stroke-width": "4", "stroke-linecap": "round", "stroke-linejoin": "round" })
        );
    } else if (tone === "high") {
        svg.append(
            svgEl("path", { d: "M24 5 44 41H4L24 5Z", fill: "none", stroke: "#F21B1B", "stroke-width": "4", "stroke-linejoin": "round" }),
            svgEl("line", { x1: "24", y1: "17", x2: "24", y2: "29", stroke: "#F21B1B", "stroke-width": "4", "stroke-linecap": "round" }),
            svgEl("circle", { cx: "24", cy: "35", r: "2.3", fill: "#F21B1B" })
        );
    } else if (tone === "medium") {
        svg.append(
            svgEl("circle", { cx: "24", cy: "24", r: "20", fill: "#FFA000" }),
            svgEl("line", { x1: "24", y1: "13", x2: "24", y2: "28", stroke: "#FFFFFF", "stroke-width": "4", "stroke-linecap": "round" }),
            svgEl("circle", { cx: "24", cy: "35", r: "2.4", fill: "#FFFFFF" })
        );
    } else if (tone === "low") {
        svg.append(
            svgEl("circle", { cx: "24", cy: "24", r: "19", fill: "none", stroke: "#218838", "stroke-width": "4" }),
            svgEl("path", { d: "m15 24 6 6 12-14", fill: "none", stroke: "#218838", "stroke-width": "4", "stroke-linecap": "round", "stroke-linejoin": "round" })
        );
    } else {
        svg.append(
            svgEl("circle", { cx: "24", cy: "24", r: "21", fill: "#083D91" }),
            svgEl("rect", { x: "13", y: "25", width: "5", height: "11", rx: "2", fill: "#FFFFFF" }),
            svgEl("rect", { x: "22", y: "18", width: "5", height: "18", rx: "2", fill: "#FFFFFF" }),
            svgEl("rect", { x: "31", y: "12", width: "5", height: "24", rx: "2", fill: "#FFFFFF" })
        );
    }
    return svg;
}

function renderLine(rows: RiskDashboardRow[]): HTMLElement {
    const card = chartCard("EVOLUCIÓN DEL RIESGO", "evm-risk-evolution-card");
    const heading = card.querySelector("h2");
    const header = el("div", "evm-risk-evolution-header");
    if (heading) header.appendChild(heading);
    const legend = el("div", "evm-risk-evolution-legend");
    [["Riesgo Bajo", colors.low], ["Riesgo Medio", colors.medium], ["Riesgo Alto", colors.high]].forEach(([name, color]) => {
        const item = el("span", "", name);
        const marker = el("i", "");
        marker.style.color = color;
        item.prepend(marker);
        legend.appendChild(item);
    });
    header.appendChild(legend);
    card.appendChild(header);
    const svg = svgEl("svg", { viewBox: "0 0 800 340", role: "img", "aria-label": "Evolución del riesgo" });
    const series = [
        { keys: ["Bajo", "RiesgoBajo", "RiesgosBajos", "CantidadBajo", "CantidadRiesgoBajo"], term: "bajo", color: colors.low, label: "Bajo" },
        { keys: ["Medio", "RiesgoMedio", "RiesgosMedios", "CantidadMedio", "CantidadRiesgoMedio"], term: "medio", color: colors.medium, label: "Medio" },
        { keys: ["Alto", "RiesgoAlto", "RiesgosAltos", "CantidadAlto", "CantidadRiesgoAlto"], term: "alto", color: colors.high, label: "Alto" }
    ];
    const seriesValue = (row: RiskDashboardRow, keys: string[], term: string): unknown => get(row, keys) ?? semantic(row, [term], true);
    const values = rows.flatMap(r => series.map(s => num(seriesValue(r, s.keys, s.term)))).filter(value => value > 0);
    const rawMax = Math.max(1, ...values);
    const step = rawMax <= 10 ? 2 : rawMax <= 30 ? 5 : rawMax <= 60 ? 10 : Math.ceil(rawMax / 5 / 10) * 10;
    const roundedMax = Math.ceil(rawMax / step) * step;
    const max = Math.max(step, roundedMax + (rawMax === roundedMax ? step : 0));
    const plot = { x: 48, y: 24, width: 704, height: 255 };
    const horizontalInset = 24;
    const seriesX = plot.x + horizontalInset;
    const seriesWidth = plot.width - horizontalInset * 2;
    for (let tick = 0; tick <= max; tick += step) {
        const y = plot.y + plot.height - tick / max * plot.height;
        svg.appendChild(svgEl("line", { x1: plot.x, y1: y, x2: plot.x + plot.width, y2: y, stroke: "#DCE4EF", "stroke-width": "1" }));
        const tickLabel = svgEl("text", { x: plot.x - 12, y: y + 4, "text-anchor": "end", class: "axis-tick" }); tickLabel.textContent = String(tick); svg.appendChild(tickLabel);
    }
    svg.appendChild(svgEl("line", { x1: plot.x, y1: plot.y, x2: plot.x, y2: plot.y + plot.height, class: "evolution-axis" }));
    svg.appendChild(svgEl("line", { x1: plot.x, y1: plot.y + plot.height, x2: plot.x + plot.width, y2: plot.y + plot.height, class: "evolution-axis" }));
    const labelPositions: number[][] = series.map(() => []);
    rows.forEach((row, rowIndex) => {
        const candidates = series.map((item, seriesIndex) => {
            const rawValue = seriesValue(row, item.keys, item.term);
            const value = num(rawValue);
            return {
                seriesIndex,
                visible: rawValue !== null && rawValue !== undefined && rawValue !== "" && value > 0,
                y: plot.y + plot.height - value * plot.height / max
            };
        }).filter(candidate => candidate.visible).sort((a, b) => a.y - b.y);
        const occupied: number[] = [];
        candidates.forEach(candidate => {
            const options = [candidate.y - 14, candidate.y + 20, candidate.y - 30, candidate.y + 36];
            const selected = options.find(option => (
                option >= plot.y + 10 && option <= plot.y + plot.height - 7 && occupied.every(position => Math.abs(position - option) >= 17)
            )) ?? candidate.y - 14;
            labelPositions[candidate.seriesIndex][rowIndex] = selected;
            occupied.push(selected);
        });
    });
    series.forEach((s, seriesIndex) => {
        const points = rows.map((row, index) => {
            const rawValue = seriesValue(row, s.keys, s.term);
            const value = num(rawValue);
            return {
                x: seriesX + (rows.length < 2 ? seriesWidth / 2 : index * seriesWidth / (rows.length - 1)),
                y: plot.y + plot.height - value * plot.height / max,
                row,
                index,
                rawValue,
                value,
                visible: rawValue !== null && rawValue !== undefined && rawValue !== "" && value > 0
            };
        });
        let segment: typeof points = [];
        const drawSegment = (): void => {
            if (segment.length > 1) {
                svg.appendChild(svgEl("path", { d: smoothLinePath(segment), fill: "none", stroke: s.color, "stroke-width": "3", "stroke-linejoin": "round", "stroke-linecap": "round" }));
            }
            segment = [];
        };
        points.forEach(point => {
            if (point.visible) segment.push(point);
            else drawSegment();
        });
        drawSegment();
        points.filter(point => point.visible).forEach(p => {
            const dot = svgEl("circle", { cx: p.x, cy: p.y, r: "5.5", fill: s.color, stroke: "#fff", "stroke-width": "1.2", tabindex: "0" });
            dot.setAttribute("aria-label", `${label(p.row, p.index)} · ${s.label}: ${display(p.rawValue)}`);
            svg.appendChild(dot);
            const valueLabel = svgEl("text", { x: p.x, y: labelPositions[seriesIndex][p.index] ?? p.y - 14, "text-anchor": "middle", class: "point-label", fill: "#00145C" });
            valueLabel.textContent = display(p.rawValue); svg.appendChild(valueLabel);
        });
    });
    renderPeriodAxis(svg, rows, seriesX, plot.y + plot.height, seriesWidth);
    const guide = svgEl("line", { y1: plot.y, y2: plot.y + plot.height, class: "evm-risk-evolution-guide" });
    svg.appendChild(guide);
    const tooltip = el("div", "evm-risk-evolution-tooltip");
    let pendingFrame: number | null = null;
    let pendingEvent: MouseEvent | null = null;
    let lastIndex = -1;
    const updateTooltip = (event: MouseEvent): void => {
        if (!rows.length) return;
        const bounds = svg.getBoundingClientRect();
        const svgX = (event.clientX - bounds.left) * 800 / bounds.width;
        if (svgX < plot.x || svgX > plot.x + plot.width) {
            tooltip.classList.remove("visible"); guide.classList.remove("visible"); return;
        }
        const index = rows.length < 2 ? 0 : Math.max(0, Math.min(rows.length - 1, Math.round((svgX - seriesX) / seriesWidth * (rows.length - 1))));
        const selectedX = seriesX + (rows.length < 2 ? seriesWidth / 2 : index * seriesWidth / (rows.length - 1));
        guide.setAttribute("x1", String(selectedX)); guide.setAttribute("x2", String(selectedX)); guide.classList.add("visible");
        if (index !== lastIndex) {
            lastIndex = index;
            const period = periodParts(rows[index], index);
            tooltip.replaceChildren(el("strong", "", `${period.month}${period.year ? ` ${period.year}` : ""}`));
            let total = 0;
            let hasRiskValues = false;
            series.forEach(item => {
                const value = seriesValue(rows[index], item.keys, item.term);
                if (value !== null && value !== undefined && value !== "") {
                    total += num(value);
                    hasRiskValues = true;
                }
                const line = el("div", "evm-risk-evolution-tooltip-row");
                const name = el("span", "", `Riesgo ${item.label}`);
                const marker = el("i", ""); marker.style.background = item.color; name.prepend(marker);
                line.append(name, el("b", "", value === null || value === undefined || value === "" || num(value) <= 0 ? "—" : display(value)));
                tooltip.appendChild(line);
            });
            const totalLine = el("div", "evm-risk-evolution-tooltip-row total");
            totalLine.append(el("span", "", "Total de riesgos"), el("b", "", hasRiskValues ? display(total) : "—"));
            tooltip.appendChild(totalLine);
        }
        const cardBounds = card.getBoundingClientRect();
        const localX = event.clientX - cardBounds.left;
        tooltip.style.left = `${localX > cardBounds.width * .64 ? localX - 250 : localX + 16}px`;
        tooltip.style.top = `${Math.max(42, event.clientY - cardBounds.top - 38)}px`;
        tooltip.classList.add("visible");
    };
    svg.addEventListener("mousemove", (event: MouseEvent) => {
        pendingEvent = event;
        if (pendingFrame !== null) return;
        pendingFrame = requestAnimationFrame(() => {
            pendingFrame = null;
            if (pendingEvent) updateTooltip(pendingEvent);
        });
    });
    svg.addEventListener("mouseleave", () => { pendingEvent = null; lastIndex = -1; tooltip.classList.remove("visible"); guide.classList.remove("visible"); });
    card.append(svg, tooltip);
    return card;
}

function smoothLinePath(points: Array<{ x: number; y: number }>): string {
    if (points.length < 2) return "";
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let index = 0; index < points.length - 1; index += 1) {
        const previous = points[Math.max(0, index - 1)];
        const current = points[index];
        const next = points[index + 1];
        const following = points[Math.min(points.length - 1, index + 2)];
        const control1X = current.x + (next.x - previous.x) / 6;
        const control1Y = current.y + (next.y - previous.y) / 6;
        const control2X = next.x - (following.x - current.x) / 6;
        const control2Y = next.y - (following.y - current.y) / 6;
        path += ` C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${next.x} ${next.y}`;
    }
    return path;
}

function renderHorizontalBars(rows: RiskDashboardRow[]): HTMLElement {
    const card = chartCard("DISTRIBUCIÓN POR CATEGORÍA", "evm-risk-category-card");
    const list = el("div", "evm-risk-hbars");
    const items = rows
        .map((row, index) => ({ row, index, value: num(get(row, ["Cantidad", "Total", "Riesgos", "Valor"])) }))
        .sort((a, b) => b.value - a.value || a.index - b.index);
    const total = items.reduce((sum, item) => sum + item.value, 0);
    const max = Math.max(1, ...items.map(item => item.value));
    items.forEach(({ row, index, value }) => {
        const pctRaw = get(row, ["Porcentaje", "Pct", "PorcentajeRiesgos"]);
        const pct = pctRaw === undefined || pctRaw === null ? (total ? value / total : 0) : percentage(pctRaw);
        const item = el("div", "evm-risk-hbar");
        item.title = `${label(row, index)}: ${display(value)} (${formatPct(pct)})`;
        item.append(el("span", "", label(row, index)));
        const track = el("div", "evm-risk-hbar-track");
        const fillPct = value / max * 100;
        const fill = el("i", ""); fill.style.width = `${fillPct}%`;
        const valueLabel = el("strong", "evm-risk-hbar-value", `${display(value)}   (${formatPct(pct)})`);
        valueLabel.style.left = `${fillPct}%`;
        track.append(fill, valueLabel);
        item.append(track);
        list.appendChild(item);
    });
    card.appendChild(list);
    return card;
}

function renderHeatmap(data: RiskDashboardData): HTMLElement {
    const card = chartCard("MAPA DE CALOR DE RIESGOS (Probabilidad vs Impacto)", "evm-risk-heatmap-card");
    const body = el("div", "evm-risk-heatmap-body");
    const tooltip = el("div", "evm-risk-point-tooltip");
    const svg = svgEl("svg", { viewBox: "0 0 520 330", role: "img", "aria-label": "Mapa de calor de probabilidad e impacto" });
    const defs = svgEl("defs", {}); const gradient = svgEl("linearGradient", { id: "evm-risk-heat-gradient", x1: "0", y1: "1", x2: "0", y2: "0" });
    [["0%", "#6BCB3C"], ["45%", "#FFF100"], ["72%", "#FF8A00"], ["100%", "#F32020"]].forEach(([offset, color]) => gradient.appendChild(svgEl("stop", { offset, "stop-color": color })));
    defs.appendChild(gradient); svg.appendChild(defs);
    const x0 = 48, y0 = 14, width = 445, height = 270, cellX = width / 5, cellY = height / 5;
    svg.appendChild(svgEl("rect", { x: x0, y: y0, width, height, fill: "url(#evm-risk-heat-gradient)" }));
    for (let i = 0; i <= 5; i++) { svg.appendChild(svgEl("line", { x1: x0 + i * cellX, y1: y0, x2: x0 + i * cellX, y2: y0 + height, stroke: "#ffffff55" })); svg.appendChild(svgEl("line", { x1: x0, y1: y0 + i * cellY, x2: x0 + width, y2: y0 + i * cellY, stroke: "#ffffff55" })); }
    for (let value = 1; value <= 5; value++) {
        const xTick = svgEl("text", {
            x: x0 + (value - .5) * cellX,
            y: y0 + height + 17,
            "text-anchor": "middle",
            class: "axis-tick heatmap-axis-tick"
        });
        xTick.textContent = String(value);
        svg.appendChild(xTick);

        const yTick = svgEl("text", {
            x: x0 - 13,
            y: y0 + (5.5 - value) * cellY + 4,
            "text-anchor": "middle",
            class: "axis-tick heatmap-axis-tick"
        });
        yTick.textContent = String(value);
        svg.appendChild(yTick);
    }
    data.heatmap.forEach((row, i) => {
        const probability = clamp(num(get(row, ["Probabilidad", "Probability", "P"])), 1, 5);
        const impact = clamp(num(get(row, ["Impacto", "Impact", "I"])), 1, 5);
        const count = num(get(row, ["Cantidad", "Total", "Riesgos", "Valor"])) || 1;
        const point = svgEl("circle", { cx: x0 + (probability - .5) * cellX, cy: y0 + (5.5 - impact) * cellY, r: Math.min(11, 3 + Math.sqrt(count)), fill: "#0046A8", stroke: "#fff", "stroke-width": "1", opacity: ".92", tabindex: "0", "data-risk-index": String(i) });
        point.setAttribute("aria-label", `${display(get(row, ["IdRiesgo"]))}: ${display(get(row, ["Nombre"]))}`);
        svg.appendChild(point);
    });
    let lastRiskIndex = -1;
    let pendingRiskEvent: MouseEvent | null = null;
    let riskFrame: number | null = null;
    const showTooltip = (event: MouseEvent, index: number): void => {
            const row = data.heatmap[index];
            if (!row) return;
            const level = display(get(row, ["NivelRiesgo", "Nivel de Riesgo"]));
            if (index !== lastRiskIndex) {
                lastRiskIndex = index;
            tooltip.replaceChildren();
            tooltip.appendChild(el("strong", "evm-risk-point-tooltip-title", display(get(row, ["Nombre"]))));
            const fields: Array<[string, unknown]> = [
                ["ID del riesgo", get(row, ["IdRiesgo"])],
                ["Probabilidad", get(row, ["ProbabilidadTexto"])],
                ["Impacto", get(row, ["ImpactoTexto"])],
                ["Nivel de riesgo", level]
            ];
            fields.forEach(([field, value]) => {
                const line = el("div", "evm-risk-point-tooltip-row");
                line.append(el("span", "", field), el("b", field === "Nivel de riesgo" ? `is-${norm(level)}` : "", display(value)));
                tooltip.appendChild(line);
            });
            }
            const bounds = card.getBoundingClientRect();
            const localX = event.clientX - bounds.left;
            const localY = event.clientY - bounds.top;
            tooltip.style.left = `${localX > bounds.width * .64 ? localX - 320 : localX + 14}px`;
            tooltip.style.top = `${localY > bounds.height * .68 ? localY - 155 : localY + 14}px`;
            tooltip.classList.add("visible");
    };
    svg.addEventListener("mousemove", (event: MouseEvent) => {
        pendingRiskEvent = event;
        if (riskFrame !== null) return;
        riskFrame = requestAnimationFrame(() => {
            riskFrame = null;
            if (!pendingRiskEvent) return;
            const point = pendingRiskEvent.target instanceof Element ? pendingRiskEvent.target.closest("[data-risk-index]") : null;
            const index = Number(point?.getAttribute("data-risk-index"));
            if (point && Number.isInteger(index)) showTooltip(pendingRiskEvent, index);
            else tooltip.classList.remove("visible");
        });
    });
    svg.addEventListener("mouseleave", () => {
        pendingRiskEvent = null;
        lastRiskIndex = -1;
        tooltip.classList.remove("visible");
    });
    const xt = svgEl("text", { x: x0 + width / 2, y: 324, "text-anchor": "middle", class: "axis-title" }); xt.textContent = "PROBABILIDAD"; svg.appendChild(xt);
    const yt = svgEl("text", { x: 14, y: y0 + height / 2, transform: `rotate(-90 14 ${y0 + height / 2})`, "text-anchor": "middle", class: "axis-title" }); yt.textContent = "IMPACTO"; svg.appendChild(yt);
    body.appendChild(svg);
    const stats = el("div", "evm-risk-levels");
    const summary = data.summary[0] ?? {};
    const total = num(get(summary, ["RiesgosTotales", "TotalRiesgos", "Total"]));
    [["Alto", "high"], ["Medio", "medium"], ["Bajo", "low"]].forEach(([name, tone]) => {
        const value = num(get(summary, [`Riesgos${name}s`, name, `${name}s`]));
        stats.appendChild(el("span", tone, `${name}: ${display(value)} (${formatWholePct(total ? value / total : 0)})`));
    });
    const exposureTotal = data.heatmap.reduce((sum, row) => (
        sum + num(get(row, ["Cantidad", "Total", "Riesgos", "Valor"]))
    ), 0);
    const variationValue = get(summary, [
        "VariacionExposicionPct",
        "VariaciónExposiciónPct",
        "VariacionExposicion",
        "VariacionMesAnterior"
    ]);
    const exposure = el("div", "evm-risk-exposure-card");
    exposure.appendChild(el("span", "evm-risk-exposure-title", "EXPOSICIÓN TOTAL"));
    exposure.appendChild(el("strong", "evm-risk-exposure-value", display(exposureTotal)));
    exposure.appendChild(el("small", "evm-risk-exposure-unit", "puntos"));
    exposure.appendChild(el("span", "evm-risk-exposure-caption", "Variación vs mes anterior"));
    if (variationValue !== undefined && variationValue !== null && variationValue !== "") {
        const variation = percentage(variationValue);
        const variationLabel = `${variation > 0 ? "+" : ""}${formatPct(variation)} ${variation > 0 ? "↗" : variation < 0 ? "↘" : "→"}`;
        exposure.appendChild(el("b", `evm-risk-exposure-variation ${variation > 0 ? "is-up" : variation < 0 ? "is-down" : "is-flat"}`, variationLabel));
    } else {
        exposure.appendChild(el("b", "evm-risk-exposure-variation is-flat", "—"));
    }
    stats.appendChild(exposure);
    body.appendChild(stats); card.append(body, tooltip);
    return card;
}

function renderVerticalBars(rows: RiskDashboardRow[], heading: string): HTMLElement {
    const chartType = heading.includes("UNIDAD") ? "evm-risk-vbar-card--units" : "evm-risk-vbar-card--responsible";
    const card = chartCard(heading, `evm-risk-vbar-card ${chartType}`);
    const plot = el("div", "evm-risk-vbars");
    const values = rows.map(r => num(get(r, ["Cantidad", "Total", "Riesgos", "Valor"])));
    const max = Math.max(1, ...values);
    rows.forEach((row, i) => {
        const item = el("div", "evm-risk-vbar"); item.title = `${label(row, i)}: ${display(values[i])}`;
        const columnWidth = 100 / Math.max(1, rows.length);
        item.style.left = `${i * columnWidth}%`;
        item.style.width = `${columnWidth}%`;
        const relativeValue = values[i] / max;
        const balancedHeight = values[i] > 0 ? 45 + relativeValue * 55 : 0;
        const bar = el("i", "");
        const measure = el("div", "evm-risk-vbar-measure");
        measure.style.height = `${balancedHeight}%`;
        measure.append(el("strong", "", display(values[i])), bar);
        const barArea = el("div", "evm-risk-vbar-area");
        barArea.appendChild(measure);
        item.append(barArea, el("span", "", label(row, i)));
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
function formatWholePct(value: number): string { return new Intl.NumberFormat("es-PE", { style: "percent", maximumFractionDigits: 0 }).format(value); }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", content?: string): HTMLElementTagNameMap[K] { const node = document.createElement(tag); if (className) node.className = className; if (content !== undefined) node.textContent = content; return node; }
function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] { const node = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v))); return node; }
function title(node: SVGElement, value: string): void { const t = svgEl("title", {}); t.textContent = value; node.appendChild(t); }
