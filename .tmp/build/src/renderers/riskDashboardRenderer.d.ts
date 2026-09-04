import { RiskDashboardData } from "../types";
export declare function renderRiskDashboard(data: RiskDashboardData | null, pageIndex?: number, _onPageChange?: (index: number) => void): HTMLElement;
export declare function mountRiskDashboardPage(main: HTMLElement, pageIndex: number, data: RiskDashboardData): void;
