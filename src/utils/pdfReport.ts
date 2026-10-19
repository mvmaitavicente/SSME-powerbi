import { toBlob } from "html-to-image";

export const API_URL = "https://ssme-reporteria-pdf-hagnhydjfkh4cshs.centralus-01.azurewebsites.net";
export interface ReportImage { imageName: string; blob: Blob; }

export async function generateReportPdf(images: ReportImage[]): Promise<string> {
    if (images.length !== 2) throw new Error("El reporte requiere Resumen y Matriz.");
    const form = new FormData();
    images.forEach(({ blob }, index) => {
        if (blob.type !== "image/png" || !blob.size || blob.size > 10 * 1024 * 1024) {
            throw new Error("Cada captura debe ser PNG y no superar 10 MiB.");
        }
        form.append("images", blob, index === 0 ? "01_resumen.png" : "02_matriz.png");
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
        const response = await fetch(`${API_URL}/api/generate-report-pdf`, {
            method: "POST", body: form, credentials: "omit", signal: controller.signal
        });
        let result: { success?: boolean; downloadUrl?: string; error?: string };
        try { result = await response.json(); }
        catch { throw new Error(`La API devolvió una respuesta no JSON (HTTP ${response.status}).`); }
        if (!response.ok || result?.success !== true || typeof result.downloadUrl !== "string") {
            throw new Error(typeof result?.error === "string" ? result.error : `No se pudo generar el PDF (HTTP ${response.status}).`);
        }
        const url = new URL(result.downloadUrl);
        if (url.origin !== API_URL || !url.pathname.startsWith("/api/download-report/") || url.username || url.password) {
            throw new Error("La API devolvió una URL de PDF inesperada.");
        }
        return url.href;
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw new Error("La generación del PDF excedió el tiempo de espera. Inténtalo nuevamente.");
        if (error instanceof TypeError) throw new Error("No se pudo conectar con la API. Revisa la conexión y CORS.");
        throw error;
    } finally { clearTimeout(timer); }
}

export async function uploadReportImage(blob: Blob): Promise<string> {
    if (!["image/png", "image/jpeg"].includes(blob.type) || !blob.size || blob.size > 10 * 1024 * 1024) {
        throw new Error("La imagen debe ser PNG/JPG y no superar 10 MB.");
    }
    const form = new FormData();
    form.append("image", blob, blob.type === "image/jpeg" ? "resumen.jpg" : "resumen.png");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
        const response = await fetch(`${API_URL}/api/upload-report-image`, {
            method: "POST", body: form, credentials: "omit", signal: controller.signal
        });
        let result: { success?: boolean; downloadUrl?: string; error?: string };
        try { result = await response.json(); }
        catch { throw new Error(`La API devolvió una respuesta no JSON (HTTP ${response.status}).`); }
        if (!response.ok || result?.success !== true || typeof result.downloadUrl !== "string") {
            throw new Error(typeof result?.error === "string" ? result.error : `No se pudo subir la imagen (HTTP ${response.status}).`);
        }
        const url = new URL(result.downloadUrl);
        if (url.origin !== API_URL || !url.pathname.startsWith("/api/download-image/") || url.username || url.password) {
            throw new Error("La API devolvió una URL de descarga inesperada.");
        }
        return url.href;
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw new Error("La subida excedió el tiempo de espera. Inténtalo nuevamente.");
        if (error instanceof TypeError) throw new Error("No se pudo conectar con la API. Revisa la conexión y CORS.");
        throw error;
    } finally { clearTimeout(timer); }
}

