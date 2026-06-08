create extension if not exists pgcrypto;

create table if not exists public.ielts_tests (
  id uuid primary key default gen_random_uuid(),
  share_code text unique,
  title text not null default 'Untitled IELTS Reading Test',
  test_data jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.ielts_tests
  add column if not exists share_code text;

alter table public.ielts_tests
  add column if not exists title text not null default 'Untitled IELTS Reading Test';

alter table public.ielts_tests
  add column if not exists test_data jsonb;

alter table public.ielts_tests
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists ielts_tests_share_code_key
on public.ielts_tests (share_code)
where share_code is not null;

alter table public.ielts_tests enable row level security;

drop policy if exists "Anyone can create IELTS shared tests" on public.ielts_tests;
create policy "Anyone can create IELTS shared tests"
on public.ielts_tests
for insert
to anon
with check (true);

drop policy if exists "Anyone can read IELTS shared tests" on public.ielts_tests;
create policy "Anyone can read IELTS shared tests"
on public.ielts_tests
for select
to anon
using (true);
