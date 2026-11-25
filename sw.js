/* Offline lezen van de Bijbel.
 *
 * Doet niets zolang de gebruiker geen offline pakket heeft opgeslagen
 * (Instellingen > Offline lezen). Met pakket: eerst het netwerk (je krijgt
 * dus altijd de nieuwste versie als je online bent), en pas als dat niet lukt
 * het opgeslagen pakket. Het pakket wordt door de pagina gedownload; nieuwe
 * versies worden op de achtergrond automatisch opgehaald zodra je online bent.
 *
 * Alleen bestanden van deze site worden bediend. Andere domeinen (inloggen,
 * forum, vertalen) worden nooit aangeraakt.
 */
var META = 'bijbel-offline-meta';
var TIMEOUT_MS = 8000;

function getMeta() {
  return caches.open(META).then(function (c) { return c.match(metaKey()); })
    .then(function (r) { return r ? r.json() : null; })
    .catch(function () { return null; });
}
var updating = false;
function liveTags() {
  return fetch(new URL('./', self.registration.scope).href, { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.text() : ''; })
    .then(function (t) {
      return {
        js: (t.match(/bible\.js\?v=([0-9A-Za-z]+)/) || [])[1],
        css: (t.match(/bible\.css\?v=([0-9A-Za-z]+)/) || [])[1]
      };
    });
}
function autoUpdate(meta) {
  if (updating || !meta || !meta.name) return Promise.resolve();
  updating = true;
  var name = null;
  return liveTags().then(function (tags) {
    if (!tags.js || tags.js === meta.version) return null;
    return fetch(new URL('offline-manifest.json', self.registration.scope).href, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (man) {
        if (!man || !man.core) return null;
        var core = man.core.map(function (e) {
          if (e.url.indexOf('bible.js?v=') === 0) return { url: 'bible.js?v=' + tags.js, size: e.size };
          if (tags.css && e.url.indexOf('bible.css?v=') === 0) return { url: 'bible.css?v=' + tags.css, size: e.size };
          return e;
        });
        var list = core.concat(meta.kt ? (man.kanttekeningen || []) : []);
        name = 'bijbel-offline-' + tags.js + '-' + Date.now();
        var i = 0, bytes = 0;
        return caches.open(name).then(function (cache) {
          function work() {
            if (i >= list.length) return Promise.resolve();
            var e = list[i++], u = new URL(e.url, self.registration.scope).href;
            function attempt(n) {
              return fetch(u).then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.arrayBuffer().then(function (buf) { return cache.put(u, new Response(buf, { status: 200, headers: res.headers })); });
              }).catch(function (err) {
                if (n >= 6) throw err;
                return new Promise(function (r) { setTimeout(r, 1000 * (n + 1)); }).then(function () { return attempt(n + 1); });
              });
            }
            return attempt(0).then(function () { bytes += e.size || 0; }).then(work);
          }
          return Promise.all([work(), work()]);
        }).then(function () {
          var m = { name: name, version: tags.js, kt: !!meta.kt, bytes: bytes, at: Date.now(), files: list.length };
          return caches.open(META).then(function (c) { return c.put(metaKey(), new Response(JSON.stringify(m))); })
            .then(function () { return caches.keys(); })
            .then(function (keys) {
              return Promise.all(keys.filter(function (k) {
                return k.indexOf('bijbel-offline-') === 0 && k !== META && k !== name;
              }).map(function (k) { return caches.delete(k); }));
            });
        });
      });
  })
    .catch(function () { if (name) return caches.delete(name); })   // mislukt: oud pakket blijft werken
    .then(function () { updating = false; });
}

function metaKey() { return new URL('__active', self.registration.scope).href; }
function shellUrl() { return new URL('./', self.registration.scope).href; }

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  // Oude opslag (ook het oude offline-pakket) weghalen, zodat de app nooit een oude versie toont.
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); })
    .then(function () { return self.clients.matchAll({ type: 'window' }); })
    .then(function (cs) { cs.forEach(function (c) { if (c.navigate) c.navigate(c.url); }); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (req.headers.get('X-Onk-Pack')) return;   // het pakket zelf: niet onderscheppen (anders time-out na 8 s bij groot bestand)
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(handle(req));
  if (req.mode === 'navigate') {
    // Online en er is een nieuwere versie? Dan op de achtergrond bijwerken.
    e.waitUntil(getMeta().then(function (m) { return m ? autoUpdate(m) : null; }));
  }
});

function fromPack(req, name) {
  return caches.open(name).then(function (cache) {
    if (req.mode === 'navigate') {
      return cache.match(shellUrl(), { ignoreSearch: true });
    }
    return cache.match(req).then(function (hit) {
      return hit || cache.match(req, { ignoreSearch: true });
    });
  }).then(function (hit) { return hit || Response.error(); });
}

function handle(req) {
  return getMeta().then(function (meta) {
    // Online: altijd de nieuwste versie van de server. Het opgeslagen pakket is alleen voor als er geen verbinding is.
    if (!meta || !meta.name) return fetch(req, { cache: 'no-cache' });
    return fetch(req, { cache: 'no-cache' }).catch(function () { return fromPack(req, meta.name); });
  });
}

// Push-meldingen: een lege push. De melding zegt alleen dat er iets nieuws is (geen inhoud op het scherm van de telefoon).
self.addEventListener('push', function (event) {
  // Met tekst (versleuteld door api/push-notify.js) of leeg (oude melding bij een privébericht).
  var d = null;
  try { d = event.data ? event.data.json() : null; } catch (e) { d = null; }
  var titel = (d && d.title) || 'De Bijbel Online';
  var tekst = (d && d.body) || 'Je hebt een nieuwe melding.';
  var url = (d && d.url) || '/';
  var soort = (d && d.kind) || 'bericht';
  event.waitUntil(self.registration.showNotification(titel, {
    body: tekst,
    icon: 'icon.png',
    badge: 'icon.png',
    tag: 'bijbel-' + soort,
    renotify: true,
    data: { url: url }
  }));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var doel = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (lijst) {
    for (var i = 0; i < lijst.length; i++) { if ('focus' in lijst[i]) return lijst[i].focus(); }
    return self.clients.openWindow(doel);
  }));
});
