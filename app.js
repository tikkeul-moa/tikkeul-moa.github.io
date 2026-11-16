/* 티끌모아 앱 동작 (index.html에서 분리). lunar.js 다음에 읽힌다. */
const pad=n=>String(n).padStart(2,'0');
const key=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parse=k=>new Date(k+'T00:00:00');
const addDays=(k,n)=>{const d=parse(k);d.setDate(d.getDate()+n);return key(d);};
const WD=['일','월','화','수','목','금','토'];
const HOL={
'2025-01-01':'신정','2025-01-27':'임시공휴일','2025-01-28':'설날 연휴','2025-01-29':'설날','2025-01-30':'설날 연휴','2025-03-01':'삼일절','2025-03-03':'대체공휴일','2025-05-05':'어린이날·부처님오신날','2025-05-06':'대체공휴일','2025-06-03':'대통령 선거','2025-06-06':'현충일','2025-08-15':'광복절','2025-10-03':'개천절','2025-10-05':'추석 연휴','2025-10-06':'추석','2025-10-07':'추석 연휴','2025-10-08':'대체공휴일','2025-10-09':'한글날','2025-12-25':'크리스마스',
'2026-01-01':'신정','2026-02-16':'설날 연휴','2026-02-17':'설날','2026-02-18':'설날 연휴','2026-03-01':'삼일절','2026-03-02':'대체공휴일','2026-05-01':'근로자의 날','2026-05-05':'어린이날','2026-05-24':'부처님오신날','2026-05-25':'대체공휴일','2026-06-03':'지방선거','2026-06-06':'현충일','2026-07-17':'제헌절','2026-08-15':'광복절','2026-08-17':'대체공휴일','2026-09-24':'추석 연휴','2026-09-25':'추석','2026-09-26':'추석 연휴','2026-10-03':'개천절','2026-10-05':'대체공휴일','2026-10-09':'한글날','2026-12-25':'크리스마스',
'2027-01-01':'신정','2027-02-06':'설날 연휴','2027-02-07':'설날','2027-02-08':'설날 연휴','2027-02-09':'대체공휴일','2027-03-01':'삼일절','2027-05-01':'근로자의 날','2027-05-03':'대체공휴일','2027-05-05':'어린이날','2027-05-13':'부처님오신날','2027-06-06':'현충일','2027-07-17':'제헌절','2027-07-19':'대체공휴일','2027-08-15':'광복절','2027-08-16':'대체공휴일','2027-09-14':'추석 연휴','2027-09-15':'추석','2027-09-16':'추석 연휴','2027-10-03':'개천절','2027-10-04':'대체공휴일','2027-10-09':'한글날','2027-10-11':'대체공휴일','2027-12-25':'크리스마스','2027-12-27':'대체공휴일'};

const uid6=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const now=new Date(), TODAY=key(now);
let view=new Date(now.getFullYear(),now.getMonth(),1);
let sel=TODAY;
/* 화면 설정 기억 (기기마다 따로) */
const pref={get:k=>{try{return localStorage.getItem(k);}catch(e){return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}}};
let calMode=pref.get('pref-calMode')==='month'?'month':'week';
let tab=pref.get('pref-tab')==='meet'?'meet':'todo', meetings=[], mnotes={};
let days={};      // { "2026-11-10": {items:[{id,text,done}], rdone:{rid:true}, skip:[rid]} }
let routines=[];  // [{id,text,wd:[0..6],start,end}]
let col=null;
let mode='once', pickWd=[];
let asking=null;  // 삭제 확인 중인 반복 id
let editing=null;  // {key,date} 수정 중인 할 일
let moving=false;  // 메뉴에서 '이동'으로 날짜 고르는 중
const $=id=>document.getElementById(id);

const dayRec=k=>{const d=days[k]||(days[k]={items:[],rdone:{},skip:[]});d.rimp=d.rimp||{};d.order=d.order||[];return d;};
function routinesFor(k){
  const w=parse(k).getDay(), skip=(days[k]&&days[k].skip)||[];
  return routines.filter(r=>r.wd.includes(w)&&k>=r.start&&(!r.end||k<=r.end)&&!skip.includes(r.id));
}
function tally(k){
  const d=days[k]||{items:[],rdone:{}}, rs=routinesFor(k);
  const total=rs.length+d.items.length;
  const done=rs.filter(r=>d.rdone&&d.rdone[r.id]).length+d.items.filter(x=>x.done).length;
  const impLeft=rs.some(r=>d.rimp&&d.rimp[r.id]&&!(d.rdone&&d.rdone[r.id]))||d.items.some(x=>x.imp&&!x.done);
  return {total,done,rs,d,impLeft};
}
function label(wd){
  const s=[...wd].sort().join('');
  if(s==='0123456')return'매일'; if(s==='12345')return'평일'; if(s==='06')return'주말';
  return wd.slice().sort((a,b)=>((a+6)%7)-((b+6)%7)).map(i=>WD[i]).join('·');
}

/* '참 잘했어요' 도장 */
function stampSVG(){
  let d='';const N=16,R=46,r=41;
  for(let i=0;i<=N*2;i++){const a=Math.PI*i/N, rr=i%2?r:R;d+=(i?'L':'M')+(50+rr*Math.cos(a)).toFixed(1)+' '+(50+rr*Math.sin(a)).toFixed(1);}
  return '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="'+d+'Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>'+
    '<circle cx="50" cy="50" r="33" fill="none" stroke="currentColor" stroke-width="2.5"/>'+
    '<text x="50" y="45" text-anchor="middle" font-size="19" font-weight="700" fill="currentColor" font-family="Do Hyeon,sans-serif">참 잘</text>'+
    '<text x="50" y="66" text-anchor="middle" font-size="19" font-weight="700" fill="currentColor" font-family="Do Hyeon,sans-serif">했어요</text></svg>';
}
const STAMP=stampSVG();
/* 생일 (양력/음력) */
let bdays=[];   // [{id,name,m,d,lunar}]
const LUNAR=(typeof KoreanLunarCalendar==='function')?new KoreanLunarCalendar():null;
const lunarCache={};
function lunarToSolar(y,m,d){
  const ck=y+'-'+m+'-'+d; if(ck in lunarCache) return lunarCache[ck];
  let out=null;
  if(LUNAR&&y>=1001&&y<=2049){
    for(let dd=d;dd>=Math.max(1,d-1);dd--){ // 30일이 없는 달이면 29일로
      if(LUNAR.setLunarDate(y,m,dd,false)){const s=LUNAR.getSolarCalendar();out=s.year+'-'+pad(s.month)+'-'+pad(s.day);break;}
    }
  }
  return lunarCache[ck]=out;
}
function bdaysOn(k){
  if(!bdays.length) return [];
  const y=+k.slice(0,4), md=k.slice(5);
  return bdays.filter(b=>{
    if(!b.lunar){
      const t=pad(b.m)+'-'+pad(b.d);
      if(t===md) return true;
      // 2월 29일생은 평년에 2월 28일
      if(t==='02-29'&&md==='02-28'&&new Date(y,1,29).getMonth()!==1) return true;
      return false;
    }
    return lunarToSolar(y,b.m,b.d)===k||lunarToSolar(y-1,b.m,b.d)===k;
  });
}
const bdayDesc=b=>(b.lunar?'음력 ':'양력 ')+b.m+'.'+b.d;

