// The build embeds the small runtime message catalog before loading this file.
(function () {
  'use strict';
  var element = document.getElementById('portfolio-messages');
  var messages = element ? JSON.parse(element.textContent) : window.PORTFOLIO_PREVIEW_MESSAGES || {};
  window.portfolioText = function (key, values) {
    var message = messages[key];
    if (typeof message !== 'string') throw new Error('Missing portfolio message: ' + key);
    return message.replace(/\{(\w+)\}/g, function (_, name) {
      return values && values[name] != null ? String(values[name]) : '{' + name + '}';
    });
  };
})();
