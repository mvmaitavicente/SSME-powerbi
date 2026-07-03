"use strict";

import { DataValue } from "../types";

const emptyText = "\u2014";

export function text(value: DataValue, fallback: string = emptyText): string {
    if (value === null || value === undefined || value === "") {
        return fallback;
    }
    return String(value);
}

export function numberValue(value: DataValue): number | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    if (value instanceof Date) {
        return value.getTime();
    }
    const parsed = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
}

export function currency(value: DataValue): string {
    const parsed = numberValue(value);
    if (parsed === null) {
        return emptyText;
    }
    return `S/ ${parsed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function shortCurrency(value: DataValue): string {
    const parsed = numberValue(value);
    if (parsed === null) {
        return emptyText;
    }
    const abs = Math.abs(parsed);
    if (abs >= 1000000) {
        return `S/ ${(parsed / 1000000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`;
    }
    if (abs >= 1000) {
        return `S/ ${(parsed / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}K`;
    }
    return currency(parsed);
}

export function percent(value: DataValue): string {
    const parsed = numberValue(value);
    if (parsed === null) {
        return emptyText;
    }
    const normalized = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
    return `${normalized.toLocaleString("en-US", { maximumFractionDigits: 0 })}%`;
}

export function percentRatio(value: DataValue): number {
    const parsed = numberValue(value);
    if (parsed === null) {
        return 0;
    }
    const normalized = Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
    return Math.max(0, Math.min(100, normalized));
}

export function decimal(value: DataValue, digits: number = 2): string {
    const parsed = numberValue(value);
    if (parsed === null) {
        return emptyText;
    }
    return parsed.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function signedDecimal(value: DataValue): string {
    const parsed = numberValue(value);
    if (parsed === null) {
        return emptyText;
    }
    const sign = parsed > 0 ? "+" : "";
    return `${sign}${decimal(parsed, 2)}`;
}

export function date(value: DataValue): string {
    if (value === null || value === undefined || value === "") {
        return emptyText;
    }
    const parsed = value instanceof Date ? value : new Date(value as string);
    if (Number.isNaN(parsed.getTime())) {
        return String(value);
    }
    const day = String(parsed.getDate()).padStart(2, "0");
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${parsed.getFullYear()}`;
}

export function createElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    className?: string,
    textContent?: string
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName);
    if (className) {
        element.className = className;
    }
    if (textContent !== undefined) {
        element.textContent = textContent;
    }
    return element;
}

export function appendChildren(parent: HTMLElement, children: Array<HTMLElement | SVGElement>): void {
    children.forEach((child) => parent.appendChild(child));
}

export function svgElement<K extends keyof SVGElementTagNameMap>(tagName: K): SVGElementTagNameMap[K] {
    return document.createElementNS("http://www.w3.org/2000/svg", tagName);
}
