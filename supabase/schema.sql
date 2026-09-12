-- Fitness OS schema for Supabase (free tier).
-- Paste this file into the SQL editor in the Supabase dashboard.

create table if not exists public.meal_logs (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  meal_name text not null,
  serving_inferred text,
  calories double precision not null default 0,
  protein_g double precision not null default 0,
  carbs_g double precision not null default 0,
  fats_g double precision not null default 0,
  fiber_g double precision not null default 0,
  iron_mg double precision not null default 0,
  zinc_mg double precision not null default 0,
  magnesium_mg double precision not null default 0,
  vitamin_d_iu double precision not null default 0,
  calcium_mg double precision not null default 0,
  vitamin_b12_mcg double precision not null default 0,
  breakdown_summary text,
  query text,
  logged_at timestamptz not null default now()
);

create index if not exists meal_logs_user_logged_at_idx
  on public.meal_logs (user_id, logged_at desc);

create table if not exists public.workout_sessions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  completed_at timestamptz
);

create index if not exists workout_sessions_user_started_idx
  on public.workout_sessions (user_id, started_at desc);

create table if not exists public.exercise_logs (
  id text primary key,
  session_id text not null references public.workout_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_name text not null,
  set_number integer not null default 1,
  weight_kg double precision,
  reps double precision,
  completed boolean not null default false
);

create index if not exists exercise_logs_session_idx
  on public.exercise_logs (session_id);

create index if not exists exercise_logs_user_idx
  on public.exercise_logs (user_id);

alter table public.meal_logs enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.exercise_logs enable row level security;

drop policy if exists "meal_logs_select_own" on public.meal_logs;
create policy "meal_logs_select_own"
  on public.meal_logs for select
  using (auth.uid() = user_id);

drop policy if exists "meal_logs_insert_own" on public.meal_logs;
create policy "meal_logs_insert_own"
  on public.meal_logs for insert
  with check (auth.uid() = user_id);

drop policy if exists "meal_logs_update_own" on public.meal_logs;
create policy "meal_logs_update_own"
  on public.meal_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "meal_logs_delete_own" on public.meal_logs;
create policy "meal_logs_delete_own"
  on public.meal_logs for delete
  using (auth.uid() = user_id);

drop policy if exists "workout_sessions_select_own" on public.workout_sessions;
create policy "workout_sessions_select_own"
  on public.workout_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "workout_sessions_insert_own" on public.workout_sessions;
create policy "workout_sessions_insert_own"
  on public.workout_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "workout_sessions_update_own" on public.workout_sessions;
create policy "workout_sessions_update_own"
  on public.workout_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "workout_sessions_delete_own" on public.workout_sessions;
create policy "workout_sessions_delete_own"
  on public.workout_sessions for delete
  using (auth.uid() = user_id);

drop policy if exists "exercise_logs_select_own" on public.exercise_logs;
create policy "exercise_logs_select_own"
  on public.exercise_logs for select
  using (auth.uid() = user_id);

drop policy if exists "exercise_logs_insert_own" on public.exercise_logs;
create policy "exercise_logs_insert_own"
  on public.exercise_logs for insert
  with check (auth.uid() = user_id);

drop policy if exists "exercise_logs_update_own" on public.exercise_logs;
create policy "exercise_logs_update_own"
  on public.exercise_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "exercise_logs_delete_own" on public.exercise_logs;
create policy "exercise_logs_delete_own"
  on public.exercise_logs for delete
  using (auth.uid() = user_id);
