(function () {
  var reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  function bind() {
    var root=document.querySelector('#dc-root .tile-study');
    if(!root)return false;
    if(root.dataset.motionBound)return true;
    root.dataset.motionBound='true';
    var cards=Array.from(root.querySelectorAll('[data-tile]'));
    var observers=[],frame=0;
    function ordered(){return cards.slice().sort(function(a,b){var x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return Math.abs(x.top-y.top)>12?x.top-y.top:x.left-y.left;});}
    if(!reduced.matches && 'IntersectionObserver' in window){
      ordered().forEach(function(card,index){card.dataset.reveal='pending';card.style.setProperty('--reveal-delay',Math.min(index,3)*65+'ms');});
      var reveal=new IntersectionObserver(function(entries){
        entries.forEach(function(entry){if(entry.isIntersecting){entry.target.dataset.reveal='shown';reveal.unobserve(entry.target);}});
      },{threshold:0.06,rootMargin:'0px 0px -12px 0px'});
      cards.forEach(function(card){reveal.observe(card);}); observers.push(reveal);
    }else{cards.forEach(function(card){card.dataset.reveal='shown';});}
    // The offset gallery moves only the backdrop; its draggable foreground remains independent.
    function pan(){
      frame=0;
      if(reduced.matches || !root.classList.contains('tile-study-3') || innerWidth<=700){cards.forEach(function(card){card.firstElementChild.style.removeProperty('--gallery-pan');});return;}
      cards.forEach(function(card){
        var art=card.firstElementChild,r=art.getBoundingClientRect();
        if(r.bottom<0 || r.top>innerHeight)return;
        var offset=Math.max(-5,Math.min(5,(r.top+r.height/2-innerHeight/2)*-.018));
        art.style.setProperty('--gallery-pan',offset.toFixed(2)+'px');
      });
    }
    function schedule(){if(!frame)frame=requestAnimationFrame(pan);}
    window.addEventListener('scroll',schedule,{passive:true}); window.addEventListener('resize',schedule); schedule();
    cards.forEach(function(card){
      card.addEventListener('pointerdown',function(event){
        if(!event.target.closest('[data-handbag-cutout],[data-widget-cutout],[data-breadboard-cutout]'))return;
        card.classList.add('is-handling');
      });
      function release(){card.classList.remove('is-handling');}
      card.addEventListener('pointerup',release);card.addEventListener('pointercancel',release);card.addEventListener('lostpointercapture',release);
    });
    function syncMotion(){
      if(reduced.matches){observers.forEach(function(observer){observer.disconnect();});cards.forEach(function(card){card.dataset.reveal='shown';card.firstElementChild.style.removeProperty('--gallery-pan');});}
      else schedule();
    }
    reduced.addEventListener('change',syncMotion);
    window.addEventListener('pagehide',function(){cancelAnimationFrame(frame);observers.forEach(function(observer){observer.disconnect();});});
    window.addEventListener('pageshow',function(event){if(event.persisted){cards.forEach(function(card){card.dataset.reveal='shown';});schedule();}});
    return true;
  }
  if(!bind()){
    var observer=new MutationObserver(function(){if(bind())observer.disconnect();});
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
})();
