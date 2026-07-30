"use strict";

import { portfolioClasses } from "./styles";

export type PortfolioIconName = "building" | "budget" | "schedule" | "cost" | "critical" | "risk" | "project" | "intervention";

export function portfolioIcon(name: PortfolioIconName): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add(portfolioClasses.icon);

    const path = (d: string): void => {
        const node = document.createElementNS("http://www.w3.org/2000/svg", "path");
        node.setAttribute("d", d);
        svg.appendChild(node);
    };
    const line = (x1: number, y1: number, x2: number, y2: number): void => {
        const node = document.createElementNS("http://www.w3.org/2000/svg", "line");
        node.setAttribute("x1", String(x1));
        node.setAttribute("y1", String(y1));
        node.setAttribute("x2", String(x2));
        node.setAttribute("y2", String(y2));
        svg.appendChild(node);
    };

    if (name === "building") {
        path("M9 54V27h14v27M23 54V12h19v42M42 54V25h13v29M5 54h54");
        path("M29 20h4v4h-4zM36 20h4v4h-4zM29 29h4v4h-4zM36 29h4v4h-4zM29 38h4v4h-4zM36 38h4v4h-4zM14 34h4v4h-4zM14 43h4v4h-4zM47 33h4v4h-4zM47 42h4v4h-4z");
    } else if (name === "budget") {
        path("M21 16c5-5 17-5 22 0l-4 6H25zM25 22c-8 8-12 15-12 24 0 9 8 14 19 14s19-5 19-14c0-9-4-16-12-24");
        path("M36 34c-1-2-7-2-8 1-1 4 9 3 8 8-1 4-8 3-9 1M32 30v18");
    } else if (name === "schedule") {
        path("M11 16h35v34H11zM11 25h35M18 10v12M38 10v12");
        path("M18 32h4v4h-4zM27 32h4v4h-4zM18 41h4v4h-4zM27 41h4v4h-4z");
        path("M40 37a13 13 0 1 0 0 26 13 13 0 0 0 0-26M40 43v8l5 3");
    } else if (name === "cost") {
        path("M14 23a12 12 0 1 0 24 0 12 12 0 0 0-24 0M29 17c-1-2-7-2-8 1-1 4 9 3 8 8-1 4-8 3-9 1M25 13v20");
        path("M14 55l12-12 8 7 17-19M43 31h8v8");
    } else if (name === "critical") {
        path("M20 13h24v43H12V13h8M24 9h16v9H24z");
        path("M19 29l2 2 4-5M19 39l2 2 4-5M19 49l2 2 4-5M30 29h9M30 39h9M30 49h9");
    } else if (name === "project") {
        path("M19 8h20l10 10v38H19zM39 8v12h10M27 31h14M27 40h14M27 49h10");
    } else if (name === "intervention") {
        path("M17 12c6 0 10 5 8 11l20 20c6-2 11 2 11 8l-7-4-5 5 4 7c-6 0-10-5-8-11L20 28c-6 2-11-2-11-8l7 4 5-5z");
        path("M39 16l9-9 9 9-9 9M34 30 16 48l-7 7M13 44l7 7");
    } else {
        path("M32 8 57 55H7z");
        line(32, 23, 32, 41);
        line(32, 48, 32, 49);
    }
    return svg;
}
