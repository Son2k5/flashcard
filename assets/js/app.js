const paths = {
  leaf: '<path d="M20 3C10 2 3 6 4 13c1 7 11 8 14 1 2-4 2-8 2-11Z"/><path d="M4 21 15 9"/>',
  book: '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/>',
  headphones:
    '<path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="12" width="4" height="8" rx="2"/><rect x="17" y="12" width="4" height="8" rx="2"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  star: '<path d="m12 3 2.8 5.6 6.2.9-4.5 4.4 1.1 6.1-5.6-2.9L6.4 20l1.1-6.1L3 9.5l6.2-.9Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  cards:
    '<rect x="6" y="5" width="15" height="16" rx="3"/><path d="M16 2H5a3 3 0 0 0-3 3v12M10 10h7m-7 5h4"/>',
  fire: '<path d="M12 2c2 6 8 8 8 13a8 8 0 0 1-16 0c0-3 2-6 4-8 0 3 1 4 2 4 3-1 3-5 2-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  moon: '<path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z"/>',
  system:
    '<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8m-4-5v5"/>',
  speaker:
    '<path d="m11 4-6 5H2v6h3l6 5Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  flip: '<path d="M4 8h15l-4-4m5 12H5l4 4M4 8v5m16 3v-5"/>',
  shuffle:
    '<path d="m3 5 4 0 10 14h4m-4-4 4 4-4 3M3 19h4L17 5h4m-4-3 4 3-4 4"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  chart: '<path d="M4 3v18h17M8 16v-4m5 4V6m5 10V9"/>',
  trophy:
    '<path d="M8 3h8v6a4 4 0 0 1-8 0Zm8 1h4v3a4 4 0 0 1-4 4M8 4H4v3a4 4 0 0 0 4 4m4 2v6m-4 2h8"/>',
  plus: '<path d="M12 5v14m-7-7h14"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.cards}</svg>`;

/* Lưu trữ, điều hướng và giao diện. Không gửi tài liệu hoặc tiến độ lên máy chủ. */
// prettier-ignore
const ACCESS_HASH='b50d69ec079a3da2e49f32a3fbfb1274595578f38aa011abda60cd0040faf8f5';
const STORE_KEY = StorageModel.metaKey,
  ACCESS_KEY = "la-access-v2";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const uid = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : "d" +
      Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) =>
        n.toString(16),
      ).join("");
const languages = {
  "en-US": "Anh",
  "ja-JP": "Nhật",
  "ko-KR": "Hàn",
  "zh-CN": "Trung",
  "fr-FR": "Pháp",
  "de-DE": "Đức",
  "es-ES": "Tây Ban Nha",
};
let store = {
  app: "la-vocab",
  version: 2,
  decks: [],
  activeDeckId: null,
  settings: { theme: "system", sound: false },
};
let view = "decks",
  groupId = null,
  selectedSections = new Set(),
  hardFilter = false,
  search = "",
  flash = null,
  quiz = null,
  setup = null,
  pending = null,
  libraryPromise = null,
  uploading = false,
  unlocked = false;
let timer = null,
  autoTimer = null,
  audioContext = null,
  toastTimer = null,
  voices = [],
  saveOK = true;
const systemTheme = matchMedia("(prefers-color-scheme:dark)");
let migrationPending = false,
  loadBlocked = false,
  quotaFailure = false,
  storageReturn = null,
  quotaOpenTimer = null,
  storageEstimate = null,
  storageMessage = "";
// Proxy giữ việc truy cập localStorage trong các try/catch của bộ ghi/đọc.
const storagePort = {
  get length() {
    return localStorage.length;
  },
  key: (i) => localStorage.key(i),
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => localStorage.setItem(k, v),
  removeItem: (k) => localStorage.removeItem(k),
};
const writer = StorageModel.createWriter({
  storage: storagePort,
  onError: storageFailure,
  onSaved: () => {
    saveOK = true;
    quotaFailure = false;
    $("#storage-warning").hidden = true;
    if (migrationPending) {
      let cleared = true;
      for (const k of StorageModel.legacyKeys)
        if (!removeStorage(k)) cleared = false;
      migrationPending = !cleared;
    }
    checkCapacity();
  },
});
function storageFailure(error) {
  saveOK = false;
  quotaFailure = StorageModel.isQuota(error) || quotaFailure;
  $("#storage-warning").textContent = quotaFailure
    ? "Bộ nhớ trình duyệt đã đầy. Thay đổi chưa lưu vẫn còn trong tab này. Hãy xuất sao lưu, dọn dung lượng rồi bấm “Thử lưu lại”; đừng đóng tab trước khi lưu được."
    : "Tiến độ sẽ không được lưu. Trình duyệt đang chặn lưu trữ. Hãy xuất tiến độ trước khi đóng tab.";
  $("#storage-warning").hidden = false;
  if (quotaFailure && quotaOpenTimer === null)
    quotaOpenTimer = setTimeout(() => {
      quotaOpenTimer = null;
      if (unlocked) openStorage(true);
    }, 0);
}
function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    storageFailure(e);
    return null;
  }
}
function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    storageFailure(e);
    return false;
  }
}
function removeStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    storageFailure(e);
    return false;
  }
}
function queueDeck(d, kind) {
  const id = d.id;
  if (kind === "all" || kind === "data")
    writer.put(StorageModel.key("data", id), () =>
      JSON.stringify(StorageModel.dataPart(d)),
    );
  if (kind === "all" || kind === "progress")
    writer.put(StorageModel.key("progress", id), () =>
      JSON.stringify(StorageModel.packProgress(d.progress)),
    );
  if (kind === "all" || kind === "progress" || kind === "stats") {
    d.records = StorageModel.trimHistory(d.records);
    writer.put(StorageModel.key("stats", id), () =>
      JSON.stringify(StorageModel.statsPart(d)),
    );
  }
}
function save(kind = "progress", id = store.activeDeckId) {
  if (loadBlocked) return false;
  if (migrationPending || kind === "all") {
    for (const d of store.decks) queueDeck(d, "all");
    writer.put(STORE_KEY, () => JSON.stringify(StorageModel.metaPart(store)));
  } else {
    const d = store.decks.find((d) => d.id === id);
    if (d) queueDeck(d, kind);
    if (kind === "meta" || kind === "all-deck") {
      if (d && kind === "all-deck") queueDeck(d, "all");
      writer.put(STORE_KEY, () => JSON.stringify(StorageModel.metaPart(store)));
    }
  }
  return true;
}
function flushStorage() {
  if (loadBlocked) return false;
  return writer.flush();
}
function load() {
  try {
    const current = StorageModel.read(storagePort);
    if (current) {
      store = current;
      const older = StorageModel.legacyKeys.some(
        (k) => storagePort.getItem(k) !== null,
      );
      migrationPending = older;
      return;
    }
    let raw = storagePort.getItem("la-vocab-v2");
    if (!raw) raw = storagePort.getItem("la-flashcards-v1");
    if (raw) {
      store = StorageModel.migrate(JSON.parse(raw));
      migrationPending = true;
      save("all");
      flushStorage();
    }
  } catch (e) {
    loadBlocked = true;
    storageFailure(e);
    $("#storage-warning").textContent =
      "Không thể đọc dữ liệu đã lưu. Dữ liệu cũ chưa bị xóa hay ghi đè. Hãy nhập bản sao lưu hợp lệ để khôi phục.";
  }
}
function checkCapacity() {
  const usage = StorageModel.scan(storagePort);
  if (!usage.error && usage.total > StorageModel.limit * 0.8 && saveOK) {
    $("#storage-warning").textContent =
      "Bộ nhớ trình duyệt sắp đầy, hãy xóa bớt hoặc xuất sao lưu";
    $("#storage-warning").hidden = false;
  }
  return usage;
}
function formatBytes(n) {
  return n >= 1024 * 1024
    ? (n / (1024 * 1024)).toFixed(2) + " MB"
    : (n / 1024).toFixed(2) + " KB";
}
function showSettings() {
  if (view === "quiz" || view === "flash") {
    openStorage();
    return;
  }
  openDialog(
    `<h2 id="dialog-title">Cài đặt</h2><p>Quản lý dữ liệu lưu trên trình duyệt này và sao lưu trước khi chuyển máy.</p><div class="form-stack">${button("storage", "Quản lý dung lượng", "primary")}${button("export", "Xuất tất cả bộ từ")}${button("close-dialog", "Đóng")}</div>`,
  );
}
function openStorage(fromQuota = false) {
  if (view !== "storage") {
    storageReturn = view;
    if (view === "quiz" && quiz) {
      stopTimers();
      quiz.paused = true;
    }
  }
  if ($("#dialog").open) {
    $("#dialog").close();
    $("#dialog").dataset.kind = "";
    pending = null;
  }
  $("#main").classList.remove("paused-content");
  view = "storage";
  if (!fromQuota) flushStorage();
  render();
  scrollTo({ top: 0 });
  measureStorage();
}
function returnFromStorage() {
  view = storageReturn || "decks";
  storageReturn = null;
  if (view === "quiz" && quiz) {
    quiz.paused = false;
    quiz.lastTick = performance.now();
    if (!quiz.answered) timer = setInterval(tickQuiz, 100);
  }
  if ((view === "quiz" && !quiz) || (view.startsWith("flash") && !flash))
    view = "decks";
  render();
}
async function measureStorage() {
  try {
    storageEstimate = navigator.storage?.estimate
      ? await navigator.storage.estimate()
      : null;
  } catch (e) {
    storageEstimate = null;
  }
  if (view === "storage") renderStorage();
}
function renderStorage() {
  const usage = checkCapacity(),
    ratio = (usage.total / StorageModel.limit) * 100,
    entries = new Map(usage.entries);
  const sourceCount = store.decks.reduce(
    (n, d) => n + Core.flatten(d.chapters).length,
    0,
  );
  const rows = store.decks
    .map((d) => {
      const keys = ["data", "progress", "stats"].map((k) =>
        StorageModel.key(k, d.id),
      );
      const size = keys.reduce(
        (n, k) =>
          n + (entries.has(k) ? StorageModel.bytes(k, entries.get(k)) : 0),
        0,
      );
      const estimated = StorageModel.snapshot({ ...store, decks: [d] })
        .filter(([k]) => k !== STORE_KEY)
        .reduce((n, [k, v]) => n + StorageModel.bytes(k, v), 0);
      const last = [...d.activity].sort().at(-1);
      return `<tr><td class="storage-deck-name"><strong>${esc(d.name)}</strong><small>${esc(languages[d.language] || d.language)}</small></td><td data-label="Số thẻ">${Core.unique(Core.flatten(d.chapters)).length}</td><td data-label="Dung lượng">${formatBytes(size)}<small>${size ? "Trên trình duyệt" : "Chưa ghi theo schema mới"}${!size ? " · dự kiến " + formatBytes(estimated) : ""}</small></td><td class="storage-last-study" data-label="Học gần nhất">${last ? esc(last.split("-").reverse().join("/")) : "Chưa học"}</td><td class="storage-deck-actions"><div class="storage-actions">${button("export-deck", "Xuất sao lưu", "small", `data-id="${d.id}"`)}${button("clear-progress", "Xóa tiến độ", "small", `data-id="${d.id}"`)}${button("clear-history", "Xóa lịch sử quiz", "small", `data-id="${d.id}"`)}${button("delete-deck", "Xóa bộ từ", "small danger", `data-id="${d.id}"`)}</div></td></tr>`;
    })
    .join("");
  $("#main").innerHTML =
    intro(
      "CÀI ĐẶT · DỮ LIỆU TRÊN THIẾT BỊ",
      "Quản lý dung lượng",
      "Giữ lại những bộ từ cần học. Xuất sao lưu trước khi dọn dữ liệu.",
      button(
        "storage-back",
        storageReturn === "quiz" || storageReturn === "flash"
          ? "Tiếp tục phiên học"
          : "Quay lại",
        "",
      ),
    ) +
    `<div class="stats storage-summary"><div class="panel stat"><div><strong>${usage.error ? "Không đo được" : formatBytes(usage.total)}</strong><span>Dung lượng các khóa của ứng dụng</span></div></div><div class="panel stat"><div><strong>${ratio.toFixed(1)}%</strong><span>So với ước lượng localStorage 5 MB</span></div></div><div class="panel stat"><div><strong>${store.decks.length}</strong><span>Bộ từ · ${sourceCount} dòng thẻ gốc</span></div></div></div><div class="progress storage-meter" role="progressbar" aria-label="Dung lượng đã dùng theo ước lượng" aria-valuenow="${Math.min(100, Math.round(ratio))}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.min(100, ratio)}%;${ratio > 80 ? "background:var(--red)" : ""}"></i></div>${ratio > 80 ? '<div class="notice error">Bộ nhớ trình duyệt sắp đầy, hãy xóa bớt hoặc xuất sao lưu</div>' : ""}${quotaFailure ? '<div class="notice error">Không ghi được do hết dung lượng. Dữ liệu đang học vẫn còn trong tab. Xuất sao lưu trước, dọn lịch sử hoặc xóa bộ không cần, rồi bấm “Thử lưu lại”.</div>' : ""}${migrationPending ? '<div class="notice">Đang chuyển dữ liệu cũ sang schema 3. Bản cũ vẫn được giữ đến khi tất cả khóa mới ghi thành công. Nếu gần đầy, hãy xuất sao lưu trước rồi dọn dữ liệu để có chỗ chuyển đổi.</div>' : ""}${loadBlocked ? '<div class="notice error">Dữ liệu lưu trữ chưa đọc được; đang chặn ghi đè để bảo vệ bản cũ. Có thể nhập bản sao lưu hợp lệ qua nút “Nhập tiến độ”.</div>' : ""}${writer.pending ? `<div class="notice">${writer.pending} khóa đang chờ lưu. Dữ liệu mới nhất vẫn có trong file xuất sao lưu, kể cả khi lưu trình duyệt thất bại.</div>` : ""}<div class="storage-section-head"><h2>Các bộ từ của bạn</h2><div class="storage-toolbar">${button("cleanup-storage", "Dọn dẹp nhanh", "primary")}${button("retry-save", "Thử lưu lại")}${button("export", "Xuất tất cả")}</div></div>${store.decks.length ? `<div class="table-wrap storage-table"><table aria-label="Các bộ từ của bạn"><thead><tr><th scope="col">Bộ từ</th><th scope="col">Số thẻ</th><th scope="col">Dung lượng</th><th scope="col">Học gần nhất</th><th scope="col">Thao tác</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty-state">Chưa có bộ từ nào.</div>'}${storageMessage ? `<div class="notice" role="status">${esc(storageMessage)}</div>` : ""}`;
}
function exportDeck(id) {
  const d = store.decks.find((d) => d.id === id);
  if (d) downloadBackup({ ...store, decks: [d], activeDeckId: id });
}
function writeLegacyReduction() {
  if (!migrationPending) return true;
  const reduced = JSON.stringify({ ...store, version: 2, schemaVersion: 2 });
  if (!writeStorage("la-vocab-v2", reduced)) return false;
  return removeStorage("la-flashcards-v1");
}
function clearDeckPart(id, part) {
  const d = store.decks.find((d) => d.id === id);
  if (!d) return;
  const message =
    part === "progress"
      ? `Xóa tiến độ của “${d.name}”: bỏ trạng thái đã thuộc/chưa thuộc, dấu sao, ngày học và gợi ý quiz. Giữ toàn bộ từ vựng và lịch sử điểm quiz. Hãy xuất sao lưu trước. Tiếp tục?`
      : `Xóa toàn bộ lịch sử và điểm cao quiz của “${d.name}”? Từ vựng, tiến độ học và dấu sao vẫn giữ. Hãy xuất sao lưu trước. Tiếp tục?`;
  if (!confirm(message)) return;
  if (part === "progress") {
    d.progress = {};
    d.activity = [];
    d.quizMemory = {};
  } else d.records = {};
  if (
    storageReturn &&
    ["quiz", "quiz-result", "flash", "flash-result"].includes(storageReturn)
  ) {
    stopTimers();
    quiz = flash = null;
    storageReturn = "decks";
  }
  if (migrationPending) writeLegacyReduction();
  save(part === "progress" ? "progress" : "stats", id);
  flushStorage();
  storageMessage = saveOK
    ? "Đã xóa " +
      (part === "progress"
        ? "tiến độ; bộ từ và lịch sử quiz vẫn còn."
        : "lịch sử quiz; tiến độ học vẫn còn.")
    : "Đã cập nhật trong tab nhưng chưa ghi được. Hãy xuất sao lưu và thử lưu lại.";
  renderStorage();
}
function deleteDeck(id) {
  const d = store.decks.find((d) => d.id === id);
  if (
    !d ||
    !confirm(
      `Xóa hẳn bộ “${d.name}”, toàn bộ từ vựng, tiến độ, dấu sao và lịch sử quiz? Không thể hoàn tác. Hãy xuất sao lưu trước. Tiếp tục?`,
    )
  )
    return;
  const wasStorage = view === "storage";
  store.decks = store.decks.filter((d) => d.id !== id);
  if (store.activeDeckId === id)
    store.activeDeckId = store.decks[0]?.id || null;
  const keys = ["data", "progress", "stats", "session"].map((k) =>
    StorageModel.key(k, id),
  );
  writer.discard(keys);
  for (const k of keys) removeStorage(k);
  if (migrationPending) writeLegacyReduction();
  save("meta");
  flushStorage();
  stopTimers();
  flash = quiz = null;
  setup = null;
  storageReturn = "decks";
  pending = null;
  $("#dialog").close();
  view = wasStorage ? "storage" : "decks";
  render();
}
function cleanupStorage() {
  if (
    !confirm(
      "Dọn lịch sử: chỉ giữ 20 lượt gần nhất mỗi bộ và top 5 của từng tập chapter; xóa tiến độ/gợi ý của thẻ không còn tồn tại và khóa bộ từ mồ côi. Không xóa từ vựng hiện có. Hãy xuất sao lưu trước. Tiếp tục?",
    )
  )
    return;
  const before = StorageModel.scan(storagePort);
  for (const d of store.decks) StorageModel.cleanDeck(d);
  const ids = new Set(store.decks.map((d) => d.id));
  let orphanKeys = 0;
  for (const [k] of before.entries) {
    const match = k.match(/^la-vocab-v3:(?:data|progress|stats|session):(.+)$/);
    if (match && !ids.has(match[1])) {
      writer.discard([k]);
      if (removeStorage(k)) orphanKeys++;
    }
  }
  if (migrationPending) writeLegacyReduction();
  save("all");
  const ok = flushStorage();
  const after = StorageModel.scan(storagePort);
  storageMessage = `${ok ? "Đã dọn dẹp" : "Đã dọn trong tab; còn dữ liệu chưa lưu"}. Giải phóng ${formatBytes(Math.max(0, before.total - after.total))} trên trình duyệt; xóa ${orphanKeys} khóa mồ côi.${ok ? "" : " Hãy xuất sao lưu rồi thử lưu lại."}`;
  renderStorage();
}
function deleteAllData() {
  if (!leaveSession()) return;
  if (
    !confirm(
      "Xóa toàn bộ bộ từ, tiến độ, dấu sao và lịch sử quiz trên trình duyệt này? Không thể hoàn tác. Hãy xuất sao lưu trước. Tiếp tục?",
    )
  ) {
    view = "decks";
    render();
    return;
  }
  writer.clear();
  const scan = StorageModel.scan(storagePort);
  if (scan.error) {
    storageFailure(scan.error);
    view = "storage";
    render();
    return;
  }
  let ok = true;
  for (const [k] of scan.entries)
    if (k !== ACCESS_KEY && !removeStorage(k)) ok = false;
  if (!ok) {
    view = "storage";
    render();
    return;
  }
  store.decks = [];
  store.activeDeckId = null;
  loadBlocked = false;
  migrationPending = false;
  setup = null;
  save("meta");
  flushStorage();
  view = "decks";
  render();
  toast("Đã xóa dữ liệu học.");
}
function deck() {
  return store.decks.find((d) => d.id === store.activeDeckId) || null;
}
const originalCards = (d) => Core.unique(Core.flatten(d.chapters));
const visibleCards = (d) => Core.unique(Core.flatten(Core.organize(d)));
const stateOf = (id) => deck()?.progress[id] || {};
const known = (cards) => cards.filter((c) => stateOf(c.id).known).length;
const percent = (cards) =>
  cards.length ? Math.round((known(cards) * 100) / cards.length) : 0;
