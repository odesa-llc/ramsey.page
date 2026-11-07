// The selected projects share visibility and navigation metadata.
(function () {
  var projects = [
    { id: 'handbag', path: '/handbag/', slide: 2, visible: true },
    { id: 'tidle', path: '/tidle/', slide: 0, visible: true },
    { id: 'restitch', path: '/restitch/', slide: 3, visible: true },
    { id: 'breadboard', path: '/fuzz/', slide: 4, visible: true },
    { id: 'beirut', path: '/beirut/', slide: 1, visible: true },
    { id: 'role-management', path: '/role-management/', slide: 5, visible: true }
  ];
  window.PORTFOLIO_PROJECTS = projects;
  var hidden = projects.filter(function (project) { return !project.visible; });
  var selectors = [];
  hidden.forEach(function (project) {
    selectors.push('a[href="' + project.path + '"]');
    selectors.push('[data-dots] > [data-project-slide="' + project.slide + '"]');
  });
  if (selectors.length) {
    var style = document.createElement('style');
    style.id = 'portfolio-project-visibility';
    style.textContent = selectors.join(',') + '{display:none!important}';
    document.head.appendChild(style);
  }
})();
