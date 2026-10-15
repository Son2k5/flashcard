const { chromium } = require('playwright'), JSZip = require('jszip');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const root = path.join(__dirname, '..'), html = require('./helpers/app.cjs').readAppHtml(), hash = html.match(/const ACCESS_HASH='([a-f0-9]+)'/)[1];
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const server = http.createServer((req, res) => {
  const file = (/^\/(vendor|assets)\//.test(req.url)) ? path.join(root, req.url) : path.join(root, 'index.html');
  for (const h of config.headers[0].headers) res.setHeader(h.key, h.value);
  res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript' : /\.css$/.test(file) ? 'text/css' : 'text/html; charset=utf-8');
  res.end(fs.readFileSync(file));
});

async function makeQuizDocx() {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + [
    'Câu 1: Hành tinh nào gần Mặt Trời nhất?',
    'A. Sao Thủy',
    'B. Sao Kim',
    'C. Trái Đất',
    'D. Sao Hỏa',
    'Giải thích: Sao Thủy có khoảng cách gần nhất tới Mặt Trời.',
    'Câu 2: Thủ đô của Việt Nam là gì?',
    'A. TP. Hồ Chí Minh',
    'B. Đà Nẵng',
    'C. Hà Nội',
    'D. Cần Thơ',
    'Giải thích: Hà Nội là thủ đô của Việt Nam.'
  ].map((t) => `<w:p><w:r>${t.includes('A. Sao Thủy') || t.includes('C. Hà Nội') ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t>${t}</w:t></w:r></w:p>`).join('') + '</w:body></w:document>');
  return zip.generateAsync({ type: 'nodebuffer' });
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const context = await browser.newContext();
    await context.addInitScript(hash => localStorage.setItem('la-access-v2', hash), hash);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept());
    await page.route('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js', route => route.fulfill({ path: path.join(root, 'node_modules/mammoth/mammoth.browser.min.js'), contentType: 'text/javascript' }));
    await page.goto('http://127.0.0.1:' + server.address().port);

    // 1. Upload multiple-choice DOCX file and check preview mode choices
    await page.locator('[data-action="upload-quiz"]').first().click();
    await page.locator('#quiz-file-input').setInputFiles({
      name: 'DiaLy.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: await makeQuizDocx()
    });
    await page.waitForSelector('#quiz-import-form');

    // Verify mode choices are rendered
    assert.equal(await page.locator('#mode-flashcard').isVisible(), true);
    assert.equal(await page.locator('#mode-quiz').isVisible(), true);
    assert.equal(await page.locator('#mode-both').isVisible(), true);
    assert.equal(await page.locator('[data-action="save-quiz-as-flash"]').isVisible(), true);

    // Click "Lưu & Học Flashcard"
    await page.locator('[data-action="save-quiz-as-flash"]').click();

    // Verify that it transitions directly to flashcard mode
    await page.waitForSelector('#flashcard');
    assert.equal(await page.evaluate(() => view), 'flash');
    assert.equal(await page.evaluate(() => flash.cards.length), 2);

    // Verify multiple choice options are displayed on the front face of the flashcard
    const optBadges = await page.locator('.front .flashcard-opt-badge').allTextContents();
    assert.deepEqual(optBadges, ['A', 'B', 'C', 'D']);
    const promptText = await page.locator('.front .question-prompt').textContent();
    assert.match(promptText, /Hành tinh nào gần Mặt Trời nhất/);

    // Flip the card and verify answer callout & explanation
    await page.keyboard.press('Space');
    await page.waitForFunction(() => flash.flipped === true);
    const answerVal = await page.locator('.back .flashcard-answer-val').textContent();
    assert.match(answerVal, /Sao Thủy/);
    const correctBadge = await page.locator('.back .flashcard-correct-badge').textContent();
    assert.match(correctBadge, /Đáp án đúng/);
    const noteText = await page.locator('.back .flashcard-note-box').textContent();
    assert.match(noteText, /khoảng cách gần nhất/);

    // Rate "Đã nhớ" (known)
    await page.locator('[data-action="known"]').click();
    assert.equal(await page.evaluate(() => Object.keys(flash.resolved).length), 1);

    // Second card: flip and rate "Chưa nhớ" (unknown)
    await page.keyboard.press('Space');
    await page.locator('[data-action="unknown"]').click();

    // The unknown card should cycle back (queue length > 0)
    assert.ok(await page.evaluate(() => flash.queue.length > 0));

    // Finish remaining card
    await page.keyboard.press('Space');
    await page.locator('[data-action="known"]').click();

    // Reaches flashcard result view
    await page.waitForSelector('.result-hero');
    assert.equal(await page.evaluate(() => view), 'flash-result');
    assert.equal(await page.locator('.result-hero [data-action="quiz-setup"]').isVisible(), true);

    // Click "Thử sức Quiz" from flashcard result
    await page.locator('.result-hero [data-action="quiz-setup"]').click();
    await page.waitForSelector('#start-quiz');
    assert.equal(await page.evaluate(() => view), 'quiz-setup');

    // From quiz-setup, click "Học Flashcard bộ này"
    assert.equal(await page.locator('[data-action="start-flash-from-quiz"]').isVisible(), true);
    await page.locator('[data-action="start-flash-from-quiz"]').click();
    await page.waitForSelector('#flashcard');
    assert.equal(await page.evaluate(() => view), 'flash');

    // Go to decks list
    await page.locator('[data-action="decks"]').first().click();
    await page.waitForSelector('.deck-card');

    // Verify deck card has both Flashcard and Quiz buttons
    assert.equal(await page.locator('[data-action="open-deck-flash"]').count(), 1);
    assert.equal(await page.locator('[data-action="open-deck"]').count(), 1);

    // Click Flashcard button from deck card
    await page.locator('[data-action="open-deck-flash"]').click();
    await page.waitForSelector('#flashcard');
    assert.equal(await page.evaluate(() => view), 'flash');

    assert.deepEqual(errors, []);
    console.log('Browser: Multiple choice flashcard mode, option rendering, answer review, rating, result navigation, deck card buttons and quiz switching passed.');
  } finally {
    await browser.close();
    await new Promise(r => server.close(r));
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
  server.close();
});
