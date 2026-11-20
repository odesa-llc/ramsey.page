(() => {
  const root = document.getElementById('ramsey-closet');
  const scene = root.querySelector('.closet-scene');
  const detail = root.querySelector('.closet-detail');
  const title = detail.querySelector('h1');
  const closetTitle = document.title;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const projects = new Map(Array.from(scene.querySelectorAll('[data-swing]'), (element) => {
    const project = element.querySelector('[data-project]');
    const [x, y] = element.dataset.pin.split(' ').map(Number);
    return [project, {
      element, project, x, y,
      length: Number(element.dataset.depth),
      limit: Number(element.dataset.limit),
      stiffness: Number(element.dataset.stiffness),
      angle: 0,
      velocity: 0
    }];
  }));

  const swinging = new Set();
  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
  let frame = 0;
  let lastFrame = 0;
  let hovered;
  let gesture;
  let lastDrag;
  let showingDetail;

  function rotate(piece, angle) {
    const nextAngle = clamp(angle, -piece.limit, piece.limit);
    if (nextAngle === piece.angle) return;
    piece.angle = nextAngle;
    if (piece.angle) {
      piece.element.setAttribute('transform', 'rotate(' + piece.angle.toFixed(3) + ' ' + piece.x + ' ' + piece.y + ')');
    } else {
      piece.element.removeAttribute('transform');
    }
  }

  function animate(now) {
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 1 / 30) : 1 / 60;
    lastFrame = now;
    for (const piece of swinging) {
      piece.velocity -= (piece.stiffness * piece.angle + 5.3 * piece.velocity) * dt;
      const next = piece.angle + piece.velocity * dt;
      if (Math.abs(next) > piece.limit) piece.velocity *= -.18;
      if (reduceMotion.matches || (Math.abs(next) < .04 && Math.abs(piece.velocity) < .3)) {
        rotate(piece, 0);
        piece.velocity = 0;
        swinging.delete(piece);
      } else {
        rotate(piece, next);
      }
    }
    frame = swinging.size ? requestAnimationFrame(animate) : 0;
    if (!frame) lastFrame = 0;
  }

  function release(piece, velocity) {
    if (reduceMotion.matches) return;
    piece.velocity = clamp(velocity, -105, 105);
    swinging.add(piece);
    if (!frame) frame = requestAnimationFrame(animate);
  }

  function swayOnLoad() {
    if (scene.hidden || reduceMotion.matches) return;
    for (const piece of projects.values()) {
      const velocity = Number(piece.element.dataset.loadSway);
      const visible = piece.element.ownerSVGElement.getClientRects().length > 0;
      if (visible && velocity && gesture?.piece !== piece && !swinging.has(piece)) {
        release(piece, velocity);
      }
    }
  }

  scene.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    const project = event.target.closest('[data-project]');
    const piece = projects.get(project);
    if (!piece) return;
    const svg = piece.element.ownerSVGElement;
    const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    gesture = {
      piece,
      id: event.pointerId,
      touch: event.pointerType === 'touch',
      startX: event.clientX,
      angle: piece.angle,
      velocity: 0,
      sampled: event.timeStamp,
      pixelsPerDegree: Math.max(2, scale * piece.length * Math.PI / 180),
      dragged: false
    };
  });

  scene.addEventListener('pointermove', (event) => {
    if (gesture?.id === event.pointerId) {
      const { piece } = gesture;
      const dx = event.clientX - gesture.startX;
      if (!gesture.dragged && Math.abs(dx) < 5) return;
      if (!gesture.dragged) {
        gesture.dragged = true;
        piece.element.dataset.held = '';
        piece.project.setPointerCapture(event.pointerId);
        swinging.delete(piece);
      }
      if (!reduceMotion.matches) {
        const previous = piece.angle;
        rotate(piece, gesture.angle - dx / gesture.pixelsPerDegree);
        const elapsed = Math.max((event.timeStamp - gesture.sampled) / 1000, .008);
        gesture.velocity = .35 * gesture.velocity + .65 * (piece.angle - previous) / elapsed;
        gesture.sampled = event.timeStamp;
      }
      return;
    }
    if (event.pointerType === 'touch') return;
    const project = event.target.closest('[data-project]');
    const piece = projects.get(project);
    if (!piece) {
      hovered = null;
      return;
    }
    if (hovered !== project) {
      hovered = project;
      release(piece, piece.velocity + (event.movementX < 0 ? 30 : -30));
    }
  });

  function finishPointer(event) {
    if (gesture?.id !== event.pointerId) return;
    const finished = gesture;
    const { piece } = finished;
    const cancelled = event.type === 'pointercancel';
    gesture = null;
    delete piece.element.dataset.held;
    if (finished.dragged) {
      const velocity = event.timeStamp - finished.sampled < 90 ? finished.velocity : 0;
      release(piece, cancelled ? 0 : velocity);
    } else if (finished.touch && !cancelled) {
      release(piece, piece.velocity - 42);
    }
    if (cancelled) return;
    lastDrag = finished.dragged ? { project: piece.project, at: performance.now() } : null;
  }
  window.addEventListener('pointerup', finishPointer);
  window.addEventListener('pointercancel', finishPointer);
  scene.addEventListener('click', (event) => {
    const project = event.target.closest('[data-project]');
    if (!lastDrag || !event.detail || performance.now() - lastDrag.at > 700 || lastDrag.project !== project) return;
    event.preventDefault();
    lastDrag = null;
  });
  scene.addEventListener('pointerleave', () => {
    hovered = null;
  });

  function showPage() {
    const next = location.hash === '#skull-cap';
    if (showingDetail === next) return;
    const initial = showingDetail === undefined;
    showingDetail = next;
    detail.hidden = !next;
    scene.hidden = next;
    document.title = next ? `${title.textContent.trim()} — ramsey hatoum` : closetTitle;
    if (next) {
      root.dispatchEvent(new Event('pouch:open'));
      if (!initial) title.focus({ preventScroll: true });
    } else {
      root.dispatchEvent(new Event('pouch:close'));
    }
    if (!initial) window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', showPage);
  showPage();
  if (document.readyState === 'complete') {
    swayOnLoad();
  } else {
    window.addEventListener('load', swayOnLoad, { once: true });
  }
})();
