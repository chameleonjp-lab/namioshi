import test from 'node:test';
import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';

const sql=readFileSync(new URL('../docs/sql/20260811_namioshi_ranking_contract_v1.sql',import.meta.url),'utf8');

test('server contract proposal is disabled, versioned, and isolated',()=>{
  assert.match(sql,/enabled boolean not null default false/);
  assert.match(sql,/verification_mode text not null/);
  assert.match(sql,/create table if not exists private\.namioshi_score_submissions/);
  assert.match(sql,/play_id text primary key/);
  assert.match(sql,/create table if not exists private\.namioshi_rate_limits/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/is_first_play boolean not null default false/);
  assert.match(sql,/max_attempts_per_window/);
  assert.match(sql,/create or replace function public\.submit_score\(/);
  assert.match(sql,/p_play_id text/);
  assert.match(sql,/p_rule_version text/);
  assert.match(sql,/p_season text/);
  assert.match(sql,/grant execute on function public\.submit_score\([^;]+to anon/i);
  assert.match(sql,/alter table private\.namioshi_score_submissions enable row level security/);
  assert.match(sql,/alter table private\.namioshi_rate_limits enable row level security/);
  assert.doesNotMatch(sql,/insert into public\.(?:game_scores|score_runs)/i);
});

test('server contract preserves the self-reported boundary',()=>{
  assert.match(sql,/'self_reported'/);
  assert.match(sql,/verification_status/);
  assert.match(sql,/p_score > c\.score_ceiling/);
  assert.match(sql,/play_id_conflict/);
  assert.match(sql,/rate_limited/);
  assert.match(sql,/revoke execute on function public\.submit_score\([^;]+from PUBLIC/i);
});
