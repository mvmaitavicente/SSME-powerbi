import powerbi from "powerbi-visuals-api";
import { FilterTarget } from "./filterFactory";
export declare class NavigationFilterController {
    private readonly host;
    private readonly beforeApply;
    private signature;
    constructor(host: powerbi.extensibility.visual.IVisualHost, beforeApply: () => void);
    applyBasic(signature: string, target: FilterTarget, values: Array<string | number>, force?: boolean): boolean;
    applyTuple(signature: string, targets: FilterTarget[], values: Array<Array<string | number>>): boolean;
    clear(force?: boolean): boolean;
    private apply;
}
