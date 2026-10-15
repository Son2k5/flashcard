const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.join(__dirname,'..'),html=require('./helpers/app.cjs').readAppHtml(),hash=html.match(/const ACCESS_HASH='([a-f0-9]+)'/)[1];
const server=http.createServer((req,res)=>{const file=path.join(root,req.url==='/'?'index.html':req.url);res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':/\.css$/.test(file)?'text/css':'text/html; charset=utf-8');res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  const context=await browser.newContext();await context.addInitScript(hash=>localStorage.setItem('la-access-v2',hash),hash);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
  const click=async a=>page.locator(`[data-action="${a}"]`).first().click();
  await click('create-manual-deck');await page.locator('#manual-deck-name').fill('Resume test');await page.locator('#manual-type').selectOption('short-answer');
  await page.locator('#manual-word').fill('First');await page.locator('#manual-answer').fill('one');await page.locator('button[value="more"]').click();
  await page.locator('#manual-word').fill('Second');await page.locator('#manual-answer').fill('two');await page.locator('button[value="done"]').click();
  await page.locator('#quiz-shuffle').uncheck();await page.locator('#quiz-repeat').check();await page.locator('#quiz-time').selectOption('30');await click('start-quiz');
  await page.locator('#quiz-answer-input').fill('wrong');await page.locator('#quiz-answer-form button').click();await click('quiz-next');
  await page.locator('#quiz-answer-input').fill('tw');
  const before=await page.evaluate(()=>({remaining:quiz.remaining,index:quiz.index,queue:quiz.questions.map(q=>q.card.id),run:quiz.runId}));
  await page.reload();await click('continue-quiz-draft');
  assert.equal(await page.locator('#quiz-answer-input').inputValue(),'tw');
  const after=await page.evaluate(()=>({remaining:quiz.remaining,index:quiz.index,queue:quiz.questions.map(q=>q.card.id),run:quiz.runId}));
  assert.equal(after.index,before.index);assert.equal(after.run,before.run);assert.deepEqual(after.queue,before.queue);assert.ok(after.remaining<=before.remaining && after.remaining>before.remaining-3000);
  await page.locator('#quiz-answer-input').fill('two');await page.locator('#quiz-answer-form button').click();
  const score=await page.evaluate(()=>quiz.score);await page.reload();await click('continue-quiz-draft');
  assert.equal(await page.evaluate(()=>quiz.answered),true);assert.equal(await page.evaluate(()=>quiz.score),score);assert.equal(await page.evaluate(()=>quiz.results.length),2);
  await click('quiz-next');assert.equal(await page.evaluate(()=>question().repeat),true);
  page.once('dialog',d=>d.accept());await click('exit-study');await click('continue-quiz-draft');
  await page.locator('#quiz-answer-input').fill('one');await page.locator('#quiz-answer-form button').click();await click('quiz-next');
  assert.equal(await page.evaluate(()=>localStorage.getItem(StorageModel.key('session',deck().id))),null);
  assert.equal(await page.evaluate(()=>Object.values(deck().records).flat().length),1);
  await click('quiz-setup');await click('start-quiz');page.once('dialog',d=>d.accept());await click('exit-study');
  assert.equal(await page.locator('.quiz-draft').count(),1);page.once('dialog',d=>d.accept());await click('delete-quiz-draft');assert.equal(await page.locator('.quiz-draft').count(),0);
  await page.reload();assert.equal(await page.locator('.quiz-draft').count(),0);
  // Invalid JSON stays removable rather than breaking the dashboard.
  await page.evaluate(()=>localStorage.setItem(StorageModel.key('session',deck().id),'{broken'));
  await page.reload();assert.equal(await page.locator('[data-action="continue-quiz-draft"]').count(),0);page.once('dialog',d=>d.accept());await click('delete-quiz-draft');
  for (const width of [1440,768,390]) {await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  assert.deepEqual(errors,[]);console.log('Quiz resume: reload, draft input, remaining time, score, repeat queue, exit/resume, completed cleanup, deletion, invalid data and responsive actions passed.');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});

