/* 티끌모아 기기연결(동기화). app.js 다음에 읽힌다.
 * - 연결 코드(20자리)로 기기를 묶는다. 로그인 없음.
 * - 내용은 연결 코드로 만든 열쇠로 이 기기에서 잠근(AES-GCM) 뒤 Firestore에 올린다.
 *   서버에는 코드도, 내용도 남지 않는다(문서 이름 = 코드의 해시).
 * - 새 코드를 만들 때만 초대 암호가 필요하다(Firestore 규칙에서 확인).
 * - 항목(날짜·반복·생일·미팅·메모)마다 마지막 수정 시각을 따로 기록해서, 두 기기에서 고친 내용을 합친다.
 */
const SYNC_CFG={projectId:'',apiKey:''}; // Firebase 프로젝트 값 (설정 후 채움)
(function(){
const T=window.__SYNC_TEST||null; // 시험용
const projectId=(T&&T.projectId)||SYNC_CFG.projectId, apiKey=(T&&T.apiKey)||SYNC_CFG.apiKey;
const BASE=(T&&T.base)||('https://firestore.googleapis.com/v1/projects/'+projectId+'/databases/(default)/documents');
const ENABLED=!!(projectId&&apiKey&&window.crypto&&crypto.subtle);
const btn=$('syncOpen');
if(!ENABLED){ if(btn) btn.hidden=true; return; }

const K={code:'sync-code',meta:'sync-meta',hash:'sync-hash',last:'sync-last',pre:'sync-preSync'};
const lsGet=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
const lsDel=k=>{try{localStorage.removeItem(k);}catch(e){}};
const jget=(k,d)=>{try{return JSON.parse(lsGet(k))||d;}catch(e){return d;}};

const ABC='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const normCode=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/[IO01]/g,'');
const showCode=c=>c.replace(/(.{4})(?=.)/g,'$1-');
function newCode(){const a=new Uint8Array(20);crypto.getRandomValues(a);return Array.from(a,x=>ABC[x&31]).join('');}

/* ---- 열쇠 ---- */
const te=new TextEncoder(), td=new TextDecoder();
const b64=u=>{let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s);};
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
let keyCache=null;
async function keysFor(code){
  if(keyCache&&keyCache.code===code) return keyCache;
  const h=new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode('tikkeul-id:'+code)));
  const id=Array.from(h,x=>x.toString(16).padStart(2,'0')).join('').slice(0,40);
  const base=await crypto.subtle.importKey('raw',te.encode(code),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:te.encode('tikkeul-sync-v1'),iterations:150000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  keyCache={code,id,key}; return keyCache;
}
async function seal(key,obj){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,te.encode(JSON.stringify(obj))));
  const out=new Uint8Array(12+ct.length);out.set(iv);out.set(ct,12);return b64(out);
}
async function unseal(key,s){
  const u=unb64(s);
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:u.subarray(0,12)},key,u.subarray(12));
  return JSON.parse(td.decode(pt));
}

/* ---- 서버 (Firestore REST) ---- */
class SyncErr extends Error{constructor(kind,status){super(kind);this.kind=kind;this.status=status;}}
async function rGet(id){
  let r; try{r=await fetch(BASE+'/sync/'+id+'?key='+apiKey,{cache:'no-store'});}catch(e){throw new SyncErr('offline');}
  if(r.status===404) return null;
  if(!r.ok) throw new SyncErr(r.status===403?'denied':'server',r.status);
  const j=await r.json();
  return {c:j.fields&&j.fields.c&&j.fields.c.stringValue, ut:j.updateTime};
}
async function rPut(id,c,ut,invite){
  const fields={c:{stringValue:c},v:{integerValue:'1'}};
  if(invite!=null) fields.inv={stringValue:invite};
  const pre=ut?'currentDocument.updateTime='+encodeURIComponent(ut):'currentDocument.exists=false';
  let r; try{r=await fetch(BASE+'/sync/'+id+'?key='+apiKey+'&'+pre,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields})});}catch(e){throw new SyncErr('offline');}
  if(r.ok){const j=await r.json();return j.updateTime;}
  if(r.status===403) throw new SyncErr('denied',403);
  if(r.status===400||r.status===409||r.status===412) throw new SyncErr('conflict',r.status);
  throw new SyncErr('server',r.status);
}

