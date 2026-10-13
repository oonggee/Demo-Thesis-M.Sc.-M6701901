// ===== T2D HealthMate - Application Logic =====
const DB_KEY='t2d_user',CHAT_KEY='t2d_chat',THEME_KEY='t2d_theme';
const $=id=>document.getElementById(id);
const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pages=['splash','register','home','dashboard','chat','ocr','settings'];
const navPages=['home','dashboard','chat','ocr','settings'];
let currentPage='splash';

/* ---------- Date helpers ---------- */
const pad=n=>String(n).padStart(2,'0');
const dKey=(d=new Date())=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const mKey=(d=new Date())=>d.getFullYear()+'-'+pad(d.getMonth()+1);
const wKey=(d=new Date())=>{const x=new Date(d);x.setDate(x.getDate()-((x.getDay()+6)%7));return dKey(x);};
const daysAgo=n=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-n);return d;};
const fmtTime=ts=>{const d=new Date(ts);return pad(d.getHours())+':'+pad(d.getMinutes());};
const fmtDate=ts=>new Date(ts).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
function dayLabel(ts){
  const k=dKey(new Date(ts));
  if(k===dKey())return 'Today · วันนี้';
  if(k===dKey(daysAgo(1)))return 'Yesterday · เมื่อวาน';
  return fmtDate(ts);
}
function agoText(ts){
  const m=Math.floor((Date.now()-ts)/60000);
  if(m<1)return 'just now · เมื่อสักครู่';
  if(m<60)return m+' min ago · '+m+' นาทีที่แล้ว';
  const h=Math.floor(m/60);
  if(h<24)return h+' h ago · '+h+' ชม.ที่แล้ว';
  const d=Math.floor(h/24);
  return d+' d ago · '+d+' วันที่แล้ว';
}

/* ---------- Data store ---------- */
const DataStore={
  get(){let d=null;try{d=JSON.parse(localStorage.getItem(DB_KEY)||'null');}catch(e){}return d?normalize(d):null;},
  save(d){try{localStorage.setItem(DB_KEY,JSON.stringify(d));}catch(e){toast('Storage full','พื้นที่จัดเก็บเต็ม','warn');}},
  update(k,v){const d=this.get();if(d){d[k]=v;this.save(d);}},
  getField(k){const d=this.get();return d?d[k]:null;},
  clear(){localStorage.removeItem(DB_KEY);localStorage.removeItem(CHAT_KEY);},
  getDefaultUser(){return{name:'',age:'',weight:'',height:'',hba1c:'',target:120,points:0,profileImg:'',
    medications:[
      {id:'m1',name:'Metformin',dose:'500 mg',time:'08:00',takenOn:''},
      {id:'m2',name:'Glipizide',dose:'5 mg',time:'12:00',takenOn:''},
      {id:'m3',name:'Metformin',dose:'500 mg',time:'18:00',takenOn:''}],
    bloodSugarLog:[],hba1cLog:[],weightLog:[],medHistory:{},
    water:{date:'',count:0},
    tasks:{daily:{key:'',done:{}},weekly:{key:'',done:{},days:[],scans:0,chats:0},monthly:{key:'',done:{},updated:false}},
    badges:{},ptsLog:[],streak:0,bestStreak:0,lastLogin:'',
    darkMode:false,notifications:true,readNotifs:[],chatPts:{date:'',n:0},scanToday:{date:'',n:0},scans:[],
    stats:{chatMsgs:0,bsLogs:0,scans:0,medsTaken:0}};}
};

function normalize(u){
  const d=DataStore.getDefaultUser();
  Object.keys(d).forEach(k=>{if(u[k]===undefined||u[k]===null)u[k]=d[k];});
  ['stats'].forEach(k=>Object.keys(d[k]).forEach(s=>{if(u[k][s]===undefined)u[k][s]=0;}));
  // legacy blood-sugar format {date:'today',val}
  u.bloodSugarLog=u.bloodSugarLog.map((l,i)=>{
    if(l.ts)return l;
    const n=l.date==='today'?0:l.date==='yesterday'?1:(parseInt(l.date)||i);
    return{ts:daysAgo(n).getTime(),val:+l.val,ctx:'random'};
  });
  u.medications=u.medications.map((m,i)=>({id:m.id||('m'+i+'_'+String(m.time||'').replace(':','')),name:m.name,dose:m.dose||'',
    time:m.time||'08:00',takenOn:m.takenOn!==undefined?m.takenOn:(m.status==='taken'?dKey():'')}));
  if(u.lastLogin&&!/^\d{4}-\d\d-\d\d$/.test(u.lastLogin)){const t=new Date(u.lastLogin);u.lastLogin=isNaN(t)?'':dKey(t);}
  if(!u.tasks.daily||!u.tasks.weekly||!u.tasks.monthly)u.tasks=d.tasks;
  // roll over daily / weekly / monthly counters
  if(u.tasks.daily.key!==dKey())u.tasks.daily={key:dKey(),done:{}};
  if(u.tasks.weekly.key!==wKey())u.tasks.weekly={key:wKey(),done:{},days:[],scans:0,chats:0};
  if(u.tasks.monthly.key!==mKey())u.tasks.monthly={key:mKey(),done:{},updated:false};
  if(u.water.date!==dKey())u.water={date:dKey(),count:0};
  if(u.chatPts.date!==dKey())u.chatPts={date:dKey(),n:0};
  if(u.scanToday.date!==dKey())u.scanToday={date:dKey(),n:0};
  return u;
}

/* ---------- Theme ---------- */
function applyTheme(dark){
  document.documentElement.setAttribute('data-theme',dark?'dark':'light');
  const m=$('metaTheme');if(m)m.setAttribute('content',dark?'#0B1220':'#0D9488');
}
applyTheme(localStorage.getItem(THEME_KEY)==='1'||!!(DataStore.get()||{}).darkMode);

/* ---------- Navigation ---------- */
const lightTonePages=[];
function show(id){
  currentPage=id;
  pages.forEach(p=>{const el=$(p);if(el)el.classList.remove('active');});
  $(id).classList.add('active');
  const bn=$('bnav');
  bn.classList.toggle('show',navPages.includes(id));
  qsa('.bnav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===id));
}
function nav(id){
  if(id!==currentPage&&$(id))$(id).scrollTop=0;
  show(id);refreshCurrent();
}
function refreshCurrent(){
  if(currentPage==='home')refreshHome();
  else if(currentPage==='dashboard')refreshDash();
  else if(currentPage==='settings')refreshSettings();
  else if(currentPage==='chat'&&!$('chatBody').children.length)initChat();
  updateNotifBadge();
}

/* ---------- Toast / FX ---------- */
let fxQueue=[];
const TOAST_IC={pts:'fa-star',badge:'fa-medal',warn:'fa-triangle-exclamation',ok:'fa-check',info:'fa-circle-info'};
function toast(title,msg,type='info'){
  const w=$('toastWrap');
  while(w.children.length>=3)w.firstChild.remove();
  const t=document.createElement('div');t.className='toast '+type;
  t.innerHTML='<div class="t-ic"><i class="fas '+(TOAST_IC[type]||TOAST_IC.info)+'"></i></div><div><b>'+esc(title)+'</b>'+(msg?'<small>'+esc(msg)+'</small>':'')+'</div>';
  w.appendChild(t);
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),320);},type==='warn'?4200:2600);
}
function flushFx(){
  const q=fxQueue;fxQueue=[];let delay=0;
  q.forEach(f=>{
    if(f.type==='pts'){setTimeout(()=>toast('+'+f.n+' pts',f.reason,'pts'),delay);delay+=500;}
    else if(f.type==='badge'){const b=BADGES[f.id];setTimeout(()=>{toast('Badge unlocked! · ปลดล็อกแล้ว',b.en+' · '+b.th,'badge');confetti(50);},delay);delay+=500;}
    else if(f.type==='level'){setTimeout(()=>showLevelUp(f.level),delay+400);}
  });
}
function confetti(n=90){
  const c=$('fxCanvas'),app=$('app');c.width=app.clientWidth;c.height=app.clientHeight;
  const ctx=c.getContext('2d'),cols=['#F59E0B','#14B8A6','#3B82F6','#EC4899','#8B5CF6','#FCD34D'];
  const ps=Array.from({length:n},()=>({x:c.width/2+(Math.random()-.5)*80,y:c.height*.35,vx:(Math.random()-.5)*10,vy:-Math.random()*10-3,
    s:Math.random()*7+4,r:Math.random()*6,vr:(Math.random()-.5)*.4,c:cols[Math.floor(Math.random()*cols.length)]}));
  let f=0;
  (function step(){
    ctx.clearRect(0,0,c.width,c.height);
    ps.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.28;p.vx*=.99;p.r+=p.vr;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.fillStyle=p.c;ctx.globalAlpha=Math.max(0,1-f/110);ctx.fillRect(-p.s/2,-p.s/3,p.s,p.s*.6);ctx.restore();});
    if(++f<120)requestAnimationFrame(step);else ctx.clearRect(0,0,c.width,c.height);
  })();
}

/* ---------- Modals ---------- */
function openModal(id){$(id).classList.add('show');}
function closeModal(id){$(id).classList.remove('show');}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){qsa('.modal-overlay.show').forEach(m=>m.classList.remove('show'));if($('camOverlay').classList.contains('open'))closeCamera();}
});
let confirmCb=null;
function showConfirm({title,msg,okText='OK',danger=false},cb){
  $('cfTitle').textContent=title;$('cfMsg').innerHTML=msg;
  const ok=$('cfOk');ok.textContent=okText;ok.className='btn '+(danger?'btn-pri danger':'btn-pri');
  $('cfIc').className='cf-ic'+(danger?' danger':'');
  $('cfIc').innerHTML='<i class="fas '+(danger?'fa-triangle-exclamation':'fa-circle-question')+'"></i>';
  confirmCb=cb;openModal('confirmModal');
}
$('cfOk').addEventListener('click',()=>{closeModal('confirmModal');const f=confirmCb;confirmCb=null;if(f)f();});

/* ---------- Points, badges, tasks ---------- */
function getLevelInfo(pts){
  let level=1,total=0;
  while(level<99){
    const req=Math.floor(100*Math.pow(1.2,level-1));
    if(pts>=total+req){total+=req;level++;}else break;
  }
  const pointsToNext=Math.floor(100*Math.pow(1.2,level-1));
  let cur=pts-total;if(level===99)cur=pointsToNext;
  return{level,currentLevelPts:cur,pointsToNext};
}
const levelStart=l=>{let s=0;for(let j=1;j<l;j++)s+=Math.floor(100*Math.pow(1.2,j-1));return s;};

