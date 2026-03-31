
# Read the file
with open(r"e:\operagx\thermodynamix\anthology\13\index.html", "r", encoding="utf-8") as f:
    content = f.read()

old_body = """  <div class="story-body">
    <p>Primera \u0111ang luy\u1ec7n vi\u1ebft truy\u1ec7n, nh\u01b0ng m\u00e0 anh l\u00e0 ng\u01b0\u1eddi hay ph\u00e1 v\u1ee1 c\u00e1c quy t\u1eafc v\u0103n h\u1ecdc. Th\u1ebf l\u00e0 nh\u1eefng th\u1ee9 anh vi\u1ebft ra\u2026 r\u1ea5t ng\u1eafn.</p>
<p>C\u1ee5 th\u1ec3 h\u01a1n, Primera \u0111ang xem trang FAQ c\u1ee7a Nicky Case v\u1ec1 c\u00e1ch \u0111\u1ec3 vi\u1ebft truy\u1ec7n. Case cho r\u1eb1ng r/WritingPrompts tr\u00ean Reddit l\u00e0 n\u01a1i \u0111\u1ec3 l\u1ea5y c\u00e1c \u00fd t\u01b0\u1edfng vi\u1ebft truy\u1ec7n. Trong subreddit \u0111\u00f3, m\u1ecdi ng\u01b0\u1eddi vi\u1ebft ra m\u1ed9t m\u1edf \u0111\u1ea7u truy\u1ec7n, v\u00e0 ng\u01b0\u1eddi \u0111\u1ecdc s\u1ebd vi\u1ebft ti\u1ebfp c\u00e2u chuy\u1ec7n t\u1eeb th\u00f4ng tin \u0111\u00f3 b\u1eb1ng c\u00e1ch \u0111\u0103ng ph\u1ea7n vi\u1ebft c\u1ee7a m\u00ecnh v\u00e0o ph\u1ea7n b\u00ecnh lu\u1eadn. Th\u1ea5y c\u00f3 r\u1ea5t nhi\u1ec1u g\u1ee3i \u00fd m\u1edf \u0111\u1ea7u, Primera kh\u00f4ng ng\u1ea7n ng\u1ea1i nh\u00fang tay v\u00e0o v\u00e0 th\u1eed vi\u1ebft truy\u1ec7n theo m\u1ed9t s\u1ed1 g\u1ee3i \u00fd.</p>
<p>M\u1edf \u0111\u1ea7u 1: There are Rules to being a hero, and to being a villain. For example: Never interrupt a monologue; always leave a way to escape a death trap; and never forcibly unmask another. No one has ever broken the Rules more than once. Today, you found out why.</p>
<p>T\u1ea1m d\u1ecbch: C\u00f3 nh\u1eefng quy t\u1eafc \u0111\u1ec3 tr\u1edf th\u00e0nh m\u1ed9t anh h\u00f9ng v\u00e0 \u0111\u1ec3 tr\u1edf th\u00e0nh m\u1ed9t k\u1ebb ph\u1ea3n di\u1ec7n. V\u00ed d\u1ee5: Kh\u00f4ng bao gi\u1edd ng\u1eaft l\u1eddi m\u1ed9t b\u00e0i di\u1ec5n v\u0103n; lu\u00f4n \u0111\u1ec3 l\u1ea1i m\u1ed9t l\u1ed1i tho\u00e1t kh\u1ecfi b\u1eaby t\u1eed th\u1ea7n; v\u00e0 kh\u00f4ng bao gi\u1edd \u00e9p bu\u1ed9c ng\u01b0\u1eddi kh\u00e1c th\u00e1o m\u1eb7t n\u1ea1. Ch\u01b0a ai t\u1eebng vi ph\u1ea1m c\u00e1c quy t\u1eafc n\u00e0y h\u01a1n m\u1ed9t l\u1ea7n. H\u00f4m nay, b\u1ea1n \u0111\u00e3 bi\u1ebft t\u1ea1i sao.</p>
<p>Ph\u1ea7n vi\u1ebft ti\u1ebfp c\u1ee7a Primera:</p>
<p>H\u00f4m nay, b\u1ea1n sau \u0111\u00e2y s\u1ebd \u0111\u01b0\u1ee3c g\u1ecdi l\u00e0 Primera c\u00f3 \u0111\u1ecdc m\u1ed9t s\u1ed1 v\u0103n b\u1ea3n lu\u1eadt \u0111\u1ec3\u2026 gi\u1ebft th\u1eddi gian. Trong \u0111\u00f3 c\u00f3 m\u1ed9t b\u1ed9 lu\u1eadt anh h\u00f9ng v\u00e0 b\u1ed9 lu\u1eadt \u00e1c nh\u00e2n. Nh\u1eefng b\u1ed9 lu\u1eadt n\u00e0y n\u00f3i v\u1ec1 \u0111i\u1ec1u ki\u1ec7n t\u1ed1i thi\u1ec3u \u0111\u1ec3 tr\u1edf th\u00e0nh anh h\u00f9ng v\u00e0 k\u1ebb ph\u1ea3n di\u1ec7n, c\u00f9ng v\u1edbi nh\u1eefng y\u00eau c\u1ea7u \u0111\u1ec3 duy tr\u00ec vai tr\u00f2 \u0111\u00f3.</p>
<p>C\u00e1c anh h\u00f9ng v\u00e0 ph\u1ea3n di\u1ec7n lu\u00f4n ph\u1ea3i nh\u1edb trong \u0111\u1ea7u c\u1ea3 b\u1ed9 lu\u1eadt \u0111\u00f3 \u0111\u1ec3 tr\u00e1nh ch\u1ee7 t\u1ecbch n\u01b0\u1edbc ph\u00e1t hi\u1ec7n m\u00ecnh \u0111ang ph\u00e1p lu\u1eadt v\u00e0 t\u01b0\u1edbc danh hi\u1ec7u Anh h\u00f9ng/Ph\u1ea3n di\u1ec7n c\u1ee7a m\u00ecnh.</p>
<p>N\u1ebfu m\u1ee9c \u0111\u1ed9 vi ph\u1ea1m qu\u00e1 cao, h\u1ecd s\u1ebd v\u1eeba b\u1ecb ph\u1ea1t h\u00e0nh ch\u00ednh t\u1eeb 50.000 USD, v\u00e0 v\u1eeba c\u00f3 th\u1ec3 ng\u1ed3i t\u00f9, ho\u1eb7c t\u1ec7 h\u01a1n, l\u00e0 t\u01b0\u1edbc quy\u1ec1n s\u1ed1ng. Th\u1ebf n\u00ean anh h\u00f9ng v\u00e0 k\u1ebb \u00e1c c\u0169ng c\u00f3 nh\u1eefng n\u1ed7i lo c\u1ee7a ri\u00eang m\u00ecnh. [H\u1ebft ph\u1ea7n vi\u1ebft ti\u1ebfp]</p>
<p>M\u1edf \u0111\u1ea7u 2: In a world of magic, your potential is predetermined by a number at birth. Archmages born with a number in the millions, peasants in the single digits. When your child is born with a mana value of \u201cH\u201d, everyone is confused.</p>
<p>T\u1ea1m d\u1ecbch: Trong m\u1ed9t th\u1ebf gi\u1edbi ph\u00e9p thu\u1eadt, ti\u1ec1m n\u0103ng c\u1ee7a b\u1ea1n \u0111\u01b0\u1ee3c x\u00e1c \u0111\u1ecbnh b\u1edfi m\u1ed9t con s\u1ed1 ngay t\u1eeb khi sinh ra. C\u00e1c ph\u00e1p s\u01b0 cao c\u1ea5p sinh ra v\u1edbi con s\u1ed1 h\u00e0ng tri\u1ec7u, c\u00f2n n\u00f4ng d\u00e2n ch\u1ec9 c\u00f3 con s\u1ed1 m\u1ed9t ch\u1eef s\u1ed1. Khi con b\u1ea1n sinh ra v\u1edbi gi\u00e1 tr\u1ecb mana l\u00e0 \u201cH\u201d, m\u1ecdi ng\u01b0\u1eddi \u0111\u1ec1u b\u1ed1i r\u1ed1i.</p>
<p>Ph\u1ea7n vi\u1ebft ti\u1ebfp c\u1ee7a Primera:</p>
<p>B\u1ea1n th\u1ea5y v\u1eady, li\u1ec1n bay th\u1eb3ng sang H\u1ed9i Ph\u00e9p thu\u1eadt Qu\u1ed1c t\u1ebf \u0111\u1ec3 h\u1ecfi v\u1ec1 v\u1ea5n \u0111\u1ec1 n\u00e0y. M\u1ed9t th\u00e0nh vi\u00ean h\u1ed9i \u0111\u1ed3ng cho hay:</p>
<p>\u201c\u0110\u00f3 l\u00e0 l\u1ed7i \u0111\u1ea5y. Con b\u1ea1n c\u00f3 ch\u1ec9 s\u1ed1 mana l\u00e0 8.\u201d</p>
<p>Th\u1ebf l\u00e0 con b\u1ea1n tr\u1edf th\u00e0nh ng\u01b0\u1eddi kh\u00f4ng bi\u1ebft g\u00ec v\u1ec1 ph\u00e9p thu\u1eadt, v\u00e0 ng\u1ed3i chung m\u00e2m v\u1edbi n\u00f4ng d\u00e2n. [H\u1ebft ph\u1ea7n vi\u1ebft ti\u1ebfp]</p>
<p>Primera li\u1ec1n th\u1ea5y ho\u1ea1t \u0111\u1ed9ng n\u00e0y hay, ph\u1ea3i sang gi\u1edbi thi\u1ec7u v\u1edbi Scratch cho \u0111\u1ee1 ph\u00ed.</p>
<p>Scratch th\u00ec \u0111ang \u0111\u1ebfm ti\u1ec1n sau khi ra ng\u00e2n h\u00e0ng \u0111\u1ec3 chuy\u1ec3n \u0111\u1ed5i Orbs th\u00e0nh USD. M\u00f9i ti\u1ec1n th\u01a1m ph\u1ee9c, nh\u01b0ng th\u00e1ng n\u00e0y l\u1ea1i ch\u1ec9 l\u00e3i \u0111\u01b0\u1ee3c 5400 USD. Ch\u1eafc l\u00e0 do anh kh\u00f4ng c\u00f3 s\u1ea3n ph\u1ea9m m\u1edbi \u0111\u1ec3 b\u00e1n, m\u00e0 ch\u1ec9 x\u1ea3 h\u00e0ng t\u1ed3n kho.</p>"""

