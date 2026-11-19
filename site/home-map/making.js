/* Process maps: each has its own notes and measured pencil annotations. */
document.querySelectorAll('.bag-demo[data-kind="map"]').forEach((demo, mapIndex) => {
 'use strict';
 const diagram = demo.querySelector('.bp-note-diagram');
 const graphic = demo.querySelector('.bp-pencil-lines');
 const pieces = [...demo.querySelectorAll('.bp-note-piece')];
 const labels = pieces.map(piece => piece.querySelector('.bp-callout'));
 const list = pieces.map(piece => ({id: piece.dataset.stage, note: piece.dataset.note}));
 const detail = demo.querySelector('.bp-note-detail');
 // Fixed per-project gestures vary the sequence, reach, and direction while
 // keeping the same pen on every redraw and at every viewport size.
 const leaderStyles = demo.classList.contains('bag-two-map')
   ? [{shape:0}, {shape:1}, {shape:2}, {shape:3}]
   : demo.classList.contains('skull-cap-map')
     ? [{shape:1,flip:-1,reach:.92}, {shape:3,reach:.86},
        {shape:0,flip:-1,reach:.9}, {shape:2,reach:.94}]
     : [{shape:2,flip:-1,reach:.86}, {shape:0,reach:.88},
        {shape:3,flip:-1}, {shape:1,reach:.92}];
 let current = -1;
 let selected = 0;
 let hovered = null;
 let focused = null;
 detail.id ||= `making-detail-${mapIndex}`;
 const svg = (tag, attrs) => {
   const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
   Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
   return node;
 };
 function show(index) {
   if (current === index) return;
   current = index;
   demo.dataset.current = index;
   pieces.forEach((piece, i) => { piece.dataset.active = i === index; });
   detail.textContent = list[index].note;
   draw();
 }
 const preview = () => show(hovered ?? focused ?? selected);
 pieces.forEach((piece, index) => {
   piece.setAttribute('aria-describedby', detail.id);
   piece.addEventListener('pointerenter', event => {
     if (event.pointerType === 'touch') return;
     hovered = index;
     preview();
   });
   const leave = () => {
     if (hovered === index) hovered = null;
     preview();
   };
   piece.addEventListener('pointerleave', leave);
   piece.addEventListener('pointercancel', leave);
   piece.addEventListener('focus', () => {
     focused = index;
     hovered = null;
     preview();
   });
   piece.addEventListener('blur', () => {
     focused = null;
     preview();
   });
   piece.addEventListener('click', () => {
     selected = index;
     pieces.forEach((item, i) => item.setAttribute('aria-pressed', i === selected));
     show(selected);
   });
 });
   function draw(){
    const width=diagram.clientWidth,height=diagram.clientHeight;if(!width||!height)return;
    graphic.setAttribute('viewBox',`0 0 ${width} ${height}`);graphic.replaceChildren();
    const base=diagram.getBoundingClientRect(),bounds=node=>{const r=node.getBoundingClientRect();return{x:r.x-base.x,y:r.y-base.y,w:r.width,h:r.height,cx:r.x-base.x+r.width/2,cy:r.y-base.y+r.height/2};};
    const images=pieces.map(p=>bounds(p.querySelector('.bp-art'))),notes=labels.map(bounds);
    const targets=pieces.map(p=>bounds(p.querySelector('.bp-pattern-papers,.bp-art[data-stage="final"] img')||p.querySelector('.bp-art')));
    const cutoutAnchors=demo.classList.contains('bag-two-map')
      ? {pattern:[.66,.05],wip:[.36,.06],fitting:[.55,.24],final:[.55,.045]}
      : {hardware:[.66,.12],finished:[.54,.16]};
    function target(i){
      const box=targets[i],stage=list[i].id;
      if(cutoutAnchors[stage]){
        const img=pieces[i].querySelector('.bp-art img');
        if(img?.naturalWidth){
          // The image fills a box with object-fit: contain. Aim at the visible cutout.
          const scale=Math.min(box.w/img.naturalWidth,box.h/img.naturalHeight);
          const [x,y]=cutoutAnchors[stage];
          return [box.cx+(x-.5)*img.naturalWidth*scale,box.cy+(y-.5)*img.naturalHeight*scale];
        }
      }
      return [box.cx+(stage==='finished'?box.w*.28:stage==='pattern'?box.w*.13:0),box.y+box.h*(stage==='pattern'?.17:.28)];
    }
    function path(d,cls='bp-pencil',extra={}){const p=svg('path',{d,'class':cls,fill:'none','vector-effect':'non-scaling-stroke',...extra});graphic.append(p);return p;}
    function wave(x1,y,x2,cls='bp-pencil',dy=2){const d=x2-x1;return path(`M ${x1} ${y} C ${x1+d*.25} ${y-dy}, ${x1+d*.35} ${y+dy}, ${x1+d*.53} ${y+.6} S ${x1+d*.84} ${y-dy*.8}, ${x2} ${y+.2}`,cls);}
    function arrow(x,y,cls='bp-pencil'){path(`M ${x-5} ${y-3} Q ${x-2} ${y-1} ${x} ${y} L ${x-5} ${y+3}`,cls);}
    const first=images[0];

     [first.y+26,first.y+first.h-20].forEach(y=>{wave(10,y,width-10,'bp-pencil bp-guide',.8);arrow(width-10,y,'bp-pencil bp-guide');});
     notes.forEach((note,i)=>{
      const [tx,ty]=target(i),cx=note.cx,sy=note.y+note.h+5,dy=ty-sy;
      const style=leaderStyles[i%leaderStyles.length];
      // Limit sideways gestures on small screens without moving their targets.
      const reach=Math.min(1,images[i].w/82)*(style.reach??1);
      const x=offset=>cx+offset*reach*(style.flip??1);
      const entry=offset=>tx+offset*reach*(style.flip??1);
      // Every gesture descends immediately, keeping the label free of underlines.
      const gestures=[
       `M ${x(4)} ${sy} C ${x(14)} ${sy+dy*.3} ${entry(-9)} ${ty-dy*.32} ${tx} ${ty}`,
       `M ${x(9)} ${sy+1} C ${x(15)} ${sy+dy*.32} ${entry(-11)} ${ty-dy*.38} ${tx} ${ty}`,
       `M ${x(-4)} ${sy} C ${x(-10)} ${sy+dy*.28} ${entry(13)} ${ty-dy*.25} ${tx} ${ty}`,
       `M ${x(-3)} ${sy+.5} C ${x(-16)} ${sy+dy*.4} ${entry(17)} ${ty-dy*.38} ${tx} ${ty}`
      ];
      const leader=path(gestures[style.shape],`bp-pencil bp-leader ${i===current?'bp-current-line':''}`);
      leader.style.setProperty('--bp-leader-scale',[1,.96,1.04,1.02][style.shape]);
     });

   }

 new ResizeObserver(draw).observe(diagram);
 diagram.querySelectorAll('img').forEach(image => image.addEventListener('load', draw, {once: true}));
 diagram.addEventListener('transitionend', event => {
   if(event.target.classList.contains('bp-art'))draw();
 });
 document.fonts.ready.then(draw);
 show(selected);
});
