# Variant Contract — WWTBAM Controller Sandbox

Tài liệu khảo sát, chỉ dựa trên nội dung 5 file trong `controller/`:
`main.js` (1817 dòng), `loader.js` (259), `sw.js` (281), `db.js` (136), `index.html` (2661).
Mọi số dòng dưới đây là số dòng thực tế tại thời điểm đọc.

---

## 1. variantKey + format → URL bundle trên R2

### 1.1. Nơi ghép

**Chỉ có một chỗ duy nhất**: `controller/main.js:1549`

```js
const zipUrl = (VARIANTS[variant] && VARIANTS[variant][format]) || VARIANTS['olga']['12'];
```

### 1.2. Quy tắc

**Không có quy tắc ghép chuỗi nào cả.** Đây là **tra bảng hai tầng**, không phải template URL:

- `VARIANTS` là object hằng khai báo tại `main.js:21-47`; toàn bộ 11 URL là **chuỗi literal viết tay**, không được sinh ra từ `variantKey` hay `format`.
- Tầng 1: `VARIANTS[variant]` — `variant` là `item.variantKey` lấy tại `main.js:1525`.
- Tầng 2: `[format]` — `format` là `selectedFormatId || item.defaultFormat`, lấy tại `main.js:1526`.
- Fallback: nếu cặp `(variant, format)` không tồn tại trong bảng, **im lặng** rơi về `VARIANTS['olga']['12']` (`main.js:1549`). Không log, không báo lỗi, không thông báo cho người dùng.

Luồng đầy đủ:
`index.html:2181` (nút `start-btn`, `onclick="startWithSelection()"`)
→ `main.js:1520` `startWithSelection()`
→ `main.js:1525-1526` đọc `variantKey` + format
→ `main.js:1531-1534` ghi `sessionStorage` + `localStorage` (`wwtbam-variant`, `wwtbam-format`)
→ `main.js:1536` gọi `downloadAndBootVariant(variant, format)`
→ `main.js:1549` tra bảng ra `zipUrl`
→ `main.js:1558` `loadBundle(zipUrl, onProgress)`.

Quy ước **đặt tên** của các literal (quan sát được, nhưng **code không hề dùng nó** để dựng URL):
`<Tên>.zip` cho format 15, `<Tên>_12q.<zip|rar>` cho format 12.

Host cố định: `https://pub-2d06308cf53245df865e113b0745c6d9.r2.dev/`
Chuỗi host này bị hard-code lặp lại ở 6 nơi: `main.js:23-45` (trong 11 URL), `main.js:1277` (`restoreDefaultQuestions`), `loader.js:45-46` (regex vá), `sw.js:11` (`R2_HOST`), `sw.js:212-213` (fallback XML).

### 1.3. Số lượng: **con số 9 trong câu hỏi không khớp với code**

Mảng `groups` (`main.js:1338-1382`) có **7 mục**, không phải 9:

| Group | id (main.js) | items |
|---|---|---|
| Project Olga (`main.js:1340`) | `olga` | 1 |
| Project Rave (`main.js:1349`) | `rave` | 4 |
| Project Classic (`main.js:1370`) | `classic` | 2 |
| **Tổng** | | **7** |

Và 7 mục đó sinh ra **11** URL phân biệt (không phải 9), vì 4 mục có 2 format:

| # | item.id | variantKey | format | URL | Dòng |
|---|---|---|---|---|---|
| 1 | `olga25` | `olga` | `12` ← default | `…r2.dev/OlgaV2.5_12q.zip` | main.js:23 |
| 2 | `olga25` | `olga` | `15` | `…r2.dev/OlgaV2.5.zip` | main.js:24 |
| 3 | `rave2007` | `2007_blue` | `12` | `…r2.dev/2007_Blue_12q.zip` | main.js:27 |
| 4 | `rave2007` | `2007_blue` | `15` ← default | `…r2.dev/2007_Blue.zip` | main.js:28 |
| 5 | `rave2008` | `2008_blue` | `12` | `…r2.dev/2008_Blue_12q.rar` | main.js:31 |
| 6 | `rave2008` | `2008_blue` | `15` ← default | `…r2.dev/2008_Blue.zip` | main.js:32 |
| 7 | `rave2017` | `2017_blue` | `12` | `…r2.dev/2017_Blue_12q.rar` | main.js:35 |
| 8 | `rave2017` | `2017_blue` | `15` ← default | `…r2.dev/2017_Blue.zip` | main.js:36 |
| 9 | `kbc2010` | `kbc_2010` | `12` ← default (duy nhất) | `…r2.dev/KBC_2010_12q.rar` | main.js:39 |
| 10 | `classic1998` | `1998_classic` | `15` ← default (duy nhất) | `…r2.dev/1998_Classic.zip` | main.js:42 |
| 11 | `endemol1999` | `1999_endemol` | `15` ← default (duy nhất) | `…r2.dev/1999_Endemol.zip` | main.js:45 |

(`…r2.dev` = `https://pub-2d06308cf53245df865e113b0745c6d9.r2.dev`)

Ba cách đếm khác cũng **không** ra 9:
- 7 mục menu × chỉ format mặc định = **7** URL (dòng 1, 4, 6, 8, 9, 10, 11 ở bảng trên).
- Số key trong `VARIANTS` (`main.js:21-47`) = **7**.
- Tổng số entry URL trong `VARIANTS` = **11**.

Nếu tài liệu gốc nói "9", nguồn của con số đó **KHÔNG XÁC ĐỊNH ĐƯỢC** từ code hiện tại.

### 1.4. Ghi chú phụ