let lastSelDone=null;
function render(){
  if(!inUndo&&undoSnap) hideUndo(); // 다른 동작을 하면 되돌리기 줄을 닫음
  const g=$('grid'); g.innerHTML='';
  let cells=[];
  if(calMode==='week'){
    const ws=addDays(sel,-parse(sel).getDay());
    for(let i=0;i<7;i++) cells.push(parse(addDays(ws,i)));
    const a=cells[0], z=cells[6];
    $('monthLabel').textContent=a.getMonth()===z.getMonth()?(a.getMonth()+1)+'월 '+a.getDate()+'~'+z.getDate()+'일':(a.getMonth()+1)+'/'+a.getDate()+'~'+(z.getMonth()+1)+'/'+z.getDate();
  } else {
    $('monthLabel').textContent=view.getFullYear()+'년 '+(view.getMonth()+1)+'월';
    const first=view.getDay(), last=new Date(view.getFullYear(),view.getMonth()+1,0).getDate();
    for(let i=0;i<first;i++){const e=document.createElement('div');e.className='day empty';g.appendChild(e);}
    for(let d=1;d<=last;d++) cells.push(new Date(view.getFullYear(),view.getMonth(),d));
  }
  $('modeBtn').textContent=calMode==='week'?'월간':'주간';
  $('modeBtn').setAttribute('aria-label',calMode==='week'?'한 달 보기':'한 주 보기');
  for(const dt of cells){
    const d=dt.getDate(), k=key(dt), t=tally(k);
    const b=document.createElement('button');
    b.className='day'+(dt.getDay()===0?' sun':'')+(dt.getDay()===6?' sat':'')+(HOL[k]?' hol':'')+(k===TODAY?' today':'')+(k===sel?' sel':'');
    b.setAttribute('aria-label',(dt.getMonth()+1)+'월 '+d+'일');
    const n=document.createElement('span');n.className='n';n.textContent=d;b.appendChild(n);
    if(bdaysOn(k).length){const c=document.createElement('span');c.className='cake';c.textContent='🎂';b.appendChild(c);b.classList.add('has-bday');}
    if(tab==='meet'){
      const mc=meetingsOn(k).length;
      if(mc){const c=document.createElement('span');c.className='mcnt';c.textContent=mc+'건';b.appendChild(c);}
    } else if(t.total&&t.done===t.total&&k<=TODAY){
      b.classList.add('stamped');
      const s=document.createElement('span');s.className='stamp';s.innerHTML=STAMP;b.appendChild(s);
    } else if(t.total){
      if(t.impLeft){const dot=document.createElement('span');dot.className='impdot';dot.title='꼭 할 일 남음';b.appendChild(dot);}
      const c=document.createElement('span');
      c.className='cnt '+(t.done===t.total?'full':t.done>0?'part':'')+(k>TODAY?' future':'');
      c.textContent=t.done+'/'+t.total;b.appendChild(c);
    }
    b.onclick=()=>{sel=k;view=new Date(dt.getFullYear(),dt.getMonth(),1);asking=null;editing=null;lastSelDone=null;syncWd();render();};
    g.appendChild(b);
  }
  $('todoPanel').hidden=tab!=='todo'; $('meetPanel').hidden=tab!=='meet';
  if(tab==='meet') renderMeet();
  const sd=parse(sel);
  $('dayLabel').textContent=sd.getFullYear()+'.'+(sd.getMonth()+1)+'.'+sd.getDate()+'('+WD[sd.getDay()]+')';
  if(HOL[sel]){const h=document.createElement('span');h.className='hol-name';h.textContent=HOL[sel];$('dayLabel').appendChild(h);}
  const t=tally(sel);
  $('score').textContent='('+t.done+' / '+t.total+' 완료)';
  const allDone=t.total>0&&t.done===t.total&&sel<=TODAY, bs=$('bigStamp');
  if(!bs.innerHTML) bs.innerHTML=STAMP;
  bs.hidden=!allDone;
  if(allDone&&lastSelDone===false){bs.classList.remove('pop');void bs.offsetWidth;bs.classList.add('pop');}
  lastSelDone=allDone;
  $('barFill').style.width=t.total?(t.done/t.total*100)+'%':'0';
  const bl=$('bdayLine'), bs2=bdaysOn(sel);
  bl.hidden=!bs2.length; bl.innerHTML='';
  bs2.forEach(b=>{const x=document.createElement('div');x.className='bday-item';x.textContent='🎂 '+b.name+' 생일';const sm=document.createElement('small');sm.textContent=' '+bdayDesc(b);x.appendChild(sm);bl.appendChild(x);});
  const ul=$('list'); ul.innerHTML='';
  if(!t.total){const p=document.createElement('li');p.className='empty-msg';p.textContent='이 날은 할 일이 없어요. 위 칸에 적어서 추가해 보세요.';ul.appendChild(p);}
  const rows=[];
  const twoStep=(key,doDel)=>()=>{ if(asking===key){asking=null;doDel();} else {asking=key;render();} };
  t.rs.forEach(r=>{
    const done=!!(t.d.rdone&&t.d.rdone[r.id]);
    const imp=!!(t.d.rimp&&t.d.rimp[r.id]);
    const key='r:'+r.id;
    rows.push({key,el:item({id:'r-'+r.id,text:r.text,done,imp,tag:label(r.wd),
      onCheck:v=>{const d=dayRec(sel);if(v)d.rdone[r.id]=true;else delete d.rdone[r.id];saveDay(sel);},
      onStar:()=>{const d=dayRec(sel);if(d.rimp[r.id])delete d.rimp[r.id];else{d.rimp[r.id]=true;toTop(key);}saveDay(sel);},
      onMenu:()=>{asking=asking===key?null:key;render();},
      onDel:()=>{asking=null;withUndo('"'+r.text+'" 이 날에서 뺐어요.',()=>{const d=dayRec(sel);d.skip=[...(d.skip||[]),r.id];delete d.rdone[r.id];delete d.rimp[r.id];saveDay(sel);});},
      ask:asking===key?{routine:r}:null,
      editing:!!(editing&&editing.key===key&&editing.date===sel),
      onEdit:()=>{asking=null;editing={key,date:sel};render();},
      onSave:v=>{editing=null;if(v&&v!==r.text){withUndo('"'+v+'"(으)로 고쳤어요.',()=>{r.text=v;saveRoutines();});}else render();}})});
  });
  t.d.items.forEach(it=>{
    const key='i:'+it.id;
    rows.push({key,el:item({id:'i-'+it.id,text:it.text,done:!!it.done,imp:!!it.imp,
      onCheck:v=>{it.done=v;saveDay(sel);},
      onStar:()=>{it.imp=!it.imp;if(it.imp)toTop(key);saveDay(sel);},
      onMenu:()=>{asking=asking===key?null:key;moving=false;render();},
      onDel:()=>{asking=null;withUndo('"'+it.text+'" 지웠어요.',()=>{const d=dayRec(sel);d.items=d.items.filter(x=>x!==it);saveDay(sel);});},
      ask:asking===key?{it}:null,
      editing:!!(editing&&editing.key===key&&editing.date===sel),
      onEdit:()=>{asking=null;editing={key,date:sel};render();},
      onSave:v=>{editing=null;if(v&&v!==it.text){withUndo('"'+v+'"(으)로 고쳤어요.',()=>{it.text=v;saveDay(sel);});}else render();}})});
  });
  const ord=(t.d.order)||[];
  rows.forEach((r,i)=>{const p=ord.indexOf(r.key);r.pos=p<0?1e6+i:p;});
  rows.sort((a,b)=>a.pos-b.pos);
  rows.forEach(r=>{r.el.dataset.key=r.key;ul.appendChild(r.el);});
  enableDrag(ul);
}

