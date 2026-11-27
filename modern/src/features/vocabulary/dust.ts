// Pixel-derived text dissolution, independently implemented for the browser.
type Particle={x:number;y:number;vx:number;vy:number;delay:number;life:number;size:number;color:string};
export type DustSnapshot={left:number;top:number;width:number;height:number;particles:Particle[]};
export function captureDust(row:HTMLElement):DustSnapshot|null{
 const box=row.getBoundingClientRect(),width=Math.ceil(box.width),height=Math.ceil(box.height);
 if(!width||!height)return null;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
 for(const el of row.querySelectorAll<HTMLElement>('.wf-entry-english>span,.wf-entry-persian>span,.wf-entry-example')){
  const style=getComputedStyle(el),walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  ctx.font=style.fontWeight+' '+style.fontSize+' '+style.fontFamily;
  ctx.fillStyle=style.color;ctx.textBaseline='middle';ctx.direction=style.direction==='rtl'?'rtl':'ltr';ctx.textAlign=ctx.direction==='rtl'?'right':'left';
  let node:Node|null;
  while((node=walker.nextNode())){
   const value=node.textContent??'';const range=document.createRange();let line='',bounds:DOMRect|null=null;
   const flush=()=>{if(bounds&&line.trim())ctx.fillText(line,(ctx.direction==='rtl'?bounds.right:bounds.left)-box.left,bounds.top-box.top+bounds.height/2);line='';bounds=null;};
   let offset=0;
   for(const ch of value){range.setStart(node,offset);offset+=ch.length;range.setEnd(node,offset);const r=range.getBoundingClientRect();if(!r.width||!r.height){if(ch==='\n')flush();continue;}if(bounds&&Math.abs(bounds.top-r.top)>3)flush();line+=ch;if(!bounds)bounds=r;else{const l=Math.min(bounds.left,r.left),right=Math.max(bounds.right,r.right);bounds=new DOMRect(l,bounds.top,right-l,bounds.height);}}
   flush();
  }
 }
 const pixels=ctx.getImageData(0,0,width,height).data,particles:Particle[]=[];
 const step=Math.max(1,Math.ceil(Math.sqrt(width*height/250000)));
 for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step){const k=(y*width+x)*4;if(pixels[k+3]<65)continue;const rand=Math.random();particles.push({x,y,vx:-28-Math.random()*100,vy:(Math.random()-.55)*90,delay:x/width*.18+Math.random()*.12,life:.42+Math.random()*.38,size:step*(.7+rand*.6),color:'rgba('+pixels[k]+','+pixels[k+1]+','+pixels[k+2]+','+pixels[k+3]/255+')'});}
 if(particles.length>8000){const stride=Math.ceil(particles.length/8000);return {left:box.left,top:box.top,width,height,particles:particles.filter((_,i)=>i%stride===0)};}
 return {left:box.left,top:box.top,width,height,particles};
}
export function playDust(snapshot:DustSnapshot):()=>void{
 if(!snapshot.particles.length||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return ()=>{};
 const pad=150,canvas=document.createElement('canvas'),w=snapshot.width+pad*2,h=snapshot.height+pad*2,dpr=Math.min(2,window.devicePixelRatio||1);
 canvas.width=Math.ceil(w*dpr);canvas.height=Math.ceil(h*dpr);
 Object.assign(canvas.style,{position:'fixed',left:(snapshot.left-pad)+'px',top:(snapshot.top-pad)+'px',width:w+'px',height:h+'px',pointerEvents:'none',zIndex:'60'});
 canvas.setAttribute('aria-hidden','true');const ctx=canvas.getContext('2d');if(!ctx)return ()=>{};
 document.body.append(canvas);ctx.scale(dpr,dpr);let frame=0;const start=performance.now();
 const stop=()=>{cancelAnimationFrame(frame);canvas.remove();};
 const draw=(now:number)=>{const elapsed=(now-start)/1000;ctx.clearRect(0,0,w,h);let alive=false;
 for(const p of snapshot.particles){const t=Math.max(0,elapsed-p.delay),f=t/p.life;if(f>=1)continue;alive=true;ctx.globalAlpha=1-f*f;ctx.fillStyle=p.color;ctx.fillRect(pad+p.x+p.vx*t*t,pad+p.y+p.vy*t-20*t*t,p.size,p.size);}
 if(alive)frame=requestAnimationFrame(draw);else stop();};frame=requestAnimationFrame(draw);return stop;
}
