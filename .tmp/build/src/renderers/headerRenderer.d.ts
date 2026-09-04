import { DashboardLevel, ProjectHeader } from "../types";
export interface SidebarOptions {
    expanded: boolean;
    activeLevel: DashboardLevel;
    portfolioViewActive: "summary" | "matrix";
    projectViewActive: "summary" | "milestones" | "risks";
    riskViewActive: "summary" | "matrix";
    canOpenUnit: boolean;
    canOpenProject: boolean;
    onOpenPronied: () => void;
    onOpenRisks: () => void;
    onOpenUnit: () => void;
    onOpenProject: () => void;
    onPortfolioView: (view: "summary" | "matrix") => void;
    onProjectView: (view: "summary" | "milestones" | "risks") => void;
    onRiskView: (view: "summary" | "matrix") => void;
    onOpenFilters: () => void;
    onToggle: () => boolean;
}
export declare function renderSidebar(options: SidebarOptions): HTMLElement;
export declare function renderHeader(header: ProjectHeader, options?: {
    titleLabel?: string | null;
    subtitle?: string;
    stateLabel?: string;
    weekOverride?: number;
}): HTMLElement;