/* 이동: 고른 날(기본 내일)에 같은 내용이 없을 때만 추가 */
function carryOver(it,to){
  const from=sel, norm=x=>String(x).replace(/\s+/g,' ').trim();
  const src=dayRec(from); src.items=src.items.filter(x=>x!==it);
  const dst=dayRec(to);
  const dup=dst.items.some(x=>norm(x.text)===norm(it.text))||routinesFor(to).some(r=>norm(r.text)===norm(it.text));
  if(!dup){
    const nid=uid6();
    dst.items.push({id:nid,text:it.text,done:false,imp:!!it.imp});
    // 꼭 할 일은 넘긴 날 목록 맨 위로
    if(it.imp){const nk='i:'+nid;dst.order=[nk,...(dst.order||[]).filter(k=>k!==nk)];}
  } else if(it.imp){
    // 같은 할 일이 이미 있으면 그 줄을 꼭 할 일로 표시하고 맨 위로
    const ex=dst.items.find(x=>norm(x.text)===norm(it.text));
    if(ex){ex.imp=true;const ek='i:'+ex.id;dst.order=[ek,...(dst.order||[]).filter(k=>k!==ek)];}
    else{const r=routinesFor(to).find(r=>norm(r.text)===norm(it.text));if(r){dst.rimp[r.id]=true;const rk='r:'+r.id;dst.order=[rk,...(dst.order||[]).filter(k=>k!==rk)];}}
  }
  saveDay(from); if(!dup||it.imp) saveDay(to);
  const d=parse(to), msg=(d.getMonth()+1)+'월 '+d.getDate()+'일';
  return dup?msg+'에 같은 할 일이 이미 있어서 이 날 것만 지웠어요.':msg+'로 옮겼어요.';
}

/* 별표한 줄을 맨 위로 */
function toTop(key){
  const keys=[...$('list').querySelectorAll('li[data-key]')].map(l=>l.dataset.key).filter(k=>k!==key);
  dayRec(sel).order=[key,...keys];
}

/* 끌어서 순서 바꾸기 (≡ 손잡이) */
function enableDrag(ul){
  ul.querySelectorAll('.grip').forEach(g=>{
    g.addEventListener('pointerdown',e=>{
      const li=g.closest('li'); if(!li) return;
      e.preventDefault();
      try{g.setPointerCapture(e.pointerId);}catch(err){}
      const rows=[...ul.querySelectorAll('li[data-key]')];
      const from=rows.indexOf(li); let to=from;
      const mids=rows.map(r=>{const b=r.getBoundingClientRect();return b.top+b.height/2;});
      const h=li.getBoundingClientRect().height, startY=e.clientY;
      li.classList.add('dragging');
      rows.forEach(r=>{if(r!==li)r.classList.add('shift');});
      const move=ev=>{
        const dy=ev.clientY-startY, y=mids[from]+dy;
        li.style.transform='translateY('+dy+'px)';
        to=rows.filter((r,i)=>i!==from&&mids[i]<y).length;
        rows.forEach((r,i)=>{
          if(i===from) return;
          let s=0;
          if(from<to&&i>from&&i<=to) s=-h;
          if(to<from&&i>=to&&i<from) s=h;
          r.style.transform=s?'translateY('+s+'px)':'';
        });
      };
      const up=()=>{
        g.removeEventListener('pointermove',move);g.removeEventListener('pointerup',up);g.removeEventListener('pointercancel',up);
        rows.forEach(r=>{r.style.transform='';r.classList.remove('shift','dragging');});
        if(to!==from){
          const keys=rows.map(r=>r.dataset.key);
          const [k]=keys.splice(from,1); keys.splice(to,0,k);
          dayRec(sel).order=keys; saveDay(sel);
        }
      };
      g.addEventListener('pointermove',move);g.addEventListener('pointerup',up);g.addEventListener('pointercancel',up);
    });
  });
}

function item(o){
  const li=document.createElement('li'); li.className=(o.done?'done ':'')+(o.imp?'imp':'');
  const gr=document.createElement('span');gr.className='grip';gr.textContent='≡';gr.setAttribute('aria-label','끌어서 순서 바꾸기');gr.title='끌어서 순서 바꾸기';
  li.appendChild(gr);
  if(o.editing){
    const f=document.createElement('form');f.className='edit-row';
    const inp=document.createElement('input');inp.type='text';inp.value=o.text;inp.maxLength=200;inp.id='edit-'+o.id;inp.setAttribute('aria-label','할 일 고치기');
    const sv=document.createElement('button');sv.type='submit';sv.className='add';sv.textContent='저장';
    const cn=document.createElement('button');cn.type='button';cn.className='mcancel';cn.textContent='취소';
    cn.onclick=()=>{editing=null;render();};
    inp.addEventListener('keydown',e=>{if(e.key==='Escape'){editing=null;render();}});
    f.addEventListener('submit',e=>{e.preventDefault();o.onSave(inp.value.trim());});
    f.append(inp,sv,cn); li.appendChild(f);
    if(o.tag) li.appendChild(Object.assign(document.createElement('div'),{className:'edit-hint',textContent:'반복 할 일이에요. 고치면 모든 날짜에 함께 바뀌어요.'}));
    setTimeout(()=>{inp.focus();try{inp.setSelectionRange(inp.value.length,inp.value.length);}catch(e){}},0);
    return li;
  }
  const lb=document.createElement('label');lb.className='cbwrap';lb.setAttribute('aria-label','완료');
  const cb=document.createElement('input');cb.type='checkbox';cb.checked=o.done;cb.id='cb-'+o.id;
  cb.onchange=()=>o.onCheck(cb.checked);
  lb.appendChild(cb); li.appendChild(lb);
  const s=document.createElement('span');s.className='t tbtn';s.tabIndex=0;s.setAttribute('role','button');s.setAttribute('aria-expanded',!!o.ask);
  if(o.imp){const m=document.createElement('span');m.className='impmark';m.textContent='★';m.setAttribute('aria-label','꼭 할 일');s.appendChild(m);}
  s.append(o.text);
  s.onclick=o.onMenu; s.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();o.onMenu();}};
  li.appendChild(s);
  if(o.tag){const g=document.createElement('span');g.className='tag';g.textContent=o.tag;li.appendChild(g);}
  const del=document.createElement('button');del.type='button';
  if(o.ask){
    del.className='del fold';del.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    del.setAttribute('aria-label','메뉴 닫기');del.title='메뉴 닫기';
    del.onclick=()=>{asking=null;render();};
  } else {
    del.className='del';del.textContent='×';
    del.setAttribute('aria-label',o.tag?'이 날에서 빼기':'삭제');del.title=o.tag?'이 날에서 빼기':'삭제';
    del.onclick=o.onDel;
  }
  li.appendChild(del);
  if(o.ask){
    const a=document.createElement('div');a.className='ask';
    const sb=document.createElement('button');sb.type='button';sb.className='star-btn';sb.textContent=o.imp?'☆ 꼭 해제':'★ 꼭';
    sb.onclick=()=>{asking=null;o.onStar();};
    a.append(sb);
    if(o.ask.it){
      const b1=document.createElement('button');b1.type='button';b1.textContent='이동';
      b1.setAttribute('aria-pressed',moving);
      b1.onclick=()=>{moving=!moving;render();};
      a.append(b1);
    } else {
      const r=o.ask.routine;
      const b1=document.createElement('button');b1.type='button';b1.className='danger';b1.textContent='반복 끝내기';b1.title='이 날부터 반복 끝내기';
      b1.onclick=()=>{asking=null;withUndo('"'+r.text+'" 반복을 이 날부터 끝냈어요.',()=>{if(sel<=r.start) routines=routines.filter(x=>x!==r); else r.end=addDays(sel,-1);saveRoutines();});};
      a.append(b1);
    }
    const eb=document.createElement('button');eb.type='button';eb.textContent='수정';eb.onclick=o.onEdit;
    a.append(eb); li.appendChild(a);
    if(o.ask.it&&moving){
      // 넘길 날짜 고르기 (기본 내일)
      const row=document.createElement('div');row.className='sendrow mvrow';
      const di=document.createElement('input');di.type='date';di.value=addDays(sel,1);di.setAttribute('aria-label','넘길 날짜');
      const go=document.createElement('button');go.type='button';go.className='go';go.textContent='이동';
      go.onclick=()=>{
        const to=di.value;
        if(!to){toast('날짜를 골라 주세요.');return;}
        if(to===sel){toast('지금 보고 있는 날이에요. 다른 날을 골라 주세요.');return;}
        asking=null;moving=false;withUndo('',()=>carryOver(o.ask.it,to));
      };
      const cn=document.createElement('button');cn.type='button';cn.textContent='취소';cn.onclick=()=>{moving=false;render();};
      row.append(di,go,cn); li.appendChild(row);
    }
  }
  return li;
}

