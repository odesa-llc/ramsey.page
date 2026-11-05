(function () {
  if (window.__portfolioProjectFilters) return;
  window.__portfolioProjectFilters = true;
  var selected = 'all';
  var boundRoot = null;
  // The unbuilt local preview has no embedded language catalog.
  var text = window.portfolioText || function (key, values) {
    if (key.indexOf('home.') === 0) return key.slice(5);
    var messages = {
      'runtime.countOne': 'Showing {count} project.',
      'runtime.countMany': 'Showing {count} projects.',
      'runtime.filteredOne': 'Showing {count} project in {category}.',
      'runtime.filteredMany': 'Showing {count} projects in {category}.'
    };
    return messages[key].replace(/\{(\w+)\}/g, function (_, name) { return String(values[name]); });
  };

  function apply(root) {
    var grid = root.querySelector('[data-grid]');
    if (!grid) return;
    var count = 0;
    root.dataset.activeProjectFilter = selected;
    grid.dataset.activeProjectFilter = selected;
    grid.querySelectorAll('[data-project-categories]').forEach(function (card) {
      var matches = selected === 'all' || card.dataset.projectCategories.split(/\s+/).includes(selected);
      card.hidden = !matches;
      card.toggleAttribute('data-project-filter-hidden', !matches);
      if (matches) count++;
      else card.querySelectorAll('audio,video').forEach(function (media) { media.pause(); });
    });
    root.querySelectorAll('[data-project-filter]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.projectFilter === selected));
    });
    var status = root.querySelector('[data-project-filter-status]');
    var key = selected === 'all' ? 'count' : 'filtered';
    var message = text('runtime.' + key + (count === 1 ? 'One' : 'Many'), {
      count: count, category: text('home.' + selected)
    });
    if (status && status.textContent !== message) status.textContent = message;
  }

  function scan() {
    var root = document.querySelector('#dc-root [data-screen-label="Home"]');
    if (!root || !root.querySelector('[data-project-filters]')) return;
    var current = root.querySelector('[data-project-filter="' + selected + '"]');
    var grid = root.querySelector('[data-grid]');
    var selectionMatches = selected === 'all'
      ? !root.querySelector('[data-project-filter][aria-pressed="true"]')
      : current && current.getAttribute('aria-pressed') === 'true';
    if (root === boundRoot && grid && grid.dataset.activeProjectFilter === selected && selectionMatches) return;
    boundRoot = root;
    apply(root);
  }
  document.addEventListener('click', function (event) {
    var button = event.target instanceof Element && event.target.closest('[data-project-filter]');
    if (!button || !button.closest('#dc-root')) return;
    // Resize can replace the rendered root between pointerdown and click.
    // Resolve the root from the current button rather than a previous render.
    var root = button.closest('[data-screen-label="Home"]');
    if (!root) return;
    selected = selected === button.dataset.projectFilter ? 'all' : button.dataset.projectFilter;
    boundRoot = root;
    apply(root);
  });
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
