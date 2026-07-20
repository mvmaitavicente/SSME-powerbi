"use strict";

import powerbi from "powerbi-visuals-api";
import { AggregateCurveData, AggregateGaugeData, CurrentSnapshot, CurveData, CurveHistoryPoint, CurveReferences, DashboardContextData, DashboardData, DashboardJsonPayload, DashboardLevel, DataValue, FieldValueMap, GaugeData, GaugeHistory, GaugeHistoryRow, JsonTablePayload, MilestoneItem, NavigatorData, NavigatorJsonPayload, NavigatorProject, ParsedDashboardData, ParserDebugData, PerformanceData, PortfolioSummary, ProjectData, ProjectHeader, RenderCurveData, RiskItem, SummaryData, UnitProjectSummaryData, UnitSummaryData } from "./types";

type DataViewTable = powerbi.DataViewTable;
type DataViewMetadataColumn = powerbi.DataViewMetadataColumn;

const headerFields = [
    "NombreIntervencion",
    "CUI",
    "Region",
    "UnidadGerencial",
    "EstadoProyecto",
    "FechaInicioPlan",
    "FechaFinPlan",
    "FechaEstado",
    "SemanaActual"
];

const curveFields = [
    "SemanaProyecto",
    "PV",
    "EV",
    "AC"
];

const curveReferenceFields = [
    "BAC",
    "SAC",
    "AT",
    "ES",
    "EACC",
    "EACT",
    "VACC",
    "VACT",
    "SPIT",
    "TSPIT"
];

const gaugeFields = [
    "CPI",
    "CPIEstado",
    "CPIVariacionSemanaAnterior",
    "SPI",
    "SPIEstado",
    "SPIVariacionSemanaAnterior",
    "TCPI",
    "TCPIEstado",
    "TCPIVariacionSemanaAnterior",
    "TSPI",
    "TSPIEstado",
    "TSPIVariacionSemanaAnterior"
];

const performanceFields = [
    "PlazoConsumidoPct",
    "PlazoRestanteSemanas",
    "PlazoProgramadoTotalSemanas",
    "PlazoProyectadoSemanas",
    "RetrasoProyectadoSemanas",
    "TerminoProyectado",
    "PresupuestoConsumidoPct",
    "PresupuestoRestante",
    "PresupuestoProgramadoBAC",
    "CostoEstimadoTerminoEAC",
    "SobreCostoProyectadoVAC",
    "SobreCostoProyectadoPct"
];

const riskFields = ["NivelRiesgo", "CantidadRiesgos", "PorcentajeRiesgos", "ImpactoPlazoSemanas", "ImpactoCosto"];
const milestoneFields = ["OrdenHito", "NombreHito", "FechaHitoPlan", "FechaHitoReal", "EstadoHito"];
const roleFieldMap: { [roleName: string]: string } = {
    proyectoNombreIntervencion: "NombreIntervencion",
    proyectoCui: "CUI",
    proyectoRegion: "Region",
    proyectoUnidadGerencial: "UnidadGerencial",
    proyectoEstado: "EstadoProyecto",
    proyectoFechaEstado: "FechaEstado",
    proyectoSemanaActual: "SemanaActual",
    curvaSemanaProyecto: "SemanaProyecto",
    curvaBAC: "BAC",
    curvaPV: "PV",
    curvaEV: "EV",
    curvaAC: "AC",
    curvaSAC: "SAC",
    curvaAT: "AT",
    curvaES: "ES",
    curvaEACC: "EACC",
    curvaEACT: "EACT",
    curvaVACC: "VACC",
    curvaVACT: "VACT",
    curvaSPIT: "SPIT",
    curvaTSPIT: "TSPIT",
    gaugeCPI: "CPI",
    gaugeSPIW: "SPI",
    gaugeTCPI: "TCPI",
    gaugeTSPIW: "TSPI",
    gaugeCPIEstado: "CPIEstado",
    gaugeSPIEstado: "SPIEstado",
    gaugeTCPIEstado: "TCPIEstado",
    gaugeTSPIEstado: "TSPIEstado",
    gaugeCPIVariacion: "CPIVariacionSemanaAnterior",
    gaugeSPIVariacion: "SPIVariacionSemanaAnterior",
    gaugeTCPIVariacion: "TCPIVariacionSemanaAnterior",
    gaugeTSPIVariacion: "TSPIVariacionSemanaAnterior",
    desempenoPlazoConsumido: "PlazoConsumidoPct",
    desempenoPlazoRestante: "PlazoRestanteSemanas",
    desempenoPlazoProgramadoTotal: "PlazoProgramadoTotalSemanas",
    desempenoPlazoProyectado: "PlazoProyectadoSemanas",
    desempenoRetrasoProyectado: "RetrasoProyectadoSemanas",
    desempenoTerminoProyectado: "TerminoProyectado",
    desempenoPresupuestoConsumido: "PresupuestoConsumidoPct",
    desempenoPresupuestoRestante: "PresupuestoRestante",
    desempenoPresupuestoProgramado: "PresupuestoProgramadoBAC",
    desempenoCostoEstimadoTerminoEAC: "CostoEstimadoTerminoEAC",
    desempenoSobreCostoProyectadoVAC: "SobreCostoProyectadoVAC",
    desempenoPorcentajeSobreCosto: "SobreCostoProyectadoPct",
    riesgoNivel: "NivelRiesgo",
    riesgoCantidad: "CantidadRiesgos",
    riesgoPorcentaje: "PorcentajeRiesgos",
    riesgoImpactoPlazo: "ImpactoPlazoSemanas",
    riesgoImpactoCosto: "ImpactoCosto",
    hitoOrden: "OrdenHito",
    hitoNombre: "NombreHito",
    hitoFechaPlan: "FechaHitoPlan",
    hitoFechaReal: "FechaHitoReal",
    hitoEstado: "EstadoHito"
};

export function parseDashboardData(dataView?: powerbi.DataView): DashboardData {
    const jsonDashboard = parseDashboardJsonData(dataView);
    if (jsonDashboard?.context.Level === "PROYECTO" && jsonDashboard.project && jsonDashboard.gauges.length && jsonDashboard.curve.length) {
        console.debug("Dashboard JSON parseado", {
            idIntervencion: jsonDashboard.idIntervencion,
            project: jsonDashboard.project,
            gaugeRows: jsonDashboard.gauges.length,
            curveRows: jsonDashboard.curve.length,
            currentCurveRow: getCurrentCurveRow(jsonDashboard.curve)
        });
        console.log(jsonDashboard.project);
        console.log(jsonDashboard.gauges);
        console.log(jsonDashboard.curve);
        console.log("Gauge History CPI", jsonDashboard.gauges.map((row) => row.CPI).filter((value): value is number => value !== null));
        console.log("Gauge History SPI", jsonDashboard.gauges.map((row) => row["SPI (w)"]).filter((value): value is number => value !== null));
        console.log("Gauge History TCPI", jsonDashboard.gauges.map((row) => row.TCPI).filter((value): value is number => value !== null));
        console.log("Gauge History TSPI", jsonDashboard.gauges.map((row) => row["TSPI (w)"]).filter((value): value is number => value !== null));
        console.log("Current Curve", getCurrentCurveRow(jsonDashboard.curve));
        return adaptJsonDashboardData(jsonDashboard);
    }

    return parseLegacyDataView(dataView);
}

