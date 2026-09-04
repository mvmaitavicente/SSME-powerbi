export interface LifecycleSink {
    register(cleanup: () => void): void;
}
export declare class ViewLifecycle implements LifecycleSink {
    private readonly cleanups;
    register(cleanup: () => void): void;
    listen<K extends keyof WindowEventMap>(target: Window, type: K, listener: (event: WindowEventMap[K]) => void, options?: AddEventListenerOptions | boolean): void;
    listen<K extends keyof DocumentEventMap>(target: Document, type: K, listener: (event: DocumentEventMap[K]) => void, options?: AddEventListenerOptions | boolean): void;
    frame(callback: FrameRequestCallback): number;
    reset(): void;
}
