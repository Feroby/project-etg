-- Run this in Supabase SQL Editor to add usage tracking
create table if not exists api_usage (
  id uuid primary key default gen_random_uuid(),
  coach text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost_usd numeric(10, 8) not null default 0,
  created_at timestamp default now()
);

alter table api_usage enable row level security;
create policy "Allow all" on api_usage for all using (true);
