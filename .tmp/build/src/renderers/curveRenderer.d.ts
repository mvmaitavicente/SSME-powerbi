import { RenderCurveData, VisualPalette } from "../types";
import { LifecycleSink } from "../controllers/ViewLifecycle";
interface CurveRenderOptions {
    portfolio?: boolean;
    unit?: boolean;
    showYearBracket?: boolean;
}
export declare function renderCurve(curve: RenderCurveData, palette: VisualPalette, options?: CurveRenderOptions, lifecycle?: LifecycleSink): HTMLElement;
export {};
