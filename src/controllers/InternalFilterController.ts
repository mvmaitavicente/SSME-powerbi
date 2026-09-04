"use strict";

import powerbi from "powerbi-visuals-api";
import { FilterTarget, tupleFilter } from "./filterFactory";

interface InternalFilterEntry {
    target: FilterTarget;
    value: string | number;
}

export class InternalFilterController {
    private readonly entries = new Map<string, InternalFilterEntry>();
    private flushPending = false;

    constructor(
        private readonly host: powerbi.extensibility.visual.IVisualHost,
        private readonly beforeApply: () => void
    ) {}

    public set(propertyName: string, target: FilterTarget, value: string | number): boolean {
        const current = this.entries.get(propertyName);
        if (current?.value === value && current.target.table === target.table && current.target.column === target.column) return false;
        this.entries.set(propertyName, { target, value });
        this.scheduleFlush();
        return true;
    }

    public remove(propertyName: string): boolean {
        if (!this.entries.delete(propertyName)) return false;
        this.scheduleFlush();
        return true;
    }

    public removeMany(propertyNames: string[]): void {
        let changed = false;
        propertyNames.forEach((propertyName) => { changed = this.entries.delete(propertyName) || changed; });
        if (changed) this.scheduleFlush();
    }

    public clear(): void {
        if (!this.entries.size) return;
        this.entries.clear();
        this.scheduleFlush();
    }

    private scheduleFlush(): void {
        if (this.flushPending) return;
        this.flushPending = true;
        queueMicrotask(() => {
            this.flushPending = false;
            this.flush();
        });
    }

    private flush(): void {
        this.beforeApply();
        if (!this.entries.size) {
            this.host.applyJsonFilter(null as unknown as powerbi.IFilter, "internalFilters", "combinedFilter", powerbi.FilterAction.remove);
            this.host.applyJsonFilter(null as unknown as powerbi.IFilter, "internalFilters", "combinedSelfFilter", powerbi.FilterAction.remove);
            return;
        }
        const entries = Array.from(this.entries.values());
        const filter = tupleFilter(entries.map((entry) => entry.target), [entries.map((entry) => entry.value)]);
        this.host.applyJsonFilter(filter, "internalFilters", "combinedFilter", powerbi.FilterAction.merge);
        this.host.applyJsonFilter(filter, "internalFilters", "combinedSelfFilter", powerbi.FilterAction.merge);
    }
}
