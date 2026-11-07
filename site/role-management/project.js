
(() => {
  const text=window.portfolioText;
  const pool=document.getElementById('employee-pool-cloud');
  const poolPoints=[];
  let poolSeed=84001;
  const poolRandom=()=>{poolSeed=(poolSeed*1664525+1013904223)>>>0;return poolSeed/4294967296;};
  for(let attempt=0;poolPoints.length<80&&attempt<8000;attempt++){
    const x=36+poolRandom()*528,y=28+poolRandom()*244;
    if(((x-300)/264)**2+((y-150)/122)**2>1)continue;
    if(poolPoints.some(point=>(x-point.x)**2+(y-point.y)**2<27**2))continue;
    poolPoints.push({x,y});
    const dot=document.createElement('span');
    dot.className='pool-dot';dot.setAttribute('aria-hidden','true');
    dot.style.setProperty('--pool-x',(x/6).toFixed(3)+'%');
    dot.style.setProperty('--pool-y',(y/3).toFixed(3)+'%');
    dot.style.setProperty('--pool-size',((15+poolRandom()*4)/6).toFixed(3)+'%');
    dot.style.setProperty('--pool-shape',(.85+poolRandom()*.3).toFixed(3));
    dot.style.setProperty('--pool-turn',(poolRandom()*60-30).toFixed(1)+'deg');
    pool.append(dot);
  }
  const root=document.getElementById('airline-department-grid');
  const paper=root.querySelector('.airline-paper');
  const grid=root.querySelector('.department-grid');
  const summary=root.querySelector('.selection-summary');
  const replay=root.querySelector('.replay-dots');
  const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
  if(!motionPreference.matches)paper.classList.add('is-preparing');
  let activeReveals=[];
  let revealObserver=null;
  const revealDots=()=>{
    paper.classList.remove('is-preparing');
    activeReveals.forEach(animation=>animation.cancel());
    activeReveals=[];
    if(motionPreference.matches)return;
    const cells=[...root.querySelectorAll('.dot-cell')].map(element=>{const bounds=element.getBoundingClientRect();return {element,x:bounds.left,y:bounds.top};});
    cells.sort((a,b)=>Math.abs(a.y-b.y)>4?a.y-b.y:a.x-b.x);
    let row=-1,lastY=-Infinity,column=0;
    cells.forEach(cell=>{
      if(cell.y-lastY>4){row++;lastY=cell.y;column=0;}
      const animation=cell.element.animate([
        {opacity:0,transform:'translateY(-5px) scale(.45)'},
        {opacity:1,transform:'translateY(0) scale(1)'}
      ],{duration:360,delay:80+row*95+column*9,easing:'cubic-bezier(.2,.75,.3,1)',fill:'backwards'});
      activeReveals.push(animation);column++;
    });
  };
  replay.addEventListener('click',revealDots);
  replay.hidden=motionPreference.matches;
  motionPreference.addEventListener('change',()=>{replay.hidden=motionPreference.matches;if(motionPreference.matches){if(revealObserver)revealObserver.disconnect();paper.classList.remove('is-preparing');activeReveals.forEach(animation=>animation.cancel());activeReveals=[];}});
  const employeesPerDot=1000;
  const formatEmployees=count=>'≈'+(count*employeesPerDot).toLocaleString(document.documentElement.lang);
  const departments=[
    {id:'inflight',name:text('runtime.roleInflight'),icon:'concierge-bell',colour:'--air-if',count:24},
    {id:'flight-ops',name:text('runtime.roleFlightOps'),icon:'plane',colour:'--air-fo',count:16},
    {id:'noc',name:text('runtime.roleNoc'),icon:'radar',colour:'--air-noc',count:4},
    {id:'ground-ops',name:text('runtime.roleGroundOps'),icon:'luggage',colour:'--air-go',count:28},
    {id:'hq',name:text('runtime.roleHq'),icon:'building-2',colour:'--air-hq',count:8}
  ];
  const totalDots=departments.reduce((sum,dept)=>sum+dept.count,0);
  const totalLabel=text('runtime.roleTotal',{employees:formatEmployees(totalDots),departments:departments.length});
  let selected=null;
  const choose=(id,persist=true)=>{
    selected=id;
    root.querySelectorAll('.department').forEach(section=>{
      section.dataset.active=String(!id||section.dataset.department===id);
      section.querySelector('button').setAttribute('aria-pressed',String(section.dataset.department===id));
    });
    const dept=departments.find(d=>d.id===id);
    summary.textContent=dept?text('runtime.roleSelected',{department:dept.name,employees:formatEmployees(dept.count)}):totalLabel;
  };
  departments.forEach(dept=>{
    const section=document.createElement('section');section.className='department';section.dataset.department=dept.id;section.style.setProperty('--dept-colour','var('+dept.colour+')');section.setAttribute('aria-label',text('runtime.roleDepartmentAria',{department:dept.name,employees:formatEmployees(dept.count)}));
    const button=document.createElement('button');button.type='button';button.className='department-select cursor-interaction';button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',text('runtime.roleDepartmentButton',{department:dept.name,employees:formatEmployees(dept.count)}));
    const avatar=document.createElement('span');avatar.className='department-avatar';avatar.setAttribute('aria-hidden','true');
    const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('class','lucide');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','/assets/airline-icons.svg#'+dept.icon);icon.append(use);avatar.append(icon);
    const label=document.createElement('span');label.className='department-name';label.textContent=dept.name;
    button.append(avatar,label);
    const people=document.createElement('div');people.className='people-grid';people.setAttribute('role','img');people.setAttribute('aria-label',text('runtime.rolePeople',{count:dept.count,employees:formatEmployees(dept.count),department:dept.name}));
    for(let i=0;i<dept.count;i++){const cell=document.createElement('span');cell.className='dot-cell';cell.setAttribute('aria-hidden','true');const dot=document.createElement('span');dot.className='person-dot';cell.append(dot);people.append(cell);}
    const count=document.createElement('div');count.className='department-total';count.textContent=formatEmployees(dept.count);
    button.addEventListener('click',()=>choose(selected===dept.id?null:dept.id));
    section.append(button,people,count);grid.append(section);
  });
  choose(null,false);
  if(!motionPreference.matches){
    if('IntersectionObserver' in window){revealObserver=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){revealObserver.disconnect();revealDots();}},{threshold:.15});revealObserver.observe(paper);}
    else revealDots();
  }
})();
