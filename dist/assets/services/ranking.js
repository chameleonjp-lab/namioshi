import { CLIENT_VERSION, GAME_SLUG, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config.js';
export async function submitScore(playerName, score) { const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_score`, { method: 'POST', headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_display_name: playerName, p_game_slug: GAME_SLUG, p_score: score, p_client_version: CLIENT_VERSION }) }); if (!res.ok)
    throw new Error(String(res.status)); }
