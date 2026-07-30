"use strict";

import { createElement } from "../utils/format";
import { PortfolioIconName, portfolioIcon } from "./icons";
import { portfolioClasses } from "./styles";

export function renderMiniCard(value: string, label: string, icon?: PortfolioIconName): HTMLElement {
    const card = createElement("div", portfolioClasses.miniCard);
    card.appendChild(createElement("strong", undefined, value));
    card.appendChild(createElement("span", undefined, label));
    if (icon) {
        card.appendChild(portfolioIcon(icon));
    }
    return card;
}
