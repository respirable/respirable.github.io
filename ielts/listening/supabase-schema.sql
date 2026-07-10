-- ============================================================
-- IELTS Listening Tests Table
-- Run this in your Supabase SQL Editor
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.ielts_listening_tests (
  id uuid primary key default gen_random_uuid(),
  share_code text unique,
  title text not null default 'Untitled IELTS Listening Test',
  test_data jsonb not null,
  created_at timestamptz not null default now()
);

create unique index if not exists ielts_listening_tests_share_code_key
  on public.ielts_listening_tests (share_code)
  where share_code is not null;

alter table public.ielts_listening_tests enable row level security;

drop policy if exists "Anyone can create IELTS listening tests" on public.ielts_listening_tests;
create policy "Anyone can create IELTS listening tests"
  on public.ielts_listening_tests
  for insert
  to anon
  with check (true);

drop policy if exists "Anyone can read IELTS listening tests" on public.ielts_listening_tests;
create policy "Anyone can read IELTS listening tests"
  on public.ielts_listening_tests
  for select
  to anon
  using (true);

-- ============================================================
-- Supabase Storage Bucket for audio files
-- Run this ONCE in your Supabase SQL Editor
-- (or create via Dashboard → Storage → New Bucket)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listening-audio',
  'listening-audio',
  true,
  52428800,   -- 50 MB per file
  array['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac']
)
on conflict (id) do nothing;

drop policy if exists "Anyone can upload listening audio" on storage.objects;
create policy "Anyone can upload listening audio"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'listening-audio');

drop policy if exists "Anyone can read listening audio" on storage.objects;
create policy "Anyone can read listening audio"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'listening-audio');
