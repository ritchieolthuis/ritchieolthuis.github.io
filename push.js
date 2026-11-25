// Push-meldingen voor De Bijbel. Vraagt eerst om toestemming (niet eerder), en slaat het abonnement op
// van dit apparaat bij het ingelogde account. Zie supabase-push-meldingen.sql en api/push-notify.js.
(function () {
  var VAPID_PUBLIC = 'BNfjff5I4nzNvNdC3T9ANXnkthKKtW8WLUwvVvyqy1VJDNli8mhCe58KjhYHeEwllwwvioIXgoJRgrLFY_Ccnr8';
  var SLEUTEL = 'bijbel-push-keuze';

  function bytes(b64u) {
    var pad = '='.repeat((4 - (b64u.length % 4)) % 4);
    var raw = atob((b64u + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  // De vraag om meldingen alleen op de telefoon, als app op het beginscherm (iPhone/Android). Niet op de Mac.
  function telefoonApp() {
    var telefoon = /iPhone|iPod|Android/i.test(navigator.userAgent);
    var zelfstandig = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    return telefoon && zelfstandig;
  }

  function kanPush() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function wachtOpSessie(cb, tries) {
    var sb = window.__onkSb;
    if (sb && sb.auth) {
      sb.auth.getSession().then(function (r) {
        var s = r && r.data && r.data.session;
        if (s && s.user) cb(sb, s.user); else if (tries < 60) setTimeout(function () { wachtOpSessie(cb, tries + 1); }, 1000);
      });
    } else if (tries < 60) {
      setTimeout(function () { wachtOpSessie(cb, tries + 1); }, 1000);
    }
  }

  function abonneer(sb, user) {
    return navigator.serviceWorker.register('sw.js').then(function () {
      return navigator.serviceWorker.ready;
    }).then(function (reg) {
      return reg.pushManager.getSubscription().then(function (bestaand) {
        return bestaand || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(VAPID_PUBLIC) });
      });
    }).then(function (sub) {
      var j = sub.toJSON();
      return sb.from('bible_push_subscriptions').upsert(
        { endpoint: j.endpoint, user_id: user.id, sub: j },
        { onConflict: 'endpoint' }
      );
    });
  }

  function banner(sb, user) {
    var d = document.createElement('div');
    d.setAttribute('role', 'dialog');
    d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:84px;z-index:9999;background:#fff;color:#1d2b33;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.2);padding:14px 16px;font:14px/1.4 system-ui,sans-serif;max-width:460px;margin:0 auto';
    d.innerHTML = '<div style="margin-bottom:10px"><b>Meldingen aanzetten?</b><br>Dan krijg je een melding als iemand je een bericht stuurt, je aanmoedigt, of als je Lezer van de maand bent.</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button type="button" data-n style="padding:8px 14px;border-radius:10px;border:1px solid #c7d0d6;background:#fff;color:#1d2b33">Nee</button>' +
      '<button type="button" data-j style="padding:8px 14px;border-radius:10px;border:0;background:#3c5e70;color:#fff">Ja</button></div>';
    document.body.appendChild(d);
    d.querySelector('[data-n]').onclick = function () { localStorage.setItem(SLEUTEL, 'nee'); d.remove(); };
    d.querySelector('[data-j]').onclick = function () {
      Notification.requestPermission().then(function (p) {
        localStorage.setItem(SLEUTEL, p === 'granted' ? 'ja' : 'nee');
        d.remove();
        if (p === 'granted') return abonneer(sb, user);
      }).catch(function () { d.remove(); });
    };
  }

  // Voor de schakelaar op de pagina Activiteit delen.
  window.bijbelPush = {
    status: function () {
      return new Promise(function (res) {
        if (!kanPush()) return res({ supported: false });
        var sb = window.__onkSb;
        var basis = { supported: true, permission: Notification.permission, subscribed: false, loggedIn: false };
        if (!sb || !sb.auth) return res(basis);
        sb.auth.getSession().then(function (r) {
          var s = r && r.data && r.data.session;
          basis.loggedIn = !!(s && s.user);
          if (!basis.loggedIn) return res(basis);
          return navigator.serviceWorker.getRegistration('sw.js').then(function (reg) {
            if (!reg) return res(basis);
            return reg.pushManager.getSubscription().then(function (sub) { basis.subscribed = !!sub; res(basis); });
          });
        }).catch(function () { res(basis); });
      });
    },
    aan: function () {
      var sb = window.__onkSb;
      // Toestemming direct binnen de tik vragen (iOS staat geen wachttijd toe ervoor).
      var perm = Notification.requestPermission();
      return perm.then(function (p) {
        if (p !== 'granted') {
          localStorage.setItem(SLEUTEL, 'nee');
          throw new Error(p === 'denied' ? 'Meldingen zijn geblokkeerd voor deze site (instellingen van je telefoon)' : 'Toestemming niet gegeven');
        }
        localStorage.setItem(SLEUTEL, 'ja');
        return sb.auth.getSession().then(function (r) {
          var s = r && r.data && r.data.session;
          if (!s || !s.user) throw new Error('Log eerst in');
          return abonneer(sb, s.user);
        });
      });
    },
    uit: function () {
      var sb = window.__onkSb;
      return navigator.serviceWorker.getRegistration('sw.js').then(function (reg) {
        if (!reg) return;
        return reg.pushManager.getSubscription().then(function (sub) {
          if (!sub) return;
          var ep = sub.endpoint;
          return sub.unsubscribe().then(function () {
            return sb.from('bible_push_subscriptions').delete().eq('endpoint', ep);
          });
        });
      }).then(function () { localStorage.setItem(SLEUTEL, 'nee'); });
    }
  };


  // Per soort aan of uit. Ontbrekende voorkeur = aan. Wordt in het vak #onk-push-soorten getekend.
  var SOORTEN = [
    { k: 'encourage', nl: 'Iemand moedigt je aan', en: 'Someone encourages you', d1: 'Een like op jouw bericht', d2: 'A like on your post' },
    { k: 'message', nl: 'Nieuw bericht', en: 'New message', d1: 'Iemand stuurt je een bericht', d2: 'Someone sends you a message' },
    { k: 'badge', nl: 'Lezer van de maand', en: 'Reader of the month', d1: 'Je krijgt de maandbadge', d2: 'You get the monthly badge' },
    { k: 'friend_post', nl: 'Vrienden plaatsen iets', en: 'Friends post something', d1: 'Iemand die je volgt plaatst iets', d2: 'Someone you follow posts something' }
  ];
  function engels() { try { return localStorage.getItem('bible-locale') === 'en'; } catch (e) { return false; } }

  function tekenSoorten(sb, user) {
    var vak = document.getElementById('onk-push-soorten');
    if (!vak || vak.getAttribute('data-klaar')) return;
    vak.setAttribute('data-klaar', '1');
    var en = engels();
    var kaart = document.createElement('div');
    kaart.style.cssText = 'margin:0 0 20px;background:#fff;border:1px solid rgba(29,43,51,.1);border-radius:16px;padding:18px 18px 8px;font-family:Inter,system-ui,sans-serif;color:#1d2b33';
    kaart.innerHTML = '<div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#7d8c95;margin-bottom:6px">' + (en ? 'Notifications' : 'Meldingen') + '</div>';
    vak.appendChild(kaart);
    sb.from('bible_push_prefs').select('kinds').eq('user_id', user.id).maybeSingle().then(function (r) {
      var kinds = (r && r.data && r.data.kinds) || {};
      SOORTEN.forEach(function (soort) {
        var rij = document.createElement('div');
        rij.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 0;border-top:1px solid rgba(29,43,51,.08)';
        var aan = kinds[soort.k] !== false;
        rij.innerHTML = '<div><div style="font-size:14px;font-weight:600">' + (en ? soort.en : soort.nl) + '</div><div style="font-size:12.5px;color:#7d8c95;margin-top:2px">' + (en ? soort.d2 : soort.d1) + '</div></div>' +
          '<button type="button" role="switch" aria-checked="' + aan + '" style="flex:none;width:46px;height:26px;border-radius:999px;border:1px solid ' + (aan ? '#3C5E70' : 'rgba(29,43,51,.3)') + ';background:' + (aan ? '#3C5E70' : 'rgba(29,43,51,.15)') + ';position:relative;cursor:pointer;padding:0"><span style="position:absolute;top:3px;left:' + (aan ? '23px' : '3px') + ';width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left .15s"></span></button>';
        var knop = rij.querySelector('button');
        knop.onclick = function () {
          var nieuw = knop.getAttribute('aria-checked') !== 'true';
          knop.setAttribute('aria-checked', String(nieuw));
          knop.style.background = nieuw ? '#3C5E70' : 'rgba(29,43,51,.15)';
          knop.style.borderColor = nieuw ? '#3C5E70' : 'rgba(29,43,51,.3)';
          knop.firstChild.style.left = nieuw ? '23px' : '3px';
          kinds[soort.k] = nieuw;
          sb.from('bible_push_prefs').upsert({ user_id: user.id, kinds: kinds, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
            .then(function (res) { if (res && res.error) { kinds[soort.k] = !nieuw; knop.setAttribute('aria-checked', String(!nieuw)); } });
        };
        kaart.appendChild(rij);
      });
    });
  }

  // Het vak verschijnt pas als de instellingenpagina open is en er een abonnement is.
  function wachtOpVak() {
    var sb = window.__onkSb;
    var zoek = function () {
      if (!document.getElementById('onk-push-soorten')) return;
      if (!sb || !sb.auth) return;
      sb.auth.getSession().then(function (r) {
        var s = r && r.data && r.data.session;
        if (!s || !s.user) return;
        if (!kanPush() || Notification.permission !== 'granted') return;
        tekenSoorten(sb, s.user);
      });
    };
    zoek();
    if (window.MutationObserver) new MutationObserver(zoek).observe(document.body, { childList: true, subtree: true });
  }
  wachtOpVak();

  if (!kanPush()) return;
  wachtOpSessie(function (sb, user) {
    if (Notification.permission === 'granted') {
      abonneer(sb, user).catch(function () {});
    } else if (Notification.permission === 'default' && localStorage.getItem(SLEUTEL) !== 'nee' && telefoonApp()) {
      setTimeout(function () { banner(sb, user); }, 4000);
    }
  }, 0);
})();