export function parseLegacyDataView(dataView?: powerbi.DataView): DashboardData {
    const rows = mapRows(dataView?.table);
    const curveHistory = mergeCurveHistoryRows(
        rows
            .map((row) => pick<CurveHistoryPoint>(row, curveFields))
            .filter((row) => hasRealValue(row.SemanaProyecto))
    );
    const curveReferences = buildCurveReferences(rows);
    const currentCurvePoint = selectCurrentCurvePoint(curveHistory, curveReferences.AT);
    const curve: RenderCurveData = {
        history: curveHistory,
        current: currentCurvePoint ?? {},
        references: curveReferences
    };
    const current: CurrentSnapshot = { ...curveReferences, ...currentCurvePoint };
    const currentGaugeRow = selectCurrentGaugeRow(rows, curveReferences.AT);
    const currentGauge = currentGaugeRow ? pickCurrentGaugeSnapshot(currentGaugeRow) : {};
    const gaugeHistory = buildGaugeHistory(rows, curveReferences.AT);
    const header = pickFirst<ProjectHeader>(rows, headerFields);
    const performance = buildPerformanceData(rows, curveReferences.AT);
    const risks = uniqueBy(
        rows.map((row) => pick<RiskItem>(row, riskFields)).filter((row) => hasAny(row, riskFields)),
        (row) => [row.NivelRiesgo, row.CantidadRiesgos, row.PorcentajeRiesgos, row.ImpactoPlazoSemanas, row.ImpactoCosto].join("|")
    );
    const milestones = uniqueBy(
        rows.map((row) => pick<MilestoneItem>(row, milestoneFields)).filter((row) => hasAny(row, milestoneFields)),
        (row) => [row.OrdenHito, row.NombreHito, row.FechaHitoPlan, row.FechaHitoReal, row.EstadoHito].join("|")
    );

    return {
        header,
        current,
        gauges: buildGauges(currentGauge, gaugeHistory),
        curve,
        performance,
        risks,
        milestones,
        hasData: rows.length > 0
    };
}

function normalizeJsonHeader(header: string): string {
    const trimmed = header.trim();
    const bracketMatch = trimmed.match(/\[([^\]]+)\]\s*$/);

    if (bracketMatch?.[1]) {
        return bracketMatch[1].trim();
    }

    return trimmed
        .replace(/^['"]|['"]$/g, "")
        .trim();
}

function jsonTableToObjects<T extends Record<string, unknown>>(table: JsonTablePayload): T[] {
    if (!table || !Array.isArray(table.header) || !Array.isArray(table.data)) {
        return [];
    }

    const keys = table.header.map((header) => normalizeJsonHeader(String(header)));

    return table.data.map((row) => {
        const result: Record<string, unknown> = {};

        keys.forEach((key, index) => {
            result[key] = row[index] ?? null;
        });

        return result as T;
    });
}

function parseNavigatorPayload(rawNavigator: unknown): NavigatorData {
    if (typeof rawNavigator !== "string" || rawNavigator.trim() === "") {
        return { projects: [] };
    }

    try {
        const payload = JSON.parse(rawNavigator) as NavigatorJsonPayload;
        const projects = payload.projects ? jsonTableToObjects<NavigatorProject>(payload.projects) : [];
        validateJsonTableRowCount(payload.projects, "JSON Navigator projects");

        return {
            schemaVersion: payload.schemaVersion,
            projects
        };
    } catch (error) {
        console.warn("No se pudo interpretar JSON Navigator.", error);
        return { projects: [] };
    }
}

function parseDashboardContext(contextTable?: JsonTablePayload): DashboardContextData {
    return parseDashboardContextWithDebug(contextTable).context;
}

function parseDashboardContextWithDebug(contextTable?: JsonTablePayload): { context: DashboardContextData; rawContextLevel: string; normalizedContextLevel: DashboardLevel } {
    validateJsonTableRowCount(contextTable, "JSON Dashboard context");

    if (!contextTable) {
        return {
            context: defaultDashboardContext("PRONIED"),
            rawContextLevel: "",
            normalizedContextLevel: "PRONIED"
        };
    }

    const rows = jsonTableToObjects<Record<string, unknown>>(contextTable);
    const contextRow = rows[0] ?? {};
    const rawContextLevelValue = firstKnownValue(contextRow, "Level", "Nivel");
    const rawContextLevel = String(rawContextLevelValue ?? "");
    const level = normalizeDashboardLevel(rawContextLevelValue);

    return {
        context: {
            Level: level,
            AxisType: normalizeAxisType(firstKnownValue(contextRow, "AxisType", "TipoEje")),
            Unit: nullableText(firstKnownValue(contextRow, "Unit", "Unidad", "UnidadGerencial")),
            ProjectId: nullableText(firstKnownValue(contextRow, "ProjectId", "IdIntervencion", "ProyectoId")),
            Region: nullableText(firstKnownValue(contextRow, "Region")),
            Province: nullableText(firstKnownValue(contextRow, "Province", "Provincia")),
            District: nullableText(firstKnownValue(contextRow, "District", "Distrito")),
            Status: nullableText(firstKnownValue(contextRow, "Status", "Estado", "EstadoProyecto")),
            CutoffDate: nullableText(firstKnownValue(contextRow, "CutoffDate", "FechaCorte", "FechaEstado"))
        },
        rawContextLevel,
        normalizedContextLevel: level
    };
}

function defaultDashboardContext(level: DashboardLevel): DashboardContextData {
    return {
        Level: level,
        Unit: null,
        ProjectId: null,
        Region: null,
        Province: null,
        District: null,
        Status: null,
        CutoffDate: null
    };
}

function normalizeAxisType(value: unknown): "CALENDAR_PERIOD" | "PROJECT_WEEK" | undefined {
    const normalized = textValue(value).trim().toUpperCase();
    if (normalized === "CALENDAR_PERIOD" || normalized === "PROJECT_WEEK") {
        return normalized;
    }
    return undefined;
}

function normalizeDashboardLevel(value: unknown): DashboardLevel {
    const normalized =
        typeof value === "string"
            ? value.trim().toUpperCase()
            : "";

    switch (normalized) {
        case "PRONIED":
            return "PRONIED";

        case "UNIDAD":
            return "UNIDAD";

        case "PROYECTO":
            return "PROYECTO";

        default:
            return "PRONIED";
    }
}

function validateJsonTableRowCount(table: JsonTablePayload | undefined, label: string): void {
    if (table && table.rowCount !== table.data.length) {
        console.warn(`${label}: rowCount no coincide con data.length.`);
    }
}

function getRoleIndex(dataView: powerbi.DataView, roleName: string): number {
    const columns = dataView.table?.columns ?? [];
    return columns.findIndex((column) => column.roles?.[roleName] === true);
}

interface ParserRoleDebugInput {
    navigatorRoleIndex: number | null;
    jsonDashboardRoleIndex: number | null;
    jsonDashboardDisplayName: string | null;
    jsonDashboardQueryName: string | null;
    dataViewRowCount: number | null;
    rowIndexUsed: number | null;
}

interface ParserDebugInput extends ParserRoleDebugInput {
    rawContextLevel: string;
    normalizedContextLevel: DashboardLevel;
    rawDashboardLength: number;
    rawDashboardPreview: string;
    directContextObject: string;
    directRawLevel: string;
    directNormalizedLevel: DashboardLevel;
    contextAfterParse: string;
    beforeLegacyLevel: string | null;
    legacyParsedLevel: string | null;
    legacyContextLevel: string | null;
    legacyParsedObject: string;
    parserUsed: string;
    fallbackUsed: boolean;
    cachedDashboardUsed: boolean;
}

type ParserDebugBase = Omit<ParserDebugInput, "beforeLegacyLevel" | "legacyParsedLevel" | "legacyContextLevel" | "legacyParsedObject" | "parserUsed" | "fallbackUsed" | "cachedDashboardUsed">;

export function parseDashboardJsonData(dataView?: powerbi.DataView): ParsedDashboardData | null {
    const table = dataView?.table;

    if (!dataView || !table || table.rows.length === 0) {
        return null;
    }

    const navigatorIndex = getRoleIndex(dataView, "jsonNavigator");
    const jsonIndex = getRoleIndex(dataView, "jsonDashboard");

    if (navigatorIndex >= 0 && jsonIndex >= 0) {
        for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
            const row = table.rows[rowIndex];
            const parsed = parseNavigatorDashboardRow(row, navigatorIndex, jsonIndex, {
                navigatorRoleIndex: navigatorIndex,
                jsonDashboardRoleIndex: jsonIndex,
                jsonDashboardDisplayName: table.columns[jsonIndex]?.displayName ?? null,
                jsonDashboardQueryName: table.columns[jsonIndex]?.queryName ?? null,
                dataViewRowCount: table.rows.length,
                rowIndexUsed: rowIndex
            });
            if (parsed) {
                return parsed;
            }
        }

        return null;
    }

    const idIndex = getRoleIndex(dataView, "idIntervencion");

    if (idIndex < 0 || jsonIndex < 0) {
        return null;
    }

    if (table.rows.length > 1) {
        console.warn("Se recibieron varias intervenciones. El visual utilizará la primera fila válida.");
    }

    for (const row of table.rows) {
        const parsed = parseDashboardJsonRow(row, idIndex, jsonIndex);
        if (parsed) {
            return parsed;
        }
    }

    return null;
}

