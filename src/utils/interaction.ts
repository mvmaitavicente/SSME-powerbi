"use strict";

export function debounceInput(callback: () => void, delay = 120): () => void {
    let timer: number | null = null;
    return () => {
        if (timer !== null) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
            timer = null;
            callback();
        }, delay);
    };
}
