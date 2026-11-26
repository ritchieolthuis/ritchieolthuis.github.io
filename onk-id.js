/* Elk account (Ritchie, De Samenkomst) heeft zijn eigen lokale opslag. Dit script staat vóór alle andere code (bible.js bevat dezelfde regels).
   Alle per-account-sleutels (instellingen, markeringen, ontwerpen, zoekgeschiedenis, leespositie, enz.) krijgen '::<gebruikers-id>' erachter zodra je ingelogd bent.
   Uitgelogd blijft alles zoals het was. De oude losse sleutels gaan alleen naar een gewoon account, nooit naar De Samenkomst. */
(function () {
  if (window.__onkId) return; window.__onkId = 1;
  var P = Storage.prototype, gi = P.getItem, si = P.setItem, ri = P.removeItem, ORG = 'c5de1da8-aa8e-47ae-b51c-76d44651a9e7';
  var EXACT = {
    'bible-hl-base': 1, 'bible-hl-pending': 1, 'bible-offline-highlights': 1, 'bible-settings-pending': 1, 'bible-highlights-v2': 1,
    'onk-designs': 1, 'onk-design-style': 1, 'onk-share-tokens': 1, 'onk-account-name': 1, 'onk-design-basket': 1, 'onk-design-resume': 1,
    'bible-resume-pos': 1, 'bible-recents': 1, 'bible-articles-seen': 1, 'bible-buddy-ignore': 1, 'bible-share-basket': 1,
    'bible-custom-bg-local': 1, 'bible-last-read': 1, 'bible-parallel-second': 1, 'onk-streak-rows': 1, 'bible-shortcuts': 1, 'bible-saved-plans': 1, 'onk-tl-favs': 1, 'onk-tl-on': 1, 'bible-read-cover': 1, 'onk-tour': 1
  };
  /* instellingen: ook de varianten met ::phone, ::tablet, ::desktop erachter */
  var SET = ['bible-fontsize', 'bible-linespacing', 'bible-verselayout', 'bible-readingwidth', 'bible-font', 'bible-theme', 'bible-bg-color', 'bible-parallel-colors', 'bible-version-themes', 'bible-text-color', 'bible-version-text-colors', 'bible-version-bg-colors', 'bible-display-name', 'bible-kanttekeningen', 'bible-red-letters', 'bible-highlight-all', 'bible-action-panel', 'bible-action-panel-parallel', 'bible-show-highlights', 'bible-infinite-scroll-v2', 'bible-reading-lines', 'bible-default-version'];
  var PRE = ['onk-recent-', 'onk-zoekteller-', 'bible-del-chat-', 'bible-plan-all-', 'onk-plan-reset-', 'onk-live-'];
  function scoped(k) {
    if (typeof k !== 'string' || k.indexOf('::') > 0 && /::[0-9a-f]{8}-[0-9a-f]{4}-/.test(k)) return false;
    if (EXACT[k] === 1) return true;
    var i; for (i = 0; i < PRE.length; i++) if (k.indexOf(PRE[i]) === 0) return true;
    for (i = 0; i < SET.length; i++) if (k === SET[i] || k.indexOf(SET[i] + '::') === 0) return true;
    return false;
  }
  function sess() {
    try {
      var raw = gi.call(localStorage, 'bible-auth-v1') || gi.call(localStorage, 'sb-vodswfyhlwvhhkqewtap-auth-token');
      var s = raw ? JSON.parse(raw) : null; return s && s.user && s.user.id ? s : null;
    } catch (e) { return null; }
  }
  function ns(k) { var s = sess(); return s ? k + '::' + s.user.id : k; }
  function isOrg() { var s = sess(); return !!s && (s.user.id === ORG || String(s.user.email || '').toLowerCase() === 'info@desamenkomst.nl'); }
  window.__onkId = { uid: function () { var s = sess(); return s ? s.user.id : ''; }, key: ns, scoped: scoped };
  P.getItem = function (k) {
    if (!scoped(k)) return gi.call(this, k);
    var n = ns(k); if (n === k) return gi.call(this, k);
    var v = gi.call(this, n);
    if (v === null && !isOrg()) { /* oude losse sleutel: eenmalig naar dit gewone account verplaatsen */
      var old = gi.call(this, k);
      if (old !== null) { try { si.call(this, n, old); ri.call(this, k); } catch (e) {} return old; }
    }
    return v;
  };
  P.setItem = function (k, v) { return si.call(this, scoped(k) ? ns(k) : k, v); };
  P.removeItem = function (k) { return ri.call(this, scoped(k) ? ns(k) : k); };
})();
