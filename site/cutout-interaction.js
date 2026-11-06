// Dragging remains direct; hover animates only the sage outline.
(function () {
  var hover = window.matchMedia('(hover: hover) and (pointer: fine)');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var geometries = new Set();
  window.addEventListener('resize', function () {
    geometries.forEach(function (record) { if (record.image.isConnected) record.sync(); else { record.observer.disconnect(); geometries.delete(record); } });
  });
  function outlineFor(image) {
    var path = image.querySelector('[data-widget-outline]');
    if (path) {
      var group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.classList.add('cutout-svg-outline'); path.before(group); group.appendChild(path);
      return group;
    }
    var kind = image.hasAttribute('data-handbag-cutout') ? 'handbag' : image.hasAttribute('data-breadboard-cutout') ? 'breadboard' : image.hasAttribute('data-camera-cutout') ? 'camera' : '';
    if (!kind) return null;
    var outline = document.createElement('img');
    outline.className = 'cutout-hover-outline'; outline.alt = ''; outline.setAttribute('aria-hidden', 'true'); outline.draggable = false;
    outline.src = '/assets/widget-outlines/' + kind + '-hover.svg?v=2';
    image.after(outline);
    function sync() {
      outline.style.left = image.offsetLeft + 'px'; outline.style.top = image.offsetTop + 'px';
      outline.style.width = image.offsetWidth + 'px'; outline.style.height = image.offsetHeight + 'px';
    }
    var record = {image: image, sync: sync};
    record.observer = new ResizeObserver(function () { if (!image.isConnected) { record.observer.disconnect(); geometries.delete(record); } else sync(); });
    record.observer.observe(image); geometries.add(record); sync();
    return outline;
  }

  function bind(image) {
    if (image.dataset.dragBound) return;
    image.dataset.dragBound = 'true';
    var drag = null, suppressClick = false;
    var card = image.closest('a') || image.parentElement;
    var ease = 'translate .45s cubic-bezier(.22,.61,.36,1)';
    image.style.transition = reduced.matches ? 'none' : ease;
    var outline = outlineFor(image);
    var separateOutline = outline && outline.classList.contains('cutout-hover-outline');
    function active(value) { if (outline) outline.classList.toggle('is-active', value && !drag); }
    image.addEventListener('pointerenter', function () { if (hover.matches) active(true); });
    image.addEventListener('pointerleave', function () { active(false); });
    card.addEventListener('focusin', function () { active(true); });
    card.addEventListener('focusout', function (event) { if (!card.contains(event.relatedTarget)) active(false); });

    image.addEventListener('pointerdown', function (event) {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      var scene = image.parentElement.getBoundingClientRect();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, maxX: scene.width * .25, maxY: scene.height * .25, moved: false };
      suppressClick = false;
      active(false);
      image.setAttribute('data-cutout-dragging', 'true');
      image.style.transition = 'none';
      if (separateOutline) outline.style.transition = 'none';
      image.style.cursor = 'grabbing';
      image.setPointerCapture(event.pointerId);
    });
    image.addEventListener('pointermove', function (event) {
      if (!drag || event.pointerId !== drag.id) return;
      var dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      image.style.translate = Math.max(-drag.maxX, Math.min(drag.maxX, dx)) + 'px ' + Math.max(-drag.maxY, Math.min(drag.maxY, dy)) + 'px';
      if (separateOutline) outline.style.translate = image.style.translate;
    });
    function release(event) {
      if (!drag || event.pointerId !== drag.id) return;
      suppressClick = drag.moved;
      var id = drag.id;
      drag = null;
      image.removeAttribute('data-cutout-dragging');
      image.style.transition = reduced.matches ? 'none' : ease;
      image.style.translate = '0px 0px';
      if (separateOutline) { outline.style.transition = ''; outline.style.translate = '0px 0px'; }
      image.style.cursor = 'grab';
      active(hover.matches && image.matches(':hover'));
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
