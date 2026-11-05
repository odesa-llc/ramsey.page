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
  location.replace(base + language + '/' + location.search + location.hash);
})();
