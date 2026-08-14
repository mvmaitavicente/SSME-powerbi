"use strict";

import { DashboardLevel, ProjectHeader } from "../types";
import { createElement, date, text } from "../utils/format";

export interface SidebarOptions {
    expanded: boolean;
    activeLevel: DashboardLevel;
    portfolioViewActive: "summary" | "matrix";
    projectViewActive: "summary" | "milestones" | "risks";
    canOpenUnit: boolean;
    canOpenProject: boolean;
    onOpenPronied: () => void;
    onOpenRisks: () => void;
    onOpenUnit: () => void;
    onOpenProject: () => void;
    onPortfolioView: (view: "summary" | "matrix") => void;
    onProjectView: (view: "summary" | "milestones" | "risks") => void;
    onOpenFilters: () => void;
    onToggle: () => boolean;
}

export function renderSidebar(options: SidebarOptions): HTMLElement {
    const sidebar = createElement("aside", `evm-sidebar${options.expanded ? " expanded" : ""}`);
    console.debug("Sidebar renderizado", {
        level: options.activeLevel,
        canOpenUnit: options.canOpenUnit,
        canOpenProject: options.canOpenProject
    });

    const brand = createElement("button", "evm-sidebar-brand");
    brand.type = "button";
    brand.setAttribute("aria-label", options.expanded ? "Contraer menú" : "Expandir menú");
    brand.setAttribute("aria-expanded", String(options.expanded));
    brand.appendChild(createElement("span", "evm-menu-icon", "▣"));
    const brandLabel = createElement("strong", undefined, options.expanded ? "Contraer menú" : "Expandir menú");
    brand.appendChild(brandLabel);

    const menu = createElement("nav", "evm-menu");
    const portfolioGroup = createElement("div", `evm-menu-project-group${options.activeLevel === "PRONIED" ? " active" : ""}`);
    portfolioGroup.appendChild(renderSidebarButton("▦", "Alta Dirección", options.activeLevel === "PRONIED", false, options.onOpenPronied));
    if (options.activeLevel === "PRONIED") {
        const portfolioSubmenu = createElement("div", "evm-project-submenu");
        portfolioSubmenu.appendChild(renderProjectSubtab("Resumen", "summary", options.portfolioViewActive === "summary", () => options.onPortfolioView("summary"), "portfolio"));
        portfolioSubmenu.appendChild(renderProjectSubtab("Matriz", "matrix", options.portfolioViewActive === "matrix", () => options.onPortfolioView("matrix"), "portfolio"));
        portfolioGroup.appendChild(portfolioSubmenu);
    }
    menu.appendChild(portfolioGroup);
    menu.appendChild(renderSidebarButton("☷", "Unidad Gerencial", options.activeLevel === "UNIDAD", false, options.onOpenUnit, options.canOpenUnit ? "Abrir Unidad Gerencial" : "Seleccione una unidad"));
    const projectGroup = createElement("div", `evm-menu-project-group${options.activeLevel === "PROYECTO" ? " active" : ""}`);
    projectGroup.appendChild(renderSidebarButton("▣", "Proyectos", options.activeLevel === "PROYECTO", false, options.onOpenProject, options.canOpenProject ? "Abrir Proyectos" : "Seleccione un proyecto"));
    if (options.activeLevel === "PROYECTO") {
        const projectSubmenu = createElement("div", "evm-project-submenu");
        projectSubmenu.appendChild(renderProjectSubtab("Resumen", "summary", options.projectViewActive === "summary", () => options.onProjectView("summary"), "project"));
        projectSubmenu.appendChild(renderProjectSubtab("Matriz", "matrix", options.projectViewActive !== "summary", () => options.onProjectView("milestones"), "project"));
        projectGroup.appendChild(projectSubmenu);
    }
    menu.appendChild(projectGroup);
    menu.appendChild(renderSidebarButton("⚠", "Riesgos", options.activeLevel === "RIESGOS", false, options.onOpenRisks, "Abrir tablero de riesgos"));

    const footer = createElement("div", "evm-menu-footer");
    footer.appendChild(renderSidebarButton("⚙", "Filtros", false, false, options.onOpenFilters, "Abrir filtros"));

    const toggleSidebar = (): void => {
        const expanded = options.onToggle();
        sidebar.classList.toggle("expanded", expanded);
        brand.setAttribute("aria-label", expanded ? "Contraer menú" : "Expandir menú");
        brand.setAttribute("aria-expanded", String(expanded));
        brandLabel.textContent = expanded ? "Contraer menú" : "Expandir menú";
    };
    brand.addEventListener("click", toggleSidebar);

    sidebar.appendChild(brand);
    sidebar.appendChild(menu);
    sidebar.appendChild(footer);
    return sidebar;
}

function renderProjectSubtab(
    label: string,
    view: "summary" | "matrix",
    active: boolean,
    onClick: () => void,
    scope: "project" | "portfolio"
): HTMLButtonElement {
    const item = createElement("button", `evm-project-subtab${active ? " active" : ""}`);
    item.type = "button";
    item.dataset.projectView = view;
    item.dataset.carouselScope = scope;
    item.setAttribute("aria-label", `Abrir ${label} de ${scope === "project" ? "Proyectos" : "Alta Dirección"}`);
    item.appendChild(createElement("span", "evm-project-subtab-marker", "•"));
    item.appendChild(createElement("span", undefined, label));
    item.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
    });
    return item;
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

export function renderHeader(header: ProjectHeader, options: { titleLabel?: string | null; subtitle?: string; stateLabel?: string } = {}): HTMLElement {
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
    stateCopy.appendChild(createElement("span", undefined, options.stateLabel ?? "Estado del Proyecto"));
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
