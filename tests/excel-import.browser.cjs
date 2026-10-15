const { chromium } = require('playwright');
const JSZip = require('jszip');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.join(__dirname, '..');
const html = require('./helpers/app.cjs').readAppHtml();
const hash = html.match(/const ACCESS_HASH='([a-f0-9]+)'/)[1];

const server = http.createServer((req, res) => {
  const file = (/^\/(vendor|assets)\//.test(req.url))
    ? path.join(root, req.url)
    : path.join(root, 'index.html');
  res.setHeader(
    'Content-Type',
    /\.m?js$/.test(file)
      ? 'text/javascript'
      : /\.css$/.test(file)
      ? 'text/css'
      : 'text/html; charset=utf-8'
  );
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath:
        process.env.CHROME_PATH ||
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
    });
    const context = await browser.newContext();
    await context.addInitScript(
      h => localStorage.setItem('la-access-v2', h),
      hash
    );
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + server.address().port);

    // Build standard Excel (.xlsx) file
    const zip = new JSZip();
    zip.file(
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>'
    );
    zip.file(
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    );
    zip.file(
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>'
    );
    zip.file(
      'xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Từ vựng B1" sheetId="1" r:id="rId1"/></sheets></workbook>'
    );

    // Shared strings matching the 5 columns from user screenshot:
    // STT | Từ vựng | Dạng từ | Nghĩa | Ví dụ
    const sst = [
      'STT',
      'Từ vựng',
      'Dạng từ',
      'Nghĩa',
      'Ví dụ',
      'abandon',
      'từ bỏ, ruồng bỏ',
      'He abandoned his car.',
      'ability',
      'danh từ',
      'khả năng, năng lực',
      'She has great ability.',
      'abnormal',
      'adj',
      'bất thường',
      'An abnormal temperature.',
    ];
    zip.file(
      'xl/sharedStrings.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sst.length}" uniqueCount="${sst.length}">${sst.map(s => `<si><t>${s}</t></si>`).join('')}</sst>`
    );

    // Sheet1 with cell values
    zip.file(
      'xl/worksheets/sheet1.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
        <row r="1">
          <c r="A1" t="s"><v>0</v></c>
          <c r="B1" t="s"><v>1</v></c>
          <c r="C1" t="s"><v>2</v></c>
          <c r="D1" t="s"><v>3</v></c>
          <c r="E1" t="s"><v>4</v></c>
        </row>
        <row r="2">
          <c r="A2"><v>1</v></c>
          <c r="B2" t="s"><v>5</v></c>
          <c r="C2" t="inlineStr"><is><t>v</t></is></c>
          <c r="D2" t="s"><v>6</v></c>
          <c r="E2" t="s"><v>7</v></c>
        </row>
        <row r="3">
          <c r="A3"><v>2</v></c>
          <c r="B3" t="s"><v>8</v></c>
          <c r="C3" t="s"><v>9</v></c>
          <c r="D3" t="s"><v>10</v></c>
          <c r="E3" t="s"><v>11</v></c>
        </row>
        <row r="4">
          <c r="A4"><v>3</v></c>
          <c r="B4" t="s"><v>12</v></c>
          <c r="C4" t="s"><v>13</v></c>
          <c r="D4" t="s"><v>14</v></c>
          <c r="E4" t="s"><v>15</v></c>
        </row>
      </sheetData></worksheet>`
    );

    const xlsxBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // 1. Upload Excel file via #file-input
    await page.locator('#file-input').setInputFiles({
      name: 'Vocabulary_B1.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: xlsxBuffer,
    });

    // 2. Wait for preview dialog
    await page.waitForSelector('#import-form');
    assert.equal(
      await page.evaluate(() => Core.flatten(pending.parsed.chapters).length),
      3
    );

    // Check deck name defaulted from filename
    assert.equal(
      await page.locator('#deck-name').inputValue(),
      'Vocabulary_B1'
    );

    // Submit import
    await page.locator('#import-form button[type="submit"]').click();
    await page.waitForSelector('.chapter-card, #search');

    // 3. Verify cards in deck
    const cards = await page.evaluate(() =>
      Core.flatten(deck().chapters).map(c => ({
        word: c.word,
        pos: c.pos,
        meaning: c.meaning,
        note: c.note,
        originalWord: c.originalWord,
      }))
    );

    assert.equal(cards.length, 3);
    assert.deepEqual(cards[0], {
      word: 'abandon',
      pos: '(v)',
      meaning: 'từ bỏ, ruồng bỏ',
      note: 'He abandoned his car.',
      originalWord: '(v) abandon',
    });
    assert.deepEqual(cards[1], {
      word: 'ability',
      pos: '(n)',
      meaning: 'khả năng, năng lực',
      note: 'She has great ability.',
      originalWord: '(n) ability',
    });
    assert.deepEqual(cards[2], {
      word: 'abnormal',
      pos: '(adj)',
      meaning: 'bất thường',
      note: 'An abnormal temperature.',
      originalWord: '(adj) abnormal',
    });

    // Search bar shows search results with table
    await page.locator('#search').fill('abandon');
    await page.waitForSelector('table');
    const searchWord = await page.locator('table .word').textContent();
    assert.ok(searchWord.includes('(v)'));
    assert.ok(searchWord.includes('abandon'));
    const searchMeaning = await page.locator('table .meaning').textContent();
    assert.ok(searchMeaning.includes('từ bỏ, ruồng bỏ'));
    assert.ok(searchMeaning.includes('He abandoned his car.'));

    // Clear search
    await page.locator('#search').fill('');

    // 4. Test studying via Flashcard mode
    // Click chapter to view group
    await page.locator('.chapter-card').first().click();
    await page.waitForSelector('[data-action="study-section"]');

    // Start flashcard for the section
    await page.locator('[data-action="study-section"]').first().click();
    await page.waitForSelector('#flashcard');

    // Front should show badge (v) and word abandon
    const front = await page.locator('.card-face.front').textContent();
    assert.ok(front.includes('abandon'));
    assert.ok(front.includes('(v)'));

    // Flip card by pressing Space
    await page.keyboard.press('Space');
    await page.waitForSelector('#flashcard.flipped');
    const back = await page.locator('.card-face.back').textContent();
    assert.ok(back.includes('từ bỏ, ruồng bỏ'));
    assert.ok(back.includes('He abandoned his car.'));

    // Return to library
    await page.locator('[data-action="exit-study"]').click();
    await page.locator('[data-action="library"]').first().click();

    // 5. Test CSV upload as well
    const csvContent =
      'STT,Từ vựng,Dạng từ,Nghĩa,Ví dụ\n1,cat,danh từ,con mèo,A cute cat\n2,sleep,động từ,ngủ,Sleep well';
    await page.locator('[data-action="upload"]').first().click();
    await page.locator('#file-input').setInputFiles({
      name: 'Animals.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent, 'utf8'),
    });

    await page.waitForSelector('#import-form');
    assert.equal(
      await page.evaluate(() => Core.flatten(pending.parsed.chapters).length),
      2
    );
    await page.locator('#import-form button[type="submit"]').click();
    await page.reload();

    const currentDeck = await page.evaluate(() => deck());
    assert.equal(currentDeck.name, 'Animals');
    const animalCards = await page.evaluate(() =>
      Core.flatten(deck().chapters).map(c => [c.word, c.pos, c.meaning, c.note])
    );
    assert.deepEqual(animalCards, [
      ['cat', '(n)', 'con mèo', 'A cute cat'],
      ['sleep', '(v)', 'ngủ', 'Sleep well'],
    ]);

    assert.deepEqual(errors, []);
    console.log(
      'Browser: Excel (.xlsx) 5-column import, POS badges, notes, Flashcard study mode, and CSV import all passed 100%!'
    );
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
