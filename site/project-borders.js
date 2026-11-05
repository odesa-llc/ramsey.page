/* Shared responsive edge treatments for project images and marked image boxes. */
(function () {
  if (window.__portfolioBorders) return;
  window.__portfolioBorders = true;
  var NS = 'http://www.w3.org/2000/svg';
  var entries = new Map();
  var pending = false;
  var resize = window.ResizeObserver ? new ResizeObserver(schedule) : null;

  function random(seed) {
    return function () {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      return (seed >>> 0) / 4294967296;
    };
  }
  function hashKey(key) {
    var hash = 2166136261;
    for (var i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
    return hash >>> 0;
  }
  function projectKey(card) {
    var explicit = card.getAttribute('data-border-key') || card.getAttribute('data-project-id') || card.getAttribute('data-tile') || card.getAttribute('data-project-card');
    if (explicit) return explicit;
    var link = card.matches('a[href]') ? card : card.querySelector('a[href]');
    if (link) {
      var href = link.getAttribute('href');
      var pathname;
      try { pathname = new URL(href, location.href).pathname.replace(/\/+$/, '') || '/'; }
      catch (_) { pathname = href; }
      var project = (window.PORTFOLIO_PROJECTS || []).find(function (item) {
        return (item.path || '').replace(/\/+$/, '') === pathname;
      });
      return project ? project.id : pathname;
    }
    var image = card.querySelector('img[src]');
    return image ? 'image:' + image.getAttribute('src').split('?')[0] : null;
  }
  function profileFor(key, override) {
    var seed = hashKey('uneven-corners-v1:' + key);
    var rng = random(seed);
    var amount = .65 + rng() * .85;
    if (override !== null && override !== '' && Number.isFinite(Number(override))) {
      amount = Math.max(.4, Math.min(1.8, Number(override)));
    }
    return {seed:seed, amount:amount};
  }
  function unevenCorners(w, h, profile) {
    var rng = random(profile.seed ^ 0x9e3779b9);
    var shortSide = Math.min(w, h);
    var unit = Math.max(.55, Math.min(1.3, shortSide / 300)) * profile.amount;
    function edge() { return Math.min(shortSide * .035, (.45 + rng() * 3) * unit); }
    function cut() { return Math.min(shortSide * .075, (1.1 + rng() * 6.9) * unit); }
    var leftTop=edge(), leftMid=edge(), leftBottom=edge();
    var rightTop=edge(), rightMid=edge(), rightBottom=edge();
    var topLeft=edge(), topMid=edge(), topRight=edge();
    var bottomLeft=edge(), bottomMid=edge(), bottomRight=edge();
    // Each corner gets its own cut length and angle; the straight image box
    // remains intact, with only a few pixels of the perimeter trimmed away.
    return [
      [leftTop+cut(), topLeft], [w*(.38+rng()*.24), topMid],
      [w-rightTop-cut(), topRight], [w-rightTop, topRight+cut()],
      [w-rightMid, h*(.38+rng()*.24)], [w-rightBottom, h-bottomRight-cut()],
      [w-rightBottom-cut(), h-bottomRight], [w*(.38+rng()*.24), h-bottomMid],
      [leftBottom+cut(), h-bottomLeft], [leftBottom, h-bottomLeft-cut()],
      [leftMid, h*(.38+rng()*.24)], [leftTop, topLeft+cut()]
    ];
  }
  function perimeter(w, h, key, variant, profile) {
    var seed = hashKey(key);
    var rng = random(873 + seed + variant * 89);
    var points = [];
    if (variant === 2) return unevenCorners(w, h, profile);
    var pitch = variant === 3 ? 7 : 22;
    var amplitude = variant === 3 ? 3.1 : variant === 4 ? 2.5 : 1.4;
    var pad = variant === 3 ? 1.25 : 1;
    function offset(position, length, side) {
      var gentle = Math.sin(position / length * Math.PI * 4 + (seed % 100) * .8 + side * .6) * amplitude * .45;
      var irregular = (rng() - .5) * amplitude * (variant === 3 ? 1.6 : .6);
      return Math.max(.25, pad + amplitude * .45 + gentle + irregular);
    }
    var x, y;
    for (x = 1; x < w; x += pitch) points.push([x, offset(x, w, 0)]);
    points.push([w - 1, 1.5]);
    for (y = 1; y < h; y += pitch) points.push([w - offset(y, h, 1), y]);
    points.push([w - 1, h - 1]);
    for (x = w - 1; x > 0; x -= pitch) points.push([x, h - offset(x, w, 2)]);
    points.push([1, h - 1]);
    for (y = h - 1; y > 0; y -= pitch) points.push([offset(y, h, 3), y]);
    return points;
  }
  function path(points, smooth) {
    if (!smooth) return 'M ' + points.map(function (p) {
      return p.map(function (n) { return n.toFixed(2); }).join(' ');
    }).join(' L ') + ' Z';
    var last = points[points.length - 1];
    var d = 'M ' + [(points[0][0] + last[0]) / 2, (points[0][1] + last[1]) / 2].join(' ');
    points.forEach(function (point, index) {
      var next = points[(index + 1) % points.length];
      d += ' Q ' + point.join(' ') + ' ' + [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2].join(' ');
    });
    return d + ' Z';
  }
  function roundedUnevenPath(points, w, h, profile) {
    var rng = random(profile.seed ^ 0x85ebca6b);
    function bounded(point) {
      return [Math.max(.1, Math.min(w - .1, point[0])), Math.max(.1, Math.min(h - .1, point[1]))];
    }
    function coordinates(point) {
      return point.map(function (n) { return n.toFixed(2); }).join(' ');
    }
    function edge(start, middle, end) {
      // Follow the slight project-specific bend without introducing a kink.
      var control = bounded([2 * middle[0] - (start[0] + end[0]) / 2, 2 * middle[1] - (start[1] + end[1]) / 2]);
      return ' Q ' + coordinates(control) + ' ' + coordinates(end);
    }
    function corner(start, end, outer) {
      // Vary the softness a little at each corner instead of repeating a
      // perfectly circular radius or joining the sides with a straight cut.
      var softness = .03 + rng() * .15;
      var control = bounded([
        outer[0] * (1 - softness) + (start[0] + end[0]) / 2 * softness,
        outer[1] * (1 - softness) + (start[1] + end[1]) / 2 * softness
      ]);
      return ' Q ' + coordinates(control) + ' ' + coordinates(end);
    }
    return 'M ' + coordinates(points[0]) +
      edge(points[0], points[1], points[2]) +
      corner(points[2], points[3], [points[3][0], points[2][1]]) +
      edge(points[3], points[4], points[5]) +
      corner(points[5], points[6], [points[5][0], points[6][1]]) +
      edge(points[6], points[7], points[8]) +
      corner(points[8], points[9], [points[9][0], points[8][1]]) +
      edge(points[9], points[10], points[11]) +
      corner(points[11], points[0], [points[11][0], points[0][1]]) + ' Z';
  }
  function addPath(svg, d, className) {
    var line = document.createElementNS(NS, 'path');
    line.setAttribute('d', d);
    if (className) line.setAttribute('class', className);
    svg.appendChild(line);
  }
  function restore(art, entry) {
    if (entry.frame) entry.frame.remove();
    entry.frame = null;
    if (entry.appliedClip && art.style.clipPath === entry.appliedClip) {
      if (entry.originalClip) art.style.setProperty('clip-path', entry.originalClip, entry.originalPriority);
      else art.style.removeProperty('clip-path');
    }
    art.classList.remove('portfolio-border-art');
    entry.appliedClip = null;
    entry.key = '';
  }
  function render() {
    pending = false;
    var grid = document.querySelector('#dc-root [data-grid]');
    var choice = document.documentElement.dataset.portfolioBorder;
    var variant = /^[1-4]$/.test(choice || '') ? Number(choice) : 0;
    var seen = new Set();
    var targets = grid ? Array.from(grid.children).map(function (card) {
      return {card:card, art:card.firstElementChild};
    }) : [];
    document.querySelectorAll('#dc-root [data-portfolio-border-art]').forEach(function (art) {
      targets.push({card:art, art:art});
    });
    targets.forEach(function (target) {
      var card = target.card, art = target.art;
      // The workbench introduction and the original layout's filler are text.
      if (!art || art.tagName !== 'DIV' || !art.querySelector('img, [data-tidle-widget], [data-restitch-survey]')) return;
      var identity = projectKey(card);
      if (!identity) return;
      var profile = profileFor(identity, card.getAttribute('data-border-amount'));
      seen.add(art);
      var entry = entries.get(art);
      if (!entry) {
        entry = {originalClip:art.style.getPropertyValue('clip-path'), originalPriority:art.style.getPropertyPriority('clip-path'), key:'', frame:null, appliedClip:null};
        entries.set(art, entry);
        if (resize) resize.observe(art);
      }
      if (!variant) {
        if (entry.frame || entry.appliedClip) restore(art, entry);
        return;
      }
      var w = art.clientWidth, h = art.clientHeight;
      if (w < 10 || h < 10) return;
      var key = [w, h, variant, identity, profile.amount].join(':');
      if (entry.key === key && entry.frame && entry.frame.parentNode === art && art.style.clipPath === entry.appliedClip) return;
      if (entry.frame) entry.frame.remove();
      var points = perimeter(w, h, identity, variant, profile);
      var d = variant === 2 ? roundedUnevenPath(points, w, h, profile) : path(points, variant !== 3);
      art.style.clipPath = "path('" + d + "')";
      entry.appliedClip = art.style.clipPath;
      art.classList.add('portfolio-border-art');
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      svg.setAttribute('class', 'portfolio-border-frame');
      svg.setAttribute('data-project-key', identity);
      svg.setAttribute('data-border-amount', profile.amount.toFixed(3));
      addPath(svg, d);
      if (variant === 4) addPath(svg, path(points.map(function (point, i) {
        return [point[0] + Math.sin(i * .45) * 1.4, point[1] + Math.cos(i * .61) * 1.3];
      }), true), 'second-line');
      art.appendChild(svg);
      entry.frame = svg;
      entry.key = key;
    });
    entries.forEach(function (entry, art) {
      if (seen.has(art)) return;
      restore(art, entry);
      if (resize) resize.unobserve(art);
      entries.delete(art);
    });
  }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(render);
  }
  window.addEventListener('portfolio:borderchange', schedule);
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', schedule);
  // Reconnect to image boxes recreated by the existing carousel/React templates.
  new MutationObserver(schedule).observe(document.documentElement, {
    childList:true, subtree:true, attributes:true,
    attributeFilter:['data-border-key','data-border-amount','data-project-id','data-tile','data-project-card','href']
  });
  schedule();
})();