- `formats` của mỗi item (`main.js:1344, 1353, 1357, 1361, 1365, 1374, 1378`) khớp đúng với các key có trong `VARIANTS` — hiện **không** có cặp `(variant, format)` nào của menu rơi vào fallback ở `main.js:1549`. Fallback này chỉ kích hoạt nếu ai đó thêm format vào `groups` mà quên thêm URL vào `VARIANTS`.
- 3 trong 11 bundle là `.rar` chứ không phải `.zip` (`main.js:31, 35, 39`) — xem mục 5.
- `main.js:1225-1233` có một `nameMap` thứ hai, lặp lại danh sách 7 `variantKey` chỉ để hiển thị trong tab Settings. Đây là nguồn dữ liệu trùng lặp thứ ba (cùng `VARIANTS` và `groups`); thêm variant mới mà quên chỗ này thì Settings hiển thị raw key.

---

## 2. Đổi biến thể: **KHÔNG** gọi `clearAll()` trước `loadBundle()`

### 2.1. Kết luận

Trên đường đi từ nút "Start controller" tới `loadBundle()`, **không có lời gọi `clearAll()` nào**.

### 2.2. Đoạn code quyết định

`controller/main.js:1539-1569` — toàn bộ thân `downloadAndBootVariant`, từ đầu đến `loadBundle`:

```js
async function downloadAndBootVariant(variant, format) {          // 1539
  const selectionOverlay = document.getElementById('selectionOverlay');
  if (selectionOverlay) selectionOverlay.classList.remove('active');

  const loadingScreen = document.getElementById('loadingScreen');
  if (loadingScreen) {
    loadingScreen.style.display = 'flex';
    loadingScreen.classList.remove('hidden');
  }

  const zipUrl = (VARIANTS[variant] && VARIANTS[variant][format]) || VARIANTS['olga']['12'];  // 1549
  const progressBar = document.getElementById('progressBar');
  const loadingStatus = document.getElementById('loadingStatus');

  try {
    await registerControllerServiceWorker();                       // 1555

    if (loadingStatus) loadingStatus.textContent = 'Downloading controller bundle...';
    await loadBundle(zipUrl, (loaded, total) => {                  // 1558  ← không có clearAll() phía trên
```

Giữa dòng 1539 và 1558 chỉ có: ẩn overlay, hiện loading screen, tra URL, đăng ký service worker. Không đụng tới IndexedDB.

`loadBundle` cũng không tự dọn — `loader.js:199-222` chỉ lặp và ghi đè:

```js
    // Step 3: Save each file to IndexedDB                         // 199
    let savedCount = 0;
    for (const entry of archiveEntries) {                          // 202
        …
        await saveFile(relativePath, fileData, mimeType);          // 220
        savedCount++;
    }
```

### 2.3. `clearAll()` được gọi ở đâu

Đúng **một** nơi: `main.js:1328`, trong `executeResetSandbox()` (`main.js:1315-1334`):

```js
async function executeResetSandbox() {                             // 1315
  …
    sessionStorage.removeItem('wwtbam-variant');                   // 1324
    sessionStorage.removeItem('wwtbam-format');
    localStorage.removeItem('wwtbam-variant');                     // 1326
    localStorage.removeItem('wwtbam-format');
    await clearAll();                                              // 1328
    toast.setComplete('Sandbox reset! Reloading...', true);
    setTimeout(() => location.reload(), 800);                      // 1330
```

Định nghĩa: `db.js:93-102`.

### 2.4. Hệ quả

**a) Ghi đè theo key, không thay thế toàn bộ.** `saveFile` (`db.js:37-47`) dùng `store.put({ path: path.toLowerCase(), … })` (`db.js:43`) trên object store keyPath `path` (`db.js:20`). Nạp bundle mới sẽ ghi đè các file trùng đường dẫn (sau khi lowercase), nhưng **mọi file của bundle cũ không có đối ứng trong bundle mới vẫn nằm nguyên trong IndexedDB** và service worker vẫn phục vụ chúng (`sw.js:157-204`).

Ví dụ cụ thể: đổi từ `2008_blue/15` (`2008_Blue.zip`, 15 câu) sang `kbc_2010/12` (`KBC_2010_12q.rar`, 12 câu). Ảnh/âm thanh riêng của 2008 Blue mà KBC 2010 không có sẽ tồn tại lẫn lộn trong danh sách file (`renderFileList`, `main.js:190`), chiếm dung lượng, và nếu bundle KBC tham chiếu một tên file trùng với tài sản cũ thì phục vụ nhầm nội dung cũ.

**b) Trong thực tế, đường đi này rất khó chạm tới.** `init()` (`main.js:1750-1784`) quyết định:

```js
    const hasData = await hasBundle();                             // 1759
    if (hasData && selectedVariant) {                              // 1761
      await bootController();                                      // 1762
    } else {
      // No data or no selection: Show the selection overlay
      const selOverlay = document.getElementById('selectionOverlay');
      if (selOverlay) selOverlay.classList.add('active');           // 1766
```

`selectedVariant` đọc từ storage tại `main.js:17`. Nên khi đã có bundle **và** đã lưu lựa chọn, trang boot thẳng vào controller, overlay chọn biến thể không hiện ra nữa.

Không tìm thấy nút/handler nào để mở lại `selectionOverlay` sau khi đã boot (đã tra toàn thư mục `controller/`: `selectionOverlay` chỉ xuất hiện tại `index.html:2157`, `main.js:1540-1541`, `1598-1599`, `1765-1766`, `1776-1777` — tất cả đều là *ẩn* overlay hoặc hiện lúc khởi tạo).

⇒ **Cách duy nhất được UI hỗ trợ để đổi biến thể là Settings → Reset**, tức `executeResetSandbox()`, và đường đó **có** `clearAll()` (`main.js:1328`) rồi `location.reload()` (`main.js:1330`). Nên trong sử dụng bình thường, dữ liệu cũ *có* bị xoá.

Lỗ hổng còn lại: `startWithSelection` được export ra global (`main.js:1813`). Bất kỳ ai gọi `startWithSelection()` từ console — hoặc bất kỳ thay đổi UI nào sau này thêm nút "đổi biến thể" — sẽ chạy `loadBundle` chồng lên dữ liệu cũ mà **không** dọn. Hợp đồng hiện tại dựa vào *sự vắng mặt của một nút*, không dựa vào code.

