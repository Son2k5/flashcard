const {chromium}=require('playwright'), JSZip=require('jszip');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.join(__dirname,'..'),html=require('./helpers/app.cjs').readAppHtml(),hash=html.match(/const ACCESS_HASH='([a-f0-9]+)'/)[1];
const server=http.createServer((req,res)=>{const file=path.join(root,req.url==='/'?'index.html':req.url);res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':/\.css$/.test(file)?'text/css':'text/html; charset=utf-8');res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  const context=await browser.newContext();await context.addInitScript(hash=>localStorage.setItem('la-access-v2',hash),hash);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
  const zip=new JSZip();zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+['TRUE/FALSE QUESTIONS:','T F 1) The sun is a star.','Answer: True','SHORT ANSWER QUESTIONS:','1) Name our planet.','Answer: Earth','MULTIPLE CHOICE QUESTIONS:','1) 2 + 2?','A) 3 B) 4 C) 5 D) 6','Answer: B'].map(t=>`<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`).join('')+'</w:body></w:document>');
  await page.locator('#quiz-file-input').setInputFiles({name:'Mixed.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:await zip.generateAsync({type:'nodebuffer'})});
  await page.waitForSelector('#quiz-import-form');assert.equal(await page.locator('[data-question-answer]').count(),3);
  assert.deepEqual(await page.evaluate(()=>pending.parsed.questions.map(q=>q.type)),['true-false','short-answer','multiple-choice']);
  await page.locator('#quiz-import-form button[type="submit"]').click();await page.waitForSelector('#start-quiz');
  await page.locator('#quiz-time').selectOption('0');await page.locator('#quiz-shuffle').uncheck();await page.locator('#quiz-auto').uncheck();await page.locator('#start-quiz').click();
  assert.equal(await page.locator('[data-action="quiz-answer"]').count(),2);
  await page.keyboard.press('3');assert.equal(await page.evaluate(()=>quiz.answered),false);
  await page.locator(`[data-action="quiz-answer"][data-index="${await page.evaluate(()=>question().options.findIndex(v=>v === question().card.meaning))}"]`).click();assert.equal(await page.evaluate(()=>quiz.feedback.correct),true);
  await page.locator('#quiz-next').click();await page.locator('#quiz-answer-input').fill('  EARTH  ');await page.locator('#quiz-answer-form button').click();assert.equal(await page.evaluate(()=>quiz.feedback.correct),true);
  await page.locator('#quiz-next').click();assert.equal(await page.locator('[data-action="quiz-answer"]').count(),4);await page.locator(`[data-action="quiz-answer"][data-index="${await page.evaluate(()=>question().options.findIndex(v=>v === question().card.meaning))}"]`).click();assert.equal(await page.evaluate(()=>quiz.feedback.correct),true);await page.locator('#quiz-next').click();
  await page.reload();assert.deepEqual(await page.evaluate(()=>Core.flatten(deck().chapters).map(c=>c.type)),['true-false','short-answer','multiple-choice']);
  assert.equal(await page.evaluate(()=>StorageModel.migrate(StorageModel.backup(store)).decks[0].chapters[0].sections[0].cards[1].answer),'Earth');
  if(process.argv[2]) {
   await page.locator('#quiz-file-input').setInputFiles(process.argv[2]);await page.waitForSelector('#quiz-import-form');
   const report=await page.evaluate(()=>({count:pending.parsed.questions.length,types:pending.parsed.questions.reduce((a,q)=>(a[q.type]=(a[q.type]||0)+1,a),{}),issues:pending.parsed.questions.filter(q=>q.issues.length).map(q=>({word:q.word,issues:q.issues}))}));
   console.log(JSON.stringify(report,null,2));assert.equal(report.count,90);assert.deepEqual(report.types,{'true-false':30,'multiple-choice':30,'short-answer':30});assert.deepEqual(report.issues,[]);
  }
  assert.deepEqual(errors,[]);console.log('Mixed quiz: DOCX import, types, typing/choice grading, keyboard bounds, reload and backup passed.');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
