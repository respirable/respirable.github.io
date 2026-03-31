import os
import re

# Template for the story page
TEMPLATE = """<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{title} — Anthology</title>
  <link rel="stylesheet" href="/theme.css">
  <script src="/theme.js" defer></script>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{
      font-family: "Segoe UI", "Segoe UI Variable", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      overflow-x: hidden;
    }}
    .container {{
      max-width: 720px;
      margin: 0 auto;
      padding: 80px 24px 100px;
    }}
    .back-link {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--muted);
      text-decoration: none;
      margin-bottom: 40px;
      transition: color 0.15s;
    }}
    .back-link:hover {{ color: var(--text); }}
    .story-header {{
      margin-bottom: 40px;
      animation: fadeSlideDown 0.8s cubic-bezier(0.22,1,0.36,1) both;
    }}
    .story-meta {{
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }}
    .story-part-badge {{
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--accent);
      background: rgba(9, 105, 218, 0.08);
      padding: 3px 9px;
      border-radius: 20px;
      border: 1px solid rgba(9, 105, 218, 0.2);
    }}
    .story-number {{
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }}
    h1.story-title {{
      font-family: "Segoe UI", "Segoe UI Variable Display", sans-serif;
      font-size: clamp(2.2rem, 8vw, 4rem);
      font-weight: 600;
      letter-spacing: -0.03em;
      line-height: 1.1;
      color: var(--text);
      margin-bottom: 16px;
    }}
    .story-subtitle {{
      font-size: 0.95rem;
      color: var(--muted);
      font-style: italic;
      line-height: 1.6;
    }}
    .divider {{ height: 1px; background: var(--border); margin: 36px 0; }}
    .story-body {{ animation: fadeSlideUp 0.8s 0.15s cubic-bezier(0.22,1,0.36,1) both; }}
    .story-body p {{ font-size: 1rem; line-height: 1.85; color: var(--text); margin-bottom: 24px; }}
    .story-body blockquote {{
      border-left: 3px solid var(--border);
      margin: 28px 0;
      padding: 12px 0 12px 20px;
      color: var(--muted);
      font-style: italic;
      font-size: 0.97rem;
      line-height: 1.8;
      background: rgba(0,0,0,0.02);
      border-radius: 4px;
    }}
    .speaker {{ font-weight: 700; font-style: normal; color: var(--text); text-transform: uppercase; font-size: 0.85rem; }}
    .story-nav {{ display: flex; justify-content: space-between; gap: 12px; margin-top: 60px; }}
    .nav-btn {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 11px 18px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--muted);
      font-family: "Segoe UI", sans-serif;
      font-size: 0.88rem;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }}
    .nav-btn.active {{ cursor: pointer; opacity: 1; color: var(--text); }}
    .nav-btn.active:hover {{ background: var(--surface2); border-color: var(--accent); }}
    .nav-btn .nav-label {{ font-size: 0.72rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); display: block; margin-bottom: 2px; }}
    .nav-btn .nav-title {{ display: block; font-size: 0.9rem; font-weight: 600; color: var(--text); }}
    .nav-btn-inner {{ display: flex; flex-direction: column; }}

    @keyframes fadeSlideDown {{ from {{ opacity: 0; transform: translateY(-20px); }} to {{ opacity: 1; transform: translateY(0); }} }}
    @keyframes fadeSlideUp {{ from {{ opacity: 0; transform: translateY(18px); }} to {{ opacity: 1; transform: translateY(0); }} }}
  </style>
</head>
<body>
<div class="theme-toggle-wrap">
  <button id="theme-toggle" class="theme-toggle" aria-label="Toggle dark mode">
    <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
    <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
  </button>
</div>
<div class="container">
  <a href="/anthology" class="back-link">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
    anthology
  </a>
  <div class="story-header">
    <div class="story-meta">
      <span class="story-part-badge">Part 1</span>
      <span class="story-number">Story {num}</span>
    </div>
    <h1 class="story-title">{title}</h1>
    <p class="story-subtitle">{teaser}</p>
  </div>
  <div class="divider"></div>
  <div class="story-body">
    {body}
  </div>
  <div class="divider"></div>
  <div class="story-nav">
    {prev_btn}
    {next_btn}
  </div>
</div>
</body>
</html>"""