function award(u,n,reason,silent){
  const b=getLevelInfo(u.points).level;
  u.points+=n;
  u.ptsLog.unshift({ts:Date.now(),pts:n,reason});u.ptsLog=u.ptsLog.slice(0,40);
  const a=getLevelInfo(u.points).level;
  if(!silent)fxQueue.push({type:'pts',n,reason});
  if(a>b)fxQueue.push({type:'level',level:a});
}
const allBsToday=u=>u.bloodSugarLog.filter(l=>dKey(new Date(l.ts))===dKey());
const medsTakenToday=u=>u.medications.filter(m=>m.takenOn===dKey());
const inRange=v=>v>=70&&v<=180;
const BADGES={
  first_bs:{ic:'fa-droplet',c:'#3B82F6',en:'First Reading',th:'บันทึกครั้งแรก',pts:10,test:u=>u.stats.bsLogs>=1},
  streak3:{ic:'fa-fire',c:'#F97316',en:'3-Day Streak',th:'ต่อเนื่อง 3 วัน',pts:20,test:u=>u.streak>=3},
  streak7:{ic:'fa-fire-flame-curved',c:'#EF4444',en:'7-Day Streak',th:'ต่อเนื่อง 7 วัน',pts:50,test:u=>u.streak>=7},
  water8:{ic:'fa-glass-water',c:'#0EA5E9',en:'Hydration Hero',th:'ดื่มน้ำครบ 8 แก้ว',pts:15,test:u=>u.water.count>=8},
  all_meds:{ic:'fa-pills',c:'#F59E0B',en:'Med Master',th:'กินยาครบทุกมื้อ',pts:20,test:u=>u.medications.length>0&&medsTakenToday(u).length===u.medications.length},
  scanner:{ic:'fa-camera',c:'#8B5CF6',en:'Smart Scanner',th:'สแกนยาครั้งแรก',pts:10,test:u=>u.stats.scans>=1},
  chatter:{ic:'fa-comments',c:'#14B8A6',en:'Coach Fan',th:'คุยกับโค้ช 10 ครั้ง',pts:15,test:u=>u.stats.chatMsgs>=10},
  steady:{ic:'fa-bullseye',c:'#10B981',en:'Steady Hand',th:'น้ำตาลดี 5 ครั้งติด',pts:30,test:u=>{const l=u.bloodSugarLog.slice().sort((a,b)=>a.ts-b.ts).slice(-5);return l.length>=5&&l.every(x=>inRange(x.val));}},
  goal:{ic:'fa-trophy',c:'#EAB308',en:'On Target',th:'HbA1c ต่ำกว่า 7%',pts:40,test:u=>+u.hba1c>0&&+u.hba1c<7},
  lvl5:{ic:'fa-crown',c:'#D97706',en:'Level 5',th:'ถึงเลเวล 5',pts:50,test:u=>getLevelInfo(u.points).level>=5}
};
function evalBadges(u){
  Object.keys(BADGES).forEach(id=>{
    if(!u.badges[id]&&BADGES[id].test(u)){
      u.badges[id]=Date.now();fxQueue.push({type:'badge',id});
      award(u,BADGES[id].pts,'Badge: '+BADGES[id].en,true);
    }
  });
}
const goMeds=()=>{nav('dashboard');setTimeout(()=>{const a=$('medsAnchor');$('dashboard').scrollTo({top:a.offsetTop-70,behavior:'smooth'});},350);};
const TASKS={
  daily:[
    {id:'login',scope:'daily',ic:'fa-sign-in-alt',tone:'g',en:'Daily Login',th:'ล็อกอินรายวัน',d:'Open app today · เปิดแอปวันนี้',pts:5,goal:1,prog:u=>1},
    {id:'bs',scope:'daily',ic:'fa-droplet',tone:'b',en:'Log Blood Sugar',th:'บันทึกน้ำตาล',d:'Record your latest reading · บันทึกค่าล่าสุด',pts:10,goal:1,prog:u=>allBsToday(u).length?1:0,act:()=>openBsModal()},
    {id:'med',scope:'daily',ic:'fa-pills',tone:'y',en:'Log Medication',th:'บันทึกการกินยา',d:'Mark a dose as taken · ติ๊กยาที่กินแล้ว',pts:10,goal:1,prog:u=>medsTakenToday(u).length?1:0,act:()=>goMeds()},
    {id:'water',scope:'daily',ic:'fa-glass-water',tone:'t',en:'Drink Water',th:'ดื่มน้ำให้พอ',d:'8 glasses today · 8 แก้ววันนี้',pts:10,goal:8,prog:u=>u.water.count,act:()=>addWater(1)}
  ],
  weekly:[
    {id:'wk-log',scope:'weekly',ic:'fa-calendar-check',tone:'v',en:'Log 5 Days',th:'บันทึกครบ 5 วัน',d:'Log health data on 5 different days',pts:50,goal:5,prog:u=>u.tasks.weekly.days.length,act:()=>openBsModal()},
    {id:'wk-scan',scope:'weekly',ic:'fa-barcode',tone:'t',en:'Scan 3 Meds',th:'สแกนยา 3 ครั้ง',d:'Use the scanner 3 times',pts:30,goal:3,prog:u=>u.tasks.weekly.scans,act:()=>nav('ocr')},
    {id:'wk-chat',scope:'weekly',ic:'fa-comments',tone:'b',en:'Ask Your Coach',th:'ถามโค้ช 5 ครั้ง',d:'Send 5 messages to the coach',pts:20,goal:5,prog:u=>u.tasks.weekly.chats,act:()=>nav('chat')}
  ],
  monthly:[
    {id:'mo-hba1c',scope:'monthly',ic:'fa-star',tone:'r',en:'Update HbA1c',th:'อัปเดตค่าน้ำตาลสะสม',d:'Enter your monthly lab result',pts:100,goal:1,prog:u=>u.tasks.monthly.updated?1:0,act:()=>openHba1cModal()}
  ]
};
const ALL_TASKS=[].concat(TASKS.daily,TASKS.weekly,TASKS.monthly);
function evalTasks(u){
  ALL_TASKS.forEach(t=>{
    const done=u.tasks[t.scope].done;
    if(!done[t.id]&&t.prog(u)>=t.goal){done[t.id]=true;award(u,t.pts,t.en);}
  });
  evalBadges(u);
}
function syncMedHistory(u){
  u.medHistory[dKey()]={t:u.medications.length,n:medsTakenToday(u).length};
  Object.keys(u.medHistory).sort().slice(0,-30).forEach(k=>delete u.medHistory[k]);
}
function markDay(u){const k=dKey();if(!u.tasks.weekly.days.includes(k))u.tasks.weekly.days.push(k);}
function commit(u){
  evalTasks(u);syncMedHistory(u);
  DataStore.save(u);flushFx();refreshCurrent();
}
function taskClick(id){
  const u=DataStore.get();if(!u)return;
  const t=ALL_TASKS.find(x=>x.id===id);
  if(t&&t.act&&!u.tasks[t.scope].done[id])t.act();
}

/* ---------- Boot / login ---------- */
function checkDailyLogin(){
  const u=DataStore.get();if(!u)return;
  const today=dKey();
  if(u.lastLogin!==today){
    u.streak=(u.lastLogin===dKey(daysAgo(1)))?(u.streak||0)+1:1;
    u.bestStreak=Math.max(u.bestStreak||0,u.streak);
    u.lastLogin=today;
  }
  evalTasks(u);DataStore.save(u);
}
let bootTimer=setTimeout(boot,2400);
function skipSplash(){if(currentPage==='splash'){clearTimeout(bootTimer);boot();}}
function boot(){
  if(currentPage!=='splash')return;
  const u=DataStore.get();
  if(u){checkDailyLogin();show('home');refreshHome();setTimeout(flushFx,500);}
  else show('register');
  updateNotifBadge();
}

/* ---------- Registration wizard ---------- */
let regStep=0;
function setRegStep(n){
  regStep=n;
  qsa('.reg-step').forEach(s=>s.classList.toggle('active',+s.dataset.step===n));
  qsa('#regDots span').forEach((s,i)=>{s.classList.toggle('active',i===n);s.classList.toggle('done',i<n);});
  $('regBack').style.display=n>0?'block':'none';
  $('regNext').innerHTML=n<2?'Next · ถัดไป →':'<i class="fas fa-check"></i> Get Started · เริ่มต้นใช้งาน';
  $('regErr').textContent='';
}
function regFail(field,msg){
  const el=$(field);if(el){el.classList.add('err');el.focus();setTimeout(()=>el.classList.remove('err'),1200);}
  $('regErr').textContent=msg;
}
function validateReg(step){
  const v=id=>$(id).value.trim();
  if(step===0){
    if(!v('rName'))return regFail('rName','Please enter your name · กรุณากรอกชื่อ'),false;
    const a=+v('rAge');if(!a||a<10||a>110)return regFail('rAge','Age must be 10-110 · อายุต้อง 10-110 ปี'),false;
  }
  if(step===1){
    const w=+v('rWeight'),h=+v('rHeight');
    if(!w||w<20||w>300)return regFail('rWeight','Weight 20-300 kg · น้ำหนัก 20-300 กก.'),false;
    if(!h||h<100||h>250)return regFail('rHeight','Height 100-250 cm · ส่วนสูง 100-250 ซม.'),false;
  }
  if(step===2){
    const a=+v('rHba1c'),t=+v('rTarget');
    if(!a||a<3||a>20)return regFail('rHba1c','HbA1c 3-20% · ค่า HbA1c 3-20%'),false;
    if(!t||t<70||t>250)return regFail('rTarget','Target 70-250 mg/dL · เป้า 70-250'),false;
    if(!$('rConsent').checked){$('regErr').textContent='Please accept the privacy policy · กรุณายอมรับนโยบาย';return false;}
  }
  return true;
}
$('regForm').addEventListener('submit',e=>{
  e.preventDefault();
  if(!validateReg(regStep)){$('regForm').classList.remove('shake');void $('regForm').offsetWidth;$('regForm').classList.add('shake');return;}
  if(regStep<2){setRegStep(regStep+1);return;}
  const d=DataStore.getDefaultUser(),v=id=>$(id).value.trim();
  d.name=v('rName');d.age=v('rAge');d.weight=v('rWeight');d.height=v('rHeight');d.hba1c=v('rHba1c');d.target=+v('rTarget');
  d.hba1cLog=[{ts:Date.now(),val:+d.hba1c}];d.weightLog=[{ts:Date.now(),val:+d.weight}];
  DataStore.save(normalize(d));
  enterApp(true);
});
$('regBack').addEventListener('click',()=>setRegStep(Math.max(0,regStep-1)));
['rWeight','rHeight'].forEach(id=>$(id).addEventListener('input',()=>{
  const b=calcBmi($('rWeight').value,$('rHeight').value),el=$('regBmi');
  if(!b){el.innerHTML='<i class="fas fa-heart-pulse"></i><span>Enter weight &amp; height to see your BMI<br><small>กรอกน้ำหนักและส่วนสูงเพื่อดูค่า BMI</small></span>';return;}
  const c=bmiCat(b);
  el.innerHTML='<i class="fas fa-heart-pulse"></i><span>Your BMI · ค่า BMI ของคุณ<br><b>'+b.toFixed(1)+'</b> <span class="pill '+c.k+'">'+c.en+' · '+c.th+'</span></span>';
}));
function enterApp(isNew){
  checkDailyLogin();
  show('home');refreshHome();
  if(isNew)toast('Welcome aboard! 🎉','ยินดีต้อนรับสู่ T2D HealthMate','ok');
  setTimeout(flushFx,700);
}

/* ---------- Health calcs ---------- */
function calcBmi(w,h){w=+w;h=+h;return(w>0&&h>0)?w/Math.pow(h/100,2):0;}
function bmiCat(b){ // Asia-Pacific cut-offs
  if(b<18.5)return{k:'low',en:'Underweight',th:'ผอม'};
  if(b<23)return{k:'good',en:'Normal',th:'ปกติ'};
  if(b<25)return{k:'warn',en:'Overweight',th:'น้ำหนักเกิน'};
  if(b<30)return{k:'high',en:'Obese I',th:'อ้วนระดับ 1'};
  return{k:'crit',en:'Obese II',th:'อ้วนระดับ 2'};
}
function bsStatus(v,u){
  const t=+((u&&u.target)||120);
  if(v<54)return{k:'crit',en:'Very low',th:'ต่ำมาก'};
  if(v<70)return{k:'low',en:'Low',th:'ต่ำ'};
  if(v<=t+20)return{k:'good',en:'Good',th:'ดี'};
  if(v<=180)return{k:'warn',en:'Elevated',th:'ค่อนข้างสูง'};
  if(v<=300)return{k:'high',en:'High',th:'สูง'};
  return{k:'crit',en:'Very high',th:'สูงมาก'};
}
const KCOL={low:'#3B82F6',good:'#10B981',warn:'#F59E0B',high:'#EF4444',crit:'#DC2626',mute:'#94A3B8'};
const CTX={fasting:{en:'Fasting',th:'งดอาหาร'},before:{en:'Before meal',th:'ก่อนอาหาร'},after:{en:'After meal',th:'หลังอาหาร'},bed:{en:'Bedtime',th:'ก่อนนอน'},random:{en:'Random',th:'ทั่วไป'}};
const sortedBs=u=>u.bloodSugarLog.slice().sort((a,b)=>a.ts-b.ts);
const latestBs=u=>{const l=sortedBs(u);return l.length?l[l.length-1]:null;};
function pillHtml(s){return '<span class="pill '+s.k+'">'+s.en+' · '+s.th+'</span>';}
function ringHtml(pct,size,stroke,color,label,sub){
  const r=(size-stroke)/2,c=2*Math.PI*r,off=c*(1-Math.min(100,Math.max(0,pct))/100);
  return '<div class="ring" style="width:'+size+'px;height:'+size+'px"><svg viewBox="0 0 '+size+' '+size+'"><circle class="bg" cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" stroke-width="'+stroke+'"/><circle class="fg" cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" stroke-width="'+stroke+'" style="stroke:'+color+'" stroke-dasharray="'+c+'" stroke-dashoffset="'+off+'"/></svg><span class="ring-l">'+label+(sub?'<small>'+sub+'</small>':'')+'</span></div>';
}

