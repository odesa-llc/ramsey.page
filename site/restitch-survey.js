/* One entrance settle, followed by a restrained pointer-weighted spring. */
(function () {
  if (window.__restitchSurveyGravity) return;
  window.__restitchSurveyGravity = true;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fineHover = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
  var scenes = new Set();
  var bound = new WeakSet();
  var axes = ['x', 'y', 'angle', 'spread'];

  function neutral() { return {x: 0, y: 0, angle: 0, spread: 0}; }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }

  function paint(scene) {
    var state = scene.state;
    // A single rigid rotation and uniform expansion preserve every pair's spacing.
    // The original transforms on the nineteen individual respondents stay intact.
    var transform = 'translate(' + (scene.cx + state.x).toFixed(4) + ' ' + (scene.cy + state.y).toFixed(4) + ') ' +
      'rotate(' + state.angle.toFixed(4) + ') scale(' + (1 + Math.max(0, state.spread)).toFixed(6) + ') ' +
      'translate(' + (-scene.cx).toFixed(4) + ' ' + (-scene.cy).toFixed(4) + ')';
    scene.pile.setAttribute('transform', (scene.baseTransform ? scene.baseTransform + ' ' : '') + transform);
  }

  function resetMotion(scene) {
    if (scene.frame !== null) cancelAnimationFrame(scene.frame);
    scene.frame = null;
    scene.lastTime = null;
    scene.state = neutral();
    scene.velocity = neutral();
    scene.target = neutral();
    if (scene.baseTransform) scene.pile.setAttribute('transform', scene.baseTransform);
    else scene.pile.removeAttribute('transform');
    delete scene.root.dataset.gravityHover;
  }

  function restoreExactRest(scene) {
    if (!scene.target.spread) {
      resetMotion(scene);
    } else {
      scene.state = Object.assign({}, scene.target);
      scene.velocity = neutral();
      paint(scene);
      scene.root.dataset.gravityHover = 'active';
    }
  }

  function tick(scene, time) {
    scene.frame = null;
    if (!scene.root.isConnected || reduced.matches || document.hidden) {
      resetMotion(scene);
      return;
    }
    var dt = scene.lastTime === null ? 1 / 60 : clamp((time - scene.lastTime) / 1000, 0, 1 / 30);
    scene.lastTime = time;
    var resting = true;
    axes.forEach(function (axis) {
      // Timestamp-based integration gives the same speed on 60 Hz and 120 Hz screens.
      var distance = scene.target[axis] - scene.state[axis];
      scene.velocity[axis] += (180 * distance - 24 * scene.velocity[axis]) * dt;
      scene.state[axis] += scene.velocity[axis] * dt;
      var threshold = axis === 'spread' ? .00005 : .005;
      if (Math.abs(distance) > threshold || Math.abs(scene.velocity[axis]) > threshold * 10) resting = false;
    });
    // Small bounds also protect the caption, footnote and particle clip during reversal.
    scene.state.x = clamp(scene.state.x, -3.3, 3.3);
    scene.state.y = clamp(scene.state.y, -2.3, 2.3);
    scene.state.angle = clamp(scene.state.angle, -1.4, 1.4);
    scene.state.spread = clamp(scene.state.spread, 0, .055);
    if (resting) {
      scene.lastTime = null;
      restoreExactRest(scene);
      return;
    }
    paint(scene);
    scene.frame = requestAnimationFrame(function (next) { tick(scene, next); });
  }

  function targetMotion(scene) {
    var active = !reduced.matches && !document.hidden && scene.root.dataset.gravityState === 'settled' &&
      ((scene.hovered && fineHover.matches) || scene.focused);
    scene.target = active ? {
      x: scene.hovered ? scene.pointer.x * 3 : 0,
      y: scene.hovered ? scene.pointer.y * 2 : -1.5,
      angle: scene.hovered ? scene.pointer.x * 1.2 : 0,
      spread: .05
    } : neutral();
    if (!active && !scene.root.dataset.gravityHover) return;
    scene.root.dataset.gravityHover = active ? 'active' : 'settling';
    if (scene.frame === null) {
      scene.lastTime = null;
      scene.frame = requestAnimationFrame(function (time) { tick(scene, time); });
    }
  }

  function point(scene, event) {
    var rect = scene.root.getBoundingClientRect();
    var view = scene.root.viewBox.baseVal;
    var scale = Math.min(rect.width / view.width, rect.height / view.height);
    if (!scale) return;
    // Account for SVG's default centered, aspect-preserving viewBox, including letterboxing.
    var x = view.x + (event.clientX - rect.left - (rect.width - view.width * scale) / 2) / scale;
    var y = view.y + (event.clientY - rect.top - (rect.height - view.height * scale) / 2) / scale;
    scene.pointer = {x: clamp((x - scene.cx) / 160, -1, 1), y: clamp((y - scene.cy) / 100, -1, 1)};
  }

  function bindMotion(scene) {
    function move(event) {
      if (event.pointerType === 'touch' || !fineHover.matches || reduced.matches) return;
      scene.hovered = true;
      point(scene, event);
      targetMotion(scene);
    }
    function leave() {
      scene.hovered = false;
      targetMotion(scene);
    }
    scene.root.addEventListener('pointerenter', move, {passive: true});
    scene.root.addEventListener('pointermove', move, {passive: true});
    scene.root.addEventListener('pointerleave', leave, {passive: true});
    scene.root.addEventListener('pointercancel', leave, {passive: true});
    // Keyboard focus on the homepage's existing project link gets the same gentle lift.
    var link = scene.root.closest('a');
    if (link) {
      link.addEventListener('focus', function () { scene.focused = true; targetMotion(scene); });
      link.addEventListener('blur', function () { scene.focused = false; targetMotion(scene); });
    }
  }

  function settle(scene, allowHover) {
    scene.root.dataset.gravityState = 'settled';
    scene.animations.forEach(function (animation) { animation.cancel(); });
    scene.animations = [];
    if (scene.observer) scene.observer.disconnect();
    if (allowHover) targetMotion(scene);
  }

  function fall(scene) {
    if (scene.played) return;
    scene.played = true;
    if (reduced.matches || !scene.dots[0] || !scene.dots[0].animate || document.hidden) {
      settle(scene, true);
      return;
    }
    scene.root.dataset.gravityState = 'falling';
    scene.animations = scene.dots.map(function (dot, index) {
      var variation = (index * 73 + 29) % 101;
      var rise = 10 + variation * .24;
      var drift = Math.sin(index * 2.4) * 2.5;
      var height = Number(dot.dataset.particleY);
      return dot.animate([
        {transform: 'translate(' + drift + 'px, -' + rise + 'px)', opacity: 0, offset: 0, easing: 'cubic-bezier(.4,0,.85,.5)'},
        {transform: 'translate(0px, 1.5px)', opacity: 1, offset: .72, easing: 'ease-out'},
        {transform: 'translate(0px, -.65px)', opacity: 1, offset: .87, easing: 'ease-in-out'},
        {transform: 'translate(0px, 0px)', opacity: 1, offset: 1}
      ], {
        duration: 920 + variation * 1.6,
        delay: Math.max(0, (375 - height) * 1.2) + variation * .65,
        fill: 'both'
      });
    });
    Promise.all(scene.animations.map(function (animation) {
      return animation.finished.catch(function () {});
    })).then(function () { settle(scene, true); });
  }

  function scan() {
    scenes.forEach(function (scene) {
      if (!scene.root.isConnected) {
        settle(scene, false);
        resetMotion(scene);
        scenes.delete(scene);
      }
    });
    document.querySelectorAll('[data-restitch-survey]').forEach(function (root) {
      if (bound.has(root)) return;
      var pile = root.querySelector('[data-restitch-pile]');
      var dots = Array.from(root.querySelectorAll('.restitch-gravity-dot'));
      // Component templates can appear before their SVG children have been inserted.
      if (!pile || !dots.length) return;
      bound.add(root);
      var positions = dots.map(function (dot) {
        var match = /translate\(\s*([-\d.]+)[,\s]+([-\d.]+)/.exec(dot.parentElement.getAttribute('transform') || '');
        return match ? {x: Number(match[1]), y: Number(match[2])} : {x: 200, y: 330};
      });
      var scene = {
        root: root, pile: pile, dots: dots, animations: [], played: false,
        cx: positions.reduce(function (sum, p) { return sum + p.x; }, 0) / positions.length,
        cy: positions.reduce(function (sum, p) { return sum + p.y; }, 0) / positions.length,
        baseTransform: pile.getAttribute('transform') || '',
        hovered: false, focused: false, pointer: {x: 0, y: 0}, frame: null, lastTime: null,
        state: neutral(), velocity: neutral(), target: neutral()
      };
      scenes.add(scene);
      bindMotion(scene);
      if (reduced.matches || !window.IntersectionObserver) { fall(scene); return; }
      root.dataset.gravityState = 'waiting';
      scene.observer = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) fall(scene);
      }, {threshold: .15, rootMargin: '0px 0px -12px 0px'});
      scene.observer.observe(pile);
    });
  }

  reduced.addEventListener('change', function () {
    if (reduced.matches) scenes.forEach(function (scene) {
      scene.played = true;
      settle(scene, false);
      resetMotion(scene);
    });
  });
  fineHover.addEventListener('change', function () {
    if (!fineHover.matches) scenes.forEach(function (scene) { scene.hovered = false; targetMotion(scene); });
  });
  document.addEventListener('visibilitychange', function () {
    scenes.forEach(function (scene) {
      if (document.hidden) {
        scene.hovered = false;
        scene.focused = false;
        resetMotion(scene);
      }
      scene.animations.forEach(function (animation) { if (document.hidden) animation.pause(); else animation.play(); });
    });
  });
  window.addEventListener('pagehide', function () {
    scenes.forEach(function (scene) {
      scene.hovered = false;
      scene.focused = false;
      settle(scene, false);
      resetMotion(scene);
    });
  });
  scan();
  new MutationObserver(scan).observe(document.documentElement, {childList: true, subtree: true});
})();
