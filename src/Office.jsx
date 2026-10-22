import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export default function Office({ agents, onSelect, control, room, theme='sunshine', motion=true }) {
 const mount = useRef(null), api = useRef(null), [failed, setFailed] = useState(false), latest=useRef({agents,onSelect,motion}), labels=useRef([]);
 latest.current={agents,onSelect,motion};
 useEffect(() => {
  const host = mount.current;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({antialias:true, alpha:true}); } catch { setFailed(true); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, host.clientWidth<600?1.25:1.7)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFShadowMap; renderer.setClearColor(0xf0f0e9,0); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  host.appendChild(renderer.domElement);
  const scene=new THREE.Scene(), camera=new THREE.OrthographicCamera(-10,10,8,-8,.1,100);
  camera.position.set(14,15,18); camera.lookAt(0,0,0);
  const orbit=new OrbitControls(camera,renderer.domElement); orbit.target.set(0,0,0); orbit.enableDamping=true; orbit.minZoom=.6; orbit.maxZoom=2.3; orbit.maxPolarAngle=Math.PI/2.3; orbit.minPolarAngle=.3; orbit.enablePan=true;
  scene.add(new THREE.HemisphereLight(0xfff6e5,0xd1c8dd,2.6)); const sun=new THREE.DirectionalLight(0xfff4df,3.2); sun.position.set(-6,15,9); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14}); sun.shadow.normalBias=.04; scene.add(sun);
  const palette=theme==='peach'?{wall:'#f5d5cd',floor:'#fff2e7',rug:'#eed2d5'}:theme==='mint'?{wall:'#cde4d8',floor:'#f1f7e6',rug:'#d6e5c4'}:{wall:'#efe0b4',floor:'#fff7e9',rug:'#e7d8ee'};
  const materials=new Map();
  function mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.8}));return materials.get(color);}
  function box(w,h,d,x,y,z,color,parent=scene){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function cylinder(rt,rb,h,x,y,z,color,parent=scene){const o=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,24),mat(color));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function sphere(r,x,y,z,color,parent=scene){const o=new THREE.Mesh(new THREE.SphereGeometry(r,20,16),mat(color));o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;}
  const floor=box(15,.34,11,0,-.24,0,'#dfc7b3');box(14.9,.07,10.9,0,-.035,0,palette.floor);
  for(let x=-7;x<7.5;x+=1)box(.012,.009,10.8,x,.006,0,'#e3e1d7');
  for(let z=-5;z<5.5;z+=1)box(14.8,.009,.012,0,.007,z,'#e3e1d7');
  box(15,2.8,.18,0,1.3,-5.5,palette.wall);box(.18,2.8,11,-7.5,1.3,0,'#f3d6c4');
  box(15,.1,.24,0,2.75,-5.5,'#fafaf3');box(.24,.1,11,-7.5,2.75,0,'#fafaf3');
  // Window wall, warm timber reveals, and green views.
  for(let x=-5.5;x<=5.6;x+=2.3){box(1.95,1.75,.08,x,1.65,-5.37,'#bde0e5');box(1.98,.09,.2,x,.74,-5.27,'#e4b67e');box(.06,1.8,.1,x,1.65,-5.3,'#fff9e9');box(1.98,.06,.1,x,1.7,-5.3,'#fff9e9');}
  const textures=[];
  function sign(text,subtitle,x,y,z,w=3.4,h=1.3,rotate=0){
   const canvas=document.createElement('canvas');canvas.width=768;canvas.height=320;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff9ed';ctx.fillRect(0,0,768,320);ctx.fillStyle='#d78262';ctx.beginPath();ctx.arc(94,105,42,0,Math.PI*2);ctx.fill();ctx.fillStyle='#534e55';ctx.font='bold 54px sans-serif';ctx.fillText(text,55,208);ctx.font='23px sans-serif';ctx.fillStyle='#929079';ctx.fillText(subtitle,55,259);ctx.fillStyle='#97c1b3';ctx.fillRect(590,48,105,23);ctx.fillStyle='#c0abd7';ctx.beginPath();ctx.arc(680,125,35,0,Math.PI*2);ctx.fill();const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);const material=new THREE.MeshStandardMaterial({map:texture,roughness:.9});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);mesh.position.set(x,y,z);mesh.rotation.y=rotate;scene.add(mesh);return mesh;
  }
  sign('RAGE AI CLUB','little bots. big possibilities.',-7.385,1.75,1.35,3.5,1.5,Math.PI/2);
  // Colorful desk neighborhoods, hand-cut rugs and playful wall art.
  function rug(w,d,x,z,color){const r=.3,s=new THREE.Shape();s.moveTo(-w/2+r,-d/2);s.lineTo(w/2-r,-d/2);s.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);s.lineTo(w/2,d/2-r);s.quadraticCurveTo(w/2,d/2,w/2-r,d/2);s.lineTo(-w/2+r,d/2);s.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);s.lineTo(-w/2,-d/2+r);s.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);const m=new THREE.Mesh(new THREE.ShapeGeometry(s),mat(color));m.rotation.x=-Math.PI/2;m.position.set(x,.027,z);m.receiveShadow=true;scene.add(m);}
  rug(3.7,3.25,-5,-1.7,'#d7e8cf');rug(3.2,3.8,5,1.25,palette.rug);
  function plant(x,z,size=1){cylinder(.25*size,.18*size,.45*size,x,.22*size,z,'#d6c5a9');cylinder(.035,.035,.7*size,x,.65*size,z,'#6e8054');for(let k=0;k<7;k++){const a=k*2.4;const leaf=sphere(.24*size,x+Math.cos(a)*.22*size,(.75+k*.055)*size,z+Math.sin(a)*.22*size,k%2?'#6f8e63':'#8ba276');leaf.scale.set(.7,1.5,.7);}}
  plant(-6.7,-4.7,1.5);plant(6.6,-4.6,1.4);plant(-6.8,4.5,1.1);plant(6.7,4.6,1.4);
  // Meeting nook.
  const table=cylinder(1.15,1.15,.15,-4.9,.98,-1.8,'#f0c479');table.scale.z=.75;cylinder(.15,.3,.9,-4.9,.48,-1.8,'#d3b392');
  function chair(x,z,color='#d5a46f',rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;scene.add(g);box(.66,.15,.64,0,.55,0,color,g);box(.66,.66,.13,0,.91,-.29,color,g);cylinder(.06,.06,.47,0,.25,0,'#6b7068',g);box(.7,.06,.09,0,.05,0,'#6b7068',g);box(.09,.06,.7,0,.05,0,'#6b7068',g);}
  chair(-4.9,-3.05,'#a9c3ab');chair(-4.9,-.5,'#e7a28d',Math.PI);chair(-6.3,-1.8,'#b9a2d3',-Math.PI/2);chair(-3.55,-1.8,'#e8c675',Math.PI/2);
  box(.42,.025,.32,-4.7,1.07,-1.7,'#e6e9dd');cylinder(.09,.09,.15,-5.3,1.12,-1.8,'#ffffff');
  // Desk islands with individual accessories.
  const positions=[[-1.4,-2.8],[1.6,-2.8],[-1.4,.45],[1.6,.45],[-1.4,3.45],[1.6,3.45]];
  const robots=[], hits=[], indicators=[], bodies=[];
  positions.forEach(([x,z],i)=>{
   const color=latest.current.agents[i]?.color||'#ed987e';rug(2.75,2.45,x,z+.45,['#f4ded2','#e0ebd9','#dce8f1','#eae0f1','#f5ebc7','#dcece6'][i]);
   box(2.5,.15,1.28,x,.92,z,'#efd5b2');for(const dx of [-1.05,1.05])for(const dz of [-.44,.44])box(.09,.87,.09,x+dx,.44,z+dz,'#fffaf0');
   box(.1,.32,.1,x,1.14,z-.17,'#58635c');box(.46,.035,.28,x,1.005,z-.1,'#58635c');box(.98,.65,.09,x,1.48,z-.27,'#434f48');box(.87,.52,.02,x,1.49,z-.214,'#aec8b9');
   for(let l=0;l<4;l++)box(.28+((i+l)%3)*.1,.025,.013,x-.13,1.62-l*.08,z-.199,l%2?'#e9ecd0':'#5e8c77');
   box(.68,.03,.23,x,1.02,z+.28,'#eeece4');box(.16,.03,.21,x+.55,1.02,z+.25,'#f3f2eb');cylinder(.09,.07,.16,x-.88,1.08,z+.13,i%2?'#c17c51':'#f5f1e5');plant(x+.94,z-.26,.34);
   chair(x,z+1,color,Math.PI);
   const bot=new THREE.Group();bot.position.set(x,0,z+.95);scene.add(bot);
   const body=cylinder(.24,.29,.49,0,.97,0,color,bot);body.material=body.material.clone();bodies.push(body);const head=box(.57,.47,.47,0,1.42,0,'#fff9ec',bot);box(.44,.25,.03,0,1.43,.245,'#494b56',bot);sphere(.045,-.105,1.46,.27,'#ffedaf',bot);sphere(.045,.105,1.46,.27,'#ffedaf',bot);box(.08,.018,.016,0,1.37,.27,'#d6f3da',bot);sphere(.038,-.22,1.35,.255,'#eda1a0',bot);sphere(.038,.22,1.35,.255,'#eda1a0',bot);cylinder(.025,.025,.14,0,1.72,0,'#81778f',bot);const indicator=sphere(.075,0,1.83,0,color,bot);indicator.material=indicator.material.clone();indicators.push(indicator);sphere(.1,-.36,1.05,.03,'#fff3df',bot);sphere(.1,.36,1.05,.03,'#fff3df',bot);
   bot.traverse(o=>{if(o.isMesh){o.userData.agent=i;hits.push(o);}});robots.push(bot);
  });
  // Lounge, rug, coffee table and library.
  box(1.05,.38,2.65,6.05,.39,1.3,'#dc9d91');box(.25,.65,2.7,6.5,.8,1.3,'#dc9d91');for(const z of [.45,1.3,2.15])box(.85,.2,.78,5.97,.67,z,'#f2b3a2');box(1.08,.53,.2,6.05,.65,-.13,'#dc9d91');box(1.08,.53,.2,6.05,.65,2.73,'#dc9d91');const pillow=box(.25,.45,.4,6,.92,.4,'#f6d887');pillow.rotation.z=.2;box(.23,.42,.43,6,.92,2.2,'#bba8d3');
  cylinder(.67,.67,.1,4.65,.58,1.3,'#e6e0cd');cylinder(.1,.18,.5,4.65,.28,1.3,'#a7aa96');box(.35,.03,.25,4.64,.65,1.3,'#879b7d');plant(5,3.6,.8);
  box(2.6,1.7,.55,4.6,.85,-4.8,'#b7a383');for(const y of [.13,.8,1.55])box(2.5,.08,.61,4.6,y,-4.77,'#d6c4a4');for(let k=0;k<12;k++)box(.11,.35+(k%3)*.08,.29,3.5+k*.19,1.05,-4.65,['#8c9b77','#dfb481','#e8e1ce','#889e9c'][k%4]);
  // Divider and welcome console.
  box(2.9,.78,.6,-5.1,.39,3.8,'#c6b392');box(3,.1,.7,-5.1,.83,3.8,'#e0cfaf');plant(-6,3.8,.6);box(.65,.09,.4,-4.6,.92,3.8,'#d8dfcf');
  sign('HELLO, HUMAN!','your ideas are welcome here.',-5.1,1.25,3.82,1.8,.7,0);
  // A tiny coffee bar, daisies and a pair of soft bean bags.
  cylinder(.43,.5,.22,4,.18,3.9,'#b8c7a3');const bean=sphere(.48,4,.42,3.9,'#b8c7a3');bean.scale.set(1,.65,1);cylinder(.34,.39,.2,5.1,.17,4.05,'#edcc80');const bean2=sphere(.39,5.1,.35,4.05,'#edcc80');bean2.scale.set(1,.7,1);
  box(1.6,.85,.7,-4.8,.43,-4.8,'#d2aa89');box(1.7,.08,.8,-4.8,.91,-4.8,'#f9ecd5');box(.5,.4,.4,-4.6,1.15,-4.8,'#b1bcb3');box(.38,.16,.05,-4.6,1.18,-4.56,'#5d6969');cylinder(.1,.08,.13,-5.2,1.02,-4.7,'#edb46f');
  for(const [x,z] of [[-6,3.8],[6.6,-4.6]]){cylinder(.025,.025,.5,x,1.2,z,'#86a16d');sphere(.09,x,1.49,z,'#d2a353');for(let p=0;p<7;p++){const a=p*Math.PI*2/7;sphere(.085,x+Math.cos(a)*.12,1.49+Math.sin(a)*.12,z,'#ffe5a2');}}
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);const a=w/h, halfHeight=Math.max(7.8,9.4/a);camera.left=-halfHeight*a;camera.right=halfHeight*a;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down={x:0,y:0};
  const pd=e=>{down={x:e.clientX,y:e.clientY};}; const click=e=>{if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;const r=host.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(hits)[0];if(hit)latest.current.onSelect(hit.object.userData.agent);};
  renderer.domElement.addEventListener('pointerdown',pd);renderer.domElement.addEventListener('pointerup',click);
  api.current={camera,orbit};let frame;const started=performance.now();
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches,projected=new THREE.Vector3();
  function animate(){frame=requestAnimationFrame(animate);const t=(performance.now()-started)/1000;orbit.update();robots.forEach((b,i)=>{const agent=latest.current.agents[i],working=agent?.status==='working',enabled=agent?.enabled!==false;const moving=latest.current.motion&&!reducedMotion;b.position.y=moving?Math.sin(t*(working?4:1.5)+i)*(working?.045:.015):0;b.rotation.y=moving?Math.sin(t*(working?2:.5)+i)*(working?.09:.025):0;bodies[i].material.color.set(enabled?(agent?.color||'#ed987e'):'#c8c6c0');indicators[i].material.color.set(!enabled?'#b9b7b0':working?'#93dcb4':'#f4d98f');if(labels.current[i]){projected.set(b.position.x,2.15,b.position.z).project(camera);labels.current[i].style.transform=`translate(${(projected.x+1)*host.clientWidth/2}px,${(-projected.y+1)*host.clientHeight/2}px) translate(-50%,-50%)`;labels.current[i].style.visibility=projected.z>1?'hidden':'visible';}});renderer.render(scene,camera);}animate();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();orbit.dispose();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();});materials.forEach(m=>m.dispose());bodies.forEach(b=>b.material.dispose());indicators.forEach(i=>i.material.dispose());textures.forEach(t=>t.dispose());scene.traverse(o=>{if(o.material?.map)o.material.dispose();});renderer.dispose();renderer.domElement.remove();api.current=null;};
 },[theme]);
 useEffect(()=>{if(!api.current)return;const {camera,orbit}=api.current;if(control.action==='in')camera.zoom=Math.min(2.3,camera.zoom+.18);if(control.action==='out')camera.zoom=Math.max(.6,camera.zoom-.18);if(control.action==='reset'){camera.position.set(14,15,18);camera.zoom=1;orbit.target.set(0,0,0);}camera.updateProjectionMatrix();},[control]);
 useEffect(()=>{if(!api.current)return;const {orbit}=api.current;orbit.target.set(room==='meeting'?-4:room==='lounge'?4:0,0,0);},[room,theme]);
 return <div className="office-canvas" ref={mount}>{failed?<div className="webgl-fallback">Tampilan 3D membutuhkan WebGL. Anda tetap dapat mengelola agent melalui panel tim.</div>:<div className="agent-nameplates">{agents.map((a,i)=><button ref={el=>labels.current[i]=el} key={a.id} className={`nameplate ${a.status==='working'?'working':''} ${a.enabled===false?'disabled':''}`} onClick={()=>onSelect(i)} style={{'--bot-color':a.color}} aria-label={`Pilih ${a.name}`}><i/>{a.name}<span>{a.enabled===false?'Zzz':a.status==='working'?'✦':'♡'}</span></button>)}</div>}</div>;
}

