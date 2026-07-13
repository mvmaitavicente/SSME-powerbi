"use strict";

import powerbi from "powerbi-visuals-api";
import { CurrentSnapshot, CurveData, CurveHistoryPoint, CurveReferences, DashboardData, DataValue, FieldValueMap, GaugeData, GaugeHistory, MilestoneItem, PerformanceData, ProjectHeader, RiskItem } from "./types";

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
    const rows = mapRows(dataView?.table);
    const curveHistory = mergeCurveHistoryRows(
        rows
            .map((row) => pick<CurveHistoryPoint>(row, curveFields))
            .filter((row) => hasRealValue(row.SemanaProyecto))
    );
    const curveReferences = buildCurveReferences(rows);
    const currentCurvePoint = selectCurrentCurvePoint(curveHistory, curveReferences.AT);
    const curve: CurveData = {
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
