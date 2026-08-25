const FIXED_STEP=1/60;
const MAX_FRAME_DELTA=.1;
const MOBILE_CELL_SIZE=3.2;
const DESKTOP_CELL_SIZE=4.2;
const MOBILE_MAX_CELLS=48000;
const DESKTOP_MAX_CELLS=90000;
const QUALITY_MAX_CELLS={HIGH:48000,MID:30000,LOW:16000};
const DEFAULT_VISCOSITY=28;
const DEFAULT_STRENGTH=64;
const HEIGHT_SCALE=.38;
const GRADIENT_SCALE=.62;
const ABYSS_STOPS=[
  [0,4,10,16],
  [.28,8,38,52],
  [.52,18,92,108],
  [.74,72,186,188],
  [1,226,248,244]
];

function clamp(value,min,max){
  return Math.max(min,Math.min(max,value));
}

function clampStrength(value){
  return clamp(Number.isFinite(value)?value:0,0,100)/100;
}

function clampByte(value){
  return Math.max(0,Math.min(255,Math.round(value)));
}

/**
 * Pick a deliberately coarse physics grid. The game remains 360x640 logical
 * pixels; this grid is only a visual surface and must never enter scoring.
 */
export function pickRippleGrid(cssW,cssH,quality='MID'){
  const width=Math.max(1,Number(cssW)||1);
  const height=Math.max(1,Number(cssH)||1);
  const cell=width<600?MOBILE_CELL_SIZE:DESKTOP_CELL_SIZE;
  let w=Math.round(width/cell);
  let h=Math.round(height/cell);
  const baseMax=width<600?MOBILE_MAX_CELLS:DESKTOP_MAX_CELLS;
  const maxCells=Math.min(baseMax,QUALITY_MAX_CELLS[quality]??QUALITY_MAX_CELLS.MID);
  const area=Math.max(1,w*h);
  if(area>maxCells){
    const scale=Math.sqrt(maxCells/area);
    w=Math.round(w*scale);
    h=Math.round(h*scale);
  }
  return{
    w:Math.max(64,Math.min(width<600?360:640,w)),
    h:Math.max(64,Math.min(520,h))
  };
}

/** HAMEN's viscosity curve, kept independent from namioshi wave fading. */
export function viscosityToDamping(viscosity=DEFAULT_VISCOSITY){
  const t=clamp(Number.isFinite(viscosity)?viscosity:DEFAULT_VISCOSITY,0,100)/100;
  return .996-t*.11;
}

function palette(mapped,target){
  const value=clamp(mapped,0,1);
  for(let index=1;index<ABYSS_STOPS.length;index++){
    const right=ABYSS_STOPS[index];
    if(value>right[0])continue;
    const left=ABYSS_STOPS[index-1];
    const span=right[0]-left[0]||1;
    const t=clamp((value-left[0])/span,0,1);
    const smooth=t*t*(3-2*t);
    target[0]=left[1]+(right[1]-left[1])*smooth;
    target[1]=left[2]+(right[2]-left[2])*smooth;
    target[2]=left[3]+(right[3]-left[3])*smooth;
    return target;
  }
  const last=ABYSS_STOPS[ABYSS_STOPS.length-1];
  target[0]=last[1];
  target[1]=last[2];
  target[2]=last[3];
  return target;
}

/**
 * A small, render-only height field based on the HAMEN reference algorithm.
 * `current` and `previous` are never consulted by World and therefore cannot
 * alter the game's geometric wave, reflection, score, or input contracts.
 */
export class RippleSurface{
  w=0;
  h=0;
  current=new Float32Array(0);
  previous=new Float32Array(0);
  pixels=new Uint8ClampedArray(0);
  paletteColor=[0,0,0];
  accumulator=0;
  lastTimestamp=null;
  damping=viscosityToDamping();
  seenImpulses=new Set();
  lastTapCount=-1;
  lastSceneKey='';

  resize(cssW,cssH,quality='MID'){
    const grid=pickRippleGrid(cssW,cssH,quality);
    if(grid.w===this.w&&grid.h===this.h)return false;
    this.w=grid.w;
    this.h=grid.h;
    this.current=new Float32Array(this.w*this.h);
    this.previous=new Float32Array(this.w*this.h);
    this.pixels=new Uint8ClampedArray(this.w*this.h*4);
    this.accumulator=0;
    this.lastTimestamp=null;
    this.seenImpulses.clear();
    this.lastTapCount=-1;
    return true;
  }

