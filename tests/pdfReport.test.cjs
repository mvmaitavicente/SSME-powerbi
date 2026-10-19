const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const source = ts.transpileModule(fs.readFileSync('src/utils/pdfReport.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const id = '12345678-1234-1234-1234-123456789abc';
const images = ['001_resumen.png', '002_matriz.png'].map(imageName => ({ imageName, blob: new Blob(['image'], { type: 'image/png' }) }));
function load(fetch, pixels = 100) {
    const context = { exports: {}, require: () => ({}), Blob, FormData, AbortController, setTimeout, clearTimeout,
        fetch, createImageBitmap: async () => ({ width: pixels, height: 100, close() {} }) };
    vm.runInNewContext(source, context);
    return context.exports.uploadReport;
}
test('sequential uploads share ID; every new report starts without ID', async () => {
    const calls = [];
    let active = false;
    const upload = load(async (url, options) => {
        assert.equal(active, false);
        active = true;
        await new Promise(resolve => setTimeout(resolve, 5));
        calls.push(options.body);
        assert.equal(options.headers, undefined);
        active = false;
        return { ok: true, json: async () => ({ success: true, requestId: id }) };
    });
    for (let n = 0; n < 2; n++) assert.equal(await upload(images, () => {}), id);
    assert.deepEqual(calls.map(f => f.get('requestId')), [null, id, null, id]);
    assert.deepEqual(calls.slice(0, 2).map(f => f.get('imageName')), images.map(i => i.imageName));
});
test('HTTP, non-JSON, API rejection, network and invalid IDs stop uploads', async () => {
    for (const response of [
        { ok: false, status: 500 },
        { ok: true, json: async () => { throw Error('invalid JSON'); } },
        { ok: true, json: async () => ({ success: false }) },
        { ok: true, json: async () => ({ success: true, requestId: 'bad' }) },
        null
    ]) {
        let calls = 0;
        const upload = load(async () => { calls++; if (!response) throw Error('network'); return response; });
        await assert.rejects(upload(images, () => {}));
        assert.equal(calls, 1);
    }
});
test('invalid files and excessive dimensions/count are rejected before upload', async () => {
    const upload = load(async () => { assert.fail('must not upload'); });
    for (const invalid of [[], Array(51).fill(images[0]), [{ ...images[0], imageName: 'bad.PNG' }],
        [{ ...images[0], blob: new Blob(['x'], { type: 'text/plain' }) }],
        [{ ...images[0], blob: new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'image/png' }) }]]) {
        await assert.rejects(upload(invalid, () => {}));
    }
    await assert.rejects(load(() => assert.fail('must not upload'), 200001)(images, () => {}));
});

test('HTTP failures preserve server message and stop before the next upload', async () => {
    let calls = 0;
    const upload = load(async () => {
        calls++;
        return { ok: false, status: 500, json: async () => ({ success: false, error: 'Error interno.' }) };
    });
    await assert.rejects(upload(images, () => {}), /HTTP 500.*001_resumen.png.*Error interno.*logs/);
    assert.equal(calls, 1);
});

test('non-JSON HTTP errors still report HTTP status', async () => {
    const upload = load(async () => ({ ok: false, status: 502, json: async () => { throw Error('HTML response'); } }));
    await assert.rejects(upload(images, () => {}), /HTTP 502.*001_resumen.png/);
});