/* ---------- Home ---------- */
const TIPS=[
  {en:'A 15-minute walk after meals can lower blood sugar noticeably.',th:'เดินหลังอาหาร 15 นาที ช่วยลดน้ำตาลในเลือดได้ชัดเจน'},
  {en:'Fill half your plate with non-starchy vegetables.',th:'แบ่งจานครึ่งหนึ่งให้ผักไม่มีแป้ง'},
  {en:'Check your feet every day for cuts, redness or swelling.',th:'ตรวจเท้าทุกวัน ดูแผล รอยแดง หรือบวม'},
  {en:'Take your medication at the same times each day.',th:'กินยาให้ตรงเวลาเดิมทุกวัน'},
  {en:'Poor sleep raises blood sugar. Aim for 7-8 hours.',th:'นอนไม่พอทำให้น้ำตาลสูง ควรนอน 7-8 ชั่วโมง'},
  {en:'Swap sugary drinks for water or unsweetened tea.',th:'เปลี่ยนเครื่องดื่มหวานเป็นน้ำเปล่าหรือชาไม่หวาน'},
  {en:'Always carry a fast-acting sugar source in case of low blood sugar.',th:'พกลูกอมหรือน้ำผลไม้ไว้เผื่อน้ำตาลต่ำ'}
];
function refreshHome(){
  const u=DataStore.get();if(!u)return;
  const h=new Date().getHours();
  $('homeGreet').innerHTML=(h<12?'Good Morning':h<18?'Good Afternoon':'Good Evening')+'<span class="th">'+(h<12?'สวัสดีตอนเช้า':h<18?'สวัสดีตอนบ่าย':'สวัสดีตอนเย็น')+'</span>';
  $('homeUser').textContent=u.name||'User';
  const pts=u.points||0,li=getLevelInfo(pts);
  $('ptsTotal').textContent=pts;$('ptsLvlText').textContent=li.level;$('streakVal').textContent=u.streak||0;
  if(li.level>=99){$('ptsBar').style.width='100%';$('ptsNext').textContent='MAX LEVEL!';}
  else{$('ptsBar').style.width=Math.min(li.currentLevelPts/li.pointsToNext*100,100)+'%';
    $('ptsNext').textContent=li.currentLevelPts+' / '+li.pointsToNext+' pts to Lv.'+(li.level+1);}
  const av=$('homeAv');
  av.innerHTML=u.profileImg?'<img src="'+u.profileImg+'" alt="">':'<span>'+esc((u.name||'U').charAt(0).toUpperCase())+'</span>';

  // today card
  const dn=TASKS.daily.filter(t=>u.tasks.daily.done[t.id]).length,dt=TASKS.daily.length;
  const last=latestBs(u),st=last?bsStatus(last.val,u):null;
  const msg=dn===dt?'All daily tasks done! Great job 🎉<br>ทำครบทุกภารกิจแล้ว!':dn+' of '+dt+' tasks done · ทำแล้ว '+dn+' จาก '+dt+' ภารกิจ';
  $('todayCard').innerHTML=ringHtml(dn/dt*100,62,7,'var(--pri)',dn+'/'+dt)+
   '<div class="today-info"><h4>Today\'s Progress<span class="th">ความคืบหน้าวันนี้</span></h4><p>'+msg+'</p></div>'+
   '<div class="today-last" onclick="nav(\'dashboard\')" style="cursor:pointer">'+(last?'<b style="color:'+KCOL[st.k]+'">'+last.val+'</b><small>mg/dL · '+fmtTime(last.ts)+'</small><span class="pill '+st.k+'">'+st.en+'</span>':'<b style="color:var(--text3)">--</b><small>No reading yet<br>ยังไม่มีค่า</small>')+'</div>';

  // water
  const wc=u.water.count;
  $('waterCard').innerHTML='<div class="water-card"><div class="water-top"><h4><i class="fas fa-glass-water"></i>Water Intake <span class="th">ดื่มน้ำวันนี้</span></h4><span class="cnt">'+wc+' / 8 · '+(wc*250)+' ml</span></div>'+
   '<div class="glasses">'+Array.from({length:8},(_,i)=>'<div class="glass'+(i<wc?' full':'')+'" onclick="setWater('+(i+1===wc?i:i+1)+')"></div>').join('')+'</div>'+
   '<div class="water-btns"><button class="sub" onclick="addWater(-1)" aria-label="Remove glass"><i class="fas fa-minus"></i></button><button class="add" onclick="addWater(1)"><i class="fas fa-plus"></i> Add a glass · เพิ่มหนึ่งแก้ว</button></div></div>';

  renderTasks(u);
  const tip=TIPS[Math.floor(Date.now()/864e5)%TIPS.length];
  $('tipCard').innerHTML='<div class="tip-card"><div class="tip-ic"><i class="fas fa-lightbulb"></i></div><div><h4>Health Tip of the Day · เคล็ดลับวันนี้</h4><p>'+tip.en+'<br><span style="font-size:11px;opacity:.85">'+tip.th+'</span></p></div></div>';
}
function renderTasks(u){
  [['daily','dailyTasks'],['weekly','weeklyTasks'],['monthly','monthlyTasks']].forEach(([sc,id])=>{
    $(id).innerHTML=TASKS[sc].map(t=>{
      const done=!!u.tasks[sc].done[t.id],p=Math.min(t.prog(u),t.goal);
      const prog=t.goal>1?'<div class="prog"><div class="prog-bar"><i style="width:'+(p/t.goal*100)+'%"></i></div><small>'+p+'/'+t.goal+'</small></div>':'';
      return '<div class="task'+(done?' done':'')+'" id="task-'+t.id+'" onclick="taskClick(\''+t.id+'\')"><div class="task-ic '+t.tone+'"><i class="fas '+t.ic+'"></i></div>'+
        '<div class="task-info"><h4>'+t.en+' <span class="th">'+t.th+'</span></h4><p>'+t.d+'</p>'+prog+'</div>'+
        '<span class="task-pts" id="pts-'+t.id+'">'+(done?'<i class="fas fa-check"></i> Done':'+'+t.pts)+'</span></div>';
    }).join('');
  });
}
function setWater(n){
  const u=DataStore.get();if(!u)return;
  u.water.count=Math.max(0,Math.min(20,n));commit(u);
}
function addWater(d){
  const u=DataStore.get();if(!u)return;
  const n=u.water.count+d;if(n<0)return;
  if(d>0&&n===8)toast('Daily water goal reached! 💧','ดื่มน้ำครบ 8 แก้วแล้ว','ok');
  u.water.count=Math.min(20,n);commit(u);
}

/* ---------- Blood sugar ---------- */
let bsCtx='fasting';
function openBsModal(){
  const h=new Date().getHours();
  bsCtx=h<9?'fasting':h<11?'after':h<14?'before':h<19?'after':'bed';
  const u=DataStore.get(),l=u&&latestBs(u);
  $('bsVal').value=l?l.val:'';
  $('bsCtx').innerHTML=Object.keys(CTX).map(k=>'<button type="button" data-k="'+k+'" onclick="setBsCtx(\''+k+'\')">'+CTX[k].en+' · '+CTX[k].th+'</button>').join('');
  setBsCtx(bsCtx);updateBsPreview();openModal('bsModal');
  setTimeout(()=>{$('bsVal').focus();$('bsVal').select();},350);
}
function setBsCtx(k){bsCtx=k;qsa('#bsCtx button').forEach(b=>b.classList.toggle('on',b.dataset.k===k));}
function stepBs(d){const i=$('bsVal');i.value=Math.max(20,Math.min(600,(+i.value||110)+d));updateBsPreview();}
function updateBsPreview(){
  const v=+$('bsVal').value,el=$('bsPreview'),u=DataStore.get();
  if(!v){el.className='bs-preview';el.textContent='Enter your reading · กรอกค่าที่วัดได้';return;}
  if(v<20||v>600){el.className='bs-preview high';el.textContent='Value must be 20-600 mg/dL · ค่าต้องอยู่ระหว่าง 20-600';return;}
  const s=bsStatus(v,u);el.className='bs-preview '+s.k;el.textContent=v+' mg/dL · '+s.en+' · '+s.th;
}
function saveBs(){
  const v=Math.round(+$('bsVal').value);
  if(!v||v<20||v>600){updateBsPreview();$('bsVal').parentElement.classList.remove('shake');void $('bsVal').offsetWidth;$('bsVal').parentElement.classList.add('shake');return;}
  closeModal('bsModal');
  logBloodSugar(v,bsCtx);
}
function logBloodSugar(val,ctx,opts={}){
  const u=DataStore.get();if(!u)return null;
  u.bloodSugarLog.push({ts:Date.now(),val,ctx:ctx||'random'});
  u.bloodSugarLog=u.bloodSugarLog.slice(-400);
  u.stats.bsLogs++;markDay(u);
  const s=bsStatus(val,u);
  commit(u);
  if(!opts.quiet){
    if(s.k==='low'||s.k==='crit'&&val<70)toast('Low blood sugar '+val+' mg/dL','Eat 15g fast carbs, recheck in 15 min · กินของหวาน 15 กรัม','warn');
    else if(s.k==='high'||s.k==='crit')toast('High blood sugar '+val+' mg/dL','Drink water & contact your doctor if it persists · ปรึกษาแพทย์หากสูงต่อเนื่อง','warn');
    else toast('Logged '+val+' mg/dL · '+s.en,s.th,'ok');
  }
  return s;
}
function deleteReading(ts){
  showConfirm({title:'Delete this reading?',msg:'This cannot be undone.<br>ไม่สามารถกู้คืนได้',okText:'Delete · ลบ',danger:true},()=>{
    const u=DataStore.get();u.bloodSugarLog=u.bloodSugarLog.filter(l=>l.ts!==ts);u.stats.bsLogs=Math.max(0,u.stats.bsLogs-1);
    DataStore.save(u);refreshCurrent();toast('Deleted · ลบแล้ว','','info');
  });
}

/* ---------- HbA1c ---------- */
function openHba1cModal(){
  const u=DataStore.get()||{};
  $('hbVal').value='';
  $('hbPrev').innerHTML='Current · ค่าปัจจุบัน: <b>'+(u.hba1c||'--')+'%</b><br>Target · เป้าหมาย: <b>&lt; 7%</b>';
  openModal('hbModal');setTimeout(()=>$('hbVal').focus(),350);
}
function saveHba1c(){
  const v=+$('hbVal').value;
  if(!v||v<3||v>20){$('hbVal').classList.add('err');setTimeout(()=>$('hbVal').classList.remove('err'),800);return;}
  const u=DataStore.get();
  u.hba1c=String(v);u.hba1cLog.push({ts:Date.now(),val:v});u.tasks.monthly.updated=true;
  closeModal('hbModal');commit(u);
  toast('HbA1c updated: '+v+'%',v<7?'On target! · ถึงเป้าหมาย':'Keep going · สู้ต่อไป','ok');
}