  clear(){
    this.current.fill(0);
    this.previous.fill(0);
    this.pixels.fill(0);
    this.accumulator=0;
    this.seenImpulses.clear();
  }

  logicalToGrid(x,y,logicalW,logicalH){
    return[
      clamp((Number(x)||0)/Math.max(1,logicalW)*this.w,1,this.w-2),
      clamp((Number(y)||0)/Math.max(1,logicalH)*this.h,1,this.h-2)
    ];
  }

  disturb(cx,cy,amp,radius){
    const r=Math.max(1.2,Number(radius)||1.2);
    const r2=r*r;
    const minX=Math.max(1,Math.floor(cx-r));
    const maxX=Math.min(this.w-2,Math.ceil(cx+r));
    const minY=Math.max(1,Math.floor(cy-r));
    const maxY=Math.min(this.h-2,Math.ceil(cy+r));
    for(let y=minY;y<=maxY;y++){
      const dy=y-cy;
      const row=y*this.w;
      for(let x=minX;x<=maxX;x++){
        const dx=x-cx;
        const d2=dx*dx+dy*dy;
        if(d2>r2)continue;
        const falloff=1-d2/r2;
        this.current[row+x]+=(Number(amp)||0)*falloff*falloff;
      }
    }
  }

  /** HAMEN drop: current only, with a fourth-power edge falloff. */
  drop(x,y,strength=DEFAULT_STRENGTH){
    const t=clampStrength(strength);
    this.disturb(x,y,.55+t*8.2,2.4+t*4.2);
  }

  /** HAMEN drag interpolation, retained for future pointer trajectory use. */
  disturbSegment(x0,y0,x1,y1,strength=DEFAULT_STRENGTH){
    const t=clampStrength(strength);
    const distance=Math.hypot(x1-x0,y1-y0);
    const steps=Math.max(1,Math.ceil(distance*1.85));
    const amp=(.42+t*7.6)/Math.pow(steps,.32);
    const radius=2.15+t*3.6+Math.min(distance*.12,2.8);
    for(let index=0;index<=steps;index++){
      const u=index/steps;
      this.disturb(x0+(x1-x0)*u,y0+(y1-y0)*u,amp,radius);
    }
  }

  /** One k=0.5 wave-equation step; edge cells stay Dirichlet zero. */
  step(){
    const{w,h}=this;
    const current=this.current;
    const previous=this.previous;
    for(let y=1;y<h-1;y++){
      const row=y*w;
      for(let x=1;x<w-1;x++){
        const index=row+x;
        previous[index]=((current[index-1]+current[index+1]+current[index-w]+current[index+w])*.5-previous[index])*this.damping;
      }
    }
    this.current=previous;
    this.previous=current;
  }

  advance(timestamp){
    const now=Number.isFinite(timestamp)?timestamp:0;
    if(this.lastTimestamp===null){
      this.lastTimestamp=now;
      return 0;
    }
    const delta=Math.min(MAX_FRAME_DELTA,Math.max(0,(now-this.lastTimestamp)/1000));
    this.lastTimestamp=now;
    this.accumulator+=delta;
    let steps=0;
    while(this.accumulator>=FIXED_STEP){
      this.step();
      this.accumulator-=FIXED_STEP;
      steps++;
    }
    return steps;
  }

