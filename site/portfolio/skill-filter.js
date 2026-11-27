(() => {
  const catalog = {
    "access-control": ["Access control", "permissions rbac role management"],
    ai: ["AI", "artificial intelligence machine learning"],
    figma: ["Figma", "", "figma-mark.svg"],
    firebase: ["Firebase", "backend"],
    ios: ["iOS", "iphone ipad app development"],
    mapping: ["Mapping", "maps geospatial gis routing"],
    "open-data": ["Open data", "public data civic data data integration"],
    "product-design": ["Product design", "ux ui interaction design"],
    salesforce: ["Salesforce", "crm service cloud sales cloud", "salesforce-cloud.svg"],
    stripe: ["Stripe", "payments billing subscriptions", "stripe-mark.svg"],
    "web-development": ["Web development", "frontend web app"],
  };
  const popular = ["stripe", "figma", "ai", "salesforce"];
  const orderedSkills = [...popular, ...Object.keys(catalog).filter(id => !popular.includes(id))];
  const selected = new Set();
  const projects = [...document.querySelectorAll("section[data-skills]")].map(element => ({
    element,
    skills: new Set(element.dataset.skills.split(/\s+/)),
  }));

  const filter = document.querySelector(".skill-filter");
  const toggle = filter.querySelector(".skill-filter__toggle");
  const panel = filter.querySelector(".skill-filter__panel");
  const search = filter.querySelector(".skill-filter__search");
  const active = filter.querySelector(".skill-filter__active");
  const groups = [...filter.querySelectorAll("[data-skill-group]")];
  const noSkills = filter.querySelector(".skill-filter__no-skills");
  const empty = document.querySelector(".skill-filter__empty");
  const status = document.querySelector(".skill-filter__status");

  function updateProjects() {
    for (const { id, option, remove } of choices) {
      option.setAttribute("aria-pressed", String(selected.has(id)));
      remove.hidden = !selected.has(id);
    }
    active.hidden = selected.size === 0;

    let count = 0;
    for (const { element, skills } of projects) {
      const matches = [...selected].every(skill => skills.has(skill));
      element.hidden = !matches;
      if (matches) count++;
    }
    empty.hidden = count !== 0;
    status.textContent = count ? `Showing ${count} ${count === 1 ? "project" : "projects"}.` : "No projects match these filters.";
  }

  const choices = orderedSkills.map(id => {
    const [label, aliases, mark] = catalog[id];
    const isPopular = popular.includes(id);
    const option = document.createElement("button");
    option.type = "button";
    option.textContent = label;
    option.setAttribute("aria-pressed", "false");
    if (isPopular && mark) {
      const logo = document.createElement("img");
      logo.className = "skill-filter__logo";
      logo.src = `assets/${mark}`;
      logo.alt = "";
      option.prepend(logo);
    }
    if (!projects.some(({ skills }) => skills.has(id))) {
      const count = document.createElement("span");
      count.className = "skill-filter__option-count";
      count.textContent = "0";
      count.setAttribute("aria-hidden", "true");
      option.append(count);
      option.setAttribute("aria-label", `${label}, no tagged projects`);
    }
    option.addEventListener("click", () => {
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      updateProjects();
    });
    groups[isPopular ? 0 : 1].append(option);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = `${label} ×`;
    remove.setAttribute("aria-label", `Remove ${label} filter`);
    remove.hidden = true;
    remove.addEventListener("click", () => {
      selected.delete(id);
      updateProjects();
      toggle.focus();
    });
    active.append(remove);
    return { id, searchText: `${label} ${aliases}`.toLowerCase(), option, remove };
  });

  function searchSkills() {
    const query = search.value.trim().toLowerCase();
    for (const { option, searchText } of choices) option.hidden = !searchText.includes(query);
    for (const group of groups) group.parentElement.hidden = !group.querySelector("button:not([hidden])");
    noSkills.hidden = choices.some(({ option }) => !option.hidden);
  }

  function setOpen(open) {
    toggle.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
    if (open) {
      search.value = "";
      searchSkills();
      search.focus({ preventScroll: true });
    }
  }

  toggle.addEventListener("click", () => setOpen(panel.hidden));
  search.addEventListener("input", searchSkills);
  filter.addEventListener("keydown", event => {
    if (event.key !== "Escape" || panel.hidden) return;
    event.preventDefault();
    setOpen(false);
    toggle.focus();
  });
  filter.addEventListener("focusout", event => {
    if (event.relatedTarget && !filter.contains(event.relatedTarget)) setOpen(false);
  });
  document.addEventListener("click", event => {
    if (!filter.contains(event.target) && !panel.hidden) setOpen(false);
  });
  empty.querySelector(".skill-filter__clear").addEventListener("click", () => {
    selected.clear();
    updateProjects();
    setOpen(false);
    toggle.focus();
  });

  filter.hidden = false;
})();
