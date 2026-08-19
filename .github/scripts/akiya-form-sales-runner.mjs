import { chromium } from 'playwright';
import crypto from 'node:crypto';

const WORKER=process.env.WORKER_URL;
const OIDC=process.env.OIDC_TOKEN;
if(!WORKER||!OIDC) throw new Error('worker auth missing');
const claimToken=crypto.randomBytes(32).toString('base64url');
const refuse=/(営業(?:目的|メール|連絡|勧誘|セールス).{0,14}(?:お断り|禁止|ご遠慮)|(?:セールス|勧誘).{0,14}(?:お断り|禁止|ご遠慮)|no\s+(?:sales|solicitation)|sales\s+(?:prohibited|not\s+accepted))/i;
const successDefault=/(送信(?:が)?完了|送信しました|お問い合わせありがとうございます|受付(?:が)?完了|thank\s+you|message\s+(?:was\s+)?sent)/i;

async function call(body){
  const r=await fetch(WORKER,{method:'POST',headers:{authorization:`Bearer ${OIDC}`,'content-type':'application/json'},body:JSON.stringify(body)});
  const x=await r.json().catch(()=>({}));
  if(!r.ok||!x.ok) throw new Error(`worker ${r.status} ${x.code||'error'}`);
  return x;
}
function sameSite(official,form){
  try{const a=new URL(official),b=new URL(form);if(b.protocol!=='https:')return false;const ah=a.hostname.replace(/^www\./,''),bh=b.hostname.replace(/^www\./,'');return ah===bh||ah.endsWith('.'+bh)||bh.endsWith('.'+ah)}catch{return false}
}
async function report(job,outcome,resultSummary='',resultUrl='',error=''){
  try{await call({action:'report',formId:job.formId,claimToken,outcome,resultSummary,resultUrl,error})}catch(e){console.error('report failed',job.formId,e.message)}
}

const claimed=await call({action:'claim',claimToken,limit:3});
console.log(`claimed=${claimed.count}`);
if(!claimed.count) process.exit(0);
const browser=await chromium.launch({headless:true});
for(const job of claimed.jobs){
  const page=await browser.newPage({locale:'ja-JP'});
  try{
    if(!sameSite(job.officialUrl,job.formUrl)){await report(job,'held','公式サイトとフォームのドメイン一致を確認できないため保留');continue}
    await page.goto(job.formUrl,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(1200);
    const bodyText=(await page.locator('body').innerText({timeout:5000}).catch(()=>''))||'';
    if(refuse.test(bodyText)){await report(job,'held','送信直前ページで営業・勧誘拒否表示を検出',page.url());continue}
    const captcha=await page.locator('iframe[src*="recaptcha"],iframe[src*="turnstile"],[class*="captcha" i],[id*="captcha" i],input[name*="captcha" i]').count();
    if(captcha>0||/reCAPTCHA|Turnstile|私はロボットではありません/.test(bodyText)){await report(job,'held','CAPTCHA/ボット対策を検出したため自動送信しない',page.url());continue}
    const passwordFields=await page.locator('input[type="password"]').count();
    if(passwordFields>0){await report(job,'held','ログイン必須フォームのため自動送信しない',page.url());continue}
    for(const f of job.fieldMap||[]){
      const loc=page.locator(f.selector).first();
      if(await loc.count()===0) throw new Error(`field not found: ${f.selector}`);
      if(f.action==='check') await loc.check({timeout:5000});
      else if(f.action==='select') await loc.selectOption(f.value,{timeout:5000});
      else await loc.fill(String(f.value??''),{timeout:5000});
    }
    const submit=page.locator(job.submitSelector).first();
    if(await submit.count()===0) throw new Error('submit button not found');
    if(!(await submit.isEnabled())) throw new Error('submit button disabled');
    const before=page.url();
    await submit.click({timeout:8000});
    await Promise.race([page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{}),page.waitForTimeout(3500)]);
    const afterText=(await page.locator('body').innerText({timeout:5000}).catch(()=>''))||'';
    const confirmation=String(job.confirmationText||'').trim();
    const confirmed=confirmation?afterText.includes(confirmation):successDefault.test(afterText);
    if(!confirmed){await report(job,'held','送信完了表示を確認できないため、送信済みと断定せず保留',page.url());continue}
    await report(job,'submitted',`フォーム送信完了を確認。遷移=${before!==page.url()?'あり':'なし'}`,page.url());
    console.log(`submitted ${job.formId} ${job.companyName}`);
  }catch(e){
    await report(job,'failed','フォーム自動送信処理でエラー',page.url(),String(e?.message||e));
    console.error(`failed ${job.formId}`,e?.message||e);
  }finally{await page.close()}
}
await browser.close();
