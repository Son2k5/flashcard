const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { DOMParser } = require('linkedom');

const root = path.join(__dirname, '..');
const html = require('./helpers/app.cjs').readAppHtml();
const Core = new Function('DOMParser', html.match(/<script id="core">([\s\S]*?)<\/script>/)[1] + ';return Core;')(DOMParser);
const hash = html.match(/const ACCESS_HASH='([a-f0-9]+)'/)[1];
const parsed = Core.parse('<h2>Chương 1</h2><table><tr><td>apple</td><td>quả táo</td></tr><tr><td>banana</td><td>quả chuối</td></tr></table>', 'test.docx');
const fixture = {
  app: 'la-vocab',
  version: 2,
  activeDeckId: null,
  settings: { theme: 'light', sound: false },
  decks: [{
    id: 'deck-1',
    ...parsed,
    language: 'en-US',
    organization: { mode: 'split', dedupe: false },
    progress: {},
    activity: [],
    quizMemory: {},
    records: {}
  }]
};

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept());

    await page.addInitScript(({ fixture, hash }) => {
      localStorage.setItem('la-vocab-v2', JSON.stringify(fixture));
      localStorage.setItem('la-access-v2', hash);
    }, { fixture, hash });

    await page.goto(url);

    // 1. Initial view:
    assert.equal(await page.evaluate(() => view), 'decks');
    // #nav-storage should always be visible and contain the storage badge
    assert.equal(await page.locator('#nav-storage').isVisible(), true);
    const badgeText = await page.locator('#nav-storage-badge').innerText();
    assert.match(badgeText, /\d+(\.\d+)?\s*(KB|MB)/);

    // When no deck is selected, #nav-flash is hidden
    await page.evaluate(() => { store.activeDeckId = null; render(); });
    assert.equal(await page.locator('#nav-flash').isHidden(), true);

    // When deck is selected, #nav-flash becomes visible
    await page.evaluate(() => { store.activeDeckId = 'deck-1'; render(); });
    assert.equal(await page.locator('#nav-flash').isVisible(), true);

    // 2. Click Dung lượng on header
    await page.locator('#nav-storage').click();
    assert.equal(await page.evaluate(() => view), 'storage');
    assert.equal(await page.locator('#nav-storage').evaluate(el => el.classList.contains('active')), true);
    assert.ok(await page.locator('.storage-section-head').isVisible());

    // 3. Return to decks
    await page.locator('#main-navigation [data-action="decks"]').click();
    assert.equal(await page.evaluate(() => view), 'decks');

    // 4. Open a deck
    await page.locator('[data-action="open-deck"]').click();
    assert.equal(await page.evaluate(() => view), 'library');
    // #nav-flash must now be visible
    assert.equal(await page.locator('#nav-flash').isVisible(), true);
    assert.equal(await page.locator('#nav-flash').evaluate(el => el.classList.contains('active')), false);

    // 5. Click Flashcard tab on header
    await page.locator('#nav-flash').click();
    assert.equal(await page.evaluate(() => view), 'flash');
    assert.equal(await page.locator('#nav-flash').evaluate(el => el.classList.contains('active')), true);
    assert.ok(await page.locator('#flashcard').isVisible());

    // 6. Flip card and rate
    await page.locator('#flashcard').click();
    await page.locator('[data-action="known"]').click();

    // 7. Click Dung lượng while in session
    await page.locator('#nav-storage').click();
    assert.equal(await page.evaluate(() => view), 'storage');
    assert.equal(await page.locator('#nav-storage').evaluate(el => el.classList.contains('active')), true);

    // 8. Return back from storage
    await page.locator('[data-action="storage-back"]').click();
    assert.equal(await page.evaluate(() => view), 'flash');
    assert.equal(await page.locator('#nav-flash').evaluate(el => el.classList.contains('active')), true);

    // 9. Back to decks and verify file-guide bar is present
    await page.locator('#main-navigation [data-action="decks"]').click();
    assert.equal(await page.evaluate(() => view), 'decks');
    assert.ok(await page.locator('.file-guide').isVisible());
    assert.equal(await page.locator('.file-guide .file-guide-item').count(), 3);

    // 10. Click upload-header and verify 3 modes dialog appears
    await page.locator('#upload-header').click();
    assert.equal(await page.locator('#dialog').getAttribute('open'), '');
    assert.equal(await page.locator('#dialog .create-mode').count(), 3);
    assert.ok(await page.locator('#dialog [data-action="upload-vocab"]').isVisible());
    assert.ok(await page.locator('#dialog [data-action="upload-quiz"]').isVisible());
    assert.ok(await page.locator('#dialog [data-action="import-backup"]').isVisible());
    await page.locator('#dialog [data-action="close-dialog"]').first().click();
    assert.equal(await page.locator('#dialog').getAttribute('open'), null);

    assert.deepEqual(errors, []);
    console.log('Header tabs, upload-header 3 modes dialog, and decks file-guide bar passed.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
  server.close();
});
