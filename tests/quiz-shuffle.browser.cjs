const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const { DOMParser } = require('linkedom');
const html = require('./helpers/app.cjs').readAppHtml();
const Core = new Function('DOMParser', html.match(/<script id="core">([\s\S]*?)<\/script>/)[1] + ';return Core;')(DOMParser);
const hash = html.match(/const ACCESS_HASH\s*=\s*'([a-f0-9]+)'/)[1];
const questions = Array.from({ length: 4 }, (_, i) => ({
  word: `Question ${i}`, options: ['A', 'B', 'C', 'D'].map(label => ({ label, text: `${label}${i}` })),
  answer: 'B', note: '', issues: [],
}));
const deck = { id: 'shuffle-test', kind: 'quiz', name: 'Shuffle test', language: 'vi-VN', hasChapters: false,
  chapters: Core.questionChapters(questions), organization: { mode: 'merged', dedupe: false },
  progress: {}, activity: [], records: {}, quizMemory: {} };
const fixture = { app: 'la-vocab', version: 2, decks: [deck], activeDeckId: deck.id, settings: { theme: 'light', sound: false } };
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); });
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ fixture, hash }) => {
      localStorage.setItem('la-vocab-v2', JSON.stringify(fixture));
      localStorage.setItem('la-access-v2', hash);
    }, { fixture, hash });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.locator('[data-action="open-deck"]').click();await page.locator('#main [data-action="quiz-setup"]').click();
    assert.equal(await page.locator('#quiz-format').isVisible(), true);
    assert.deepEqual(await page.locator('#quiz-format option').allTextContents(), [
      'Trắc nghiệm A–D', 'Đúng / Sai (True / False)', 'Điền từ / Gõ đáp án', 'Hỗn hợp cả 3 dạng'
    ]);
    assert.equal(await page.locator('#quiz-shuffleAnswers').isChecked(), true);
    await page.locator('#quiz-shuffle').uncheck();
    await page.locator('#quiz-repeat').check();
    await page.locator('#quiz-time').selectOption('0');
    // Fixed RNG makes permutation assertions deterministic.
    await page.evaluate(() => { Math.random = () => 0; });
    await page.locator('#start-quiz').click();
    const original = await page.evaluate(() => originalCards(deck()).map(c => ({ options: c.options, answer: c.answer, meaning: c.meaning })));
    const order = await page.evaluate(() => question().options);
    assert.deepEqual(order, ['B0', 'C0', 'D0', 'A0']);
    assert.deepEqual(await page.locator('.answer .shape').allTextContents(), ['A', 'B', 'C', 'D']);
    assert.deepEqual(await page.evaluate(() => quiz.questions.map(q => q.card.word)), questions.map(q => q.word));
    await page.evaluate(() => renderQuiz());
    assert.deepEqual(await page.evaluate(() => question().options), order);
    await page.locator('[data-action="pause-quiz"]').click();
    assert.equal(await page.locator('#dialog').isVisible(), true);
    assert.equal(await page.evaluate(() => quiz.paused), true);
    await page.locator('[data-action="resume-quiz"]').click();
    assert.equal(await page.locator('.quiz-prompt').isVisible(), true);
    assert.equal(await page.evaluate(() => quiz.paused), false);
    assert.deepEqual(await page.evaluate(() => question().options), order);
    await page.evaluate(() => { quiz.inventory = ['half']; renderQuiz(); });
    await page.locator('[data-action="power"]').click();
    assert.equal(await page.locator('.answer:disabled').count(), 2);
    assert.equal(await page.locator('.answer[data-index="0"]').isEnabled(), true);
    // Wrong choice queues a freshly shuffled repeat without changing current feedback.
    const wrong = await page.evaluate(() => question().options.findIndex((v, i) => v !== question().card.meaning && !quiz.hidden.includes(i)));
    await page.locator(`.answer[data-index="${wrong}"]`).click();
    assert.equal(await page.evaluate(() => quiz.feedback.correct), false);
    assert.equal(await page.locator('.answer.correct').getAttribute('data-index'), '0');
    assert.deepEqual(await page.evaluate(() => question().options), order);
    assert.deepEqual(await page.evaluate(() => quiz.questions[3].options), ['C0', 'D0', 'A0', 'B0']);
    for (let i = 0; i < 4; i++) {
      await page.locator('#quiz-next').click();
      const index = await page.evaluate(() => question().options.indexOf(question().card.meaning));
      await page.keyboard.press(String(index + 1));
      assert.equal(await page.evaluate(() => quiz.feedback.correct), true);
    }
    assert.equal(await page.evaluate(() => quiz.results.filter(r => r.correct).length), 3);
    assert.equal(await page.evaluate(() => quiz.retryResults[0].points), 0);
    assert.deepEqual(await page.evaluate(() => originalCards(deck()).map(c => ({ options: c.options, answer: c.answer, meaning: c.meaning }))), original);
    await page.locator('#quiz-next').click();
    await page.locator('[data-action="replay-quiz"]').click();
    assert.deepEqual(await page.evaluate(() => question().options), order);
    // Explicit opt-out preserves source order and remains independent of question shuffle.
    await page.evaluate(() => { view = 'quiz-setup'; stopTimers(); render(); });
    await page.locator('#quiz-shuffleAnswers').uncheck();
    await page.locator('#start-quiz').click();
    assert.deepEqual(await page.evaluate(() => question().options), original[0].options);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    // Existing A–D questions can be presented as True/False or typed answers.
    await page.evaluate(() => { stopTimers(); quiz = null; view = 'quiz-setup'; render(); });
    await page.locator('#quiz-format').selectOption('true-false');
    await page.locator('#quiz-shuffle').uncheck();
    await page.locator('#start-quiz').click();
    assert.deepEqual(await page.locator('.answer .shape').allTextContents(), ['T', 'F']);
    assert.match(await page.locator('.quiz-prompt').innerText(), /Đáp án đề xuất:/);
    const tfAnswer = await page.evaluate(() => question().options.indexOf(questionExpected(question())));
    await page.locator(`[data-action="quiz-answer"][data-index="${tfAnswer}"]`).click();
    assert.equal(await page.evaluate(() => quiz.feedback.correct), true);
    await page.evaluate(() => { stopTimers(); quiz = null; view = 'quiz-setup'; render(); });
    await page.locator('#quiz-format').selectOption('typing');
    await page.locator('#quiz-shuffle').uncheck();
    await page.locator('#start-quiz').click();
    assert.equal(await page.locator('#quiz-answer-input').isVisible(), true);
    await page.locator('#quiz-answer-input').fill('  b0  ');
    await page.locator('#quiz-answer-form button').click();
    assert.equal(await page.evaluate(() => quiz.feedback.correct), true);
    assert.deepEqual(errors, []);
    console.log('Quiz shuffle: default, labels, scoring, keyboard, 50/50, repeat, replay, source integrity, opt-out, pause/resume and layout passed.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
