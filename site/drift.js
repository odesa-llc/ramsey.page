// Gentle pointer-following drift for elements marked [data-drift].
// Amount in px can be set per element: data-drift="6".
(function () {
  var MAX = 5;
  function bind(el) {
    if (el.__driftBound) return;
    el.__driftBound = true;
    var amt = parseFloat(el.getAttribute('data-drift')) || MAX;
    el.style.display = el.style.display || 'inline-block';
    el.style.transition = 'transform .28s cubic-bezier(.22,.61,.36,1)';
    el.addEventListener('mousemove', function (e) {
      var r = el.getBoundingClientRect();
      var x = ((e.clientX - r.left) / r.width - 0.5) * 2 * amt;
      var y = ((e.clientY - r.top) / r.height - 0.5) * 2 * amt;
      el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    });
    el.addEventListener('mouseleave', function () {
      el.style.transform = 'translate(0,0)';
    });
  }
  function scan() { document.querySelectorAll('[data-drift]').forEach(bind); }
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
