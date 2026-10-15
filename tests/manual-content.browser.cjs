const {chromium}=require('playwright'),JSZip=require('jszip');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.join(__dirname,'..'),html=require('./helpers/app.cjs').readAppHtml(),hash=html.match(/const ACCESS_HASH='([a-f0-9]+)'/)[1];
const server=http.createServer((req,res)=>{const file=path.join(root,req.url==='/'?'index.html':req.url);res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':/\.css$/.test(file)?'text/css':'text/html; charset=utf-8');res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  const context=await browser.newContext();await context.addInitScript(hash=>localStorage.setItem('la-access-v2',hash),hash);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
  const click=async a=>page.locator(`[data-action="${a}"]`).first().click();
  const fill=async(word,answer)=>{await page.locator('#manual-word').fill(word);await page.locator('#manual-answer').fill(answer);};
  const save=async(more=false)=>page.locator(`#manual-card-form button[value="${more?'more':'done'}"]`).click();
  await click('create-manual-deck');await page.locator('#manual-deck-name').fill('Manual flashcards');await fill('apple','quả táo');await save(true);
  await fill('pear','quả lê');await save();assert.equal(await page.evaluate(()=>originalCards(deck()).length),2);
  await click('add-manual-card');await fill('pear','quả lê');await save();assert.match(await page.locator('#manual-error').textContent(),/đã có/);await click('close-dialog');
  await click('create-manual-deck');await page.locator('#manual-deck-name').fill('Manual questions');await page.locator('#manual-type').selectOption('short-answer');await fill('Our planet?','Earth');await save(true);
  await page.locator('#manual-type').selectOption('true-false');await page.locator('#manual-word').fill('Earth is a planet.');await page.locator('#manual-answer').selectOption('T');await save(true);
  await page.locator('#manual-type').selectOption('multiple-choice');await page.locator('#manual-word').fill('2 + 2?');
  for(const [i,v] of ['3','4','5','6'].entries()) await page.locator('[data-manual-option]').nth(i).fill(v);
  await page.locator('#manual-answer').selectOption('B');await save();
  assert.deepEqual(await page.evaluate(()=>originalCards(deck()).map(c=>c.type)),['short-answer','true-false','multiple-choice']);
  await page.evaluate(()=>{const d=deck(),cards=originalCards(d);d.progress[cards[0].id]={known:true,starred:true};d.progress[cards[1].id]={known:true,starred:true};d.quizMemory[cards[1].id]={consecutive:2,lastRun:'test'};save('all-deck');flushStorage();});
  await click('manage-cards');await page.locator('#manage-search').fill('Earth is');await click('select-managed-cards');assert.equal(await page.locator('[data-manage-card]:checked').count(),1);
  page.once('dialog',d=>d.dismiss());await click('delete-managed-cards');assert.equal(await page.evaluate(()=>originalCards(deck()).length),3);
  page.once('dialog',d=>d.accept());await click('delete-managed-cards');assert.equal(await page.locator('[data-manage-card]').count(),2);
  assert.equal(await page.evaluate(()=>Object.keys(deck().progress).length),1);assert.equal(await page.evaluate(()=>Object.keys(deck().quizMemory).length),0);
  await click('select-managed-cards');await click('delete-managed-cards');assert.match(await page.locator('#manage-error').textContent(),/ít nhất một/);
  await click('close-dialog');await page.reload();assert.equal(await page.evaluate(()=>originalCards(deck()).length),2);
  assert.equal(await page.evaluate(()=>StorageModel.migrate(StorageModel.backup(store)).decks.length),2);
  // Discard an invalid uploaded question without losing edits to kept questions.
  const zip=new JSZip();zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+['1) Invalid MCQ','A) only one','SHORT ANSWER QUESTIONS:','1) Keep this question','Answer: yes'].map(t=>`<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`).join('')+'</w:body></w:document>');
  await page.locator('#quiz-file-input').setInputFiles({name:'Remove.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:await zip.generateAsync({type:'nodebuffer'})});await page.waitForSelector('#quiz-import-form');
  await page.locator('#quiz-deck-name').fill('Edited upload');await page.locator('[data-question-word="1"]').fill('Edited prompt');await page.locator('[data-question-answer="1"]').fill('edited answer');
  assert.equal(await page.locator('#quiz-import-form button[type="submit"]').isDisabled(),true);await click('remove-import-question');
  assert.equal(await page.locator('[data-question-word]').inputValue(),'Edited prompt');assert.equal(await page.locator('[data-question-answer]').inputValue(),'edited answer');assert.equal(await page.locator('#quiz-deck-name').inputValue(),'Edited upload');
  await page.locator('#quiz-import-form button[type="submit"]').click();await page.waitForSelector('#start-quiz');assert.equal(await page.evaluate(()=>originalCards(deck()).length),1);
  await click('add-manual-card');await page.locator('#manual-type').selectOption('short-answer');await fill('New after upload','new answer');await save();
  await click('manage-cards');await page.locator('[data-manage-card]').first().check();page.once('dialog',d=>d.accept());await click('delete-managed-cards');await click('close-dialog');await page.reload();assert.equal(await page.evaluate(()=>originalCards(deck())[0].word),'New after upload');
  await page.locator('[data-action="open-deck"]').last().click();
  await page.setViewportSize({width:390,height:844});await click('manage-cards');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await click('close-dialog');await click('add-manual-card');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);console.log('Manual content: flashcards, all question types, duplicates, bulk deletion/cancel, progress cleanup, import removal preserving edits, reload, backup and mobile passed.');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
