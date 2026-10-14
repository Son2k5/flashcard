// Chạy bằng npm test. Chỉ sử dụng dữ liệu giả; không chứa tài liệu của người dùng.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DOMParser } = require('linkedom');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const code = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const C = new Function('DOMParser', code + '\nreturn Core;')(DOMParser);
let passed = 0;
function test(name, action) { action(); passed++; console.log('✓ ' + name); }
test('Script vẫn hợp lệ khi công cụ xem trước chèn mã trước thẻ đóng body', () => {
  const preview = html.replace(/<\/body>/i, '<script>window.previewReady=true;</script></body>');
  const scripts = [...preview.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 4);
  for (const [, code] of scripts) assert.doesNotThrow(() => new Function(code));
  assert.ok(preview.indexOf('window.previewReady') > preview.indexOf('<script id="app-code">'));
});
const table = rows => '<table>' + rows.map(r => '<tr>' + r.map(x => '<td>' + x + '</td>').join('') + '</tr>').join('') + '</table>';
const source = '<h1>Bỏ qua tiêu đề</h1><p>Ngày và ghi chú: không phải lệnh</p><h2>Chapter A</h2><p><strong>Dictation 1</strong></p>' + table([['Từ','Nghĩa','Ghi chú'],['(n)(v) sacrifice','hy sinh','giữ / = &gt;&lt; → (gốc)'],['猫 / ねこ','mèo','日本語'],['안녕','xin chào','한국어'],['你好','chào','中文'],['At most &gt;&lt; at least','nhiều nhất &gt;&lt; ít nhất','']]) + '<h2>Chapter B</h2><p><strong>Dictation 1</strong></p>' + table([['(n) sacrifice','sự hy sinh','nghĩa thứ hai'],['bonjour','xin chào','français']]);
const parsed = C.parse(source, 'fixture.docx');
const deck = {id:'test-deck', ...parsed, language:'ja-JP', organization:{mode:'split',dedupe:false},progress:{},activity:[],quizMemory:{},records:{}};
test('Parse đủ chapter, section trùng tên, dòng không có POS và Unicode', () => {
  assert.equal(parsed.chapters.length,2); assert.equal(C.flatten(parsed.chapters).length,8);
  assert.notEqual(parsed.chapters[0].sections[0].id,parsed.chapters[1].sections[0].id);
  const cards=C.flatten(parsed.chapters); assert.equal(cards[0].pos,'(n)(v)');assert.equal(cards[0].word,'sacrifice');
  assert.equal(cards[0].note,'giữ / = >< → (gốc)');assert.equal(cards[1].word,'猫 / ねこ');assert.equal(cards[2].word,'안녕');assert.equal(cards[3].word,'你好');assert.equal(cards[4].word,'At most');assert.equal(cards[1].pos,'');
});
test('Nhiều đoạn in đậm liên tiếp vẫn là một tiêu đề section',()=>{
  const p=C.parse('<h2>A</h2><p><strong>Vocab </strong><em><strong>highlights</strong></em></p>'+table([['one','một']]));assert.equal(p.chapters[0].sections[0].name,'Vocab highlights');
});
test('Không có chapter: mặc định Tất cả; bảng 4 cột thành ghi chú',()=>{
  const p=C.parse(table([['木','cây','ví dụ 1','ví dụ 2']]));assert.equal(p.hasChapters,false);assert.equal(p.chapters[0].name,'Tất cả');assert.equal(C.flatten(p.chapters)[0].note,'ví dụ 1\n\nví dụ 2');
});
test('Từ và nghĩa giữ nguyên ký hiệu và xuống dòng',()=>{
  const p=C.parse(table([['a / b = c &gt;&lt; d → (E)','<p>nghĩa 1</p><p>nghĩa 2</p>']]));assert.equal(C.flatten(p.chapters)[0].word,'a / b = c >< d → (E)');assert.equal(C.flatten(p.chapters)[0].meaning,'nghĩa 1\nnghĩa 2');
});
test('Lỗi không bảng, bảng 1 cột, gộp ô; cảnh báo dòng thiếu nghĩa',()=>{
  assert.throws(()=>C.parse('<h2>A</h2>'),/không có bảng/);assert.throws(()=>C.parse(table([['alone']])),/sai định dạng/);
  assert.throws(()=>C.parse('<table><tr><td colspan="2">a</td><td>b</td></tr></table>'),/sai định dạng/);
  const p=C.parse(table([['good','tốt'],['bad','']]));assert.equal(C.flatten(p.chapters).length,1);assert.equal(p.warnings.length,1);
});
test('ID ổn định khi khác hoa/thường, khoảng trắng, Unicode NFC, thứ tự chapter',()=>{
  assert.equal(C.cardId('  CAT  ','MÈO'),C.cardId('cat','mèo'));assert.notEqual(C.cardId('cat','mèo'),C.cardId('cat','con mèo'));
  const p=C.parse('<h2>Đổi tên</h2>'+table([['(n) sacrifice','hy sinh']]));assert.equal(C.flatten(p.chapters)[0].id,C.flatten(parsed.chapters)[0].id);
});
test('Gộp rồi tách giữ cấu trúc gốc, ID, tiến độ và sao',()=>{
  const original=JSON.stringify(deck.chapters),card=C.flatten(deck.chapters)[0];deck.progress[card.id]={known:true,starred:true};
  deck.organization.mode='merged';assert.equal(C.organize(deck).length,1);assert.equal(C.flatten(C.organize(deck))[0].id,card.id);
  deck.organization.mode='split';assert.equal(C.organize(deck).length,2);assert.equal(JSON.stringify(deck.chapters),original);assert.deepEqual(deck.progress[card.id],{known:true,starred:true});
});
test('Loại trùng theo từ, giữ nghĩa đầu và gộp nghĩa/ghi chú khác',()=>{
  const cards=C.flatten(deck.chapters),deduped=C.deduplicate(cards);assert.equal(deduped.length,7);assert.equal(deduped[0].meaning,'hy sinh');assert.ok(deduped[0].note.includes('sự hy sinh'));assert.ok(deduped[0].note.includes('nghĩa thứ hai'));assert.equal(cards[0].note,'giữ / = >< → (gốc)');
});
test('Kế thừa tiến độ từ tài liệu mới chỉ sao chép ID khớp',()=>{
  const p=C.parse(table([['sacrifice','hy sinh'],['new','mới']]));const inherited=C.inheritProgress(p.chapters,deck.progress);assert.equal(Object.keys(inherited).length,1);assert.equal(inherited[C.cardId('sacrifice','hy sinh')].starred,true);assert.notEqual(inherited[C.cardId('sacrifice','hy sinh')],deck.progress[C.cardId('sacrifice','hy sinh')]);
});
const card=(word,meaning,pos='(n)')=>({id:C.cardId(word,meaning),word,meaning,pos,note:''});
const pool=[card('a','A'),card('b','B'),card('c','C'),card('d','D'),card('a','A khác'),card('e','A'),card('f','F','(v)')];
test('Đáp án nhiễu: 4 lựa chọn khác nhau, loại cả trùng từ lẫn nghĩa',()=>{
  for(const direction of ['forward','reverse']){const choices=C.choices(pool[0],pool.slice(0,2),pool,direction,()=>.4);assert.equal(choices.length,4);assert.equal(new Set(choices.map(C.normalize)).size,4);assert.ok(choices.includes(direction==='forward'?'A':'a'));assert.ok(!choices.includes(direction==='forward'?'A khác':'e'));}
});
test('Ưu tiên đáp án cùng loại từ; bộ 3 thẻ chuyển sang gõ',()=>{
  const choices=C.choices(pool[0],pool,pool,'forward',()=>.5);assert.ok(!choices.includes('F'));assert.equal(C.choices(pool[0],pool.slice(0,3),pool.slice(0,3),'forward'),null);
});
test('Điểm tốc độ, giới hạn, chuỗi, nhân đôi và câu sai',()=>{
  assert.equal(C.score({correct:true,remaining:10,limit:10}),1000);assert.equal(C.score({correct:true,remaining:0,limit:10}),600);assert.equal(C.score({correct:true,remaining:5,limit:10}),800);
  assert.equal(C.score({correct:true,limit:0,streak:3}),1100);assert.equal(C.score({correct:true,remaining:100,limit:10,streak:20,double:true}),3000);assert.equal(C.score({correct:false,streak:20,double:true}),0);
});
test('So khớp đáp án: POS, hoa/thường, khoảng trắng, biến thể và CJK',()=>{
  assert.ok(C.matches(' (n) CAT ','cat / feline',true));assert.ok(C.matches('feline','cat / feline',true));assert.ok(C.matches('go   home','go home',true));assert.ok(C.matches('ねこ','猫 / ねこ',true));assert.ok(!C.matches('','cat / ',true));assert.ok(!C.matches('mèo','mèo / động vật',false));assert.ok(C.matches('MÈO','mèo',false));
});
test('Phạm vi quiz và bộ lọc; khóa điểm cao không phụ thuộc thứ tự chọn',()=>{
  deck.organization.mode='split';const scopes=C.scopes(deck);assert.equal(C.selectCards(deck,[scopes[0].id],'hard').length,1);assert.equal(C.selectCards(deck,[scopes[0].id],'unknown').length,5);assert.equal(C.scopeKey('split',['a','b']),C.scopeKey('split',['b','a']));assert.notEqual(C.scopeKey('split',['a']),C.scopeKey('merged',['a']));
  deck.organization.mode='merged';deck.organization.dedupe=true;assert.equal(C.scopes(deck).length,2);assert.equal(C.selectCards(deck,C.scopes(deck).map(s=>s.id)).length,7);
});
test('Bot có điểm và chuỗi theo cùng công thức',()=>{
  const bot={accuracy:.7,speed:.5,streak:2,score:100};const next=C.botAnswer(bot,20,()=>.1);assert.equal(next.streak,3);assert.ok(next.score>100);const wrong=C.botAnswer(bot,20,()=>.99);assert.equal(wrong.streak,0);assert.equal(wrong.score,100);
});
test('Backup giữ dữ liệu và tiến độ, loại phiên bản/ID không hợp lệ',()=>{
  const backup={app:'la-vocab',version:2,decks:[deck],activeDeckId:deck.id,settings:{theme:'dark',sound:true}};
  const restored=C.validateBackup(JSON.parse(JSON.stringify(backup)));assert.deepEqual(restored.decks[0].progress,deck.progress);assert.deepEqual(restored.decks[0].chapters,deck.chapters);assert.equal(restored.settings.theme,'dark');
  assert.throws(()=>C.validateBackup({...backup,version:999}));const bad=JSON.parse(JSON.stringify(backup));bad.decks[0].chapters[0].sections[0].cards[0].id='wrong';assert.throws(()=>C.validateBackup(bad));
});
console.log(`\n${passed} nhóm kiểm tra đã đạt.`);