export async function captureReportPage(main: HTMLElement, index: number, options: { expandMatrix?: boolean } = {}): Promise<ReportImage> {
    let width = main.offsetWidth;
    let height = main.offsetHeight;
    if (!width || !height || width * height > 20_000_000) {
        throw new Error("La captura debe tener dimensiones válidas y como máximo 20 megapíxeles.");
    }
    // Keep the snapshot in the visual's own document: Power BI's opaque-origin
    // sandbox prevents html2canvas from reading its auxiliary iframe document.
    const clone = main.cloneNode(true) as HTMLElement;
    clone.setAttribute("aria-hidden", "true");
    clone.style.cssText += `;position:absolute;left:-100000px;top:0;width:${width}px;height:${height}px;min-width:0;transform:none;pointer-events:none;`;
    if (main.classList.contains("evm-main--unit")) clone.classList.toggle("evm-main--unit-matrix", index === 1);
    else if (main.classList.contains("evm-main--project")) clone.classList.toggle("evm-main--project-details", index === 1);
    else clone.classList.toggle("evm-main--portfolio-details", index === 1);
    clone.querySelectorAll<HTMLElement>("*").forEach((el) => {
        el.style.setProperty("transition", "none", "important");
        el.style.setProperty("animation", "none", "important");
    });
    clone.querySelectorAll<HTMLElement>(".evm-body-carousel-page").forEach((page, pageIndex) => {
        page.classList.toggle("active", pageIndex === index);
        page.setAttribute("aria-hidden", String(pageIndex !== index));
    });
    clone.querySelectorAll(".evm-pdf-controls, .evm-carousel-button, .evm-carousel-dots, .evm-project-curve-heading-actions").forEach((el) => el.remove());
    main.parentElement!.appendChild(clone);
    try {
        const filterPanel = clone.querySelector<HTMLElement>(":scope > .evm-filter-panel--project-inline");
        let rows: string[] | null = null;
        if (filterPanel) {
            const layout = window.getComputedStyle(clone);
            rows = layout.gridTemplateRows.split(" ");
            const filterRow = Array.from(clone.children).indexOf(filterPanel);
            height -= filterPanel.offsetHeight + (parseFloat(layout.rowGap) || 0);
            rows.splice(filterRow, 1);
            clone.style.gridTemplateRows = rows.join(" ");
            clone.style.height = `${height}px`;
            filterPanel.remove();
        }
        const matrixWrap = options.expandMatrix ? clone.querySelector<HTMLElement>(".evm-project-curve-matrix-wrap") : null;
        if (matrixWrap) {
            // Show the whole matrix: widen to its full width and let every ancestor grow to its full height.
            width += Math.max(0, matrixWrap.scrollWidth - matrixWrap.clientWidth);
            clone.style.width = `${width}px`;
            for (let el: HTMLElement | null = matrixWrap; el && el !== clone; el = el.parentElement) {
                el.style.setProperty("height", "auto", "important");
                el.style.setProperty("max-height", "none", "important");
                el.style.setProperty("min-height", "0", "important");
                el.style.setProperty("overflow", "visible", "important");
                if (el.classList.contains("evm-body-carousel-page")) {
                    el.style.setProperty("grid-template-rows", "auto auto", "important");
                    el.style.setProperty("position", "relative", "important");
                    el.style.setProperty("inset", "auto", "important");
                    el.style.setProperty("transform", "none", "important");
                } else if (el.classList.contains("evm-body-carousel-viewport")) {
                    el.style.setProperty("position", "relative", "important");
                }
            }
            if (rows) {
                rows[rows.length - 1] = "auto";
                clone.style.gridTemplateRows = rows.join(" ");
            }
            clone.style.height = "auto";
            height = clone.offsetHeight;
            if (width * height > 20_000_000 * 4) throw new Error("La matriz es demasiado grande para capturarla.");
        }
        // html-to-image deep-clones SVGs without copying their descendants' CSS.
        // Freeze computed SVG styles while the clone still has the report stylesheet.
        // Read all styles before writing so inherited styles stay unchanged.
        const svgStyles = Array.from(clone.querySelectorAll<SVGElement>("svg, svg *"), (element) => {
            const computed = window.getComputedStyle(element);
            return { element, properties: Array.from(computed, (name) =>
                [name, computed.getPropertyValue(name)] as const) };
        });
        svgStyles.forEach(({ element, properties }) => {
            properties.forEach(([name, value]) => element.style.setProperty(name, value));
        });
        const blob = await toBlob(clone, {
            width, height,
            pixelRatio: Math.min(2, Math.sqrt(20_000_000 / (width * height))),
            backgroundColor: "#F7F9FC",
            // The visual uses system fonts; no remote font/CSS requests needed.
            skipFonts: true,
            style: { position: "relative", inset: "auto", insetInline: "auto", insetBlock: "auto", left: "0", top: "0", margin: "0", transform: "none" },
            filter: (node) => !(node instanceof Element && node.tagName === "IFRAME")
        });
        if (!blob) throw new Error("No se pudo generar la captura PNG.");
        return { imageName: index === 0 ? "001_resumen.png" : "002_matriz.png", blob };
    } finally {
        clone.remove();
    }
}