new_body = """  <div class="story-body">
    <p>Primera \u0111ang luy\u1ec7n vi\u1ebft truy\u1ec7n, nh\u01b0ng m\u00e0 anh l\u00e0 ng\u01b0\u1eddi hay ph\u00e1 v\u1ee1 c\u00e1c quy t\u1eafc v\u0103n h\u1ecdc. Th\u1ebf l\u00e0 nh\u1eefng th\u1ee9 anh vi\u1ebft ra\u2026 r\u1ea5t ng\u1eafn.</p>
    <p>C\u1ee5 th\u1ec3 h\u01a1n, Primera \u0111ang xem trang FAQ c\u1ee7a Nicky Case v\u1ec1 c\u00e1ch \u0111\u1ec3 vi\u1ebft truy\u1ec7n. Case cho r\u1eb1ng r/WritingPrompts tr\u00ean Reddit l\u00e0 n\u01a1i \u0111\u1ec3 l\u1ea5y c\u00e1c \u00fd t\u01b0\u1edfng vi\u1ebft truy\u1ec7n. Trong subreddit \u0111\u00f3, m\u1ecdi ng\u01b0\u1eddi vi\u1ebft ra m\u1ed9t m\u1edf \u0111\u1ea7u truy\u1ec7n, v\u00e0 ng\u01b0\u1eddi \u0111\u1ecdc s\u1ebd vi\u1ebft ti\u1ebfp c\u00e2u chuy\u1ec7n t\u1eeb th\u00f4ng tin \u0111\u00f3 b\u1eb1ng c\u00e1ch \u0111\u0103ng ph\u1ea7n vi\u1ebft c\u1ee7a m\u00ecnh v\u00e0o ph\u1ea7n b\u00ecnh lu\u1eadn. Th\u1ea5y c\u00f3 r\u1ea5t nhi\u1ec1u g\u1ee3i \u00fd m\u1edf \u0111\u1ea7u, Primera kh\u00f4ng ng\u1ea7n ng\u1ea1i nh\u00fang tay v\u00e0o v\u00e0 th\u1eed vi\u1ebft truy\u1ec7n theo m\u1ed9t s\u1ed1 g\u1ee3i \u00fd.</p>

    <div class="prompt-block">
      <div class="prompt-label">M\u1edf \u0111\u1ea7u 1 \u00b7 r/WritingPrompts</div>
      <div class="prompt-en">There are Rules to being a hero, and to being a villain. For example: Never interrupt a monologue; always leave a way to escape a death trap; and never forcibly unmask another. No one has ever broken the Rules more than once. Today, you found out why.</div>
      <div class="prompt-vi">C\u00f3 nh\u1eefng quy t\u1eafc \u0111\u1ec3 tr\u1edf th\u00e0nh m\u1ed9t anh h\u00f9ng v\u00e0 \u0111\u1ec3 tr\u1edf th\u00e0nh m\u1ed9t k\u1ebb ph\u1ea3n di\u1ec7n. V\u00ed d\u1ee5: Kh\u00f4ng bao gi\u1edd ng\u1eaft l\u1eddi m\u1ed9t b\u00e0i di\u1ec5n v\u0103n; lu\u00f4n \u0111\u1ec3 l\u1ea1i m\u1ed9t l\u1ed1i tho\u00e1t kh\u1ecfi b\u1eaby t\u1eed th\u1ea7n; v\u00e0 kh\u00f4ng bao gi\u1edd \u00e9p bu\u1ed9c ng\u01b0\u1eddi kh\u00e1c th\u00e1o m\u1eb7t n\u1ea1. Ch\u01b0a ai t\u1eebng vi ph\u1ea1m c\u00e1c quy t\u1eafc n\u00e0y h\u01a1n m\u1ed9t l\u1ea7n. H\u00f4m nay, b\u1ea1n \u0111\u00e3 bi\u1ebft t\u1ea1i sao.</div>
    </div>

    <div class="response-block">
      <div class="response-label">\u270d\ufe0f Ph\u1ea7n vi\u1ebft ti\u1ebfp c\u1ee7a Primera</div>
      <div class="response-text">
        <p>H\u00f4m nay, b\u1ea1n \u2014 sau \u0111\u00e2y s\u1ebd \u0111\u01b0\u1ee3c g\u1ecdi l\u00e0 Primera \u2014 c\u00f3 \u0111\u1ecdc m\u1ed9t s\u1ed1 v\u0103n b\u1ea3n lu\u1eadt \u0111\u1ec3\u2026 gi\u1ebft th\u1eddi gian. Trong \u0111\u00f3 c\u00f3 m\u1ed9t b\u1ed9 lu\u1eadt anh h\u00f9ng v\u00e0 b\u1ed9 lu\u1eadt \u00e1c nh\u00e2n. Nh\u1eefng b\u1ed9 lu\u1eadt n\u00e0y n\u00f3i v\u1ec1 \u0111i\u1ec1u ki\u1ec7n t\u1ed1i thi\u1ec3u \u0111\u1ec3 tr\u1edf th\u00e0nh anh h\u00f9ng v\u00e0 k\u1ebb ph\u1ea3n di\u1ec7n, c\u00f9ng v\u1edbi nh\u1eefng y\u00eau c\u1ea7u \u0111\u1ec3 duy tr\u00ec vai tr\u00f2 \u0111\u00f3.</p>
        <p>C\u00e1c anh h\u00f9ng v\u00e0 ph\u1ea3n di\u1ec7n lu\u00f4n ph\u1ea3i nh\u1edb trong \u0111\u1ea7u c\u1ea3 b\u1ed9 lu\u1eadt \u0111\u00f3 \u0111\u1ec3 tr\u00e1nh ch\u1ee7 t\u1ecbch n\u01b0\u1edbc ph\u00e1t hi\u1ec7n m\u00ecnh \u0111ang vi ph\u1ea1m ph\u00e1p lu\u1eadt v\u00e0 t\u01b0\u1edbc danh hi\u1ec7u Anh h\u00f9ng/Ph\u1ea3n di\u1ec7n c\u1ee7a m\u00ecnh.</p>
        <p>N\u1ebfu m\u1ee9c \u0111\u1ed9 vi ph\u1ea1m qu\u00e1 cao, h\u1ecd s\u1ebd v\u1eeba b\u1ecb ph\u1ea1t h\u00e0nh ch\u00ednh t\u1eeb 50.000 USD, v\u00e0 v\u1eeba c\u00f3 th\u1ec3 ng\u1ed3i t\u00f9, ho\u1eb7c t\u1ec7 h\u01a1n, l\u00e0 t\u01b0\u1edbc quy\u1ec1n s\u1ed1ng. Th\u1ebf n\u00ean anh h\u00f9ng v\u00e0 k\u1ebb \u00e1c c\u0169ng c\u00f3 nh\u1eefng n\u1ed7i lo c\u1ee7a ri\u00eang m\u00ecnh.</p>
      </div>
      <div class="response-end">H\u1ebft ph\u1ea7n vi\u1ebft ti\u1ebfp</div>
    </div>

    <div class="prompt-block">
      <div class="prompt-label">M\u1edf \u0111\u1ea7u 2 \u00b7 r/WritingPrompts</div>
      <div class="prompt-en">In a world of magic, your potential is predetermined by a number at birth. Archmages born with a number in the millions, peasants in the single digits. When your child is born with a mana value of \u201cH\u201d, everyone is confused.</div>
      <div class="prompt-vi">Trong m\u1ed9t th\u1ebf gi\u1edbi ph\u00e9p thu\u1eadt, ti\u1ec1m n\u0103ng c\u1ee7a b\u1ea1n \u0111\u01b0\u1ee3c x\u00e1c \u0111\u1ecbnh b\u1edfi m\u1ed9t con s\u1ed1 ngay t\u1eeb khi sinh ra. C\u00e1c ph\u00e1p s\u01b0 cao c\u1ea5p sinh ra v\u1edbi con s\u1ed1 h\u00e0ng tri\u1ec7u, c\u00f2n n\u00f4ng d\u00e2n ch\u1ec9 c\u00f3 con s\u1ed1 m\u1ed9t ch\u1eef s\u1ed1. Khi con b\u1ea1n sinh ra v\u1edbi gi\u00e1 tr\u1ecb mana l\u00e0 \u201cH\u201d, m\u1ecdi ng\u01b0\u1eddi \u0111\u1ec1u b\u1ed1i r\u1ed1i.</div>
    </div>

    <div class="response-block">
      <div class="response-label">\u270d\ufe0f Ph\u1ea7n vi\u1ebft ti\u1ebfp c\u1ee7a Primera</div>
      <div class="response-text">
        <p>B\u1ea1n th\u1ea5y v\u1eady, li\u1ec1n bay th\u1eb3ng sang H\u1ed9i Ph\u00e9p thu\u1eadt Qu\u1ed1c t\u1ebf \u0111\u1ec3 h\u1ecfi v\u1ec1 v\u1ea5n \u0111\u1ec1 n\u00e0y. M\u1ed9t th\u00e0nh vi\u00ean h\u1ed9i \u0111\u1ed3ng cho hay:</p>
        <p><em>\u201c\u0110\u00f3 l\u00e0 l\u1ed7i \u0111\u1ea5y. Con b\u1ea1n c\u00f3 ch\u1ec9 s\u1ed1 mana l\u00e0 8.\u201d</em></p>
        <p>Th\u1ebf l\u00e0 con b\u1ea1n tr\u1edf th\u00e0nh ng\u01b0\u1eddi kh\u00f4ng bi\u1ebft g\u00ec v\u1ec1 ph\u00e9p thu\u1eadt, v\u00e0 ng\u1ed3i chung m\u00e2m v\u1edbi n\u00f4ng d\u00e2n.</p>
      </div>
      <div class="response-end">H\u1ebft ph\u1ea7n vi\u1ebft ti\u1ebfp</div>
    </div>

    <p>Primera li\u1ec1n th\u1ea5y ho\u1ea1t \u0111\u1ed9ng n\u00e0y hay, ph\u1ea3i sang gi\u1edbi thi\u1ec7u v\u1edbi Scratch cho \u0111\u1ee1 ph\u00ed.</p>
    <p>Scratch th\u00ec \u0111ang \u0111\u1ebfm ti\u1ec1n sau khi ra ng\u00e2n h\u00e0ng \u0111\u1ec3 chuy\u1ec3n \u0111\u1ed5i Orbs th\u00e0nh USD. M\u00f9i ti\u1ec1n th\u01a1m ph\u1ee9c, nh\u01b0ng th\u00e1ng n\u00e0y l\u1ea1i ch\u1ec9 l\u00e3i \u0111\u01b0\u1ee3c 5400 USD. Ch\u1eafc l\u00e0 do anh kh\u00f4ng c\u00f3 s\u1ea3n ph\u1ea9m m\u1edbi \u0111\u1ec3 b\u00e1n, m\u00e0 ch\u1ec9 x\u1ea3 h\u00e0ng t\u1ed3n kho.</p>"""

if old_body in content:
    content = content.replace(old_body, new_body)
    with open(r"e:\operagx\thermodynamix\anthology\13\index.html", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: Body replaced.")
else:
    print("ERROR: Old body not found. Checking for partial match...")
    # Check what's actually there
    marker = '<div class="story-body">'
    idx = content.find(marker)
    print(f"story-body div found at index: {idx}")