/* ---------- Dashboard ---------- */
let dashRange=7,chartLogs=[];
function setRange(r){dashRange=r;qsa('#rangeSeg button').forEach(b=>b.classList.toggle('on',+b.dataset.r===r));refreshDash();}
function delta(cur,prev,unit,invertGood){
  if(prev==null)return '';
  const d=+(cur-prev).toFixed(1);if(d===0)return '<span class="dc-delta flat">no change</span>';
  const up=d>0;return '<span class="dc-delta '+(up?'up':'down')+'"><i class="fas fa-arrow-'+(up?'up':'down')+'"></i> '+Math.abs(d)+unit+'</span>';
}
function refreshDash(){
  const u=DataStore.get();if(!u)return;
  const last=latestBs(u),ls=last?bsStatus(last.val,u):null;
  const hb=+u.hba1c,hbS=!hb?null:hb<7?{k:'good',en:'On target',th:'ถึงเป้า'}:hb<8?{k:'warn',en:'Near target',th:'ใกล้เป้า'}:{k:'high',en:'Above target',th:'เกินเป้า'};
  const hbPrev=u.hba1cLog.length>1?u.hba1cLog[u.hba1cLog.length-2].val:null;
  const wPrev=u.weightLog.length>1?u.weightLog[u.weightLog.length-2].val:null;
  const bmi=calcBmi(u.weight,u.height),bc=bmi?bmiCat(bmi):null;
  const li=getLevelInfo(u.points);
  $('dashStats').innerHTML=
   '<div class="dash-card" onclick="openBsModal()"><div class="dc-top"><div class="dc-icon r"><i class="fas fa-droplet"></i></div>'+(ls?'<span class="pill '+ls.k+'">'+ls.en+'</span>':'<span class="pill mute">No data</span>')+'</div><div class="dc-val">'+(last?last.val:'--')+'<small>mg/dL</small></div><div class="dc-label">Blood Sugar · น้ำตาลในเลือด</div><div class="dc-sub">'+(last?dayLabel(last.ts).split(' ·')[0]+' '+fmtTime(last.ts):'Tap to log · แตะเพื่อบันทึก')+'</div></div>'+
   '<div class="dash-card" onclick="openHba1cModal()"><div class="dc-top"><div class="dc-icon v"><i class="fas fa-chart-line"></i></div>'+(hbS?'<span class="pill '+hbS.k+'">'+hbS.en+'</span>':'')+'</div><div class="dc-val">'+(hb||'--')+'<small>%</small></div><div class="dc-label">HbA1c · น้ำตาลสะสม</div><div class="dc-sub">'+delta(hb,hbPrev,'%')+' target &lt; 7%</div></div>'+
   '<div class="dash-card" onclick="openEditProfile()"><div class="dc-top"><div class="dc-icon b"><i class="fas fa-weight-scale"></i></div>'+(bc?'<span class="pill '+bc.k+'">BMI '+bmi.toFixed(1)+'</span>':'')+'</div><div class="dc-val">'+(u.weight||'--')+'<small>kg</small></div><div class="dc-label">Weight · น้ำหนัก</div><div class="dc-sub">'+delta(+u.weight,wPrev,' kg')+'</div></div>'+
   '<div class="dash-card" onclick="openLevelInfo()"><div class="dc-top"><div class="dc-icon y"><i class="fas fa-star"></i></div><span class="pill warn">Lv.'+li.level+'</span></div><div class="dc-val">'+u.points+'<small>pts</small></div><div class="dc-label">Points · แต้มสะสม</div><div class="dc-sub">'+Object.keys(u.badges).length+' / '+Object.keys(BADGES).length+' badges</div></div>';

  // trend chart
  const since=daysAgo(dashRange-1);since.setHours(0,0,0,0);
  chartLogs=sortedBs(u).filter(l=>l.ts>=since.getTime());
  $('bsChart').innerHTML=buildChart(chartLogs,u);
  const vals=chartLogs.map(l=>l.val);
  if(vals.length){
    const avg=Math.round(vals.reduce((a,b)=>a+b,0)/vals.length),tir=Math.round(vals.filter(inRange).length/vals.length*100);
    $('trendStats').innerHTML=
     '<div class="ms"><b>'+avg+'</b><small>Average<br>เฉลี่ย</small></div><div class="ms"><b style="color:var(--info)">'+Math.min(...vals)+'</b><small>Lowest<br>ต่ำสุด</small></div>'+
     '<div class="ms"><b style="color:var(--bad)">'+Math.max(...vals)+'</b><small>Highest<br>สูงสุด</small></div><div class="ms"><b style="color:'+(tir>=70?'var(--ok)':tir>=50?'var(--warn)':'var(--bad)')+'">'+tir+'%</b><small>In range<br>อยู่ในเกณฑ์</small></div>';
    showPoint(chartLogs.length-1);
  }else{$('trendStats').innerHTML='';$('trendInfo').innerHTML='';}

  // BMI
  if(bmi){
    const pos=Math.max(0,Math.min(100,(bmi-15)/(40-15)*100));
    const hm=u.height/100,lo=(18.5*hm*hm).toFixed(0),hi=(22.9*hm*hm).toFixed(0);
    $('bmiCard').innerHTML='<div class="card-head"><div class="card-title">Body Mass Index<span class="th">ดัชนีมวลกาย (เกณฑ์เอเชีย)</span></div>'+pillHtml(bc)+'</div>'+
     '<div class="bmi-top"><div class="bmi-val">'+bmi.toFixed(1)+'<small>kg/m²</small></div></div>'+
     '<div class="bmi-scale"><div class="bmi-mark" style="left:'+pos+'%"></div></div>'+
     '<div class="bmi-ticks"><span>15</span><span>18.5</span><span>23</span><span>25</span><span>30</span><span>40</span></div>'+
     '<div class="bmi-note">Healthy weight for your height: <b>'+lo+'-'+hi+' kg</b><br>น้ำหนักที่เหมาะสมกับส่วนสูงของคุณ: '+lo+'-'+hi+' กก.</div>';
  }else $('bmiCard').innerHTML='<div class="empty"><i class="fas fa-weight-scale"></i>Add height &amp; weight to see BMI</div>';

  // adherence + meds
  const days=Object.keys(u.medHistory).sort().slice(-7).map(k=>u.medHistory[k]).filter(x=>x.t>0);
  const totT=days.reduce((a,b)=>a+b.t,0),totN=days.reduce((a,b)=>a+b.n,0),adh=totT?Math.round(totN/totT*100):0;
  const tk=medsTakenToday(u).length,tt=u.medications.length;
  $('adhCard').innerHTML=ringHtml(adh,64,7,adh>=80?'var(--ok)':adh>=50?'var(--warn)':'var(--bad)',adh+'%','7 days')+
   '<div><h4>Medication Adherence<span class="th">การกินยาตามสั่ง 7 วัน</span></h4><p>Today: <b>'+tk+' / '+tt+'</b> doses taken<br>'+(adh>=80?'Excellent consistency! · สม่ำเสมอมาก':'Try to take every dose on time · พยายามกินยาให้ตรงเวลา')+'</p></div>';
  const now=new Date(),nowM=now.getHours()*60+now.getMinutes();
  const meds=u.medications.slice().sort((a,b)=>a.time.localeCompare(b.time));
  $('medList').innerHTML=meds.length?meds.map(m=>{
    const taken=m.takenOn===dKey(),[hh,mm]=m.time.split(':').map(Number),missed=!taken&&(nowM-(hh*60+mm))>120;
    const cls=taken?'taken':missed?'missed':'pending',txt=taken?'Taken · กินแล้ว ✓':missed?'Missed · พลาด':'Pending · รอกิน';
    const btn=taken?'<button class="med-btn undo" onclick="undoMed(\''+m.id+'\')" title="Undo"><i class="fas fa-rotate-left"></i></button>':'<button class="med-btn" onclick="takeMed(\''+m.id+'\')"><i class="fas fa-check"></i> Take · กินแล้ว</button>';
    return '<div class="med-item"><div class="med-dot '+cls+'"></div><div class="med-info">'+esc(m.name)+(m.dose?' '+esc(m.dose):'')+'<small class="s-'+cls+'">'+m.time+' · '+txt+'</small></div>'+btn+
      '<button class="med-del" onclick="deleteMed(\''+m.id+'\')" aria-label="Delete"><i class="fas fa-trash"></i></button></div>';
  }).join(''):'<div class="card"><div class="empty"><i class="fas fa-pills"></i>No medications yet · ยังไม่มีรายการยา<br><button class="btn btn-pri" onclick="openMedModal()">Add medication</button></div></div>';

  // recent readings
  const recent=sortedBs(u).slice(-6).reverse();
  $('readingList').innerHTML=recent.length?recent.map(l=>{const s=bsStatus(l.val,u),c=CTX[l.ctx]||CTX.random;
    return '<div class="rd-item"><div class="rd-val" style="color:'+KCOL[s.k]+'">'+l.val+'<small>mg/dL</small></div><div class="rd-info">'+c.en+' · '+c.th+'<small>'+dayLabel(l.ts)+' · '+fmtTime(l.ts)+'</small></div>'+pillHtml(s).replace(/ · .*?</,'<')+
      '<button class="med-del" onclick="deleteReading('+l.ts+')" aria-label="Delete"><i class="fas fa-trash"></i></button></div>';
  }).join(''):'<div class="empty"><i class="fas fa-droplet"></i>No readings yet · ยังไม่มีบันทึก<br><button class="btn btn-pri" onclick="openBsModal()">Log first reading</button></div>';
}
function buildChart(logs,u){
  if(!logs.length)return '<div class="empty"><i class="fas fa-chart-line"></i>No readings in this period<br>ยังไม่มีข้อมูลในช่วงนี้<br><button class="btn btn-pri" onclick="openBsModal()">Log a reading</button></div>';
  const W=320,H=165,pl=26,pr=10,pt=14,pb=24,n=logs.length;
  const vals=logs.map(l=>l.val),ymin=40,ymax=Math.max(220,Math.ceil((Math.max(...vals)+10)/20)*20);
  const x=i=>pl+(n===1?(W-pl-pr)/2:i*(W-pl-pr)/(n-1)),y=v=>pt+(1-(v-ymin)/(ymax-ymin))*(H-pt-pb);
  const t=+u.target||120,top=Math.min(t+20,ymax);
  let s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Blood sugar trend chart"><defs><linearGradient id="bsGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14B8A6" stop-opacity=".35"/><stop offset="1" stop-color="#14B8A6" stop-opacity="0"/></linearGradient></defs>';
  s+='<rect class="c-band" x="'+pl+'" y="'+y(top)+'" width="'+(W-pl-pr)+'" height="'+(y(70)-y(top))+'" rx="4"/>';
  [70,120,180,ymax>=240?240:null].filter(Boolean).forEach(v=>{s+='<line class="c-grid" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text class="c-lbl" x="'+(pl-5)+'" y="'+(y(v)+3)+'" text-anchor="end">'+v+'</text>';});
  s+='<line class="c-target" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(t)+'" y2="'+y(t)+'"/>';
  const pts=logs.map((l,i)=>[x(i),y(l.val)]);
  if(n>1){
    let d='M'+pts[0][0]+','+pts[0][1];
    for(let i=0;i<n-1;i++){
      const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
      d+=' C'+(p1[0]+(p2[0]-p0[0])/6)+','+(p1[1]+(p2[1]-p0[1])/6)+' '+(p2[0]-(p3[0]-p1[0])/6)+','+(p2[1]-(p3[1]-p1[1])/6)+' '+p2[0]+','+p2[1];
    }
    s+='<path class="c-area" d="'+d+' L'+pts[n-1][0]+','+(H-pb)+' L'+pts[0][0]+','+(H-pb)+' Z" fill="url(#bsGrad)"/><path class="c-line" pathLength="1000" d="'+d+'"/>';
  }
  logs.forEach((l,i)=>{s+='<circle class="c-dot" id="cd'+i+'" cx="'+pts[i][0]+'" cy="'+pts[i][1]+'" r="'+(n>20?3.2:4.5)+'" fill="'+KCOL[bsStatus(l.val,u).k]+'"/><circle class="c-hit" cx="'+pts[i][0]+'" cy="'+pts[i][1]+'" r="'+Math.max(7,Math.min(14,(W-pl-pr)/n/2))+'" onclick="showPoint('+i+')"/>';});
  const ticks=Math.min(5,n);
  for(let k=0;k<ticks;k++){const i=ticks===1?0:Math.round(k*(n-1)/(ticks-1));s+='<text class="c-lbl" x="'+x(i)+'" y="'+(H-6)+'" text-anchor="middle">'+fmtDate(logs[i].ts)+'</text>';}
  s+='</svg><div class="legend"><span><i style="background:#3B82F6"></i>Low</span><span><i style="background:#10B981"></i>Good</span><span><i style="background:#F59E0B"></i>Elevated</span><span><i style="background:#EF4444"></i>High</span></div>';
  return s;
}
function showPoint(i){
  const l=chartLogs[i];if(!l)return;
  const u=DataStore.get(),s=bsStatus(l.val,u),c=CTX[l.ctx]||CTX.random;
  qsa('.c-dot').forEach(d=>d.classList.remove('sel'));const d=$('cd'+i);if(d)d.classList.add('sel');
  $('trendInfo').innerHTML='<b style="color:'+KCOL[s.k]+'">'+l.val+'</b>mg/dL · '+s.en+' · '+c.en+' · '+fmtDate(l.ts)+' '+fmtTime(l.ts);
}

