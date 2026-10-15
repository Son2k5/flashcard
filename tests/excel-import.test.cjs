const assert = require('node:assert/strict');
const { DOMParser } = require('linkedom');
const html = require('./helpers/app.cjs').readAppHtml();
const code = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const C = new Function('DOMParser', code + '\nreturn Core;')(DOMParser);

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('✓ ' + name);
}

// 1. normalizePos
test('Chuẩn hóa loại từ (POS) sang dạng có ngoặc (v), (n), (adj), (adv)...', () => {
  assert.equal(C.normalizePos('v'), '(v)');
  assert.equal(C.normalizePos('(v)'), '(v)');
  assert.equal(C.normalizePos('động từ'), '(v)');
  assert.equal(C.normalizePos('verb'), '(v)');
  assert.equal(C.normalizePos('n'), '(n)');
  assert.equal(C.normalizePos('danh từ'), '(n)');
  assert.equal(C.normalizePos('adj'), '(adj)');
  assert.equal(C.normalizePos('tính từ'), '(adj)');
  assert.equal(C.normalizePos('adv'), '(adv)');
  assert.equal(C.normalizePos('trạng từ'), '(adv)');
  assert.equal(C.normalizePos('prep'), '(prep)');
  assert.equal(C.normalizePos('giới từ'), '(prep)');
  assert.equal(C.normalizePos('cụm từ'), '(phr)');
  assert.equal(C.normalizePos('v, n'), '(v) (n)');
  assert.equal(C.normalizePos(''), '');
  assert.equal(C.normalizePos(null), '');
});

// 2. parseCsv
test('Phân tích cú pháp CSV hỗ trợ dấu phẩy, chấm phẩy, tab và ô có ngoặc kép', () => {
  const csvComma = 'STT,Từ vựng,Dạng từ,Nghĩa,Ví dụ\n1,abandon,v,"từ bỏ, ruồng bỏ","He abandoned his car."\n2,ability,n,khả năng,"She has great ability."';
  const rowsComma = C.parseCsv(csvComma);
  assert.equal(rowsComma.length, 3);
  assert.deepEqual(rowsComma[1], ['1', 'abandon', 'v', 'từ bỏ, ruồng bỏ', 'He abandoned his car.']);

  const csvSemi = 'STT;Từ vựng;Dạng từ;Nghĩa;Ví dụ\n1;abandon;v;từ bỏ;Ví dụ';
  const rowsSemi = C.parseCsv(csvSemi);
  assert.equal(rowsSemi.length, 2);
  assert.equal(rowsSemi[1][1], 'abandon');

  const csvTab = 'STT\tTừ vựng\tDạng từ\tNghĩa\tVí dụ\n1\tabandon\tv\ttừ bỏ\tVí dụ';
  const rowsTab = C.parseCsv(csvTab);
  assert.equal(rowsTab.length, 2);
  assert.equal(rowsTab[1][1], 'abandon');
});

// 3. parseSpreadsheet with 5 columns: STT | Từ vựng | Dạng từ | Nghĩa | Ví dụ
test('Nhập file Excel định dạng 5 cột chuẩn: STT | Từ vựng | Dạng từ | Nghĩa | Ví dụ', () => {
  const sheets = [{
    name: 'Từ vựng Tuần 1',
    rows: [
      ['STT', 'Từ vựng', 'Dạng từ', 'Nghĩa', 'Ví dụ'],
      ['1', 'abandon', 'v', 'từ bỏ, ruồng bỏ', 'He abandoned his car in the snow.'],
      ['2', 'ability', 'danh từ', 'khả năng, năng lực', 'She has the ability to learn quickly.'],
      ['3', 'abnormal', '(adj)', 'bất thường', 'An abnormal heart rhythm was detected.'],
      ['4', 'hot >< cold', 'adj', 'nóng >< lạnh', 'Opposites'],
      ['5', 'incomplete', 'adj', '', 'Không có nghĩa'],
    ]
  }];

  const parsed = C.parseSpreadsheet(sheets, 'Unit1_Vocab.xlsx');
  assert.equal(parsed.name, 'Unit1_Vocab');
  assert.equal(parsed.hasChapters, false);
  assert.equal(parsed.chapters.length, 1);

  const cards = C.flatten(parsed.chapters);
  assert.equal(cards.length, 5); // 1, 2, 3 + 2 cards from antonym pair hot/cold = 5 cards
  assert.equal(cards[0].word, 'abandon');
  assert.equal(cards[0].pos, '(v)');
  assert.equal(cards[0].meaning, 'từ bỏ, ruồng bỏ');
  assert.equal(cards[0].note, 'He abandoned his car in the snow.');
  assert.equal(cards[0].originalWord, '(v) abandon');

  assert.equal(cards[1].word, 'ability');
  assert.equal(cards[1].pos, '(n)');
  assert.equal(cards[1].meaning, 'khả năng, năng lực');

  assert.equal(cards[2].word, 'abnormal');
  assert.equal(cards[2].pos, '(adj)');

  // Antonym pair
  assert.equal(cards[3].word, 'hot');
  assert.equal(cards[3].meaning, 'nóng');
  assert.ok(cards[3].note.includes('Đối nghĩa: cold — lạnh'));

  assert.equal(cards[4].word, 'cold');
  assert.equal(cards[4].meaning, 'lạnh');
  assert.ok(cards[4].note.includes('Đối nghĩa: hot — nóng'));

  // Warning for incomplete row 5
  assert.equal(parsed.warnings.length, 1);
  assert.ok(parsed.warnings[0].includes('dòng 6: thiếu từ vựng hoặc nghĩa'));
});

