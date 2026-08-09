import {
  GLASS_REFLECTION_ENERGY,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  MAX_REFLECTIONS,
  MAX_TAPS,
  MAX_WAVES,
  PLAY_SECONDS,
  REFLECTION_SURFACE_CLEARANCE,
  WALL_REFLECTION_ENERGY,
  WAVE_LIFETIME
} from '../config.js';
import {judgementFromPrecision} from './judgement.js';
import {createOfficialLayout,createPracticeLayout} from './layouts.js';
import {GAME_MODE,isOfficialMode,normalizeGameMode} from './modes.js';
import {candidateScore,scoreCategory} from './scoring.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const OFFICIAL_RANDOM_SEED=0xfc71e804;

function seededRandom(seed){
  let state=seed>>>0;
  return()=>{
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    return state/0x100000000;
  };
}

export class World{
  w=LOGICAL_WIDTH;
  h=LOGICAL_HEIGHT;
  mode=GAME_MODE.OFFICIAL;
  layoutId=null;
  ruleVersion=null;
  layoutFingerprint=null;
  rankingCandidate=true;
  score=0;
  scoreBreakdown={direct:0,wall:0,glass:0,double:0};
  taps=0;
  time=PLAY_SECONDS;
  waves=[];
  beacons=[];
  glass=[];
  particles=[];
  reflectionEffects=[];
  bestHits=new Map();
  waveSequence=1;
  onHit=()=>{};
  onReflect=()=>{};

  constructor({random=Math.random}={}){
    if(typeof random!=='function')throw new TypeError('random source must be a function');
    this.practiceRandomSource=random;
    this.random=random;
  }

  reset({mode=GAME_MODE.OFFICIAL,random=this.practiceRandomSource}={}){
    this.w=LOGICAL_WIDTH;
    this.h=LOGICAL_HEIGHT;
    this.mode=normalizeGameMode(mode);
    const official=isOfficialMode(this.mode);
    if(!official){
      if(typeof random!=='function')throw new TypeError('practice random source must be a function');
      this.practiceRandomSource=random;
    }
    this.random=official?seededRandom(OFFICIAL_RANDOM_SEED):this.practiceRandomSource;
    const layout=official?createOfficialLayout():createPracticeLayout(this.random);
    this.layoutId=layout.id;
    this.ruleVersion=layout.ruleVersion;
    this.layoutFingerprint=layout.fingerprint;
    this.rankingCandidate=official;
    this.score=0;
    this.scoreBreakdown={direct:0,wall:0,glass:0,double:0};
    this.taps=0;
    this.time=PLAY_SECONDS;
    this.waves=[];
    this.particles=[];
    this.reflectionEffects=[];
    this.bestHits=new Map();
    this.waveSequence=1;
    this.beacons=layout.beacons;
    this.glass=layout.glass;
  }

  tap(x,y){
    if(this.taps>=MAX_TAPS)return false;
    const tapNumber=this.taps+1;
    const wave=this.addWave(x,y,0,'direct',{rootTapId:`tap-${tapNumber}`});
    if(!wave)return false;
    this.taps=tapNumber;
    return true;
  }

  addWave(x,y,reflections,kind,{
    rootTapId=null,
    parentWaveId=null,
    surfaceHistory=[],
    surfaceCooldowns=new Map(),
    edges=[],
    glass=[],
    radius=1,
    width=9,
    speed=165,
    age=0,
    lifetime=WAVE_LIFETIME,
    energy=1,
    reflectedBy=null,
    previousRadius=radius
  }={}){
    if(this.waves.length>=MAX_WAVES)return null;
    const id=this.waveSequence++;
    const reflectionDepth=Math.max(0,Number.isFinite(reflections)?reflections:0);
    const wave={
      id,
      waveId:id,
      rootTapId:rootTapId??`manual-${id}`,
      parentWaveId,
      originX:x,
      originY:y,
      previousRadius,
      radius,
      width,
      speed,
      age,
      lifetime,
      life:lifetime,
      energy,
      reflections:reflectionDepth,
      reflectionDepth,
      kind,
      reflectedBy,
      hit:new Set(),
      edges:new Set(edges),
      glass:new Set(glass),
      surfaceHistory:new Set(surfaceHistory),
      surfaceCooldowns:new Map(surfaceCooldowns),
      hitCandidates:new Map()
    };
    this.waves.push(wave);
    return wave;
  }

