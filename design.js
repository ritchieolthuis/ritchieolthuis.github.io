/* De Bijbel Online — Ontwerp-studio
 *
 * Maak van één of meer bijbelverzen een eigen afbeelding: achtergrond (kleur,
 * verloop, foto of eigen foto), lettertype, kleuren, formaat. Bewaar het
 * ontwerp (op dit apparaat en, ingelogd, in je account) en deel het.
 *
 * Los van de gebundelde bible.js; bible.js roept alleen window.__onkDesign aan:
 *   add(item[, openStudio])  item = {code,bookName,chapter,verseStart,verseEnd,version,label,text}
 *   open()                   studio openen met de verzamelde verzen
 *   count()                  aantal verzamelde verzen
 *   mountGallery(el)         "Mijn ontwerpen" in een container tonen (Bewaard-pagina)
 */
(function () {
  'use strict';
  if (window.__onkDesign) return;

  /* ───────── helpers ───────── */
  var LS_BASKET = 'onk-design-basket';
  var LS_STYLE = 'onk-design-style';
  var LS_DESIGNS = 'onk-designs';
  var LS_RESUME = 'onk-design-resume';
  var ROOT = window.__onkRoot || (function () {
    try { return new URL('./', document.baseURI).href; } catch (e) { return './'; }
  })();

  var LOGO_IMG = null;
  (function () { try { var l = new Image(); l.onload = function () { LOGO_IMG = l; }; l.src = ROOT + 'img/brand/bijbel-online-logo.webp'; } catch (e) {} })();

  /* De taal komt van de app zelf (window.__onkLocale, gezet door bible.js);
     alleen als die er nog niet is, valt dit terug op dezelfde detectie als de app. */
  function isEn() {
    var l = window.__onkLocale;
    if (l === 'en' || l === 'nl') return l === 'en';
    try {
      var p = location.pathname.toLowerCase(), q = location.search.toLowerCase();
      if (p.indexOf('3dbible') > -1 || q.indexOf('lang=en') > -1 || q.indexOf('locale=en') > -1) return true;
      if (p.indexOf('3dbijbel') > -1 || q.indexOf('lang=nl') > -1 || q.indexOf('locale=nl') > -1) return false;
      var v = localStorage.getItem('bible-locale');
      if (v === 'en' || v === 'nl') return v === 'en';
    } catch (e) {}
    return false;
  }
  function t(nl, en) { return isEn() ? en : nl; }
  function lsGet(k, fb) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  function uid() {
    try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) for (var k in props) {
      var v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'icon') continue;
      else if (k === 'style') n.style.cssText = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    if (props && props.icon) n.insertBefore(icon(props.icon, props.iconSize), n.firstChild);
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  var ICONS = {
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    download: '<path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/>',
    share: '<path d="M8.6 13.5l6.8 3.9M15.4 6.6L8.6 10.5"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="5.5" r="2.6"/><circle cx="18" cy="18.5" r="2.6"/>',
    up: '<path d="M12 19V5m0 0l-6 6m6-6l6 6"/>',
    down: '<path d="M12 5v14m0 0l-6-6m6 6l6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    design: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="M21 15l-5-5L5 21"/>'
  };
  function icon(n, size) {
    var w = document.createElement('span');
    w.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;flex:none';
    w.innerHTML = '<svg viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + '</svg>';
    return w;
  }
  function debounce(fn, ms) {
    var h; return function () { var a = arguments, s = this; clearTimeout(h); h = setTimeout(function () { fn.apply(s, a); }, ms); };
  }

  /* ───────── vaste keuzes ───────── */
  var FORMATS = {
    sq: { w: 1080, h: 1080, nl: 'Vierkant', en: 'Square' },
    pt: { w: 1080, h: 1350, nl: 'Post 4:5', en: 'Post 4:5' },
    st: { w: 1080, h: 1920, nl: 'Story', en: 'Story' },
    ls: { w: 1920, h: 1080, nl: 'Liggend', en: 'Landscape' }
  };
  var FONTS = {
    playfair: { label: 'Playfair', css: '"Playfair Display", Georgia, serif', g: 'Playfair+Display:ital,wght@0,400;0,700;1,400;1,700' },
    lora: { label: 'Lora', css: 'Lora, Georgia, serif', g: 'Lora:ital,wght@0,400;0,700;1,400;1,700' },
    cormorant: { label: 'Cormorant', css: '"Cormorant Garamond", Georgia, serif', g: 'Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700' },
    cinzel: { label: 'Cinzel', css: 'Cinzel, "Times New Roman", serif', g: 'Cinzel:wght@400;700' },
    georgia: { label: 'Georgia', css: 'Georgia, "Times New Roman", serif' },
    montserrat: { label: 'Montserrat', css: 'Montserrat, "Helvetica Neue", Arial, sans-serif', g: 'Montserrat:ital,wght@0,400;0,700;1,400;1,700' },
    system: { label: 'Modern', css: '-apple-system, "Segoe UI", Helvetica, Arial, sans-serif' },
    caveat: { label: 'Caveat', css: 'Caveat, "Segoe Script", cursive', g: 'Caveat:wght@400;700' },
    dancing: { label: 'Dancing', css: '"Dancing Script", "Snell Roundhand", cursive', g: 'Dancing+Script:wght@400;700' },
    dyslexic: { label: 'OpenDyslexic', css: 'OpenDyslexic, Verdana, sans-serif' }
  };
  var GRADIENTS = [
    ['#3C5E70', '#1d2b33', 160], ['#0f2027', '#2c5364', 160], ['#ff9966', '#ff5e62', 135], ['#f6d365', '#fda085', 135],
    ['#667eea', '#764ba2', 135], ['#134e5e', '#71b280', 150], ['#232526', '#414345', 160], ['#fbc2eb', '#a6c1ee', 135],
    ['#1e3c72', '#2a5298', 160], ['#c33764', '#1d2671', 150], ['#f8f1e4', '#d9c7a3', 160], ['#0b0b0f', '#3a3a4a', 160]
  ];
  var SOLIDS = ['#ffffff', '#f6efe0', '#1d2b33', '#000000', '#3C5E70', '#8a3b2e', '#2f5d3a', '#7a5c2e', '#ffd98a', '#e8b4b8', '#cfe3ee', '#4a3b6b'];
  var PHOTOS = 49;
  var DEFAULT_STYLE = {
    fmt: 'sq',
    bg: { type: 'gradient', c1: '#3C5E70', c2: '#1d2b33', angle: 160, photo: 1, custom: null, posX: 0.5, posY: 0.5, zoom: 1 },
    overlay: '#000000', dim: 30, blur: 0,
    font: 'playfair', size: 0, color: '#ffffff', refColor: '#ffd98a',
    align: 'center', valign: 'middle', bold: false, italic: false, upper: false,
    shadow: true, lh: 1.35, showRef: true, showVer: true, logo: true, quote: true,
    frame: false, pad: 11, gap: 0.95
  };
  function cloneStyle(s) { return JSON.parse(JSON.stringify(s || DEFAULT_STYLE)); }
  function normStyle(s) {
    var d = cloneStyle(DEFAULT_STYLE);
    if (s) for (var k in s) if (k !== 'bg') d[k] = s[k];
    if (s && s.bg) for (var b in s.bg) d.bg[b] = s.bg[b];
    return d;
  }

  /* ───────── lettertypen laden (Google Fonts, met nette terugval) ───────── */
  var fontsRequested = false;
  function fontName(k) { return k === 'dyslexic' ? t('Dyslexie', 'Dyslexia') : FONTS[k].label; }
  function loadFonts(done) {
    if (!fontsRequested) {
      fontsRequested = true;
      var fam = [];
      for (var k in FONTS) if (FONTS[k].g) fam.push('family=' + FONTS[k].g);
      var link = el('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?' + fam.join('&') + '&display=swap' });
      document.head.appendChild(link);
      try {
        var ff = new FontFace('OpenDyslexic', 'url(' + ROOT + 'fonts/opendyslexic-400.woff2)', { weight: '400' });
        ff.load().then(function (f) { document.fonts.add(f); done && done(); }).catch(function () {});
      } catch (e) {}
    }
    if (document.fonts && document.fonts.load) {
      var ps = [];
      for (var f in FONTS) {
        if (!FONTS[f].g) continue;
        var nm = FONTS[f].css.split(',')[0].replace(/"/g, '');
        ps.push(document.fonts.load('400 40px "' + nm + '"').catch(function () {}));
        ps.push(document.fonts.load('700 40px "' + nm + '"').catch(function () {}));
      }
      Promise.all(ps).then(function () { done && done(); });
    }
  }

  /* ───────── afbeeldingen ───────── */
  var imgCache = {}, imgOrder = [], imgWait = {};
  function cacheImg(src, im) {
    imgCache[src] = im;
    var i = imgOrder.indexOf(src); if (i > -1) imgOrder.splice(i, 1);
    imgOrder.push(src);
    // een grote foto is ~30 MB uitgepakt: houd er maar een paar vast
    while (imgOrder.length > 5) delete imgCache[imgOrder.shift()];
  }
  function loadImg(src, cb) {
    var c = imgCache[src];
    if (c && c.complete && c.naturalWidth) { cacheImg(src, c); cb(c); return; }
    // dezelfde foto die al geladen wordt (bijvoorbeeld door vooraf laden): niet nog eens ophalen
    if (imgWait[src]) { imgWait[src].push(cb); return; }
    imgWait[src] = [cb];
    var im = new Image();
    var done = function (ok) {
      var list = imgWait[src] || []; delete imgWait[src];
      if (ok) cacheImg(src, im);
      list.forEach(function (f) { try { f(ok ? im : null); } catch (e) {} });
    };
    im.onload = function () {
      // eerst uitpakken (decode), dan pas gebruiken: voorkomt haperen bij het eerste tekenen
      if (im.decode) im.decode().then(function () { done(true); }, function () { done(true); });
      else done(true);
    };
    im.onerror = function () { done(false); };
    im.src = src;
  }
  function prefetchImg(src) { if (!(imgCache[src] && imgCache[src].complete)) loadImg(src, function () {}); }
  // de studio gebruikt de schonere 2x-versies (img/votd/hd/, gemaakt met make-hd-photos.py)
  function photoUrl(n) { return ROOT + 'img/votd/hd/nature-' + (n < 10 ? '0' : '') + n + '.webp'; }
  function photoUrlSd(n) { return ROOT + 'img/votd/nature-' + (n < 10 ? '0' : '') + n + '.webp'; }
  function photoThumb(n) { return ROOT + 'img/votd/thumb/nature-' + (n < 10 ? '0' : '') + n + '.webp'; }
  function bgSource(st) {
    if (st.bg.type === 'photo') return photoUrl(st.bg.photo || 1);
    if (st.bg.type === 'custom' && st.bg.custom) return st.bg.custom;
    return null;
  }

  /* ───────── tekenen ───────── */
  function breakWord(ctx, w, maxW) {
    var parts = [], p = '';
    for (var k = 0; k < w.length; k++) {
      var tst = p + w.charAt(k);
      if (p && ctx.measureText(tst).width > maxW) { parts.push(p); p = w.charAt(k); } else p = tst;
    }
    if (p) parts.push(p);
    return parts;
  }
  function wrap(ctx, text, maxW) {
    var words = text.split(/\s+/), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      if (ctx.measureText(words[i]).width > maxW) {
        // een woord breder dan de regel: afbreken in plaats van buiten beeld laten lopen
        if (cur) { lines.push(cur); cur = ''; }
        var parts = breakWord(ctx, words[i], maxW);
        for (var j = 0; j < parts.length - 1; j++) lines.push(parts[j]);
        cur = parts[parts.length - 1] || '';
        continue;
      }
      var test = cur ? cur + ' ' + words[i] : words[i];
      if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = words[i]; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  /* Opeenvolgende verzen (zelfde boek, hoofdstuk en vertaling) worden één verwijzing:
     Spreuken 4:1 + 4:2 + 4:3 -> Spreuken 4:1-3. Los staande verzen (4:1 en 4:3) blijven apart. */
  function splitLabel(label) {
    var m = String(label || '').match(/^(.*?)\s+(\d+):(\d+)(?:-(\d+))?\s*(?:\(([^)]*)\))?\s*$/);
    return m ? { book: m[1], chapter: +m[2], start: +m[3], end: +(m[4] || m[3]), ver: m[5] || '' } : null;
  }
  function mergeItems(items) {
    var out = [];
    items.forEach(function (it) {
      var p = splitLabel(it.label);
      out.push({ label: it.label, text: it.text || '', p: p });
    });
    var changed = true;
    while (changed) {
      changed = false;
      outer: for (var i = 0; i < out.length; i++) {
        var a = out[i]; if (!a.p) continue;
        for (var j = 0; j < out.length; j++) {
          if (i === j) continue;
          var b = out[j]; if (!b.p) continue;
          if (a.p.book !== b.p.book || a.p.chapter !== b.p.chapter || a.p.ver !== b.p.ver) continue;
          if (b.p.start === a.p.end + 1) {
            a.text = a.text.replace(/\s+$/, '') + ' ' + b.text.replace(/^\s+/, '');
            a.p = { book: a.p.book, chapter: a.p.chapter, start: a.p.start, end: b.p.end, ver: a.p.ver };
            a.label = a.p.book + ' ' + a.p.chapter + ':' + a.p.start + (a.p.end > a.p.start ? '-' + a.p.end : '') + (a.p.ver ? ' (' + a.p.ver + ')' : '');
            out.splice(j, 1); changed = true; break outer;
          }
        }
      }
    }
    return out.map(function (o) { return { label: o.label, text: o.text }; });
  }
  function refText(it, st) {
    var l = it.label || '';
    if (!st.showVer) l = l.replace(/\s*\([^)]*\)\s*$/, '');
    return '— ' + l;
  }
  // De afbeelding heeft altijd precies het gekozen formaat (de tekst is dan overal scherp). Is de foto
  // kleiner dan dat formaat, dan wordt hij zo goed mogelijk vergroot: in stappen van max 1,5x met hoge
  // kwaliteit en daarna licht aangescherpt. Het resultaat wordt onthouden tot foto of formaat verandert.
  var upCache = { key: '', cv: null };
  var bgLayer = { key: null, cv: null };
  var imgIds = typeof WeakMap === 'function' ? new WeakMap() : null, imgIdN = 0;
  function imgId(img) {
    if (!img) return 0;
    if (!imgIds) return img.src || 1;
    if (!imgIds.has(img)) imgIds.set(img, ++imgIdN);
    return imgIds.get(img);
  }
  function drawUpscaled(ctx, img, W, H, dx, dy, dw, dh) {
    try {
      if (!document.createElement || W * H > 12000000) return false;
      var key = (img.src || img.currentSrc || '') + '|' + img.naturalWidth + '|' + W + 'x' + H;
      var out = upCache.key === key ? upCache.cv : null;
      if (!out) {
        var cur = img, cw = img.naturalWidth, ch = img.naturalHeight, c;
        while (cw * 1.5 < dw) {
          var nw = Math.round(cw * 1.5), nh = Math.round(ch * 1.5);
          c = document.createElement('canvas'); c.width = nw; c.height = nh;
          var cc = c.getContext('2d'); cc.imageSmoothingEnabled = true; cc.imageSmoothingQuality = 'high';
          cc.drawImage(cur, 0, 0, nw, nh);
          cur = c; cw = nw; ch = nh;
        }
        out = document.createElement('canvas'); out.width = W; out.height = H;
        var oc = out.getContext('2d'); oc.imageSmoothingEnabled = true; oc.imageSmoothingQuality = 'high';
        oc.drawImage(cur, dx, dy, dw, dh);
        // lichte verscherping (3x3), zodat een vergrote foto niet zacht oogt
        if (oc.getImageData) {
          var id = oc.getImageData(0, 0, W, H), d = id.data, src = new Uint8ClampedArray(d), a = 0.5, x, y, k, p;
          for (y = 1; y < H - 1; y++) {
            for (x = 1; x < W - 1; x++) {
              p = (y * W + x) * 4;
              for (k = 0; k < 3; k++) {
                d[p + k] = (1 + 4 * a) * src[p + k] - a * (src[p + k - 4] + src[p + k + 4] + src[p + k - W * 4] + src[p + k + W * 4]);
              }
            }
          }
          oc.putImageData(id, 0, 0);
        }
        upCache.key = key; upCache.cv = out;
      }
      ctx.drawImage(out, 0, 0);
      return true;
    } catch (e) { return false; }
  }
  // Echte afmeting van de achtergrondfoto. Het kleine voorbeeldplaatje (200 px) telt als de volle foto.
  var PHOTO_NATIVE = { w: 2200, h: 3300 };
  function photoNative(st, img) {
    if (!img || !img.naturalWidth) return null;
    if (st.bg.type === 'photo' && img.naturalWidth < 400) return PHOTO_NATIVE;
    return { w: img.naturalWidth, h: img.naturalHeight };
  }
  // De grootste maat (in de gekozen verhouding) waarop de foto precies 1:1 wordt gebruikt: scherp,
  // zonder vergroten. Past het formaat in de foto, dan blijft het precies zoals gekozen.
  function sharpSize(W, H, st, img) {
    var n = (st.bg.type === 'photo' || st.bg.type === 'custom') ? photoNative(st, img) : null;
    if (!n) return { w: W, h: H };
    var up = Math.max(W / n.w, H / n.h);
    if (up <= 1.0001) {
      // de foto heeft meer pixels dan het formaat: tot 2x groter exporteren, zo scherp als de foto toelaat
      var f = Math.min(2, 1 / up);
      return { w: Math.round(W * f), h: Math.round(H * f) };
    }
    return { w: Math.max(320, Math.floor(W / up)), h: Math.max(320, Math.floor(H / up)) };
  }
  // Hoe groot de afbeelding op het scherm getoond wordt en met hoeveel pixels hij getekend moet
  // worden om scherp te zijn. Bij een foto-achtergrond wordt hij nooit groter getoond dan de foto
  // aankan (1 foto-pixel = 1 schermpixel): liever een kleiner voorbeeld dan een wazig groot voorbeeld.
  // Zonder foto (kleur of verloop) mag hij het hele vak vullen, met scherpe tekst op schermdichtheid.
  function previewFit(box, FW, FH, bw, bh, st, img) {
    try {
      var full = sharpSize(FW, FH, st, img), base = sharpSize(bw, bh, st, img);
      var dpr = Math.min(3, window.devicePixelRatio || 1);
      var photo = st.bg.type === 'photo' || st.bg.type === 'custom';
      var fit = Math.min(box.w, box.h * (full.w / full.h));
      var cssW = photo ? Math.min(fit, full.w / dpr) : fit;
      if (!(cssW > 0)) return { css: 0, zoom: 1, capped: false };
      // getekend op precies de schermgrootte (x schermdichtheid): scherp en niet onnodig zwaar
      // Iets meer pixels tekenen dan het scherm heeft en de browser laten verkleinen: dat oogt scherper
      // (zoals de kaarten onder Bewaard, die ook van groot naar klein gaan) dan 1 op 1 tekenen,
      // waarbij de zachtheid van de foto op 100% zichtbaar is.
      var os = dpr >= 2 ? 1.5 : 2;
      var z = Math.max(0.35, Math.min(3, (cssW * dpr * os) / base.w));
      return { css: cssW, zoom: z, capped: photo && cssW < fit - 1 };
    } catch (e) { return { css: 0, zoom: 1, capped: false }; }
  }
  // Welk deel van de foto zichtbaar is (0..1 per as, 0.5 = gecentreerd, zoals altijd). Een oud ontwerp
  // zonder deze velden krijgt 0.5, dus het ziet er precies hetzelfde uit.
  function clamp01(v) { return Math.min(1, Math.max(0, v)); }
  function bgPos(bg) {
    var p = function (v) { return (v === null || v === undefined || v === '' || !isFinite(Number(v))) ? 0.5 : clamp01(Number(v)); };
    return { x: p(bg && bg.posX), y: p(bg && bg.posY) };
  }
  // Zoom van de foto (1 = precies het vak vullen; hoger = groter, zodat hij in beide richtingen uitsteekt).
  function bgZoom(bg) {
    var z = Number(bg && bg.zoom);
    return (bg && bg.zoom !== undefined && bg.zoom !== null && isFinite(z)) ? Math.min(3, Math.max(1, z)) : 1;
  }
  // Maat en plaats van de foto in het vak. Eén plek voor tekenen en voor slepen, zodat ze niet uiteenlopen.
  function coverGeom(W, H, img, bg) {
    var s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * bgZoom(bg), p = bgPos(bg);
    var dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    return { s: s, dw: dw, dh: dh, dx: (W - dw) * p.x, dy: (H - dh) * p.y };
  }
  function draw(canvas, W, H, st, items, img, zoom) {
    items = mergeItems(items);
    var ss = sharpSize(W, H, st, img);
    var z = zoom > 0 ? zoom : 1;
    if (ss.w * z * ss.h * z > 9000000) z = Math.sqrt(9000000 / (ss.w * ss.h));
    W = Math.round(ss.w * z); H = Math.round(ss.h * z);
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    var u = W / 1080;

    // achtergrond (foto, verloop, verduistering, rand). Dat is het zwaarste deel en verandert niet bij
    // tekst-instellingen, dus de laag wordt onthouden: schuiven met een tekstschuif tekent alleen de tekst.
    var bg = st.bg, layerKey = null;
    try {
      var bp = bgPos(bg);
      layerKey = [bg.type, bg.c1, bg.c2, bg.angle, bg.photo, bg.custom ? bg.custom.length : 0, bp.x, bp.y, bgZoom(bg), st.blur, st.dim, st.overlay,
        st.frame ? st.color : '', W, H, imgId(img)].join('|');
    } catch (e) {}
    if (layerKey && bgLayer.key === layerKey && bgLayer.cv) {
      ctx.drawImage(bgLayer.cv, 0, 0);
    } else {
    if (bg.type === 'color') { ctx.fillStyle = bg.c1; ctx.fillRect(0, 0, W, H); }
    else if ((bg.type === 'photo' || bg.type === 'custom') && img) {
      var cg = coverGeom(W, H, img, bg), s = cg.s, dw = cg.dw, dh = cg.dh, dx = cg.dx, dy = cg.dy;
      if (st.blur > 0) {
        var f = 1 / (1 + st.blur * 0.12);
        var sm = document.createElement('canvas');
        sm.width = Math.max(8, Math.round(W * f)); sm.height = Math.max(8, Math.round(H * f));
        var sc = sm.getContext('2d');
        sc.drawImage(img, dx * f, dy * f, dw * f, dh * f);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(sm, 0, 0, W, H);
      } else if (s > 1.02 && img.naturalWidth >= 400 && drawUpscaled(ctx, img, W, H, dx, dy, dw, dh)) {
        // foto is groter getekend dan hij is: stapsgewijs vergroot en licht aangescherpt (zie drawUpscaled)
      } else { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, dx, dy, dw, dh); }
    } else {
      var a = (bg.angle || 0) * Math.PI / 180, cx = W / 2, cy = H / 2;
      var len = Math.abs(W * Math.sin(a)) + Math.abs(H * Math.cos(a));
      var x = Math.sin(a) * len / 2, y = -Math.cos(a) * len / 2;
      var g = ctx.createLinearGradient(cx - x, cy - y, cx + x, cy + y);
      g.addColorStop(0, bg.c1); g.addColorStop(1, bg.c2 || bg.c1);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (st.dim > 0 && (bg.type === 'photo' || bg.type === 'custom')) {
      ctx.globalAlpha = st.dim / 100; ctx.fillStyle = st.overlay; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    }
    if (st.frame) {
      ctx.strokeStyle = st.color; ctx.globalAlpha = 0.65; ctx.lineWidth = Math.max(2, 3 * u);
      var m = 34 * u; ctx.strokeRect(m, m, W - 2 * m, H - 2 * m); ctx.globalAlpha = 1;
    }
    if (layerKey && W * H <= 9000000) {
      try {
        var lc = bgLayer.cv && bgLayer.cv.width === W && bgLayer.cv.height === H ? bgLayer.cv : document.createElement('canvas');
        lc.width = W; lc.height = H;
        lc.getContext('2d').drawImage(canvas, 0, 0);
        bgLayer.key = layerKey; bgLayer.cv = lc;
      } catch (e) { bgLayer.key = null; }
    }
    }

    // tekst
    var fam = (FONTS[st.font] || FONTS.playfair).css;
    var pad = W * st.pad / 100;
    var boxW = W - 2 * pad;
    var top = pad, bottom = H - pad - (st.logo ? 40 * u : 0), boxH = bottom - top;
    function font(px, bold, italic) { ctx.font = (italic ? 'italic ' : '') + (bold ? '700 ' : '400 ') + px + 'px ' + fam; }
    function build(px) {
      var out = { px: px, h: 0, blocks: [] };
      var refPx = Math.max(px * 0.5, 22 * u), gap = px * (st.gap == null ? 0.95 : st.gap);
      items.forEach(function (it, i) {
        var txt = (it.text || '').trim();
        if (st.upper) txt = txt.toUpperCase();
        if (st.quote) txt = '“' + txt + '”';
        font(px, st.bold, st.italic);
        var lines = wrap(ctx, txt, boxW);
        var b = { lines: lines, ref: null, refLines: [], refPx: refPx };
        var h = lines.length * px * st.lh;
        if (st.showRef) {
          b.ref = refText(it, st);
          font(refPx, true, false);
          b.refLines = wrap(ctx, b.ref, boxW);
          h += px * 0.35 + b.refLines.length * refPx * 1.3;
        }
        b.h = h;
        out.blocks.push(b);
        out.h += h + (i ? gap : 0);
      });
      out.gap = gap;
      return out;
    }
    // "auto": de tekst krimpt tot alles past. Een eigen grootte blijft precies zoals ingesteld;
    // past het dan niet, dan wordt de afbeelding hoger (zie hieronder).
    var manual = st.size > 0;
    var px = manual ? Math.max(16, st.size) * u : Math.min(110 * u, W * 0.1), lay;
    var minPx = 14 * u;
    for (;;) {
      lay = build(px);
      if (manual || lay.h <= boxH || px <= minPx) break;
      px = Math.max(minPx, px - Math.max(1, 2 * u));
    }
    // Past alles ook op de kleinste lettergrootte niet? Dan wordt de afbeelding hoger,
    // zodat er nooit een vers buiten beeld valt.
    var maxH = Math.min(W * 6, Math.floor(16000000 / W)); // veilige canvasgrootte (Safari)
    if (lay.h > boxH + 2 && H < maxH) {
      return draw(canvas, W, Math.min(maxH, Math.ceil(H + (lay.h - boxH) + 4)), st, items, img, 1);
    }
    // Bij de maximale hoogte nog steeds te veel? Dan toch kleiner, zodat niets buiten beeld valt.
    while (lay.h > boxH + 2 && px > minPx) {
      px = Math.max(minPx, px - Math.max(1, 2 * u));
      lay = build(px);
    }
    var y = st.valign === 'top' ? top : st.valign === 'bottom' ? bottom - lay.h : top + (boxH - lay.h) / 2;
    var tx = st.align === 'left' ? pad : st.align === 'right' ? W - pad : W / 2;
    ctx.textAlign = st.align; ctx.textBaseline = 'top';
    if (st.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = lay.px * 0.14; ctx.shadowOffsetY = lay.px * 0.04; }
    lay.blocks.forEach(function (b, i) {
      if (i) y += lay.gap;
      font(lay.px, st.bold, st.italic); ctx.fillStyle = st.color;
      b.lines.forEach(function (ln) { ctx.fillText(ln, tx, y + (lay.px * st.lh - lay.px) / 2); y += lay.px * st.lh; });
      if (b.ref) {
        y += lay.px * 0.35;
        font(b.refPx, true, false); ctx.fillStyle = st.refColor;
        b.refLines.forEach(function (ln) { ctx.fillText(ln, tx, y); y += b.refPx * 1.3; });
      }
    });
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    if (st.logo) {
      var lg = LOGO_IMG;
      if (lg && lg.complete && lg.naturalWidth) {
        // het woordlogo uit de kop, met de gekleurde bolletjes
        var lh = 58 * u, lw = lh * lg.naturalWidth / lg.naturalHeight;
        ctx.globalAlpha = 1; ctx.drawImage(lg, (W - lw) / 2, H - pad * 0.55 - 5 * u - lh, lw, lh);
      } else {
        ctx.textAlign = 'center'; ctx.globalAlpha = 0.7; ctx.fillStyle = st.color;
        ctx.font = '600 ' + Math.round(22 * u) + 'px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';
        ctx.fillText((isEn() ? 'The Bible Online' : 'De Bijbel Online'), W / 2, H - pad * 0.55 - 22 * u);
        ctx.globalAlpha = 1;
      }
    }
  }

  /* ───────── echtheid van de verstekst ─────────
     De tekst van een vers is nooit te bewerken. Bij het openen van een ontwerp wordt elke
     tekst vergeleken met de echte Bijbeltekst uit de app (window.__onkVerse). Wat daar niet
     in staat wordt vervangen door de echte tekst; verzen zonder verwijzing worden verwijderd. */
  function plain(x) { return String(x || '').replace(/[\[\]]/g, '').replace(/\s+/g, ' ').trim(); }
  function canonical(it) {
    var f = window.__onkVerse;
    if (!f || !it.code || !it.chapter || !it.verseStart || !it.version) return null;
    var out = [];
    try {
      for (var v = it.verseStart; v <= (it.verseEnd || it.verseStart); v++) {
        var x = f(it.version, it.code, it.chapter, v);
        if (x) out.push(x); // een leeg deel van een bereik (samengevoegd vers) slaan we over
      }
    } catch (e) { return null; }
    return out.length ? out.join(' ') : null;
  }
  function verifyItems(list) {
    if (!window.__onkVerse) return list;
    var out = [];
    list.forEach(function (it) {
      var c = canonical(it);
      if (c === null) {
        // geen tekst terug te vinden voor een geldige verwijzing (bijvoorbeeld een leeg vers in deze
        // vertaling): houd het vers met de tekst uit de app. Zonder verwijzing of tekst: niet gebruiken.
        if (it.code && it.chapter && it.verseStart && plain(it.text)) out.push(it);
        return;
      }
      var copy = {}; for (var k in it) copy[k] = it[k];
      if (plain(c).indexOf(plain(it.text)) === -1 || !plain(it.text)) copy.text = plain(c);
      out.push(copy);
    });
    return out;
  }

  /* ───────── opslag: verzameling (basket) ───────── */
  // De selectie hoort bij dit tabblad: een refresh laat hem staan, maar zodra je het tabblad of de
  // browser sluit is hij weg. Daarom sessionStorage; localStorage alleen als dat niet beschikbaar is.
  function sess() { try { var k = '__odz'; sessionStorage.setItem(k, '1'); sessionStorage.removeItem(k); return sessionStorage; } catch (e) { return null; } }
  function sGet(k, fb) {
    var st = sess() || localStorage;
    try { var v = st.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; }
  }
  function sSet(k, v) {
    var st = sess() || localStorage;
    try { st.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  function sDel(k) { try { (sess() || localStorage).removeItem(k); } catch (e) {} }
  function getBasket() { var b = sGet(LS_BASKET, []); return Array.isArray(b) ? b : []; }
  function setBasket(b) {
    if (b && b.length) sSet(LS_BASKET, b); else sDel(LS_BASKET);
    updatePill();
  }

  /* ───────── opslag: ontwerpen (lokaal + account) ───────── */
  function localDesigns() { var d = lsGet(LS_DESIGNS, []); return Array.isArray(d) ? d : []; }
  function setLocalDesigns(d) { return lsSet(LS_DESIGNS, d); }
  // Past de lijst niet in de browseropslag? Eerst de voorbeeldplaatjes van oudere ontwerpen weglaten,
  // daarna de oudste ontwerpen (die staan in je account als je ingelogd was).
  function storeDesigns(list) {
    if (setLocalDesigns(list)) return true;
    var l = list.map(function (d, i) {
      if (i === 0 || !d.thumb) return d;
      var c = {}; for (var k in d) c[k] = d[k]; delete c.thumb; return c;
    });
    if (setLocalDesigns(l)) return true;
    for (var n = l.length - 1; n >= 1; n--) { if (setLocalDesigns(l.slice(0, n))) return true; }
    return false;
  }
  var remote = { ok: true, user: null, checked: false };
  function sb() { return window.__onkSb && window.__onkSb.from ? window.__onkSb : null; }
  var authTransient = false; // laatste inlogcontrole mislukte door het netwerk (niet: uitgelogd)
  function getUser() {
    return getUserRaw().then(function (u) {
      if (u) loadAccountName(u); else if (sb() && !authTransient) setAccountName('');
      return u;
    });
  }
  function getUserRaw() {
    var c = sb();
    if (!c || !c.auth) return Promise.resolve(null);
    // eerst de sessie in deze browser (geen netwerk nodig, zoals de app zelf doet); pas daarna de server
    function viaServer() {
      return c.auth.getUser().then(function (r) {
        var err = r && r.error;
        authTransient = !!(err && (err.name === 'AuthRetryableFetchError' || /fetch|network/i.test(String(err.message || ''))));
        remote.user = (r && r.data && r.data.user) || null;
        return remote.user;
      }, function () { authTransient = true; return null; });
    }
    if (!c.auth.getSession) return viaServer();
    return c.auth.getSession().then(function (r) {
      var u = r && r.data && r.data.session && r.data.session.user;
      if (u) { remote.user = u; return u; }
      return viaServer();
    }, viaServer);
  }
  function remoteSave(d) {
    return getUser().then(function (u) {
      if (!u) return 'local';
      function up() {
        return sb().from('bible_designs').upsert({
          id: d.id, user_id: u.id, title: d.title, data: d, updated_at: new Date(d.updated).toISOString()
        }, { onConflict: 'id' }).then(function (r) { return r && r.error ? r.error : null; }, function (e) { return e || { message: 'failed' }; });
      }
      return up().then(function (err) {
        if (!err) return 'account';
        // een ontwerp dat zonder account is gemaakt: eerst overnemen, dan opnieuw proberen
        var tok = ownerToken(d.id);
        if (!tok) return 'noaccount';
        return rpc('onk_claim_design', { p_id: d.id, p_token: tok }).then(function (r) {
          if (r.error || r.data !== true) return 'noaccount';
          return up().then(function (e2) { return e2 ? 'noaccount' : 'account'; });
        });
      });
    });
  }
  function deleteDesign(d) {
    var tok = ownerToken(d.id), jobs = [remoteDelete(d.id)];
    if (d.shareId && tok) jobs.push(rpc('onk_delete_shared', { p_share: d.shareId, p_token: tok }));
    return Promise.all(jobs).then(function () {
      var m = lsGet(LS_TOKENS, {});
      if (m && m[d.id]) { delete m[d.id]; lsSet(LS_TOKENS, m); }
    }, function () {});
  }
  function remoteDelete(id) {
    return getUser().then(function (u) {
      if (!u) return;
      return sb().from('bible_designs').delete().eq('id', id).then(function () {}, function () {});
    });
  }
  function remoteList() {
    return getUser().then(function (u) {
      if (!u) return [];
      return sb().from('bible_designs').select('id,data,updated_at').order('updated_at', { ascending: false })
        .then(function (r) {
          if (!r || r.error || !r.data) { remote.ok = false; return []; }
          return r.data.map(function (x) {
            var dd = x.data;
            if (dd && dd.preview) { dd = Object.assign({}, dd); delete dd.preview; } // groot, alleen voor het link-voorbeeld
            return dd;
          }).filter(Boolean);
        }, function () { remote.ok = false; return []; });
    });
  }
  function allDesigns(cb) {
    var loc = localDesigns();
    remoteList().then(function (rem) {
      var map = {};
      loc.concat(rem).forEach(function (d) { if (!map[d.id] || (d.updated || 0) > (map[d.id].updated || 0)) map[d.id] = d; });
      var out = Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
      // kleine synchronisatie: lokaal bijwerken met wat in het account staat
      if (rem.length) storeDesigns(out.slice(0, 40));
      cb(out);
    });
  }
  // Standaardnaam van een ontwerp: "Ontwerp van <naam van het account>" / "Design by <name>".
  // Alleen een naam, nooit een e-mailadres.
  function plainName(v) { v = String(v || '').trim(); return v && v.indexOf('@') < 0 && !/\.(com|nl|net|org|info|io|eu|be|de|gmail)(\.|$)/i.test(v) ? v : ''; }
  var accountName = plainName(lsGet('onk-account-name', ''));
  var studioTitle = null;
  function designTitle() {
    return accountName ? t('Ontwerp van ' + accountName, 'Design by ' + accountName) : t('Mijn ontwerp', 'My design');
  }
  // Het Samenkomst-account (persoon "De Samenkomst" in het menu). Zelfde uid als xe in bible.js.
  var ORG_UID = 'c5de1da8-aa8e-47ae-b51c-76d44651a9e7';
  // Staat de admin op "Wissel naar De Samenkomst"? Dan plaatst een bericht onder het Samenkomst-account.
  function postAsOrg() {
    try { return localStorage.getItem('bible-active-persona') === 'bot'; } catch (e) { return false; }
  }
  // Titel voor een bericht: als het Samenkomst-account plaatst, staat er De Samenkomst in de titel, niet de naam van de persoon.
  function postTitle(asOrg) {
    return asOrg ? t('Ontwerp van De Samenkomst', 'Design by De Samenkomst') : designTitle();
  }
  // Een ontwerp dat in de Gemeenschap staat (bericht met activity_ref "design:<code>") blijft vanzelf bijgewerkt:
  // bij elke keer bewaren krijgt dat bericht de nieuwe afbeelding (en de eigen titel, als die is aangepast).
  // Alleen de plaatser van het bericht kan het bijwerken (rechten van de database); voor anderen gebeurt er niets.
  function findPost(c, shareId) {
    return Promise.resolve(c.from('bible_forum_topics').select('id,author,title,body').eq('activity_ref', 'design:' + shareId).limit(1)).then(function (r) {
      return (r && r.data && r.data[0]) || null;
    }, function () { return null; });
  }
  var postSyncT = {};
  function syncCommunityPost(d, preview) {
    if (!d || !d.shareId || !preview) return;
    clearTimeout(postSyncT[d.shareId]);
    postSyncT[d.shareId] = setTimeout(function () {
      var c = sb(); if (!c) return;
      getUser().then(function (u) {
        if (!u) return;
        return findPost(c, d.shareId).then(function (post) {
          if (!post) return; // niet in de Gemeenschap geplaatst: niets te doen
          // rechten: de database laat alleen de plaatser of een admin het bericht bijwerken
          var path = u.id + '/share-' + d.shareId + '.jpg';
          return c.storage.from('bible-backgrounds').upload(path, dataUrlToBlob(preview), { contentType: 'image/jpeg', upsert: true }).then(function (up) {
            if (up && up.error) throw up.error;
            var url = c.storage.from('bible-backgrounds').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
            var nodes = ((post.body && post.body.nodes) || []).filter(function (n) { return n.type !== 'img'; }).concat([{ type: 'img', url: url }]);
            var patch = { body: { v: 1, nodes: nodes } };
            if (d.titleCustom && d.title) patch.title = d.title;
            return c.from('bible_forum_topics').update(patch).eq('id', post.id);
          });
        });
      }).then(function () { try { window.dispatchEvent(new Event('onk-community-changed')); } catch (e) {} }, function () {});
    }, 2500);
  }
  function setAccountName(n) {
    n = plainName(n);
    if ((n || '') === (accountName || '')) return;
    accountName = n || '';
    if (n) lsSet('onk-account-name', n); else { try { localStorage.removeItem('onk-account-name'); } catch (e) {} }
    try { window.dispatchEvent(new Event('onk-designs-changed')); } catch (e) {}
    if (studioTitle) studioTitle();
  }
  // Alle studio-instellingen (lettertype, grootte, afstand, kleuren, formaat, achtergrond, marge ...)
  // worden bewaard en gelden voor het volgende ontwerp. Lokaal in de browser, en in het account
  // (bible_settings, sleutel 'design-style') zodat ze ook na een nieuwe sessie of op een ander
  // apparaat terugkomen. Een eigen achtergrondfoto gaat niet mee naar het account (te groot).
  var STYLE_KEY = 'design-style', styleTimer = null, styleLatest = null;
  function pushStyleSoon(style) {
    styleLatest = style;
    clearTimeout(styleTimer);
    styleTimer = setTimeout(function () {
      var c = sb(), snap = styleLatest ? cloneStyle(styleLatest) : null;
      if (!c || !snap) return;
      if (snap.bg && snap.bg.type === 'custom') snap.bg.type = 'gradient';
      if (snap.bg) snap.bg.custom = null;
      getUser().then(function (u) {
        if (!u) return;
        return c.from('bible_settings').upsert({ user_id: u.id, key: STYLE_KEY, value: JSON.stringify(snap), updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });
      }).then(function () {}, function () {});
    }, 1500);
  }
  function pullStyle(u) {
    var c = sb();
    if (!u || !c || lsGet(LS_STYLE, null)) return; // lokaal staat al een eigen stijl: die wint
    Promise.resolve(c.from('bible_settings').select('value').eq('user_id', u.id).eq('key', STYLE_KEY).maybeSingle()).then(function (r) {
      try {
        var v = r && r.data && r.data.value;
        var parsed = v ? JSON.parse(v) : null;
        if (parsed && typeof parsed === 'object' && !lsGet(LS_STYLE, null)) lsSet(LS_STYLE, parsed);
      } catch (e) {}
    }, function () {});
  }
  function loadAccountName(u) {
    var c = sb();
    if (!u || !c) return;
    var meta = u.user_metadata || {};
    var fallback = plainName(meta.full_name || meta.name);
    Promise.resolve(c.from('bible_profiles').select('display_name,username').eq('user_id', u.id).maybeSingle()).then(function (r) {
      var p = r && r.data;
      setAccountName((p && (plainName(p.display_name) || plainName(p.username))) || fallback);
    }, function () { setAccountName(fallback); });
  }
  // leesbare naam voor bestanden en links: zonder accenten (Mattheüs wordt mattheus)
  function slugify(s) {
    var out = String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return out.slice(0, 60).replace(/-+$/, '');
  }

  /* ───────── delen via korte link (Supabase) ─────────
     Een ontwerp krijgt een korte code (?o=k3F9aZ2q). De eigenaar kiest wie het mag zien of
     bewerken. De verzen zelf zijn nooit aan te passen: de tekst wordt bij het openen altijd
     tegen de echte Bijbeltekst gecontroleerd. Zie supabase-designs-sharing.sql. */
  var SHARE_CHARS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function newShareId() {
    var out = '', r = new Uint8Array(8);
    try { crypto.getRandomValues(r); } catch (e) { for (var i = 0; i < 8; i++) r[i] = Math.floor(Math.random() * 256); }
    for (var j = 0; j < 8; j++) out += SHARE_CHARS.charAt(r[j] % SHARE_CHARS.length);
    return out;
  }
  // geheime sleutel per ontwerp, alleen in deze browser: daarmee houdt wie zonder account deelt
  // zelf de controle over de link
  var LS_TOKENS = 'onk-share-tokens';
  function ownerToken(designId, create) {
    var m = lsGet(LS_TOKENS, {});
    if (!m || typeof m !== 'object') m = {};
    if (!m[designId] && create) {
      var out = '', r = new Uint8Array(32);
      try { crypto.getRandomValues(r); } catch (e) { for (var i = 0; i < 32; i++) r[i] = Math.floor(Math.random() * 256); }
      for (var j = 0; j < 32; j++) out += SHARE_CHARS.charAt(r[j] % SHARE_CHARS.length);
      m[designId] = out; lsSet(LS_TOKENS, m);
    }
    return m[designId] || null;
  }
  function shortLink(id, title) {
    var sl = slugify(title);
    // design-share.php geeft het ontwerp als voorbeeldafbeelding aan WhatsApp, Telegram enzovoort
    return ROOT + 'design-share.php?o=' + (sl ? sl + '-' : '') + id;
  }
  function rpc(fn, args) {
    var c = sb();
    if (!c || !c.rpc) return Promise.resolve({ error: { message: 'no-client' } });
    return Promise.resolve(c.rpc(fn, args)).then(function (r) { return r || { error: { message: 'empty' } }; }, function (e) { return { error: e || { message: 'failed' } }; });
  }
  function setShare(designId, shareId, mode, users) {
    var c = sb();
    if (!c) return Promise.resolve({ error: { message: 'no-client' } });
    var patch = { share_id: shareId, share_mode: mode };
    if (mode === 'edit_members') patch.edit_users = users || null;
    return Promise.resolve(c.from('bible_designs').update(patch).eq('id', designId).select('id'))
      .then(function (r) { return r || {}; }, function (e) { return { error: e || { message: 'failed' } }; });
  }
  // haalt alleen ?o=... uit de adresbalk; andere parameters (zoals ?lang=en) blijven staan
  function stripShareParam() {
    try {
      var u = new URL(location.href);
      if (!u.searchParams.has('o')) return;
      u.searchParams.delete('o');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (e) {}
  }
  // Alleen kijken: de afbeelding op een witte pagina, zonder ontwerpstudio.
  function openViewer(d, base) {
    ensureCss();
    var st = normStyle(d.style), F = FORMATS[st.fmt] || FORMATS.sq, list = verifyItems(d.items || []);
    var name = (d.titleCustom && d.title) ? d.title : designTitle(list);
    var canvas = el('canvas', { class: 'odz-view-img', role: 'img', 'aria-label': name });
    var bg;
    function close() {
      if (bg) bg.remove();
      stripShareParam();
    }
    function download() {
      canvas.toBlob(function (b) {
        if (!b) return;
        var a = el('a', { href: URL.createObjectURL(b), download: (slugify(name) || t('bijbelvers', 'bible-verse')) + '.png' });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      }, 'image/png');
    }
    bg = el('div', { class: 'odz-view', role: 'dialog', 'aria-modal': 'true', 'aria-label': name }, [
      el('button', { type: 'button', class: 'odz-btn ico odz-view-x', 'aria-label': t('Sluiten', 'Close'), icon: 'x', iconSize: 16, onclick: close }),
      canvas,
      el('div', { class: 'odz-view-row' }, [
        el('button', { type: 'button', class: 'odz-btn', icon: 'download', text: t('Downloaden', 'Download'), onclick: download }),
        el('button', { type: 'button', class: 'odz-btn', text: t('Eigen kopie maken', 'Make my own copy'), onclick: function () { close(); openStudio(base); } })
      ])
    ]);
    bg.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.body.appendChild(bg);
    var k = Math.min(1, 1600 / Math.max(F.w, F.h));
    var src = bgSource(st);
    function go(img) {
      var bw = Math.round(F.w * k), bh = Math.round(F.h * k);
      var fit = previewFit({ w: window.innerWidth - 40, h: window.innerHeight - 170 }, F.w, F.h, bw, bh, st, img);
      draw(canvas, bw, bh, st, list, img, fit.zoom);
      if (fit.css > 0) { canvas.style.width = Math.round(fit.css) + 'px'; canvas.style.height = 'auto'; }
    }
    if (src) loadImg(src, function (im) { go(im); }); else go(null);
  }
  function loadShared(id) {
    var tries = 0;
    (function go() {
      if (!sb() && tries++ < 24) { setTimeout(go, 250); return; }
      var mine = localDesigns().filter(function (x) { return x.shareId === id; })[0];
      var tok = mine ? ownerToken(mine.id) : null;
      rpc('onk_get_shared', tok ? { p_share: id, p_token: tok } : { p_share: id }).then(function (r) {
        var o = r && !r.error && r.data;
        if (!o || !o.data || !o.data.items) {
          toast(t('Dit ontwerp is niet beschikbaar of wordt niet meer gedeeld.', 'This design is not available or is no longer shared.'));
          return;
        }
        var d = o.data, base = { items: d.items, style: d.style, title: d.title, titleCustom: d.titleCustom };
        stripShareParam();
        if (o.is_owner) openStudio(Object.assign(base, { id: d.id, created: d.created, shareId: id, shareMode: o.mode, editUsers: Array.isArray(o.edit_users) ? o.edit_users : null }));
        else if (o.can_edit) openStudio(Object.assign(base, { id: d.id, created: d.created, shareId: id, shareMode: o.mode, sharedEdit: true,
          banner: t('Je mag dit ontwerp bewerken. Bewaren werkt het bij voor iedereen met de link.', 'You can edit this design. Saving updates it for everyone with the link.') }));
        else openViewer(d, base);
      });
    })();
  }

  /* ───────── stijl ───────── */
  var CSS = [
    '.odz,.odz-view,.odz-toast,.odz-gal-top,.odz-card,.odz-empty{--o-paper:var(--paper,#f4f6f7);--o-deep:var(--paper-deep,#eaeef0);--o-surface:var(--surface,#fff);--o-ink:var(--ink,#1d2b33);--o-muted:var(--ink-muted,#9aa7af);--o-soft:var(--ink-soft,#3C5E70);--o-acc:var(--terracotta,#3C5E70);--o-acc-deep:var(--terracotta-deep,#2c4757);--o-line:rgba(29,43,51,.1);--o-line2:rgba(29,43,51,.15);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}',
    '.odz-toast{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 28px);transform:translateX(-50%);z-index:2147483600;background:var(--o-surface);color:var(--o-ink);border:1px solid var(--o-line);border-radius:14px;padding:12px 16px;font-size:13.5px;font-weight:500;line-height:1.35;max-width:min(92vw,440px);display:flex;align-items:center;gap:12px;text-align:left;box-shadow:0 8px 30px rgba(0,0,0,.18)}',
    '.odz-toast button{flex:none;border:0;background:var(--o-acc);color:#fff;border-radius:999px;padding:8px 14px;font:600 12.5px/1 Inter,system-ui,sans-serif;cursor:pointer}',
    '.odz-toast button:hover{background:var(--o-acc-deep)}',
    '.odz{position:fixed;inset:0;z-index:2147483000;background:var(--o-paper);color:var(--o-ink);display:flex;flex-direction:column;font-size:14px;line-height:1.4;-webkit-user-select:none;user-select:none}',
    '.odz *{box-sizing:border-box}',
    '.odz-head{display:flex;align-items:center;gap:8px;padding:12px 14px;padding-top:calc(10px + env(safe-area-inset-top,0px));background:var(--o-surface);border-bottom:1px solid var(--o-line);flex:none}',
    '.odz-title{flex:1;min-width:0;margin:0;font-family:"DM Sans",Inter,system-ui,sans-serif;font-size:17px;font-weight:600;color:var(--o-ink);background:transparent;border:1px solid transparent;border-radius:10px;padding:7px 9px;text-overflow:ellipsis;-webkit-user-select:text;user-select:text}',
    '.odz-title:hover{border-color:var(--o-line2)}',
    '.odz-title:focus{outline:0;border-color:rgba(60,94,112,.5);box-shadow:0 0 0 3px rgba(60,94,112,.18);background:var(--o-surface)}',
    '.odz-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--o-line2);background:var(--o-surface);color:var(--o-ink);border-radius:10px;padding:9px 12px;font:600 13px/1 Inter,system-ui,sans-serif;cursor:pointer;white-space:nowrap}',
    '.odz-btn:hover{background:var(--o-deep)}',
    '.odz-btn.pri{background:var(--o-acc);border-color:var(--o-acc);color:#fff}',
    '.odz-btn.pri:hover{background:var(--o-acc-deep);border-color:var(--o-acc-deep)}',
    '.odz-btn.ico{width:34px;height:34px;padding:0;border-radius:999px;border-color:transparent;background:var(--o-deep);color:var(--o-soft);display:inline-flex;align-items:center;justify-content:center}',
    '.odz-btn.ico:hover{background:rgba(29,43,51,.1)}',
    '.odz-btn.sm{padding:7px 10px;font-size:12.5px}',
    '.odz-btn.sm.ico{width:30px;height:30px;padding:0}',
    '.odz-btn.on{background:var(--o-acc);border-color:var(--o-acc);color:#fff}',
    '.odz-btn.danger{color:#b4412f}',
    '.odz-btn[disabled]{opacity:.4;cursor:default}',
    '.odz-view{position:fixed;inset:0;z-index:2147483000;background:#fff;color:var(--o-ink);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:56px 20px calc(24px + env(safe-area-inset-bottom,0px))}',
    '.odz-view *{box-sizing:border-box}',
    '.odz-view-img{display:block;width:auto;height:auto;max-width:100%;max-height:calc(100vh - 170px);max-height:calc(100dvh - 170px);border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.16)}',
    '.odz-view-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}',
    '.odz-view-x{position:absolute;top:calc(14px + env(safe-area-inset-top,0px));right:16px}',
    '.odz-banner{padding:10px 14px;background:var(--o-deep);color:var(--o-soft);font-size:12.5px;line-height:1.45;border-bottom:1px solid var(--o-line);flex:none}',
    '.odz-modal-bg{position:absolute;inset:0;z-index:5;background:rgba(29,43,51,.4);display:flex;align-items:flex-end;justify-content:center}',
    '.odz-modal{width:100%;max-width:480px;max-height:90%;overflow-y:auto;background:var(--o-paper);border:1px solid var(--o-line);border-radius:16px 16px 0 0;padding:18px;padding-bottom:calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 30px rgba(0,0,0,.16);-webkit-user-select:auto;user-select:auto}',
    '.odz-modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}',
    '.odz-modal-head h3{margin:0;font-family:"DM Sans",Inter,system-ui,sans-serif;font-size:16px;font-weight:600}',
    '.odz-opt{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:left;border:1px solid var(--o-line2);background:var(--o-surface);border-radius:12px;padding:12px 14px;cursor:pointer;margin-top:8px;color:var(--o-ink);font:inherit}',
    '.odz-opt:hover{background:var(--o-deep)}',
    '.odz-opt.on{border-color:var(--o-acc);box-shadow:0 0 0 3px rgba(60,94,112,.14)}',
    '.odz-opt b{display:block;font-size:13.5px;font-weight:600}',
    '.odz-opt span{display:block;font-size:12.5px;color:var(--o-muted);margin-top:2px}',
    '.odz-dot{width:18px;height:18px;border-radius:50%;border:2px solid var(--o-line2);flex:none;margin-top:1px}',
    '.odz-opt.on .odz-dot{border-color:var(--o-acc);background:radial-gradient(var(--o-acc) 0 42%,transparent 46%)}',
    '.odz-mem-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:16px}',
    '.odz-mem-head b{font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--o-muted);font-weight:700}',
    '.odz-mem-head .odz-btn{padding:7px 10px;font-size:12.5px}',
    '.odz-mem-list{margin-top:8px;max-height:220px;overflow-y:auto;border:1px solid var(--o-line2);border-radius:12px;background:var(--o-surface)}',
    '.odz-mem{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;border-bottom:1px solid var(--o-line);background:transparent;padding:9px 12px;cursor:pointer;font:500 13.5px/1.25 Inter,system-ui,sans-serif;color:var(--o-ink)}',
    '.odz-mem:last-child{border-bottom:0}',
    '.odz-mem:hover{background:var(--o-deep)}',
    '.odz-mem i{width:18px;height:18px;border-radius:6px;border:2px solid var(--o-line2);flex:none;display:flex;align-items:center;justify-content:center;color:#fff}',
    '.odz-mem.on i{background:var(--o-acc);border-color:var(--o-acc)}',
    '.odz-mem span{margin-left:auto;color:var(--o-muted);font-size:12.5px;font-weight:400}',
    '.odz-link{flex:1;min-width:0;background:var(--o-surface);border:1px solid rgba(29,43,51,.2);border-radius:10px;padding:10px 12px;font:13px/1.2 Inter,system-ui,sans-serif;color:var(--o-ink)}',
    '@media (min-width:860px){.odz-modal-bg{align-items:center}.odz-modal{border-radius:16px}}',
    '.odz-main{flex:1;min-height:0;display:flex;flex-direction:column}',
    '.odz-stage{flex:0 0 42%;min-height:0;display:flex;align-items:center;justify-content:center;padding:16px;background:var(--o-deep);position:relative}',
    '.odz-stage.odz-busy canvas{opacity:.82;transition:opacity .15s}',
    '.odz-stage-note{position:absolute;left:0;right:0;bottom:8px;text-align:center;font-size:11.5px;color:var(--o-muted);pointer-events:none}',
    '.odz-stage canvas{max-width:100%;max-height:100%;width:auto;height:auto;border-radius:12px;box-shadow:0 6px 24px rgba(29,43,51,.14);background:#ddd}',
    '.odz-stage canvas.odz-drag{cursor:grab;touch-action:none}',
    '.odz-stage canvas.odz-dragging{cursor:grabbing}',
    '.odz-stage canvas{-webkit-user-select:none;user-select:none;-webkit-user-drag:none;-webkit-touch-callout:none}',
    '.odz-side{flex:1;min-height:0;display:flex;flex-direction:column;background:var(--o-surface);border-top:1px solid var(--o-line)}',
    '.odz-tabs{display:flex;gap:2px;padding:6px 10px 0;border-bottom:1px solid var(--o-line);flex:none;overflow-x:auto;scrollbar-width:none}',
    '.odz-tabs::-webkit-scrollbar{display:none}',
    '.odz-tabs button{flex:1;border:0;background:transparent;color:var(--o-muted);font:600 13px/1 Inter,system-ui,sans-serif;padding:12px 10px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap}',
    '.odz-tabs button.on{color:var(--o-acc);border-bottom-color:var(--o-acc)}',
    '.odz-panel{flex:1;min-height:0;overflow-y:auto;padding:20px 18px 28px;-webkit-overflow-scrolling:touch;-webkit-user-select:auto;user-select:auto}',
    '.odz-sec{margin:0 0 26px}',
    '.odz-sec>h3{margin:0 0 10px;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--o-muted);font-weight:700}',
    '.odz-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.odz-fmt{display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-width:132px;flex:1 1 132px;max-width:220px;padding:10px 14px;border:1px solid var(--o-line2);border-radius:12px;background:var(--o-surface);color:var(--o-ink);cursor:pointer;font:inherit;text-align:left}',
    '.odz-fmt b{font-size:13.5px;font-weight:600;line-height:1.2}',
    '.odz-fmt span{font-size:12px;color:var(--o-muted);line-height:1.2;font-variant-numeric:tabular-nums}',
    '.odz-fmt:hover{background:var(--o-deep)}',
    '.odz-fmt.on{background:var(--o-acc);border-color:var(--o-acc);color:#fff}',
    '.odz-fmt.on span{color:rgba(255,255,255,.78)}',
    '.odz-row+.odz-row{margin-top:12px}',
    '.odz-sw{width:32px;height:32px;border-radius:50%;border:1px solid var(--o-line);cursor:pointer;padding:0;flex:none}',
    '.odz-sw.on{border-color:var(--o-acc);box-shadow:0 0 0 2px var(--o-surface),0 0 0 4px var(--o-acc)}',
    '.odz-sw.sq{border-radius:10px;width:54px;height:42px}',
    '.odz input[type=color]{width:40px;height:34px;border:1px solid var(--o-line2);padding:2px;background:var(--o-surface);border-radius:10px;cursor:pointer}',
    '.odz input[type=range]{flex:1;min-width:120px;accent-color:var(--o-acc)}',
    '.odz-lbl{font-size:12.5px;color:var(--o-soft);font-weight:500;min-width:74px}',
    '.odz-item{border:0;border-radius:12px;padding:13px 14px;margin-bottom:10px;background:var(--o-paper)}',
    '.odz-item b{display:block;font-size:13px;font-weight:600;color:var(--o-soft);margin-bottom:4px}',
    '.odz-item textarea{width:100%;background:var(--o-surface);border:1px solid rgba(29,43,51,.2);color:var(--o-ink);border-radius:10px;padding:9px 11px;font:14px/1.45 Inter,system-ui,sans-serif;resize:vertical;min-height:84px;-webkit-user-select:text;user-select:text}',
    '.odz-item textarea:focus{outline:0;border-color:rgba(60,94,112,.5);box-shadow:0 0 0 3px rgba(60,94,112,.18)}',
    '.odz-item .acts{display:flex;gap:6px;margin-top:10px;justify-content:flex-end;flex-wrap:wrap}',
    '.odz-photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:8px}',
    '.odz-photos button{padding:0;border:2px solid transparent;border-radius:12px;overflow:hidden;cursor:pointer;aspect-ratio:1;background:var(--o-deep)}',
    '.odz-photos button.on{border-color:var(--o-acc)}',
    '.odz-photos img{width:100%;height:100%;object-fit:cover;display:block}',
    '.odz-modal{border-radius:28px 28px 0 0;border:0;box-shadow:0 -10px 40px rgba(29,43,51,.22)}',
    '@media (min-width:860px){.odz-modal{border-radius:28px;max-width:520px}}',
    '.odz-modal-head h3{font-family:ui-serif,\'New York\',\'Iowan Old Style\',Georgia,serif;font-size:24px;font-weight:400}',
    '.odz-opt{border:0!important;border-radius:20px!important;box-shadow:0 1px 2px rgba(29,43,51,.05),0 8px 22px rgba(29,43,51,.07)}',
    '.odz-btn{border-radius:999px}',
    '.odz-tabs{gap:6px}.odz-tabs button{border-radius:999px;font-weight:600}',
    '.odz-item,.odz-card,.odz-sec{border-radius:22px}',
    '.odz-stage canvas{border-radius:22px;box-shadow:0 10px 34px rgba(29,43,51,.2)}',
    '.odz-photos button{border-radius:16px}',
    '.odz-seg{border-radius:999px}',
    '.odz-title{font-family:ui-serif,\'New York\',\'Iowan Old Style\',Georgia,serif;font-weight:400}',
    '.odz-panel{padding-bottom:calc(24px + env(safe-area-inset-bottom,0px))}',
    '@media (max-width:640px){.odz-photos{grid-template-columns:repeat(4,1fr)}.odz-fonts{grid-template-columns:repeat(2,1fr)}.odz-modal{max-height:92%}}',
    '.odz-fonts{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}',
    '.odz-fonts button{min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid var(--o-line);background:var(--o-surface);color:var(--o-ink);border-radius:10px;padding:11px 8px;cursor:pointer;font-size:15px;line-height:1.2;letter-spacing:0;word-spacing:0}',
    '.odz-fonts button:hover{background:var(--o-deep)}',
    '.odz-fonts button.on{background:var(--o-acc);border-color:var(--o-acc);color:#fff}',
    '.odz-seg{display:inline-flex;border:1px solid var(--o-line2);border-radius:10px;overflow:hidden;background:var(--o-surface)}',
    '.odz-seg button{border:0;background:transparent;color:var(--o-ink);padding:9px 13px;cursor:pointer;font:600 13px/1 Inter,system-ui,sans-serif}',
    '.odz-seg button+button{border-left:1px solid var(--o-line2)}',
    '.odz-seg button.on{background:var(--o-acc);color:#fff}',
    '.odz-hint{font-size:12.5px;color:var(--o-muted);margin:10px 0 0;line-height:1.5}',
    '.odz-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;align-items:start}',
    '.odz-card{border:1px solid var(--o-line);border-radius:14px;overflow:hidden;background:var(--o-surface);color:var(--o-ink);display:flex;flex-direction:column}',
    '.odz-card .th{display:flex;align-items:center;justify-content:center;aspect-ratio:1/1;overflow:hidden;background:var(--o-deep) center/contain no-repeat;border:0;padding:0;cursor:pointer;width:100%;line-height:0}',
    '.odz-card .mt{padding:10px 12px 8px;font-size:13px;font-weight:600}',
    '.odz-card .mt small{display:block;font-weight:400;color:var(--o-muted);margin-top:2px}',
    '.odz-card .ac{display:flex;gap:6px;padding:0 12px 12px}',
    '.odz-gal-btn{border:1px solid var(--o-line2);background:var(--o-surface);color:var(--o-ink);border-radius:8px;padding:7px 10px;font:600 12px/1 Inter,system-ui,sans-serif;cursor:pointer}',
    '.odz-gal-btn:hover{background:var(--o-deep)}',
    '.odz-empty{font-size:14px;color:var(--o-muted);padding:6px 0}',
    '.odz-gal-top{display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap}',
    '.odz-gal-top button{display:inline-flex;align-items:center;gap:7px;border:0;background:var(--o-acc);color:#fff;border-radius:10px;padding:10px 14px;font:600 13px/1 Inter,system-ui,sans-serif;cursor:pointer}',
    '.odz-gal-top button:hover{background:var(--o-acc-deep)}',
    '.odz-btn.pri.ico{background:var(--o-acc);border-color:var(--o-acc);color:#fff}',
    '.odz-btn.pri.ico:hover{background:var(--o-acc-deep);border-color:var(--o-acc-deep)}',
    '.odz-btn.odz-narrow{display:none}',
    '@media (max-width:540px){.odz-head{flex-wrap:nowrap;gap:4px;padding-left:10px;padding-right:10px}.odz-title{flex:1 1 0;order:0;font-size:16px;text-overflow:ellipsis;white-space:nowrap}.odz-btn.odz-wide{display:none}.odz-btn.odz-narrow{display:inline-flex}.odz-head>.odz-btn{padding-left:9px;padding-right:9px}.odz-head>.odz-btn.ico{width:36px;height:36px}}',
    '@media (max-width:860px){.odz input[type=text],.odz input[type=search],.odz textarea,.odz-view input{font-size:16px}}',
    '@media (pointer:coarse){.odz-btn.ico{width:40px;height:40px}.odz-btn.sm.ico{width:38px;height:38px}.odz-btn.sm{padding:9px 12px}.odz-sw{width:36px;height:36px}.odz-mem{padding:12px}.odz-tabs button{padding:14px 12px}}',
    '@media (min-width:860px){.odz-main{flex-direction:row}.odz-stage{flex:1 1 auto;padding:32px}.odz-side{flex:0 0 400px;border-top:0;border-left:1px solid var(--o-line)}}'
  ].join('\n');
  var cssDone = false;
  function ensureCss() {
    if (cssDone) return; cssDone = true;
    document.head.appendChild(el('style', { 'data-odz': '', text: CSS }));
  }

  /* ───────── toast + zwevende knop ───────── */
  var toastTimer;
  function toast(msg, action) {
    ensureCss();
    var old = document.querySelector('.odz-toast'); if (old) old.remove();
    var n = el('div', { class: 'odz-toast', role: 'status' }, [el('span', { text: msg })]);
    if (action) n.appendChild(el('button', { type: 'button', text: action.label, onclick: function () { n.remove(); action.run(); } }));
    document.body.appendChild(n);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { n.remove(); }, action ? 4000 : 2500);
  }
  function updatePill() { /* de zwevende knop is vervangen door de toast met actie en de Ontwerpen-tab */ }

  function dataUrlToBlob(u) {
    var parts = u.split(','), bin = atob(parts[1]), n = bin.length, arr = new Uint8Array(n);
    for (var k = 0; k < n; k++) arr[k] = bin.charCodeAt(k);
    return new Blob([arr], { type: 'image/jpeg' });
  }
  /* ───────── studio ───────── */
  var studioOpen = false, root = null, studioResize = null;

  function openStudio(opts) {
    if (studioOpen) return;
    ensureCss();
    opts = opts || {};
    studioOpen = true; updatePill();

    var items = verifyItems(opts.items ? opts.items.slice() : getBasket());
    var st = normStyle(opts.style || lsGet(LS_STYLE, null));
    var cur = { id: opts.id || null, created: opts.created || null, title: opts.titleCustom ? (opts.title || null) : null, shareId: opts.shareId || null, shareMode: opts.shareMode || (opts.id ? 'off' : 'view'), editUsers: Array.isArray(opts.editUsers) ? opts.editUsers : null, sharedEdit: !!opts.sharedEdit };
    // verder met een bewaard ontwerp waar je verzen aan toevoegt (zie "Meer verzen toevoegen")
    var resumed = false, resume = opts.fromBasket ? sGet(LS_RESUME, null) : null;
    if (resume && resume.id && localDesigns().some(function (x) { return x.id === resume.id; })) {
      cur = { id: resume.id, created: resume.created || null, title: resume.title || null, shareId: resume.shareId || null, shareMode: resume.shareMode || 'off', editUsers: Array.isArray(resume.editUsers) ? resume.editUsers : null, sharedEdit: false };
      resumed = true;
    }
    if (opts.fromBasket && sGet(LS_RESUME, null)) sDel(LS_RESUME);
    var tab = opts.tab || 'verses';
    var bgImg = null;

    var canvas = el('canvas');
    var panel = el('div', { class: 'odz-panel' });
    var tabsBar = el('div', { class: 'odz-tabs' });
    var title = el('input', { type: 'text', class: 'odz-title', maxlength: '60', 'aria-label': t('Naam van het ontwerp', 'Design name'),
      oninput: function (e) { cur.title = e.target.value.trim() || null; persistSoon(); },
      onblur: function () { title.value = cur.title || designTitle(items); } });
    function showTitle() { if (document.activeElement !== title) title.value = cur.title || designTitle(items); }
    var note = el('div', { class: 'odz-stage-note' });
    var stage = el('div', { class: 'odz-stage' }, [canvas, note]);

    // Foto verschuiven in het voorbeeld: sleep om te kiezen welk deel van de foto zichtbaar is.
    // Alleen bij een foto-achtergrond, en alleen langs de as waar de foto over het vak uitsteekt.
    // Schermpixels: hoeveel de foto over het vak heen kan bewegen, per as (0 = niets te schuiven).
    function photoOverflow() {
      if (!(st.bg.type === 'photo' || st.bg.type === 'custom') || !bgImg || !canvas.width || !canvas.height) return null;
      var g = coverGeom(canvas.width, canvas.height, bgImg, st.bg), k = canvas.getBoundingClientRect().width / canvas.width;
      return { x: Math.max(0, (g.dw - canvas.width) * k), y: Math.max(0, (g.dh - canvas.height) * k) };
    }
    // Maat van de foto op het scherm (CSS-pixels) bij een zoomstand: zelfde rekening als coverGeom
    function fitCss(zoom, r) {
      var k = r.width / canvas.width;
      var s = Math.max(canvas.width / bgImg.naturalWidth, canvas.height / bgImg.naturalHeight) * zoom;
      return { w: bgImg.naturalWidth * s * k, h: bgImg.naturalHeight * s * k };
    }
    function atDefaultPos() { var p = bgPos(st.bg); return p.x === 0.5 && p.y === 0.5 && bgZoom(st.bg) === 1; }
    var drag = null;
    canvas.addEventListener('pointerdown', function (e) {
      var o = photoOverflow();
      if (!o || e.button > 0) return;
      var p = bgPos(st.bg);
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, px: p.x, py: p.y, ox: o.x, oy: o.y, moved: false, wasDefault: atDefaultPos() };
      // Geen tekst- of sleepselectie van de pagina eronder: die kan het volgen van de muis stilleggen (pointercancel)
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      canvas.classList.add('odz-dragging');
    });
    // Nieuwe beginpunt na elke zoomstap, zodat de verschuiving daarna weer precies de vingerbeweging volgt
    function rebaseDrag(e) {
      var p = bgPos(st.bg);
      drag.x = e.clientX; drag.y = e.clientY; drag.px = p.x; drag.py = p.y;
    }
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var o = photoOverflow(); if (!o) return;
      var r = canvas.getBoundingClientRect(), BW = r.width, BH = r.height;
      // vorige vingerpositie: bij zoomen rond die plek blijft het beeld onder de vinger staan, daarna volgt de stap 1 op 1
      var lx = drag.lx, ly = drag.ly; drag.lx = e.clientX; drag.ly = e.clientY;
      // Sleep je in een richting waar de foto niet uitsteekt, dan zoomt hij mee tot de uitsteek de sleepafstand
      // (plus een kleine marge) is. Zo volgt de foto de vinger in alle vier de richtingen. Afstand = vanaf het begin.
      var needX = Math.abs(e.clientX - drag.sx), needY = Math.abs(e.clientY - drag.sy);
      // De uitsteek is 2x de sleepafstand + een marge: vanuit het midden kan de foto dan de hele sleep volgen zonder
      // tegen de rand te lopen. Het zoomen gebeurt in kleine stappen, dus geen sprong.
      var MARGE = 0.25, z0 = bgZoom(st.bg), d0 = fitCss(z0, r), zT = z0;
      if (d0.w - BW < 2 * needX) zT = Math.max(zT, (BW + 2 * needX + MARGE * BW) * z0 / d0.w);
      if (d0.h - BH < 2 * needY) zT = Math.max(zT, (BH + 2 * needY + MARGE * BH) * z0 / d0.h);
      zT = Math.min(3, zT);
      if (zT > z0 + 1e-6) {
        var p0 = bgPos(st.bg), d1 = fitCss(zT, r), f = zT / z0;
        var fx = lx - r.left, fy = ly - r.top;
        // linkerrand en bovenrand van de foto nu; bij zoomen blijft het beeld onder de vinger staan
        var left0 = (BW - d0.w) * p0.x, top0 = (BH - d0.h) * p0.y;
        var left1 = fx - (fx - left0) * f, top1 = fy - (fy - top0) * f;
        st.bg.zoom = zT;
        st.bg.posX = d1.w > BW ? clamp01(-left1 / (d1.w - BW)) : 0.5;
        st.bg.posY = d1.h > BH ? clamp01(-top1 / (d1.h - BH)) : 0.5;
        // vanaf hier de gewone stap: de nieuwe positie is het beginpunt, de uitsteek is nu groot genoeg
        drag.x = lx; drag.y = ly; drag.px = clamp01(st.bg.posX); drag.py = clamp01(st.bg.posY); drag.moved = true;
        o = photoOverflow(); if (!o) return;
        redraw(); // ook als de stap hieronder niets verschuift
      }
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      // naar rechts slepen toont meer van de linkerkant van de foto, dus de positie gaat omlaag
      var nx = o.x >= 1 ? clamp01(drag.px - dx / o.x) : drag.px;
      var ny = o.y >= 1 ? clamp01(drag.py - dy / o.y) : drag.py;
      var cur0 = bgPos(st.bg);
      if (nx === cur0.x && ny === cur0.y) return;
      st.bg.posX = nx; st.bg.posY = ny; drag.moved = true;
      redraw();
    });
    function endDrag() {
      if (!drag) return;
      var d = drag; drag = null;
      canvas.classList.remove('odz-dragging');
      if (!d.moved) return;
      showTitle();
      persist(); // direct opslaan, niet wachten op de debounce; spoelt ook het mandje
      if (d.wasDefault !== atDefaultPos()) render(); // de knop "Positie herstellen" verschijnt of verdwijnt
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    // Een nieuw ontwerp leeft in het mandje ("Toevoegen aan ontwerp"). Zodra het is bewaard
    // is het een eigen ontwerp: het mandje is dan leeg en wijzigingen worden automatisch
    // in het bewaarde ontwerp opgeslagen.
    var autoTimer = null;
    function autoNow() {
      if (!autoTimer) return;
      clearTimeout(autoTimer); autoTimer = null;
      if (cur.id && !cur.sharedEdit && items.length) save(true);
    }
    studioFlush = autoNow;
    // Een bewaard, gedeeld ontwerp met een ouder voorbeeld (van vóór het nieuwe logo) krijgt bij openen vanzelf een nieuw voorbeeld;
    // daarmee wordt ook het bericht in de Gemeenschap bijgewerkt (syncCommunityPost in save).
    setTimeout(function () {
      if (cur.id && cur.shareId && !cur.sharedEdit && opts.previewV !== 2 && items.length) syncImg(function () { save(true); });
    }, 1200);
    studioTitle = function () { showTitle(); };
    function persist() {
      lsSet(LS_STYLE, st);
      pushStyleSoon(st);
      if (!cur.id) { setBasket(items); return; }
      if (cur.sharedEdit) return;
      clearTimeout(autoTimer);
      autoTimer = setTimeout(autoNow, 1500);
    }
    var persistSoon = debounce(persist, 250);
    if (resumed) { setBasket([]); autoTimer = setTimeout(autoNow, 400); } // de toegevoegde verzen meteen in het ontwerp bewaren
    var pending = false;
    function redraw() {
      if (pending) return; pending = true;
      requestAnimationFrame(function () {
        pending = false;
        var F = FORMATS[st.fmt] || FORMATS.sq;
        var k = Math.min(1, 1100 / Math.max(F.w, F.h));
        var bw = Math.round(F.w * k), bh = Math.round(F.h * k);
        // het vak waarin de afbeelding getoond wordt: tekenen op die grootte (x schermdichtheid),
        // anders rekt de browser een kleine afbeelding uit en wordt hij wazig op een groot scherm
        var pad = (window.innerWidth >= 860 ? 64 : 32);
        var box = { w: Math.max(0, (stage.clientWidth || 0) - pad), h: Math.max(0, (stage.clientHeight || 0) - pad) };
        var fit = box.w && box.h ? previewFit(box, F.w, F.h, bw, bh, st, bgImg) : { css: 0, zoom: 1, capped: false };
        draw(canvas, bw, bh, st, items, bgImg, fit.zoom);
        // het voorbeeld niet groter tonen dan de foto scherp kan zijn
        if (fit.css > 0) { canvas.style.width = Math.round(fit.css) + 'px'; canvas.style.height = 'auto'; }
        else { canvas.style.width = ''; canvas.style.height = ''; }
        note.textContent = fit.capped ? t('Voorbeeld op 100% scherpte', 'Preview at 100% sharpness') : '';
        // bij een foto altijd grijpen en slepen aanbieden (ook zonder uitsteek: dan zoomt de foto mee met het slepen),
        // anders scrolt de telefoon de pagina bij een veeg omhoog of omlaag
        if (photoOverflow()) canvas.classList.add('odz-drag'); else canvas.classList.remove('odz-drag');
      });
    }
    studioResize = debounce(function () { if (root && root.isConnected) redraw(); }, 200);
    window.addEventListener('resize', studioResize);
    var syncSeq = 0;
    function syncImg(cb) {
      var src = bgSource(st), seq = ++syncSeq;
      if (!src) { bgImg = null; cb && cb(); return; }
      var hit = imgCache[src];
      if (hit && hit.complete && hit.naturalWidth) { cacheImg(src, hit); bgImg = hit; cb && cb(); return; }
      // Geen vaag tussenstapje: het vorige beeld blijft staan tot de scherpe foto klaar is
      // (en bij de allereerste foto is er eerst alleen de achtergrondkleur). De gewone, kleinere
      // foto wordt alleen gebruikt als de scherpe ontbreekt.
      stage.classList.add('odz-busy');
      loadImg(src, function (im) {
        if (seq !== syncSeq) return;
        stage.classList.remove('odz-busy');
        if (!im && st.bg.type === 'photo') { loadImg(photoUrlSd(st.bg.photo || 1), function (sd) { if (seq === syncSeq) { bgImg = sd; cb && cb(); } }); return; }
        bgImg = im; cb && cb();
      });
    }
    function changed(full) {
      showTitle();
      persistSoon();
      if (full) syncImg(redraw); else redraw();
    }

    /* — kleine bouwstenen — */
    function sec(name, kids) { return el('div', { class: 'odz-sec' }, [el('h3', { text: name })].concat(kids)); }
    function swatches(list, val, on) {
      return list.map(function (c) {
        return el('button', { type: 'button', class: 'odz-sw' + (c.toLowerCase() === String(val).toLowerCase() ? ' on' : ''), style: 'background:' + c, 'aria-label': c, onclick: function () { on(c); } });
      });
    }
    function colorRow(label, key, list, after) {
      var inp = el('input', { type: 'color', value: st[key], 'aria-label': label, oninput: function (e) { st[key] = e.target.value; changed(); } });
      var wrapEl = el('div', { class: 'odz-row' }, swatches(list, st[key], function (c) { st[key] = c; changed(); render(); }).concat([inp]));
      return sec(label, [wrapEl]);
    }
    function slider(label, min, max, step, get, set, fmt) {
      var out = el('span', { class: 'odz-lbl', style: 'min-width:44px;text-align:right', text: fmt ? fmt(get()) : String(get()) });
      var inp = el('input', { type: 'range', min: min, max: max, step: step, value: get(), 'aria-label': label, oninput: function (e) {
        var v = parseFloat(e.target.value); set(v);
        var shown = get(); // de waarde zoals die echt wordt gebruikt (bijvoorbeeld 16 i.p.v. 5)
        out.textContent = fmt ? fmt(shown) : String(shown);
        if (shown !== v) e.target.value = shown;
        changed();
      } });
      return el('div', { class: 'odz-row' }, [el('span', { class: 'odz-lbl', text: label }), inp, out]);
    }
    function seg(opts2, val, on) {
      return el('div', { class: 'odz-seg' }, opts2.map(function (o) {
        return el('button', { type: 'button', class: o[0] === val ? 'on' : '', text: o[1], onclick: function () { on(o[0]); render(); } });
      }));
    }
    function toggle(label, key) {
      return el('button', { type: 'button', class: 'odz-btn sm' + (st[key] ? ' on' : ''), 'aria-pressed': st[key] ? 'true' : 'false', text: label, onclick: function () {
        st[key] = !st[key]; changed(); render();
      } });
    }

    /* — tabbladen — */
    function tabVerses() {
      var d = el('div');
      if (!items.length) {
        d.appendChild(el('p', { class: 'odz-hint', text: t('Nog geen verzen. Sluit de studio, tik op een vers en kies “Toevoegen aan ontwerp”. Doe dit zo vaak je wilt.', 'No verses yet. Close the studio, tap a verse and choose “Add to design”. Repeat as often as you like.') }));
      }
      items.forEach(function (it, i) {
        var box = el('div', { class: 'odz-item' }, [el('b', { text: it.label })]);
        box.appendChild(el('div', { style: 'font-size:13px;color:var(--o-soft);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden', text: it.text }));
        box.appendChild(el('div', { class: 'acts' }, [
          el('button', { type: 'button', class: 'odz-btn sm ico', 'aria-label': t('Omhoog', 'Up'), disabled: i === 0 ? '' : null, icon: 'up', iconSize: 16, onclick: function () { if (i) { var x = items[i]; items[i] = items[i - 1]; items[i - 1] = x; changed(); render(); } } }),
          el('button', { type: 'button', class: 'odz-btn sm ico', 'aria-label': t('Omlaag', 'Down'), icon: 'down', iconSize: 16, onclick: function () { if (i < items.length - 1) { var x = items[i]; items[i] = items[i + 1]; items[i + 1] = x; changed(); render(); } } }),
          el('button', { type: 'button', class: 'odz-btn sm ico danger', 'aria-label': t('Verwijderen', 'Remove'), icon: 'x', iconSize: 16, onclick: function () { items.splice(i, 1); changed(); render(); } })
        ]));
        d.appendChild(box);
      });
      if (items.length > 1 && mergeItems(items).length < items.length) {
        d.appendChild(el('p', { class: 'odz-hint', text: t('Opeenvolgende verzen worden in het ontwerp samengevoegd tot één verwijzing, bijvoorbeeld Spreuken 4:1-3.', 'Consecutive verses are merged into one reference in the design, for example Proverbs 4:1-3.') }));
      }
      d.appendChild(el('div', { class: 'odz-row', style: 'margin-top:10px' }, [
        el('button', { type: 'button', class: 'odz-btn', icon: 'plus', iconSize: 16, text: t('Meer verzen toevoegen', 'Add more verses'), onclick: function () {
          if (cur.id && !cur.sharedEdit && items.length) {
            // bewaard ontwerp: de verzen gaan naar het mandje en het ontwerp wordt onthouden, zodat
            // je er daarna gewoon mee verder gaat (zelfde ontwerp, niet een nieuw)
            autoNow(); save(true);
            setBasket(items.map(function (x) { return { code: x.code, bookName: x.bookName, chapter: x.chapter, verseStart: x.verseStart, verseEnd: x.verseEnd, version: x.version, label: x.label, text: x.text }; }));
            sSet(LS_RESUME, { id: cur.id, created: cur.created, title: cur.title, shareId: cur.shareId, shareMode: cur.shareMode, editUsers: cur.editUsers });
          }
          closeStudio(); toast(t('Tik op een vers en kies “Toevoegen aan ontwerp”.', 'Tap a verse and choose “Add to design”.'));
        } }),
        items.length ? el('button', { type: 'button', class: 'odz-btn danger', text: t('Alles wissen', 'Clear all'), onclick: function () {
          autoNow();
          items.length = 0; cur = { id: null, created: null, title: null, shareId: null, shareMode: 'off', editUsers: null, sharedEdit: false }; changed(); render();
        } }) : null
      ]));
      return d;
    }

    function tabText() {
      var d = el('div');
      d.appendChild(sec(t('Lettertype', 'Font'), [el('div', { class: 'odz-fonts' }, Object.keys(FONTS).map(function (k) {
        return el('button', { type: 'button', class: k === st.font ? 'on' : '', style: 'font-family:' + FONTS[k].css + (k === 'dyslexic' ? ';font-size:13px' : ''), title: FONTS[k].label, text: fontName(k), onclick: function () {
          st.font = k; loadFonts(redraw); changed(); render();
        } });
      }))]));
      d.appendChild(sec(t('Stijl', 'Style'), [el('div', { class: 'odz-row' }, [
        toggle(t('Vet', 'Bold'), 'bold'), toggle(t('Cursief', 'Italic'), 'italic'), toggle('ABC', 'upper'), toggle(t('Schaduw', 'Shadow'), 'shadow'), toggle('“ ”', 'quote')
      ])]));
      d.appendChild(sec(t('Grootte & regelafstand', 'Size & spacing'), [
        slider(t('Grootte', 'Size'), 0, 150, 1, function () { return st.size; }, function (v) { st.size = (v > 0 && v < 16) ? 16 : v; }, function (v) { return v === 0 ? 'auto' : v; }),
        slider(t('Regelafstand', 'Line height'), 1, 2, 0.05, function () { return st.lh; }, function (v) { st.lh = v; }),
        slider(t('Ruimte tussen verzen', 'Space between verses'), 0.2, 2.5, 0.05, function () { return st.gap == null ? 0.95 : st.gap; }, function (v) { st.gap = v; }),
        el('p', { class: 'odz-hint', text: t('Op “auto” past de tekst zichzelf aan zodat alles in beeld past. Met een eigen grootte blijven de letters precies zo groot; past het niet, dan wordt de afbeelding hoger.', 'On “auto” the text sizes itself so everything fits. With your own size the letters stay exactly that big; if it does not fit, the image gets taller.') })
      ]));
      d.appendChild(colorRow(t('Letterkleur', 'Text colour'), 'color', SOLIDS, true));
      d.appendChild(colorRow(t('Kleur van de verwijzing', 'Reference colour'), 'refColor', SOLIDS, true));
      d.appendChild(sec(t('Uitlijning', 'Alignment'), [
        el('div', { class: 'odz-row' }, [seg([['left', t('Links', 'Left')], ['center', t('Midden', 'Centre')], ['right', t('Rechts', 'Right')]], st.align, function (v) { st.align = v; changed(); })]),
        el('div', { class: 'odz-row' }, [seg([['top', t('Boven', 'Top')], ['middle', t('Midden', 'Middle')], ['bottom', t('Onder', 'Bottom')]], st.valign, function (v) { st.valign = v; changed(); })])
      ]));
      d.appendChild(sec(t('Verwijzing', 'Reference'), [el('div', { class: 'odz-row' }, [toggle(t('Toon verwijzing', 'Show reference'), 'showRef'), toggle(t('Toon vertaling', 'Show translation'), 'showVer')])]));
      return d;
    }

    function tabBg() {
      var d = el('div'), bg = st.bg;
      d.appendChild(sec(t('Soort achtergrond', 'Background type'), [el('div', { class: 'odz-row' }, [seg([
        ['color', t('Kleur', 'Colour')], ['gradient', t('Verloop', 'Gradient')], ['photo', t('Foto', 'Photo')], ['custom', t('Eigen foto', 'Own photo')]
      ], bg.type, function (v) { bg.type = v; changed(true); })])]));
      if (bg.type === 'photo' || bg.type === 'custom') {
        var posRows = [el('p', { class: 'odz-hint', text: t('Sleep de foto in het voorbeeld om te kiezen welk deel zichtbaar is.', 'Drag the photo in the preview to choose which part is visible.') }),
          el('div', { class: 'odz-row' }, [el('button', { type: 'button', class: 'odz-btn sm', text: t('Positie herstellen', 'Reset position'), onclick: function () { bg.posX = 0.5; bg.posY = 0.5; bg.zoom = 1; changed(true); render(); } })])];
        d.appendChild(sec(t('Positie', 'Position'), posRows));
      }
      if (bg.type === 'color') {
        var ci = el('input', { type: 'color', value: bg.c1, oninput: function (e) { bg.c1 = e.target.value; changed(); } });
        d.appendChild(sec(t('Kleur', 'Colour'), [el('div', { class: 'odz-row' }, swatches(SOLIDS, bg.c1, function (c) { bg.c1 = c; changed(); render(); }).concat([ci]))]));
      }
      if (bg.type === 'gradient') {
        d.appendChild(sec(t('Voorbeelden', 'Presets'), [el('div', { class: 'odz-row' }, GRADIENTS.map(function (g) {
          var on = g[0] === bg.c1 && g[1] === bg.c2 && g[2] === bg.angle;
          return el('button', { type: 'button', class: 'odz-sw sq' + (on ? ' on' : ''), style: 'background:linear-gradient(' + g[2] + 'deg,' + g[0] + ',' + g[1] + ')', 'aria-label': g[0] + ' ' + g[1], onclick: function () {
            bg.c1 = g[0]; bg.c2 = g[1]; bg.angle = g[2]; changed(); render();
          } });
        }))]));
        d.appendChild(sec(t('Eigen verloop', 'Custom gradient'), [
          el('div', { class: 'odz-row' }, [
            el('input', { type: 'color', value: bg.c1, oninput: function (e) { bg.c1 = e.target.value; changed(); } }),
            el('input', { type: 'color', value: bg.c2, oninput: function (e) { bg.c2 = e.target.value; changed(); } })
          ]),
          slider(t('Hoek', 'Angle'), 0, 360, 5, function () { return bg.angle; }, function (v) { bg.angle = v; }, function (v) { return v + '°'; })
        ]));
      }
      if (bg.type === 'photo') {
        var grid = el('div', { class: 'odz-photos' });
        for (var n = 1; n <= PHOTOS; n++) if (n !== 9) (function (n) { // 9 = kraan met maan: uit het assortiment (besluit 2026-10-16)
          var warm = function () { prefetchImg(photoUrl(n)); };
          grid.appendChild(el('button', { type: 'button', class: n === bg.photo ? 'on' : '', 'aria-label': t('Foto ', 'Photo ') + n,
            onpointerenter: warm, onfocus: warm, ontouchstart: warm, onclick: function () {
            // alleen de markering verplaatsen; het raster niet opnieuw opbouwen (dat gaf haperen en flikkeren)
            var wasMoved = !atDefaultPos();
            bg.photo = n; bg.posX = 0.5; bg.posY = 0.5; bg.zoom = 1; // een nieuwe foto begint weer gecentreerd
            Array.prototype.forEach.call(grid.children, function (b, i) { b.className = (i + 1 === n) ? 'on' : ''; });
            changed(true);
            if (wasMoved) render(); // "Positie herstellen" verdwijnt
          } },
            el('img', { src: photoThumb(n), decoding: 'async', alt: '', width: 74, height: 74, onerror: function (e) { var im = e.target; if (!im.__full) { im.__full = 1; im.src = photoUrl(n); } } })));
        })(n);
        d.appendChild(sec(t('Kies een foto', 'Pick a photo'), [grid]));
      }
      if (bg.type === 'custom') {
        var file = el('input', { type: 'file', accept: 'image/*', style: 'display:none', onchange: function (e) {
          var f = e.target.files && e.target.files[0]; if (!f) return;
          var rd = new FileReader();
          rd.onload = function () {
            var im = new Image();
            im.onload = function () {
              var k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
              var c = document.createElement('canvas');
              c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
              c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
              bg.custom = c.toDataURL('image/jpeg', 0.82); bg.type = 'custom'; bg.posX = 0.5; bg.posY = 0.5; bg.zoom = 1;
              changed(true); render();
            };
            im.onerror = function () { toast(t('Deze afbeelding kon niet worden geopend.', 'This image could not be opened.')); };
            im.src = rd.result;
          };
          rd.readAsDataURL(f);
        } });
        d.appendChild(sec(t('Eigen foto', 'Your own photo'), [
          el('div', { class: 'odz-row' }, [
            el('button', { type: 'button', class: 'odz-btn pri', text: bg.custom ? t('Andere foto kiezen', 'Choose another photo') : t('Foto uit je galerij kiezen', 'Choose a photo'), onclick: function () { file.click(); } }),
            file
          ]),
          el('p', { class: 'odz-hint', text: t('Je foto blijft op je apparaat en in je opgeslagen ontwerp; er wordt niets openbaar gemaakt.', 'Your photo stays on your device and in your saved design; nothing is made public.') })
        ]));
      }
      if (bg.type === 'photo' || bg.type === 'custom') {
        d.appendChild(sec(t('Fotolaag', 'Photo layer'), [
          slider(t('Verdonkeren', 'Dim'), 0, 90, 1, function () { return st.dim; }, function (v) { st.dim = v; }, function (v) { return v + '%'; }),
          slider(t('Vervagen', 'Blur'), 0, 100, 1, function () { return st.blur; }, function (v) { st.blur = v; }),
          el('div', { class: 'odz-row' }, [el('span', { class: 'odz-lbl', text: t('Laagkleur', 'Layer colour') }),
            el('button', { type: 'button', class: 'odz-btn sm' + (st.overlay === '#000000' ? ' on' : ''), text: t('Donker', 'Dark'), onclick: function () { st.overlay = '#000000'; changed(); render(); } }),
            el('button', { type: 'button', class: 'odz-btn sm' + (st.overlay === '#ffffff' ? ' on' : ''), text: t('Licht', 'Light'), onclick: function () { st.overlay = '#ffffff'; changed(); render(); } })
          ])
        ]));
      }
      return d;
    }

    function tabLayout() {
      var d = el('div');
      d.appendChild(sec(t('Formaat', 'Format'), [el('div', { class: 'odz-row' }, Object.keys(FORMATS).map(function (k) {
        var F = FORMATS[k];
        return el('button', { type: 'button', class: 'odz-fmt' + (k === st.fmt ? ' on' : ''), 'aria-pressed': k === st.fmt ? 'true' : 'false', onclick: function () { st.fmt = k; changed(); render(); } }, [el('b', { text: isEn() ? F.en : F.nl }), el('span', { text: F.w + '\u00d7' + F.h })]);
      }))]));
      if (st.bg.type === 'photo' || st.bg.type === 'custom') {
        var F0 = FORMATS[st.fmt] || FORMATS.sq, sz = sharpSize(F0.w, F0.h, st, bgImg);
        d.appendChild(el('p', { class: 'odz-hint', style: 'margin:-14px 0 24px',
          text: (sz.w === F0.w && sz.h === F0.h)
            ? t('Uitvoer: ' + sz.w + '×' + sz.h + ' px, volledig scherp.', 'Output: ' + sz.w + '×' + sz.h + ' px, fully sharp.')
            : t('Uitvoer: ' + sz.w + '×' + sz.h + ' px. Zo groot kan deze foto scherp zijn; er wordt niets vergroot.', 'Output: ' + sz.w + '×' + sz.h + ' px. That is as large as this photo can be sharp; nothing is enlarged.') }));
      }
      d.appendChild(sec(t('Marge & rand', 'Margin & border'), [
        slider(t('Marge', 'Margin'), 4, 22, 1, function () { return st.pad; }, function (v) { st.pad = v; }, function (v) { return v + '%'; }),
        el('div', { class: 'odz-row' }, [toggle(t('Sierrand', 'Border'), 'frame'), toggle(t('Naam van de site', 'Site name'), 'logo')])
      ]));
      return d;
    }

    function tabSaved() {
      var d = el('div');
      mountGallery(d, { onOpenDesign: function (ds) {
        autoNow(); // eerst afmaken wat nog niet is bewaard van het ontwerp dat nu open staat
        items.length = 0; verifyItems(ds.items || []).forEach(function (x) { items.push(x); });
        st = normStyle(ds.style); cur = { id: ds.id, created: ds.created, title: ds.titleCustom ? ds.title : null, shareId: ds.shareId || null, shareMode: ds.shareMode || 'off', editUsers: Array.isArray(ds.editUsers) ? ds.editUsers : null, sharedEdit: false };
        tab = 'verses'; changed(true); render();
      }, compact: true });
      return d;
    }

    var TABS = [['verses', t('Verzen', 'Verses'), tabVerses], ['text', t('Tekst', 'Text'), tabText], ['bg', t('Achtergrond', 'Background'), tabBg], ['layout', t('Opmaak', 'Layout'), tabLayout], ['saved', t('Bewaard', 'Saved'), tabSaved]];
    // Alles terugzetten: formaat, lettertype, grootte, afstand, kleuren, achtergrond, marge en rand.
    // Je verzen en de naam van je ontwerp blijven staan.
    function resetAll() {
      st = cloneStyle(DEFAULT_STYLE);
      lsSet(LS_STYLE, st); pushStyleSoon(st);
      changed(true); render();
      toast(t('Teruggezet: formaat, lettertype, grootte, regelafstand, kleuren, achtergrond, marge en rand. Je verzen en naam blijven.',
        'Reset: format, font, size, line spacing, colours, background, margin and border. Your verses and name stay.'));
    }
    function render() {
      var top = panel.scrollTop;
      tabsBar.innerHTML = '';
      TABS.forEach(function (T) {
        tabsBar.appendChild(el('button', { type: 'button', class: T[0] === tab ? 'on' : '', text: T[1], onclick: function () { tab = T[0]; render(); panel.scrollTop = 0; } }));
      });
      panel.innerHTML = '';
      var cont = null;
      TABS.forEach(function (T) { if (T[0] === tab) cont = T[2](); });
      panel.appendChild(cont);
      panel.scrollTop = top;
    }

    /* — acties — */
    function exportBlob(cb) {
      var F = FORMATS[st.fmt] || FORMATS.sq, c = document.createElement('canvas'), src = bgSource(st);
      function go(img) {
        draw(c, F.w, F.h, st, items, img);
        c.toBlob(function (b) { cb(b); }, 'image/png');
      }
      if (src) loadImg(src, function (im) { go(im || bgImg); }); else go(null);
    }
    function fileName() {
      return slugify(cur.title || designTitle(items)) || t('bijbelvers', 'bible-verse');
    }
    function needItems() {
      if (items.length) return false;
      toast(t('Voeg eerst een vers toe.', 'Add a verse first.')); return true;
    }
    function download() {
      if (needItems()) return;
      exportBlob(function (b) {
        var a = el('a', { href: URL.createObjectURL(b), download: fileName() + '.png' });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      });
    }
    function openShare() {
      if (needItems()) return;
      var busy = false, status = '';
      var bg = el('div', { class: 'odz-modal-bg', onclick: function (e) { if (e.target === bg) bg.remove(); } });
      var box = el('div', { class: 'odz-modal', role: 'dialog', 'aria-modal': 'true' });
      bg.appendChild(box); root.appendChild(bg);
      var MODES = [
        ['off', t('Alleen ik', 'Only me'), t('Niemand anders heeft toegang.', 'No one else has access.')],
        ['view', t('Iedereen met de link kan bekijken', 'Anyone with the link can view'), t('Ze kunnen er een eigen kopie van maken.', 'They can make their own copy.')],
        ['edit_members', t('Ingelogde leden kunnen bewerken', 'Logged-in members can edit'), t('Anderen met de link kunnen alleen bekijken.', 'Everyone else with the link can only view.')],
        ['edit_link', t('Iedereen met de link kan bewerken', 'Anyone with the link can edit'), t('Zonder in te loggen. Wijzigingen zijn direct voor iedereen zichtbaar.', 'No login needed. Changes show for everyone right away.')]
      ];
      // bestaande leden van de site: wie mag bewerken (leeg = alle leden)
      var members = null, memberQ = '', uTimer = null, canMembers = null; var shareUser = undefined;
      getUser().then(function (u) {
        canMembers = !!u; shareUser = u || null;
        var c = sb();
        if (!u || !c) { if (bg.isConnected) paint(); return; }
        return Promise.resolve(c.from('bible_profiles').select('user_id,username,display_name').order('username', { ascending: true }).limit(1000))
          .then(function (r) {
            members = ((r && r.data) || []).filter(function (m) { return m.user_id && m.user_id !== u.id; })
              .map(function (m) { return { user_id: m.user_id, handle: plainName(m.username) || '', name: plainName(m.display_name) || plainName(m.username) || t('Lid', 'Member'), avatar: null }; });
            var ids = members.map(function (x) { return x.user_id; });
            if (!ids.length) { if (bg.isConnected) paint(); return; }
            return Promise.resolve(c.from('bible_forum_profile').select('user_id, avatar_url, display_name').in('user_id', ids)).then(function (f) {
              var av = {}, dn = {}; ((f && f.data) || []).forEach(function (x) { av[x.user_id] = x.avatar_url || null; dn[x.user_id] = plainName(x.display_name); });
              members.forEach(function (x) { x.avatar = av[x.user_id] || null; if (x.name === t('Lid', 'Member') && dn[x.user_id]) x.name = dn[x.user_id]; });
              if (bg.isConnected) paint();
            }, function () { if (bg.isConnected) paint(); });
          }, function () { members = []; });
      });
      // alleen namen: nooit een e-mailadres tonen (zie plainName bovenaan)
      function memberName(m) { return m.name; }
      function allowed(id) { return !Array.isArray(cur.editUsers) || cur.editUsers.indexOf(id) > -1; }
      function saveUsers() {
        clearTimeout(uTimer);
        uTimer = setTimeout(function () {
          var c = sb();
          if (!c || !cur.id) return;
          Promise.resolve(c.from('bible_designs').update({ edit_users: Array.isArray(cur.editUsers) ? cur.editUsers : null }).eq('id', cur.id)).then(function (r) {
            if (r && r.error) { status = t('De ledenlijst opslaan lukt nog niet. Is de database bijgewerkt?', 'Saving the member list did not work yet. Is the database updated?'); paint(); }
            else save(true);
          }, function () {});
        }, 350);
      }
      function membersBox() {
        var wrap = el('div', null);
        var count = el('b', { text: '' });
        var list = el('div', { class: 'odz-mem-list' });
        function fill() {
          list.innerHTML = '';
          var q = memberQ.toLowerCase(), n = 0;
          (members || []).forEach(function (m) {
            var nm = memberName(m);
            if (q && nm.toLowerCase().indexOf(q) < 0) return;
            n++;
            var on = allowed(m.user_id);
            var row = el('div', { class: 'odz-mem' + (on ? ' on' : ''), style: 'cursor:default' }, [
              el('button', { type: 'button', class: 'odz-memtog', 'aria-pressed': on ? 'true' : 'false', 'aria-label': t('Mag bewerken', 'Can edit'), style: 'display:inline-flex;border:0;background:transparent;padding:0;cursor:pointer;flex:none', onclick: function () {
                var ids = Array.isArray(cur.editUsers) ? cur.editUsers.slice() : members.map(function (x) { return x.user_id; });
                var i = ids.indexOf(m.user_id);
                if (i > -1) ids.splice(i, 1); else ids.push(m.user_id);
                cur.editUsers = ids; saveUsers(); fill();
              } }, [el('i', null, on ? [icon('check', 12)] : null)]),
              m.avatar ? el('img', { src: m.avatar, alt: '', width: 26, height: 26, style: 'width:26px;height:26px;border-radius:50%;object-fit:cover;flex:none' })
                : el('span', { 'aria-hidden': 'true', style: 'width:26px;height:26px;border-radius:50%;background:var(--o-deep);display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:var(--o-soft);flex:none;margin:0', text: nm.charAt(0).toUpperCase() }),
              el('a', { href: ROOT + 'gemeenschap/#' + (isEn() ? 'member/' : 'lid/') + encodeURIComponent(m.handle || m.user_id), target: '_blank', rel: 'noopener', style: 'margin:0;color:var(--o-ink);text-decoration:none;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1', text: nm })
            ]);
            list.appendChild(row);
          });
          if (!n) list.appendChild(el('p', { class: 'odz-hint', style: 'margin:0;padding:12px', text: members === null ? t('Leden laden…', 'Loading members…') : t('Geen leden gevonden.', 'No members found.') }));
          var on = (members || []).filter(function (m) { return allowed(m.user_id); }).length;
          count.textContent = t('Wie mag bewerken', 'Who can edit') + (members ? ' · ' + on + '/' + members.length : '');
        }
        wrap.appendChild(el('div', { class: 'odz-mem-head' }, [
          count,
          el('div', { class: 'odz-row', style: 'gap:6px' }, [
            el('button', { type: 'button', class: 'odz-btn', text: t('Alles aan', 'All on'), onclick: function () { cur.editUsers = null; saveUsers(); fill(); } }),
            el('button', { type: 'button', class: 'odz-btn', text: t('Alles uit', 'All off'), onclick: function () { cur.editUsers = []; saveUsers(); fill(); } })
          ])
        ]));
        wrap.appendChild(el('input', { type: 'search', class: 'odz-link', style: 'width:100%;margin-top:8px;box-sizing:border-box', placeholder: t('Zoek een lid', 'Search a member'), 'aria-label': t('Zoek een lid', 'Search a member'),
          oninput: function (e) { memberQ = e.target.value; fill(); } }));
        wrap.appendChild(list);
        fill();
        return wrap;
      }
      // Plaatst het ontwerp (afbeelding, link en naam van het account) in het kanaal "Vers dat me raakte" van de Gemeenschap.
      var postState = 'idle', postText = '';
      function postToTijdlijn() {
        var c = sb();
        if (!c || !shareUser || !cur.shareId) return;
        var pv = makePreview();
        if (!pv) { status = t('Er is geen voorbeeld om te plaatsen. Sla het ontwerp eerst op.', 'There is no preview to post. Save the design first.'); paint(); return; }
        postState = 'busy'; paint();
        var asOrg = postAsOrg();
        var title = cur.title || postTitle(asOrg), path = shareUser.id + '/share-' + cur.shareId + '.jpg';
        c.storage.from('bible-backgrounds').upload(path, dataUrlToBlob(pv), { contentType: 'image/jpeg', upsert: true }).then(function (up) {
          if (up.error) throw up.error;
          var url = c.storage.from('bible-backgrounds').getPublicUrl(path).data.publicUrl;
          return findPost(c, cur.shareId).then(function (old) {
            if (!old) return null;
            var keep = (old.body && old.body.nodes || []).filter(function (n) { return n.type !== 'img'; });
            var nodes = (postText.trim() ? [{ type: 'p', text: postText.trim() }] : keep).concat([{ type: 'img', url: url + '?v=' + Date.now() }]);
            return c.from('bible_forum_topics').update({ title: title, body: { v: 1, nodes: nodes } }).eq('id', old.id);
          }).then(function (done) { if (done) return done; return Promise.resolve(c.from('bible_forum_categories').select('*').limit(500)).then(function (cr) {
            var rows = (cr && cr.data) || [];
            var cat = rows.filter(function (x) { return x.slug === 'vers-raakt'; })[0] || rows.filter(function (x) { return JSON.stringify(x).toLowerCase().indexOf('vers dat me raakte') > -1; })[0];
            if (!cat) throw new Error('geen kanaal');
            return c.from('bible_forum_topics').insert({
              author: asOrg ? ORG_UID : shareUser.id, category_id: cat.id, title: title,
              body: { v: 1, nodes: (postText.trim() ? [{ type: 'p', text: postText.trim() }] : []).concat([{ type: 'img', url: url }]) },
              activity_ref: 'design:' + cur.shareId
            });
          }); });
        }).then(function (r) {
          if (r && r.error) throw r.error;
          postState = 'done'; paint();
        }, function () {
          postState = 'error'; paint();
        });
      }
      function paint() {
        box.innerHTML = '';
        box.appendChild(el('div', { class: 'odz-modal-head' }, [
          el('h3', { text: t('Delen via link', 'Share by link') }),
          el('button', { type: 'button', class: 'odz-btn ico', 'aria-label': t('Sluiten', 'Close'), icon: 'x', iconSize: 16, onclick: function () { bg.remove(); } })
        ]));
        box.appendChild(el('p', { class: 'odz-hint', style: 'margin:0 0 4px', text: t('Kies wie dit ontwerp mag zien of bewerken. De bijbelverzen zelf kunnen nooit worden aangepast.', 'Choose who can view or edit this design. The Bible verses themselves can never be changed.') }));
        MODES.filter(function (m) { return m[0] !== 'edit_members' || canMembers === true; }).forEach(function (m) {
          var on = (cur.shareId ? (cur.shareMode || 'off') : ((cur.shareMode && cur.shareMode !== 'off') ? cur.shareMode : 'view')) === m[0];
          box.appendChild(el('button', { type: 'button', class: 'odz-opt' + (on ? ' on' : ''), disabled: busy ? '' : null, onclick: function () { choose(m[0]); } }, [
            el('i', { class: 'odz-dot' }),
            el('div', null, [el('b', { text: m[1] }), el('span', { text: m[2] })])
          ]));
        });
        if ((cur.shareMode || 'off') === 'edit_members') box.appendChild(membersBox());
        if (cur.shareId) {
          var inp = el('input', { type: 'text', readonly: '', value: shortLink(cur.shareId, cur.title || designTitle(items)), class: 'odz-link', onfocus: function (e) { e.target.select(); } });
          // telefoon: één tik opent het deelvenster van het apparaat (WhatsApp, Telegram, Teams, Gmail ...)
          if (navigator.share) box.appendChild(el('button', { type: 'button', class: 'odz-btn pri', style: 'margin-top:14px;width:100%', text: t('Deel via een app', 'Share via an app'), onclick: function () {
            var u = shortLink(cur.shareId, cur.title || designTitle(items));
            navigator.share({ title: cur.title || designTitle(items), text: mergeItems(items).map(function (i) { return i.label; }).join(', '), url: u }).catch(function () {});
          } }));
          box.appendChild(el('div', { class: 'odz-row', style: 'margin-top:10px;flex-wrap:nowrap' }, [
            inp,
            el('button', { type: 'button', class: 'odz-btn pri', text: t('Kopieer link', 'Copy link'), onclick: function () {
              var done = function () { toast(t('Link gekopieerd.', 'Link copied.')); };
              if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(inp.value).then(done, function () { inp.select(); });
              else inp.select();
            } })
          ]));
          if ((cur.shareMode || 'off') === 'off') box.appendChild(el('p', { class: 'odz-hint', style: 'margin-top:8px', text: t('Deze link werkt alleen voor jou.', 'This link only works for you.') }));
        }
        if (cur.shareId && shareUser && (cur.shareMode || 'off') !== 'off') {
          if (postState === 'compose') {
            var ta = el('textarea', { rows: '3', maxlength: '280', 'aria-label': t('Tekst erboven', 'Text above'), placeholder: t('Tekst erboven (optioneel)', 'Text above (optional)'), style: 'width:100%;box-sizing:border-box;border:1px solid rgba(29,43,51,.2);border-radius:10px;padding:9px 11px;font:14px/1.45 Inter,system-ui,sans-serif;background:var(--o-surface);color:var(--o-ink);margin-top:10px;resize:vertical' });
            ta.value = postText;
            ta.addEventListener('input', function (e) { postText = e.target.value; });
            box.appendChild(ta);
            box.appendChild(el('button', { type: 'button', class: 'odz-btn pri', style: 'margin-top:8px;width:100%', text: t('Plaats in Gemeenschap', 'Post to Community'), onclick: postToTijdlijn }));
          } else {
            var pTxt = postState === 'busy' ? t('Bezig…', 'Busy…')
              : postState === 'done' ? t('Gelukt', 'Done')
              : postState === 'error' ? t('Mislukt, probeer opnieuw', 'Failed, try again')
              : t('Plaats in Gemeenschap', 'Post to Community');
            box.appendChild(el('button', { type: 'button', class: 'odz-btn pri', style: 'margin-top:10px;width:100%', disabled: (postState === 'busy' || postState === 'done') ? '' : null, icon: postState === 'done' ? 'check' : undefined, iconSize: 16, text: pTxt, onclick: function () { postState = 'compose'; paint(); } }));
          }
        }
        if (status) box.appendChild(el('p', { class: 'odz-hint', style: 'margin-top:12px', text: status }));
      }
      // zonder account: bekijken en bewerken met de link kan gewoon, alleen 'leden' vraagt een login
      function chooseAnon(mode) {
        if (mode === 'edit_members') { status = t('Log in om alleen ingelogde leden te laten bewerken.', 'Log in to let only logged-in members edit.'); return; }
        return save(true).then(function (where) {
          if (!cur.id) return;
          var tok = ownerToken(cur.id, true);
          if (cur.shareId) {
            return rpc('onk_set_share_mode', { p_share: cur.shareId, p_mode: mode, p_token: tok }).then(function (r) {
              if (r.error || r.data !== true) { status = t('Dit lukt niet: alleen de maker kan de rechten wijzigen.', 'This did not work: only the creator can change the permissions.'); return; }
              cur.shareMode = mode; status = '';
              return save(true);
            });
          }
          var d = localDesigns().filter(function (x) { return x.id === cur.id; })[0];
          if (!d) { status = t('Er ging iets mis. Probeer het opnieuw.', 'Something went wrong. Try again.'); return; }
          function attempt(n) {
            var id = newShareId();
            var pvc = makePreview();
            var dc = pvc ? Object.assign({}, d, { preview: pvc }) : d;
            return rpc('onk_create_shared', { p_id: cur.id, p_share: id, p_mode: mode, p_token: tok, p_data: dc }).then(function (r) {
              var o = r && !r.error && r.data;
              if (o && o.ok) { cur.shareId = id; cur.shareMode = mode; status = ''; return save(true); }
              if (o && o.error === 'taken' && n < 3) return attempt(n + 1);
              status = t('Delen via link is nog niet ingesteld in de database.', 'Link sharing is not set up in the database yet.');
            });
          }
          return attempt(0);
        });
      }
      function choose(mode, silent) {
        if (busy) return;
        busy = true; if (!silent) status = t('Even geduld\u2026', 'One moment\u2026'); paint();
        // de link bestaat al: de keuze meteen tonen, het opslaan gebeurt op de achtergrond
        if (cur.shareId && cur.id && shareUser !== undefined) {
          if (!shareUser && mode === 'edit_members') { busy = false; status = t('Log in om alleen ingelogde leden te laten bewerken.', 'Log in to let only logged-in members edit.'); paint(); return; }
          var prevMode = cur.shareMode;
          cur.shareMode = mode; busy = false; status = ''; paint();
          var job = shareUser
            ? setShare(cur.id, cur.shareId, mode, cur.editUsers).then(function (r) { return !(r.error || !r.data || !r.data.length); })
            : rpc('onk_set_share_mode', { p_share: cur.shareId, p_mode: mode, p_token: ownerToken(cur.id) }).then(function (r) { return !(r.error || r.data !== true); });
          return job.then(function (ok) {
            if (!ok) { cur.shareMode = prevMode; status = t('Dit lukt niet. Probeer het opnieuw.', 'This did not work. Try again.'); paint(); }
          }, function () { cur.shareMode = prevMode; status = t('Er ging iets mis. Probeer het opnieuw.', 'Something went wrong. Try again.'); paint(); });
        }
        getUser().then(function (u) {
          if (!u) return chooseAnon(mode);
          return save(true).then(function (where) {
            if (where !== 'account') { status = t('Bewaren in je account is nog niet beschikbaar, dus delen kan nog niet.', 'Saving to your account is not available yet, so sharing is not possible.'); return; }
            function attempt(n) {
              var id = cur.shareId || newShareId();
              return setShare(cur.id, id, mode, cur.editUsers).then(function (r) {
                if (r.error && String(r.error.code) === '23505' && n < 3) { cur.shareId = null; return attempt(n + 1); }
                if (r.error || !r.data || !r.data.length) { status = t('Delen via link is nog niet ingesteld in de database.', 'Link sharing is not set up in the database yet.'); return; }
                cur.shareId = id; cur.shareMode = mode; status = '';
                return save(true);
              });
            }
            return attempt(0);
          });
        }).then(function () { busy = false; paint(); }, function () { busy = false; status = t('Er ging iets mis. Probeer het opnieuw.', 'Something went wrong. Try again.'); paint(); });
      }
      paint();
      // de link wordt bij openen klaargemaakt (standaard: iedereen met de link kan bekijken); daarna past wisselen alleen de modus aan
      if (!cur.shareId && items.length && !cur.sharedEdit) choose((cur.shareMode && cur.shareMode !== 'off') ? cur.shareMode : 'view', true);
    }
    // Voorbeeld voor in WhatsApp en andere apps (design-share.php toont dit bij een deellink).
    // Staat alleen in de versie die naar het account gaat, niet in de lokale opslag.
    function makePreview() {
      try {
        var F = FORMATS[st.fmt] || FORMATS.sq, c = document.createElement('canvas');
        var ss = sharpSize(F.w, F.h, st, bgImg);
        // WhatsApp laat een voorbeeld weg als de afbeelding te zwaar is (ongeveer boven 300 KB):
        // daarom net zo lang verkleinen tot hij er ruim onder blijft
        var out = null, long = 1200, qual = 0.86;
        for (var tries = 0; tries < 6; tries++) {
          var z = Math.min(1, long / Math.max(ss.w, ss.h));
          draw(c, F.w, F.h, st, items, bgImg, z);
          out = c.toDataURL('image/jpeg', qual);
          if (out.length * 0.75 < 240000) break;
          if (qual > 0.7) qual -= 0.08; else long = Math.round(long * 0.85);
        }
        return out;
      } catch (e) { return null; }
    }
    function save(silent) {
      silent = silent === true;
      if (needItems()) return Promise.resolve('none');
      var c = document.createElement('canvas'), F = FORMATS[st.fmt] || FORMATS.sq, k = 720 / Math.max(F.w, F.h);
      draw(c, Math.round(F.w * k), Math.round(F.h * k), st, items, bgImg);
      var now = Date.now();
      var d = {
        id: cur.id || uid(), created: cur.created || now, updated: now,
        title: cur.title || designTitle(items), titleCustom: !!cur.title,
        items: items.map(function (x) { return { label: x.label, text: x.text, code: x.code, chapter: x.chapter, verseStart: x.verseStart, verseEnd: x.verseEnd, version: x.version }; }),
        style: st, thumb: c.toDataURL('image/jpeg', 0.85),
        shareId: cur.shareId || null, shareMode: cur.shareMode || 'off',
        previewV: 2,
        editUsers: cur.shareMode === 'edit_members' && Array.isArray(cur.editUsers) ? cur.editUsers : null
      };
      if (cur.sharedEdit) {
        // ontwerp van iemand anders met bewerkrechten: bijwerken voor iedereen met de link
        var dsh = d;
        var pvs = (cur.shareMode && cur.shareMode !== 'off') ? makePreview() : null;
        if (pvs) dsh = Object.assign({}, d, { preview: pvs });
        return rpc('onk_update_shared', { p_share: cur.shareId, p_data: dsh }).then(function (r) {
          var ok = !!r && !r.error && r.data === true;
          if (!silent) toast(ok
            ? t('Bijgewerkt voor iedereen met de link.', 'Updated for everyone with the link.')
            : t('Bijwerken lukt niet: je hebt hier geen bewerkrechten voor.', 'Could not update: you do not have edit rights for this design.'));
          if (ok && pvs) syncCommunityPost(d, pvs);
          return ok ? 'shared' : 'denied';
        });
      }
      var wasNew = !cur.id;
      var dr = d;
      // ook bij 'alleen ik': het voorbeeld (alleen de afbeelding) mag de eigen link laten zien
      if (cur.shareId) {
        var pv = makePreview();
        if (pv) dr = Object.assign({}, d, { preview: pv });
      }
      cur.id = d.id; cur.created = d.created;
      var list = localDesigns().filter(function (x) { return x.id !== d.id; });
      list.unshift(d);
      var stored = storeDesigns(list);
      if (!stored) {
        // te groot voor lokale opslag: zonder eigen foto proberen
        var slim = JSON.parse(JSON.stringify(d)); slim.style.bg.custom = null;
        if (slim.style.bg.type === 'custom') slim.style.bg.type = 'gradient';
        list[0] = slim; stored = storeDesigns(list);
      }
      if (!stored && !silent) toast(t('Het geheugen van je browser is vol. Dit ontwerp is niet op dit apparaat bewaard.', 'Your browser storage is full. This design was not saved on this device.'));
      if (wasNew) setBasket([]);
      var tok = d.shareId && d.shareMode !== 'off' ? ownerToken(d.id) : null;
      var saving = remoteSave(dr).then(function (where) {
        if (tok && where !== 'account') {
          return rpc('onk_update_shared', { p_share: d.shareId, p_data: dr, p_token: tok }).then(function () { return where; });
        }
        return where;
      });
      return saving.then(function (where) {
        if (dr.preview && (where === 'account' || where === 'local' || where === 'noaccount')) syncCommunityPost(d, dr.preview);
        window.dispatchEvent(new Event('onk-designs-changed'));
        if (!silent) {
          if (where === 'account') toast(t('Bewaard in je account.', 'Saved to your account.'));
          else if (where === 'noaccount') toast(t('Bewaard op dit apparaat. Opslaan in je account is nog niet beschikbaar.', 'Saved on this device. Saving to your account is not available yet.'));
          else toast(t('Bewaard op dit apparaat. Log in om je ontwerpen in je account te bewaren.', 'Saved on this device. Log in to keep your designs in your account.'));
        }
        if (tab === 'saved') render();
        return where;
      });
    }

    /* — opbouw — */
    var closeBtn = el('button', { type: 'button', class: 'odz-btn ico', 'aria-label': t('Sluiten', 'Close'), icon: 'x', onclick: function () { closeStudio(); } });
    var head = el('div', { class: 'odz-head' }, [
      closeBtn, title,
      el('button', { type: 'button', class: 'odz-btn danger', text: t('Alles resetten', 'Reset everything'),
        title: t('Zet formaat, lettertype, grootte, regelafstand, kleuren, achtergrond, marge en rand terug naar standaard. Je verzen en naam blijven staan.', 'Resets format, font, size, line spacing, colours, background, margin and border to default. Your verses and name stay.'),
        'aria-label': t('Alles resetten', 'Reset everything'), onclick: resetAll }),
      el('button', { type: 'button', class: 'odz-btn', text: t('Bewaar', 'Save'), onclick: function () {
        var fresh = !cur.id && !cur.sharedEdit && items.length > 0;
        save().then(function (where) {
          if (!fresh || !cur.id || where === 'none' || where === 'denied') return;
          // bewaard: het ontwerp staat nu onder Bewaard, de selectie begint weer leeg
          clearTimeout(autoTimer); autoTimer = null;
          items.length = 0;
          cur = { id: null, created: null, title: null, shareId: null, shareMode: 'off', editUsers: null, sharedEdit: false };
          setBasket([]);
          tab = 'saved'; changed(); render();
        });
      } }),
      el('button', { type: 'button', class: 'odz-btn', icon: 'download', 'aria-label': t('Downloaden', 'Download'), onclick: download }),
      el('button', { type: 'button', class: 'odz-btn pri odz-wide', text: t('Delen', 'Share'), onclick: openShare }),
      el('button', { type: 'button', class: 'odz-btn pri ico odz-narrow', icon: 'share', 'aria-label': t('Delen', 'Share'), title: t('Delen', 'Share'), onclick: openShare })
    ]);
    root = el('div', { class: 'odz', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('Ontwerp maken', 'Create a design') }, [
      head,
      opts.banner ? el('div', { class: 'odz-banner', text: opts.banner }) : null,
      el('div', { class: 'odz-main' }, [stage, el('div', { class: 'odz-side' }, [tabsBar, panel])])
    ]);
    document.body.appendChild(root);
    root.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var modals = root.querySelectorAll('.odz-modal-bg');
      if (modals.length) { modals[modals.length - 1].remove(); return; } // eerst de deel-sheet
      if (e.target === title) { title.blur(); return; }
      closeStudio();
    });

    showTitle();
    render();
    syncImg(redraw);
    loadFonts(redraw);
    closeBtn.focus();
  }

  var studioFlush = null;
  function closeStudio() {
    if (!root) return;
    if (studioResize) { window.removeEventListener('resize', studioResize); studioResize = null; }
    if (studioFlush) { try { studioFlush(); } catch (e) {} studioFlush = null; }
    studioTitle = null;
    root.remove(); root = null; studioOpen = false; updatePill();
  }

  /* ───────── galerij "Mijn ontwerpen" ───────── */
  function shownTitle(d) {
    return d.titleCustom && d.title ? d.title : designTitle(d.items || []);
  }
  // tekent een voorbeeld pas als het in beeld komt (scheelt veel geheugen bij veel ontwerpen)
  var thumbObserver = null;
  function lazyDraw(cv, fn) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    if (!thumbObserver) {
      thumbObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          thumbObserver.unobserve(en.target);
          var f = en.target.__draw; en.target.__draw = null;
          if (f) f();
        });
      }, { rootMargin: '240px' });
    }
    cv.__draw = fn;
    thumbObserver.observe(cv);
  }
  function thumbCanvas(d) {
    var cv = document.createElement('canvas');
    try {
      var st = normStyle(d.style), F = FORMATS[st.fmt] || FORMATS.sq;
      var W = 720, H = Math.round(W * F.h / F.w), list = verifyItems(d.items || []);
      var go = function (img) { draw(cv, W, H, st, list, img); };
      var src = bgSource(st);
      cv.width = W; cv.height = H;
      cv.style.cssText = 'display:block;width:auto;height:auto;max-width:100%;max-height:100%';
      lazyDraw(cv, function () { if (src) loadImg(src, function (im) { go(im); }); else go(null); });
    } catch (e) {}
    return cv;
  }
  function mountGallery(container, opts) {
    ensureCss();
    opts = opts || {};
    if (container.__odzMounted && !opts.compact) { return; }
    container.__odzMounted = true;
    var alive = true;
    function show(list) {
      if (!alive || !container.isConnected) return;
      container.innerHTML = '';
      var top = el('div', { class: 'odz-gal-top' }, [
        el('button', { type: 'button', icon: 'plus', iconSize: 16,
          text: getBasket().length
            ? t('Verder met je ontwerp (' + getBasket().length + ' ' + (getBasket().length === 1 ? 'vers' : 'verzen') + ')', 'Continue your design (' + getBasket().length + ' ' + (getBasket().length === 1 ? 'verse' : 'verses') + ')')
            : t('Nieuw ontwerp', 'New design'),
          onclick: function () {
            if (opts.compact) { return; }
            openStudio({ items: getBasket(), fromBasket: true });
          } })
      ]);
      if (opts.compact) top = el('div');
      container.appendChild(top);
      if (!list.length) {
        container.appendChild(el('p', { class: 'odz-empty', text: t(
          'Nog geen ontwerpen bewaard. Tik op een vers, kies “Toevoegen aan ontwerp” en maak je eigen afbeelding.',
          'No designs saved yet. Tap a verse, choose “Add to design” and make your own image.') }));
        return;
      }
      var grid = el('div', { class: 'odz-gal' });
      list.forEach(function (d) {
        var open = function () {
          if (opts.onOpenDesign) { opts.onOpenDesign(d); return; }
          openStudio({ items: d.items, style: d.style, id: d.id, created: d.created, title: d.title, titleCustom: d.titleCustom, shareId: d.shareId, shareMode: d.shareMode, editUsers: d.editUsers, previewV: d.previewV });
        };
        var card = el('div', { class: 'odz-card' }, [
          el('button', { type: 'button', class: 'th', 'aria-label': shownTitle(d), style: d.thumb ? 'background-image:url(' + d.thumb + ')' : '', onclick: open }, thumbCanvas(d)),
          el('div', { class: 'mt' }, [shownTitle(d), el('small', { text: new Date(d.updated || Date.now()).toLocaleDateString(isEn() ? 'en-GB' : 'nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) })]),
          el('div', { class: 'ac' }, [
            el('button', { type: 'button', class: 'odz-gal-btn', text: t('Open', 'Open'), onclick: open }),
            el('button', { type: 'button', class: 'odz-gal-btn', text: t('Verwijder', 'Delete'), onclick: function () {
              setLocalDesigns(localDesigns().filter(function (x) { return x.id !== d.id; }));
              card.remove();
              // pas opnieuw laden als het ook uit het account is, anders komt de kaart terug
              deleteDesign(d).then(function () { window.dispatchEvent(new Event('onk-designs-changed')); load(); });
            } })
          ])
        ]);
        grid.appendChild(card);
      });
      container.appendChild(grid);
    }
    function load() { show(localDesigns()); allDesigns(show); }
    var onChange = function () {
      if (!container.isConnected) { alive = false; window.removeEventListener('onk-designs-changed', onChange); return; }
      show(localDesigns());
    };
    window.addEventListener('onk-designs-changed', onChange);
    load();
  }

  /* ───────── API ───────── */
  function sameItem(a, b) {
    return a.code === b.code && a.chapter === b.chapter && a.verseStart === b.verseStart && a.verseEnd === b.verseEnd && a.version === b.version;
  }
  window.__onkDesign = {
    add: function (item, andOpen) {
      var b = getBasket(), dup = b.some(function (x) { return sameItem(x, item); });
      if (!dup) { b.push({ code: item.code, bookName: item.bookName, chapter: item.chapter, verseStart: item.verseStart, verseEnd: item.verseEnd, version: item.version, label: item.label, text: item.text }); setBasket(b); }
      if (andOpen) { openStudio({ items: getBasket(), fromBasket: true }); return; }
      toast(dup
        ? t(item.label + ' staat al in je ontwerp.', item.label + ' is already in your design.')
        : t(item.label + ' toegevoegd aan je ontwerp.', item.label + ' added to your design.'),
        { label: t('Ontwerpen', 'Design'), run: function () { openStudio({ items: getBasket(), fromBasket: true }); } });
    },
    open: function () { openStudio({ items: getBasket(), fromBasket: true }); },
    count: function () { return getBasket().length; },
    has: function (item) { return getBasket().some(function (x) { return sameItem(x, item); }); },
    mountGallery: function (c) { mountGallery(c); }
  };

  function init() {
    // oude selectie uit localStorage (van vóór "hoort bij dit tabblad") eenmalig opruimen
    try { localStorage.removeItem(LS_BASKET); localStorage.removeItem('onk-design-basket-at'); localStorage.removeItem(LS_RESUME); } catch (e) {}
    getUser().then(pullStyle);
    var m = location.search.match(/[?&]o=([A-Za-z0-9-]{6,90})/);
    if (m) {
      var code = m[1].split('-').pop();
      if (code.length >= 6 && code.length <= 16) setTimeout(function () { if (!studioOpen) loadShared(code); }, 400);
    }
  }
  // wat nog niet is bewaard (autosave wacht 1,5 s) gaat niet verloren als je het tabblad verlaat
  function flushNow() { if (studioOpen && studioFlush) { try { studioFlush(); } catch (e) {} } }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushNow(); });
  window.addEventListener('pagehide', flushNow);
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
