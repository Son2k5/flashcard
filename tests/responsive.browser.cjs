const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");
const { DOMParser } = require("linkedom");
const { root } = require("./helpers/app.cjs");

const Core = new Function(
  "DOMParser",
  fs.readFileSync(path.join(root, "assets/js/core.js"), "utf8") +
    "; return Core;",
)(DOMParser);
const hash = fs
  .readFileSync(path.join(root, "assets/js/app.js"), "utf8")
  .match(/const ACCESS_HASH='([^']+)'/)[1];
const parsed = Core.parse(
  "<h2>Chapter với tên dài để kiểm tra bố cục trên màn hình nhỏ</h2><table>" +
    Array.from(
      { length: 4 },
      (_, i) =>
        `<tr><td>word${i}${"long".repeat(12)}</td><td>Nghĩa của từ ${i}</td></tr>`,
    ).join("") +
    "</table>",
  "fixture.docx",
);
const fixture = {
  app: "la-vocab",
  version: 2,
  activeDeckId: "responsive",
  settings: { theme: "light", sound: false },
  decks: [
    {
      id: "responsive",
      ...parsed,
      name: "Bộ từ kiểm tra điện thoại và iPad " + "LongName".repeat(10),
      language: "en-US",
      organization: { mode: "split", dedupe: false },
      progress: {},
      activity: [],
      records: {},
      quizMemory: {},
    },
  ],
};
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const file = path.resolve(
    root,
    "." + (pathname === "/" ? "/index.html" : pathname),
  );
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  for (const header of require("../vercel.json").headers[0].headers)
    res.setHeader(header.key, header.value);
  res.setHeader(
    "Content-Type",
    file.endsWith(".css")
      ? "text/css"
      : file.endsWith(".js")
        ? "text/javascript"
        : "text/html; charset=utf-8",
  );
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath:
        process.env.CHROME_PATH ||
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
    });
    const errors = [];
    for (const [width, height] of [
      [320, 740],
      [390, 844],
      [430, 932],
      [667, 375],
      [768, 1024],
      [820, 1180],
      [1024, 768],
      [1180, 820],
      [1440, 900],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: width <= 1180,
      });
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("dialog", (dialog) => dialog.accept());
      const check = async (label) => {
        const overflow = await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        if (overflow.scroll > overflow.width + 1)
          console.log(
            await page.evaluate(() =>
              [...document.querySelectorAll("#main *")]
                .filter((el) => el.getBoundingClientRect().right > innerWidth)
                .map((el) => ({
                  tag: el.tagName,
                  class: el.className,
                  width: el.getBoundingClientRect().width,
                  text: el.textContent.slice(0, 50),
                }))
                .slice(0, 15),
            ),
          );
        assert.ok(
          overflow.scroll <= overflow.width + 1,
          `${width}px ${label}: ${JSON.stringify(overflow)}`,
        );
        const modal = page.locator("dialog[open]");
        if (await modal.count())
          assert.ok(
            await modal.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
            `${width}px ${label}: dialog overflow`,
          );
      };
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await check("gate");
      await page.evaluate(
        ({ fixture, hash }) => {
          localStorage.setItem("la-vocab-v2", JSON.stringify(fixture));
          localStorage.setItem("la-access-v2", hash);
        },
        { fixture, hash },
      );
      await page.reload();
      await page.locator('[data-action="open-deck"]').first().waitFor();
      assert.equal(
        await page
          .locator(".header .nav")
          .evaluate((el) => getComputedStyle(el).display),
        width <= 1100 ? "none" : "flex",
      );
      const openNavigation = async () => {
        if (width <= 1100) await page.locator("#nav-toggle").click();
      };
      if (width <= 1100) {
        const toggle = page.locator("#nav-toggle");
        await toggle.click();
        assert.equal(await toggle.getAttribute("aria-expanded"), "true");
        assert.ok(await page.locator("#nav-stats").isVisible());
        await check("expanded navigation");
        await page.keyboard.press("Tab");
        assert.ok(
          await page
            .locator("#main-navigation button")
            .first()
            .evaluate((el) => el === document.activeElement),
        );
        await page.keyboard.press("Escape");
        assert.equal(await toggle.getAttribute("aria-expanded"), "false");
        assert.ok(await toggle.evaluate((el) => el === document.activeElement));
        await toggle.click();
        await page.locator("#main h1").click();
        assert.equal(await toggle.getAttribute("aria-expanded"), "false");
        await toggle.click();
        await page.locator('#main-navigation [data-action="decks"]').click();
        assert.equal(await toggle.getAttribute("aria-expanded"), "false");
        await toggle.click();
        await page.setViewportSize({ width: 1280, height });
        assert.ok(await page.locator("#main-navigation").isVisible());
        await page.setViewportSize({ width, height });
        await page.waitForFunction(
          () =>
            document
              .querySelector("#nav-toggle")
              .getAttribute("aria-expanded") === "false",
        );
        assert.equal(await page.locator("#main-navigation").isVisible(), false);
      }
      await check("decks");
      await page.locator('[data-action="open-deck"]').first().click();
      await check("library");
      await page.locator("#search").fill("word");
      await check("search table");
      await page.locator("#search").fill("");
      await page.locator(".chapter-card").first().click();
      await check("group");
      await page.locator("#start-flash").click();
      await page.locator("#flashcard").click();
      await check("flash");
      await page.locator('[data-action="known"]').click();
      await openNavigation();
      await page.locator("#nav-quiz-setup").click();
      await check("quiz setup");
      await page.locator("#quiz-time").selectOption("0");
      await page.locator("#start-quiz").click();
      await check("quiz");
      await page.locator('[data-action="pause-quiz"]').click();
      await check("pause dialog");
      await page.locator(".dialog-close").click();
      await openNavigation();
      await page.locator("#nav-stats").click();
      await check("stats");
      await page.locator('[data-action="settings"]').click();
      await check("settings dialog");
      await page.locator('#dialog [data-action="storage"]').click();
      await check("storage table");
      await page.locator('[data-action="help"]').click();
      await check("help dialog");
      await page.locator(".dialog-close").click();
      await page.locator('[data-action="decks"]').first().click();
      await page.locator(".deck-menu summary").first().click();
      await page.locator('[data-action="deck-settings"]').first().click();
      await check("deck settings");
      await page.locator(".dialog-close").click();
      await page.locator("#theme-select").click();
      await check("theme");
      if ([390, 820, 1440].includes(width)) {
        fs.mkdirSync(path.join(root, "screenshots"), { recursive: true });
        await page.screenshot({
          path: path.join(root, `screenshots/responsive-${width}.png`),
          fullPage: true,
        });
      }
      await page.evaluate(() => {
        store.decks = [];
        render();
      });
      await check("empty state");
      console.log(
        `Responsive ${width}×${height}: gate, library, search, flash, quiz, stats, storage, dialogs and empty state passed.`,
      );
      await page.close();
    }
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