  step(dt,{countTime=true}={}){
    if(countTime)this.time-=dt;
    for(const beacon of this.beacons){
      beacon.flash=Math.max(0,beacon.flash-dt*3);
      beacon.x=clamp(beacon.x+beacon.vx*dt,beacon.radius,this.w-beacon.radius);
      beacon.y=clamp(beacon.y+beacon.vy*dt,70,this.h-beacon.radius);
      if(beacon.x<=beacon.radius||beacon.x>=this.w-beacon.radius)beacon.vx*=-1;
      if(beacon.y<=70||beacon.y>=this.h-beacon.radius)beacon.vy*=-1;
    }

    for(let index=this.waves.length-1;index>=0;index--){
      const wave=this.waves[index];
      const previousRadius=wave.radius;
      wave.previousRadius=previousRadius;
      wave.age+=dt;
      wave.radius+=wave.speed*dt;
      this.reflect(wave,previousRadius);
      for(const beacon of this.beacons){
        if(wave.hit.has(beacon.id))continue;
        const distance=Math.hypot(wave.originX-beacon.x,wave.originY-beacon.y);
        const error=Math.abs(distance-wave.radius);
        const band=wave.width+beacon.radius*.35;
        if(error<=band){
          wave.hit.add(beacon.id);
          const precision=Math.max(0,1-error/band);
          const category=scoreCategory(wave);
          const candidate=candidateScore(category,precision);
          const hitKey=`${wave.rootTapId}:${beacon.id}`;
          const previous=this.bestHits.get(hitKey);
          wave.hitCandidates.set(beacon.id,{category,score:candidate,error,waveId:wave.id,reflectionDepth:wave.reflections});
          if(!previous||candidate>previous.score){
            if(previous)this.scoreBreakdown[previous.category]-=previous.score;
            this.scoreBreakdown[category]+=candidate;
            this.bestHits.set(hitKey,{category,score:candidate,error,waveId:wave.id,reflectionDepth:wave.reflections});
            const points=candidate-(previous?.score??0);
            this.score+=points;
            beacon.flash=1;
            beacon.vx+=(beacon.x-wave.originX)/(distance||1)*22;
            beacon.vy+=(beacon.y-wave.originY)/(distance||1)*22;
            this.burst(beacon.x,beacon.y);
            this.onHit({
              judgement:judgementFromPrecision(precision),
              precision,
              points,
              candidateScore:candidate,
              category,
              kind:wave.kind,
              reflections:wave.reflections
            });
          }
        }
      }
      if(wave.age>wave.lifetime)this.waves.splice(index,1);
    }

    for(let index=this.particles.length-1;index>=0;index--){
      const particle=this.particles[index];
      particle.age+=dt;
      particle.x+=particle.vx*dt;
      particle.y+=particle.vy*dt;
      if(particle.age>particle.life)this.particles.splice(index,1);
    }

    for(let index=this.reflectionEffects.length-1;index>=0;index--){
      const effect=this.reflectionEffects[index];
      effect.age+=dt;
      if(effect.age>effect.life)this.reflectionEffects.splice(index,1);
    }
  }

  surfaceIsCooling(wave,surfaceKey){
    const contactRadius=wave.surfaceCooldowns?.get(surfaceKey);
    return Number.isFinite(contactRadius)&&wave.radius-contactRadius<REFLECTION_SURFACE_CLEARANCE;
  }

  crossedRadius(startRadius,endRadius,targetRadius){
    const epsilon=1e-7;
    return targetRadius>epsilon&&startRadius-epsilon<=targetRadius&&endRadius+epsilon>=targetRadius;
  }

  createReflection(wave,{
    kind,
    surfaceKey,
    surfaceId,
    originX,
    originY,
    contactX,
    contactY,
    normalX,
    normalY,
    energyMultiplier
  }){
    if(this.waves.length>=MAX_WAVES)return null;
    const surfaceHistory=new Set(wave.surfaceHistory);
    surfaceHistory.add(surfaceKey);
    const surfaceCooldowns=new Map(wave.surfaceCooldowns);
    surfaceCooldowns.set(surfaceKey,wave.radius);
    const edges=new Set(wave.edges);
    const glass=new Set(wave.glass);
    if(kind==='wall')edges.add(surfaceId);
    else glass.add(surfaceId);
    const depth=(wave.reflectionDepth??wave.reflections??0)+1;
    const reflected=this.addWave(originX,originY,depth,kind,{
      rootTapId:wave.rootTapId,
      parentWaveId:wave.waveId??wave.id,
      surfaceHistory,
      surfaceCooldowns,
      edges,
      glass,
      radius:wave.radius,
      width:wave.width,
      speed:wave.speed,
      age:wave.age,
      lifetime:wave.lifetime,
      energy:wave.energy*energyMultiplier,
      reflectedBy:surfaceKey
    });
    if(!reflected)return null;
    wave.surfaceHistory.add(surfaceKey);
    wave.surfaceCooldowns.set(surfaceKey,wave.radius);
    if(kind==='wall')wave.edges.add(surfaceId);
    else wave.glass.add(surfaceId);
    this.addReflectionEffect(contactX,contactY,normalX,normalY,kind);
    this.onReflect({
      kind,
      reflections:reflected.reflections,
      reflectionDepth:reflected.reflectionDepth,
      waveId:reflected.id,
      parentWaveId:wave.id,
      surfaceKey,
      x:contactX,
      y:contactY,
      normalX,
      normalY,
      energy:reflected.energy
    });
    return reflected;
  }

