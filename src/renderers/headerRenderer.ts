"use strict";

import { ProjectHeader } from "../types";
import { createElement, date, text } from "../utils/format";

export function renderSidebar(): HTMLElement {
    const sidebar = createElement("aside", "evm-sidebar");

    const menu = createElement("nav", "evm-menu");
    ["Resumen Ejecutivo", "Direccion Unidad de Linea", "Proyectos", "Riesgos", "Tabla de Cierre"].forEach((label, index) => {
        const item = createElement("div", `evm-menu-item${index === 0 ? " active" : ""}`);
        item.appendChild(createElement("span", "evm-menu-icon", ["⌂", "◌", "▣", "△", "☷"][index]));
        item.appendChild(createElement("span", undefined, label));
        menu.appendChild(item);
    });

    const footer = createElement("div", "evm-menu-footer");
    ["Mapa Cartografico", "Explicacion"].forEach((label) => {
        const item = createElement("div", "evm-menu-item ghost");
        item.appendChild(createElement("span", "evm-menu-icon", "ⓘ"));
        item.appendChild(createElement("span", undefined, label));
        footer.appendChild(item);
    });

    sidebar.appendChild(menu);
    sidebar.appendChild(footer);
    return sidebar;
}

export function renderHeader(header: ProjectHeader): HTMLElement {
    const wrapper = createElement("section", "evm-header evm-card");

    const project = createElement("div", "evm-project-title");
    const title = createElement("h1");
    title.appendChild(createElement("span", undefined, "Proyecto:"));
    title.appendChild(document.createTextNode(` ${text(header.NombreIntervencion, "Proyecto sin nombre")}`));
    project.appendChild(title);
    const meta = createElement("div", "evm-header-meta");
    appendMeta(meta, "Unidad:", text(header.UnidadGerencial));
    appendMeta(meta, "CUI:", text(header.CUI));
    appendMeta(meta, "Region:", text(header.Region));
    appendMeta(meta, "Provincia:", text(header.Provincia));
    appendMeta(meta, "Distrito:", text(header.Distrito));
    project.appendChild(meta);

    const stateClass = projectStateClass(header.EstadoProyecto);
    const state = createElement("div", `evm-project-state ${stateClass}`);
    const stateIcon = createElement("div", "evm-project-state-icon");
    stateIcon.appendChild(createElement("span", undefined, stateClass === "stable" ? "✓" : "!"));
    const stateBody = createElement("div", "evm-project-state-body");
    const stateCopy = createElement("div", "evm-project-state-copy");
    stateCopy.appendChild(createElement("span", undefined, "Estado del Proyecto"));
    stateCopy.appendChild(createElement("strong", undefined, text(header.EstadoProyecto, "Sin estado")));
    const stateMessage = createElement("small", "evm-project-state-message", text(header.MensajeEjecutivo, ""));
    state.appendChild(stateIcon);
    stateBody.appendChild(stateCopy);
    stateBody.appendChild(stateMessage);
    state.appendChild(stateBody);

    const dates = createElement("div", "evm-project-dates");
    dates.appendChild(createElement("span", undefined, "Fecha de Estado"));
    dates.appendChild(createElement("strong", undefined, date(header.FechaEstado)));
    dates.appendChild(createElement("small", undefined, `Semana Actual ${text(header.SemanaActual)}`));

    wrapper.appendChild(project);
    wrapper.appendChild(state);
    wrapper.appendChild(dates);
    return wrapper;
}

function appendMeta(parent: HTMLElement, label: string, value: string): void {
    const item = createElement("span", "evm-header-meta-item");
    item.appendChild(createElement("b", undefined, label));
    item.appendChild(document.createTextNode(` ${value}`));
    parent.appendChild(item);
}

function projectStateClass(status?: string): string {
    const value = (status ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (value.includes("estable")) {
        return "stable";
    }
    if (value.includes("riesgo")) {
        return "risk";
    }
    if (value.includes("critico") || value.includes("critic")) {
        return "critical";
    }
    return "neutral";
}