/* 반복 선택 UI */
const PRESET={daily:[0,1,2,3,4,5,6],weekday:[1,2,3,4,5],weekend:[0,6]};
const HINT={once:'',daily:'선택한 날부터 매일 자동으로 표시돼요.',weekday:'선택한 날부터 월~금에 자동으로 표시돼요.',weekend:'선택한 날부터 토·일에 자동으로 표시돼요.'};
function syncWd(){ if(mode==='custom'&&!pickWd.length) pickWd=[parse(sel).getDay()]; drawWd(); }
function drawWd(){
  const box=$('wd'); box.hidden=mode!=='custom'; box.innerHTML='';
  [1,2,3,4,5,6,0].forEach(i=>{
    const b=document.createElement('button');b.type='button';b.textContent=WD[i];
    b.setAttribute('aria-pressed',pickWd.includes(i));
    b.onclick=()=>{pickWd=pickWd.includes(i)?pickWd.filter(x=>x!==i):[...pickWd,i];drawWd();};
    box.appendChild(b);
  });
  $('hint').textContent=mode==='custom'
    ?(pickWd.length?'선택한 날부터 매주 '+label(pickWd)+'에 자동으로 표시돼요.':'요일을 하나 이상 골라 주세요.')
    :HINT[mode];
  $('hint').hidden=!$('hint').textContent;
}
$('seg').querySelectorAll('button').forEach(b=>b.onclick=()=>{
  mode=b.dataset.r;
  $('seg').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));
  if(mode==='custom'&&!pickWd.length) pickWd=[parse(sel).getDay()];
  drawWd();
});

$('addForm').addEventListener('submit',e=>{
  e.preventDefault();
  const v=$('newTask').value.trim(); if(!v) return;
  if(mode==='once'){
    dayRec(sel).items.push({id:uid6(),text:v,done:false});
    $('newTask').value=''; saveDay(sel);
  } else {
    const wd=mode==='custom'?[...pickWd]:PRESET[mode];
    if(!wd.length){$('hint').textContent='요일을 하나 이상 골라 주세요.';$('hint').hidden=false;return;}
    routines.push({id:uid6(),text:v,wd,start:sel,end:null});
    $('newTask').value=''; saveRoutines();
  }
});
function moveBy(n){
  if(calMode==='week'){sel=addDays(sel,7*n);const d=parse(sel);view=new Date(d.getFullYear(),d.getMonth(),1);asking=null;lastSelDone=null;}
  else view=new Date(view.getFullYear(),view.getMonth()+n,1);
  render();
}
$('prev').onclick=()=>moveBy(-1);
$('next').onclick=()=>moveBy(1);
/* 달력을 옆으로 밀어서 이동 */
(function(){
  const cal=document.querySelector('.cal'); let sx=0,sy=0,st=0,on=false;
  cal.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;on=true;sx=e.touches[0].clientX;sy=e.touches[0].clientY;st=Date.now();},{passive:true});
  cal.addEventListener('touchend',e=>{
    if(!on)return; on=false;
    const t=e.changedTouches[0], dx=t.clientX-sx, dy=t.clientY-sy;
    if(Math.abs(dx)<50||Math.abs(dx)<Math.abs(dy)*1.5||Date.now()-st>800) return;
    const n=dx<0?1:-1;
    closeExtras(); moveBy(n);
    const g=$('grid'); g.classList.remove('slide-l','slide-r'); void g.offsetWidth; g.classList.add(n>0?'slide-l':'slide-r');
  },{passive:true});
})();
$('modeBtn').onclick=()=>{
  calMode=calMode==='week'?'month':'week';
  pref.set('pref-calMode',calMode);
  if(calMode==='month'){const d=parse(sel);view=new Date(d.getFullYear(),d.getMonth(),1);}
  render();
};
$('goToday').onclick=()=>{view=new Date(now.getFullYear(),now.getMonth(),1);sel=TODAY;asking=null;render();};

/* 저장 */
let writing=Promise.resolve();
const fail=e=>{$('status').textContent=e&&e.code==='quota_exceeded'?'저장 공간이 가득 찼어요. 지난 날짜의 할 일을 지워 주세요.':'저장하지 못했어요. 인터넷 연결을 확인해 주세요.';};
function saveLocal(){try{localStorage.setItem('todo-days',JSON.stringify(days));localStorage.setItem('todo-routines',JSON.stringify(routines));localStorage.setItem('todo-bdays',JSON.stringify(bdays));localStorage.setItem('todo-meetings',JSON.stringify(meetings));localStorage.setItem('todo-mnotes',JSON.stringify(mnotes));}catch(e){}}
function saveDay(k){
  render();
  const d=days[k]||{items:[],rdone:{},skip:[]};
  const body={date:k,items:d.items.map(x=>({id:x.id,text:x.text,done:!!x.done,imp:!!x.imp})),rdone:{...(d.rdone||{})},skip:[...(d.skip||[])],rimp:{...(d.rimp||{})},order:[...(d.order||[])]};
  const emptyDay=!body.items.length&&!Object.keys(body.rdone).length&&!body.skip.length&&!Object.keys(body.rimp).length;
  if(!col){saveLocal();return;}
  writing=writing.then(()=>emptyDay?col.doc('d'+k).delete():col.doc('d'+k).set(body)).catch(fail);
}
function saveRoutines(){
  render();
  if(!col){saveLocal();return;}
  const list=routines.map(r=>({id:r.id,text:r.text,wd:[...r.wd],start:r.start,end:r.end||null}));
  writing=writing.then(()=>col.doc('routines').set({list})).catch(fail);
}

function useLocal(msg){
  try{days=JSON.parse(localStorage.getItem('todo-days')||'{}')||{};}catch(e){days={};}
  try{routines=JSON.parse(localStorage.getItem('todo-routines')||'[]')||[];}catch(e){routines=[];}
  try{bdays=JSON.parse(localStorage.getItem('todo-bdays')||'[]')||[];}catch(e){bdays=[];}
  try{meetings=JSON.parse(localStorage.getItem('todo-meetings')||'[]')||[];}catch(e){meetings=[];}
  try{mnotes=JSON.parse(localStorage.getItem('todo-mnotes')||'{}')||{};}catch(e){mnotes={};}
  Object.values(days).forEach(d=>{d.items=d.items||[];d.rdone=d.rdone||{};d.skip=d.skip||[];});
  $('status').textContent=msg; render();
}

