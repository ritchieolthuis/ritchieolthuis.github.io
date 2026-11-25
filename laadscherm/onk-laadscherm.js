/* Lettertype vooraf laden: het gekozen leeslettertype en de vaste lettertypen worden al bij het openen opgehaald, en de leestekst wacht (max 3 s) tot het gekozen lettertype er is. Zo verspringt de tekst niet meer. */
(function(){try{
  var h=document.documentElement,F={opendyslexic:"OpenDyslexic",lexend:"Lexend",atkinson:"Atkinson Hyperlegible",merriweather:"Merriweather",lora:"Lora",ptserif:"PT Serif",sourceserif:"Source Serif 4",literata:"Literata",inter:"Inter",dmsans:"DM Sans",nunito:"Nunito"};
  if(!document.fonts||!document.fonts.load)return;
  var u="";try{var r=localStorage.getItem("bible-auth-v1")||localStorage.getItem("sb-vodswfyhlwvhhkqewtap-auth-token"),a=r&&JSON.parse(r);u=a&&a.user&&a.user.id||""}catch(e){}
  var c=null;try{c=localStorage.getItem(u?"bible-font::"+u:"bible-font")}catch(e){}
  var fam=F[c],ld=function(n,w){try{return document.fonts.load(w+" 1em \""+n+"\"")}catch(e){return Promise.resolve()}};
  var all=[ld("Inter","400"),ld("Inter","500"),ld("Inter","600"),ld("Inter","700"),ld("DM Sans","400"),ld("DM Sans","500")];
  if(fam){var need=false;try{need=!document.fonts.check("16px \""+fam+"\"")}catch(e){}
    var mine=[ld(fam,"400"),ld(fam,"700")];all=all.concat(mine);
    if(need&&/\/(\d+|[a-z0-9-]+)\//.test(location.pathname+"/")){h.classList.add("onk-setwait");var rel=function(){h.classList.remove("onk-setwait")};setTimeout(rel,3000);Promise.all(mine).then(rel,rel)}}
}catch(e){}})();
/* Laadscherm voor de app (HTML, per periode of het witte scherm). Vervangt de oude witte splash (#onk-splash, blijft in de pagina als reserve maar wordt verborgen).
   ?laadscherm=<auto|advent|kerst|pasen|hemel|pink|wit> forceert een scherm; &houd=1 laat het staan (om te bekijken); ?laadscherm=uit zet het uit (oude splash zichtbaar).
   Geen periode actief = het witte scherm met wolkjes en olijftakjes. Muziek: Inner Light (Kevin MacLeod, incompetech.com, CC BY 4.0), loop, standaard 50%. */
(function(){
  var q=new URLSearchParams(location.search),v=q.get("laadscherm"); if(v==="uit") return;
  var script=document.currentScript,dir=(script&&script.src||"").replace(/[^\/]*$/,"");
  var F={advent:"1-Advent",kerst:"2-Kerst",pasen:"3-Pasen",hemel:"4-Hemelvaart",pink:"5-Pinksteren",wit:"0-Wit"};
  var forced=!!v,o=null,frame=null,t0=0,au=null,poll=null,closed=false,bootTimer=null,bootFallback=null;
  /* Oude splash meteen onzichtbaar (hij blijft wel draaien, zodat zijn eigen 'klaar'-signaal werkt). Zo zie je nooit eerst het oude scherm. */
  var st=document.createElement("style"); st.textContent="#onk-splash{visibility:hidden!important}"; (document.head||document.documentElement).appendChild(st);
  function iconSize(){var w=innerWidth,h=innerHeight;return Math.max(72,w>h?120*h/900:96*h/844)}
  function shell(){
    if(o) return; t0=Date.now();
    o=document.createElement("div"); o.id="onk-lds";
    o.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483600;background:#f4f6f7;opacity:1;transition:opacity .6s cubic-bezier(.4,0,.2,1)";
    (document.body||document.documentElement).appendChild(o);
    /* Muziek: loop, 50%, geluid pas na klik/toets/aanraking (browserregel). Zelfde instellingen als de keuzepagina. */
    au=new Audio(dir+"inner-light.mp3"); var on=true,vol=50; au.loop=true;
    try{if(localStorage.getItem("onkMuziek")==="uit")on=false;var sv=localStorage.getItem("onkVolume");if(sv!==null&&!isNaN(+sv))vol=Math.max(0,Math.min(100,+sv))}catch(e){}
    au.volume=vol/100;
    /* Safari/iOS can occasionally finish the document load while the large
       reader module is still missing (or has been evicted from memory). Do
       not leave the user with the empty mobile shell: offer one safe retry,
       then show a useful recovery action. */
    bootTimer=setTimeout(function(){
      if(closed)return;
      var r=document.getElementById("root");
      if(!r||r.children.length)return;
      var retried=false;
      try{retried=sessionStorage.getItem("onk-boot-retried")==="1"}catch(e){}
      if(!retried){
        try{sessionStorage.setItem("onk-boot-retried","1")}catch(e){}
        var u=new URL(location.href);u.searchParams.set("onk-retry",String(Date.now()));
        location.replace(u.href);return;
      }
      bootFallback=document.createElement("div");
      bootFallback.style.cssText="position:absolute;left:16px;right:16px;top:50%;transform:translateY(-50%);max-width:420px;margin:auto;padding:22px 18px;border:1px solid #d2d9dd;border-radius:16px;background:#fff;box-shadow:0 8px 30px rgba(29,43,51,.12);color:#1d2b33;text-align:center;font:500 15px/1.45 Inter,system-ui,-apple-system,sans-serif";
      bootFallback.innerHTML='<strong style="display:block;margin-bottom:8px;font-size:17px">De Bijbel kon niet laden</strong><span style="display:block;margin-bottom:16px;color:#3C5E70">De verbinding op deze telefoon liep vast. Probeer het nog een keer.</span><button type="button" style="height:42px;padding:0 20px;border:0;border-radius:999px;background:#3C5E70;color:#fff;font:600 14px Inter,system-ui,-apple-system,sans-serif">Opnieuw proberen</button>';
      bootFallback.querySelector("button").onclick=function(){try{sessionStorage.removeItem("onk-boot-retried")}catch(e){}location.reload()};
      o.appendChild(bootFallback);
    },8000);
    /* Browsers (vooral Safari/iPhone) staan geluid zonder aanraking niet toe. Daarom: eerst proberen met geluid; lukt dat niet, dan stil starten
       en bij de eerste aanraking/klik/toets het geluid aanzetten (50%). Er staat geen tekst; zonder toestemming van de browser blijft het stil tot de eerste aanraking. */
    function hideHint(){}
    function showHint(){}
    function unmute(){if(closed||!on) return; au.muted=false; var p=au.play(); if(p&&p.then)p.then(function(){if(closed){try{au.pause()}catch(e){}}else hideHint()}).catch(function(){}); else hideHint()}
    function go(){
      if(closed||!on) return;
      if(au.paused||au.muted){au.muted=false;var p=au.play();if(p&&p.then)p.then(function(){if(closed){try{au.pause()}catch(e){}}else hideHint()}).catch(function(){if(closed)return;au.muted=true;au.play().catch(function(){});showHint()})}
    }
    document.addEventListener("visibilitychange",function(){if(document.hidden&&au&&!closed)try{au.pause()}catch(e){}});
    ["pointerdown","touchend","click","keydown"].forEach(function(ev){addEventListener(ev,go,{passive:true})});
    var p0=au.play(); if(p0&&p0.then)p0.then(function(){if(closed){try{au.pause()}catch(e){}}},function(){}); if(p0&&p0.catch)p0.catch(function(){if(closed)return;au.muted=true;var p1=au.play();if(p1&&p1.catch)p1.catch(function(){});showHint()});
    if(!q.get("houd")){
      /* Sluit pas als de app klaar is (#root heeft inhoud) en het scherm minimaal 4 s stond. Duurt het laden langer (trage verbinding),
         dan blijven scherm en muziek gewoon doorlopen; pas na 30 s als noodrem sluit het toch. Sluiten gaat zacht (scherm en muziek fade). */
      poll=setInterval(function(){var r=document.getElementById("root"),ready=!r||r.children.length>0;if(ready&&Date.now()-t0>=3200)close()},200);
      setTimeout(close,30000);
    }
  }
  function setFrame(key){
    if(!o||frame) return; if(!F[key]) key="wit";
    o.style.background=(key==="wit")?"#1d2b33":"#f4f6f7"; frame=document.createElement("iframe"); frame.src=dir+F[key]+"-animatie.html?v=20261124n"; frame.title=key; frame.setAttribute("aria-hidden","true");
    frame.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;border:0;opacity:0;transition:opacity .35s ease";
    /* Het scherm staat eerst effen wit (zelfde kleur als het nieuwe scherm) en komt zacht in beeld zodra het klaar is: geen icoon-tussenstap, geen flits. */
    frame.onload=function(){frame.__ok=1;
      var d=frame.contentDocument&&frame.contentDocument.fonts?frame.contentDocument.fonts.ready:Promise.resolve();
      d.then(function(){requestAnimationFrame(function(){frame.style.opacity=1})});
    };
    o.appendChild(frame);
    /* Komt het seizoensbestand niet binnen (slechte of wegvallende verbinding), dan na 4 s het witte scherm. */
    var k=key,fr=frame; setTimeout(function(){if(!closed&&frame===fr&&k!=="wit"&&!fr.__ok){try{fr.remove()}catch(e){} frame=null; setFrame("wit")}},4000);
  }
  function close(){
    if(closed||!o) return; closed=true; clearInterval(poll);
    clearTimeout(bootTimer);
    if(bootFallback)bootFallback.remove();
    /* Scherm en muziek verdwijnen precies tegelijk, zacht, in 2 s. Op iPhone/iPad negeert Safari het aanpassen van volume (dan kan er niet gefaded worden):
       daar loopt het scherm zacht leeg en stopt de muziek aan het einde van die 2 s. Altijd hard stoppen op dat moment (pauze, bron leeg, opnieuw laden). */
    var T=2000,t1=Date.now(),v0=1; try{v0=au.volume||1}catch(e){}
    o.style.transition="opacity "+T+"ms ease-in-out"; o.style.opacity=0;
    function stopAudio(){try{au.muted=true;au.pause();au.removeAttribute("src");au.load()}catch(e){}}
    /* Kan het volume niet worden aangepast (iPhone/iPad), dan stopt de muziek meteen bij het begin van het sluiten, zodat hij nooit doorspeelt terwijl het scherm al leegloopt. */
    var canFade=true; try{au.volume=v0*.5; canFade=Math.abs(au.volume-v0*.5)<.05; au.volume=v0}catch(e){canFade=false}
    if(!canFade){stopAudio()}
    var d=setInterval(function(){var k=Math.min(1,(Date.now()-t1)/T);try{au.volume=Math.max(0,v0*(1-k))}catch(e){}if(k>=1){clearInterval(d);stopAudio()}},50);
    setTimeout(function(){clearInterval(d);stopAudio();o.remove()},T+50);
  }
  function pick(){
    shell();
    if(v&&v!=="auto"&&F[v]) return setFrame(v);
    /* Offline (gedownloade app): altijd het nieuwe witte scherm, nooit een seizoen. Een eenmalige download mag niet in het verkeerde seizoen blijven hangen. */
    if(navigator.onLine===false) return setFrame("wit");
    var s=document.createElement("script"); s.src=dir+"periode.js";
    s.onload=function(){var p=window.onkPeriode(new Date()); setFrame(p&&F[p.k]?p.k:"wit")};
    s.onerror=function(){setFrame("wit")};
    document.head.appendChild(s);
  }
  /* Alleen bij het openen van de app of de website (eerste pagina van de sessie: html heeft dan class onk-sp), of met ?laadscherm=.
     Verversen of naar een andere pagina gaan toont het laadscherm niet opnieuw. */
  /* Tonen bij het openen: nieuwe sessie, of de laatste keer was meer dan 30 min geleden (app opnieuw geopend). De homepage laadt zichzelf bij het openen
     één keer opnieuw; binnen 5 s daarna tonen we het scherm nog steeds. Verversen of een andere pagina binnen die tijd toont het niet. */
  var show=forced;
  if(!show){try{var K="onk-lds-first",f=+sessionStorage.getItem(K)||0,now=Date.now(),last=+localStorage.getItem("onk-lds-t")||0,fresh=(!f||now-last>1800000);
    show=fresh||(now-f<5000);
    if(fresh){sessionStorage.setItem(K,String(now));localStorage.setItem("onk-lds-t",String(now))}}catch(e){show=document.documentElement.classList.contains("onk-sp")}}
  if(show) pick();
})();
