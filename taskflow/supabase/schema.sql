-- TaskFlow — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run

-- ─── TASKS ────────────────────────────────────────────────────────────────────
create table if not exists tasks (
  id              uuid primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  title           text not null,
  category        text,
  priority        text default 'p2',
  status          text default 'todo',
  deadline        text,
  notes           text,
  progress        integer default 0,
  progress_log    jsonb,
  estimated_minutes integer,
  created_at      timestamptz default now(),
  done_at         timestamptz,
  goal_id         uuid,
  recurring       text,
  checklist       jsonb
);
alter table tasks enable row level security;
create policy "own tasks" on tasks for all using (auth.uid() = user_id);

-- ─── GOALS ────────────────────────────────────────────────────────────────────
create table if not exists goals (
  id              uuid primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  title           text not null,
  category        text,
  status          text default 'active',
  progress        integer default 0,
  deadline        text,
  notes           text,
  cover_emoji     text,
  created_at      timestamptz default now()
);
alter table goals enable row level security;
create policy "own goals" on goals for all using (auth.uid() = user_id);

-- ─── MILESTONES ───────────────────────────────────────────────────────────────
create table if not exists milestones (
  id              uuid primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  goal_id         uuid references goals(id) on delete cascade,
  title           text not null,
  status          text default 'todo',
  created_at      timestamptz default now()
);
alter table milestones enable row level security;
create policy "own milestones" on milestones for all using (auth.uid() = user_id);

-- ─── IDEAS ────────────────────────────────────────────────────────────────────
create table if not exists ideas (
  id              uuid primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  content         text,
  category        text,
  status          text default 'active',
  pinned          boolean default false,
  enrichment      jsonb,
  created_at      timestamptz default now()
);
alter table ideas enable row level security;
create policy "own ideas" on ideas for all using (auth.uid() = user_id);

-- ─── RESOURCES (Library) ──────────────────────────────────────────────────────
create table if not exists resources (
  id              uuid primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  url             text,
  title           text,
  summary         text,
  tags            jsonb,
  reason          text,
  status          text default 'toread',
  notes           text,
  reading_minutes integer,
  created_at      timestamptz default now()
);
alter table resources enable row level security;
create policy "own resources" on resources for all using (auth.uid() = user_id);

-- ─── WEEKLY REVIEWS ───────────────────────────────────────────────────────────
create table if not exists weekly_reviews (
  id              uuid primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  week_start      text,
  ai_summary      text,
  created_at      timestamptz default now()
);
alter table weekly_reviews enable row level security;
create policy "own weekly_reviews" on weekly_reviews for all using (auth.uid() = user_id);

-- ─── USER PREFERENCES ─────────────────────────────────────────────────────────
create table if not exists user_preferences (
  user_id         uuid references auth.users(id) on delete cascade primary key,
  ai_provider     text,
  ai_model        text,
  notify_done     boolean default true,
  notify_overdue  boolean default true,
  auto_reminder   boolean default true,
  data            jsonb,           -- widget layout + priority rules
  updated_at      timestamptz default now()
);
alter table user_preferences enable row level security;
create policy "own preferences" on user_preferences for all using (auth.uid() = user_id);
