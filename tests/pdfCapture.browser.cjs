// Run with PLAYWRIGHT_MODULE pointing to an installed playwright package.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage();
        await page.setContent('<iframe sandbox="allow-scripts" srcdoc="<body></body>"></iframe>');
        const frame = page.frames()[1];
        await frame.addScriptTag({ content: fs.readFileSync('node_modules/html-to-image/dist/html-to-image.js', 'utf8') });
        await frame.evaluate(() => {
            window.exports = {};
            window.require = () => window.htmlToImage;
            document.body.innerHTML = `<style>
                main { width: 400px; height: 200px; }
                .evm-body-carousel-page { display: none; width: 400px; height: 200px; }
                .active { display: block; }
                .capture-box { fill: rgb(0,255,0); }
                .capture-line { stroke: rgb(255,255,0); stroke-width: 8px; fill: none; }
            </style><main><div class="evm-body-carousel-page active" style="background:rgb(255,0,0)"><svg width="100" height="100"><rect class="capture-box" width="100" height="100"/><path class="capture-line" d="M 0 50 L 100 50"/></svg>Resumen</div><div class="evm-body-carousel-page" style="background:rgb(0,0,255)">Matriz</div></main>`;
        });
        await frame.addScriptTag({ content: ts.transpileModule(fs.readFileSync('src/utils/pdfReport.ts', 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
        }).outputText });
        const result = await frame.evaluate(async () => {
            let blocked = false;
            try { void parent.document; } catch { blocked = true; }
            const main = document.querySelector('main');
            const captures = [];
            for (const index of [0, 1]) {
                const image = await window.exports.captureReportPage(main, index);
                const bitmap = await createImageBitmap(image.blob);
                const canvas = document.createElement('canvas');
                canvas.width = bitmap.width; canvas.height = bitmap.height;
                const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
                if (index === 0) {
                    const scale = bitmap.width / 400;
                    window.svgPixels = [20, 50].map(y => Array.from(ctx.getImageData(20 * scale, y * scale, 1, 1).data));
                }
                captures.push({ name: image.imageName, type: image.blob.type,
                    pixel: Array.from(ctx.getImageData(300, 100, 1, 1).data) });
                bitmap.close();
            }
            return { blocked, captures, svgPixels: window.svgPixels, remaining: document.querySelectorAll('main').length,
                originalActive: main.firstElementChild.classList.contains('active') };
        });
        assert.equal(result.blocked, true);
        assert.equal(result.remaining, 1);
        assert.equal(result.originalActive, true);
        assert.deepEqual(result.svgPixels, [[0, 255, 0, 255], [255, 255, 0, 255]]);
        assert.deepEqual(result.captures, [
            { name: '001_resumen.png', type: 'image/png', pixel: [255, 0, 0, 255] },
            { name: '002_matriz.png', type: 'image/png', pixel: [0, 0, 255, 255] }
        ]);
        console.log('PASS: two distinct PNG pages inside opaque-origin sandbox; original view preserved; clones removed.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
