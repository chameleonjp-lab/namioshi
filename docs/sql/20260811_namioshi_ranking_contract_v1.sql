-- namioshi ranking contract v1
-- This file is a reviewed proposal only. It is not applied to Supabase by this PR.
-- It intentionally stores namioshi records in private tables and leaves the
-- existing shared ranking function and existing game data untouched.

begin;

create table if not exists private.namioshi_ranking_config (
  config_id smallint primary key check (config_id = 1),
  game_slug text not null unique check (game_slug = 'namioshi'),
  season text not null,
  client_version text not null,
  rule_version text not null,
  score_ceiling integer not null check (score_ceiling between 0 and 6480),
  max_attempts_per_window integer not null check (max_attempts_per_window between 1 and 120),
  window_seconds integer not null check (window_seconds between 60 and 86400),
  enabled boolean not null default false,
  verification_mode text not null check (verification_mode in ('self_reported', 'server_verified')),
  updated_at timestamptz not null default now()
);

insert into private.namioshi_ranking_config (
  config_id,
  game_slug,
  season,
  client_version,
  rule_version,
  score_ceiling,
  max_attempts_per_window,
  window_seconds,
  enabled,
  verification_mode
) values (
  1,
  'namioshi',
  'prelaunch-v2',
  'namioshi-v3.2.0-official003',
  'namioshi-v3-strategy-002',
  6480,
  60,
  3600,
  false,
  'self_reported'
)
on conflict (config_id) do nothing;

create table if not exists private.namioshi_score_submissions (
  play_id text primary key check (play_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  game_slug text not null check (game_slug = 'namioshi'),
  season text not null,
  normalized_name text not null,
  display_name text not null,
  score integer not null check (score >= 0),
  client_version text not null,
  rule_version text not null,
  ranking_status text not null default 'normal' check (ranking_status in ('normal', 'review', 'hidden', 'rejected')),
  verification_status text not null check (verification_status in ('self_reported', 'server_verified')),
  is_first_play boolean not null default false,
  is_new_best boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists namioshi_score_submissions_ranking_idx
  on private.namioshi_score_submissions (season, ranking_status, score desc, created_at asc, play_id asc);

create table if not exists private.namioshi_rate_limits (
  normalized_name text primary key,
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count >= 0)
);

alter table private.namioshi_ranking_config enable row level security;
alter table private.namioshi_score_submissions enable row level security;
alter table private.namioshi_rate_limits enable row level security;

revoke all on private.namioshi_ranking_config from public, anon, authenticated;
revoke all on private.namioshi_score_submissions from public, anon, authenticated;
revoke all on private.namioshi_rate_limits from public, anon, authenticated;

create or replace function public.submit_namioshi_score_v1(
  p_display_name text,
  p_game_slug text,
  p_score integer,
  p_client_version text,
  p_play_id text,
  p_rule_version text,
  p_season text
)
returns table (
  accepted boolean,
  status text,
  reason text,
  play_id text,
  result_normalized_name text,
  result_display_name text,
  result_first_score integer,
  result_best_score integer,
  result_play_count integer,
  is_first_play boolean,
  is_new_best boolean,
  verification_status text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  c private.namioshi_ranking_config%rowtype;
  existing private.namioshi_score_submissions%rowtype;
  rate_row private.namioshi_rate_limits%rowtype;
  v_now timestamptz := clock_timestamp();
  v_display_name text;
  v_normalized_name text;
  v_old_count integer;
  v_old_best integer;
  v_new_count integer;
  v_first_score integer;
  v_best_score integer;
  v_is_first_play boolean;
  v_is_new_best boolean;
begin
  select * into c
  from private.namioshi_ranking_config
  where config_id = 1;

  if not found or not c.enabled then
    return query select false, 'disabled', 'ranking_disabled', null::text, null::text, null::text,
      null::integer, null::integer, null::integer, false, false, null::text;
    return;
  end if;

  if p_game_slug is distinct from c.game_slug then
    return query select false, 'rejected', 'game_rejected', null::text, null::text, null::text,
      null::integer, null::integer, null::integer, false, false, null::text;
    return;
  end if;

  v_display_name := btrim(coalesce(p_display_name, ''));
  v_normalized_name := lower(v_display_name);
  if char_length(v_display_name) < 1 or char_length(v_display_name) > 20 then
    return query select false, 'rejected', 'invalid_name', null::text, null::text, null::text,
      null::integer, null::integer, null::integer, false, false, null::text;
    return;
  end if;

  if p_score is null or p_score < 0 or p_score > c.score_ceiling then
    return query select false, 'rejected', 'invalid_score', null::text, null::text, null::text,
      null::integer, null::integer, null::integer, false, false, null::text;
    return;
  end if;

  if p_client_version is distinct from c.client_version
     or p_rule_version is distinct from c.rule_version
     or p_season is distinct from c.season then
    return query select false, 'rejected', 'version_rejected', null::text, null::text, null::text,
      null::integer, null::integer, null::integer, false, false, null::text;
    return;
  end if;

  if p_play_id is null or p_play_id !~ '^[A-Za-z0-9_-]{1,128}$' then
    return query select false, 'rejected', 'invalid_play_id', null::text, null::text, null::text,
      null::integer, null::integer, null::integer, false, false, null::text;
    return;
  end if;

  -- Serialize the same play_id even when two submissions use different names.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_play_id, 0));

  select * into existing
  from private.namioshi_score_submissions
  where play_id = p_play_id
  for update;

  if found then
    if existing.game_slug is distinct from p_game_slug
       or existing.season is distinct from p_season
       or existing.normalized_name is distinct from v_normalized_name
       or existing.score is distinct from p_score
       or existing.client_version is distinct from p_client_version
       or existing.rule_version is distinct from p_rule_version then
      return query select false, 'rejected', 'play_id_conflict', null::text, null::text, null::text,
        null::integer, null::integer, null::integer, false, false, null::text;
      return;
    end if;

    select count(*)::integer,
      (array_agg(score order by created_at asc, play_id asc))[1],
      max(score)
    into v_new_count, v_first_score, v_best_score
    from private.namioshi_score_submissions
    where normalized_name = existing.normalized_name
      and season = existing.season
      and ranking_status = 'normal';
    return query select true, 'idempotent', 'already_recorded', existing.play_id,
      existing.normalized_name, existing.display_name, v_first_score, v_best_score,
      v_new_count, existing.is_first_play, existing.is_new_best, existing.verification_status;
    return;
  end if;

  insert into private.namioshi_rate_limits (normalized_name, window_started_at, attempt_count)
  values (v_normalized_name, v_now, 0)
  on conflict (normalized_name) do nothing;

  select * into rate_row
  from private.namioshi_rate_limits
  where normalized_name = v_normalized_name
  for update;

  if v_now >= rate_row.window_started_at + make_interval(secs => c.window_seconds::double precision) then
    update private.namioshi_rate_limits
    set window_started_at = v_now, attempt_count = 0
    where normalized_name = v_normalized_name;
    rate_row.attempt_count := 0;
  end if;

  if rate_row.attempt_count >= c.max_attempts_per_window then
    return query select false, 'rejected', 'rate_limited', null::text, null::text, null::text,
      null::integer, null::integer, null::integer, false, false, null::text;
    return;
  end if;

  update private.namioshi_rate_limits
  set attempt_count = rate_row.attempt_count + 1
  where normalized_name = v_normalized_name;

  select count(*)::integer, max(score)
  into v_old_count, v_old_best
  from private.namioshi_score_submissions
  where normalized_name = v_normalized_name
    and season = c.season
    and ranking_status = 'normal';

  v_is_first_play := v_old_count = 0;
  v_is_new_best := v_is_first_play or p_score > v_old_best;

  insert into private.namioshi_score_submissions (
  play_id, game_slug, season, normalized_name, display_name, score,
    client_version, rule_version, verification_status, is_first_play, is_new_best, created_at
  ) values (
    p_play_id, c.game_slug, c.season, v_normalized_name, v_display_name, p_score,
    p_client_version, p_rule_version, c.verification_mode, v_is_first_play, v_is_new_best, v_now
  );

  select count(*)::integer,
    (array_agg(score order by created_at asc, play_id asc))[1],
    max(score)
  into v_new_count, v_first_score, v_best_score
  from private.namioshi_score_submissions
  where normalized_name = v_normalized_name
    and season = c.season
    and ranking_status = 'normal';

  return query select true, 'accepted', 'stored', p_play_id, v_normalized_name,
    v_display_name, v_first_score, v_best_score, v_new_count,
    v_is_first_play, v_is_new_best, c.verification_mode;
