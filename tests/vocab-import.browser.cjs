const { chromium } = require('playwright');
const JSZip = require('jszip');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const hash = html.match(/const ACCESS_HASH='([a-f0-9]+)'/)[1];
const server = http.createServer((req, res) => {
  const file = req.url.startsWith('/vendor/') ? path.join(root, req.url) : path.join(root, 'index.html');
  res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript' : 'text/html; charset=utf-8');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const context = await browser.newContext();
    await context.addInitScript(hash => localStorage.setItem('la-access-v2', hash), hash);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const metrics = await page.locator('.upload-zone .btn').evaluate(button => {
        const icon = button.querySelector('svg'), rect = button.getBoundingClientRect(), ir = icon.getBoundingClientRect();
        return { width: ir.width, offset: Math.abs(ir.y + ir.height / 2 - rect.y - rect.height / 2), color: getComputedStyle(icon).color, buttonColor: getComputedStyle(button).color };
      });
      assert.equal(metrics.width, 20);
      assert.ok(metrics.offset < 1);
      assert.equal(metrics.color, metrics.buttonColor);
    }
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + ['tools: (v) công cụ', 'hot: (adj) nóng &gt;&lt; cold: (adj) lạnh'].map(t => '<w:p><w:r><w:t>' + t + '</w:t></w:r></w:p>').join('') + '</w:body></w:document>');
    await page.locator('#file-input').setInputFiles({ name: 'Vocabulary.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await zip.generateAsync({ type: 'nodebuffer' }) });
    await page.waitForSelector('#import-form');
    assert.equal(await page.evaluate(() => Core.flatten(pending.parsed.chapters).length), 3);
    await page.locator('#import-form button[type="submit"]').click();
    await page.reload();
    const cards = await page.evaluate(() => Core.flatten(deck().chapters));
    assert.deepEqual(cards.map(c => [c.word, c.meaning, c.pos]), [['tools', 'công cụ', '(v)'], ['hot', 'nóng', '(adj)'], ['cold', 'lạnh', '(adj)']]);
    assert.ok(cards[1].note.includes('Đối nghĩa: cold'));
    assert.deepEqual(errors, []);
    console.log('Browser: DOCX line import, antonyms, save/reload and upload button alignment passed.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
