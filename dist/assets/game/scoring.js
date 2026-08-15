import {REFLECTION_TAP_MAX_BONUS} from '../config.js';

export const SCORE_CATEGORY=Object.freeze({
  DIRECT:'direct',
  WALL:'wall',
  GLASS:'glass',
  DOUBLE:'double'
});

export const SCORE_BASES=Object.freeze({
  [SCORE_CATEGORY.DIRECT]:20,
  [SCORE_CATEGORY.WALL]:100,
  [SCORE_CATEGORY.GLASS]:180,
  [SCORE_CATEGORY.DOUBLE]:300
});

export const SCORE_LABELS=Object.freeze({
  [SCORE_CATEGORY.DIRECT]:'直接',
  [SCORE_CATEGORY.WALL]:'壁反射',
  [SCORE_CATEGORY.GLASS]:'反射板',
  [SCORE_CATEGORY.DOUBLE]:'2回反射'
});

export const REFLECTION_TAP_BASES=Object.freeze({
  1:REFLECTION_TAP_MAX_BONUS/2,
  2:REFLECTION_TAP_MAX_BONUS
});

export function scoreCategory({kind='direct',reflections=0}={}){
  if(reflections>=2)return SCORE_CATEGORY.DOUBLE;
  if(kind==='glass')return SCORE_CATEGORY.GLASS;
  if(kind==='wall')return SCORE_CATEGORY.WALL;
  return SCORE_CATEGORY.DIRECT;
}

export function candidateScore(category,accuracy){
  const base=SCORE_BASES[category]??SCORE_BASES[SCORE_CATEGORY.DIRECT];
  const precision=Number.isFinite(accuracy)?Math.max(0,Math.min(1,accuracy)):0;
  return Math.round(base*(.8+precision*.4));
}

/**
 * A reflected-wave tap is a small, optional skill bonus. It never replaces
 * route scoring: one reflection is worth 10..20 points and two reflections
 * 20..40 points, with the exact value determined by radial tap precision.
 */
export function reflectionTapScore(reflections,accuracy){
  const depth=Math.max(1,Math.min(2,Number.isFinite(reflections)?Math.floor(reflections):1));
  const base=REFLECTION_TAP_BASES[depth];
  const precision=Number.isFinite(accuracy)?Math.max(0,Math.min(1,accuracy)):0;
  return Math.round(base*(.5+precision*.5));
}

export function scoreRouteKey(beaconId,pathIntersections=[]){
  const beacon=String(beaconId??'');
  const surfaces=Array.isArray(pathIntersections)
    ?pathIntersections.map(intersection=>intersection?.surfaceKey).filter(Boolean)
    :[];
  return`${beacon}|${surfaces.length?surfaces.join('>'):'direct'}`;
}
