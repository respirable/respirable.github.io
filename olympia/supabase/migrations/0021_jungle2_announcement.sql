-- =====================================================================================
-- Olympia Controller - notice for Luật rừng 2 in "Thông báo & cập nhật" (lobby, Scripts/News.js).
-- Run AFTER 0013 (and 0020, which adds the rules). Safe to re-run: the notice has a fixed id, so
-- it is added only once and a copy you edited or deleted in the lobby is left as it is.
-- =====================================================================================

insert into public.announcements (id, kind, title, body, created_by)
	values ('5f0c2a1e-0d23-4b7a-9e15-000000000002', 'update', 'Luật rừng 2',
		E'Đã thêm luật chơi Luật rừng 2, chọn khi tạo phòng. Luật này dùng đồ hoạ Olympia 26 và điểm có thể âm.\n\n'
		'### Khởi động\n'
		'- Lượt riêng như Olympia 26, mỗi thí sinh 10 câu.\n'
		'- Lượt chung 16 câu, bấm chuông trả lời sai không bị trừ điểm.\n'
		'- Lượt bảng 6 câu: 2 ô 10 điểm, 2 ô 15 điểm, 2 ô 20 điểm. MC chọn ô, thí sinh bấm chuông. Đúng được điểm của ô, sai không bị trừ và người khác được bấm lại một lần.\n\n'
		'### Vượt chướng ngại vật\n'
		'- Giải đúng chướng ngại vật được 10, 10, 5, 5 điểm theo số hàng ngang đã mở (5 điểm sau câu hỏi trung tâm).\n'
		'- Giải sai bị trừ 10, 25, 50, 75 điểm theo số hàng ngang đã mở (100 điểm sau câu hỏi trung tâm).\n'
		'- Trả lời đúng hàng ngang không được điểm. Thí sinh còn chơi mà không trả lời đúng hàng ngang bị trừ 5 điểm.\n'
		'- Hết 15 giây cuối mà không ai giải được, mỗi thí sinh còn chơi bị trừ 20 điểm.\n\n'
		'### Tăng tốc\n'
		'- Thời gian 20, 20, 30, 30 giây.\n'
		'- Trả lời đúng theo thứ tự nhanh nhất được +5, -10, -25, -40 điểm. Sai hoặc không trả lời bị trừ 40 điểm.\n\n'
		'### Về đích\n'
		'- Câu 20 điểm trong bộ đề thành câu 0 điểm, câu 30 điểm thành câu 5 điểm.\n'
		'- Câu 0 điểm: đúng 0 (có ngôi sao 5), sai -20 (có ngôi sao -40).\n'
		'- Câu 5 điểm: đúng 5 (có ngôi sao 10), sai -30 (có ngôi sao -60).\n'
		'- Cướp đúng được 5 hoặc 10 điểm, lấy từ thí sinh đang thi. Cướp sai bị trừ 10 hoặc 15 điểm.\n\n'
		'Luật rừng và Luật rừng 2 không còn là bản thử nghiệm (bỏ nhãn BETA).',
		null)
	on conflict (id) do nothing;