/* ===== 미팅 ===== */
const mKey=(m,k)=>m.id+'|'+k;
/* 미팅 날짜 옮기기. 반복 미팅은 그날만 빼고 새 날짜에 한 번짜리 미팅을 만든다. 결정사항·이슈도 함께 옮긴다. */
function moveMeeting(m,from,to){
  let nm=m;
  if(m.wd){
    m.skip=[...(m.skip||[]),from];
    nm={id:uid6(),title:m.title,from:m.from,to:m.to,place:m.place,memo:m.memo,date:to};
    meetings.push(nm);
  } else m.date=to;
  const sk=mKey(m,from), dk=mKey(nm,to);
  if(mnotes[sk]){
    if(mnotes[dk]){ // 옮길 날에 이미 메모가 있으면 합치기
      const a=mnotes[dk], b=mnotes[sk];
      a.dec=[a.dec,b.dec].filter(x=>x&&x.trim()).join('\n');
      a.issues=[...(a.issues||[]),...(b.issues||[])];
    } else mnotes[dk]=mnotes[sk];
    delete mnotes[sk];
  }
  saveLocal(); render();
  const d=parse(to);
  return '"'+m.title+'" 미팅을 '+(d.getMonth()+1)+'월 '+d.getDate()+'일로 옮겼어요.';
}
function meetingsOn(k){
  const w=parse(k).getDay();
  return meetings.filter(m=>m.wd?(m.wd.includes(w)&&k>=m.start&&(!m.end||k<=m.end)&&!(m.skip||[]).includes(k)):m.date===k)
    .sort((a,b)=>(a.from||'99:99').localeCompare(b.from||'99:99'));
}
function noteOf(m,k,make){const id=mKey(m,k);if(!mnotes[id]&&make)mnotes[id]={dec:'',issues:[]};return mnotes[id]||{dec:'',issues:[]};}
const fmtD=k=>{const d=parse(k);return (d.getMonth()+1)+'.'+d.getDate()+'('+WD[d.getDay()]+')';};
const mk=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;};

function setTab(t){
  tab=t; asking=null; pref.set('pref-tab',t);
  $('tools').hidden=true; $('more').setAttribute('aria-expanded',false); // ⋯ 메뉴 닫기
  $('tabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',b.dataset.t===t));
  render();
}
$('tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>setTab(b.dataset.t));

function renderMeet(){
  const sd=parse(sel);
  $('mDayLabel').textContent=sd.getFullYear()+'.'+(sd.getMonth()+1)+'.'+sd.getDate()+'('+WD[sd.getDay()]+')';
  if(HOL[sel]) $('mDayLabel').appendChild(mk('span','hol-name',HOL[sel]));
  const ms=meetingsOn(sel);
  $('mScore').textContent='(미팅 '+ms.length+'건)';
  const bl=$('mBdayLine'), bs=bdaysOn(sel);
  bl.hidden=!bs.length; bl.innerHTML='';
  bs.forEach(b=>{const x=mk('div','bday-item','🎂 '+b.name+' 생일');x.appendChild(mk('small',null,' '+bdayDesc(b)));bl.appendChild(x);});
  const ul=$('mList'); ul.innerHTML='';
  if(!ms.length) ul.appendChild(mk('li','empty-msg','이 날은 미팅이 없어요. 위의 + 미팅 추가를 눌러 보세요.'));
  ms.forEach(m=>{
    const key='m:'+m.id, nt=noteOf(m,sel), left=nt.issues.filter(i=>!i.done).length;
    const li=mk('li','mcard');
    const op=mk('button','mopen');op.type='button';
    const tc=mk('span','mtimecol',m.from||'미정');
    if(m.from&&m.to) tc.appendChild(mk('small',null,'~'+m.to));
    const bd=mk('span','mbody');
    bd.appendChild(mk('span','mtitle',m.title));
    const bits=[]; if(m.place) bits.push('📍 '+m.place); if(m.wd){const l=label(m.wd);bits.push(['매일','평일','주말'].includes(l)?l:'매주 '+l);}
    const sub=mk('span','msub',bits.join(' · '));
    if(nt.issues.length) sub.appendChild(mk('span',left?'iss-left':'iss-done',(bits.length?' · ':'')+'이슈 '+nt.issues.length+'개'+(left?' ('+left+'개 남음)':' (모두 해결)')));
    if(sub.textContent) bd.appendChild(sub);
    op.append(tc,bd); op.onclick=()=>openSheet(m.id,sel);
    const del=mk('button','del','×');del.type='button';
    del.setAttribute('aria-label',m.wd?'이 날에서 빼기':'삭제');del.title=m.wd?'이 날에서 빼기':'삭제';
    del.onclick=()=>{
      const k=sel;
      withUndo('"'+m.title+'" 미팅을 '+(m.wd?'이 날에서 뺐어요.':'지웠어요.'),()=>{
        if(m.wd) m.skip=[...(m.skip||[]),k];
        else {meetings=meetings.filter(x=>x!==m);delete mnotes[mKey(m,k)];}
        saveLocal();render();
      });
    };
    li.append(op,del);
    ul.appendChild(li);
  });
}

/* 미팅 추가 */
let mMode='once', mPick=[];
function drawMWd(){
  const box=$('mWd'); box.hidden=mMode!=='custom'; box.innerHTML='';
  [1,2,3,4,5,6,0].forEach(i=>{
    const b=mk('button',null,WD[i]);b.type='button';b.setAttribute('aria-pressed',mPick.includes(i));
    b.onclick=()=>{mPick=mPick.includes(i)?mPick.filter(x=>x!==i):[...mPick,i];drawMWd();};
    box.appendChild(b);
  });
}
$('mSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{
  mMode=b.dataset.r;
  $('mSeg').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));
  if(mMode==='custom'&&!mPick.length) mPick=[parse(sel).getDay()];
  drawMWd();
});
function resetMForm(){
  ['mTitle','mFrom','mTo','mPlace','mMemo'].forEach(i=>{$(i).value='';});
  $('mForm').hidden=true; $('mAddToggle').hidden=false; $('mHint').hidden=true;
}
$('mAddToggle').onclick=()=>{$('mForm').hidden=false;$('mAddToggle').hidden=true;drawMWd();$('mTitle').focus();};
$('mCancel').onclick=resetMForm;
$('mForm').addEventListener('submit',e=>{
  e.preventDefault();
  const hint=t=>{$('mHint').textContent=t;$('mHint').hidden=false;};
  const title=$('mTitle').value.trim();
  if(!title){hint('미팅 제목을 적어 주세요.');return;}
  const m={id:uid6(),title,from:$('mFrom').value||'',to:$('mTo').value||'',place:$('mPlace').value.trim(),memo:$('mMemo').value.trim()};
  if(mMode==='once') m.date=sel;
  else{
    const wd=mMode==='custom'?[...mPick]:PRESET[mMode];
    if(!wd.length){hint('요일을 하나 이상 골라 주세요.');return;}
    m.wd=[...wd]; m.start=sel; m.end=null; m.skip=[];
  }
  meetings.push(m); saveLocal(); resetMForm(); render();
});

