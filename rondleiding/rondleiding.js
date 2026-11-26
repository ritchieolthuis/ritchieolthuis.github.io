/* Rondleiding voor nieuwe gebruikers (STAGING, nog niet live).
   Loopt over de echte pagina's van De Bijbel Online: Home, lezen, leesplannen, gemeenschap, profiel.
   Stijl: site-tokens (Inter, DM Sans, #3C5E70) en de vier kleuren van het logo (geel, blauw, groen, donkerblauw).
   Toestand: localStorage "onk-tour" = {s: stap of -1, d: 1 klaar / 2 later}. Terug naar begin: ?rondleiding=1 of window.OnkTour.start(). */
(function(){
if(window.__onkTour)return;window.__onkTour=1;
var Y='#f5b800',B='#2aa7e0',G='#7db928',D='#3C5E70',COL=[Y,B,G,D],TINT=['#fff3cf','#dff1fb','#e9f5d6','#dfe8ed'],DEEP=['#a97800','#1d7fae','#5a8a14','#2c4757'];
var KEY='onk-tour';
try{if(/[?&]norond=1/.test(location.search))sessionStorage.setItem('onk-norond','1')}catch(e){}
function en(){try{if(window.__onkLocale)return window.__onkLocale==='en'}catch(e){}var p=location.pathname,q=location.search;if(/3dbible|[?&](lang|locale)=en/.test(p+q))return true;if(/3dbijbel|[?&](lang|locale)=nl/.test(p+q))return false;try{return localStorage.getItem('bible-locale')==='en'}catch(e){return false}}
function L(a){return en()?a[1]:a[0]}
function get(){try{return JSON.parse(localStorage.getItem(KEY)||'null')||{}}catch(e){return {}}}
function put(o){try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){}}

/* ---------- zoekhulpen (ook in open shadow DOM van de gemeenschap) ---------- */
function roots(){var r=[document];document.querySelectorAll('*').forEach(function(e){if(e.shadowRoot)r.push(e.shadowRoot)});return r}
function q1(sel){var rs=roots();for(var i=0;i<rs.length;i++){var e=rs[i].querySelector(sel);if(e)return e}return null}
function vis(e){if(!e)return false;var r=e.getBoundingClientRect();return r.width>2&&r.height>2}
function byText(sel,re){var rs=roots();for(var i=0;i<rs.length;i++){var l=rs[i].querySelectorAll(sel);for(var j=0;j<l.length;j++){if(re.test((l[j].textContent||'').trim())&&vis(l[j]))return l[j]}}return null}
function heading(re){var h=byText('h1,h2,h3',re);return h}
function card(e){   /* kleinste omringende kaart (afgeronde hoek + eigen achtergrond) */
  var p=e;while(p&&p!==document.body){var cs=getComputedStyle(p),rd=parseFloat(cs.borderTopLeftRadius)||0,bg=cs.backgroundColor,b=p.getBoundingClientRect();
    if(rd>=12&&bg&&bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent'&&b.width>240&&b.height>80)return p;p=p.parentElement}
  return e.parentElement||e}
function section(re){var h=heading(re);if(!h)return null;var best=h,p=h.parentElement,vh=innerHeight;
  while(p&&p!==document.body){var others=p.querySelectorAll('h1,h2');if(others.length>1||p.getBoundingClientRect().height>vh*1.6)break;best=p;p=p.parentElement}
  return best}
function aria(re){var rs=roots();for(var i=0;i<rs.length;i++){var l=rs[i].querySelectorAll('[aria-label],[title]');for(var j=0;j<l.length;j++){var a=(l[j].getAttribute('aria-label')||l[j].getAttribute('title')||'');if(re.test(a)&&vis(l[j]))return l[j]}}return null}
function firstVis(list){for(var i=0;i<list.length;i++){var e=typeof list[i]==='function'?list[i]():q1(list[i]);if(e&&vis(e))return e}return null}

/* ---------- de echte menu's openen en sluiten (zo laat de rondleiding alles ook echt zien) ---------- */
function fire(e,type,x,y,Ctor){try{e.dispatchEvent(new (Ctor||MouseEvent)(type,{bubbles:true,cancelable:true,view:window,clientX:x,clientY:y,button:0,buttons:type.indexOf('up')>=0||type==='click'?0:1,pointerType:'mouse',pointerId:1,isPrimary:true}))}catch(x){}}
var lastTap=0;
function sheetOpen(){var rs=roots();for(var i=0;i<rs.length;i++){var l=rs[i].querySelectorAll('button');for(var j=0;j<l.length;j++){if(/^(Kopiëren|Copy)$/i.test((l[j].textContent||'').trim()))return true}}return false}
function openVerseSheet(n){   /* n = poging: 0 gewone tik, 1 met tekstselectie, 2 tik op het versnummer */
  if(sheetOpen()||Date.now()-lastTap<4000)return;   /* nooit tikken terwijl het menu al open is (een tweede tik sluit het) */
  var sp=q1('sup[data-v="16"]'),v=sp&&sp.parentElement;if(!v)return;
  var r=v.getBoundingClientRect(),x=r.left+Math.min(40,r.width/2),y=r.top+Math.min(30,r.height/2),tgt=v;
  function seq(e,list){list.forEach(function(t){fire(e,t,x,y,t.indexOf('pointer')===0&&window.PointerEvent?PointerEvent:MouseEvent)})}
  n=n||0;
  if(n===1){try{var rg=document.createRange();rg.selectNodeContents(v);var sel=getSelection();sel.removeAllRanges();sel.addRange(rg)}catch(e){}seq(v,['pointerdown','mousedown','pointerup','mouseup','click'])}
  else if(n>=2){tgt=sp;seq(tgt,['pointerdown','mousedown','pointerup','mouseup','click'])}
  else{seq(v,['pointerover','pointerdown','mousedown','pointerup','mouseup','click'])}
}
function closeSheet(){
  if(!byText('button',/^(Kopiëren|Copy)$/i))return;
  try{['keydown','keyup'].forEach(function(t){document.dispatchEvent(new KeyboardEvent(t,{key:'Escape',code:'Escape',keyCode:27,bubbles:true}))})}catch(e){}
}
function gearBtn(){return aria(/^(Leesinstellingen|Reading settings)/i)}
function popupOf(re){   /* kleinste zwevende kader dat deze tekst bevat */
  var best=null,rs=roots();
  rs.forEach(function(r){r.querySelectorAll('div,section,aside').forEach(function(e){
    if(e.closest('#otr')||!re.test(e.textContent||'')||!vis(e))return;var b=e.getBoundingClientRect();
    if(b.width<180||b.height<120||b.width>innerWidth+2)return;
    var cs=getComputedStyle(e);if(cs.position!=='fixed'&&cs.position!=='absolute'&&cs.position!=='sticky')return;
    if(!best||b.width*b.height<best.getBoundingClientRect().width*best.getBoundingClientRect().height)best=e;
  })});
  return best;
}
var SET_RE=/(Tekstgrootte|Lettergrootte|Lettertype|Text size|Font size)/i;
function openSettings(){if(!popupOf(SET_RE)){var g=gearBtn();g&&g.click()}}
function closeSettings(){if(popupOf(SET_RE)){var g=gearBtn();g&&g.click()}}
function openMeer(){var b=q1('.onk-meer');if(b&&!document.querySelector('.onk-mm.open'))b.click()}
function closeMeer(){var b=q1('.onk-meer');if(b&&document.querySelector('.onk-mm.open'))b.click()}

function samBtn(){   /* de + Vriend-knop van De Samenkomst (alleen als jullie nog geen vrienden zijn) */
  var out=null;roots().forEach(function(r){if(out)return;r.querySelectorAll('[data-follow]').forEach(function(b){
    if(out||!vis(b))return;var row=rowOf(b);if(/De Samenkomst/i.test((row.textContent||'').slice(0,80))&&/\+/.test(b.textContent))out=b})});
  return out}
function rowOf(b){var p=b;while(p.parentElement&&p.parentElement.getBoundingClientRect().height<140&&p.parentElement.querySelectorAll('[data-follow]').length===1)p=p.parentElement;return p}
/* ---------- pagina-herkenning ---------- */
var P={
 home:{url:'/',is:function(){return document.documentElement.classList.contains('onk-home')||!!heading(/^(Lees de Bijbel online|Read the Bible online)/i)}},
 read:{url:function(){return en()?'/john/3/?ref=JHN.3.16':'/johannes/3/?ref=JHN.3.16&v=sv'},is:function(){return !!document.querySelector('.onk-read-top')}},
 plans:{url:'/leesplan/',is:function(){return !!heading(/^(Leesplannen|Reading plans)$/i)},
  /* de leesplannen openen alleen vanuit de app zelf (een directe link valt terug op Home): klik op het echte tabblad */
  nav:function(){var t=byText('nav.onk-tabbar .onk-tab,nav.onk-tabbar button,.onk-side button,aside button,nav button,a',/^(Leesplannen|Reading plans|Plans)$/i);if(!t)return false;t.click();return true}},
 comm:{url:function(){return en()?'/community/#members':'/gemeenschap/#leden'},is:function(){return /^\/(gemeenschap|community)\//.test(location.pathname)}},
 profile:{url:function(){return en()?'/profile/':'/profiel/'},is:function(){return /^\/(profiel|profile)\//.test(location.pathname)}}
};
function onPage(k){try{return P[k].is()}catch(e){return false}}
function pageUrl(k){var u=P[k].url;return typeof u==='function'?u():u}

/* ---------- stappen ---------- */
var S=[
 {id:'welcome',page:'home',big:1,ic:'hand',
  t:[['Welkom bij De Bijbel Online','Welcome to The Bible Online'],['Samen kijken we in twee minuten waar je de Bijbel leest, hoe je teksten bewaart en waar je anderen vindt. Je kunt altijd stoppen.','In two minutes we will look at where you read the Bible, how you save verses and where you find others. You can stop at any time.']]},
 {id:'search',page:'home',ic:'search',target:[function(){var i=q1('input[type=search],input.rounded-full');return i&&(i.closest('form')||i.parentElement)}],
  t:[['Zoek alles op één plek','Search everything in one place'],['Typ een vers, een woord of een onderwerp. De zoekbalk begrijpt "in den beginne" net zo goed als "Johannes 3:16" en zoekt in alle vertalingen.','Type a verse, a word or a topic. The search bar understands "in the beginning" as well as "John 3:16" and looks in every translation.']]},
 {id:'votd',page:'home',ic:'sun',target:[function(){return section(/^(Vers van de dag|Verse of the day)/i)}],
  t:[['Elke dag een nieuw vers','A new verse every day'],['Het vers van de dag staat bovenaan. Tik erop om het hele hoofdstuk te lezen.','The verse of the day is at the top. Tap it to read the whole chapter.']]},
 {id:'books',page:'home',ic:'book',target:[function(){var h=byText('h2,h3,div,span',/^(Oude Testament|Old Testament)$/i);return h?card(h):section(/^(Kies een bijbelboek|Choose a (Bible )?book)/i)}],
  t:[['Kies zelf een bijbelboek','Pick a book yourself'],['Oude en Nieuwe Testament staan naast elkaar. Tik op een boek en daarna op een hoofdstuk.','Old and New Testament sit side by side. Tap a book, then a chapter.']]},
 {id:'tabs',page:'home',ic:'grid',target:['nav.onk-tabbar','.onk-sidebar','nav[class*=side],aside'],
  t:[['Zo kom je overal','This is how you get around'],['Home, Bijbel, Leesplannen, Gemeenschap en Meer. Onder Meer vind je je profiel, onderwerpen, artikelen en het evangelie.','Home, Bible, Plans, Community and More. Under More you find your profile, topics, articles and the gospel.']]},
 {id:'picker',page:'read',ic:'pin',target:[function(){var h=q1('.relative.z-10.flex-none.flex-nowrap');if(!h)return null;var best=null;h.querySelectorAll('button,div,a').forEach(function(e){var t=(e.textContent||'').trim(),b=e.getBoundingClientRect();if(t.length>3&&t.length<40&&/\d+(:\d+)?$/.test(t)&&b.width>90&&b.height>20&&b.height<80&&(!best||b.width*b.height<best.b.width*best.b.height))best={e:e,b:b}});return best?best.e:h}],
  t:[['Hier lees je de Bijbel','This is where you read'],['Bovenin staat waar je bent. Tik op de balk om een ander boek, hoofdstuk of vers te kiezen.','The bar at the top shows where you are. Tap it to choose another book, chapter or verse.']]},
 {id:'verse',page:'read',ic:'tap',tap:1,target:[function(){var s=q1('sup[data-v="16"]');return s&&s.parentElement}],
  t:[['Tik op een vers','Tap a verse'],['Elk vers heeft een eigen menu. Probeer het: tik op vers 16.','Every verse has its own menu. Try it: tap verse 16.']]},
 {id:'sheet',page:'read',ic:'pen',noNav:1,open:openVerseSheet,close:closeSheet,target:[function(){var b=byText('button',/^(Kopiëren|Copy)$/i);return b&&(b.closest('[class*="rounded-t"]')||b.parentElement.parentElement)}],
  t:[['Wat je met een vers kunt doen','What you can do with a verse'],['Markeer in een kleur, kopieer, sla op als favoriet, schrijf een aantekening of maak er een afbeelding van om te delen.','Highlight in a colour, copy, save as a favorite, write a note or turn it into an image to share.']]},
 {id:'settings',page:'read',ic:'gear',open:openSettings,close:closeSettings,multi:1,target:[function(){return popupOf(SET_RE)},gearBtn],
  t:[['Maak het prettig om te lezen','Make it comfortable to read'],['Met het tandwiel stel je lettergrootte, lettertype, regelafstand en weergave in. Probeer iets, het past meteen toe.','The gear sets text size, font, line spacing and layout. Try something, it applies at once.']]},
 {id:'meer',page:'read',ic:'grid',open:openMeer,close:closeMeer,multi:1,target:['.onk-mm.open','.onk-meer'],
  t:[['Meer opties bij het lezen','More reading options'],['Onder de drie puntjes wissel je van vertaling (SV, HSV, NBG 1951, KJV), lees je twee vertalingen naast elkaar en open je de tijdlijn.','Under the three dots you switch translation (SV, HSV, NBG 1951, KJV), read two translations side by side and open the timeline.']]},
 {id:'nav',page:'read',ic:'next',target:['.onk-nav'],
  t:[['Verder lezen','Keep reading'],['Onderaan ga je naar het vorige of volgende hoofdstuk. Op de telefoon verbergt de ronde knop alles behalve de tekst, voor rustig lezen.','At the bottom you go to the previous or next chapter. On a phone the round button hides everything except the text, for quiet reading.']]},
 {id:'plans',page:'plans',auth:1,ic:'list',target:[function(){var b=byText('button,a',/^(Start|Starten)$/i);return b&&(b.closest('li,article,[class*=rounded-2xl],[class*=rounded-xl]')||b.parentElement)},function(){return heading(/^(Leesplannen|Reading plans)$/i)}],
  t:[['Lees met een plan','Read with a plan'],['Een leesplan geeft je elke dag een stukje. De cirkel vult zich vers voor vers terwijl je leest en je krijgt een badge als je klaar bent.','A reading plan gives you a little each day. The circle fills verse by verse as you read, and you earn a badge when you finish.']]},
 {id:'community',page:'comm',auth:1,ic:'users',target:['.tabs3','.yt','.chips2'],
  t:[['Lees samen','Read together'],['In de Gemeenschap staan berichten, kanalen en leden. Deel een vers dat je raakte of volg wat anderen lezen.','The Community has posts, channels and members. Share a verse that touched you or follow what others read.']]},
 {id:'follow',page:'comm',auth:1,ic:'users',tap:1,optional:1,target:[function(){var b=samBtn();return b?rowOf(b):null}],tapEl:function(){return samBtn()},
  t:[['Maak vrienden, begin bij De Samenkomst','Make friends, start with De Samenkomst'],['Met + Vriend stuur je een vriendverzoek. Dit is echt: probeer het bij De Samenkomst. Als wij terugvolgen zijn we vrienden en zie je wat wij delen.','With + Friend you send a friend request. This is real: try it with De Samenkomst. If we follow back we are friends and you see what we share.']]},
 {id:'more',page:'profile',auth:1,ic:'user',target:['.onk-pf2-head',function(){return heading(/./)}],
  t:[['Jouw eigen plek','Your own place'],['In je profiel staan je reeks van dagen, je voortgang en badges, je bewaarde verzen, markeringen en notities.','Your profile holds your streak of days, your progress and badges, your saved verses, highlights and notes.']]},
 {id:'done',page:'profile',big:1,last:1,ic:'check',
  t:[['Je bent klaar','You are all set'],['Begin met lezen, kies een leesplan of kijk bij de gemeenschap. Je kunt deze rondleiding opnieuw starten via Profiel.','Start reading, pick a reading plan or look around the community. You can restart this tour from your profile.']]}
];
var N=S.length;
function signed(){try{return !!localStorage.getItem('bible-auth-v1')}catch(e){return false}}
function active(s){return !(s.auth&&!signed())}
function seq(){return S.filter(function(s){return active(s)&&!s.big})}   /* de genummerde stappen */

/* ---------- pictogrammen (lijn, 24x24) ---------- */
var IC={
 hand:'<path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11m0-4.5v-1a1.5 1.5 0 0 1 3 0V11m0-3a1.5 1.5 0 0 1 3 0v6.5A5.5 5.5 0 0 1 11.5 20H11a5 5 0 0 1-4-2l-2.3-3.3a1.4 1.4 0 0 1 2.2-1.7L8 14"/>',
 search:'<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
 book:'<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13"/>',
 grid:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
 pin:'<path d="M12 21s6.5-5.6 6.5-11A6.5 6.5 0 0 0 5.5 10C5.5 15.400 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/>',
 tap:'<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11l5 1.2a2 2 0 0 1 1.500 2.100L17.800 19a2 2 0 0 1-2 1.600H11a2 2 0 0 1-1.600-.8L6 14.500"/>',
 pen:'<path d="M4 20l1-4L16.500 4.500a2 2 0 0 1 3 3L8 19z"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M12 3.500v2.200M12 18.300v2.200M3.500 12h2.200M18.300 12h2.200M6 6l1.600 1.600M16.400 16.400 18 18M18 6l-1.600 1.600M7.600 16.400 6 18"/>',
 next:'<path d="M5 12h14M13 6l6 6-6 6"/>',
 list:'<rect x="5" y="3.500" width="14" height="17" rx="2.500"/><path d="M9 8.500h6M9 12h6M9 15.500h4"/>',
 users:'<circle cx="9" cy="8.500" r="3.200"/><path d="M3.500 19c.5-3.200 2.700-5 5.500-5s5 1.800 5.500 5M15.500 5.600a3.200 3.200 0 0 1 0 5.800M17 14.400c2 .6 3.200 2.100 3.500 4.600"/>',
 user:'<circle cx="12" cy="8.500" r="3.500"/><path d="M5 20c.7-3.700 3.400-5.500 7-5.500s6.300 1.800 7 5.500"/>',
 check:'<path d="M5 12.500l4.500 4.500L19 7.500"/>',
 close:'<path d="M6 6l12 12M18 6 6 18"/>'
};
function svg(n,sz,c){return '<svg viewBox="0 0 24 24" width="'+(sz||22)+'" height="'+(sz||22)+'" fill="none" stroke="'+(c||'currentColor')+'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+IC[n]+'</svg>'}

/* ---------- CSS (alleen .otr-) ---------- */
var CSS='\
#otr{position:fixed;inset:0;z-index:2147483647;isolation:isolate;font-family:Inter,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;pointer-events:none}\
#otr *{box-sizing:border-box}\
#otr .d{position:fixed;background:transparent;pointer-events:auto}\
#otr .dimfull{position:fixed;inset:0;background:rgba(29,43,51,.62);pointer-events:auto}\
#otr .ring{position:fixed;pointer-events:none;border-radius:var(--rad,18px);outline:3px solid #7db928;outline-offset:0;box-shadow:0 0 0 3px #fff,0 0 0 9999px rgba(29,43,51,.62);transition:top .28s,left .28s,width .28s,height .28s,border-radius .28s}\
#otr .hole{position:fixed;pointer-events:auto;background:transparent}\
#otr .card{position:fixed;left:50%;transform:translateX(-50%);width:min(400px,calc(100vw - 24px));background:#fff;border-radius:20px;box-shadow:0 12px 40px rgba(0,0,0,.28);pointer-events:auto;overflow:hidden;transition:top .28s,bottom .28s,opacity .2s}\
#otr .seg{display:flex;gap:3px;padding:16px 56px 0 16px}\
#otr .seg i{flex:1;height:5px;border-radius:3px;background:#eaeef0;overflow:hidden;position:relative}\
#otr .seg i.on:after{content:"";position:absolute;inset:0;background:var(--c);border-radius:3px}\
#otr .bd{padding:14px 18px 16px}\
#otr .top{display:flex;align-items:center;gap:12px;margin-bottom:8px}\
#otr .tile{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;flex:none;background:var(--t);color:var(--dp)}\
#otr .cnt{font:600 11.5px Inter,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#7d8c95}\
#otr h4{margin:0;font:700 19px/1.25 "DM Sans",Inter,system-ui,sans-serif;color:#1d2b33;text-wrap:balance}\
#otr p{margin:6px 0 14px;font:400 14.5px/1.55 Inter,system-ui,sans-serif;color:#3C5E70}\
#otr .row{display:flex;align-items:center;gap:8px}\
#otr .x{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:50%;border:0;background:#eaeef0;color:#3C5E70;cursor:pointer;display:grid;place-items:center;z-index:2}\
#otr .x:hover{background:#dfe5e8}\
#otr .skip{margin-right:auto;padding:10px 4px;color:#7d8c95;font:500 13.5px Inter,system-ui,sans-serif;background:none;border:0;cursor:pointer}\
#otr .skip:hover{color:#1d2b33}\
#otr .b{border:0;border-radius:12px;padding:10px 18px;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;background:#3C5E70;color:#fff;transition:background .15s}\
#otr .b:hover{background:#2c4757}\
#otr .b.s{background:#fff;color:#1d2b33;box-shadow:inset 0 0 0 1px rgba(29,43,51,.15)}\
#otr .b.s:hover{background:#eaeef0}\
#otr .b:focus-visible,#otr .skip:focus-visible{outline:2px solid #2aa7e0;outline-offset:2px}\
#otr .big{text-align:center;padding:10px 4px 2px}\
#otr .lgband{background:#3C5E70;padding:24px 18px;display:flex;justify-content:center;align-items:center}\
#otr .lgband img{height:34px;width:auto;max-width:78%;display:block}\
#otr .big h4{font-size:22px}\
#otr .cta{display:flex;flex-direction:column;gap:8px;margin-top:4px}\
#otr .cta .b{width:100%}\
@media (prefers-reduced-motion:reduce){#otr *{transition:none!important}}';

/* ---------- toestand ---------- */
var el=null,cur=-1,timer=0,tapOff=null,closing=false;
function ensureEl(){
  if(el)return el;
  var st=document.createElement('style');st.id='otr-css';st.textContent=CSS;document.head.appendChild(st);
  el=document.createElement('div');el.id='otr';el.setAttribute('role','dialog');el.setAttribute('aria-live','polite');document.body.appendChild(el);
  return el;
}
function targetOf(s){
  if(!s.target)return null;
  if(s.multi){var out=[];s.target.forEach(function(t){var e=typeof t==='function'?t():q1(t);if(e&&vis(e))out.push(e)});return out.length?out:null}
  return firstVis(s.target);
}
function rectOf(t){
  if(!t)return null;
  var a=Array.isArray(t)?t:[t],x1=1e9,y1=1e9,x2=-1e9,y2=-1e9;
  a.forEach(function(e){var r=e.getBoundingClientRect();x1=Math.min(x1,r.left);y1=Math.min(y1,r.top);x2=Math.max(x2,r.right);y2=Math.max(y2,r.bottom)});
  var pad=6,vw=innerWidth,vh=innerHeight;
  x1=Math.max(4,x1-pad);y1=Math.max(4,y1-pad);x2=Math.min(vw-4,x2+pad);y2=Math.min(vh-4,y2+pad);
  return {x:x1,y:y1,w:Math.max(20,x2-x1),h:Math.max(20,y2-y1)};
}
function logoSrc(){var i=document.querySelector('img.bible-logo-img');return i&&i.getAttribute('src')?i.getAttribute('src'):'/img/brand/bijbel-online-logo.webp'}

function radiusOf(t){
  var e=Array.isArray(t)?t[0]:t,r=18;
  try{var v=parseFloat(getComputedStyle(e).borderTopLeftRadius);if(v>0)r=v+6}catch(x){}
  return r;
}
/* De kaart wordt per stap één keer opgebouwd (zo blijven de knoppen stabiel en werken klikken altijd);
   daarna verschuiven alleen de posities. */
function build(){
  var s=S[cur],c=COL[cur%4];
  el.style.setProperty('--c',c);
  el.innerHTML='<div class="dimfull" data-dim></div><div class="d" data-p="0"></div><div class="d" data-p="1"></div><div class="d" data-p="2"></div><div class="d" data-p="3"></div><div class="ring" data-ring></div><div class="hole" data-hole></div>'+cardHtml(s,c);
  el.__built=cur;if(el.parentNode&&el.nextSibling)document.body.appendChild(el);bind();
  var b=el.querySelector('[data-n],[data-e]');b&&b.focus&&b.focus({preventScroll:true});
}
function draw(){
  if(cur<0||!el)return;
  if(el.__built!==cur)build();
  var s=S[cur],t=targetOf(s),r=rectOf(t),vw=innerWidth,vh=innerHeight;
  var dim=el.querySelector('[data-dim]'),ring=el.querySelector('[data-ring]'),hole=el.querySelector('[data-hole]'),ps=el.querySelectorAll('[data-p]');
  function pos(n,x,y,w,h){n.style.left=x+'px';n.style.top=y+'px';n.style.width=Math.max(0,w)+'px';n.style.height=Math.max(0,h)+'px'}
  if(!r){
    dim.style.display='block';ring.style.display='none';hole.style.display='none';ps.forEach(function(n){n.style.display='none'});
  }else{
    dim.style.display='none';ring.style.display='block';ps.forEach(function(n){n.style.display='block'});
    pos(ps[0],0,0,vw,r.y);pos(ps[1],0,r.y,r.x,r.h);pos(ps[2],r.x+r.w,r.y,vw-r.x-r.w,r.h);pos(ps[3],0,r.y+r.h,vw,vh-r.y-r.h);
    pos(ring,r.x,r.y,r.w,r.h);
    var rad=Math.min(radiusOf(t),Math.min(r.w,r.h)/2);ring.style.setProperty('--rad',rad+'px');
    hole.style.display=s.tap?'none':'block';if(!s.tap)pos(hole,r.x,r.y,r.w,r.h);
  }
  var card=el.querySelector('.card');
  if(card){
    var ch=card.offsetHeight,top;
    if(!r){top=Math.max(16,(vh-ch)/2)}
    else{var mid=r.y+r.h/2;top=mid>vh*0.5?Math.max(12,r.y-ch-14):Math.min(vh-ch-12,r.y+r.h+14);top=Math.max(12,Math.min(vh-ch-12,top))}
    card.style.top=top+'px';
  }
}
function cardHtml(s,c){
  var i=cur,tt=L(s.t[0]),tx=L(s.t[1]),idx=COL.indexOf(c);
  var st='--c:'+G+';--t:'+TINT[2]+';--dp:'+DEEP[2];
  if(s.last){
    return '<div class="card" style="'+st+'"><div class="lgband"><img src="'+logoSrc()+'" alt="De Bijbel Online"></div><div class="bd"><div class="big"><h4>'+tt+'</h4><p>'+tx+'</p></div>'+
      '<div class="cta"><button class="b" data-e="read">'+(en()?'Start reading':'Begin met lezen')+'</button><button class="b s" data-e="plans">'+(en()?'Pick a reading plan':'Kies een leesplan')+'</button><button class="b s" data-e="x">'+(en()?'Close':'Sluiten')+'</button></div></div></div>';
  }
  if(s.big){
    return '<div class="card" style="'+st+'"><div class="lgband"><img src="'+logoSrc()+'" alt="De Bijbel Online"></div><div class="bd"><div class="big"><h4>'+tt+'</h4><p>'+tx+'</p></div>'+
      '<div class="cta"><button class="b" data-n>'+(en()?'Start the tour':'Start rondleiding')+'</button><button class="b s" data-later>'+(en()?'Maybe later':'Misschien later')+'</button></div></div></div>';
  }
  var sq=seq(),pos=sq.indexOf(s)+1,MAINN=sq.length,segs='';for(var k=1;k<=MAINN;k++){segs+='<i class="'+(k<=pos?'on':'')+'" style="--c:'+(k<pos?G:Y)+'"></i>'}
  return '<div class="card" style="'+st+'"><button class="x" data-later aria-label="'+(en()?'Stop the tour':'Stop de rondleiding')+'" title="'+(en()?'Stop the tour':'Stop de rondleiding')+'">'+svg('close',16)+'</button><div class="seg">'+segs+'</div><div class="bd">'+
    '<div class="top"><span class="tile">'+svg(s.ic,22)+'</span><div><div class="cnt">'+pos+' '+(en()?'of':'van')+' '+MAINN+'</div><h4>'+tt+'</h4></div></div>'+
    '<p>'+tx+'</p>'+
    '<div class="row"><button class="skip" data-skipstep>'+(en()?'Skip':'Overslaan')+'</button><button class="b s" data-b>'+(en()?'Back':'Terug')+'</button><button class="b" data-n>'+(en()?'Continue':'Ga door')+'</button></div></div></div>';
}
function bind(){
  var n=el.querySelector('[data-n]'),b=el.querySelector('[data-b]'),lt=el.querySelectorAll('[data-later]'),e=el.querySelectorAll('[data-e]');
  n&&n.addEventListener('click',function(){next()});
  b&&b.addEventListener('click',function(){back()});
  lt.forEach(function(x){x.addEventListener('click',function(){later()})});
  el.querySelectorAll('[data-skipstep]').forEach(function(x){x.addEventListener('click',function(){next()})});
  e.forEach(function(x){x.addEventListener('click',function(){finish(x.getAttribute('data-e'))})});
}

/* ---------- vloeiend: opnieuw tekenen terwijl de stap actief is ---------- */
function loop(){clearInterval(timer);timer=setInterval(function(){if(cur>=0)draw()},220)}
function onResize(){if(cur>=0)draw()}

/* ---------- navigatie tussen stappen ---------- */
function scrollTo(t){
  var e=Array.isArray(t)?t[0]:t;if(!e)return;
  var r=e.getBoundingClientRect(),vh=innerHeight;
  if(e.closest&&(e.closest('header')||e.closest('.relative.z-10.flex-none')||getComputedStyle(e).position==='fixed'))return;
  if(r.height>vh*0.6){e.style.scrollMarginTop=Math.min(270,Math.round(vh*0.3)+30)+'px';try{e.scrollIntoView({block:'start',behavior:'auto'})}catch(x){}}
  else if(r.top<84||r.bottom>vh-150){e.style.scrollMarginTop='';try{e.scrollIntoView({block:'center',behavior:'auto'})}catch(x){}}
}
function goTo(i,dir){
  LOG.push('goTo '+i+' from '+cur+' @'+Date.now()%100000);
  dir=dir||1;
  while(i>=0&&i<N&&!active(S[i]))i+=dir;
  if(i<0)i=0;
  if(i>=N){finish('x');return}
  var s=S[i],prev=S[cur];
  if(prev&&prev.close)prev.close();
  cur=-1;put({s:i,d:0,t:Date.now()});
  if(tapOff){tapOff();tapOff=null}
  if(!onPage(s.page)){ /* andere pagina: volledig laden, de rondleiding hervat daar */
    if(P[s.page].nav){   /* binnen de app wisselen (geen herlaad) */
      var nk0=null;try{nk0=JSON.parse(sessionStorage.getItem('onk-tour-click')||'null')}catch(e){}
      if(!(nk0&&nk0.i===i&&Date.now()-nk0.t<30000)){try{sessionStorage.setItem('onk-tour-click',JSON.stringify({i:i,t:Date.now()}))}catch(e){}
        if(P[s.page].nav()){show(i);return}}
    }
    var nk=null;try{nk=JSON.parse(sessionStorage.getItem('onk-tour-nav')||'null')}catch(e){}
    if(nk&&nk.i===i&&Date.now()-nk.t<30000){show(i);return}   /* al geprobeerd: nooit blijven herladen, toon de stap zonder doelwit */
    try{sessionStorage.setItem('onk-tour-nav',JSON.stringify({i:i,t:Date.now()}))}catch(e){}
    if(el)el.innerHTML='';
    location.assign(pageUrl(s.page));return;
  }
  show(i);
}
var LOG=[];window.__tourLog=LOG;var lastShow={i:-1,t:0};
function show(i){
  LOG.push('show '+i+' @'+Date.now()%100000);
  if(lastShow.i===i&&Date.now()-lastShow.t<1200&&el&&el.__built===i){LOG.push('  dup ignored');return}   /* nooit dezelfde stap twee keer vlak na elkaar */
  lastShow={i:i,t:Date.now()};
  ensureEl();cur=i;var s=S[i];
  if(s.open)setTimeout(function(){if(cur===i)s.open(0)},700);
  waitTarget(s,function(t){
    if(cur!==i)return;
    if(t)scrollTo(t);
    else if(s.optional&&!s.big){ /* geen doelwit (bv. geen leden): sla de stap over */ if(i<N-1){goTo(i+1);return}}
    el.__built=-1;draw();loop();
    if(s.tap&&t)armTap(s,t);
  });
}
function waitTarget(s,cb){
  if(!s.target){cb(null);return}
  var tries=0,max=s.open?28:30;
  (function poll(){var t=targetOf(s);if(t||tries++>=max){cb(t);return}if(s.open&&tries%6===5)s.open(Math.floor(tries/6)+1);setTimeout(poll,250)})();
}
function armTap(s,t){
  var node=Array.isArray(t)?t[0]:t;
  function fn(e){
    var te=s.tapEl&&s.tapEl();if(te)node=te;
    if(!node.contains(e.target))return;
    cleanup();lastTap=Date.now();setTimeout(function(){if(cur>=0&&S[cur]===s)next()},s.id==='verse'?700:450);
  }
  function cleanup(){document.removeEventListener('click',fn,true);tapOff=null}
  document.addEventListener('click',fn,true);tapOff=cleanup;
}
function next(){goTo(cur+1,1)}
function back(){
  var i=cur-1;
  /* de menustap heeft een open menu nodig: ga dan terug naar de vers-stap */
  goTo(Math.max(0,i),-1)
}
function later(){var o=get();put({s:-1,d:2,t:Date.now()});stop()}
function finish(to){
  put({s:-1,d:1,t:Date.now()});stop();
  if(to==='read'){location.assign(pageUrl('read').split('?')[0])}
  else if(to==='plans'){location.assign(pageUrl('plans'))}
}
function stop(){
  var cs=S[cur];if(cs&&cs.close)cs.close();
  cur=-1;clearInterval(timer);if(tapOff){tapOff();tapOff=null}
  if(el){el.remove();el=null}
}
function start(){put({s:0,d:0,t:Date.now()});if(!onPage(S[0].page)){location.assign(pageUrl('home'));return}show(0)}

/* ---------- wie krijgt de rondleiding automatisch? ---------- */
var LAUNCH=Date.parse('2026-11-26T00:00:00+01:00');   /* alleen accounts die vanaf de lancering (26 nov 2026) zijn aangemaakt, plus alle toekomstige; de site-beheerder (is_admin) krijgt hem één keer om te testen */
function session(){try{var o=JSON.parse(localStorage.getItem('bible-auth-v1')||localStorage.getItem('sb-vodswfyhlwvhhkqewtap-auth-token')||'null');return o&&(o.user?o:(o.currentSession||null))}catch(e){return null}}
function eligible(cb){
  var ss=session(),u=ss&&ss.user;
  if(!u){cb(false);return}                      /* niet ingelogd: geen automatische rondleiding */
  var c=Date.parse(u.created_at||'');
  if(c&&c>=LAUNCH){cb(true);return}   /* account gemaakt vanaf de lancering: nieuw lid */
  var tries=0;                                  /* anders: alleen de testgebruiker */
  (function ask(){
    var sb=window.__onkSb;
    if(!sb||!sb.from){if(tries++<20){setTimeout(ask,500)}else cb(false);return}
    try{sb.from('bible_profiles').select('is_admin').eq('user_id',u.id).maybeSingle().then(function(r){cb(!!(r&&r.data&&r.data.is_admin===true))},function(){cb(false)})}catch(e){cb(false)}
  })();
}

/* ---------- opstarten ---------- */
function appReady(){
  var root=document.getElementById('root');
  if(!root||!root.children.length)return false;
  if(document.getElementById('onk-lds')||document.getElementById('onk-splash')&&getComputedStyle(document.getElementById('onk-splash')).display!=='none')return false;
  return true;
}
function boot(){
  try{if(sessionStorage.getItem('onk-norond')==='1')return}catch(e){}
  var o=get(),force=/[?&]rondleiding=1/.test(location.search);
  if(force){put({s:0,d:0,t:Date.now()});o={s:0}}
  var tries=0;
  (function wait(){
    if(!appReady()&&tries++<60){setTimeout(wait,500);return}
    setTimeout(function(){
      if(o.s>=0&&o.s!=null&&!o.d&&('s' in o)){ /* lopende rondleiding: hervat */
        var s=S[o.s];if(!s){return}
        if(!active(s))goTo(o.s,1);else if(onPage(s.page))show(o.s);else goTo(o.s,1);
        return;
      }
      /* eerste keer: alleen voor NIEUWE leden (account net gemaakt) en voor de beheerder om te testen; op de startpagina;
         nooit als de rondleiding al gedaan of uitgesteld is. Bestaande leden zien hem alleen via ?rondleiding=1 of Profiel. */
      if(!('d' in o)&&!('s' in o)&&onPage('home')&&!/[?&]norond/.test(location.search)){
        eligible(function(ok){if(ok&&!('d' in get())&&!('s' in get())&&onPage('home')){put({s:0,d:0,t:Date.now()});show(0)}});
      }
    },900);
  })();
}
window.addEventListener('resize',onResize);
window.addEventListener('scroll',function(){if(cur>=0)draw()},true);
document.addEventListener('keydown',function(e){
  if(cur<0)return;
  if(e.key==='Escape'&&S[cur].id!=='sheet'){later()}
  else if(e.key==='ArrowRight'){next()}
  else if(e.key==='ArrowLeft'){back()}
});
window.OnkTour={start:start,stop:stop,state:get,view:function(i){show(i)},measure:function(){var c=el&&el.querySelector('.card'),g=el&&el.querySelector('[data-ring]');var a=c&&c.getBoundingClientRect(),b=g&&getComputedStyle(g).display!=='none'&&g.getBoundingClientRect();var inside=a&&a.left>=0&&a.top>=0&&a.right<=innerWidth&&a.bottom<=innerHeight;var ov=a&&b&&!(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom);return {step:cur,vp:[innerWidth,innerHeight],card:a&&[Math.round(a.left),Math.round(a.top),Math.round(a.width),Math.round(a.height)],ring:b&&[Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)],cardInside:!!inside,overlap:!!ov}},probe:function(i){var t=targetOf(S[i]);if(t)scrollTo(t);t=targetOf(S[i]);var r=rectOf(t);var e=Array.isArray(t)?t[0]:t;return {id:S[i].id,found:!!t,el:e?e.tagName+'.'+String(e.className).slice(0,40):null,rect:r&&[Math.round(r.x),Math.round(r.y),Math.round(r.w),Math.round(r.h)],vp:[innerWidth,innerHeight]}}};
if(document.readyState==='complete')boot();else window.addEventListener('load',boot);
})();
