import {reflectionPathReaches} from './reflection-path.js';

export const REFLECTION_ARC_SEGMENTS=96;

const TWO_PI=Math.PI*2;
function waveRadius(wave){
  return Number.isFinite(wave.displayRadius)?wave.displayRadius:wave.radius;
}


export function reflectionDepth(wave){
  return Math.max(0,wave?.reflectionDepth??wave?.reflections??0);
}

function reflectionPathDepth(path){
  let depth=0;
  for(let current=path;current;current=current.previous)depth++;
  return depth;
}

/**
 * A reflected wave is visible only where its unfolded line reaches every
 * recorded finite surface in the recorded order.
 */
export function isReflectionPointVisible(wave,x,y,scratch=null){
  const depth=reflectionDepth(wave);
  if(depth===0)return true;
  if(!wave?.reflectionPath)return false;
  if(reflectionPathDepth(wave.reflectionPath)!==depth)return false;
  return reflectionPathReaches(wave.originX,wave.originY,x,y,wave.reflectionPath,scratch);
}

/**
 * Count the same midpoint samples used by the renderers.  Keeping this
 * check in the game layer lets input guidance and drawing agree about
 * whether a finite reflected arc is actually visible.
 */
export function countVisibleReflectionArcSegments(
  wave,
  segments=REFLECTION_ARC_SEGMENTS
){
  if(
    !wave||
    !Number.isInteger(segments)||
    segments<4||
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
    if(isReflectionPointVisible(wave,middleX,middleY,intersectionScratch))count++;
  }
  return count;
}

export function hasVisibleReflectionArc(wave,segments=REFLECTION_ARC_SEGMENTS){
  return countVisibleReflectionArcSegments(wave,segments)>0;
}