**c) File người dùng tự sửa cũng bị ghi đè.** Nếu người dùng sửa `default.html` trong editor (`saveEditorContent`, `main.js:1058-1065`) rồi nạp lại cùng bundle đó, `loadBundle` ghi đè không hỏi. Đối lập với đường upload thủ công, vốn *có* kiểm tra xung đột và hỏi (`main.js:1128-1147`).

---

## 3. Các giả định của `patchSandboxContent`

Hàm: `loader.js:40-76`. Chỉ được gọi từ **một** nơi: `loader.js:213`, bên trong nhánh `if (entry.isText)` tại `loader.js:211`.

### GĐ-1 — Đầu vào là chuỗi text, và "text" được xác định bằng đuôi file

`loader.js:110` (RAR) và `loader.js:131` (ZIP), giống hệt nhau:
```js
const isText = ['js', 'html', 'htm', 'css', 'json', 'xml', 'txt'].includes(ext);
```
Chỉ 7 đuôi này mới được đưa qua `patchSandboxContent` (`loader.js:211-214`); còn lại đi thẳng qua `getBlob()` (`loader.js:216`).

**Vi phạm — file text có đuôi ngoài danh sách:** ví dụ `.mjs`, `.jsx`, `.vue`, `.aspx`, `.php`, `.svg`, `.htaccess`, hoặc file không đuôi. Chúng **không được vá**. Biểu hiện: mọi `async: false` bên trong vẫn còn (treo UI, xem GĐ-3), mọi URL XML trỏ R2 vẫn còn (bỏ qua sandbox, xem GĐ-4), và nếu là trang HTML thì không có script relay (xem GĐ-6). Không có cảnh báo nào.

**Vi phạm ngược — file nhị phân mang đuôi text:** ví dụ một `.txt` thực chất là binary, hoặc `.json` được lưu UTF-16. Nó bị decode như UTF-8 (`loader.js:115` / `136`), chạy qua regex, rồi ghi lại thành `new Blob([content], …)` (`loader.js:214`) — **nội dung hỏng vĩnh viễn** trong IndexedDB, không thể khôi phục nếu không nạp lại bundle.

### GĐ-2 — File text là UTF-8

`loader.js:115` (RAR): `new TextDecoder('utf-8').decode(dataBytes)`
`loader.js:136` (ZIP): `entry.async('string')` — JSZip decode UTF-8.
Ghi lại luôn là UTF-8 tại `loader.js:214`.

**Vi phạm:** bundle controller WWTBAM đời cũ hay được soạn bằng Notepad hệ Windows → Windows-1252, hoặc UTF-16LE có BOM. Biểu hiện: mọi ký tự ngoài ASCII biến thành `` hoặc mojibake (`Ã©`, `â€œ`) ngay trong file đã lưu — không phải lỗi hiển thị mà là hỏng dữ liệu. Câu hỏi tiếng Việt / có dấu, tên người chơi, ký hiệu tiền tệ £/€ đều dính. Với UTF-16, decode UTF-8 sẽ chèn `\0` giữa mọi ký tự khiến file JS/HTML hỏng hoàn toàn.

### GĐ-3 — AJAX đồng bộ luôn được viết đúng dạng `async:<khoảng trắng>false`

`loader.js:42-43`:
```js
    // Fix 1: Stop synchronous AJAX deadlocks (required for Service Workers)
    content = content.replace(/async:\s*false/g, 'async: true');
```

**Giả định con 3a — cú pháp.** Regex chỉ khớp `async:` liền sau là khoảng trắng tuỳ ý rồi `false`.
Không khớp: `async : false` (khoảng trắng **trước** dấu hai chấm), `"async": false`, `'async':false`, `async:!1` (đã minify/uglify), `xhr.open(m, u, false)` (XHR thuần), `$.ajaxSetup({async: cfg.sync})` (giá trị qua biến).
Biểu hiện khi vi phạm: XHR đồng bộ sống sót. Trong iframe do service worker điều khiển, request đồng bộ phải đi qua handler `fetch` async của SW (`sw.js:120-132`) → **luồng chính đứng hình**. Người dùng thấy controller trắng hoặc treo cứng ngay lúc nạp câu hỏi; Chrome sau đó log `Synchronous XHR … deprecated`. Không có timeout, không có màn hình lỗi (`errorScreen` tại `index.html:2225` chỉ bắt lỗi của `loadBundle`, không bắt lỗi runtime trong iframe).

**Giả định con 3b — không có dương tính giả.** Regex là `/g`, không phân biệt ngữ cảnh.
Biểu hiện khi vi phạm: `async: false` nằm trong comment, trong string literal (ví dụ code sinh ra HTML mẫu, hoặc tài liệu nhúng), hoặc trong một object config **không** phải AJAX, đều bị lật thành `true` một cách âm thầm. Hiếm nhưng khi xảy ra thì cực khó chẩn đoán vì file trên đĩa (trong bundle gốc) khác file đang chạy (trong IndexedDB).

### GĐ-4 — XML câu hỏi được tham chiếu bằng đúng 2 URL tuyệt đối, đúng host đó

`loader.js:44-46`:
```js
    // Fix 2: Keep question XML inside the sandbox so edited IndexedDB files are used.
    content = content.replace(/https:\/\/pub-2d06308cf53245df865e113b0745c6d9\.r2\.dev\/questions\.xml/gi, '/controller/sandbox/questions/questions.xml');
    content = content.replace(/https:\/\/pub-2d06308cf53245df865e113b0745c6d9\.r2\.dev\/switchQuestions\.xml/gi, '/controller/sandbox/questions/switchQuestions.xml');
```

Cờ `i` chỉ giúp không phân biệt hoa/thường; **cấu trúc URL phải khớp từng ký tự**.