// 4. parseSpreadsheet with 4 columns: Từ vựng | Dạng từ | Nghĩa | Ví dụ
test('Nhập file Excel định dạng 4 cột: Từ vựng | Dạng từ | Nghĩa | Ví dụ', () => {
  const sheets = [{
    name: 'Sheet1',
    rows: [
      ['Từ vựng', 'Dạng từ', 'Nghĩa', 'Ví dụ'],
      ['accomplish', 'verb', 'hoàn thành, đạt được', 'I accomplished my goal.'],
      ['accurate', 'tính từ', 'chính xác', 'An accurate description.'],
    ]
  }];

  const parsed = C.parseSpreadsheet(sheets, 'Vocab4Col.xlsx');
  const cards = C.flatten(parsed.chapters);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].word, 'accomplish');
  assert.equal(cards[0].pos, '(v)');
  assert.equal(cards[1].word, 'accurate');
  assert.equal(cards[1].pos, '(adj)');
});

// 5. Multi-sheet Excel workbook creating multiple chapters
test('Workbook Excel nhiều sheet tự động tạo các Chapter tương ứng', () => {
  const sheets = [
    {
      name: 'Chương 1 - Gia đình',
      rows: [
        ['STT', 'Từ vựng', 'Dạng từ', 'Nghĩa', 'Ví dụ'],
        ['1', 'father', 'n', 'bố, cha', 'My father is a doctor.'],
        ['2', 'mother', 'n', 'mẹ', 'My mother is a teacher.'],
      ]
    },
    {
      name: 'Chương 2 - Trường học',
      rows: [
        ['STT', 'Từ vựng', 'Dạng từ', 'Nghĩa', 'Ví dụ'],
        ['1', 'teacher', 'n', 'giáo viên', 'Our teacher is nice.'],
        ['2', 'student', 'n', 'học sinh', 'Diligent student.'],
      ]
    }
  ];

  const parsed = C.parseSpreadsheet(sheets, 'English_Lessons.xlsx');
  assert.equal(parsed.hasChapters, true);
  assert.equal(parsed.chapters.length, 2);
  assert.equal(parsed.chapters[0].name, 'Chương 1 - Gia đình');
  assert.equal(parsed.chapters[1].name, 'Chương 2 - Trường học');
  assert.equal(C.flatten(parsed.chapters).length, 4);
});

// 6. Headerless sheet with numeric column 0
test('Bảng không có dòng tiêu đề vẫn tự nhận diện cột STT và các cột từ vựng', () => {
  const sheets = [{
    name: 'Sheet1',
    rows: [
      ['1', 'run', 'v', 'chạy', 'Run fast'],
      ['2', 'walk', 'v', 'đi bộ', 'Walk slowly'],
    ]
  }];

  const parsed = C.parseSpreadsheet(sheets, 'NoHeader.xlsx');
  const cards = C.flatten(parsed.chapters);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].word, 'run');
  assert.equal(cards[0].meaning, 'chạy');
  assert.equal(cards[0].pos, '(v)');
  assert.equal(cards[0].note, 'Run fast');
});

console.log(`\n${passed} nhóm kiểm tra Excel import đã đạt.`);
