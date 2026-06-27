import{GAME_URL}from'../config';export function shareText(score:number){return `波押しで ${score}点！\n反射する波をビーコンに重ねた。\n${GAME_URL}`}
export async function share(score:number){const text=shareText(score);if(navigator.share){await navigator.share({text});return'共有しました'}if(navigator.clipboard){await navigator.clipboard.writeText(text);return'シェア文をコピーしました'}throw new Error(text)}
