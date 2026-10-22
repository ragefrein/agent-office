export const officeRooms=[
 {id:'office',name:'Studio & desks',x:-4,z:2,zoom:1.35},
 {id:'cabins',name:'Private cabins',x:-5,z:-8,zoom:1.8},
 {id:'pantry',name:'Pantry',x:10,z:-8,zoom:2.1},
 {id:'games',name:'Games room',x:10,z:-2,zoom:2.1},
 {id:'lounge',name:'Lounge',x:10,z:4,zoom:2.1},
 {id:'dining',name:'Dining room',x:10,z:9,zoom:2.1},
];
export const deskPosition=i=>i===0?{x:-11,z:-8}:{x:-11+((i-1)%5)*3.5,z:-2.8+Math.floor((i-1)/5)*3.5};
export function officeObstacles(count){
 const rect=(x,z,w,d)=>({x,z,w,d});
 const objects=Array.from({length:Math.max(count,18)},(_,i)=>{const p=deskPosition(i);return rect(p.x,p.z,2.4,1.1);});
 objects.push(rect(-5,-8,2.4,1.1),rect(1,-8,2.7,1.7),rect(12,-8,1,4),rect(10,-2,3.1,1.7),rect(12,4,1.2,3.2),rect(10,9,2.8,1.2));
 // Door gaps stay open, so all idle destinations remain reachable.
 for(const [a,b]of [[-11,-9],[-7,-3],[-1,3],[5,8],[10,11]])objects.push(rect(6.3,(a+b)/2,.22,b-a));
 for(const [a,b]of [[-14,-12],[-10,-6],[-4,0],[2,6.3]])objects.push(rect((a+b)/2,-5.5,b-a,.2));
 objects.push(rect(-8,-8.25,.2,5.5),rect(-2,-8.25,.2,5.5));
 return objects;
}
export function findOfficePath(start,end,obstacles){
 const minX=-13.5,minZ=-10.5,step=.5,nx=55,nz=43;
 const point=(ix,iz)=>({x:minX+ix*step,z:minZ+iz*step});
 const index=p=>({x:Math.max(0,Math.min(nx-1,Math.round((p.x-minX)/step))),z:Math.max(0,Math.min(nz-1,Math.round((p.z-minZ)/step)))});
 const free=(x,z)=>{const p=point(x,z);return !obstacles.some(o=>Math.abs(p.x-o.x)<o.w/2+.23&&Math.abs(p.z-o.z)<o.d/2+.23);};
 const a=index(start),b=index(end),key=(x,z)=>z*nx+x,source=key(a.x,a.z),target=key(b.x,b.z);
 if(!free(b.x,b.z))return [];
 const queue=[[a.x,a.z]],visited=new Map([[source,null]]);let cursor=0;
 while(cursor<queue.length){const [x,z]=queue[cursor++],id=key(x,z);if(id===target)break;for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,zz=z+dz,k=key(xx,zz);if(xx<0||zz<0||xx>=nx||zz>=nz||visited.has(k)||!free(xx,zz))continue;visited.set(k,id);queue.push([xx,zz]);}}
 if(!visited.has(target))return [];
 const path=[];let at=target;while(at!==source){path.push(point(at%nx,Math.floor(at/nx)));at=visited.get(at);}return path.reverse();
}
export const leisureSpots=[{x:9,z:-7.5,room:'Pantry'},{x:8.5,z:-.5,room:'Games room'},{x:9,z:4.5,room:'Lounge'},{x:8,z:8,room:'Dining room'},{x:-4,z:-4,room:'Studio'},{x:3,z:8.5,room:'Studio'}];
export function roomAt(x,z){if(x>6.3)return z<-5?'Pantry':z<1?'Games room':z<7?'Lounge':'Dining room';return z<-5.5?'Cabin':'Studio';}