**Vi phạm:** bundle dùng `http://` (không phải https), thêm query (`questions.xml?v=2`), thêm dấu `/` thừa, dùng bucket R2 khác, dùng custom domain, dùng đường dẫn tương đối (`../questions.xml`, `data/questions.xml`), hoặc tên file khác (`questions12.xml`, `Questions_12q.xml`).

Biểu hiện: URL không được viết lại → controller fetch thẳng lên internet. **Mọi chỉnh sửa câu hỏi người dùng làm trong sandbox bị bỏ qua hoàn toàn** — họ sửa, bấm lưu, thấy file đổi trong editor, nhưng game vẫn chạy bộ câu hỏi cũ trên cloud. Đây là kiểu lỗi tệ nhất vì không có thông báo và người dùng sẽ đổ lỗi cho chức năng lưu.

*Lưới an toàn một phần:* `sw.js:129-131` + `isCloudQuestionXmlRequest` (`sw.js:134-138`) chặn request tới **đúng host** `R2_HOST` (`sw.js:11`) với path kết thúc bằng `/questions.xml` hoặc `/switchquestions.xml`, rồi phục vụ từ IndexedDB (`handleQuestionXmlRequest`, `sw.js:243-280`). Lưới này cứu được trường hợp URL có query hoặc thư mục con **trên cùng host đó**, nhưng **không** cứu được host khác, đường dẫn tương đối, hay tên file khác.

### GĐ-5 — Đích viết lại nằm ở `questions/` trong sandbox

Hai URL đích ở `loader.js:45-46` hard-code thư mục `questions/`.

**Vi phạm:** bundle đặt XML ở nơi khác. Biểu hiện phụ thuộc vị trí, do `getStorageKeyCandidates` (`sw.js:102-116`) có fallback:
```js
    if (fileName === 'questions.xml') {
        candidates.push('questions/questions.xml', 'questions.xml');   // 107-108
```
- Đặt ở gốc bundle (`questions.xml`) → **vẫn chạy**, nhờ candidate thứ hai.
- Đặt ở thư mục khác (`data/questions.xml`, `xml/questions.xml`) → không có candidate nào khớp → `handleSandboxRequest` rơi xuống fallback cloud (`sw.js:210-217`), tải bản trên R2. Lại là triệu chứng "sửa không ăn" như GĐ-4.

### GĐ-6 — Trang HTML nhận diện được bằng đuôi `.html` / `.htm`

`loader.js:49`:
```js
    if (normalizedName.endsWith('.html') || normalizedName.endsWith('.htm')) {
```
Lưu ý tham số truyền vào là `relativePath` (`loader.js:213`), tức đã bị cắt `rootPrefix`. `endsWith` **phân biệt hoa thường**.

**Vi phạm:** file tên `DEFAULT.HTML`, `Default.HTM`, hoặc `default.aspx` / `index.php` / `main.xhtml`.
Biểu hiện: script relay không được chèn. Người dùng vào trong controller rồi **không thoát ra được bằng phím** — Backspace không hiện lại thanh trên, Escape không mở được menu Files/Editor. Vì controller chạy trong `<iframe>` (`index.html:2249`) và chiếm toàn màn hình, handler keydown của trang cha (`main.js:1697-1718`) không nhận được phím khi focus nằm trong iframe. Người dùng bị kẹt, phải F5.

Đây là điểm giòn nhất: `DEFAULT.HTML` viết hoa **vẫn** được service worker phục vụ bình thường (mọi key đã lowercase, `db.js:43` + `sw.js:103`), nên bundle trông như chạy tốt — chỉ có phím tắt là chết.

### GĐ-7 — HTML có thẻ `</body>` viết đúng dạng

`loader.js:69-73`:
```js
        if (/<\/body>/i.test(content)) {
            content = content.replace(/<\/body>/i, relayScript + '</body>');
        } else {
            content += relayScript;
        }
```

**Vi phạm:** `</body >` (có khoảng trắng trước `>`), hoặc HTML không có thẻ body (fragment, file chỉ có `<frameset>`).
Biểu hiện: rơi vào nhánh `else`, script bị nối vào **cuối file**, tức sau `</html>`. Trình duyệt vẫn thường chạy được (parser khoan dung), nên đa số trường hợp là vô hại. Nhưng: với `<frameset>` thì phím vẫn không tới nơi vì focus nằm ở frame con; với tài liệu XHTML thực sự (`application/xhtml+xml`) thì nội dung sau `</html>` là lỗi cú pháp XML → **cả trang không render**. Ở đây `sw.js:26` phục vụ `.html` là `text/html` nên rủi ro XHTML thấp.

*Ghi chú:* `replace` với regex không `/g` chỉ thay thế `</body>` **đầu tiên**. Nếu file có nhiều chuỗi `</body>` (ví dụ trong string literal của JS sinh HTML), script có thể bị chèn nhầm vào giữa một chuỗi → file JS/HTML hỏng cú pháp. Biểu hiện: trang trắng, lỗi parse trong console.

### GĐ-8 — Không xung đột với handler bàn phím sẵn có của bundle

Script chèn vào (`loader.js:50-68`) đăng ký `document.addEventListener('keydown', …)` ở phase bubble, và gọi `e.preventDefault()` cho Backspace, Escape, Backquote.

**Vi phạm:** bundle tự bắt keydown ở capture phase rồi gọi `stopPropagation()` / `stopImmediatePropagation()`. Biểu hiện: relay im lặng không hoạt động → kẹt trong iframe như GĐ-6.
**Vi phạm ngược:** bundle dùng Escape hoặc Backspace cho chức năng game (huỷ chọn đáp án, quay lại). Biểu hiện: mỗi lần người dùng bấm phím đó, vừa kích hoạt chức năng game vừa bật/tắt dev bar của sandbox — nhấp nháy, khó chịu, dễ mất trạng thái.

