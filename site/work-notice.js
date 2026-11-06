(function () {
  if (window.__portfolioWorkNotice) return;
  window.__portfolioWorkNotice = true;
  var key = 'portfolio-work-notice-dismissed-v1';
  var dismissed = false, mountedRoot, notice;
  try { dismissed = sessionStorage.getItem(key) === '1'; } catch (_) {}
  var fallback = {
    'home.wipMessage': 'Glad you’re here! I’m cleaning things up. Come back soon :)',
    'home.wipLabel': 'A little site update',
    'home.wipDismiss': 'Dismiss site update'
  };
  function text(name) { return window.portfolioText ? window.portfolioText(name) : fallback[name]; }
  function mount() {
    if (dismissed) return;
    var root = document.querySelector('#dc-root [data-screen-label="Home"]');
    if (!root || (root === mountedRoot && notice && notice.isConnected)) return;
    var header = root.querySelector('.direction-nav');
    if (!header) return;
    mountedRoot = root;
    notice = document.createElement('aside');
    notice.className = 'portfolio-work-notice';
    notice.setAttribute('aria-label', text('home.wipLabel'));
    var inner = document.createElement('div'); inner.className = 'portfolio-work-notice-inner';
    var message = document.createElement('p'); message.textContent = text('home.wipMessage');
    var close = document.createElement('button'); close.type = 'button'; close.setAttribute('aria-label', text('home.wipDismiss'));
    close.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4.3 4.6c3.4 3.1 7.4 7.2 11.1 11M15.4 4.2c-3.9 3.5-7.2 7.8-11.2 11.3"/></svg>';
    close.addEventListener('click', function () {
      dismissed = true;
      try { sessionStorage.setItem(key, '1'); } catch (_) {}
      var focused = document.activeElement === close;
      notice.remove();
      if (focused) { var next = header.querySelector('a'); if (next) next.focus({preventScroll: true}); }
    });
    inner.append(message, close); notice.appendChild(inner); header.before(notice);
  }
  mount();
  new MutationObserver(mount).observe(document.documentElement, {childList: true, subtree: true});
})();
