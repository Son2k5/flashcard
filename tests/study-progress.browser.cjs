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

  await click('open-deck');
  for (const tab of ['library','hard','stats','quiz-setup','storage']) {
    await click(tab);
    await page.reload();
    assert.equal(await page.evaluate(()=>view),tab);
  }
  await click('flashcard');
  assert.equal(await page.evaluate(()=>view),'flash-setup');
  assert.equal(await page.locator('#flashcard').count(),0);
  assert.equal(await page.locator('#nav-flash').evaluate(el=>el.classList.contains('active')),true);
  await page.reload();assert.equal(await page.evaluate(()=>view),'flash-setup');
  await click('start-flash-all');
  const progress=page.locator('.study-progress [role="progressbar"]');
  assert.equal(await progress.getAttribute('aria-valuenow'),'0');
  await click('known');
  assert.equal(await progress.getAttribute('aria-valuenow'),'1');
  const current=await page.evaluate(()=>flash.queue[0]);
  await click('flip');
  await page.reload();
  assert.equal(await page.evaluate(()=>view),'flash');
  assert.equal(await page.evaluate(()=>flash.flipped),true);
  assert.equal(await progress.getAttribute('aria-valuenow'),'1');
  assert.equal(await page.evaluate(()=>flash.queue[0]),current);
  page.once('dialog',d=>d.dismiss());await click('flashcard');
  assert.equal(await page.evaluate(()=>flash.queue[0]),current);
  page.once('dialog',d=>d.dismiss());await click('exit-study');
  assert.equal(await page.evaluate(()=>view),'flash');
  page.once('dialog',d=>d.accept());await click('exit-study');
  assert.equal(await page.evaluate(()=>flash),null);
  await click('flashcard');assert.equal(await page.evaluate(()=>view),'flash-setup');
  assert.equal(await page.locator('#flashcard').count(),0);
  await page.reload();
  assert.equal(await page.locator('.active-session-row').count(),1);
  await click('continue-flash-draft');
  assert.equal(await page.evaluate(()=>flash.queue[0]),current);
  assert.equal(await progress.getAttribute('aria-valuenow'),'1');
  page.once('dialog',d=>d.accept());await click('exit-study');
  page.once('dialog',d=>d.dismiss());await click('delete-flash-draft');
  assert.equal(await page.locator('.active-session-row').count(),1);
  page.once('dialog',d=>d.accept());await click('delete-flash-draft');
  assert.equal(await page.locator('.active-session-row').count(),0);
  assert.equal(await page.evaluate(()=>Object.values(deck().progress).filter(p=>p.known).length),1);
  await page.reload();assert.equal(await page.locator('.active-session-row').count(),0);
  await click('start-flash-all');await click('known');await click('known');
  await click('library');assert.equal(await page.locator('.active-session-row').count(),0);
  await click('start-flash-all');page.once('dialog',d=>d.accept());await click('exit-study');
  await click('quiz-setup');
  await page.locator('#quiz-shuffle').uncheck();
  await page.locator('#quiz-repeat').uncheck();
  await page.locator('#quiz-time').selectOption('0');
  await click('start-quiz');
  assert.equal(await progress.getAttribute('aria-valuenow'),'0');
  await page.locator('#quiz-answer-input').fill('one');
  await page.locator('#quiz-answer-form button').click();
  assert.equal(await progress.getAttribute('aria-valuenow'),'1');
  assert.equal(await progress.getAttribute('aria-valuemax'),'2');
  await page.reload();
  assert.equal(await page.evaluate(()=>view),'quiz');
  assert.equal(await page.evaluate(()=>quiz.answered),true);
  assert.equal(await progress.getAttribute('aria-valuenow'),'1');
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await progress.isVisible(),true);
    assert.ok((await progress.boundingBox()).height>=12);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  page.once('dialog',d=>d.accept());await click('exit-study');
  assert.equal(await page.locator('.active-session-row').count(),2);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await click('continue-quiz-draft');
  assert.equal(await progress.getAttribute('aria-valuenow'),'1');
  page.once('dialog',d=>d.accept());await click('exit-study');
  page.once('dialog',d=>d.accept());await click('delete-quiz-draft');
  assert.equal(await page.locator('.active-session-row').count(),1);
  assert.deepEqual(errors,[]);
  console.log('Study progress and flashcard exit/navigation passed.');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});