Thêm nữa, cả hai phím còn được xử lý **lần thứ hai** ở trang cha (`main.js:1697-1718`) qua `postMessage` (`main.js:1721-1728`). Nếu focus nằm ở trang cha chứ không trong iframe thì chỉ handler cha chạy — hành vi khác nhau tuỳ chỗ đang focus.

### GĐ-9 — Việc vá chỉ cần xảy ra một lần, tại thời điểm nạp bundle

`patchSandboxContent` chỉ được gọi từ `loader.js:213`, tức **chỉ trong `loadBundle`**.

Các đường ghi file khác **không** vá:
- Upload thủ công: `handleFileUpload` → `saveFile(destPath, file, …)` (`main.js:1162`).
- Upload từ thư mục local: `loadFromLocalFiles` → `saveFile` (`loader.js:251`).
- Tạo file mới trong editor: `main.js:527`.
- Lưu file đã sửa: `saveEditorContent` (`main.js:1062`).

**Vi phạm:** người dùng tải bản gốc `default.html` từ đâu đó rồi upload đè vào sandbox. Biểu hiện: file đó **chưa vá** — `async: false` quay lại (treo), URL R2 quay lại (sửa câu hỏi không ăn), relay biến mất (kẹt phím). Người dùng không có cách nào biết là bundle được nạp qua cloud thì khác với file cùng tên upload tay.

---

## 4. So sánh `MIME_TYPES` (sw.js) với `LOADER_MIME_TYPES` (loader.js)

- `sw.js:25-51` — `MIME_TYPES`, **25 entry**, tra bởi `getMimeType` (`sw.js:53-56`).
- `loader.js:8-30` — `LOADER_MIME_TYPES`, **21 entry**, tra bởi `getLoaderMimeType` (`loader.js:32-35`).
- Cả hai fallback về `'application/octet-stream'` (`sw.js:55`, `loader.js:34`).

### 4.0. Điều kiện tiên quyết: bảng nào thực sự có tác dụng?

`sw.js:161` quyết định tất cả:

```js
                const mimeType = record.mimeType || getMimeType(resolved.key || storageKey);
```

`record.mimeType` được ghi lúc lưu, bởi `saveFile` (`db.js:37-47`) với giá trị từ `getLoaderMimeType(relativePath)` (`loader.js:219-220`). Vì `getLoaderMimeType` **không bao giờ trả chuỗi rỗng** (luôn có fallback ở `loader.js:34`), `record.mimeType` luôn truthy.

⇒ **`MIME_TYPES` trong `sw.js` là code chết đối với mọi file đến từ `loadBundle`.** Bảng của `loader.js` thắng 100%. `getMimeType` của SW chỉ chạy nếu record có `mimeType` rỗng — mà không đường ghi nào trong repo tạo ra tình huống đó (`main.js:1162`, `main.js:527`, `main.js:1062`, `loader.js:251` đều truyền giá trị truthy; `db.js:43` có `mimeType || ''` nhưng không ai kích hoạt nhánh đó).

Mọi hậu quả dưới đây đều là hệ quả của việc **bảng nghèo hơn (`loader.js`) che khuất bảng giàu hơn (`sw.js`)**.

### 4.1. Lệch A — 4 đuôi chỉ có trong `sw.js`

| Đuôi | sw.js | loader.js | Thực tế được phục vụ |
|---|---|---|---|
| `.webp` | `image/webp` (sw.js:38) | *không có* | `application/octet-stream` |
| `.webm` | `video/webm` (sw.js:43) | *không có* | `application/octet-stream` |
| `.txt` | `text/plain; charset=utf-8` (sw.js:49) | *không có* | `application/octet-stream` |
| `.url` | `text/plain; charset=utf-8` (sw.js:50) | *không có* | `application/octet-stream` |

**Hậu quả `.webp`:** `<img>` thường vẫn hiện nhờ trình duyệt sniff nội dung ảnh. Nhưng `.webp` nằm trong `WHITELIST` upload (`main.js:1068`) và trong danh sách ảnh của editor (`main.js:238`, `main.js:325`, `main.js:976`) — tức đây là loại tài sản được hỗ trợ chính thức, chỉ riêng khâu phục vụ là sai. CSS `background-image` và `fetch` + `createImageBitmap` sẽ khắt khe hơn `<img>`; `<picture><source type="image/webp">` sẽ không khớp.

**Hậu quả `.webm` — nghiêm trọng nhất trong nhóm này.** Nhánh xử lý Range request tại `sw.js:165`:
```js
            if (rangeHeader && (mimeType.startsWith('audio/') || mimeType.startsWith('video/'))) {
```
`application/octet-stream` không thoả điều kiện → **không bao giờ trả 206 Partial Content** (`sw.js:183-193`), luôn trả nguyên file 200 (`sw.js:197-204`). Biểu hiện: video `.webm` không tua được, thanh seek chết; trình duyệt phải tải trọn file trước khi phát; với file lớn có thể không phát được. Trớ trêu là toàn bộ đoạn code Range 30 dòng ở `sw.js:164-194` được viết ra chính để xử lý media.

*Lưu ý:* `.mp3`, `.wav`, `.ogg`, `.mp4` **có** trong `loader.js:21-24` nên chúng vẫn được 206 bình thường. Chỉ `.webm` bị loại.

**Hậu quả `.txt`:** `.txt` nằm trong danh sách `isText` (`loader.js:110`, `131`) nên **được vá và được decode như text**, rồi ghi lại với type `application/octet-stream` (`loader.js:214`). File readme/credit mở trong iframe sẽ bị tải xuống thay vì hiển thị.

**Hậu quả `.url`:** file shortcut Windows — rất phổ biến trong các bản controller WWTBAM đóng gói sẵn. `sw.js:50` cho thấy tác giả đã chủ ý thêm nó, nhưng vì `loader.js` thiếu, ý định đó vô hiệu.

### 4.2. Lệch B — hậu tố `charset` trên 8 loại text