function day(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function streak(days) {
  let n = 0,
    d = new Date();
  if (!days.includes(day(d))) d.setDate(d.getDate() - 1);
  while (days.includes(day(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
function activity() {
  const d = deck(),
    today = day();
  if (!d.activity.includes(today)) d.activity.push(today);
}
function mark(id, value) {
  deck().progress[id] = { ...stateOf(id), known: value };
  activity();
  save();
}
function toast(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 4500);
}
const button = (action, label, cls = "", attrs = "") =>
  `<button type="button" class="btn ${cls}" data-action="${action}" ${attrs}>${label}</button>`;
function badges(pos) {
  return (pos.match(/\([^)]*\)/g) || [])
    .map(
      (p) =>
        `<span class="badge ${esc(p.replace(/[().\s]/g, "").toLowerCase())}">${esc(p)}</span>`,
    )
    .join(" ");
}
function meter(cards) {
  return `<div class="progress" role="progressbar" aria-label="Tỷ lệ đã thuộc" aria-valuenow="${percent(cards)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${percent(cards)}%"></i></div>`;
}
function starButton(id) {
  const on = stateOf(id).starred;
  return `<button class="icon-btn ${on ? "starred" : ""}" data-action="star" data-id="${esc(id)}" aria-pressed="${!!on}" aria-label="${on ? "Bỏ" : "Thêm"} đánh dấu từ khó">${icon("star")}</button>`;
}
function getVoice() {
  const lang = deck()?.language || "en-US";
  return (
    voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ||
    voices.find(
      (v) =>
        v.lang.split(/[-_]/)[0].toLowerCase() ===
        lang.split("-")[0].toLowerCase(),
    )
  );
}
function speaker(id) {
  return deck()?.kind !== "quiz" && getVoice()
    ? `<button class="icon-btn speech" data-action="speak" data-id="${esc(id)}" aria-label="Phát âm từ" title="Phát âm">${icon("speaker")}</button>`
    : "";
}
function voiceNotice() {
  return getVoice()
    ? ""
    : '<p class="muted voice-notice" style="font-size:12px;margin-top:12px">Thiết bị chưa có giọng đọc cho ngôn ngữ này; nút loa được ẩn. Có thể thêm giọng trong cài đặt thiết bị.</p>';
}
function speak(id) {
  const c = originalCards(deck()).find((c) => c.id === id);
  const voice = getVoice();
  if (!c || !voice || !("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(Core.splitWord(c.word).word);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.85;
    u.onerror = (e) => {
      if (!["canceled", "interrupted"].includes(e.error))
        toast("Chưa phát được giọng đọc trên thiết bị này.");
    };
    speechSynthesis.speak(u);
  } catch (e) {
    toast("Không thể phát âm trên trình duyệt này.");
  }
}
function theme() {
  const t = store.settings.theme,
    current = t === "system" ? (systemTheme.matches ? "dark" : "light") : t;
  document.documentElement.dataset.theme = current;
  for (const b of document.querySelectorAll('[data-action="theme"]')) {
    const label =
      current === "dark" ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối";
    b.innerHTML = icon(current === "dark" ? "sun" : "moon");
    b.setAttribute("aria-label", label);
    b.title = label;
  }
}
function header() {
  const d = deck();
  $("#upload-header").innerHTML =
    icon("upload") + (uploading ? "Đang đọc…" : "Upload file");
  $("#upload-header").disabled = uploading;
  for (const b of document.querySelectorAll("nav [data-action]"))
    b.classList.toggle(
      "active",
      b.dataset.action === view ||
        (b.dataset.action === "library" && view === "group"),
    );
  $("#nav-deck").hidden = !d;
  $("#nav-hard").hidden = !d;
  $("#nav-stats").hidden = !d;
  $("#nav-quiz-setup").hidden = !d;
  $("#backup-export").disabled = !store.decks.length;
}
// Only screen/deck/group changes create browser entries, never individual answers.
let routePosition = Number.isInteger(history.state?.flashcardPosition)
    ? history.state.flashcardPosition
    : 0,
  routeSnapshot = null,
  restoringRoute = false,
  undoingBack = false;
function currentRoute() {
  return {
    view,
    deckId: ["decks", "storage"].includes(view) ? null : store.activeDeckId,
    groupId: ["group", "flash", "flash-result"].includes(view) ? groupId : null,
  };
}
function syncRoute() {
  if (restoringRoute) return;
  const route = currentRoute();
  if (JSON.stringify(route) === JSON.stringify(routeSnapshot)) return;
  const state = {
    flashcardPosition: routeSnapshot ? ++routePosition : routePosition,
    flashcardRoute: route,
  };
  if (routeSnapshot) history.pushState(state, "");
  else history.replaceState(state, "");
  routeSnapshot = route;
}
function restoreRoute(route) {
  const allowed = [
    "decks",
    "storage",
    "library",
    "group",
    "hard",
    "stats",
    "quiz-setup",
    "quiz",
    "quiz-result",
    "flash",
    "flash-result",
  ];
  view = allowed.includes(route?.view) ? route.view : "decks";
  const target = store.decks.find((d) => d.id === route?.deckId);
  if (!["decks", "storage"].includes(view)) {
    if (!target) view = "decks";
    else store.activeDeckId = target.id;
  }
  groupId = route?.groupId || null;
  // A finished/abandoned session cannot be replayed by navigating Forward.
  if (["quiz", "quiz-result"].includes(view)) view = "quiz-setup";
  if (["flash", "flash-result"].includes(view))
    view = groupId ? "group" : "library";
  if (view === "group") {
    const g = currentGroup();
    if (g) selectedSections = new Set(g.sections.map((s) => s.id));
    else view = "library";
  }
  search = "";
  hardFilter = false;
  save("meta");
}
window.addEventListener("popstate", (event) => {
  const state = event.state;
  if (undoingBack) {
    undoingBack = false;
    return;
  }
  if (!state?.flashcardRoute) return;
  const targetPosition = state.flashcardPosition;
  if (!unlocked) {
    routePosition = targetPosition;
    routeSnapshot = null;
    return;
  }
  const resumeStorage =
    view === "storage" &&
    state.flashcardRoute.view === storageReturn &&
    state.flashcardRoute.deckId === store.activeDeckId &&
    ((storageReturn === "quiz" && quiz) ||
      (storageReturn === "flash" && flash));
  if (!resumeStorage && !leaveSession()) {
    undoingBack = true;
    history.go(routePosition - targetPosition);
    return;
  }
  if ($("#dialog").open) $("#dialog").close();
  $("#dialog").dataset.kind = "";
  pending = null;
  restoringRoute = true;
  routePosition = targetPosition;
  try {
    if (resumeStorage) returnFromStorage();
    else {
      storageReturn = null;
      restoreRoute(state.flashcardRoute);
      render();
    }
    routeSnapshot = currentRoute();
    history.replaceState(
      { flashcardPosition: routePosition, flashcardRoute: routeSnapshot },
      "",
    );
    flushStorage();
    scrollTo({ top: 0 });
  } finally {
    restoringRoute = false;
  }
});
// Disclosure navigation: keep hidden links out of the keyboard tab order.
function setNavigationOpen(open, restoreFocus = false) {
  const toggle = $("#nav-toggle");
  $(".header").classList.toggle("navigation-open", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute(
    "aria-label",
    open ? "Đóng menu điều hướng" : "Mở menu điều hướng",
  );
  if (restoreFocus) toggle.focus();
}
const compactNavigation = matchMedia("(max-width: 1100px)");
compactNavigation.addEventListener("change", () => setNavigationOpen(false));
document.addEventListener("click", (event) => {
  if (
    !event.target.closest(".header") &&
    $(".header").classList.contains("navigation-open")
  ) {
    setNavigationOpen(
      false,
      !!document.activeElement.closest("#main-navigation"),
    );
  }
});

function render() {
  if (!unlocked) return;
  setNavigationOpen(
    false,
    compactNavigation.matches &&
      !!document.activeElement.closest("#main-navigation"),
  );
  header();
  if (!deck() && !["decks", "storage"].includes(view)) view = "decks";
  syncRoute();
  (
    ({
      storage: renderStorage,
      decks: renderDecks,
      library: renderLibrary,
      group: renderGroup,
      hard: renderHard,
      stats: renderStats,
      flash: renderFlash,
      "flash-result": renderFlashResult,
      "quiz-setup": renderQuizSetup,
      quiz: renderQuiz,
      "quiz-result": renderQuizResult,
    })[view] || renderDecks
  )();
}
function stopTimers() {
  if (timer !== null) clearInterval(timer);
  if (autoTimer !== null) clearTimeout(autoTimer);
  timer = autoTimer = null;
}
function leaveSession() {
  const sessionView = view === "storage" ? storageReturn : view;
  const playing = sessionView === "quiz" && quiz && !quiz.answered;
  const wasPaused = quiz?.paused;
  if (playing && !wasPaused) {
    tickQuiz();
    quiz.paused = true;
    stopTimers();
  }
  if (
    (sessionView === "flash" || sessionView === "quiz") &&
    !confirm(
      sessionView === "quiz" ? "Rời bài trắc nghiệm? Bài đang làm sẽ được lưu để tiếp tục sau." : "Rời phiên flashcard? Tiến độ từng thẻ đã được lưu.",
    )
  ) {
    if (playing && !wasPaused && !quiz.answered) {
      quiz.paused = false;
      quiz.lastTick = performance.now();
      timer = setInterval(tickQuiz, 100);
    }
    return false;
  }
  stopTimers();
  $("#main").classList.remove("paused-content");
  if ($("#dialog").dataset.kind === "pause") {
    $("#dialog").close();
    $("#dialog").dataset.kind = "";
  }
  flash = null;
  saveQuizDraft();
  flushStorage();
  quiz = null;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  return true;
}
function navigate(target) {
  if (!leaveSession()) return;
  view = target;
  search = "";
  render();
  scrollTo({ top: 0 });
}
function openDeck(id) {
  if (!leaveSession()) return;
  store.activeDeckId = id;
  save("meta");
  view = deck().kind === "quiz" ? "quiz-setup" : "library";
  search = "";
  render();
  scrollTo({ top: 0 });
}
const intro = (tag, title, sub, extra = "") =>
  `<section class="intro"><div><div class="eyebrow">${tag}</div><h1>${title}</h1><p>${sub}</p></div>${extra}</section>`;
function fileGuide() {
  return `<section class="panel file-guide" aria-label="Hướng dẫn file có thể nộp"><h2>Bạn có thể nộp những file nào?</h2><p class="muted">Chọn đúng loại tài liệu để bắt đầu học. File được đọc ngay trên thiết bị của bạn.</p><div class="file-guide-grid"><article class="file-guide-item"><span class="pill">.docx</span><h3>Bộ từ vựng</h3><p>File Word có bảng gồm cột <b>Từ</b> và <b>Nghĩa</b>, hoặc mỗi dòng một từ, ví dụ: <b>apple: quả táo</b>. Dùng Heading 2 để chia chương.</p>${button("upload", "Thêm bộ từ", "small primary")}</article><article class="file-guide-item"><span class="pill">.docx · .pdf</span><h3>Câu hỏi trắc nghiệm</h3><p>Một file có thể gồm A–D, True/False và Short Answer. Chia phần bằng tiêu đề TRUE/FALSE QUESTIONS, MULTIPLE CHOICE QUESTIONS hoặc SHORT ANSWER QUESTIONS. Ghi <b>Đáp án: …</b> sau mỗi câu. PDF cần có văn bản chọn/copy được; kiểm tra đáp án ở bước xem trước.</p>${button("upload-quiz", "Nhập trắc nghiệm", "small primary")}</article><article class="file-guide-item"><span class="pill">.json</span><h3>Khôi phục tiến độ</h3><p>Dùng file đã tạo bằng <b>Xuất tiến độ</b> của ứng dụng. Khôi phục sẽ thay thế dữ liệu hiện tại; hãy xuất bản sao lưu trước.</p>${button("import-backup", "Nhập tiến độ", "small")}</article></div><p class="muted file-guide-note">Tối đa 30 MB/file. Chưa hỗ trợ .doc, Excel, ảnh hoặc PDF scan. Hãy lưu .doc thành .docx; chuyển bản scan thành văn bản trước khi nhập.</p></section>`;
}
function librarySwitcher() {
  return `<section class="panel library-switcher" aria-label="Chuyển bộ trong thư viện"><div class="switcher-field"><label for="library-deck">Chuyển bộ học <span class="pill">${store.decks.length} bộ trong thư viện</span></label><select id="library-deck" aria-describedby="library-switcher-hint">${store.decks.map((d) => `<option value="${esc(d.id)}" ${d.id === store.activeDeckId ? "selected" : ""}>${esc(d.name)} · ${d.kind === "quiz" ? "Trắc nghiệm" : "Từ vựng"}</option>`).join("")}</select></div>${button("upload", icon("plus") + " Thêm bộ từ", "small")}<p class="muted switcher-hint" id="library-switcher-hint">Chọn bộ để xem nội dung và thống kê. Tiến độ được lưu riêng cho từng bộ.</p></section>`;
}
function switchLibraryDeck(id) {
  if (!store.decks.some((d) => d.id === id) || id === store.activeDeckId)
    return;
  if (!leaveSession()) return;
  store.activeDeckId = id;
  groupId = null;
  selectedSections = new Set();
  search = "";
  hardFilter = false;
  setup = null;
  view = "library";
  save("meta");
  render();
  $("#library-deck").focus();
}
function renderDecks() {
  const cards = store.decks
    .map((d) => {
      const all = visibleCards(d),
        k = all.filter((c) => d.progress[c.id]?.known).length;
      return `<article class="panel deck-card"><div class="row spread"><span class="chapter-icon">${icon("book")}</span><span class="pill">${d.kind === "quiz" ? "Trắc nghiệm mọi môn" : esc(languages[d.language] || d.language)}</span></div><h2>${esc(d.name)}</h2><p class="muted">${all.length} ${d.kind === "quiz" ? "câu hỏi" : "từ"} · ${Core.organize(d).length} nhóm</p><div class="progress-label"><span>${k} ${d.kind === "quiz" ? "câu đã nắm vững" : "từ đã thuộc"}</span><strong>${Math.round((k * 100) / (all.length || 1))}%</strong></div><div class="progress"><i style="width:${(k * 100) / (all.length || 1)}%"></i></div><div class="row spread" style="margin-top:20px">${button("open-deck", (d.kind === "quiz" ? "Luyện trắc nghiệm " : "Mở bộ từ ") + icon("arrow"), "primary small", `data-id="${d.id}"`)}${button("deck-settings", "Cài đặt", "small", `data-id="${d.id}"`)}</div></article>`;
    })
    .join("");
  $("#main").innerHTML =
    intro(
      "MỖI NGÀY MỘT CHÚT",
      "Học mọi môn, mỗi ngày.",
      "Học từ vựng hoặc nhập bộ câu hỏi trắc nghiệm Word/PDF cho mọi môn.",
      `<div class="home-actions" aria-label="Thêm và quản lý bộ học">${button("upload", icon("upload") + " Thêm bộ từ", "primary")}${button("upload-quiz", icon("plus") + " Nhập trắc nghiệm", "primary")}${button("create-manual-deck", icon("plus") + " Tạo bộ thủ công")}${button("storage", "Quản lý dung lượng")}</div>`,
    ) +
    store.decks.map(draftHTML).join("") +
    (store.decks.length
      ? `<div class="grid">${cards}</div>`
      : `<div class="empty-hero"><div class="upload-zone" id="drop-zone">${icon("upload")}<h2>Bắt đầu từ tài liệu của bạn</h2><p>Kéo thả file Word (.docx) hoặc PDF vào đây. Tự nhận diện trắc nghiệm, bảng hoặc dòng từ vựng trong Word. Ví dụ: tools: (n) công cụ; hot: nóng &gt;&lt; cold: lạnh (cặp đối nghĩa).</p>${button("upload", "Chọn file Word / PDF " + icon("arrow"), "primary")}<p>Đọc ngay trên trình duyệt · Không gửi file lên mạng</p></div><div class="sample-area"><div class="sample-card"><div class="sample-inner"><small>MỘT THẺ, MỘT KẾT NỐI MỚI</small><strong>木漏れ日</strong><span class="badge">Tiếng Nhật</span><p>Nắng xuyên qua kẽ lá</p><small>Ngôn ngữ nào cũng có một nơi ở đây.</small></div></div></div></div>`) +
    fileGuide();
}
function statCards(cards) {
  return `<div class="stats">${[
    ["cards", cards.length, "Từ trong bộ"],
    ["check", known(cards), "Từ đã thuộc"],
    ["fire", streak(deck().activity), "Ngày liên tiếp"],
    [
      "star",
      originalCards(deck()).filter((c) => stateOf(c.id).starred).length,
      "Từ khó",
    ],
  ]
    .map(
      ([i, n, l]) =>
        `<div class="panel stat"><div class="stat-icon">${icon(i)}</div><div><strong>${n}</strong><span>${l}</span></div></div>`,
    )
    .join("")}</div>`;
}
function renderLibrary() {
  const d = deck();
  $("#main").innerHTML =
    intro(
      "THƯ VIỆN CỦA BẠN",
      esc(d.name),
      `${esc(languages[d.language] || d.language)} · ${d.organization.mode === "split" ? "Tách theo chapter" : "Gộp tất cả vào một bản"}`,
      button("deck-settings", "Cài đặt bộ từ", "", `data-id="${d.id}"`),
    ) +
    contentTools() +
    statCards(visibleCards(d)) +
    draftHTML(d) +
    librarySwitcher() +
    `<div class="section-head"><h2>Chọn một nhóm để bắt đầu</h2><label class="searchbar">${icon("search")}<input type="search" id="search" value="${esc(search)}" placeholder="Tìm từ hoặc nghĩa trong toàn bộ bộ từ…" aria-label="Tìm kiếm từ vựng"></label></div><div id="library-results"></div>` +
    fileGuide();
  renderSearch();
}
function wordTable(cards) {
  if (deck()?.kind === "quiz")
    return `<div class="section-list">${cards.map((c) => `<article class="panel question-preview"><h3>${esc(c.word)}</h3>${(c.options || []).map((o, i) => `<p class="${i === c.answer ? "quiz-answer-highlight" : ""}">${c.type === "true-false" ? "TF"[i] : "ABCD"[i]}. ${esc(o)}</p>`).join("")}<p><strong class="quiz-answer-highlight">Đáp án: ${c.options ? (c.type === "true-false" ? "TF"[c.answer] : "ABCD"[c.answer]) + ". " : ""}${esc(c.meaning)}</strong></p>${c.note ? `<p>Giải thích: ${esc(c.note)}</p>` : ""}${starButton(c.id)}</article>`).join("") || "<p>Chưa có câu hỏi phù hợp.</p>"}</div>`;
  if (!cards.length)
    return '<div class="empty-state">Chưa có từ phù hợp.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Từ</th><th>Nghĩa và ghi chú</th><th>Thao tác</th></tr></thead><tbody>${cards.map((c) => `<tr><td class="word">${badges(c.pos)} ${esc(c.word)}<small>${esc(c.chapterName || "")} / ${esc(c.sectionName || "")}</small></td><td class="meaning">${esc(c.meaning)}${c.note ? `<small>${esc(c.note)}</small>` : ""}</td><td><div class="row" style="flex-wrap:nowrap">${starButton(c.id)}${speaker(c.id)}</div></td></tr>`).join("")}</tbody></table></div>`;
}
function renderSearch() {
  const d = deck(),
    el = $("#library-results");
  if (!el) return;
  if (search.trim()) {
    const q = Core.normalize(search),
      cards = originalCards(d).filter((c) =>
        Core.normalize(c.word + " " + c.meaning + " " + c.note).includes(q),
      );
    el.innerHTML = `<p class="muted">${cards.length} kết quả trên toàn bộ cấu trúc gốc</p>${wordTable(cards)}`;
    return;
  }
  el.innerHTML = `<div class="grid">${Core.organize(d)
    .map((g, i) => {
      const cards = Core.unique(Core.flatten([g]));
      return `<button class="panel chapter-card" data-action="group" data-id="${g.id}"><span class="num">${String(i + 1).padStart(2, "0")}</span><span class="chapter-icon">${icon(/listening/i.test(g.name) ? "headphones" : "book")}</span><h3>${esc(g.name)}</h3><p>${cards.length} từ · ${g.sections.length} section</p><div class="progress-label"><span>${known(cards)} / ${cards.length} đã thuộc</span><strong>${percent(cards)}%</strong></div>${meter(cards)}<span class="chapter-bottom"><span>Học theo nhịp của bạn</span>${icon("arrow")}</span></button>`;
    })
    .join("")}</div>${voiceNotice()}`;
}
function currentGroup() {
  return Core.organize(deck()).find((g) => g.id === groupId);
}
function groupSelection() {
  const g = currentGroup();
  return Core.unique(
    Core.flatten([
      { ...g, sections: g.sections.filter((s) => selectedSections.has(s.id)) },
    ]),
  ).filter((c) => !hardFilter || stateOf(c.id).starred);
}
function renderGroup() {
  const g = currentGroup();
  if (!g) {
    view = "library";
    render();
    return;
  }
  $("#main").innerHTML =
    `<div class="breadcrumb">${button("library", "← Bộ từ", "small ghost")} / ${esc(g.name)}</div>` +
    intro(
      "CHỌN NHỊP HỌC CỦA BẠN",
      esc(g.name),
      `${Core.unique(Core.flatten([g])).length} từ · ${g.sections.length} section`,
    ) +
    `<div class="study-options"><section><div class="row spread" style="margin-bottom:16px"><h2>Chọn section</h2>${button("select-sections", "Chọn tất cả / Bỏ chọn", "small")}</div><div class="section-list">${g.sections.map((s) => `<div class="section-item"><input type="checkbox" id="sec-${s.id}" data-section="${s.id}" ${selectedSections.has(s.id) ? "checked" : ""}><label for="sec-${s.id}"><strong>${esc(s.name)}</strong><small>${Core.unique(s.cards).length} từ · ${known(Core.unique(s.cards))} đã thuộc</small></label>${button("study-section", "Học", "small", `data-id="${s.id}"`)}</div>`).join("")}</div></section><aside class="panel launch-panel"><div class="eyebrow">PHIÊN HỌC CỦA BẠN</div><h3 id="selection-count"></h3><label><input type="checkbox" id="hard-filter" ${hardFilter ? "checked" : ""}> Chỉ học từ ⭐ khó</label>${button("start-flash", "Bắt đầu flashcard " + icon("arrow"), "primary", 'id="start-flash"')}${button("quiz-group", "Quiz thử thách", "")}<p>Chọn nhiều section hoặc cả nhóm. Tiến độ được lưu sau mỗi lần đánh giá thẻ.</p>${voiceNotice()}</aside></div>`;
  updateSelection();
}
function updateSelection() {
  if ($("#selection-count"))
    $("#selection-count").textContent =
      `${groupSelection().length} từ · ${selectedSections.size} section`;
  if ($("#start-flash")) $("#start-flash").disabled = !groupSelection().length;
}
function renderHard() {
  const cards = originalCards(deck()).filter((c) => stateOf(c.id).starred);
  $("#main").innerHTML =
    intro(
      "DÀNH THÊM MỘT CHÚT CHÚ Ý",
      "Những từ cần nhớ hơn.",
      `${cards.length} từ được đánh dấu trong bộ ${esc(deck().name)}.`,
      button(
        "study-hard",
        "Học từ khó",
        "primary",
        cards.length ? "" : "disabled",
      ),
    ) + wordTable(cards);
}
function renderStats() {
  const d = deck(),
    cards = visibleCards(d);
  $("#main").innerHTML =
    intro("NHÌN LẠI ĐỂ ĐI XA HƠN", "Mỗi chút đều đáng kể.", esc(d.name)) +
    statCards(cards) +
    `<div class="stats-bottom"><section class="panel"><h2>Tiến độ theo nhóm</h2>${Core.organize(
      d,
    )
      .map((g) => {
        const a = Core.unique(Core.flatten([g]));
        return (
          `<div class="chart-row"><span>${esc(g.name)}</span>${meter(a)}<strong>${known(a)}/${a.length} · ${percent(a)}%</strong></div>` +
          fileGuide()
        );
      })
      .join(
        "",
      )}</section><section class="panel"><h2>Nhịp học 7 ngày</h2><div class="week">${Array.from(
      { length: 7 },
      (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - 6 + i);
        const done = d.activity.includes(day(date));
        return `<div class="day ${done ? "done" : ""}"><span>${esc(date.toLocaleDateString("vi-VN", { weekday: "short" }))}</span><i title="${day(date)}">${done ? "✓" : date.getDate()}</i></div>`;
      },
    ).join(
      "",
    )}</div><p class="muted" style="margin-top:20px">${d.activity.length} ngày đã học. Trả lời ít nhất một câu để ghi nhận ngày học; chuỗi được giữ nếu đã học hôm nay hoặc hôm qua.</p></section></div>`;
}
function openDialog(html) {
  $("#dialog").innerHTML =
    `<div class="dialog-topbar"><button type="button" class="icon-btn dialog-close" data-action="close-dialog" aria-label="Đóng hộp thoại" title="Đóng">×</button></div>` +
    html;
  $("#dialog").scrollTop = 0;
  if (!$("#dialog").open) $("#dialog").showModal();
}
function closeDialog() {
  if ($("#dialog").dataset.kind === "pause") {
    resumeQuiz();
    return;
  }
  $("#dialog").close();
  $("#dialog").dataset.kind = "";
  pending = null;
}
function languageFields(language = "en-US") {
  return `<label>Ngôn ngữ cột “Từ”<select id="deck-language">${Object.entries(
    languages,
  )
    .map(
      ([v, t]) =>
        `<option value="${v}" ${language === v ? "selected" : ""}>${t}</option>`,
    )
    .join(
      "",
    )}<option value="other" ${!languages[language] ? "selected" : ""}>Khác (nhập mã giọng)</option></select></label><label id="custom-language-label" ${languages[language] ? "hidden" : ""}>Mã ngôn ngữ, ví dụ it-IT<input id="custom-language" type="text" maxlength="35" value="${languages[language] ? "" : esc(language)}" placeholder="it-IT"></label>`;
}
function organizationFields(d) {
  const mode = d.organization?.mode || (d.hasChapters ? "split" : "merged");
  return `<fieldset><legend>Cách tổ chức bộ từ</legend><label class="radio-option"><input type="radio" name="organization" value="split" ${mode === "split" ? "checked" : ""} ${d.hasChapters ? "" : "disabled"}><span><b>Tách theo chapter</b><small>Mỗi chapter một nhóm, giữ section bên trong.${d.hasChapters ? "" : " File không có Heading 2 nên tùy chọn này không dùng được."}</small></span></label><label class="radio-option"><input type="radio" name="organization" value="merged" ${mode === "merged" ? "checked" : ""}><span><b>Gộp tất cả vào một bản</b><small>Học toàn bộ thẻ trong một nhóm. Cấu trúc gốc vẫn được giữ.</small></span></label><label class="filter-check"><input type="checkbox" id="dedupe" ${d.organization?.dedupe ? "checked" : ""} ${mode === "split" ? "disabled" : ""}> Loại bỏ từ trùng lặp khi gộp</label><small style="display:block;margin-top:8px">Giữ nghĩa đầu tiên, đưa nghĩa khác vào ghi chú. ID và tiến độ gốc không bị xóa.</small></fieldset>`;
}
function readDeckFields() {
  const name = $("#deck-name").value.trim();
  if (!name || name.length > 200)
    throw Error("Tên bộ từ cần từ 1 đến 200 ký tự.");
  const language =
    $("#deck-language").value === "other"
      ? $("#custom-language").value.trim()
      : $("#deck-language").value;
  if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(language))
    throw Error("Mã ngôn ngữ chưa đúng. Ví dụ: en-US, ja-JP, it-IT.");
  return {
    name,
    language,
    organization: {
      mode: $('input[name="organization"]:checked').value,
      dedupe: $("#dedupe").checked,
    },
  };
}
function deckSettings(id) {
  if (view === "quiz" || view === "flash") {
    toast("Hãy kết thúc phiên học trước khi mở cài đặt.");
    return;
  }
  const d = store.decks.find((d) => d.id === id);
  pending = { kind: "settings", id };
  openDialog(
    `<h2 id="dialog-title">Cài đặt bộ từ</h2><form id="settings-form" class="form-stack"><label>Tên bộ từ<input id="deck-name" type="text" maxlength="200" value="${esc(d.name)}" required></label>${languageFields(d.language)}${organizationFields(d)}<p>Mỗi ID giữ nguyên tiến độ khi đổi cách tổ chức. Các từ bị ẩn khi loại trùng sẽ trở lại khi tắt tùy chọn đó.</p><div class="dialog-actions">${button("storage", "Quản lý dung lượng")}${button("delete-deck", "Xóa bộ từ", "danger", `data-id="${d.id}"`)}${button("close-dialog", "Hủy")}<button type="submit" class="btn primary">Lưu thay đổi</button></div></form>`,
  );
}
function saveDeckSettings() {
  try {
    const fields = readDeckFields(),
      d = store.decks.find((d) => d.id === pending.id);
    if (
      JSON.stringify(fields.organization) !== JSON.stringify(d.organization) &&
      !confirm(
        "Đổi cách tổ chức bộ từ? Tiến độ và cấu trúc gốc sẽ được giữ nguyên.",
      )
    )
      return;
    Object.assign(d, fields);
    save("data", d.id);
    pending = null;
    $("#dialog").close();
    if (store.activeDeckId === d.id && view === "group") view = "library";
    render();
    toast("Đã lưu cài đặt.");
  } catch (e) {
    toast(e.message);
  }
}
// Thư viện đọc Word và PDF đóng gói cùng ứng dụng, tải theo nhu cầu.
let zipPromise = null;
function loadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (zipPromise) return zipPromise;
  zipPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "./vendor/jszip.min.js";
    s.onload = () => resolve(window.JSZip);
    s.onerror = () => reject(Error("Không thể tải thư viện zip."));
    document.head.appendChild(s);
  });
  return zipPromise;
}
let pdfPromise = null;
function loadPdfJs() {
  if (window.pdfjsLib && window.pdfjsLib.PDFWorker?._setupFakeWorkerGlobal)
    return Promise.resolve(window.pdfjsLib);
  if (pdfPromise) return pdfPromise;
  pdfPromise = (async () => {
    if (!window.pdfjsWorker) {
      await new Promise((r) => {
        const sw = document.createElement("script");
        sw.src = "./vendor/pdf.worker.min.js";
        sw.onload = sw.onerror = () => r();
        document.head.appendChild(sw);
      });
    }
    let pdfjs = window.pdfjsLib;
    if (!pdfjs) {
      pdfjs = await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "./vendor/pdf.min.js";
        s.onload = () => {
          if (window.pdfjsLib) resolve(window.pdfjsLib);
          else
            import("./vendor/pdf.min.mjs")
              .then((m) => {
                window.pdfjsLib = m;
                resolve(m);
              })
              .catch(reject);
        };
        s.onerror = () => {
          import("./vendor/pdf.min.mjs")
            .then((m) => {
              window.pdfjsLib = m;
              resolve(m);
            })
            .catch(reject);
        };
        document.head.appendChild(s);
      });
    }
    if (window.pdfjsWorker?.WorkerMessageHandler && pdfjs.PDFWorker) {
      pdfjs.PDFWorker._setupFakeWorkerGlobal = Promise.resolve(
        window.pdfjsWorker.WorkerMessageHandler,
      );
    }
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs";
    }
    return pdfjs;
  })();
  return pdfPromise;
}
function loadMammoth() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  if (libraryPromise) return libraryPromise;
  libraryPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "./vendor/mammoth.browser.min.js";
    const timeout = setTimeout(() => {
      s.remove();
      libraryPromise = null;
      reject(
        Error(
          "Chưa tải được thư viện Word. Hãy kiểm tra Internet rồi thử lại.",
        ),
      );
    }, 25000);
    s.onload = () => {
      clearTimeout(timeout);
      resolve(window.mammoth);
    };
    s.onerror = () => {
      clearTimeout(timeout);
      s.remove();
      libraryPromise = null;
      reject(Error("Không tải được thư viện đọc Word. Hãy kiểm tra mạng."));
    };
    document.head.appendChild(s);
  });
  return libraryPromise;
}
async function readDocxLines(file) {
  try {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const xmlFile = zip.file("word/document.xml");
    if (!xmlFile) return null;
    const xml = await xmlFile.async("string");
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const paragraphs = doc.getElementsByTagName("w:p");
    const lines = [];
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i],
        runs = [];
      const rNodes = p.getElementsByTagName("w:r");
      for (let j = 0; j < rNodes.length; j++) {
        const r = rNodes[j],
          tNodes = r.getElementsByTagName("w:t");
        let text = "";
        for (let k = 0; k < tNodes.length; k++)
          text += tNodes[k].textContent || "";
        if (!text) continue;
        const rPr = r.getElementsByTagName("w:rPr")[0];
        let bold = false,
          colored = false,
          highlight = false,
          yellowBg = false;
        if (rPr) {
          const b =
            rPr.getElementsByTagName("w:b")[0] ||
            rPr.getElementsByTagName("w:bCs")[0];
          if (b) {
            const val = b.getAttribute("w:val");
            bold = val !== "0" && val !== "false";
          }
          const color = rPr.getElementsByTagName("w:color")[0];
          if (color) {
            const cVal = (color.getAttribute("w:val") || "").toLowerCase();
            if (
              cVal &&
              !["auto", "000000", "windowtext", "none"].includes(cVal)
            )
              colored = true;
          }
          const hl = rPr.getElementsByTagName("w:highlight")[0];
          if (hl) {
            const hVal = (hl.getAttribute("w:val") || "").toLowerCase();
            if (hVal && hVal !== "none") {
              highlight = true;
              if (/yellow/i.test(hVal)) yellowBg = true;
            }
          }
          const shd = rPr.getElementsByTagName("w:shd")[0];
          if (shd) {
            const sVal = (shd.getAttribute("w:fill") || "").toLowerCase();
            if (sVal && !["auto", "none", "000000", "ffffff"].includes(sVal)) {
              highlight = true;
              if (/ffff00|ffeb3b|fef08a|fff200|yellow/i.test(sVal))
                yellowBg = true;
            }
          }
        }
        const isMark = bold || colored || highlight || yellowBg;
        runs.push({ text, bold: isMark, colored, highlight, yellowBg });
      }
      if (runs.length) lines.push(runs);
    }
    return lines.length ? lines : null;
  } catch (e) {
    return null;
  }
}
async function importWord(file) {
  if (!file || uploading) return;
  if (!/\.(docx)$/i.test(file.name)) {
    importError(
      "Vui lòng chọn file Word (.docx). File scan và PDF không được hỗ trợ cho bảng từ vựng.",
    );
    return;
  }
  if (file.size > 30 * 1024 * 1024) {
    importError(
      "File quá lớn (tối đa 30 MB). Hãy dùng bản Word chỉ có văn bản và bảng.",
    );
    return;
  }
  uploading = true;
  header();
  let stage = "load";
  try {
    const m = await loadMammoth();
    stage = "convert";
    const result = await m.convertToHtml(
      { arrayBuffer: await file.arrayBuffer() },
      {
        includeEmbeddedStyleMap: false,
        styleMap: ["p[style-name='Tiêu đề 2'] => h2:fresh"],
        convertImage: m.images.imgElement(() => Promise.resolve({ src: "" })),
      },
    );
    stage = "parse";
    const parsed = Core.parse(result.value, file.name);
    if (result.messages.length)
      parsed.warnings.push(
        "Một số định dạng Word không được chuyển đầy đủ; hãy đối chiếu mẫu và số thẻ.",
      );
    pending = { kind: "import", parsed };
    showPreview();
  } catch (e) {
    importError(
      stage === "convert"
        ? "File Word bị hỏng, có mật khẩu hoặc không phải .docx thật. Hãy mở trong Word rồi lưu lại."
        : e.message,
    );
  } finally {
    uploading = false;
    header();
    $("#file-input").value = "";
  }
}
function showQuizImportHelp() {
  openDialog(
    `<h2 id="dialog-title">Nhập trắc nghiệm mọi môn</h2><p>Chọn Word (.docx) hoặc PDF có văn bản. Mỗi câu bắt đầu bằng “Câu 1:” hoặc “1.”, có thể thuộc dạng A–D, True/False hoặc Short Answer trong cùng file. Dùng tiêu đề từng phần để nhận diện loại câu. Ghi “Answer: …” hoặc “Đáp án: …” cho câu trả lời ngắn. Bôi đậm chữ cái, tô màu chữ (đỏ, vàng,...) hoặc tô nền vàng cho đáp án đúng.</p><div class="question-preview">Câu 1: Hành tinh nào gần Mặt Trời nhất?<br><span class="quiz-answer-highlight"><strong>A. Sao Thủy</strong></span><br>B. Sao Kim<br>C. Trái Đất<br>D. Sao Hỏa<br>Giải thích: Sao Thủy có quỹ đạo gần Mặt Trời nhất.</div><p>Có thể đặt 4 đáp án trên các dòng riêng hoặc cùng dòng. PDF nên có bố cục một cột; file scan/ảnh chưa được hỗ trợ. Bạn sẽ xem lại toàn bộ câu hỏi và chỉnh đáp án trước khi lưu.</p><div class="dialog-actions">${button("close-dialog", "Hủy")}${button("choose-quiz-file", "Chọn Word / PDF", "primary")}</div>`,
  );
}
async function readQuizPDF(file) {
  const pdfjs = await loadPdfJs();
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs";
  }
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
    disableFontFace: true,
    fontExtraProperties: true,
    useSystemFonts: true,
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 300)
      throw Error("PDF quá dài (tối đa 300 trang). Hãy chia thành các bộ nhỏ.");
    const lines = [];
    function multiplyMatrix(m1, m2) {
      return [
        m1[0] * m2[0] + m1[2] * m2[1],
        m1[1] * m2[0] + m1[3] * m2[1],
        m1[0] * m2[2] + m1[2] * m2[3],
        m1[1] * m2[2] + m1[3] * m2[3],
        m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
        m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
      ];
    }
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const opList = await page.getOperatorList();
      const content = await page.getTextContent();
      const OPS = pdfjs.OPS || {};
      const opNames = Object.fromEntries(
        Object.entries(OPS).map(([k, v]) => [v, k]),
      );
      let currentColor = "#000000",
        currentMatrix = [1, 0, 0, 1, 0, 0];
      const matrixStack = [[1, 0, 0, 1, 0, 0]],
        yellowBoxes = [],
        coloredItems = [];
      for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i],
          name = opNames[fn] || fn,
          args = opList.argsArray[i];
        if (name === "save") {
          matrixStack.push([...currentMatrix]);
        } else if (name === "restore") {
          if (matrixStack.length > 1) currentMatrix = matrixStack.pop();
        } else if (name === "transform") {
          currentMatrix = multiplyMatrix(currentMatrix, args);
        } else if (name === "setFillRGBColor") {
          currentColor = (args[0] || "").toLowerCase();
        } else if (name === "setFillGray") {
          currentColor = args[0] === 0 ? "#000000" : "#888888";
        } else if (name === "setTextMatrix") {
          currentMatrix = args[0] || currentMatrix;
        } else if (name === "constructPath") {
          const isYellow =
            /#(?:ffff00|ffeb3b|fef08a|fff566|ffd700|ffe600|eab308|facc15|fde047|fff200)/i.test(
              currentColor,
            ) ||
            (currentColor.startsWith("#") &&
              currentColor.length === 7 &&
              parseInt(currentColor.slice(1, 3), 16) > 200 &&
              parseInt(currentColor.slice(3, 5), 16) > 180 &&
              parseInt(currentColor.slice(5, 7), 16) < 120);
          if (isYellow && args[2]) {
            const box = args[2];
            const minX = Math.min(
              box[0] * currentMatrix[0] + currentMatrix[4],
              box[2] * currentMatrix[0] + currentMatrix[4],
            );
            const maxX = Math.max(
              box[0] * currentMatrix[0] + currentMatrix[4],
              box[2] * currentMatrix[0] + currentMatrix[4],
            );
            const minY = Math.min(
              box[1] * currentMatrix[3] + currentMatrix[5],
              box[3] * currentMatrix[3] + currentMatrix[5],
            );
            const maxY = Math.max(
              box[1] * currentMatrix[3] + currentMatrix[5],
              box[3] * currentMatrix[3] + currentMatrix[5],
            );
            yellowBoxes.push({ minX, minY, maxX, maxY });
          }
        } else if (name === "showText" || name === "showSpacedText") {
          if (currentColor && currentColor !== "#000000") {
            coloredItems.push({
              x: currentMatrix[4],
              y: currentMatrix[5],
              color: currentColor,
            });
          }
        }
      }
      const rows = [];
      for (const item of content.items) {
        if (!item.str?.trim()) continue;
        const x = item.transform[4],
          y = item.transform[5],
          height = Math.abs(item.height) || 10;
        let row = rows.find(
          (r) => Math.abs(r.y - y) < Math.min(r.height, height) * 0.3,
        );
        if (!row) {
          row = { y, height, items: [] };
          rows.push(row);
        }
        let font;
        try {
          font = page.commonObjs.get(item.fontName);
        } catch {}
        const boldFont =
          !!font?.bold ||
          !!font?.black ||
          /bold|black|heavy|demi/i.test(font?.name || "");
        // Compare actual text bounds with the highlight, without extending it into adjacent lines.
        const style = content.styles[item.fontName] || {};
        const textBottom =
          y + (Number.isFinite(style.descent) ? style.descent : -0.2) * height;
        const textTop =
          y + (Number.isFinite(style.ascent) ? style.ascent : 0.8) * height;
        const textHeight = Math.max(1, textTop - textBottom);
        const textWidth = Math.abs(item.width) || height;
        const inYellow = yellowBoxes.some((b) => {
          const overlapX =
            Math.min(x + textWidth, b.maxX) - Math.max(x, b.minX);
          const overlapY =
            Math.min(textTop, b.maxY) - Math.max(textBottom, b.minY);
          // A highlighted answer label is sufficient; most of the text height must overlap.
          return (
            overlapX >= Math.min(textWidth, height) * 0.3 &&
            overlapY >= textHeight * 0.5
          );
        });
        let isColored = false;
        const matchedColor = coloredItems.find(
          (c) => Math.abs(c.x - x) < 30 && Math.abs(c.y - y) < 15,
        );
        if (matchedColor) {
          const hex = matchedColor.color;
          if (hex.startsWith("#") && hex.length === 7) {
            const r = parseInt(hex.slice(1, 3), 16),
              g = parseInt(hex.slice(3, 5), 16),
              b = parseInt(hex.slice(5, 7), 16);
            if (
              (r > 60 || g > 60 || b > 60) &&
              (Math.abs(r - g) > 30 ||
                Math.abs(r - b) > 30 ||
                Math.abs(g - b) > 30 ||
                (r > 150 && g > 150))
            ) {
              isColored = true;
            }
          }
        }
        const isMarked = boldFont || inYellow || isColored;
        row.items.push({
          x,
          width: item.width,
          text: item.str,
          bold: isMarked,
          rawBold: boldFont,
          inYellow,
          isColored,
        });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const row of rows) {
        row.items.sort((a, b) => a.x - b.x);
        const runs = [];
        row.items.forEach((item, i) => {
          const previous = row.items[i - 1];
          if (previous && item.x > previous.x + previous.width + 1)
            runs.push({ text: " ", bold: false });
          runs.push({ text: item.text, bold: item.bold });
        });
        lines.push(runs);
      }
      page.cleanup();
    }
    if (!lines.length)
      throw Error(
        "PDF không có văn bản đọc được; file scan/ảnh cần chuyển sang Word có văn bản trước.",
      );
    return lines;
  } finally {
    await task.destroy();
  }
}
async function importQuizFile(file, preloadedLines = null) {
  if (!file || uploading) return;
  if (!/\.(docx|pdf)$/i.test(file.name)) {
    importError("Chọn file Word .docx hoặc PDF.");
    return;
  }
  if (file.size > 30 * 1024 * 1024) {
    importError("File quá lớn, tối đa 30 MB.");
    return;
  }
  uploading = true;
  header();
  openDialog(
    '<h2 id="dialog-title">Đang đọc câu hỏi…</h2><p role="status">Đang xử lý tài liệu trên thiết bị của bạn.</p>',
  );
  try {
    let lines = preloadedLines,
      warnings = [];
    if (!lines) {
      if (/\.pdf$/i.test(file.name)) {
        lines = await readQuizPDF(file);
        warnings.push(
          "PDF có thể làm mất kiểu chữ hoặc thứ tự văn bản. Hãy kiểm tra từng câu và đáp án trước khi lưu.",
        );
      } else {
        lines = await readDocxLines(file);
        if (!lines) {
          const mammoth = await loadMammoth();
          const result = await mammoth.convertToHtml(
            { arrayBuffer: await file.arrayBuffer() },
            {
              transformDocument: mammoth.transforms.paragraph((p) => {
                p.children = p.children.map((c) => {
                  if (c.type === "run" && c.highlight) c.isBold = true;
                  return c;
                });
                return p;
              }),
              convertImage: mammoth.images.imgElement(() =>
                Promise.resolve({ src: "" }),
              ),
            },
          );
          lines = Core.quizLines(result.value);
        }
      }
    }
    const parsed = Core.parseQuestions(lines, file.name);
    parsed.warnings.unshift(...warnings);
    pending = { kind: "quiz-import", parsed };
    showQuizPreview();
  } catch (e) {
    importError("Không đọc được bộ câu hỏi: " + e.message);
  } finally {
    uploading = false;
    header();
    $("#quiz-file-input").value = "";
    $("#file-input").value = "";
  }
}
async function processUploadedFile(file) {
  if (!file || uploading) return;
  if (/\.pdf$/i.test(file.name)) {
    await importQuizFile(file);
    return;
  }
  if (!/\.docx$/i.test(file.name)) {
    importError(
      "Vui lòng chọn file Word (.docx) hoặc PDF (.pdf). File scan và ảnh không được hỗ trợ.",
    );
    return;
  }
  uploading = true;
  header();
  openDialog(
    '<h2 id="dialog-title">Đang đọc tài liệu…</h2><p role="status">Đang phân tích cấu trúc file Word / PDF.</p>',
  );
  try {
    let quizLines = null;
    try {
      quizLines = await readDocxLines(file);
    } catch {}
    let tableHtml = null;
    try {
      const m = await loadMammoth();
      const res = await m.convertToHtml(
        { arrayBuffer: await file.arrayBuffer() },
        {
          includeEmbeddedStyleMap: false,
          styleMap: ["p[style-name='Tiêu đề 2'] => h2:fresh"],
          convertImage: m.images.imgElement(() => Promise.resolve({ src: "" })),
        },
      );
      tableHtml = res.value;
      if (!quizLines) quizLines = Core.quizLines(tableHtml);
    } catch {}

    let quizParsed = null;
    if (quizLines && quizLines.length) {
      try {
        quizParsed = Core.parseQuestions(quizLines, file.name);
      } catch {}
    }

    let tableParsed = null;
    if (tableHtml) {
      try {
        tableParsed = Core.parse(tableHtml, file.name);
      } catch {}
    }

    uploading = false;
    header();
    if (
      quizParsed &&
      quizParsed.questions.length > 0 &&
      (!tableParsed || quizParsed.questions.length >= 2)
    ) {
      pending = { kind: "quiz-import", parsed: quizParsed };
      showQuizPreview();
      return;
    }
    if (tableParsed && tableParsed.chapters.length > 0) {
      pending = { kind: "import", parsed: tableParsed };
      showPreview();
      return;
    }
    if (quizParsed && quizParsed.questions.length > 0) {
      pending = { kind: "quiz-import", parsed: quizParsed };
      showQuizPreview();
      return;
    }
    if (tableHtml) {
      const parsed = Core.parse(tableHtml, file.name);
      pending = { kind: "import", parsed };
      showPreview();
    } else {
      throw Error(
        "Tài liệu không có bảng, dòng từ vựng dạng từ: nghĩa hoặc câu hỏi trắc nghiệm A. B. C. D.",
      );
    }
  } catch (e) {
    uploading = false;
    header();
    importError(e.message || "Không thể nhận dạng tài liệu.");
  } finally {
    $("#file-input").value = "";
    $("#quiz-file-input").value = "";
  }
}
function showQuizPreview() {
  const p = pending.parsed;
  openDialog(
    `<h2 id="dialog-title">Kiểm tra ${p.questions.length} câu hỏi</h2><p>Chữ đậm, chữ tô màu hoặc nền vàng là đáp án nhận diện từ file (được tô nền vàng). Kiểm tra từng loại câu, sửa nội dung và nhập đáp án còn thiếu. Short Answer được chấm theo đáp án bạn nhập, không phân biệt hoa/thường và khoảng trắng thừa. Câu A–D thiếu lựa chọn phải sửa trong tài liệu rồi nhập lại.</p><form id="quiz-import-form" class="form-stack"><label>Tên bộ câu hỏi / môn học<input id="quiz-deck-name" type="text" maxlength="200" required value="${esc(p.name.slice(0, 200))}"></label>${p.questions.map((q, i) => `<section class="question-preview">${button("remove-import-question", "&times;", "danger remove-question", `data-index="${i}" aria-label="Bỏ câu ${i + 1}" title="Bỏ câu này"`)}<h3>Câu ${i + 1} · ${q.type === "true-false" ? "True/False" : q.type === "short-answer" ? "Short Answer" : "A–D"}</h3>${q.chapter ? `<p class="muted">${esc(q.chapter)}</p>` : ""}<label>Nội dung câu hỏi<textarea data-question-word="${i}" required>${esc(q.word)}</textarea></label><div class="question-options" data-question-index="${i}">${q.options.map((o) => `<p class="${q.answer === o.label || (!q.answer && o.bold) ? "quiz-answer-highlight" : ""}" data-option-label="${o.label}">${q.answer === o.label || (!q.answer && o.bold) ? "<strong>" : ""}${o.label}. ${esc(o.text)}${q.answer === o.label || (!q.answer && o.bold) ? "</strong>" : ""}</p>`).join("")}</div>${q.note ? `<p>Giải thích: ${esc(q.note)}</p>` : ""}${q.issues.length ? `<p class="notice error">${q.issues.map(esc).join(" · ")}</p>` : ""}<label>Đáp án đúng${q.type === "short-answer" ? `<input type="text" data-question-answer="${i}" required value="${esc(q.answer || "")}" placeholder="Nhập câu trả lời ngắn">` : `<select data-question-answer="${i}" required><option value="">Chọn đáp án đúng</option>${q.options.map((o) => `<option value="${o.label}" ${q.answer === o.label ? "selected" : ""}>${q.type === "true-false" ? o.text : o.label}</option>`).join("")}</select>`}</label></section>`).join("")}<p id="quiz-import-error" class="gate-error" role="alert"></p><div class="dialog-actions">${button("close-dialog", "Hủy")}<button class="btn primary" type="submit" ${!p.questions.length || p.questions.some((q) => q.issues.length) ? "disabled" : ""}>Lưu bộ câu hỏi và luyện quiz</button></div></form>`,
  );
}
function removeImportQuestion(index) {
  if (pending?.kind !== 'quiz-import') return;
  const p = pending.parsed;
  p.name = $('#quiz-deck-name').value;
  for (const el of document.querySelectorAll('[data-question-word]'))
    p.questions[Number(el.dataset.questionWord)].word = el.value;
  for (const el of document.querySelectorAll('[data-question-answer]'))
    p.questions[Number(el.dataset.questionAnswer)].answer = el.value;
  p.questions.splice(index, 1);
  showQuizPreview();
}

