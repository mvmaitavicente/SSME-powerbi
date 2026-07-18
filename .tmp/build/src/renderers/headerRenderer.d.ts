import { DashboardLevel, ProjectHeader } from "../types";
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
export declare function renderSidebar(options: SidebarOptions): HTMLElement;
export declare function renderHeader(header: ProjectHeader, options?: {
    titleLabel?: string | null;
}): HTMLElement;
