/* The selected process map: static content, measured pencil annotations. */
(() => {
 'use strict';
 const demo = document.querySelector('#handbag-making .bag-demo');
 if (!demo) return;
 const diagram = demo.querySelector('.bp-note-diagram');
 const graphic = demo.querySelector('.bp-pencil-lines');
 const pieces = [...demo.querySelectorAll('.bp-note-piece')];
 const labels = pieces.map(piece => piece.querySelector('.bp-callout'));
 const list = pieces.map(piece => ({id: piece.dataset.stage, note: piece.dataset.note}));
 const detail = demo.querySelector('.bp-note-detail');
 let current = 0;
 const svg = (tag, attrs) => {
   const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
   Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
   return node;
 };
 function select(index) {
   current = index;
   demo.dataset.current = index;
   pieces.forEach((piece, i) => piece.setAttribute('aria-pressed', i === index));
   detail.textContent = list[index].note;
   draw();
 }
 pieces.forEach((piece, index) => piece.addEventListener('click', () => select(index)));
 demo.querySelector('[data-making-next]').addEventListener('click', () => select((current + 1) % pieces.length));
   function draw(){
    const width=diagram.clientWidth,height=diagram.clientHeight;if(!width||!height)return;
    graphic.setAttribute('viewBox',`0 0 ${width} ${height}`);graphic.replaceChildren();
    const base=diagram.getBoundingClientRect(),bounds=node=>{const r=node.getBoundingClientRect();return{x:r.x-base.x,y:r.y-base.y,w:r.width,h:r.height,cx:r.x-base.x+r.width/2,cy:r.y-base.y+r.height/2};};
    const images=pieces.map(p=>bounds(p.querySelector('.bp-art'))),notes=labels.map(bounds);
    const targets=pieces.map(p=>bounds(p.querySelector('.bp-pattern-papers')||p.querySelector('.bp-art')));
    function path(d,cls='bp-pencil',extra={}){const p=svg('path',{d,'class':cls,fill:'none','vector-effect':'non-scaling-stroke',...extra});graphic.append(p);return p;}
    function wave(x1,y,x2,cls='bp-pencil',dy=2){const d=x2-x1;return path(`M ${x1} ${y} C ${x1+d*.25} ${y-dy}, ${x1+d*.35} ${y+dy}, ${x1+d*.53} ${y+.6} S ${x1+d*.84} ${y-dy*.8}, ${x2} ${y+.2}`,cls);}
    function arrow(x,y,cls='bp-pencil'){path(`M ${x-5} ${y-3} Q ${x-2} ${y-1} ${x} ${y} L ${x-5} ${y+3}`,cls);}
    const first=images[0];

     [first.y+26,first.y+first.h-20].forEach(y=>{wave(10,y,width-10,'bp-pencil bp-guide',.8);arrow(width-10,y,'bp-pencil bp-guide');});
     notes.forEach((note,i)=>{const image=targets[i],s=list[i],tx=image.cx+(s.id==='finished'?image.w*.28:s.id==='pattern'?image.w*.13:0),ty=image.y+image.h*(s.id==='pattern'?.17:.28),sx=note.cx-25,sy=note.y+note.h+3;path(`M ${sx} ${sy} Q ${sx+18} ${sy-1} ${sx+35} ${sy+.8} C ${sx+51} ${sy+1} ${tx-15} ${ty-3} ${tx} ${ty}`,`bp-pencil bp-leader ${i===current?'bp-current-line':''}`);});

   }

 new ResizeObserver(draw).observe(diagram);
 diagram.querySelectorAll('img').forEach(image => image.addEventListener('load', draw, {once: true}));
 document.fonts.ready.then(draw);
 select(0);
})();
