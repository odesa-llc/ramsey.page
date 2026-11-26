/* Stack the sharp, lit exposure over each softened collage. */
(() => {
  if (!CSS.supports('mask-image', 'linear-gradient(black, transparent)')) return;

  for (const art of document.querySelectorAll('.sewing-inspo-art')) {
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
    art.dataset.lighting = 'wide';
    art.replaceChildren(ambient, light);
  }
})();
