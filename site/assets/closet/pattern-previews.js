(() => {
  const options = new Map([
    ['half-fold', 'Skullcap cutting pattern on a subtly creased half-fold sheet.'],
    ['open-fold', 'Skullcap cutting pattern on a lightly opened folded sheet.'],
    ['three-panel-fold', 'Skullcap cutting pattern on a partly opened three-panel fold.'],
    ['cut-paper-template', 'Folded paper template cut to the shape of the skullcap crown panel.']
  ]);
  const choice = new URLSearchParams(location.search).get('pattern');
  const description = options.get(choice);
  if (!description) return;

  const paper = document.querySelector('.closet-pattern-paper');
  paper.closest('figure').dataset.paper = choice;
  paper.src = '/assets/closet/pattern-' + choice + '.webp';
  paper.alt = description;
  paper.hidden = false;
})();