function parseNavigatorDashboardRow(
    row: powerbi.DataViewTableRow,
    navigatorIndex: number,
    jsonIndex: number,
    roleDebug: ParserRoleDebugInput
): ParsedDashboardData | null {
    const rawNavigator = row[navigatorIndex];
    const rawDashboard = row[jsonIndex];

    if (typeof rawDashboard !== "string" || rawDashboard.trim() === "") {
        return null;
    }

    try {
        const navigator = parseNavigatorPayload(rawNavigator);
        const payload = JSON.parse(rawDashboard) as DashboardJsonPayload;
        const directContextRows = payload.context ? jsonTableToObjects<Record<string, unknown>>(payload.context) : [];
        const directContextRow = directContextRows[0] ?? {};
        const directRawLevelValue = firstKnownValue(directContextRow, "Level", "Nivel");
        const directRawLevel = String(directRawLevelValue ?? "");
        const directNormalizedLevel = normalizeDashboardLevel(directRawLevelValue);
        const contextDebug = parseDashboardContextWithDebug(payload.context);
        const debugBase: ParserDebugBase = {
            ...roleDebug,
            rawContextLevel: contextDebug.rawContextLevel,
            normalizedContextLevel: contextDebug.normalizedContextLevel,
            rawDashboardLength: rawDashboard.length,
            rawDashboardPreview: rawDashboard.slice(0, 800),
            directContextObject: JSON.stringify(directContextRow, null, 2),
            directRawLevel,
            directNormalizedLevel,
            contextAfterParse: JSON.stringify(contextDebug.context, null, 2)
        };

        switch (contextDebug.context.Level) {
            case "PRONIED":
                return parseProniedDashboardPayload(payload, contextDebug.context, navigator, debugBase);
            case "UNIDAD":
                return parseUnitDashboardPayload(payload, contextDebug.context, navigator, debugBase);
            case "PROYECTO":
                return parseProjectDashboardPayload(payload, contextDebug.context, navigator, debugBase);
            default:
                return null;
        }
    } catch (error) {
        console.error("No se pudo interpretar JSON Navigator/Dashboard.", error);
        return null;
    }
}

function parseProniedDashboardPayload(
    payload: DashboardJsonPayload,
    context: DashboardContextData,
    navigator: NavigatorData,
    debugBase: ParserDebugBase
): ParsedDashboardData | null {
    return parseDashboardPayload(payload, context.ProjectId || "__json_dashboard__", context, navigator, {
        ...debugBase,
        beforeLegacyLevel: null,
        legacyParsedLevel: null,
        legacyContextLevel: null,
        legacyParsedObject: "",
        parserUsed: "parseProniedDashboardPayload",
        fallbackUsed: false,
        cachedDashboardUsed: false
    });
}

function parseUnitDashboardPayload(
    payload: DashboardJsonPayload,
    context: DashboardContextData,
    navigator: NavigatorData,
    debugBase: ParserDebugBase
): ParsedDashboardData | null {
    return parseDashboardPayload(payload, context.ProjectId || "__json_dashboard__", context, navigator, {
        ...debugBase,
        beforeLegacyLevel: null,
        legacyParsedLevel: null,
        legacyContextLevel: null,
        legacyParsedObject: "",
        parserUsed: "parseUnitDashboardPayload",
        fallbackUsed: false,
        cachedDashboardUsed: false
    });
}

function parseProjectDashboardPayload(
    payload: DashboardJsonPayload,
    context: DashboardContextData,
    navigator: NavigatorData,
    debugBase: ParserDebugBase
): ParsedDashboardData | null {
    const parsed = parseDashboardPayload(payload, context.ProjectId || "__json_dashboard__", context, navigator, {
        ...debugBase,
        beforeLegacyLevel: context.Level,
        legacyParsedLevel: null,
        legacyContextLevel: null,
        legacyParsedObject: "",
        parserUsed: "parseProjectDashboardPayload",
        fallbackUsed: false,
        cachedDashboardUsed: false
    });
    const legacyParsedLevel = readLegacyParsedLevel(parsed);
    return parsed ? {
        ...parsed,
        debug: parsed.debug
            ? {
                ...parsed.debug,
                legacyParsedLevel
            }
            : undefined
    } : null;
}

function parseDashboardJsonRow(row: powerbi.DataViewTableRow, idIndex: number, jsonIndex: number): ParsedDashboardData | null {
    const idIntervencion = String(row[idIndex] ?? "").trim();
    const rawJson = row[jsonIndex];

    if (!idIntervencion || typeof rawJson !== "string" || rawJson.trim() === "") {
        return null;
    }

    try {
        const payload = JSON.parse(rawJson) as DashboardJsonPayload;
        const directContextRows = payload.context ? jsonTableToObjects<Record<string, unknown>>(payload.context) : [];
        const directContextRow = directContextRows[0] ?? {};
        const directRawLevelValue = firstKnownValue(directContextRow, "Level", "Nivel");
        const contextDebug = parseDashboardContextWithDebug(payload.context);
        return parseDashboardPayload(payload, idIntervencion, contextDebug.context, undefined, {
            rawContextLevel: contextDebug.rawContextLevel,
            normalizedContextLevel: contextDebug.normalizedContextLevel,
            rawDashboardLength: rawJson.length,
            rawDashboardPreview: rawJson.slice(0, 800),
            directContextObject: JSON.stringify(directContextRow, null, 2),
            directRawLevel: String(directRawLevelValue ?? ""),
            directNormalizedLevel: normalizeDashboardLevel(directRawLevelValue),
            contextAfterParse: JSON.stringify(contextDebug.context, null, 2),
            beforeLegacyLevel: contextDebug.context.Level,
            legacyParsedLevel: null,
            legacyContextLevel: null,
            legacyParsedObject: "",
            parserUsed: "parseDashboardJsonRow",
            fallbackUsed: true,
            cachedDashboardUsed: false,
            navigatorRoleIndex: null,
            jsonDashboardRoleIndex: jsonIndex,
            jsonDashboardDisplayName: null,
            jsonDashboardQueryName: null,
            dataViewRowCount: null,
            rowIndexUsed: null
        });
    } catch (error) {
        console.error("No se pudo interpretar JSON Dashboard.", error);
        return null;
    }
}

