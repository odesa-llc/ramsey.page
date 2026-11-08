// Drag the artwork directly and spring it back on release.
(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  function bind(image) {
    if (image.dataset.dragBound) return;
    image.dataset.dragBound = 'true';
    var drag = null, suppressClick = false;
    var card = image.closest('a') || image.parentElement;
    var ease = 'translate .45s cubic-bezier(.22,.61,.36,1)';
    image.style.transition = reduced.matches ? 'none' : ease;
    image.addEventListener('pointerdown', function (event) {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      var scene = image.parentElement.getBoundingClientRect();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, maxX: scene.width * .25, maxY: scene.height * .25, moved: false };
      suppressClick = false;
      image.setAttribute('data-cutout-dragging', 'true');
      image.style.transition = 'none';
      image.style.cursor = 'grabbing';
      image.setPointerCapture(event.pointerId);
    });
    image.addEventListener('pointermove', function (event) {
      if (!drag || event.pointerId !== drag.id) return;
      var dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      image.style.translate = Math.max(-drag.maxX, Math.min(drag.maxX, dx)) + 'px ' + Math.max(-drag.maxY, Math.min(drag.maxY, dy)) + 'px';
    });
    function release(event) {
      if (!drag || event.pointerId !== drag.id) return;
      suppressClick = drag.moved;
      var id = drag.id;
      drag = null;
      image.removeAttribute('data-cutout-dragging');
      image.style.transition = reduced.matches ? 'none' : ease;
      image.style.translate = '0px 0px';
      image.style.cursor = 'grab';
      if (image.hasPointerCapture(id)) image.releasePointerCapture(id);
    }
    image.addEventListener('pointerup', release);
    image.addEventListener('pointercancel', release);
    image.addEventListener('lostpointercapture', release);
    card.addEventListener('click', function (event) {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    }, true);
  }
  function scan() { document.querySelectorAll('[data-handbag-cutout],[data-breadboard-cutout],[data-widget-cutout]').forEach(bind); }
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });

  // The Fuzz card contains separate native links so its audio controls remain
  // independent. Forward clicks on the board and caption to the same link.
  // Completed drags are stopped by the card's capture listener above.
  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0) return;
    var target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('a,button,input,select,textarea,[contenteditable],[data-audio-player]')) return;
    var card = target.closest('[data-project-card="breadboard"]');
    if (!card || card.closest('x-dc')) return;
    var link = card.querySelector('a[href]');
    if (!link) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey) {
      window.open(link.href, '_blank', 'noopener');
    } else {
      link.click();
    }
  });
})();