/* ---- 항목 단위로 펼치기 / 모으기 ---- */
function flat(){
  const o={};
  for(const k in days) o['d:'+k]=days[k];
  routines.forEach((x,i)=>{o['r:'+(x.id||'#'+i)]=x;});
  bdays.forEach((x,i)=>{o['b:'+(x.id||'#'+i)]=x;});
  meetings.forEach((x,i)=>{o['m:'+(x.id||'#'+i)]=x;});
  for(const k in mnotes) o['n:'+k]=mnotes[k];
  return o;
}
function unflat(items){
  const nd={},nn={},arr={r:[],b:[],m:[]};
  const cur={r:routines,b:bdays,m:meetings}, pos={};
  for(const t in cur) cur[t].forEach((x,i)=>{pos[t+':'+(x.id||'#'+i)]=i;});
  const keys=Object.keys(items).sort((a,b)=>(pos[a]??1e9)-(pos[b]??1e9));
  for(const k of keys){
    const t=k[0], rest=k.slice(2), v=items[k];
    if(t==='d') nd[rest]=v; else if(t==='n') nn[rest]=v; else if(arr[t]) arr[t].push(v);
  }
  Object.values(nd).forEach(d=>{d.items=d.items||[];d.rdone=d.rdone||{};d.skip=d.skip||[];});
  return {days:nd,routines:arr.r,bdays:arr.b,meetings:arr.m,mnotes:nn};
}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}

/* 저장할 때마다 바뀐 항목에 시각 기록. meta: {key: 시각(+있음 / -지움)} */
function markChanges(baseTs){
  const now=baseTs||Date.now(), f=flat(), meta=jget(K.meta,{}), hs=jget(K.hash,{}), nh={};
  for(const k in f){ const h=hash(JSON.stringify(f[k])); nh[k]=h; if(hs[k]!==h||!(meta[k]>0)) meta[k]=now; }
  for(const k in hs){ if(!(k in f)) meta[k]=-now; }
  lsSet(K.meta,JSON.stringify(meta)); lsSet(K.hash,JSON.stringify(nh));
}
/* 두 쪽 합치기: 항목마다 더 나중에 고친 쪽이 이김 (같으면 서버 쪽) */
function merge(L,R){
  const items={},meta={};
  const keys=new Set([...Object.keys(L.meta),...Object.keys(R.meta),...Object.keys(L.items),...Object.keys(R.items)]);
  for(const k of keys){
    const lt=L.meta[k]||0, rt=R.meta[k]||0;
    const win=Math.abs(lt)>Math.abs(rt)?'L':'R';
    const t=win==='L'?lt:rt, src=win==='L'?L:R;
    meta[k]=t;
    if(t>=0&&k in src.items) items[k]=src.items[k];
    else if(t>=0){ const o=win==='L'?R:L; if(k in o.items) items[k]=o.items[k]; }
  }
  return {items,meta};
}

/* ---- 화면 ---- */
const st={busy:false,again:false,timer:null,poll:null,lastOk:Number(lsGet(K.last)||0),err:''};
const code=()=>lsGet(K.code);
const fmtTime=t=>{const d=new Date(t);return (d.getHours()<12?'오전 ':'오후 ')+((d.getHours()%12)||12)+':'+String(d.getMinutes()).padStart(2,'0');};
function drawSync(){
  const c=code(); $('syncOff').hidden=!!c; $('syncOn').hidden=!c;
  if(c){
    $('syncCodeTxt').textContent=showCode(c);
    $('syncState').textContent=st.busy?'맞추는 중…':st.err?st.err:st.lastOk?'✅ 연결됨 · 마지막으로 맞춘 때 '+fmtTime(st.lastOk):'✅ 연결됨';
    $('syncState').classList.toggle('bad',!!st.err&&!st.busy);
  }
  if(btn) btn.classList.toggle('on',!!c);
}
const panelOpen=()=>!$('syncPanel').hidden;
function setStatus(){ if(code()) $('status').textContent='여러 기기에서 함께 쓰는 중이에요 (기기연결).'; }
const errMsg=e=>e&&e.kind==='offline'?'인터넷이 연결되면 다시 맞출게요.':e&&e.kind==='denied'?'저장소가 거절했어요. 잠시 뒤 다시 해 주세요.':'저장소와 맞추지 못했어요. 잠시 뒤 다시 할게요.';