function contentTools() {
  return `<div class="row content-tools">${button('add-manual-card', 'Thêm thẻ / câu hỏi', 'primary small')}${button('manage-cards', 'Quản lý · Xóa câu', 'small')}${button('create-manual-deck', 'Tạo bộ mới', 'small')}</div>`;
}

function showManualCard(newDeck = false, defaultType = '') {
  if (!newDeck && !deck()) return;
  const d = newDeck ? null : deck();
  const types = d?.kind === 'quiz'
    ? [['short-answer','Câu hỏi trả lời ngắn'], ['multiple-choice','Trắc nghiệm A–D'], ['true-false','True/False']]
    : d ? [['flashcard','Flashcard']] : [['flashcard','Bộ flashcard'], ['short-answer','Bộ câu hỏi trả lời ngắn'], ['multiple-choice','Bộ câu trắc nghiệm A–D'], ['true-false','Bộ câu hỏi True/False']];
  const sections = d?.chapters.flatMap(ch => ch.sections.map(s => [s.id, ch.name + ' / ' + s.name])) || [];
  openDialog(`<h2 id="dialog-title">${newDeck ? 'Tạo bộ học thủ công' : 'Thêm thẻ / câu hỏi'}</h2><form id="manual-card-form" class="form-stack" data-new-deck="${newDeck}">
    ${newDeck ? '<label>Tên bộ học<input id="manual-deck-name" required maxlength="200"></label>' : `<p>Bộ học: <b>${esc(d.name)}</b></p><label>Thêm vào section<select id="manual-section">${sections.map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('')}</select></label>`}
    <label>${newDeck ? 'Loại bộ / thẻ đầu tiên' : 'Loại câu'}<select id="manual-type">${types.map(([v,t])=>`<option value="${v}" ${v===defaultType?'selected':''}>${t}</option>`).join('')}</select></label>
    <p class="muted">Bộ câu hỏi có thể chứa cả A–D, True/False và trả lời ngắn. Tạo thẻ đầu tiên rồi tiếp tục thêm từng câu.</p>
    <label>Mặt trước / Nội dung câu hỏi<textarea id="manual-word" required maxlength="100000"></textarea></label>
    <div id="manual-answer-fields"></div>
    <label>Ghi chú / Giải thích<textarea id="manual-note" maxlength="100000"></textarea></label>
    <p id="manual-error" class="gate-error" role="alert"></p>
    <div class="dialog-actions">${button('close-dialog','Hủy')}<button class="btn" type="submit" value="more">Lưu và thêm tiếp</button><button class="btn primary" type="submit" value="done">Lưu</button></div></form>`);
  renderManualAnswerFields();
}

