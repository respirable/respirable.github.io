# Nhiệm vụ

Hãy tạo một file PDF tiếng Việt tên **"Siêu hướng dẫn sử dụng Olympia HTML5"** (tên file gợi ý: `SIEU_HUONG_DAN_OLYMPIA_HTML5.pdf`). Bạn chưa biết gì về dự án này; mọi dữ kiện cần thiết nằm ở phần "Tư liệu" bên dưới. Nếu bạn truy cập được thư mục dự án (`C:\inetpub\wwwroot\2015_Retro\`), hãy đọc các file được nêu tên để kiểm chứng và lấy thêm chi tiết; khi tư liệu và mã nguồn khác nhau, tin mã nguồn và ghi chú lại chỗ khác.

Người đọc: (a) người điều khiển buổi thi, không cần biết lập trình, và (b) người mới muốn sửa hoặc mở rộng controller, biết JavaScript cơ bản, có thể đã quen bộ WWTBAM HTML5 Controller. Chương 1, 2, 7 viết cho nhóm (a); chương 3, 4, 5 cho nhóm (b); chương 6 cho cả hai.

---

# Cấu trúc bắt buộc

Trang bìa, mục lục, rồi 7 chương theo đúng thứ tự:

1. **Olympia HTML5 là gì?** Định nghĩa, nguồn gốc, thành phần.
2. **Hướng dẫn sử dụng và điều khiển.** Khởi chạy, màn đồ hoạ, màn quản lý, bảng phím, luồng từng vòng thi, luật tính điểm đang cài.
3. **Hướng dẫn chỉnh sửa tính năng.** Ba phần: (3.1) chỉnh đồ hoạ, (3.2) chỉnh animation, (3.3) chỉnh cơ chế có sẵn của vòng thi, tách hai mức: không đụng logic (cấu hình, âm thanh, đề) và có đụng logic (đổi phím, đổi điều kiện, thêm bước).
4. **Hướng dẫn thêm tính năng.** (4.1) thêm đồ hoạ / animation, (4.2) thêm cơ chế mới cho vòng thi (phím mới, nút mới trên màn quản lý, thông tin mới trên màn quản lý, âm thanh mới), (4.3) thêm vòng thi, dùng vòng "Câu hỏi phụ" làm ví dụ xuyên suốt.
5. **Cơ chế hoạt động chi tiết.** Kiến trúc hai trang, đồng bộ, vòng đời một phím, bộ đếm bước của 4 vòng (vẽ đủ cả 4 sơ đồ trạng thái), hệ thống âm thanh 7 kênh, đồng hồ chung, khởi động trang, đọc XML.
6. **So sánh với WWTBAM HTML5 Controller** (thư mục `WWTBAM Original Project` trong dự án).
7. **Một số lưu ý khác khi chạy.**

Phụ lục (nếu còn chỗ): bảng tra nhanh phím; bảng tra nhanh "muốn làm X thì mở file Y".

---

# Yêu cầu hình minh hoạ

## Biểu đồ và sơ đồ (tự vẽ, dạng vector)

Tối thiểu các hình sau, đánh số "Hình N" kèm chú thích:

- Kiến trúc hai trang và chiều dữ liệu (phím / lệnh đi một chiều, bản chụp trạng thái đi chiều ngược lại).
- Nhóm file theo thứ tự nạp trong `default.html`.
- Vòng đời một phím qua ba tầng: `KeyboardController.js` → hàm bước trong `Rounds/*.js` → hàm đồ hoạ / âm thanh → `changed()` cập nhật màn quản lý.
- Sơ đồ trạng thái của bộ đếm từng vòng (4 hình: KĐ, VCNV, TT, VĐ), mũi tên ghi phím chuyển bước.
- Quyết định trong `Keyboard.dispatch` (khoá F6 → phím vòng → phím chung).
- Đường đi một lệnh từ nút trên màn quản lý tới hàm trên trang đồ hoạ.
- Nhạc nền 3 đoạn (intro / đoạn lặp / outro) của `kd_60s.mp3`.
- Bốn mẫu animation (A, B, C, D ở mục Tư liệu 3.2).
- Cấu tạo thanh thời gian (dải đỏ + chấm đỏ).
- Cây phần tử con của `.stageContainerDiv` và cái nào bị F6 ẩn.
- Chèn một bước mới mà không đánh số lại các bước cũ.
- So sánh luồng "phím → bộ đếm → lệnh" giữa WWTBAM gốc và Olympia.
- Bố cục màn quản lý dạng khung dây (wireframe) đánh số các vùng, khớp với phần mô tả ở chương 2.

## Hình ảnh có sẵn trong dự án (nếu truy cập được)

- `O24/Warm-up/text.png`, `O24/Beat the Obstacle/text.png`, `O24/Accelerate/text.png`, `O24/Finish Line/text.png`: thẻ tên 4 vòng (nên đặt trên nền tối `#0b1a3a`, ảnh có nền trong suốt).
- `O24/Warm-up/question_bar.png`, `O24/Warm-up/contestant_bar.png`, `O24/Beat the Obstacle/Obstacle/question_bar.png`, `O24/Accelerate/Question/question_contents_bar.png`, `O24/Finish Line/choosing_question_value_bar.png`: các thành phần đồ hoạ.
- `WWTBAM Original Project/Images/Large_Strap_Unedited.png`: thanh câu hỏi của bộ gốc, để so sánh ở chương 6.

## Vùng trống cho ảnh chụp màn hình (tôi sẽ tự chèn sau)

Tạo đúng các khung giữ chỗ dưới đây, mỗi khung:
- viền nét đứt xám 1.5 pt, nền `#f4f6fa`, kích thước cố định: ảnh màn đồ hoạ tỉ lệ 16:9 rộng 170 mm (cao 95.6 mm); ảnh màn quản lý rộng 170 mm, cao 110 mm;
- giữa khung ghi chữ: `ẢNH CHỤP MÀN HÌNH #N` và một dòng mô tả cần chụp gì;
- dưới khung là chú thích "Hình N. ..." như hình thường;
- không để khung bị cắt ngang giữa hai trang.

Danh sách khung:

| # | Nội dung cần chụp | Chương |
|---|---|---|
| S1 | Màn đồ hoạ lúc mới mở (chỉ có nền) | 2 |
| S2 | Màn quản lý toàn trang, vòng Khởi động | 2 |
| S3 | Khởi động: thanh câu hỏi + 4 thanh tên, một thí sinh đang bấm chuông | 2 |
| S4 | VCNV: ô chữ + ảnh + thanh câu hỏi, có tên người xin trả lời CNV | 2 |
| S5 | Cây đáp án VCNV sau khi chấm | 2 |
| S6 | Tăng tốc: khung câu hỏi có ảnh và thanh thời gian | 2 |
| S7 | Về đích: màn chọn gói 20 / 30 điểm | 2 |
| S8 | Về đích: nhóm câu hỏi, có ngôi sao hy vọng | 2 |
| S9 | Bảng tổng kết điểm (phím M) | 2 |
| S10 | Bảng kết quả F6 | 2 |
| S11 | Màn quản lý, tab Tăng tốc (ô nhập đáp án + thời gian + nút "Ghế N đúng") | 2 |
| S12 | Console F12 của `default.html` khi gõ `window.GameVariables` | 3 |
| S13 | Màn đồ hoạ WWTBAM gốc (câu hỏi + 4 đáp án) | 6 |

---

# Yêu cầu trình bày và giọng văn

- Khổ A4, lề khoảng 15 mm, font hỗ trợ đầy đủ dấu tiếng Việt (ví dụ Segoe UI / Noto Sans), mã nguồn dùng font đơn cách (Consolas / JetBrains Mono) trong khối có nền nhạt.
- Mỗi chương bắt đầu trang mới. Bảng và khối mã không bị cắt ngang trang khi tránh được.
- Cách làm gợi ý nếu bạn có môi trường chạy lệnh: viết một trang HTML có SVG nội tuyến và CSS in ấn (`@page`), rồi in ra PDF bằng Chrome / Edge chạy nền (`--headless --print-to-pdf --no-pdf-header-footer`). Sau khi in, xem lại vài trang để chắc hình không tràn chữ, khung ảnh không bị cắt.
- Quy tắc viết (bắt buộc):
  - không dùng tính từ khoa trương ("quan trọng", "then chốt", "tuyệt vời", "mạnh mẽ") khi không có dữ kiện đi kèm;
  - không dùng các cụm nối sáo ("hơn nữa", "ngoài ra", "bên cạnh đó", "không chỉ... mà còn...", "tóm lại", "nhìn chung", "có thể thấy", "điều đáng chú ý là");
  - không dùng gạch ngang dài (—) để nối ý; dùng dấu phẩy, hai chấm hoặc tách câu;
  - tiêu đề chỉ viết hoa chữ đầu; in đậm chỉ cho thuật ngữ hoặc từ khoá tra cứu; không emoji;
  - không bịa dữ kiện: điều gì không có trong tư liệu hoặc mã nguồn thì không viết, hoặc ghi rõ là chưa chắc;
  - dùng danh sách khi các mục thật sự song song; phần giải thích cơ chế viết thành đoạn văn.

---

# Tư liệu

## T1. Định nghĩa và nguồn gốc

- Olympia HTML5 (trong mã gọi là "Olympia Controller") là bộ điều khiển đồ hoạ và âm thanh chạy trên trình duyệt để dựng lại gameshow "Đường lên đỉnh Olympia" (VTV) cho một buổi thi tổ chức tại chỗ: 4 thí sinh, 4 vòng Khởi động (KĐ), Vượt chướng ngại vật (VCNV), Tăng tốc (TT), Về đích (VĐ). Vòng thứ 5 "Câu hỏi phụ" đã được dành chỗ (phím F5, mã vòng `tb`) nhưng chưa có mã.
- Viết bằng HTML, CSS và JavaScript thuần, không thư viện, không bước build; chép thư mục vào IIS là chạy.
- Thư mục dự án: `C:\inetpub\wwwroot\2015_Retro\`. Dự án thay thế một bộ WWTBAM ("Ai là triệu phú") HTML5 Controller từng nằm ở cùng thư mục (ngày 2026-09-11). Bộ WWTBAM gốc được giữ trong thư mục con `WWTBAM Original Project`.
- Ngày 2026-09-23 toàn bộ mã JavaScript được viết lại theo đúng lối của bộ WWTBAM gốc (bản mà người dùng gọi là Olga V2.5): hàm toàn cục, trạng thái là biến phẳng trong `window.GameVariables`, một bộ đếm bước cho mỗi vòng, mọi phím nằm trong một file `KeyboardController.js`. Mục đích: người đã quen sửa bộ WWTBAM đọc và sửa được ngay.
- Đồ hoạ lấy từ bộ ảnh trong thư mục `O24/` (mỗi vòng một thư mục: `Warm-up`, `Beat the Obstacle`, `Accelerate`, `Finish Line`). Âm thanh nằm trong `Sounds/`, tên ASCII theo vòng (`kd_`, `vcnv_`, `tt_`, `vd_`), được chép và đổi tên từ một bộ âm thanh gốc tên tiếng Việt.

## T2. Thành phần và bản đồ file

Hai trang:
- `default.html`: màn đồ hoạ (đưa lên máy chiếu / phát sóng). Là trang duy nhất phát âm thanh và giữ trạng thái thật ("authority").
- `control.html`: màn quản lý của người điều khiển ("remote"). Hiển thị trạng thái, gửi phím và lệnh sang `default.html`. Nạp `Variables.js`, `StateSync.js`, `KeyboardController.js`, `ControlPanel.js`.

File theo thứ tự nạp trong `default.html`:

| File | Chứa gì |
|---|---|
| `Scripts/Variables.js` | Cấu hình (khối *Initialization Variables*: điểm, thời gian, file dữ liệu, âm thanh) và mọi biến trạng thái, chia khối Sequence Counters / Boolean / Number / String / Array / Audio / Interval-Timeout; cuối file là hàm dùng chung (`createPlayer`, `getPlayer`, `displayName`, `vdOrder`, `ttRankPoints`, `normalizeAnswer`, `answerMatches`, `vcnvLength`) |
| `Scripts/StateSync.js` | Đồng bộ hai trang (BroadcastChannel tên `olympia`, localStorage khoá `olympia.state`, nhịp tim `olympia.authority` mỗi 1 giây) |
| `Scripts/AudioControl.js` | 7 kênh âm thanh, nhạc nền có đoạn lặp |
| `Scripts/TimerControl.js` | Đồng hồ chung `startClock / stopClock / isClockRunning` (dùng requestAnimationFrame) |
| `Scripts/QuestionLoader.js` | Để trống, nội dung đã chuyển vào `Init.js` |
| `Scripts/StageControl.js` | Nền, thẻ tên vòng, hàm dựng phần tử `newElement`, `newImage`, `newGlare`, hằng `TIMER_DOT = 18` |
| `Scripts/ScoreboardControl.js` | 4 thanh tên thí sinh, `addScore`, `setScore`, chuông, người trên sân khấu |
| `Scripts/ScoreSummaryControl.js` | Bảng tổng kết điểm (phím M) |
| `Scripts/ScoreBoardScreenControl.js` | Bảng kết quả hiện tại (F6) |
| `Scripts/VcnvControl.js` | Đồ hoạ VCNV: ảnh 5 mảnh, ô chữ 4 hàng, thanh câu hỏi, thẻ tên người xin trả lời |
| `Scripts/VcnvTreeControl.js` | Cây đáp án, dùng chung cho VCNV và Tăng tốc |
| `Scripts/TangTocControl.js` | Khung câu hỏi Tăng tốc (ảnh hoặc video) |
| `Scripts/VeDichControl.js` | Màn chọn gói, nhóm câu hỏi, hộp điểm, ngôi sao hy vọng (`star.webm`) |
| `Scripts/QuestionControl.js` | Thanh câu hỏi Khởi động, đồng hồ đếm 3-2-1 |
| `Scripts/GeneralControl.js` | `switchRound()`, `leaveRound()`, `enterRound()`, `pressKey()` |
| `Scripts/Rounds/KhoiDong.js`, `VCNV.js`, `TangToc.js`, `VeDich.js` | Hàm bước của từng vòng; mỗi hàm tự đặt bộ đếm sang bước mới |
| `Scripts/KeyboardController.js` | Mọi phím: `handleRoundKey(key, round)`, `handleGlobalKey(key)`, và `GameVariables.Keyboard.dispatch / dispatchTo / switchRound / init` |
| `Scripts/PanelStateControl.js` | `buildRoundStateForPanel()`: đổi biến phẳng + bộ đếm thành object theo vòng, phase dạng chữ, cho màn quản lý |
| `Scripts/PanelCommands.js` | 24 lệnh từ nút màn quản lý: `playSound stopSounds setScore setName resetNames kdKey vcnvKey ttKey vdKey kdReset kdResetCommon kdClearBuzz kdSetDone vcnvReset vcnvReveal vcnvFinish vcnvUnEliminate vcnvSetAnswers ttSetAnswers ttReset ttGoto vdReset vdGoto vdSetOrder` |
| `Scripts/Init.js` | `init()` khi trang tải xong; `getContestantsForGame()`, `getAllQuestionsForGame()`, các hàm đọc XML, lưu tên gõ tay |
| `Scripts/ControlPanel.js` | Toàn bộ màn quản lý (chỉ `control.html` nạp) |
| `Styles/olympia.css`, `Styles/control.css` | Giao diện hai trang |
| `Questions/players.xml`, `khoidong.xml`, `vcnv.xml`, `tangtoc.xml`, `vedich.xml` | Thí sinh và đề; mỗi file có chú thích cách điền ở đầu. Ảnh / video của đề cũng để trong `Questions/` (ví dụ `tt1.png`, `tt4.mp4`, `vcnv_picture.png`) |
| `web.config` | Cấu hình IIS: trang mặc định, kiểu MIME cho font / âm thanh / video, tắt bộ nhớ đệm |
| `CHECKLIST.md` | Danh sách bước kiểm tra từng vòng |

## T3. Hướng dẫn sử dụng và điều khiển

### Khởi chạy
Mở `http://localhost/2015_Retro/` (trang mặc định là `default.html`) trên máy chiếu / màn phát, và `http://localhost/2015_Retro/control.html` trên màn của người điều khiển, **cùng một trình duyệt, cùng một máy**. Sân khấu cố định 1920×1080 px, không tự co giãn: đặt màn phát ở 1920×1080, zoom trình duyệt 100 %, bấm F11 toàn màn hình. Bấm một phím bất kỳ trên trang đồ hoạ trước khi thi để trình duyệt cho phép phát âm thanh.

### Màn quản lý (các vùng, từ trên xuống)
Tiêu đề (tên vòng đang thi) và đồng hồ đang chạy; ba "chip" trạng thái (người đang thi, thang điểm, trạng thái bước); câu hỏi hiện tại và đáp án (chỉ host thấy); 4 ô thống kê theo vòng; thanh nút hành động của vòng đang thi (nút của phím nên bấm tiếp được làm nổi); bảng âm thanh (phát chồng, không đổi trạng thái vòng; nút "Dừng tất cả âm"); bảng phím tắt đầy đủ; tab theo vòng, tự chuyển theo vòng đang thi:
- KĐ: đặt lại cả vòng / lượt chung, xoá chuông, đánh dấu ghế đã thi.
- VCNV: ô nhập đáp án 4 thí sinh cho hàng đang mở kèm nút "Ghế N đúng" (tự đánh dấu khi đáp án gõ khớp đáp án trong XML), "Ai đúng chướng ngại vật", "Tất cả người xin đều sai, loại" (không hỏi xác nhận), "Khôi phục quyền thi cho ghế…", "Mở hết ảnh + đáp án", đặt lại.
- TT: ô đáp án + thời gian (giây, ví dụ 1.25) cho 4 ghế, tự lưu khi rời ô, tự đánh dấu đúng khi khớp, nút "Ghế N đúng" trong từng dòng, "Chạy lại câu…", đặt lại.
- VĐ: thứ tự thi dạng "Tên A --> Tên B --> Tên C --> Tên D", "Đổi thứ tự thi…", "Chạy lại lượt của ghế…", đặt lại.
Tiếp theo: điểm số (sửa tay điểm từng ghế), tên thí sinh (đặt tên, "Về tên trong players.xml"; tên gõ tay được nhớ trên máy), khu "Màn đồ hoạ" (trạng thái kết nối, nút F1 đến F4, "Xin trạng thái"). Nhãn "KĐ" và "Loại CNV" trên bảng điểm chỉ hiện trong vòng tương ứng.

### Phím chung

| Phím | Tác dụng |
|---|---|
| F1 / F2 / F3 / F4 / F5 | Chuyển vòng KĐ / VCNV / TT / VĐ / Câu hỏi phụ (F5 chưa có nội dung) |
| M | Tổng kết điểm: mở (điểm thấp nhất trước) / người kế / đóng. Bị từ chối khi đồ hoạ vòng còn trên màn |
| F6 | Bảng kết quả hiện tại bật / tắt. Khi bảng mở, mọi phím khác bị khoá trừ F6 và dấu chấm |
| . (dấu chấm) | Tiếng "ô trống" `blank.ogg` |
| 0 | Ẩn / hiện dải thanh tên thí sinh (trừ lúc VCNV đang xét người xin trả lời CNV) |
| Z / X | +10 / −5 cho người đang hoạt động (dự phòng) |
| 1-4 ngoài vòng | Bật / tắt cờ bấm chuông của ghế (thử nghiệm) |

Không giữ phím (phím lặp bị bỏ qua); phím gõ trong ô nhập liệu không được tính.

### Luồng từng vòng (phím → việc)

**Khởi động**, lượt riêng: 4 thí sinh × 6 câu. ← thẻ tên vòng + `kd_start`; ← thí sinh kế lên sân khấu + `kd_ready`; ← thanh câu hỏi (có dải đồng hồ) + thanh tên hiện lần lượt + `kd_open_question`; → câu 1 + nhạc nền `kd_60s` (lặp đến câu cuối); Space đếm 3-2-1; ↑ đúng +10 `kd_correct`; ↓ sai `kd_wrong`, không trừ; → câu kế; sau câu 6 → đồ hoạ tắt, 1 giây sau `kd_complete`; ← lặp cho thí sinh kế. Lượt chung (sau thí sinh thứ 4): 12 câu, ← `kd_ready`; ← thanh câu hỏi không dải đồng hồ; → câu 1; 1-4 bấm chuông (người đầu tiên khoá câu, `kd_buzz`); ↑ +10 cho người bấm; ↓ −5 cho người bấm, không ai bấm thì chỉ phát tiếng; Backspace xoá chuông bấm nhầm; hết câu 12 → tắt; ← sang VCNV.

**VCNV**: ← thẻ tên + `vcnv_start`; ← bảng ô chữ + ảnh + thanh câu hỏi + `vcnv_open_board`. 1-4 chọn hàng (ô tròn xanh sáng, `vcnv_select_row`); U huỷ chọn khi chưa hiện câu; 5 câu ô trung tâm (chỉ khi 4 hàng đã hỏi, CNV chưa giải). → hiện câu (`vcnv_open_question`); → thanh 15 giây + `vcnv_15s`; 1-4 đánh dấu ghế trả lời đúng hàng (chỉ đánh dấu, điểm cộng lúc chấm); → cây đáp án (`vcnv_open_answers`); → chấm: hàng đúng hiện chữ + `vcnv_row_correct`, sai xám + `vcnv_row_wrong`, cộng +10 mỗi ghế đúng (ô trung tâm +10); → cất cây; → mở mảnh ảnh nếu hàng đúng (`vcnv_open_picture`). Q / W / E / R: ghế 1-4 xin trả lời CNV (khoá luồng hàng ngay, tên hiện dưới thanh câu hỏi, `vcnv_signal`); bấm lại phím của ghế đã xin (hoặc 1-4) = ghế đó đúng: điểm theo số hàng đã mở 1:60, 2:50, 3:40, 4:30, sau khi mở ô trung tâm 20; mở toàn bộ, `vcnv_solved`. Backspace bỏ người xin cuối; 0 tất cả người xin đều sai, bị loại khỏi phần còn lại của vòng (`vcnv_row_wrong`). Khi đủ 5 câu mà chưa ai giải: → mở 15 giây chót; hết giờ → mở toàn bộ, không ai có điểm. Tất cả bị loại: → mở toàn bộ. ← tắt đồ hoạ; ← sang TT.

**Tăng tốc**: 4 câu, thời gian 20, 20, 30, 30 giây (ghi đè bằng thuộc tính `seconds` trong XML). ← thẻ tên + `tt_start`; ← câu 1: thanh câu hỏi + khung ảnh / video + `tt_open_question`; → đồng hồ + `tt_20s` / `tt_30s`, video bắt đầu chạy; người điều khiển gõ đáp án và thời gian trên màn quản lý; → cây đáp án (xếp theo thời gian) + `tt_open_answers`; 1-4 đánh dấu đúng; B xem lại khung câu hỏi / ảnh đáp án, B lần nữa về cây (→ bị khoá khi đang xem lại); → chấm: ghế đúng xếp theo thời gian nhận 40 / 30 / 20 / 10, bằng thời gian thì bằng điểm và người kế nhận hạng kế tiếp không bỏ hạng (1.25, 1.25, 2.29 → 40, 40, 30); `vcnv_row_correct` / `vcnv_row_wrong`; → cất cây; → câu kế. Sau câu 4 → tắt; ← ← sang VĐ.

**Về đích**: ← thẻ tên + `vd_start`; ← thứ tự thi theo điểm hiện tại, cao trước (bằng điểm: ghế số nhỏ trước), người đầu lên sân khấu (`vd_ready`, chỉ âm thanh); ← màn chọn gói + `vd_choose`; 2 / 3 chọn câu 20 / 30 điểm (3 lượt chọn, `vd_pick`), U bỏ lượt chọn cuối; ← `vd_open_question`, 2 giây sau nhóm câu hỏi và hộp điểm phóng to vào, thanh câu hỏi trống; S đặt ngôi sao hy vọng (mỗi thí sinh một lần, cho câu chưa hiện); → hiện câu; → đồng hồ (20 điểm: 15 giây `vd_15s`, 30 điểm: 20 giây `vd_20s`); ↑ đúng: + giá trị (×2 nếu có ngôi sao) `vd_correct`; ↓ sai: có ngôi sao thì − giá trị; không phát tiếng sai, mở 5 giây giành quyền (`vd_5s`, thanh chạy ngược); 1-4 ghế khác bấm giành (`kd_buzz`); ↑ người giành đúng: + giá trị cho họ, − giá trị cho người trên sân khấu (trừ khi có ngôi sao); ↓ người giành sai: − nửa giá trị; → câu kế; sau câu 3: nhóm câu hỏi tắt, `vd_turn_complete`; ← người kế (thứ tự tính lại theo điểm, trừ khi host đã đặt tay); sau người thứ 4 ← tắt đồ hoạ.

Luật chung: điểm không bao giờ xuống dưới 0. Tên hiển thị = 2 chữ cuối của họ tên (tên mặc định "Thí sinh N" hiện đủ). Tự đánh dấu đúng: so khớp không phân biệt hoa thường, dấu câu, khoảng trắng (có phân biệt dấu tiếng Việt); đáp án XML dạng "a / b" chấp nhận cả hai; đánh dấu tự động bị gỡ nếu đáp án gõ bị sửa thành sai, đánh dấu tay không bao giờ bị động tới.

## T4. Cơ chế hoạt động

**Trạng thái**: mọi thứ là biến phẳng trong `window.GameVariables`, tên bắt đầu bằng tên vòng (`VcnvCurrentRow`, `IsTangTocReviewing`, `VeDichSeat`...). Không có biến ẩn trong closure.

**Bộ đếm bước** (giống `QuestionSequenceCounter` của WWTBAM gốc):

```
KĐ    KhoiDongSequenceCounter  0 idle 1 title 2 ready 3 set 4 question 5 done 6 finished
VCNV  VcnvSequenceCounter      0 idle 1 title 2 board 3 rowSelected 4 rowQuestion 5 rowTimer
                               6 rowAnswers 7 rowGraded 8 rowBack 9 guessing 10 finalWindow 11 finished 12 done
TT    TangTocSequenceCounter   0 idle 1 title 2 question 3 timer 4 answers 5 graded 6 blank 7 finished 8 done
VĐ    VeDichSequenceCounter    0 idle 1 title 2 stageCall 3 choose 4 ready 5 question 6 timer 7 steal
                               8 stealAnswer 9 answered 10 blank 11 finished 12 done
```
Mảng `KhoiDongPhaseNames`, `VcnvPhaseNames`, `TangTocPhaseNames`, `VeDichPhaseNames` chứa các tên trên; màn quản lý in trạng thái theo tên.

**Vòng đời một phím**: `keydown` → `GameVariables.Keyboard.dispatch(key)`: nếu bảng F6 mở và phím không phải F6 / dấu chấm thì bỏ; gọi `handleRoundKey(key, CurrentRound)` (khối `if (key == 'ArrowRight') // key 'right arrow' for ...` → `if (round == 'vcnv') { if (vcnv == 4) { vcnvStartTimer(); } ... }`), trả `true` nếu vòng đã dùng phím; nếu `false` thì `handleGlobalKey(key)`; xong gọi `GameVariables.changed()` (StateSync gom thay đổi, gửi một bản chụp mỗi khung). Ví dụ: → ở VCNV bước 4 gọi `vcnvStartTimer()`, hàm này bật `IsVcnvTimerRunning`, gọi `startObstacleTimer()`, `startShortPassiveSound('vcnv_15s.mp3')`, `startClock({...})`, đặt `VcnvSequenceCounter = 5`. Trên `control.html`, phím không xử lý tại chỗ mà được chuyển nguyên sang trang đồ hoạ (`Sync.sendKey`).

**Nút màn quản lý**: `gv.Sync.sendCommand(tên, tham số)` → StateSync trên trang đồ hoạ gọi `GameVariables.Commands[tên](tham số)` (định nghĩa trong `PanelCommands.js`) → lệnh `*Key` gọi `Keyboard.dispatchTo(vòng, phím)` tức chạy đúng nhánh như phím thật. Nút có thuộc tính `data-cmd` + `data-key` trong HTML tự hoạt động không cần JavaScript; `data-sendkey` gửi phím chung.

**Màn quản lý đọc trạng thái**: `StateSync.buildSnapshot()` gồm người chơi, vòng hiện tại, `roundState: buildRoundStateForPanel()`, tổng kết (`SummaryState`), F6, đồng hồ (`TimerState`), nhạc nền (`BedState`). Ghi vào localStorage và gửi qua BroadcastChannel; màn quản lý vẽ lại từ bản chụp. Trang đồ hoạ thứ hai được phát hiện qua nhịp tim và hiện cảnh báo đỏ.

**Chuyển vòng**: `switchRound(id)`: `leaveRound(cũ)` dọn đồ hoạ vòng cũ (bộ đếm giữ nguyên nên F-phím quay lại được); xoá chuông; đóng tổng kết nếu đang mở; `enterRound(mới)`: VCNV / TT / VĐ chưa bắt đầu thì hiện thẻ tên ngay; KĐ chờ ← đầu tiên.

**Âm thanh**: 7 kênh, mỗi kênh một HTMLAudioElement, giữ tên hàm của WWTBAM gốc:

| Hàm | Kênh | Dùng cho |
|---|---|---|
| `startGeneralSound(f)` | StingerSound | tiếng ngắn, chồng được |
| `startLongActiveSound(f)` | ResultSound | đúng / sai |
| `startShortPassiveSound(f)` / `stopShortPassiveSound()` | TimerSound | nhạc đồng hồ một câu |
| `startLongPassiveSound(f)` / `releaseLongPassiveSound()` / `stopLongPassiveSound()` | RoundBedSound | nhạc nền cả lượt |
| `playBuzzerSound()`, `startShortActiveSound(f)` | BuzzerSound | chuông, tín hiệu CNV |
| `startLifelineActiveSound(f)` | StarSound | ngôi sao hy vọng |
| `startLifelinePassiveSound(f)` | AmbientSound | nhạc tổng kết |
Nhạc nền `kd_60s.mp3` theo `BedLoops`: lặp 30 ↔ 50 giây, câu cuối nhảy tới 49 giây để phát phần kết (bỏ qua nếu đã cách 49 giây dưới 2 giây). Vòng lặp được theo dõi bằng setInterval 40 ms.

**Đồng hồ**: một đồng hồ chung; `startClock` mới huỷ cái cũ. Mọi thanh thời gian gồm `...Fill` (dải đỏ, đổi `width`) và `...Dot` (chấm đỏ 18 px, đổi `left`).

**Khởi động trang** (`init()` trong `Init.js`, có cảnh báo "DO NOT TAMPER"): đọc `players.xml` (lỗi thì dùng "Thí sinh 1..4") → đọc 4 file đề (file lỗi chỉ ghi lỗi, vòng đó hiện "(thiếu câu ...)") → dựng mọi đồ hoạ rồi ẩn, nền luôn hiện → bật đồng bộ → bật bàn phím. Âm thanh chỉ phát sau phím bấm.

## T5. Chỉnh sửa (dữ kiện cho chương 3)

Không đụng logic: điểm (`Points`, ví dụ `KD_WRONG_COMMON: -5`), thời gian (`Timings`; đổi thời gian thì nhạc đồng hồ vẫn dài như cũ, phải thay file), thay âm thanh (chép đè đúng tên cũ vào `Sounds/`), thêm âm thanh (thêm dòng `'ten.mp3': true` vào `SoundMap`, tự hiện trên bảng âm thanh; nhãn tiếng Việt thêm vào `soundLabels` trong `ControlPanel.js`), `BedLoops`, đề và tên trong `Questions/*.xml`, vị trí / kích thước đồ hoạ trong `olympia.css` (sân khấu 1920×1080, mọi phần tử `position: absolute`, toạ độ px).

Có đụng logic:
- Đổi âm thanh / hình ở một bước: sửa hàm bước trong `Rounds/*.js` (ví dụ `tangTocGradeQuestion` đang mượn `vcnv_row_correct.mp3`).
- Đổi phím: chuyển nhánh sang khối phím khác trong `KeyboardController.js`, sửa bảng phím đầu file và `data-key` của nút trong `control.html`. Tránh phím chung M, Z, X, 0, dấu chấm, F1-F6.
- Đổi điều kiện: ví dụ `else if (vd == 7) { if (window.GameVariables.VeDichStealSeat === null) { veDichCloseQuestion(); } }`.
- Thêm bước: không đánh số lại bước cũ; bước mới lấy số trống kế tiếp. Ví dụ thêm bước "scores" (số 9) sau bước 5 của TT: thêm tên vào cuối `TangTocPhaseNames`; viết `tangTocShowScores()` đặt bộ đếm = 9; trong khối `ArrowRight` nhánh `tt`: `tt == 5` gọi hàm mới, `tt == 9` cất cây; tìm mọi chỗ dùng số bước (`tangTocCanMark()` bước 2-4, phím B bước 4-5, `areRoundGraphicsOnScreen()` coi bước ≥ 7 là xong vòng); tuỳ chọn thêm nhãn vào `ttPhaseText` và `ttKeys()` trong `ControlPanel.js`. Lưu ý: nếu bước mới dùng bảng F6 thì phím bị khoá, → sẽ không chạy.

Animation (nguyên tắc: chỉ viết bằng CSS, JavaScript chỉ bật tắt class; không thêm hiệu ứng mờ dần / trượt ngoài những cái đã có trừ khi được yêu cầu; thoát luôn tức thì). Bốn mẫu:
- A. Phóng to khi vào bằng `.offstage`: `.questionBarDiv { transform-origin: 0 0; transform: scale(1); transition: transform 900ms cubic-bezier(0.16, 0.84, 0.44, 1); } .questionBarDiv.offstage { transform: scale(0.001); opacity: 0; }`.
- B. Thoát tức thì: thêm `noTransition` và `offstage`, `void root.offsetWidth;`, gỡ `noTransition`.
- C. Hai nhịp: thêm `.on` (hiện), hai `requestAnimationFrame` sau mới thêm `.in` (chạy transition); dùng khi phần tử `display: none` lúc ẩn (khung TT, nhóm câu hỏi VĐ, cây đáp án).
- D. Loé sáng một lần: `newGlare(class, parent)` tạo `glare.png` với `@keyframes`, tự gỡ `.on` khi xong.

## T6. Thêm tính năng (dữ kiện cho chương 4)

Ví dụ thêm đồ hoạ: dải chữ "GIẢI LAO" bật tắt bằng phím G: (1) `default.html` thêm `<div class="breakDiv offstage"><p class="breakTextP">GIẢI LAO</p></div>` là con trực tiếp của `.stageContainerDiv`; (2) CSS theo mẫu A, `left: 560px; top: 440px; width: 800px; height: 200px; transform-origin: 50% 50%; transition: transform 600ms linear;`; (3) file `Scripts/BreakControl.js` có `showBreakBanner`, `hideBreakBanner` (mẫu B), `toggleBreakBanner`, nạp trước `KeyboardController.js`; (4) `gameVariables.IsBreakBannerShowing = false;`; (5) trong `handleGlobalKey`: `if (lower == 'g') { toggleBreakBanner(); return true; }`; muốn chặn phím M khi đang hiện thì thêm vào `areRoundGraphicsOnScreen()`.

Phím mới: phím chung vào `handleGlobalKey`, phím vòng vào `handleRoundKey` (trả `true` / `false`); phím có tác dụng mặc định của trình duyệt thêm vào `SWALLOWED_KEYS`.

Nút mới: loại làm việc của phím có sẵn chỉ cần `<button data-cmd="vdKey" data-key="s">`; loại làm việc mới cần 3 chỗ: lệnh trong `PanelCommands.js`, nút có `id` trong `control.html`, `addEventListener('click', ...)` gọi `gv.Sync.sendCommand('ten', {...})` trong `ControlPanel.js`.

Thông tin mới trên màn quản lý: thêm trường vào khối vòng trong `buildRoundStateForPanel()` rồi đọc trong hàm `render...` của `ControlPanel.js`; biến không thuộc vòng thì thêm vào `buildSnapshot()` của `StateSync.js`.

Âm thanh ở một bước: thêm lời gọi hàm âm thanh vào hàm bước; trễ thì `setTimeout(function () { startGeneralSound('x.mp3'); }, 1000);`.

Thêm vòng thi, ví dụ Câu hỏi phụ (mã `tb`, phím F5 đã dành): luật đã thống nhất với người dùng: chỉ dùng khi cả 4 thí sinh đã thi xong Về đích; màn quản lý phát hiện nhóm bằng điểm cao nhất và nhóm bằng điểm cao nhì (≥ 2 người), người điều khiển chọn nhóm cần phân định; mỗi câu: → hiện câu (`tt_open_question`), Space chạy đồng hồ 15 giây liên tục (`vcnv_15s`), 1-4 bấm chuông (`kd_buzz`, chỉ ghế trong nhóm và chưa sai ở câu đó); ↑ đúng (`kd_correct`, dừng đồng hồ): người đó xếp trên, những người còn lại tiếp tục thi với nhau; ↓ sai: không phát tiếng, người đó mất quyền ở câu này, đồng hồ vẫn chạy cho người khác giành; tất cả sai hoặc hết giờ: sang câu kế; còn một người: phân định xong (`vcnv_solved`). Không đổi điểm, không thẻ tên vòng, chỉ hiện thanh tên của nhóm đang thi. Các chỗ phải thêm: bộ đếm `CauHoiPhuSequenceCounter` + `CauHoiPhuPhaseNames` và biến trong `Variables.js`; `Questions/cauhoiphu.xml` + hàm đọc trong `Init.js`; `Scripts/Rounds/CauHoiPhu.js`; nhánh `round == 'tb'` trong `KeyboardController.js`; `leaveRound` / `enterRound` trong `GeneralControl.js`; khối `tb` trong `PanelStateControl.js`; lệnh `tbKey`, `tbReset`... trong `PanelCommands.js`; tab + thanh nút trong `control.html`, hàm vẽ trong `ControlPanel.js`, đổi `tabForRound` từ `tb: 'vd'` thành `tb: 'tb'`.

Quy tắc an toàn: mọi file dùng chung một không gian tên (đặt tiền tố theo vòng / theo đồ hoạ, hằng số viết hoa có tiền tố, tìm tên trước khi đặt); `control.html` cũng nạp `Variables.js`, `StateSync.js`, `KeyboardController.js` nên không gọi hàm đồ hoạ ở cấp cao nhất trong ba file này; không chạm DOM ở cấp cao nhất của file; chữ lên màn hình dùng `textContent`, không `innerHTML`; hàm đồ hoạ phải chịu được khi phần tử chưa có (`if (!root) { return; }`); đồ hoạ mới là con trực tiếp của `.stageContainerDiv` (CSS `.stageContainerDiv.boardMode > div:not(.stageBackgroundDiv):not(.boardScreenDiv)` ẩn chúng khi F6 mở); thay đổi trạng thái trong `setTimeout`, `onDone` của đồng hồ hay sự kiện `ended` phải tự gọi `window.GameVariables.changed()`.

Kiểm tra: `node --check Scripts/<file>.js` (nếu có Node.js); F12 xem lỗi đỏ trên cả hai trang; chạy lại `CHECKLIST.md`; trong Console dùng `pressKey('ArrowLeft')` và xem `window.GameVariables.<Tên>SequenceCounter`.

Lỗi thường gặp: `xxx is not defined` (quên thẻ `<script>`, sai tên); phím không có tác dụng (sai bước, F6 đang mở, con trỏ trong ô nhập); chức năng cũ chạy sai (trùng tên hàm); không có hiệu ứng (thêm `.on` và `.in` cùng lúc); ẩn vẫn có hiệu ứng (thiếu `void root.offsetWidth`); màn quản lý không cập nhật (thiếu `changed()` hoặc thiếu trường trong `PanelStateControl.js`); âm thanh không phát (sai tên, chưa bấm phím nào trên trang đồ hoạ, thiếu file); âm thanh hai lần (hai tab `default.html`).

## T7. So sánh với WWTBAM HTML5 Controller gốc

Số dòng đếm bằng `wc -l` trên hai thư mục `Scripts` (Olympia tổng 4927 dòng gồm `ControlPanel.js` 776; gốc tổng 4944 dòng gồm jQuery nén).

| WWTBAM gốc | Olympia | Ghi chú |
|---|---|---|
| `Variables.js` (196) | `Variables.js` (394) | cùng khuôn IIFE, chia khối theo kiểu biến; Olympia thêm bảng bộ đếm và hàm dùng chung |
| `KeyboardController.js` (1326), 25 nhánh `e.keyCode ==` | `KeyboardController.js` (303) | gốc so `keyCode` và viết lệnh jQuery ngay trong nhánh; Olympia so `e.key`, thêm tầng "vòng", nhánh gọi hàm bước |
| `QuestionSequenceCounter`, `MoneyTreeSequenceCounter` | 4 bộ đếm, mỗi vòng một | |
| `AudioControl.js` (198) | `AudioControl.js` (180) | giữ tên hàm gốc; Olympia thêm nhạc nền có đoạn lặp |
| `TimerControl.js` (933) | `TimerControl.js` (60) | Olympia chỉ có một đồng hồ chung |
| `Init.js` (285) | `Init.js` (183) | cùng cảnh báo "DO NOT TAMPER"; gốc đọc XML bằng `$.ajax` với `async: false`, Olympia dùng `fetch` bất đồng bộ, đọc 5 file |
| `GeneralControl.js` (89): logo, âm thanh theo cấp câu hỏi (`playLightsDownSound`, `playCorrectAnswerSound`...) | `GeneralControl.js` (61): chuyển vòng | |
| `QuestionAndAnswerControl.js` (308) | `QuestionControl.js`, `TangTocControl.js`, `VeDichControl.js`, `VcnvControl.js` | mỗi vòng một kiểu thanh câu hỏi |
| `MoneyTreeControl.js` (357) | `ScoreboardControl.js`, `ScoreBoardScreenControl.js` | thang tiền → thanh điểm 4 người + bảng F6 |
| `WinningsControl.js` (139) | `ScoreSummaryControl.js` | số tiền thắng → tổng kết điểm |
| `ContestantsControl.js` (22) | `getContestantsForGame()` trong `Init.js` | 1 người chơi → 4 |
| `FastestFingerControl.js` (144) | `VcnvTreeControl.js` | nhiều người trả lời, xếp theo thời gian |
| `LifelineControl.js` (911) | ngôi sao hy vọng trong `VeDichControl.js` / `Rounds/VeDich.js` | |
| `CameraControl.js`, `jquery-2.1.1.min.js`, `jquery.3d.js`, `accounting.js` | không có | Olympia không dùng jQuery |
| không có | `StateSync.js`, `ControlPanel.js`, `PanelStateControl.js`, `PanelCommands.js`, `control.html` | gốc chỉ điều khiển bằng bàn phím trên chính trang đồ hoạ; Olympia có màn quản lý thứ hai |

Khác biệt khác: gốc là 1 trang, 1 người chơi, 15 cấp câu hỏi, thao tác DOM bằng jQuery `.transition()`; Olympia 2 trang đồng bộ, 4 người, 4 vòng, DOM thuần (`querySelector`, `classList`), animation chỉ bằng CSS. Ảnh gốc nằm trong `WWTBAM Original Project/Images/`, ảnh Olympia trong `O24/`.

## T8. Lưu ý khi chạy

- Phải chạy qua IIS (hoặc máy chủ web khác), không mở file bằng đường dẫn `file://` (trình duyệt chặn `fetch` đọc XML). Mọi đuôi file phục vụ phải có trong `web.config` (thiếu sẽ bị lỗi 404.3); `web.config` đã khai báo font, mp3 / ogg / oga / wav, video, và tắt bộ nhớ đệm để bản sửa có hiệu lực ngay khi tải lại.
- Hai trang cùng trình duyệt, cùng máy (BroadcastChannel và localStorage không đi qua máy khác). Chỉ một tab `default.html`; tab thứ hai hiện cảnh báo đỏ và âm thanh sẽ lặp.
- Sân khấu cố định 1920×1080, không co giãn: màn phát 1920×1080, zoom 100 %, F11.
- Trình duyệt chặn âm thanh cho tới khi trang đồ hoạ nhận một thao tác của người dùng: bấm một phím trên `default.html` trước khi bắt đầu.
- Video Tăng tốc phát không tiếng (`muted`). Clip ngôi sao `O24/Finish Line/star.webm` là tuỳ chọn: thiếu file thì chỉ không có hình ngôi sao.
- Thiếu hoặc lỗi file XML: vòng đó hiện "(thiếu câu ...)", không làm sập trang. Lỗi cú pháp XML xem ở Console.
- Tên gõ trên màn quản lý được lưu trong localStorage của máy, ưu tiên hơn `players.xml`; đổi máy thì phải gõ lại hoặc dùng "Về tên trong players.xml".
- F6 khoá mọi phím trừ F6 và dấu chấm. M bị từ chối khi đồ hoạ vòng còn trên màn.
- Nút "Tất cả người xin đều sai, loại" không hỏi xác nhận; bấm nhầm thì dùng "Khôi phục quyền thi cho ghế…".
- Không giữ phím; phím lặp bị bỏ qua. Phím gõ trong ô nhập liệu của màn quản lý không điều khiển buổi thi.
