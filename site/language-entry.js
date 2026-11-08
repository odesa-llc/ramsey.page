// Only the neutral homepage runs this script. Explicit language URLs are stable.
(function () {
  'use strict';
  var script = document.currentScript;
  var base = script && script.getAttribute('data-base-path') || '/';
  if (location.pathname !== base && location.pathname !== base + 'index.html') return;
  var preferences = navigator.languages && navigator.languages.length
    ? navigator.languages : [navigator.language || 'en'];
  var language = 'en';
  for (var i = 0; i < preferences.length; i++) {
    var candidate = String(preferences[i]).toLowerCase().split('-')[0];
    if (candidate === 'en' || candidate === 'fr') { language = candidate; break; }
  }
  var search = new URLSearchParams(location.search);
  // A client-side language redirect must not hide the incoming referral source.
  // Pass only its origin, without paths, query strings or any visitor identifier.
  if (document.referrer) {
    try {
      var referrer = new URL(document.referrer);
      if (/^https?:$/.test(referrer.protocol) && referrer.origin !== location.origin) {
        search.set('_portfolio_ref', referrer.origin);
      }
    } catch (_) {}
  }
  var query = search.toString();
  location.replace(base + language + '/' + (query ? '?' + query : '') + location.hash);
})();
