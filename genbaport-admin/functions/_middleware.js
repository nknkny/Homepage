const USERNAME='genbaport';
const PASSWORD_SHA256='48a096d8c6abb2871166e68303a1a85806142ba86e115d36f8b552c7be62243a';

function unauthorized(){
  return new Response('Authentication required',{status:401,headers:{
    'WWW-Authenticate':'Basic realm="GENBA PORT OPS", charset="UTF-8"',
    'Cache-Control':'no-store',
    'X-Robots-Tag':'noindex, nofollow, noarchive'
  }});
}
function safeEqual(a,b){
  if(a.length!==b.length)return false;
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
async function sha256(text){
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function onRequest(context){
  const header=context.request.headers.get('Authorization')||'';
  if(!header.startsWith('Basic '))return unauthorized();
  let decoded='';
  try{decoded=atob(header.slice(6))}catch{return unauthorized()}
  const p=decoded.indexOf(':');
  if(p<0)return unauthorized();
  const user=decoded.slice(0,p),password=decoded.slice(p+1);
  const hash=await sha256(password);
  if(!safeEqual(user,USERNAME)||!safeEqual(hash,PASSWORD_SHA256))return unauthorized();
  const response=await context.next();
  const h=new Headers(response.headers);
  h.set('Cache-Control','no-store, private');
  h.set('X-Robots-Tag','noindex, nofollow, noarchive, nosnippet');
  h.set('X-Frame-Options','DENY');
  h.set('X-Content-Type-Options','nosniff');
  h.set('Referrer-Policy','no-referrer');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
}
