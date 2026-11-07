(function(){
  if(window.__portfolioRoleWidget)return;
  window.__portfolioRoleWidget=true;
  function render(button,grouped){
    button.dataset.roleGrouped=String(grouped);
    button.setAttribute('aria-pressed',String(grouped));
    button.querySelectorAll('.role-widget-dot').forEach(function(dot){
      dot.setAttribute('cx',grouped?dot.dataset.groupX:dot.dataset.poolX);
      dot.setAttribute('cy',grouped?dot.dataset.groupY:dot.dataset.poolY);
    });
  }
  document.addEventListener('click',function(event){
    var button=event.target instanceof Element&&event.target.closest('[data-role-toggle]');
    if(button)render(button,button.dataset.roleGrouped!=='true');
  });
})();
