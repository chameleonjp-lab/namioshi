export const HIT_JUDGEMENT=Object.freeze({
  PERFECT:'PERFECT',
  GREAT:'GREAT',
  GOOD:'GOOD',
  HIT:'HIT'
});

export const JUDGEMENT_THRESHOLDS=Object.freeze({
  PERFECT:.85,
  GREAT:.6,
  GOOD:.3
});

export function judgementFromPrecision(value){
  const precision=Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
  if(precision>=JUDGEMENT_THRESHOLDS.PERFECT)return HIT_JUDGEMENT.PERFECT;
  if(precision>=JUDGEMENT_THRESHOLDS.GREAT)return HIT_JUDGEMENT.GREAT;
  if(precision>=JUDGEMENT_THRESHOLDS.GOOD)return HIT_JUDGEMENT.GOOD;
  return HIT_JUDGEMENT.HIT;
}