function renderManualAnswerFields() {
  const type = $('#manual-type').value;
  $('#manual-answer-fields').innerHTML = type === 'multiple-choice'
    ? `<div class="form-stack">${['A','B','C','D'].map(v=>`<label>Lựa chọn ${v}<input data-manual-option="${v}" required maxlength="100000"></label>`).join('')}<label>Đáp án đúng<select id="manual-answer" required><option value="">Chọn đáp án</option>${['A','B','C','D'].map(v=>`<option>${v}</option>`).join('')}</select></label></div>`
    : type === 'true-false' ? '<label>Đáp án đúng<select id="manual-answer" required><option value="">Chọn đáp án</option><option value="T">True (Đúng)</option><option value="F">False (Sai)</option></select></label>'
    : `<label>${type === 'flashcard' ? 'Mặt sau / Nghĩa' : 'Đáp án đúng'}<textarea id="manual-answer" required maxlength="100000"></textarea></label>`;
}

function commitManualCard(more) {
  try {
    const newDeck = $('#manual-card-form').dataset.newDeck === 'true';
    const type = $('#manual-type').value, word = $('#manual-word').value.trim(), answer = $('#manual-answer').value.trim(), note = $('#manual-note').value.trim();
    if (!word || !answer) throw Error('Nhập đủ nội dung và đáp án.');
    let card;
    if (type === 'flashcard') card = {id:Core.cardId(word,answer),word,originalWord:word,meaning:answer,pos:'',note};
    else {
      const options = type === 'true-false' ? [{label:'T',text:'True'},{label:'F',text:'False'}] : type === 'multiple-choice' ? [...document.querySelectorAll('[data-manual-option]')].map(el=>({label:el.dataset.manualOption,text:el.value.trim()})) : [];
      if (options.some(o=>!o.text) || new Set(options.map(o=>Core.normalize(o.text))).size !== options.length) throw Error('Các lựa chọn phải có nội dung và không trùng nhau.');
      card = Core.questionChapters([{word,answer,note,type,options,issues:[]}])[0].sections[0].cards[0];
    }
    let d = deck();
    if (newDeck) {
      const name = $('#manual-deck-name').value.trim();
      if (!name || name.length > 200) throw Error('Tên bộ học cần từ 1 đến 200 ký tự.');
      if (store.decks.length >= 100) throw Error('Đã đạt giới hạn 100 bộ học.');
      d = {id:uid(),kind:type==='flashcard'?'vocab':'quiz',name,language:'vi-VN',sourceName:'',hasChapters:false,chapters:[{id:uid(),name:'Tất cả',sections:[{id:uid(),name:'Thẻ tự tạo',cards:[card]}]}],organization:{mode:'merged',dedupe:false},progress:{},activity:[],records:{},quizMemory:{}};
      store.decks.push(d);store.activeDeckId=d.id;
    } else {
      if (originalCards(d).some(c=>c.id===card.id)) throw Error('Thẻ này đã có trong bộ học.');
      const section = d.chapters.flatMap(ch=>ch.sections).find(s=>s.id===$('#manual-section').value);
      if (!section) throw Error('Không tìm thấy section.');
      section.cards.push(card);
    }
    save('all-deck',d.id);
    const saved = !loadBlocked && flushStorage();
    $('#dialog').close();setup=null;view=saved?(d.kind==='quiz'?'quiz-setup':'library'):'storage';render();
    toast(saved?'Đã lưu thẻ vào bộ học.':'Chưa lưu được trên trình duyệt; hãy xuất sao lưu hoặc dọn dung lượng.');
    if (more && saved) showManualCard(false,type);
  } catch(e) { $('#manual-error').textContent=e.message; }
}

