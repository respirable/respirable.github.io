-- =====================================================================================
-- Olympia Controller - pictures and videos in "Thông báo & cập nhật" (Scripts/News.js).
-- Run AFTER 0013. Safe to re-run.
--
-- A PUBLIC bucket "news": anyone can see a file (the news are public), only a site admin
-- (is_site_admin, 0013) can upload, replace or delete one. Files go under <user id>/<name>.
-- An announcement only holds the file's https address; the lobby shows it as an <img> / <video>,
-- never as HTML.
-- =====================================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
	values ('news', 'news', true, 52428800,
		array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'])
	on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
		allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "news: site admins upload" on storage.objects;
drop policy if exists "news: site admins change" on storage.objects;
drop policy if exists "news: site admins delete" on storage.objects;
create policy "news: site admins upload" on storage.objects for insert to authenticated
	with check (bucket_id = 'news' and (select public.is_site_admin()));
create policy "news: site admins change" on storage.objects for update to authenticated
	using (bucket_id = 'news' and (select public.is_site_admin()))
	with check (bucket_id = 'news' and (select public.is_site_admin()));
create policy "news: site admins delete" on storage.objects for delete to authenticated
	using (bucket_id = 'news' and (select public.is_site_admin()));
