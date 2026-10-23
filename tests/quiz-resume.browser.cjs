const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.join(__dirname,'..'),html=require('./helpers/app.cjs').readAppHtml(),hash=html.match(/const ACCESS_HASH\s*=\s*'([a-f0-9]+)'/)[1];
const {DOMParser}=require('linkedom'),Core=new Function('DOMParser',html.match(/<script id="core">([\s\S]*?)<\/script>/)[1]+';return Core;')(DOMParser);
const questions=[{word:'First',type:'short-answer',options:[],answer:'one',note:'',issues:[]},{word:'Second',type:'short-answer',options:[],answer:'two',note:'',issues:[]}];
const deck={id:'resume-test',kind:'quiz',name:'Resume test',language:'vi-VN',hasChapters:false,chapters:Core.questionChapters(questions),organization:{mode:'merged',dedupe:false},progress:{},activity:[],records:{},quizMemory:{}};
const fixture={app:'la-vocab',version:2,decks:[deck],activeDeckId:deck.id,settings:{theme:'light',sound:false}};
const server=http.createServer((req,res)=>{const file=path.join(root,req.url==='/'?'index.html':req.url);res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':/\.css$/.test(file)?'text/css':'text/html; charset=utf-8');res.end(fs.readFileSync(file));});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  const context=await browser.newContext();await context.addInitScript(({hash,fixture})=>{localStorage.setItem('la-access-v2',hash);localStorage.setItem('la-vocab-v2',JSON.stringify(fixture));},{hash,fixture});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
  const click=async a=>page.locator(`[data-action="${a}"]`).first().click();
  await click('open-deck');await click('quiz-setup');
  await page.locator('#quiz-shuffle').uncheck();await page.locator('#quiz-repeat').check();await page.locator('#quiz-time').selectOption('30');await click('start-quiz');
  await page.locator('#quiz-answer-input').fill('wrong');await page.locator('#quiz-answer-form button').click();await click('quiz-next');
  await page.locator('#quiz-answer-input').fill('tw');
  const before=await page.evaluate(()=>({remaining:quiz.remaining,index:quiz.index,queue:quiz.questions.map(q=>q.card.id),run:quiz.runId}));
  await page.reload();assert.equal(await page.evaluate(()=>view),'quiz');
  assert.equal(await page.locator('#quiz-answer-input').inputValue(),'tw');
  const after=await page.evaluate(()=>({remaining:quiz.remaining,index:quiz.index,queue:quiz.questions.map(q=>q.card.id),run:quiz.runId}));
  assert.equal(after.index,before.index);assert.equal(after.run,before.run);assert.deepEqual(after.queue,before.queue);assert.ok(after.remaining<=before.remaining && after.remaining>before.remaining-3000);
  await page.locator('#quiz-answer-input').fill('two');await page.locator('#quiz-answer-form button').click();
  const score=await page.evaluate(()=>quiz.score);await page.reload();assert.equal(await page.evaluate(()=>view),'quiz');
  assert.equal(await page.evaluate(()=>quiz.answered),true);assert.equal(await page.evaluate(()=>quiz.score),score);assert.equal(await page.evaluate(()=>quiz.results.length),2);
  await click('quiz-next');assert.equal(await page.evaluate(()=>question().repeat),true);
  page.once('dialog',d=>d.accept());await click('exit-study');await click('continue-quiz-draft');
  await page.locator('#quiz-answer-input').fill('one');await page.locator('#quiz-answer-form button').click();await click('quiz-next');
  assert.equal(await page.evaluate(()=>localStorage.getItem(StorageModel.key('session',deck().id))),null);
  assert.equal(await page.evaluate(()=>Object.values(deck().records).flat().length),1);
  await click('quiz-setup');await click('start-quiz');page.once('dialog',d=>d.accept());await click('exit-study');
  assert.equal(await page.locator('.active-session-row').count(),1);page.once('dialog',d=>d.accept());await click('delete-quiz-draft');assert.equal(await page.locator('.active-session-row').count(),0);
  await page.reload();assert.equal(await page.locator('.active-session-row').count(),0);
  // Invalid JSON stays removable rather than breaking the dashboard.
  await page.evaluate(()=>localStorage.setItem(StorageModel.key('session',deck().id),'{broken'));
  await page.reload();assert.equal(await page.locator('[data-action="continue-quiz-draft"]:not([disabled])').count(),0);page.once('dialog',d=>d.accept());await click('delete-quiz-draft');
  for (const width of [1440,768,390]) {await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  assert.deepEqual(errors,[]);console.log('Quiz resume: reload, draft input, remaining time, score, repeat queue, exit/resume, completed cleanup, deletion, invalid data and responsive actions passed.');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});

