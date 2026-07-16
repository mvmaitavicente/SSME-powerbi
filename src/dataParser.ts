"use strict";

import powerbi from "powerbi-visuals-api";
import { CurrentSnapshot, CurveData, CurveHistoryPoint, CurveReferences, DashboardData, DashboardJsonPayload, DataValue, FieldValueMap, GaugeData, GaugeHistory, GaugeHistoryRow, JsonTablePayload, MilestoneItem, ParsedDashboardData, PerformanceData, ProjectData, ProjectHeader, RenderCurveData, RiskItem } from "./types";

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
    if (jsonDashboard?.project && jsonDashboard.gauges.length && jsonDashboard.curve.length) {
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

    // Fallback temporal: eliminar este bloque cuando JSON Dashboard quede validado en Power BI.
    return parseLegacyDashboardData(dataView);
}

function parseLegacyDashboardData(dataView?: powerbi.DataView): DashboardData {
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

function getRoleIndex(dataView: powerbi.DataView, roleName: string): number {
    const columns = dataView.table?.columns ?? [];
    return columns.findIndex((column) => column.roles?.[roleName] === true);
}

export function parseDashboardJsonData(dataView?: powerbi.DataView): ParsedDashboardData | null {
    const table = dataView?.table;

    if (!dataView || !table || table.rows.length === 0) {
        return null;
    }

    const idIndex = getRoleIndex(dataView, "idIntervencion");
    const jsonIndex = getRoleIndex(dataView, "jsonDashboard");

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

function parseDashboardJsonRow(row: powerbi.DataViewTableRow, idIndex: number, jsonIndex: number): ParsedDashboardData | null {
    const idIntervencion = String(row[idIndex] ?? "").trim();
    const rawJson = row[jsonIndex];

    if (!idIntervencion || typeof rawJson !== "string" || rawJson.trim() === "") {
        return null;
    }

    try {
        const payload = JSON.parse(rawJson) as DashboardJsonPayload;

        if (!payload.project || !payload.gauges || !payload.curve) {
            console.warn("El JSON Dashboard no contiene project, gauges o curve.");
            return null;
        }

        const projectRows = jsonTableToObjects<ProjectData>(payload.project);
        const gaugeRows = jsonTableToObjects<GaugeHistoryRow>(payload.gauges);
        const curveRows = jsonTableToObjects<CurveData>(payload.curve);
        const riskRows = payload.risks ? jsonTableToObjects<Record<string, unknown>>(payload.risks) : [];
        const milestoneRows = payload.milestone || payload.milestones
            ? jsonTableToObjects<Record<string, unknown>>((payload.milestone || payload.milestones) as JsonTablePayload)
            : [];

        if (payload.project.rowCount !== payload.project.data.length) {
            console.warn("JSON project: rowCount no coincide con data.length.");
        }

        if (payload.gauges.rowCount !== payload.gauges.data.length) {
            console.warn("JSON gauges: rowCount no coincide con data.length.");
        }

        if (payload.curve.rowCount !== payload.curve.data.length) {
            console.warn("JSON curve: rowCount no coincide con data.length.");
        }

        if (payload.risks && payload.risks.rowCount !== payload.risks.data.length) {
            console.warn("JSON risks: rowCount no coincide con data.length.");
        }

        const milestonePayload = payload.milestone || payload.milestones;
        if (milestonePayload && milestonePayload.rowCount !== milestonePayload.data.length) {
            console.warn("JSON milestone: rowCount no coincide con data.length.");
        }

        const normalizedGauges = gaugeRows
            .map((item) => ({
                ...item,
                Semana: toFiniteNumber(item.Semana, 0),
                CPI: toNullableNumber(item.CPI),
                "SPI (w)": toNullableNumber(firstKnownValue(item, "SPI (w)", "SPI (W)", "SPIw", "SPIW")),
                TCPI: toNullableNumber(item.TCPI),
                "TSPI (w)": toNullableNumber(firstKnownValue(item, "TSPI (w)", "TSPI (W)", "TSPIw", "TSPIW")),
                CPIEstado: textValue(firstKnownValue(item, "CPIestado", "CPIEstado", "CPI Estado")),
                SPIEstado: textValue(firstKnownValue(item, "SPIestado", "SPIEstado", "SPI Estado", "SPI (w) Estado")),
                TCPIEstado: textValue(firstKnownValue(item, "TCPIestado", "TCPIEstado", "TCPI Estado")),
                TSPIEstado: textValue(firstKnownValue(item, "TSPIestado", "TSPIEstado", "TSPI Estado", "TSPI (w) Estado"))
            }))
            .sort((a, b) => a.Semana - b.Semana);

        const normalizedCurve = curveRows
            .map((item) => ({
                ...item,
                Semana: toFiniteNumber(item.Semana, 0),
                BAC: toNullableNumber(item.BAC),
                SAC: toNullableNumber(item.SAC),
                ES: toNullableNumber(item.ES),
                AT: toNullableNumber(item.AT),
                PV: toNullableNumber(item.PV),
                EV: toNullableNumber(item.EV),
                AC: toNullableNumber(item.AC),
                "SPI (t)": toNullableNumber(item["SPI (t)"]),
                "TSPI (t)": toNullableNumber(item["TSPI (t)"]),
                "EAC (c)": toNullableNumber(item["EAC (c)"]),
                "EAC (t)": toNullableNumber(item["EAC (t)"]),
                "VAC (c)": toNullableNumber(item["VAC (c)"]),
                "VAC (t)": toNullableNumber(item["VAC (t)"])
            }))
            .sort((a, b) => a.Semana - b.Semana);

        const normalizedRisks = riskRows.map(normalizeJsonRisk).filter((item) => hasAny(item as FieldValueMap, riskFields));
        const normalizedMilestones = milestoneRows
            .map(normalizeJsonMilestone)
            .filter((item) => hasAny(item as FieldValueMap, milestoneFields))
            .sort((a, b) => (toNullableNumber(a.OrdenHito) ?? 0) - (toNullableNumber(b.OrdenHito) ?? 0));

        return {
            idIntervencion,
            project: normalizeProjectData(projectRows[0] ?? null),
            gauges: normalizedGauges,
            curve: normalizedCurve,
            risks: normalizedRisks,
            milestones: normalizedMilestones
        };
    } catch (error) {
        console.error("No se pudo interpretar JSON Dashboard.", error);
        return null;
    }
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

function adaptJsonDashboardData(parsed: ParsedDashboardData): DashboardData {
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
