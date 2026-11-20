(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches) return;

  const photo = document.querySelector('.pouch-photo');
  const canvas = document.querySelector('.pouch-motion');
  const context = canvas.getContext('2d');
  if (!context || !photo.decode) return;

  const { width, height } = canvas;
  const opening = new Path2D();
  opening.moveTo(0, 0);
  opening.lineTo(width, 0);
  opening.lineTo(width, 287);
  opening.lineTo(787, 287);
  opening.bezierCurveTo(574, 273, 351, 278, 128, 291);
  opening.lineTo(0, 291);
  opening.closePath();

  // Feather only the sides of each moving area into the still photograph.
  function sideMask(left, leftOpaque, rightOpaque, right) {
    const mask = context.createLinearGradient(0, 0, width, 0);
    mask.addColorStop(left / width, 'transparent');
    mask.addColorStop(leftOpaque / width, 'black');
    mask.addColorStop(rightOpaque / width, 'black');
    mask.addColorStop(right / width, 'transparent');
    return mask;
  }

  const paperMask = sideMask(50, 150, 860, 955);
  const filmMask = sideMask(130, 155, 746, 826);

  function drawStrip(top, bottom, destinationTop, destinationBottom) {
    context.drawImage(photo, 0, top, width, bottom - top,
      0, destinationTop, width, destinationBottom - destinationTop);
  }

  function paintFrame(offset) {
    context.clearRect(0, 0, width, height);

    // The exposed knit and its shadow rise behind the fixed zipper track.
    context.save();
    context.clip(opening);
    drawStrip(0, 54, 0, 54 + offset);
    drawStrip(54, 300, 54 + offset, 300);
    context.globalCompositeOperation = 'destination-in';
    context.fillStyle = paperMask;
    context.fillRect(0, 0, width, 300);
    context.restore();

    // Carry the lower edge of the same knit upward behind the frosted film.
    context.save();
    context.beginPath();
    context.rect(0, 650, width, 660);
    context.clip();
    drawStrip(650, 940, 650, 940 + offset);
    drawStrip(940, 1115, 940 + offset, 1115 + offset);
    drawStrip(1115, 1310, 1115 + offset, 1310);
    context.globalCompositeOperation = 'destination-in';
    context.fillStyle = filmMask;
    context.fillRect(0, 650, width, 660);
    context.restore();
  }

  photo.decode().then(() => {
    if (reducedMotion.matches) return;
    paintFrame(72);
    canvas.hidden = false;

    let start;
    function animate(now) {
      start ??= now;
      const progress = Math.min(1, Math.max(0, (now - start - 65) / 700));
      if (progress === 1 || reducedMotion.matches) {
        canvas.hidden = true;
        return;
      }
      const eased = progress * progress * (3 - 2 * progress);
      paintFrame(72 * (1 - eased));
      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }).catch(() => {
    // Keep the still image visible if the animation cannot be prepared.
    canvas.hidden = true;
  });
})();
