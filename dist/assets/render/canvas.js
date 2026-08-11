import {createViewport} from '../game/viewport.js';
import {fillReflectionArcPoints,REFLECTION_ARC_SEGMENTS} from './reflection-arcs.js';

export class CanvasView{
  constructor(canvas){
    this.canvas=canvas;
    const context=canvas.getContext('2d',{alpha:false});
    if(!context)throw Error('Canvas unavailable');
    this.ctx=context;
    this.dpr=1;
    this.screenWidth=1;
    this.screenHeight=1;
    this.viewport=createViewport(1,1);
    this.arcPoints=new Float32Array(REFLECTION_ARC_SEGMENTS*4);
  }

  waveStroke(wave){
    if(wave.reflections>=2)return[255,198,64];
    if(wave.kind==='glass')return[194,126,255];
    if(wave.kind==='wall')return[116,148,255];
    return[90,235,255];
  }

  resize(width,height,_quality,viewport=createViewport(width,height)){
    const dpr=Math.min(devicePixelRatio||1,1.25);
    this.dpr=dpr;
    this.screenWidth=width;
    this.screenHeight=height;
    this.viewport=viewport;
    this.canvas.width=Math.max(1,Math.floor(width*dpr));
    this.canvas.height=Math.max(1,Math.floor(height*dpr));
    this.canvas.style.width=width+'px';
    this.canvas.style.height=height+'px';
  }

  render(world,time){
    const context=this.ctx;
    const viewport=this.viewport;
    context.setTransform(this.dpr,0,0,this.dpr,0,0);
    context.fillStyle='#020813';
    context.fillRect(0,0,this.screenWidth,this.screenHeight);
    context.strokeStyle='rgba(110,230,255,.035)';
    context.lineWidth=1;
    for(let y=16;y<this.screenHeight;y+=22){
      context.beginPath();
      for(let x=0;x<=this.screenWidth;x+=24)context.lineTo(x,y+Math.sin(x*.025+time*.0015+y)*2);
      context.stroke();
    }

    context.save();
    context.beginPath();
    context.rect(viewport.offsetX,viewport.offsetY,viewport.displayWidth,viewport.displayHeight);
    context.clip();
    context.translate(viewport.offsetX,viewport.offsetY);
    context.scale(viewport.scale,viewport.scale);

    const width=world.w;
    const height=world.h;
    context.fillStyle='#03101f';
    context.fillRect(0,0,width,height);
    context.strokeStyle='rgba(110,230,255,.10)';
    context.lineWidth=1;
    for(let y=20;y<height;y+=18){
      context.beginPath();
      for(let x=0;x<width;x+=24)context.lineTo(x,y+Math.sin(x*.03+time*.002+y)*3);
      context.stroke();
    }
    context.lineCap='round';
    for(const glass of world.glass){
      context.strokeStyle='rgba(93,54,255,.24)';
      context.lineWidth=10;
      context.beginPath();
      context.moveTo(glass.x1,glass.y1);
      context.lineTo(glass.x2,glass.y2);
      context.stroke();
      context.strokeStyle='rgba(207,183,255,.92)';
      context.lineWidth=3;
      context.beginPath();
      context.moveTo(glass.x1,glass.y1);
      context.lineTo(glass.x2,glass.y2);
      context.stroke();
      context.strokeStyle='rgba(255,224,117,.9)';
      context.lineWidth=2;
      const midX=(glass.x1+glass.x2)*.5;
      const midY=(glass.y1+glass.y2)*.5;
      context.beginPath();
      context.moveTo(midX-glass.nx*10,midY-glass.ny*10);
      context.lineTo(midX+glass.nx*10,midY+glass.ny*10);
      context.stroke();
      for(const point of [[glass.x1,glass.y1],[glass.x2,glass.y2]]){
        context.beginPath();
        context.arc(point[0],point[1],4,0,Math.PI*2);
        context.stroke();
      }
    }
    for(const effect of world.reflectionEffects){
      const progress=Math.min(1,effect.age/effect.life);
      const alpha=(1-progress)*.72;
      context.strokeStyle=effect.kind==='glass'?`rgba(214,152,255,${alpha})`:`rgba(127,171,255,${alpha})`;
      context.lineWidth=2;
      context.beginPath();
      context.arc(effect.x,effect.y,4+progress*22,0,Math.PI*2);
      context.stroke();
      context.strokeStyle=`rgba(255,224,117,${alpha})`;
      context.beginPath();
      context.moveTo(effect.x,effect.y);
      context.lineTo(effect.x+effect.normalX*(12+progress*18),effect.y+effect.normalY*(12+progress*18));
      context.stroke();
    }
    for(const wave of world.waves){
      const [red,green,blue]=this.waveStroke(wave);
      context.strokeStyle=`rgba(${red},${green},${blue},${(1-wave.age/wave.life)*.86})`;
      context.lineWidth=wave.reflections>=2?4:3;
      context.beginPath();
      if((wave.reflectionDepth??wave.reflections??0)>0){
        const pointCount=fillReflectionArcPoints(wave,this.arcPoints,REFLECTION_ARC_SEGMENTS);
        for(let point=0;point<pointCount;point+=4){
          context.moveTo(this.arcPoints[point],this.arcPoints[point+1]);
          context.lineTo(this.arcPoints[point+2],this.arcPoints[point+3]);
        }
      }else{
        context.arc(wave.originX,wave.originY,wave.radius,0,Math.PI*2);
      }
      context.stroke();
    }
    for(const beacon of world.beacons){
      const glow=context.createRadialGradient(beacon.x,beacon.y,2,beacon.x,beacon.y,beacon.radius*3);
      glow.addColorStop(0,'#ffffe0');
      glow.addColorStop(1,'rgba(80,230,255,0)');
      context.fillStyle=glow;
      context.beginPath();
      context.arc(beacon.x,beacon.y,beacon.radius*3,0,Math.PI*2);
      context.fill();
      context.fillStyle='#eaffff';
      context.beginPath();
      context.arc(beacon.x,beacon.y,beacon.radius,0,Math.PI*2);
      context.fill();
    }
    for(const particle of world.particles){
      context.fillStyle=`rgba(190,250,255,${1-particle.age/particle.life})`;
      context.fillRect(particle.x,particle.y,2,2);
    }
    context.restore();
  }
}
