export const GAME_MODE=Object.freeze({
  OFFICIAL:'official',
  PRACTICE:'practice'
});

export const MODE_PRESENTATION=Object.freeze({
  [GAME_MODE.OFFICIAL]:Object.freeze({
    label:'公式',
    resultTitle:'公式結果',
    description:'候補C・開港型の固定配置で遊びます。',
    rankingText:'公式モードです。ランキング送信はPhase 5で開始します。'
  }),
  [GAME_MODE.PRACTICE]:Object.freeze({
    label:'練習',
    resultTitle:'練習結果',
    description:'毎回変わるランダム配置で遊びます。',
    rankingText:'練習モードのためランキングへ送信しません。'
  })
});

export function normalizeGameMode(value){
  return value===GAME_MODE.PRACTICE?GAME_MODE.PRACTICE:GAME_MODE.OFFICIAL;
}

export function isOfficialMode(value){
  return normalizeGameMode(value)===GAME_MODE.OFFICIAL;
}

export function modePresentation(value){
  return MODE_PRESENTATION[normalizeGameMode(value)];
}

export function rankingPolicy(value){
  const mode=normalizeGameMode(value);
  return Object.freeze({
    mode,
    rankingCandidate:mode===GAME_MODE.OFFICIAL,
    submitNow:false,
    statusText:MODE_PRESENTATION[mode].rankingText
  });
}
