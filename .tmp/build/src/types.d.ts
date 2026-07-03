export type DataValue = string | number | boolean | Date | null | undefined;
export interface FieldValueMap {
    [fieldName: string]: DataValue;
}
export interface ProjectHeader {
    NombreIntervencion?: string;
    CUI?: string;
    Region?: string;
    UnidadGerencial?: string;
    EstadoProyecto?: string;
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
export interface CurveData {
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
    curve: CurveData;
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
