/* Notities: mappen met notities (pagina's met titel, tekst en Bijbelverzen). Gedeeld door /notities/ en het versmenu in de lezer.
   Opslag: localStorage 'bible-notities-v1'; ingelogd ook in Supabase (bible_settings, key 'bible-notities'), samengevoegd per item (nieuwste wint). */
(function () {
  if (window.OnkN) return;
  /* ---------- taal: Nederlands (standaard) of Engels, volgt bible-locale ---------- */
  function isEn() { try { return (localStorage.getItem('bible-locale') || '').toLowerCase().indexOf('en') === 0; } catch (e) { return false; } }
  window.OnkEN = isEn;
  window.OnkUn = function () { return isEn() ? 'Untitled note' : OnkUn(); };
  var DICT = {
    'Notities': 'Notes', 'Alle notities': 'All notes', 'Map': 'Folder', 'Afgelopen 30 dagen': 'Previous 30 days', 'Afgelopen 7 dagen': 'Previous 7 days',
    'Vandaag': 'Today', 'Gisteren': 'Yesterday', 'Eerder': 'Earlier', 'Bewaar': 'Save', 'Bezig…': 'Working…',
    'De notities blijven bewaard': 'The notes are kept', 'De notities in deze map blijven bewaard bij Alle notities.': 'The notes in this folder stay available under All notes.',
    'Delen lukt niet, probeer later': 'Sharing failed, try again later', 'Deze notitie wordt verwijderd. Dit kan niet ongedaan worden gemaakt.': 'This note will be deleted. This cannot be undone.',
    'Geen map': 'No folder', 'Inloggen lukt niet. Controleer je gegevens.': 'Sign-in failed. Check your details.', 'Inloggen lukt niet. Probeer het later opnieuw.': 'Sign-in failed. Try again later.',
    'Link gekopieerd': 'Link copied', 'Log in om te delen': 'Sign in to share', 'Maak map': 'Create folder', 'Map verwijderen?': 'Delete folder?',
    'Minder tonen': 'Show less', 'Naam van de map': 'Folder name', 'Naam van map wijzigen': 'Rename folder', 'Niets gevonden': 'Nothing found', 'Niets gevonden.': 'Nothing found.',
    'Nieuwe map': 'New folder', 'Nieuwe notitie': 'New note', 'Nog geen notities': 'No notes yet', 'Probeer een ander woord.': 'Try another word.',
    'Verplaats naar map': 'Move to folder', 'Verwijder map': 'Delete folder', 'Verwijderen': 'Delete', 'Vul je e-mailadres en wachtwoord in.': 'Enter your email address and password.',
    'Wie de link heeft en is ingelogd, kan bewerken. Wie niet is ingelogd, kan alleen bekijken.': 'Anyone with the link who is signed in can edit. Anyone not signed in can only view.',
    'Wie de link heeft, kan alleen bekijken (preview). Niets kan worden bewerkt of gedeeld.': 'Anyone with the link can only view (preview). Nothing can be edited or shared.',
    'Aanmelden': 'Sign in', 'Account': 'Account', 'Deel notitie': 'Share note', 'E-mail': 'Email', 'Inloggen': 'Sign in', 'Registreren': 'Register', 'Kopieer link': 'Copy link',
    'Lege notitie': 'Empty note', 'Meld u aan om notities te bekijken': 'Sign in to view notes', 'Notities zijn alleen zichtbaar voor leden die zijn aangemeld.': 'Notes are only visible to signed-in members.',
    'Toon alles': 'Show all', 'Typ een boek en hoofdstuk (Nederlands of Engels), of een woord uit de tekst.': 'Type a book and chapter, or a word from the text.',
    'Vers toevoegen': 'Add verse', 'Wachtwoord': 'Password', 'Werk samen': 'Collaborate', 'Doorgaan met Google': 'Continue with Google', 'of': 'or',
    'Titel': 'Title', 'Zoek': 'Search', 'Terug': 'Back', 'Ongedaan maken': 'Undo', 'Opnieuw': 'Redo', 'Delen': 'Share', 'Meer': 'More', 'Sluiten': 'Close',
    'Vers omhoog': 'Move verse up', 'Vers omlaag': 'Move verse down', 'Vers verwijderen': 'Remove verse', 'Notitie': 'Note', 'Notitie verwijderen?': 'Delete note?', 'Verwijder notitie': 'Delete note',
    'Maak een notitie, geef hem een titel zoals De doop, en zet er tekst en Bijbelverzen in. Vanuit elk vers kun je kiezen: Toevoegen aan Notities.': 'Create a note, give it a title such as Baptism, and add text and Bible verses. From any verse you can choose: Add to Notes.',
    'Johannes 3:16, John 3 of een woord uit de tekst': 'John 3:16, 1 Cor 13 or a word from the text',
    'Toevoegen aan Notities': 'Add to Notes', 'Titel, bijvoorbeeld De doop': 'Title, for example Baptism', 'Maak notitie en voeg vers toe': 'Create note and add verse', 'Nieuwe notitie in deze map': 'New note in this folder',
    'Alleen lezen': 'Read only', 'Gedeelde notitie': 'Shared note', 'Je kunt bewerken. Wijzigingen worden automatisch opgeslagen.': 'You can edit. Changes are saved automatically.',
    'Log in om deze notitie te bewerken. Je kunt hem nu alleen bekijken.': 'Sign in to edit this note. You can only view it for now.', 'Niet gevonden': 'Not found',
    'Deze link werkt niet (meer).': 'This link does not work (any more).', 'Laden lukt niet. Probeer het later opnieuw.': 'Loading failed. Try again later.', 'Open deze pagina via de link die je kreeg.': 'Open this page through the link you received.',
    'Notities | De Samenkomst': 'Notes | De Samenkomst', 'Gedeelde notitie | De Samenkomst': 'Shared note | De Samenkomst'
  };
  var RX = [
    [/^(\d+) notitie$/, '$1 note'], [/^(\d+) notities$/, '$1 notes'], [/^Toegevoegd: (.*)$/, 'Added: $1'], [/^Toegevoegd aan "(.*)"$/, 'Added to "$1"'],
    [/^Verplaatst naar (.*)$/, 'Moved to $1'], [/^(.*) \(hele hoofdstuk\)$/, '$1 (whole chapter)'], [/^Of kies een vers uit (.*):$/, 'Or choose a verse from $1:'], [/^Kies een hoofdstuk in (.*):$/, 'Choose a chapter in $1:']
  ];
  function trText(s) {
    var t = String(s).trim(); if (!t) return s;
    var r = DICT[t];
    if (r === undefined) { for (var i = 0; i < RX.length; i++) { if (RX[i][0].test(t)) { r = t.replace(RX[i][0], RX[i][1]); break; } } }
    return r === undefined ? s : s.replace(t, r);
  }
  var SKIP = '#body,.pv,.nm,.kaart,.vb .t,.vb .r a,textarea,input,[contenteditable="true"]';
  function vertaal(root) {
    if (!isEn() || !root) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, lijst = [];
    while ((n = w.nextNode())) lijst.push(n);
    lijst.forEach(function (n) { var p = n.parentElement; if (!p || p.closest(SKIP)) return; var r = trText(n.nodeValue); if (r !== n.nodeValue) n.nodeValue = r; });
    [].forEach.call(root.querySelectorAll('[placeholder],[aria-label],[title]'), function (e) {
      ['placeholder', 'aria-label', 'title'].forEach(function (a) { var v = e.getAttribute(a); if (v) { var r = trText(v); if (r !== v) e.setAttribute(a, r); } });
    });
  }
  var vplan = false;
  function vertaalAlles() {
    if (vplan) return; vplan = true;
    requestAnimationFrame(function () {
      vplan = false; if (!isEn()) return;
      if (location.pathname.indexOf('/notities') === 0) { vertaal(document.body); var t = trText(document.title); if (t !== document.title) document.title = t; }
      else [].forEach.call(document.querySelectorAll('.onkn-bg,.onkn-toast'), vertaal);
    });
  }
  function startVertaling() { if (!document.body) return; vertaalAlles(); new MutationObserver(vertaalAlles).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title'] }); }
  if (document.body) startVertaling(); else document.addEventListener('DOMContentLoaded', startVertaling);
  var KEY = 'bible-notities-v1', SB = 'https://vodswfyhlwvhhkqewtap.supabase.co', PK = 'sb_publishable_TWZO4LBJZCVPuXG9pAknyA_7gxtFNfu', RK = 'bible-notities';
  var EN_ALIAS = { GEN: ['genesis', 'gen', 'ge'], EXO: ['exodus', 'exod', 'ex'], LEV: ['leviticus', 'lev'], NUM: ['numbers', 'num', 'nu'], DEU: ['deuteronomy', 'deut', 'dt'], JOS: ['joshua', 'josh'], JDG: ['judges', 'judg'], RUT: ['ruth'], '1SA': ['1 samuel', '1 sam', 'i samuel', 'first samuel'], '2SA': ['2 samuel', '2 sam', 'ii samuel', 'second samuel'], '1KI': ['1 kings', '1 kgs', 'i kings', 'first kings'], '2KI': ['2 kings', '2 kgs', 'ii kings', 'second kings'], '1CH': ['1 chronicles', '1 chron', 'i chronicles', 'first chronicles'], '2CH': ['2 chronicles', '2 chron', 'ii chronicles', 'second chronicles'], EZR: ['ezra'], NEH: ['nehemiah', 'neh'], EST: ['esther', 'est'], JOB: ['job'], PSA: ['psalms', 'psalm', 'ps', 'psa'], PRO: ['proverbs', 'prov', 'pr'], ECC: ['ecclesiastes', 'eccl', 'eccles'], SNG: ['song of solomon', 'song of songs', 'song', 'songs', 'sos'], ISA: ['isaiah', 'isa'], JER: ['jeremiah', 'jer'], LAM: ['lamentations', 'lam'], EZK: ['ezekiel', 'ezek'], DAN: ['daniel', 'dan'], HOS: ['hosea', 'hos'], JOL: ['joel'], AMO: ['amos'], OBA: ['obadiah', 'obad'], JON: ['jonah'], MIC: ['micah', 'mic'], NAM: ['nahum', 'nah'], HAB: ['habakkuk', 'hab'], ZEP: ['zephaniah', 'zeph'], HAG: ['haggai', 'hag'], ZEC: ['zechariah', 'zech'], MAL: ['malachi', 'mal'], MAT: ['matthew', 'matt', 'mt'], MRK: ['mark', 'mk'], LUK: ['luke', 'lk'], JHN: ['john', 'jn'], ACT: ['acts', 'act'], ROM: ['romans', 'rom'], '1CO': ['1 corinthians', '1 cor', 'i corinthians', 'first corinthians'], '2CO': ['2 corinthians', '2 cor', 'ii corinthians', 'second corinthians'], GAL: ['galatians', 'gal'], EPH: ['ephesians', 'eph'], PHP: ['philippians', 'phil'], COL: ['colossians', 'col'], '1TH': ['1 thessalonians', '1 thess', 'i thessalonians', 'first thessalonians'], '2TH': ['2 thessalonians', '2 thess', 'ii thessalonians', 'second thessalonians'], '1TI': ['1 timothy', '1 tim', 'i timothy', 'first timothy'], '2TI': ['2 timothy', '2 tim', 'ii timothy', 'second timothy'], TIT: ['titus'], PHM: ['philemon'], HEB: ['hebrews', 'heb'], JAS: ['james', 'jas'], '1PE': ['1 peter', '1 pet', 'i peter', 'first peter'], '2PE': ['2 peter', '2 pet', 'ii peter', 'second peter'], '1JN': ['1 john', '1 jn', 'i john', 'first john'], '2JN': ['2 john', '2 jn', 'ii john', 'second john'], '3JN': ['3 john', '3 jn', 'iii john', 'third john'], JUD: ['jude'], REV: ['revelation', 'revelations', 'rev', 'apocalypse'] };

  function norm(t) { return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.,;:!?()\[\]"'“”‘’\-–—]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function slug(n) { return norm(n).replace(/ /g, '-'); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---------- opslag ---------- */
  /* Elk account (Ritchie, De Samenkomst) heeft zijn eigen opslagsleutel: KEY + '::' + gebruikers-id. Uitgelogd blijft de losse sleutel. */
  var ST = null, STID = null, listeners = [], pushT = null, ORG = 'c5de1da8-aa8e-47ae-b51c-76d44651a9e7';
  function leeg() { return { v: 1, folders: [], notes: [], del: {} }; }
  function who() { var s = sessie(); return s ? s.user.id : ''; }
  function isOrg(s) { return !!s && (s.user.id === ORG || String(s.user.email || '').toLowerCase() === 'info@desamenkomst.nl'); }
  function skey() { var id = who(); return id ? KEY + '::' + id : KEY; }
  function lees() {
    try {
      var s = sessie(), k = skey(), raw = localStorage.getItem(k);
      /* oude losse sleutel (van voor de scheiding) gaat alleen naar een gewoon account, nooit naar De Samenkomst */
      if (raw === null && s && !isOrg(s)) { var old = localStorage.getItem(KEY); if (old) { raw = old; localStorage.setItem(k, old); localStorage.removeItem(KEY); } }
      var j = JSON.parse(raw || 'null'); if (j && j.notes) { j.folders = j.folders || []; j.del = j.del || {}; return j; }
    } catch (e) {} return leeg();
  }
  function state() { var id = who(); if (!ST || STID !== id) { ST = lees(); STID = id; } return ST; }
  function schrijf() { try { if (ST && STID === who()) localStorage.setItem(skey(), JSON.stringify(ST)); } catch (e) {} }
  function changed(skipPush) { schrijf(); listeners.forEach(function (f) { try { f(); } catch (e) {} }); if (!skipPush) { clearTimeout(pushT); pushT = setTimeout(push, 900); } }
  function sessie() { try { var raw = localStorage.getItem('bible-auth-v1') || localStorage.getItem('sb-vodswfyhlwvhhkqewtap-auth-token'); var s = raw ? JSON.parse(raw) : null; return s && s.access_token && s.user ? s : null; } catch (e) { return null; } }
  function hdr(tok) { return { apikey: PK, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }; }
  function merge(a, b) {
    var out = leeg(), del = {}, k;
    [a.del || {}, b.del || {}].forEach(function (d) { for (k in d) del[k] = Math.max(del[k] || 0, d[k]); });
    function mix(la, lb) {
      var m = {}; (la || []).concat(lb || []).forEach(function (x) { if (!m[x.id] || (x.t || 0) > (m[x.id].t || 0)) m[x.id] = x; });
      return Object.keys(m).map(function (i) { return m[i]; }).filter(function (x) { return !(del[x.id] && del[x.id] >= (x.t || 0)); });
    }
    out.folders = mix(a.folders, b.folders); out.notes = mix(a.notes, b.notes); out.del = del; return out;
  }
  function pull() {
    var s = sessie(); if (!s) return Promise.resolve(false);
    return fetch(SB + '/rest/v1/bible_settings?select=value&key=eq.' + RK + '&user_id=eq.' + s.user.id, { headers: hdr(s.access_token) })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var rem = rows && rows[0] && rows[0].value; if (typeof rem === 'string') { try { rem = JSON.parse(rem); } catch (e) { rem = null; } }
        /* Serverrij zonder eigenaar-stempel (van voor de scheiding) telt nooit voor De Samenkomst; een rij met een ander id telt voor niemand. */
        if (rem && rem.notes && ((rem.owner && rem.owner !== s.user.id) || (!rem.owner && isOrg(s)))) rem = null;
        if (rem && rem.notes) { var before = JSON.stringify(state()); ST = merge(state(), rem); if (JSON.stringify(ST) !== before) { changed(true); push(); } }
        else if (state().notes.length || state().folders.length) push();
        return true;
      }).catch(function () { return false; });
  }
  function push() {
    var s = sessie(); if (!s) return;
    state(); if (STID !== s.user.id) return; /* nooit de notities van het ene account onder het andere account uploaden */
    fetch(SB + '/rest/v1/bible_settings?on_conflict=user_id,key', { method: 'POST', headers: Object.assign({ Prefer: 'resolution=merge-duplicates,return=minimal' }, hdr(s.access_token)), body: JSON.stringify({ user_id: s.user.id, key: RK, value: Object.assign({}, state(), { owner: s.user.id }), updated_at: new Date().toISOString() }) }).catch(function () {});
  }

  /* ---------- mappen en notities ---------- */
  function addFolder(name) { var f = { id: 'f' + uid(), name: (name || '').trim() || (isEn() ? 'New folder' : 'Nieuwe map'), t: Date.now() }; state().folders.push(f); changed(); return f; }
  function renameFolder(id, name) { var f = state().folders.filter(function (x) { return x.id === id; })[0]; if (f && name.trim()) { f.name = name.trim(); f.t = Date.now(); changed(); } }
  function delFolder(id) { var s = state(), now = Date.now(); s.folders = s.folders.filter(function (x) { return x.id !== id; }); s.del[id] = now; s.notes.forEach(function (n) { if (n.folder === id) { n.folder = null; n.t = now; } }); changed(); }
  function addNote(title, folder) { var now = Date.now(), n = { id: 'n' + uid(), title: (title || '').trim(), folder: folder || null, blocks: [], c: now, t: now }; state().notes.push(n); changed(); return n; }
  function note(id) { return state().notes.filter(function (x) { return x.id === id; })[0]; }
  function touch(n) { n.t = Date.now(); changed(); }
  function delNote(id) { var s = state(); s.notes = s.notes.filter(function (x) { return x.id !== id; }); s.del[id] = Date.now(); changed(); }
  function addBlock(id, b) { var n = note(id); if (!n) return; n.blocks.push(b); touch(n); }

  /* ---------- Bijbeldata ---------- */
  var DATA = null, LOAD = null;
  function data() { if (DATA) return Promise.resolve(DATA); if (!LOAD) LOAD = Promise.all([fetch('/data/sv.json').then(function (r) { return r.json(); }), isEn() ? fetch('/data/kjv.json').then(function (r) { return r.json(); }) : Promise.resolve(null)]).then(function (r) { var d = r[0], k = r[1]; DATA = d; d.forEach(function (b, i) { b.slug = slug(b.name); if (k && k[i]) { b.enName = k[i].name; b.enChapters = k[i].chapters; } }); return d; }); return LOAD; }
  function bookNames(b) { var n = [norm(b.name)]; (EN_ALIAS[b.code] || []).forEach(function (x) { n.push(norm(x)); }); return n; }
  function bookByCode(c) { return (DATA || []).filter(function (b) { return b.code === c; })[0]; }
  function bname(b) { return isEn() && b.enName ? b.enName : b.name; }
  function label(ref) { var b = bookByCode(ref.code); var nm = b ? bname(b) : ref.code; return nm + ' ' + ref.ch + (ref.v1 ? ':' + ref.v1 + (ref.v2 && ref.v2 !== ref.v1 ? '-' + ref.v2 : '') : ''); }
  function verses(ref) {
    var b = bookByCode(ref.code), chs = b && (isEn() && b.enChapters ? b.enChapters : b.chapters); if (!b || !chs[ref.ch - 1]) return [];
    var v = chs[ref.ch - 1].v, a = ref.v1 || 1, z = ref.v1 ? (ref.v2 || ref.v1) : v.length, out = [];
    for (var i = a; i <= Math.min(z, v.length); i++) out.push({ n: i, t: v[i - 1] });
    return out;
  }
  function href(ref) { var b = bookByCode(ref.code); return b ? '/' + b.slug + '/' + ref.ch + '/' + (ref.v1 ? '?ref=' + ref.code + '.' + ref.ch + '.' + ref.v1 + '&v=' + (isEn() ? 'kjv' : 'sv') : '') : '/'; }
  // "john 3:16", "Johannes 3:16-18", "1 cor 13", "ps 23 1"
  function parse(q) {
    var n = norm(q).replace(/\b(vers|verse|vs|v|hoofdstuk|hfst|chapter|ch)\b/g, ' ').replace(/\s+/g, ' ').trim();
    var m = /^((?:[123]|i{1,3}) ?[a-z]+(?: [a-z]+)*|[a-z]+(?: [a-z]+)*) (\d+)(?: (\d+)(?: (\d+))?)?$/.exec(n); if (!m || !DATA) return null;
    var bk = null, pre = [];
    DATA.forEach(function (b) { bookNames(b).forEach(function (x) { if (x === m[1]) bk = b; else if (m[1].length >= 3 && x.indexOf(m[1]) === 0 && pre.indexOf(b) < 0) pre.push(b); }); });
    if (!bk && pre.length === 1) bk = pre[0]; if (!bk) return null;
    var ch = +m[2]; if (ch < 1 || ch > bk.chapters.length) return null;
    var max = bk.chapters[ch - 1].v.length, v1 = m[3] ? +m[3] : 0, v2 = m[4] ? +m[4] : 0;
    if (v1 > max) v1 = 0; if (v2 > max) v2 = max; if (v2 && v2 < v1) v2 = v1;
    return { code: bk.code, ch: ch, v1: v1 || 0, v2: v1 ? (v2 || v1) : 0 };
  }
  function booksFor(q) { var x = norm(q); if (!x || !DATA) return []; var out = []; DATA.forEach(function (b) { if (bookNames(b).some(function (n) { return n.indexOf(x) === 0; })) out.push(b); }); return out; }
  function search(q, max) {
    var w = norm(q).split(' ').filter(function (x) { return x.length > 1; }); if (!w.length || !DATA) return [];
    var out = [];
    for (var bi = 0; bi < DATA.length && out.length < max; bi++) { var b = DATA[bi]; for (var ci = 0; ci < b.chapters.length && out.length < max; ci++) { var v = b.chapters[ci].v; for (var vi = 0; vi < v.length; vi++) { var t = ' ' + norm(v[vi]) + ' '; var ok = true; for (var k = 0; k < w.length; k++) { if (t.indexOf(k === w.length - 1 ? ' ' + w[k] : ' ' + w[k] + ' ') < 0) { ok = false; break; } } if (ok) { out.push({ code: b.code, ch: ci + 1, v1: vi + 1, v2: vi + 1 }); if (out.length >= max) break; } } } }
    return out;
  }

  /* ---------- stijl en kleine UI-hulpen ---------- */
  var CSS = '.onkn-bg{position:fixed;inset:0;z-index:2147483100;background:rgba(10,18,24,.45);display:flex;align-items:flex-end;justify-content:center}' +
    '.onkn-sh{width:100%;max-width:460px;max-height:86vh;max-height:86dvh;overflow-y:auto;background:#fff;color:#1d2b33;border-radius:24px 24px 0 0;padding:18px 18px calc(22px + env(safe-area-inset-bottom,0px));font-family:Inter,system-ui,sans-serif;box-shadow:0 -10px 40px rgba(0,0,0,.2)}' +
    '@media(min-width:768px){.onkn-bg{align-items:center}.onkn-sh{border-radius:24px}}' +
    '.onkn-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.onkn-h b{font-size:18px;font-weight:700}' +
    '.onkn-x{width:36px;height:36px;border-radius:50%;border:0;background:#f0f2f4;color:#1d2b33;font-size:20px;cursor:pointer;line-height:1}' +
    '.onkn-ref{font-size:13px;color:#6b7a83;margin:0 0 12px}' +
    '.onkn-g{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6b7a83;margin:14px 2px 6px}' +
    '.onkn-r{display:flex;align-items:center;gap:12px;width:100%;padding:12px 10px;border:0;background:none;border-radius:12px;font:inherit;font-size:16px;color:#1d2b33;text-align:left;cursor:pointer}' +
    '.onkn-r:hover{background:#f1f4f6}.onkn-r svg{flex:none;width:22px;height:22px;color:#3c5e70}.onkn-r small{display:block;color:#6b7a83;font-size:13px}' +
    '.onkn-in{width:100%;height:46px;border-radius:12px;border:1px solid #d5dde1;padding:0 14px;font:inherit;font-size:16px;color:#1d2b33;background:#fff;outline:none;margin:6px 0}.onkn-in:focus{border-color:#3c5e70}' +
    '.onkn-b{height:46px;padding:0 20px;border-radius:999px;border:1px solid #cdd7dc;background:#eef2f4;color:#1d2b33;font:inherit;font-size:15px;font-weight:700;cursor:pointer;margin-top:6px}' +
    '.onkn-toast{position:fixed;left:50%;bottom:calc(92px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483200;display:flex;align-items:center;gap:10px;background:#fff;color:#1d2b33;border:1px solid #e3e8eb;padding:12px 18px 12px 14px;border-radius:16px;font:600 15px Inter,system-ui,sans-serif;box-shadow:0 8px 30px rgba(29,43,51,.16);width:max-content;max-width:calc(100vw - 32px)}.onkn-toast svg{flex:none;width:20px;height:20px;color:#3c5e70}';
  function css() { if (document.getElementById('onkn-css')) return; var s = document.createElement('style'); s.id = 'onkn-css'; s.textContent = CSS; document.head.appendChild(s); }
  var IC_NOTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V15l-4 5H6.5A1.5 1.5 0 0 1 5 18.5z"/><path d="M15 20v-4a1 1 0 0 1 1-1h3"/><path d="M8.5 8h7M8.5 11.5h7"/></svg>';
  var IC_FOLDER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
  var IC_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';
  function toast(t) { css(); var d = document.createElement('div'); d.className = 'onkn-toast'; d.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span></span>'; d.lastChild.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2600); }

  /* Keuzescherm "Toevoegen aan Notities" (vanuit het versmenu) */
  function pick(ref) {
    css();
    data().then(function () {
      var s = state(), bg = document.createElement('div'); bg.className = 'onkn-bg';
      function sluit() { bg.remove(); }
      function klaar(n) { addBlock(n.id, { t: 'verse', id: 'b' + uid(), code: ref.code, ch: ref.ch, v1: ref.v1 || 0, v2: ref.v2 || 0 }); sluit(); toast('Toegevoegd aan "' + (n.title || OnkUn()) + '"'); }
      function teken() {
        var h = '<div class="onkn-sh" role="dialog" aria-label="Toevoegen aan Notities"><div class="onkn-h"><b>Toevoegen aan Notities</b><button class="onkn-x" type="button" data-x aria-label="Sluiten">×</button></div><p class="onkn-ref">' + esc(label(ref)) + '</p>';
        h += '<button class="onkn-r" type="button" data-nieuw>' + IC_PLUS + '<span>Nieuwe notitie</span></button>';
        var loos = s.notes.filter(function (n) { return !n.folder; }).sort(function (a, b) { return b.t - a.t; });
        if (loos.length) { h += '<div class="onkn-g">Notities</div>'; loos.forEach(function (n) { h += '<button class="onkn-r" type="button" data-n="' + n.id + '">' + IC_NOTE + '<span>' + esc(n.title || OnkUn()) + '</span></button>'; }); }
        s.folders.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (f) {
          var ns = s.notes.filter(function (n) { return n.folder === f.id; }).sort(function (a, b) { return b.t - a.t; });
          h += '<div class="onkn-g">' + esc(f.name) + '</div>';
          ns.forEach(function (n) { h += '<button class="onkn-r" type="button" data-n="' + n.id + '">' + IC_NOTE + '<span>' + esc(n.title || OnkUn()) + '</span></button>'; });
          h += '<button class="onkn-r" type="button" data-nieuw="' + f.id + '">' + IC_PLUS + '<span>Nieuwe notitie in deze map</span></button>';
        });
        bg.innerHTML = h + '</div>';
      }
      teken(); document.body.appendChild(bg);
      bg.addEventListener('click', function (e) {
        if (e.target === bg || e.target.closest('[data-x]')) { sluit(); return; }
        var r = e.target.closest('[data-n]'); if (r) { klaar(note(r.getAttribute('data-n'))); return; }
        var nw = e.target.closest('[data-nieuw]'); if (nw) {
          var fid = nw.getAttribute('data-nieuw') || null, sh = bg.querySelector('.onkn-sh');
          sh.innerHTML = '<div class="onkn-h"><b>Nieuwe notitie</b><button class="onkn-x" type="button" data-x aria-label="Sluiten">×</button></div><p class="onkn-ref">' + esc(label(ref)) + '</p><input class="onkn-in" id="onkn-t" placeholder="Titel, bijvoorbeeld De doop" autocomplete="off"><button class="onkn-b" type="button" data-maak>Maak notitie en voeg vers toe</button>';
          var inp = sh.querySelector('#onkn-t'); inp.focus();
          var maak = function () { klaar(addNote(inp.value, fid)); };
          sh.querySelector('[data-maak]').onclick = maak; inp.onkeydown = function (ev) { if (ev.key === 'Enter') maak(); };
        }
      });
    });
  }

  window.OnkN = { bname: bname, state: state, onChange: function (f) { listeners.push(f); }, pull: pull, push: push, addFolder: addFolder, renameFolder: renameFolder, delFolder: delFolder, addNote: addNote, note: note, touch: touch, delNote: delNote, addBlock: addBlock, data: data, parse: parse, booksFor: booksFor, search: search, verses: verses, label: label, href: href, bookByCode: bookByCode, pick: pick, esc: esc, uid: uid, toast: toast, css: css, ICONS: { note: IC_NOTE, folder: IC_FOLDER, plus: IC_PLUS } };
  window.addEventListener('storage', function (e) { if (e.key === KEY) { ST = lees(); listeners.forEach(function (f) { try { f(); } catch (x) {} }); } });
})();
