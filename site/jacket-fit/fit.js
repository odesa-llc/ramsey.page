(() => {
const degrees=Math.PI/180;
const saturate=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const normalize=(x,y,z)=>{
  const len=Math.hypot(x,y,z)||1;
  return [x/len,y/len,z/len];
};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

function decodeForm(bytes) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const count=view.getUint16(0,true), faces=view.getUint16(2,true);
  if(bytes.length!==4+count*10+faces*6) throw new Error("Unexpected mannequin mesh size");
  const verts=new Float32Array(count*7);
  let at=4;
  for(let i=0;i<verts.length;i+=7,at+=10) {
    verts[i]=view.getInt16(at,true)*.01;
    verts[i+1]=view.getUint16(at+2,true)*.01;
    verts[i+2]=view.getInt16(at+4,true)*.01;
    verts[i+3]=view.getInt8(at+6)/127;
    verts[i+4]=view.getInt8(at+7)/127;
    verts[i+5]=view.getInt8(at+8)/127;
    verts[i+6]=view.getUint8(at+9)/255;
  }
  const triangles=new Uint16Array(faces*3);
  for(let i=0;i<triangles.length;i++) triangles[i]=view.getUint16(at+i*2,true);
  return {verts,triangles,seams:formSeams(verts,triangles)};
}

function formSeams(verts,triangles) {
  const lines=[];
  const sections=[
    {min:92,max:106,plane:(x,y)=>y-99.59-.49*Math.cos(x*.214),thickness:.14},
    {min:142,max:163,plane:(x,y)=>Math.abs(x)-25.10-.10*(y-150.50),thickness:.108},
    {min:135,max:163,plane:(x,y)=>Math.abs(x)-73.15-.13*(y-148.7),thickness:.105},
    {min:5,max:14,plane:(x,y,z)=>y-8.65-.036*(z-2),thickness:.12}
  ];
  for(let i=0;i<triangles.length;i+=3) {
    const indices=[triangles[i]*7,triangles[i+1]*7,triangles[i+2]*7];
    const a=verts[indices[0]+1],b=verts[indices[1]+1],c=verts[indices[2]+1];
    const ymin=Math.min(a,b,c),ymax=Math.max(a,b,c);
    for(const {min,max,plane,thickness} of sections) {
      if(ymax<min||ymin>max) continue;
      const points=indices.map(at=>[verts[at],verts[at+1],verts[at+2]]);
      const values=points.map(p=>plane(...p)), crossing=[];
      for(let k=0;k<3;k++) {
        const next=(k+1)%3,p=points[k],q=points[next],vp=values[k],vq=values[next];
        if((vp<0)===(vq<0)) continue;
        const u=vp/(vp-vq);
        crossing.push(p.map((n,j)=>n+(q[j]-n)*u));
      }
      if(crossing.length===2&&crossing.every(p=>p[1]>=min&&p[1]<=max)) lines.push([...crossing,thickness]);
    }
  }
  return lines;
}

function viewCamera(width,height,yaw,elevation,zoom,framing="jacket") {
  const a=yaw*degrees,b=elevation*degrees;
  const sy=Math.sin(a),cy=Math.cos(a),sp=Math.sin(b),cp=Math.cos(b);
  const view=[sy*cp,sp,cy*cp], right=[cy,0,-sy],up=[-sy*sp,cp,-cy*sp];
  const target=framing==="body"?94.25:framing==="zipper"?125.5:121;
  const base=framing==="body"?483:framing==="zipper"?126:195;
  const distance=base*Math.max(1,.83*height/width)/zoom;
  const focal=height/(2*Math.tan(17.4*degrees));
  const eye=[view[0]*distance,target+view[1]*distance,view[2]*distance];
  function project(x,y,z) {
    y-=target;
    const near=1/(distance-(x*view[0]+y*view[1]+z*view[2]));
    return [
      width*.50+(x*right[0]+z*right[2])*focal*near,
      height*.487-(x*up[0]+y*up[1]+z*up[2])*focal*near,
      near
    ];
  }
  return {view,right,up,focal,eye,project};
}

function jacketTrim(fabric,details) {
  const verts=[],tris=[],materials=[];
  const add=(a,b)=>a.map((v,i)=>v+b[i]);
  const diff=(a,b)=>a.map((v,i)=>v-b[i]);
  const scale=(a,k)=>a.map(v=>v*k);
  const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const v3=a=>normalize(...a);
  const point=i=>Array.from(fabric.verts.slice(i*7,i*7+3));
  const normal=i=>Array.from(fabric.verts.slice(i*7+3,i*7+6));

  function face(vertices,material,normalOverride) {
    const flat=normalOverride||v3(cross(diff(vertices[1],vertices[0]),diff(vertices[2],vertices[0])));
    const base=materials.length;
    for(const p of vertices){verts.push(...p,...flat,1);materials.push(material);}
    for(let k=1;k+1<vertices.length;k++)tris.push(base,base+k,base+k+1);
  }

  const zip=details.zipper.map(point);
  const n=details.zipper.map(normal);
  const run=[0];
  for(let i=1;i<zip.length;i++)run.push(run.at(-1)+Math.hypot(...diff(zip[i],zip[i-1])));
  const length=run.at(-1);

  function section(distance) {
    let i=1;
    while(i+1<run.length&&distance>run[i])i++;
    const f=saturate((distance-run[i-1])/(run[i]-run[i-1]),0,1);
    const up=v3(diff(zip[Math.min(zip.length-1,i+1)],zip[Math.max(0,i-2)]));
    const average=v3(mix(n[i-1],n[i],f));
    const right=v3(cross(up,average));
    const out=v3(cross(right,up));
    return {p:mix(zip[i-1],zip[i],f),right,up,out};
  }

  function convert(s,x,y,z) {
    return add(add(add(s.p,scale(s.right,x)),scale(s.up,y)),scale(s.out,z));
  }

  // Chamfer both the stamped walls and the polished face of each metal part.
  function stamped(s,x,y,z,w,h,d,bevel,material=3) {
    const ring=(width,height,radius,lift)=>{
      const a=width/2,b=height/2,c=Math.min(radius,a*.45,b*.45);
      return [[-a+c,-b],[a-c,-b],[a,-b+c],[a,b-c],[a-c,b],[-a+c,b],[-a,b-c],[-a,-b+c]]
        .map(([u,v])=>convert(s,x+u,y+v,lift));
    };
    const low=ring(w,h,bevel,z),edge=ring(w,h,bevel,z+d*.57);
    const high=ring(w-bevel*.7,h-bevel*.7,bevel*.73,z+d);
    face(high,material,s.out);
    for(let k=0;k<8;k++){
      const k2=(k+1)%8;
      face([low[k],low[k2],edge[k2],edge[k]],material);
      face([edge[k],edge[k2],high[k2],high[k]],material);
    }
  }

  function ribbon(a,b,w,material,lift) {
    const sa=section(a),sb=section(b);
    face([convert(sa,-w/2,0,lift),convert(sa,w/2,0,lift),convert(sb,w/2,0,lift),convert(sb,-w/2,0,lift)],material,v3(add(sa.out,sb.out)));
  }

  const top=length-.68;
  for(let d=.17;d<length-.15;d+=.32)ribbon(d,Math.min(d+.325,length-.15),1.10,2,.071);
  for(let d=.85,k=0;d<top-.60;d+=.255,k++){
    const s=section(d),sign=k%2===0?-1:1;
    stamped(s,sign*.083,0,.113,.388,.151,.104,.042);
  }
  const start=section(.41);
  stamped(start,.115,0,.112,.49,.61,.16,.065);
  stamped(start,-.173,-.095,.123,.147,.54,.111,.041);
  const finish=section(top+.37);
  stamped(finish,-.19,0,.11,.16,.27,.09,.037);
  stamped(finish,.19,.015,.11,.16,.29,.09,.038);

  const slide=section(top);
  stamped(slide,0,0,.12,.78,1.04,.225,.105);
  stamped(slide,0,-.09,.327,.43,.43,.124,.077);
  const pullCenter=-1.07;
  const ringPortion=(x,y,z)=>convert(slide,x,y,z);
  const r1=.286,r2=.72,t1=.136,t2=.50;
  const segments=20;
  for(let i=0;i<segments;i++){
    const angle=i/segments*2*Math.PI,a2=(i+1)/segments*2*Math.PI;
    const ring=(a,radiusX,radiusY,z)=>ringPortion(radiusX*Math.cos(a),pullCenter+radiusY*Math.sin(a),z);
    const ma=ring(angle,r1,r2,.386),mb=ring(a2,r1,r2,.386),mc=ring(a2,t1,t2,.386),md=ring(angle,t1,t2,.386);
    face([ma,mb,mc,md],3,slide.out);
    face([ring(angle,r1,r2,.319),ring(a2,r1,r2,.319),mb,ma],3);
    face([mc,ring(a2,t1,t2,.319),ring(angle,t1,t2,.319),md],3);
  }

  // Turned-under edges give the open cuffs a visible leather lip and dark interior.
  for(const opening of details.cuff) {
    const ring=opening.filter((id,i)=>i===0||opening[i-1]!==id);
    if(ring[0]===ring.at(-1))ring.pop();
    const center=ring.reduce((a,id)=>add(a,scale(point(id),1/ring.length)),[0,0,0]);
    for(let i=0;i<ring.length;i++){
      const a=point(ring[i]),b=point(ring[(i+1)%ring.length]);
      const insideA=v3([center[0]-a[0],0,center[2]-a[2]]),insideB=v3([center[0]-b[0],0,center[2]-b[2]]);
      const ia=add(a,scale(insideA,.15)),ib=add(b,scale(insideB,.15));
      face([a,b,ib,ia],4,[0,-1,0]);
      face([ia,ib,add(ib,[0,1.18,0]),add(ia,[0,1.18,0])],4,v3(add(insideA,insideB)));
    }
  }
  return {verts,tris,materials};
}

function clothScene(body,fabric,paths) {
  const bodyCount=body.verts.length/7,fabricCount=fabric.verts.length/7;
  const trim=jacketTrim(fabric,paths.details);
  const clothEnd=fabricCount+bodyCount;
  const count=clothEnd+trim.materials.length;
  if(count>=65536) throw new Error("Too many scene vertices");
  const verts=new Float32Array(count*7);
  verts.set(body.verts);
  verts.set(fabric.verts,body.verts.length);
  verts.set(trim.verts,clothEnd*7);
  const materials=new Uint8Array(count);
  materials.fill(1,bodyCount,clothEnd);
  materials.set(trim.materials,clothEnd);
  const triangles=new Uint16Array(body.triangles.length+fabric.triangles.length+trim.tris.length);
  triangles.set(body.triangles);
  for(let i=0;i<fabric.triangles.length;i++)triangles[body.triangles.length+i]=fabric.triangles[i]+bodyCount;
  const start=body.triangles.length+fabric.triangles.length;
  for(let i=0;i<trim.tris.length;i++)triangles[start+i]=trim.tris[i]+clothEnd;
  const seams=body.seams.map(([a,b,t])=>[a,b,t,0]);
  const clothPoint=index=>Array.from(fabric.verts.slice(index*7,index*7+3));
  const shifted=(index,amount)=>{
    const v=index*7;
    return [0,1,2].map(k=>fabric.verts[v+k]+amount*fabric.verts[v+3+k]);
  };

  function trace(ids,thickness,tone,closed=false,raise=.065) {
    const points=ids.map(index=>shifted(index,raise));
    if(closed)points.push(points[0]);
    for(let i=1;i<points.length;i++)seams.push([points[i-1],points[i],thickness,tone]);
  }
  trace(paths.details.hem,.095,1,true);
  trace(paths.details.neckline,.11,1,true);
  for(const ids of paths.details.cuff)trace(ids,.11,1,true);
  for(const ids of paths.details.armhole)trace(ids,.105,1,true);
  const g=paths.guides;
  const side=sideName=>Object.fromEntries(Object.entries(g[sideName]).map(([k,ids])=>[k,ids.map(clothPoint)]));
  const guides={shoulders:g.shoulders.map(clothPoint),chest:g.chest.map(clothPoint),hem:g.hem.map(clothPoint),sideSeams:paths.sideSeams.map(ids=>ids.map(clothPoint)),back:g.back.map(clothPoint),left:side("left"),right:side("right")};
  return {verts,triangles,seams,materials,guides};
}

function leatherGrain() {
  const result=new Float32Array(128*128);
  const rand=(x,y,k)=>{
    let id=Math.imul(x,18352516)^Math.imul(y,9133127)^Math.imul(k,48120317);
    id=Math.imul(id^(id>>>14),16777619);
    return ((id^(id>>>13))&1023)/1023;
  };
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    let near=100,far=100;
    const cx=x/8,cy=y/8,ix=Math.floor(cx),iy=Math.floor(cy);
    for(let k=-1;k<=1;k++)for(let j=-1;j<=1;j++){
      const u=ix+j,v=iy+k;
      const dx=cx-u-.18-.64*rand(u&15,v&15,1);
      const dy=cy-v-.16-.68*rand(u&15,v&15,2);
      const d=dx*dx+dy*dy;
      if(d<near){far=near;near=d;}else if(d<far)far=d;
    }
    const groove=Math.exp(-Math.max(0,far-near)*11);
    const pebble=.5-Math.min(near,.5);
    result[y*128+x]=(pebble-.20)*2.1-groove*1.55+(rand(x,y,3)-.49)*.69;
  }
  return result;
}

