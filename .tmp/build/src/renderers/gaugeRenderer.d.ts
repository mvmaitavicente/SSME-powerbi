import { GaugeData, GaugeMetricKey, VisualPalette } from "../types";
import { LifecycleSink } from "../controllers/ViewLifecycle";
export declare function renderGaugeGrid(gauges: GaugeData[], palette: VisualPalette, onHistoryOpen?: (key: GaugeMetricKey) => void, lifecycle?: LifecycleSink): HTMLElement;
export declare function renderGauge(data: GaugeData, palette: VisualPalette, onHistoryOpen?: (key: GaugeMetricKey) => void, lifecycle?: LifecycleSink): HTMLElement;
