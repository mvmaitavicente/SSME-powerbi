const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const source = ts.transpileModule(fs.readFileSync('src/utils/pdfReport.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const api = 'https://ssme-reporteria-pdf-hagnhydjfkh4cshs.centralus-01.azurewebsites.net';
function load(fetch, method = 'uploadReportImage') {
    const context = { exports: {}, require: () => ({}), Blob, FormData, URL, AbortController, setTimeout, clearTimeout, fetch };
    vm.runInNewContext(source, context);
    return context.exports[method];
}
test('sends both report pages in one request, summary first, without changing their bytes', async () => {
    let calls = 0;
    const upload = load(async (url, options) => {
        calls++;
        assert.equal(url, `${api}/api/generate-report-pdf`);
        assert.equal(options.credentials, 'omit');
        assert.equal(options.headers, undefined);
        const files = options.body.getAll('images');
        assert.deepEqual(files.map(file => file.name), ['01_resumen.png', '02_matriz.png']);
        assert.deepEqual(await Promise.all(files.map(file => file.text())), ['summary', 'matrix']);
        return { ok: true, json: async () => ({ success: true, downloadUrl: `${api}/api/download-report/test.pdf` }) };
    }, 'generateReportPdf');
    const images = ['summary', 'matrix'].map(text => ({ blob: new Blob([text], { type: 'image/png' }) }));
    assert.equal(await upload(images), `${api}/api/download-report/test.pdf`);
    assert.equal(calls, 1);
    await assert.rejects(upload(images.slice(0, 1)));
    assert.equal(calls, 1);
});
test('PDF upload rejects server failures and unexpected download endpoints', async () => {
    const images = [0, 1].map(() => ({ blob: new Blob(['png'], { type: 'image/png' }) }));
    for (const result of [{ success: false }, { success: true, downloadUrl: `${api}/api/download-image/test.png` },
        { success: true, downloadUrl: 'https://example.com/api/download-report/test.pdf' }]) {
        const upload = load(async () => ({ ok: true, json: async () => result }), 'generateReportPdf');
        await assert.rejects(upload(images));
    }
});
test('uploads the generated image without credentials and returns the download URL', async () => {
    const upload = load(async (url, options) => {
        assert.equal(url, `${api}/api/upload-report-image`);
        assert.equal(options.credentials, 'omit');
        assert.equal(options.headers, undefined);
        assert.equal(options.body.get('image').name, 'resumen.png');
        return { ok: true, json: async () => ({ success: true, downloadUrl: `${api}/api/download-image/test.png` }) };
    });
    assert.equal(await upload(new Blob(['png'], { type: 'image/png' })), `${api}/api/download-image/test.png`);
});
test('rejects unsuccessful responses and download URLs outside the expected endpoint', async () => {
    for (const result of [
        { success: false, error: 'Upload failed' },
        { success: true },
        { success: true, downloadUrl: 'https://example.com/api/download-image/test.png' },
        { success: true, downloadUrl: `${api}/other/test.png` }
    ]) {
        const upload = load(async () => ({ ok: true, json: async () => result }));
        await assert.rejects(upload(new Blob(['png'], { type: 'image/png' })));
    }
});