test('Nhập dòng, danh sách, loại từ trước/sau từ và sau dấu hai chấm', () => {
  const p = C.parse('<p><strong>tools: (v) công cụ</strong><br>cat (n): mèo</p><ul><li>(adj) happy: vui</li><li>2. 猫：mèo</li></ul>');
  const cards = C.flatten(p.chapters);
  assert.deepEqual(cards.map(c => [c.word, c.pos, c.meaning]), [['tools','(v)','công cụ'], ['cat','(n)','mèo'], ['happy','(adj)','vui'], ['猫','','mèo']]);
  assert.equal(cards[0].id, C.cardId('tools', 'công cụ'));
});
test('Đối nghĩa trong dòng và bảng: tách đúng nghĩa, giữ ghi chú', () => {
  for (const source of ['<p>hot: (adj) nóng &gt;&lt; cold: (adj) lạnh</p>', '<p>hot &gt;&lt; cold: nóng &gt;&lt; lạnh</p>', table([['hot &gt;&lt; cold', 'nóng &gt;&lt; lạnh', 'ví dụ']])]) {
    const cards = C.flatten(C.parse(source).chapters);
    assert.deepEqual(cards.map(c => [c.word,c.meaning]), [['hot','nóng'],['cold','lạnh']]);
    assert.ok(cards[0].note.includes('Đối nghĩa: cold'));
    assert.ok(cards[1].note.includes('Đối nghĩa: hot'));
    if (source.startsWith('<table')) assert.ok(cards[0].note.includes('ví dụ'));
  }
});
test('Trộn bảng và dòng, giữ chapter/section, cảnh báo thiếu nghĩa', () => {
  const p = C.parse('<h2>Unit 1</h2><h3>Words</h3><p>cat: mèo</p>' + table([['dog','chó']]) + '<h2>Unit 2</h2><p>hot &gt;&lt; cold: nóng</p><p>empty:</p><p>up &gt;&lt; down</p>');
  assert.equal(p.chapters.length, 2);
  assert.equal(p.chapters[0].sections[0].name, 'Words');
  assert.equal(C.flatten(p.chapters).length, 3);
  assert.equal(C.flatten(p.chapters)[2].word, 'hot >< cold');
  assert.equal(p.warnings.length, 3);
});
