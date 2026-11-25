'use strict';
const fs=require('node:fs');const path=require('node:path');
function finalize(name,h) {
 const editorial=/^(?:index|service|faq|request|report-sample|payment|commercial|service-terms|aomori-city|aomori-vacant-house-(?:checklist|one-time-check|photo-report)|inherited-home-aomori|parent-facility-home-aomori|remote-home-aomori|snow-vacant-home-aomori|vacant-home-(?:after-storm|notice|weeds)-aomori|about|contact|404)\.html$/.test(name);
 const text=s=>s.replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim();
 const href=x=>(x.match(/\bhref\s*=\s*["']([^"']+)["']/i)||[])[1]||"";
 const target=x=>href(x).replace(/^https:\/\/akiya-pocket-aomori\.pages\.dev\//i,"").replace(/^\.?\//,"").split(/[?#]/)[0];
 const isRequest=x=>/^(?:request)(?:\.html)?$/.test(target(x))||(editorial&&/^(?:register|member-login|member)(?:\.html)?$/.test(target(x)));
 const A=/<a\b[^>]*>[\s\S]*?<\/a>/gi;
 const normalize=x=>x.replace(/\bhref\s*=\s*["'][^"']+["']/i,`href="${/^request(?:\.html)?$/.test(target(x))?href(x):"request.html"}"`).replace(/>[\s\S]*<\/a>$/,">現地確認を依頼する</a>");
 if(editorial){
   h=h.replace(/<a\b[^>]*class=["'][^"']*\bcard\b[^"']*["'][^>]*>(?:(?!<\/a>)[\s\S])*?<h3>\s*(?:新規無料会員登録|ログイン)\s*<\/h3>(?:(?!<\/a>)[\s\S])*?<\/a>/gi,"");
   h=h.replace(/<article\b[^>]*>(?:(?!<\/article>)[\s\S])*?<h3>\s*新規無料会員登録\s*<\/h3>(?:(?!<\/article>)[\s\S])*?<\/article>/gi,"");
   h=h.replace(/<p\b([^>]*)>(?:(?!<\/p>)[\s\S])*?<\/p>/gi,(p,attrs)=>{
     const t=text(p);
     if(/^すでに会員の方は/.test(t))return "";
     if(/^(?:現地確認の)?依頼するできます[。]|^(?:現地確認の)?依頼には無料会員登録が必要/.test(t)){
       if(t.includes("まだ依頼しない方は"))return p.replace("依頼するできます。","事前登録は不要です。");
       return `<p${attrs}>事前登録は不要です。</p>`;
     }
     if(/^無料会員は登録料0円|^無料会員向けのインタラクティブ版|^公開チェックリストは登録不要です。後から依頼したい方は/.test(t))return `<p${attrs}>公開チェックリストは無料です。現地確認は事前登録なしで依頼できます。</p>`;
     if(/^登録料0円・月額0円。登録だけでは料金は発生しません/.test(t))return "";
     return p.replace("会員登録は登録料0円・月額0円で、登録だけでは課金されません。","").replace("会員登録は登録料・月額0円。","");
   });
   const pairs=[
     ["依頼するできますが、登録しただけでは料金は発生しません。",""],
     ["保存して後から続けたい場合だけ、無料会員版を使えます。",""],
     ["無料会員版では確認済み・未確認の状態を端末内に保存して、後から続けられます。",""],
     ["チェック状態を保存したい場合だけ無料会員登録を選べます。",""],
     ["保存したい場合だけ無料会員登録へ進めます。",""],
     ["会員登録後、物件情報などを入力して","物件情報などを入力して"],
     ["登録時に必要なのは、お名前・メールアドレス・パスワードの3項目だけです。",""],
     ["<b>無料会員</b>は登録料0円・月額0円で、チェック状態の保存や現地確認の依頼に使います。",""],
     ["<b>新規無料会員登録：</b>登録料0円・月額0円。チェック状態を保存したい場合に使います。登録だけでは現地確認料金は発生しません。<br>",""],
     ["<br><b>ログイン：</b>すでに無料会員の方の入口です。",""],
     ["<strong>新規無料会員登録</strong>は登録料0円・月額0円。すでに会員の方は<strong>ログイン</strong>できます。",""],
     ["チェック状態を保存して使う","現地確認が必要な場合"],
     ["依頼するできます","依頼できます"]
   ];for(const [x,y] of pairs)h=h.split(x).join(y);
   h=h.replace(/(<h[1-6]\b[^>]*>)無料チェック・無料会員(?:登録)?・[^<]*?は別です(<\/h[1-6]>)/g,"$1無料チェックと現地確認について$2");
   h=h.replace(A,x=>isRequest(x)&&/会員|ログイン|チェック状態を.*保存/.test(text(x))&&!/<h[1-6]/i.test(x)?normalize(x):x);
 }
 const groups=/<(div|nav)\b[^>]*class=["'][^"']*\b(?:header-actions|mobile-bar|form-actions|hero-actions|actions)\b[^"']*["'][^>]*>(?:(?!<\/?(?:div|nav)\b)[\s\S])*?<\/\1>/gi;
 h=h.replace(groups,b=>{const m=[...b.matchAll(A)].map(x=>x[0]).filter(isRequest);if(m.length<=1)return b;const best=m.find(x=>/btn-primary/.test(x))||m[0];let used=false;return b.replace(A,x=>{if(!isRequest(x))return x;if(x===best&&!used){used=true;return normalize(x)}return ""})});
 h=h.replace(/<footer\b[\s\S]*?<\/footer>/gi,b=>{let used=false;return b.replace(A,x=>{if(editorial&&/無料会員規約/.test(text(x)))return "";if(!isRequest(x))return x;if(used)return "";used=true;return editorial?normalize(x):x}).replace(/(?:<br\s*\/?>\s*){2,}/gi,"<br>")});
 if(name==="index.html"){h=h.replace(/(<div class="warm-hero-price")><span>青森の外観確認<\/span>/,'$1 aria-label="青森の外観確認">').replace(/<div class="craft-price-ribbon">ONE-TIME PHOTO CHECK<\/div><span>青森の外観確認・1物件<\/span>/,"");if(!/対応地域[：:]?\s*青森市・むつ市/.test(text(h)))h=h.replace(/(<p class="warm-lead">[\s\S]*?<\/p>)/,'$1<p class="small">対応地域：青森市・むつ市</p>')}
 if(name==="request.html"){h=h.replace(/<p>青森の外観現地確認<\/p>/,"");if(!/対応地域[：:]?\s*青森市・むつ市/.test(text(h)))h=h.replace(/(<div class="warm-price-line">[\s\S]*?<\/div>)/,'$1<p>対応地域：青森市・むつ市</p>')}
 if(name==="service.html")h=h.replace("青森の外観現地確認は3,480円（税込）。","外観現地確認は3,480円（税込）です。対応地域：青森市・むつ市。");
 if(name==="service-terms.html")h=h.replace("青森の外観現地確認は1物件1回3,480円（税込）です。","青森市・むつ市の外観現地確認は1物件1回3,480円（税込）です。追加料金はありません。").replace("その個別条件を優先します。ただし、法令上無効となる条件は適用しません。","その個別条件を優先します。ただし、現地確認の料金は1物件1回3,480円（税込）です。法令上無効となる条件は適用しません。");
 if(name==="commercial.html")h=h.replace("青森の外観現地確認は1物件1回3,480円（税込）です。","青森市・むつ市の外観現地確認は1物件1回3,480円（税込）です。追加料金はありません。");
 return h;
}
function audit(name,h){
 const visible=h.replace(/<script\b[\s\S]*?<\/script>/gi,"").replace(/<style\b[\s\S]*?<\/style>/gi,"").replace(/<[^>]*>/g,"");
 const isReq=x=>/\bhref=["'](?:https:\/\/akiya-pocket-aomori\.pages\.dev\/|\/|\.\/)?request(?:\.html)?(?:[?#][^"']*)?["']/i.test(x);
 const groups=[...h.matchAll(/<(div|nav)\b[^>]*class=["'][^"']*\b(?:header-actions|mobile-bar|form-actions|hero-actions|actions)\b[^"']*["'][^>]*>(?:(?!<\/?(?:div|nav)\b)[\s\S])*?<\/\1>/gi),...h.matchAll(/<footer\b[\s\S]*?<\/footer>/gi)];
 const failures=[];
 if(groups.some(g=>[...g[0].matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)].filter(x=>isReq(x[0])).length>1))failures.push("duplicate CTA");
 if(/依頼するできます/.test(visible))failures.push("broken Japanese");
 if(/3,480\s*円(?:[（(]税込[）)])?\s*(?:から|〜|～|より)|正式料金|個別見積もり|出張料金/.test(visible))failures.push("variable price");
 return failures;
}
module.exports={finalize,audit};
if(require.main===module){const root=process.argv[2]||'dist';const names=fs.readdirSync(root).filter(n=>n.endsWith('.html'));const results=names.map(n=>{const p=path.join(root,n),before=fs.readFileSync(p,'utf8'),after=finalize(n,before),flags=audit(n,after);if(finalize(n,after)!==after)flags.push('non-idempotent');if(n==='report-sample.html'){const extract=s=>s.match(/<section class="section"><div class="wrap"><div class="section-title"><span class="kicker">SAMPLE[\s\S]*?<\/section>/)?.[0];if(extract(before)&&extract(before)!==extract(after))flags.push('report sample changed')}return {p,n,before,after,flags}});const failures=results.filter(r=>r.flags.length);if(failures.length){console.error(JSON.stringify(failures.map(({n,flags})=>({n,flags}))));process.exit(1)}for(const r of results)if(r.before!==r.after)fs.writeFileSync(r.p,r.after);console.log(JSON.stringify({htmlCount:results.length,changed:results.filter(r=>r.before!==r.after).length,failures:0}));}
