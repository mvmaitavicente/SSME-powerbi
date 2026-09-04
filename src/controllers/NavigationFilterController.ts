"use strict";

import powerbi from "powerbi-visuals-api";
import { basicFilter, FilterTarget, tupleFilter } from "./filterFactory";

export class NavigationFilterController {
    private signature: string | null = null;

    constructor(
        private readonly host: powerbi.extensibility.visual.IVisualHost,
        private readonly beforeApply: () => void
    ) {}

    public applyBasic(signature: string, target: FilterTarget, values: Array<string | number>, force = false): boolean {
        if (!force && this.signature === signature) return false;
        return this.apply(signature, basicFilter(target, values));
    }

    public applyTuple(signature: string, targets: FilterTarget[], values: Array<Array<string | number>>): boolean {
        if (this.signature === signature) return false;
        return this.apply(signature, tupleFilter(targets, values));
    }

    public clear(force = false): boolean {
        if (!force && this.signature === null) return false;
        this.beforeApply();
        this.host.applyJsonFilter(null as unknown as powerbi.IFilter, "general", "filter", powerbi.FilterAction.remove);
        this.host.applyJsonFilter(null as unknown as powerbi.IFilter, "general", "selfFilter", powerbi.FilterAction.remove);
        this.signature = null;
        return true;
    }

    private apply(signature: string, filter: powerbi.IFilter): boolean {
        this.beforeApply();
        this.host.applyJsonFilter(filter, "general", "filter", powerbi.FilterAction.merge);
        this.host.applyJsonFilter(filter, "general", "selfFilter", powerbi.FilterAction.merge);
        this.signature = signature;
        return true;
    }
}