function makeFormRenderer(mesh) {
  const {verts,triangles,seams,materials}=mesh;
  const count=verts.length/7;
  const screen=new Float32Array(count*7);
  const ground=new Float32Array(count*2);
  const light=normalize(-.33,1,.32);
  const softFill=normalize(.78,.35,.63);
  const edge=normalize(.36,.68,-.77);
  let mask=new Uint8Array(0), depth=new Float32Array(0);
  const swatch=leatherGrain();
  const srgb=n=>255*(n<.0031308?12.92*n:1.055*n**(1/2.4)-.055);

  return function renderForm(width,height,params,rgba) {
    const {yaw,elevation,zoom,framing}=params;
    const camera=viewCamera(width,height,yaw,elevation,zoom,framing);
    const {view,right,up,eye,focal,project}=camera;
    const half=normalize(light[0]+view[0],light[1]+view[1],light[2]+view[2]);
    const soft=normalize(softFill[0]+view[0],softFill[1]+view[1],softFill[2]+view[2]);
    const rimHalf=normalize(edge[0]+view[0],edge[1]+view[1],edge[2]+view[2]);
    const size=width*height;
    if(mask.length!==size) {
      mask=new Uint8Array(size);
      depth=new Float32Array(size);
    } else {
      mask.fill(0);
    }
    depth.fill(-Infinity);

    for(let i=0,j=0,k=0;i<verts.length;i+=7,j+=7,k+=2) {
      const x=verts[i],y=verts[i+1],z=verts[i+2];
      const nx=verts[i+3],ny=verts[i+4],nz=verts[i+5],ao=verts[i+6];
      const diffuse=Math.max(0,nx*light[0]+ny*light[1]+nz*light[2]);
      const fill=Math.max(0,nx*softFill[0]+ny*softFill[1]+nz*softFill[2]);
      const rim=Math.max(0,nx*edge[0]+ny*edge[1]+nz*edge[2]);
      const nview=nx*view[0]+ny*view[1]+nz*view[2];
      const ndoth=Math.max(0,nx*half[0]+ny*half[1]+nz*half[2]);
      const spec=.029*ndoth**18+.015*ndoth**5+.010*(1-saturate(nview))**3*rim;
      const diffuseLight=ao*(.187+.093*(.5+.5*ny)+.605*diffuse+.144*fill+.107*rim);
      const surface=1+.009*Math.sin(x*.45+y*.17+z*.56)*Math.sin(y*.47-z*.29);
      const p=project(x,y,z);
      screen[j]=p[0];screen[j+1]=p[1];screen[j+2]=p[2];
      const material=materials[i/7];
      if(material===0) {
        screen[j+3]=srgb(.475*diffuseLight*surface+spec);
        screen[j+4]=srgb(.280*diffuseLight*surface+.91*spec);
        screen[j+5]=srgb(.169*diffuseLight*surface+.83*spec);
      } else if(material===3) {
        const env=.084+.066*(.5+.5*ny)+.033*diffuse+.038*rim;
        const polish=.133*ndoth**13+.240*ndoth**55+.044*fill;
        screen[j+3]=srgb((env+polish)*.94);
        screen[j+4]=srgb((env+polish)*.98);
        screen[j+5]=srgb((env+polish)*1.06);
      } else if(material===2||material===4) {
        const matte=material===2?.0055+.005*diffuseLight:.0034+.0036*diffuseLight;
        screen[j+3]=srgb(matte);
        screen[j+4]=srgb(matte*.986);
        screen[j+5]=srgb(matte*1.04);
      } else {
        const nw=Math.max(.03,nview);
        const h2=Math.max(0,nx*soft[0]+ny*soft[1]+nz*soft[2]);
        const h3=Math.max(0,nx*rimHalf[0]+ny*rimHalf[1]+nz*rimHalf[2]);
        const reflect=(ndotL,ndotH,energy)=>{
          const d=.079/(Math.PI*(ndotH*ndotH*(-.921)+1)**2);
          const k=.225;
          const vis=.25/((nw*(1-k)+k)*(ndotL*(1-k)+k));
          const fresnel=.036+.078*(1-nw)**4;
          return Math.min(.081,energy*d*vis*fresnel*ndotL);
        };
        const gloss=reflect(diffuse,ndoth,1.27)+reflect(fill,h2,.69)+reflect(rim,h3,.71);
        const coated=.0105*diffuseLight+.0042*ao+gloss;
        screen[j+3]=srgb(coated*1.017);
        screen[j+4]=srgb(coated);
        screen[j+5]=srgb(coated*1.031);
      }
      screen[j+6]=nview;
      const s=project(x-y*light[0]/light[1],0,z-y*light[2]/light[1]);
      ground[k]=s[0];ground[k+1]=s[1];
    }

    function raster(buffer,stride,shadow) {
      for(let i=0;i<triangles.length;i+=3) {
        const a=triangles[i]*stride,b=triangles[i+1]*stride,c=triangles[i+2]*stride;
        if(!shadow&&buffer[a+6]<-.075&&buffer[b+6]<-.075&&buffer[c+6]<-.075) continue;
        const ax=buffer[a],ay=buffer[a+1],bx=buffer[b],by=buffer[b+1],cx=buffer[c],cy=buffer[c+1];
        const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
        if(Math.abs(det)<.006) continue;
        const minX=Math.max(0,Math.floor(Math.min(ax,bx,cx))),maxX=Math.min(width-1,Math.ceil(Math.max(ax,bx,cx)));
        const minY=Math.max(0,Math.floor(Math.min(ay,by,cy))),maxY=Math.min(height-1,Math.ceil(Math.max(ay,by,cy)));
        if(minX>maxX||minY>maxY) continue;
        const adx=(by-cy)/det,ady=(cx-bx)/det,bdx=(cy-ay)/det,bdy=(ax-cx)/det;
        if(shadow) {
          for(let y=minY;y<=maxY;y++) {
            let u=adx*(minX+.5-cx)+ady*(y+.5-cy),v=bdx*(minX+.5-cx)+bdy*(y+.5-cy);
            for(let x=minX,p=y*width+x;x<=maxX;x++,p++,u+=adx,v+=bdx) {
              if(u>=-.0001&&v>=-.0001&&u+v<=1.0001) mask[p]=1;
            }
          }
        } else {
          const leather=materials[triangles[i]]===1;
          const fxa=verts[triangles[i]*7],fxb=verts[triangles[i+1]*7],fxc=verts[triangles[i+2]*7];
          const fya=verts[triangles[i]*7+1],fyb=verts[triangles[i+1]*7+1],fyc=verts[triangles[i+2]*7+1];
          const fza=verts[triangles[i]*7+2],fzb=verts[triangles[i+1]*7+2],fzc=verts[triangles[i+2]*7+2];
          const cz=buffer[c+2],az=buffer[a+2]-cz,bz=buffer[b+2]-cz;
          const cr=buffer[c+3],ar=buffer[a+3]-cr,br=buffer[b+3]-cr;
          const cg=buffer[c+4],ag=buffer[a+4]-cg,bg=buffer[b+4]-cg;
          const cb=buffer[c+5],ab=buffer[a+5]-cb,bb=buffer[b+5]-cb;
          for(let y=minY;y<=maxY;y++) {
            let u=adx*(minX+.5-cx)+ady*(y+.5-cy),v=bdx*(minX+.5-cx)+bdy*(y+.5-cy);
            for(let x=minX,p=y*width+x;x<=maxX;x++,p++,u+=adx,v+=bdx) {
              if(u<-.0004||v<-.0004||u+v>1.0004) continue;
              const near=cz+az*u+bz*v;
              if(near<=depth[p]) continue;
              depth[p]=near;
              const k=p*4;
              let grain=0;
              if(leather){
                const px=fxc+(fxa-fxc)*u+(fxb-fxc)*v;
                const py=fyc+(fya-fyc)*u+(fyb-fyc)*v;
                const pz=fzc+(fza-fzc)*u+(fzb-fzc)*v;
                const gx=Math.floor((px+.42*pz)*19)&127,gy=Math.floor((py+.29*pz)*19)&127;
                const layer=swatch[gy*128+gx];
                const key=cr+ar*u+br*v;
                grain=layer*(.67+.033*key);
              }
              rgba[k]=cr+ar*u+br*v+grain;rgba[k+1]=cg+ag*u+bg*v+grain;rgba[k+2]=cb+ab*u+bb*v+grain;
            }
          }
        }
      }
    }

    raster(ground,2,true);
    const center=width*.5;
    const step=22;
    const backR=155,backG=155,backB=155;
    for(let y=0;y<height;y++) {
      const vy=(height*.487-y-.5)/focal;
      const slope=-view[1]+up[1]*vy;
      const dist=slope<-.0001?-eye[1]/slope:Infinity;
      const floor=Number.isFinite(dist)&&dist<6900;
      const fog=floor?Math.exp(-((Math.max(0,dist-100)/1210)**1.5)):0;
      const lineFade=floor?Math.exp(-((Math.max(0,dist-160)/1060)**1.32)):0;
      const px=floor?(-view[0]+up[0]*vy)*dist+eye[0]:0;
      const pz=floor?(-view[2]+up[2]*vy)*dist+eye[2]:0;
      const unit=floor?dist/focal:0;
      const dx=right[0]*unit,dz=right[2]*unit;
      const verticalSample=floor?eye[1]*up[1]/(slope*slope*focal):0;
      const footprintX=Math.abs(dx)+Math.abs(up[0]*unit+(-view[0]+up[0]*vy)*verticalSample);
      const footprintZ=Math.abs(dz)+Math.abs(up[2]*unit+(-view[2]+up[2]*vy)*verticalSample);
      const lineWidthX=.155+.56*footprintX;
      const lineWidthZ=.155+.56*footprintZ;
      const gridStrength=35*lineFade*saturate(1-Math.max(footprintX,footprintZ)/step);
      let xg=px+(.5-center)*dx,zg=pz+(.5-center)*dz;
      const skyGradient=5*saturate(y/height+.18);
      for(let x=0,p=y*width;x<width;x++,p++,xg+=dx,zg+=dz) {
        let line=0, shadow=0;
        if(floor) {
          const gx=Math.abs(xg-step*Math.round(xg/step)),gz=Math.abs(zg-step*Math.round(zg/step));
          line=gridStrength*Math.max(saturate(1-gx/lineWidthX),saturate(1-gz/lineWidthZ));
          const m=mask[p];
          if(x>0&&x+1<width&&y>0&&y+1<height) {
            const neighbors=mask[p-1]+mask[p+1]+mask[p-width]+mask[p+width];
            shadow=(5*m+neighbors)/9;
          } else shadow=m;
          if(Math.abs(xg)<45&&Math.abs(zg)<47) {
            const foot=Math.abs(Math.abs(xg)-20.6);
            const contact=.20*Math.exp(-((foot/8.2)**2+((zg-9.5)/12.5)**2));
            shadow=Math.min(1,shadow+contact);
          }
        }
        const vignette=5*((x/width-.5)**2+(y/height-.44)**2);
        const lit=skyGradient+47*fog-line*(1-shadow*.46)-88*shadow-vignette;
        const at=p*4;
        rgba[at]=backR+lit;
        rgba[at+1]=backG+lit-fog*1.5;
        rgba[at+2]=backB+lit-fog*3.5;
        rgba[at+3]=255;
      }
    }
    raster(screen,7,false);
    for(const [from,to,thickness,tone] of seams) {
      const a=project(...from),b=project(...to);
      const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],ll=dx*dx+dy*dy;
      if(ll<.0001) continue;
      const widthPx=.38+thickness*focal*(a[2]+b[2])*.49;
      const left=Math.max(0,Math.floor(Math.min(a[0],b[0])-widthPx));
      const right=Math.min(width-1,Math.ceil(Math.max(a[0],b[0])+widthPx));
      const top=Math.max(0,Math.floor(Math.min(a[1],b[1])-widthPx));
      const bottom=Math.min(height-1,Math.ceil(Math.max(a[1],b[1])+widthPx));
      for(let y=top;y<=bottom;y++) for(let x=left;x<=right;x++) {
        const px=x+.5-a[0],py=y+.5-a[1],p=y*width+x;
        const t=saturate((px*dx+py*dy)/ll);
        if(!Number.isFinite(depth[p])||a[2]+t*dz<depth[p]-.00000145) continue;
        const r=Math.hypot(px-t*dx,py-t*dy);
        const alpha=saturate(1-r/widthPx);
        if(tone===0){
          for(let channel=0;channel<3;channel++) rgba[p*4+channel]*=1-.36*alpha;
        } else {
          const shades=[0,20,19,83,112];
          for(let channel=0;channel<3;channel++) rgba[p*4+channel]+=(shades[tone]-rgba[p*4+channel])*alpha*(tone>=3?.90:.75);
        }
      }
    }
    return camera;
  };
}