`sw.js:26-31, 49-50` gắn `; charset=utf-8` cho `.html`, `.htm`, `.css`, `.js`, `.json`, `.xml`, `.txt`, `.url`.
`loader.js:9-14` **không** gắn charset cho bất kỳ loại nào.

Vì `record.mimeType` thắng (`sw.js:161`), thực tế phục vụ là `text/html` trần, `application/javascript` trần, v.v.

**Hậu quả:** khi header thiếu charset, trình duyệt phải tự đoán encoding của tài liệu. Với HTML nó tìm `<meta charset>`; nếu không có thì rơi về mặc định theo locale (thường Windows-1252). Bundle controller WWTBAM đời cũ rất hay thiếu `<meta charset>`. Biểu hiện: **mojibake toàn bộ câu hỏi có dấu** — chính xác cùng triệu chứng với GĐ-2 ở mục 3 nhưng nguyên nhân khác hẳn (ở đây file trong DB đúng UTF-8, chỉ header sai), nên rất dễ chẩn đoán nhầm.

Với `.js`: script tải qua `<script src>` kế thừa encoding của tài liệu cha khi header không nói gì → string literal tiếng Việt / ký hiệu £ trong JS hỏng.
Với `.xml`: đỡ hơn, vì XML parser đọc khai báo `<?xml version="1.0" encoding="UTF-8"?>` bên trong file.

Đây là lệch có tác động rộng nhất — chạm vào **mọi** file HTML/JS/CSS của **mọi** bundle.

### 4.3. Lệch C — 17 đuôi giống hệt nhau ở cả hai bảng

`.html` `.htm` `.css` `.js` `.json` `.xml` `.png` `.jpg` `.jpeg` `.gif` `.ico` `.svg` `.mp3` `.wav` `.ogg` `.mp4` `.woff` `.woff2` `.ttf` `.otf` `.eot` — giá trị trùng nhau (bỏ qua phần charset đã nói ở 4.2). Không có hậu quả.

### 4.4. Lệch D — các đuôi thiếu ở **cả hai** bảng

Không phải "lệch giữa hai bảng", nhưng cùng cơ chế hỏng, nên ghi ở đây:

`.ts`, `.cpp`, `.cs` nằm trong `WHITELIST` upload (`main.js:1068`) và trong danh sách file sửa được của editor (`main.js:977`), nhưng **không có** trong bảng nào → `application/octet-stream`.
`.bmp`, `.cur`, `.mid`, `.swf`, `.map`, `.md` cũng vậy.

Hậu quả: tải xuống thay vì hiển thị/thực thi. Với `.ts`/`.cpp`/`.cs` thì điều này thực ra **an toàn** (không nên được trình duyệt thực thi). Với `.bmp`/`.cur` (con trỏ chuột tuỳ biến, hay gặp trong controller đời 1998/2007) thì `cursor: url(x.cur)` sẽ không áp dụng.

### 4.5. Tóm tắt hướng sửa

Lệch A và B biến mất hoàn toàn nếu `LOADER_MIME_TYPES` được đồng bộ với `MIME_TYPES` — hoặc, tốt hơn, nếu `sw.js:161` đảo thứ tự ưu tiên thành `getMimeType(...) || record.mimeType`, để bảng của SW (giàu hơn, có charset, sửa được mà không cần nạp lại bundle) làm nguồn sự thật. Hiện tại hai bảng là dữ liệu trùng lặp không có cơ chế nào giữ chúng đồng bộ.

---

## 5. Checklist tối thiểu cho một file `.zip` để `loadBundle` xử lý đúng

