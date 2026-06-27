-- CivicPulse Supabase schema. Run once in the Supabase SQL editor.
-- Mirrors the old Firestore collections as Postgres tables. Writes go through
-- the service-role key (API routes / agent / seed); the browser only reads via
-- realtime, so RLS grants public SELECT and no anon write.

-- ── issues ────────────────────────────────────────────────
create table if not exists issues (
  id text primary key,
  reporter_id text not null default 'anonymous',
  photo_url text not null default '',
  lat double precision not null,
  lng double precision not null,
  address text not null default '',
  ward_id text not null default '',
  category text not null default 'other',
  severity text not null default 'low',
  ai_description text not null default '',
  ai_confidence int not null default 0,
  department text not null default '',
  extracted_entities text[] not null default '{}',
  predicted_resolution_min_days int not null default 0,
  predicted_resolution_max_days int not null default 0,
  status text not null default 'reported',
  is_predicted boolean not null default false,
  predicted_category text,
  prediction_confidence int,
  based_on_count int,
  historical_pattern text,
  verifier_ids text[] not null default '{}',
  verification_count int not null default 0,
  agent_review_count int not null default 0,
  last_agent_review_at timestamptz,
  escalated_at timestamptz,
  escalation_dept text,
  escalation_attempts int not null default 0,
  merged_into_issue_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists issues_status_idx on issues (status);
create index if not exists issues_ward_idx on issues (ward_id);

-- ── agent_activity (live feed) ────────────────────────────
create table if not exists agent_activity (
  id uuid primary key default gen_random_uuid(),
  issue_id text not null,
  issue_category text not null default '',
  issue_address text not null default '',
  reasoning text not null default '',
  action_taken text not null default '',
  action_detail text not null default '',
  confidence_score int not null default 0,
  chain_step int not null default 0,
  is_self_correction boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists agent_activity_issue_idx on agent_activity (issue_id);
create index if not exists agent_activity_time_idx on agent_activity (created_at desc);

-- ── agent_memory ──────────────────────────────────────────
create table if not exists agent_memory (
  issue_id text primary key,
  last_action text not null default '',
  last_action_at timestamptz,
  action_history text[] not null default '{}',
  cooldown_until timestamptz,
  escalation_attempts int not null default 0
);

-- ── profiles (citizens) ───────────────────────────────────
create table if not exists profiles (
  uid text primary key,
  display_name text not null default 'Citizen',
  photo_url text not null default '',
  xp int not null default 0,
  badge text not null default 'newcomer',
  ward_id text not null default '',
  reported_issue_ids text[] not null default '{}',
  verified_issue_ids text[] not null default '{}'
);

-- ── wards ─────────────────────────────────────────────────
create table if not exists wards (
  ward_id text primary key,
  ward_name text not null default '',
  total_reported int not null default 0,
  total_resolved int not null default 0,
  total_predicted int not null default 0,
  avg_resolution_days double precision not null default 0,
  health_score int not null default 0,
  last_updated timestamptz not null default now()
);

-- ── city_metrics (single row id='current') ────────────────
create table if not exists city_metrics (
  id text primary key,
  civic_score int not null default 0,
  total_open_issues int not null default 0,
  total_resolved_this_month int not null default 0,
  avg_resolution_days double precision not null default 0,
  active_wards_count int not null default 0,
  weekly_delta int not null default 0,
  last_updated timestamptz not null default now()
);

-- ── Row Level Security: public read, writes only via service role ──
do $$
declare t text;
begin
  foreach t in array array['issues','agent_activity','agent_memory','profiles','wards','city_metrics']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;
end $$;

-- ── Realtime: stream these tables to the browser ──────────
alter publication supabase_realtime add table issues;
alter publication supabase_realtime add table agent_activity;
alter publication supabase_realtime add table city_metrics;

-- ── Storage bucket for issue photos (public read) ─────────
insert into storage.buckets (id, name, public)
values ('issues', 'issues', true)
on conflict (id) do nothing;
