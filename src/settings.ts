"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsModel = formattingSettings.Model;
import FormattingSettingsSlice = formattingSettings.Slice;

class GeneralCardSettings extends FormattingSettingsCard {
    showShadow = new formattingSettings.ToggleSwitch({
        name: "showShadow",
        displayName: "Mostrar sombra",
        value: true
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Tamano de texto",
        value: 11
    });

    name = "general";
    displayName = "General";
    slices: FormattingSettingsSlice[] = [this.showShadow, this.fontSize];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    general = new GeneralCardSettings();
    cards = [this.general];
}
