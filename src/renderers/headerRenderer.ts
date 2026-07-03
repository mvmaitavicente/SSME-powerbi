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
    project.appendChild(createElement("span", undefined, "Proyecto"));
    project.appendChild(createElement("h1", undefined, text(header.NombreIntervencion, "Proyecto sin nombre")));
    const meta = createElement("div", "evm-header-meta");
    appendMeta(meta, "CUI:", text(header.CUI));
    appendMeta(meta, "Region:", text(header.Region));
    appendMeta(meta, "Unidad:", text(header.UnidadGerencial));
    project.appendChild(meta);

    const state = createElement("div", "evm-project-state");
    state.appendChild(createElement("span", undefined, "Estado del Proyecto"));
    state.appendChild(createElement("strong", undefined, text(header.EstadoProyecto, "Sin estado")));

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
    parent.appendChild(createElement("b", undefined, label));
    parent.appendChild(document.createTextNode(` ${value}`));
}
