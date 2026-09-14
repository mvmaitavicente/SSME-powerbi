export declare function isPerfEnabled(): boolean;
export declare function perfPoint(label: string): void;
export declare function perfNavigation(label: string): void;
export declare function perfMeasure<T>(label: string, action: () => T): T;
export declare function perfLogObject(label: string, value: unknown): void;
export declare function getPerfReportText(): string;
export declare function clearPerfReport(): void;
export declare function renderPerfPanel(): HTMLElement;
