// The task count and plain white fill always share the same value out of eight.
(function () {
  if (window.__tidleWidgetAnimation) return;
  window.__tidleWidgetAnimation = true;
  var text = window.portfolioText;
  var TOTAL = 8, TRACK_WIDTH = 1365, FIRST_STEP_MS = 250, STEP_MS = 1600, COMPLETE_HOLD_MS = 3200;

  function bind(widget) {
    if (widget.closest('x-dc') || widget.dataset.tidleBound) return;
    var counter = widget.querySelector('[data-tidle-count]');
    var fill = widget.querySelector('[data-tidle-fill]');
    var bar = widget.querySelector('[data-tidle-bar]');
    // The runtime may insert the wrapper before its SVG children are ready.
    if (!counter || !fill || !bar) return;
    widget.dataset.tidleBound = 'true';
    var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var done = 0, timer, hasAdvanced = false, firstStepAt = 0;

    function paint(value) {
      done = value;
      counter.textContent = text('runtime.done', {done: done, total: TOTAL});
      var width = TRACK_WIDTH * done / TOTAL;
      fill.setAttribute('width', String(width));
      fill.style.width = width + 'px';
      bar.setAttribute('aria-valuenow', String(done));
      widget.dataset.tidleDone = String(done);
      widget.setAttribute('aria-label', text('runtime.widget', {done: done, total: TOTAL}));
      widget.style.setProperty('--tidle-progress', String(done / TOTAL));
    }
    function visible() {
      var rect = widget.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    }
    function tick() {
      if (!widget.isConnected) {
        motion.removeEventListener('change', motionChanged);
        return;
      }
      if (!motion.matches && !document.hidden && !document.querySelector('#portfolio-load-gate') && visible() && !widget.hasAttribute('data-cutout-dragging')) {
        // Keep zero visible briefly once the loading screen has cleared.
        if (!hasAdvanced) {
          if (!firstStepAt) firstStepAt = Date.now() + FIRST_STEP_MS;
          if (Date.now() < firstStepAt) {
            timer = setTimeout(tick, firstStepAt - Date.now());
            return;
          }
        }
        var next = done === TOTAL ? 0 : done + 1;
        fill.style.transition = next === 0 ? 'none' : '';
        paint(next);
        hasAdvanced = true;
      } else if (!hasAdvanced) {
        firstStepAt = 0;
      }
      timer = setTimeout(tick, !hasAdvanced ? 80 : done === TOTAL ? COMPLETE_HOLD_MS : STEP_MS);
    }
    function motionChanged() {
      clearTimeout(timer);
      hasAdvanced = false;
      firstStepAt = 0;
      if (motion.matches) {
        fill.style.transition = 'none';
        paint(0);
      } else {
        fill.style.transition = '';
        timer = setTimeout(tick, 0);
      }
    }
    paint(0);
    motion.addEventListener('change', motionChanged);
    if (!motion.matches) timer = setTimeout(tick, 0);
  }
  function scan() { document.querySelectorAll('[data-tidle-widget]').forEach(bind); }
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