/* 입력 중이거나 미팅 창이 열려 있으면 화면을 바꾸지 않도록 잠시 미룸 */
function busyUI(){
  const a=document.activeElement;
  if(typeof sheet!=='undefined'&&sheet) return true;
  // 화면을 다시 그릴 때 새로 만들어지는 입력칸(목록 안 수정·이동 칸 등, id 없음)에 쓰는 중일 때만 미룸
  return !!(a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA')&&a.type!=='checkbox'&&(!a.id||a.id.startsWith('edit-')));
}
function applyLocal(m){
  const now=flat(), changed=Object.keys(m.items).length!==Object.keys(now).length||Object.keys(m.items).some(k=>!(k in now)||JSON.stringify(now[k])!==JSON.stringify(m.items[k]));
  lsSet(K.meta,JSON.stringify(m.meta));
  if(changed){
    const x=unflat(m.items);
    days=x.days; routines=x.routines; bdays=x.bdays; meetings=x.meetings; mnotes=x.mnotes;
    if(typeof hideUndo==='function') hideUndo();
    origSave();
    try{render(); if(!$('bdayPanel').hidden) drawBdays(); if(!$('issuePanel').hidden) drawIssues(); checkRemind();}catch(e){}
  }
  const nh={}; const f=flat(); for(const k in f) nh[k]=hash(JSON.stringify(f[k])); lsSet(K.hash,JSON.stringify(nh));
  return changed;
}
async function syncNow(opt){
  opt=opt||{};
  const c=code(); if(!c) return;
  if(st.busy){st.again=true;return;}
  if(!opt.force&&busyUI()){clearTimeout(st.timer);st.timer=setTimeout(()=>syncNow(),3000);return;}
  st.busy=true; st.err=''; if(panelOpen()) drawSync();
  try{
    const {id,key}=await keysFor(c);
    for(let tries=0;;tries++){
      const rem=await rGet(id);
      let R={items:{},meta:{}};
      if(rem&&rem.c) R=await unseal(key,rem.c);
      else if(!rem&&!opt.creating) throw new SyncErr('gone');
      const L={items:flat(),meta:jget(K.meta,{})};
      const m=merge(L,R);
      const same=JSON.stringify(m.meta)===JSON.stringify(R.meta);
      if(!same||!rem){
        try{ await rPut(id,await seal(key,m),rem?rem.ut:null,opt.creating&&!rem?opt.invite:null); }
        catch(e){ if(e.kind==='conflict'&&tries<3) continue; throw e; }
      }
      applyLocal(m);
      break;
    }
    st.lastOk=Date.now(); lsSet(K.last,String(st.lastOk));
  }catch(e){
    if(e&&e.kind==='gone'){ st.err='이 코드의 저장소를 찾지 못했어요.'; }
    else if(e instanceof SyncErr) st.err=errMsg(e);
    else st.err='내용을 풀지 못했어요. 연결 코드를 확인해 주세요.';
    if(opt.throwErr){st.busy=false;drawSync();throw e;}
  }finally{
    st.busy=false; if(panelOpen()) drawSync();
    if(st.again){st.again=false;setTimeout(()=>syncNow(),300);}
  }
}

/* 저장할 때 시각 기록 + 조금 뒤 올리기 */
const origSave=saveLocal;
saveLocal=function(){ origSave(); if(code()){ markChanges(); clearTimeout(st.timer); st.timer=setTimeout(()=>syncNow(),1500); } };

function startLoop(){
  clearInterval(st.poll);
  if(!code()) return;
  st.poll=setInterval(()=>{ if(document.visibilityState==='visible') syncNow(); },30000);
}
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') syncNow(); });
window.addEventListener('online',()=>syncNow());

/* ---- 연결하기 ---- */
async function createCode(){
  const inv=$('syncInvite').value.trim();
  if(!inv){toast('초대 암호를 넣어 주세요.');$('syncInvite').focus();return;}
  const c=newCode(), t=Date.now();
  lsSet(K.code,c); lsSet(K.meta,'{}'); lsSet(K.hash,'{}'); markChanges(t);
  $('syncMake').disabled=true;
  try{
    await syncNow({creating:true,invite:inv,force:true,throwErr:true});
    // 첫 저장에만 초대 암호가 들어가므로 곧바로 한 번 더 저장해서 지운다
    const {id,key}=await keysFor(c); const rem=await rGet(id);
    if(rem) await rPut(id,rem.c,rem.ut,null);
    $('syncInvite').value=''; toast('연결 코드를 만들었어요. 다른 기기에 이 코드를 넣으세요.'); startLoop(); setStatus();
  }catch(e){
    lsDel(K.code); lsDel(K.meta); lsDel(K.hash); lsDel(K.last); st.err='';
    toast(e&&e.kind==='denied'?'초대 암호가 맞지 않아요.':e&&e.kind==='offline'?'인터넷 연결을 확인해 주세요.':'코드를 만들지 못했어요. 잠시 뒤 다시 해 주세요.');
  }finally{ $('syncMake').disabled=false; drawSync(); }
}
async function joinCode(raw){
  const c=normCode(raw);
  if(c.length!==20){toast('연결 코드는 20자리예요. 다시 확인해 주세요.');return;}
  $('syncJoin').disabled=true;
  try{
    const {id,key}=await keysFor(c);
    const rem=await rGet(id);
    if(!rem){toast('이 코드로 된 저장소가 없어요. 코드를 확인해 주세요.');return;}
    try{ await unseal(key,rem.c); }catch(e){toast('코드가 맞지 않아요.');return;}
    // 혹시 몰라 연결 전 내용을 이 기기에 한 벌 남겨 둔다
    lsSet(K.pre,JSON.stringify({at:Date.now(),days,routines,bdays,meetings,mnotes}));
    // 이 기기에 있던 내용은 '아주 예전'으로 표시 → 겹치면 저장소 쪽, 이 기기에만 있는 건 그대로 합침
    lsSet(K.code,c); lsSet(K.meta,'{}'); lsSet(K.hash,'{}'); markChanges(1);
    await syncNow({force:true,throwErr:true});
    $('syncCodeIn').value=''; toast('연결했어요. 두 기기 내용을 합쳤어요.'); startLoop(); setStatus();
  }catch(e){
    lsDel(K.code); lsDel(K.meta); lsDel(K.hash); st.err='';
    toast(e&&e.kind==='offline'?'인터넷 연결을 확인해 주세요.':'연결하지 못했어요. 잠시 뒤 다시 해 주세요.');
  }finally{ $('syncJoin').disabled=false; drawSync(); }
}
function disconnect(){
  const b=$('syncOff2');
  if(!b.classList.contains('armed')){b.classList.add('armed');b.textContent='한 번 더 누르면 끊어요';setTimeout(()=>{b.classList.remove('armed');b.textContent='연결끊기';},4000);return;}
  b.classList.remove('armed'); b.textContent='연결끊기';
  [K.code,K.meta,K.hash,K.last].forEach(lsDel); clearInterval(st.poll); keyCache=null; st.err=''; st.lastOk=0;
  $('status').textContent='이 기기에만 저장돼요. 가끔 백업해 두세요.';
  drawSync(); toast('연결을 끊었어요. 이 기기의 내용은 그대로 있어요.');
}
async function copy(txt,msg){
  try{await navigator.clipboard.writeText(txt);toast(msg);}
  catch(e){ const t=document.createElement('textarea');t.value=txt;document.body.appendChild(t);t.select();try{document.execCommand('copy');toast(msg);}catch(er){toast(txt);}t.remove(); }
}

/* ---- 버튼 ---- */
function openSync(){
  $('issuePanel').hidden=true; $('purge').hidden=true; if(typeof endBdayEdit==='function')endBdayEdit(); $('bdayPanel').hidden=true;
  drawSync(); $('syncPanel').hidden=false; $('syncPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
  if(code()) syncNow();
}
btn.onclick=openSync;
$('syncClose').onclick=()=>{$('syncPanel').hidden=true;};
// 다른 창을 열면 기기연결 창은 닫기
['bdayOpen','issueOpen','purgeOpen'].forEach(i=>{const e=$(i); if(e) e.addEventListener('click',()=>{$('syncPanel').hidden=true;});});
$('syncMake').onclick=createCode;
$('syncJoin').onclick=()=>joinCode($('syncCodeIn').value);
$('syncCodeIn').onkeydown=e=>{if(e.key==='Enter')joinCode($('syncCodeIn').value);};
$('syncCopy').onclick=()=>copy(showCode(code()),'연결 코드를 복사했어요.');
$('syncLink').onclick=()=>copy(location.origin+location.pathname+'#sync='+code(),'연결 링크를 복사했어요. 다른 기기에서 열어 주세요.');
$('syncNowBtn').onclick=()=>syncNow({force:true});
$('syncOff2').onclick=disconnect;

/* 링크로 열었을 때 (#sync=코드) */
function fromLink(){
  const m=location.hash.match(/sync=([A-Za-z0-9-]+)/);
  if(!m) return;
  history.replaceState(null,'',location.pathname+location.search);
  const c=normCode(m[1]);
  if(code()===c){ toast('이미 연결된 기기예요.'); }
  else if(code()){ openSync(); toast('이 기기는 이미 다른 코드로 연결돼 있어요. 먼저 연결을 끊어 주세요.'); }
  else { openSync(); $('syncCodeIn').value=showCode(c); toast('연결 코드를 받았어요. [연결]을 눌러 주세요.'); }
}
fromLink(); window.addEventListener('hashchange',fromLink);

drawSync();
if(code()){ setStatus(); startLoop(); syncNow(); }
window.__sync={syncNow,merge,flat,unflat}; // 시험용
})();
