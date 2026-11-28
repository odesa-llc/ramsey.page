(() => {
  const main = document.querySelector("main");
  const dialog = document.querySelector(".project-focus");
  if (typeof dialog.showModal !== "function") return;

  const content = dialog.querySelector(".project-focus__content");
  const back = dialog.querySelector(".project-focus__back");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const duration = 460;
  const slideEase = "cubic-bezier(.2, .72, .24, 1)";
  let active;

  function reset() {
    const { panel, placeholder, title, logo, opener, animations } = active;
    for (const animation of animations) animation.cancel();
    placeholder.replaceWith(panel);
    title.classList.remove("project-focus-source");
    logo.classList.remove("project-focus-source");
    dialog.close();
    content.replaceChildren();
    active = undefined;
    opener.focus({ preventScroll: true });
  }

  function close() {
    if (!active || active.closing) return;
    if (!active.animations.length || reducedMotion.matches ||
        active.viewportWidth !== innerWidth || active.viewportHeight !== innerHeight) {
      reset();
      return;
    }
    active.closing = true;
    for (const animation of active.animations) animation.reverse();
    Promise.all(active.animations.map(animation => animation.finished)).then(reset);
  }

  function slide(element, from, heading = false) {
    const to = element.getBoundingClientRect();
    const dx = from.x - to.x;
    const dy = from.y - to.y;
    const frames = [
      { transform: `translate(${dx}px, ${dy}px)`, offset: 0, easing: slideEase },
      { transform: "none", offset: 1 },
    ];
    // The heading rises slightly faster so the artwork never crosses the name.
    if (heading) frames.splice(1, 0, {
      transform: `translate(${dx * .37}px, ${dy * .26}px)`,
      offset: .25,
      easing: slideEase,
    });
    return element.animate(frames, { duration, fill: "both" });
  }

  function open({ panel, title, logo, detail }, opener) {
    if (active) return;
    const titleBox = title.getBoundingClientRect();
    const logoBox = logo.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    const headingStart = { x: Math.min(titleBox.left, logoBox.left), y: titleBox.top };
    const placeholder = document.createElement("div");
    placeholder.className = "operations__panel";
    placeholder.style.aspectRatio = getComputedStyle(panel).aspectRatio;
    placeholder.setAttribute("aria-hidden", "true");

    const heading = document.createElement("div");
    heading.className = "project-focus__heading";
    heading.style.height = titleBox.height + "px";
    const name = document.createElement("h2");
    name.className = "operations__title";
    name.id = "project-focus-title";
    name.textContent = title.textContent;
    name.style.fontSize = getComputedStyle(title).fontSize;
    const mark = logo.cloneNode(true);
    const details = detail?.content.cloneNode(true);
    const palette = details?.querySelector(".project-focus__palette");
    const description = details?.querySelector(".project-focus__description");
    if (!palette) {
      for (const [element, box] of [[name, titleBox], [mark, logoBox]]) {
        Object.assign(element.style, {
          left: box.x - headingStart.x + "px",
          top: box.y - headingStart.y + "px",
          width: box.width + "px",
          height: box.height + "px",
        });
      }
    }
    heading.append(mark, name);
    if (palette) heading.append(palette);
    panel.replaceWith(placeholder);
    content.style.setProperty("--focus-artwork-width", panelBox.width + "px");
    content.append(heading);
    if (details) content.append(details);
    content.append(panel);
    title.classList.add("project-focus-source");
    logo.classList.add("project-focus-source");
    dialog.showModal();

    const animations = reducedMotion.matches
      ? [main.animate({ opacity: [0, 0] }, { duration: 0, fill: "both" })]
      : [
          slide(heading, headingStart, true),
          slide(panel, panelBox),
          main.animate({ opacity: [1, 0] }, { duration, fill: "both", easing: "ease-out" }),
          back.animate({ opacity: [0, 1] }, { duration, easing: "ease-in" }),
        ];
    if (description && !reducedMotion.matches) {
      animations.push(description.animate({ opacity: [0, 1] }, { duration, easing: "ease-in" }));
    }
    active = { panel, placeholder, title, logo, opener, animations, viewportWidth: innerWidth, viewportHeight: innerHeight };
  }

  back.addEventListener("click", close);
  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    close();
  });

  for (const project of main.querySelectorAll("section.operations")) {
    const title = project.querySelector(".operations__title");
    const logo = project.querySelector(".pwc-project__partners") ?? project.querySelector(".operations__project-icon");
    const panel = project.querySelector(".operations__panel");
    const detail = project.querySelector("template.project-focus__detail");
    const titleButton = document.createElement("button");
    titleButton.type = "button";
    titleButton.className = "project-focus__trigger";
    titleButton.setAttribute("aria-haspopup", "dialog");
    titleButton.append(...title.childNodes);
    title.append(titleButton);

    const artworkButton = document.createElement("button");
    artworkButton.type = "button";
    artworkButton.className = "project-focus__artwork-trigger";
    artworkButton.setAttribute("aria-label", `Open ${title.textContent.trim()} project`);
    artworkButton.setAttribute("aria-haspopup", "dialog");
    panel.append(artworkButton);

    for (const button of [titleButton, artworkButton]) {
      button.addEventListener("click", () => open({ title, logo, panel, detail }, button));
    }
  }
})();
