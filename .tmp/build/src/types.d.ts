export type DataValue = string | number | boolean | Date | null | undefined;
export interface FieldValueMap {
    [fieldName: string]: DataValue;
}
export interface ProjectHeader {
    NombreIntervencion?: string;
    CUI?: string;
    Region?: string;
    Provincia?: string;
    Distrito?: string;
    UnidadGerencial?: string;
    EstadoProyecto?: string;
    MensajeEjecutivo?: string;
    FechaInicioPlan?: DataValue;
    FechaFinPlan?: DataValue;
    FechaEstado?: DataValue;
    SemanaActual?: DataValue;
}
export interface CurvePoint {
    SemanaActual?: DataValue;
    SemanaProyecto?: DataValue;
    FechaInicioSemana?: DataValue;
    FechaFinSemana?: DataValue;
    FechaCorte?: DataValue;
    FechaEnvioReporte?: DataValue;
    PV?: DataValue;
    EV?: DataValue;
    AC?: DataValue;
    BAC?: DataValue;
    SAC?: DataValue;
    AT?: DataValue;
    ES?: DataValue;
    EACC?: DataValue;
    EACT?: DataValue;
    VACC?: DataValue;
    VACT?: DataValue;
    EACCosto?: DataValue;
    EACTiempo?: DataValue;
    FlagEjecucion?: DataValue;
}
export interface CurveHistoryPoint {
    SemanaProyecto?: DataValue;
    PV?: DataValue;
    EV?: DataValue;
    AC?: DataValue;
}
export interface CurveReferences {
    BAC?: DataValue;
    SAC?: DataValue;
    AT?: DataValue;
    ES?: DataValue;
    EACC?: DataValue;
    EACT?: DataValue;
    VACC?: DataValue;
    VACT?: DataValue;
    SPIT?: DataValue;
    TSPIT?: DataValue;
    FechaEstado?: DataValue;
}
export interface RenderCurveData {
    history: CurveHistoryPoint[];
    current: CurveHistoryPoint;
    references: CurveReferences;
}
export interface GaugeData {
    key: "CPI" | "SPIW" | "TCPI" | "TSPIW";
    title: string;
    value?: DataValue;
    min: number;
    max: number;
    target: number;
    variation?: DataValue;
    status?: string;
    sparkline: number[];
}
export interface GaugeHistory {
    CPI: number[];
    SPIW: number[];
    TCPI: number[];
    TSPIW: number[];
}
export interface PerformanceData {
    PlazoConsumidoPct?: DataValue;
    PlazoRestanteSemanas?: DataValue;
    PlazoProgramadoTotalSemanas?: DataValue;
    PlazoProyectadoSemanas?: DataValue;
    RetrasoProyectadoSemanas?: DataValue;
    TerminoProyectado?: DataValue;
    PresupuestoConsumidoPct?: DataValue;
    PresupuestoRestante?: DataValue;
    PresupuestoProgramadoBAC?: DataValue;
    CostoEstimadoTerminoEAC?: DataValue;
    SobreCostoProyectadoVAC?: DataValue;
    SobreCostoProyectadoPct?: DataValue;
}
export interface RiskItem {
    NivelRiesgo?: string;
    CantidadRiesgos?: DataValue;
    PorcentajeRiesgos?: DataValue;
    ImpactoPlazoSemanas?: DataValue;
    ImpactoCosto?: DataValue;
}
export interface MilestoneItem {
    OrdenHito?: DataValue;
    NombreHito?: string;
    FechaHitoPlan?: DataValue;
    FechaHitoReal?: DataValue;
    EstadoHito?: string;
    SemaforoHito?: string;
}
export interface CurrentSnapshot extends ProjectHeader, PerformanceData {
    SemanaProyecto?: DataValue;
    FechaCorte?: DataValue;
    PV?: DataValue;
    EV?: DataValue;
    AC?: DataValue;
    BAC?: DataValue;
    SAC?: DataValue;
    AT?: DataValue;
    ES?: DataValue;
    EACC?: DataValue;
    EACT?: DataValue;
    VACC?: DataValue;
    VACT?: DataValue;
    EACCosto?: DataValue;
    EACTiempo?: DataValue;
    FlagEjecucion?: DataValue;
    CPI?: DataValue;
    CPIEstado?: string;
    CPIVariacionSemanaAnterior?: DataValue;
    SPI?: DataValue;
    SPIT?: DataValue;
    SPIEstado?: string;
    SPIVariacionSemanaAnterior?: DataValue;
    TCPI?: DataValue;
    TCPIEstado?: string;
    TCPIVariacionSemanaAnterior?: DataValue;
    TSPI?: DataValue;
    TSPIT?: DataValue;
    TSPIEstado?: string;
    TSPIVariacionSemanaAnterior?: DataValue;
}
export interface ParsedProjectData {
    header: ProjectHeader;
    current: CurrentSnapshot;
    curve: RenderCurveData;
    risks: RiskItem[];
    milestones: MilestoneItem[];
}
export interface DashboardData extends ParsedProjectData {
    gauges: GaugeData[];
    performance: PerformanceData;
    hasData: boolean;
}
export interface VisualPalette {
    blue: string;
    red: string;
    orange: string;
    green: string;
    purple: string;
    background: string;
    card: string;
    text: string;
    muted: string;
    border: string;
}
export interface JsonTablePayload {
    header: string[];
    rowCount: number;
    data: unknown[][];
}
export type DashboardLevel = "PRONIED" | "UNIDAD" | "PROYECTO";
export interface NavigatorJsonPayload {
    schemaVersion?: string;
    projects?: JsonTablePayload;
}
export interface NavigatorProject extends Record<string, unknown> {
    IdIntervencion?: string | number | null;
    NombreIntervencion?: string | null;
    UnidadGerencial?: string | null;
    Region?: string | null;
    Provincia?: string | null;
    Distrito?: string | null;
    EstadoProyecto?: string | null;
}
export interface NavigatorData {
    schemaVersion?: string;
    projects: NavigatorProject[];
}
export interface DashboardContextData {
    Level: DashboardLevel;
    AxisType?: "CALENDAR_PERIOD" | "PROJECT_WEEK";
    Unit: string | null;
    ProjectId: string | null;
    Region: string | null;
    Province: string | null;
    District: string | null;
    Status: string | null;
    CutoffDate: string | null;
}
export interface InternalFilterState {
    levelFilter?: DashboardLevel;
    unitFilter?: string;
    regionFilter?: string;
    provinceFilter?: string;
    districtFilter?: string;
    statusFilter?: string;
    projectFilter?: string;
}
export interface DashboardJsonPayload {
    schemaVersion?: string;
    context?: JsonTablePayload;
    summary?: JsonTablePayload;
    project?: JsonTablePayload;
    gauges?: JsonTablePayload;
    curve?: JsonTablePayload;
    units?: JsonTablePayload;
    projects?: JsonTablePayload;
    milestone?: JsonTablePayload;
    milestones?: JsonTablePayload;
    risks?: JsonTablePayload;
}
export interface SummaryData {
    CantidadProyectos: number | null;
    BAC: number | null;
    PV: number | null;
    EV: number | null;
    AC: number | null;
    CPI: number | null;
    SPIW: number | null;
    TCPI: number | null;
    TSPIW?: number | null;
    SPIT?: number | null;
    TSPIT?: number | null;
    EACC?: number | null;
    EACT?: number | null;
    VACC?: number | null;
    VACT?: number | null;
}
export interface UnitSummaryData extends Record<string, unknown> {
    UnidadGerencial: string;
    CantidadProyectos: number | null;
    BAC: number | null;
    PV: number | null;
    EV: number | null;
    AC: number | null;
    CPI: number | null;
    SPIW: number | null;
    TCPI: number | null;
}
export interface UnitProjectSummaryData extends Record<string, unknown> {
    IdIntervencion: string;
    NombreIntervencion: string;
    Cui: string | number | null;
    UnidadGerencial: string;
    Region: string;
    Provincia: string;
    Distrito: string;
    EstadoProyecto: string;
    BAC: number | null;
    PV: number | null;
    EV: number | null;
    AC: number | null;
    CPI: number | null;
    SPIW: number | null;
    TCPI: number | null;
}
export interface AggregateCurveData extends Record<string, unknown> {
    OrdenSemana: number;
    FechaInicioSemana: string | null;
    FechaFinSemana: string | null;
    LabelSemana: string;
    BAC: number | null;
    PV: number | null;
    EV: number | null;
    AC: number | null;
    CPI: number | null;
    SPIW: number | null;
}
export interface AggregateGaugeData extends Record<string, unknown> {
    OrdenSemana: number;
    FechaInicioSemana: string | null;
    FechaFinSemana: string | null;
    LabelSemana: string;
    CPI: number | null;
    SPIW: number | null;
    TCPI: number | null;
}
export interface ProjectData extends Record<string, unknown> {
    IdIntervencion: string;
    NombreIntervencion: string;
    Cui: string | number | null;
    Region: string;
    Provincia: string;
    Distrito: string;
    UnidadGerencial: string;
    EstadoProyecto?: string;
    MensajeEjecutivo?: string;
    FechaEstado: string | null;
    SemanaActual: string | number | null;
}
export interface CurveData extends Record<string, unknown> {
    Semana: number;
    BAC: number | null;
    SAC: number | null;
    ES: number | null;
    AT: number | null;
    PV: number | null;
    EV: number | null;
    AC: number | null;
    "SPI (t)": number | null;
    "TSPI (t)": number | null;
    "EAC (c)": number | null;
    "EAC (t)": number | null;
    "VAC (c)": number | null;
    "VAC (t)": number | null;
}
export interface GaugeHistoryRow extends Record<string, unknown> {
    Semana: number;
    CPI: number | null;
    "SPI (w)": number | null;
    TCPI: number | null;
    "TSPI (w)": number | null;
    CPIEstado?: string;
    SPIEstado?: string;
    TCPIEstado?: string;
    TSPIEstado?: string;
}
export type GaugeMetricKey = "CPI" | "SPI (w)" | "TCPI" | "TSPI (w)";
export interface GaugeChartPoint {
    week: number;
    value: number;
}
export interface GaugeChartSeries {
    key: GaugeMetricKey;
    label: string;
    points: GaugeChartPoint[];
}
export interface ParserDebugData {
    rawContextLevel: string;
    normalizedContextLevel: DashboardLevel;
    contextLevelAfterParse: DashboardLevel;
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
    finalContextLevel: DashboardLevel;
    finalParsedPreview: string;
    parserUsed: string;
    fallbackUsed: boolean;
    cachedDashboardUsed: boolean;
    jsonDashboardRoleIndex: number | null;
    jsonDashboardDisplayName: string | null;
    jsonDashboardQueryName: string | null;
    navigatorRoleIndex: number | null;
    dataViewRowCount: number | null;
    rowIndexUsed: number | null;
}
export interface ParsedDashboardData {
    idIntervencion: string;
    schemaVersion?: string;
    context: DashboardContextData;
    debug?: ParserDebugData;
    summary: SummaryData | null;
    navigator?: NavigatorData;
    project: ProjectData | null;
    gauges: GaugeHistoryRow[];
    curve: CurveData[];
    aggregateGauges: AggregateGaugeData[];
    aggregateCurve: AggregateCurveData[];
    units: UnitSummaryData[];
    projects: UnitProjectSummaryData[];
    risks: RiskItem[];
    milestones: MilestoneItem[];
}
