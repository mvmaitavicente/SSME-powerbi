export declare const API_URL = "https://ssme-reporteria-pdf-hagnhydjfkh4cshs.centralus-01.azurewebsites.net";
export interface ReportImage {
    imageName: string;
    blob: Blob;
}
export declare function generateReportPdf(images: ReportImage[]): Promise<string>;
export declare function uploadReportImage(blob: Blob): Promise<string>;
export declare function captureReportPage(main: HTMLElement, index: number, options?: {
    expandMatrix?: boolean;
}): Promise<ReportImage>;
export declare function uploadReport(images: ReportImage[], progress: (label: string) => void): Promise<string>;