/* 미팅 상세 창 */
let sheet=null, sendFor=null, sheetSaveT=null;
const lazySave=()=>{clearTimeout(sheetSaveT);sheetSaveT=setTimeout(saveLocal,300);};
function openSheet(id,k){sheet={id,k};sendFor=null;document.body.style.overflow='hidden';drawSheet();$('mSheet').hidden=false;}
function closeSheet(){
  clearTimeout(sheetSaveT); saveLocal();
  sheet=null; $('mSheet').hidden=true; document.body.style.overflow='';
  render(); if(!$('issuePanel').hidden) drawIssues();
}
$('mSheet').addEventListener('click',e=>{if(e.target===$('mSheet'))closeSheet();});
function sfield(lbl,el){const w=mk('label','sf');w.append(mk('span',null,lbl),el);return w;}
function sinput(type,val,ph,on){const i=mk('input');i.type=type;i.value=val||'';if(ph)i.placeholder=ph;i.addEventListener('input',()=>{on(i.value);lazySave();});return i;}
function stext(val,ph,on){const t=mk('textarea');t.rows=3;t.value=val||'';t.placeholder=ph;t.addEventListener('input',()=>{on(t.value);lazySave();});return t;}
function drawSheet(){
  const c=$('mSheetBody'); c.innerHTML='';
  const m=meetings.find(x=>x.id===sheet.id); if(!m){closeSheet();return;}
  const k=sheet.k, nt=noteOf(m,k,true);
  const head=mk('div','bp-head');head.appendChild(mk('b',null,'🕑 '+parse(k).getFullYear()+'.'+fmtD(k)+' 미팅'));
  const x=mk('button','bp-close','×');x.type='button';x.setAttribute('aria-label','닫기');x.onclick=closeSheet;head.appendChild(x);
  c.appendChild(head);
  c.appendChild(sfield('제목',sinput('text',m.title,'미팅 제목',v=>{if(v.trim())m.title=v.trim();})));
  {// 날짜 이동: 날짜를 고르고 [이동] (반복 미팅은 이 날 한 번만)
    const dr=mk('div','mdate');
    const di=mk('input');di.type='date';di.value=k;di.setAttribute('aria-label','옮길 날짜');
    const go=mk('button','go','이동');go.type='button';go.disabled=true;
    di.oninput=di.onchange=()=>{go.disabled=!di.value||di.value===k;};
    go.onclick=()=>{
      const to=di.value; if(!to||to===k) return;
      closeSheet();
      withUndo('',()=>moveMeeting(m,k,to));
    };
    dr.append(di,go); c.appendChild(sfield('날짜',dr));
  }
  const tr=mk('div','mtime');
  tr.append(sinput('time',m.from,'',v=>{m.from=v;}),mk('span',null,'~'),sinput('time',m.to,'',v=>{m.to=v;}));
  c.appendChild(sfield('시간',tr));
  c.appendChild(sfield('장소',sinput('text',m.place,'장소',v=>{m.place=v.trim();})));
  {const mt=stext(m.memo,'안건, 준비할 것',v=>{m.memo=v;});mt.className='memo-ta';c.appendChild(sfield('내용',mt));}
  if(m.wd){
    const endB=mk('button','sheet-end','반복 끝내기');endB.type='button';endB.title='이 날부터 반복 끝내기';
    endB.onclick=()=>{const t=m.title;closeSheet();withUndo('"'+t+'" 반복을 이 날부터 끝냈어요.',()=>{if(k<=m.start) meetings=meetings.filter(x=>x!==m); else m.end=addDays(k,-1);saveLocal();render();});};
    c.appendChild(endB);
  }
  if(m.wd) c.appendChild(mk('p','bp-note','반복되는 미팅이에요. 제목·시간·장소·내용은 모든 날짜에 함께 바뀌어요. 날짜 [이동]은 이 날 한 번만 옮겨져요. 결정사항과 이슈는 날짜마다 따로 적어요.'));
  c.appendChild(mk('div','sec-title','회의 후 정리'));
  c.appendChild(sfield('결정사항',stext(nt.dec,'회의에서 정해진 것',v=>{nt.dec=v;})));
  const left=nt.issues.filter(i=>!i.done).length;
  c.appendChild(mk('div','sub-title','이슈'+(nt.issues.length?' '+nt.issues.length+'개'+(left?' · '+left+'개 남음':' · 모두 해결'):'')));
  const ul=mk('ul','ilist');
  nt.issues.forEach(i=>{
    const li=mk('li',i.done?'idone':'');
    const cb=mk('input');cb.type='checkbox';cb.checked=!!i.done;cb.setAttribute('aria-label','해결');
    cb.onchange=()=>{i.done=cb.checked;saveLocal();drawSheet();};
    li.append(cb,mk('span','t',i.text));
    if(i.sent) li.appendChild(mk('span','isent','→ '+fmtD(i.sent)+' 할일'));
    const sb=mk('button','ibtn','할일로');sb.type='button';sb.onclick=()=>{sendFor=sendFor===i.id?null:i.id;drawSheet();};
    const del=mk('button','del','×');del.type='button';del.setAttribute('aria-label','이슈 삭제');
    del.onclick=()=>withUndo('이슈를 지웠어요.',()=>{nt.issues=nt.issues.filter(z=>z!==i);saveLocal();drawSheet();});
    li.append(sb,del);
    if(sendFor===i.id){
      const row=mk('div','sendrow');
      const di=mk('input');di.type='date';di.value=k>TODAY?k:TODAY;di.setAttribute('aria-label','보낼 날짜');
      const go=mk('button','go','보내기');go.type='button';
      go.onclick=()=>{
        const to=di.value; if(!to) return;
        const norm=s=>String(s).replace(/\s+/g,' ').trim();
        const dst=dayRec(to);
        const dup=dst.items.some(z=>norm(z.text)===norm(i.text))||routinesFor(to).some(r=>norm(r.text)===norm(i.text));
        if(!dup) dst.items.push({id:uid6(),text:i.text,done:false,imp:false});
        i.sent=to; sendFor=null; saveLocal(); drawSheet();
        toast(dup?fmtD(to)+'에 같은 할 일이 이미 있어요.':fmtD(to)+' 할일로 보냈어요.');
      };
      const cn=mk('button',null,'취소');cn.type='button';cn.onclick=()=>{sendFor=null;drawSheet();};
      row.append(di,go,cn); li.appendChild(row);
    }
    ul.appendChild(li);
  });
  c.appendChild(ul);
  const f=mk('form','iadd');
  const ii=mk('input');ii.type='text';ii.placeholder='이슈를 적고 추가';ii.maxLength=200;ii.autocomplete='off';
  const ib=mk('button','add','추가');ib.type='submit';
  f.append(ii,ib);
  f.addEventListener('submit',e=>{e.preventDefault();const v=ii.value.trim();if(!v)return;nt.issues.push({id:uid6(),text:v,done:false});saveLocal();drawSheet();const n=$('mSheetBody').querySelector('.iadd input');if(n)n.focus();});
  c.appendChild(f);
}

/* 이슈모음 */
function drawIssues(){
  const box=$('issueList'); box.innerHTML='';
  const groups=[];
  Object.keys(mnotes).forEach(id=>{
    const p=id.indexOf('|'), mid=id.slice(0,p), k=id.slice(p+1);
    const m=meetings.find(x=>x.id===mid); if(!m) return;
    const open=(mnotes[id].issues||[]).filter(i=>!i.done);
    if(open.length) groups.push({m,k,open});
  });
  groups.sort((a,b)=>a.k<b.k?-1:a.k>b.k?1:0);
  if(!groups.length){box.appendChild(mk('li','empty','아직 해결 안 된 이슈가 없어요.'));return;}
  groups.forEach(g=>{
    const h=mk('li','ig-head');
    const b=mk('button',null,fmtD(g.k)+' '+g.m.title);b.type='button';b.onclick=()=>openSheet(g.m.id,g.k);
    h.appendChild(b); box.appendChild(h);
    g.open.forEach(i=>{
      const li=mk('li','ig-item');
      const cb=mk('input');cb.type='checkbox';cb.setAttribute('aria-label','해결');
      cb.onchange=()=>{i.done=true;saveLocal();drawIssues();toast('해결로 표시했어요.');};
      li.append(cb,mk('span','t',i.text));
      if(i.sent) li.appendChild(mk('span','isent','→ '+fmtD(i.sent)+' 할일'));
      box.appendChild(li);
    });
  });
}
$('issueOpen').onclick=()=>{
  $('purge').hidden=true; if(typeof endBdayEdit==='function')endBdayEdit(); $('bdayPanel').hidden=true;
  drawIssues(); $('issuePanel').hidden=false; $('issuePanel').scrollIntoView({behavior:'smooth',block:'nearest'});
};
$('issueClose').onclick=()=>{$('issuePanel').hidden=true;};

$('tabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',b.dataset.t===tab));
drawWd(); render();
useLocal('이 핸드폰에만 저장돼요. 가끔 백업해 두세요.');
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{});
  let reloaded=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloaded)return;reloaded=true;location.reload();});
}

/* 백업 / 복원 */
const ls={get:k=>{try{return localStorage.getItem(k);}catch(e){return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}}};
let toastTimer;
function toast(msg){const t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true;},3000);}

/* 브라우저에 영구 저장 요청 (저장공간 부족 시 자동 삭제 방지) */
if(navigator.storage&&navigator.storage.persist){navigator.storage.persist().catch(()=>{});}