def generate_story_html(num, title, lines):
    # Process body lines
    body_html = []
    in_dialogue = False
    dialogue_block = []

    # Simple teaser: first paragraph or first 20 words
    teaser = ""
    for line in lines:
        if line and not re.match(r'^[A-Z\s]+:', line):
            teaser = line[:150] + "..." if len(line) > 150 else line
            break

    for line in lines:
        line = line.strip()
        if not line:
            if in_dialogue:
                body_html.append("<blockquote>" + "<br><br>".join(dialogue_block) + "</blockquote>")
                in_dialogue = False
                dialogue_block = []
            continue

        # Check for speaker format like "NAME: text"
        match = re.match(r'^([A-Z\xC0-\u1EF9\s]+):\s*(.*)', line)
        if match:
            speaker = match.group(1).strip()
            text = match.group(2).strip()
            dialog_line = f'<span class="speaker">{speaker}:</span> "{text}"'
            
            if not in_dialogue:
                in_dialogue = True
            dialogue_block.append(dialog_line)
        else:
            if in_dialogue:
                body_html.append("<blockquote>" + "<br><br>".join(dialogue_block) + "</blockquote>")
                in_dialogue = False
                dialogue_block = []
            body_html.append(f"<p>{line}</p>")

    if in_dialogue:
        body_html.append("<blockquote>" + "<br><br>".join(dialogue_block) + "</blockquote>")

    return "\n".join(body_html), teaser

def main():
    with open("e:/operagx/thermodynamix/tuyen_tap_content.txt", "r", encoding="utf-8") as f:
        content = f.read()

    # Split by story markers e.g. "0 – Giới thiệu", "1 – Làm giàu sớm"
    # Note: Using a broad regex to catch numbers followed by - or –
    stories_raw = re.split(r'\n(\d+)\s*[–-]', content)
    
    stories_data = []
    # stories_raw[0] is often the file header
    for i in range(1, len(stories_raw), 2):
        num = stories_raw[i].strip()
        rest = stories_raw[i+1].strip()
        lines = rest.split('\n')
        title = lines[0].strip()
        body_lines = lines[1:]
        stories_data.append({'num': num, 'title': title, 'lines': body_lines})

    # Create directories and files
    base_path = "e:/operagx/thermodynamix/anthology"
    os.makedirs(base_path, exist_ok=True)

    for i, data in enumerate(stories_data):
        num = data['num']
        title = data['title']
        body, teaser = generate_story_html(num, title, data['lines'])

        prev_btn = ""
        if i > 0:
            prev_story = stories_data[i-1]
            prev_btn = f"""<a href="/anthology/{prev_story['num']}" class="nav-btn active">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      <div class="nav-btn-inner">
        <span class="nav-label">Previous</span>
        <span class="nav-title">{prev_story['title']}</span>
      </div>
    </a>"""

        next_btn = ""
        if i < len(stories_data) - 1:
            next_story = stories_data[i+1]
            next_btn = f"""<a href="/anthology/{next_story['num']}" class="nav-btn active">
      <div class="nav-btn-inner" style="text-align:right;">
        <span class="nav-label">Next</span>
        <span class="nav-title">{next_story['title']}</span>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </a>"""

        html = TEMPLATE.format(
            num=num,
            title=title,
            teaser=teaser,
            body=body,
            prev_btn=prev_btn,
            next_btn=next_btn
        )

        dir_path = os.path.join(base_path, num)
        os.makedirs(dir_path, exist_ok=True)
        with open(os.path.join(dir_path, "index.html"), "w", encoding="utf-8") as f:
            f.write(html)

    print(f"Generated {len(stories_data)} stories.")

if __name__ == "__main__":
    main()
