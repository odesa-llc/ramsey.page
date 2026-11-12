(() => {
  const portrait = document.querySelector('[data-portrait-soft-sweep]');
  if (!portrait) return;

  const scriptURL = document.currentScript.src;
  const assets = new URL('../assets/home-map/', scriptURL);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;

  // Draw just the ink. The receipt stock is a separate, stationary image.
  const width = 235;
  const height = 285;
  canvas.width = width;
  canvas.height = height;
  canvas.className = portrait.className;
  canvas.setAttribute('aria-hidden', 'true');

  let paper;
  let ink;
  let loading = false;
  let onScreen = !('IntersectionObserver' in window);
  let frame = null;
  let start = null;
  let elapsed = 0;
  let lastPaint = -Infinity;

  function paint(seconds) {
    context.clearRect(0, 0, width, height);
    context.drawImage(ink, 0, 0);

    // The two bands wrap outside the printed area, so there is no visible jump.
    const leading = 24.5 + 261.5 * ((seconds / 6.4 + 0.31) % 1);
    const trailing = 24.5 + 261.5 * ((seconds / 6.4 + 0.81) % 1);
    sweepBand(leading, 8, 2.45);
    sweepBand(trailing, 5.5, -1.35);
  }

  function sweepBand(center, radius, shift) {
    const first = Math.max(0, Math.floor(center - radius));
    const end = Math.min(height, Math.ceil(center + radius));
    for (let row = first; row < end; row++) {
      const distance = Math.abs(row + 0.5 - center) / radius;
      if (distance >= 1) continue;
      const taper = (1 + Math.cos(Math.PI * distance)) / 2;
      context.clearRect(0, row, width, 1);
      context.drawImage(ink, 0, row, width, 1, shift * taper, row, width, 1);
    }
  }

  function animate(now) {
    if (start === null) start = now - elapsed;
    elapsed = now - start;
    if (elapsed - lastPaint >= 1000 / 30 - 1) {
      paint(elapsed / 1000);
      lastPaint = elapsed;
    }
    frame = requestAnimationFrame(animate);
  }

  function pause() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    start = null;
  }

  function loadImage(file) {
    const image = new Image(width, height);
    image.src = new URL(file, assets).href;
    return image.decode().then(() => image);
  }

  async function loadLayers() {
    loading = true;
    try {
      [paper, ink] = await Promise.all([
        loadImage('portrait-soft-sweep-paper.webp'),
        loadImage('portrait-soft-sweep-ink.webp')
      ]);
    } catch {
      // The original portrait remains visible if either layer fails to load.
      return;
    }
    paper.className = portrait.className;
    paper.alt = '';
    paper.draggable = false;
    paper.setAttribute('aria-hidden', 'true');
    syncPlayback();
  }

  function syncPlayback() {
    if (reducedMotion.matches) {
      pause();
      if (paper?.isConnected) {
        paper.remove();
        canvas.remove();
        portrait.style.visibility = '';
      }
      return;
    }

    if (!onScreen || document.hidden) {
      pause();
      return;
    }
    if (!loading) void loadLayers();
    if (!ink) return;

    if (!paper.isConnected) {
      paint(elapsed / 1000);
      portrait.after(paper, canvas);
      portrait.style.visibility = 'hidden';
    }
    if (frame === null) frame = requestAnimationFrame(animate);
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      syncPlayback();
    });
    observer.observe(portrait);
  }

  reducedMotion.addEventListener('change', syncPlayback);
  document.addEventListener('visibilitychange', syncPlayback);
  syncPlayback();
})();
