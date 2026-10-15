/* Các hàm dữ liệu thuần, dùng chung cho trình duyệt và test Node. */
const Core = (() => {
  const normalize = (s) =>
    String(s).normalize("NFC").trim().replace(/\s+/gu, " ").toLowerCase();
  // Hash 128 bit xác định từ nội dung; không phụ thuộc vị trí trong tài liệu.
  function hash(text) {
    let a = 1779033703,
      b = 3144134277,
      c = 1013904242,
      d = 2773480762;
    for (let i = 0; i < text.length; i++) {
      const k = text.charCodeAt(i);
      a = b ^ Math.imul(a ^ k, 597399067);
      b = c ^ Math.imul(b ^ k, 2869860233);
      c = d ^ Math.imul(c ^ k, 951274213);
      d = a ^ Math.imul(d ^ k, 2716044179);
    }
    a = Math.imul(c ^ (a >>> 18), 597399067);
    b = Math.imul(d ^ (b >>> 22), 2869860233);
    c = Math.imul(a ^ (c >>> 17), 951274213);
    d = Math.imul(b ^ (d >>> 19), 2716044179);
    return [a ^ b ^ c ^ d, b ^ a, c ^ a, d ^ a]
      .map((n) => (n >>> 0).toString(16).padStart(8, "0"))
      .join("");
  }
  const cardId = (word, meaning) =>
    "t" + hash(JSON.stringify([normalize(word), normalize(meaning)]));
  function splitWord(raw) {
    let word = raw,
      pos = "",
      m;
    const re =
      /^\s*(\((?:n|v|adj|adv|prep|pron|conj|interj|det|art|aux|num|phr|phrase|phrasal\s+v|n\/v)\.?\))/i;
    while ((m = word.match(re))) {
      pos += m[1];
      word = word.slice(m[0].length);
    }
    return { word: pos ? word.trim() : raw, pos, originalWord: raw };
  }
  function textOf(node) {
    if (node.nodeType === 3) return node.nodeValue;
    if (node.nodeType !== 1) return "";
    if (node.tagName === "BR") return "\n";
    return (
      Array.from(node.childNodes).map(textOf).join("") +
      (["P", "DIV", "LI"].includes(node.tagName) ? "\n" : "")
    );
  }
  function parse(html, fileName = "Bộ từ.docx") {
    // Tránh thẻ đóng trang dạng thô bị công cụ xem trước chèn script vào giữa chuỗi JS.
    const root = new DOMParser().parseFromString(
      "\x3c!doctype html>\x3chtml>\x3cbody>" + html + "\x3c/body>\x3c/html>",
      "text/html",
    ).body;
    const chapters = [],
      warnings = [];
    let chapter = null,
      section = null,
      count = 0,
      tableNum = 0;
    const hasChapters = !!root.querySelector("h2");
    const names = new Map();
    function newChapter(name) {
      const norm = normalize(name),
        occurrence = names.get(norm) || 0;
      names.set(norm, occurrence + 1);
      chapter = { id: "c" + hash(norm + "|" + occurrence), name, sections: [] };
      chapters.push(chapter);
      section = null;
    }
    function newSection(name) {
      const n = chapter.sections.filter(
        (s) => normalize(s.name) === normalize(name),
      ).length;
      section = {
        id: "s" + hash(chapter.id + "|" + normalize(name) + "|" + n),
        name,
        cards: [],
      };
      chapter.sections.push(section);
    }
    function addCard(raw, meaning, note = "") {
      const parts = splitWord(raw),
        definition = splitWord(meaning);
      if (!parts.word || !definition.word) return false;
      if (!chapter) newChapter("Tất cả");
      if (!section) newSection("Từ vựng chung");
      const pos = parts.pos || definition.pos;
      section.cards.push({
        id: cardId(parts.word, definition.word),
        ...parts,
        pos,
        meaning: definition.word,
        note,
      });
      count++;
      return true;
    }
    function addVocabulary(raw, meaning, note = "") {
      const words = raw.split(/\s*(?:><|<>|≠|↔)\s*/),
        meanings = meaning.split(/\s*(?:><|<>|≠|↔)\s*/);
      if (
        words.length === 2 &&
        meanings.length === 2 &&
        words.every(Boolean) &&
        meanings.every(Boolean)
      ) {
        words.forEach((word, i) =>
          addCard(
            word,
            meanings[i],
            [note, "Đối nghĩa: " + words[1 - i] + " — " + meanings[1 - i]]
              .filter(Boolean)
              .join("\n"),
          ),
        );
        return true;
      }
      if (words.length > 1 || meanings.length > 1)
        warnings.push(
          "Cặp đối nghĩa chưa có đủ hai từ và hai nghĩa tương ứng; giữ nguyên để bạn kiểm tra: " +
            raw +
            ": " +
            meaning,
        );
      return addCard(raw, meaning, note);
    }
    function entry(line) {
      const match = line
        .trim()
        .replace(/^(?:[•●▪*–-]\s+|\d+[.)]\s*)/, "")
        .match(/^([^:：]+)[:：]\s*(.+)$/);
      if (!match) return null;
      let word = match[1].trim(),
        meaning = match[2].trim();
      // Word commonly places the part of speech after the vocabulary.
      const suffix = word.match(/\s*(\([^()]+\))\s*$/);
      if (suffix && splitWord(suffix[1]).pos)
        word = suffix[1] + " " + word.slice(0, suffix.index).trim();
      return word && meaning && splitWord(word).word && splitWord(meaning).word
        ? { word, meaning }
        : null;
    }
    function addLine(line) {
      const halves = line.split(/\s*(?:><|<>|≠|↔)\s*/);
      const pair = halves.length === 2 ? halves.map(entry) : [];
      if (pair.length === 2 && pair.every(Boolean)) {
        pair.forEach((item, i) =>
          addCard(
            item.word,
            item.meaning,
            "Đối nghĩa: " +
              splitWord(pair[1 - i].word).word +
              " — " +
              splitWord(pair[1 - i].meaning).word,
          ),
        );
        return true;
      }
      const item = entry(line);
      if (item) return addVocabulary(item.word, item.meaning);
      if (/[:：]|><|<>|≠|↔/.test(line))
        warnings.push("Dòng chưa đủ từ và nghĩa, đã bỏ qua: " + line);
      return false;
    }
    const headers = [
      ["từ", "nghĩa"],
      ["từ vựng", "nghĩa"],
      ["word", "meaning"],
      ["words", "meanings"],
      ["cụm", "viết tắt"],
      ["cụm từ", "viết tắt"],
      ["単語", "意味"],
      ["단어", "뜻"],
      ["词语", "意思"],
    ];
    for (const node of Array.from(root.children)) {
      const text = textOf(node).trim();
      if (node.tagName === "H2") {
        newChapter(text || "Chapter chưa đặt tên");
        continue;
      }
      if (node.tagName !== "TABLE") {
        if (node.matches("p,ul,ol,div") && (chapter || !hasChapters)) {
          const lines = text
            .split(/\n/)
            .map((line) => line.trim())
            .filter(Boolean);
          if (lines.reduce((found, line) => addLine(line) || found, false))
            continue;
        }
        const bold =
          node.matches("p") &&
          node.querySelector("strong,b") &&
          Array.from(node.querySelectorAll("strong,b"))
            .filter((b) => !b.parentElement.closest("strong,b"))
            .map((b) => b.textContent)
            .join("")
            .trim() === node.textContent.trim();
        if (
          text &&
          (bold || node.matches("h3,h4")) &&
          (chapter || !hasChapters)
        ) {
          if (!chapter) newChapter("Tất cả");
          newSection(text);
        }
        continue;
      }
      if (!chapter) newChapter("Tất cả");
      tableNum++;
      const rows = Array.from(node.querySelectorAll("tr")).filter(
        (r) => r.closest("table") === node,
      );
      let usable = 0;
      rows.forEach((row, index) => {
        const cells = Array.from(row.children).filter((c) =>
            ["TD", "TH"].includes(c.tagName),
          ),
          values = cells.map((c) => textOf(c).trim());
        if (values.every((v) => !v)) return;
        if (
          cells.length < 2 ||
          cells.some(
            (c) =>
              Number(c.getAttribute("colspan") || 1) !== 1 ||
              Number(c.getAttribute("rowspan") || 1) !== 1 ||
              c.querySelector("table"),
          )
        ) {
          warnings.push(
            `${chapter.name}, bảng ${tableNum}, dòng ${index + 1}: cần ít nhất 2 ô độc lập, không gộp ô; đã bỏ qua.`,
          );
          return;
        }
        if (
          headers.some(
            ([w, m]) =>
              normalize(values[0]) === w && normalize(values[1]) === m,
          )
        )
          return;
        if (!values[0] || !values[1]) {
          warnings.push(
            `${chapter.name}, bảng ${tableNum}, dòng ${index + 1}: thiếu từ hoặc nghĩa; đã bỏ qua.`,
          );
          return;
        }
        const parts = splitWord(values[0]);
        if (!parts.word) {
          warnings.push(
            `Bảng ${tableNum}, dòng ${index + 1}: thiếu từ sau tiền tố loại từ.`,
          );
          return;
        }
        if (
          addVocabulary(
            values[0],
            values[1],
            values.slice(2).filter(Boolean).join("\n\n"),
          )
        )
          usable++;
      });
      if (!usable)
        warnings.push(`Bảng ${tableNum}: không có dòng từ vựng hợp lệ.`);
    }
    const valid = chapters
      .map((c) => ({
        ...c,
        sections: c.sections.filter((s) => s.cards.length),
      }))
      .filter((c) => c.sections.length);
    if (!count)
      throw Error(
        "File không có bảng hoặc dòng từ vựng hợp lệ; bảng sai định dạng cần có từ và nghĩa ở hai ô đầu, không gộp ô. Có thể viết mỗi dòng như tools: (n) công cụ hoặc hot: nóng >< cold: lạnh.",
      );
    return {
      name: fileName.replace(/\.docx$/i, ""),
      sourceName: fileName,
      hasChapters,
      chapters: valid,
      warnings,
    };
  }
  function normalizePos(raw) {
    if (!raw) return "";
    let p = String(raw).trim();
    if (!p) return "";
    if (/^\(.*\)$/.test(p)) return p;
    const map = {
      "động từ": "(v)",
      "verb": "(v)",
      "v": "(v)",
      "danh từ": "(n)",
      "noun": "(n)",
      "n": "(n)",
      "tính từ": "(adj)",
      "adjective": "(adj)",
      "adj": "(adj)",
      "trạng từ": "(adv)",
      "phó từ": "(adv)",
      "adverb": "(adv)",
      "adv": "(adv)",
      "giới từ": "(prep)",
      "preposition": "(prep)",
      "prep": "(prep)",
      "đại từ": "(pron)",
      "pronoun": "(pron)",
      "pron": "(pron)",
      "liên từ": "(conj)",
      "conjunction": "(conj)",
      "conj": "(conj)",
      "thán từ": "(interj)",
      "interjection": "(interj)",
      "interj": "(interj)",
      "cụm từ": "(phr)",
      "cụm": "(phr)",
      "phrase": "(phr)",
      "phr": "(phr)",
      "thành ngữ": "(idiom)",
      "idiom": "(idiom)",
      "n/v": "(n/v)",
      "v/n": "(n/v)",
    };
    const lower = p.toLowerCase();
    if (map[lower]) return map[lower];
    if (/[,/]/.test(p)) {
      const parts = p.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
      return parts
        .map((part) => map[part.toLowerCase()] || `(${part})`)
        .join(" ");
    }
    return `(${p})`;
  }
  function parseCsv(text) {
    if (!text) return [];
    const firstLine = text.split(/\r?\n/)[0] || "";
    let delimiter = ",";
    const commas = (firstLine.match(/,/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;
    const semis = (firstLine.match(/;/g) || []).length;
    if (tabs > commas && tabs > semis) delimiter = "\t";
    else if (semis > commas && semis > tabs) delimiter = ";";

    const rows = [];
    let row = [];
    let curr = "";
    let inQuotes = false;
    let i = 0;
    while (i < text.length) {
      const char = text[i];
      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') {
            curr += '"';
            i += 2;
            continue;
          } else {
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          curr += char;
          i++;
          continue;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
          i++;
          continue;
        } else if (char === delimiter) {
          row.push(curr.trim());
          curr = "";
          i++;
          continue;
        } else if (char === "\r") {
          if (i + 1 < text.length && text[i + 1] === "\n") i++;
          row.push(curr.trim());
          curr = "";
          rows.push(row);
          row = [];
          i++;
          continue;
        } else if (char === "\n") {
          row.push(curr.trim());
          curr = "";
          rows.push(row);
          row = [];
          i++;
          continue;
        } else {
          curr += char;
          i++;
          continue;
        }
      }
    }
    if (curr.length > 0 || row.length > 0) {
      row.push(curr.trim());
      rows.push(row);
    }
    return rows.filter((r) => r.some((cell) => cell.length > 0));
  }
  function detectSpreadsheetColumns(headerRow, sampleRows = []) {
    let colStt = -1,
      colWord = -1,
      colPos = -1,
      colMeaning = -1,
      colExample = -1;

    const normH = (s) => normalize(s).replace(/[:：]/g, "");

    if (headerRow && headerRow.length >= 2) {
      headerRow.forEach((h, idx) => {
        const norm = normH(h);
        if (/^(stt|no|no\.|số\s*thứ\s*tự|#|index|order|id)$/i.test(norm)) {
          colStt = idx;
        } else if (
          /^(từ\s*vựng|từ|word|words|vocabulary|vocab|term|tiếng\s*anh|thuật\s*ngữ)$/i.test(
            norm,
          )
        ) {
          colWord = idx;
        } else if (
          /^(dạng\s*từ|loại\s*từ|từ\s*loại|pos|part\s*of\s*speech|type|form|word\s*class)$/i.test(
            norm,
          )
        ) {
          colPos = idx;
        } else if (
          /^(nghĩa|ý\s*nghĩa|meaning|meanings|definition|dịch|tiếng\s*việt|nghĩa\s*tiếng\s*việt|giải\s*thích)$/i.test(
            norm,
          )
        ) {
          colMeaning = idx;
        } else if (
          /^(ví\s*dụ|câu\s*ví\s*dụ|example|examples|sentence|sentences|ghi\s*chú|note|notes|câu)$/i.test(
            norm,
          )
        ) {
          colExample = idx;
        }
      });
    }

    const hasDetectedHeaders = colWord !== -1 && colMeaning !== -1;
    if (!hasDetectedHeaders) {
      const allRows = [headerRow, ...sampleRows].filter(Boolean);
      const maxCols = Math.max(0, ...allRows.map((r) => r.length));
      const isCol0Numeric =
        sampleRows.length > 0 &&
        sampleRows
          .slice(0, 5)
          .every((r) => /^\d+$/.test((r[0] || "").trim()));

      if (maxCols >= 5) {
        if (isCol0Numeric) {
          colStt = 0;
          colWord = 1;
          colPos = 2;
          colMeaning = 3;
          colExample = 4;
        } else {
          colWord = 0;
          colPos = 1;
          colMeaning = 2;
          colExample = 3;
        }
      } else if (maxCols === 4) {
        if (isCol0Numeric) {
          colStt = 0;
          colWord = 1;
          colMeaning = 2;
          colExample = 3;
        } else {
          colWord = 0;
          colPos = 1;
          colMeaning = 2;
          colExample = 3;
        }
      } else if (maxCols === 3) {
        colWord = 0;
        colMeaning = 1;
        colExample = 2;
      } else {
        colWord = 0;
        colMeaning = 1;
      }
    }

    return {
      colStt,
      colWord,
      colPos,
      colMeaning,
      colExample,
      hasDetectedHeaders,
    };
  }
  function parseSpreadsheet(sheets, fileName = "Từ vựng.xlsx") {
    const chapters = [],
      warnings = [];
    let count = 0;
    const names = new Map();

    const cleanBaseName =
      fileName.replace(/\.(xlsx|xls|csv)$/i, "") || "Bộ từ vựng";
    const multiSheets = sheets.length > 1;

    for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
      const sheet = sheets[sIdx];
      const sheetName = (sheet.name || `Sheet${sIdx + 1}`).trim();
      const rawRows = (sheet.rows || []).filter(
        (r) => r && r.some((c) => String(c).trim().length > 0),
      );
      if (!rawRows.length) continue;

      let headerRowIndex = -1;
      let detected = null;
      const searchLimit = Math.min(rawRows.length, 10);
      for (let i = 0; i < searchLimit; i++) {
        const det = detectSpreadsheetColumns(
          rawRows[i],
          rawRows.slice(i + 1, i + 6),
        );
        if (det.hasDetectedHeaders) {
          headerRowIndex = i;
          detected = det;
          break;
        }
      }

      if (headerRowIndex === -1) {
        detected = detectSpreadsheetColumns(null, rawRows.slice(0, 5));
        headerRowIndex = -1;
      }

      const { colWord, colPos, colMeaning, colExample } = detected;
      if (colWord === -1 || colMeaning === -1) {
        warnings.push(
          `Sheet "${sheetName}": không tìm thấy cột Từ vựng hoặc Nghĩa.`,
        );
        continue;
      }

      const chapterName = multiSheets ? sheetName : cleanBaseName;
      const normChapter = normalize(chapterName);
      const occurrence = names.get(normChapter) || 0;
      names.set(normChapter, occurrence + 1);

      const chapter = {
        id: "c" + hash(normChapter + "|" + occurrence),
        name: chapterName,
        sections: [],
      };

      const sectionName = multiSheets
        ? "Từ vựng"
        : /^sheet\s*\d+$/i.test(sheetName)
          ? "Từ vựng chung"
          : sheetName;
      const section = {
        id: "s" + hash(chapter.id + "|" + normalize(sectionName) + "|0"),
        name: sectionName,
        cards: [],
      };
      chapter.sections.push(section);

      function addSpreadsheetCard(rawWord, rawPos, rawMeaning, rawExample) {
        const split = splitWord(rawWord);
        const defSplit = splitWord(rawMeaning);
        const cleanWord = split.word;
        const cleanMeaning = defSplit.word;
        if (!cleanWord || !cleanMeaning) return false;

        const posVal = rawPos
          ? normalizePos(rawPos)
          : split.pos || defSplit.pos;
        const note = rawExample ? String(rawExample).trim() : "";

        const words = cleanWord.split(/\s*(?:><|<>|≠|↔)\s*/);
        const meanings = cleanMeaning.split(/\s*(?:><|<>|≠|↔)\s*/);
        if (
          words.length === 2 &&
          meanings.length === 2 &&
          words.every(Boolean) &&
          meanings.every(Boolean)
        ) {
          words.forEach((w, idx) => {
            const cPos = posVal;
            section.cards.push({
              id: cardId(w, meanings[idx]),
              word: w,
              pos: cPos,
              meaning: meanings[idx],
              note: [
                note,
                "Đối nghĩa: " + words[1 - idx] + " — " + meanings[1 - idx],
              ]
                .filter(Boolean)
                .join("\n"),
              originalWord: cPos ? `${cPos} ${w}` : w,
            });
            count++;
          });
          return true;
        }

        const cPos = posVal || "";
        section.cards.push({
          id: cardId(cleanWord, cleanMeaning),
          word: cleanWord,
          pos: cPos,
          meaning: cleanMeaning,
          note,
          originalWord: cPos ? `${cPos} ${cleanWord}` : cleanWord,
        });
        count++;
        return true;
      }

      const startIdx = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
      for (let rIdx = startIdx; rIdx < rawRows.length; rIdx++) {
        const row = rawRows[rIdx];
        const rowDisplayNum = rIdx + 1;
        const rawW = String(
          colWord >= 0 && row[colWord] != null ? row[colWord] : "",
        ).trim();
        const rawP = String(
          colPos >= 0 && row[colPos] != null ? row[colPos] : "",
        ).trim();
        const rawM = String(
          colMeaning >= 0 && row[colMeaning] != null ? row[colMeaning] : "",
        ).trim();
        const rawE = String(
          colExample >= 0 && row[colExample] != null ? row[colExample] : "",
        ).trim();

        if (!rawW && !rawM) continue;

        if (!rawW || !rawM) {
          warnings.push(
            `Sheet "${sheetName}", dòng ${rowDisplayNum}: thiếu từ vựng hoặc nghĩa; đã bỏ qua.`,
          );
          continue;
        }

        addSpreadsheetCard(rawW, rawP, rawM, rawE);
      }

      if (section.cards.length > 0) {
        chapters.push(chapter);
      } else {
        warnings.push(
          `Sheet "${sheetName}": không có dòng từ vựng hợp lệ nào.`,
        );
      }
    }

    if (!count) {
      throw Error(
        "File Excel không có dòng từ vựng hợp lệ. Bảng cần có các cột Từ vựng, Dạng từ, Nghĩa, Ví dụ (hoặc Từ và Nghĩa).",
      );
    }

    return {
      name: cleanBaseName,
      sourceName: fileName,
      hasChapters: chapters.length > 1,
      chapters,
      warnings,
    };
  }
  const questionId = (word, options, answer) =>
    "q" +
    hash(JSON.stringify([normalize(word), options.map(normalize), answer]));
  function quizLines(html) {
    const root = new DOMParser().parseFromString(
        "\x3chtml>\x3cbody>" + html + "\x3c/body>\x3c/html>",
        "text/html",
      ).body,
      lines = [];
    let runs = [];
    const flush = () => {
      if (runs.some((r) => r.text.trim())) lines.push(runs);
      runs = [];
    };
    function isMark(n) {
      if (n.nodeType !== 1) return false;
      if (["STRONG", "B", "MARK", "U"].includes(n.tagName)) return true;
      const s = (n.getAttribute("style") || "").toLowerCase();
      if (s) {
        if (/color\s*:\s*(?!black|#000000|#000|rgba?\(0,\s*0,\s*0\))/i.test(s))
          return true;
        if (
          /background(?:-color)?\s*:\s*(?!none|transparent|white|#ffffff|#fff)/i.test(
            s,
          )
        )
          return true;
      }
      const c = (n.getAttribute("color") || "").toLowerCase();
      if (c && !["black", "#000000", "#000"].includes(c)) return true;
      return false;
    }
    function walk(node, bold = false) {
      if (node.nodeType === 3) {
        runs.push({ text: node.nodeValue, bold });
        return;
      }
      if (node.nodeType !== 1) return;
      const block = ["P", "DIV", "LI", "H1", "H2", "H3", "TR", "TD"].includes(
        node.tagName,
      );
      if (block) flush();
      if (node.tagName === "BR") {
        flush();
        return;
      }
      const marked = bold || isMark(node);
      for (const child of node.childNodes) walk(child, marked);
      if (block) flush();
    }
    walk(root);
    flush();
    return lines;
  }
  function parseQuestions(lines, fileName) {
    // Retain formatting offsets: Word often splits one answer across runs.
    const sliceRuns = (runs, begin) => {
      let offset = 0;
      return runs.map(r => {
        const text = r.text.slice(Math.max(0, begin - offset));
        offset += r.text.length;
        return {...r, text};
      }).filter(r=>r.text);
    };
    function readMarkedShortAnswer(q) {
      const runs=q.shortRuns || [];
      delete q.shortRuns;
      const text=runs.map(r=>r.text).join('');
      const spans=[];
      let offset=0;
      for (const r of runs) {
        const end=offset+r.text.length;
        if ((r.bold || r.highlight || r.colored || r.yellowBg) && /[^\s_]/u.test(r.text)) {
          const last=spans[spans.length-1];
          if (last && /^[\s_]*$/u.test(text.slice(last.end,offset))) last.end=end;
          else spans.push({start:offset,end});
        }
        offset=end;
      }
      for (const span of spans) {
        const raw=text.slice(span.start,span.end);
        const leading=raw.match(/^[\s_]+/u)?.[0].length || 0;
        const trailing=raw.match(/[\s_]+$/u)?.[0].length || 0;
        span.start+=leading;span.end-=trailing;
        span.answer=text.slice(span.start,span.end).replace(/\s+/gu,' ').trim();
      }
      // A fully bold prompt is a heading/style, not an answer. Multiple
      // separated marks need review unless an explicit answer disambiguates.
      const candidates=spans.filter(s=>s.answer && /[\p{L}\p{N}]/u.test(text.slice(0,s.start)+text.slice(s.end)));
      const chosen=q.answer ? candidates.filter(s=>normalize(s.answer)===normalize(q.answer)) : candidates;
      if (chosen.length!==1) return;
      const span=chosen[0];
      if (!q.answer) q.answer=span.answer;
      q.word=(text.slice(0,span.start)+'__________'+text.slice(span.end)).replace(/_{2,}/g,'__________').trim();
    }
    const questions = [],
      warnings = [];
    let current = null,
      active = null, sectionType = 'multiple-choice', chapter = '', tfRuns = [];
    for (const runs of lines) {
      const text = runs.map((r) => r.text).join("");
      if (!text.trim()) continue;
      const heading = text.trim().replace(/[:：]\s*$/, '');
      let nextType = null;
      if (/^(?:TRUE\s*[/–-]\s*FALSE(?:\s+QUESTIONS)?|ĐÚNG\s*[/–-]\s*SAI)$/iu.test(heading)) nextType = 'true-false';
      if (/^(?:SHORT\s+ANS(?:WER)?(?:\s+QUESTIONS)?|CÂU HỎI TRẢ LỜI NGẮN|TRẢ LỜI NGẮN)$/iu.test(heading)) nextType = 'short-answer';
      if (/^(?:MULTIPLE\s+CHOICE(?:\s+QUESTIONS)?|TRẮC NGHIỆM)$/iu.test(heading)) nextType = 'multiple-choice';
      if (nextType || /^(?:Chapter|Chương)\s+\d+\b/iu.test(heading)) {
        if (nextType) sectionType = nextType;
        else { chapter = heading; sectionType = 'multiple-choice'; }
        current = null; active = null; tfRuns = []; continue;
      }
      if (sectionType === 'true-false' && /^\s*(?:T\s*F|T|F)\s*$/i.test(text)) {
        tfRuns.push(...runs); continue;
      }
      const tfPrefix = text.match(/^\s*T\s*F\s*(?=\d+[.)])/i);
      let start = text.match(
        /^\s*(?:T\s*F\s*)?(?:C[âa]u\s*\d+\s*[:.)-]?|Question\s*\d+\s*[:.)-]?|\d+[.)])\s*([\s\S]*)$/iu,
      );
      // Some Word files place the next number inside its sentence. Recover only
      // the next sequential number beside a blank, and ask for review.
      const displaced = !start && sectionType === 'short-answer' && current &&
        text.match(/^(.*_.*\s)(\d+)\)\s*(_.*)$/u);
      if (displaced && Number(displaced[2]) === current.number + 1) {
        start = [text, displaced[1] + displaced[3]];
        warnings.push('Câu ' + displaced[2] + ': số thứ tự nằm giữa câu; hãy kiểm tra nội dung trước khi lưu.');
      }
      if (start) {
        current = {
          word: start[1],
          options: [],
          answer: null,
          note: "",
          issues: [],
          type: tfPrefix ? 'true-false' : sectionType,
          chapter,
          number: displaced ? Number(displaced[2]) : Number(text.match(/\d+/)?.[0]),
        };
        if (current.type === 'short-answer') {
          current.shortRuns = sliceRuns(runs,text.length-start[1].length);
          if (displaced) {
            const leftEnd=displaced[1].length, rightStart=leftEnd+displaced[2].length+1;
            let offset=0;
            const left=runs.map(r=>{
              const part={...r,text:r.text.slice(0,Math.max(0,leftEnd-offset))};
              offset+=r.text.length;return part;
            });
            current.shortRuns=[...left,...sliceRuns(runs,rightStart)];
          }
        }
        if (current.type === 'true-false') {
          let offset = 0;
          const marks = new Set();
          const prefixRuns = tfPrefix ? runs : tfRuns;
          const limit = tfPrefix ? tfPrefix[0].length : Infinity;
          for (const r of prefixRuns) {
            const part = r.text.slice(0, Math.max(0, limit - offset));
            if (r.bold) for (const m of part.matchAll(/[TF]/gi)) marks.add(m[0].toUpperCase());
            offset += r.text.length;
          }
          current.options = [{label:'T', text:'True', bold:marks.has('T')}, {label:'F', text:'False', bold:marks.has('F')}];
        }
        tfRuns = [];
        questions.push(current);
        active = null;
        continue;
      }
      if (!current) continue;
      const explicit = text.match(/^\s*(?:Đáp án|Answer|Ans)\s*[:：]\s*(.+)$/iu);
      if (explicit) {
        let value = explicit[1].trim();
        if (current.type === 'true-false') {
          value = /^(?:T|True|Đúng)\.?$/iu.test(value) ? 'T' : /^(?:F|False|Sai)\.?$/iu.test(value) ? 'F' : '';
        } else if (current.type === 'multiple-choice') value = value.match(/^([A-D])(?:[.)\s]|$)/i)?.[1].toUpperCase() || '';
        current.answer = value || null;
        active = null; continue;
      }
      const explanation = text.match(
        /^\s*(?:Giải thích|Lời giải)\s*:\s*(.*)$/iu,
      );
      if (explanation) {
        current.note += explanation[1];
        active = "note";
        continue;
      }
      const matches = [...text.matchAll(/(?:^|\s)([A-D])[.)：:]\s*/gi)];
      if (matches.length && current.type === 'multiple-choice') {
        for (let i = 0; i < matches.length; i++) {
          const m = matches[i],
            begin = m.index,
            end = matches[i + 1]?.index ?? text.length;
          const label = m[1].toUpperCase(),
            body = text.slice(begin + m[0].length, end).trim();
          let offset = 0,
            bold = false;
          for (const run of runs) {
            const left = offset;
            offset += run.text.length;
            if (
              run.bold &&
              run.text
                .slice(
                  Math.max(0, begin - left),
                  Math.max(0, Math.min(run.text.length, end - left)),
                )
                .trim()
            )
              bold = true;
          }
          if (current.options.some((o) => o.label === label))
            current.issues.push("Lặp lựa chọn " + label);
          current.options.push({ label, text: body, bold });
          active = current.options.length - 1;
        }
        continue;
      }
      if (active === "note") current.note += "\n" + text.trim();
      else if (typeof active === "number") {
        current.options[active].text += "\n" + text.trim();
        if (runs.some((r) => r.bold && r.text.trim()))
          current.options[active].bold = true;
      } else {
        current.word += "\n" + text.trim();
        if (current.type === 'short-answer' && current.shortRuns)
          current.shortRuns.push({text:'\n',bold:false},...runs);
      }
    }
    if (!questions.length)
      throw Error(
        "Không tìm thấy câu hỏi. Bắt đầu mỗi câu bằng “Câu 1:” hoặc “1.”, sau đó là A. B. C. D.",
      );
    questions.forEach((q, i) => {
      const bold = q.options.filter((o) => o.bold);
      if (q.type !== 'true-false') q.options.sort((a, b) => a.label.localeCompare(b.label));
      if (!q.word.trim()) q.issues.push("Thiếu nội dung câu hỏi");
      if (q.type === 'short-answer') {
        readMarkedShortAnswer(q);
        if (!q.answer) warnings.push('Câu ' + (i + 1) + ': chưa có đáp án Short Answer; hãy nhập đáp án và kiểm tra nội dung.');
        return;
      }
      if (
        q.options.length !== (q.type === 'true-false' ? 2 : 4) ||
        q.options.map((o) => o.label).sort().join("") !== (q.type === 'true-false' ? 'FT' : "ABCD") ||
        q.options.some((o) => !o.text.trim())
      )
        q.issues.push("Cần đúng 4 lựa chọn A/B/C/D có nội dung");
      if (
        new Set(q.options.map((o) => normalize(o.text))).size !==
        q.options.length
      )
        q.issues.push("Các lựa chọn bị trùng nội dung");
      if (!q.answer && bold.length === 1) q.answer = bold[0].label;
      if (!q.answer)
        warnings.push(
          "Câu " +
            (i + 1) +
            ": " +
            (bold.length
              ? "Nhiều lựa chọn có chữ đậm"
              : "Chưa nhận diện được đáp án (đậm, tô màu hoặc nền vàng)") +
            "; hãy chọn đáp án đúng.",
        );
    });
    return {
      name: fileName.replace(/\.(docx|pdf)$/i, ""),
      sourceName: fileName,
      questions,
      warnings,
    };
  }
  function questionChapters(questions) {
    const cards = questions.map((q, i) => {
      if (q.issues.length || !q.answer?.trim() || !q.word.trim() || (q.type !== 'short-answer' && !q.options.some(o => o.label === q.answer)))
        throw Error(
          "Câu " + (i + 1) + ": kiểm tra nội dung, lựa chọn và đáp án đúng.",
        );
      const options = q.options.map((o) => o.text),
        answer = q.type === 'short-answer' ? q.answer.trim() : q.options.findIndex(o => o.label === q.answer);
      return {
        id: questionId(q.word, options, answer),
        word: q.word,
        originalWord: q.word,
        meaning: q.type === 'short-answer' ? answer : options[answer],
        ...(q.type === 'short-answer' ? {} : {options}),
        type: q.type || 'multiple-choice',
        answer,
        pos: "",
        note: q.note,
      };
    });
    return [
      {
        id: "quiz-chapter",
        name: "Tất cả câu hỏi",
        sections: [{ id: "quiz-section", name: "Trắc nghiệm", cards }],
      },
    ];
  }
  function flatten(chapters) {
    return chapters.flatMap((c) =>
      c.sections.flatMap((s) =>
        s.cards.map((t) => ({
          ...t,
          chapterId: c.id,
          chapterName: c.name,
          sectionId: s.id,
          sectionName: s.name,
        })),
      ),
    );
  }
  const unique = (cards) =>
    Array.from(new Map(cards.map((c) => [c.id, c])).values());
  function deduplicate(cards) {
    const byWord = new Map();
    for (const card of cards) {
      const key = card.options || card.type === 'short-answer' ? card.id : normalize(card.word),
        old = byWord.get(key);
      if (!old) {
        byWord.set(key, { ...card });
        continue;
      }
      const extra = [];
      if (normalize(old.meaning) !== normalize(card.meaning))
        extra.push("Nghĩa bổ sung: " + card.meaning);
      if (card.note && !old.note.includes(card.note)) extra.push(card.note);
      if (extra.length)
        old.note = [old.note, ...extra].filter(Boolean).join("\n\n");
    }
    return [...byWord.values()];
  }
  function organize(deck) {
    if (deck.organization.mode === "split" && deck.hasChapters)
      return deck.chapters;
    const cards = flatten(deck.chapters),
      merged = deck.organization.dedupe ? deduplicate(cards) : cards;
    return [
      {
        id: "merged",
        name: deck.name,
        sections: [
          { id: "merged-section", name: "Toàn bộ từ vựng", cards: merged },
        ],
      },
    ];
  }
  function scopes(deck) {
    return deck.organization.mode === "split" && deck.hasChapters
      ? deck.chapters.map((c) => ({
          id: c.id,
          name: c.name,
          cards: unique(flatten([c])),
        }))
      : deck.chapters.flatMap((c) =>
          c.sections.map((s) => ({
            id: s.id,
            name: c.name + " / " + s.name,
            cards: unique(flatten([{ ...c, sections: [s] }])),
          })),
        );
  }
  function selectCards(deck, scopeIds, filter = "all") {
    let cards = scopes(deck)
      .filter((s) => scopeIds.includes(s.id))
      .flatMap((s) => s.cards);
    if (deck.organization.mode === "merged" && deck.organization.dedupe)
      cards = deduplicate(cards);
    return unique(cards).filter(
      (c) =>
        filter === "all" ||
        (filter === "unknown"
          ? !deck.progress[c.id]?.known
          : deck.progress[c.id]?.starred),
    );
  }
  function shuffle(cards, rng = Math.random) {
    const a = [...cards];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function choices(card, selected, all, direction, rng = Math.random) {
    const field = direction === "reverse" ? "word" : "meaning",
      correct = card[field],
      seen = new Set([normalize(correct)]);
    const candidates = [
      ...shuffle(
        selected.filter((t) => t.pos === card.pos),
        rng,
      ),
      ...shuffle(selected, rng),
      ...shuffle(all, rng),
    ];
    const wrong = [];
    for (const c of candidates) {
      if (
        normalize(c.word) === normalize(card.word) ||
        normalize(c.meaning) === normalize(card.meaning) ||
        seen.has(normalize(c[field]))
      )
        continue;
      seen.add(normalize(c[field]));
      wrong.push(c[field]);
      if (wrong.length === 3) break;
    }
    return wrong.length === 3 ? shuffle([correct, ...wrong], rng) : null;
  }
  function matches(answer, expected, isWord) {
    const actual = normalize(splitWord(answer).word),
      full = normalize(splitWord(expected).word);
    if (!actual) return false;
    if (actual === full) return true;
    return (
      isWord &&
      splitWord(expected)
        .word.split("/")
        .map((s) => normalize(s))
        .filter(Boolean)
        .includes(actual)
    );
  }
  function score({
    correct,
    remaining = 0,
    limit = 0,
    streak = 1,
    double = false,
  }) {
    if (!correct) return 0;
    const base = limit
      ? 600 + 400 * Math.max(0, Math.min(1, remaining / limit))
      : 1000;
    const multiplier = streak < 3 ? 1 : Math.min(1.5, 1 + (streak - 2) * 0.1);
    return Math.round(base * multiplier * (double ? 2 : 1));
  }
  function botAnswer(bot, limit, rng = Math.random) {
    const correct = rng() < bot.accuracy;
    const fraction = Math.min(
      0.95,
      Math.max(0.08, bot.speed + (rng() - 0.5) * 0.24),
    );
    const streak = correct ? bot.streak + 1 : 0;
    return {
      ...bot,
      streak,
      score:
        bot.score +
        score({ correct, remaining: limit * (1 - fraction), limit, streak }),
    };
  }
  const scopeKey = (mode, ids) => mode + ":" + hash([...ids].sort().join("|"));
  // Kế thừa trạng thái theo ID, không thay đổi bộ cũ hoặc cấu trúc nguồn.
  function inheritProgress(chapters, previous = {}) {
    const result = {};
    for (const c of flatten(chapters))
      if (Object.hasOwn(previous, c.id)) result[c.id] = { ...previous[c.id] };
    return result;
  }
  const safeId = (s) =>
    typeof s === "string" && /^[a-zA-Z0-9:_-]{1,100}$/.test(s);
  const isText = (s, max = 100000) => typeof s === "string" && s.length <= max;
  function validateBackup(value) {
    if (
      !value ||
      value.app !== "la-vocab" ||
      value.version !== 2 ||
      !Array.isArray(value.decks) ||
      value.decks.length > 100
    )
      throw Error(
        "File sao lưu không đúng định dạng hoặc phiên bản không được hỗ trợ (cần Lá v2).",
      );
    let count = 0;
    const deckIds = new Set();
    const decks = value.decks.map((d) => {
      if (
        !d ||
        !safeId(d.id) ||
        deckIds.has(d.id) ||
        !isText(d.name, 200) ||
        !d.name.trim() ||
        !isText(d.language, 35) ||
        !/^([a-z]{2,3})(-[a-z0-9]{2,8})*$/i.test(d.language) ||
        !Array.isArray(d.chapters) ||
        !d.chapters.length ||
        typeof d.hasChapters !== "boolean" ||
        !["split", "merged"].includes(d.organization?.mode)
      )
        throw Error("Dữ liệu bộ từ trong bản sao lưu không hợp lệ.");
      deckIds.add(d.id);
      const structureIds = new Set();
      const chapters = d.chapters.map((ch) => {
        if (
          !safeId(ch.id) ||
          structureIds.has(ch.id) ||
          !isText(ch.name, 1000) ||
          !Array.isArray(ch.sections) ||
          !ch.sections.length
        )
          throw Error("Chapter không hợp lệ.");
        structureIds.add(ch.id);
        return {
          id: ch.id,
          name: ch.name,
          sections: ch.sections.map((s) => {
            if (
              !safeId(s.id) ||
              structureIds.has(s.id) ||
              !isText(s.name, 1000) ||
              !Array.isArray(s.cards) ||
              !s.cards.length
            )
              throw Error("Section không hợp lệ.");
            structureIds.add(s.id);
            return {
              id: s.id,
              name: s.name,
              cards: s.cards.map((c) => {
                if (
                  ++count > 100000 ||
                  !c ||
                  !isText(c.word) ||
                  !c.word.trim() ||
                  !isText(c.meaning) ||
                  !c.meaning.trim() ||
                  !isText(c.pos, 100) ||
                  !isText(c.note) ||
                  c.id !==
                    (d.kind === "quiz"
                      ? questionId(c.word, c.options || [], c.answer)
                      : cardId(c.word, c.meaning))
                )
                  throw Error("Thẻ từ vựng hoặc ID không hợp lệ.");
                if (
                  d.kind === "quiz" &&
                  (c.type === 'short-answer'
                    ? (c.options != null || !isText(c.answer) || c.answer !== c.meaning)
                    : (!['multiple-choice', 'true-false', undefined].includes(c.type) || !Array.isArray(c.options) ||
                    c.options.length !== (c.type === 'true-false' ? 2 : 4) ||
                    c.options.some((o) => !isText(o) || !o.trim()) ||
                    new Set(c.options.map(normalize)).size !== c.options.length ||
                    !Number.isInteger(c.answer) ||
                    c.answer < 0 ||
                    c.answer >= c.options.length ||
                    c.meaning !== c.options[c.answer]))
                )
                  throw Error("Câu trắc nghiệm không hợp lệ.");
                return {
                  ...(d.kind === "quiz"
                    ? { ...(c.options ? {options: [...c.options]} : {}), answer: c.answer, ...(c.type ? {type:c.type} : {}) }
                    : {}),
                  id: c.id,
                  word: c.word,
                  meaning: c.meaning,
                  pos: c.pos,
                  note: c.note,
                  originalWord: isText(c.originalWord)
                    ? c.originalWord
                    : c.pos + " " + c.word,
                };
              }),
            };
          }),
        };
      });
      const ids = new Set(flatten(chapters).map((t) => t.id)),
        progress = {},
        memory = {},
        records = {};
      for (const id of ids) {
        const p = d.progress?.[id];
        if (p) {
          progress[id] = { starred: p.starred === true };
          if (typeof p.known === "boolean") progress[id].known = p.known;
        }
        const m = d.quizMemory?.[id];
        if (
          m &&
          Number.isInteger(m.consecutive) &&
          m.consecutive >= 0 &&
          m.consecutive <= 100000
        )
          memory[id] = {
            consecutive: m.consecutive,
            lastRun: isText(m.lastRun, 100) ? m.lastRun : "",
          };
      }
      if (d.records && typeof d.records === "object")
        for (const [key, values] of Object.entries(d.records)) {
          if (
            !/^(split|merged):[a-f0-9]{32}$/.test(key) ||
            !Array.isArray(values)
          )
            continue;
          records[key] = values
            .slice(0, 200)
            .filter(
              (r) =>
                r &&
                Number.isFinite(r.score) &&
                r.score >= 0 &&
                Number.isInteger(r.correct) &&
                Number.isInteger(r.total) &&
                r.correct >= 0 &&
                r.total >= r.correct &&
                isText(r.date, 50) &&
                isText(r.id, 100) &&
                isText(r.label, 2000),
            )
            .map((r) => ({
              id: r.id,
              date: r.date,
              score: r.score,
              correct: r.correct,
              total: r.total,
              label: r.label,
            }));
        }
      return {
        ...(d.kind === "quiz" ? { kind: "quiz" } : {}),
        id: d.id,
        name: d.name,
        language: d.language,
        sourceName: isText(d.sourceName, 1000) ? d.sourceName : "",
        hasChapters: d.hasChapters,
        chapters,
        organization: {
          mode: d.hasChapters ? d.organization.mode : "merged",
          dedupe: d.organization.dedupe === true,
        },
        progress,
        quizMemory: memory,
        records,
        activity: Array.isArray(d.activity)
          ? [
              ...new Set(
                d.activity.filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)),
              ),
            ].sort()
          : [],
      };
    });
    return {
      app: "la-vocab",
      version: 2,
      decks,
      activeDeckId: decks.some((d) => d.id === value.activeDeckId)
        ? value.activeDeckId
        : decks[0]?.id || null,
      settings: {
        theme: ["system", "light", "dark"].includes(value.settings?.theme)
          ? value.settings.theme
          : "system",
        sound: value.settings?.sound === true,
      },
    };
  }
  return {
    quizLines,
    parseQuestions,
    questionChapters,
    questionId,
    normalize,
    hash,
    cardId,
    splitWord,
    textOf,
    parse,
    flatten,
    unique,
    deduplicate,
    organize,
    scopes,
    selectCards,
    shuffle,
    choices,
    matches,
    score,
    botAnswer,
    scopeKey,
    inheritProgress,
    validateBackup,
    normalizePos,
    parseCsv,
    detectSpreadsheetColumns,
    parseSpreadsheet,
  };
})();
