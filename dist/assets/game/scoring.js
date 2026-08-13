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

export function scoreRouteKey(beaconId,pathIntersections=[]){
  const beacon=String(beaconId??'');
  const surfaces=Array.isArray(pathIntersections)
    ?pathIntersections.map(intersection=>intersection?.surfaceKey).filter(Boolean)
    :[];
  return`${beacon}|${surfaces.length?surfaces.join('>'):'direct'}`;
}