const root=document.getElementById("jacket-fit");
if(!root)return;
const get=selector=>root.querySelector(selector);
const rotation=get("#sleeve-fit-rotation"), zoom=get("#sleeve-fit-zoom"), framing=get("#sleeve-fit-framing");
const toggle=get("#sleeve-fit-measure"), orbitOutput=get('output[for="sleeve-fit-rotation"]');
const zoomOutput=get('output[for="sleeve-fit-zoom"]'), note=get(".fit-note"), live=get(".fit-live");
const status=get(".fit-unavailable"), template=get(".fit-guide-template");
const fields=[rotation,zoom,framing,toggle];
const camera={yaw:20,elevation:9,zoom:.75,framing:"jacket"};
const guideKeys=["shoulders","chest","back","sleeve","upper","cuff","hem"];
let panels=[],drag,show=false,reduced=false,tick=0,settle=0;
const turn=n=>((n+180)%360+360)%360-180;

function mountPanel(name,body,bytes,paths,upper,cuff){
  const panel=get('[data-fit-cut="'+name+'"]');
  const stage=panel.querySelector(".fit-stage"), canvas=panel.querySelector("canvas");
  const drawing=canvas.getContext("2d",{alpha:false});
  if(!drawing)throw new Error("Canvas is unavailable");
  const overlay=panel.querySelector(".fit-overlay");
  overlay.appendChild(template.content.cloneNode(true));
  const labels=Object.fromEntries(guideKeys.map(key=>[key,{
    node:overlay.querySelector('[data-measure="'+key+'"]'),
    lines:Array.from(overlay.querySelector('[data-guide="'+key+'"]').querySelectorAll("path")),
  }]));
  labels.upper.node.textContent="Upper "+upper+" cm";
  labels.cuff.node.textContent="Cuff "+cuff+" cm";
  const seams=Array.from(overlay.querySelector(".fit-side-seams").querySelectorAll("path"));
  const scene=clothScene(body,decodeForm(bytes),paths);
  return {stage,canvas,drawing,overlay,svg:overlay.querySelector("svg"),labels,seams,
    guides:scene.guides,render:makeFormRenderer(scene),picture:null};
}

