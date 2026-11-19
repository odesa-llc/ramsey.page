/* Stack the sharp, lit exposure over the softened collage. */
(() => {
  if (!CSS.supports('mask-image', 'linear-gradient(black, transparent)')) return;

  const art = document.querySelector('.skull-cap-collage .skull-cap-art');
  if (!art) return;

  const ambient = document.createElement('span');
  ambient.className = 'collage-exposure collage-ambient';
  for (const child of [...art.children]) ambient.append(child);

  const illumination = ambient.cloneNode(true);
  illumination.className = 'collage-exposure';
  const filter = illumination.querySelector('filter');
  const wire = illumination.querySelector('image');
  if (filter && wire) {
    filter.id += '-light';
    wire.setAttribute('filter', `url(#${filter.id})`);
  }

  const light = document.createElement('span');
  light.className = 'collage-light';
  light.setAttribute('aria-hidden', 'true');
  light.append(illumination);
  art.dataset.lighting = 'soft';
  art.replaceChildren(ambient, light);
})();
