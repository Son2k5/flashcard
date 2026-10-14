// Dữ liệu giả; kiểm tra lưu trữ mà không truy cập profile trình duyệt thật.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {DOMParser}=require('linkedom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const coreCode=html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const storageCode=html.match(/<script id="storage-core">([\s\S]*?)<\/script>/)[1];
const {Core:C,StorageModel:S}=new Function('DOMParser',coreCode+'\n'+storageCode+'\nreturn {Core,StorageModel};')(DOMParser);
let passed=0;
function test(name,fn){fn();passed++;console.log('✓ '+name);}
class MemoryStorage{
 constructor(entries=[]){this.map=new Map(entries);this.writes=[];this.capacity=Infinity;this.failKey=null;}
 get length(){return this.map.size;}key(i){return [...this.map.keys()][i]??null;}getItem(k){return this.map.get(k)??null;}
 setItem(k,v){const candidate=new Map(this.map);candidate.set(k,String(v));const size=[...candidate].reduce((n,[key,value])=>n+S.bytes(key,value),0);if(k===this.failKey||size>this.capacity){const e=new Error('Full');e.name='QuotaExceededError';throw e;}this.map=candidate;this.writes.push(k);}
 removeItem(k){this.map.delete(k);}
}
function fixture(){const parsed=C.parse('<h2>A</h2><p><strong>Nhóm</strong></p><table>'+Array.from({length:6},(_,i)=>`<tr><td>猫 ${i}</td><td>nghĩa ${i}</td><td>ghi chú</td></tr>`).join('')+'</table>','fixture.docx');const cards=C.flatten(parsed.chapters),progress={};progress[cards[0].id]={};progress[cards[1].id]={known:false};progress[cards[2].id]={known:true};progress[cards[3].id]={starred:true};progress[cards[4].id]={known:false,starred:true};progress[cards[5].id]={known:true,starred:true};return {app:'la-vocab',version:2,activeDeckId:'deck-test',settings:{theme:'dark',sound:true},decks:[{id:'deck-test',...parsed,language:'ja-JP',organization:{mode:'merged',dedupe:true},progress,activity:['2026-10-12','2026-10-13'],records:{},quizMemory:{[cards[1].id]:{consecutive:2,lastRun:'run-1'}}}]};}
function clock(){let now=0,seq=0;const timers=new Map();return {setTimer(fn,delay){const id=++seq;timers.set(id,{fn,at:now+delay});return id;},clearTimer(id){timers.delete(id);},advance(ms){now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}},get count(){return timers.size;}};}
test('Di chuyển v2 giữ nguyên nội dung, đã thuộc/chưa thuộc, sao, ngôn ngữ và cài đặt',()=>{
 const input=fixture(),old=JSON.stringify(input),migrated=S.migrate(input);assert.equal(migrated.schemaVersion,3);assert.equal(JSON.stringify(input),old);assert.deepEqual(migrated.decks[0].chapters,input.decks[0].chapters);assert.deepEqual(migrated.decks[0].activity,input.decks[0].activity);assert.deepEqual(migrated.decks[0].quizMemory,input.decks[0].quizMemory);assert.equal(migrated.settings.theme,'dark');
 const codes=S.packProgress(migrated.decks[0].progress),cards=C.flatten(input.decks[0].chapters);assert.equal(codes[cards[0].id],undefined);assert.deepEqual(cards.slice(1).map(c=>codes[c.id]),[1,2,3,4,5]);
 const restored=S.migrate(S.backup(migrated));assert.deepEqual(S.packProgress(restored.decks[0].progress),codes);assert.equal(restored.decks[0].progress[cards[3].id].known,undefined);assert.equal(restored.decks[0].progress[cards[5].id].known,true);assert.equal(restored.decks[0].progress[cards[5].id].starred,true);
});
test('Di chuyển v1 giữ tiến độ khi ID được đổi sang hash nội dung',()=>{
 const old={version:1,data:{fileName:'old.docx',chapters:[{name:'A',sections:[{name:'S',cards:[{id:'t0',word:'cat',meaning:'mèo',partOfSpeech:'(n)'}]}]}]},progress:{t0:{known:true,starred:true}},activity:['2026-10-01']};const m=S.migrate(old);assert.equal(m.decks[0].progress[C.cardId('cat','mèo')].known,true);assert.equal(m.decks[0].progress[C.cardId('cat','mèo')].starred,true);assert.deepEqual(m.decks[0].activity,old.activity);
});
test('Schema 3 lưu một cấu trúc, khóa tiến độ chỉ là mã số, không lưu file/HTML/base64',()=>{
 const state=S.migrate(fixture());state.decks[0].docx='private-binary';state.decks[0].rawHtml='<table>raw</table>';state.decks[0].base64='binary-base64';state.decks[0].mergedCopy=state.decks[0].chapters;const entries=S.snapshot(state);assert.equal(entries.length,4);const text=JSON.stringify(entries);for(const bad of ['private-binary','rawHtml','binary-base64','mergedCopy'])assert.ok(!text.includes(bad));
 assert.equal(entries.filter(([,v])=>v.includes('"chapters"')).length,1);const progress=JSON.parse(entries.find(([k])=>k===S.key('progress','deck-test'))[1]);assert.ok(Object.values(progress).every(Number.isInteger));assert.ok(!JSON.stringify(progress).includes('nghĩa'));
 const storage=new MemoryStorage(entries);assert.deepEqual(S.backup(S.read(storage)),S.backup(state));
});
test('Giữ 20 lượt gần nhất toàn bộ bộ từ và top 5 mỗi phạm vi, không trùng bản ghi',()=>{
 const records={};for(const group of ['a','b','c'])records[group]=Array.from({length:40},(_,i)=>({id:group+i,date:new Date(Date.UTC(2026,0,i+1,group.charCodeAt(0)-97)).toISOString(),score:4000-i*10,total:10,correct:8,label:'test'}));
 const trimmed=S.trimHistory(records),all=Object.entries(records).flatMap(([scope,rows])=>rows.map(r=>({scope,r}))).sort((a,b)=>b.r.date.localeCompare(a.r.date));const actual=Object.entries(trimmed).flatMap(([scope,rows])=>rows.map(r=>scope+'|'+r.id));const expected=new Set(all.slice(0,20).map(({scope,r})=>scope+'|'+r.id));for(const [scope,rows] of Object.entries(records))for(const r of [...rows].sort((a,b)=>b.score-a.score).slice(0,5))expected.add(scope+'|'+r.id);assert.deepEqual(new Set(actual),expected);assert.equal(actual.length,new Set(actual).size);assert.ok(actual.length<=35);assert.deepEqual(S.trimHistory(trimmed),trimmed);
});
test('Tính dung lượng gồm khóa và giá trị UTF-16, loại dữ liệu ngoài app',()=>{
 const entries=[[S.metaKey,'猫🙂'],['another-app','x'.repeat(10000)],['la-access-v2','abc'],['la-vocab-v2','old']];const expected=(S.metaKey.length+3+'la-access-v2'.length+3+'la-vocab-v2'.length+3)*2;assert.equal(S.footprint(entries),expected);const report=S.scan(new MemoryStorage(entries));assert.equal(report.total,expected);assert.equal(report.entries.length,3);
});
test('Debounce 500 ms gộp nhiều thay đổi, serialize lúc flush và không ghi cấu trúc nguồn',()=>{
 const storage=new MemoryStorage(),time=clock();let value=1,serialized=0;const writer=S.createWriter({storage,...time});const key=S.key('progress','one');const get=()=>{serialized++;return JSON.stringify({card:value});};writer.put(key,get);time.advance(400);value=2;writer.put(key,get);time.advance(499);assert.equal(storage.writes.length,0);assert.equal(serialized,0);time.advance(1);assert.deepEqual(storage.writes,[key]);assert.equal(storage.getItem(key),'{"card":2}');assert.equal(serialized,1);assert.equal(writer.pending,0);
 writer.put(key,get);time.advance(500);assert.equal(storage.writes.length,1,'Không ghi khi giá trị không đổi');
});
test('Flush khi ẩn/đóng trang ghi ngay và hủy lịch debounce',()=>{
 const storage=new MemoryStorage(),time=clock(),writer=S.createWriter({storage,...time});writer.put('key',()=> 'value');assert.equal(writer.flush(),true);assert.equal(storage.getItem('key'),'value');assert.equal(time.count,0);time.advance(1000);assert.equal(storage.writes.length,1);
});
test('QuotaExceededError giữ dữ liệu cũ, hoàn tác đợt ghi và giữ hàng chờ để thử lại',()=>{
 const storage=new MemoryStorage([['first','before'],['second','unchanged']]),time=clock();let caught;storage.failKey='second';const writer=S.createWriter({storage,...time,onError:e=>caught=e});writer.put('first',()=> 'after');writer.put('second',()=> 'new');assert.equal(writer.flush(),false);assert.equal(S.isQuota(caught),true);assert.equal(storage.getItem('first'),'before');assert.equal(storage.getItem('second'),'unchanged');assert.equal(writer.pending,2);storage.failKey=null;assert.equal(writer.flush(),true);assert.equal(storage.getItem('first'),'after');assert.equal(writer.pending,0);
});
test('Di chuyển bị đầy trước manifest: bản v2 vẫn nguyên, không để lại bản mới nửa chừng',()=>{
 const raw=JSON.stringify(fixture()),storage=new MemoryStorage([['la-vocab-v2',raw]]);storage.failKey=S.metaKey;const result=S.transaction(storage,S.snapshot(S.migrate(JSON.parse(raw))));assert.equal(result.ok,false);assert.equal(storage.getItem('la-vocab-v2'),raw);assert.equal(storage.length,1);storage.failKey=null;assert.equal(S.transaction(storage,S.snapshot(S.migrate(JSON.parse(raw)))).ok,true);assert.equal(S.read(storage).decks.length,1);
});
test('Hoàn tác theo dung lượng: thu nhỏ bản ghi mới trước khi phục hồi bản cũ lớn',()=>{
 const storage=new MemoryStorage([['a','a'.repeat(100)],['b','b'.repeat(10)],['fail','x']]);storage.capacity=1000;storage.failKey='fail';const before=[...storage.map];const result=S.transaction(storage,[['a','1'],['b','2'.repeat(300)],['fail','new']]);assert.equal(result.ok,false);assert.deepEqual([...storage.map],before);assert.deepEqual(result.rollbackErrors,[]);
});
test('Dọn tiến độ và gợi ý mồ côi không xóa từ, sao hay tiến độ hợp lệ',()=>{
 const d=S.migrate(fixture()).decks[0],count=C.flatten(d.chapters).length;d.progress.orphan={known:true,starred:true};d.quizMemory.orphan={consecutive:4,lastRun:'x'};const valid=S.packProgress(d.progress);delete valid.orphan;S.cleanDeck(d);assert.equal(C.flatten(d.chapters).length,count);assert.equal(d.progress.orphan,undefined);assert.equal(d.quizMemory.orphan,undefined);assert.deepEqual(S.packProgress(d.progress),valid);
});
test('Phiên bản lạ, mã trạng thái sai và quyền đọc bị chặn được xử lý',()=>{
 assert.throws(()=>S.migrate({...fixture(),schemaVersion:99}));assert.throws(()=>S.unpackProgress({id:9}));assert.throws(()=>S.unpackProgress({id:'2'}));assert.ok(S.scan({get length(){throw Error('blocked');}}).error);assert.equal(S.isQuota({name:'SecurityError'}),false);
});
console.log(`\n${passed} nhóm kiểm tra lưu trữ đã đạt.`);
