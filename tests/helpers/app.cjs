const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "../..");

// Existing unit tests evaluate pure modules; legacy browser tests serve this
// self-contained document. The responsive suite serves real production assets.
function readAppHtml() {
  return fs
    .readFileSync(path.join(root, "index.html"), "utf8")
    .replace(
      /<link rel="stylesheet" href="([^"]+)"\s*\/?>/g,
      (_, file) =>
        `<style>${fs.readFileSync(path.join(root, file), "utf8")}</style>`,
    )
    .replace(
      /<script id="([^"]+)" src="([^"]+)"><\/script>/g,
      (_, id, file) =>
        `<script id="${id}">\n${fs.readFileSync(path.join(root, file), "utf8").replace(/^/gm, "    ")}</script>`,
    );
}

module.exports = { readAppHtml, root };
