export declare class LazyCarouselView {
    private readonly mounts;
    create(className: string, active: boolean, render: (page: HTMLElement) => void): HTMLElement;
    mount(page: HTMLElement): void;
}
