# Đưa Olympia Controller lên mạng

Trang web là trang tĩnh (HTML, CSS, JavaScript), không cần máy chủ riêng. Mọi đường dẫn trong code là đường dẫn tương đối, nên trang chạy được ở gốc tên miền (`https://ten.github.io/`) hay trong thư mục con (`https://ten.github.io/olympia/`). Phần dữ liệu (tài khoản, phòng, bộ đề, kênh thời gian thực) nằm ở dự án Supabase ghi trong `Scripts/Config.js`.

## 1. Chuẩn bị Supabase

Chạy lần lượt các file trong `supabase/migrations/` bằng SQL Editor, theo đúng thứ tự số: 0001 đến 0009. Mỗi file chạy lại nhiều lần cũng không sao.

Trong Dashboard của dự án:

1. Authentication → Sign In / Providers: bật Anonymous sign-ins (màn sân khấu, khán giả, thí sinh, bảng điểm đăng nhập ẩn danh). Giữ Allow new users to sign up ở trạng thái bật; việc chặn tự đăng ký do hook `before_user_created` làm.
2. Authentication → Hooks: hook Before User Created trỏ tới hàm `public.before_user_created`.
3. Authentication → URL Configuration: đặt Site URL là địa chỉ trang sau khi đưa lên, ví dụ `https://ten.github.io/olympia/`, và thêm vào Redirect URLs dòng `https://ten.github.io/olympia/**`. Thiếu bước này thì đăng nhập bằng Google sẽ quay về sai trang.
4. Database → Extensions (tuỳ chọn): bật `pg_cron` rồi chạy lại 0008 để phòng hết hạn được xoá mỗi giờ. Không bật thì phòng hết hạn được xoá khi có người quản lý mở sảnh.

Khoá `anon` trong `Scripts/Config.js` được phép công khai. Khoá `service_role` không bao giờ được đưa vào code.

### Nhận yêu cầu tài khoản

Nút "Yêu cầu một tài khoản" ở trang đăng nhập cần ba dịch vụ: Cloudflare Turnstile (captcha), Resend (gửi email) và Edge Function `request-account` trong `supabase/functions/`.

1. Cloudflare Dashboard → Turnstile → Add widget, thêm tên miền của trang (ví dụ `respirable.github.io`). Chép Site Key vào `turnstileSiteKey` trong `Scripts/Config.js`. Giữ Secret Key cho bước 4. Khi để trống Site Key, trang dùng khoá thử của Cloudflare trên `localhost`; ở tên miền thật thì biểu mẫu không gửi.
2. Tạo tài khoản Resend và lấy API key. Nếu chưa xác minh tên miền riêng, Resend chỉ gửi được tới email đã dùng để đăng ký Resend. Hãy đăng ký Resend bằng chính email sẽ nhận yêu cầu.
3. Sau khi chạy 0009, đặt mã gác cổng trong SQL Editor (một chuỗi ngẫu nhiên dài từ 24 ký tự trở lên):
   ```
   insert into public.account_request_gate (id, secret) values (1, 'chuoi-ngau-nhien-dai')
   on conflict (id) do update set secret = excluded.secret;
   ```
4. Dashboard → Edge Functions → Secrets, thêm: `TURNSTILE_SECRET` (Secret Key ở bước 1), `REQUEST_GATE` (chuỗi ở bước 3), `RESEND_API_KEY`, `ADMIN_EMAIL` (email nhận yêu cầu), và `MAIL_FROM` nếu đã có tên miền gửi thư.
5. Dashboard → Edge Functions → Deploy a new function → Via Editor, đặt tên `request-account`, dán nội dung `supabase/functions/request-account/index.ts`, tắt "Verify JWT", rồi Deploy. Dùng CLI thì chạy `supabase functions deploy request-account --no-verify-jwt`.

Mỗi yêu cầu được lưu trong bảng `account_requests`, kể cả khi email không gửi được. Email gửi về `ADMIN_EMAIL` có sẵn các câu SQL để cấp tài khoản cho người đó.

## 2. Những gì không đưa lên

`.gitignore` đã bỏ qua `Questions/` (bộ đề thật trên máy sân khấu) và `.claude/`. Khi không có `Questions/`, trang dùng bộ đề mẫu trong `Demo/`; bộ đề thật nên tải lên bằng trang Quản lý câu hỏi.

Thư mục `O24/` (đồ hoạ) và `Sounds/` (âm thanh) có thể thuộc bản quyền của chương trình gốc. Đây là lý do repo đang để private.

## 3. Chọn nơi chạy trang

GitHub Pages với repo private chỉ dùng được trên gói trả phí (GitHub Pro, Team hoặc Enterprise). Có ba cách:

1. Repo `respirable/olympia` để private, chạy trang bằng Cloudflare Pages (miễn phí với repo private). Trong Cloudflare: Workers & Pages → Create → Pages → kết nối GitHub → chọn repo → Framework preset: None, Build command để trống, Build output directory: `/`. Mỗi lần push lên `main` trang tự cập nhật.
2. Gói GitHub trả phí: Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`.
3. Gộp vào site github.io có sẵn: chép toàn bộ thư mục (trừ `Questions/`, `.git/`, `.claude/`) vào một thư mục con của repo site đó, ví dụ `olympia/`, rồi push repo site. Repo site github.io phải public, nên đồ hoạ và âm thanh sẽ công khai.

File `.nojekyll` ở gốc giữ GitHub Pages không xử lý trang bằng Jekyll. Cloudflare bỏ qua file này. `web.config` chỉ dùng cho IIS trên máy này, các nơi khác bỏ qua.

## 4. Đưa code lên

Code đã commit trên nhánh `main` ở máy này, remote `origin` là `https://github.com/respirable/olympia.git`. Bạn tự đẩy lên:

```
cd C:\inetpub\wwwroot\2015_Retro
git push -u origin main
```

## 5. Kiểm tra sau khi đưa lên

1. Mở `index.html` trên địa chỉ mới, đăng nhập bằng tài khoản quản lý (cả email lẫn Google).
2. Tạo phòng, mở Quản lý trận (trận tự chạy trên máy này sau vài giây) và Vào màn sân khấu trên máy chiếu, bấm vài phím. Chọn "Âm thanh phát ở: Màn sân khấu" rồi bấm nút bật âm thanh trên màn sân khấu, nghe thử. Tải lại màn sân khấu giữa chừng: trận không bị ảnh hưởng.
3. Mở Vào thi trên điện thoại, vào bằng mật khẩu BTC, bấm chuông ở lượt chung Khởi động.
4. Mở Hiện màn khán giả và Hiện bảng điểm, quét mã QR trong Chia sẻ liên kết trận bằng điện thoại.
5. Ở Quản lý câu hỏi, tạo một bộ đề, tải ảnh Tăng tốc lên, chọn Dùng cho phòng này, tải lại màn sân khấu và xem ảnh có hiện không.

Mỗi phòng dùng được 4 tiếng kể từ lúc tạo. Muốn thử lâu hơn thì tạo phòng mới.
