// Load gate: holds the page still (no scrolling) behind a wordmark screen until
// every image/video on the page is decoded, then fades away. Hard cap so a slow
// asset can never trap a visitor.
(function () {
  if (window.__portfolioLoadGate) return;
  window.__portfolioLoadGate = true;

  var CAP = 14000;          // absolute ceiling before we let go regardless
  var MIN = 600;            // keep the screen up at least this long (no flash)
  var started = Date.now();
  var overlay, fill, lockStyle, released = false, lastTotal = -1, stable = 0;
  var winLoaded = document.readyState === 'complete';
  var fontsReady = false;

  window.addEventListener('load', function () { winLoaded = true; });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { fontsReady = true; });
  } else { fontsReady = true; }

  function block(e) { if (!released) { e.preventDefault(); e.stopPropagation(); } }
  var KEYS = { 32: 1, 33: 1, 34: 1, 35: 1, 36: 1, 37: 1, 38: 1, 39: 1, 40: 1 };
  function blockKeys(e) { if (!released && KEYS[e.keyCode]) { e.preventDefault(); } }

  function lock() {
    lockStyle = document.createElement('style');
    lockStyle.textContent = 'html,body{overflow:hidden!important;overscroll-behavior:none}';
    document.head.appendChild(lockStyle);
    window.addEventListener('wheel', block, { passive: false });
    window.addEventListener('touchmove', block, { passive: false });
    window.addEventListener('keydown', blockKeys);
  }

  function unlock() {
    if (lockStyle && lockStyle.parentNode) lockStyle.parentNode.removeChild(lockStyle);
    window.removeEventListener('wheel', block, { passive: false });
    window.removeEventListener('touchmove', block, { passive: false });
    window.removeEventListener('keydown', blockKeys);
  }

  function build() {
    overlay = document.createElement('div');
    overlay.id = 'portfolio-load-gate';
    overlay.setAttribute('style', 'position:fixed;inset:0;z-index:2147483000;background:#F8F8F6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;transition:opacity .55s ease');
    var track = document.createElement('div');
    track.setAttribute('style', 'width:168px;height:2px;background:rgba(13,37,101,.16)');
    fill = document.createElement('div');
    fill.setAttribute('style', 'width:4%;height:100%;background:#0D2565;transition:width .35s cubic-bezier(.22,.61,.36,1)');
    track.appendChild(fill);
    overlay.appendChild(track);
    document.body.appendChild(overlay);
  }

  function ready() {
    var total = 0, done = 0;
    var imgs = document.images;
    for (var i = 0; i < imgs.length; i++) {
      if (!imgs[i].getAttribute('src')) continue;
      total++;
      if (imgs[i].complete && imgs[i].naturalWidth > 0) done++;
    }
    var vids = document.getElementsByTagName('video');
    for (var j = 0; j < vids.length; j++) {
      total++;
      if (vids[j].readyState >= 2) done++;
    }
    return { total: total, done: done, ratio: total ? done / total : 1 };
  }

  function release() {
    if (released) return;
    released = true;
    unlock();
    if (fill) fill.style.width = '100%';
    if (!overlay) return;
    overlay.style.opacity = '0';
    setTimeout(function () { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 580);
  }

  function tick() {
    var s = ready();
    var elapsed = Date.now() - started;
    if (fill) fill.style.width = Math.max(4, Math.round(s.ratio * 96)) + '%';
    // the design streams in, so the asset list keeps growing: only trust a
    // complete count once it has stopped changing for a couple of frames
    if (s.total === lastTotal) stable++; else stable = 0;
    lastTotal = s.total;
    if (elapsed > CAP) return release();
    if (elapsed > MIN && winLoaded && fontsReady && s.ratio >= 1 && stable >= 3) return release();
    setTimeout(tick, 140);
  }

  function start() {
    lock();
    build();
    tick();
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
