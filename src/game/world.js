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
  REFLECTION_TAP_RANGE,
  REFLECTED_WAVE_LIFETIME,
  WALL_REFLECTION_ENERGY,
  WAVE_SPEED,
  WAVE_LIFETIME
} from '../config.js';
import {judgementFromPrecision} from './judgement.js';
import {createOfficialLayout,createPracticeLayout} from './layouts.js';
import {GAME_MODE,isOfficialMode,normalizeGameMode} from './modes.js';
import {createReflectionPath,traceReflectionPath} from './reflection-path.js';
import {candidateScore,reflectionTapScore,scoreCategory,scoreRouteKey} from './scoring.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const clampVector=(x,y,maximum)=>{
  const length=Math.hypot(x,y);
  if(length<=maximum||length===0)return[x,y];
  const scale=maximum/length;
  return[x*scale,y*scale];
};
const OFFICIAL_RANDOM_SEED=0xfc71e804;
const LIFETIME_EPSILON=1e-9;
const WAVE_FADE_LIFETIME=.18;
const SCORE_CATEGORIES=Object.freeze(['direct','wall','glass','double']);

function emptyCategoryCounts(){
  return{direct:0,wall:0,glass:0,double:0};
}

function countCategory(counts,candidate){
  if(SCORE_CATEGORIES.includes(candidate.category))counts[candidate.category]++;
}

