import {
  REFLECTION_ARC_SEGMENTS,
  isReflectionPointVisible,
  reflectionDepth
} from '../game/reflection-arc-visibility.js';

export {REFLECTION_ARC_SEGMENTS,isReflectionPointVisible};

const TWO_PI=Math.PI*2;
function waveRadius(wave){
  return Number.isFinite(wave.displayRadius)?wave.displayRadius:wave.radius;
}


/**
 * Fill `target` with independent line segments for the finite part of a
 * reflected wave.  Returning a point count lets WebGL use one draw call and
 * lets Canvas 2D build one path without allocating an array per wave/frame.
 */
export function fillReflectionArcPoints(
  wave,
  target,
  segments=REFLECTION_ARC_SEGMENTS
){
  if(!wave||!target||!Number.isInteger(segments)||segments<4){
    return 0;
  }
  if(target.length<segments*4){
    throw new RangeError('reflection arc buffer is too small');
  }
  if(
    reflectionDepth(wave)===0||
    !Number.isFinite(waveRadius(wave))||
    waveRadius(wave)<=0
  )return 0;

  let count=0;
  const intersectionScratch={x:0,y:0};
  for(let index=0;index<segments;index++){
    const startAngle=index/segments*TWO_PI;
    const endAngle=(index+1)/segments*TWO_PI;
    const middleAngle=(startAngle+endAngle)*.5;
    const middleX=wave.originX+Math.cos(middleAngle)*waveRadius(wave);
    const middleY=wave.originY+Math.sin(middleAngle)*waveRadius(wave);
    if(!isReflectionPointVisible(wave,middleX,middleY,intersectionScratch))continue;
    target[count++]=wave.originX+Math.cos(startAngle)*waveRadius(wave);
    target[count++]=wave.originY+Math.sin(startAngle)*waveRadius(wave);
    target[count++]=wave.originX+Math.cos(endAngle)*waveRadius(wave);
    target[count++]=wave.originY+Math.sin(endAngle)*waveRadius(wave);
  }
  return count;
}
