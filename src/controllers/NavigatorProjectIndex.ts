"use strict";

import { NavigatorProject } from "../types";

export class NavigatorProjectIndex {
    private readonly projectsById = new Map<string, NavigatorProject>();
    private readonly secondary = new Map<keyof NavigatorProject, Map<string, NavigatorProject[]>>();
    private cachedValues: NavigatorProject[] = [];
    private lastSource: NavigatorProject[] | null = null;
    private dirty = true;
    private revisionValue = 0;

    constructor(private readonly projectId: (project: NavigatorProject) => string | null) {}

    public add(projects: NavigatorProject[]): void {
        if (projects === this.lastSource) return;
        this.lastSource = projects;
        let changed = false;
        projects.forEach((project) => {
            const id = this.projectId(project);
            if (id && this.projectsById.get(id) !== project) {
                this.projectsById.set(id, project);
                changed = true;
            }
        });
        if (changed) {
            this.dirty = true;
            this.revisionValue += 1;
        }
    }

    public get(projectId: string): NavigatorProject | undefined {
        return this.projectsById.get(projectId);
    }

    public values(): NavigatorProject[] {
        this.ensureCaches();
        return this.cachedValues;
    }

    public candidates(filters: Array<{ key: keyof NavigatorProject; value: string }>): NavigatorProject[] {
        this.ensureCaches();
        let smallest: NavigatorProject[] | null = null;
        filters.forEach(({ key, value }) => {
            const bucket = this.secondary.get(key)?.get(value) ?? [];
            if (smallest === null || bucket.length < smallest.length) smallest = bucket;
        });
        return smallest ?? this.cachedValues;
    }

    public get size(): number {
        return this.projectsById.size;
    }

    public get revision(): number {
        return this.revisionValue;
    }

    private ensureCaches(): void {
        if (!this.dirty) return;
        this.cachedValues = Array.from(this.projectsById.values());
        this.secondary.clear();
        const keys: Array<keyof NavigatorProject> = ["UnidadGerencial", "Region", "Provincia", "Distrito", "EstadoProyecto"];
        keys.forEach((key) => {
            const index = new Map<string, NavigatorProject[]>();
            this.cachedValues.forEach((project) => {
                const raw = project[key];
                if (raw === null || raw === undefined) return;
                const value = String(raw);
                const bucket = index.get(value);
                if (bucket) bucket.push(project);
                else index.set(value, [project]);
            });
            this.secondary.set(key, index);
        });
        this.dirty = false;
    }
}
