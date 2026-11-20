(() => {
  const root = document.getElementById('ramsey-closet');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const photo = root.querySelector('.pouch-photo');
  const canvas = root.querySelector('.pouch-motion');
  const visual = root.querySelector('.pouch-visual');
  const context = canvas.getContext('2d');
  if (!context || !photo.decode) return;

  const { width, height } = canvas;
  const filmTop = 650;
  const filmBottom = 1360;
  const contentsTop = 880;
  const contentsBottom = 1215;
  const film = document.createElement('canvas');
  film.width = width;
  film.height = filmBottom - filmTop;
  const filmContext = film.getContext('2d');
  if (!filmContext) return;

  const opening = new Path2D();
  opening.moveTo(0, 0);
  opening.lineTo(width, 0);
  opening.lineTo(width, 287);
  opening.lineTo(787, 287);
  opening.bezierCurveTo(574, 273, 351, 278, 128, 291);
  opening.lineTo(0, 291);
  opening.closePath();

  const filmMask = filmContext.createLinearGradient(0, 0, width, 0);
  filmMask.addColorStop(130 / width, 'transparent');
  filmMask.addColorStop(155 / width, 'black');
  filmMask.addColorStop(784 / width, 'black');
  filmMask.addColorStop(826 / width, 'transparent');
  let playback = 0;
  let frame = 0;

  function drawStrip(target, top, bottom, destinationTop, destinationBottom) {
    target.drawImage(photo, 0, top, width, bottom - top,
      0, destinationTop, width, destinationBottom - destinationTop);
  }

  let lastOffset;
  function paintFrame(offset) {
    if (offset === lastOffset) return;
    if (lastOffset === undefined || photo.naturalWidth !== width || photo.naturalHeight !== height) {
      context.clearRect(0, 0, width, height);
      context.drawImage(photo, 0, 0, width, height);
    } else {
      // Restore only the two strips repainted by the previous frame.
      context.clearRect(0, 0, width, 300);
      drawStrip(context, 0, 300, 0, 300);
      context.clearRect(0, filmTop, width, film.height);
      drawStrip(context, filmTop, filmBottom, filmTop, filmBottom);
    }
    lastOffset = offset;

    // Replace the exposed knit above the fixed zipper, preserving empty alpha.
    context.save();
    context.clip(opening);
    context.clearRect(0, 0, width, 300);
    drawStrip(context, 0, 54, 0, 54 + offset);
    drawStrip(context, 54, 300, 54 + offset, 300);
    context.restore();

    // The knit and spool share a rigid translation behind the fixed film edges.
    const start = contentsTop - filmTop + offset;
    const end = contentsBottom - filmTop + offset;
    filmContext.clearRect(0, 0, width, film.height);
    drawStrip(filmContext, filmTop, contentsTop, 0, start);
    drawStrip(filmContext, contentsTop, contentsBottom, start, end);
    drawStrip(filmContext, contentsBottom, filmBottom, end, film.height);
    filmContext.save();
    filmContext.globalCompositeOperation = 'destination-in';
    filmContext.fillStyle = filmMask;
    filmContext.fillRect(0, 0, width, film.height);
    filmContext.restore();
    context.drawImage(film, 0, filmTop);
  }

  function stop() {
    lastOffset = undefined;
    playback += 1;
    cancelAnimationFrame(frame);
    canvas.hidden = true;
    visual.classList.remove('is-animating');
  }

  root.addEventListener('pouch:close', stop);
  root.addEventListener('pouch:open', () => {
    stop();
    if (reduceMotion.matches) return;
    const requested = playback;
    photo.decode().then(() => {
      if (playback !== requested || reduceMotion.matches) return;
      paintFrame(72);
      canvas.hidden = false;
      visual.classList.add('is-animating');
      let start;
      function animate(now) {
        start ??= now;
        const progress = Math.min(1, Math.max(0, (now - start - 65) / 700));
        if (progress === 1 || reduceMotion.matches) {
          stop();
          return;
        }
        const eased = progress * progress * (3 - 2 * progress);
        paintFrame(72 * (1 - eased));
        frame = requestAnimationFrame(animate);
      }
      frame = requestAnimationFrame(animate);
    }).catch(() => {
      if (playback === requested) stop();
    });
  });
})();
