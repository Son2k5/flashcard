const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { DOMParser } = require('linkedom');

(async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const html = require('./helpers/app.cjs').readAppHtml();
  const start = html.indexOf('    async function readQuizPDF(file)');
  const end = html.indexOf('\n    async function ', start + 10);
  // Use the production importer with the Node PDF.js worker configuration.
  const source = html.slice(start, end).replace(/pdfjs\.GlobalWorkerOptions\.workerSrc\s*=\s*['"]\.\/vendor\/pdf.worker.min.mjs['"];?/, '');
  const readPDF = new Function('loadPdfJs', source + ';return readQuizPDF;')(async () => pdfjs);
  const Core = new Function('DOMParser', html.match(/<script id="core">([\s\S]*?)<\/script>/)[1] + ';return Core;')(DOMParser);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  // Tight spacing reproduces the original false positive on the preceding line.
  const cases = [
    { marks: [3], width: 160, answer: 'D' },
    { marks: [1], width: 12, answer: 'B' },
    { marks: [1, 3], width: 160, answer: null },
    { marks: [], width: 160, answer: null },
  ];
  cases.forEach((test, index) => {
    const page = doc.addPage();
    page.drawText(`${index + 1}. Select an answer`, { x: 30, y: 780, size: 11, font });
    for (let i = 0; i < 4; i++) {
      const y = 760 - i * 16.5;
      if (test.marks.includes(i)) page.drawRectangle({ x: 30, y: y - 3, width: test.width, height: 13.5, color: rgb(1, 1, 0) });
      page.drawText(`${'ABCD'[i]}. Option ${i + 1}`, { x: 30, y, size: 11, font });
    }
  });
  const bytes = await doc.save();
  const lines = await readPDF({ arrayBuffer: async () => bytes });
  const parsed = Core.parseQuestions(lines, 'highlight.pdf');
  assert.equal(parsed.questions.length, cases.length);
  parsed.questions.forEach((q, index) => {
    assert.equal(q.answer, cases[index].answer);
    assert.deepEqual(q.options.map(o => o.bold), [0, 1, 2, 3].map(i => cases[index].marks.includes(i)));
  });
  console.log('PDF highlights: adjacent lines, label-only marks, ambiguous and unmarked answers passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