Mỗi mục có **căn cứ** (số dòng) và **cách kiểm bằng script**. Ký hiệu: `E` = mảng đường dẫn entry (đã bỏ thư mục, đã đổi `\` → `/`); `R` = `rootPrefix` tính được; `Erel` = `E` sau khi cắt `R`.

### A. Tầng tải về

| # | Điều kiện | Căn cứ | Kiểm bằng script |
|---|---|---|---|
| A1 | URL trả `response.ok` (2xx) | loader.js:152-155 | `(await fetch(url)).ok === true` |
| A2 | Có CORS cho origin của trang | loader.js:152 (fetch cross-origin) | header `Access-Control-Allow-Origin` khớp origin |
| A3 | `response.body` đọc được dạng stream | loader.js:159 `response.body.getReader()` | `resp.body !== null` |
| A4 | *Nên có* `Content-Length` | loader.js:157-158; main.js:1559-1565 | có header → thanh % chạy; thiếu → chỉ hiện KB (không phải lỗi) |

### B. Định dạng archive

| # | Điều kiện | Căn cứ | Kiểm bằng script |
|---|---|---|---|
| B1 | 4 byte đầu **không** phải `52 61 72 21` (`Rar!`) | loader.js:85-86 | `!(b[0]==0x52&&b[1]==0x61&&b[2]==0x72&&b[3]==0x21)` |
| B2 | Là ZIP hợp lệ — `JSZip.loadAsync` không throw | loader.js:122 | `await JSZip.loadAsync(buf)` không ném lỗi |
| B3 | Không mã hoá / không đặt mật khẩu | loader.js:122 (JSZip không hỗ trợ) | không có bit 0 của general purpose flag |
| B4 | Nén bằng `store` (0) hoặc `deflate` (8) | loader.js:122 | mọi entry có method ∈ {0, 8} |
| B5 | Không phải ZIP64 nhiều phân đoạn / split | loader.js:122 | một file duy nhất, không `.z01` |

> **Cảnh báo:** B1 là điều kiện *duy nhất* để chọn nhánh. Bất kỳ file nào không mở đầu bằng `Rar!` đều bị **giả định** là ZIP. Một `.7z`, `.tar.gz`, hay một trang HTML lỗi 404 sẽ đi vào `JSZip.loadAsync` và ném lỗi khó hiểu, hiện ở `errorScreen` (`main.js:1573-1579`) dưới dạng thông điệp của JSZip.

### C. Điểm vào và cấu trúc thư mục

| # | Điều kiện | Căn cứ | Kiểm bằng script |
|---|---|---|---|
| C1 | **Bắt buộc** — có ít nhất một entry mà `path.toLowerCase()` kết thúc bằng `default.html` \| `default.htm` \| `index.html` \| `index.htm` | loader.js:180-183 | `E.some(p => /(default\|index)\.html?$/i.test(p))` |
| C2 | Entry **khớp đầu tiên** theo thứ tự `Object.keys(zip.files)` phải là điểm vào thật | loader.js:180 `findIndex` | `E.findIndex(match) === E.indexOf(<điểm vào mong muốn>)` |
| C3 | Sau khi cắt `R`, điểm vào phải nằm ở gốc (không còn `/`) | loader.js:186-188, 204-206 | `Erel.includes('default.html') \|\| Erel.includes('index.html')` với tên không chứa `/` |
| C4 | **Mọi** entry phải bắt đầu bằng `R` | loader.js:204-206 | `E.every(p => p.startsWith(R))` |
| C5 | Không có entry nào rỗng sau khi cắt `R` | loader.js:208 | `Erel.every(p => p.length > 0)` |

> **C2 và C4 là cái bẫy chính.** `rootPrefix` được suy ra từ **một** entry (`loader.js:186-188`). Nếu archive có `Olga/default.html` **và** `Olga/help/index.html`, mà `help/index.html` xuất hiện trước trong thứ tự key, thì `R = 'Olga/help/'`. Khi đó `loader.js:204-206`:
> ```js
>         const relativePath = normalizedName.startsWith(rootPrefix)
>             ? normalizedName.substring(rootPrefix.length)
>             : normalizedName;
> ```
> `Olga/default.html` **không** bắt đầu bằng `Olga/help/` nên giữ nguyên đường dẫn đầy đủ → lưu thành key `olga/default.html`. Service worker mặc định tìm `default.html` ở gốc (`sw.js:151-153`, candidates ở `sw.js:111-112`) → **404, sandbox trắng**. Cây file bị chẻ đôi im lặng.
>
> Vì vậy khuyến nghị mạnh: **archive chỉ nên có đúng một file tên `default.html`/`index.html`, đặt ở gốc hoặc ngay trong đúng một thư mục cấp cao nhất.**

**Đường fallback khi C1 sai** (`loader.js:189-197`): nếu không tìm thấy điểm vào, `R` chỉ được đặt khi *tất cả* entry chung một thư mục cấp cao nhất — và nó suy từ `paths[0]`. Nếu không, `R = ''`. Dù nhánh nào, không có `default.html` thì `sw.js:151-153` vẫn 404. **C1 là bắt buộc tuyệt đối.**

### D. Đường dẫn và va chạm key

| # | Điều kiện | Căn cứ | Kiểm bằng script |
|---|---|---|---|
| D1 | **Không** có hai entry trùng nhau khi so sánh không phân biệt hoa thường (sau khi cắt `R`) | db.js:43 `path.toLowerCase()` | `new Set(Erel.map(p=>p.toLowerCase())).size === Erel.length` |
| D2 | Không phụ thuộc vào thư mục rỗng | loader.js:128 `if (entry.dir) continue` | thư mục rỗng bị mất; nếu cần, thêm file `.keep` |
| D3 | Đường dẫn không chứa `..` (thoát thư mục) | *không có kiểm tra nào trong code* | `Erel.every(p => !p.split('/').includes('..'))` |
| D4 | Không có ký tự `\` còn sót gây nhập nhằng | loader.js:129 (đã đổi `\`→`/`) | tự động xử lý |
| D5 | Điểm vào không viết hoa đuôi (`DEFAULT.HTML`) | loader.js:49 `endsWith` phân biệt hoa thường | `/\.(html?)$/.test(p)` — chữ thường |

> **D1 là lỗi mất dữ liệu âm thầm.** `saveFile` lowercase key (`db.js:43`). `Sounds/Intro.mp3` và `sounds/intro.mp3` cùng ghi vào key `sounds/intro.mp3`; file lưu **sau** thắng, file kia biến mất không dấu vết. `savedCount` (`loader.js:221`) vẫn đếm cả hai nên không có tín hiệu nào. Bundle đóng gói trên hệ thống case-sensitive (Linux/macOS) rất dễ dính.
>
> **D5** — xem GĐ-6 mục 3: `DEFAULT.HTML` vẫn được phục vụ (key đã lowercase) nhưng **không được chèn script relay**, người dùng kẹt trong iframe.
>
> **D3** — code hoàn toàn không kiểm tra. Không có nguy cơ thoát thư mục thật (IndexedDB dùng key phẳng, không phải filesystem), nhưng key sẽ chứa `..` và không bao giờ khớp request nào từ SW.

### E. Nội dung file (điều kiện để các fix ở mục 3 hoạt động)

| # | Điều kiện | Căn cứ | Kiểm bằng script |
|---|---|---|---|
| E1 | File text chỉ dùng 7 đuôi: `js htm html css json xml txt` | loader.js:110, 131 | mọi file cần vá phải thuộc tập này |
| E2 | Mọi file text là UTF-8 hợp lệ | loader.js:115, 136, 214 | `new TextDecoder('utf-8',{fatal:true}).decode(bytes)` không ném lỗi |
| E3 | AJAX đồng bộ chỉ viết dạng `async:\s*false` | loader.js:43 | grep còn sót: `/async\s*:\s*false\|"async"\s*:\s*false\|open\([^)]*,\s*false\s*\)/` |
| E4 | Không có `async: false` nằm trong comment/string (tránh dương tính giả) | loader.js:43 (`/g`, không phân biệt ngữ cảnh) | rà tay các match của E3 |
| E5 | URL XML dùng **đúng** 2 chuỗi tuyệt đối được vá | loader.js:45-46 | grep còn sót: `/questions\.xml/i` mà không khớp 2 regex ở 45-46 |
| E6 | XML sau khi vá nằm ở `questions/…` hoặc gốc | loader.js:45-46; sw.js:107-110 | `Erel` chứa `questions/questions.xml` hoặc `questions.xml` |
| E7 | Điểm vào chứa `</body>` viết liền, chữ thường/hoa đều được | loader.js:69 `/<\/body>/i` | `/<\/body>/i.test(html) === true` |
| E8 | Chỉ có **một** `</body>` trong file | loader.js:70 (`replace` không `/g`, thay cái đầu tiên) | `(html.match(/<\/body>/gi)\|\|[]).length === 1` |
| E9 | Có `<meta charset="utf-8">` trong mọi HTML | sw.js:161 che charset của sw.js:26 — xem mục 4.2 | `/<meta[^>]+charset/i.test(html)` |
| E10 | Không bắt keydown ở capture phase rồi `stopImmediatePropagation` | loader.js:52 (bubble phase) | grep `stopImmediatePropagation` trong handler keydown |
| E11 | Media cần tua chỉ dùng `.mp3 .wav .ogg .mp4` (tránh `.webm`) | loader.js:21-24 vs sw.js:165 — xem mục 4.1 | `!Erel.some(p => p.endsWith('.webm'))` |
| E12 | Không dùng `.webp` `.txt` `.url` nếu cần MIME đúng | mục 4.1 | liệt kê các đuôi ngoài `LOADER_MIME_TYPES` |

### F. Giới hạn kích thước

Toàn bộ archive được giữ trong RAM: mảng `chunks` (`loader.js:160, 165`) → `Blob` (`loader.js:171`) → `ArrayBuffer` (`loader.js:172`) → nội dung giải nén. Đỉnh bộ nhớ xấp xỉ 3× kích thước archive cộng với dữ liệu đã giải nén.

Code **không đặt giới hạn nào**, cũng không kiểm tra hạn ngạch IndexedDB (không thấy `navigator.storage.estimate()` ở đâu trong 5 file). Ngưỡng an toàn cụ thể: **KHÔNG XÁC ĐỊNH ĐƯỢC** — phụ thuộc RAM và hạn ngạch gốc của trình duyệt, không suy ra được từ code.

Nếu `saveFile` (`db.js:37-47`) thất bại vì hết hạn ngạch, `tx.onerror` (`db.js:45`) reject → lỗi lan lên `loadBundle` → `downloadAndBootVariant` bắt ở `main.js:1570` và hiện `errorScreen`. Nhưng lúc đó **các file đã ghi vẫn nằm lại** trong IndexedDB (không có transaction bao trùm, mỗi `saveFile` là một transaction riêng — `db.js:41`), để lại sandbox ở trạng thái nạp dở. Lần mở trang sau, `hasBundle()` (`db.js:69-78`, đếm `> 0`) trả `true` → `init()` (`main.js:1761`) boot thẳng vào một bundle không đầy đủ.

### G. Điều **không** được kiểm tra ở bất kỳ đâu

Ghi lại để rõ ranh giới hợp đồng:

- Không có manifest, không có checksum, không có versioning của bundle.
- `loadBundle` trả `savedCount` (`loader.js:224`) nhưng **caller bỏ qua giá trị này** (`main.js:1558`). Một archive hợp lệ nhưng rỗng (0 file) vẫn được coi là thành công, rồi `bootController()` (`main.js:1569`) chạy và iframe trỏ vào sandbox trống → 404 từ `sw.js:224-230`.
- Không kiểm tra rằng `default.html` thực sự tồn tại **sau khi** lưu.
- Không kiểm tra bundle có khớp với `format` đã chọn hay không — nạp bundle 15 câu dưới nhãn `'12'` sẽ chạy trót lọt, chỉ sai về gameplay.

---

## Phụ lục — chỉ mục căn cứ

| Chủ đề | Vị trí |
|---|---|
| Bảng `VARIANTS` (11 URL) | main.js:21-47 |
| Mảng `groups` (7 mục) | main.js:1338-1382 |
| `nameMap` trùng lặp lần 3 | main.js:1225-1233 |
| `selectVariant` | main.js:1443-1451 |
| `startWithSelection` | main.js:1520-1537 |
| Tra URL + fallback | main.js:1549 |
| `downloadAndBootVariant` | main.js:1539-1581 |
| Gọi `loadBundle` | main.js:1558 |
| `bootController` | main.js:1583-1624 |
| `executeResetSandbox` (nơi duy nhất gọi `clearAll`) | main.js:1315-1334 (clearAll ở 1328) |
| `init` — quyết định boot hay hiện menu | main.js:1750-1784 (điều kiện ở 1761) |
| `WHITELIST` upload | main.js:1068 |
| Export global (`startWithSelection`) | main.js:1813 |
| `LOADER_MIME_TYPES` | loader.js:8-30 |
| `getLoaderMimeType` | loader.js:32-35 |
| `patchSandboxContent` | loader.js:40-76 |
| Nhận diện RAR | loader.js:85-86 |
| Danh sách `isText` | loader.js:110, 131 |
| `loadBundle` | loader.js:150-225 |
| Suy `rootPrefix` | loader.js:178-197 |
| Vòng lưu file | loader.js:199-222 |
| `MIME_TYPES` | sw.js:25-51 |
| `R2_HOST` | sw.js:11 |
| `getStorageKeyCandidates` | sw.js:102-116 |
| Ưu tiên MIME lúc phục vụ | sw.js:161 |
| Điều kiện Range 206 | sw.js:165 |
| Mặc định `default.html` | sw.js:151-153 |
| Fallback XML lên cloud | sw.js:210-217 |
| `saveFile` (lowercase key) | db.js:37-47 (dòng 43) |
| `hasBundle` | db.js:69-78 |
| `clearAll` | db.js:93-102 |
| Thẻ `<script>` JSZip | index.html:44 |
| Nút `start-btn` | index.html:2181 |
| `<iframe>` controller | index.html:2249 |
