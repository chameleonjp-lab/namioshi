import {LOGICAL_HEIGHT,LOGICAL_WIDTH,MAX_TAPS,PLAY_SECONDS} from '../config.js';
import {createOfficialLayout,createPracticeLayout} from './layouts.js';
import {GAME_MODE,isOfficialMode,normalizeGameMode} from './modes.js';

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
  taps=0;
  time=PLAY_SECONDS;
  combo=0;
  waves=[];
  beacons=[];
  glass=[];
  particles=[];
  onHit=()=>{};

  constructor({random=Math.random}={}){
    if(typeof random!=='function')throw new TypeError('random source must be a function');
    this.random=random;
  }

  reset({mode=GAME_MODE.OFFICIAL,random=this.random}={}){
    this.w=LOGICAL_WIDTH;
    this.h=LOGICAL_HEIGHT;
    this.mode=normalizeGameMode(mode);
    const official=isOfficialMode(this.mode);
    this.random=official?seededRandom(OFFICIAL_RANDOM_SEED):random;
    const layout=official?createOfficialLayout():createPracticeLayout(this.random);
    this.layoutId=layout.id;
    this.ruleVersion=layout.ruleVersion;
    this.layoutFingerprint=layout.fingerprint;
    this.rankingCandidate=official;
    this.score=0;
    this.taps=0;
    this.time=PLAY_SECONDS;
    this.combo=0;
    this.waves=[];
    this.particles=[];
    this.beacons=layout.beacons;
    this.glass=layout.glass;
  }

  tap(x,y){
    if(this.taps>=MAX_TAPS)return false;
    this.taps++;
    this.addWave(x,y,0,'direct');
    return true;
  }

  addWave(x,y,reflections,kind){
    this.waves.push({
      id:waveSequence++,
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
      glass:new Set()
    });
    while(this.waves.length>24)this.waves.shift();
  }

  step(dt){
    this.time-=dt;
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
          const base=wave.reflections>=2?260:wave.kind==='glass'?200:wave.kind==='wall'?160:100;
          const accuracy=1+Math.max(0,1-error/band)*.45;
          const multiplier=accuracy*(1+Math.min(this.combo,5)*.12);
          this.combo++;
          this.score+=Math.round(base*multiplier);
          beacon.flash=1;
          beacon.vx+=(beacon.x-wave.originX)/(distance||1)*22;
          beacon.vy+=(beacon.y-wave.originY)/(distance||1)*22;
          this.burst(beacon.x,beacon.y);
          this.onHit();
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
        this.addWave(x,y,wave.reflections+1,'wall');
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
        this.addWave(
          wave.originX-2*perpendicular*piece.nx,
          wave.originY-2*perpendicular*piece.ny,
          wave.reflections+1,
          'glass'
        );
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
}