function updateControls(){
  const yaw=Math.round(camera.yaw),zoomPercent=Math.round(camera.zoom*100);
  rotation.value=String(yaw);
  orbitOutput.value=yaw+"°";
  zoom.value=String(zoomPercent);
  zoomOutput.value=zoomPercent+"%";
  framing.value=camera.framing;
  const angleName=yaw===0?"Front":Math.abs(yaw)===180?"Back":Math.abs(yaw)+" degrees "+(yaw<0?"left":"right")+" of front";
  rotation.setAttribute("aria-valuetext",angleName);
  zoom.setAttribute("aria-valuetext",zoomPercent+" percent");
  toggle.setAttribute("aria-pressed",String(show));
  toggle.textContent=show?"Hide measurements":"Show measurements";
  note.hidden=!show;
  for(const panel of panels)panel.overlay.hidden=!show;
}

function paintGuides(panel,w,h){
  const vp=viewCamera(w,h,camera.yaw,camera.elevation,camera.zoom,camera.framing);
  const {view,project}=vp,source=panel.guides;
  const side=view[0]<0?source.left:source.right;
  const body=camera.framing==="body";
  const char=p=>p.slice(0,2).map(x=>Math.round(x*10)/10).join(" ");
  const line=points=>points.length?"M"+points.map(char).join(" L"):"";
  const projectAll=points=>points.map(p=>project(...p));
  panel.svg.setAttribute("viewBox","0 0 "+w+" "+h);

  function mark(name,front,back,anchor,loc){
    const {node,lines}=panel.labels[name],half=node.offsetWidth*.5;
    const x=saturate(loc[0],half+5,w-half-5),y=saturate(loc[1],13,h-13);
    node.style.left=x+"px";
    node.style.top=y+"px";
    const edge=x+(anchor[0]<x?-half:half);
    lines[0].setAttribute("d",back);
    lines[1].setAttribute("d",front);
    lines[2].setAttribute("d",Math.hypot(anchor[0]-edge,anchor[1]-y)<6?"":line([[edge,y],[edge+(anchor[0]-edge)*.28,y],anchor]));
  }

  function loop(name,pts,loc){
    const projected=projectAll(pts),center=pts.reduce((acc,p)=>acc.map((n,k)=>n+p[k]/pts.length),[0,0,0]);
    let visible="";
    for(let i=1;i<projected.length;i++){
      const p=pts[i];
      if((p[0]-center[0])*view[0]+(p[2]-center[2])*view[2]>0)visible+="M"+char(projected[i-1])+" L"+char(projected[i]);
    }
    const near=projected.reduce((a,b)=>a[2]>b[2]?a:b);
    mark(name,visible,line([...projected,projected[0]]),near,loc);
  }

  const shoulders=projectAll(source.shoulders).sort((a,b)=>a[0]-b[0]);
  const y=saturate(Math.min(...shoulders.map(p=>p[1]))-16,29,h*.41);
  const x=(shoulders[0][0]+shoulders[1][0])*.5;
  mark("shoulders",line([shoulders[0],[shoulders[0][0],y],[shoulders[1][0],y],shoulders[1]]),"",[x,y],[x,y-12]);
  panel.labels.shoulders.lines[2].setAttribute("d",line([[x,y-4],[x,y]]));
  loop("chest",source.chest,[w*.17,h*(body ? .414 : .446)]);
  loop("upper",side.upper,[w*.834,h*(body ? .396 : .39)]);
  loop("cuff",side.cuff,[w*.835,h*(body ? .627 : .799)]);
  loop("hem",source.hem,[w*.17,h*(body ? .657 : .785)]);

  const back=projectAll(source.back),backVisible=view[2]<-.16;
  mark("back",backVisible?line(back):"",backVisible?"":line(back),back[Math.floor(back.length*.44)],
    [w*.16,h*(body ? .535 : .631)]);
  const sleeve=projectAll(side.sleeve);
  mark("sleeve",line(sleeve),"",sleeve[Math.floor(sleeve.length*.60)],
    [w*.842,h*(body ? .511 : .595)]);
  source.sideSeams.forEach((pts,i)=>{
    const visible=Math.abs(view[0])<.67||Math.sign(view[0])===(i===0?-1:1);
    panel.seams[i].setAttribute("d",visible?line(projectAll(pts)):"");
  });
}

