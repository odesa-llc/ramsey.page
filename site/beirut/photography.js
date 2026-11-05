(() => {
  const links = [...document.querySelectorAll('[data-photo]')];
  const dialog = document.querySelector('.photo-viewer');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const image = dialog.querySelector('[data-full-photo]');
  const caption = dialog.querySelector('[data-full-caption]');
  const position = dialog.querySelector('[data-photo-position]');
  let current = 0;
  let origin = null;
  let savedOverflow = '';
  const text = window.portfolioText;
  function show(index) {
    current = (index + links.length) % links.length;
    const link = links[current];
    image.src = link.href;
    image.alt = link.querySelector('img').alt;
    caption.textContent = link.dataset.caption;
    position.textContent = text('runtime.photoPosition', {current: String(current + 1).padStart(2, '0'), total: links.length});
  }
  links.forEach((link, index) => link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    origin = link;
    show(index);
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
  }));
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-prev]').addEventListener('click', () => show(current - 1));
  dialog.querySelector('[data-next]').addEventListener('click', () => show(current + 1));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1); }
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = savedOverflow;
    origin?.focus({preventScroll:true});
  });
})();
