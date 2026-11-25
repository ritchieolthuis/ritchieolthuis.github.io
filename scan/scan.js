/* De Bijbel Online - Bijbel scannen
 *
 * Camera (of een foto) -> tekst herkennen (Tesseract, zelf gehost in /scan/) ->
 * het vers of hoofdstuk zoeken in alle vier de vertalingen -> openen in de lezer.
 * Wordt pas geladen als iemand op "Bijbel scannen" onder Meer tikt
 * (window.__onkScanOpen in bible.js). Alleen op telefoons kan de camera worden
 * gebruikt; op tablets en computers is het import-only (foto kiezen of plakken).
 *
 *   window.__onkScan.open()    scanner openen
 *   window.__onkScan.close()   scanner sluiten
 *   window.__onkScan._t        pure hulpfuncties (voor de tests)
 */
(function () {
  "use strict";
  var W = typeof window !== "undefined" ? window : globalThis;
  if (W.__onkScan) return;

  var ROOT = W.__onkRoot || (typeof location !== "undefined" ? new URL("./", location.href).href : "./");

  function isEn() {
    try {
      var p = location.pathname.toLowerCase(), q = new URLSearchParams(location.search);
      var l = q.get("lang") || q.get("locale");
      if (p.indexOf("3dbible") >= 0 || l === "en") return true;
      if (p.indexOf("3dbijbel") >= 0 || l === "nl") return false;
      if (W.__onkLocale) return W.__onkLocale === "en";
      return localStorage.getItem("bible-locale") === "en";
    } catch (e) { return false; }
  }
  function L(nl, en) { return isEn() ? en : nl; }

  /* ---------- Versdata en zoekindex ---------- */
  var VERS = [
    { key: "sv", url: "data/sv.json", label: "Statenvertaling", lang: "nl" },
    { key: "hsv", url: "data/seo/hsv.json", label: "HSV", lang: "nl" },
    { key: "nbg51", url: "data/seo/nbg51.json", label: "NBG 1951", lang: "nl" },
    { key: "kjv", url: "data/seo/kjv.json", label: "KJV", lang: "en" }
  ];

  function tok(s) {
    return String(s || "").replace(/-\s*\n\s*/g, "").toLowerCase().normalize("NFD")
      .replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, " ").split(" ")
      .filter(function (w) { return w.length >= 3; });
  }
  function squash(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "").replace(/th/g, "t");
  }

  function build(data, ver) {
    var words = new Map(), df = [], vw = [], vo = [], vB = [], vC = [], vN = [], vt = [], books = [];
    data.forEach(function (b, bi) {
      var chs = [];
      b.chapters.forEach(function (c, ci) {
        var arr = c.v || c;
        chs.push(arr.length);
        arr.forEach(function (t, ti) {
          var set = new Set(), ids = [], ord = [];
          tok(t).forEach(function (w) {
            var id = words.get(w);
            if (id === undefined) { id = df.length; words.set(w, id); df.push(0); }
            ord.push(id);
            if (!set.has(id)) { set.add(id); ids.push(id); df[id]++; }
          });
          vt.push(String(t || "")); vo.push(Int32Array.from(ord));
          vw.push(Int32Array.from(ids)); vB.push(bi); vC.push(ci + 1); vN.push(ti + 1);
        });
      });
      books.push({ code: b.code, name: b.name, ch: chs });
    });
    var N = vw.length, wt = new Float32Array(df.length), post = new Array(df.length), i, j;
    for (i = 0; i < df.length; i++) {
      wt[i] = df[i] <= N * 0.05 ? Math.log(N / df[i]) : 0; /* veelvoorkomende woorden tellen niet mee */
      post[i] = [];
    }
    var tw = new Float32Array(N);
    for (i = 0; i < N; i++) {
      var a = vw[i], s = 0;
      for (j = 0; j < a.length; j++) { s += wt[a[j]]; post[a[j]].push(i); }
      tw[i] = s;
    }
    var chIdx = new Map();
    for (i = 0; i < N; i++) { var ck = vB[i] * 1000 + vC[i]; if (!chIdx.has(ck)) chIdx.set(ck, i); }
    return { ver: ver, words: words, wt: wt, post: post, tw: tw, vo: vo, vw: vw, chIdx: chIdx, vB: vB, vC: vC, vN: vN, vt: vt, N: N, books: books };
  }

  /* Welk deel van de woordparen van dit vers staat ook in de herkende tekst (volgorde telt). */
  function bigramRecall(ord, qb) {
    if (ord.length < 2) return 1;
    var n = 0, i;
    for (i = 0; i + 1 < ord.length; i++) if (qb.has(ord[i] * 100000 + ord[i + 1])) n++;
    return n / (ord.length - 1);
  }

  /* Beste hoofdstuk en vers-bereik in één vertaling. */
  function query(ix, text) {
    var seen = new Set(), q = [], qb = new Set(), prev = -1;
    tok(text).forEach(function (w) {
      var id = ix.words.get(w);
      if (id === undefined) { prev = -1; return; }
      if (prev >= 0) qb.add(prev * 100000 + id);
      prev = id;
      if (ix.wt[id] > 0 && !seen.has(id)) { seen.add(id); q.push(id); }
    });
    if (q.length < 3) return null;
    var mw = new Float32Array(ix.N), i, v;
    q.forEach(function (id) {
      var p = ix.post[id], w = ix.wt[id];
      for (i = 0; i < p.length; i++) mw[p[i]] += w;
    });
    var cs = new Map();
    for (v = 0; v < ix.N; v++) {
      if (mw[v] < 1.5 || !ix.tw[v] || mw[v] / ix.tw[v] < 0.3) continue;
      var k = ix.vB[v] * 1000 + ix.vC[v];
      cs.set(k, (cs.get(k) || 0) + mw[v]);
    }
    var bestK = -1, bestS = 0, tops = [];
    cs.forEach(function (s, k) { tops.push([k, s]); if (s > bestS) { bestS = s; bestK = k; } });
    tops.sort(function (a, b) { return b[1] - a[1]; });
    var top = tops.slice(0, 3).map(function (t) { return { bi: Math.floor(t[0] / 1000), ch: t[0] % 1000, score: t[1] }; });
    if (bestK < 0) return null;
    var bi = Math.floor(bestK / 1000), ch = bestK % 1000, hits = [];
    for (v = 0; v < ix.N; v++) {
      if (ix.vB[v] === bi && ix.vC[v] === ch && mw[v] >= 2 && ix.tw[v] && mw[v] / ix.tw[v] >= 0.4) {
        hits.push({ n: ix.vN[v], w: mw[v], r: mw[v] / ix.tw[v], b: bigramRecall(ix.vo[v], qb) });
      }
    }
    if (!hits.length) return null;
    /* Verzen die dicht bij elkaar liggen (hoogstens 1 vers tussen) vormen één bereik. */
    var groups = [], cur = null;
    hits.forEach(function (h) {
      if (cur && h.n - cur.e <= 2) { cur.e = h.n; cur.s += h.w; cur.l.push(h); }
      else { cur = { b: h.n, e: h.n, s: h.w, l: [h] }; groups.push(cur); }
    });
    groups.sort(function (a, b) { return b.s - a.s; });
    /* Buurverzen delen vaak woorden: een rand-vers telt alleen mee als het goed overeenkomt. */
    var g = groups[0].l;
    var rs = g.map(function (h) { return h.r; }).sort(function (x, y) { return x - y; });
    var edge = Math.max(0.6, 0.75 * rs[Math.floor(rs.length / 2)]);
    function weak(h) { return h.r < edge || h.b < 0.35; }
    while (g.length > 1 && weak(g[g.length - 1])) g.pop();
    while (g.length > 1 && weak(g[0])) g.shift();
    return { ver: ix.ver, bi: bi, chapter: ch, vs: g[0].n, ve: g[g.length - 1].n, score: bestS, top: top };
  }

  /* Regel voor regel: elke leesregel zoekt zijn beste vers in dit hoofdstuk (en een versnummer aan het begin van de regel
     telt mee). De regels staan in de volgorde van de pagina, dus de verzen horen oplopend te zijn: de beste oplopende reeks
     is het bereik. Losse treffers ver weg (herhaalde woorden elders in het hoofdstuk) vallen zo af. Werkt ook als de
     vertaling op papier niet precies die in de app is. */
  function lineRange(ix, text, bi, ch) {
    var nch = ix.books[bi].ch.length, c0 = Math.max(1, ch - 2), c1 = Math.min(nch, ch + 2);
    var g0 = ix.chIdx.get(bi * 1000 + c0), gl = ix.chIdx.get(bi * 1000 + c1);
    if (g0 === undefined || gl === undefined) return null;
    var g1 = gl + ix.books[bi].ch[c1 - 1] - 1, vsets = [], g, n, j, i;
    for (g = g0; g <= g1; g++) vsets.push(new Set(ix.vw[g]));
    var items = [], lines = String(text || "").split(/\n+/);
    lines.forEach(function (line, li) {
      var ids = [], seen = new Set(), lw = 0;
      tok(line).forEach(function (w) {
        var id = ix.words.get(w);
        if (id !== undefined && ix.wt[id] > 0 && !seen.has(id)) { seen.add(id); ids.push(id); lw += ix.wt[id]; }
      });
      var mm = /^\W{0,3}(\d{1,3})\s*[A-Za-z\u00C0-\u00FF"\u201C\u2018(]/.exec(line), num = mm ? +mm[1] : 0;
      var bestG = -1, bestS = 0, cand = [];
      for (g = g0; g <= g1; g++) {
        var sc = 0, set = vsets[g - g0];
        for (j = 0; j < ids.length; j++) if (set.has(ids[j])) sc += ix.wt[ids[j]];
        if (num && ix.vN[g] === num) sc += 4;
        if (sc >= 2) cand.push({ g: g, s: sc });
        if (sc > bestS) { bestS = sc; bestG = g; }
      }
      /* Een regel kan het einde van twee verzen zijn (Johannes 3:15 en 16 eindigen gelijk): neem de beste twee mee, de reeks kiest. */
      cand.sort(function (a, b) { return b.s - a.s; });
      cand.slice(0, 2).forEach(function (cd, ci) {
        if (cd.s >= 2 && cd.s / (lw + (num ? 4 : 0)) >= 0.35 && (ci === 0 || cd.s >= 0.6 * bestS)) items.push({ g: cd.g, s: cd.s, l: li });
      });
    });
    var m = items.length;
    if (!m) return null;
    var dp = [], prev = [];
    for (i = 0; i < m; i++) {
      dp[i] = items[i].s; prev[i] = -1;
      for (j = 0; j < i; j++) {
        var jump = items[i].g - items[j].g;
        if (items[i].l > items[j].l && jump >= 0 && jump <= 8 && dp[j] + items[i].s > dp[i]) { dp[i] = dp[j] + items[i].s; prev[i] = j; }
      }
    }
    var top = 0;
    for (i = 1; i < m; i++) if (dp[i] > dp[top]) top = i;
    var chain = [];
    for (i = top; i >= 0; i = prev[i]) chain.unshift(items[i]);
    /* Zwakke eindpunten die ver van de rest liggen weghalen. */
    var ss = chain.map(function (c) { return c.s; }).sort(function (a, b) { return a - b; }), med = ss[Math.floor(ss.length / 2)];
    while (chain.length > 2 && chain[0].s < 0.4 * med && chain[1].g - chain[0].g > 2) chain.shift();
    while (chain.length > 2 && chain[chain.length - 1].s < 0.4 * med && chain[chain.length - 1].g - chain[chain.length - 2].g > 2) chain.pop();
    var tot = 0;
    chain.forEach(function (c) { tot += c.s; });
    var a = chain[0].g, z = chain[chain.length - 1].g;
    return { ix: ix, bi: bi, chS: ix.vC[a], vS: ix.vN[a], chE: ix.vC[z], vE: ix.vN[z], weight: tot, n: chain.length };
  }

  /* Verwijzingen zoals "Romeinen 11:1-18" of "Romans 11" in de tekst. */
  function nameMap(idxs) {
    var m = new Map();
    idxs.forEach(function (ix) {
      ix.books.forEach(function (b, bi) { m.set(squash(b.name), bi); });
    });
    return m;
  }
  function findBook(map, g) {
    g = squash(g);
    if (g.length < 3) return -1;
    if (map.has(g)) return map.get(g);
    var found = -1, n = 0;
    map.forEach(function (bi, name) {
      if (name.indexOf(g) === 0 && found !== bi) { found = bi; n++; }
    });
    return n === 1 ? found : -1;
  }
  function refsFromText(text, idxs) {
    var map = nameMap(idxs), out = [], re = /(?:^|[^a-z0-9])([123]?[ \t]?[a-z]{3,}(?:[ \t][a-z]{2,})?)\.?[ \t]*(\d{1,3})(?:[ \t]*[:.,][ \t]*(\d{1,3})(?:[ \t]*[-–—][ \t]*(\d{1,3}))?)?/g, m;
    var raw = String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    while ((m = re.exec(raw))) {
      var bi = findBook(map, m[1]);
      if (bi < 0 && m[1].indexOf(" ") > 0) {
        var parts = m[1].split(/\s/);
        bi = findBook(map, parts[parts.length - 1]);   /* "zie romeinen 11" */
        if (bi < 0) bi = findBook(map, parts[0]);
      }
      if (bi < 0) continue;
      out.push({ bi: bi, chapter: +m[2], vs: m[3] ? +m[3] : 0, ve: m[4] ? +m[4] : 0 });
    }
    return out;
  }

  /* Alles samen: tekst -> {code, chapter, verseStart, verseEnd, version, label, name, how} of null. */
  function decide(text, loaded, prefer, noLines) {
    if (!loaded.length) return null;
    var best = null;
    loaded.forEach(function (ix) {
      var r = query(ix, text);
      if (!r) return;
      var better = !best || r.score > best.score * 1.03 || (r.score >= best.score * 0.97 && ix.ver.key === prefer);
      if (better) best = r;
    });
    var refs = refsFromText(text, loaded);
    var ref0 = loaded[0];
    function bookOf(bi) { return ref0.books[bi]; }
    function validRef(r) {
      var b = bookOf(r.bi);
      if (!b || r.chapter < 1 || r.chapter > b.ch.length) return false;
      if (r.vs && r.vs > b.ch[r.chapter - 1]) return false;
      return true;
    }
    refs = refs.filter(validRef);
    var agree = best ? refs.filter(function (r) { return r.bi === best.bi && r.chapter === best.chapter; }) : [];
    /* Staat er een verwijzing met vers in de tekst (bijv. "1 Korintiërs 13:4-5") en de woorden zijn geen zekere treffer
       (andere vertaling, zoals de NBV, die niet in de app staat), dan wint de verwijzing. */
    var wref = refs.filter(function (r) { return r.vs; })[0];
    if (wref && (!best || (!agree.length && best.score < 60))) {
      var ixr = loaded.filter(function (x) { return x.ver.key === prefer; })[0] || loaded[0];
      var ver = wref.ve && wref.ve >= wref.vs ? wref.ve : wref.vs;
      return pack(ixr, wref.bi, wref.chapter, wref.vs, ver, "ref", 30);
    }
    if (best) {
      var s = best.score + (agree.length ? 25 : 0);
      if (s >= 20) {
        var ix = loaded.filter(function (x) { return x.ver.key === best.ver.key; })[0], ch0 = best.chapter, vs = best.vs, ve = best.ve, chE = best.chapter;
        if (!noLines) {
          /* Bereik en vertaling uit de regel-voor-regel uitlijning (beste reeks over alle vertalingen). */
          var lbest = null;
          loaded.forEach(function (x) {
            var lr = lineRange(x, text, best.bi, best.chapter);
            if (!lr) return;
            if (!lbest || lr.weight > lbest.weight * 1.03 || (lr.weight >= lbest.weight * 0.97 && x.ver.key === prefer)) lbest = lr;
          });
          if (lbest && (lbest.n >= 2 || lbest.weight >= 8)) { ix = lbest.ix; ch0 = lbest.chS; vs = lbest.vS; chE = lbest.chE; ve = lbest.vE; }
        }
        var res = pack(ix, best.bi, ch0, vs, ve, "text", s, chE);
        if (agree.length || coverOk(res, text, loaded)) return res;
      }
    }
    /* Geen tekstmatch: een los opgeschreven verwijzing werkt ook. */
    var withV = refs.filter(function (r) { return r.vs; })[0] || refs[0];
    if (withV) {
      var ix2 = loaded.filter(function (x) { return x.ver.key === prefer; })[0] || loaded[0];
      var ve = withV.ve && withV.ve >= withV.vs ? withV.ve : withV.vs;
      return pack(ix2, withV.bi, withV.chapter, withV.vs, ve, "ref", 10);
    }
    return null;
  }
  /* Meerdere losse verzen: vind de beste passage, haal de regels ervan weg en zoek in de rest verder. */
  function wordSet(ix, r) {
    var bi = -1, set = new Set();
    ix.books.forEach(function (b, i) { if (b.code === r.code) bi = i; });
    if (bi < 0) return set;
    segments(r).forEach(function (sg) {
      var g0 = ix.chIdx.get(bi * 1000 + sg.chapter);
      if (g0 === undefined) return;
      var n = ix.books[bi].ch[sg.chapter - 1], a = sg.vs || 1, z = sg.ve || n, g, j;
      for (g = g0 + a - 1; g <= g0 + z - 1; g++) { var arr = ix.vw[g]; if (arr) for (j = 0; j < arr.length; j++) set.add(arr[j]); }
    });
    return set;
  }
  function belongs(ix, set, line) {
    var ids = [], seen = new Set(), inn = 0, tot = 0;
    tok(line).forEach(function (w) {
      var id = ix.words.get(w);
      if (id !== undefined && ix.wt[id] > 0 && !seen.has(id)) { seen.add(id); ids.push(id); }
    });
    if (ids.length < 2) return true;
    ids.forEach(function (id) { tot += ix.wt[id]; if (set.has(id)) inn += ix.wt[id]; });
    return tot > 0 && inn / tot >= 0.55;
  }
  /* Klopt de gevonden passage echt met wat er staat? Staat de tekst in een vertaling die niet in de app zit (bijv. NBV), dan
     komt er per vers hooguit toevallige overlap uit: dan geen vers tonen in plaats van een verkeerd vers. */
  function coverOk(r, text, loaded) {
    var ix = null, k;
    for (k = 0; k < loaded.length; k++) if (loaded[k].ver.key === r.version) ix = loaded[k];
    if (!ix) return true;
    var set = wordSet(ix, r), q = new Set(), pw = 0, hit = 0, owned = 0;
    String(text || "").split(/\n+/).forEach(function (l) {
      var seen = new Set(), lt = 0, li = 0;
      tok(l).forEach(function (w) {
        var id = ix.words.get(w);
        if (id !== undefined && ix.wt[id] > 0) { q.add(id); if (!seen.has(id)) { seen.add(id); lt += ix.wt[id]; if (set.has(id)) li += ix.wt[id]; } }
      });
      if (seen.size >= 2 && lt > 0 && li / lt >= 0.6) owned++;
    });
    set.forEach(function (id) { var w = ix.wt[id]; if (w > 0) { pw += w; if (q.has(id)) hit += w; } });
    r.recall = pw ? hit / pw : 0;
    /* Een echte treffer: de passage komt grotendeels terug in de tekst EN minstens een regel van de tekst hoort er duidelijk bij. */
    return r.recall >= 0.4 && owned >= 1;
  }
  function near(a, b) {
    if (a.code !== b.code) return false;
    var x = span(a), y = span(b);
    return !(x[1] + 2 < y[0] || y[1] + 2 < x[0]);
  }
  function decideMany(text, loaded, prefer) {
    var out = [], ixp = loaded.filter(function (x) { return x.ver.key === prefer; })[0] || loaded[0];
    if (!ixp) return out;
    /* 1. Verwijzingen die in de tekst staan ("1 Korintiërs 13:4-5") zijn betrouwbaar: die komen eerst. */
    var seenR = {};
    refsFromText(text, loaded).forEach(function (r) {
      var b = loaded[0].books[r.bi];
      if (!r.vs || !b || r.chapter < 1 || r.chapter > b.ch.length || r.vs > b.ch[r.chapter - 1]) return;
      var key = r.bi + ":" + r.chapter + ":" + r.vs;
      if (seenR[key] || out.length >= 6) return;
      seenR[key] = 1;
      out.push(pack(ixp, r.bi, r.chapter, r.vs, r.ve && r.ve >= r.vs ? Math.min(r.ve, b.ch[r.chapter - 1]) : r.vs, "ref", 30));
    });
    /* 2. Daarna de tekst zelf: de beste passage, de regels ervan weg, de rest opnieuw. Een tweede of derde treffer moet sterk zijn. */
    var lines = String(text || "").split(/\n+/).filter(function (l) { return l.trim(); }), guard = 0;
    while (lines.length && guard++ < 5 && out.length < 6) {
      var r = decide(lines.join("\n"), loaded, prefer);
      if (!r || r.how !== "text") break;
      if ((out.length || guard > 1) && r.score < 25) break;
      var ix = loaded.filter(function (x) { return x.ver.key === r.version; })[0];
      if (!out.some(function (o) { return near(o, r); })) out.push(r);
      if (!ix) break;
      var set = wordSet(ix, r), rest = lines.filter(function (l) { return !belongs(ix, set, l); });
      if (rest.length === lines.length || rest.length < 1) break;
      lines = rest;
    }
    return out;
  }
  function verseText(r) {
    var ix = null, bi = -1, g, k;
    for (k = 0; k < loaded.length; k++) if (loaded[k].ver.key === r.version) ix = loaded[k];
    if (!ix) return "";
    ix.books.forEach(function (b, i) { if (b.code === r.code) bi = i; });
    g = ix.chIdx.get(bi * 1000 + r.chapter);
    if (bi < 0 || g === undefined) return "";
    var t = ix.vt[g + (r.verseStart || 1) - 1] || "";
    t = t.replace(/\s+/g, " ").trim();
    return t.length > 130 ? t.slice(0, 127).replace(/\s+\S*$/, "") + "\u2026" : t;
  }
  function pack(ix, bi, ch, vs, ve, how, score, chE) {
    var b = ix.books[bi];
    return {
      code: b.code, name: b.name, chapter: ch, verseStart: vs || 0, chapterEnd: chE || ch,
      verseEnd: vs ? ((chE && chE > ch) ? (ve || 1) : Math.max(vs, ve || vs)) : 0,
      version: ix.ver.key, label: ix.ver.label, how: how, score: score, counts: b.ch
    };
  }
  function refLabel(r) {
    var ce = r.chapterEnd || r.chapter, s = r.name + " " + r.chapter;
    if (r.verseStart) {
      s += ":" + r.verseStart;
      if (ce > r.chapter) s += " \u2013 " + ce + ":" + r.verseEnd;
      else if (r.verseEnd > r.verseStart) s += "-" + r.verseEnd;
    }
    return s;
  }
  function span(r) {
    var ce = r.chapterEnd || r.chapter;
    return [r.chapter * 1000 + (r.verseStart || 0), ce * 1000 + (r.verseStart ? r.verseEnd : 999)];
  }
  function same(a, b) {
    if (!a || !b) return false;
    if (a.code !== b.code || a.version !== b.version) return false;
    var x = span(a), y = span(b);
    return !(x[1] < y[0] || y[1] < x[0]);
  }
  /* Een bereik over meerdere hoofdstukken: de lezer toont een bereik maar binnen een hoofdstuk, dus per hoofdstuk een deel. */
  function isMulti(r) { return !!(r && r.verseStart && (r.chapterEnd || r.chapter) > r.chapter); }
  function segments(r) {
    var out = [], ce = r.chapterEnd || r.chapter, c;
    if (ce <= r.chapter || !r.verseStart) return [{ chapter: r.chapter, vs: r.verseStart, ve: r.verseEnd }];
    for (c = r.chapter; c <= ce; c++) {
      var n = r.counts[c - 1], a = c === r.chapter ? r.verseStart : 1, z = c === ce ? r.verseEnd : n;
      out.push({ chapter: c, vs: a === 1 && z === n ? 0 : a, ve: a === 1 && z === n ? 0 : z });
    }
    return out;
  }
  W.__onkScan = { _t: { decideMany: decideMany, lineRange: lineRange, tok: tok, build: build, query: query, decide: decide, refsFromText: refsFromText, refLabel: refLabel, segments: segments, span: span, VERS: VERS, prep: prep, prepAuto: prepAuto, linePitch: linePitch, textScore: textScore, getPool: getPool, recognize: recognize, guessLang: guessLang } };
  if (typeof document === "undefined") return;

  /* ---------- Gegevens laden ---------- */
  var loaded = [], loading = null;
  function loadAll() {
    if (loading) return loading;
    loading = VERS.reduce(function (p, v) {
      return p.then(function () {
        return fetch(ROOT + v.url).then(function (r) { return r.json(); }).then(function (d) {
          loaded.push(build(d, v));
        }).catch(function () { /* een vertaling die niet laadt, slaan we over */ });
      });
    }, Promise.resolve());
    return loading;
  }

  /* ---------- OCR ---------- */
  /* Een pool van werkers (parallel): de pagina wordt in stroken geknipt en tegelijk gelezen. */
  var pool = null, poolLang = "", poolP = null;
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error("script")); };
      document.head.appendChild(s);
    });
  }
  function poolSize() {
    var n = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory;
    if (mem && mem <= 2) return 1;
    return Math.max(1, Math.min(3, n - 1));
  }
  /* De eerste werker is meteen klaar voor gebruik, de andere laden daarna een voor een op de achtergrond. */
  function getPool(lang, onProgress) {
    if (poolP && poolLang === lang) return poolP;
    var old = pool, mine = [], n = poolSize();
    pool = null; poolLang = lang;
    function mk(i) {
      return W.Tesseract.createWorker([lang], 1, {
        workerPath: ROOT + "scan/worker.min.js",
        corePath: ROOT + "scan/core",
        langPath: ROOT + "scan/lang",
        gzip: true,
        logger: function (m) { if (i === 0 && onProgress && m && typeof m.progress === "number") onProgress(m); }
      });
    }
    function more(i) {
      if (i >= n || poolLang !== lang) return;
      mk(i).then(function (w) {
        if (poolLang !== lang) { try { w.terminate(); } catch (e) {} return; }
        mine.push(w); more(i + 1);
      }, function () { /* minder werkers is prima */ });
    }
    poolP = (W.Tesseract ? Promise.resolve() : loadScript(ROOT + "scan/tesseract.min.js")).then(function () { return mk(0); }).then(function (w) {
      mine.push(w); pool = mine;
      if (old) old.forEach(function (x) { try { x.terminate(); } catch (e) {} });
      more(1);
      return mine;
    });
    poolP.catch(function () { poolP = null; poolLang = ""; });
    return poolP;
  }

  /* Knip de pagina op de witste regel bij 1/n, 2/n, ... zodat geen regel doormidden gaat. */
  function splitBands(c, n) {
    var H = c.height, dark = c.__dark;
    if (n < 2 || H < 500 || !dark) return [c];
    var cuts = [0], k, y;
    for (k = 1; k < n; k++) {
      var target = Math.round(H * k / n), win = Math.round(H / (n * 5)), best = target, bv = Infinity;
      for (y = Math.max(1, target - win); y < Math.min(H - 1, target + win); y++) {
        var v = dark[y - 1] + dark[y] + dark[y + 1];
        if (v < bv) { bv = v; best = y; }
      }
      cuts.push(best);
    }
    cuts.push(H);
    var out = [];
    for (k = 0; k < cuts.length - 1; k++) {
      var h = cuts[k + 1] - cuts[k];
      if (h < 20) continue;
      var b = document.createElement("canvas");
      b.width = c.width; b.height = h;
      b.getContext("2d").drawImage(c, 0, cuts[k], c.width, h, 0, 0, c.width, h);
      out.push(b);
    }
    return out;
  }
  function recognize(canvas, lang) {
    return getPool(lang).then(function (ws) {
      var live = ws.slice(), bands = splitBands(canvas, live.length);
      return Promise.all(bands.map(function (b, i) { return live[i % live.length].recognize(b); }));
    }).then(function (rs) {
      return rs.map(function (r) { return (r && r.data && r.data.text) || ""; }).join("\n");
    });
  }

  /* Welke taal is dit? Alleen om te zien of we met het verkeerde taalmodel lezen. */
  var NL_W = ["het", "een", "van", "den", "niet", "zijn", "hij", "die", "dat", "maar", "voor", "met", "aan", "ook", "der", "dit", "des", "zij", "gij"];
  var EN_W = ["the", "and", "that", "with", "for", "unto", "shall", "his", "thou", "them", "they", "not", "you", "him", "was", "which"];
  function guessLang(text) {
    var nl = 0, en = 0;
    tok(text).forEach(function (w) { if (NL_W.indexOf(w) >= 0) nl++; if (EN_W.indexOf(w) >= 0) en++; });
    if (en >= 4 && en >= nl * 2) return "eng";
    if (nl >= 4 && nl >= en * 2) return "nld";
    return null;
  }

  /* Beeld voorbereiden: uitsnede, schalen en omzetten naar een schone zwart-wit pagina. */
  function prep(src, sw, sh, crop, maxSide) {
    var cx = crop ? crop.x : 0, cy = crop ? crop.y : 0, cw = crop ? crop.w : sw, ch = crop ? crop.h : sh;
    var scale = Math.min(1, (maxSide || 1500) / Math.max(cw, ch));
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(cw * scale)); c.height = Math.max(1, Math.round(ch * scale));
    var g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(src, cx, cy, cw, ch, 0, 0, c.width, c.height);
    var w = c.width, h = c.height, im = g.getImageData(0, 0, w, h), d = im.data, n = w * h, gray = new Uint8Array(n), i, x, y;
    for (i = 0; i < n; i++) gray[i] = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000 | 0;
    /* Lokale drempel (Bradley): haalt schaduw, ongelijk licht en korrel weg, zoals een documentscanner. */
    var ii = new Uint32Array((w + 1) * (h + 1)), W1 = w + 1, dark = new Uint32Array(h);
    for (y = 0; y < h; y++) {
      var row = 0;
      for (x = 0; x < w; x++) { row += gray[y * w + x]; ii[(y + 1) * W1 + x + 1] = ii[y * W1 + x + 1] + row; }
    }
    var half = Math.max(8, Math.round(Math.min(w, h) / 24)), T = 0.14;
    for (y = 0; y < h; y++) {
      var y0 = Math.max(0, y - half), y1 = Math.min(h - 1, y + half);
      for (x = 0; x < w; x++) {
        var x0 = Math.max(0, x - half), x1 = Math.min(w - 1, x + half), cnt = (x1 - x0 + 1) * (y1 - y0 + 1);
        var sum = ii[(y1 + 1) * W1 + x1 + 1] - ii[y0 * W1 + x1 + 1] - ii[(y1 + 1) * W1 + x0] + ii[y0 * W1 + x0];
        var v = gray[y * w + x] * cnt <= sum * (1 - T) ? 0 : 255, o = (y * w + x) * 4;
        if (v === 0) dark[y]++;
        d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = 255;
      }
    }
    g.putImageData(im, 0, 0);
    c.__dark = dark;
    return c;
  }

  /* Afstand tussen tekstregels (px) uit het inktprofiel per rij; null als er geen duidelijk ritme is. */
  function linePitch(dark) {
    var H = dark.length, i, lag, m = 0;
    if (H < 200) return null;
    for (i = 0; i < H; i++) m += dark[i];
    m /= H;
    var best = 0, ac = [];
    for (lag = 10; lag <= 160 && lag < H / 3; lag++) {
      var sum = 0;
      for (i = 0; i + lag < H; i++) sum += (dark[i] - m) * (dark[i + lag] - m);
      ac[lag] = sum / (H - lag);
      if (ac[lag] > best) best = ac[lag];
    }
    var v0 = 0, k;
    for (i = 0; i < H; i++) v0 += (dark[i] - m) * (dark[i] - m);
    v0 /= H;
    if (!(best > 0.12 * v0)) return null;
    /* Kleinste duidelijke piek: de regelafstand, niet een veelvoud ervan (alinea's of twee regels). */
    for (lag = 11; lag <= 160 && lag < H / 3; lag++) {
      if (ac[lag] >= 0.45 * best && ac[lag] >= ac[lag - 1] && (ac[lag + 1] === undefined || ac[lag] >= ac[lag + 1])) return lag;
    }
    return null;
  }
  /* Staat er tekst in beeld? Tekst heeft een regelritme (afwisselend inkt en wit); een tafel, hand of leeg vlak niet. */
  function textScore(dark, w) {
    var H = dark.length, i, lag, m = 0, r = new Float32Array(H);
    for (i = 0; i < H; i++) { r[i] = dark[i] / w; m += r[i]; }
    m /= H;
    var v0 = 0;
    for (i = 0; i < H; i++) v0 += (r[i] - m) * (r[i] - m);
    v0 /= H;
    var best = 0;
    for (lag = 4; lag <= 80 && lag < H / 3; lag++) {
      var sum = 0;
      for (i = 0; i + lag < H; i++) sum += (r[i] - m) * (r[i + lag] - m);
      sum /= (H - lag);
      if (sum > best) best = sum;
    }
    var rhythm = v0 > 0 ? best / v0 : 0;
    var cv = m > 0 ? Math.sqrt(v0) / m : 0;   /* hoe sterk wisselen inkt en wit per rij */
    return { ink: m, rhythm: rhythm, cv: cv, text: m >= 0.012 && m <= 0.22 && v0 > 1e-5 && rhythm >= 0.25 && cv >= 0.55 };
  }

  /* Tekst die groot in beeld staat hoeft niet op volle grootte gelezen te worden: schaal naar ca. 26 px regelafstand (getest: tot 23 px geen verlies). */
  function prepAuto(src, sw, sh, crop, maxSide) {
    var c = prep(src, sw, sh, crop, maxSide), p = linePitch(c.__dark);
    c.__pitch = p;
    if (p && p > 30) {
      var f = Math.max(0.55, 26 / p);   /* hoogstens 45% kleiner: de meting kan ernaast zitten */
      var c2 = prep(src, sw, sh, crop, Math.max(560, Math.round(Math.max(c.width, c.height) * f)));
      c2.__pitch = p; c2.__scaled = true;
      return c2;
    }
    return c;
  }

  /* Kleine vingerafdruk van het beeld: om te zien of de camera stilgehouden wordt. */
  function sig(src, sw, sh, crop) {
    var c = document.createElement("canvas"); c.width = 24; c.height = 32;
    var g = c.getContext("2d", { willReadFrequently: true });
    if (crop) g.drawImage(src, crop.x, crop.y, crop.w, crop.h, 0, 0, 24, 32); else g.drawImage(src, 0, 0, sw, sh, 0, 0, 24, 32);
    var d = g.getImageData(0, 0, 24, 32).data, out = new Uint8Array(24 * 32), i;
    for (i = 0; i < out.length; i++) out[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
    return out;
  }
  function sigDiff(a, b) {
    var s = 0, i;
    for (i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    return s / a.length;
  }

  /* ---------- Uiterlijk (tokens van de site, zie sectie 2 van CLAUDE.md) ---------- */
  /* Stijl van de sites: wit en licht, met vrolijke kleuraccenten (oranje, groen, roze) en foto's. */
  var CSS =
    ".osc-root{--am:#E8A33D;--am-s:#FFF3DD;--am-d:#B9741A;--gr:#2E9B5E;--gr-s:#E4F4E9;--pk:#D9486B;--pk-s:#FDE7EA;--bl-s:#E3EEF5;position:fixed;inset:0;z-index:99990;display:flex;flex-direction:column;background:var(--surface,#fff);color:var(--ink,#1d2b33);font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}" +
    ".osc-top{display:flex;align-items:center;gap:12px;flex:none;padding:calc(env(safe-area-inset-top) + 12px) 16px 6px}" +
    ".osc-top h2{margin:0;flex:1;font:600 18px 'DM Sans',Inter,sans-serif!important;color:var(--ink,#1d2b33)!important;text-align:left!important}" +
    ".osc-x{width:36px;height:36px;border-radius:999px;border:0;background:var(--paper-deep,#eaeef0);color:var(--ink-soft,#3C5E70);display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none}" +
    ".osc-x:active{transform:scale(.94)}" +
    ".osc-intro{display:flex;align-items:center;gap:12px;flex:none;padding:8px 16px 12px}" +
    ".osc-tile{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex:none}" +
    ".osc-tile.am{background:var(--am-s);color:var(--am-d)}.osc-tile.gr{background:var(--gr-s);color:var(--gr)}.osc-tile.pk{background:var(--pk-s);color:var(--pk)}.osc-tile.bl{background:var(--bl-s);color:var(--terracotta,#3C5E70)}" +
    ".osc-hint{margin:0;font-size:14px;line-height:1.4;color:var(--ink-soft,#3C5E70)}" +
    ".osc-main{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;gap:12px;padding:0 0 12px;width:100%;max-width:640px;margin:0 auto}" +
    ".osc-frame{position:relative;flex:1;min-height:0;width:100%;border-radius:0 0 28px 28px;overflow:hidden;background:var(--am-s);box-shadow:0 10px 30px rgba(29,43,51,.12)}" +
    ".osc-frame video,.osc-frame canvas.osc-still{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}" +
    ".osc-empty{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:28px;text-align:center;background:linear-gradient(165deg,var(--am-s),#fff 70%)}" +
    ".osc-idle .osc-empty{display:flex}" +
    ".osc-ei{width:68px;height:68px;border-radius:22px;background:var(--am);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(232,163,61,.45);animation:oscBob 2.2s ease-in-out infinite}" +
    "@keyframes oscBob{50%{transform:translateY(-5px)}}" +
    ".osc-et{font-size:14.5px;line-height:1.45;color:var(--ink,#1d2b33);max-width:270px;font-weight:500}" +
    ".osc-eh{font-size:12.5px;line-height:1.5;color:var(--ink-soft,#3C5E70);max-width:290px}.osc-eh[hidden]{display:none}" +
    ".osc-er{border:0;border-radius:999px;background:var(--terracotta,#3C5E70);color:#fff;font:600 14px Inter,sans-serif;padding:11px 22px;cursor:pointer}" +
    ".osc-er[hidden]{display:none}.osc-er:active{background:var(--terracotta-deep,#2c4757)}" +
    ".osc-eb{border:1px solid rgba(29,43,51,.15);border-radius:999px;background:var(--surface,#fff);color:var(--ink,#1d2b33);font:600 13px Inter,sans-serif;padding:9px 18px;cursor:pointer}" +
    ".osc-eb[hidden]{display:none}.osc-eb:active{background:var(--paper-deep,#eaeef0)}" +
    ".osc-bad .osc-ei{background:var(--pk-s);color:var(--pk);box-shadow:none;animation:none}" +
    ".osc-c{position:absolute;width:36px;height:36px;border:4px solid var(--am);pointer-events:none;filter:drop-shadow(0 1px 3px rgba(0,0,0,.3))}" +
    ".osc-idle .osc-c{opacity:.9;filter:none}" +
    ".osc-c.tl{top:18px;left:18px;border-right:0;border-bottom:0;border-top-left-radius:14px}" +
    ".osc-c.tr{top:18px;right:18px;border-left:0;border-bottom:0;border-top-right-radius:14px}" +
    ".osc-c.bl{bottom:18px;left:18px;border-right:0;border-top:0;border-bottom-left-radius:14px}" +
    ".osc-c.br{bottom:18px;right:18px;border-left:0;border-top:0;border-bottom-right-radius:14px}" +
    ".osc-line{position:absolute;left:24px;right:24px;top:24px;height:3px;border-radius:3px;background:linear-gradient(90deg,transparent,var(--am),transparent);box-shadow:0 0 16px 3px rgba(232,163,61,.6);pointer-events:none;animation:oscSweep 2.6s ease-in-out infinite alternate}" +
    "@keyframes oscSweep{from{transform:translateY(0)}to{transform:translateY(calc(var(--osc-h,300px) - 52px))}}" +
    ".osc-idle .osc-line,.osc-nocam .osc-c{display:none}.osc-nocam~.osc-status{display:none}" +
    ".osc-wait~.osc-status .osc-dot{background:var(--ink-muted,#9aa7af);animation:none}.osc-wait .osc-line{opacity:.25}" +
    ".osc-status{display:flex;align-items:center;justify-content:center;gap:8px;width:calc(100% - 32px);min-height:20px;flex:none;font:600 13px Inter,sans-serif;color:var(--ink-soft,#3C5E70);text-align:center}.osc-status .osc-st{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".osc-dot{width:8px;height:8px;border-radius:99px;background:var(--gr);flex:none;animation:oscPulse 1.2s ease-in-out infinite}" +
    "@keyframes oscPulse{50%{transform:scale(1.5);opacity:.5}}" +
    ".osc-below{width:calc(100% - 32px);min-height:158px;flex:none;display:flex;flex-direction:column;gap:10px}.osc-tips{display:flex;gap:8px;width:100%;flex:none}" +
    ".osc-tips[hidden]{display:none}" +
    ".osc-tip{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 6px;border-radius:12px;font:600 11.5px Inter,sans-serif;line-height:1.2;white-space:nowrap}" +
    ".osc-tip svg{flex:none}.osc-tip.am{background:var(--am-s);color:var(--am-d)}.osc-tip.gr{background:var(--gr-s);color:var(--gr)}.osc-tip.pk{background:var(--pk-s);color:var(--pk)}" +
    ".osc-card{flex-wrap:wrap;width:100%;background:var(--surface,#fff);border:1px solid rgba(29,43,51,.08);border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:12px;box-shadow:0 6px 20px rgba(29,43,51,.1);flex:none}" +
    ".osc-card[hidden],.osc-msg[hidden]{display:none}" +
    ".osc-ok{width:40px;height:40px;border-radius:12px;background:var(--gr-s);color:var(--gr);display:flex;align-items:center;justify-content:center;flex:none}" +
    ".osc-ct{flex:1;min-width:0}" +
    ".osc-lab{font:700 11px Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--gr)}" +
    ".osc-ref{font:600 18px 'DM Sans',Inter,sans-serif;color:var(--ink,#1d2b33);margin-top:1px;line-height:1.2;overflow-wrap:anywhere}" +
    ".osc-sub{display:flex;align-items:center;gap:8px;margin-top:4px}" +
    ".osc-chip{padding:2px 9px;border-radius:999px;background:var(--bl-s);color:var(--terracotta,#3C5E70);font:600 11.5px Inter,sans-serif}" +
    ".osc-pips{display:flex;gap:4px}.osc-pips i{width:14px;height:4px;border-radius:4px;background:var(--line-strong,#d2d9dd);transition:background .2s}.osc-pips i.on{background:var(--am)}" +
    ".osc-pen{width:26px;height:26px;border:0;border-radius:99px;background:var(--paper-deep,#eaeef0);color:var(--ink-soft,#3C5E70);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}" +
    ".osc-segs{order:3;flex-basis:100%;display:flex;flex-wrap:wrap;align-items:center;gap:6px;font:600 12px Inter,sans-serif;color:var(--ink-soft,#3C5E70)}.osc-segs[hidden]{display:none}.osc-seg{border:1px solid rgba(29,43,51,.15);background:var(--surface,#fff);color:var(--ink,#1d2b33);border-radius:999px;padding:6px 12px;font:600 12.5px Inter,sans-serif;cursor:pointer}.osc-seg:active{background:var(--paper-deep,#eaeef0)}"
    + ".osc-er2{display:flex;align-items:center;gap:6px}.osc-lb{min-width:26px}.osc-er2 i{font-style:normal;color:var(--ink-muted,#9aa7af)}" +
    ".osc-edit{order:3;flex-basis:100%;display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding-top:2px;font:600 12px Inter,sans-serif;color:var(--ink-soft,#3C5E70)}.osc-edit[hidden]{display:none}" +
    ".osc-step{display:inline-flex;align-items:center;gap:2px;background:var(--paper-deep,#eaeef0);border-radius:999px;padding:2px}" +
    ".osc-step button{width:26px;height:26px;border:0;border-radius:99px;background:var(--surface,#fff);color:var(--ink,#1d2b33);font:600 16px/1 Inter,sans-serif;cursor:pointer;padding:0}" +
    ".osc-step b{min-width:26px;text-align:center;font:600 13px Inter,sans-serif;color:var(--ink,#1d2b33)}" +
    ".osc-all{border:1px solid rgba(29,43,51,.15);background:var(--surface,#fff);color:var(--ink,#1d2b33);border-radius:999px;padding:5px 10px;font:600 12px Inter,sans-serif;cursor:pointer}" +
    ".osc-go{order:2;border:0;border-radius:999px;background:var(--terracotta,#3C5E70);color:#fff;font:600 14px Inter,sans-serif;padding:11px 20px;cursor:pointer;flex:none}" +
    ".osc-go:active{background:var(--terracotta-deep,#2c4757)}" +
    ".osc-msg{width:100%;font-size:13.5px;line-height:1.45;color:var(--ink-soft,#3C5E70);text-align:center;padding:4px 8px;flex:none}" +
    ".osc-bar{display:grid;grid-template-columns:1fr 68px 1fr;align-items:center;gap:10px;width:100%;flex:none;padding:8px 20px calc(env(safe-area-inset-bottom) + 16px)}" +
    ".osc-bar>*{min-width:0}" +
    ".osc-pick{display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid rgba(29,43,51,.12);background:var(--surface,#fff);color:var(--ink,#1d2b33);border-radius:999px;padding:10px 8px;font:600 12.5px Inter,sans-serif;cursor:pointer;white-space:nowrap}" +
    ".osc-pick svg{color:var(--terracotta,#3C5E70)}.osc-pick:active{background:var(--paper-deep,#eaeef0)}" +
    ".osc-pick input{display:none}" +
    ".osc-bar .osc-shot{flex:none;min-width:68px;width:68px;height:68px;border-radius:999px;border:4px solid var(--am);background:var(--surface,#fff);padding:0;cursor:pointer;position:relative;box-shadow:0 8px 20px rgba(232,163,61,.4)}" +
    ".osc-shot::after{content:'';position:absolute;inset:5px;border-radius:999px;background:var(--am);transition:transform .15s}" +
    ".osc-shot:active::after{transform:scale(.86)}" +
    ".osc-sp{display:flex;justify-content:flex-end}.osc-pick{justify-self:start}" +
    ".osc-retry{border:1px solid rgba(29,43,51,.12);background:var(--surface,#fff);color:var(--ink,#1d2b33);border-radius:999px;padding:10px 16px;font:600 13px Inter,sans-serif;cursor:pointer}" +
    ".osc-retry[hidden]{display:none}.osc-retry:active{background:var(--paper-deep,#eaeef0)}" +
    "@media (max-width:350px){.osc-pick span{display:none}.osc-pick{padding:11px;justify-self:start}.osc-tip svg{display:none}.osc-tip{padding:9px 4px;font-size:11px}.osc-retry{padding:9px 12px}.osc-card{gap:10px}.osc-go{padding:11px 16px}}" +
    "@media (max-height:600px) and (orientation:portrait){.osc-top{padding-top:calc(env(safe-area-inset-top) + 6px);padding-bottom:0}.osc-bar{grid-template-columns:1fr 54px 1fr;padding-top:2px;padding-bottom:calc(env(safe-area-inset-bottom) + 8px)}.osc-bar .osc-shot{width:54px;height:54px;min-width:54px}.osc-below{min-height:138px;gap:6px}.osc-card{padding:8px 12px}.osc-main{gap:6px}}" +
    "@media (max-height:700px) and (orientation:portrait){.osc-intro{display:none}.osc-below{min-height:150px}}" +
    "@media (min-width:700px) and (orientation:portrait){.osc-main{padding-top:4px}.osc-frame{border-radius:24px;width:calc(100% - 32px)}}" +
    "@media (prefers-reduced-motion:reduce){.osc-line,.osc-dot,.osc-ei{animation:none}}" +
    "@media (orientation:landscape) and (max-height:500px){.osc-intro,.osc-tips{display:none}.osc-top{padding-top:calc(env(safe-area-inset-top) + 6px);padding-bottom:4px}.osc-main{flex-direction:row;align-items:stretch;padding:4px 16px 0;max-width:none}.osc-frame{border-radius:20px}.osc-below{min-height:0;width:auto;align-self:center;max-width:300px}.osc-status{position:absolute;top:calc(env(safe-area-inset-top) + 14px);right:16px;width:auto;max-width:55%;min-height:0}.osc-card,.osc-msg{width:auto}.osc-card,.osc-msg{max-width:280px;align-self:center}.osc-bar{padding-top:6px;padding-bottom:8px}.osc-bar .osc-shot{width:56px;height:56px;min-width:56px}}";


  /* Nieuwe stijl (logo): wit en zacht, leisteenblauw met drie bollen. Staat bewust na CSS, zodat het wint. */
  var CSS2 =
    ".osc-root{--sl:#2b566e;--sl-d:#1f4357;--sl-s:#5d7f93;--tb:#e6f5ff;--ty:#fff6d1;--tg:#eefad2;--tl:#e3ebf0;background:#fff;overflow:hidden}" +
    ".osc-root::before{content:'';position:absolute;width:300px;height:300px;right:-120px;top:-130px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#8adcff,#11a6f7 60%,#0a7fdc);opacity:.16;pointer-events:none}" +
    ".osc-root::after{content:'';position:absolute;width:220px;height:220px;left:-100px;bottom:-90px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#dcf76a,#8fd11e 60%,#5fae0a);opacity:.14;pointer-events:none}" +
    ".osc-root>*{position:relative;z-index:1}" +
    ".osc-root,.osc-root *,.osc-root *::before,.osc-root *::after{box-sizing:border-box}" +
    ".osc-o{display:inline-block;flex:none;width:12px;height:12px;border-radius:50%;font-style:normal}" +
    ".osc-o.b{background:radial-gradient(circle at 35% 30%,#8adcff,#11a6f7 55%,#0a7fdc)}.osc-o.y{background:radial-gradient(circle at 35% 30%,#fff39a,#ffd21a 55%,#e6a500)}.osc-o.g{background:radial-gradient(circle at 35% 30%,#dcf76a,#8fd11e 55%,#5fae0a)}" +
    ".osc-top{padding-top:calc(env(safe-area-inset-top) + 18px)}" +
    ".osc-top h2{font:700 24px 'DM Sans',Inter,sans-serif!important;letter-spacing:-.01em;color:var(--sl)!important}" +
    ".osc-x{width:40px;height:40px;background:#e9f0f5;color:var(--sl)}" +
    ".osc-tile{display:none}.osc-intro{padding:2px 20px 12px}.osc-hint{color:var(--sl-s);font-size:14px}" +
    ".osc-frame{width:calc(100% - 36px);border-radius:30px;background:#f4f8fb;border:1px solid var(--tl);box-shadow:none}" +
    ".osc-c{border-color:var(--sl);filter:drop-shadow(0 0 2px rgba(255,255,255,.85));width:38px;height:38px;z-index:3}" +
    ".osc-c.tl{top:16px;left:16px;border-top-left-radius:16px}.osc-c.tr{top:16px;right:16px;border-top-right-radius:16px}.osc-c.bl{bottom:16px;left:16px;border-bottom-left-radius:16px}.osc-c.br{bottom:16px;right:16px;border-bottom-right-radius:16px}" +
    ".osc-line{background:linear-gradient(90deg,transparent,#11a6f7,transparent);box-shadow:0 0 18px 4px rgba(17,166,247,.45);z-index:2}" +
    ".osc-empty{background:#f4f8fb}" +
    ".osc-ei{position:relative;width:112px;height:104px;border-radius:0;background:none;box-shadow:none;color:#fff;animation:none;display:block}" +
    ".osc-es{position:absolute;left:20px;top:16px;width:72px;height:72px;background:var(--sl);border-radius:26px;display:flex;align-items:center;justify-content:center;z-index:2;box-shadow:0 10px 22px rgba(43,86,110,.3)}" +
    ".osc-es svg{width:32px;height:32px}" +
    ".osc-ei .osc-o{position:absolute;z-index:1}.osc-ei .osc-o.b{width:40px;height:40px;right:2px;top:2px}.osc-ei .osc-o.y{width:32px;height:32px;left:0;top:42px}.osc-ei .osc-o.g{width:38px;height:38px;right:6px;bottom:0}" +
    ".osc-bad .osc-ei{background:none}" +
    ".osc-et{font:700 20px 'DM Sans',Inter,sans-serif;color:var(--sl)}.osc-eh{color:var(--sl-s);font-size:13.5px}" +
    ".osc-er{background:var(--sl);box-shadow:0 8px 18px rgba(43,86,110,.28);height:44px;padding:0 24px}.osc-er:active{background:var(--sl-d)}" +
    ".osc-eb{border:1.5px solid var(--tl);color:var(--sl)}" +
    ".osc-status{color:var(--sl);font-size:14px}" +
    ".osc-dot{width:12px;height:12px;background:radial-gradient(circle at 35% 30%,#8adcff,#11a6f7 55%,#0a7fdc)}" +
    ".osc-wait~.osc-status .osc-dot{background:#c5d0d7}" +
    ".osc-tip{height:38px;padding:0 6px;border-radius:999px;font:600 12.5px Inter,sans-serif;color:var(--sl-d);gap:7px}" +
    ".osc-tip.y{background:var(--ty)}.osc-tip.b{background:var(--tb)}.osc-tip.g{background:var(--tg)}" +
    ".osc-card{border-radius:26px;border:1px solid var(--tl);box-shadow:0 18px 50px rgba(43,86,110,.14);padding:14px 16px}" +
    ".osc-ok{width:36px;height:36px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#dcf76a,#8fd11e 55%,#5fae0a);color:#fff}" +
    ".osc-lab{color:#5fae0a}.osc-ref{font:700 24px 'DM Sans',Inter,sans-serif;color:var(--sl);letter-spacing:-.01em}" +
    ".osc-chip{background:var(--sl);color:#fff;padding:3px 11px;font-size:12px}" +
    ".osc-vt{margin-top:6px;padding-left:12px;border-left:4px solid #ffd21a;font-size:13.5px;line-height:1.5;color:var(--ink,#1d2b33);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.osc-vt:empty{display:none}" +
    ".osc-pips i.on{background:#11a6f7}.osc-pen{background:#e9f0f5;color:var(--sl)}" +
    ".osc-go{background:var(--sl);box-shadow:0 8px 18px rgba(43,86,110,.28);height:46px}.osc-go:active{background:var(--sl-d)}" +
    ".osc-seg,.osc-all{border-color:var(--tl);color:var(--sl)}" +
    ".osc-multi{width:100%;flex:none;display:flex;flex-direction:column;gap:8px;background:#fff;border:1px solid var(--tl);border-radius:26px;box-shadow:0 18px 50px rgba(43,86,110,.14);padding:12px 12px 10px;max-height:270px}.osc-multi[hidden]{display:none}" +
    ".osc-mh{display:flex;align-items:center;gap:10px;padding:0 4px;font:700 15px 'DM Sans',Inter,sans-serif;color:var(--sl)}.osc-okm{width:28px;height:28px}.osc-okm svg{width:16px;height:16px}" +
    ".osc-ml{display:flex;flex-direction:column;gap:8px;overflow-y:auto;-webkit-overflow-scrolling:touch;min-height:0}" +
    ".osc-mr{display:flex;flex-direction:column;gap:3px;text-align:left;border:1.5px solid var(--tl);background:#f4f8fb;border-radius:18px;padding:10px 14px;cursor:pointer;font-family:Inter,sans-serif;color:var(--ink,#1d2b33)}.osc-mr:active{background:#e6f5ff;border-color:#11a6f7}" +
    ".osc-mrt{display:flex;align-items:center;gap:8px}.osc-mrt b{font:700 17px 'DM Sans',Inter,sans-serif;color:var(--sl)}.osc-mrt .osc-chip{padding:2px 9px;font-size:11px}" +
    ".osc-mrv{font-size:12.5px;line-height:1.4;color:var(--sl-s);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
    ".osc-below{min-height:150px}" +
    ".osc-row{display:flex;align-items:stretch;gap:6px}.osc-row .osc-mr{flex:1;min-width:0}" +
    ".osc-qa{display:flex;flex-direction:column;justify-content:center;gap:6px;flex:none}" +
    ".osc-q{width:42px;height:42px;border-radius:50%;border:1.5px solid var(--tl);background:#fff;color:var(--sl);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;transition:transform .12s}.osc-q:active{transform:scale(.9)}" +
    ".osc-q.on{background:#ffd21a;border-color:#e6a500;color:var(--sl-d)}.osc-q.on svg{fill:currentColor;fill-opacity:.25}.osc-q.hl.on{background:#fff39a;border-color:#ffd21a}" +
    ".osc-bulk{display:flex;gap:8px;padding:0 2px}.osc-bulk[hidden]{display:none}" +
    ".osc-bk{flex:1;min-width:0;height:40px;border-radius:999px;border:1.5px solid var(--tl);background:#f4f8fb;color:var(--sl);font:600 12.5px Inter,sans-serif;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;white-space:nowrap;padding:0 8px}.osc-bk svg{width:17px;height:17px;flex:none}.osc-bk.on{background:#fff39a;border-color:#ffd21a}" +

    ".osc-pick{height:44px;border:1.5px solid var(--tl);color:var(--sl);padding:0 10px}.osc-pick svg{color:var(--sl)}" +
    ".osc-bar .osc-shot{width:80px;height:80px;min-width:80px;border:5px solid var(--sl);box-shadow:0 10px 24px rgba(43,86,110,.22)}" +
    ".osc-shot::after{inset:8px;background:radial-gradient(circle at 35% 30%,#8adcff,#11a6f7 55%,#0a7fdc)}" +
    ".osc-bar{grid-template-columns:minmax(0,1fr) 80px minmax(0,1fr)}" +
    ".osc-retry{border:1.5px solid var(--tl);color:var(--sl)}" +
    ".osc-sp .osc-pick{justify-self:end;margin-left:auto}.osc-retry:not([hidden])+.osc-take{display:none}" +
    "@media (max-height:700px) and (orientation:portrait){.osc-bar .osc-shot{width:64px;height:64px;min-width:64px}.osc-bar{grid-template-columns:minmax(0,1fr) 64px minmax(0,1fr)}.osc-multi{max-height:220px}.osc-top h2{font-size:20px}}" +
    "@media (orientation:landscape) and (max-height:500px){.osc-frame{border-radius:20px;width:auto}.osc-bar .osc-shot{width:56px;height:56px;min-width:56px}.osc-bar{grid-template-columns:minmax(0,1fr) 56px minmax(0,1fr)}.osc-multi{max-width:300px;align-self:center;max-height:240px}.osc-top h2{font-size:20px}}" +
    ".osc-import-only .osc-shot,.osc-import-only .osc-take{display:none!important}.osc-import-only .osc-bar{grid-template-columns:1fr}.osc-import-only .osc-pick{width:100%}.osc-import-only .osc-tips{display:none}.osc-import-only .osc-frame{min-height:150px}" +
    "@media (max-width:350px){.osc-tip .osc-o{display:none}}";

  var ICON = {
    back: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    cam: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
    image: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v14H4z"/><path d="M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/><path d="M4 16l5-5 4 4 3-3 4 4"/></svg>',
    scan: '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v2"/><path d="M20 16v2a2 2 0 0 1-2 2h-2"/><path d="M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 8h4l2 2v5H9z"/></svg>',
    scanS: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2"/><path d="M16 4h2a2 2 0 0 1 2 2v2"/><path d="M20 16v2a2 2 0 0 1-2 2h-2"/><path d="M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 8h4l2 2v5H9z"/></svg>',
    star: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.9l6-.9z"/></svg>',
    mark: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4l5 5-8.5 8.5H6.5v-5z"/><path d="M4 21h9"/></svg>',
    pen: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    sun: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/></svg>',
    still: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/></svg>',
    lines: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M5 12h14M5 17h9"/></svg>'
  };

  /* ---------- Camera uit ---------- */
  /* De opname stopt meteen als de scanner sluit of de pagina of app naar de achtergrond gaat (de indicator van het toestel gaat dan uit). */
  function stopStream(stream) {
    try { stream && stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
  }
  function keepCam(stream) { stopStream(stream); W.__onkCamKeep = null; }
  function takeKept() { return null; }

  /* iPhone/iPad als app op het beginscherm: iOS vraagt daar bij elke start opnieuw om de camera en er is geen instelling voor.
     Daar beginnen we met de camera-app van het toestel (geen toestemming nodig); live scannen blijft een keuze. */
  function isIosStandalone() {
    try {
      var ua = navigator.userAgent || "", ios = /iPhone|iPad|iPod/.test(ua) || (/Mac/.test(ua) && navigator.maxTouchPoints > 1);
      var sa = navigator.standalone === true || (W.matchMedia && W.matchMedia("(display-mode: standalone)").matches);
      return !!(ios && sa);
    } catch (e) { return false; }
  }

  function isPhoneDevice() {
    try {
      var ua = navigator.userAgent || "";
      return /iPhone|iPod/.test(ua) || (/Android/.test(ua) && /Mobile/.test(ua));
    } catch (e) { return false; }
  }

  /* ---------- De scanner ---------- */
  var S = null; /* actieve sessie */

  function open() {
    if (S) return;
    var importOnly = !isPhoneDevice();
    if (!document.getElementById("osc-css")) {
      var st = document.createElement("style"); st.id = "osc-css"; st.textContent = CSS + CSS2; document.head.appendChild(st);
    }
    var root = document.createElement("div");
    root.className = "osc-root" + (importOnly ? " osc-import-only" : "");
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", L("Bijbel scannen", "Scan the Bible"));
    root.innerHTML =
      '<div class="osc-top"><button type="button" class="osc-x" aria-label="' + L("Terug", "Back") + '">' + ICON.back + '</button><h2>' + L("Bijbel scannen", "Scan the Bible") + '</h2></div>' +
      '<div class="osc-intro"><span class="osc-tile am">' + ICON.scanS + '</span><p class="osc-hint">' + L(importOnly ? "Kies of plak een foto van een stukje uit de Bijbel. Wij zoeken het vers op." : "Richt de camera op een stukje uit de Bijbel. Wij zoeken het vers op.", importOnly ? "Choose or paste a photo of a Bible passage. We find the verse." : "Point the camera at a part of the Bible. We find the verse.") + '</p></div>' +
      '<div class="osc-main"><div class="osc-frame osc-idle"><video playsinline muted autoplay></video><canvas class="osc-still" hidden></canvas>' +
      '<div class="osc-empty"><span class="osc-ei"><i class="osc-o b"></i><i class="osc-o y"></i><i class="osc-o g"></i><span class="osc-es">' + ICON.scan + '</span></span><span class="osc-et">' + L(importOnly ? "Kies een foto\u2026" : "Camera starten\u2026", importOnly ? "Choose a photo\u2026" : "Starting camera\u2026") + '</span><span class="osc-eh" hidden></span><button type="button" class="osc-er" hidden>' + L("Opnieuw proberen", "Try again") + '</button><button type="button" class="osc-eb"' + (importOnly ? "" : " hidden") + '>' + L("Foto kiezen", "Choose photo") + '</button></div>' +
      '<i class="osc-c tl"></i><i class="osc-c tr"></i><i class="osc-c bl"></i><i class="osc-c br"></i><div class="osc-line"></div>' +
      '</div>' +
      '<div class="osc-status"><span class="osc-dot"></span><span class="osc-st"></span></div>' +
      '<div class="osc-below"><div class="osc-tips"><span class="osc-tip y"><i class="osc-o y"></i><span>' + L("Goed licht", "Good light") + '</span></span><span class="osc-tip b"><i class="osc-o b"></i><span>' + L("Houd stil", "Hold still") + '</span></span><span class="osc-tip g"><i class="osc-o g"></i><span>' + L("Tekst recht", "Text straight") + '</span></span></div>' +
      '<div class="osc-card" hidden><span class="osc-ok">' + ICON.check + '</span><div class="osc-ct"><div class="osc-lab">' + L("Gevonden", "Found") + '</div><div class="osc-ref"></div>' +
      '<div class="osc-vt"></div><div class="osc-sub"><span class="osc-chip"></span><span class="osc-pips"><i></i><i></i></span><button type="button" class="osc-pen" aria-label="' + L("Verzen aanpassen", "Adjust verses") + '">' + ICON.pen + '</button></div></div>' +
      '<div class="osc-segs" hidden></div>' +
      '<div class="osc-edit" hidden>' +
      '<div class="osc-er2"><span class="osc-lb">' + L("van", "from") + '</span><span class="osc-step"><button type="button" data-a="sc-">\u2212</button><b class="osc-sc"></b><button type="button" data-a="sc+">+</button></span><i>:</i><span class="osc-step"><button type="button" data-a="sv-">\u2212</button><b class="osc-sv"></b><button type="button" data-a="sv+">+</button></span></div>' +
      '<div class="osc-er2"><span class="osc-lb">' + L("tot", "to") + '</span><span class="osc-step"><button type="button" data-a="ec-">\u2212</button><b class="osc-ec"></b><button type="button" data-a="ec+">+</button></span><i>:</i><span class="osc-step"><button type="button" data-a="ev-">\u2212</button><b class="osc-ev"></b><button type="button" data-a="ev+">+</button></span></div>' +
      '<button type="button" class="osc-all">' + L("Alleen hoofdstuk", "Chapter only") + '</button></div>' +
      '<button type="button" class="osc-go">' + L("Openen", "Open") + '</button></div>' +
      '<div class="osc-multi" hidden><div class="osc-mh"><span class="osc-ok osc-okm">' + ICON.check + '</span><span class="osc-mt"></span></div><div class="osc-bulk" hidden></div><div class="osc-ml"></div></div>' +
      '<div class="osc-msg" hidden></div></div></div>' +
      '<div class="osc-bar"><label class="osc-pick" aria-label="' + L("Foto kiezen", "Choose photo") + '">' + ICON.image + '<span>' + L("Foto kiezen", "Choose photo") + '</span><input type="file" accept="image/*"></label>' +
      '<button type="button" class="osc-shot" aria-label="' + L("Foto maken", "Take photo") + '"></button>' +
      '<div class="osc-sp"><button type="button" class="osc-retry" hidden>' + L("Opnieuw", "Retry") + '</button><label class="osc-pick osc-take" aria-label="' + L("Foto maken met de camera-app", "Take a photo with the camera app") + '">' + ICON.cam + '<span>' + L("Foto maken", "Take photo") + '</span><input type="file" accept="image/*" capture="environment"></label></div></div>';
    document.body.appendChild(root);

    var $ = function (q) { return root.querySelector(q); };
    var frame = $(".osc-frame"), video = $("video"), still = $(".osc-still"), stEl = $(".osc-st"),
      card = $(".osc-card"), multiEl = $(".osc-multi"), tips = $(".osc-tips"), msg = $(".osc-msg"), retry = $(".osc-retry"), pips = root.querySelectorAll(".osc-pips i");

    S = { root: root, stream: null, closed: false, busy: false, frozen: false, timer: 0, last: null, stable: 0, prefer: "sv", reduced: false };
    try { var dv = localStorage.getItem("bible-default-version"); if (dv && VERS.some(function (v) { return v.key === dv; })) S.prefer = dv; } catch (e) {}
    var me = S;

    function status(t) { stEl.textContent = t; }
    function setH() { frame.style.setProperty("--osc-h", frame.clientHeight + "px"); }
    setH();
    var ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(setH) : null;
    ro && ro.observe(frame);

    function close() {
      if (me.closed) return; me.closed = true;
      clearTimeout(me.timer);
      keepCam(me.stream);
      ro && ro.disconnect();
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("pagehide", suspendCam);
      root.remove(); if (S === me) S = null;
    }
    /* Open één deel (de lezer toont een bereik binnen één hoofdstuk). */
    function openSeg(sg, r) {
      close();
      /* De lezer zet de vertaling soms terug als de accountinstellingen binnenkomen: even vasthouden. */
      W.__onkKeepUntil = Date.now() + 8000;
      var q = "?ref=" + r.code + "." + sg.chapter + (sg.vs ? "." + sg.vs + (sg.ve > sg.vs ? "-" + sg.ve : "") : "") + "&v=" + r.version;
      try { history.pushState(null, "", location.pathname + q); } catch (e) {}
      window.dispatchEvent(new CustomEvent("openBibleVerse", {
        detail: { code: r.code, chapter: sg.chapter, verseStart: sg.vs, verseEnd: sg.ve, version: r.version }
      }));
    }
    function openVerse(r) { openSeg(segments(r)[0], r); }
    function segLabel(x) {
      if (!x.vs) return L("Hoofdstuk ", "Chapter ") + x.chapter;
      return x.chapter + ":" + x.vs + (x.ve > x.vs ? "–" + x.ve : "");
    }
    var edit = $(".osc-edit"), segsEl = $(".osc-segs");
    function paint() {
      var c = me.cur; if (!c) return;
      $(".osc-ref").textContent = refLabel(c);
      $(".osc-sc").textContent = c.chapter; $(".osc-sv").textContent = c.verseStart || "–";
      $(".osc-ec").textContent = c.chapterEnd || c.chapter; $(".osc-ev").textContent = c.verseEnd || "–";
      var sg = segments(c);
      if (sg.length > 1) {
        segsEl.hidden = false;
        segsEl.innerHTML = "<span>" + L("Open per hoofdstuk:", "Open by chapter:") + "</span>" + sg.map(function (x, i) { return '<button type="button" class="osc-seg" data-i="' + i + '">' + segLabel(x) + "</button>"; }).join("");
      } else segsEl.hidden = true;
    }
    segsEl.onclick = function (e) {
      var b = e.target.closest && e.target.closest(".osc-seg"); if (!b || !me.cur) return;
      var sg = segments(me.cur)[+b.getAttribute("data-i")];
      if (sg) openSeg(sg, me.cur);
    };
    /* Snel bewaren of markeren zonder de Bijbel te openen (alleen als de app dat kan: favorieten alleen ingelogd). */
    function Q() { return W.__onkQuick || null; }
    function qOk(r) { return !!(r && r.verseStart && !isMulti(r) && Q()); }
    function qSeg(r) { return segments(r)[0]; }
    function qState(r) {
      var q = Q(), sg = qSeg(r);
      return { fav: !!(q && q.signedIn && q.isFav(r.code, sg.chapter, sg.vs, sg.ve)), hl: !!(q && q.isHl(r.version, r.code, sg.chapter, sg.vs, sg.ve)) };
    }
    function qAct(r, a, want) {
      var q = Q(), sg = qSeg(r); if (!q || !qOk(r)) return;
      if (a === "fav") { if (!q.signedIn) return; var cur = q.isFav(r.code, sg.chapter, sg.vs, sg.ve); if (want === undefined || want !== cur) q.fav(r.code, sg.chapter, sg.vs, sg.ve, refLabel(r)); }
      else q.hl(r.version, r.code, sg.chapter, sg.vs, sg.ve, want === undefined ? !qState(r).hl : want);
    }
    function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
    function renderMulti() {
      var all = me.multi || [], q = Q(), signed = !!(q && q.signedIn), flags = me.qFlags = me.qFlags || {};
      var rows = all.map(function (r, i) {
        var st = flags[i] || (flags[i] = qState(r)), ok = qOk(r);
        return '<div class="osc-row"><button type="button" class="osc-mr" data-i="' + i + '"><span class="osc-mrt"><b>' + esc(refLabel(r)) + '</b><i class="osc-chip">' + esc(r.label) + '</i></span><span class="osc-mrv">' + esc(verseText(r)) + '</span></button>' +
          (ok ? '<span class="osc-qa">' + (signed ? '<button type="button" class="osc-q' + (st.fav ? ' on' : '') + '" data-i="' + i + '" data-a="fav" aria-pressed="' + st.fav + '" aria-label="' + L("Favoriet", "Favorite") + '">' + ICON.star + '</button>' : '') +
          '<button type="button" class="osc-q hl' + (st.hl ? ' on' : '') + '" data-i="' + i + '" data-a="hl" aria-pressed="' + st.hl + '" aria-label="' + L("Markeren", "Highlight") + '">' + ICON.mark + '</button></span>' : '') + '</div>';
      }).join("");
      $(".osc-ml").innerHTML = rows;
      var okAll = all.filter(qOk), bulk = $(".osc-bulk");
      if (!okAll.length) { bulk.hidden = true; return; }
      bulk.hidden = false;
      var allFav = okAll.every(function (r) { return flags[all.indexOf(r)].fav; }), allHl = okAll.every(function (r) { return flags[all.indexOf(r)].hl; });
      bulk.innerHTML = (signed ? '<button type="button" class="osc-bk' + (allFav ? ' on' : '') + '" data-a="fav">' + ICON.star + '<span>' + (allFav ? L("Alle favoriet", "All favorited") : L("Alle favoriet", "Favorite all")) + '</span></button>' : '') +
        '<button type="button" class="osc-bk hl' + (allHl ? ' on' : '') + '" data-a="hl">' + ICON.mark + '<span>' + (allHl ? L("Alle gemarkeerd", "All highlighted") : L("Alle markeren", "Highlight all")) + '</span></button>';
    }
    function showMulti(all) {
      msg.hidden = true; card.hidden = true; tips.hidden = true; edit.hidden = true; segsEl.hidden = true; multiEl.hidden = false;
      root.classList.add("osc-has-multi");
      me.cur = null;
      var sameList = me.multi && me.multi.length === all.length && me.multi.every(function (o, i) { return same(o, all[i]); });
      me.multi = all; if (!sameList) me.qFlags = {};
      $(".osc-mt").textContent = all.length + L(" verzen gevonden. Kies er één.", " verses found. Choose one.");
      renderMulti();
    }
    $(".osc-ml").onclick = function (e) {
      var qb = e.target.closest && e.target.closest(".osc-q");
      if (qb && me.multi) {
        var i = +qb.getAttribute("data-i"), a = qb.getAttribute("data-a"), r = me.multi[i], f = me.qFlags[i];
        if (r && f) { qAct(r, a); f[a] = !f[a]; renderMulti(); }
        return;
      }
      var b = e.target.closest && e.target.closest(".osc-mr"); if (!b || !me.multi) return;
      var r2 = me.multi[+b.getAttribute("data-i")]; if (r2) openVerse(r2);
    };
    $(".osc-bulk").onclick = function (e) {
      var b = e.target.closest && e.target.closest(".osc-bk"); if (!b || !me.multi) return;
      var a = b.getAttribute("data-a"), list = me.multi.map(function (r, i) { return [r, i]; }).filter(function (x) { return qOk(x[0]); });
      var want = !list.every(function (x) { return me.qFlags[x[1]][a]; });
      /* Alle verzen in één keer opslaan: apart na elkaar bleef alleen het laatste vers over (de lijst werd pas na een nieuwe weergave bijgewerkt). */
      if (a === "hl" && Q() && Q().hlMany) {
        Q().hlMany(list.map(function (x) { var sg = qSeg(x[0]); return [x[0].version, x[0].code, sg.chapter, sg.vs, sg.ve]; }), want);
        list.forEach(function (x) { me.qFlags[x[1]][a] = want; });
      } else list.forEach(function (x) { qAct(x[0], a, want); me.qFlags[x[1]][a] = want; });
      renderMulti();
    };
    function showResult(r) {
      msg.hidden = true; multiEl.hidden = true; root.classList.remove("osc-has-multi");
      if (me.editing && r) return;   /* tijdens het aanpassen verandert het kaartje niet meer */
      if (!r) { card.hidden = true; tips.hidden = false; me.cur = null; edit.hidden = true; segsEl.hidden = true; return; }
      card.hidden = false; tips.hidden = true;
      me.cur = {}; for (var k in r) me.cur[k] = r[k];
      $(".osc-chip").textContent = r.label;
      $(".osc-vt").textContent = verseText(r);
      paint();
      card.querySelector(".osc-go").onclick = function () { openVerse(me.cur); };
      pips.forEach(function (p, i) { p.className = i < me.stable ? "on" : ""; });
    }
    $(".osc-pen").onclick = function () {
      var c = me.cur; if (!c) return;
      me.editing = true; me.frozen = true; clearTimeout(me.timer); clearTimeout(me.openT);
      if (!c.verseStart) { c.verseStart = 1; c.chapterEnd = c.chapter; c.verseEnd = Math.min(c.counts[c.chapter - 1], 10); }
      edit.hidden = false; retry.hidden = false; paint(); status(L("Verzen aanpassen", "Adjust the verses"));
    };
    edit.onclick = function (e) {
      var b = e.target.closest && e.target.closest("button"), c = me.cur; if (!b || !c) return;
      var counts = c.counts, nch = counts.length;
      if (b.className === "osc-all") { c.verseStart = 0; c.verseEnd = 0; c.chapterEnd = c.chapter; paint(); return; }
      if (!c.verseStart) { c.verseStart = 1; c.chapterEnd = c.chapter; c.verseEnd = Math.min(counts[c.chapter - 1], 10); }
      var a = b.getAttribute("data-a"), sc = c.chapter, sv = c.verseStart, ec = c.chapterEnd || c.chapter, ev = c.verseEnd;
      if (a === "sc-") sc--; if (a === "sc+") sc++; if (a === "sv-") sv--; if (a === "sv+") sv++;
      if (a === "ec-") ec--; if (a === "ec+") ec++; if (a === "ev-") ev--; if (a === "ev+") ev++;
      function cl(ch, v) { ch = Math.min(Math.max(1, ch), nch); v = Math.min(Math.max(1, v), counts[ch - 1]); return [ch, v]; }
      var st = cl(sc, sv), en = cl(ec, ev);
      if (a.charAt(0) === "s") { if (st[0] * 1000 + st[1] > en[0] * 1000 + en[1]) en = st.slice(); }
      else if (en[0] * 1000 + en[1] < st[0] * 1000 + st[1]) st = en.slice();
      c.chapter = st[0]; c.verseStart = st[1]; c.chapterEnd = en[0]; c.verseEnd = en[1];
      paint();
    };

    function showMsg(t) { multiEl.hidden = true; root.classList.remove("osc-has-multi"); card.hidden = true; tips.hidden = true; msg.hidden = false; msg.textContent = t; }

    /* Tekst -> resultaat. */
    function process(text, manual, steady) {
      return loadAll().then(function () {
        var all = decideMany(text, loaded, me.prefer), r = all[0] || null;
        W.__onkScan._last = { text: text, result: r, all: all };
        if (me.closed) return null;
        if (r && same(r, me.last)) me.stable++; else me.stable = r ? 1 : 0;
        if (!r) me.multi = null;
        /* Camera stil gehouden en het resultaat is zeker: meteen openen, geen tweede leesronde nodig. */
        var sure = !!(r && steady && (r.how === "ref" || (r.how === "text" && r.score >= 40)));
        if (sure) me.stable = 2;
        me.last = r;
        /* Meerdere losse verzen gevonden: eerst voorstellen, nooit er zelf een openen. */
        if (all.length > 1 && !me.editing) {
          showMulti(all);
          if (manual || me.stable >= 2) { me.frozen = true; clearTimeout(me.timer); retry.hidden = false; status(L("Kies een vers om te openen", "Choose a verse to open")); }
          return r;
        }
        showResult(r);
        /* Meerdere hoofdstukken: stop met doorlezen, de gebruiker kiest een deel (of leest opnieuw). */
        if (r && isMulti(r) && me.stable >= 2 && !me.editing) {
          me.frozen = true; clearTimeout(me.timer); retry.hidden = false;
          status(L("Kies hieronder een deel om te openen", "Choose a part below to open"));
        }
        /* Over meerdere hoofdstukken: niet zelf openen, want de lezer toont maar één hoofdstuk tegelijk; de gebruiker kiest een deel. */
        if (r && !me.editing && !isMulti(r) && (manual || me.stable >= 2)) me.openT = setTimeout(function () { if (!me.closed && !me.editing) openVerse(me.cur || r); }, manual ? 250 : 450);
        return r;
      });
    }

    /* Lees een beeld; klopt het taalmodel niet (Engelse tekst met het Nederlandse model of andersom), lees opnieuw. */
    function readCanvas(c) {
      return recognize(c, me.lang).then(function (t) {
        var g = guessLang(t);
        if (g && g !== me.lang && !me.langSwitched) {
          me.lang = g; me.langSwitched = true;
          status(L("Taal wisselen\u2026", "Switching language\u2026"));
          return recognize(c, g);
        }
        return t;
      });
    }

    /* Wat de gebruiker in het kader ziet (object-fit: cover) als uitsnede van het beeld. */
    function cropFor(vw, vh) {
      var fw = frame.clientWidth, fh = frame.clientHeight;
      if (!fw || !fh) return null;
      var s = Math.max(fw / vw, fh / vh), w = fw / s, h = fh / s;
      return { x: (vw - w) / 2, y: (vh - h) / 2, w: w, h: h };
    }
    function schedule(ms) { clearTimeout(me.timer); if (!me.closed && !me.frozen) me.timer = setTimeout(tick, ms); }
    function tick() {
      if (me.closed || me.frozen || me.busy || document.hidden) { schedule(500); return; }
      if (!video.videoWidth) { schedule(300); return; }
      me.busy = true; me.langSwitched = false;
      var vw = video.videoWidth, vh = video.videoHeight, crop = cropFor(vw, vh);
      /* Eerst een snelle blik: staat er uberhaupt tekst in beeld? Zo niet, dan blijft het rustig en lezen we niets. */
      var probe = prep(video, vw, vh, crop, 480), ts = textScore(probe.__dark, probe.width);
      W.__onkScan._ts = ts;
      if (!ts.text) {
        me.busy = false; me.moves = 0; me.empty = (me.empty || 0) + 1;
        frame.classList.add("osc-wait");
        if (me.last) { me.last = null; me.stable = 0; me.multi = null; showResult(null); }
        status(me.empty > 12 ? L("Geen tekst gezien. Kom wat dichterbij.", "No text seen. Move a bit closer.") : L("Richt de camera op tekst", "Point the camera at text"));
        schedule(400); return;
      }
      me.empty = 0; frame.classList.remove("osc-wait");
      var s0 = sig(video, vw, vh, crop);
      /* Zelfde beeld als de vorige keer zonder resultaat: niet opnieuw lezen. */
      if (me.noHit && sigDiff(me.noHit, s0) < 6) {
        status(L("Geen vers herkend. Beweeg naar een andere plek.", "No verse recognised. Move to another spot."));
        me.busy = false; schedule(600); return;
      }
      /* Eerst even kijken of de camera stilstaat: een bewogen beeld lezen kost tijd en levert niets op. */
      setTimeout(function () {
        if (me.closed || me.frozen) { me.busy = false; return; }
        var s1 = sig(video, video.videoWidth, video.videoHeight, cropFor(video.videoWidth, video.videoHeight));
        if (sigDiff(s0, s1) >= 8 && (me.moves = (me.moves || 0) + 1) < 12) {
          status(L("Houd de camera stil\u2026", "Hold the camera still\u2026")); me.busy = false; schedule(120); return;
        }
        me.moves = 0; run(s1);
      }, 280);
    }
    function run(s0) {
      status(L("Tekst lezen\u2026", "Reading text\u2026"));
      var t0 = Date.now(), vw = video.videoWidth, vh = video.videoHeight;
      var c = prepAuto(video, vw, vh, cropFor(vw, vh), 1280);
      readCanvas(c).then(function (t) {
        W.__onkScan._ms = Date.now() - t0; W.__onkScan._pitch = c.__pitch;
        var steady = sigDiff(s0, sig(video, video.videoWidth, video.videoHeight, cropFor(video.videoWidth, video.videoHeight))) < 12;
        return process(t, false, steady).then(function (r) { me.noHit = r ? null : s0; return r; });
      }).catch(function () {
        status(L("Scannen lukt niet. Kies een foto.", "Scanning failed. Choose a photo."));
      }).then(function () {
        me.busy = false;
        if (!me.closed && !me.frozen) { status(me.multi && !multiEl.hidden ? L("Kies een vers om te openen", "Choose a verse to open") : isMulti(me.last) ? L("Kies hieronder een deel om te openen", "Choose a part below to open") : me.last ? L("Bijna zeker, even stilhouden\u2026", "Almost sure, hold still\u2026") : me.noHit ? L("Geen vers herkend. Beweeg naar een andere plek.", "No verse recognised. Move to another spot.") : L("Houd de tekst stil in het kader", "Hold the text still in the frame")); schedule(250); }
      });
    }

    /* Eén foto (sluiterknop of gekozen bestand). */
    function single(src, sw, sh, crop) {
      me.frozen = true; clearTimeout(me.timer);
      still.width = sw; still.height = sh;
      if (crop) { still.width = Math.round(crop.w); still.height = Math.round(crop.h); still.getContext("2d").drawImage(src, crop.x, crop.y, crop.w, crop.h, 0, 0, still.width, still.height); }
      else still.getContext("2d").drawImage(src, 0, 0);
      still.hidden = false; frame.classList.remove("osc-idle");
      retry.hidden = false; status(L("Foto lezen…", "Reading photo…"));
      var c = prepAuto(src, sw, sh, crop, 1600);
      me.langSwitched = false;
      var wait = function () { return me.busy ? new Promise(function (r) { setTimeout(r, 200); }).then(wait) : 0; };
      Promise.resolve(wait()).then(function () { me.busy = true; return readCanvas(c); }).then(function (t) { return process(t, true, false); }).then(function (r) {
        status(me.multi && me.multi.length > 1 && !multiEl.hidden ? L("Kies een vers om te openen", "Choose a verse to open") : isMulti(r) ? L("Kies hieronder een deel om te openen", "Choose a part below to open") : r ? L("Gevonden", "Found") : L("Niets herkend", "Nothing recognised"));
        if (!r) showMsg(L("Geen vers herkend. Kom dichterbij, zorg voor licht en houd de tekst recht in beeld.", "No verse recognised. Move closer, add light and keep the text straight."));
      }).catch(function () {
        showMsg(L("Scannen lukt niet. Probeer het opnieuw.", "Scanning failed. Try again."));
      }).then(function () { me.busy = false; });
    }
    function resume() {
      me.frozen = false; me.editing = false; edit.hidden = true; segsEl.hidden = true; clearTimeout(me.openT); still.hidden = true; retry.hidden = true; me.last = null; me.stable = 0; me.noHit = null;
      card.hidden = true; multiEl.hidden = true; root.classList.remove("osc-has-multi"); me.multi = null; msg.hidden = true; tips.hidden = false;
      if (me.camSuspended) { me.camSuspended = false; startCamera(); }
      else if (me.stream) { frame.classList.remove("osc-idle"); schedule(100); }
    }
    function suspendCam() {
      if (!me.stream) return;
      stopStream(me.stream); me.stream = null; me.camSuspended = true;
      try { video.srcObject = null; } catch (e) {}
      frame.classList.add("osc-idle");
    }
    function vis() {
      if (document.hidden) { suspendCam(); return; }
      if (me.camSuspended && !me.closed && !me.frozen) { me.camSuspended = false; startCamera(); return; }
      /* Terug uit de instellingen: de camera zelf opnieuw proberen. */
      if (me.camFailed && !me.camBusy) startCamera();
      if (!me.frozen) schedule(200);
    }
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pagehide", suspendCam);

    W.__onkScan._ui = { showMulti: showMulti, loaded: function () { return loaded; } };
    $(".osc-x").onclick = close;
    $(".osc-eb").onclick = function () { $(".osc-pick input").click(); };
    retry.onclick = resume;
    $(".osc-shot").onclick = function () {
      if (me.stream && video.videoWidth && !me.frozen) single(video, video.videoWidth, video.videoHeight, cropFor(video.videoWidth, video.videoHeight));
      else if (me.frozen) resume();
      else $(".osc-take input").click();
    };
    var processPhoto = function (f) {
      if (!f) return;
      var url = URL.createObjectURL(f), im = new Image();
      im.onload = function () { single(im, im.naturalWidth, im.naturalHeight, null); URL.revokeObjectURL(url); };
      im.onerror = function () { showMsg(L("Deze foto kan niet worden gelezen.", "This photo cannot be read.")); URL.revokeObjectURL(url); };
      im.src = url;
    };
    var onPhoto = function (e) {
      var f = e.target.files && e.target.files[0]; e.target.value = "";
      processPhoto(f);
    };
    root.querySelectorAll(".osc-pick input").forEach(function (inp) { inp.onchange = onPhoto; });
    root.addEventListener("paste", function (e) {
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf("image/") === 0) {
          e.preventDefault(); processPhoto(items[i].getAsFile()); return;
        }
      }
    });
    /* Camera starten, tegelijk de scanner en de vertalingen laden. */
    status(L("Scanner laden…", "Loading scanner…"));
    loadAll();
    me.lang = (isEn() || me.prefer === "kjv") ? "eng" : "nld";
    var enginePromise = importOnly ? Promise.resolve() : getPool(me.lang, function (m) {
      if (m.status && /loading|initial/.test(m.status)) status(L("Scanner laden… ", "Loading scanner… ") + Math.round(m.progress * 100) + "%");
    });
    /* Camera: eerst een eenvoudig verzoek (achtercamera), anders elke camera. Het eerste verzoek mag al in de tik
       zelf gedaan zijn (window.__onkCamP), want iPhone en Safari willen dat de toestemming bij een tik hoort. */
    function camError(e) {
      var n = e && e.name, ua = navigator.userAgent || "", ios = /iPhone|iPad|iPod/.test(ua) || (/Mac/.test(ua) && navigator.maxTouchPoints > 1);
      var inApp = /FBAN|FBAV|Instagram|Telegram|Line\/|Twitter|Snapchat|MicroMessenger|TikTok/i.test(ua);
      if (inApp) return [L("De camera werkt hier niet.", "The camera does not work here."), L("Open deze pagina in Safari of Chrome. In deze app werkt de camera meestal niet.", "Open this page in Safari or Chrome. The camera usually does not work in this app.")];
      if (n === "NotAllowedError" || n === "PermissionDeniedError" || n === "SecurityError")
        return [L("Geen toegang tot de camera.", "No access to the camera."),
          ios ? L("Tik in de adresbalk op aA of •••, kies Websiteinstellingen en zet Camera op Sta toe. Dan hoef je het niet meer elke keer te doen.", "Tap aA or ••• in the address bar, choose Website Settings and set Camera to Allow. Then you will not be asked again.")
              : L("Tik op het slotje bij de adresbalk en sta de camera toe. Probeer het daarna opnieuw.", "Tap the lock icon by the address bar and allow the camera. Then try again.")];
      if (n === "NotFoundError" || n === "DevicesNotFoundError") return [L("Geen camera gevonden.", "No camera found."), L("Kies een foto van de tekst.", "Choose a photo of the text.")];
      if (n === "NotReadableError" || n === "AbortError" || n === "TrackStartError") return [L("De camera is in gebruik.", "The camera is in use."), L("Sluit andere apps die de camera gebruiken en probeer het opnieuw.", "Close other apps that use the camera and try again.")];
      return [L("De camera start niet.", "The camera does not start."), L("Probeer het opnieuw of kies een foto.", "Try again or choose a photo.")];
    }
    function getStream() {
      var md = navigator.mediaDevices;
      if (!md || !md.getUserMedia) return Promise.reject({ name: "NotFoundError" });
      var kept = takeKept();
      if (kept) { W.__onkCamP = null; return Promise.resolve(kept); }
      var first = W.__onkCamP; W.__onkCamP = null;
      var p = first || md.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      return p.catch(function (e) {
        if (e && (e.name === "NotAllowedError" || e.name === "PermissionDeniedError" || e.name === "SecurityError")) throw e;
        return md.getUserMedia({ video: true, audio: false });
      });
    }
    function startCamera() {
      me.camFailed = false; me.camBusy = true; me.photoFirst = false; frame.classList.remove("osc-nocam");
      $(".osc-et").textContent = L("Camera starten…", "Starting camera…");
      $(".osc-eh").hidden = true; $(".osc-er").hidden = true; $(".osc-eb").hidden = true; frame.classList.remove("osc-bad");
      var camP = getStream();
      camP.then(function (stream) {
        if (me.closed) { keepCam(stream); return; }
        me.camBusy = false; me.stream = stream; video.srcObject = stream;
        /* Scherpte en resolutie zo goed mogelijk (niet elk toestel kan dit; dan gebeurt er niets). */
        try {
          var tr = stream.getVideoTracks()[0], caps = tr && tr.getCapabilities ? tr.getCapabilities() : {};
          if (caps.focusMode && caps.focusMode.indexOf("continuous") >= 0) tr.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(function () {});
          tr.applyConstraints({ width: { ideal: 1920 }, height: { ideal: 1080 } }).catch(function () {});
        } catch (e) {}
        var p = video.play(); p && p.catch && p.catch(function () {});
        frame.classList.remove("osc-idle");
        if (me.engineReady) { status(L("Richt de camera op tekst", "Point the camera at text")); schedule(200); }
      }).catch(function (e) {
        me.camFailed = true; me.camBusy = false;
        var m = camError(e);
        frame.classList.add("osc-nocam", "osc-bad");
        $(".osc-et").textContent = m[0]; $(".osc-eh").textContent = m[1]; $(".osc-eh").hidden = false;
        $(".osc-er").hidden = false;
        try { W.__onkScan._camErr = e && e.name; } catch (x) {}
      });
    }
    $(".osc-er").onclick = startCamera;
    /* Zodra de toestemming in de instellingen verandert, start de camera vanzelf. */
    try {
      navigator.permissions && navigator.permissions.query({ name: "camera" }).then(function (ps) {
        ps.onchange = function () { if (!me.closed && me.camFailed && ps.state !== "denied") startCamera(); };
      }).catch(function () {});
    } catch (e) {}
    function showPhotoFirst() {
      me.photoFirst = true;
      $(".osc-et").textContent = L("Maak een foto van de tekst", "Take a photo of the text");
      $(".osc-eh").textContent = L("Je camera-app opent. Daar hoef je geen toestemming voor te geven.", "Your camera app opens. No permission is needed for that.");
      $(".osc-eh").hidden = false;
      $(".osc-er").textContent = L("Live scannen", "Scan live"); $(".osc-er").hidden = false;
      $(".osc-eb").hidden = true;
      status(L("Tik op de ronde knop voor een foto", "Tap the round button for a photo"));
    }
    if (importOnly) {
      frame.classList.add("osc-import-only");
      $(".osc-eh").textContent = L("Kies een foto of plak een afbeelding (Ctrl/Cmd+V).", "Choose a photo or paste an image (Ctrl/Cmd+V).");
      $(".osc-eh").hidden = false;
      status(L("Kies of plak een foto", "Choose or paste a photo"));
    } else if (isIosStandalone() && !(W.__onkCamKeep && W.__onkCamKeep.stream) && !W.__onkCamP) showPhotoFirst(); else startCamera();
    enginePromise.then(function () {
      if (me.closed) return;
      me.engineReady = true;
      if (!me.camFailed) status(importOnly ? L("Kies of plak een foto", "Choose or paste a photo") : me.photoFirst ? L("Tik op de ronde knop voor een foto", "Tap the round button for a photo") : me.stream ? L("Richt de camera op tekst", "Point the camera at text") : L("Camera starten…", "Starting camera…"));
      if (me.stream) schedule(200);
    }).catch(function () {
      status(L("Scanner laadt niet", "Scanner does not load"));
      showMsg(L("De scanner kon niet laden. Controleer je verbinding en probeer het opnieuw.", "The scanner could not load. Check your connection and try again."));
    });
  }

  W.__onkScan.open = open;
  W.__onkScan.close = function () { if (S) { var b = S.root.querySelector(".osc-x"); b && b.click(); } };
})();
