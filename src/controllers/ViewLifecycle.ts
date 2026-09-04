"use strict";

export interface LifecycleSink {
    register(cleanup: () => void): void;
}

export class ViewLifecycle implements LifecycleSink {
    private readonly cleanups = new Set<() => void>();

    public register(cleanup: () => void): void {
        this.cleanups.add(cleanup);
    }

    public listen<K extends keyof WindowEventMap>(
        target: Window,
        type: K,
        listener: (event: WindowEventMap[K]) => void,
        options?: AddEventListenerOptions | boolean
    ): void;
    public listen<K extends keyof DocumentEventMap>(
        target: Document,
        type: K,
        listener: (event: DocumentEventMap[K]) => void,
        options?: AddEventListenerOptions | boolean
    ): void;
    public listen(
        target: EventTarget,
        type: string,
        listener: EventListener,
        options?: AddEventListenerOptions | boolean
    ): void {
        target.addEventListener(type, listener, options);
        this.register(() => target.removeEventListener(type, listener, options));
    }

    public frame(callback: FrameRequestCallback): number {
        const id = window.requestAnimationFrame(callback);
        this.register(() => window.cancelAnimationFrame(id));
        return id;
    }

    public reset(): void {
        this.cleanups.forEach((cleanup) => cleanup());
        this.cleanups.clear();
    }
}
