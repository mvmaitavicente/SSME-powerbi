"use strict";

import powerbi from "powerbi-visuals-api";

export interface FilterTarget {
    table: string;
    column: string;
}

export function basicFilter(target: FilterTarget, values: Array<string | number>): powerbi.IFilter {
    return {
        $schema: ["http", "://powerbi.com/product/schema#basic"].join(""),
        target,
        filterType: 1,
        operator: "In",
        values,
        requireSingleSelection: false
    } as unknown as powerbi.IFilter;
}

export function tupleFilter(targets: FilterTarget[], values: Array<Array<string | number>>): powerbi.IFilter {
    return {
        $schema: ["http", "://powerbi.com/product/schema#tuple"].join(""),
        target: targets,
        filterType: 6,
        operator: "In",
        values: values.map((row) => row.map((value) => ({ value })))
    } as unknown as powerbi.IFilter;
}