end;
$function$;

create or replace function public.get_namioshi_ranking_v1(p_limit integer default 10)
returns table (
  rank_no bigint,
  display_name text,
  best_score integer,
  play_count bigint,
  verification_status text
)
language sql
stable
security definer
set search_path = ''
as $function$
  with config as (
    select season
    from private.namioshi_ranking_config
    where config_id = 1 and enabled = true
  ), per_player as (
    select
      s.normalized_name,
      (array_agg(s.display_name order by s.created_at desc, s.play_id desc))[1] as display_name,
      max(s.score)::integer as best_score,
      count(*)::bigint as play_count,
      min(s.created_at) as first_play_at,
      max(s.verification_status) as verification_status
    from private.namioshi_score_submissions s
    where s.season = (select season from config)
      and s.ranking_status = 'normal'
    group by s.normalized_name
  ), ranked as (
    select
      row_number() over (
        order by best_score desc, first_play_at asc, display_name asc, normalized_name asc
      ) as rank_no,
      normalized_name,
      display_name,
      best_score,
      play_count,
      verification_status
    from per_player
    order by best_score desc, first_play_at asc, display_name asc, normalized_name asc
    limit least(greatest(coalesce(p_limit, 10), 1), 10)
  )
  select rank_no, display_name, best_score, play_count, verification_status
  from ranked
  order by rank_no;
$function$;

revoke execute on function public.submit_namioshi_score_v1(text, text, integer, text, text, text, text) from PUBLIC;
grant execute on function public.submit_namioshi_score_v1(text, text, integer, text, text, text, text) to anon;
revoke execute on function public.get_namioshi_ranking_v1(integer) from PUBLIC;
grant execute on function public.get_namioshi_ranking_v1(integer) to anon;

commit;
