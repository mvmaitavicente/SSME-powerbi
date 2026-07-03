import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsModel = formattingSettings.Model;
import FormattingSettingsSlice = formattingSettings.Slice;
declare class GeneralCardSettings extends FormattingSettingsCard {
    showShadow: formattingSettings.ToggleSwitch;
    fontSize: formattingSettings.NumUpDown;
    name: string;
    displayName: string;
    slices: FormattingSettingsSlice[];
}
export declare class VisualFormattingSettingsModel extends FormattingSettingsModel {
    general: GeneralCardSettings;
    cards: GeneralCardSettings[];
}
export {};
