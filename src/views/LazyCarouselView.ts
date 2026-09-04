"use strict";

export class LazyCarouselView {
    private readonly mounts = new WeakMap<HTMLElement, () => void>();

    public create(className: string, active: boolean, render: (page: HTMLElement) => void): HTMLElement {
        const page = document.createElement("div");
        page.className = className;
        let mounted = false;
        const mount = (): void => {
            if (mounted) return;
            mounted = true;
            render(page);
            this.mounts.delete(page);
        };
        this.mounts.set(page, mount);
        if (active) mount();
        return page;
    }

    public mount(page: HTMLElement): void {
        this.mounts.get(page)?.();
    }
}