function parseDashboardPayload(
    payload: DashboardJsonPayload,
    idIntervencion: string,
    context: DashboardContextData,
    navigator?: NavigatorData,
    debugInput?: ParserDebugInput
): ParsedDashboardData | null {
    if (!validateDashboardPayload(payload, context.Level)) {
        console.warn(`El JSON Dashboard no contiene los bloques requeridos para ${context.Level}.`);
        return null;
    }

    const summaryRows = payload.summary ? jsonTableToObjects<Record<string, unknown>>(payload.summary) : [];
    const portfolioSummaryRows = payload.portfolioSummary
        ? jsonTableToObjects<Record<string, unknown>>(payload.portfolioSummary)
        : [];
    const projectRows = payload.project ? jsonTableToObjects<ProjectData>(payload.project) : [];
    const gaugeRows = payload.gauges ? jsonTableToObjects<Record<string, unknown>>(payload.gauges) : [];
    const curveRows = payload.curve ? jsonTableToObjects<Record<string, unknown>>(payload.curve) : [];
    const unitRows = payload.units ? jsonTableToObjects<Record<string, unknown>>(payload.units) : [];
    const projectSummaryRows = payload.projects ? jsonTableToObjects<Record<string, unknown>>(payload.projects) : [];
    const riskRows = payload.risks ? jsonTableToObjects<Record<string, unknown>>(payload.risks) : [];
    const milestoneRows = payload.milestone || payload.milestones
        ? jsonTableToObjects<Record<string, unknown>>((payload.milestone || payload.milestones) as JsonTablePayload)
        : [];

    validateJsonTableRowCount(payload.summary, "JSON summary");
    validateJsonTableRowCount(payload.portfolioSummary, "JSON portfolioSummary");
    validateJsonTableRowCount(payload.project, "JSON project");
    validateJsonTableRowCount(payload.gauges, "JSON gauges");
    validateJsonTableRowCount(payload.curve, "JSON curve");
    validateJsonTableRowCount(payload.units, "JSON units");
    validateJsonTableRowCount(payload.projects, "JSON projects");
    validateJsonTableRowCount(payload.risks, "JSON risks");

    const milestonePayload = payload.milestone || payload.milestones;
    validateJsonTableRowCount(milestonePayload, "JSON milestone");

    const normalizedGauges = gaugeRows
        .map(normalizeJsonGauge)
        .sort((a, b) => a.Semana - b.Semana);

    const normalizedCurve = curveRows
        .map(normalizeJsonCurve)
        .sort((a, b) => a.Semana - b.Semana);
    const normalizedAggregateGauges = gaugeRows.map(normalizeAggregateGauge).sort((a, b) => a.OrdenSemana - b.OrdenSemana);
    const normalizedAggregateCurve = curveRows.map(normalizeAggregateCurve).sort((a, b) => a.OrdenSemana - b.OrdenSemana);
    const normalizedUnits = unitRows.map(normalizeUnitSummary);
    const normalizedProjects = projectSummaryRows.map(normalizeUnitProjectSummary);

    const normalizedRisks = riskRows.map(normalizeJsonRisk).filter((item) => hasAny(item as FieldValueMap, riskFields));
    const normalizedMilestones = milestoneRows
        .map(normalizeJsonMilestone)
        .filter((item) => hasAny(item as FieldValueMap, milestoneFields))
        .sort((a, b) => (toNullableNumber(a.OrdenHito) ?? 0) - (toNullableNumber(b.OrdenHito) ?? 0));

    const debug: ParserDebugData | undefined = debugInput
        ? {
            rawContextLevel: debugInput.rawContextLevel,
            normalizedContextLevel: debugInput.normalizedContextLevel,
            contextLevelAfterParse: context.Level,
            rawDashboardLength: debugInput.rawDashboardLength,
            rawDashboardPreview: debugInput.rawDashboardPreview,
            directContextObject: debugInput.directContextObject,
            directRawLevel: debugInput.directRawLevel,
            directNormalizedLevel: debugInput.directNormalizedLevel,
            contextAfterParse: debugInput.contextAfterParse,
            beforeLegacyLevel: debugInput.beforeLegacyLevel,
            legacyParsedLevel: debugInput.legacyParsedLevel,
            legacyContextLevel: debugInput.legacyContextLevel,
            legacyParsedObject: debugInput.legacyParsedObject,
            finalContextLevel: context.Level,
            finalParsedPreview: "",
            parserUsed: debugInput.parserUsed,
            fallbackUsed: debugInput.fallbackUsed,
            cachedDashboardUsed: debugInput.cachedDashboardUsed,
            jsonDashboardRoleIndex: debugInput.jsonDashboardRoleIndex,
            jsonDashboardDisplayName: debugInput.jsonDashboardDisplayName,
            jsonDashboardQueryName: debugInput.jsonDashboardQueryName,
            navigatorRoleIndex: debugInput.navigatorRoleIndex,
            dataViewRowCount: debugInput.dataViewRowCount,
            rowIndexUsed: debugInput.rowIndexUsed
        }
        : undefined;

    const finalParsed: ParsedDashboardData = {
        idIntervencion,
        schemaVersion: payload.schemaVersion,
        context,
        debug,
        navigator,
        summary: normalizeSummary(summaryRows[0] ?? null),
        portfolioSummary: normalizePortfolioSummary(portfolioSummaryRows[0] ?? null),
        project: normalizeProjectData(projectRows[0] ?? null),
        gauges: normalizedGauges,
        curve: normalizedCurve,
        aggregateGauges: normalizedAggregateGauges,
        aggregateCurve: normalizedAggregateCurve,
        units: normalizedUnits,
        projects: normalizedProjects,
        risks: normalizedRisks,
        milestones: normalizedMilestones
    };

    if (finalParsed.debug) {
        finalParsed.debug.finalParsedPreview = JSON.stringify(finalParsed, null, 2).slice(0, 2000);
    }

    return finalParsed;
}

function normalizePortfolioSummary(row: Record<string, unknown> | null): PortfolioSummary | null {
    if (!row) {
        return null;
    }

    return {
        activeProjects: readNullableNumber(row, ["ActiveProjects"]),
        projects: readNullableNumber(row, ["Projects"]),
        interventions: readNullableNumber(row, ["Interventions"]),
        institutionalBudget: readNullableNumber(row, ["InstitutionalBudget"]),
        projectedBudget: readNullableNumber(row, ["ProjectedBudget"]),
        interventionBudget: readNullableNumber(row, ["InterventionBudget"]),
        scheduleDeviation: readNullableNumber(row, ["ScheduleDeviation"]),
        costDeviation: readNullableNumber(row, ["CostDeviation"]),
        criticalInterventions: readNullableNumber(row, ["CriticalInterventions"]),
        portfolioRisk: readNullableNumber(row, ["PortfolioRisk"])
    };
}

function readLegacyParsedLevel(parsed: ParsedDashboardData | null): string | null {
    if (!parsed) {
        return null;
    }

    const candidate = parsed as ParsedDashboardData & {
        level?: unknown;
        dashboardLevel?: unknown;
        currentLevel?: unknown;
        view?: unknown;
        viewType?: unknown;
    };
    const legacyValue = candidate.level
        ?? candidate.dashboardLevel
        ?? candidate.currentLevel
        ?? candidate.view
        ?? candidate.viewType
        ?? null;

    return legacyValue === null || legacyValue === undefined ? null : String(legacyValue);
}

function validateDashboardPayload(payload: DashboardJsonPayload, level: DashboardLevel): boolean {
    if (!payload.context || !payload.summary) {
        return false;
    }

    if (level === "PRONIED") {
        return Boolean(payload.gauges && payload.curve && payload.units);
    }

    if (level === "UNIDAD") {
        return Boolean(payload.gauges && payload.curve && payload.projects);
    }

    if (level === "PROYECTO") {
        return Boolean(payload.project && payload.gauges && payload.curve);
    }

    return false;
}

