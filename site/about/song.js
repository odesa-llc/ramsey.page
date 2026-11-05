document.querySelectorAll('.song-toggle').forEach(button=>{
  const control=button.closest('.song-controls');
  const field=control.querySelector('input');
  button.addEventListener('click',()=>{
    const open=button.getAttribute('aria-expanded')!=='true';
    button.setAttribute('aria-expanded',String(open));
    control.dataset.open=String(open);
    field.disabled=!open;
    control.querySelector('.song-reveal').setAttribute('aria-hidden',String(!open));
    if(open)requestAnimationFrame(()=>field.focus());
  });
  field.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    event.preventDefault();
    button.setAttribute('aria-expanded','false');
    control.dataset.open='false';
    field.disabled=true;
    control.querySelector('.song-reveal').setAttribute('aria-hidden','true');
    button.focus();
  });
});
