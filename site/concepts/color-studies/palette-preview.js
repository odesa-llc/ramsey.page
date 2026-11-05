(function(){
  var requested=new URL(location.href).searchParams.get('palette-study');
  var preview=requested!==null;
  var id=requested||window.ramseyDefaultPalette||'original';
  // BEGIN PALETTE DATA
  var palettes={"blend-17": ["#F8F8F5", "#142A5F", "#EDECE4", "#B8CBD4"], "blend-33": ["#F7F7F4", "#1C2F58", "#ECEBE3", "#B9C9CF"], "blend-50": ["#F7F6F3", "#233452", "#ECEAE2", "#B9C8CB"], "blend-67": ["#F7F6F2", "#2A384C", "#EBEAE0", "#B9C7C7"], "blend-83": ["#F6F6F1", "#323D45", "#EAE9DF", "#BAC5C2"], "chalk-graphite": ["#F6F5F0", "#39423F", "#E9E8DE", "#BAC4BE"]};
  // END PALETTE DATA
  var colors=palettes[id];if(!colors&&id!=='original')return;
  var root=document.documentElement,assetRoot='/concepts/color-studies/assets/'+id+'/';root.dataset.sitePalette=id;
  if(colors){
  root.dataset.paletteStudy=id;if(preview)root.dataset.palettePreview='true';
  ['background','ink','surface','accent'].forEach(function(key,i){root.style.setProperty('--study-'+key,colors[i]);});
  root.style.setProperty('--study-underline','url("'+assetRoot+'underline.svg")');
  var css=document.createElement('link');css.rel='stylesheet';css.href='/concepts/color-studies/palette-preview.css?v=2';document.head.appendChild(css);
  }
  var artwork={'/assets/eiffel-tower-sketch.svg':'eiffel-tower-sketch.svg','/assets/music-note-sketch.svg':'music-note-sketch.svg','/assets/ascii-face/ramsey-retro-selected-outline.svg':'avatar.svg'};
  function applyArtwork(){if(!colors)return;document.querySelectorAll('img[src]').forEach(function(image){var current=image.getAttribute('src').split('?')[0];if(artwork[current])image.setAttribute('src',assetRoot+artwork[current]);});}
  function start(){
    applyArtwork();new MutationObserver(applyArtwork).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',function(event){
      if(!preview)return;
      var anchor=event.target.closest('a[href]');if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return;
      var url=new URL(anchor.href,location.href);
      if(url.origin!==location.origin||!/^\/(?:$|about\/?$|handbag\/?$|tidle\/?$|restitch\/?$|fuzz\/?$|beirut\/?$)/.test(url.pathname))return;
      url.searchParams.set('palette-study',id);anchor.href=url.pathname+url.search+url.hash;
    },true);
    if(window.parent!==window)window.parent.postMessage({type:'palette-study-page',palette:id,path:location.pathname},location.origin);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
