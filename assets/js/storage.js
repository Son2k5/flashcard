/* Schema 3: chỉ lưu cấu trúc nguồn và trạng thái số; nhóm gộp luôn tính lại. */
const StorageModel = (() => {
  const schemaVersion = 3,
    metaKey = "la-vocab-v3",
    prefix = "la-vocab-v3:",
    limit = 5 * 1024 * 1024;
  const legacyKeys = ["la-vocab-v2", "la-flashcards-v1", "la-theme-v1"];
  const key = (kind, id) => prefix + kind + ":" + id;
  const belongs = (k) =>
    k === metaKey ||
    k.startsWith(prefix) ||
    legacyKeys.includes(k) ||
    k === "la-access-v2";
  const bytes = (k, v) => 2 * (k.length + String(v).length);
  const footprint = (entries) =>
    entries.reduce((n, [k, v]) => n + (belongs(k) ? bytes(k, v) : 0), 0);
  const isQuota = (e) =>
    !!e &&
    (e.name === "QuotaExceededError" ||
      e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      e.code === 22 ||
      e.code === 1014);
  // 3 = sao chưa học, 4 = sao + chưa thuộc, 5 = sao + đã thuộc.
  function packProgress(progress) {
    const out = {};
    for (const [id, p] of Object.entries(progress || {})) {
      const base = p.known === true ? 2 : p.known === false ? 1 : 0;
      const value = base + (p.starred ? 3 : 0);
      if (value) out[id] = value;
    }
    return out;
  }
  function unpackProgress(progress) {
    const out = {};
    for (const [id, value] of Object.entries(progress || {})) {
      if (!Number.isInteger(value) || value < 0 || value > 5)
        throw Error("Mã tiến độ không hợp lệ.");
      if (!value) continue;
      const base = value % 3;
      out[id] = { starred: value >= 3 };
      if (base) out[id].known = base === 2;
    }
    return out;
  }
  // 20 lượt gần nhất trên toàn bộ bộ từ, hợp với top 5 của từng tập chapter.
  function trimHistory(records = {}) {
    const groups = Object.entries(records).map(([scope, rows]) => [
      scope,
      Array.from(new Map(rows.map((r) => [r.id, r])).values()),
    ]);
    const recent = groups
      .flatMap(([scope, rows]) => rows.map((r) => ({ scope, r })))
      .sort(
        (a, b) =>
          b.r.date.localeCompare(a.r.date) || b.r.id.localeCompare(a.r.id),
      )
      .slice(0, 20);
    const keep = new Set(recent.map(({ scope, r }) => scope + "|" + r.id)),
      out = {};
    for (const [scope, rows] of groups) {
      for (const r of [...rows]
        .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))
        .slice(0, 5))
        keep.add(scope + "|" + r.id);
      const retained = rows
        .filter((r) => keep.has(scope + "|" + r.id))
        .sort((a, b) => b.date.localeCompare(a.date));
      if (retained.length) out[scope] = retained;
    }
    return out;
  }
  function cleanDeck(d) {
    const ids = new Set(Core.flatten(d.chapters).map((c) => c.id));
    d.progress = Object.fromEntries(
      Object.entries(d.progress || {}).filter(([id]) => ids.has(id)),
    );
    d.quizMemory = Object.fromEntries(
      Object.entries(d.quizMemory || {}).filter(([id]) => ids.has(id)),
    );
    d.records = trimHistory(d.records);
    return d;
  }
  function dataPart(d) {
    return {
      schemaVersion,
      ...(d.kind === "quiz" ? { kind: "quiz" } : {}),
      id: d.id,
      name: d.name,
      language: d.language,
      sourceName: d.sourceName,
      hasChapters: d.hasChapters,
      organization: { ...d.organization },
      chapters: d.chapters.map((c) => ({
        id: c.id,
        name: c.name,
        sections: c.sections.map((s) => ({
          id: s.id,
          name: s.name,
          cards: s.cards.map((t) => ({
            ...(t.options ? { options: [...t.options], answer: t.answer } : {}),
            id: t.id,
            word: t.word,
            meaning: t.meaning,
            pos: t.pos,
            note: t.note,
            originalWord: t.originalWord ?? t.word,
          })),
        })),
      })),
    };
  }
  function statsPart(d) {
    return {
      schemaVersion,
      activity: d.activity,
      quizMemory: d.quizMemory,
      records: trimHistory(d.records),
    };
  }
  const metaPart = (s) => ({
    app: "la-vocab",
    schemaVersion,
    decks: s.decks.map((d) => d.id),
    activeDeckId: s.activeDeckId,
    settings: s.settings,
  });
  function snapshot(s) {
    const entries = [];
    for (const d of s.decks) {
      entries.push(
        [key("data", d.id), JSON.stringify(dataPart(d))],
        [key("progress", d.id), JSON.stringify(packProgress(d.progress))],
        [key("stats", d.id), JSON.stringify(statsPart(d))],
      );
    }
    entries.push([metaKey, JSON.stringify(metaPart(s))]);
    return entries;
  }
  function legacyV1(old) {
    if (!old?.data?.chapters) throw Error("Dữ liệu cũ không hợp lệ.");
    const progress = {};
    const chapters = old.data.chapters.map((c, ci) => ({
      id: "c" + Core.hash(c.name + ci),
      name: c.name,
      sections: c.sections.map((s, si) => ({
        id: "s" + Core.hash(c.name + ci + s.name + si),
        name: s.name,
        cards: s.cards.map((t) => {
          const id = Core.cardId(t.word, t.meaning),
            p = old.progress?.[t.id];
          if (p) {
            const prev = progress[id] || {};
            progress[id] = {
              known: prev.known === true || p.known === true,
              starred: prev.starred === true || p.starred === true,
            };
          }
          return {
            id,
            word: t.word,
            meaning: t.meaning,
            pos: t.partOfSpeech || "",
            originalWord: t.originalWord || t.word,
            note: "",
          };
        }),
      })),
    }));
    const id = "legacy-" + Core.hash(old.data.fileName || "Word");
    return {
      app: "la-vocab",
      version: 2,
      decks: [
        {
          id,
          name: (old.data.fileName || "Bộ từ cũ").replace(/\.docx$/i, ""),
          sourceName: old.data.fileName || "",
          language: "en-US",
          hasChapters: true,
          chapters,
          organization: { mode: "split", dedupe: false },
          progress,
          activity: old.activity || [],
          records: {},
          quizMemory: {},
        },
      ],
      activeDeckId: id,
      settings: { theme: "system", sound: false },
    };
  }
  function migrate(value) {
    let source = value;
    if (value?.version === 1 && value.data) source = legacyV1(value);
    else if (value?.schemaVersion === 3) {
      if (value.app !== "la-vocab" || !Array.isArray(value.decks))
        throw Error("Bản sao lưu schema 3 không hợp lệ.");
      source = {
        ...value,
        version: 2,
        decks: value.decks.map((d) => ({
          ...d,
          progress: unpackProgress(d.progress),
        })),
      };
    } else if (value?.schemaVersion !== undefined && value.schemaVersion !== 2)
      throw Error("Phiên bản lưu trữ chưa được hỗ trợ.");
    const valid = Core.validateBackup(source);
    valid.schemaVersion = 3;
    valid.decks.forEach(cleanDeck);
    return valid;
  }
  function backup(s) {
    return {
      app: "la-vocab",
      schemaVersion,
      activeDeckId: s.activeDeckId,
      settings: { ...s.settings },
      decks: s.decks.map((d) => ({
        ...dataPart(d),
        ...statsPart(d),
        progress: packProgress(d.progress),
      })),
    };
  }
  function read(storage) {
    const raw = storage.getItem(metaKey);
    if (!raw) return null;
    const meta = JSON.parse(raw);
    if (
      meta.schemaVersion !== 3 ||
      meta.app !== "la-vocab" ||
      !Array.isArray(meta.decks) ||
      meta.decks.some(
        (id) => typeof id !== "string" || !/^[a-zA-Z0-9:_-]{1,100}$/.test(id),
      )
    )
      throw Error("Danh mục bộ từ không hợp lệ.");
    const decks = meta.decks.map((id) => {
      const data = JSON.parse(storage.getItem(key("data", id)) || "null");
      if (!data || data.schemaVersion !== 3 || data.id !== id)
        throw Error("Thiếu dữ liệu bộ từ. Hãy khôi phục bản sao lưu.");
      const stats = JSON.parse(storage.getItem(key("stats", id)) || "{}");
      if (stats.schemaVersion !== undefined && stats.schemaVersion !== 3)
        throw Error("Phiên bản thống kê không hợp lệ.");
      return {
        ...data,
        activity: stats.activity || [],
        records: stats.records || {},
        quizMemory: stats.quizMemory || {},
        progress: JSON.parse(storage.getItem(key("progress", id)) || "{}"),
      };
    });
    return migrate({ ...meta, decks });
  }
  function scan(storage) {
    try {
      const entries = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && belongs(k)) {
          const v = storage.getItem(k);
          if (v !== null) entries.push([k, v]);
        }
      }
      return { entries, total: footprint(entries), error: null };
    } catch (error) {
      return { entries: [], total: 0, error };
    }
  }
  // localStorage.setItem là nguyên tử theo từng khóa. Nếu cả đợt lỗi, trả các khóa đã ghi về giá trị cũ.
  function transaction(storage, entries) {
    const old = new Map(),
      sizes = new Map(),
      written = [];
    try {
      for (const [k, v] of entries) {
        const before = storage.getItem(k);
        if (before === v) continue;
        old.set(k, before);
        sizes.set(k, v.length);
        storage.setItem(k, v);
        written.push(k);
      }
      return { ok: true, writes: written.length };
    } catch (error) {
      const rollbackErrors = [];
      const delta = (k) =>
        old.get(k) === null ? -Infinity : old.get(k).length - sizes.get(k);
      const rollback = written.sort((a, b) => delta(a) - delta(b));
      for (const k of rollback) {
        try {
          const prior = old.get(k);
          if (prior === null) storage.removeItem(k);
          else storage.setItem(k, prior);
        } catch (e) {
          rollbackErrors.push(e);
        }
      }
      return { ok: false, error, rollbackErrors };
    }
  }
  function createWriter({
    storage,
    onError = () => {},
    onSaved = () => {},
    delay = 500,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  }) {
    const jobs = new Map();
    let timer = null;
    function cancelTimer() {
      if (timer !== null) clearTimer(timer);
      timer = null;
    }
    function flush() {
      cancelTimer();
      if (!jobs.size) return true;
      let entries;
      try {
        entries = Array.from(jobs, ([k, get]) => [k, get()]).sort(
          (a, b) => Number(a[0] === metaKey) - Number(b[0] === metaKey),
        );
      } catch (error) {
        onError(error);
        return false;
      }
      const result = transaction(storage, entries);
      if (!result.ok) {
        onError(result.error, result.rollbackErrors);
        return false;
      }
      jobs.clear();
      onSaved(result);
      return true;
    }
    function put(k, get) {
      jobs.set(k, get);
      cancelTimer();
      timer = setTimer(flush, delay);
    }
    function discard(keys) {
      for (const k of keys) jobs.delete(k);
      if (!jobs.size) cancelTimer();
    }
    function clear() {
      jobs.clear();
      cancelTimer();
    }
    return {
      put,
      flush,
      discard,
      clear,
      get pending() {
        return jobs.size;
      },
    };
  }
  return {
    schemaVersion,
    metaKey,
    prefix,
    legacyKeys,
    limit,
    key,
    belongs,
    bytes,
    footprint,
    isQuota,
    packProgress,
    unpackProgress,
    trimHistory,
    cleanDeck,
    dataPart,
    statsPart,
    metaPart,
    snapshot,
    migrate,
    backup,
    read,
    scan,
    transaction,
    createWriter,
  };
})();
