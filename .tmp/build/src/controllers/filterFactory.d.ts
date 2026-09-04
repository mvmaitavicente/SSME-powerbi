import powerbi from "powerbi-visuals-api";
export interface FilterTarget {
    table: string;
    column: string;
}
export declare function basicFilter(target: FilterTarget, values: Array<string | number>): powerbi.IFilter;
export declare function tupleFilter(targets: FilterTarget[], values: Array<Array<string | number>>): powerbi.IFilter;
