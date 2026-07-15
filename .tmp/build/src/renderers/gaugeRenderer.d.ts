import { GaugeData, GaugeMetricKey, VisualPalette } from "../types";
export declare function renderGaugeGrid(gauges: GaugeData[], palette: VisualPalette, onHistoryOpen?: (key: GaugeMetricKey) => void): HTMLElement;
export declare function renderGauge(data: GaugeData, palette: VisualPalette, onHistoryOpen?: (key: GaugeMetricKey) => void): HTMLElement;