function normalizeSummary(row: Record<string, unknown> | null): SummaryData | null {
    if (!row) {
        return null;
    }

    return {
        CantidadProyectos: readNullableNumber(row, ["CantidadProyectos", "Cantidad Proyectos", "Proyectos"]),
        BAC: readNullableNumber(row, ["BAC"]),
        PV: readNullableNumber(row, ["PV"]),
        EV: readNullableNumber(row, ["EV"]),
        AC: readNullableNumber(row, ["AC"]),
        CPI: readNullableNumber(row, ["CPI"]),
        SPIW: readNullableNumber(row, ["SPIW", "SPI (w)", "SPI"]),
        TCPI: readNullableNumber(row, ["TCPI"]),
        TSPIW: readNullableNumber(row, ["TSPIW", "TSPI (w)", "TSPI"]),
        SPIT: readNullableNumber(row, ["SPIT", "SPI (t)"]),
        TSPIT: readNullableNumber(row, ["TSPIT", "TSPI (t)"]),
        EACC: readNullableNumber(row, ["EACC", "EAC (c)"]),
        EACT: readNullableNumber(row, ["EACT", "EAC (t)"]),
        VACC: readNullableNumber(row, ["VACC", "VAC (c)"]),
        VACT: readNullableNumber(row, ["VACT", "VAC (t)"])
    };
}

function normalizeJsonGauge(row: Record<string, unknown>): GaugeHistoryRow {
    return {
        ...row,
        Semana: readFiniteNumber(row, ["Semana", "OrdenSemana", "OrdenSemanaEV"], 0),
        CPI: readNullableNumber(row, ["CPI"]),
        "SPI (w)": readNullableNumber(row, ["SPI (w)", "SPI (W)", "SPIw", "SPIW", "SPI"]),
        TCPI: readNullableNumber(row, ["TCPI"]),
        "TSPI (w)": readNullableNumber(row, ["TSPI (w)", "TSPI (W)", "TSPIw", "TSPIW", "TSPI"]),
        CPIEstado: textValue(firstKnownValue(row, "CPIestado", "CPIEstado", "CPI Estado")),
        SPIEstado: textValue(firstKnownValue(row, "SPIestado", "SPIEstado", "SPI Estado", "SPI (w) Estado")),
        TCPIEstado: textValue(firstKnownValue(row, "TCPIestado", "TCPIEstado", "TCPI Estado")),
        TSPIEstado: textValue(firstKnownValue(row, "TSPIestado", "TSPIEstado", "TSPI Estado", "TSPI (w) Estado"))
    };
}

function normalizeJsonCurve(row: Record<string, unknown>): CurveData {
    return {
        ...row,
        Semana: readFiniteNumber(row, ["Semana", "OrdenSemana", "OrdenSemanaEV"], 0),
        BAC: readNullableNumber(row, ["BAC"]),
        SAC: readNullableNumber(row, ["SAC"]),
        ES: readNullableNumber(row, ["ES"]),
        AT: readNullableNumber(row, ["AT"]),
        PV: readNullableNumber(row, ["PV"]),
        EV: readNullableNumber(row, ["EV"]),
        AC: readNullableNumber(row, ["AC"]),
        "SPI (t)": readNullableNumber(row, ["SPI (t)", "SPIT"]),
        "TSPI (t)": readNullableNumber(row, ["TSPI (t)", "TSPIT"]),
        "EAC (c)": readNullableNumber(row, ["EAC (c)", "EACC"]),
        "EAC (t)": readNullableNumber(row, ["EAC (t)", "EACT"]),
        "VAC (c)": readNullableNumber(row, ["VAC (c)", "VACC"]),
        "VAC (t)": readNullableNumber(row, ["VAC (t)", "VACT"])
    };
}

function normalizeAggregateGauge(row: Record<string, unknown>): AggregateGaugeData {
    return {
        ...row,
        OrdenSemana: readFiniteNumber(row, ["OrdenSemana", "OrdenSemanaEV", "Semana"], 0),
        FechaInicioSemana: nullableText(firstKnownValue(row, "FechaInicioSemana")),
        FechaFinSemana: nullableText(firstKnownValue(row, "FechaFinSemana")),
        LabelSemana: textValue(firstKnownValue(row, "LabelSemana", "SemanaLabel", "Semana")),
        CPI: readNullableNumber(row, ["CPI"]),
        SPIW: readNullableNumber(row, ["SPIW", "SPI (w)", "SPI"]),
        TCPI: readNullableNumber(row, ["TCPI"]),
        TSPIW: readNullableNumber(row, ["TSPIW", "TSPI (w)", "TSPI"])
    };
}

function normalizeAggregateCurve(row: Record<string, unknown>): AggregateCurveData {
    return {
        ...row,
        OrdenSemana: readFiniteNumber(row, ["OrdenSemana", "OrdenSemanaEV", "Semana"], 0),
        FechaInicioSemana: nullableText(firstKnownValue(row, "FechaInicioSemana")),
        FechaFinSemana: nullableText(firstKnownValue(row, "FechaFinSemana")),
        LabelSemana: textValue(firstKnownValue(row, "LabelSemana", "SemanaLabel", "Semana")),
        BAC: readNullableNumber(row, ["BAC"]),
        SAC: readNullableNumber(row, ["SAC"]),
        ES: readNullableNumber(row, ["ES"]),
        AT: readNullableNumber(row, ["AT"]),
        PV: readNullableNumber(row, ["PV"]),
        EV: readNullableNumber(row, ["EV"]),
        AC: readNullableNumber(row, ["AC"]),
        CPI: readNullableNumber(row, ["CPI"]),
        SPIW: readNullableNumber(row, ["SPIW", "SPI (w)", "SPI"]),
        TSPIT: readNullableNumber(row, ["TSPIT", "TSPI (t)"]),
        EACC: readNullableNumber(row, ["EACC", "EAC (c)"]),
        EACT: readNullableNumber(row, ["EACT", "EAC (t)"]),
        VACC: readNullableNumber(row, ["VACC", "VAC (c)"]),
        VACT: readNullableNumber(row, ["VACT", "VAC (t)"])
    };
}

function normalizeUnitSummary(row: Record<string, unknown>): UnitSummaryData {
    return {
        ...row,
        UnidadGerencial: textValue(firstKnownValue(row, "UnidadGerencial", "Unidad")),
        CantidadProyectos: readNullableNumber(row, ["CantidadProyectos", "Cantidad Proyectos", "Proyectos"]),
        BAC: readNullableNumber(row, ["BAC"]),
        PV: readNullableNumber(row, ["PV"]),
        EV: readNullableNumber(row, ["EV"]),
        AC: readNullableNumber(row, ["AC"]),
        CPI: readNullableNumber(row, ["CPI"]),
        SPIW: readNullableNumber(row, ["SPIW", "SPI (w)", "SPI"]),
        TCPI: readNullableNumber(row, ["TCPI"])
    };
}

function normalizeUnitProjectSummary(row: Record<string, unknown>): UnitProjectSummaryData {
    return {
        ...row,
        IdIntervencion: textValue(firstKnownValue(row, "IdIntervencion", "ProjectId")),
        NombreIntervencion: textValue(firstKnownValue(row, "NombreIntervencion", "Proyecto")),
        Cui: textOrNumberValue(firstKnownValue(row, "Cui", "CUI")),
        UnidadGerencial: textValue(firstKnownValue(row, "UnidadGerencial", "Unidad")),
        Region: textValue(firstKnownValue(row, "Region")),
        Provincia: textValue(firstKnownValue(row, "Provincia", "Province")),
        Distrito: textValue(firstKnownValue(row, "Distrito", "District")),
        EstadoProyecto: textValue(firstKnownValue(row, "EstadoProyecto", "Estado", "Status")),
        BAC: readNullableNumber(row, ["BAC"]),
        PV: readNullableNumber(row, ["PV"]),
        EV: readNullableNumber(row, ["EV"]),
        AC: readNullableNumber(row, ["AC"]),
        CPI: readNullableNumber(row, ["CPI"]),
        SPIW: readNullableNumber(row, ["SPIW", "SPI (w)", "SPI"]),
        TCPI: readNullableNumber(row, ["TCPI"])
    };
}

