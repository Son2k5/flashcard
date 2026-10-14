Bundled document readers, loaded on demand by index.html:

- Mammoth 1.13.0: mammoth.browser.min.js from the npm package `mammoth`. License: mammoth-LICENSE (BSD-2-Clause).
- PDF.js 6.4.299: pdf.min.mjs and pdf.worker.min.mjs from `pdfjs-dist/build`. License: pdfjs-LICENSE (Apache-2.0).

The PDF main module and worker must always use the same version. PDF font-weight extraction also uses `page.commonObjs` after `getOperatorList()`; run the real-PDF browser test before upgrading PDF.js.