function showManageCards() {
  const d=deck();if (!d) return;
  openDialog(`<h2 id="dialog-title">Quản lý nội dung · ${esc(d.name)}</h2><p>Chọn các thẻ hoặc câu hỏi không muốn dùng rồi xóa. Các bản trùng cùng nội dung và tiến độ đi kèm sẽ được xóa khỏi bộ này.</p><label>Tìm nội dung<input id="manage-search" type="search" placeholder="Tìm câu hỏi hoặc đáp án"></label><div class="row">${button('select-managed-cards','Chọn / bỏ chọn kết quả','small')}${button('delete-managed-cards','Xóa câu đã chọn','danger small','id="delete-managed" disabled')}</div><p id="manage-count" role="status"></p><div id="manage-list" class="form-stack">${originalCards(d).map(c=>`<label class="panel manage-card" data-search="${esc(Core.normalize(c.word+' '+c.meaning))}"><input type="checkbox" data-manage-card="${c.id}"><span><strong class="text-preserve">${esc(c.word)}</strong><br><span class="text-preserve">${esc(c.meaning)}</span></span></label>`).join('')}</div><p id="manage-error" role="alert" class="gate-error"></p><div class="dialog-actions">${button('add-manual-card','Thêm thẻ / câu hỏi','primary')}${button('close-dialog','Đóng')}</div>`);
  updateManageSelection();
}
function updateManageSelection() {
  const count=document.querySelectorAll('[data-manage-card]:checked').length;
  $('#manage-count').textContent=`Đã chọn ${count} / ${originalCards(deck()).length} thẻ`;
  $('#delete-managed').disabled=!count;
}
function deleteManagedCards() {
  const ids=new Set([...document.querySelectorAll('[data-manage-card]:checked')].map(el=>el.dataset.manageCard)), d=deck();
  if (!ids.size) return;
  if (ids.size===originalCards(d).length) {$('#manage-error').textContent='Cần giữ ít nhất một thẻ. Để xóa cả bộ, dùng Cài đặt bộ học hoặc Quản lý dung lượng.';return;}
  if (!confirm(`Xóa ${ids.size} thẻ/câu hỏi đã chọn và tiến độ tương ứng khỏi bộ “${d.name}”?`)) return;
  d.chapters=d.chapters.map(ch=>({...ch,sections:ch.sections.map(s=>({...s,cards:s.cards.filter(c=>!ids.has(c.id))})).filter(s=>s.cards.length)})).filter(ch=>ch.sections.length);
  for (const id of ids) {delete d.progress[id];delete d.quizMemory[id];}
  save('all-deck',d.id);const saved=!loadBlocked&&flushStorage();
  setup=null;render();
  if (saved) {showManageCards();toast(`Đã xóa ${ids.size} thẻ/câu hỏi.`);}
  else {$('#dialog').close();view='storage';render();toast('Chưa lưu được thay đổi; hãy xuất sao lưu hoặc dọn dung lượng.');}
}
function commitQuizImport() {
  try {
    if (pending?.kind !== "quiz-import") return;
    const p = pending.parsed,
      name = $("#quiz-deck-name").value.trim();
    if (!name || name.length > 200)
      throw Error("Tên bộ câu hỏi cần từ 1 đến 200 ký tự.");
    for (const el of document.querySelectorAll("[data-question-answer]"))
      p.questions[Number(el.dataset.questionAnswer)].answer = el.value.trim();
    for (const el of document.querySelectorAll("[data-question-word]"))
      p.questions[Number(el.dataset.questionWord)].word = el.value.trim();
    if (!p.questions.length) throw Error("Cần giữ ít nhất một câu hỏi.");
    const chapters = Core.questionChapters(p.questions);
    const d = {
      id: uid(),
      kind: "quiz",
      name,
      language: "vi-VN",
      sourceName: p.sourceName,
      hasChapters: false,
      chapters,
      organization: { mode: "merged", dedupe: false },
      progress: {},
      activity: [],
      records: {},
      quizMemory: {},
    };
    store.decks.push(d);
    store.activeDeckId = d.id;
    save("all-deck", d.id);
    const saved = !loadBlocked && flushStorage();
    pending = null;
    $("#dialog").close();
    view = saved ? "quiz-setup" : "storage";
    render();
    toast(
      saved
        ? "Đã lưu bộ câu hỏi trắc nghiệm."
        : "Bộ câu hỏi đã mở nhưng chưa lưu được; hãy xuất sao lưu hoặc dọn dung lượng.",
    );
  } catch (e) {
    $("#quiz-import-error").textContent = e.message;
  }
}
function importError(message) {
  pending = null;
  openDialog(
    `<h2 id="dialog-title">Chưa thể nhập dữ liệu</h2><div class="notice error" role="alert">${esc(message)}</div><p>Dữ liệu đang có vẫn được giữ nguyên.</p><div class="dialog-actions">${button("close-dialog", "Đóng", "primary")}</div>`,
  );
}
function showPreview() {
  const p = pending.parsed,
    sections = p.chapters.flatMap((c) => c.sections),
    cards = Core.flatten(p.chapters),
    prior = store.decks.find((d) => d.sourceName === p.sourceName);
  openDialog(
    `<h2 id="dialog-title">Kiểm tra bộ từ trước khi lưu</h2><div class="stats">${[
      [p.chapters.length, "Chapter"],
      [sections.length, "Section"],
      [cards.length, "Dòng thẻ"],
    ]
      .map(
        ([n, l]) =>
          `<div class="panel stat"><div><strong>${n}</strong><span>${l}</span></div></div>`,
      )
      .join(
        "",
      )}</div><p>${Core.unique(cards).length} thẻ có nội dung khác nhau. Các dòng giống hệt nhau dùng chung ID và tiến độ.</p>${p.warnings.length ? `<details class="notice"><summary>${p.warnings.length} lưu ý khi đọc file</summary><ul>${p.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></details>` : ""}<form id="import-form" class="form-stack"><label>Tên bộ từ<input id="deck-name" type="text" maxlength="200" value="${esc(p.name.slice(0, 200))}" required></label>${languageFields(prior?.language || "en-US")}${organizationFields(p)}${store.decks.length ? `<label>Kế thừa tiến độ và sao từ bộ cũ<select id="inherit"><option value="">Không kế thừa</option>${store.decks.map((d) => `<option value="${d.id}" ${d === prior ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select></label><p>Luôn tạo bộ từ mới. Chỉ sao chép trạng thái của các ID còn khớp; bộ cũ không bị thay đổi.</p>` : ""}<details><summary>Xem chapter, section và thẻ mẫu</summary>${p.chapters.map((c) => `<div class="preview-chapter"><b>${esc(c.name)}</b>${c.sections.map((s) => `<p><b>${esc(s.name)}</b> · ${s.cards.length} dòng<br><span class="text-preserve">${esc(s.cards[0].originalWord)} → ${esc(s.cards[0].meaning)}${s.cards[0].note ? "\n" + esc(s.cards[0].note) : ""}</span></p>`).join("")}</div>`).join("")}</details><div class="dialog-actions">${button("close-dialog", "Hủy")}<button type="submit" class="btn primary">Lưu và bắt đầu ${icon("arrow")}</button></div></form>`,
  );
}
function commitImport() {
  try {
    const fields = readDeckFields(),
      p = pending.parsed,
      prior = store.decks.find((d) => d.id === $("#inherit")?.value);
    const d = {
      id: uid(),
      ...fields,
      sourceName: p.sourceName,
      hasChapters: p.hasChapters,
      chapters: p.chapters,
      progress: Core.inheritProgress(p.chapters, prior?.progress),
      activity: [],
      records: {},
      quizMemory: {},
    };
    store.decks.push(d);
    store.activeDeckId = d.id;
    save("all-deck", d.id);
    pending = null;
    $("#dialog").close();
    view = "library";
    search = "";
    render();
    toast("Đã thêm bộ từ mới. Cấu trúc gốc được giữ đầy đủ.");
  } catch (e) {
    toast(e.message);
  }
}
function downloadBackup(source) {
  const blob = new Blob(
      [
        JSON.stringify(
          {
            ...StorageModel.backup(source),
            exportedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "la-tien-do-" + day() + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Đã xuất bản sao lưu, gồm cả thay đổi chưa ghi được vào trình duyệt.");
}
function exportBackup() {
  downloadBackup(store);
}
async function importBackup(file) {
  if (!file) return;
  try {
    if (!/\.json$/i.test(file.name) || file.size > 30 * 1024 * 1024)
      throw Error("Chọn bản sao lưu JSON, tối đa 30 MB.");
    const restored = StorageModel.migrate(JSON.parse(await file.text()));
    if (
      !confirm(
        `Khôi phục ${restored.decks.length} bộ từ từ bản sao lưu? Toàn bộ dữ liệu hiện tại sẽ bị ghi đè. Hãy xuất bản hiện tại trước nếu cần.`,
      )
    )
      return;
    stopTimers();
    writer.clear();
    const previous = store;
    store = restored;
    flash = quiz = null;
    loadBlocked = false;
    save("all");
    const ok = flushStorage();
    if (ok) {
      for (const d of previous.decks) deleteQuizDraft(d.id);
      const ids = new Set(store.decks.map((d) => d.id));
      for (const d of previous.decks)
        if (!ids.has(d.id))
          for (const kind of ["data", "progress", "stats"])
            removeStorage(StorageModel.key(kind, d.id));
    }
    theme();
    view = ok ? "decks" : "storage";
    render();
    toast(
      ok
        ? "Đã khôi phục bản sao lưu."
        : "Bản sao lưu đã mở trong tab nhưng chưa lưu được. Hãy dọn dung lượng.",
    );
  } catch (e) {
    importError(
      e instanceof SyntaxError
        ? "File JSON bị hỏng hoặc không đúng định dạng."
        : e.message,
    );
  } finally {
    $("#backup-input").value = "";
  }
}
function toggleStar(id) {
  const d = deck();
  d.progress[id] = { ...stateOf(id), starred: !stateOf(id).starred };
  save();
  for (const b of document.querySelectorAll('[data-action="star"]'))
    if (b.dataset.id === id) {
      b.outerHTML = starButton(id);
    }
  if (view === "hard") renderHard();
}
// Flashcard: vòng hữu hạn, thẻ sai trở lại sau tối đa ba thẻ khác.
function startFlash(cards, label) {
  if (!cards.length) {
    toast("Không có từ phù hợp với lựa chọn.");
    return;
  }
  stopTimers();
  flash = {
    cards: Core.unique(cards),
    label,
    queue: Core.unique(cards).map((c) => c.id),
    attempts: {},
    resolved: {},
    reverse: false,
    flipped: false,
  };
  view = "flash";
  render();
  scrollTo({ top: 0 });
}
const flashCard = () => flash.cards.find((c) => c.id === flash.queue[0]);
function renderFlash() {
  const c = flashCard();
  if (!c) {
    view = "flash-result";
    render();
    return;
  }
  const front = flash.reverse ? c.meaning : c.word,
    back = flash.reverse ? c.word : c.meaning,
    done = Object.keys(flash.resolved).length;
  $("#main").innerHTML =
    `<div class="study-shell"><div class="study-top">${button("exit-study", icon("back") + " Rời phiên", "small ghost")}<h2>${esc(flash.label)}</h2></div><div class="study-progress"><div class="row spread"><span>Đã hoàn tất</span><strong>${done} / ${flash.cards.length}</strong></div><div class="progress"><i style="width:${(done * 100) / flash.cards.length}%"></i></div></div><div class="tools-row"><div class="row">${button("reverse", icon("flip") + (flash.reverse ? " Nghĩa → Từ" : " Từ → Nghĩa"), "small", `aria-pressed="${flash.reverse}"`)}${button("shuffle-flash", icon("shuffle") + " Xáo trộn", "small")}</div><div class="row">${starButton(c.id)}${speaker(c.id)}</div></div><div class="flashcard ${flash.flipped ? "flipped" : ""}" id="flashcard" data-action="flip" role="button" tabindex="0" aria-label="${esc(flash.flipped ? back : front)}. Bấm để lật thẻ" aria-pressed="${flash.flipped}"><div class="card-inner"><div class="card-face front" aria-hidden="${flash.flipped}"><span class="card-label">${flash.reverse ? "NGHĨA" : "TỪ CẦN NHỚ"}</span>${!flash.reverse ? "<div>" + badges(c.pos) + "</div>" : ""}<div class="card-text ${front.length > 80 ? "long" : ""}">${esc(front)}</div><span class="card-hint">Chạm hoặc nhấn Space để lật</span></div><div class="card-face back" aria-hidden="${!flash.flipped}"><span class="card-label">${flash.reverse ? "TỪ CẦN NHỚ" : "NGHĨA"}</span>${flash.reverse ? "<div>" + badges(c.pos) + "</div>" : ""}<div class="card-text ${back.length > 80 ? "long" : ""}">${esc(back)}</div>${c.note ? `<div class="card-note text-preserve">${esc(c.note)}</div>` : ""}</div></div></div><p class="study-meta">${esc(c.chapterName)} / ${esc(c.sectionName)}${flash.attempts[c.id] ? " · Ôn lại lượt 2" : ""}</p><div class="rating-row">${button("unknown", icon("back") + " Chưa thuộc", "unknown")}${button("known", "Đã thuộc " + icon("check"), "primary")}</div><p class="key-hint"><kbd>Space</kbd> Lật · <kbd>←</kbd> Chưa thuộc · <kbd>→</kbd> Đã thuộc</p><p class="muted" style="text-align:center;font-size:12px">Mỗi từ xuất hiện tối đa 2 lần/vòng. Từ chưa thuộc có thể học lại ở phần tổng kết.</p>${voiceNotice()}</div>`;
}
function flip() {
  if (view !== "flash") return;
  flash.flipped = !flash.flipped;
  const el = $("#flashcard"),
    c = flashCard();
  el.classList.toggle("flipped", flash.flipped);
  el.setAttribute("aria-pressed", flash.flipped);
  el.setAttribute(
    "aria-label",
    (flash.flipped
      ? flash.reverse
        ? c.word
        : c.meaning
      : flash.reverse
        ? c.meaning
        : c.word) + ". Bấm để lật thẻ",
  );
  el.querySelector(".front").setAttribute("aria-hidden", flash.flipped);
  el.querySelector(".back").setAttribute("aria-hidden", !flash.flipped);
}
function rate(value) {
  if (view !== "flash") return;
  const id = flash.queue.shift();
  flash.attempts[id] = (flash.attempts[id] || 0) + 1;
  mark(id, value);
  if (value || flash.attempts[id] >= 2) flash.resolved[id] = value;
  else flash.queue.splice(Math.min(3, flash.queue.length), 0, id);
  flash.flipped = false;
  if (!flash.queue.length) view = "flash-result";
  render();
}
const flashWrong = () => flash.cards.filter((c) => !flash.resolved[c.id]);
function renderFlashResult() {
  const wrong = flashWrong();
  $("#main").innerHTML =
    `<div class="study-shell"><div class="panel result-hero"><div class="result-icon">${icon("trophy")}</div><h1>Hoàn thành vòng học!</h1><div class="result-numbers"><div><strong>${flash.cards.length - wrong.length}</strong><span>Từ đã thuộc</span></div><div><strong>${wrong.length}</strong><span>Từ chưa thuộc</span></div></div><div class="row" style="justify-content:center">${button("retry-flash", "Học lại từ chưa thuộc", "primary", wrong.length ? "" : "disabled")}${button("restart-flash", "Học lại toàn bộ")}${button("library", "Về bộ từ", "ghost")}</div></div>${wrong.length ? '<div class="section-head"><h2>Từ cần ôn thêm</h2></div>' + wordTable(wrong) : ""}</div>`;
}

/* Quiz thử thách: trạng thái một phiên, một interval, luôn dọn khi rời phiên. */
const powerNames = {
  half: "50/50",
  time: "Thêm giờ",
  double: "Nhân đôi điểm",
  second: "Cơ hội thứ hai",
};
function ensureSetup() {
  const d = deck();
  if (!setup || setup.deckId !== d.id || setup.mode !== d.organization.mode)
    setup = {
      deckId: d.id,
      mode: d.organization.mode,
      scopes: Core.scopes(d).map((s) => s.id),
      filter: "all",
      count: "10",
      time: "20",
      direction: "forward",
      format: "choice",
      power: true,
      bots: true,
      shuffle: true,
      auto: false,
      repeat: false,
    };
}
const selectHTML = (id, label, options, value) =>
  `<label>${label}<select id="${id}">${options.map(([v, t]) => `<option value="${v}" ${String(value) === String(v) ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
const toggleHTML = (id, text, value) =>
  `<label class="toggle-label"><input type="checkbox" id="${id}" ${value ? "checked" : ""}> ${text}</label>`;
function renderQuizSetup() {
  ensureSetup();
  const d = deck(),
    scopes = Core.scopes(d);
  $("#main").innerHTML =
    intro(
      "HỌC MỘT CHÚT, CHƠI MỘT VÒNG",
      "Quiz thử thách",
      "Một cuộc đua nhỏ với chính bạn. Chơi một người; đối thủ mô phỏng luôn được ghi nhãn Bot.",
      `<span class="pill quiz-pill">✦ SẴN SÀNG BỨT PHÁ?</span>`,
    ) +
    contentTools() +
    draftHTML(d) +
    `<div class="quiz-setup"><section class="panel"><h2>01 · Chọn sân chơi</h2>${selectHTML(
      "quiz-deck",
      "Bộ học",
      store.decks.map((d) => [d.id, d.name]),
      d.id,
    )}<div class="row spread" style="margin:20px 0 12px"><h3>${d.organization.mode === "split" ? "Chapter" : "Section gốc"}</h3>${button("quiz-select-all", "Chọn tất cả / Bỏ chọn", "small")}</div><p class="muted" style="font-size:12px">${d.organization.mode === "merged" ? "Bộ đang gộp; chọn section gốc để giới hạn câu hỏi." : "Chọn một hoặc nhiều chapter."}</p><div class="scope-list">${scopes.map((s) => `<label class="scope-option"><input type="checkbox" data-scope="${s.id}" ${setup.scopes.includes(s.id) ? "checked" : ""}><span>${esc(s.name)}</span><small>${s.cards.length} ${d.kind === "quiz" ? "câu" : "từ"}</small></label>`).join("")}</div></section><section class="panel form-stack"><h2>02 · Luật chơi của bạn</h2><div class="form-grid">${selectHTML(
      "quiz-filter",
      "Nguồn câu hỏi",
      [
        ["all", "Tất cả"],
        ["unknown", "Chưa thuộc"],
        ["hard", "Đã đánh dấu ⭐"],
      ],
      setup.filter,
    )}${selectHTML(
      "quiz-count",
      "Số câu",
      [
        ["10", "10 câu"],
        ["20", "20 câu"],
        ["30", "30 câu"],
        ["all", "Tất cả"],
      ],
      setup.count,
    )}${selectHTML(
      "quiz-time",
      "Thời gian mỗi câu",
      [
        ["10", "10 giây"],
        ["15", "15 giây"],
        ["20", "20 giây"],
        ["30", "30 giây"],
        ["0", "Không giới hạn"],
      ],
      setup.time,
    )}${selectHTML(
      "quiz-direction",
      "Hướng câu hỏi",
      [
        ["forward", "Từ → Nghĩa"],
        ["reverse", "Nghĩa → Từ"],
        ["mixed", "Hỗn hợp"],
      ],
      setup.direction,
    )}${selectHTML(
      "quiz-format",
      "Dạng câu",
      [
        ["choice", "Trắc nghiệm"],
        ["typing", "Gõ đáp án"],
        ["mixed", "Hỗn hợp"],
      ],
      setup.format,
    )}</div><div class="toggle-grid">${toggleHTML("quiz-power", "Power-up", setup.power)}${toggleHTML("quiz-sound", "Âm thanh", store.settings.sound)}${toggleHTML("quiz-bots", "Đua với 4 bot", setup.bots)}${toggleHTML("quiz-shuffle", "Xáo trộn", setup.shuffle)}${toggleHTML("quiz-auto", "Tự chuyển sau 2 giây", setup.auto)}${toggleHTML("quiz-repeat", "Lặp câu sai đến khi đúng", setup.repeat)}</div><p class="muted" style="font-size:12px">Khi bật lặp câu sai: câu sai hoặc hết giờ trở lại sau 2 câu khác (hoặc cuối hàng chờ nếu còn ít câu). Lượt ôn lại không cộng điểm; kết quả tính theo lần trả lời đầu.</p><div class="notice" id="quiz-selection"></div>${button("start-quiz", "Bắt đầu thử thách " + icon("arrow"), "primary quiz-start", 'id="start-quiz"')}<p class="muted" style="font-size:12px">Ít nhất 1 từ để chơi. Khi không đủ 4 đáp án khác nhau, câu hỏi tự chuyển sang gõ. Trả lời quiz không tự đánh dấu “Đã thuộc”.</p></section></div><div class="section-head"><h2>Thành tích theo tập nhóm đã chọn</h2></div><div id="setup-history"></div>`;
  if (d.kind === "quiz") {
    for (const id of ["quiz-direction", "quiz-format"]) {
      $("#" + id).closest("label").hidden = true;
    }
    $("#quiz-direction").value = "forward";
    $("#quiz-format").value = "choice";
    setup.direction = "forward";
    setup.format = "choice";
    $("#start-quiz").nextElementSibling.textContent =
      "A–D: chọn 1 trong 4 đáp án. True/False: chọn Đúng/Sai. Short Answer: gõ câu trả lời rồi nhấn Enter.";
  }
  updateQuizSelection();
}
function readSetup() {
  if (!$("#quiz-filter")) return;
  setup.scopes = Array.from(
    document.querySelectorAll("[data-scope]:checked"),
  ).map((el) => el.dataset.scope);
  for (const key of ["filter", "count", "time", "direction", "format"])
    setup[key] = $("#quiz-" + key).value;
  for (const key of ["power", "bots", "shuffle", "auto", "repeat"])
    setup[key] = $("#quiz-" + key).checked;
  store.settings.sound = $("#quiz-sound").checked;
  save("meta");
}
function setupCards() {
  return Core.selectCards(deck(), setup.scopes, setup.filter);
}
function updateQuizSelection() {
  const cards = setupCards(),
    count =
      setup.count === "all"
        ? cards.length
        : Math.min(Number(setup.count), cards.length);
  $("#quiz-selection").textContent = !setup.scopes.length
    ? "Chọn ít nhất một chapter/section để bắt đầu."
    : !cards.length
      ? "Không có nội dung phù hợp với bộ lọc. Hãy đổi nguồn câu hỏi hoặc chọn nhóm khác."
      : `${cards.length} ${deck().kind === "quiz" ? "câu hỏi" : "từ"} phù hợp · Chơi ${count} câu${count < 4 && deck().kind !== "quiz" ? " · Có thể dùng dạng gõ vì ít đáp án khác nhau" : ""}`;
  $("#start-quiz").disabled = !count;
  $("#setup-history").innerHTML = historyHTML(
    Core.scopeKey(deck().organization.mode, setup.scopes),
  );
}
function historyHTML(key) {
  const list = deck().records[key] || [];
  if (!list.length)
    return '<div class="empty-state">Chưa có lượt chơi hoàn tất cho tập nhóm này.</div>';
  const top = [...list].sort((a, b) => b.score - a.score).slice(0, 5),
    recent = [...list].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const table = (rows) =>
    `<div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Điểm</th><th>Đúng</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(new Date(r.date).toLocaleString("vi-VN"))}<small>${esc(r.label)}</small></td><td><b>${r.score.toLocaleString("vi-VN")}</b></td><td>${r.correct}/${r.total}</td></tr>`).join("")}</tbody></table></div>`;
  return `<div class="history-grid"><div><h3>5 điểm cao nhất</h3>${table(top)}</div><div><h3>5 lượt gần nhất</h3>${table(recent)}</div></div><p class="muted" style="font-size:12px;margin-top:10px">Điểm được lưu theo tập nhóm; luật chơi đi kèm mỗi lượt. Chỉ so sánh trực tiếp các lượt có cùng luật và số câu.</p>`;
}
function prepareAudio() {
  if (!store.settings.sound) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended")
      audioContext.resume().catch(() => {});
  } catch (e) {
    toast("Thiết bị chưa phát được âm thanh trò chơi.");
  }
}
function sound(correct) {
  if (!store.settings.sound) return;
  prepareAudio();
  if (!audioContext) return;
  try {
    const now = audioContext.currentTime;
    [correct ? 523 : 196, correct ? 784 : 164].forEach((freq, i) => {
      const o = audioContext.createOscillator(),
        g = audioContext.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, now + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.08, now + i * 0.09 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.16);
      o.connect(g);
      g.connect(audioContext.destination);
      o.start(now + i * 0.09);
      o.stop(now + i * 0.09 + 0.18);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
    });
  } catch (e) {
    /* Quiz tiếp tục nếu thiết bị không hỗ trợ audio. */
  }
}
function startQuiz(overrideCards = null, replayConfig = null) {
  if (readQuizDraft(deck()) && !confirm('Bộ này có bài đang làm dở. Bắt đầu bài mới sẽ thay thế bài dở. Tiếp tục?')) return;
  if (replayConfig) setup = structuredClone(replayConfig);
  else readSetup();
  const d = deck(),
    pool = overrideCards || setupCards();
  if (!pool.length) {
    toast("Không có từ để chơi.");
    return;
  }
  const config = structuredClone(setup);
  let cards = config.shuffle ? Core.shuffle(pool) : [...pool];
  if (!overrideCards && config.count !== "all")
    cards = cards.slice(0, Number(config.count));
  const all = originalCards(d),
    questions = cards.map((c) => {
      if (c.type === "short-answer") return {card:c, direction:"forward", format:"typing", options:null, fallback:false};
      if (c.options)
        return {
          card: c,
          direction: "forward",
          format: "choice",
          options: [...c.options],
          fallback: false,
        };
      const direction =
        config.direction === "mixed"
          ? Math.random() < 0.5
            ? "forward"
            : "reverse"
          : config.direction;
      let format =
        config.format === "mixed"
          ? Math.random() < 0.5
            ? "choice"
            : "typing"
          : config.format;
      const options =
        format === "choice" ? Core.choices(c, pool, all, direction) : null;
      if (!options) format = "typing";
      return {
        card: c,
        direction,
        format,
        options,
        fallback: config.format === "choice" && !options,
      };
    });
  stopTimers();
  prepareAudio();
  quiz = {
    deckId: d.id,
    runId: uid(),
    config,
    cards,
    pool,
    questions,
    index: 0,
    results: [],
    retryResults: [],
    score: 0,
    streak: 0,
    maxStreak: 0,
    inventory: [],
    bots: config.bots
      ? [
          { name: "Mầm", emoji: "🌱", accuracy: 0.55, speed: 0.7 },
          { name: "Mây", emoji: "☁️", accuracy: 0.7, speed: 0.53 },
          { name: "Cáo", emoji: "🦊", accuracy: 0.82, speed: 0.38 },
          { name: "Sao", emoji: "🌟", accuracy: 0.92, speed: 0.22 },
        ].map((b) => ({ ...b, score: 0, streak: 0 }))
      : [],
    scopeKey: Core.scopeKey(d.organization.mode, config.scopes),
    saved: false,
  };
  view = "quiz";
  beginQuestion();
  scrollTo({ top: 0 });
}
function question() {
  return quiz.questions[quiz.index];
}
let lastDraftSave = 0;
function saveQuizDraft() {
  if (!quiz || quiz.saved || loadBlocked || !quiz.deckId) return;
  const state = structuredClone(quiz);
  state.typedAnswer = $('#quiz-answer-input')?.value ?? quiz.typedAnswer ?? '';
  state.cards = quiz.cards.map(c=>c.id);
  state.pool = quiz.pool.map(c=>c.id);
  state.questions = quiz.questions.map(q=>({...q,card:q.card.id}));
  state.paused = true;
  state.lastTick = 0;
  const value = JSON.stringify({version:1, savedAt:new Date().toISOString(), state});
  writer.put(StorageModel.key('session',quiz.deckId),()=>value);
  lastDraftSave = performance.now();
}
function readQuizDraft(d) {
  try {
    const raw = storagePort.getItem(StorageModel.key('session',d.id));
    if (!raw) return null;
    const data = JSON.parse(raw), s = data.state;
    if (data.version !== 1 || !s || s.deckId !== d.id || s.saved || typeof s.runId !== 'string' ||
        !Array.isArray(s.cards) || !s.cards.length || !Array.isArray(s.pool) ||
        !Array.isArray(s.questions) || !s.questions.length || !Number.isInteger(s.index) || s.index < 0 || s.index >= s.questions.length ||
        !s.config || !Array.isArray(s.config.scopes) || !Array.isArray(s.results) || !Array.isArray(s.retryResults) ||
        !Array.isArray(s.inventory) || !Array.isArray(s.bots) || !Array.isArray(s.hidden) || !s.used ||
        typeof s.answered !== 'boolean' || (s.answered && !s.feedback) ||
        !['score','streak','maxStreak','remaining','budget','elapsed'].every(k=>Number.isFinite(s[k]) && s[k]>=0)) throw Error('Invalid session');
    const cards = new Map(originalCards(d).map(c=>[c.id,c]));
    if (![...s.cards,...s.pool,...s.questions.map(q=>q.card)].every(id=>cards.has(id)) ||
        !s.questions.every(q=>['forward','reverse'].includes(q.direction) && ['choice','typing'].includes(q.format) &&
          (q.format==='typing' || (Array.isArray(q.options) && q.options.length>=2 && q.options.every(o=>typeof o==='string'))))) throw Error('Changed content');
    s.cards=s.cards.map(id=>cards.get(id));s.pool=s.pool.map(id=>cards.get(id));
    s.questions=s.questions.map(q=>({...q,card:cards.get(q.card)}));
    return {state:s,savedAt:data.savedAt};
  } catch { return {invalid:true}; }
}
function draftHTML(d) {
  const draft = readQuizDraft(d);
  if (!draft) return '';
  const s=draft.state;
  return `<section class="panel quiz-draft"><div><span class="eyebrow">BÀI ĐANG LÀM DỞ</span><h3>${esc(d.name)}</h3><p>${draft.invalid ? 'Nội dung bộ học đã thay đổi hoặc phiên lưu không còn hợp lệ. Hãy xóa phiên này để bắt đầu lại.' : `Đã trả lời ${s.results.length}/${s.cards.length} câu · Đang ở lượt ${s.index+1}/${s.questions.length} · ${s.score.toLocaleString('vi-VN')} điểm`}</p>${!draft.invalid ? `<div class="progress"><i style="width:${Math.min(100,s.results.length/s.cards.length*100)}%"></i></div>`:''}</div><div class="row">${!draft.invalid?button('continue-quiz-draft','Làm tiếp','primary',`data-id="${d.id}"`):''}${button('delete-quiz-draft','Xóa bài dở','danger',`data-id="${d.id}"`)}</div></section>`;
}
function deleteQuizDraft(id) {
  const key=StorageModel.key('session',id);
  writer.discard([key]);
  return removeStorage(key);
}
function continueQuizDraft(id) {
  const d=store.decks.find(d=>d.id===id), draft=d&&readQuizDraft(d);
  if (!draft || draft.invalid) {toast('Không thể tiếp tục phiên này. Hãy xóa bài dở và bắt đầu lại.');return;}
  if (!leaveSession()) return;
  store.activeDeckId=id;save('meta');
  quiz=draft.state;setup=structuredClone(quiz.config);
  quiz.paused=false;quiz.lastTick=performance.now();
  view='quiz';prepareAudio();render();
  if ($('#quiz-answer-input')) $('#quiz-answer-input').value=quiz.typedAnswer || '';
  if (!quiz.answered) timer=setInterval(tickQuiz,100);
  scrollTo({top:0});
}
function beginQuestion() {
  stopTimers();
  quiz.answered = false;
  quiz.paused = false;
  quiz.remaining = Number(quiz.config.time) * 1000;
  quiz.budget = quiz.remaining;
  quiz.elapsed = 0;
  quiz.lastTick = performance.now();
  quiz.hidden = [];
  quiz.used = {};
  quiz.double = false;
  quiz.second = false;
  quiz.retryMessage = "";
  quiz.feedback = null;
  quiz.typedAnswer = '';
  render();
  saveQuizDraft();
  timer = setInterval(tickQuiz, 100);
}
function tickQuiz() {
  if (view !== "quiz" || !quiz || quiz.paused || quiz.answered) return;
  const now = performance.now(),
    delta = Math.max(0, now - quiz.lastTick);
  quiz.lastTick = now;
  quiz.elapsed += delta;
  if (Number(quiz.config.time) > 0)
    quiz.remaining = Math.max(0, quiz.remaining - delta);
  updateTimer();
  if (now-lastDraftSave >= 5000) saveQuizDraft();
  if (Number(quiz.config.time) > 0 && quiz.remaining <= 0)
    submitQuiz("", true, true);
}
function updateTimer() {
  if (!$("#timer-text")) return;
  const limited = Number(quiz.config.time) > 0;
  $("#timer-text").textContent = limited
    ? Math.ceil(quiz.remaining / 1000) + "s"
    : "∞";
  $("#timer-fill").style.width = limited
    ? Math.max(0, (quiz.remaining / quiz.budget) * 100) + "%"
    : "100%";
  $("#timer-fill").classList.toggle(
    "urgent",
    limited && quiz.remaining <= 5000,
  );
  $("#quiz-timer").setAttribute(
    "aria-valuenow",
    limited ? Math.ceil(quiz.remaining / 1000) : 0,
  );
}
function ranking() {
  return [
    { name: "Bạn", emoji: "🙂", score: quiz.score, user: true },
    ...quiz.bots,
  ].sort(
    (a, b) =>
      b.score - a.score || Number(b.user || false) - Number(a.user || false),
  );
}
function rankingHTML() {
  if (!quiz.bots.length) return "";
  return `<aside class="panel leaderboard"><h3>Đường đua mô phỏng</h3><p class="muted">4 đối thủ Bot · cập nhật sau mỗi câu</p><ol>${ranking()
    .map(
      (p) =>
        `<li class="${p.user ? "you" : ""}"><span>${p.emoji} ${esc(p.name)} ${p.user ? "" : "<small>Bot</small>"}</span><strong>${p.score.toLocaleString("vi-VN")}</strong></li>`,
    )
    .join("")}</ol></aside>`;
}
function powerAvailable(type) {
  if (quiz.answered || quiz.paused || quiz.used[type]) return false;
  if (type === "half") {
    const q = question(),
      correct = q.direction === "forward" ? q.card.meaning : q.card.word;
    return (
      q.format === "choice" &&
      q.options.filter((v, i) => v !== correct && !quiz.hidden.includes(i))
        .length >= 2
    );
  }
  if (type === "time") return Number(quiz.config.time) > 0;
  return true;
}
function renderQuiz() {
  if (!quiz) {
    view = "quiz-setup";
    render();
    return;
  }
  const q = question(),
    c = q.card,
    isWord = q.direction === "forward",
    prompt = isWord ? c.word : c.meaning,
    expected = isWord ? c.meaning : c.word;
  $("#main").innerHTML =
    `<div class="quiz-play"><div class="quiz-toolbar"><div class="row"><span class="pill quiz-pill">✦ Quiz thử thách</span><strong>${quiz.index + 1} / ${quiz.questions.length}</strong></div><div class="row">${button("quiz-sound", store.settings.sound ? "♫ Âm thanh bật" : "♪ Âm thanh tắt", "small", `aria-pressed="${store.settings.sound}"`)}${button("pause-quiz", "Ⅱ Tạm dừng", "small", quiz.answered ? "disabled" : "")}${button("exit-study", icon("close"), "small", 'aria-label="Thoát quiz"')}</div></div><div class="game-hud"><div><small>ĐIỂM CỦA BẠN</small><strong>${quiz.score.toLocaleString("vi-VN")}</strong></div><div><small>CHUỖI ĐÚNG</small><strong>🔥 ${quiz.streak}</strong></div><div><small>THỜI GIAN</small><strong id="timer-text"></strong></div></div><div class="timer-bar" id="quiz-timer" role="progressbar" aria-label="Giây còn lại" aria-valuemin="0" aria-valuemax="${quiz.budget / 1000 || 1}"><i id="timer-fill"></i></div><div class="quiz-game-grid"><section class="panel quiz-panel"><div class="row spread"><span class="muted">${c.type === "short-answer" ? "Nhập câu trả lời ngắn" : c.type === "true-false" ? "Chọn True (Đúng) hoặc False (Sai)" : c.options ? "Chọn một đáp án đúng" : isWord ? "Chọn hoặc nhập nghĩa của từ" : "Tìm từ tương ứng với nghĩa"}</span><div class="row">${starButton(c.id)}${isWord ? speaker(c.id) : ""}</div></div>${q.repeat ? '<p class="notice" role="status">↻ Ôn lại câu đã sai · Không cộng điểm</p>' : ""}${q.fallback ? '<p class="notice">Chưa đủ 4 đáp án khác nhau; câu này chuyển sang gõ.</p>' : ""}<div class="quiz-prompt">${isWord ? "<div>" + badges(c.pos) + "</div>" : ""}${esc(prompt)}</div>${
      q.format === "choice"
        ? `<div class="answers game-answers">${q.options
            .map((option, i) => {
              const result = quiz.feedback;
              return `<button class="btn answer option-${i} ${quiz.answered ? (option === expected ? "correct" : option === result?.answer ? "wrong" : "") : ""}" data-action="quiz-answer" data-index="${i}" ${quiz.answered || quiz.hidden.includes(i) ? "disabled" : ""}><span class="shape">${c.options ? (c.type === "true-false" ? "TF"[i] : "ABCD"[i]) : ["▲", "◆", "●", "■"][i]}</span><span>${quiz.hidden.includes(i) ? "Đã loại" : esc(option)}</span><kbd>${i + 1}</kbd>${quiz.answered && option === expected ? '<span aria-label="Đáp án đúng">✓</span>' : ""}${quiz.answered && option !== expected && option === result?.answer ? '<span aria-label="Đáp án sai">✕</span>' : ""}</button>`;
            })
            .join("")}</div>`
        : `<form id="quiz-answer-form" class="quiz-form"><label for="quiz-answer-input">Câu trả lời của bạn</label><input id="quiz-answer-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" ${quiz.answered ? "disabled" : ""} value="${esc(quiz.feedback?.answer || "")}" placeholder="Gõ đáp án…"><small>Không phân biệt hoa/thường hoặc khoảng trắng thừa.${!isWord ? " Chấp nhận một biến thể được ngăn bằng dấu /." : ""}</small>${!quiz.answered ? '<button class="btn primary" type="submit">Trả lời ↵</button>' : ""}</form>`
    }${quiz.retryMessage && !quiz.answered ? `<div class="notice" role="status">${esc(quiz.retryMessage)}</div>` : ""}${quiz.answered ? `<div class="quiz-feedback ${quiz.feedback.correct ? "" : "wrong"}" role="status"><strong>${quiz.feedback.correct ? "✓ Chính xác!" : "✕ " + (quiz.feedback.timeout ? "Hết giờ. " : "") + "Không sao, thử ghi nhớ lần nữa nhé."}</strong><span>Đáp án: ${esc(expected)}</span>${quiz.feedback.repeatQueued ? "<p>Câu này sẽ xuất hiện lại sau 2 câu khác hoặc ở cuối hàng chờ nếu còn ít câu.</p>" : ""}${c.note ? `<p class="text-preserve">${esc(c.note)}</p>` : ""}<small>+${quiz.feedback.points} điểm · ${(quiz.feedback.elapsed / 1000).toFixed(1)} giây${quiz.feedback.reward ? " · Nhận: " + powerNames[quiz.feedback.reward] : ""}</small></div><div class="quiz-navigation">${speaker(c.id)}${button("quiz-next", quiz.index + 1 === quiz.questions.length ? "Xem kết quả" : "Câu tiếp " + icon("arrow"), "primary", 'id="quiz-next"')}</div>` : ""}<p class="study-meta">${esc(c.chapterName)} / ${esc(c.sectionName)}</p></section>${rankingHTML()}</div>${
      quiz.config.power
        ? `<div class="power-tray"><div><strong>Túi power-up</strong><small>Nhận 1 món ở chuỗi 3, 6, 9… · tối đa 3 món · phím Q/W/E theo ô</small></div><div class="row">${quiz.inventory.length ? quiz.inventory.map((p, i) => button("power", `${["Q", "W", "E"][i]} · ${powerNames[p]}`, "power-button", `data-index="${i}" ${powerAvailable(p) ? "" : "disabled"}`)).join("") : '<span class="muted">Chưa có power-up. Tiếp tục chuỗi đúng nhé!</span>'}</div><small>${
            Object.keys(quiz.used)
              .map((p) => powerNames[p])
              .join(" · ")
              ? "Đã dùng câu này: " +
                Object.keys(quiz.used)
                  .map((p) => powerNames[p])
                  .join(" · ")
              : "50/50 chỉ dùng cho trắc nghiệm; Thêm giờ chỉ dùng khi có giới hạn giờ."
          }</small></div>`
        : ""
    }</div>`;
  updateTimer();
  if (q.format === "typing" && !quiz.answered)
    $("#quiz-answer-input")?.focus({ preventScroll: true });
  if (quiz.answered) $("#quiz-next")?.focus({ preventScroll: true });
}
function submitQuiz(answer, timeout = false, alreadyTicked = false) {
  if (view !== "quiz" || !quiz || quiz.answered || quiz.paused) return;
  if (!alreadyTicked) {
    tickQuiz();
    if (quiz.answered) return;
  }
  const q = question(),
    expected = q.direction === "forward" ? q.card.meaning : q.card.word;
  const correct =
    !timeout &&
    (q.card.options
      ? answer === expected
      : Core.matches(answer, expected, q.direction === "reverse"));
  if (!correct && !timeout && quiz.second) {
    quiz.second = false;
    quiz.retryMessage =
      "↻ Cơ hội thứ hai: bạn còn một lần thử. Đồng hồ vẫn chạy.";
    if (q.format === "choice") {
      const index = q.options.indexOf(answer);
      if (index >= 0) quiz.hidden.push(index);
    }
    renderQuiz();
    saveQuizDraft();
    return;
  }
  stopTimers();
  quiz.answered = true;
  if (!q.repeat) quiz.streak = correct ? quiz.streak + 1 : 0;
  quiz.maxStreak = Math.max(quiz.maxStreak, quiz.streak);
  const points = q.repeat
    ? 0
    : Core.score({
        correct,
        remaining: quiz.remaining,
        limit: Number(quiz.config.time) * 1000,
        streak: quiz.streak,
        double: quiz.double,
      });
  quiz.score += points;
  let reward = null;
  if (
    !q.repeat &&
    correct &&
    quiz.config.power &&
    quiz.streak % 3 === 0 &&
    quiz.inventory.length < 3
  ) {
    const types = Object.keys(powerNames);
    reward = types[Math.floor(Math.random() * types.length)];
    quiz.inventory.push(reward);
  }
  const repeatQueued = quiz.config.repeat && !correct;
  if (repeatQueued)
    quiz.questions.splice(Math.min(quiz.index + 3, quiz.questions.length), 0, {
      ...q,
      repeat: true,
      options: q.options ? [...q.options] : null,
    });
  quiz.feedback = {
    id: q.card.id,
    answer,
    correct,
    timeout,
    points,
    elapsed: quiz.elapsed,
    reward,
    repeatQueued,
  };
  (q.repeat ? quiz.retryResults : quiz.results).push(quiz.feedback);
  if (!q.repeat)
    quiz.bots = quiz.bots.map((b) =>
      Core.botAnswer(b, Number(quiz.config.time) * 1000),
    );
  const d = deck(),
    memory = d.quizMemory[q.card.id] || { consecutive: 0, lastRun: "" };
  if (!q.repeat && memory.lastRun !== quiz.runId)
    d.quizMemory[q.card.id] = {
      lastRun: quiz.runId,
      consecutive: correct ? memory.consecutive + 1 : 0,
    };
  activity();
  save("stats");
  sound(correct);
  renderQuiz();
  saveQuizDraft();
  if (quiz.config.auto)
    autoTimer = setTimeout(() => {
      autoTimer = null;
      nextQuestion();
    }, 2000);
}
function nextQuestion() {
  if (!quiz?.answered || view !== "quiz") return;
  stopTimers();
  if (quiz.index + 1 >= quiz.questions.length) {
    finishQuiz();
    return;
  }
  quiz.index++;
  beginQuestion();
}
function usePower(index) {
  if (view !== "quiz" || !quiz) return;
  tickQuiz();
  if (quiz.answered) return;
  const type = quiz.inventory[index];
  if (!type || !powerAvailable(type)) return;
  const typed = $("#quiz-answer-input")?.value || "";
  quiz.inventory.splice(index, 1);
  quiz.used[type] = true;
  if (type === "half") {
    const q = question(),
      correct = q.direction === "forward" ? q.card.meaning : q.card.word;
    quiz.hidden.push(
      ...Core.shuffle(
        q.options
          .map((v, i) => ({ v, i }))
          .filter((x) => x.v !== correct && !quiz.hidden.includes(x.i)),
      )
        .slice(0, 2)
        .map((x) => x.i),
    );
  } else if (type === "time") {
    quiz.remaining += 10000;
    quiz.budget += 10000;
  } else if (type === "double") quiz.double = true;
  else if (type === "second") quiz.second = true;
  renderQuiz();
  if ($("#quiz-answer-input")) $("#quiz-answer-input").value = typed;
  saveQuizDraft();
}
function pauseQuiz() {
  if (view !== "quiz" || !quiz || quiz.paused || quiz.answered) return;
  tickQuiz();
  if (quiz.answered) return;
  quiz.paused = true;
  saveQuizDraft();
  stopTimers();
  $("#quiz-private").textContent = "";
  $("#main").classList.add("paused-content");
  $("#dialog").dataset.kind = "pause";
  openDialog(
    `<h2 id="dialog-title">Tạm nghỉ một chút.</h2><p>Đồng hồ và câu hỏi đã được tạm dừng.</p><div class="dialog-actions">${button("exit-paused", "Thoát phiên", "danger")}${button("resume-quiz", "Tiếp tục", "primary")}</div>`,
  );
}
function resumeQuiz() {
  if (!quiz || !quiz.paused) return;
  $("#dialog").close();
  $("#dialog").dataset.kind = "";
  $("#main").classList.remove("paused-content");
  quiz.paused = false;
  quiz.lastTick = performance.now();
  timer = setInterval(tickQuiz, 100);
}
function finishQuiz() {
  stopTimers();
  if (!quiz.saved) {
    const d = deck(),
      records = d.records[quiz.scopeKey] || [];
    quiz.previousBest = records.length
      ? Math.max(...records.map((r) => r.score))
      : 0;
    quiz.newRecord = quiz.score > quiz.previousBest;
    const label = `${quiz.cards.length} câu · ${quiz.config.time === "0" ? "không giới hạn" : quiz.config.time + "s"} · ${quiz.config.format} · ${quiz.config.direction} · power-up ${quiz.config.power ? "bật" : "tắt"} · lặp câu sai ${quiz.config.repeat ? "bật" : "tắt"} · ${quiz.retryResults.length} lượt ôn lại`;
    records.push({
      id: quiz.runId,
      date: new Date().toISOString(),
      score: quiz.score,
      correct: quiz.results.filter((r) => r.correct).length,
      total: quiz.cards.length,
      label,
    });
    d.records[quiz.scopeKey] = records;
    d.records = StorageModel.trimHistory(d.records);
    quiz.saved = true;
    save("stats");
  }
  view = "quiz-result";
  deleteQuizDraft(quiz.deckId);
  flushStorage();
  render();
  scrollTo({ top: 0 });
}
function wrongQuizCards() {
  const ids = new Set(quiz.results.filter((r) => !r.correct).map((r) => r.id));
  return quiz.cards.filter((c) => ids.has(c.id));
}
function renderQuizResult() {
  const wrong = wrongQuizCards(),
    correct = quiz.results.length - wrong.length,
    rank = ranking().findIndex((p) => p.user) + 1,
    average =
      quiz.results.reduce((n, r) => n + r.elapsed, 0) /
      quiz.results.length /
      1000,
    suggestions = quiz.cards.filter(
      (c) =>
        (deck().quizMemory[c.id]?.consecutive || 0) >= 2 &&
        !stateOf(c.id).known,
    );
  $("#main").innerHTML =
    intro(
      "THÊM MỘT BƯỚC TIẾN BỘ",
      "Bạn đã hoàn thành!",
      `${quiz.cards.length} câu · ${esc(deck().name)}`,
      quiz.newRecord
        ? '<span class="pill quiz-pill">🏆 Kỷ lục mới!</span>'
        : "",
    ) +
    `<div class="quiz-result-grid"><section class="panel result-hero"><div class="eyebrow">TỔNG ĐIỂM</div><div class="big-score">${quiz.score.toLocaleString("vi-VN")}</div><p class="muted">Điểm cao nhất trước đó: ${quiz.previousBest.toLocaleString("vi-VN")}${quiz.bots.length ? " · Hạng " + rank + "/5 (đua với Bot)" : ""}</p><p class="muted">${quiz.config.repeat ? `Đã ôn lại ${quiz.retryResults.length} lượt. Điểm và đúng/sai bên dưới tính theo lần trả lời đầu tiên.` : ""}</p><div class="result-metrics">${[
      [correct, "Câu đúng"],
      [wrong.length, "Câu sai"],
      [Math.round((correct * 100) / quiz.results.length) + "%", "Chính xác"],
      [average.toFixed(1) + "s", "Thời gian TB"],
      [quiz.maxStreak, "Chuỗi dài nhất"],
    ]
      .map(([n, l]) => `<div><strong>${n}</strong><small>${l}</small></div>`)
      .join(
        "",
      )}</div><div class="row" style="justify-content:center">${button("replay-quiz", "Chơi lại", "primary")}${button("replay-wrong", "Chỉ chơi lại câu sai", "", wrong.length ? "" : "disabled")}${button("decks", "Về trang chủ", "ghost")}</div></section>${rankingHTML()}</div>${suggestions.length ? `<div class="notice"><b>${suggestions.length} ${deck().kind === "quiz" ? "câu trả lời" : "từ"} đúng liên tiếp ở ít nhất 2 lần chơi khác nhau.</b> Bạn có muốn đánh dấu đã thuộc?<details><summary>Xem nội dung gợi ý</summary>${suggestions.map((c) => `<span class="pill">${esc(c.word)}</span>`).join(" ")}</details>${button("accept-known", "Đánh dấu đã thuộc", "small")}</div>` : ""}${wrong.length ? `<div class="section-head"><h2>${deck().kind === "quiz" ? "Câu hỏi cần ôn lại" : "Từ cần dành thêm thời gian"}</h2><div class="row">${button("star-wrong", "⭐ Đánh dấu câu sai", "small")}${button("unknown-wrong", "Đánh dấu chưa thuộc", "small")}</div></div>${wordTable(wrong)}` : ""}<div class="section-head"><h2>Lịch sử tập nhóm này</h2></div>${historyHTML(quiz.scopeKey)}`;
}

/* Một điểm vào cho thao tác chạm, chuột và bàn phím. */
function helpContent() {
  return `<h2 id="dialog-title">Một góc học của riêng bạn</h2><ol class="help-list"><li><b>Thêm bộ từ:</b> nhập .docx, chọn ngôn ngữ và cách tách/gộp. Heading 2 là chapter, dòng in đậm là section; cột 1 từ, cột 2 nghĩa, các cột tiếp theo là ghi chú. Không có chapter thì tự gộp “Tất cả”.</li><li><b>Flashcard:</b> chọn một hoặc nhiều section, Space để lật, ← chưa thuộc, → đã thuộc. Từ chưa thuộc trở lại sau tối đa 3 thẻ khác, tối đa 2 lượt/vòng. Đảo chiều, xáo trộn và dấu sao đều nằm trên thẻ.</li><li><b>Quiz thử thách:</b> chọn phạm vi và luật chơi. Phím 1–4 chọn đáp án, Enter nộp câu gõ; Q/W/E dùng power-up theo vị trí. Chọn “Không giới hạn” nếu muốn học thư thả. Sang tab khác sẽ tự tạm dừng câu đang chơi.</li><li><b>Điểm:</b> đúng nhận 600–1000 điểm theo thời gian, từ chuỗi 3 được nhân ×1.1, tăng dần tối đa ×1.5. Không giới hạn giờ nhận 1000 điểm cơ bản. Power-up nhân đôi áp dụng sau thưởng chuỗi. Sai hoặc hết giờ nhận 0.</li><li><b>Gõ đáp án:</b> bỏ qua loại từ, hoa/thường và khoảng trắng thừa. Với câu trả lời là từ, có thể nhập một biến thể ngăn bằng “/”. Câu trả lời là nghĩa cần khớp toàn bộ nghĩa.</li><li><b>Tiến độ:</b> quiz chỉ gợi ý đã thuộc sau 2 lần chơi đúng liên tiếp, không tự đánh dấu. Bảng xếp hạng chỉ có bạn và Bot mô phỏng; không có người chơi trực tuyến.</li><li><b>Sao lưu:</b> dùng Xuất tiến độ, rồi Nhập tiến độ trên máy khác. Khôi phục sẽ thay toàn bộ dữ liệu hiện tại sau khi bạn xác nhận.</li></ol><p>Dữ liệu chỉ ở trình duyệt này. Chế độ riêng tư có thể xóa dữ liệu khi đóng cửa sổ, ngay cả khi thao tác lưu tạm thời thành công. Không có cách đáng tin cậy để mọi trình duyệt phát hiện chế độ riêng tư; hãy luôn xuất sao lưu.</p><p>Tài liệu được đọc ngay trên thiết bị. Học dữ liệu đã lưu trong trang đang mở không cần mạng. Giọng đọc phụ thuộc thiết bị. Mã truy cập chỉ là lớp chắn nhẹ, không bảo mật dữ liệu qua máy chủ.</p>`;
}
function showHelp() {
  if (view === "quiz" && quiz && !quiz.answered) {
    pauseQuiz();
    $("#dialog .dialog-topbar").insertAdjacentHTML(
      "afterend",
      helpContent().replace('id="dialog-title"', ""),
    );
    return;
  }
  if (autoTimer !== null) {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
  openDialog(
    helpContent() +
      `<div class="dialog-actions">${button("close-dialog", "Đã hiểu", "primary")}</div>`,
  );
}
async function unlock(code) {
  try {
    if (!crypto.subtle)
      throw Error("Hãy mở bằng HTTPS hoặc localhost để dùng mã truy cập.");
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(code),
    );
    const digest = Array.from(new Uint8Array(bytes), (v) =>
      v.toString(16).padStart(2, "0"),
    ).join("");
    if (digest !== ACCESS_HASH) {
      $("#gate-error").textContent = "Mã chưa đúng. Bạn hãy thử lại.";
      return;
    }
    writeStorage(ACCESS_KEY, ACCESS_HASH);
    unlocked = true;
    $("#gate").hidden = true;
    $("#app").hidden = false;
    $("#access-code").value = "";
    render();
    if (quotaFailure) openStorage(true);
  } catch (e) {
    $("#gate-error").textContent = e.message;
  }
}
document.addEventListener("click", (event) => {
  const b = event.target.closest("[data-action]");
  if (!b || b.disabled) return;
  const a = b.dataset.action,
    id = b.dataset.id;
  if (a === "theme") {
    store.settings.theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    theme();
    save("meta");
    flushStorage();
    return;
  }
  if (!unlocked) return;
  if (a === "toggle-navigation") {
    setNavigationOpen(b.getAttribute("aria-expanded") !== "true");
    return;
  }
  if (a === 'create-manual-deck' || a === 'add-manual-card' || a === 'manage-cards') {
    if (!leaveSession()) return;
    if (a === 'manage-cards') showManageCards();
    else showManualCard(a === 'create-manual-deck');
    return;
  }
  if (a === 'remove-import-question') {removeImportQuestion(Number(b.dataset.index));return;}
  if (a === 'continue-quiz-draft') {continueQuizDraft(id);return;}
  if (a === 'delete-quiz-draft') {
    if (confirm('Xóa bài trắc nghiệm đang làm dở? Bộ câu hỏi và các kết quả đã hoàn thành vẫn được giữ.')) {
      if (deleteQuizDraft(id)) {render();toast('Đã xóa bài dở.');}
      else toast('Chưa xóa được bài dở trên trình duyệt.');
    }
    return;
  }
  if (a === 'delete-managed-cards') {deleteManagedCards();return;}
  if (a === 'select-managed-cards') {
    const boxes=[...document.querySelectorAll('.manage-card:not([hidden]) [data-manage-card]')];
    const checked=boxes.some(el=>!el.checked);for (const el of boxes) el.checked=checked;
    updateManageSelection();return;
  }
  if (["decks", "library", "hard", "stats", "quiz-setup"].includes(a)) {
    navigate(a);
    return;
  }
  if (a === "upload-quiz") {
    if (!leaveSession()) return;
    showQuizImportHelp();
    return;
  }
  if (a === "choose-quiz-file") {
    $("#quiz-file-input").click();
    return;
  }
  if (a === "settings") {
    showSettings();
    return;
  }
  if (a === "storage") {
    openStorage();
    return;
  }
  if (a === "storage-back") {
    returnFromStorage();
    return;
  }
  if (a === "export-deck") {
    exportDeck(id);
    return;
  }
  if (a === "clear-progress") {
    clearDeckPart(id, "progress");
    return;
  }
  if (a === "clear-history") {
    clearDeckPart(id, "history");
    return;
  }
  if (a === "cleanup-storage") {
    cleanupStorage();
    return;
  }
  if (a === "retry-save") {
    const ok = flushStorage();
    storageMessage =
      ok && !loadBlocked
        ? "Đã lưu tất cả thay đổi đang chờ."
        : "Chưa lưu được. Hãy xuất sao lưu hoặc dọn thêm dữ liệu.";
    renderStorage();
    return;
  }
  if (a === "open-deck") {
    openDeck(id);
    return;
  }
  if (a === "group") {
    groupId = id;
    selectedSections = new Set(currentGroup().sections.map((s) => s.id));
    hardFilter = false;
    view = "group";
    render();
    scrollTo({ top: 0 });
  } else if (a === "upload") {
    if ((view === "quiz" || view === "flash") && !leaveSession()) return;
    if (["quiz", "flash"].includes(view)) {
      view = "decks";
      render();
    }
    $("#file-input").click();
  } else if (a === "deck-settings") deckSettings(id);
  else if (a === "close-dialog") closeDialog();
  else if (a === "help") showHelp();
  else if (a === "select-sections") {
    const g = currentGroup();
    selectedSections =
      selectedSections.size === g.sections.length
        ? new Set()
        : new Set(g.sections.map((s) => s.id));
    renderGroup();
  } else if (a === "start-flash")
    startFlash(groupSelection(), currentGroup().name);
  else if (a === "study-section") {
    const g = currentGroup(),
      cards = Core.unique(
        Core.flatten([
          { ...g, sections: g.sections.filter((s) => s.id === id) },
        ]),
      ).filter((c) => !hardFilter || stateOf(c.id).starred);
    startFlash(cards, g.sections.find((s) => s.id === id).name);
  } else if (a === "study-hard")
    startFlash(
      originalCards(deck()).filter((c) => stateOf(c.id).starred),
      "Những từ khó",
    );
  else if (a === "quiz-group") {
    ensureSetup();
    setup.scopes =
      deck().organization.mode === "split"
        ? [groupId]
        : Core.scopes(deck()).map((s) => s.id);
    setup.filter = hardFilter ? "hard" : "all";
    view = "quiz-setup";
    render();
  } else if (a === "flip") flip();
  else if (a === "known") rate(true);
  else if (a === "unknown") rate(false);
  else if (a === "reverse") {
    flash.reverse = !flash.reverse;
    flash.flipped = false;
    renderFlash();
  } else if (a === "shuffle-flash") {
    flash.queue = Core.shuffle(flash.queue);
    flash.flipped = false;
    renderFlash();
    toast("Đã xáo trộn các thẻ còn lại.");
  } else if (a === "retry-flash") startFlash(flashWrong(), "Ôn từ chưa thuộc");
  else if (a === "restart-flash") startFlash(flash.cards, flash.label);
  else if (a === "star") toggleStar(id);
  else if (a === "speak") speak(id);
  else if (a === "exit-study" || a === "exit-paused") navigate("library");
  else if (a === "quiz-select-all") {
    readSetup();
    const scopes = Core.scopes(deck());
    setup.scopes =
      setup.scopes.length === scopes.length ? [] : scopes.map((s) => s.id);
    renderQuizSetup();
  } else if (a === "start-quiz") startQuiz();
  else if (a === "quiz-answer")
    submitQuiz(question().options[Number(b.dataset.index)]);
  else if (a === "quiz-next") nextQuestion();
  else if (a === "power") usePower(Number(b.dataset.index));
  else if (a === "pause-quiz") pauseQuiz();
  else if (a === "resume-quiz") resumeQuiz();
  else if (a === "quiz-sound") {
    store.settings.sound = !store.settings.sound;
    save("meta");
    prepareAudio();
    b.textContent = store.settings.sound ? "♫ Âm thanh bật" : "♪ Âm thanh tắt";
    b.setAttribute("aria-pressed", store.settings.sound);
  } else if (a === "replay-quiz") {
    const cards = quiz.cards,
      config = quiz.config;
    startQuiz(cards, config);
  } else if (a === "replay-wrong") {
    const cards = wrongQuizCards(),
      config = quiz.config;
    startQuiz(cards, config);
  } else if (a === "star-wrong") {
    for (const c of wrongQuizCards())
      deck().progress[c.id] = { ...stateOf(c.id), starred: true };
    save();
    renderQuizResult();
    toast("Đã thêm các từ sai vào ⭐ khó.");
  } else if (a === "unknown-wrong") {
    for (const c of wrongQuizCards())
      deck().progress[c.id] = { ...stateOf(c.id), known: false };
    save();
    toast("Đã đánh dấu các từ sai là chưa thuộc.");
  } else if (a === "accept-known") {
    for (const c of quiz.cards)
      if ((deck().quizMemory[c.id]?.consecutive || 0) >= 2)
        deck().progress[c.id] = { ...stateOf(c.id), known: true };
    save();
    renderQuizResult();
    toast("Đã đánh dấu những từ được gợi ý là đã thuộc.");
  } else if (a === "export") {
    if (view === "quiz" && !quiz.answered) pauseQuiz();
    exportBackup();
  } else if (a === "import-backup") {
    if (!leaveSession()) return;
    if (["quiz", "flash"].includes(view)) {
      view = "decks";
      render();
    }
    $("#backup-input").click();
  } else if (a === "delete-deck") deleteDeck(id);
  else if (a === "delete-all") deleteAllData();
  else if (a === "lock") {
    if (!leaveSession()) return;
    removeStorage(ACCESS_KEY);
    unlocked = false;
    $("#app").hidden = true;
    $("#gate").hidden = false;
    $("#access-code").focus();
    view = "decks";
  }
});
document.addEventListener("change", (event) => {
  const el = event.target;
  if (!unlocked) return;
  if (el.id === 'manual-type') {renderManualAnswerFields();return;}
  if (el.matches('[data-manage-card]')) {updateManageSelection();return;}
  if (el.id === "quiz-file-input") importQuizFile(el.files[0]);
  else if (el.id === "file-input") processUploadedFile(el.files[0]);
  else if (el.id === "backup-input") importBackup(el.files[0]);
  else if (el.dataset.section) {
    el.checked
      ? selectedSections.add(el.dataset.section)
      : selectedSections.delete(el.dataset.section);
    updateSelection();
  } else if (el.id === "hard-filter") {
    hardFilter = el.checked;
    updateSelection();
  } else if (el.name === "organization")
    $("#dedupe").disabled = el.value === "split";
  else if (el.id === "deck-language")
    $("#custom-language-label").hidden = el.value !== "other";
  else if (el.id === "library-deck") switchLibraryDeck(el.value);
  else if (el.id === "quiz-deck") {
    store.activeDeckId = el.value;
    setup = null;
    save("meta");
    render();
  } else if (
    el.dataset.scope ||
    (el.id.startsWith("quiz-") && view === "quiz-setup")
  ) {
    readSetup();
    updateQuizSelection();
  } else if (el.matches("[data-question-answer]")) {
    const qIdx = Number(el.dataset.questionAnswer),
      val = el.value;
    const box = document.querySelector(
      `.question-options[data-question-index="${qIdx}"]`,
    );
    if (box) {
      box.querySelectorAll("p[data-option-label]").forEach((p) => {
        const isSel = p.dataset.optionLabel === val;
        p.classList.toggle("quiz-answer-highlight", isSel);
        const lbl = p.dataset.optionLabel;
        const txt = p.textContent.replace(/^[A-DFT]\.\s*/, "").trim();
        p.innerHTML = isSel
          ? `<strong>${lbl}. ${esc(txt)}</strong>`
          : `${lbl}. ${esc(txt)}`;
      });
    }
  }
});
document.addEventListener("input", (event) => {
  if (event.target.id === "search") {
    search = event.target.value;
    renderSearch();
  }
});
document.addEventListener('input', (event) => {
  if (unlocked && event.target.id === 'quiz-answer-input') {
    quiz.typedAnswer=event.target.value;saveQuizDraft();return;
  }
  if (!unlocked || event.target.id !== 'manage-search') return;
  const query=Core.normalize(event.target.value);
  for (const row of document.querySelectorAll('.manage-card')) row.hidden=!row.dataset.search.includes(query);
});
document.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = event.target.id;
  if (id === "gate-form") {
    unlock($("#access-code").value);
    return;
  }
  if (!unlocked) return;
  if (id === "quiz-import-form") commitQuizImport();
  else if (id === 'manual-card-form') commitManualCard(event.submitter?.value === 'more');
  else if (id === "import-form") commitImport();
  else if (id === "settings-form") saveDeckSettings();
  else if (id === "quiz-answer-form") submitQuiz($("#quiz-answer-input").value);
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    $(".header").classList.contains("navigation-open")
  ) {
    event.preventDefault();
    setNavigationOpen(false, true);
    return;
  }
  if (
    !unlocked ||
    event.repeat ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    document.querySelector("dialog[open]") ||
    event.target.closest('input,textarea,select,[contenteditable="true"]')
  )
    return;
  if (view === "flash") {
    if (event.code === "Space" && !event.target.closest("button,a")) {
      event.preventDefault();
      flip();
    } else if (event.key === "Enter" && event.target.id === "flashcard") {
      event.preventDefault();
      flip();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      rate(true);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      rate(false);
    }
  } else if (view === "quiz" && !quiz.answered && !quiz.paused) {
    if (/^[1-4]$/.test(event.key) && question().format === "choice") {
      const index = Number(event.key) - 1;
      if (index < question().options.length && !quiz.hidden.includes(index)) {
        event.preventDefault();
        submitQuiz(question().options[index]);
      }
    } else if (["q", "w", "e"].includes(event.key.toLowerCase())) {
      event.preventDefault();
      usePower(["q", "w", "e"].indexOf(event.key.toLowerCase()));
    } else if (event.key === "Escape") {
      event.preventDefault();
      pauseQuiz();
    }
  }
});
document.addEventListener("dragover", (e) => {
  if (unlocked && e.target.closest("#drop-zone")) {
    e.preventDefault();
    $("#drop-zone").classList.add("drag");
  }
});
document.addEventListener("dragleave", (e) => {
  if (e.target.closest("#drop-zone")) $("#drop-zone")?.classList.remove("drag");
});
document.addEventListener("drop", (e) => {
  if (unlocked && e.target.closest("#drop-zone")) {
    e.preventDefault();
    $("#drop-zone").classList.remove("drag");
    processUploadedFile(e.dataTransfer.files[0]);
  }
});
$("#dialog").addEventListener("cancel", (e) => {
  e.preventDefault();
  closeDialog();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (view === "quiz" && !quiz?.answered) pauseQuiz();
    saveQuizDraft();
    flushStorage();
  }
});
window.addEventListener("pagehide", () => {
  saveQuizDraft();
  flushStorage();
  stopTimers();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
});
if (systemTheme.addEventListener)
  systemTheme.addEventListener("change", () => {
    if (store.settings.theme === "system") theme();
  });
function refreshVoices() {
  if (!("speechSynthesis" in window)) return;
  voices = speechSynthesis.getVoices();
  if (unlocked && ["library", "group", "hard", "flash"].includes(view))
    render();
}
load();
theme();
checkCapacity();
if ("speechSynthesis" in window) {
  voices = speechSynthesis.getVoices();
  speechSynthesis.addEventListener("voiceschanged", refreshVoices);
}
const remembered = readStorage(ACCESS_KEY);
if (remembered === ACCESS_HASH) {
  unlocked = true;
  $("#gate").hidden = true;
  $("#app").hidden = false;
  render();
} else $("#access-code").focus();
if (quotaFailure && unlocked) openStorage(true);