function isBetterCandidate(candidate,previous){
  if(!previous)return true;
  if(candidate.score!==previous.score)return candidate.score>previous.score;
  if(candidate.reflectionDepth!==previous.reflectionDepth)return candidate.reflectionDepth>previous.reflectionDepth;
  if(candidate.error!==previous.error)return candidate.error<previous.error;
  return candidate.waveId<previous.waveId;
}

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
  layoutVersion=null;
  ruleVersion=null;
  layoutFingerprint=null;
  rankingCandidate=true;
  score=0;
  scoreBreakdown={direct:0,wall:0,glass:0,double:0};
  taps=0;
  reflectionCount=0;
  time=PLAY_SECONDS;
  waves=[];
  waveFades=[];
  beacons=[];
  glass=[];
  particles=[];
  reflectionEffects=[];
  bestHits=new Map();
  routeBestHits=new Map();
  reflectionTapAwards=new Map();
  finalizedRoots=new Set();
  waveSequence=1;
  reflectionEffectSequence=1;
  roundSequence=0;
  onHit=()=>{};
  onRoute=()=>{};
  onReflect=()=>{};
  onReflectionTap=()=>{};

  constructor({random=Math.random}={}){
    if(typeof random!=='function')throw new TypeError('random source must be a function');
    this.practiceRandomSource=random;
    this.random=random;
  }

  reset({mode=GAME_MODE.OFFICIAL,random=this.practiceRandomSource}={}){
    this.roundSequence++;
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
    this.layoutVersion=layout.layoutVersion??null;
    this.ruleVersion=layout.ruleVersion;
    this.layoutFingerprint=layout.fingerprint;
    this.rankingCandidate=official;
    this.score=0;
    this.scoreBreakdown={direct:0,wall:0,glass:0,double:0};
    this.taps=0;
    this.reflectionCount=0;
    this.time=PLAY_SECONDS;
    this.waves=[];
    this.waveFades=[];
    this.particles=[];
    this.reflectionEffects=[];
    this.bestHits=new Map();
    this.routeBestHits=new Map();
    this.reflectionTapAwards=new Map();
    this.finalizedRoots=new Set();
    this.waveSequence=1;
    this.reflectionEffectSequence=1;
    this.beacons=layout.beacons;
    this.glass=layout.glass;
  }

  tap(x,y,{action='auto',reflectionTarget=null}={}){
    if(action!=='root'){
      const target=action==='reflection'&&reflectionTarget
        ?this.findCapturedReflectionTapTarget(reflectionTarget)
        :this.findWaterRippleTapTarget(x,y);
      if(target)return this.registerReflectionTap(target,x,y);
      if(action==='reflection')return false;
    }
    if(this.taps>=MAX_TAPS)return false;
    const tapNumber=this.taps+1;
    const wave=this.addWave(x,y,0,'direct',{rootTapId:`tap-${tapNumber}`});
    if(!wave)return false;
    this.taps=tapNumber;
    return true;
  }

  /**
   * Find the reflected water ripple shown by the renderers.  The geometric
   * path remains the deterministic source of truth, while the renderers can
   * present the same target as a neutral water ripple instead of a
   * reflection-type colour.  A finite reflection arc is intentionally not a
   * fallback: only this short-lived, real water ripple can receive the bonus.
   */
  findWaterRippleTapTarget(x,y){
    if(!Number.isFinite(x)||!Number.isFinite(y))return null;
    let best=null;
    for(const effect of this.reflectionEffects){
      const wave=effect?.wave;
      if(!wave||effect.rippleTapUsed||!this.isWaterRippleTapAvailable(wave)||effect.age<0||effect.age>=effect.life)continue;
      const progress=Math.max(0,Math.min(1,effect.age/effect.life));
      const visibleRadius=4+progress*22;
      const distance=Math.hypot(x-effect.x,y-effect.y);
      const tapRange=Math.max(8,REFLECTION_TAP_RANGE*.55);
      const radialError=Math.abs(distance-visibleRadius);
      if(distance<=1e-7||radialError>tapRange)continue;
      const precision=Math.max(0,Math.min(1,1-radialError/tapRange));
      const candidate={
        wave,
        waveId:wave.id,
        rootTapId:wave.rootTapId,
        reflectionDepth:Math.max(1,wave.reflectionDepth??wave.reflections??1),
        radialError,
        precision,
        projectedX:effect.x+(x-effect.x)*(visibleRadius/distance),
        projectedY:effect.y+(y-effect.y)*(visibleRadius/distance),
        rippleEffect:effect
      };
      if(!best||candidate.radialError<best.radialError)best=candidate;
    }
    return best;
  }

  isWaterRippleTapAvailable(wave){
    return Boolean(
      wave&&
      !wave.reflectionTapUsed&&
      !this.reflectionTapAwards.has(wave.rootTapId)&&
      !this.finalizedRoots.has(wave.rootTapId)&&
      this.reflectionTapAwards.size<MAX_TAPS&&
      this.reflectionEffects.some(effect=>
        effect?.wave===wave&&
        !effect.rippleTapUsed&&
        Number.isFinite(effect.age)&&
        Number.isFinite(effect.life)&&
        effect.age>=0&&
        effect.age<effect.life
      )
    );
  }

  hasAvailableWaterRipple(){
    return this.reflectionEffects.some(effect=>this.isWaterRippleTapAvailable(effect?.wave));
  }

  /**
   * Preserve the target selected at pointerdown until the queued input is
   * applied. The simulation can advance one or more fixed steps in between,
   * so searching only the new radius would make a tap on a visible ring miss.
   */
  findCapturedReflectionTapTarget(snapshot){
    if(!snapshot||typeof snapshot!=='object')return null;
    if(!Number.isFinite(snapshot.rippleEffectId))return null;
    const wave=[
      ...this.waves,
      ...this.waveFades.map(fade=>fade.wave)
    ].find(candidate=>
      candidate?.id===snapshot.waveId&&
      candidate?.rootTapId===snapshot.rootTapId
    );
    if(!wave)return null;
    const rippleEffect=this.reflectionEffects.find(effect=>effect.id===snapshot.rippleEffectId);
    if(
      !rippleEffect||
      rippleEffect.wave!==wave||
      rippleEffect.rippleTapUsed||
      rippleEffect.age<0||
      rippleEffect.age>=rippleEffect.life||
      this.reflectionTapAwards.has(snapshot.rootTapId)
    )return null;
    const depth=Math.max(0,wave.reflectionDepth??wave.reflections??0);
    if(
      depth<=0||
      wave.reflectionTapUsed||
      this.reflectionTapAwards.has(wave.rootTapId)||
      this.finalizedRoots.has(wave.rootTapId)||
      this.reflectionTapAwards.size>=MAX_TAPS||
      !this.isWaterRippleTapAvailable(wave)
    )return null;
    if(depth!==snapshot.reflectionDepth)return null;
    return{
      wave,
      rootTapId:wave.rootTapId,
      reflectionDepth:depth,
      radialError:snapshot.radialError,
      precision:Math.max(0,Math.min(1,snapshot.precision)),
      projectedX:snapshot.projectedX,
      projectedY:snapshot.projectedY,
      rippleEffect
    };
  }

  registerReflectionTap(target,x,y){
    if(!target?.wave||this.reflectionTapAwards.has(target.rootTapId))return false;
    if(this.reflectionTapAwards.size>=MAX_TAPS)return false;
    const points=reflectionTapScore(target.reflectionDepth,target.precision);
    const award={
      rootTapId:target.rootTapId,
      waveId:target.wave.id,
      source:'water-ripple',
      reflections:target.reflectionDepth,
      reflectionDepth:target.reflectionDepth,
      totalReflections:this.reflectionCount,
      precision:target.precision,
      judgement:judgementFromPrecision(target.precision),
      radialError:target.radialError,
      x,
      y,
      points,
      score:points,
      routeStatus:'reflection-tap'
    };
    target.wave.reflectionTapUsed=true;
    if(target.rippleEffect)target.rippleEffect.rippleTapUsed=true;
    this.reflectionTapAwards.set(target.rootTapId,award);
    this.burst(x,y);
    this.rebuildRouteScore();
    this.onReflectionTap({...award});
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
    speed=WAVE_SPEED,
    age=0,
    lifetime=WAVE_LIFETIME,
    physicsLifetime=WAVE_LIFETIME,
    energy=1,
    reflectedBy=null,
    reflectionPath=null,
    emittedSurfaces=[],
    previousRadius=radius,
    displayAge=age,
    displayRadius=radius,
    displayPreviousRadius=previousRadius
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
      physicsLifetime:Math.max(0,Number.isFinite(physicsLifetime)?physicsLifetime:WAVE_LIFETIME),
      displayAge:Math.max(0,Number.isFinite(displayAge)?displayAge:age),
      displayRadius:Number.isFinite(displayRadius)?displayRadius:radius,
      displayPreviousRadius:Number.isFinite(displayPreviousRadius)?displayPreviousRadius:previousRadius,
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
      hitCandidates:new Map(),
      finalizedHits:new Set()
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

  rebuildRouteScore(){
    const routes=new Map();
    for(const [sourceHitKey,candidate] of this.bestHits){
      if(!this.finalizedRoots.has(candidate.rootTapId))continue;
      const routeKey=candidate.routeKey??scoreRouteKey(candidate.beaconId,candidate.pathIntersections);
      const previous=routes.get(routeKey);
      if(!previous||isBetterCandidate(candidate,previous)){
        routes.set(routeKey,{...candidate,routeKey,sourceHitKey});
      }
    }
    const breakdown={direct:0,wall:0,glass:0,double:0};
    let score=0;
    for(const candidate of routes.values()){
      score+=candidate.score;
      breakdown[candidate.category]+=candidate.score;
    }
    score+=this.getReflectionTapScore();
    this.routeBestHits=routes;
    this.scoreBreakdown=breakdown;
    this.score=score;
  }

  routeEvent(candidate,{points=0,routeStatus='known'}={}){
    return{
      beaconId:candidate.beaconId,
      waveId:candidate.waveId,
      judgement:judgementFromPrecision(candidate.precision),
      precision:candidate.precision,
      points,
      candidateScore:candidate.score,
      category:candidate.category,
      kind:candidate.kind,
      reflections:candidate.reflections,
      pathIntersections:candidate.pathIntersections,
      routeKey:candidate.routeKey,
      routeStatus,
      discoveredRoutes:this.routeBestHits.size
    };
  }

  presentCandidateImpact(wave,beacon,candidate){
    this.prepareBeacon(beacon);
    const targetX=Number.isFinite(candidate.targetX)?candidate.targetX:beacon.x;
    const targetY=Number.isFinite(candidate.targetY)?candidate.targetY:beacon.y;
    const distance=Math.hypot(wave.originX-targetX,wave.originY-targetY);
    beacon.flash=1;
    beacon.shakeVx+=(targetX-wave.originX)/(distance||1)*BEACON_SHAKE_IMPULSE;
    beacon.shakeVy+=(targetY-wave.originY)/(distance||1)*BEACON_SHAKE_IMPULSE;
    [beacon.shakeVx,beacon.shakeVy]=clampVector(beacon.shakeVx,beacon.shakeVy,BEACON_SHAKE_MAX_SPEED);
    this.burst(targetX,targetY);
    this.onHit(this.routeEvent(candidate,{routeStatus:'impact'}));
  }

  settleRoots(rootTapIds){
    const roots=[...new Set(rootTapIds)].filter(rootTapId=>rootTapId&&!this.finalizedRoots.has(rootTapId));
    if(!roots.length)return;
    const rootSet=new Set(roots);
    const previousRoutes=this.routeBestHits;
    for(const rootTapId of roots)this.finalizedRoots.add(rootTapId);
    this.rebuildRouteScore();
    const candidates=[...this.bestHits].filter(([,candidate])=>rootSet.has(candidate.rootTapId));
    const contributingHitKeys=new Set();
    const candidateCategoryCounts=emptyCategoryCounts();
    const awardedCategoryCounts=emptyCategoryCounts();
    for(const[,candidate]of candidates)countCategory(candidateCategoryCounts,candidate);
    let points=0;
    let newRoutes=0;
    let improvedRoutes=0;
    let representative=null;
    for(const [routeKey,candidate] of this.routeBestHits){
      if(!rootSet.has(candidate.rootTapId))continue;
      const previous=previousRoutes.get(routeKey);
      const addedPoints=candidate.score-(previous?.score??0);
      if(addedPoints<=0)continue;
      points+=addedPoints;
      countCategory(awardedCategoryCounts,candidate);
      if(previous)improvedRoutes++;
      else newRoutes++;
      contributingHitKeys.add(candidate.sourceHitKey);
      if(!representative||isBetterCandidate(candidate,representative))representative=candidate;
    }
    const knownRoutes=Math.max(0,candidates.length-contributingHitKeys.size);
    if(!representative){
      for(const[,candidate]of candidates){
        if(!representative||isBetterCandidate(candidate,representative))representative=candidate;
      }
    }
    if(!representative)return;
    const routeStatus=newRoutes?'new':improvedRoutes?'improved':'known';
    this.onRoute({
      ...this.routeEvent(representative,{points,routeStatus}),
      rootCount:roots.length,
      candidateCount:candidates.length,
      newRoutes,
      improvedRoutes,
      knownRoutes,
      candidateCategoryCounts,
      awardedCategoryCounts
    });
  }

  settleCompletedRoots({all=false}={}){
    const activeRoots=all?new Set():new Set(this.waves.map(wave=>wave.rootTapId));
    const completed=[];
    for(const candidate of this.bestHits.values()){
      if(!this.finalizedRoots.has(candidate.rootTapId)&&(all||!activeRoots.has(candidate.rootTapId))){
        completed.push(candidate.rootTapId);
      }
    }
    this.settleRoots(completed);
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

  commitWaveHit(wave,beacon){
    if(this.finalizedRoots.has(wave.rootTapId))return;
    if(wave.finalizedHits.has(beacon.id))return;
    const candidate=wave.hitCandidates.get(beacon.id);
    if(!candidate)return;
    wave.finalizedHits.add(beacon.id);
    candidate.pending=false;
    const hitKey=`${wave.rootTapId}:${beacon.id}`;
    const previous=this.bestHits.get(hitKey);
    if(!isBetterCandidate(candidate,previous))return;
    const routeKey=scoreRouteKey(beacon.id,candidate.pathIntersections);
    const accepted={
      ...candidate,
      beaconId:beacon.id,
      rootTapId:wave.rootTapId,
      originX:wave.originX,
      originY:wave.originY,
      kind:wave.kind,
      reflections:wave.reflections,
      routeKey,
      pending:false
    };
    this.bestHits.set(hitKey,accepted);
    if(candidate.score>(previous?.score??0))this.presentCandidateImpact(wave,beacon,accepted);
  }

  flushWaveHits(wave){
    for(const beacon of this.beacons)this.commitWaveHit(wave,beacon);
  }

  /**
   * The round deadline is a third hit-finalization boundary alongside band
   * exit and wave lifetime. Commit only candidates already observed by the
   * final fixed step; do not advance wave or beacon physics here.
   */
  finalizePendingHits(){
    for(const wave of this.waves)this.flushWaveHits(wave);
    this.settleCompletedRoots({all:true});
  }

  scoreWave(wave,beaconTargets,{finalize=false}={}){
    for(let beaconIndex=0;beaconIndex<this.beacons.length;beaconIndex++){
      const beacon=this.beacons[beaconIndex];
      const target=beaconTargets[beaconIndex];
      // `hit` is reserved for an explicit route suppression. Pending and
      // finalized candidates have their own stores so the states cannot be
      // confused with one another.
      if(wave.finalizedHits.has(beacon.id))continue;
      if(wave.hit.has(beacon.id))continue;
      const distance=Math.hypot(wave.originX-target.x,wave.originY-target.y);
      const error=Math.abs(distance-wave.radius);
      const band=wave.width+beacon.radius*.35;
      const previousCandidate=wave.hitCandidates.get(beacon.id);
      if(error<=band){
        const pathTrace=this.traceWavePath(wave,target.x,target.y);
        if(pathTrace.valid&&(!previousCandidate||error<previousCandidate.error-1e-9)){
          const precision=Math.max(0,1-error/band);
          const category=scoreCategory(wave);
          const candidate=candidateScore(category,precision);
          const pathIntersections=pathTrace.intersections.map(intersection=>({...intersection}));
          wave.hitCandidates.set(beacon.id,{
            category,
            score:candidate,
            error,
            precision,
            targetX:target.x,
            targetY:target.y,
            waveId:wave.id,
            reflectionDepth:wave.reflections,
            pathIntersections,
            pending:true
          });
          // A mathematically exact hit cannot be improved by a later sample.
          if(error<=LIFETIME_EPSILON)this.commitWaveHit(wave,beacon);
        }
      }else if(previousCandidate){
        // The wave has passed through its finite judgement band.  Commit the
        // minimum-error sample once, after no further improvement is possible.
        this.commitWaveHit(wave,beacon);
      }
      if(finalize)this.commitWaveHit(wave,beacon);
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

    this.removeExpiredWaves();
    const wavesAtStepStart=[...this.waves].reverse();
    for(const wave of wavesAtStepStart){
      const physicsLifetime=Math.max(0,Number.isFinite(wave.physicsLifetime)?wave.physicsLifetime:WAVE_LIFETIME);
      const displayLifetime=Math.max(0,Number.isFinite(wave.lifetime)?wave.lifetime:physicsLifetime);
      const physicsAge=Math.max(0,Number.isFinite(wave.age)?wave.age:0);
      const displayAge=Math.max(0,Number.isFinite(wave.displayAge)?wave.displayAge:physicsAge);
      const remainingPhysics=Math.max(0,physicsLifetime-physicsAge);
      const remainingDisplay=Math.max(0,displayLifetime-displayAge);
      const activeDt=Math.min(dt,remainingPhysics);
      const displayDt=Math.min(dt,remainingDisplay);
      const beaconTargets=activeDt<dt-LIFETIME_EPSILON
        ?beaconStarts.map(start=>{
          const sampled={...start};
          this.advanceBeacon(sampled,activeDt);
          return sampled;
        })
        :this.beacons;
      const previousRadius=Number.isFinite(wave.radius)?wave.radius:1;
      const previousDisplayRadius=Number.isFinite(wave.displayRadius)?wave.displayRadius:previousRadius;
      const previousDisplayAge=displayAge;
      wave.previousRadius=previousRadius;
      wave.displayPreviousRadius=previousDisplayRadius;
      wave.age=Math.min(physicsLifetime,physicsAge+activeDt);
      wave.radius=previousRadius+wave.speed*activeDt;
      wave.displayAge=Math.min(displayLifetime,previousDisplayAge+displayDt);
      wave.displayRadius=previousDisplayRadius+wave.speed*displayDt;
      const propagationQueue=activeDt>LIFETIME_EPSILON
        ?[{wave:{...wave,previousRadius,age:wave.age,radius:wave.radius},startRadius:previousRadius,includeActiveContacts:false}]
        :[];
      for(let queueIndex=0;queueIndex<propagationQueue.length;queueIndex++){
        const propagation=propagationQueue[queueIndex];
        const children=this.reflect(propagation.wave,propagation.startRadius,{
          includeActiveContacts:propagation.includeActiveContacts
        });
        this.scoreWave(propagation.wave,beaconTargets);
        const childPhysicsLifetime=Number.isFinite(propagation.wave.physicsLifetime)
          ?propagation.wave.physicsLifetime
          :WAVE_LIFETIME;
        if(propagation.wave.age>=childPhysicsLifetime-LIFETIME_EPSILON){
          this.flushWaveHits(propagation.wave);
        }
        for(const child of children){
          propagationQueue.push({wave:child,startRadius:child.previousRadius,includeActiveContacts:true});
        }
      }
    }
    this.removeExpiredWaves();
    this.settleCompletedRoots();

    for(let index=this.waveFades.length-1;index>=0;index--){
      const fade=this.waveFades[index];
      fade.age+=dt;
      if(fade.age>=fade.life)this.waveFades.splice(index,1);
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
      if(effect.age>=effect.life)this.reflectionEffects.splice(index,1);
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

  removeExpiredWaves(){
    const active=[];
    for(const wave of this.waves){
      const displayAge=Number.isFinite(wave.displayAge)?wave.displayAge:wave.age;
      if(wave.lifetime-displayAge<=LIFETIME_EPSILON){
        this.waveFades.push({wave,age:0,life:WAVE_FADE_LIFETIME});
      }else{
        active.push(wave);
      }
    }
    this.waves=active;
    while(this.waveFades.length>24)this.waveFades.shift();
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
    const physicsLifetime=Number.isFinite(wave.physicsLifetime)?wave.physicsLifetime:WAVE_LIFETIME;
    const contactAge=wave.speed>0
      ?Math.max(0,wave.age-distanceAfterContact/wave.speed)
      :wave.age;
    if(
      this.waves.length>=MAX_WAVES||
      physicsLifetime-contactAge<=LIFETIME_EPSILON||
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
      lifetime:Math.max(wave.lifetime,REFLECTED_WAVE_LIFETIME),
      physicsLifetime,
      displayAge:wave.displayAge??wave.age,
      displayRadius:wave.radius,
      displayPreviousRadius:activationRadius,
      energy:wave.energy*energyMultiplier,
      reflectedBy:surfaceKey,
      reflectionPath,
      previousRadius:activationRadius
    });
    if(!reflected)return null;
    wave.emittedSurfaces.add(surfaceKey);
    // The child is intentionally kept even when this particular contact is
    // outside the parent's finite route.  A later point on the child can be
    // a valid two-surface route, which the physics and score path must retain.
    // Feedback, however, must not announce a reflection that the finite
    // surfaces could not physically produce.
    if(this.waveCanReach(reflected,contactX,contactY)){
      this.reflectionCount++;
      this.addReflectionEffect(contactX,contactY,normalX,normalY,kind,reflected);
      this.onReflect({
        kind,
        reflections:reflected.reflections,
        reflectionDepth:reflected.reflectionDepth,
        totalReflections:this.reflectionCount,
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
    }
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

  addReflectionEffect(x,y,normalX,normalY,kind,wave=null){
    this.reflectionEffects.push({
      id:this.reflectionEffectSequence++,
      x,
      y,
      normalX,
      normalY,
      kind,
      wave,
      rippleTapUsed:false,
      age:0,
      life:.42
    });
    while(this.reflectionEffects.length>24)this.reflectionEffects.shift();
  }

  getScoreBreakdown(){
    const breakdown={...this.scoreBreakdown};
    const reflectionTap=this.getReflectionTapScore();
    if(reflectionTap>0)breakdown.reflectionTap=reflectionTap;
    return breakdown;
  }

  getReflectionTapScore(){
    let score=0;
    for(const award of this.reflectionTapAwards.values())score+=award.score;
    return score;
  }

  getReflectionCount(){
    return this.reflectionCount;
  }

  getScoreLedgerSum(){
    let score=this.getReflectionTapScore();
    for(const candidate of this.routeBestHits.values())score+=candidate.score;
    return score;
  }

  getDiscoveredRouteCount(){
    return this.routeBestHits.size;
  }

  getBestRoute(){
    let best=null;
    for(const candidate of this.routeBestHits.values()){
      if(!best||isBetterCandidate(candidate,best))best=candidate;
    }
    return best
      ?{...best,pathIntersections:(best.pathIntersections??[]).map(intersection=>({...intersection}))}
      :null;
  }
}