/* ---------- Medications ---------- */
function takeMed(id){
  const u=DataStore.get();const m=u.medications.find(x=>x.id===id);if(!m)return;
  m.takenOn=dKey();u.stats.medsTaken++;markDay(u);
  commit(u);toast('Dose logged · บันทึกแล้ว',m.name+' '+m.time,'ok');
}
function undoMed(id){const u=DataStore.get();const m=u.medications.find(x=>x.id===id);if(!m)return;m.takenOn='';u.stats.medsTaken=Math.max(0,u.stats.medsTaken-1);commit(u);}
function deleteMed(id){
  showConfirm({title:'Remove this medication?',msg:'It will be removed from your daily list.<br>ลบออกจากรายการยาประจำวัน',okText:'Remove · ลบ',danger:true},()=>{
    const u=DataStore.get();u.medications=u.medications.filter(m=>m.id!==id);commit(u);
  });
}
function openMedModal(){$('medName').value='';$('medDose').value='';$('medTime').value='08:00';openModal('medModal');setTimeout(()=>$('medName').focus(),350);}
function saveMed(){
  const name=$('medName').value.trim();
  if(!name){$('medName').classList.add('err');setTimeout(()=>$('medName').classList.remove('err'),800);return;}
  const u=DataStore.get();
  u.medications.push({id:'m'+Date.now(),name,dose:$('medDose').value.trim(),time:$('medTime').value||'08:00',takenOn:''});
  closeModal('medModal');commit(u);toast('Medication added · เพิ่มยาแล้ว',name,'ok');
}

/* ---------- Chat ---------- */
const qaBank=[
  {q:['blood sugar','log blood','น้ำตาล','บันทึก'],r:'Great job tracking! 🎯 For HbA1c of {hba1c}%, aim for fasting 80-130 mg/dL. Your latest was {bs} mg/dL.\nTip: just type e.g. **"น้ำตาล 128"** and I will log it for you!\nเป้าหมายน้ำตาลเช้าอยู่ที่ 80-130 mg/dL',pts:5,a:['bs','dash']},
  {q:['medication','meds','med','ยา','กินยา'],r:'Consistency is key—same time daily helps maintain stable levels. 💊\nความสม่ำเสมอสำคัญมาก\n\nCommon T2D medications:\n• Metformin — first-line treatment\n• Sulfonylureas — stimulate insulin\n• DPP-4 inhibitors — incretin-based\n• SGLT2 inhibitors — kidney glucose',pts:5,a:['meds','scan']},
  {q:['eat','food','diet','อาหาร','กิน'],r:'Great question! 🥗\n• Non-starchy vegetables (ผักใบเขียว)\n• Lean proteins like fish, chicken (โปรตีนไขมันต่ำ)\n• Whole grains in moderation (ธัญพืช)\n• Healthy fats: nuts, avocado, olive oil\n• Low-GI fruits: berries, apples\n\n❌ Avoid:\n• Sugary drinks & fruit juices\n• White rice in large portions\n• Processed snacks & sweets\n• Deep fried foods\n\nTip: ใช้จานสุขภาพ ½ ผัก ¼ โปรตีน ¼ คาร์บ',pts:5},
  {q:['exercise','workout','ออกกำลัง','เดิน'],r:'Exercise helps blood sugar control! 🏃\n• Aim 150 min/week moderate activity\n• Walking 15-30 min after meals\n• Swimming, cycling, yoga\n• Resistance training 2-3x/week\n• Start slow, build up gradually\n\nBenefits:\n✅ Lowers blood sugar immediately\n✅ Improves insulin sensitivity\n✅ Reduces cardiovascular risk\n✅ Helps weight management\n\nเดินหลังอาหาร 15 นาทีช่วยลดน้ำตาลได้ดี',pts:5},
  {q:['progress','coach','ความก้าวหน้า'],r:'You\'re doing great, {name}! 📊 You\'ve earned {pts} points.\n\nYour Health Summary:\n• HbA1c: {hba1c}%\n• Latest BS: {bs} mg/dL\n• Keep completing daily tasks!\n\nคุณทำได้ดีมาก! มี {pts} แต้มแล้ว',pts:5,a:['dash']},
  {q:['hba1c','เอชบีเอ','a1c'],r:'Your HbA1c is {hba1c}%. Target for most T2D patients is below 7%.\nค่า HbA1c คือ {hba1c}%\n\nWhat HbA1c means:\n• <5.7% = Normal\n• 5.7-6.4% = Prediabetes\n• ≥6.5% = Diabetes\n\nTips to lower:\n1. Monitor blood sugar regularly\n2. Take medications as prescribed\n3. Exercise regularly\n4. Follow a balanced diet\n5. Manage stress effectively',pts:5,a:['hba1c']},
  {q:['complication','ภาวะแทรกซ้อน','อันตราย'],r:'Common T2D complications:\n🔹 Diabetic retinopathy — eye damage\n🔹 Nephropathy — kidney damage\n🔹 Neuropathy — nerve damage\n🔹 Cardiovascular disease\n🔹 Diabetic foot — poor wound healing\n\nPrevention:\n✅ Keep HbA1c < 7%\n✅ Control blood pressure\n✅ Regular eye & kidney checkups\n✅ Daily foot inspection\n\nการควบคุมที่ดีช่วยป้องกันภาวะแทรกซ้อนได้',pts:5},
  {q:['stress','เครียด','นอน','sleep','วิตก'],r:'Stress and poor sleep affect blood sugar! 😴\n\nStress Management:\n• Deep breathing 5-10 min daily\n• Progressive muscle relaxation\n• Mindfulness meditation\n• Light walking in nature\n• Talk to loved ones\n\nSleep Tips:\n• Aim 7-8 hours\n• Regular sleep schedule\n• Avoid screens before bed\n• Keep bedroom cool & dark\n\nความเครียดและนอนไม่พอส่งผลต่อน้ำตาลในเลือด',pts:5},
  {q:['point','แต้ม','reward','รางวัล','level','เลเวล'],r:'Points System 🌟\n• Daily Login: +5\n• Log Blood Sugar: +10\n• Log Medication: +10\n• Drink 8 glasses: +10\n• Weekly challenges: +20 to +50\n• Monthly HbA1c update: +100\n• Unlock badges for bonus points!\n\nYour points: **{pts}**\n\nระบบแต้มช่วยสร้างแรงจูงใจในการดูแลสุขภาพ',pts:0,a:['level']},
  {q:['self management','self-management','การจัดการ','ดูแลตัวเอง'],r:'Self-management for T2D:\n1️⃣ Blood sugar monitoring (ตรวจน้ำตาล)\n2️⃣ Medication adherence (กินยาตรงเวลา)\n3️⃣ Healthy diet (อาหารสุขภาพ)\n4️⃣ Regular exercise (ออกกำลังกาย)\n5️⃣ Stress management (จัดการความเครียด)\n6️⃣ Regular checkups (พบแพทย์ตามนัด)\n7️⃣ Foot care (ดูแลเท้า)\n\nThis chatbot helps you track all of these! 💪',pts:5},
  {q:['water','น้ำ','drink','ดื่ม','ดื่มน้ำ'],r:'Hydration is important for diabetes! 💧\n\n• Drink 8-10 glasses/day (2-2.5L)\n• Water is the best choice\n• Avoid sugary drinks & sodas\n• Unsweetened tea is OK\n• Limit fruit juice\n\nDehydration can raise blood sugar levels!\nการดื่มน้ำเพียงพอช่วยควบคุมน้ำตาลได้',pts:3,a:['water']},
  {q:['weight','น้ำหนัก','ลดน้ำหนัก','อ้วน','bmi'],r:'Weight management for T2D:\n\nYour weight: **{weight} kg** (BMI {bmi})\n\n• Losing 5-7% body weight improves insulin sensitivity\n• Focus on gradual loss (0.5-1 kg/week)\n• Combine diet + exercise\n• Avoid crash diets\n• Track portions, not just calories\n\nTips:\n🥗 Eat more vegetables\n🚶 Walk 30 min daily\n📏 Measure portions\n📝 Keep a food diary\n\nการลดน้ำหนัก 5-7% ช่วยให้อินซูลินทำงานดีขึ้น',pts:3,a:['dash']},
  {q:['insulin','อินซูลิน','ฉีด'],r:'About Insulin 💉:\n\nInsulin may be needed when:\n• Oral meds aren\'t enough\n• HbA1c remains high (>8-9%)\n• During illness or surgery\n\nTypes:\n• Rapid-acting (before meals)\n• Long-acting (once daily)\n• Premixed (combination)\n\nImportant:\n✅ Rotate injection sites\n✅ Store properly (2-8°C)\n✅ Never skip doses\n✅ Monitor for hypoglycemia\n\nอินซูลินช่วยควบคุมน้ำตาลเมื่อยากินไม่เพียงพอ',pts:5},
  {q:['foot','เท้า','แผล','บาดแผล'],r:'Diabetic Foot Care 🦶:\n\n• Inspect feet daily\n• Wash with warm (not hot) water\n• Moisturize, but not between toes\n• Wear comfortable, closed shoes\n• Cut nails straight across\n• Never walk barefoot\n\n⚠️ See doctor immediately for:\n• Cuts that won\'t heal\n• Redness or swelling\n• Numbness or tingling\n• Color changes\n\nการดูแลเท้าสำคัญมากสำหรับผู้ป่วยเบาหวาน',pts:5},
  {q:['hypo','น้ำตาลต่ำ','low sugar','หน้ามืด','เวียนหัว','ใจสั่น'],r:'Hypoglycemia (Low Blood Sugar) ⚠️\nBlood sugar < 70 mg/dL\n\nSymptoms:\n• Shakiness, sweating\n• Dizziness, confusion\n• Rapid heartbeat\n• Hunger, weakness\n\nTreatment (Rule of 15):\n1. Eat 15g fast-acting carbs\n   (glucose tablet, juice, candy)\n2. Wait 15 minutes\n3. Recheck blood sugar\n4. Repeat if still low\n\nAlways carry glucose tablets!\nพกลูกอมหรือน้ำผลไม้ไว้เสมอ',pts:5,a:['bs'],alert:true},
  {q:['check','ตรวจ','checkup','พบแพทย์','หมอ'],r:'Regular Checkups for T2D 🏥:\n\nEvery 3 months:\n• HbA1c test\n• Blood sugar review\n• Medication adjustment\n\nEvery 6-12 months:\n• Eye exam (จักษุแพทย์)\n• Kidney function (creatinine)\n• Lipid profile (cholesterol)\n• Foot examination\n• Blood pressure check\n\nDon\'t skip appointments!\nอย่าลืมพบแพทย์ตามนัดเสมอ',pts:5},
  {q:['sick','ป่วย','ไข้','flu','ไม่สบาย'],r:'Sick Day Management 🤒:\n\nWhen you\'re sick:\n• Continue diabetes medications\n• Check blood sugar every 2-4 hours\n• Stay hydrated\n• Eat small, frequent meals\n• Rest adequately\n\n⚠️ Seek medical help if:\n• Blood sugar >300 mg/dL\n• Vomiting >6 hours\n• Fever >38.5°C for 24+ hours\n• Difficulty breathing\n\nเมื่อป่วยควรตรวจน้ำตาลถี่ขึ้นและดื่มน้ำมากๆ',pts:5},
  {q:['hello','hi','สวัสดี','หวัดดี','hey'],r:'Hello {name}! 👋 I\'m your T2D Health Coach.\n\nI can help you with:\n🩸 Blood sugar tracking\n💊 Medication reminders\n🥗 Diet advice\n🏃 Exercise tips\n📊 Health progress\n😴 Stress & sleep\n🦶 Foot care\n\nWhat would you like to know?\nสวัสดีค่ะ ถามอะไรได้เลยค่ะ',pts:2},
  {q:['thank','ขอบคุณ','thanks'],r:'You\'re welcome, {name}! 😊\nRemember: small daily steps lead to big health improvements.\n\nKeep up the great work!\nยินดีค่ะ ทำต่อไปนะคะ ทุกก้าวเล็กๆ สำคัญ! 💪',pts:2},
  {q:['alcohol','เหล้า','เบียร์','แอลกอฮอล์'],r:'Alcohol & Diabetes 🍷:\n\n• Limit to 1 drink/day (women), 2 (men)\n• Never drink on empty stomach\n• Choose dry wine or light beer\n• Avoid sweet cocktails\n• Monitor blood sugar closely\n• Alcohol can cause delayed hypoglycemia\n\n⚠️ Some meds interact with alcohol!\nConsult your doctor first.\n\nแอลกอฮอล์อาจทำให้น้ำตาลต่ำได้ ระวังด้วย',pts:3},
  {q:['smoking','บุหรี่','สูบ'],r:'Smoking & Diabetes 🚭:\n\nSmoking increases risk of:\n• Heart disease (2-4x higher)\n• Kidney damage\n• Nerve damage\n• Poor circulation\n• Slow wound healing\n\nQuitting benefits:\n✅ Better blood sugar control\n✅ Lower cardiovascular risk\n✅ Improved circulation\n✅ Better lung function\n\nAsk your doctor about quit programs!\nเลิกบุหรี่ช่วยลดความเสี่ยงภาวะแทรกซ้อนได้มาก',pts:3}
];
const CHAT_ACTIONS={
  bs:{l:'🩸 Log sugar · บันทึกน้ำตาล',f:()=>openBsModal()},
  meds:{l:'💊 My meds · ยาของฉัน',f:()=>goMeds()},
  scan:{l:'📷 Scan med · สแกนยา',f:()=>nav('ocr')},
  dash:{l:'📊 Dashboard · สถิติ',f:()=>nav('dashboard')},
  water:{l:'💧 Add water · เพิ่มน้ำ',f:()=>{addWater(1);}},
  hba1c:{l:'📈 Update HbA1c · อัปเดต',f:()=>openHba1cModal()},
  level:{l:'⭐ Level & badges · เลเวล',f:()=>openLevelInfo()}
};
const CHIP_POOL=['📊 สรุปวันนี้ · Daily summary','🩸 บันทึกน้ำตาล · Log sugar','🥗 อาหารที่ควรกิน','🏃 ออกกำลังกาย · Exercise','💧 ดื่มน้ำ · Hydration','😴 ความเครียดและการนอน','🦶 ดูแลเท้า · Foot care','⚖️ น้ำหนัก · Weight','📈 ค่า HbA1c','🚨 น้ำตาลต่ำ ทำอย่างไร','⭐ ระบบแต้ม · Points','🏥 ตรวจสุขภาพ · Checkup'];
const ChatStore={get(){try{return JSON.parse(localStorage.getItem(CHAT_KEY)||'[]');}catch(e){return[];}},
  add(m){const l=this.get();l.push(m);try{localStorage.setItem(CHAT_KEY,JSON.stringify(l.slice(-60)));}catch(e){}},clear(){localStorage.removeItem(CHAT_KEY);}};
