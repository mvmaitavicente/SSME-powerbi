import powerbi from "powerbi-visuals-api";
import { FilterTarget } from "./filterFactory";
export declare class InternalFilterController {
    private readonly host;
    private readonly beforeApply;
    private readonly entries;
    private flushPending;
    constructor(host: powerbi.extensibility.visual.IVisualHost, beforeApply: () => void);
    set(propertyName: string, target: FilterTarget, value: string | number): boolean;
    remove(propertyName: string): boolean;
    removeMany(propertyNames: string[]): void;
    clear(): void;
    private scheduleFlush;
    private flush;
}
