import { DashboardLevel, ProjectHeader } from "../types";
export interface SidebarOptions {
    expanded: boolean;
    activeLevel: DashboardLevel;
    projectViewActive: "summary" | "milestones" | "risks";
    canOpenUnit: boolean;
    canOpenProject: boolean;
    onOpenPronied: () => void;
    onOpenRisks: () => void;
    onOpenUnit: () => void;
    onOpenProject: () => void;
    onProjectView: (view: "summary" | "milestones" | "risks") => void;
    onOpenFilters: () => void;
    onToggle: () => boolean;
}
export declare function renderSidebar(options: SidebarOptions): HTMLElement;
export declare function renderHeader(header: ProjectHeader, options?: {
    titleLabel?: string | null;
    subtitle?: string;
    stateLabel?: string;
}): HTMLElement;