const fmt=t=>esc(t).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
function renderMsg(m,animate=true){
  const d=document.createElement('div');d.className='msg '+m.role+(m.alert?' alert':'');
  if(!animate)d.style.animation='none';
  let h=fmt(m.text);
  if(m.acts&&m.acts.length)h+='<div class="msg-acts">'+m.acts.map(k=>'<button onclick="chatAction(\''+k+'\')">'+CHAT_ACTIONS[k].l+'</button>').join('')+'</div>';
  d.innerHTML=h+'<span class="msg-time">'+fmtTime(m.ts)+'</span>';
  $('chatBody').appendChild(d);scrollChat();
}
const scrollChat=()=>{const b=$('chatBody');requestAnimationFrame(()=>b.scrollTop=b.scrollHeight);};
function chatAction(k){const a=CHAT_ACTIONS[k];if(a)a.f();}
function pushMsg(role,text,extra={}){const m=Object.assign({role,text,ts:Date.now()},extra);ChatStore.add(m);renderMsg(m);return m;}
function randChips(n=4,exclude=''){
  return CHIP_POOL.filter(c=>c!==exclude).sort(()=>Math.random()-.5).slice(0,n);
}
function refreshChips(list){
  $('chipArea').innerHTML=list.map(c=>'<button class="chip" data-q="'+esc(c)+'">'+esc(c)+'</button>').join('');
}
$('chipArea').addEventListener('click',e=>{const b=e.target.closest('.chip');if(b)sendText(b.dataset.q);});
function initChat(){
  const u=DataStore.get()||{},hist=ChatStore.get();
  $('chatBody').innerHTML='';
  if(hist.length)hist.forEach(m=>renderMsg(m,false));
  else pushMsg('bot','Hello **'+(u.name||'there')+'**! 👋 Your current HbA1c is '+(u.hba1c||'N/A')+'%. How can I help you manage your health today?\n\nสวัสดีค่ะ คุณ'+(u.name||'')+' ค่า HbA1c ปัจจุบันคือ '+(u.hba1c||'-')+'% วันนี้ให้ช่วยอะไรดีคะ?\n\n💡 Tip: type "น้ำตาล 128" to log a reading instantly.',{acts:['bs','dash']});
  refreshChips(['📊 สรุปวันนี้ · Daily summary','🩸 บันทึกน้ำตาล · Log sugar','🥗 อาหารที่ควรกิน','🏃 ออกกำลังกาย · Exercise','💧 ดื่มน้ำ · Hydration','⭐ ระบบแต้ม · Points']);
  scrollChat();
}
function clearChat(){
  showConfirm({title:'Clear conversation?',msg:'Chat history will be deleted.<br>ลบประวัติการสนทนาทั้งหมด',okText:'Clear · ล้าง',danger:true},()=>{ChatStore.clear();initChat();});
}
function sendMsg(){const v=$('chatIn').value.trim();if(!v)return;$('chatIn').value='';sendText(v);}
function sendText(t){
  pushMsg('user',t);
  const typing=document.createElement('div');typing.className='msg bot typing';typing.innerHTML='<i></i><i></i><i></i>';
  $('chatBody').appendChild(typing);scrollChat();
  setTimeout(()=>{typing.remove();botReply(t);},600+Math.random()*500);
}
function goChat(topic){nav('chat');setTimeout(()=>sendText(topic),350);}
function kwMatch(ql,k){return(/^[a-z0-9 ]+$/.test(k)&&k.length<=3)?new RegExp('\\b'+k+'\\b').test(ql):ql.includes(k);}
function matchQA(ql){
  let best=null,bs=0;
  qaBank.forEach(qa=>{let s=0;qa.q.forEach(k=>{if(kwMatch(ql,k))s+=k.length;});if(s>bs){bs=s;best=qa;}});
  return best;
}
function tryParseBs(t){
  const tl=t.toLowerCase();
  if(/hba1c|a1c|เอชบีเอ/.test(tl)||!/(น้ำตาล|sugar|glucose|\bbs\b)/.test(tl))return null;
  const m=tl.match(/(\d{2,3})(?!\d)/);if(!m)return null;
  const v=+m[1];if(v<20||v>600)return null;
  const ctx=/ก่อนอาหาร|before/.test(tl)?'before':/หลังอาหาร|after/.test(tl)?'after':/ก่อนนอน|bed/.test(tl)?'bed':/ตื่น|เช้า|fasting|งดอาหาร/.test(tl)?'fasting':'random';
  return{v,ctx};
}
function dailySummary(u){
  const t=allBsToday(u).sort((a,b)=>a.ts-b.ts),tk=medsTakenToday(u).length,tm=u.medications.length;
  const dn=TASKS.daily.filter(x=>u.tasks.daily.done[x.id]).length;
  let s='📊 **Today\'s summary · สรุปวันนี้**\n\n';
  s+='🩸 Blood sugar: '+(t.length?t.map(l=>l.val).join(', ')+' mg/dL ('+t.length+' reading'+(t.length>1?'s':'')+')':'no reading yet — please log one · ยังไม่ได้บันทึก')+'\n';
  s+='💊 Medication: '+tk+'/'+tm+' doses taken · กินยา '+tk+'/'+tm+' มื้อ\n';
  s+='💧 Water: '+u.water.count+'/8 glasses · ดื่มน้ำ '+u.water.count+'/8 แก้ว\n';
  s+='✅ Tasks: '+dn+'/'+TASKS.daily.length+' · 🔥 Streak: '+u.streak+' days\n⭐ Points: '+u.points+' (Lv.'+getLevelInfo(u.points).level+')\n\n';
  const todo=[];if(!t.length)todo.push('bs');if(tk<tm)todo.push('meds');if(u.water.count<8)todo.push('water');
  s+=todo.length?'Next up: let\'s finish the remaining items! 💪\nมาทำที่เหลือให้ครบกันนะคะ':'Amazing! You completed everything today. 🎉\nยอดเยี่ยมมาก ทำครบทุกอย่างแล้ว!';
  return{text:s,acts:todo.slice(0,3)};
}
function botReply(q){
  const u=DataStore.get();if(!u)return;
  const ql=q.toLowerCase();let text,acts=[],alert=false,pts=0;
  const bsP=tryParseBs(q);
  if(bsP){
    const s=logBloodSugar(bsP.v,bsP.ctx,{quiet:true});
    text='✅ Logged **'+bsP.v+' mg/dL** ('+CTX[bsP.ctx].en+') — '+s.en+' · '+s.th+'\n\n';
    if(bsP.v<70){text+='⚠️ This is low! Eat 15g fast-acting carbs (juice, candy), then recheck in 15 minutes.\nน้ำตาลต่ำ! ดื่มน้ำผลไม้หรืออมลูกอม แล้ววัดซ้ำใน 15 นาที';alert=true;}
    else if(bsP.v>300){text+='🚨 Very high! Drink water, check for symptoms and contact your doctor promptly.\nน้ำตาลสูงมาก ควรติดต่อแพทย์โดยเร็ว';alert=true;}
    else if(bsP.v>180){text+='Your reading is high. Drink water, take a light walk and follow your medication plan.\nค่าค่อนข้างสูง ลองดื่มน้ำและเดินเบาๆ';acts=['dash'];}
    else if(bsP.v<=(+u.target||120)+20){text+='Excellent! Keep up the great control. 🌟\nยอดเยี่ยม ควบคุมได้ดีมาก';acts=['dash'];}
    else{text+='Slightly above target. A short walk after meals helps.\nสูงกว่าเป้าเล็กน้อย ลองเดินหลังอาหาร';acts=['dash'];}
  }else if(/สรุป|summary|วันนี้|today/.test(ql)&&!/ยา|อาหาร/.test(ql)){
    const s=dailySummary(u);text=s.text;acts=s.acts.length?s.acts:['dash'];
  }else{
    const m=matchQA(ql);
    if(m){
      const l=latestBs(u),bmi=calcBmi(u.weight,u.height);
      text=m.r.replace(/\{name\}/g,u.name||'').replace(/\{hba1c\}/g,u.hba1c||'N/A').replace(/\{pts\}/g,u.points||0)
        .replace(/\{bs\}/g,l?l.val:'--').replace(/\{weight\}/g,u.weight||'--').replace(/\{bmi\}/g,bmi?bmi.toFixed(1):'--');
      acts=m.a||[];alert=!!m.alert;pts=m.pts;
    }else{
      text='I\'m here to help! Try asking about:\n🩸 Blood sugar · น้ำตาล\n💊 Medication · ยา\n🥗 Diet · อาหาร\n🏃 Exercise · ออกกำลังกาย\n📊 HbA1c · น้ำตาลสะสม\n😴 Sleep & stress · การนอน\n💧 Hydration · น้ำ\n🦶 Foot care · ดูแลเท้า\n⚖️ Weight · น้ำหนัก\n\nลองถามได้เลยค่ะ 😊';pts=1;
    }
  }
  // chat usage accounting (re-read user because logBloodSugar may have saved)
  const u2=DataStore.get();
  u2.stats.chatMsgs++;u2.tasks.weekly.chats++;
  if(pts>0&&u2.chatPts.n<30){
    const g=Math.min(pts,30-u2.chatPts.n);u2.chatPts.n+=g;award(u2,g,'Chat with coach',true);
    text+='\n\n✨ +'+g+' points! (ได้ +'+g+' แต้ม) · '+u2.chatPts.n+'/30 today';
  }
  commit(u2);
  pushMsg('bot',text,{acts,alert});
  refreshChips(randChips(5,q));
}

