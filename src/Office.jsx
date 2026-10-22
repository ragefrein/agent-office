import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export default function Office({ agents, onSelect, control, room }) {
 const mount = useRef(null), api = useRef(null), [failed, setFailed] = useState(false);
 useEffect(() => {
  const host = mount.current;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({antialias:true, alpha:true}); } catch { setFailed(true); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFShadowMap; renderer.setClearColor(0xf0f0e9,0); renderer.outputColorSpace=THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene=new THREE.Scene(), camera=new THREE.OrthographicCamera(-10,10,8,-8,.1,100);
  camera.position.set(14,15,18); camera.lookAt(0,0,0);
  const orbit=new OrbitControls(camera,renderer.domElement); orbit.target.set(0,0,0); orbit.enableDamping=true; orbit.minZoom=.6; orbit.maxZoom=2.3; orbit.maxPolarAngle=Math.PI/2.3; orbit.minPolarAngle=.3; orbit.enablePan=true;
  scene.add(new THREE.AmbientLight(0xffffff,2)); const sun=new THREE.DirectionalLight(0xfff4df,3.2); sun.position.set(-6,15,9); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14}); sun.shadow.normalBias=.04; scene.add(sun);
  const materials=new Map();
  function mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.8}));return materials.get(color);}
  function box(w,h,d,x,y,z,color,parent=scene){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function cylinder(rt,rb,h,x,y,z,color,parent=scene){const o=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,24),mat(color));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function sphere(r,x,y,z,color,parent=scene){const o=new THREE.Mesh(new THREE.SphereGeometry(r,20,16),mat(color));o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;}
  const floor=box(15,.34,11,0,-.24,0,'#d4d6cd');box(14.9,.07,10.9,0,-.035,0,'#f4f1e7');
  for(let x=-7;x<7.5;x+=1)box(.012,.009,10.8,x,.006,0,'#e3e1d7');
  for(let z=-5;z<5.5;z+=1)box(14.8,.009,.012,0,.007,z,'#e3e1d7');
  box(15,2.8,.18,0,1.3,-5.5,'#e7e8dd');box(.18,2.8,11,-7.5,1.3,0,'#e3e5da');
  box(15,.1,.24,0,2.75,-5.5,'#fafaf3');box(.24,.1,11,-7.5,2.75,0,'#fafaf3');
  // Window wall, warm timber reveals, and green views.
  for(let x=-5.5;x<=5.6;x+=2.3){box(1.95,1.75,.08,x,1.65,-5.37,'#b9d3cc');box(1.98,.09,.2,x,.74,-5.27,'#c4b493');box(.06,1.8,.1,x,1.65,-5.3,'#f7f7ec');box(1.98,.06,.1,x,1.7,-5.3,'#f7f7ec');}
  function plant(x,z,size=1){cylinder(.25*size,.18*size,.45*size,x,.22*size,z,'#d6c5a9');cylinder(.035,.035,.7*size,x,.65*size,z,'#6e8054');for(let k=0;k<7;k++){const a=k*2.4;const leaf=sphere(.24*size,x+Math.cos(a)*.22*size,(.75+k*.055)*size,z+Math.sin(a)*.22*size,k%2?'#6f8e63':'#8ba276');leaf.scale.set(.7,1.5,.7);}}
  plant(-6.7,-4.7,1.5);plant(6.6,-4.6,1.4);plant(-6.8,4.5,1.1);plant(6.7,4.6,1.4);
  // Meeting nook.
  box(3.5,.02,3.3,-5,.025,-1.7,'#d6ded1'); const table=cylinder(1.15,1.15,.15,-4.9,.98,-1.8,'#c9ae87');table.scale.z=.75;cylinder(.15,.3,.9,-4.9,.48,-1.8,'#bbb8a7');
  function chair(x,z,color='#d5a46f',rot=0){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;scene.add(g);box(.66,.15,.64,0,.55,0,color,g);box(.66,.66,.13,0,.91,-.29,color,g);cylinder(.06,.06,.47,0,.25,0,'#6b7068',g);box(.7,.06,.09,0,.05,0,'#6b7068',g);box(.09,.06,.7,0,.05,0,'#6b7068',g);}
  chair(-4.9,-3.05,'#c6ac7c');chair(-4.9,-.5,'#c6ac7c',Math.PI);chair(-6.3,-1.8,'#c6ac7c',-Math.PI/2);chair(-3.55,-1.8,'#c6ac7c',Math.PI/2);
  box(.42,.025,.32,-4.7,1.07,-1.7,'#e6e9dd');cylinder(.09,.09,.15,-5.3,1.12,-1.8,'#ffffff');
  // Desk islands with individual accessories.
  const positions=[[-1.4,-2.8],[1.6,-2.8],[-1.4,.45],[1.6,.45],[-1.4,3.45],[1.6,3.45]];
  const robots=[], hits=[];
  positions.forEach(([x,z],i)=>{
   box(2.5,.15,1.28,x,.92,z,'#d6be99');for(const dx of [-1.05,1.05])for(const dz of [-.44,.44])box(.09,.87,.09,x+dx,.44,z+dz,'#eeeae0');
   box(.1,.32,.1,x,1.14,z-.17,'#58635c');box(.46,.035,.28,x,1.005,z-.1,'#58635c');box(.98,.65,.09,x,1.48,z-.27,'#434f48');box(.87,.52,.02,x,1.49,z-.214,'#aec8b9');
   for(let l=0;l<4;l++)box(.28+((i+l)%3)*.1,.025,.013,x-.13,1.62-l*.08,z-.199,l%2?'#e9ecd0':'#5e8c77');
   box(.68,.03,.23,x,1.02,z+.28,'#eeece4');box(.16,.03,.21,x+.55,1.02,z+.25,'#f3f2eb');cylinder(.09,.07,.16,x-.88,1.08,z+.13,i%2?'#c17c51':'#f5f1e5');plant(x+.94,z-.26,.34);
   chair(x,z+1,'#798b7a',Math.PI);
   const bot=new THREE.Group();bot.position.set(x,0,z+.95);scene.add(bot);
   cylinder(.24,.29,.49,0,.97,0,agents[i]?.color||'#d99969',bot); const head=box(.54,.45,.45,0,1.42,0,'#f4f0df',bot);box(.42,.23,.03,0,1.43,.235,'#394942',bot);sphere(.045,-.105,1.46,.26,'#b8e7bd',bot);sphere(.045,.105,1.46,.26,'#b8e7bd',bot);cylinder(.025,.025,.14,0,1.72,0,'#6e7e69',bot);sphere(.06,0,1.81,0,agents[i]?.color||'#de9564',bot);sphere(.1,-.36,1.05,.03,'#f0eadb',bot);sphere(.1,.36,1.05,.03,'#f0eadb',bot);
   bot.traverse(o=>{if(o.isMesh){o.userData.agent=i;hits.push(o);}});robots.push(bot);
  });
  // Lounge, rug, coffee table and library.
  box(3.35,.025,3.5,5,.02,1.25,'#dfd6bd');box(1.05,.38,2.65,6.05,.39,1.3,'#d7a377');box(.25,.65,2.7,6.5,.8,1.3,'#d7a377');for(const z of [.45,1.3,2.15])box(.85,.2,.78,5.97,.67,z,'#e5b589');box(1.08,.53,.2,6.05,.65,-.13,'#d7a377');box(1.08,.53,.2,6.05,.65,2.73,'#d7a377');
  cylinder(.67,.67,.1,4.65,.58,1.3,'#e6e0cd');cylinder(.1,.18,.5,4.65,.28,1.3,'#a7aa96');box(.35,.03,.25,4.64,.65,1.3,'#879b7d');plant(5,3.6,.8);
  box(2.6,1.7,.55,4.6,.85,-4.8,'#b7a383');for(const y of [.13,.8,1.55])box(2.5,.08,.61,4.6,y,-4.77,'#d6c4a4');for(let k=0;k<12;k++)box(.11,.35+(k%3)*.08,.29,3.5+k*.19,1.05,-4.65,['#8c9b77','#dfb481','#e8e1ce','#889e9c'][k%4]);
  // Divider and welcome console.
  box(2.9,.78,.6,-5.1,.39,3.8,'#c6b392');box(3,.1,.7,-5.1,.83,3.8,'#e0cfaf');plant(-6,3.8,.6);box(.65,.09,.4,-4.6,.92,3.8,'#d8dfcf');
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);const a=w/h, halfHeight=Math.max(7.8,9.4/a);camera.left=-halfHeight*a;camera.right=halfHeight*a;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down={x:0,y:0};
  const pd=e=>{down={x:e.clientX,y:e.clientY};}; const click=e=>{if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;const r=host.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(hits)[0];if(hit)onSelect(hit.object.userData.agent);};
  renderer.domElement.addEventListener('pointerdown',pd);renderer.domElement.addEventListener('pointerup',click);
  api.current={camera,orbit};let frame;const started=performance.now();
  function animate(){frame=requestAnimationFrame(animate);const t=(performance.now()-started)/1000;robots.forEach((b,i)=>{b.position.y=Math.sin(t*1.7+i)*.025;b.rotation.y=Math.sin(t*.6+i)*.06;});orbit.update();renderer.render(scene,camera);}animate();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();orbit.dispose();scene.traverse(o=>{if(o.geometry)o.geometry.dispose();});materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();api.current=null;};
 },[]);
 useEffect(()=>{if(!api.current)return;const {camera,orbit}=api.current;if(control.action==='in')camera.zoom=Math.min(2.3,camera.zoom+.18);if(control.action==='out')camera.zoom=Math.max(.6,camera.zoom-.18);if(control.action==='reset'){camera.position.set(14,15,18);camera.zoom=1;orbit.target.set(0,0,0);}camera.updateProjectionMatrix();},[control]);
 useEffect(()=>{if(!api.current)return;const {orbit}=api.current;orbit.target.set(room==='meeting'?-4:room==='lounge'?4:0,0,0);},[room]);
 return <div className="office-canvas" ref={mount}>{failed&&<div className="webgl-fallback">Tampilan 3D membutuhkan WebGL. Anda tetap dapat mengelola agent melalui panel tim.</div>}</div>;
}

