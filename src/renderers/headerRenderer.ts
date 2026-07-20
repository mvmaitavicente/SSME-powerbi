"use strict";

import { DashboardLevel, ProjectHeader } from "../types";
import { createElement, date, text } from "../utils/format";

export interface SidebarOptions {
    activeLevel: DashboardLevel;
    projectViewActive: "summary" | "milestones" | "risks";
    canOpenUnit: boolean;
    canOpenProject: boolean;
    onOpenPronied: () => void;
    onOpenUnit: () => void;
    onOpenProject: () => void;
    onProjectView: (view: "summary" | "milestones" | "risks") => void;
    onOpenFilters: () => void;
}

export function renderSidebar(options: SidebarOptions): HTMLElement {
    const sidebar = createElement("aside", "evm-sidebar");
    console.debug("Sidebar renderizado", {
        level: options.activeLevel,
        canOpenUnit: options.canOpenUnit,
        canOpenProject: options.canOpenProject
    });

    const menu = createElement("nav", "evm-menu");
    menu.appendChild(createElement("div", "evm-menu-group-label", "Navegación"));
    menu.appendChild(renderSidebarButton("▦", "PRONIED", options.activeLevel === "PRONIED", false, options.onOpenPronied));
    menu.appendChild(renderSidebarButton("☷", "UNIDAD", options.activeLevel === "UNIDAD", false, options.onOpenUnit, options.canOpenUnit ? "Abrir unidad" : "Seleccione una unidad"));
    menu.appendChild(renderSidebarButton("▣", "PROYECTO", options.activeLevel === "PROYECTO", false, options.onOpenProject, options.canOpenProject ? "Abrir proyecto" : "Seleccione un proyecto"));

    menu.appendChild(createElement("div", "evm-menu-group-label evm-menu-group-label--project", "Proyecto"));
    const disableProjectViews = options.activeLevel !== "PROYECTO";
    menu.appendChild(renderSidebarButton("⌂", "Resumen", options.projectViewActive === "summary" && !disableProjectViews, disableProjectViews, () => options.onProjectView("summary"), disableProjectViews ? "Disponible en nivel PROYECTO" : "Ver Curva S"));
    menu.appendChild(renderSidebarButton("◇", "Hitos", options.projectViewActive === "milestones" && !disableProjectViews, disableProjectViews, () => options.onProjectView("milestones"), disableProjectViews ? "Disponible en nivel PROYECTO" : "Ver Hitos"));
    menu.appendChild(renderSidebarButton("△", "Riesgos", options.projectViewActive === "risks" && !disableProjectViews, disableProjectViews, () => options.onProjectView("risks"), disableProjectViews ? "Disponible en nivel PROYECTO" : "Ver Riesgos"));

    const footer = createElement("div", "evm-menu-footer");
    footer.appendChild(renderSidebarButton("⚙", "Filtros", false, false, options.onOpenFilters, "Abrir filtros"));
    footer.appendChild(renderSidebarButton("ⓘ", "Explicación", false, true, () => undefined, "Explicación"));

    sidebar.appendChild(menu);
    sidebar.appendChild(footer);
    return sidebar;
}

function renderSidebarButton(
    icon: string,
    label: string,
    active: boolean,
    disabled: boolean,
    onClick: () => void,
    tooltip?: string
): HTMLButtonElement {
    console.debug("Registrando botón sidebar", {
        name: label,
        disabled
    });
    const item = createElement("button", `evm-menu-item${active ? " sidebar-item--active active" : ""}${disabled ? " disabled" : ""}`);
    item.type = "button";
    item.disabled = disabled;
    item.title = tooltip ?? label;
    item.setAttribute("aria-label", tooltip ?? label);
    item.appendChild(createElement("span", "evm-menu-icon", icon));
    item.appendChild(createElement("span", undefined, label));
    item.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (item.disabled) {
            return;
        }

        console.debug("Sidebar click recibido", {
            target: label
        });
        onClick();
    });
    return item;
}

export function renderHeader(header: ProjectHeader, options: { titleLabel?: string | null; subtitle?: string } = {}): HTMLElement {
    const wrapper = createElement("section", "evm-header evm-card");

    const project = createElement("div", "evm-project-title");
    const title = createElement("h1");
    const titleLabel = options.titleLabel === undefined ? "Proyecto:" : options.titleLabel;
    if (titleLabel) {
        title.appendChild(createElement("span", undefined, titleLabel));
        title.appendChild(document.createTextNode(` ${text(header.NombreIntervencion, "Proyecto sin nombre")}`));
    } else {
        title.appendChild(document.createTextNode(text(header.NombreIntervencion, "Proyecto sin nombre")));
    }
    project.appendChild(title);
    const meta = createElement("div", "evm-header-meta");
    if (options.subtitle) {
        meta.classList.add("evm-header-subtitle");
        meta.textContent = options.subtitle;
    } else {
        appendMeta(meta, "Unidad:", text(header.UnidadGerencial));
        appendMeta(meta, "CUI:", text(header.CUI));
        appendMeta(meta, "Region:", text(header.Region));
        appendMeta(meta, "Provincia:", text(header.Provincia));
        appendMeta(meta, "Distrito:", text(header.Distrito));
    }
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