  reflect(wave,previousRadius=null){
    const depth=wave.reflectionDepth??wave.reflections??0;
    if(depth>=MAX_REFLECTIONS)return;
    const startRadius=Number.isFinite(previousRadius)
      ?previousRadius
      :Number.isFinite(wave.previousRadius)
        ?wave.previousRadius
        :Math.max(0,wave.radius-(wave.speed||0)/60);
    const endRadius=wave.radius;
    const sides=[
      {side:'l',distance:Math.abs(wave.originX),along:wave.originY,originX:-wave.originX,originY:wave.originY,normalX:1,normalY:0,contactX:0,contactY:wave.originY},
      {side:'r',distance:Math.abs(this.w-wave.originX),along:wave.originY,originX:2*this.w-wave.originX,originY:wave.originY,normalX:-1,normalY:0,contactX:this.w,contactY:wave.originY},
      {side:'t',distance:Math.abs(wave.originY),along:wave.originX,originX:wave.originX,originY:-wave.originY,normalX:0,normalY:1,contactX:wave.originX,contactY:0},
      {side:'b',distance:Math.abs(this.h-wave.originY),along:wave.originX,originX:wave.originX,originY:2*this.h-wave.originY,normalX:0,normalY:-1,contactX:wave.originX,contactY:this.h}
    ];
    for(const side of sides){
      const surfaceKey=`wall:${side.side}`;
      const withinSegment=side.along>=0&&side.along<=((side.side==='l'||side.side==='r')?this.h:this.w);
      if(!withinSegment||!this.crossedRadius(startRadius,endRadius,side.distance)||this.surfaceIsCooling(wave,surfaceKey))continue;
      this.createReflection(wave,{
        kind:'wall',
        surfaceKey,
        surfaceId:side.side,
        originX:side.originX,
        originY:side.originY,
        contactX:side.contactX,
        contactY:side.contactY,
        normalX:side.normalX,
        normalY:side.normalY,
        energyMultiplier:WALL_REFLECTION_ENERGY
      });
    }

    for(const piece of this.glass){
      const vx=piece.x2-piece.x1;
      const vy=piece.y2-piece.y1;
      const lengthSquared=vx*vx+vy*vy;
      if(lengthSquared<=0)continue;
      const segmentLength=Math.sqrt(lengthSquared);
      const position=((wave.originX-piece.x1)*vx+(wave.originY-piece.y1)*vy)/lengthSquared;
      let pointX;
      let pointY;
      let normalX;
      let normalY;
      let distance;
      if(position>=0&&position<=1){
        pointX=piece.x1+vx*position;
        pointY=piece.y1+vy*position;
        const rawNormalX=Number.isFinite(piece.nx)?piece.nx:-vy/segmentLength;
        const rawNormalY=Number.isFinite(piece.ny)?piece.ny:vx/segmentLength;
        const normalLength=Math.hypot(rawNormalX,rawNormalY)||1;
        normalX=rawNormalX/normalLength;
        normalY=rawNormalY/normalLength;
        distance=Math.abs((wave.originX-pointX)*normalX+(wave.originY-pointY)*normalY);
      }else{
        const endpoint=position<0?[piece.x1,piece.y1]:[piece.x2,piece.y2];
        pointX=endpoint[0];
        pointY=endpoint[1];
        const dx=wave.originX-pointX;
        const dy=wave.originY-pointY;
        distance=Math.hypot(dx,dy);
        if(distance<=1e-7)continue;
        normalX=dx/distance;
        normalY=dy/distance;
      }
      const perpendicular=(wave.originX-pointX)*normalX+(wave.originY-pointY)*normalY;
      const surfaceKey=`glass:${piece.id}`;
      if(!this.crossedRadius(startRadius,endRadius,distance)||this.surfaceIsCooling(wave,surfaceKey))continue;
      this.createReflection(wave,{
        kind:'glass',
        surfaceKey,
        surfaceId:piece.id,
        originX:wave.originX-2*perpendicular*normalX,
        originY:wave.originY-2*perpendicular*normalY,
        contactX:pointX,
        contactY:pointY,
        normalX,
        normalY,
        energyMultiplier:GLASS_REFLECTION_ENERGY
      });
    }
  }

  burst(x,y){
    for(let index=0;index<14;index++){
      this.particles.push({
        x,
        y,
        vx:-70+this.random()*140,
        vy:-70+this.random()*140,
        age:0,
        life:.3+this.random()*.5
      });
    }
    while(this.particles.length>90)this.particles.shift();
  }

  addReflectionEffect(x,y,normalX,normalY,kind){
    this.reflectionEffects.push({x,y,normalX,normalY,kind,age:0,life:.42});
    while(this.reflectionEffects.length>24)this.reflectionEffects.shift();
  }

  getScoreBreakdown(){
    return{...this.scoreBreakdown};
  }
}
