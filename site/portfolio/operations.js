const scene = document.querySelector(".operations-demo");
const papers = [...scene.querySelectorAll(".demo-paper")];
const capture = scene.querySelector(".tidle-capture");
const entry = scene.querySelector(".tidle-entry");
const add = scene.querySelector(".tidle-add");
const activity = scene.querySelector(".tidle-activity");
const list = scene.querySelector(".tidle-list");
const rows = scene.querySelector(".tidle-rows");
const tasks = [...rows.children];
const receipt = scene.querySelector(".demo-receipt");
const receiptImage = receipt.querySelector("img");

const easeOut = "cubic-bezier(.23, 1, .32, 1)";
const receiptStart = 37.815 - (960 / 1354) * 405.208;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let inView = false;
let playback;

function hold(duration) {
  return scene.animate([], { duration }).finished;
}

function setEntry(title) {
  entry.textContent = title ?? "New task";
  entry.toggleAttribute("data-placeholder", title == null);
}

function revealEntry(title) {
  setEntry(title);
  entry.animate({ opacity: [0, 1], transform: ["translateY(.26em)", "translateY(0)"] }, {
    duration: 255,
    easing: easeOut,
  });
}

function pulseAdd() {
  add.animate([
    { transform: "scale(1)", backgroundColor: "#423f45", color: "#f4f4f4" },
    { transform: "scale(.94)", backgroundColor: "#c8dee0", color: "#191a1c", offset: .22 },
    { transform: "scale(1)", backgroundColor: "#c8dee0", color: "#191a1c", offset: .48 },
    { transform: "scale(1)", backgroundColor: "#423f45", color: "#f4f4f4" },
  ], { duration: 350, easing: easeOut });
}

function appendTask(row) {
  const startHeight = list.offsetHeight;
  rows.append(row);
  list.animate({ height: [`${startHeight}px`, `${list.offsetHeight}px`] }, {
    duration: 395,
    easing: easeOut,
  });
  row.animate({ transform: ["translateY(-.4em)", "translateY(0)"], opacity: [0, 1] }, {
    duration: 320,
    easing: easeOut,
  });
}

async function addPaperTask(paper, row) {
  setEntry(null);
  activity.hidden = false;
  paper.hidden = false;
  const fall = paper.animate([
    { transform: "translate(-18px, -315px) rotate(-9deg) scale(.94)", easing: "cubic-bezier(.3, .76, .44, 1)" },
    { transform: "translateY(6px) rotate(1deg) scale(1.025)", offset: .54, easing: easeOut },
    { transform: "translateY(-7px) rotate(-1deg) scale(1)", offset: .67, easing: easeOut },
    { transform: "translateY(1px) rotate(0) scale(1)", offset: .75, easing: "cubic-bezier(.48, 0, .85, .44)" },
    { transform: "translateY(252px) rotate(0) scale(.9)" },
  ], { duration: 820, fill: "both" });

  await hold(515);
  revealEntry(row.querySelector(".tidle-task").textContent);
  await fall.finished;

  paper.hidden = true;
  fall.cancel();
  activity.hidden = true;
  pulseAdd();
  capture.animate({ transform: ["translateY(2px)", "translateY(0)"] }, { duration: 235, easing: easeOut });
  appendTask(row);
}

async function closeList() {
  revealEntry(`${tasks.length} tasks added`);
  add.textContent = "Done";
  const collapse = list.animate([
    { height: `${list.offsetHeight}px`, opacity: 1 },
    { height: "0px", opacity: 0, paddingBlock: "0px", marginTop: "0px" },
  ], { duration: 400, easing: "cubic-bezier(.4, 0, .2, 1)", fill: "forwards" });

  await collapse.finished;
  list.hidden = true;
  collapse.cancel();
}

