(function () {
  if (window.__projectAudioBound) return;
  window.__projectAudioBound = true;
  var text = window.portfolioText;
  var number = new Intl.NumberFormat(document.documentElement.lang || 'en', {minimumFractionDigits: 1, maximumFractionDigits: 1});
  var active = null;
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function bind(player) {
    if (player.closest('x-dc') || player.dataset.audioBound) return;
    var button = player.querySelector('[data-project-audio]');
    var audio = player.parentElement.querySelector('[data-project-audio-media]');
    var range = player.querySelector('[data-audio-position]');
    var clock = player.querySelector('[data-audio-time]');
    var label = player.querySelector('[data-audio-label]');
    if (!button || !audio || !range || !clock || !label) return;
    player.dataset.audioBound = 'true';
    var frame = null, revealing = false;

    function paint() {
      var duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      var current = audio.currentTime || 0;
      var progress = duration ? Math.min(100, current / duration * 100) : 0;
      range.value = String(progress);
      range.style.setProperty('--audio-progress', progress + '%');
      range.setAttribute('aria-valuetext', text('runtime.audioPosition', {current: number.format(current), duration: number.format(duration)}));
      var time = text('runtime.time', {current: number.format(current)});
      if (clock.textContent !== time) clock.textContent = time;
    }
    function state() {
      var playing = !audio.paused && !audio.ended;
      player.toggleAttribute('data-audio-playing', playing);
      button.setAttribute('aria-label', text(playing ? 'runtime.pauseAudio' : 'runtime.playAudio'));
      label.textContent = text(playing ? 'runtime.pause' : 'runtime.play');
      if (playing) {
        active = audio;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(tick);
      } else {
        if (active === audio) active = null;
        cancelAnimationFrame(frame);
      }
      paint();
    }
    function tick() {
      if (!player.isConnected || audio.paused || audio.ended) { state(); return; }
      paint();
      frame = requestAnimationFrame(tick);
    }
    function reveal() {
      if (revealing || player.hasAttribute('data-audio-open') || !player.isConnected) return;
      var rect = player.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= window.innerHeight) return;
      if (document.querySelector('#portfolio-load-gate')) return;
      revealing = true;
      // Leave one rendered frame at the compact size before opening the timeline.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { player.setAttribute('data-audio-open', 'true'); });
      });
    }
    player.revealAudio = reveal;
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (!audio.paused && !audio.ended) { audio.pause(); return; }
      if (active && active !== audio) active.pause();
      if (audio.ended) audio.currentTime = 0;
      var play = audio.play();
      if (play && play.catch) play.catch(state);
    });
    range.addEventListener('input', function () {
      if (Number.isFinite(audio.duration)) audio.currentTime = Number(range.value) / 100 * audio.duration;
      paint();
    });
    range.addEventListener('pointerdown', function () { player.setAttribute('data-audio-seeking', 'true'); });
    function releaseSeek() { player.removeAttribute('data-audio-seeking'); }
    range.addEventListener('pointerup', releaseSeek);
    range.addEventListener('pointercancel', releaseSeek);
    range.addEventListener('blur', releaseSeek);
    ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked'].forEach(function (event) { audio.addEventListener(event, paint); });
    ['play', 'pause', 'ended', 'error'].forEach(function (event) { audio.addEventListener(event, state); });
    if (motion.matches) player.setAttribute('data-audio-open', 'true');
    var visibility = new IntersectionObserver(function () { reveal(); });
    visibility.observe(player);
    paint();
    reveal();
  }
  function scan() {
    document.querySelectorAll('[data-audio-player]').forEach(function (player) {
      bind(player);
      if (player.revealAudio) player.revealAudio();
    });
  }
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
