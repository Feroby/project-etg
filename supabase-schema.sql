-- Project ETG Database Schema
-- Run this in Supabase SQL Editor

-- Settings / profile
create table if not exists settings (
  id integer primary key default 1,
  -- Body & nutrition targets
  goal_weight numeric,
  current_weight numeric,
  target_date text,
  daily_calories integer,
  daily_protein integer,
  daily_carbs integer,
  daily_fat integer,
  daily_water numeric,
  -- Recovery baselines
  hrv_baseline integer,
  hrv_minimum integer,
  sleep_target numeric,
  whoop_min_recovery integer,
  whoop_max_strain numeric,
  -- Training profile
  training_days_per_week integer,
  current_block text,
  athlete_background text,
  -- Guardrail thresholds
  hrv_flag_days integer default 3,
  strain_flag_days integer default 2,
  weight_plateau_days integer default 10,
  updated_at timestamp default now()
);

insert into settings (id) values (1) on conflict (id) do nothing;

-- Daily logs
create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  -- Nutrition
  weight numeric,
  calories integer,
  protein integer,
  carbs integer,
  fat integer,
  water numeric,
  meal_quality text,
  nutrition_notes text,
  -- Recovery
  hrv integer,
  rhr integer,
  sleep_hours numeric,
  sleep_quality integer,
  whoop_recovery integer,
  whoop_strain numeric,
  soreness integer,
  recovery_notes text,
  -- Coach outputs (stored as text)
  nutrition_output text,
  recovery_output text,
  central_output text,
  created_at timestamp default now()
);

-- Strength sessions (separate table — multiple per week, not daily)
create table if not exists strength_sessions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  week_number integer,
  day_type text, -- e.g. "Day 1 — Lower (squat focus)"
  rpe numeric,
  duration integer,
  feel text,
  session_detail text,
  session_notes text,
  coach_output text,
  created_at timestamp default now()
);

-- Chat messages for each coach
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  coach text not null, -- 'nutrition' | 'recovery' | 'strength' | 'central'
  role text not null,  -- 'user' | 'assistant'
  content text not null,
  created_at timestamp default now()
);

-- Guardrail flags log
create table if not exists guardrail_flags (
  id uuid primary key default gen_random_uuid(),
  flag_type text not null,
  message text not null,
  resolved boolean default false,
  created_at timestamp default now()
);

-- Enable RLS but allow all for single user app
alter table settings enable row level security;
alter table daily_logs enable row level security;
alter table strength_sessions enable row level security;
alter table chat_messages enable row level security;
alter table guardrail_flags enable row level security;

create policy "Allow all" on settings for all using (true);
create policy "Allow all" on daily_logs for all using (true);
create policy "Allow all" on strength_sessions for all using (true);
create policy "Allow all" on chat_messages for all using (true);
create policy "Allow all" on guardrail_flags for all using (true);
