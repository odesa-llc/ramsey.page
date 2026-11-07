/* Keep the cards in reading order while measuring two independent mobile columns. */
(function () {
  if (window.__portfolioMobileMasonry) return;
  window.__portfolioMobileMasonry = true;
  var phone = window.matchMedia('(max-width: 700px)');
  var frame = 0;
  var observed = new WeakSet();
  var resize = new ResizeObserver(schedule);

  function schedule() {
    if (!frame) frame = requestAnimationFrame(layout);
  }
  function set(element, name, value) {
    if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
  }
  function project(card) {
    var id = card.dataset.tile || card.dataset.projectCard || card.dataset.projectId;
    if (id) return id;
    if (card.querySelector('[data-handbag-cutout]')) return 'handbag';
    if (card.querySelector('[data-tidle-widget]')) return 'tidle';
    if (card.querySelector('[data-restitch-survey]')) return 'restitch';
    if (card.querySelector('[data-breadboard-cutout]')) return 'breadboard';
    return 'beirut';
  }
  function layout() {
    frame = 0;
    if (!phone.matches) return;
    var root = document.querySelector('#dc-root [data-mobile-layout="masonry"]');
    var grid = root && root.querySelector('[data-grid]');
    if (!grid) return;
    var cards = Array.from(grid.querySelectorAll(':scope > [data-project-categories]'));
    cards.forEach(function (card) {
      var id = project(card);
      if (card.dataset.mobileProject !== id) card.dataset.mobileProject = id;
      if (!observed.has(card)) { observed.add(card); resize.observe(card); }
    });
    if (!observed.has(grid)) { observed.add(grid); resize.observe(grid); }
    set(grid, '--mobile-card-width', ((grid.getBoundingClientRect().width - 14) / 2).toFixed(3) + 'px');
    cards = cards.filter(function (card) { return !card.hidden && getComputedStyle(card).display !== 'none'; });
    var fullGallery = cards.length === 6 && (!grid.dataset.activeProjectFilter || grid.dataset.activeProjectFilter === 'all');
    var columns = {handbag: 0, tidle: 1, restitch: 1, breadboard: 0, beirut: 1};
    var bottoms = [0, 0];
    // The retained workbench template keeps its introduction inside the grid.
    var introduction = grid.querySelector(':scope > .tile-introduction');
    if (introduction) {
      var introHeight = Math.ceil(introduction.getBoundingClientRect().height);
      set(introduction, '--masonry-span', String(introHeight));
      bottoms = [introHeight, introHeight];
      if (!observed.has(introduction)) { observed.add(introduction); resize.observe(introduction); }
    }
    cards.forEach(function (card) {
      if (card.dataset.mobileProject === 'role-management') {
        var top = Math.max(bottoms[0], bottoms[1]);
        var roleHeight = Math.ceil(card.getBoundingClientRect().height);
        set(card, '--masonry-column', '1');
        set(card, '--masonry-row', String(top + 1));
        set(card, '--masonry-span', String(roleHeight));
        bottoms = [top + roleHeight + 28, top + roleHeight + 28];
        return;
      }
      var column = fullGallery ? columns[card.dataset.mobileProject] : (bottoms[0] <= bottoms[1] ? 0 : 1);
      var height = Math.ceil(card.getBoundingClientRect().height);
      set(card, '--masonry-column', String(column + 1));
      set(card, '--masonry-row', String(bottoms[column] + 1));
      set(card, '--masonry-span', String(height));
      bottoms[column] += height + 28;
    });
    if (!grid.hasAttribute('data-masonry-ready')) grid.setAttribute('data-masonry-ready', '');
  }

  phone.addEventListener('change', schedule);
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', schedule);
  if (document.fonts) document.fonts.ready.then(schedule);
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['hidden', 'data-project-filter-hidden', 'data-active-project-filter']
  });
  schedule();
})();