function normalizeProjectData(project: ProjectData | null): ProjectData | null {
    if (!project) {
        return null;
    }

    return {
        ...project,
        IdIntervencion: textValue(project.IdIntervencion),
        NombreIntervencion: textValue(project.NombreIntervencion),
        Cui: textOrNumberValue(project.Cui),
        Region: textValue(project.Region),
        Provincia: textValue(project.Provincia),
        Distrito: textValue(project.Distrito),
        UnidadGerencial: textValue(project.UnidadGerencial),
        EstadoProyecto: textValue(project.EstadoProyecto),
        MensajeEjecutivo: textValue(project.MensajeEjecutivo),
        FechaEstado: nullableText(project.FechaEstado),
        SemanaActual: textOrNumberValue(project.SemanaActual)
    };
}

export function adaptJsonDashboardData(parsed: ParsedDashboardData): DashboardData {
    const currentRow = getCurrentCurveRow(parsed.curve);
    const currentGaugeRow = getCurrentGaugeRow(parsed.gauges);
    const project = parsed.project;
    const current: CurrentSnapshot = buildJsonCurrentSnapshot(project, currentRow, currentGaugeRow);
    const curve: RenderCurveData = {
        history: parsed.curve.map((row) => ({
            SemanaProyecto: row.Semana,
            PV: row.PV,
            EV: row.EV,
            AC: row.AC
        })),
        current: currentRow
            ? {
                SemanaProyecto: currentRow.Semana,
                PV: currentRow.PV,
                EV: currentRow.EV,
                AC: currentRow.AC
            }
            : {},
        references: {
            BAC: currentRow?.BAC,
            SAC: currentRow?.SAC,
            AT: currentRow?.AT,
            ES: currentRow?.ES,
            EACC: currentRow?.["EAC (c)"],
            EACT: currentRow?.["EAC (t)"],
            VACC: currentRow?.["VAC (c)"],
            VACT: currentRow?.["VAC (t)"],
            SPIT: currentRow?.["SPI (t)"],
            TSPIT: currentRow?.["TSPI (t)"],
            FechaEstado: project?.FechaEstado
        }
    };

    return {
        header: buildJsonHeader(project),
        current,
        gauges: buildJsonGauges(parsed.gauges),
        curve,
        performance: buildJsonPerformance(currentRow),
        risks: parsed.risks,
        milestones: parsed.milestones,
        hasData: parsed.project !== null && parsed.gauges.length > 0 && parsed.curve.length > 0
    };
}

function buildNonProjectPlaceholder(context: DashboardContextData): DashboardData {
    const header: ProjectHeader = {
        NombreIntervencion: context.Level === "UNIDAD" ? context.Unit ?? undefined : "PRONIED",
        UnidadGerencial: context.Unit ?? undefined,
        Region: context.Region ?? undefined,
        Provincia: context.Province ?? undefined,
        Distrito: context.District ?? undefined,
        EstadoProyecto: context.Status ?? undefined
    };

    return {
        header,
        current: header,
        gauges: [],
        curve: {
            history: [],
            current: {},
            references: {}
        },
        performance: {},
        risks: [],
        milestones: [],
        hasData: false
    };
}

function normalizeJsonRisk(row: Record<string, unknown>): RiskItem {
    return {
        NivelRiesgo: textValue(firstKnownValue(row, "NivelRiesgo")),
        CantidadRiesgos: toNullableNumber(firstKnownValue(row, "CantidadRiesgos", "Cantidad")),
        PorcentajeRiesgos: toNullableNumber(firstKnownValue(row, "PorcentajeRiesgos", "PorcentajeRiesgo", "% Total Riesgo")),
        ImpactoPlazoSemanas: toNullableNumber(firstKnownValue(row, "ImpactoPlazoSemanas", "ImpactoPlazo", "Impacto en plazo")),
        ImpactoCosto: toNullableNumber(firstKnownValue(row, "ImpactoCosto", "ImpactoCostoSoles", "Impacto en costo"))
    };
}

function normalizeJsonMilestone(row: Record<string, unknown>): MilestoneItem {
    return {
        OrdenHito: toNullableNumber(firstKnownValue(row, "OrdenHito", "Orden")),
        NombreHito: textValue(firstKnownValue(row, "NombreHito")),
        FechaHitoPlan: textOrNumberValue(firstKnownValue(row, "FechaHitoPlan", "FechaHito")),
        FechaHitoReal: textOrNumberValue(firstKnownValue(row, "FechaHitoReal")),
        EstadoHito: textValue(firstKnownValue(row, "EstadoHito", "SemaforoHito")),
        SemaforoHito: textValue(firstKnownValue(row, "SemaforoHito"))
    };
}

function buildJsonHeader(project: ProjectData | null): ProjectHeader {
    return {
        NombreIntervencion: project?.NombreIntervencion,
        CUI: project?.Cui === null || project?.Cui === undefined ? undefined : String(project.Cui),
        Region: project?.Region,
        Provincia: project?.Provincia,
        Distrito: project?.Distrito,
        UnidadGerencial: project?.UnidadGerencial,
        EstadoProyecto: project?.EstadoProyecto,
        MensajeEjecutivo: project?.MensajeEjecutivo,
        FechaEstado: project?.FechaEstado,
        SemanaActual: project?.SemanaActual
    };
}

function buildJsonCurrentSnapshot(project: ProjectData | null, currentRow: CurveData | null, currentGaugeRow: GaugeHistoryRow | null): CurrentSnapshot {
    const bac = currentRow?.BAC ?? null;
    const pv = currentRow?.PV ?? null;
    const ev = currentRow?.EV ?? null;
    const ac = currentRow?.AC ?? null;
    const spiT = currentRow?.["SPI (t)"] ?? null;
    const tspiT = currentRow?.["TSPI (t)"] ?? null;
    const eacC = currentRow?.["EAC (c)"] ?? null;
    const eacT = currentRow?.["EAC (t)"] ?? null;
    const vacC = currentRow?.["VAC (c)"] ?? null;
    const vacT = currentRow?.["VAC (t)"] ?? null;

    return {
        ...buildJsonHeader(project),
        SemanaProyecto: currentRow?.Semana,
        PV: pv,
        EV: ev,
        AC: ac,
        BAC: bac,
        SAC: currentRow?.SAC ?? null,
        AT: currentRow?.AT ?? null,
        ES: currentRow?.ES ?? null,
        EACC: eacC,
        EACT: eacT,
        VACC: vacC,
        VACT: vacT,
        CPI: currentGaugeRow?.CPI ?? null,
        CPIEstado: currentGaugeRow?.CPIEstado,
        SPI: currentGaugeRow?.["SPI (w)"] ?? null,
        SPIEstado: currentGaugeRow?.SPIEstado,
        SPIT: spiT,
        TCPI: currentGaugeRow?.TCPI ?? null,
        TCPIEstado: currentGaugeRow?.TCPIEstado,
        TSPI: currentGaugeRow?.["TSPI (w)"] ?? null,
        TSPIEstado: currentGaugeRow?.TSPIEstado,
        TSPIT: tspiT,
        PlazoConsumidoPct: ratio(currentRow?.AT ?? null, currentRow?.SAC ?? null),
        PlazoRestanteSemanas: difference(currentRow?.SAC ?? null, currentRow?.AT ?? null),
        PlazoProgramadoTotalSemanas: currentRow?.SAC ?? null,
        PlazoProyectadoSemanas: eacT,
        RetrasoProyectadoSemanas: vacT,
        PresupuestoConsumidoPct: ratio(ac, bac),
        PresupuestoRestante: difference(bac, ac),
        PresupuestoProgramadoBAC: bac,
        CostoEstimadoTerminoEAC: eacC,
        SobreCostoProyectadoVAC: vacC,
        SobreCostoProyectadoPct: ratio(vacC, bac)
    };
}