/* ---------- OCR / Camera ---------- */
const mockMeds=[
  {drug:'Metformin HCl',dose:'500 mg',freq:'2x daily (เช้า-เย็น)',type:'Biguanide (ยาลดน้ำตาล)',note:'Take with meals (กินพร้อมอาหาร)',side:'Nausea, diarrhea (คลื่นไส้, ท้องเสีย)'},
  {drug:'Glipizide',dose:'5 mg',freq:'1x daily (เช้า)',type:'Sulfonylurea (กระตุ้นอินซูลิน)',note:'Take 30 min before breakfast',side:'Hypoglycemia, weight gain'},
  {drug:'Sitagliptin',dose:'100 mg',freq:'1x daily',type:'DPP-4 Inhibitor',note:'Can take with or without food',side:'Headache, nasopharyngitis'},
  {drug:'Empagliflozin',dose:'10 mg',freq:'1x daily (เช้า)',type:'SGLT2 Inhibitor',note:'Take in the morning',side:'UTI, dehydration risk'},
  {drug:'Pioglitazone',dose:'15 mg',freq:'1x daily',type:'Thiazolidinedione',note:'Monitor liver function',side:'Weight gain, edema'}
];
let camStream=null,camFacing='environment',camFlashOn=false,ocrBusy=false,lastScan=null,lastMedIdx=-1;
async function openCamera(){
  $('camOverlay').classList.add('open');
  const v=$('camVideo'),mode=$('camMode');
  v.style.display='none';mode.textContent='Demo viewfinder · โหมดจำลอง';
  if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia){
    try{
      camStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:camFacing}},audio:false});
      v.srcObject=camStream;v.style.display='block';mode.textContent='Live camera · กล้องจริง';
      v.play().catch(()=>{});
    }catch(e){camStream=null;}
  }
}
function stopCam(){if(camStream){camStream.getTracks().forEach(t=>t.stop());camStream=null;}$('camVideo').srcObject=null;}
function closeCamera(){stopCam();camFlashOn=false;$('camFlash').classList.remove('on');$('camOverlay').classList.remove('open');}
function switchCamera(){camFacing=camFacing==='environment'?'user':'environment';stopCam();openCamera();}
function toggleFlash(){
  camFlashOn=!camFlashOn;$('camFlash').classList.toggle('on',camFlashOn);
  const tr=camStream&&camStream.getVideoTracks()[0];
  if(tr&&tr.getCapabilities&&tr.getCapabilities().torch)tr.applyConstraints({advanced:[{torch:camFlashOn}]}).catch(()=>{});
}
function capturePhoto(){
  const vf=$('camVf'),v=$('camVideo');let img=null;
  if(v.style.display==='block'&&v.videoWidth){
    const c=document.createElement('canvas');const s=Math.min(1,640/v.videoWidth);c.width=v.videoWidth*s;c.height=v.videoHeight*s;
    c.getContext('2d').drawImage(v,0,0,c.width,c.height);img=c.toDataURL('image/jpeg',.7);
  }
  vf.style.background='#fff';
  setTimeout(()=>{vf.style.background='';closeCamera();runOCR(img);},250);
}
$('galleryInput').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  resizeImage(f,640,url=>runOCR(url));e.target.value='';
});
function resizeImage(file,max,cb){
  const r=new FileReader();
  r.onload=ev=>{const im=new Image();im.onload=()=>{
    const s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');
    c.width=im.width*s;c.height=im.height*s;c.getContext('2d').drawImage(im,0,0,c.width,c.height);cb(c.toDataURL('image/jpeg',.75));
  };im.src=ev.target.result;};
  r.readAsDataURL(file);
}
function runOCR(imgUrl){
  if(ocrBusy)return;ocrBusy=true;
  if(currentPage!=='ocr')nav('ocr');
  let i;do{i=Math.floor(Math.random()*mockMeds.length);}while(i===lastMedIdx);lastMedIdx=i;
  const m=mockMeds[i];
  const pv=$('ocrPreview');
  if(imgUrl){$('ocrPreviewImg').src=imgUrl;pv.style.display='block';}else pv.style.display='none';
  $('ocrResult').style.display='none';
  const proc=$('ocrProcessing');proc.classList.add('show');
  const steps=['ocrStep1','ocrStep2','ocrStep3'];
  steps.forEach(id=>{$(id).className='ocr-step';$(id).querySelector('i').className='fas fa-circle';});
  $('ocrStep1').classList.add('active');
  const done=(id,next)=>{$(id).className='ocr-step done';$(id).querySelector('i').className='fas fa-check-circle';if(next)$(next).classList.add('active');};
  setTimeout(()=>done('ocrStep1','ocrStep2'),800);
  setTimeout(()=>done('ocrStep2','ocrStep3'),1600);
  setTimeout(()=>done('ocrStep3'),2200);
  setTimeout(()=>{
    proc.classList.remove('show');lastScan=m;
    $('ocrDrug').textContent=m.drug;$('ocrDose').textContent=m.dose;$('ocrFreq').textContent=m.freq;
    $('ocrType').textContent=m.type;$('ocrNote').textContent=m.note;$('ocrSide').textContent=m.side;
    $('ocrConf').textContent=(94+Math.floor(Math.random()*6))+'% match';
    $('ocrResult').style.display='block';
    setTimeout(()=>$('ocr').scrollTo({top:$('ocrResult').offsetTop-70,behavior:'smooth'}),50);
    const u=DataStore.get();
    if(u){
      u.stats.scans++;u.tasks.weekly.scans++;
      u.scans.unshift({drug:m.drug,dose:m.dose,ts:Date.now()});u.scans=u.scans.slice(0,8);
      u.scanToday.n++;if(u.scanToday.n<=3)award(u,5,'Scan medication');
      markDay(u);commit(u);
    }
    ocrBusy=false;renderScanHist();
  },2800);
}
function renderScanHist(){
  const u=DataStore.get(),l=(u&&u.scans)||[];
  $('scanHistTitle').style.display=$('scanHist').style.display=l.length?'block':'none';
  $('scanHistTitle').style.display=l.length?'flex':'none';
  $('scanHist').innerHTML=l.slice(0,5).map(s=>'<div class="rd-item"><div class="task-ic v" style="width:34px;height:34px;font-size:13px"><i class="fas fa-pills"></i></div><div class="rd-info">'+esc(s.drug)+' '+esc(s.dose)+'<small>'+agoText(s.ts)+'</small></div></div>').join('');
}
function addScannedMed(){
  if(!lastScan)return;
  const u=DataStore.get();if(!u)return;
  const n=parseInt((lastScan.freq.match(/(\d)x/)||[0,1])[1]);
  const times=n>=3?['08:00','12:00','18:00']:n===2?['08:00','18:00']:['08:00'];
  times.forEach(t=>{if(!u.medications.some(m=>m.name===lastScan.drug&&m.time===t))u.medications.push({id:'m'+Date.now()+t.replace(':',''),name:lastScan.drug,dose:lastScan.dose,time:t,takenOn:''});});
  commit(u);toast('Added to your meds · เพิ่มแล้ว',lastScan.drug+' ('+times.join(', ')+')','ok');
}
function askAboutScanned(){if(lastScan)goChat('ยา '+lastScan.drug+' — medication info');}

/* ---------- Notifications ---------- */
function buildNotifs(u){
  const L=[],today=dKey(),now=new Date(),nowM=now.getHours()*60+now.getMinutes();
  u.medications.forEach(m=>{
    if(m.takenOn===today)return;const[h,mm]=m.time.split(':').map(Number),diff=nowM-(h*60+mm);
    if(diff>=-30)L.push({key:'med-'+m.id+'-'+today,ic:'fa-pills',c:'y',t:diff>120?'Missed medication · พลาดการกินยา':'Time for Medication · ถึงเวลากินยา',p:m.name+' '+(m.dose||'')+' was scheduled at '+m.time+'. Tap to mark as taken.',s:'Scheduled '+m.time,act:'goMeds()'});
  });
  const l=latestBs(u);
  if(l&&dKey(new Date(l.ts))===today&&(l.val>180||l.val<70))L.push({key:'bsalert-'+l.ts,ic:'fa-triangle-exclamation',c:'r',t:l.val<70?'Low blood sugar alert · น้ำตาลต่ำ':'High blood sugar alert · น้ำตาลสูง',p:'Your latest reading is '+l.val+' mg/dL. '+(l.val<70?'Eat fast-acting carbs and recheck in 15 min.':'Drink water and contact your doctor if it stays high.'),s:agoText(l.ts),act:"nav('chat')"});
  if(!allBsToday(u).length)L.push({key:'bs-'+today,ic:'fa-droplet',c:'b',t:'Log your blood sugar · บันทึกน้ำตาลวันนี้',p:'You have not logged a reading today. Earn +10 pts!',s:'Daily reminder',act:'openBsModal()'});
  if(u.water.count<8&&now.getHours()>=12)L.push({key:'water-'+today,ic:'fa-glass-water',c:'b',t:'Stay hydrated · อย่าลืมดื่มน้ำ',p:'You have had '+u.water.count+'/8 glasses today.',s:'Daily reminder'});
  const wd=u.tasks.weekly.days.length;
  if(wd>0&&wd<5)L.push({key:'wk-'+wKey()+'-'+wd,ic:'fa-bullseye',c:'g',t:'Weekly Challenge · ภารกิจสัปดาห์',p:'You have logged '+wd+'/5 days. '+(5-wd)+' more to earn 50 pts!',s:'This week'});
  if(u.streak>=3)L.push({key:'streak-'+u.streak,ic:'fa-fire',c:'v',t:u.streak+'-day streak! 🔥 · ต่อเนื่อง '+u.streak+' วัน',p:'Keep opening the app every day to extend it.',s:'Streak'});
  if(!u.tasks.monthly.updated)L.push({key:'hb-'+mKey(),ic:'fa-star',c:'r',t:'Monthly HbA1c update · อัปเดต HbA1c',p:'Enter your latest lab result to earn +100 pts.',s:'This month',act:'openHba1cModal()'});
  return L;
}
function unreadCount(u){return u.notifications===false?0:buildNotifs(u).filter(n=>!u.readNotifs.includes(n.key)).length;}
function updateNotifBadge(){
  const u=DataStore.get(),b=$('notifBadge');if(!b)return;
  const n=u?unreadCount(u):0;
  b.style.display=n?'flex':'none';b.textContent=n>9?'9+':n;
}
function openNotif(){
  const u=DataStore.get();if(!u)return;
  const L=buildNotifs(u);
  $('notifList').innerHTML=L.length?L.map(n=>'<div class="nt'+(u.readNotifs.includes(n.key)?'':' unread')+'"'+(n.act?' style="cursor:pointer" onclick="closeNotif();'+n.act+'"':'')+'><div class="nt-ic '+n.c+'"><i class="fas '+n.ic+'"></i></div><div style="flex:1"><h4>'+n.t+'</h4><p>'+n.p+'</p><small>'+n.s+'</small></div></div>').join(''):'<div class="empty"><i class="fas fa-circle-check"></i>You\'re all caught up! 🎉<br>ไม่มีการแจ้งเตือนใหม่</div>';
  openModal('notifModal');
}
function closeNotif(){closeModal('notifModal');}
function markAllRead(){
  const u=DataStore.get();if(!u)return;
  u.readNotifs=Array.from(new Set(u.readNotifs.concat(buildNotifs(u).map(n=>n.key)))).slice(-120);
  DataStore.save(u);closeNotif();updateNotifBadge();
}
setInterval(()=>{if(currentPage!=='splash'&&currentPage!=='register')updateNotifBadge();},60000);

