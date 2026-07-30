import { PortfolioIconName } from "./icons";
export declare function renderPrimaryCard(tone: "blue" | "green", icon: PortfolioIconName, value: string, label: string, note: string | undefined, miniCards: Array<[string, string, PortfolioIconName?]>): HTMLElement;
export declare function renderHorizontalCard(tone: "blue" | "orange", icon: PortfolioIconName, value: string, label: string, note: string): HTMLElement;
export declare function renderCompactCard(tone: "orange" | "red", icon: PortfolioIconName, value: string, label: string): HTMLElement;
