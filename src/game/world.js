import {
  BEACON_SHAKE_DAMPING,
  BEACON_SHAKE_IMPULSE,
  BEACON_SHAKE_MAX_OFFSET,
  BEACON_SHAKE_MAX_SPEED,
  BEACON_SHAKE_SPRING,
  GLASS_REFLECTION_ENERGY,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  MAX_REFLECTIONS,
  MAX_TAPS,
  MAX_WAVES,
  PLAY_SECONDS,
  WALL_REFLECTION_ENERGY,
  WAVE_LIFETIME
} from '../config.js';
import {judgementFromPrecision} from './judgement.js';
import {createOfficialLayout,createPracticeLayout} from './layouts.js';
import {GAME_MODE,isOfficialMode,normalizeGameMode} from './modes.js';
import {createReflectionPath,traceReflectionPath} from './reflection-path.js';
import {candidateScore,scoreCategory} from './scoring.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const clampVector=(x,y,maximum)=>{
  const length=Math.hypot(x,y);
  if(length<=maximum||length===0)return[x,y];
  const scale=maximum/length;
  return[x*scale,y*scale];
};
const OFFICIAL_RANDOM_SEED=0xfc71e804;
const LIFETIME_EPSILON=1e-9;

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
    edges=[],
    glass=[],
    radius=1,
    width=9,
    speed=165,
    age=0,
    lifetime=WAVE_LIFETIME,
    energy=1,
    reflectedBy=null,
    reflectionPath=null,
    emittedSurfaces=[],
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
      reflectionPath,
      hit:new Set(),
      edges:new Set(edges),
      glass:new Set(glass),
      surfaceHistory:new Set(surfaceHistory),
      emittedSurfaces:new Set(emittedSurfaces),
      hitCandidates:new Map()
    };
    this.waves.push(wave);
    return wave;
  }

  prepareBeacon(beacon){
    if(!Number.isFinite(beacon.baseX))beacon.baseX=beacon.x;
    if(!Number.isFinite(beacon.baseY))beacon.baseY=beacon.y;
    if(!Number.isFinite(beacon.shakeX))beacon.shakeX=0;
    if(!Number.isFinite(beacon.shakeY))beacon.shakeY=0;
    if(!Number.isFinite(beacon.shakeVx))beacon.shakeVx=0;
    if(!Number.isFinite(beacon.shakeVy))beacon.shakeVy=0;
  }

  advanceBeacon(beacon,dt){
    beacon.flash=Math.max(0,beacon.flash-dt*3);
    beacon.baseX=clamp(beacon.baseX+beacon.vx*dt,beacon.radius,this.w-beacon.radius);
    beacon.baseY=clamp(beacon.baseY+beacon.vy*dt,70,this.h-beacon.radius);
    if(beacon.baseX<=beacon.radius||beacon.baseX>=this.w-beacon.radius)beacon.vx*=-1;
    if(beacon.baseY<=70||beacon.baseY>=this.h-beacon.radius)beacon.vy*=-1;
    const damping=Math.exp(-BEACON_SHAKE_DAMPING*dt);
    beacon.shakeVx=(beacon.shakeVx-BEACON_SHAKE_SPRING*beacon.shakeX*dt)*damping;
    beacon.shakeVy=(beacon.shakeVy-BEACON_SHAKE_SPRING*beacon.shakeY*dt)*damping;
    [beacon.shakeVx,beacon.shakeVy]=clampVector(beacon.shakeVx,beacon.shakeVy,BEACON_SHAKE_MAX_SPEED);
    beacon.shakeX+=beacon.shakeVx*dt;
    beacon.shakeY+=beacon.shakeVy*dt;
    [beacon.shakeX,beacon.shakeY]=clampVector(beacon.shakeX,beacon.shakeY,BEACON_SHAKE_MAX_OFFSET);
    beacon.x=clamp(beacon.baseX+beacon.shakeX,beacon.radius,this.w-beacon.radius);
    beacon.y=clamp(beacon.baseY+beacon.shakeY,70,this.h-beacon.radius);
  }

  scoreWave(wave,beaconTargets){
    for(let beaconIndex=0;beaconIndex<this.beacons.length;beaconIndex++){
      const beacon=this.beacons[beaconIndex];
      const target=beaconTargets[beaconIndex];
      if(wave.hit.has(beacon.id))continue;
      const distance=Math.hypot(wave.originX-target.x,wave.originY-target.y);
      const error=Math.abs(distance-wave.radius);
      const band=wave.width+beacon.radius*.35;
      if(error>band)continue;
      const pathTrace=this.traceWavePath(wave,target.x,target.y);
      if(!pathTrace.valid)continue;
      wave.hit.add(beacon.id);
      const precision=Math.max(0,1-error/band);
      const category=scoreCategory(wave);
      const candidate=candidateScore(category,precision);
      const hitKey=`${wave.rootTapId}:${beacon.id}`;
      const previous=this.bestHits.get(hitKey);
      const pathIntersections=pathTrace.intersections.map(intersection=>({...intersection}));
      wave.hitCandidates.set(beacon.id,{category,score:candidate,error,waveId:wave.id,reflectionDepth:wave.reflections,pathIntersections});
      if(previous&&candidate<=previous.score)continue;
      if(previous)this.scoreBreakdown[previous.category]-=previous.score;
      this.scoreBreakdown[category]+=candidate;
      this.bestHits.set(hitKey,{category,score:candidate,error,waveId:wave.id,reflectionDepth:wave.reflections,pathIntersections});
      const points=candidate-(previous?.score??0);
      this.score+=points;
      beacon.flash=1;
      beacon.shakeVx+=(target.x-wave.originX)/(distance||1)*BEACON_SHAKE_IMPULSE;
      beacon.shakeVy+=(target.y-wave.originY)/(distance||1)*BEACON_SHAKE_IMPULSE;
      [beacon.shakeVx,beacon.shakeVy]=clampVector(beacon.shakeVx,beacon.shakeVy,BEACON_SHAKE_MAX_SPEED);
      this.burst(target.x,target.y);
      this.onHit({
        beaconId:beacon.id,
        waveId:wave.id,
        judgement:judgementFromPrecision(precision),
        precision,
        points,
        candidateScore:candidate,
        category,
        kind:wave.kind,
        reflections:wave.reflections,
        pathIntersections
      });
    }
  }

  step(dt,{countTime=true}={}){
    if(countTime)this.time-=dt;
    const beaconStarts=this.beacons.map(beacon=>{
      this.prepareBeacon(beacon);
      return{...beacon};
    });
    for(const beacon of this.beacons){
      this.advanceBeacon(beacon,dt);
    }

    this.waves=this.waves.filter(wave=>wave.lifetime-wave.age>LIFETIME_EPSILON);
    const wavesAtStepStart=[...this.waves].reverse();
    for(const wave of wavesAtStepStart){
      const remainingLifetime=Math.max(0,wave.lifetime-wave.age);
      const activeDt=Math.min(dt,remainingLifetime);
      const beaconTargets=activeDt<dt-LIFETIME_EPSILON
        ?beaconStarts.map(start=>{
          const sampled={...start};
          this.advanceBeacon(sampled,activeDt);
          return sampled;
        })
        :this.beacons;
      const previousRadius=wave.radius;
      wave.previousRadius=previousRadius;
      wave.age=Math.min(wave.lifetime,wave.age+activeDt);
      wave.radius+=wave.speed*activeDt;
      const propagationQueue=[{wave,startRadius:previousRadius,includeActiveContacts:false}];
      for(let queueIndex=0;queueIndex<propagationQueue.length;queueIndex++){
        const propagation=propagationQueue[queueIndex];
        const children=this.reflect(propagation.wave,propagation.startRadius,{
          includeActiveContacts:propagation.includeActiveContacts
        });
        this.scoreWave(propagation.wave,beaconTargets);
        for(const child of children){
          propagationQueue.push({wave:child,startRadius:child.previousRadius,includeActiveContacts:true});
        }
      }
    }
    this.waves=this.waves.filter(wave=>wave.age<wave.lifetime-LIFETIME_EPSILON);

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

  traceWavePath(wave,x,y){
    const depth=Math.max(0,wave.reflectionDepth??wave.reflections??0);
    if(depth>0&&!wave.reflectionPath){
      return{valid:false,intersections:[],reason:'missing-reflection-path'};
    }
    const trace=traceReflectionPath(wave.originX,wave.originY,x,y,wave.reflectionPath);
    if(trace.valid&&trace.intersections.length!==depth){
      return{valid:false,intersections:trace.intersections,reason:'reflection-depth-mismatch'};
    }
    return trace;
  }

  waveCanReach(wave,x,y){
    return this.traceWavePath(wave,x,y).valid;
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
    contactRadius,
    activationRadius=contactRadius,
    normalX,
    normalY,
    surfaceX1,
    surfaceY1,
    surfaceX2,
    surfaceY2,
    energyMultiplier
  }){
    const distanceAfterContact=Math.max(0,wave.radius-activationRadius);
    const contactAge=wave.speed>0
      ?Math.max(0,wave.age-distanceAfterContact/wave.speed)
      :wave.age;
    if(
      this.waves.length>=MAX_WAVES||
      wave.lifetime-contactAge<=LIFETIME_EPSILON||
      wave.surfaceHistory.has(surfaceKey)||
      wave.emittedSurfaces.has(surfaceKey)
    )return null;
    const surfaceHistory=new Set(wave.surfaceHistory);
    surfaceHistory.add(surfaceKey);
    const edges=new Set(wave.edges);
    const glass=new Set(wave.glass);
    if(kind==='wall')edges.add(surfaceId);
    else glass.add(surfaceId);
    const depth=(wave.reflectionDepth??wave.reflections??0)+1;
    const reflectionPath=createReflectionPath({
      previous:wave.reflectionPath,
      surfaceKey,
      surfaceKind:kind,
      x1:surfaceX1,
      y1:surfaceY1,
      x2:surfaceX2,
      y2:surfaceY2,
      parentOriginX:wave.originX,
      parentOriginY:wave.originY,
      childOriginX:originX,
      childOriginY:originY
    });
    const reflected=this.addWave(originX,originY,depth,kind,{
      rootTapId:wave.rootTapId,
      parentWaveId:wave.waveId??wave.id,
      surfaceHistory,
      edges,
      glass,
      radius:wave.radius,
      width:wave.width,
      speed:wave.speed,
      age:wave.age,
      lifetime:wave.lifetime,
      energy:wave.energy*energyMultiplier,
      reflectedBy:surfaceKey,
      reflectionPath,
      previousRadius:activationRadius
    });
    if(!reflected)return null;
    wave.emittedSurfaces.add(surfaceKey);
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
      contactAge,
      contactRadius,
      activationRadius,
      energy:reflected.energy
    });
    return reflected;
  }

  reflect(wave,previousRadius=null,{includeActiveContacts=false}={}){
    const depth=wave.reflectionDepth??wave.reflections??0;
    if(depth>=MAX_REFLECTIONS)return[];
    const reflectedWaves=[];
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
      const vertical=side.side==='l'||side.side==='r';
      const segmentLength=vertical?this.h:this.w;
      const contactAlong=clamp(side.along,0,segmentLength);
      const withinSegment=side.along>=0&&side.along<=segmentLength;
      const contactX=vertical?side.contactX:contactAlong;
      const contactY=vertical?contactAlong:side.contactY;
      const distance=withinSegment
        ?side.distance
        :Math.hypot(wave.originX-contactX,wave.originY-contactY);
      const alreadyActive=includeActiveContacts&&distance>1e-7&&distance<startRadius-1e-7&&distance<=endRadius+1e-7;
      if(wave.surfaceHistory.has(surfaceKey)||wave.emittedSurfaces.has(surfaceKey)||(!alreadyActive&&!this.crossedRadius(startRadius,endRadius,distance)))continue;
      const reflected=this.createReflection(wave,{
        kind:'wall',
        surfaceKey,
        surfaceId:side.side,
        originX:side.originX,
        originY:side.originY,
        contactX,
        contactY,
        contactRadius:distance,
        activationRadius:alreadyActive?startRadius:distance,
        normalX:side.normalX,
        normalY:side.normalY,
        surfaceX1:vertical?side.contactX:0,
        surfaceY1:vertical?0:side.contactY,
        surfaceX2:vertical?side.contactX:this.w,
        surfaceY2:vertical?this.h:side.contactY,
        energyMultiplier:WALL_REFLECTION_ENERGY
      });
      if(reflected)reflectedWaves.push(reflected);
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
      let distance;
      const rawNormalX=Number.isFinite(piece.nx)?piece.nx:-vy/segmentLength;
      const rawNormalY=Number.isFinite(piece.ny)?piece.ny:vx/segmentLength;
      const normalLength=Math.hypot(rawNormalX,rawNormalY)||1;
      let normalX=rawNormalX/normalLength;
      let normalY=rawNormalY/normalLength;
      if(position>=0&&position<=1){
        pointX=piece.x1+vx*position;
        pointY=piece.y1+vy*position;
        distance=Math.abs((wave.originX-pointX)*normalX+(wave.originY-pointY)*normalY);
      }else{
        const endpoint=position<0?[piece.x1,piece.y1]:[piece.x2,piece.y2];
        pointX=endpoint[0];
        pointY=endpoint[1];
        const dx=wave.originX-pointX;
        const dy=wave.originY-pointY;
        distance=Math.hypot(dx,dy);
        if(distance<=1e-7)continue;
      }
      let perpendicular=(wave.originX-pointX)*normalX+(wave.originY-pointY)*normalY;
      if(Math.abs(perpendicular)<=1e-7)continue;
      if(perpendicular<0){
        normalX*=-1;
        normalY*=-1;
        perpendicular*=-1;
      }
      const surfaceKey=`glass:${piece.id}`;
      const alreadyActive=includeActiveContacts&&distance>1e-7&&distance<startRadius-1e-7&&distance<=endRadius+1e-7;
      if(wave.surfaceHistory.has(surfaceKey)||wave.emittedSurfaces.has(surfaceKey)||(!alreadyActive&&!this.crossedRadius(startRadius,endRadius,distance)))continue;
      const reflected=this.createReflection(wave,{
        kind:'glass',
        surfaceKey,
        surfaceId:piece.id,
        originX:wave.originX-2*perpendicular*normalX,
        originY:wave.originY-2*perpendicular*normalY,
        contactX:pointX,
        contactY:pointY,
        contactRadius:distance,
        activationRadius:alreadyActive?startRadius:distance,
        normalX,
        normalY,
        surfaceX1:piece.x1,
        surfaceY1:piece.y1,
        surfaceX2:piece.x2,
        surfaceY2:piece.y2,
        energyMultiplier:GLASS_REFLECTION_ENERGY
      });
      if(reflected)reflectedWaves.push(reflected);
    }
    return reflectedWaves;
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