function buildJsonPerformance(currentRow: CurveData | null): PerformanceData {
    const bac = currentRow?.BAC ?? null;
    const ac = currentRow?.AC ?? null;
    const eacC = currentRow?.["EAC (c)"] ?? null;
    const eacT = currentRow?.["EAC (t)"] ?? null;
    const vacC = currentRow?.["VAC (c)"] ?? null;
    const vacT = currentRow?.["VAC (t)"] ?? null;

    return {
        PlazoConsumidoPct: ratio(currentRow?.AT ?? null, currentRow?.SAC ?? null),
        PlazoRestanteSemanas: difference(currentRow?.SAC ?? null, currentRow?.AT ?? null),
        PlazoProgramadoTotalSemanas: currentRow?.SAC ?? null,
        PlazoProyectadoSemanas: eacT,
        RetrasoProyectadoSemanas: vacT,
        PresupuestoConsumidoPct: ratio(ac, bac),
        PresupuestoRestante: difference(bac, ac),
        PresupuestoProgramadoBAC: bac,
        CostoEstimadoTerminoEAC: eacC,
        SobreCostoProyectadoVAC: vacC,
        SobreCostoProyectadoPct: ratio(vacC, bac)
    };
}

function getCurrentCurveRow(curve: CurveData[]): CurveData | null {
    if (curve.length === 0) {
        return null;
    }

    const at = curve.map((row) => row.AT).find((value) => value !== null) ?? null;

    if (at !== null) {
        const currentRow = curve.find((row) => row.Semana === at);

        if (currentRow) {
            return currentRow;
        }
    }

    return curve[curve.length - 1] ?? null;
}

function getCurrentGaugeRow(gauges: GaugeHistoryRow[]): GaugeHistoryRow | null {
    return gauges[gauges.length - 1] ?? null;
}

function buildJsonGauges(gauges: GaugeHistoryRow[]): GaugeData[] {
    const current = getCurrentGaugeRow(gauges);
    const sparkRows = windowJsonGaugeRows(gauges, current?.Semana ?? null);
    const history: GaugeHistory = {
        CPI: sparkRows.map((row) => row.CPI).filter((value): value is number => value !== null),
        SPIW: sparkRows.map((row) => row["SPI (w)"]).filter((value): value is number => value !== null),
        TCPI: sparkRows.map((row) => row.TCPI).filter((value): value is number => value !== null),
        TSPIW: sparkRows.map((row) => row["TSPI (w)"]).filter((value): value is number => value !== null)
    };

    return [
        gauge("CPI", lastValue(history.CPI), current?.CPIEstado, calculateGaugeVariation(history.CPI), history.CPI),
        gauge("SPIW", lastValue(history.SPIW), current?.SPIEstado, calculateGaugeVariation(history.SPIW), history.SPIW),
        gauge("TCPI", lastValue(history.TCPI), current?.TCPIEstado, calculateGaugeVariation(history.TCPI), history.TCPI),
        gauge("TSPIW", lastValue(history.TSPIW), current?.TSPIEstado, calculateGaugeVariation(history.TSPIW), history.TSPIW)
    ];
}

function windowJsonGaugeRows(gauges: GaugeHistoryRow[], currentWeek: number | null): GaugeHistoryRow[] {
    if (currentWeek === null) {
        return gauges;
    }
    const historyStartWeek = Math.max(0, currentWeek - 5);
    const filtered = gauges.filter((row) => row.Semana <= currentWeek && row.Semana >= historyStartWeek);
    return filtered.length ? filtered : gauges;
}

function lastValue(values: number[]): number | null {
    return values[values.length - 1] ?? null;
}

function calculateGaugeVariation(values: number[]): number | null {
    if (values.length < 2) {
        return null;
    }

    return values[values.length - 1] - values[values.length - 2];
}

function toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
}

function toFiniteNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : fallback;
}

function textValue(value: unknown): string {
    return value === null || value === undefined ? "" : String(value);
}

function nullableText(value: unknown): string | null {
    return value === null || value === undefined || value === "" ? null : String(value);
}

function textOrNumberValue(value: unknown): string | number | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    return typeof value === "number" || typeof value === "string" ? value : String(value);
}

function readNullableNumber(row: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(row, key)) {
            return toNullableNumber(row[key]);
        }
    }

    return null;
}

function readFiniteNumber(row: Record<string, unknown>, keys: string[], fallback: number): number {
    const value = readNullableNumber(row, keys);
    return value === null ? fallback : value;
}

function firstKnownValue(source: Record<string, unknown>, ...keys: string[]): unknown {
    for (const key of keys) {
        if (source[key] !== undefined) {
            return source[key];
        }
    }

    return null;
}

function ratio(numerator: number | null, denominator: number | null): number | null {
    if (numerator === null || denominator === null || denominator === 0) {
        return null;
    }

    return numerator / denominator;
}

function difference(left: number | null, right: number | null): number | null {
    if (left === null || right === null) {
        return null;
    }

    return left - right;
}

function mapRows(table?: DataViewTable): FieldValueMap[] {
    if (!table?.columns?.length || !table.rows?.length) {
        return [];
    }

    const fieldNames = table.columns.map(resolveFieldName);
    return table.rows.map((row) => {
        const mapped: FieldValueMap = {};
        row.forEach((value, index) => {
            const name = fieldNames[index];
            if (name) {
                mapped[name] = value;
            }
        });
        return mapped;
    });
}

function resolveFieldName(column: DataViewMetadataColumn): string {
    const roleName = Object.keys(column.roles ?? {}).find((role) => column.roles?.[role] && roleFieldMap[role]);
    return roleName ? roleFieldMap[roleName] : "";
}

function pick<T>(row: FieldValueMap, fields: string[]): T {
    return fields.reduce((target, field) => {
        (target as FieldValueMap)[field] = row[field];
        return target;
    }, {} as T);
}

function pickFirst<T>(rows: FieldValueMap[], fields: string[]): T {
    const target = {} as FieldValueMap;
    fields.forEach((field) => {
        const row = rows.find((candidate) => hasRealValue(candidate[field]));
        target[field] = row?.[field];
    });
    return target as T;
}

function pickWithFallback<T>(primary: FieldValueMap, rows: FieldValueMap[], fields: string[]): T {
    const target = {} as FieldValueMap;
    fields.forEach((field) => {
        if (hasRealValue(primary[field])) {
            target[field] = primary[field];
            return;
        }
        const row = rows.find((candidate) => hasRealValue(candidate[field]));
        target[field] = row?.[field];
    });
    return target as T;
}

function buildPerformanceData(rows: FieldValueMap[], at: DataValue): PerformanceData {
    const currentWeek = toNumber(at);
    const currentRow = currentWeek === null
        ? undefined
        : rows.find((row) => toNumber(row.SemanaProyecto) === currentWeek && hasAny(row, performanceFields));
    const target = {} as FieldValueMap;

    performanceFields.forEach((field) => {
        if (currentRow && hasRealValue(currentRow[field])) {
            target[field] = currentRow[field];
            return;
        }

        const row = rows.find((candidate) => hasRealValue(candidate[field]));
        target[field] = row?.[field];
    });

    const performance = target as PerformanceData;
    console.debug("Desempeno values", {
        porcentajeSobreCosto: performance.SobreCostoProyectadoPct,
        costoEstimadoTerminoEAC: performance.CostoEstimadoTerminoEAC,
        plazoConsumido: performance.PlazoConsumidoPct,
        plazoProgramadoTotal: performance.PlazoProgramadoTotalSemanas,
        plazoProyectado: performance.PlazoProyectadoSemanas,
        plazoRestante: performance.PlazoRestanteSemanas,
        presupuestoConsumido: performance.PresupuestoConsumidoPct,
        presupuestoProgramado: performance.PresupuestoProgramadoBAC,
        presupuestoRestante: performance.PresupuestoRestante,
        retrasoProyectado: performance.RetrasoProyectadoSemanas,
        sobreCostoProyectadoVAC: performance.SobreCostoProyectadoVAC,
        terminoProyectado: performance.TerminoProyectado
    });

    return performance;
}