/* 백업 알림: 마지막 백업(또는 처음 사용) 후 14일이 지나면 표시 */
const DAY=86400000;
if(!ls.get('todo-firstUse')) ls.set('todo-firstUse',String(Date.now()));
function hasData(){return routines.length>0||Object.values(days).some(d=>d.items&&d.items.length);}
function checkRemind(){
  const last=Number(ls.get('todo-lastBackup')||ls.get('todo-firstUse')||Date.now());
  const snooze=Number(ls.get('todo-snooze')||0);
  const t=Date.now(), passed=Math.floor((t-last)/DAY);
  const show=hasData()&&passed>=14&&t>snooze;
  $('remind').hidden=!show;
  if(show) $('remindText').textContent=ls.get('todo-lastBackup')?'마지막 백업 후 '+passed+'일이 지났어요.':'아직 백업한 적이 없어요. 한 번 저장해 두세요.';
}
function doBackup(){
  const blob=new Blob([JSON.stringify({v:3,days,routines,bdays,meetings,mnotes})],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='티끌모아-백업-'+TODAY+'.json';
  document.body.appendChild(a);a.click();a.remove();
  ls.set('todo-lastBackup',String(Date.now()));
  checkRemind();

  toast('백업 파일을 다운로드 폴더에 저장했어요.');
}
$('backup').onclick=doBackup;
$('undoBtn').onclick=doUndo;
/* 되돌리기 */
var undoSnap=null, undoTimer=null, inUndo=false;
function hideUndo(){clearTimeout(undoTimer);undoSnap=null;const u=document.getElementById('undo');if(u)u.hidden=true;}
function withUndo(msg,fn){
  const snap=JSON.stringify({days,routines,bdays,meetings,mnotes});
  inUndo=true; let ret; try{ret=fn();}finally{inUndo=false;}
  undoSnap=snap;
  $('undoText').textContent=ret||msg;
  $('toast').hidden=true;
  $('undo').hidden=false;
  clearTimeout(undoTimer); undoTimer=setTimeout(()=>{$('undo').hidden=true;undoSnap=null;},7000);
}
function doUndo(){
  if(!undoSnap) return;
  const x=JSON.parse(undoSnap); hideUndo();
  days=x.days; routines=x.routines; bdays=x.bdays||[]; meetings=x.meetings||[]; mnotes=x.mnotes||{};
  saveLocal(); asking=null; render();
  if(!$('bdayPanel').hidden) drawBdays();
  if(sheet) drawSheet();
  if(!$('issuePanel').hidden) drawIssues();
  if(typeof checkRemind==='function') checkRemind();
  clearTimeout(undoTimer); $('undo').hidden=true;
  toast('되돌렸어요.');
}


/* 생일 관리 */
let bdayLunar=false, bdayEdit=null;
const BDAY_NOTE='달력에 🎂로 표시돼요. 음력 생일은 해마다 양력 날짜를 계산해서 보여 줘요. 목록을 누르면 고칠 수 있어요.';
function fillBdaySel(){
  const m=$('bdayM'), d=$('bdayD'), keepM=m.value, keepD=d.value;
  if(!m.options.length){for(let i=1;i<=12;i++){const o=document.createElement('option');o.value=i;o.textContent=i+'월';m.appendChild(o);}}
  const max=bdayLunar?30:[31,29,31,30,31,30,31,31,30,31,30,31][(+m.value||1)-1];
  d.innerHTML='';for(let i=1;i<=max;i++){const o=document.createElement('option');o.value=i;o.textContent=i+'일';d.appendChild(o);}
  if(keepD&&+keepD<=max) d.value=keepD;
}
function drawBdays(){
  const ul=$('bdayList'); ul.innerHTML='';
  if(!bdays.length){const li=document.createElement('li');li.className='empty';li.textContent='아직 등록된 생일이 없어요.';ul.appendChild(li);return;}
  const y=now.getFullYear();
  const next=b=>{ // 다가오는 양력 날짜
    for(const yy of [y,y+1]){const k=b.lunar?(lunarToSolar(yy,b.m,b.d)||lunarToSolar(yy-1,b.m,b.d)):yy+'-'+pad(b.m)+'-'+pad(b.d);if(k&&k>=TODAY)return k;}
    return null;
  };
  bdays.map(b=>({b,n:next(b)})).sort((a,z)=>(a.n||'9')<(z.n||'9')?-1:1).forEach(({b,n})=>{
    const li=document.createElement('li');
    if(bdayEdit===b) li.className='editing';
    const nm=document.createElement('button');nm.type='button';nm.className='nm';nm.textContent='🎂 '+b.name+' ('+bdayDesc(b)+')';
    nm.title='눌러서 고치기'; nm.onclick=()=>startBdayEdit(b);
    const nx=document.createElement('span');nx.className='nx';
    if(n){const dd=Math.round((parse(n)-parse(TODAY))/86400000);const nd=parse(n);nx.textContent=(dd===0?'오늘':'D-'+dd)+' · '+(nd.getMonth()+1)+'.'+nd.getDate();}
    const del=document.createElement('button');del.type='button';del.className='del';del.textContent='×';del.setAttribute('aria-label','삭제');
    del.onclick=()=>{ if(del.classList.contains('armed')){withUndo(b.name+' 생일을 지웠어요.',()=>{bdays=bdays.filter(x=>x!==b);saveLocal();drawBdays();render();});} else {del.classList.add('armed');del.title='한 번 더 누르면 삭제';nx.textContent='× 한 번 더 누르면 삭제';} };
    li.append(nm,nx,del); ul.appendChild(li);
  });
}
function setBdayLunar(v){
  bdayLunar=v;
  $('bdayCal').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',(x.dataset.l==='1')===v));
  fillBdaySel();
}
$('bdayCal').querySelectorAll('button').forEach(b=>b.onclick=()=>setBdayLunar(b.dataset.l==='1'));
function startBdayEdit(b){
  bdayEdit=b;
  $('bdayName').value=b.name; setBdayLunar(!!b.lunar);
  $('bdayM').value=b.m; fillBdaySel(); $('bdayD').value=b.d;
  $('bdaySubmit').textContent='수정'; $('bdayCancelEdit').hidden=false;
  $('bdayNote').textContent=b.name+' 생일을 고치는 중이에요. 다 고치고 수정을 누르세요.';
  drawBdays(); $('bdayName').focus();
}
function endBdayEdit(){
  bdayEdit=null; $('bdayName').value='';
  $('bdaySubmit').textContent='추가'; $('bdayCancelEdit').hidden=true; $('bdayNote').textContent=BDAY_NOTE;
  drawBdays();
}
$('bdayCancelEdit').onclick=endBdayEdit;
$('bdayM').onchange=fillBdaySel;
$('bdayOpen').onclick=()=>{$('issuePanel').hidden=true;$('purge').hidden=true;fillBdaySel();drawBdays();$('bdayPanel').hidden=false;$('bdayPanel').scrollIntoView({behavior:'smooth',block:'nearest'});};
$('bdayClose').onclick=()=>{endBdayEdit();$('bdayPanel').hidden=true;};
$('bdayForm').addEventListener('submit',e=>{
  e.preventDefault();
  const name=$('bdayName').value.trim();
  if(!name){$('bdayNote').textContent='이름을 적어 주세요.';return;}
  if(bdayLunar&&!LUNAR){$('bdayNote').textContent='음력 계산 파일을 불러오지 못했어요. 인터넷에 연결된 상태로 앱을 다시 열어 주세요.';return;}
  const val={name,m:+$('bdayM').value,d:+$('bdayD').value,lunar:bdayLunar};
  const editing=bdayEdit;
  if(editing){Object.assign(editing,val);} else bdays.push({id:uid6(),...val});
  saveLocal(); endBdayEdit(); render();
  if(editing&&typeof toast==='function') toast(name+' 생일을 고쳤어요.');
});

/* 날짜 이후 삭제 */
function purgePlan(from){
  const dayKeys=Object.keys(days).filter(k=>k>=from&&days[k]&&((days[k].items||[]).length||Object.keys(days[k].rdone||{}).length||Object.keys(days[k].rimp||{}).length||(days[k].skip||[]).length));
  const items=dayKeys.reduce((n,k)=>n+(days[k].items||[]).length,0);
  const rStop=routines.filter(r=>!r.end||r.end>=from);
  return {dayKeys,items,rStop};
}
function purgeInfo(){
  const from=$('purgeDate').value;
  if(!from){$('purgeInfo').textContent='날짜를 골라 주세요.';$('purgeGo').disabled=true;return;}
  const p=purgePlan(from), d=parse(from), lbl=d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate()+'('+WD[d.getDay()]+')';
  const parts=[];
  if(p.items) parts.push('한번 할 일 '+p.items+'개');
  if(p.rStop.length) parts.push('반복 할 일 '+p.rStop.length+'개 ('+lbl+'부터 멈춤)');
  if(!parts.length&&!p.dayKeys.length){$('purgeInfo').textContent=lbl+' 이후에는 정리할 내용이 없어요.';$('purgeGo').disabled=true;return;}
  $('purgeInfo').innerHTML='';
  $('purgeInfo').append(lbl+'부터 정리돼요: '+(parts.join(', ')||'체크·별표 기록')+'. 그 전 날짜의 기록은 그대로 남아요. 되돌릴 수 없으니 필요하면 먼저 백업 저장을 해 두세요.');
  $('purgeGo').disabled=false;
}
$('purgeOpen').onclick=()=>{$('issuePanel').hidden=true;if(typeof endBdayEdit==='function')endBdayEdit();$('bdayPanel').hidden=true;$('purgeDate').value=sel;$('purge').hidden=false;purgeInfo();$('purge').scrollIntoView({behavior:'smooth',block:'nearest'});};
$('purgeDate').oninput=purgeInfo;
$('purgeClose').onclick=()=>{$('purge').hidden=true;};
$('purgeGo').onclick=()=>{
  const from=$('purgeDate').value; if(!from) return;
  const p=purgePlan(from);
  withUndo('할 일을 정리했어요. 한번 할 일 '+p.items+'개, 반복 '+p.rStop.length+'개',()=>{
    Object.keys(days).forEach(k=>{if(k>=from) delete days[k];});
    routines=routines.filter(r=>r.start<from);
    routines.forEach(r=>{if(!r.end||r.end>=from) r.end=addDays(from,-1);});
    saveLocal(); asking=null; render(); checkRemind();
  });
  $('purge').hidden=true;
};
$('remindGo').onclick=doBackup;
$('remindLater').onclick=()=>{ls.set('todo-snooze',String(Date.now()+3*DAY));checkRemind();};
/* ⋯ 메뉴와 그 아래 창(생일관리·이슈모음·할일정리·기기연결)을 모두 닫기.
   맨 위 탭, 달·주 이동, 주간/월간, 오늘, 달력 날짜를 누르면 닫힌다. */
function closeExtras(){
  $('tools').hidden=true; $('more').setAttribute('aria-expanded',false);
  if(typeof endBdayEdit==='function'&&!$('bdayPanel').hidden) endBdayEdit();
  ['bdayPanel','issuePanel','purge','syncPanel'].forEach(i=>{const e=document.getElementById(i); if(e) e.hidden=true;});
}
$('tabs').addEventListener('click',closeExtras);
document.querySelector('header').addEventListener('click',e=>{ if(e.target.closest('button')&&!e.target.closest('#more')) closeExtras(); });
$('grid').addEventListener('click',e=>{ if(e.target.closest('button,[data-k],.day,.cell')) closeExtras(); });
$('more').onclick=()=>{const open=$('tools').hidden;$('tools').hidden=!open;$('more').setAttribute('aria-expanded',open);if(open)$('tools').scrollIntoView({behavior:'smooth',block:'nearest'});};
checkRemind();
/* 설치 도우미: 브라우저로 열었을 때 앱 설치를 안내 */
(function(){
  const ua=navigator.userAgent;
  const standalone=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
  if(standalone) return;
  const until=Number(ls.get('todo-installSnooze')||0);
  const box=$('install'),txt=$('installText'),btn=$('installBtn');
  const show=(html,label,fn)=>{
    if(Date.now()<until&&!/KAKAOTALK/i.test(ua)) return;
    txt.innerHTML=html+' <a href="guide.html" style="color:#fff;text-decoration:underline;white-space:nowrap">그림으로 보기</a>'; btn.hidden=!label; if(label){btn.textContent=label;btn.onclick=fn;} box.hidden=false;
  };
  const hide=()=>{box.hidden=true;};
  $('installClose').onclick=()=>{ls.set('todo-installSnooze',String(Date.now()+7*DAY));hide();};
  window.addEventListener('appinstalled',()=>{hide();toast('설치됐어요! 이제 홈 화면 아이콘으로 여세요.');});
  const isIOS=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/.test(ua)&&'ontouchend' in document);
  const external='kakaotalk://web/openExternal?url='+encodeURIComponent(location.href);

  if(/KAKAOTALK/i.test(ua)){
    // 카카오톡 안 브라우저는 설치가 안 되므로 기본 브라우저로 바로 넘김
    show('<b>카카오톡 안에서는 설치가 안 돼요.</b><br>'+(isIOS?'Safari':'Chrome')+'로 열어서 설치해 주세요.','브라우저로 열기',()=>{location.href=external;});
    setTimeout(()=>{location.href=external;},400);
    return;
  }
  if(/NAVER|Instagram|FBAN|FBAV|Line\//i.test(ua)){
    show('<b>이 앱 안에서는 설치가 안 돼요.</b><br>오른쪽 위 메뉴에서 <b>다른 브라우저로 열기</b>를 눌러 주세요.');
    return;
  }
  if(isIOS){
    show('<b>앱으로 설치하기</b><br>아래쪽 <b>공유 버튼(□↑)</b> → <b>홈 화면에 추가</b>를 누르세요.');
    return;
  }
  let prompted=false;
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault(); prompted=true;
    show('<b>티끌모아를 앱으로 설치할 수 있어요.</b><br>홈 화면에서 바로 열려요.','설치',async()=>{
      e.prompt();
      try{const r=await e.userChoice; if(r.outcome==='accepted') hide();}catch(err){}
    });
  });
  setTimeout(()=>{
    if(prompted) return;
    show('<b>앱으로 설치하기</b><br>오른쪽 위 <b>⋮</b> 메뉴 → <b>홈 화면에 추가</b>를 누르세요. 이미 설치했다면 홈 화면 아이콘으로 여세요.');
  },2500);
})();
$('restoreFile').onchange=async e=>{
  const f=e.target.files[0]; if(!f) return;
  try{
    const x=JSON.parse(await f.text());
    if(!x||typeof x.days!=='object'||!Array.isArray(x.routines)) throw 0;
    days=x.days; routines=x.routines; bdays=Array.isArray(x.bdays)?x.bdays:bdays; meetings=Array.isArray(x.meetings)?x.meetings:meetings; mnotes=(x.mnotes&&typeof x.mnotes==='object')?x.mnotes:mnotes; saveLocal();
    Object.values(days).forEach(d=>{d.items=d.items||[];d.rdone=d.rdone||{};d.skip=d.skip||[];});
    toast('백업을 복원했어요.'); render(); checkRemind();
  }catch(err){toast('백업 파일을 읽지 못했어요. 티끌모아에서 저장한 .json 파일인지 확인해 주세요.');}
  e.target.value='';
};
