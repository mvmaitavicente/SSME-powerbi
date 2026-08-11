import { RenderCurveData, VisualPalette } from "../types";
interface CurveRenderOptions {
    portfolio?: boolean;
}
export declare function renderCurve(curve: RenderCurveData, palette: VisualPalette, options?: CurveRenderOptions): HTMLElement;
export {};
