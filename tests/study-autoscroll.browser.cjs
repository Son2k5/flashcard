const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const { DOMParser } = require('linkedom');
const html = require('./helpers/app.cjs').readAppHtml();
const Core = new Function('DOMParser', html.match(/<script id="core">([\s\S]*?)<\/script>/)[1] + ';return Core;')(DOMParser);
const hash = html.match(/const ACCESS_HASH\s*=\s*'([a-f0-9]+)'/)[1];
const rows = Array.from({ length: 15 }, (_, i) => `<tr><td>word ${i}</td><td>meaning ${i}</td></tr>`).join('');
const deck = {
  id: 'autoscroll-test',
  ...Core.parse(`<table>${rows}</table>`, 'Autoscroll.docx'),
  language: 'en-US', organization: { mode: 'merged', dedupe: false },
  progress: {}, activity: [], records: {}, quizMemory: {}
};
const fixture = { app: 'la-vocab', version: 2, decks: [deck], activeDeckId: deck.id, settings: { theme: 'light', sound: false } };
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 500 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(({ fixture, hash }) => {
      localStorage.setItem('la-vocab-v2', JSON.stringify(fixture));
      localStorage.setItem('la-access-v2', hash);
    }, { fixture, hash });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.locator('[data-action="open-deck"]').click();
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.locator('[data-action="start-flash-all"]').click();
    await page.waitForTimeout(50);
    assert.ok(await page.locator('.study-shell').evaluate(el => el.getBoundingClientRect().top <= 20));
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'flashcard');

    await page.locator('[data-action="exit-study"]').click();
    await page.locator('#nav-toggle').click();
    await page.locator('#nav-quiz-setup').click();
    await page.locator('#quiz-time').selectOption('0');
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.locator('#start-quiz').click();
    await page.waitForTimeout(50);
    assert.ok(await page.locator('.quiz-play').evaluate(el => el.getBoundingClientRect().top <= 20));
    assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('answer')), true);
    assert.deepEqual(errors, []);
    console.log('Study autoscroll: Flashcard and Quiz reveal the main task and focus its first control.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
