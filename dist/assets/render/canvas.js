import {createViewport} from '../game/viewport.js';
import {QUALITY} from '../config.js';
import {fillReflectionArcPoints,REFLECTION_ARC_SEGMENTS} from './reflection-arcs.js';
import {RippleSurface} from './ripple-surface.js';
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
    this.quality='MID';
    this.rippleSurface=new RippleSurface();
    this.rippleCanvas=null;
    this.rippleContext=null;
    this.rippleImageData=null;
  }

  waveStroke(wave){
    // Wave colour no longer encodes the reflection type. The water surface
    // and the reflection count communicate the result without four competing
    // ring colours.
    return[158,225,232];
  }

  waveVisualWidth(wave){
    return Math.max(3,wave.width*.58);
  }

  waveRadius(wave){
    return Number.isFinite(wave.displayRadius)?wave.displayRadius:wave.radius;
  }

  wavePath(context,wave){
    context.beginPath();
    if((wave.reflectionDepth??wave.reflections??0)>0){
      const pointCount=fillReflectionArcPoints(wave,this.arcPoints,REFLECTION_ARC_SEGMENTS);
      for(let point=0;point<pointCount;point+=4){
        context.moveTo(this.arcPoints[point],this.arcPoints[point+1]);
        context.lineTo(this.arcPoints[point+2],this.arcPoints[point+3]);
      }
    }else{
      context.arc(wave.originX,wave.originY,this.waveRadius(wave),0,Math.PI*2);
    }
  }

  reflectionTapHint(context,wave,time){
    const pulse=.18+.10*(.5+.5*Math.sin(time*.008+(wave.id??0)));
    context.save();
    this.wavePath(context,wave);
    context.strokeStyle=`rgba(216,250,255,${pulse})`;
    context.lineWidth=this.waveVisualWidth(wave)+8;
    context.stroke();
    this.wavePath(context,wave);
    context.strokeStyle=`rgba(239,255,255,${.46+pulse})`;
    context.lineWidth=2;
    context.setLineDash([4,6]);
    context.stroke();
    context.restore();
  }

  strokeWaveBand(context,wave,red,green,blue,alpha,width){
    this.wavePath(context,wave);
    context.strokeStyle='rgba('+red+','+green+','+blue+','+Math.min(1,alpha+.20)+')';
    context.lineWidth=width+4;
    context.stroke();
    this.wavePath(context,wave);
    context.strokeStyle='rgba('+red+','+green+','+blue+','+alpha+')';
    context.lineWidth=width;
    context.stroke();
  }

  resize(width,height,quality='MID',viewport=createViewport(width,height)){
    this.quality=quality;
    const dpr=Math.min(devicePixelRatio||1,QUALITY[quality]?.dpr??QUALITY.MID.dpr);
    this.dpr=dpr;
    this.screenWidth=width;
    this.screenHeight=height;
    this.viewport=viewport;
    this.canvas.width=Math.max(1,Math.floor(width*dpr));
    this.canvas.height=Math.max(1,Math.floor(height*dpr));
    this.canvas.style.width=width+'px';
    this.canvas.style.height=height+'px';
  }

  drawRippleSurface(context,width,height){
    const surface=this.rippleSurface;
    if(!surface.w||!surface.h)return;
    if(!this.rippleCanvas||this.rippleCanvas.width!==surface.w||this.rippleCanvas.height!==surface.h){
      this.rippleCanvas=document.createElement('canvas');
      this.rippleCanvas.width=surface.w;
      this.rippleCanvas.height=surface.h;
      this.rippleContext=this.rippleCanvas.getContext('2d');
      this.rippleImageData=this.rippleContext?.createImageData(surface.w,surface.h)??null;
    }
    if(!this.rippleContext||!this.rippleImageData)return;
    this.rippleImageData.data.set(surface.paint());
    this.rippleContext.putImageData(this.rippleImageData,0,0);
    context.save();
    context.globalCompositeOperation='screen';
    context.globalAlpha=.68;
    context.imageSmoothingEnabled=true;
    context.imageSmoothingQuality='high';
    context.drawImage(this.rippleCanvas,0,0,width,height);
    context.restore();
  }

  render(world,time,quality=this.quality){
    const context=this.ctx;
    const viewport=this.viewport;
    this.rippleSurface.resize(world.w,world.h,quality);
    this.rippleSurface.syncWorld(world);
    this.rippleSurface.advance(time);
    context.setTransform(this.dpr,0,0,this.dpr,0,0);
    const sky=context.createLinearGradient(0,0,0,this.screenHeight);
    sky.addColorStop(0,'#020813');
    sky.addColorStop(.52,'#071d31');
    sky.addColorStop(1,'#01050d');
    context.fillStyle=sky;
    context.fillRect(0,0,this.screenWidth,this.screenHeight);
    const light=context.createRadialGradient(this.screenWidth*.5,this.screenHeight*.34,4,this.screenWidth*.5,this.screenHeight*.34,this.screenWidth*.72);
    light.addColorStop(0,'rgba(24,144,184,.18)');
    light.addColorStop(1,'rgba(2,8,19,0)');
    context.fillStyle=light;
    context.fillRect(0,0,this.screenWidth,this.screenHeight);
    context.strokeStyle='rgba(110,230,255,.035)';
    context.lineWidth=1;
    for(let y=16;y<this.screenHeight;y+=22){
      context.beginPath();
      for(let x=0;x<=this.screenWidth;x+=24)context.lineTo(x,y+Math.sin(x*.025+time*.0015+y)*2);
      context.stroke();
    }
    context.strokeStyle='rgba(184,245,255,.022)';
    for(let y=27;y<this.screenHeight;y+=34){
      context.beginPath();
      for(let x=0;x<=this.screenWidth;x+=30)context.lineTo(x,y+Math.sin(x*.019-time*.001+y)*1.5);
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
    const surface=context.createRadialGradient(width*.5,height*.34,18,width*.5,height*.48,Math.max(width,height)*.76);
    surface.addColorStop(0,'#0b3d56');
    surface.addColorStop(.42,'#05243a');
    surface.addColorStop(1,'#020b18');
    context.fillStyle=surface;
    context.fillRect(0,0,width,height);
    this.drawRippleSurface(context,width,height);
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
        context.strokeStyle='rgba(222,205,255,.42)';
        context.lineWidth=5;
        context.beginPath();
        context.arc(point[0],point[1],5,0,Math.PI*2);
        context.stroke();
        context.strokeStyle='rgba(255,250,224,.82)';
        context.lineWidth=1.5;
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
      const age=Number.isFinite(wave.displayAge)?wave.displayAge:wave.age;
      const alpha=Math.max(0,1-age/wave.life)*.78;
      if(world.isReflectionTapAvailable(wave))this.reflectionTapHint(context,wave,time);
      this.strokeWaveBand(context,wave,red,green,blue,alpha,this.waveVisualWidth(wave));
    }
    for(const fade of world.waveFades??[]){
      const wave=fade.wave;
      const [red,green,blue]=this.waveStroke(wave);
      const alpha=Math.max(0,1-fade.age/fade.life)*.78;
      this.strokeWaveBand(context,wave,red,green,blue,alpha,this.waveVisualWidth(wave));
    }
    for(const beacon of world.beacons){
      const flash=beacon.flash||0;
      const pulse=.5+.5*Math.sin(time*.004+String(beacon.id).length);
      const glowRadius=beacon.radius*(3+flash*1.2);
      const glow=context.createRadialGradient(beacon.x,beacon.y,2,beacon.x,beacon.y,glowRadius);
      glow.addColorStop(0,'rgba(255,255,224,.94)');
      glow.addColorStop(.35,'rgba(110,238,255,.38)');
      glow.addColorStop(1,'rgba(80,230,255,0)');
      context.fillStyle=glow;
      context.beginPath();
      context.arc(beacon.x,beacon.y,glowRadius,0,Math.PI*2);
      context.fill();
      context.strokeStyle='rgba(145,242,255,'+(.34+pulse*.28+flash*.18)+')';
      context.lineWidth=2;
      context.beginPath();
      context.arc(beacon.x,beacon.y,beacon.radius*(1.35+pulse*.28+flash*.55),0,Math.PI*2);
      context.stroke();
      context.fillStyle='#eaffff';
      context.beginPath();
      context.arc(beacon.x,beacon.y,beacon.radius*(.96+flash*.12),0,Math.PI*2);
      context.fill();
      context.strokeStyle='rgba(255,250,194,.78)';
      context.lineWidth=1.5;
      context.beginPath();
      context.arc(beacon.x,beacon.y,beacon.radius*1.12,0,Math.PI*2);
      context.stroke();
    }
    const particleCount=Math.min(QUALITY[quality]?.particles??world.particles.length,world.particles.length);
    for(let index=0;index<particleCount;index++){
      const particle=world.particles[index];
      context.fillStyle=`rgba(190,250,255,${1-particle.age/particle.life})`;
      context.fillRect(particle.x,particle.y,2,2);
    }
    context.restore();
  }
}