/* ---------- Level & badges ---------- */
function openLevelInfo(){
  const u=DataStore.get();if(!u)return;
  const pts=u.points||0,li=getLevelInfo(pts);
  const pct=li.level>=99?100:li.currentLevelPts/li.pointsToNext*100;
  let h='<div class="lvl-hero">'+ringHtml(pct,76,8,'#FDE68A','Lv.'+li.level)+'<div><h4>Level '+li.level+'</h4><p>'+pts+' total points<br>'+(li.level>=99?'MAX LEVEL':(li.pointsToNext-li.currentLevelPts)+' pts to Level '+(li.level+1))+'</p></div></div>';
  h+='<div class="lvl-h">Badges · เหรียญรางวัล ('+Object.keys(u.badges).length+'/'+Object.keys(BADGES).length+')</div><div class="badge-grid">';
  Object.keys(BADGES).forEach(id=>{const b=BADGES[id],got=!!u.badges[id];
    h+='<div class="bd'+(got?'':' locked')+'" style="--c:'+b.c+'"><div class="bd-ic"><i class="fas '+(got?b.ic:'fa-lock')+'"></i></div><b>'+b.en+'</b><small>'+b.th+'</small></div>';});
  h+='</div><div class="lvl-h">Next Levels · เลเวลถัดไป</div>';
  for(let i=1;i<=3;i++){const t=li.level+i;if(t>99)break;h+='<div class="lvl-row"><strong>Level '+t+'</strong><span>'+levelStart(t)+' pts</span></div>';}
  h+='<div class="lvl-h">Recent Activity · กิจกรรมล่าสุด</div>';
  h+=u.ptsLog.length?u.ptsLog.slice(0,6).map(a=>'<div class="act-row"><b>+'+a.pts+'</b><span>'+esc(a.reason)+'</span><small>'+agoText(a.ts).split(' · ')[0]+'</small></div>').join(''):'<div class="empty" style="padding:12px">No activity yet · ยังไม่มีกิจกรรม</div>';
  $('lvlModalBody').innerHTML=h;openModal('lvlModal');
}
function closeLevelInfo(){closeModal('lvlModal');}
function showLevelUp(l){$('luLevel').textContent=l;openModal('lvlUpModal');confetti(140);}

/* ---------- Settings ---------- */
function refreshSettings(){
  const u=DataStore.get()||{};
  $('setName').textContent=u.name||'User';
  const camB='<div class="cam-badge"><i class="fas fa-camera"></i></div>';
  $('setAvatar').innerHTML=(u.profileImg?'<img src="'+u.profileImg+'" alt="">':esc((u.name||'U').charAt(0).toUpperCase()))+camB;
  const li=getLevelInfo(u.points||0);
  $('setBadges').innerHTML='<span class="chip-glass"><i class="fas fa-star" style="color:#FCD34D"></i> Level '+li.level+'</span><span class="chip-glass"><i class="fas fa-fire"></i> '+(u.streak||0)+' day streak</span><span class="chip-glass"><i class="fas fa-medal" style="color:#FDE68A"></i> '+Object.keys(u.badges||{}).length+' badges</span>';
  $('sDispName').textContent=u.name||'-';
  $('sDispAge').textContent=u.age?u.age+' years (ปี)':'-';
  $('sDispHba1c').textContent=u.hba1c?u.hba1c+'%':'-';
  $('sDispHeight').textContent=u.height?u.height+' cm':'-';
  $('sDispWeight').textContent=u.weight?u.weight+' kg':'-';
  const b=calcBmi(u.weight,u.height);$('sDispBmi').textContent=b?b.toFixed(1)+' ('+bmiCat(b).en+')':'-';
  $('sDispTarget').textContent=(u.target||120)+' mg/dL';
  $('darkToggle').classList.toggle('on',document.documentElement.getAttribute('data-theme')==='dark');
  $('notiToggle').classList.toggle('on',u.notifications!==false);
}
function toggleDark(){
  const on=document.documentElement.getAttribute('data-theme')!=='dark';
  applyTheme(on);localStorage.setItem(THEME_KEY,on?'1':'0');
  const u=DataStore.get();if(u){u.darkMode=on;DataStore.save(u);}
  $('darkToggle').classList.toggle('on',on);
}
function toggleNoti(){
  const u=DataStore.get()||{};u.notifications=!(u.notifications!==false);DataStore.save(u);
  $('notiToggle').classList.toggle('on',u.notifications);updateNotifBadge();
  toast(u.notifications?'Notifications on · เปิดแจ้งเตือน':'Notifications off · ปิดแจ้งเตือน','','info');
}
$('profileInput').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  resizeImage(f,256,url=>{DataStore.update('profileImg',url);refreshSettings();toast('Profile photo updated · อัปเดตรูปแล้ว','','ok');});e.target.value='';
});
function openEditProfile(){
  const u=DataStore.get()||{};
  $('editName').value=u.name||'';$('editAge').value=u.age||'';$('editHeight').value=u.height||'';
  $('editHba1c').value=u.hba1c||'';$('editWeight').value=u.weight||'';$('editTarget').value=u.target||120;
  openModal('editModal');
}
function closeEditModal(){closeModal('editModal');}
function saveEditProfile(){
  const u=DataStore.get()||{};
  const g=id=>$(id).value.trim();
  const bad=(id)=>{$(id).classList.add('err');setTimeout(()=>$(id).classList.remove('err'),900);};
  if(!g('editName'))return bad('editName');
  const age=+g('editAge'),h=+g('editHeight'),w=+g('editWeight'),hb=+g('editHba1c'),t=+g('editTarget');
  if(age<10||age>110)return bad('editAge');if(h<100||h>250)return bad('editHeight');
  if(w<20||w>300)return bad('editWeight');if(hb<3||hb>20)return bad('editHba1c');if(t<70||t>250)return bad('editTarget');
  if(String(w)!==String(u.weight))u.weightLog.push({ts:Date.now(),val:w});
  if(String(hb)!==String(u.hba1c)){u.hba1cLog.push({ts:Date.now(),val:hb});u.tasks.monthly.updated=true;}
  u.name=g('editName');u.age=String(age);u.height=String(h);u.weight=String(w);u.hba1c=String(hb);u.target=t;
  closeEditModal();commit(u);toast('Profile saved · บันทึกแล้ว','','ok');
}
function openPolicy(){openModal('policyModal');}
function closePolicy(){closeModal('policyModal');}
function logout(){
  showConfirm({title:'Logout & clear data?',msg:'All your data on this device will be erased.<br>ข้อมูลทั้งหมดในเครื่องจะถูกลบ',okText:'Logout · ออก',danger:true},()=>{DataStore.clear();location.reload();});
}
function exportCSV(){
  const u=DataStore.get();if(!u)return;
  const rows=[['date','time','glucose_mg_dl','context','status']].concat(sortedBs(u).map(l=>[dKey(new Date(l.ts)),fmtTime(l.ts),l.val,(CTX[l.ctx]||CTX.random).en,bsStatus(l.val,u).en]));
  if(rows.length<2){toast('Nothing to export · ไม่มีข้อมูล','Log a reading first','warn');return;}
  const blob=new Blob(['\ufeff'+rows.map(r=>r.join(',')).join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='t2d-healthmate-'+dKey().replace(/-/g,'')+'.csv';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast('Exported '+(rows.length-1)+' readings','ส่งออกไฟล์ CSV แล้ว','ok');
}

/* ---------- Demo data & presenter panel ---------- */
function seedSampleData(){
  const u=DataStore.get();if(!u)return;
  let s=7;const rnd=()=>{s=(s*9301+49297)%233280;return s/233280;};
  const seed=[];
  for(let i=13;i>=0;i--){
    const base=150-(13-i)*1.7;
    [[7,30,'fasting',-22,16],[12,45,'before',-8,14],[14,10,'after',22,30],[21,30,'bed',6,26]].forEach(([hh,mm,ctx,off,spread],k)=>{
      if(k===1&&rnd()<.5)return;
      const d=daysAgo(i);d.setHours(hh,mm,0,0);if(d.getTime()>Date.now())return;
      seed.push({ts:d.getTime(),val:Math.round(base+off+rnd()*spread),ctx,seed:true});
    });
  }
  u.bloodSugarLog=u.bloodSugarLog.filter(l=>!l.seed).concat(seed);
  u.stats.bsLogs=Math.max(u.stats.bsLogs,seed.length);
  const hb=+u.hba1c||7.2;
  u.hba1cLog=[{ts:daysAgo(180).getTime(),val:+(hb+1.1).toFixed(1)},{ts:daysAgo(90).getTime(),val:+(hb+.5).toFixed(1)},{ts:Date.now(),val:hb}];
  const w=+u.weight||75;
  u.weightLog=[{ts:daysAgo(60).getTime(),val:w+3},{ts:daysAgo(30).getTime(),val:w+1.5},{ts:Date.now(),val:w}];
  for(let i=1;i<=6;i++){const t=u.medications.length;u.medHistory[dKey(daysAgo(i))]={t,n:Math.min(t,2+Math.round(rnd()))};}
  u.streak=Math.max(u.streak,5);u.bestStreak=Math.max(u.bestStreak,5);
  if(u.points<260)u.points=260;
  u.ptsLog=[{ts:Date.now()-36e5,pts:10,reason:'Log Blood Sugar'},{ts:Date.now()-72e5,pts:10,reason:'Log Medication'},{ts:Date.now()-864e5,pts:50,reason:'Log 5 Days'},{ts:Date.now()-9e7,pts:15,reason:'Badge: Coach Fan'}].concat(u.ptsLog).slice(0,40);
  u.stats.chatMsgs=Math.max(u.stats.chatMsgs,10);u.stats.scans=Math.max(u.stats.scans,1);
  evalBadges(u);fxQueue=[];
  DataStore.save(u);refreshCurrent();
  toast('Sample data loaded · โหลดข้อมูลตัวอย่าง','14 days of readings, meds & badges','ok');
}
function startDemoProfile(){
  const d=DataStore.getDefaultUser();
  Object.assign(d,{name:'สมชาย ใจดี',age:'58',weight:'78',height:'170',hba1c:'7.2',target:120});
  d.hba1cLog=[{ts:Date.now(),val:7.2}];d.weightLog=[{ts:Date.now(),val:78}];
  DataStore.save(normalize(d));
  const u=DataStore.get();DataStore.save(u);
  enterApp(false);seedSampleData();
}
function demoAction(a){
  let u=DataStore.get();
  if(a==='dark'){toggleDark();return;}
  if(a==='reset'){DataStore.clear();location.reload();return;}
  if(!u){startDemoProfile();if(a==='seed')return;u=DataStore.get();}
  if(a==='seed')seedSampleData();
  else if(a==='points'){award(u,50,'Demo bonus');commit(u);}
  else if(a==='high'){if(currentPage==='splash'||currentPage==='register')return;logBloodSugar(245,'after');}
}
