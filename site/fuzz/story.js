const stage = document.querySelector('.reveal-stage');
const viewButtons = [...document.querySelectorAll('button[data-view]')];
const compact = matchMedia('(max-width: 999px)');
const hint = document.querySelector('.view-hint');
const boardCaption = document.querySelector('.board-caption');
const fuzzText = window.portfolioText;
const captions = { photo: fuzzText('runtime.boardPhoto'), overlay: fuzzText('runtime.boardOverlay'), diagram: fuzzText('runtime.boardDiagram') };
const views = ['photo', 'overlay', 'diagram'];
let chosenView = null;
const defaultView = () => 'overlay';

function setView(view) {
  if (!stage) return;
  stage.dataset.view = view;
  stage.setAttribute('aria-label', fuzzText('runtime.boardActivate', {current: captions[view], next: captions[views[(views.indexOf(view) + 1) % views.length]]}));
  if (boardCaption) boardCaption.textContent = captions[view];
  viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
}
function syncViewport() {
  if (hint) hint.textContent = fuzzText(compact.matches ? 'runtime.tap' : 'runtime.click');
  setView(chosenView || defaultView());
}
viewButtons.forEach(button => button.addEventListener('click', () => {
  chosenView = button.dataset.view;
  setView(chosenView);
}));
if (stage) {
  stage.tabIndex = 0;
  stage.setAttribute('role', 'button');
  const toggle = () => {
    chosenView = views[(views.indexOf(stage.dataset.view) + 1) % views.length];
    setView(chosenView);
  };
  stage.addEventListener('click', toggle);
  stage.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); }
    if (event.key === 'Escape') { chosenView = null; setView(defaultView()); }
  });
  compact.addEventListener('change', syncViewport);
  syncViewport();
}

const video = document.querySelector('#bench-video');
const play = document.querySelector('.play-button');
if (video && play) {
  const updateButton = () => {
    play.setAttribute('aria-label', fuzzText(video.paused ? 'runtime.playBench' : 'runtime.pauseBench'));
    play.querySelector('path').setAttribute('d', video.paused ? 'M8 4L20 12 8 20Z' : 'M6 4H10V20H6ZM14 4H18V20H14Z');
  };
  play.addEventListener('click', async () => {
    if (!video.paused) { video.pause(); return; }
    video.controls = true;
    try { await video.play(); }
    catch { video.focus(); }
  });
  ['play', 'pause', 'ended'].forEach(event => video.addEventListener(event, updateButton));
}

document.fonts.ready.then(() => {
  document.documentElement.dataset.fontReady = String(document.fonts.check('28px "Notebook Hand"'));
  document.documentElement.dataset.fontFamily = getComputedStyle(document.body).fontFamily;
});