function buildCurveReferences(rows: FieldValueMap[]): CurveReferences {
    const initial = pickFirst<CurveReferences>(rows, curveReferenceFields);
    const at = initial.AT;
    const currentRow = rows.find((row) => {
        const week = toNumber(row.SemanaProyecto);
        const currentWeek = toNumber(at);
        return week !== null && currentWeek !== null && week === currentWeek;
    });
    const target = {} as FieldValueMap;
    curveReferenceFields.forEach((field) => {
        target[field] = firstReferenceValue(rows, field, currentRow);
    });
    return target as CurveReferences;
}

function firstReferenceValue(rows: FieldValueMap[], field: string, currentRow?: FieldValueMap): DataValue {
    const currentValue = currentRow?.[field];
    if (hasUsableReferenceValue(currentValue, rows, field)) {
        return currentValue;
    }

    const nonZeroRow = rows.find((row) => {
        const value = toNumber(row[field]);
        return value !== null && value !== 0;
    });
    if (nonZeroRow) {
        return nonZeroRow[field];
    }

    const row = rows.find((candidate) => hasRealValue(candidate[field]));
    return row?.[field];
}

function hasUsableReferenceValue(value: DataValue, rows: FieldValueMap[], field: string): boolean {
    if (!hasRealValue(value)) {
        return false;
    }
    const parsed = toNumber(value);
    if (parsed === null || parsed !== 0) {
        return true;
    }
    return !rows.some((row) => {
        const candidate = toNumber(row[field]);
        return candidate !== null && candidate !== 0;
    });
}

function mergeCurveHistoryRows(rows: CurveHistoryPoint[]): CurveHistoryPoint[] {
    const grouped: { [week: string]: CurveHistoryPoint } = {};

    rows.forEach((row) => {
        const week = toNumber(row.SemanaProyecto);
        if (week === null) {
            return;
        }

        const key = String(week);
        const target = grouped[key] ?? {};
        curveFields.forEach((field) => {
            const value = (row as FieldValueMap)[field];
            if (!hasRealValue((target as FieldValueMap)[field]) && hasRealValue(value)) {
                (target as FieldValueMap)[field] = value;
            }
        });
        grouped[key] = target;
    });

    return Object.keys(grouped)
        .map((key) => grouped[key])
        .sort((a, b) => (toNumber(a.SemanaProyecto) ?? Number.MAX_SAFE_INTEGER) - (toNumber(b.SemanaProyecto) ?? Number.MAX_SAFE_INTEGER));
}

function selectCurrentCurvePoint(rows: CurveHistoryPoint[], at: DataValue): CurveHistoryPoint | undefined {
    const currentWeek = toNumber(at);
    if (currentWeek === null) {
        return undefined;
    }
    return rows.find((row) => toNumber(row.SemanaProyecto) === currentWeek);
}

function selectCurrentGaugeRow(rows: FieldValueMap[], at: DataValue): FieldValueMap | undefined {
    const currentWeek = toNumber(at);
    if (currentWeek !== null) {
        const currentRow = rows.find((row) => toNumber(row.SemanaProyecto) === currentWeek && hasAny(row, gaugeFields));
        if (currentRow) {
            return currentRow;
        }
    }
    return rows.find((row) => hasAny(row, gaugeFields));
}

function pickCurrentGaugeSnapshot(row: FieldValueMap): CurrentSnapshot {
    const snapshot = pick<CurrentSnapshot>(row, gaugeFields);
    snapshot.CPIEstado = asText(row.CPIEstado);
    snapshot.SPIEstado = asText(row.SPIEstado);
    snapshot.TCPIEstado = asText(row.TCPIEstado);
    snapshot.TSPIEstado = asText(row.TSPIEstado);
    return snapshot;
}

function buildGaugeHistory(rows: FieldValueMap[], at: DataValue): GaugeHistory {
    const currentWeek = toNumber(at);
    const historyStartWeek = currentWeek === null ? null : Math.max(0, currentWeek - 5);
    const orderedRows = rows
        .map((row, index) => ({ row, index, week: toNumber(row.SemanaProyecto) }))
        .filter((item) => hasAny(item.row, gaugeFields))
        .filter((item) => currentWeek === null || item.week === null || item.week <= currentWeek)
        .filter((item) => historyStartWeek === null || item.week === null || item.week >= historyStartWeek)
        .sort((a, b) => {
            const left = a.week ?? Number.MAX_SAFE_INTEGER;
            const right = b.week ?? Number.MAX_SAFE_INTEGER;
            if (left !== right) {
                return left - right;
            }
            return a.index - b.index;
        });

    return {
        CPI: historyFor(orderedRows, "CPI"),
        SPIW: historyFor(orderedRows, "SPI"),
        TCPI: historyFor(orderedRows, "TCPI"),
        TSPIW: historyFor(orderedRows, "TSPI")
    };
}

function historyFor(rows: Array<{ row: FieldValueMap; index: number; week: number | null }>, key: "CPI" | "SPI" | "TCPI" | "TSPI"): number[] {
    const seenRows: { [signature: string]: boolean } = {};
    const history: number[] = [];
    rows.forEach(({ row, index, week }) => {
        const value = toNumber(row[key]);
        if (value === null) {
            return;
        }
        const signature = week !== null ? `${key}:${week}` : `${key}:${index}`;
        if (seenRows[signature]) {
            return;
        }
        seenRows[signature] = true;
        history.push(value);
    });
    return history;
}

function buildGauges(current: CurrentSnapshot, history: GaugeHistory): GaugeData[] {
    console.debug("Gauge values", {
        CPI: current.CPI,
        SPIW: current.SPI,
        TCPI: current.TCPI,
        TSPIW: current.TSPI
    });
    return [
        gauge("CPI", current.CPI, current.CPIEstado, current.CPIVariacionSemanaAnterior, history.CPI),
        gauge("SPIW", current.SPI, current.SPIEstado, current.SPIVariacionSemanaAnterior, history.SPIW),
        gauge("TCPI", current.TCPI, current.TCPIEstado, current.TCPIVariacionSemanaAnterior, history.TCPI),
        gauge("TSPIW", current.TSPI, current.TSPIEstado, current.TSPIVariacionSemanaAnterior, history.TSPIW)
    ];
}

function gauge(
    key: "CPI" | "SPIW" | "TCPI" | "TSPIW",
    value: DataValue,
    status: DataValue,
    variation: DataValue,
    sparkline: number[]
): GaugeData {
    return {
        key,
        title: gaugeTitle(key),
        value,
        min: 0,
        max: 1.5,
        target: 1,
        variation,
        status: asText(status),
        sparkline
    };
}

function gaugeTitle(key: "CPI" | "SPIW" | "TCPI" | "TSPIW"): string {
    if (key === "SPIW") {
        return "SPI (w)";
    }
    if (key === "TSPIW") {
        return "TSPI (w)";
    }
    return key;
}

function hasAny(row: object, fields: string[]): boolean {
    return fields.some((field) => hasRealValue((row as FieldValueMap)[field]));
}

function uniqueBy<T>(items: T[], keySelector: (item: T) => string): T[] {
    const seen: { [key: string]: boolean } = {};
    return items.filter((item) => {
        const key = keySelector(item);
        if (seen[key]) {
            return false;
        }
        seen[key] = true;
        return true;
    });
}

function asText(value: unknown): string | undefined {
    return value === null || value === undefined || value === "" ? undefined : String(value);
}

function toNumber(value: DataValue): number | null {
    if (!hasRealValue(value)) {
        return null;
    }
    const parsed = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
}

function hasRealValue(value: DataValue): boolean {
    return value !== null && value !== undefined && value !== "";
}
