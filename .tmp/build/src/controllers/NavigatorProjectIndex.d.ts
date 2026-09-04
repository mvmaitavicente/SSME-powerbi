import { NavigatorProject } from "../types";
export declare class NavigatorProjectIndex {
    private readonly projectId;
    private readonly projectsById;
    private readonly secondary;
    private cachedValues;
    private lastSource;
    private dirty;
    private revisionValue;
    constructor(projectId: (project: NavigatorProject) => string | null);
    add(projects: NavigatorProject[]): void;
    get(projectId: string): NavigatorProject | undefined;
    values(): NavigatorProject[];
    candidates(filters: Array<{
        key: keyof NavigatorProject;
        value: string;
    }>): NavigatorProject[];
    get size(): number;
    get revision(): number;
    private ensureCaches;
}