async function printReceipt() {
  receipt.hidden = false;
  await receiptImage.animate({
    transform: [`translateY(${receiptStart}px)`, "translateY(0)"],
  }, { duration: 5700, easing: "linear" }).finished;

  await hold(500);
  pulseAdd();
  receiptImage.animate({ transform: ["translateY(0)", "translateY(5px)"] }, {
    duration: 130,
    easing: easeOut,
    fill: "forwards",
  });

  await hold(300);
  await receiptImage.animate([
    { transform: "translateY(5px) rotate(0)" },
    { transform: "translateY(9px) rotate(1.6deg)", offset: .13 },
    { transform: "translateY(5px) rotate(1.3deg)", offset: .28 },
    { transform: "translateY(340px) rotate(5.5deg)" },
  ], { duration: 950, easing: "cubic-bezier(.42, 0, .88, .4)", fill: "forwards" }).finished;
}

function resetWidget(animated = false) {
  for (const animation of scene.getAnimations({ subtree: true })) {
    if (!("animationName" in animation)) animation.cancel();
  }

  papers.forEach((paper) => { paper.hidden = animated; });
  rows.replaceChildren(...(animated ? [] : tasks));
  setEntry(null);
  add.textContent = "Add";
  activity.hidden = true;
  list.hidden = false;
  receipt.hidden = true;
}

async function playWidget(signal) {
  while (!signal.aborted) {
    resetWidget(true);
    await hold(550);

    for (const [index, row] of tasks.entries()) {
      await addPaperTask(papers[index], row);
      await hold(435);
    }

    await hold(600);
    await closeList();
    await printReceipt();
    await hold(400);
  }
}

function updateMotion() {
  const shouldRun = inView && !document.hidden && !reducedMotion.matches;

  if (shouldRun && !playback) {
    playback = new AbortController();
    const { signal } = playback;
    playWidget(signal).catch((error) => {
      if (signal.aborted) return;
      playback = null;
      resetWidget();
      console.error(error);
    });
  } else if (!shouldRun && playback) {
    playback.abort();
    playback = null;
    resetWidget();
  }
}

if (!CSS.supports("scale", "calc(.152439cqw / 1px)")) {
  new ResizeObserver(([entry]) => {
    scene.style.transform = `scale(${entry.contentRect.width / 656})`;
  }).observe(scene.parentElement);
}

new IntersectionObserver(([entry]) => {
  inView = entry.intersectionRatio >= .5;
  updateMotion();
}, { threshold: .5 }).observe(scene);

reducedMotion.addEventListener("change", updateMotion);
document.addEventListener("visibilitychange", updateMotion);

const rentReel = document.querySelector("[data-rent]");
const rentBadge = rentReel.closest(".odesa-project__price");
const rentPanel = rentBadge.parentElement;
const monthlyRent = Number(rentReel.dataset.rent);
const formatRent = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const rentThreshold = .35;
let rentInView = false;
let rentAnimation;

const rentStops = [0, .375, .75, 1].map((fraction) => {
  const stop = document.createElement("span");
  stop.textContent = formatRent.format(Math.round(monthlyRent * fraction));
  return stop;
});
rentReel.replaceChildren(...rentStops);
const rentRest = `translateY(${-100 * (rentStops.length - 1) / rentStops.length}%)`;
rentReel.style.setProperty("--rent-rest", rentRest);

function resetRent() {
  rentAnimation?.cancel();
  rentAnimation = undefined;
  delete rentBadge.dataset.rolling;
}

function updateRentMotion() {
  if (reducedMotion.matches) {
    resetRent();
    return;
  }
  if (!rentInView || rentAnimation) return;

  rentBadge.dataset.rolling = "";
  const animation = rentReel.animate({
    transform: ["translateY(0)", rentRest],
  }, { duration: 1320, easing: "cubic-bezier(.36, .13, .24, 1)", fill: "forwards" });
  rentAnimation = animation;
  animation.onfinish = () => {
    if (rentAnimation === animation) delete rentBadge.dataset.rolling;
  };
}

new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) resetRent();
  rentInView = entry.intersectionRatio >= rentThreshold;
  updateRentMotion();
}, { threshold: [0, rentThreshold] }).observe(rentPanel);
reducedMotion.addEventListener("change", updateRentMotion);