function requestDraw(){
  if(!panels.length||tick)return;
  tick=requestAnimationFrame(()=>{
    tick=0;
    try{
      for(const p of panels){
        const w=p.stage.clientWidth,h=p.stage.clientHeight;
        if(!w||!h)continue;
        const scale=reduced ? .85 : Math.min(1.42,Math.max(window.devicePixelRatio||1,1.12));
        const width=Math.round(w*scale),height=Math.round(h*scale);
        if(!p.picture||p.picture.width!==width||p.picture.height!==height){
          p.canvas.width=width;p.canvas.height=height;
          p.picture=p.drawing.createImageData(width,height);
        }
        p.render(width,height,camera,p.picture.data);
        p.drawing.putImageData(p.picture,0,0);
        if(show)paintGuides(p,w,h);
      }
      root.dataset.ready="true";
    }catch(error){fail(error);}
  });
}

function settleView(){
  reduced=true;
  requestDraw();
  clearTimeout(settle);
  settle=setTimeout(()=>{reduced=false;requestDraw();},135);
}

function fail(error){
  for(const p of panels)p.overlay.hidden=true;
  panels=[];
  root.dataset.ready="false";
  status.hidden=false;
  note.hidden=true;
  for(const field of fields)field.disabled=true;
  console.error("Jacket fit:",error);
}

