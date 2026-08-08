import {LOGICAL_HEIGHT,LOGICAL_WIDTH,MAX_TAPS,PLAY_SECONDS} from '../config.js';
import {judgementFromPrecision} from './judgement.js';
import {createOfficialLayout,createPracticeLayout} from './layouts.js';
import {GAME_MODE,isOfficialMode,normalizeGameMode} from './modes.js';
import {candidateScore,scoreCategory} from './scoring.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const OFFICIAL_RANDOM_SEED=0xfc71e804;
let waveSequence=1;

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
    this.beacons=layout.beacons;
    this.glass=layout.glass;
  }

  tap(x,y){
    if(this.taps>=MAX_TAPS)return false;
    this.taps++;
    this.addWave(x,y,0,'direct',{rootTapId:`tap-${this.taps}`});
    return true;
  }

  addWave(x,y,reflections,kind,{rootTapId=null,parentWaveId=null,surfaceHistory=[]}={}){
    const wave={
      id:waveSequence++,
      rootTapId:rootTapId??`manual-${waveSequence}`,
      parentWaveId,
      originX:x,
      originY:y,
      radius:1,
      width:9,
      speed:165,
      age:0,
      life:3,
      reflections,
      kind,
      hit:new Set(),
      edges:new Set(),
      glass:new Set(),
      surfaceHistory:new Set(surfaceHistory),
      hitCandidates:new Map()
    };
    this.waves.push(wave);
    while(this.waves.length>24)this.waves.shift();
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
      wave.age+=dt;
      wave.radius+=wave.speed*dt;
      this.reflect(wave);
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
      if(wave.age>wave.life)this.waves.splice(index,1);
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

  reflect(wave){
    if(wave.reflections>=2)return;
    const sides=[
      ['l',-wave.originX,wave.originY],
      ['r',2*this.w-wave.originX,wave.originY],
      ['t',wave.originX,-wave.originY],
      ['b',wave.originX,2*this.h-wave.originY]
    ];
    for(const[side,x,y]of sides){
      const distance=side==='l'?wave.originX:side==='r'?this.w-wave.originX:side==='t'?wave.originY:this.h-wave.originY;
      if(wave.radius>distance&&!wave.edges.has(side)){
        wave.edges.add(side);
        const normalX=side==='l'?1:side==='r'?-1:0;
        const normalY=side==='t'?1:side==='b'?-1:0;
        const contactX=side==='l'?0:side==='r'?this.w:clamp(wave.originX,0,this.w);
        const contactY=side==='t'?0:side==='b'?this.h:clamp(wave.originY,0,this.h);
        const surfaceKey=`wall:${side}`;
        wave.surfaceHistory.add(surfaceKey);
        const reflected=this.addWave(x,y,wave.reflections+1,'wall',{
          rootTapId:wave.rootTapId,
          parentWaveId:wave.id,
          surfaceHistory:wave.surfaceHistory
        });
        reflected.edges.add(side);
        reflected.surfaceHistory.add(surfaceKey);
        this.addReflectionEffect(contactX,contactY,normalX,normalY,'wall');
        this.onReflect({kind:'wall',reflections:reflected.reflections,x:contactX,y:contactY,normalX,normalY});
      }
    }

    for(const piece of this.glass){
      if(wave.glass.has(piece.id))continue;
      const vx=piece.x2-piece.x1;
      const vy=piece.y2-piece.y1;
      const lengthSquared=vx*vx+vy*vy;
      const position=clamp(((wave.originX-piece.x1)*vx+(wave.originY-piece.y1)*vy)/lengthSquared,0,1);
      const pointX=piece.x1+vx*position;
      const pointY=piece.y1+vy*position;
      const perpendicular=(wave.originX-pointX)*piece.nx+(wave.originY-pointY)*piece.ny;
      if(Math.abs(Math.abs(perpendicular)-wave.radius)<9){
        wave.glass.add(piece.id);
        const surfaceKey=`glass:${piece.id}`;
        wave.surfaceHistory.add(surfaceKey);
        const reflected=this.addWave(
          wave.originX-2*perpendicular*piece.nx,
          wave.originY-2*perpendicular*piece.ny,
          wave.reflections+1,
          'glass',
          {
            rootTapId:wave.rootTapId,
            parentWaveId:wave.id,
            surfaceHistory:wave.surfaceHistory
          }
        );
        reflected.glass.add(piece.id);
        reflected.surfaceHistory.add(surfaceKey);
        this.addReflectionEffect(pointX,pointY,piece.nx,piece.ny,'glass');
        this.onReflect({kind:'glass',reflections:reflected.reflections,x:pointX,y:pointY,normalX:piece.nx,normalY:piece.ny});
      }
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
