"use strict";

import { createElement } from "../utils/format";
import { PortfolioIconName, portfolioIcon } from "./icons";
import { renderMiniCard } from "./MiniCard";
import { portfolioClasses } from "./styles";

function iconBlock(icon: PortfolioIconName): HTMLElement {
    const wrap = createElement("div", portfolioClasses.iconWrap);
    wrap.appendChild(portfolioIcon(icon));
    return wrap;
}

function mainMetric(value: string, label: string, note?: string): HTMLElement {
    const main = createElement("div", portfolioClasses.main);
    main.appendChild(createElement("strong", undefined, value));
    main.appendChild(createElement("span", undefined, label));
    if (note) {
        main.appendChild(createElement("small", undefined, note));
    }
    main.appendChild(createElement("i", portfolioClasses.accentLine));
    return main;
}

export function renderPrimaryCard(
    tone: "blue" | "green",
    icon: PortfolioIconName,
    value: string,
    label: string,
    note: string | undefined,
    miniCards: Array<[string, string, PortfolioIconName?]>
): HTMLElement {
    const card = createElement("article", `${portfolioClasses.card} ${portfolioClasses.primaryCard} is-${tone}`);
    const right = createElement("div", portfolioClasses.detail);
    miniCards.forEach(([miniValue, miniLabel, miniIcon]) => right.appendChild(renderMiniCard(miniValue, miniLabel, miniIcon)));
    card.appendChild(iconBlock(icon));
    card.appendChild(mainMetric(value, label, note));
    card.appendChild(right);
    return card;
}

export function renderHorizontalCard(
    tone: "blue" | "orange",
    icon: PortfolioIconName,
    value: string,
    label: string,
    note: string
): HTMLElement {
    const card = createElement("article", `${portfolioClasses.card} ${portfolioClasses.horizontalCard} is-${tone}`);
    card.appendChild(iconBlock(icon));
    card.appendChild(mainMetric(value, label, note));
    return card;
}

export function renderCompactCard(
    tone: "orange" | "red",
    icon: PortfolioIconName,
    value: string,
    label: string
): HTMLElement {
    const card = createElement("article", `${portfolioClasses.card} ${portfolioClasses.compactCard} is-${tone}`);
    card.appendChild(iconBlock(icon));
    card.appendChild(mainMetric(value, label));
    return card;
}
