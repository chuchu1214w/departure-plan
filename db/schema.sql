-- momo的植树计划 · 数据库结构
-- 在 Supabase 项目的 SQL Editor 里整段粘贴执行一次即可。

create extension if not exists "pgcrypto";

-- 所有表都按 user_id 隔离，配合下面的 RLS 策略，
-- 保证每个登录用户只能读写自己的数据（即便以后加别的用户也不会互相看到）。

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('event','study','work')),  -- 三个日历用同一张表，靠 kind 区分
  title text not null,
  note text default '',
  date date,              -- 单日事项（重大事件/学习日历用）
  start_at timestamptz,   -- 需要具体时间的用这个（比如面签几点）
  amount numeric,         -- 打工日历用：当天收入，单位韩币
  done boolean not null default false,
  source text not null default 'user' check (source in ('user','ai')),  -- 标记是不是 AI 生成的学习计划
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_user_date_idx on events(user_id, date);
create index if not exists events_user_kind_idx on events(user_id, kind);

alter table events enable row level security;

drop policy if exists "自己读自己的" on events;
create policy "自己读自己的" on events for select using (auth.uid() = user_id);

drop policy if exists "自己写自己的" on events;
create policy "自己写自己的" on events for insert with check (auth.uid() = user_id);

drop policy if exists "自己改自己的" on events;
create policy "自己改自己的" on events for update using (auth.uid() = user_id);

drop policy if exists "自己删自己的" on events;
create policy "自己删自己的" on events for delete using (auth.uid() = user_id);

-- 自动维护 updated_at
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists events_set_updated_at on events;
create trigger events_set_updated_at before update on events
  for each row execute function set_updated_at();