function attachDrag(stage){
  stage.addEventListener("pointerdown",event=>{
    if(!panels.length||event.button>0||drag)return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,yaw:camera.yaw,elevation:camera.elevation};
    stage.setPointerCapture?.(event.pointerId);
  });
  stage.addEventListener("pointermove",event=>{
    if(drag?.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.moved&&Math.abs(dx)+Math.abs(dy)<3)return;
    drag.moved=true;
    camera.yaw=turn(drag.yaw-dx*.63);
    if(event.pointerType!=="touch")camera.elevation=saturate(drag.elevation+dy*.25,3,35);
    reduced=true;
    updateControls();
    requestDraw();
  });
  function release(event){
    if(drag?.id!==event.pointerId)return;
    const moved=drag.moved;
    drag=null;
    reduced=false;
    if(moved){requestDraw();}
  }
  for(const type of ["pointerup","pointercancel","lostpointercapture"])stage.addEventListener(type,release);
}

rotation.addEventListener("input",()=>{camera.yaw=Number(rotation.value);updateControls();settleView();});
zoom.addEventListener("input",()=>{camera.zoom=Number(zoom.value)/100;updateControls();settleView();});
framing.addEventListener("change",()=>{camera.framing=framing.value;updateControls();requestDraw();});
toggle.addEventListener("click",()=>{
  show=!show;
  live.textContent=show?"Chest and hem 60 centimeters flat. Upper sleeve 20 centimeters and cuff 19 centimeters.":"Measurements hidden.";
  updateControls();
  requestDraw();
  
});
window.addEventListener("resize",requestDraw);

async function loadPreview() {
  try {
    const assets = await Promise.all(["body.mesh", "jacket.mesh", "guides.json"].map(async asset => {
      const response = await fetch(asset);
      if (!response.ok) throw new Error("Could not load " + asset);
      return response;
    }));
    const [bodyBytes, jacketBytes, paths] = await Promise.all([
      assets[0].arrayBuffer(), assets[1].arrayBuffer(), assets[2].json()
    ]);
    const body = decodeForm(new Uint8Array(bodyBytes));
    panels = [mountPanel("current", body, new Uint8Array(jacketBytes), paths, 20, 19)];
    const observer=typeof ResizeObserver==="function"?new ResizeObserver(requestDraw):null;
    for(const panel of panels){
      attachDrag(panel.stage);
      observer?.observe(panel.stage);
    }
    for(const field of fields)field.disabled=false;
    updateControls();
    requestDraw();
  }catch(error){fail(error);}
}

loadPreview();

})();