  /**
   * Convert World events into visual impulses. Root taps use the exact HAMEN
   * drop; reflection contacts and reflection-tap bonuses use smaller drops.
   * Every key is consumed once so an existing wave cannot repeatedly inject
   * energy on every render frame.
   */
  syncWorld(world){
    const sceneKey=`${world?.mode??''}:${world?.layoutId??''}:${world?.roundSequence??''}`;
    const taps=Number.isFinite(world?.taps)?world.taps:0;
    if(this.lastTapCount>taps||this.lastSceneKey&&this.lastSceneKey!==sceneKey){
      this.clear();
    }
    this.lastSceneKey=sceneKey;
    const logicalW=Math.max(1,world?.w??360);
    const logicalH=Math.max(1,world?.h??640);
    for(const wave of world?.waves??[]){
      const depth=wave.reflectionDepth??wave.reflections??0;
      if(depth!==0)continue;
      const key=`root:${wave.rootTapId??wave.id}`;
      if(this.seenImpulses.has(key))continue;
      const[x,y]=this.logicalToGrid(wave.originX,wave.originY,logicalW,logicalH);
      this.drop(x,y,DEFAULT_STRENGTH);
      this.seenImpulses.add(key);
    }
    for(const effect of world?.reflectionEffects??[]){
      // The renderer may observe an effect after a long frame or a Safari
      // browser-chrome resize.  The effect id is the once-only guard, so a
      // live effect must still be injected when it is first observed after
      // the short event window has elapsed.
      if(!Number.isFinite(effect.age)||effect.age<0||effect.age>effect.life)continue;
      const effectKey=effect.id??`${effect.kind}:${Math.round(effect.x*10)}:${Math.round(effect.y*10)}`;
      const key=`reflect:${effectKey}`;
      if(this.seenImpulses.has(key))continue;
      const[x,y]=this.logicalToGrid(effect.x,effect.y,logicalW,logicalH);
      this.drop(x,y,42);
      this.seenImpulses.add(key);
    }
    for(const award of world?.reflectionTapAwards?.values?.()??[]){
      const key=`tap-bonus:${award.rootTapId}`;
      if(this.seenImpulses.has(key))continue;
      const[x,y]=this.logicalToGrid(award.x,award.y,logicalW,logicalH);
      this.drop(x,y,56);
      this.seenImpulses.add(key);
    }
    this.lastTapCount=taps;
  }

  /** Paint transparent lit water highlights for Canvas and WebGL texture use. */
  paint(){
    const{w,h,current,pixels}=this;
    const lightX=-.42;
    const lightY=-.58;
    const lightZ=.7;
    const halfZ=lightZ+1;
    const halfInverse=1/Math.sqrt(lightX*lightX+lightY*lightY+halfZ*halfZ);
    for(let y=1;y<h-1;y++){
      const row=y*w;
      for(let x=1;x<w-1;x++){
        const index=row+x;
        const z=current[index];
        const dx=(current[index-1]-current[index+1])*GRADIENT_SCALE;
        const dy=(current[index-w]-current[index+w])*GRADIENT_SCALE;
        const inverse=1/Math.sqrt(dx*dx+dy*dy+1);
        const nx=dx*inverse;
        const ny=dy*inverse;
        const nz=inverse;
        const diffuse=Math.max(0,nx*lightX+ny*lightY+nz*lightZ);
        const specular=Math.pow(Math.max(0,nx*lightX*halfInverse+ny*lightY*halfInverse+nz*halfZ*halfInverse),42);
        const crest=Math.min(1,Math.hypot(dx,dy)*1.4);
        const mapped=.5+.5*Math.tanh(z*HEIGHT_SCALE+crest*.22);
        const color=palette(mapped,this.paletteColor);
        const activity=clamp(Math.abs(z)*.08+crest*1.8+specular*1.1,0,1);
        const alpha=activity<=.001?0:clampByte((18+activity*210)*(.28+.72*diffuse));
        const offset=index*4;
        pixels[offset]=clampByte(color[0]*(.28+.72*diffuse)+specular*235);
        pixels[offset+1]=clampByte(color[1]*(.28+.72*diffuse)+specular*235);
        pixels[offset+2]=clampByte(color[2]*(.28+.72*diffuse)+specular*240);
        pixels[offset+3]=alpha;
      }
    }
    // Copy the nearest interior pixel for a seamless visual edge. The
    // physical boundary values themselves remain untouched at zero.
    for(let x=0;x<w;x++){
      this.copyPixel((w+Math.min(w-1,Math.max(1,x)))*4,x*4);
      this.copyPixel(((h-2)*w+Math.min(w-1,Math.max(1,x)))*4,((h-1)*w+x)*4);
    }
    for(let y=0;y<h;y++){
      this.copyPixel((y*w+1)*4,(y*w)*4);
      this.copyPixel((y*w+w-2)*4,(y*w+w-1)*4);
    }
    return this.pixels;
  }

  copyPixel(source,target){
    this.pixels[target]=this.pixels[source];
    this.pixels[target+1]=this.pixels[source+1];
    this.pixels[target+2]=this.pixels[source+2];
    this.pixels[target+3]=this.pixels[source+3];
  }
}

export const RIPPLE_SURFACE_CONSTANTS=Object.freeze({
  fixedStep:FIXED_STEP,
  maxFrameDelta:MAX_FRAME_DELTA,
  damping:viscosityToDamping(),
  mobileCellSize:MOBILE_CELL_SIZE,
  mobileMaxCells:MOBILE_MAX_CELLS,
  gradientScale:GRADIENT_SCALE,
  specularPower:42
});
