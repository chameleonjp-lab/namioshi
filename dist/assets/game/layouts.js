import {
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  OFFICIAL_LAYOUT_FINGERPRINT,
  OFFICIAL_LAYOUT_ID,
  OFFICIAL_LAYOUT_VERSION,
  OFFICIAL_RULE_VERSION
} from '../config.js';

const OFFICIAL_BEACONS=Object.freeze([
  Object.freeze({id:'beacon-a',x:76,y:204,vx:11,vy:-4,radius:16}),
  Object.freeze({id:'beacon-b',x:284,y:286,vx:-10,vy:5,radius:16}),
  Object.freeze({id:'beacon-c',x:180,y:510,vx:6,vy:-7,radius:16})
]);

const OFFICIAL_GLASS=Object.freeze([
  Object.freeze({id:'glass-c1',x1:44,y1:302,x2:126,y2:244}),
  Object.freeze({id:'glass-c2',x1:236,y1:226,x2:318,y2:286}),
  Object.freeze({id:'glass-c3',x1:46,y1:474,x2:136,y2:518}),
  Object.freeze({id:'glass-c4',x1:224,y1:520,x2:316,y2:470})
]);

export const PRACTICE_LAYOUT_CONSTRAINTS=Object.freeze({
  endpointMargin:18,
  minY:90,
  maxY:LOGICAL_HEIGHT-18,
  beaconGap:28,
  maxGlassAttempts:96
});

const PRACTICE_GLASS_FALLBACKS=Object.freeze([
  Object.freeze({x1:24,y1:104,x2:108,y2:104}),
  Object.freeze({x1:252,y1:104,x2:336,y2:132}),
  Object.freeze({x1:24,y1:580,x2:108,y2:600}),
  Object.freeze({x1:252,y1:580,x2:336,y2:548}),
  Object.freeze({x1:154,y1:104,x2:206,y2:104}),
  Object.freeze({x1:154,y1:590,x2:206,y2:590}),
  Object.freeze({x1:24,y1:365,x2:108,y2:330}),
  Object.freeze({x1:252,y1:365,x2:336,y2:395})
]);

export const OFFICIAL_LAYOUT=Object.freeze({
  id:OFFICIAL_LAYOUT_ID,
  label:'候補C・開港型',
  layoutVersion:OFFICIAL_LAYOUT_VERSION,
  ruleVersion:OFFICIAL_RULE_VERSION,
  fingerprint:OFFICIAL_LAYOUT_FINGERPRINT,
  beacons:OFFICIAL_BEACONS,
  glass:OFFICIAL_GLASS
});

function cloneBeacon(beacon){
  return{
    id:beacon.id,
    x:beacon.x,
    y:beacon.y,
    baseX:beacon.x,
    baseY:beacon.y,
    vx:beacon.vx,
    vy:beacon.vy,
    radius:beacon.radius,
    flash:0
  };
}

function cloneGlass(piece){
  const vx=piece.x2-piece.x1;
  const vy=piece.y2-piece.y1;
  const length=Math.hypot(vx,vy)||1;
  return{
    id:piece.id,
    x1:piece.x1,
    y1:piece.y1,
    x2:piece.x2,
    y2:piece.y2,
    nx:-vy/length,
    ny:vx/length
  };
}

export function createOfficialLayout(){
  return{
    id:OFFICIAL_LAYOUT.id,
    label:OFFICIAL_LAYOUT.label,
    layoutVersion:OFFICIAL_LAYOUT.layoutVersion,
    ruleVersion:OFFICIAL_LAYOUT.ruleVersion,
    fingerprint:OFFICIAL_LAYOUT.fingerprint,
    beacons:OFFICIAL_LAYOUT.beacons.map(cloneBeacon),
    glass:OFFICIAL_LAYOUT.glass.map(cloneGlass)
  };
}

function randomBetween(random,min,max){
  return min+random()*(max-min);
}

function pointToSegmentDistance(px,py,piece){
  const dx=piece.x2-piece.x1;
  const dy=piece.y2-piece.y1;
  const lengthSquared=dx*dx+dy*dy;
  const projection=lengthSquared===0
    ?0
    :Math.max(0,Math.min(1,((px-piece.x1)*dx+(py-piece.y1)*dy)/lengthSquared));
  return Math.hypot(px-(piece.x1+dx*projection),py-(piece.y1+dy*projection));
}

function isPracticeGlassValid(piece,beacons){
  const {endpointMargin,minY,maxY,beaconGap}=PRACTICE_LAYOUT_CONSTRAINTS;
  const endpointsInside=[piece.x1,piece.x2].every(x=>x>=endpointMargin&&x<=LOGICAL_WIDTH-endpointMargin)
    &&[piece.y1,piece.y2].every(y=>y>=minY&&y<=maxY);
  if(!endpointsInside)return false;
  return beacons.every(beacon=>pointToSegmentDistance(beacon.x,beacon.y,piece)>=beaconGap);
}

function createPracticeGlass(index,random,beacons){
  const {endpointMargin,minY,maxY,maxGlassAttempts}=PRACTICE_LAYOUT_CONSTRAINTS;
  for(let attempt=0;attempt<maxGlassAttempts;attempt++){
    const x1=randomBetween(random,endpointMargin,LOGICAL_WIDTH-endpointMargin);
    const y1=randomBetween(random,minY,maxY);
    const length=randomBetween(random,64,110);
    const angle=randomBetween(random,-.9,.9);
    const piece={
      x1,
      y1,
      x2:x1+Math.cos(angle)*length,
      y2:y1+Math.sin(angle)*length
    };
    if(isPracticeGlassValid(piece,beacons))return cloneGlass({id:`practice-glass-${index+1}`,...piece});
  }
  for(let offset=0;offset<PRACTICE_GLASS_FALLBACKS.length;offset++){
    const fallback=PRACTICE_GLASS_FALLBACKS[(index+offset)%PRACTICE_GLASS_FALLBACKS.length];
    if(isPracticeGlassValid(fallback,beacons)){
      return cloneGlass({id:`practice-glass-${index+1}`,...fallback});
    }
  }
  throw new Error('practice layout could not place a safe reflection board');
}

export function createPracticeLayout(random=Math.random){
  if(typeof random!=='function')throw new TypeError('practice random source must be a function');
  const beacons=[];
  const glass=[];
  for(let index=0;index<3;index++){
    const y=[.3,.5,.7][index]*LOGICAL_HEIGHT+(.5-random())*36;
    beacons.push({
      id:`practice-beacon-${index+1}`,
      x:(index+1)*LOGICAL_WIDTH/4,
      y,
      baseX:(index+1)*LOGICAL_WIDTH/4,
      baseY:y,
      vx:randomBetween(random,-8,8),
      vy:randomBetween(random,-8,8),
      radius:Math.max(13,Math.min(18,LOGICAL_WIDTH*.045)),
      flash:0
    });
  }
  for(let index=0;index<4;index++)glass.push(createPracticeGlass(index,random,beacons));
  return{
    id:'practice-random',
    label:'練習ランダム',
    layoutVersion:null,
    ruleVersion:OFFICIAL_RULE_VERSION,
    fingerprint:null,
    beacons,
    glass
  };
}
