-- =====================================================================================
-- Olympia Controller - the first notice in "Thông báo & cập nhật" (lobby, Scripts/News.js).
-- Run AFTER 0013. Safe to re-run: the notice has a fixed id, so it is added only once and a
-- copy you edited or deleted in the lobby is left as it is.
-- =====================================================================================

insert into public.announcements (id, kind, title, body, created_by)
	values ('5f0c2a1e-0d23-4b7a-9e15-000000000001', 'update', 'Olympia 23 và bảng thông báo',
		E'- Đã thêm luật chơi Olympia 23.\n- Đã thêm cái bảng thông báo này.\n- Sửa thêm vài lỗi về animation Tăng tốc.\n- Hết rồi.',
		null)
	on conflict (id) do nothing;
