export const GAME_SLUG='namioshi';
export const GAME_URL='https://chameleonjp.codeberg.page/namioshi/';
export const CLIENT_VERSION='namioshi-v3.1.0-official002';
export const SCORE_UNIT='点';
export const PLAY_SECONDS=30;
export const MAX_TAPS=6;
export const SCORE_HARD_CEILING=6480;
export const MAX_REFLECTIONS=2;
export const REFLECTIVE_SURFACE_COUNT=8;
export const MAX_WAVES=MAX_TAPS*(1+REFLECTIVE_SURFACE_COUNT+REFLECTIVE_SURFACE_COUNT*(REFLECTIVE_SURFACE_COUNT-1));
export const WAVE_LIFETIME=3;
export const WALL_REFLECTION_ENERGY=.72;
export const GLASS_REFLECTION_ENERGY=.84;
export const BEACON_SHAKE_IMPULSE=22;
export const BEACON_SHAKE_MAX_SPEED=48;
export const BEACON_SHAKE_MAX_OFFSET=12;
export const BEACON_SHAKE_SPRING=36;
export const BEACON_SHAKE_DAMPING=10;
export const LOGICAL_WIDTH=360;
export const LOGICAL_HEIGHT=640;
export const OFFICIAL_LAYOUT_ID='candidate-c-open-harbor';
export const OFFICIAL_LAYOUT_FINGERPRINT='fnv1a-fc71e804';
export const OFFICIAL_RULE_VERSION='namioshi-v3-layout-study-001';
export const SUPABASE_URL='https://mlpnjgezrnhdxsxolyzj.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY='sb_publishable_drzcy0v97knU6FgjqSgBHw_0A9XPdFM';
export const QUALITY={
  HIGH:{dpr:1.5,waves:MAX_WAVES,particles:90},
  MID:{dpr:1.25,waves:MAX_WAVES,particles:70},
  LOW:{dpr:1,waves:MAX_WAVES,particles:45}
};
