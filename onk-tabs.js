/* Onderbalk (Home, Bijbel, Leesplan, Community, Meer) en het Meer-menu voor losse pagina's die niet de hele app laden (bijvoorbeeld /zoeken/).
   Zelfde opbouw en zelfde klassen als OnkTabs in bible.js; de opmaak komt uit onk-tabs.css, dat uit bible.css wordt gemaakt
   (scripts/onk-tabs-css/build-onk-tabs-css.py). Alleen op telefoonbreedte (tot 767 px). Wijzig je OnkTabs in bible.js, pas dit bestand dan ook aan. */
(function () {
  if (window.__onkTabs) return; window.__onkTabs = 1;
  var mq = window.matchMedia('(max-width:767px)'), nav = null, bg = null, sheet = null, view = 'main', open = false;
  function en() { try { return localStorage.getItem('bible-locale') === 'en'; } catch (e) { return false; } }
  function J(nl, e) { return en() ? e : nl; }
  function signedIn() { try { var r = localStorage.getItem('bible-auth-v1') || localStorage.getItem('sb-vodswfyhlwvhhkqewtap-auth-token'); var s = r ? JSON.parse(r) : null; return !!(s && s.access_token && s.user); } catch (e) { return false; } }
  function ic(paths, cls) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('class', cls || 'h-6 w-6'); s.setAttribute('aria-hidden', 'true');
    paths.forEach(function (d) { var p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); s.appendChild(p); });
    return s;
  }
  function el(tag, cls, attrs) { var e = document.createElement(tag); if (cls) e.className = cls; for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); return e; }
  function go(u) { return function () { location.href = u; }; }
  function bibleUrl() {
    try { var r = JSON.parse(localStorage.getItem('bible-recents') || '[]')[0]; if (r && r.s && r.c) return '/' + r.s + '/' + r.c + '/' + (r.v && r.v !== 'sv' ? '?v=' + r.v : ''); } catch (e) {}
    return '/genesis/1/';
  }
  function tab(label, paths, fn, on) {
    var b = el('button', 'onk-tab' + (on ? ' is-on' : ''), { type: 'button' }); if (on) b.setAttribute('aria-current', 'page');
    var i = el('span', 'onk-tab-ic'); i.appendChild(ic(paths)); b.appendChild(i);
    var t = el('span'); t.textContent = label; b.appendChild(t); b.onclick = fn; return b;
  }
  function row(label, paths, fn) {
    var b = el('button', 'onk-more-row', { type: 'button' }); var i = el('span', 'onk-more-ic'); i.appendChild(ic(paths, 'h-5 w-5')); b.appendChild(i);
    var t = el('span', 'onk-more-t'); t.textContent = label; b.appendChild(t); b.appendChild(ic(['M9 6l6 6-6 6'], 'h-4 w-4')); b.onclick = fn; return b;
  }
  function ext(label, href, paths) {
    var a = el('a', 'onk-more-row', { href: href, target: '_blank', rel: 'noopener noreferrer' }); var i = el('span', 'onk-more-ic'); i.appendChild(ic(paths, 'h-5 w-5')); a.appendChild(i);
    var t = el('span', 'onk-more-t'); t.textContent = label; a.appendChild(t); a.appendChild(ic(['M7 17L17 7', 'M8 7h9v9'], 'h-4 w-4')); a.onclick = function () { close(); }; return a;
  }
  function close() { open = false; view = 'main'; renderSheet(); markMore(); }
  function markMore() { if (!nav) return; var m = nav.lastChild; if (m) { m.className = 'onk-tab' + (open ? ' is-on' : ''); if (open) m.setAttribute('aria-current', 'page'); else m.removeAttribute('aria-current'); } }
  function renderSheet() {
    if (bg) { bg.remove(); bg = null; } if (sheet) { sheet.remove(); sheet = null; }
    if (!open) return;
    bg = el('div', 'onk-more-bg'); bg.onclick = close; document.body.appendChild(bg);
    sheet = el('div', 'onk-more', { role: 'dialog', 'aria-label': J('Meer', 'More') });
    var h = el('div', 'onk-more-h');
    if (view === 'ext') { var back = el('button', 'onk-more-x', { type: 'button', 'aria-label': J('Terug', 'Back') }); back.appendChild(ic(['M15 6l-6 6 6 6'], 'h-4 w-4')); back.onclick = function () { view = 'main'; renderSheet(); }; h.appendChild(back); }
    var ti = el('span'); ti.textContent = view === 'ext' ? J('Extern', 'External') : J('Meer', 'More'); h.appendChild(ti);
    var x = el('button', 'onk-more-x', { type: 'button', 'aria-label': J('Sluiten', 'Close') }); x.appendChild(ic(['M6 6l12 12', 'M18 6L6 18'], 'h-4 w-4')); x.onclick = close; h.appendChild(x);
    sheet.appendChild(h);
    if (view === 'ext') {
      sheet.appendChild(ext('Forum', 'https://desamenkomst.nl/forum/', ['M7 3h7l5 5v13H7z', 'M14 3v5h5', 'M9.5 13h6M9.5 17h6']));
      sheet.appendChild(ext(J('Doneren', 'Donate'), 'https://donorbox.org/de-bijbel-online', ['M12 21s-7-4.35-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.65-9.5 9-9.5 9z']));
      sheet.appendChild(ext('Telegram', 'https://t.me/theassembling', ['M21 4L3 11l6 2.5M21 4l-7 17-5-7.5M21 4L9 13.5']));
      sheet.appendChild(ext(J('3D-Bijbel', '3D Bible'), 'https://de3dbijbel.nl/', ['M12 6.5c-1.4-1.1-3.3-1.7-5.5-1.7-1 0-1.7.1-2.5.3v13c.8-.2 1.5-.3 2.5-.3 2.2 0 4.1.6 5.5 1.7', 'M12 6.5c1.4-1.1 3.3-1.7 5.5-1.7 1 0 1.7.1 2.5.3v13c-.8-.2-1.5-.3-2.5-.3-2.2 0-4.1.6-5.5 1.7V6.5z', 'M12 9v2M11 10h2']));
      sheet.appendChild(ext(J('Kerk vinden', 'Find a church'), 'https://www.kerkvinden.nl/', ['M5 10.5L12 4.5l7 6V20H5z', 'M12 11.5v5M9.5 14h5']));
      sheet.appendChild(ext('De Samenkijkers', 'https://desamenkijkers.nl/', ['M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z', 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z']));
    } else {
      if (signedIn()) sheet.appendChild(row(J('Profiel', 'Profile'), ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21c0-4 3.6-7 8-7s8 3 8 7'], go('/profiel/')));
      else sheet.appendChild(row(J('Notities', 'Notes'), ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'], go('/notities/')));
      sheet.appendChild(row(J('Onderwerpen', 'Topics'), ['M4 6h16', 'M4 12h16', 'M4 18h10'], go('/onderwerpen/')));
      sheet.appendChild(row(J('Evangelie', 'Gospel'), ['M12 3v18', 'M5 9h14'], go(en() ? '/gospel/' : '/evangelie/')));
      sheet.appendChild(row(J('Extern', 'External'), ['M14 3h7v7', 'M10 14L21 3', 'M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5'], function () { view = 'ext'; renderSheet(); }));
      if (!signedIn()) sheet.appendChild(row(J('Inloggen', 'Log in'), ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21c0-4 3.6-7 8-7s8 3 8 7'], go('/accountinstellingen/')));
    }
    document.body.appendChild(sheet);
  }
  function build() {
    nav = el('nav', 'onk-tabbar', { 'aria-label': J('Hoofdmenu', 'Main menu') });
    nav.appendChild(tab(J('Home', 'Home'), ['M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z'], go('/')));
    nav.appendChild(tab(J('Bijbel', 'Bible'), ['M3.5 5.5C6 4.5 9 4.5 12 6c3-1.5 6-1.5 8.5-.5v13c-2.5-1-5.5-1-8.5.5-3-1.5-6-1.5-8.5-.5z', 'M12 6v13.5'], function () { location.href = bibleUrl(); }));
    nav.appendChild(tab(J('Leesplannen', 'Plans'), ['M7.5 3.5h9A2.5 2.5 0 0 1 19 6v12a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18V6a2.5 2.5 0 0 1 2.5-2.5z', 'M9 9h6M9 13h6M9 17h3'], go('/leesplan/')));
    nav.appendChild(tab(en() ? 'Community' : 'Gemeenschap', ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'], go(en() ? '/community/' : '/gemeenschap/')));
    nav.appendChild(tab(J('Meer', 'More'), ['M4 7h16', 'M4 12h16', 'M4 17h16'], function () { open = !open; view = 'main'; renderSheet(); markMore(); }));
    document.body.appendChild(nav);
    document.documentElement.classList.add('onk-has-tabbar');
  }
  function apply() {
    if (mq.matches && !nav) build();
    else if (!mq.matches && nav) { close(); nav.remove(); nav = null; document.documentElement.classList.remove('onk-has-tabbar'); }
  }
  var st = document.createElement('style'); st.textContent = 'html.onk-has-tabbar body{padding-bottom:calc(64px + env(safe-area-inset-bottom,0px))}'; document.head.appendChild(st);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) close(); });
  if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply);
  if (document.body) apply(); else document.addEventListener('DOMContentLoaded', apply);
})();