export async function uploadReport(images: ReportImage[], progress: (label: string) => void): Promise<string> {
    if (!images.length || images.length > 50) throw new Error("El reporte debe contener entre 1 y 50 imágenes.");
    let total = 0;
    for (const { imageName, blob } of images) {
        if (!/^[A-Za-z0-9_-]+\.(png|jpg|jpeg)$/.test(imageName)) throw new Error("Nombre de imagen inválido.");
        if (!['image/png', 'image/jpeg'].includes(blob.type) ||
            (blob.type === 'image/png') !== imageName.endsWith('.png')) throw new Error("Solo se permiten imágenes PNG/JPEG con extensión correspondiente.");
        if (!blob.size || blob.size > 10 * 1024 * 1024) throw new Error(`${imageName}: máximo 10 MiB por imagen.`);
        const bitmap = await createImageBitmap(blob);
        try {
            if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 20_000_000) throw new Error(`${imageName}: máximo 20 megapíxeles.`);
        } finally { bitmap.close(); }
        total += blob.size;
    }
    if (total > 100 * 1024 * 1024) throw new Error("El reporte supera 100 MiB.");
    let requestId: string | undefined;
    for (let index = 0; index < images.length; index++) {
        progress(`Subiendo ${index + 1} de ${images.length}...`);
        const form = new FormData();
        form.append("image", images[index].blob, images[index].imageName);
        form.append("imageName", images[index].imageName);
        if (requestId) form.append("requestId", requestId);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 120_000);
        try {
            const response = await fetch(`${API_URL}/api/upload-report-image`, { method: "POST", body: form, signal: controller.signal });
            if (!response.ok) {
                let detail = "";
                try {
                    const body = await response.json();
                    const message = body?.error ?? body?.message;
                    if (typeof message === "string") detail = message.replace(/\s+/g, " ").trim().slice(0, 300);
                } catch { /* Keep the HTTP status when the server returns HTML or no body. */ }
                const nextStep = response.status >= 500 ? " Revisar los logs de upload-report-image en Azure." : "";
                throw new Error(`Error HTTP ${response.status} al subir ${images[index].imageName}.${detail ? ` ${detail}` : ""}${nextStep}`);
            }
            let result: { success?: boolean; requestId?: string; error?: string };
            try { result = await response.json(); } catch { throw new Error("La API devolvió una respuesta no JSON."); }
            if (!result || result.success !== true) throw new Error(`La API rechazó ${images[index].imageName}.`);
            if (!requestId) {
                if (typeof result.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.requestId)) throw new Error("La API no devolvió un requestId UUID válido.");
                requestId = result.requestId;
            } else if (result.requestId !== undefined && result.requestId !== requestId) {
                throw new Error("La API devolvió un requestId diferente al reporte actual.");
            }
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") throw new Error("La subida excedió el tiempo de espera.");
            if (error instanceof TypeError) throw new Error("No se pudo conectar con la API. Verifique la red y CORS de la Function App.");
            throw error;
        } finally { clearTimeout(timer); }
    }
    return requestId!;
}
