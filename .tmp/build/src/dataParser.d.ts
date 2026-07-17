import powerbi from "powerbi-visuals-api";
import { DashboardData, ParsedDashboardData } from "./types";
export declare function parseDashboardData(dataView?: powerbi.DataView): DashboardData;
export declare function parseLegacyDataView(dataView?: powerbi.DataView): DashboardData;
export declare function parseDashboardJsonData(dataView?: powerbi.DataView): ParsedDashboardData | null;
