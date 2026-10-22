import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {deskPosition,officeObstacles,findOfficePath,leisureSpots,roomAt,officeRooms} from '../shared/office-layout';

export default function OfficeCampus({agents,onSelect,control,room,theme='sunshine',motion=true,showBubbles=true}){
 const host=useRef(null),api=useRef(null),latest=useRef({}),overlays=useRef([]),locations=useRef([]),[failed,setFailed]=useState(false);
 latest.current={agents,onSelect,motion};
 const layoutKey=agents.map(a=>a.id).join('|');
 useEffect(()=>{
  const root=host.current;let renderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});}catch{setFailed(true);return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,root.clientWidth<600?1.25:1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;root.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-24,24,17,-17,.1,150);camera.position.set(24,31,36);camera.lookAt(0,0,0);
  const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.minZoom=.65;orbit.maxZoom=3.5;orbit.maxPolarAngle=Math.PI/2.25;orbit.minPolarAngle=.3;orbit.target.set(0,0,0);
  scene.add(new THREE.HemisphereLight(0xfff6e7,0xd6cfdf,2.3));const sun=new THREE.DirectionalLight(0xffefd8,3);sun.position.set(-12,24,16);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25,far:90});sun.shadow.normalBias=.035;scene.add(sun);
  const colors=theme==='mint'?{floor:'#f4f6e9',wall:'#cfe0d0',accent:'#7da98e'}:theme==='peach'?{floor:'#fff3e8',wall:'#ecd0ce',accent:'#ca8792'}:{floor:'#fff6e7',wall:'#ece0bf',accent:'#d1a35e'};
  const mats=new Map(),textures=[],uniqueMats=[];
  const material=color=>{if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.82}));return mats.get(color);};
  function mesh(geometry,x,y,z,color,parent=scene){const m=new THREE.Mesh(geometry,material(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  const box=(w,h,d,x,y,z,c,p=scene)=>mesh(new THREE.BoxGeometry(w,h,d),x,y,z,c,p);
  const rounded=(w,h,d,x,y,z,c,p=scene)=>mesh(new RoundedBoxGeometry(w,h,d,2,.09),x,y,z,c,p);
  const cyl=(r,h,x,y,z,c,p=scene)=>mesh(new THREE.CylinderGeometry(r,r*.92,h,18),x,y,z,c,p);
  const sphere=(r,x,y,z,c,p=scene)=>mesh(new THREE.SphereGeometry(r,16,12),x,y,z,c,p);
  function textPlane(title,subtitle,x,y,z,w,h,rotation=0,bg='#fff9ed'){
   const canvas=document.createElement('canvas');canvas.width=768;canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,768,256);ctx.fillStyle='#a87d5c';ctx.font='bold 56px sans-serif';ctx.fillText(title,35,105);ctx.fillStyle='#b5a087';ctx.font='25px sans-serif';ctx.fillText(subtitle,38,164);ctx.fillStyle='#dfb66e';ctx.beginPath();ctx.arc(694,111,33,0,Math.PI*2);ctx.fill();const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);const mat=new THREE.MeshStandardMaterial({map:texture,roughness:1});uniqueMats.push(mat);const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);p.position.set(x,y,z);p.rotation.y=rotation;scene.add(p);return p;
  }
  function plant(x,z,s=1){cyl(.27*s,.43*s,x,.22*s,z,'#d9ba9c');cyl(.025,.7*s,x,.7*s,z,'#8a9e6c');for(let i=0;i<5;i++){const a=i*2.4;const l=sphere(.25*s,x+Math.cos(a)*.16*s,(.85+i*.07)*s,z+Math.sin(a)*.18*s,i%2?'#9bae7c':'#b5c391');l.scale.set(.7,1.6,.7);}}
  function chair(x,z,color,rotation=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rotation;scene.add(g);rounded(.67,.16,.64,0,.48,0,color,g);rounded(.67,.65,.15,0,.83,-.27,color,g);cyl(.055,.4,0,.22,0,'#a9a69b',g);box(.7,.06,.09,0,.05,0,'#a9a69b',g);box(.09,.06,.7,0,.05,0,'#a9a69b',g);return g;}
  function desk(x,z,color,small=false){
   box(small?2:2.4,.025,2.5,x,.015,z+.4,theme==='mint'?'#e1ebd6':'#f0e1d4');rounded(small?2:2.4,.14,1.1,x,.88,z,'#e6c6a1');for(const dx of [-.95,.95])for(const dz of [-.4,.4])box(.07,.8,.07,x+dx,.43,z+dz,'#fff9ed');
   cyl(.08,.3,x,1.07,z-.16,'#7d8986');box(.52,.035,.24,x,.975,z-.16,'#8f9a91');rounded(.97,.64,.075,x,1.37,z-.25,'#61706b');box(.84,.5,.015,x,1.38,z-.205,'#b9d6cc');for(let l=0;l<4;l++)box(.25+l%2*.2,.026,.012,x-.15,1.5-l*.085,z-.192,l%2?'#eaf1d1':'#86b6a0');rounded(.62,.025,.23,x,.97,z+.26,'#fff5e4');cyl(.085,.14,x+.85,1.02,z+.15,'#d9a782');plant(x-.88,z-.23,.3);chair(x,z+1,color,Math.PI);
  }
  // A 28 × 22 campus with open-front rooms and visible doorways.
  rounded(28,.42,22,0,-.24,0,'#debd9c');box(27.9,.07,21.9,0,-.025,0,colors.floor);
  for(let x=-13;x<=13;x++)box(.012,.008,21.8,x,.016,0,'#e9dfcb');for(let z=-10;z<=10;z++)box(27.8,.008,.012,0,.016,z,'#e9dfcb');
  box(28,3,.2,0,1.45,-11,colors.wall);box(.2,3,22,-14,1.45,0,'#efdbcd');box(28,.1,.26,0,3,-11,'#fff8e7');box(.26,.1,22,-14,3,0,'#fff8e7');
  for(let x=-12;x<13;x+=3){box(2.5,1.8,.06,x,1.65,-10.87,'#c3e0e2');box(2.6,.1,.25,x,.71,-10.77,'#d5b48c');box(.06,1.85,.09,x,1.65,-10.81,'#fff8e8');box(2.5,.06,.09,x,1.6,-10.8,'#fff8e8');}
  // Colored neighborhoods, cabin dividers and doors.
  for(const [z,hue]of [[-8,'#e9e2cb'],[-2,'#dce8db'],[4,'#eaddeb'],[9,'#f3e4c7']])box(7.2,.035,z===9?3.5:5.7,10.1,.035,z,hue);
  for(const [a,b]of [[-11,-9],[-7,-3],[-1,3],[5,8],[10,11]]){box(.2,.95,b-a,6.3,.48,(a+b)/2,'#d6d9c5');box(.26,.06,b-a,6.3,.98,(a+b)/2,'#ece6cf');}
  for(const z of [-8,-2,4,9]){box(.18,2.3,.14,6.3,1.15,z-1,'#d3bea1');box(.18,2.3,.14,6.3,1.15,z+1,'#d3bea1');box(.18,.13,2.14,6.3,2.3,z,'#d3bea1');}
  for(const [a,b]of [[-14,-12],[-10,-6],[-4,0],[2,6.3]])box(b-a,1.0,.18,(a+b)/2,.5,-5.5,'#d8d6d3');
  for(const x of [-8,-2])box(.18,1.4,5.5,x,.7,-8.25,'#e5d9d6');
  textPlane('RAGE AI CAMPUS','specialists at work. possibilities everywhere.',-13.86,1.9,4.5,7.5,2.1,Math.PI/2);
  for(const [i,x]of [-11,-5,1].entries()){box(5.5,.022,5,x,.029,-8.2,['#f5dfce','#e2e7d8','#e6e0ec'][i]);textPlane(['LEAD CABIN','FOCUS CABIN','MEETING LAB'][i],['plan · delegate · report','a quiet place to think','bring your next big idea'][i],x,2.45,-10.7,3.3,.8);}
  desk(-5,-8,'#adbacd',true);rounded(2.7,.16,1.7,1,.85,-8,'#e5c498');for(const x of [-.1,2.1])chair(x,-6.7,'#d2b5a1',Math.PI);
  // Work pods grow along with the team; empty cabins/desks leave room for new agents.
  const count=latest.current.agents.length,emptyCount=Math.max(count,18);
  for(let i=0;i<emptyCount;i++){const p=deskPosition(i);desk(p.x,p.z,latest.current.agents[i]?.color||'#d5d6cb');}
  // Pantry with a fridge, coffee machine, sink and breakfast stools.
  textPlane('THE PANTRY','coffee. snacks. fresh ideas.',10,2.4,-10.7,4.6,1.1);
  rounded(1.1,1.9,1.2,12.2,.95,-9.6,'#b4c8be');box(.06,.45,.06,11.62,1.17,-9.2,'#8da89a');rounded(1.15,.95,2.8,12.1,.47,-6.8,'#dbc0a1');box(1.3,.1,3,12.1,.99,-6.8,'#fff2d8');rounded(.62,.53,.55,12.05,1.3,-7.8,'#8b9d95');box(.42,.2,.04,11.72,1.32,-7.8,'#4a6257');cyl(.1,.16,11.6,1.1,-7.8,'#e7ae81');rounded(.8,.03,.65,12,1.05,-6.2,'#bacacb');cyl(.3,.65,8.3,.32,-9,'#ceb087');cyl(.3,.65,9.4,.32,-9,'#d7b6b7');plant(7.5,-10,.9);
  // Games room: table tennis, arcade cabinets and pinball-inspired consoles.
  textPlane('PLAY ROOM','take a break. find a new angle.',10,2.35,-4.8,4.3,1.0);
  box(3,.12,1.6,10,.9,-2,'#93b3a5');box(3.02,.025,.035,10,.98,-2,'#f6eedc');box(.035,.12,1.6,10,1.05,-2,'#d9e3d5');for(const x of [9,11])for(const z of [-2.5,-1.5])box(.08,.85,.08,x,.45,z,'#b1aa9e');sphere(.065,10.6,1.03,-1.7,'#f9ecd4');for(const z of [-3.6,-.5]){rounded(.7,1.15,.7,12.3,.58,z,'#bca5cb');box(.5,.42,.05,12.3,1.02,z+.37,'#7e929c');box(.5,.03,.3,12.3,.75,z+.48,'#e9c48e');}
  // Lounge with soft sofas, a bookshelf, cushions and bean bags.
  textPlane('SLOW CLUB','recharge your batteries.',10,2.1,1.3,4.1,.95);
  rounded(1.2,.45,3.2,12.1,.4,4,'#d79d94');rounded(.2,.7,3.2,12.65,.8,4,'#d79d94');for(const z of [2.9,4,5.1])rounded(1,.2,.92,12,.69,z,'#efb5a4');rounded(.25,.43,.5,12,.99,3,'#e9cc87');rounded(.25,.43,.5,12,.99,5.1,'#b8a3d2');cyl(.65,.1,9.6,.57,4,'#ead6b4');cyl(.1,.5,9.6,.3,4,'#c4b594');const bean=sphere(.58,8.2,.38,5.5,'#b9c59e');bean.scale.y=.65;box(1.2,1.65,.45,12.7,.83,6.3,'#d6c3a5');for(let k=0;k<6;k++)box(.11,.38+k%2*.1,.3,12.2+k*.18,1.05,6.35,['#a8b697','#dcb294','#b6adc4'][k%3]);plant(7.5,6.5,.8);
  // Dining nook, extra chairs, bowls, and flowers.
  textPlane('THE LONG TABLE','good food. good company.',10,1.9,7.3,4.3,.9);
  rounded(2.8,.15,1.2,10,.82,9,'#e2c28f');for(const x of [9,10,11]){chair(x,10.1,['#ddaf9c','#b9c8ab','#c3b0cf'][x-9],Math.PI);chair(x,7.9,'#d5c69f');cyl(.2,.035,x,.93,9,'#fff7e7');}plant(12.7,10,.9);
  for(const [x,z]of [[-13,-10],[-13,9.7],[5,9.5],[5,-10],[13,-4.7]])plant(x,z,1.15);
  // Robot geometry has an explicit front (+Z); seated robots rotate PI toward the monitor (-Z).
  const bots=[],hits=[],obstacles=officeObstacles(count);
  for(const [i,a]of latest.current.agents.entries()){
   const p=deskPosition(i),home={x:p.x,z:p.z+1.05},g=new THREE.Group();g.position.set(home.x,0,home.z);g.rotation.y=Math.PI;scene.add(g);
   const body=rounded(.52,.57,.4,0,.9,0,a.color,g);body.material=body.material.clone();uniqueMats.push(body.material);
   rounded(.64,.5,.5,0,1.45,0,'#fff8e7',g);rounded(.5,.3,.035,0,1.45,.264,'#43515b',g);sphere(.055,-.12,1.48,.293,'#fbe7a2',g);sphere(.055,.12,1.48,.293,'#fbe7a2',g);box(.1,.022,.015,0,1.36,.29,'#bfdfc3',g);sphere(.035,-.255,1.36,.275,'#efa6a0',g);sphere(.035,.255,1.36,.275,'#efa6a0',g);
   cyl(.025,.17,0,1.8,0,'#a49c91',g);const indicator=sphere(.075,0,1.91,0,'#e7cc83',g);indicator.material=indicator.material.clone();uniqueMats.push(indicator.material);rounded(.28,.3,.07,0,.93,-.23,'#d0d3c8',g);
   const leftArm=rounded(.14,.48,.16,-.37,.94,.03,'#f9edda',g),rightArm=rounded(.14,.48,.16,.37,.94,.03,'#f9edda',g),leftLeg=rounded(.17,.42,.19,-.16,.36,0,'#a6a89d',g),rightLeg=rounded(.17,.42,.19,.16,.36,0,'#a6a89d',g);
   rounded(.23,.13,.32,-.16,.11,.06,a.color,g);rounded(.23,.13,.32,.16,.11,.06,a.color,g);
   g.traverse(o=>{if(o.isMesh){o.userData.agent=i;hits.push(o);}});
   bots.push({g,home,body,indicator,leftArm,rightArm,leftLeg,rightLeg,path:[],state:'desk',goal:home,next:6+i*1.3,visit:i,previousWork:false});
  }
  const resize=()=>{const w=root.clientWidth,h=root.clientHeight,a=w/h,half=Math.max(15.6,18.5/a);renderer.setSize(w,h);camera.left=-half*a;camera.right=half*a;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(root);resize();
  const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();let down={x:0,y:0};
  const pointerDown=e=>{down={x:e.clientX,y:e.clientY};},pointerUp=e=>{if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;const r=root.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(mouse,camera);const hit=raycaster.intersectObjects(hits)[0];if(hit)latest.current.onSelect(hit.object.userData.agent);};renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,projected=new THREE.Vector3();let frame,last=performance.now();const start=last;
  function route(bot,goal){bot.goal=goal;bot.path=findOfficePath({x:bot.g.position.x,z:bot.g.position.z},goal,obstacles);}
  function animate(){frame=requestAnimationFrame(animate);const now=performance.now(),dt=Math.min((now-last)/1000,.06),t=(now-start)/1000;last=now;orbit.update();
   bots.forEach((b,i)=>{
    const a=latest.current.agents[i],hasTask=a?.status==='working',movingAllowed=latest.current.motion&&!reduced&&a?.enabled!==false;
    if(hasTask&&!b.previousWork){route(b,b.home);b.state='returning';}b.previousWork=hasTask;
    if(!hasTask&&movingAllowed&&t>b.next&&!b.path.length){const target=leisureSpots[(b.visit++)%leisureSpots.length];route(b,{x:target.x+(i%2)*.5,z:target.z});b.state='walking';b.next=t+16+(i%4)*3;}
    if(!movingAllowed){b.g.position.set(b.home.x,0,b.home.z);b.path=[];b.state='desk';}
    let walking=b.path.length>0;
    if(walking){const target=b.path[0],dx=target.x-b.g.position.x,dz=target.z-b.g.position.z,d=Math.hypot(dx,dz),speed=1.6*dt;if(d<speed+.01){b.g.position.x=target.x;b.g.position.z=target.z;b.path.shift();}else{b.g.position.x+=dx/d*speed;b.g.position.z+=dz/d*speed;}if(d>.01){const angle=Math.atan2(dx,dz);b.g.rotation.y+=Math.atan2(Math.sin(angle-b.g.rotation.y),Math.cos(angle-b.g.rotation.y))*Math.min(1,dt*9);}}
    if(!b.path.length&&b.state==='returning'){b.g.position.set(b.home.x,0,b.home.z);b.state='desk';}
    if(!b.path.length&&b.state==='walking'){b.state='relaxing';b.next=t+8+(i%4)*3;}
    const atDesk=Math.hypot(b.g.position.x-b.home.x,b.g.position.z-b.home.z)<.4;
    if(atDesk&&!walking){b.g.rotation.y=Math.PI;b.g.position.y=-.13;}else b.g.position.y=movingAllowed&&walking?Math.sin(t*12+i)*.035:0;
    const swing=movingAllowed&&walking?Math.sin(t*10+i)*.45:0;b.leftLeg.rotation.x=swing;b.rightLeg.rotation.x=-swing;b.leftArm.rotation.x=walking?-swing:atDesk&&hasTask?-.8+(movingAllowed?Math.sin(t*10+i)*.08:0):0;b.rightArm.rotation.x=walking?swing:atDesk&&hasTask?-.8+(movingAllowed?Math.cos(t*10+i)*.08:0):0;
    b.body.material.color.set(a?.enabled===false?'#c5c3bc':a?.color||'#d9ab86');b.indicator.material.color.set(a?.enabled===false?'#bcbab1':hasTask?'#8cc9a8':'#e8cf8a');
    if(overlays.current[i]){projected.set(b.g.position.x,2.55,b.g.position.z).project(camera);overlays.current[i].style.transform=`translate(${(projected.x+1)*root.clientWidth/2}px,${(1-projected.y)*root.clientHeight/2}px) translate(-50%,-100%)`;overlays.current[i].style.visibility=projected.z>1?'hidden':'visible';}
    if(locations.current[i])locations.current[i].textContent=a?.enabled===false?'Nonaktif':walking?(hasTask?'Kembali ke meja':'Berjalan'):atDesk&&hasTask?(a.executionStatus==='queued'?'Menunggu antrean':a.phase==='plan'?'Membagi tugas':a.phase==='report'?'Laporan final':'Bekerja'):roomAt(b.g.position.x,b.g.position.z);
   });renderer.render(scene,camera);
  }
  api.current={camera,orbit};animate();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();orbit.dispose();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();});mats.forEach(m=>m.dispose());uniqueMats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();api.current=null;};
 },[theme,layoutKey]);
 useEffect(()=>{if(!api.current)return;const {camera,orbit}=api.current;if(control.action==='in')camera.zoom=Math.min(3.5,camera.zoom+.25);if(control.action==='out')camera.zoom=Math.max(.65,camera.zoom-.25);if(control.action==='reset'){camera.zoom=1;camera.position.set(24,31,36);orbit.target.set(0,0,0);}camera.updateProjectionMatrix();},[control]);
 useEffect(()=>{if(!api.current)return;const {camera,orbit}=api.current,focus=officeRooms.find(r=>r.id===room);orbit.target.set(focus?.x||0,0,focus?.z||0);camera.zoom=focus?.zoom||1;camera.updateProjectionMatrix();},[room,theme,layoutKey]);
 return <div className="office-canvas campus-canvas" ref={host}>{failed?<div className="webgl-fallback">WebGL tidak tersedia. Panel tim, misi, dan laporan tetap dapat digunakan.</div>:<div className="campus-overlays">{agents.map((a,i)=><div className="bot-overlay" key={a.id} ref={el=>overlays.current[i]=el} style={{'--bot-color':a.color}}><button className="bot-identity" onClick={()=>onSelect(i)} aria-label={`Pilih ${a.name}`}><i/>{a.name}<span ref={el=>locations.current[i]=el}>Studio</span></button>{showBubbles&&a.bubble&&<button className={`bot-bubble ${a.bubble.type}`} onClick={()=>onSelect(i)} title={a.bubble.message}><small>{new Date(a.bubble.created).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})} · {a.bubble.type==='output'?'Output langsung':a.bubble.type==='delegation'?'Delegasi':a.bubble.type==='handoff'?'Hasil / handoff':a.bubble.type==='report'?'Laporan final':a.bubble.type==='tool'?'Tool aktif':'Log kerja'}</small><span>{a.bubble.message}</span></button>}</div>)}</div>}</div>;
}
