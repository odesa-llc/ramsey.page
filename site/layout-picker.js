// Sage outlines and uneven image corners are the fixed approved site treatments.
(function () {
  if (window.__portfolioLayoutPicker) return;
  window.__portfolioLayoutPicker = true;
  document.documentElement.dataset.portfolioBorder = '2';
  document.documentElement.dataset.portfolioOutline = 'sage';
  var borderStyle = document.createElement('link');
  borderStyle.rel = 'stylesheet'; borderStyle.href = '/project-borders.css?v=1';
  document.head.appendChild(borderStyle);
  var borderScript = document.createElement('script');
  borderScript.src = '/project-borders.js?v=5'; document.head.appendChild(borderScript);
  window.addEventListener('pageshow', function () {
    document.documentElement.dataset.portfolioBorder = '2';
    window.dispatchEvent(new CustomEvent('portfolio:borderchange'));
  });
})();
