/**
 * main.js — Core logic for WWTBAM Controller Sandbox
 * Refurbished Phase 3: Custom Find/Replace & Immersive Mode Relay
 */

// ─── STATE ───
let devBarVisible = false;
let monacoLoaded = false;
let editorModel = null;
let currentFilePath = null;
let selectedPath = null;
let selectedType = null; // 'file' or 'directory'
let currentPath = '';
let currentFile = null;
let currentEditorFile = null;
let uploadToast = null;
let selectedVariant = sessionStorage.getItem('wwtbam-variant') || localStorage.getItem('wwtbam-variant') || null;
let selectedFormat = sessionStorage.getItem('wwtbam-format') || localStorage.getItem('wwtbam-format') || null;
const CONTROLLER_SW_VERSION = '2.3';

const R2_BASE = 'https://pub-2d06308cf53245df865e113b0745c6d9.r2.dev/';

/* Menu labels for each format id, uniform across every variant that offers the format.
   Distinct from FORMAT_LABELS below, which is the shorter wording used in Settings. */
const FORMAT_MENU_LABELS = {
  '11': '11 questions format',
  '12': '12 questions format',
  '15': '15 questions format',
  '16': '16 questions format',
  'clock': 'Clock format',
  'risk': 'Risk format (UK 2018)'
};

function fmt(id, label, desc) { return { id, label, desc }; }

/* ─── CATALOG ───
   The single source for every graphic variant. VARIANTS, groups and nameMap below are
   derived from it; none of them is edited by hand. To add a variant, add it here only.

   Group order and item order become the menu order. The key order inside `formats`
   becomes both the format order in the menu and the key order in VARIANTS.
   `settingsName` overrides the label shown in the Settings diagnostic; it is present
   only where that label differs from `name`. */
const CATALOG = [
  {
    id: 'olga', name: 'Project Olga',
    items: [
      {
        id: 'olgav1', variantKey: 'olga_v1', name: 'Olga V1', tag: null,
        desc: 'The original WWTBAM Olga graphics. It\'s like the one you see in WWTBAM Greece, I think.',
        defaultFormat: '12',
        formats: {
          '12': R2_BASE + 'OlgaV1_12q.zip',
          '15': R2_BASE + 'OlgaV1.zip',
          '16': R2_BASE + 'OlgaV1_16q.zip',
          'clock': R2_BASE + 'OlgaV1_Clock.zip',
          'risk': R2_BASE + 'OlgaV1_Risk.zip'
        }
      },
      {
        id: 'olgav15azerbaijan', variantKey: 'olga_v1_5_azerbaijan', name: 'Olga V1.5 Azerbaijan', tag: null,
        desc: 'Also the WWTBAM Olga graphics in Vietnam, although with a slightly different win strap and PAF clock.',
        defaultFormat: '12',
        formats: {
          '12': R2_BASE + 'OlgaV1.5_Azerbaijan_12q.zip',
          '15': R2_BASE + 'OlgaV1.5_Azerbaijan.zip',
          '16': R2_BASE + 'OlgaV1.5_Azerbaijan_16q.zip',
          'clock': R2_BASE + 'OlgaV1.5_Azerbaijan_Clock.zip',
          'risk': R2_BASE + 'OlgaV1.5_Azerbaijan_Risk.zip'
        }
      },
      {
        id: 'olgav15vietnam', variantKey: 'olga_v1_5_vietnam', name: 'Olga V1.5 Vietnam', tag: null,
        desc: 'Do people really read these descriptions? Either way, it\'s the WWTBAM Olga graphics that looked revolutionary when it first came out in Vietnam, at least that\'s what I think',
        defaultFormat: '12',
        formats: {
          '12': R2_BASE + 'OlgaV1.5_Vietnam_12q.zip',
          '15': R2_BASE + 'OlgaV1.5_Vietnam.zip',
          '16': R2_BASE + 'OlgaV1.5_Vietnam_16q.zip',
          'clock': R2_BASE + 'OlgaV1.5_Vietnam_Clock.zip',
          'risk': R2_BASE + 'OlgaV1.5_Vietnam_Risk.zip'
        }
      },
      {
        id: 'olgav2', variantKey: 'olga_v2', name: 'Olga V2', tag: null,
        desc: 'The WWTBAM Olga graphics used in Costa Rica, I think.',
        defaultFormat: '12',
        formats: {
          '12': R2_BASE + 'OlgaV2_12q.zip',
          '15': R2_BASE + 'OlgaV2.zip',
          '16': R2_BASE + 'OlgaV2_16q.zip',
          'clock': R2_BASE + 'OlgaV2_Clock.zip',
          'risk': R2_BASE + 'OlgaV2_Risk.zip'
        }
      },
      {
        id: 'olga', variantKey: 'olga', name: 'Olga V2.5', tag: null,
        desc: 'Olga V2 but with a different font for money tree, I think. That\'s the only thing I noticed LMFAO.',
        defaultFormat: '12',
        formats: {
          '12': R2_BASE + 'OlgaV2.5_12q.zip',
          '15': R2_BASE + 'OlgaV2.5.zip',
          '16': R2_BASE + 'OlgaV2.5_16q.zip',
          'clock': R2_BASE + 'OlgaV2.5_Clock.zip',
          'risk': R2_BASE + 'OlgaV2.5_Risk.zip'
        }
      },
      {
        id: 'olga_v3', variantKey: 'olga_v3', name: 'Olga V3', tag: null,
        desc: 'It\'s the UK Hot Seat 2026 graphics but brought into Olga... I guess? Except for the money tree part, though.',
        defaultFormat: '12',
        formats: {
          '12': R2_BASE + 'OlgaV3_12q.zip',
          '15': R2_BASE + 'OlgaV3.zip',
          '16': R2_BASE + 'OlgaV3_16q.zip',
          'clock': R2_BASE + 'OlgaV3_Clock.zip',
          'risk': R2_BASE + 'OlgaV3_Risk.zip'
        }
      }
    ]
  },
  {
    id: 'rave', name: 'Project Rave',
    items: [
      {
        id: 'rave2007', variantKey: '2007_blue', name: '2007 Blue', settingsName: 'Project Rave (2007 Blue)', tag: null,
        desc: 'The iconic 2007 internation rave graphics that is basically 2008 Blue with a few differences.',
        defaultFormat: '15',
        formats: {
          '12': R2_BASE + '2007_Blue_12q.zip',
          '15': R2_BASE + '2007_Blue.zip'
        }
      },
      {
        id: 'rave2008', variantKey: '2008_blue', name: '2008 Blue', settingsName: 'Project Rave (2008 Blue)', tag: null,
        desc: 'The iconic 2008 UK & international rave graphics that you definitely have seen before.',
        defaultFormat: '15',
        formats: {
          '12': R2_BASE + '2008_Blue_12q.rar',
          '15': R2_BASE + '2008_Blue.zip'
        }
      },
      {
        id: 'rave2017', variantKey: '2017_blue', name: '2017 Blue', settingsName: 'Project Rave (2017 Blue)', tag: null,
        desc: 'Basically 2008 Blue but a bit different, I guess.',
        defaultFormat: '15',
        formats: {
          '12': R2_BASE + '2017_Blue_12q.rar',
          '15': R2_BASE + '2017_Blue.zip'
        }
      },
      {
        id: 'kbc2010', variantKey: 'kbc_2010', name: 'KBC 2010', settingsName: 'Project Rave (KBC 2010)', tag: null,
        desc: 'Basically Rave Format but... purple-ish, I guess. Probably looks a bit American too.',
        defaultFormat: '12',
        formats: {
          '12': R2_BASE + 'KBC_2010_12q.rar'
        }
      }
    ]
  },
  {
    id: 'classic', name: 'Project Classic',
    items: [
      {
        id: 'classic1998', variantKey: '1998_classic', name: '1998 Classic', tag: null,
        desc: 'The original graphic style used in the UK.',
        defaultFormat: '15',
        formats: {
          '15': R2_BASE + '1998_Classic.zip'
        }
      },
      {
        id: 'endemol1999', variantKey: '1999_endemol', name: '1999 Endemol', tag: null,
        desc: 'The graphics style used in the Netherlands.',
        defaultFormat: '15',
        formats: {
          '15': R2_BASE + '1999_Endemol.zip'
        }
      },
      {
        id: '1999_australia', variantKey: '1999_australia', name: '1999 Australia', tag: null,
        desc: 'The original graphic style but with slightly different fonts... and lifeline graphics... and PAF & ATA graphics... oh my god the list goes on.',
        defaultFormat: '11',
        formats: {
          '11': R2_BASE + '1999_Australia.zip'
        }
      },
      {
        id: '1999_classic', variantKey: '1999_classic', name: '1999 Classic', tag: null,
        desc: '1998 Classic but a bit different. IDK the difference, maybe the lifelines icon are much squeezed or somethin\'.',
        defaultFormat: '15',
        formats: {
          '15': R2_BASE + '1999_Classic.zip'
        }
      },
      {
        id: '1999_classic_v_2', variantKey: '1999_classic_v_2', name: '1999 Classic v 2', tag: null,
        desc: '1999 Classic but a bit different. You just have to look for the exact difference.',
        defaultFormat: '15',
        formats: {
          '15': R2_BASE + '1999_Classic_v2.zip'
        }
      },
      {
        id: '1999_classic_v_3', variantKey: '1999_classic_v_3', name: '1999 Classic v 3', tag: null,
        desc: 'Alright how are there this many versions of 1999 Classic?',
        defaultFormat: '15',
        formats: {
          '15': R2_BASE + '1999_Classic_v3.zip'
        }
      },
      {
        id: '1999_endemol_v_2', variantKey: '1999_endemol_v_2', name: '1999 Endemol v 2', tag: null,
        desc: 'The Classic graphics used in the Netherlands but the lifelines\' fill are actually black and not transparent, I think.',
        defaultFormat: '15',
        formats: {
          '15': R2_BASE + '1999_Endemol_v2.zip'
        }
      },
      {
        id: '2000_australia', variantKey: '2000_australia', name: '2000 Australia', tag: null,
        desc: '1999 Australia but with 15 questions.',
        defaultFormat: '15',
        formats: {
          '15': R2_BASE + '2000_Australia.zip'
        }
      },
      {
        id: '2002_classic', variantKey: '2002_classic', name: '2002 Classic', tag: null,
        desc: '1999 Classic but the graphics shifted like 0.2 pixels I think.',
        defaultFormat: '15',
        formats: {
          '15': R2_BASE + '2002_Classic.zip'
        }
      },
      {
        id: '2002_classic_v_2', variantKey: '2002_classic_v_2', name: '2002 Classic v 2', tag: null,
        desc: 'Alright I\'m tired of writing these descriptions. These graphics have like so little differences that I honestly do not care at all LMFAO.',
        defaultFormat: '15',
        formats: {
          '15': R2_BASE + '2002_Classic_v2.zip'
        }
      }
    ]
  },
  {
    id: 'hotseat', name: 'Project Hot Seat',
    items: [
      {
        id: 'hot_seat_2009_au', variantKey: 'hot_seat_2009_au', name: 'Hot Seat 2009 AU', tag: null,
        desc: 'The original 2009 Hot Seat graphics used in Australia',
        defaultFormat: '15',
        formats: {
          '15': R2_BASE + 'HotSeat2009AU.zip'
        }
      },
      {
        id: 'hot_seat_2010', variantKey: 'hot_seat_2010', name: 'Hot Seat 2010', tag: null,
        desc: 'The 2010 Hot Seat graphics used... somewhere, maybe in Greece, I guess.',
        defaultFormat: '15',
        formats: {
          '15': R2_BASE + 'HotSeat2010.zip'
        }
      },
      {
        id: 'hotseat_2010_vn', variantKey: 'hotseat_2010_vn', name: 'Hot Seat 2010 Vietnam', tag: null,
        desc: 'The 2010 Hot Seat Graphics but with Vietnamese stuff, probably with minuscule changes to how soundtracks play.',
        defaultFormat: '15',
        formats: {
          '15': R2_BASE + 'HotSeat2010VN.zip'
        }
      },
      {
        id: 'hot_seat_2026_au', variantKey: 'hot_seat_2026_au', name: 'Hot Seat 2026 AU', tag: null,
        desc: 'Australia has a 2026 version of WWTBAM Hot Seat????',
        defaultFormat: '15',
        formats: {
          '15': R2_BASE + 'HotSeat2026AU.zip'
        }
      },
      {
        id: 'hotseat_2026_au_alt', variantKey: 'hotseat_2026_au_alt', name: 'Hot Seat 2026 AU (Alt)', tag: null,
        desc: 'And there is another graphic variation of that???',
        defaultFormat: '15',
        formats: {
          '15': R2_BASE + 'HotSeat2026AUAlt.zip'
        }
      },
      {
        id: 'hot_seat_2026_uk', variantKey: 'hot_seat_2026_uk', name: 'Hot Seat 2026 UK', tag: null,
        desc: 'The graphics used in the 2026 Hot Seat version of WWTBAM UK.',
        defaultFormat: '15',
        formats: {
          '15': R2_BASE + 'HotSeat2026UK.zip'
        }
      },
      {
        id: 'hotseat_2026_uk_alt', variantKey: 'hotseat_2026_uk_alt', name: 'Hot Seat 2026 UK (Alt)', tag: null,
        desc: 'Alright, what\'s up with Millionaire switching up graphics every so often?',
        defaultFormat: '15',
        formats: {
          '15': R2_BASE + 'HotSeat2026UKAlt.zip'
        }
      },
      {
        id: 'hotseat_2026_uk_alt2', variantKey: 'hotseat_2026_uk_alt2', name: 'Hot Seat 2026 UK (Alt 2)', tag: null,
        desc: 'I couldn\'t think of more creative descriptions for these.',
        defaultFormat: '15',
        formats: {
          '15': R2_BASE + 'HotSeat2026UKAlt2.zip'
        }
      },
      {
        id: 'hotseat_2026_uk_real', variantKey: 'hotseat_2026_uk_real', name: 'Hot Seat 2026 UK (Broadcast)', tag: null,
        desc: 'Ah yes, Hot Seat 2026 UK Real, and there will be "HOT SEAT 2026 UK REAL 2" or something. I can\'t trust this anymore /j',
        defaultFormat: '15',
        formats: {
          '15': R2_BASE + 'HotSeat2026UKReal.zip'
        }
      }
    ]
  }
];

const CATALOG_ITEMS = CATALOG.flatMap(g => g.items);

/** variantKey -> { formatId: bundleUrl } */
const VARIANTS = Object.fromEntries(
  CATALOG_ITEMS.map(it => [it.variantKey, { ...it.formats }])
);

/** variantKey -> label for the Settings diagnostic */
const nameMap = Object.fromEntries(
  CATALOG_ITEMS.map(it => [it.variantKey, it.settingsName || it.name])
);

/** The variation menu's group/item tree */
const groups = CATALOG.map(g => ({
  id: g.id,
  name: g.name,
  items: g.items.map(it => ({
    id: it.id,
    variantKey: it.variantKey,
    name: it.name,
    tag: it.tag,
    desc: it.desc,
    formats: Object.keys(it.formats).map(f => fmt(f, FORMAT_MENU_LABELS[f], '')),
    defaultFormat: it.defaultFormat
  }))
}));

/* Display names for format ids. Keep in sync with the `formats` arrays in `groups`.
   Ids are not all numeric, so never interpolate one into a "N Questions" sentence. */
const FORMAT_LABELS = {
  '11': '11 questions',
  '12': '12 questions',
  '15': '15 questions',
  '16': '16 questions',
  'clock': 'Clock format',
  'risk': 'Risk format (UK 2018)'
};

function toggleNewMenu() { /* legacy stub */ }
// Close menus when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.fab-container')) {
    const m = document.getElementById('newMenu');
    if (m) m.classList.remove('active');
  }
});
let activeTab = 'files';
let expandedFolders = new Set(['questions', 'scripts', 'images']);
let lastClickTime = 0;
let lastClickPath = null;

// Settings (persist in localStorage)
let settings = Object.assign(
  { promptConflict: true, menuLightMode: false, editorLightMode: false },
  JSON.parse(localStorage.getItem('sandbox-settings') || '{}')
);

// ─── UTILS ───
function getFileIcon(path) {
  const ext = path.split('.').pop().toLowerCase();

  const icons = {
    js: { color: '#f7df1e', svg: '<path d="M3,3V21H21V3H3M7.73,18.04C7.13,18.04 6.5,17.92 5.9,17.68V16.1C6.5,16.55 7.16,16.83 7.9,16.83C8.61,16.83 8.94,16.5 8.94,16.03C8.94,15.44 8.5,15.22 7.7,14.88L6.82,14.5C5.8,14.07 5.16,13.44 5.16,12.35C5.16,11.23 6.03,10.5 7.27,10.5C7.94,10.5 8.5,10.64 9.1,10.9V12.44C8.6,12.06 7.9,11.83 7.31,11.83C6.7,11.83 6.4,12.13 6.4,12.5C6.4,13.06 6.9,13.3 7.6,13.61L8.47,14C9.5,14.44 10.15,15.08 10.15,16.17C10.15,17.43 9.17,18.04 7.73,18.04M15.42,18.04C14,18.04 13.1,17.3 12.63,16.24L14.1,15.4C14.4,15.94 14.71,16.53 15.41,16.53C16.06,16.53 16.5,16.17 16.5,15.54V10.65H17.75V15.53C17.75,17.14 16.71,18.04 15.42,18.04Z"/>' },
    xml: { color: '#2f81f7', svg: '<path d="M12.89 3L14.85 3.4L11.11 21L9.15 20.6L12.89 3M19.59 12L16 8.41V5.58L22.42 12L16 18.41V15.58L19.59 12M1.58 12L8 5.58V8.41L4.41 12L8 15.58V18.41L1.58 12Z"/>' },
    css: { color: '#8b5cf6', svg: '<path d="M5,3L4.35,6.34H17.94L17.5,8.53H3.92L3.26,11.87H16.85L16.07,15.76L11.72,17.14L7.38,15.76L7.66,14.34H4.26L3.71,17.14L11.72,21L19.74,17.14L21,7.03L21,3H5Z"/>' },
    html: { color: '#ff5722', svg: '<path d="M12,17.5L8.33,14.92L4.66,12.33L8.33,9.75L12,7.17L15.66,9.75L19.33,12.33L15.66,14.92L12,17.5M12,4.4L2,12.33L12,20.25L22,12.33L12,4.4Z"/>' },
    png: { color: '#4caf50', svg: '<path d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z"/>' },
    jpg: { color: '#4caf50', svg: '<path d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z"/>' },
    jpeg: { color: '#4caf50', svg: '<path d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z"/>' },
    mp3: { color: '#f85149', svg: '<path d="M12,3V13.55C11.41,13.21 10.73,13 10,13C7.79,13 6,14.79 6,17C6,19.21 7.79,21 10,21C12.21,21 14,19.21 14,17V7H18V3H12Z"/>' },
    wav: { color: '#f85149', svg: '<path d="M12,3V13.55C11.41,13.21 10.73,13 10,13C7.79,13 6,14.79 6,17C6,19.21 7.79,21 10,21C12.21,21 14,19.21 14,17V7H18V3H12Z"/>' },
    ttf: { color: '#9e9e9e', svg: '<path d="M9,4V7H11V19H14V7H16V4H9Z"/>' },
    otf: { color: '#9e9e9e', svg: '<path d="M9,4V7H11V19H14V7H16V4H9Z"/>' },
    woff: { color: '#9e9e9e', svg: '<path d="M9,4V7H11V19H14V7H16V4H9Z"/>' },
    woff2: { color: '#9e9e9e', svg: '<path d="M9,4V7H11V19H14V7H16V4H9Z"/>' }
  };

  const config = icons[ext] || { color: '#848d97', svg: '<path d="M13,9V3.5L18.5,9M6,2C4.89,2 4,2.89 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6Z"/>' };
  return `<svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: ${config.color}; display: block;">${config.svg}</svg>`;
}

function isMobileDevice() {
  return (navigator.maxTouchPoints > 1 && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)) ||
    (window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(hover: none)').matches) ||
    (window.screen.width < 768);
}


// ─── VALIDATION & DIRTY STATE HELPERS ───
const ILLEGAL_FILENAME_CHARS = /[\\:*?"<>|\/]/;

function validateItemName(name, isFolder) {
  if (!name || !name.trim()) {
    return { valid: false, error: 'Name cannot be empty.' };
  }
  const trimmed = name.trim();
  if (trimmed.toLowerCase() === 'filename.ext' || trimmed.toLowerCase() === 'folder name') {
    return { valid: false, error: 'Please choose a custom name.' };
  }
  if (ILLEGAL_FILENAME_CHARS.test(trimmed)) {
    return { valid: false, error: 'Name contains invalid characters (/ \\ : * ? " < > |).' };
  }
  return { valid: true, name: trimmed };
}

let isEditorDirty = false;
function setDirty(dirty) {
  isEditorDirty = dirty;
  const titleEl = document.getElementById('editorOpenFile');
  if (!titleEl) return;
  const existingDot = titleEl.querySelector('.editor-dirty-dot');
  if (dirty && !existingDot) {
    const dot = document.createElement('span');
    dot.className = 'editor-dirty-dot';
    dot.title = 'Unsaved changes';
    titleEl.appendChild(dot);
  } else if (!dirty && existingDot) {
    existingDot.remove();
  }
}

// ─── MENU & TABS ───
function toggleDevBar() {
  devBarVisible = !devBarVisible;
  const overlay = document.getElementById('editMenuOverlay');
  if (overlay) overlay.classList.toggle('active', devBarVisible);
  if (devBarVisible) {
    switchTab(activeTab);
    renderFileList();
    initSettingsUI();
    if (!monacoLoaded) loadMonaco();
    else if (window.editor) {
      setTimeout(() => window.editor.layout(), 50);
    }
  }
}

let currentFileView = 'list';
function setFileView(view) {
  currentFileView = view;
  const btnList = document.getElementById('btnListView');
  const btnGrid = document.getElementById('btnGridView');
  if (btnList) btnList.classList.toggle('active', view === 'list');
  if (btnGrid) btnGrid.classList.toggle('active', view === 'grid');
  const listEl = document.getElementById('fileList');
  const gridEl = document.getElementById('fileGrid');
  if (listEl) listEl.style.display = view === 'list' ? 'block' : 'none';
  if (gridEl) gridEl.style.display = view === 'grid' ? 'grid' : 'none';
  renderFileList();
}

function switchTab(tabId) {
  activeTab = tabId;
  const titleMap = { 'files': 'My Files', 'editor': 'Editor', 'info': 'Sandbox Guide', 'settings': 'Settings', 'switch': 'Switch variant' };
  const titleEl = document.getElementById('editTopTitle');
  if (titleEl) titleEl.textContent = titleMap[tabId] || 'Editor';
  document.querySelectorAll('.rail-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.edit-panel').forEach(c => c.classList.remove('active'));
  const tabBtn = document.getElementById(`railBtn-${tabId}`);
  const tabContent = document.getElementById(`panel-${tabId}`);
  if (tabBtn) tabBtn.classList.add('active');
  if (tabContent) tabContent.classList.add('active');
  if (tabId === 'editor') {
    if (!monacoLoaded) loadMonaco();
    setTimeout(() => {
      if (window.editor) window.editor.layout();
    }, 50);
  }
  if (tabId === 'switch') renderSwitchPanel();
}

// ─── IMMERSIVE MODE ───
function toggleTopBar() {
  document.body.classList.toggle('topbar-hidden');
  localStorage.setItem('topbar-hidden', document.body.classList.contains('topbar-hidden'));
}



// ─── DRIVE-STYLE FILE LIST ───
async function renderFileList() {
  const listContainer = document.getElementById('fileList');
  const gridContainer = document.getElementById('fileGrid');
  if (!listContainer || !gridContainer) return;
  const allPaths = await getAllPaths();
  const paths = allPaths.filter(p => !p.endsWith('/.keep'));
  const folderKeepPaths = allPaths.filter(p => p.endsWith('/.keep'));

  if (paths.length === 0) {
    const emptyHtml = `
      <div class="root-empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--edit-text-ghost)"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <h4>No files in sandbox</h4>
        <p>Upload your controller graphics and sounds or restore the default questions.</p>
        <div style="display:flex;gap:8px;">
          <button class="sg-btn" onclick="document.getElementById('fileInput').click()">Upload Files</button>
          <button class="sg-btn" onclick="restoreDefaultQuestions()">Restore Defaults</button>
        </div>
      </div>`;
    listContainer.innerHTML = emptyHtml;
    gridContainer.innerHTML = emptyHtml;
    return;
  }

  // List View
  const tree = buildFileTree(allPaths);
  listContainer.innerHTML = renderTreeRecursive(tree, '', 0);

  // Grid View
  let gridHtml = '';
  paths.sort().forEach(p => {
    const name = p.split('/').pop();
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    const folderPath = p.includes('/') ? p.substring(0, p.lastIndexOf('/')) : '/';
    const thumb = getGridThumbHtml(ext, name);
    gridHtml += `
      <div class="file-card${selectedPath === p ? ' selected' : ''}" data-path="${p}" onclick="handleRowClick(event,'${p}',false)" title="${p}">
        <div class="file-thumb">${thumb}</div>
        <span class="file-card-name">${name}</span>
        <span class="file-card-path">${folderPath}</span>
      </div>`;
  });
  gridContainer.innerHTML = gridHtml;

  highlightSelectedRow();
}

function getGridThumbHtml(ext, name) {
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
    return `<div class="file-thumb-img" style="flex-direction:column;gap:2px;"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span style="font-size:9px;font-weight:600;letter-spacing:0.04em;">${ext.toUpperCase()}</span></div>`;
  }
  if (ext === 'xml') {
    return `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#a06ad6" stroke-width="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg><span class="file-badge badge-xml" style="position:absolute;bottom:4px;right:4px;">XML</span></div>`;
  }
  if (['js', 'json', 'ts'].includes(ext)) {
    return `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#c49a1a" stroke-width="1.7"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg><span class="file-badge badge-js" style="position:absolute;bottom:4px;right:4px;">${ext.toUpperCase()}</span></div>`;
  }
  if (['html', 'htm'].includes(ext)) {
    return `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#5aab5a" stroke-width="1.7"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><span class="file-badge badge-html" style="position:absolute;bottom:4px;right:4px;">HTML</span></div>`;
  }
  if (['mp3', 'wav', 'ogg'].includes(ext)) {
    return `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#e57373" stroke-width="1.7"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg><span class="file-badge badge-other" style="position:absolute;bottom:4px;right:4px;">AUDIO</span></div>`;
  }
  return `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#7c8490" stroke-width="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span class="file-badge badge-other" style="position:absolute;bottom:4px;right:4px;">${ext ? ext.toUpperCase() : 'FILE'}</span></div>`;
}

function buildFileTree(paths) {
  const root = { _files: [], _folders: {} };
  paths.forEach(path => {
    const isKeep = path.endsWith('/.keep');
    const actualPath = isKeep ? path.substring(0, path.length - '/.keep'.length) : path;
    const parts = actualPath.split('/');
    let current = root;
    if (isKeep) {
      for (let i = 0; i < parts.length; i++) {
        const folder = parts[i];
        if (!current._folders[folder]) current._folders[folder] = { _files: [], _folders: {} };
        current = current._folders[folder];
      }
    } else {
      for (let i = 0; i < parts.length - 1; i++) {
        const folder = parts[i];
        if (!current._folders[folder]) current._folders[folder] = { _files: [], _folders: {} };
        current = current._folders[folder];
      }
      current._files.push(path);
    }
  });
  return root;
}

function getBadgeClass(ext) {
  if (ext === 'xml') return 'file-badge badge-xml';
  if (ext === 'js' || ext === 'json' || ext === 'ts') return 'file-badge badge-js';
  if (ext === 'html' || ext === 'htm') return 'file-badge badge-html';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'file-badge badge-png';
  return 'file-badge badge-other';
}

function renderTreeRecursive(node, currentPath, depth = 0) {
  let html = '';
  const folders = Object.keys(node._folders).sort();
  const pad = Math.min(depth, 8) * 14;

  folders.forEach(name => {
    const fullPath = currentPath ? `${currentPath}/${name}` : name;
    const isOpen = expandedFolders.has(fullPath);
    const folderSvg = isOpen
      ? `<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2z"/><polyline points="8 14 12 10 16 14"/>`
      : `<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><line x1="9" y1="14" x2="15" y2="14"/>`;
    const chevronSvg = `<svg viewBox="0 0 24 24" class="chevron-icon"><polyline points="9 18 15 12 9 6"/></svg>`;
    html += `<div class="file-row${isOpen ? ' open' : ''}${selectedPath === fullPath ? ' selected' : ''}" data-path="${fullPath}" data-type="folder" onclick="handleRowClick(event,'${fullPath}',true)" style="padding-left:${12 + pad}px">
      ${chevronSvg}
      <span class="node-icon" style="color:${isOpen ? 'var(--edit-accent)' : 'var(--edit-text-dimmed)'}"><svg viewBox="0 0 24 24">${folderSvg}</svg></span>
      <span class="file-name" title="${name}">${name}</span>
      <span class="row-acts">
        <button class="ra" onclick="event.stopPropagation();renameFolderWrapper('${fullPath}')" title="Rename"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="ra danger" onclick="event.stopPropagation();deleteFolderWrapper('${fullPath}')" title="Delete"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
      </span>
    </div>`;
    if (isOpen) {
      const childFolders = Object.keys(node._folders[name]._folders);
      const childFiles = node._folders[name]._files;
      if (childFolders.length === 0 && childFiles.length === 0) {
        html += `<div class="empty-folder-row" style="padding-left:${12 + pad + 25}px"><span>(empty folder)</span></div>`;
      } else {
        html += renderTreeRecursive(node._folders[name], fullPath, depth + 1);
      }
    }
  });

  const files = node._files.sort();
  files.forEach(path => {
    const name = path.split('/').pop();
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    const isImg = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);
    const iconPath = isImg
      ? `<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>`
      : `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`;
    const bk = getBadgeClass(ext);
    const badgeText = ext ? ext.toUpperCase() : 'FILE';
    html += `<div class="file-row${selectedPath === path ? ' selected' : ''}" data-path="${path}" data-type="file" onclick="handleRowClick(event,'${path}',false)" style="padding-left:${12 + pad}px">
      <span class="chevron-spacer"></span>
      <span class="node-icon" style="color:var(--edit-text-ghost)"><svg viewBox="0 0 24 24">${iconPath}</svg></span>
      <span class="file-name" title="${name}">${name}</span>
      <span class="${bk}">${badgeText}</span>
      <span class="row-acts">
        <button class="ra" onclick="event.stopPropagation();renameFileWrapper('${path}')" title="Rename"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="ra danger" onclick="event.stopPropagation();deleteFileWrapper('${path}')" title="Delete"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
      </span>
    </div>`;
  });
  return html;
}

// ─── CLICK & DOUBLE CLICK ───
function handleRowClick(e, path, isFolder) {
  const now = Date.now();
  if (now - lastClickTime < 300 && lastClickPath === path) {
    if (isFolder) toggleFolder(path);
    else loadFile(path);
    lastClickTime = 0;
  } else {
    selectedPath = path;
    selectedType = isFolder ? 'directory' : 'file';
    lastClickTime = now;
    lastClickPath = path;
    highlightSelectedRow();
  }
}

function highlightSelectedRow() {
  document.querySelectorAll('.file-row, .file-card').forEach(el => {
    el.classList.toggle('selected', el.getAttribute('data-path') === selectedPath);
  });
}

async function inlineNewItem(type) {
  const container = document.getElementById('fileList');
  if (!container) return;

  const existing = document.getElementById('inline-new-item');
  if (existing) {
    const inp = existing.querySelector('input');
    if (inp) {
      inp.focus();
      inp.select();
    }
    return;
  }

  // Switch to list view if currently in grid view
  if (currentFileView !== 'list') {
    currentFileView = 'list';
    const btnList = document.getElementById('btnListView');
    const btnGrid = document.getElementById('btnGridView');
    if (btnList) btnList.classList.add('active');
    if (btnGrid) btnGrid.classList.remove('active');
    const listEl = document.getElementById('fileList');
    const gridEl = document.getElementById('fileGrid');
    if (listEl) listEl.style.display = 'block';
    if (gridEl) gridEl.style.display = 'none';
    await renderFileList();
  }

  // Determine target directory based on current selection
  let targetDir = '';
  let indentPad = 0;
  if (selectedPath) {
    if (selectedType === 'directory') {
      targetDir = selectedPath;
      indentPad = (selectedPath.split('/').length) * 14;
      if (!expandedFolders.has(selectedPath)) {
        expandedFolders.add(selectedPath);
        await renderFileList();
      }
    } else {
      // Selected item is a file: create as sibling in its parent directory
      if (selectedPath.includes('/')) {
        targetDir = selectedPath.substring(0, selectedPath.lastIndexOf('/'));
        indentPad = (targetDir.split('/').length) * 14;
      }
    }
  }

  const div = document.createElement('div');
  div.className = 'new-row';
  div.id = 'inline-new-item';
  div.style.paddingLeft = (12 + indentPad) + 'px';

  // Prevent clicks inside the new row from triggering outside document clicks
  div.addEventListener('click', (e) => e.stopPropagation());
  div.addEventListener('mousedown', (e) => e.stopPropagation());

  const folderSvg = type === 'folder'
    ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--edit-accent)" stroke-width="1.8"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`
    : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--edit-text-ghost)" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

  div.innerHTML = `
    <span class="node-icon" style="display:flex;align-items:center;">${folderSvg}</span>
    <input type="text" class="inline-input" placeholder="${type === 'folder' ? 'folder name' : 'filename.ext'}" autocomplete="off" spellcheck="false" />
    <div class="new-row-actions">
      <button class="new-row-btn confirm" type="button" title="Create (Enter)">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </button>
      <button class="new-row-btn cancel" type="button" title="Cancel (Esc)">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  `;

  const input = div.querySelector('input');
  const confirmBtn = div.querySelector('.new-row-btn.confirm');
  const cancelBtn = div.querySelector('.new-row-btn.cancel');

  // Position: if targetDir is selected, put it right under the target folder row
  let inserted = false;
  if (targetDir) {
    const parentRow = container.querySelector(`.file-row[data-path="${targetDir}"]`);
    if (parentRow && parentRow.nextSibling) {
      container.insertBefore(div, parentRow.nextSibling);
      inserted = true;
    } else if (parentRow) {
      container.appendChild(div);
      inserted = true;
    }
  }
  if (!inserted) {
    container.prepend(div);
  }

  // Focus input
  requestAnimationFrame(() => {
    if (document.body.contains(input)) {
      input.focus();
    }
  });

  let isCommitting = false;

  const cleanup = () => {
    document.removeEventListener('mousedown', handleDocMouseDown, true);
    if (div.parentNode) div.remove();
  };

  const handleCancel = () => {
    if (isCommitting) return;
    isCommitting = true;
    cleanup();
  };

  const handleSave = async () => {
    if (isCommitting) return;
    isCommitting = true;
    const rawVal = input.value.trim();

    if (!rawVal) {
      cleanup();
      return;
    }

    const validation = validateItemName(rawVal, type === 'folder');
    if (!validation.valid) {
      showNotification(validation.error, false);
      isCommitting = false;
      input.focus();
      return;
    }
    const cleanName = validation.name;
    const targetPath = targetDir ? targetDir + '/' + cleanName : cleanName;

    // Check collision in same directory (case-insensitive)
    const allPaths = await getAllPaths();
    const collision = allPaths.some(p => {
      const pNorm = p.toLowerCase();
      const targetNorm = targetPath.toLowerCase();
      return pNorm === targetNorm || pNorm === targetNorm + '/.keep' || pNorm.startsWith(targetNorm + '/');
    });

    if (collision) {
      showNotification(`An item named "${cleanName}" already exists here.`, false);
      isCommitting = false;
      input.focus();
      return;
    }

    cleanup();

    if (type === 'folder') {
      await saveFile(targetPath + '/.keep', new Uint8Array([0]), 'text/plain');
      expandedFolders.add(targetPath);
      selectedPath = targetPath;
      selectedType = 'directory';
      showNotification(`Created folder "${cleanName}"`, false);
      await renderFileList();
    } else {
      const mime = getLoaderMimeType(targetPath);
      await saveFile(targetPath, new Uint8Array([0]), mime);
      selectedPath = targetPath;
      selectedType = 'file';
      showNotification(`Created file "${cleanName}"`, false);
      await renderFileList();
      await loadFile(targetPath);
    }
  };

  // Prevent mousedown on action buttons from blurring the input
  confirmBtn.addEventListener('mousedown', (e) => e.preventDefault());
  cancelBtn.addEventListener('mousedown', (e) => e.preventDefault());

  confirmBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleSave();
  });

  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleCancel();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  });

  // Handle explicit outside click via document mousedown
  const handleDocMouseDown = (e) => {
    if (div.contains(e.target) || (e.target && e.target.closest && e.target.closest('.ib'))) return;
    const rawVal = input.value.trim();
    if (rawVal) {
      handleSave();
    } else {
      handleCancel();
    }
  };

  setTimeout(() => {
    document.addEventListener('mousedown', handleDocMouseDown, true);
  }, 100);
}

function toggleFolder(path) {
  if (expandedFolders.has(path)) expandedFolders.delete(path);
  else expandedFolders.add(path);
  renderFileList();
}

// ─── RENAME & DELETE ───
async function renameFileWrapper(oldPath) {
  const oldName = oldPath.split('/').pop();
  const row = document.querySelector(`.file-row[data-path="${oldPath}"]`);
  if (!row) return;
  const nameSpan = row.querySelector('.file-name');
  if (!nameSpan) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-input';
  input.value = oldName;

  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  let isCommitting = false;
  const handleSave = async () => {
    if (isCommitting) return;
    isCommitting = true;
    const rawVal = input.value.trim();
    if (!rawVal || rawVal === oldName) {
      input.replaceWith(nameSpan);
      return;
    }

    const validation = validateItemName(rawVal, false);
    if (!validation.valid) {
      showNotification(validation.error, false);
      input.replaceWith(nameSpan);
      return;
    }
    const newName = validation.name;
    const parts = oldPath.split('/');
    parts[parts.length - 1] = newName;
    const newPath = parts.join('/');

    // Check duplicate in same folder (case-insensitive, ignoring self)
    const allPaths = await getAllPaths();
    const collision = allPaths.some(p => p.toLowerCase() === newPath.toLowerCase() && p !== oldPath);
    if (collision) {
      showNotification(`A file named "${newName}" already exists in this folder.`, false);
      input.replaceWith(nameSpan);
      return;
    }

    const record = await getFile(oldPath);
    if (record) {
      await saveFile(newPath, record.blob, record.mimeType || getLoaderMimeType(newPath));
      await deleteFile(oldPath);
      if (currentFilePath === oldPath) {
        currentFilePath = newPath;
        const topBarTitle = document.getElementById('editorOpenFile');
        if (topBarTitle) {
          topBarTitle.textContent = newPath;
          if (isEditorDirty) setDirty(true);
        }
      }
      if (selectedPath === oldPath) selectedPath = newPath;
      renderFileList(); hardRefresh();
    } else {
      input.replaceWith(nameSpan);
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      isCommitting = true;
      input.replaceWith(nameSpan);
    }
  });
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (!isCommitting && document.body.contains(input)) {
        handleSave();
      }
    }, 150);
  });
}

async function renameFolderWrapper(oldPrefix) {
  const oldName = oldPrefix.split('/').pop();
  const row = document.querySelector(`.file-row[data-path="${oldPrefix}"]`);
  if (!row) return;
  const nameSpan = row.querySelector('.file-name');
  if (!nameSpan) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-input';
  input.value = oldName;

  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  let isCommitting = false;
  const handleSave = async () => {
    if (isCommitting) return;
    isCommitting = true;
    const rawVal = input.value.trim();
    if (!rawVal || rawVal === oldName) {
      input.replaceWith(nameSpan);
      return;
    }

    const validation = validateItemName(rawVal, true);
    if (!validation.valid) {
      showNotification(validation.error, false);
      input.replaceWith(nameSpan);
      return;
    }
    const newName = validation.name;
    const newPrefix = oldPrefix.substring(0, oldPrefix.lastIndexOf('/') + 1) + newName;

    // Collision check
    const allPaths = await getAllPaths();
    const collision = allPaths.some(p => {
      if (p.startsWith(oldPrefix + '/') || p === oldPrefix) return false;
      return p.toLowerCase() === newPrefix.toLowerCase() || p.toLowerCase().startsWith(newPrefix.toLowerCase() + '/');
    });

    if (collision) {
      showNotification(`A folder named "${newName}" already exists here.`, false);
      input.replaceWith(nameSpan);
      return;
    }

    const affected = allPaths.filter(p => p.startsWith(oldPrefix + '/') || p === oldPrefix);
    for (const path of affected) {
      const newPath = newPrefix + path.substring(oldPrefix.length);
      const record = await getFile(path);
      if (record) {
        await saveFile(newPath, record.blob, record.mimeType);
        await deleteFile(path);
        if (currentFilePath === path) {
          currentFilePath = newPath;
          const topBarTitle = document.getElementById('editorOpenFile');
          if (topBarTitle) {
            topBarTitle.textContent = newPath;
            if (isEditorDirty) setDirty(true);
          }
        }
      }
    }
    if (expandedFolders.has(oldPrefix)) {
      expandedFolders.delete(oldPrefix);
      expandedFolders.add(newPrefix);
    }
    if (selectedPath && (selectedPath === oldPrefix || selectedPath.startsWith(oldPrefix + '/'))) {
      selectedPath = newPrefix + selectedPath.substring(oldPrefix.length);
    }
    renderFileList(); hardRefresh();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      isCommitting = true;
      input.replaceWith(nameSpan);
    }
  });
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (!isCommitting && document.body.contains(input)) {
        handleSave();
      }
    }, 150);
  });
}

async function deleteFolderWrapper(prefix) {
  const allPaths = await getAllPaths();
  const affected = allPaths.filter(p => p.startsWith(prefix + '/') || p === prefix);
  const fileCount = affected.filter(p => !p.endsWith('/.keep')).length;
  const folderName = prefix.split('/').pop();
  const promptText = fileCount > 0
    ? `Delete folder "${folderName}" and all ${fileCount} file(s) inside it?`
    : `Delete empty folder "${folderName}"?`;

  if (confirm(promptText)) {
    for (const path of affected) await deleteFile(path);
    if (selectedPath && (selectedPath === prefix || selectedPath.startsWith(prefix + '/'))) {
      selectedPath = null;
    }
    if (currentFilePath && (currentFilePath === prefix || currentFilePath.startsWith(prefix + '/'))) {
      currentFilePath = null;
      if (editorModel) { editorModel.dispose(); editorModel = null; }
      setDirty(false);
      const editorContainer = document.getElementById('editorContainer');
      const emptyState = document.getElementById('editorEmptyState');
      if (editorContainer) editorContainer.style.display = 'none';
      if (emptyState) {
        emptyState.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--edit-text-ghost);"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg><p style="color: var(--edit-text-muted); font-size: 13px; margin: 0;">Select a file from My Files to start editing</p>`;
        emptyState.style.display = 'flex';
      }
      const topBarTitle = document.getElementById('editorOpenFile');
      if (topBarTitle) topBarTitle.textContent = 'No file selected';
    }
    renderFileList(); hardRefresh();
  }
}

async function deleteFileWrapper(path) {
  const fileName = path.split('/').pop();
  if (confirm(`Delete "${fileName}"?`)) {
    await deleteFile(path);
    if (selectedPath === path) {
      selectedPath = null;
    }
    if (currentFilePath === path) {
      currentFilePath = null;
      if (editorModel) { editorModel.dispose(); editorModel = null; }
      setDirty(false);
      const editorContainer = document.getElementById('editorContainer');
      const emptyState = document.getElementById('editorEmptyState');
      if (editorContainer) editorContainer.style.display = 'none';
      if (emptyState) {
        emptyState.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--edit-text-ghost);"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg><p style="color: var(--edit-text-muted); font-size: 13px; margin: 0;">Select a file from My Files to start editing</p>`;
        emptyState.style.display = 'flex';
      }
      const topBarTitle = document.getElementById('editorOpenFile');
      if (topBarTitle) topBarTitle.textContent = 'No file selected';
    }
    renderFileList(); hardRefresh();
  }
}

// ─── MONACO ───
let monacoInitPromise = null;

function ensureMonacoLoaded() {
  if (monacoInitPromise) return monacoInitPromise;

  monacoInitPromise = new Promise((resolve, reject) => {
    if (window.monaco && window.editor) {
      monacoLoaded = true;
      return resolve(window.editor);
    }

    if (typeof require === 'undefined') {
      console.warn('Monaco AMD loader (require) not available yet.');
      return reject(new Error('Monaco loader not found'));
    }

    require.config({
      paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs' }
    });

    require(['vs/editor/editor.main'], function () {
      try {
        monaco.editor.defineTheme('wwtbam-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [],
          colors: {
            'editor.background': '#0e0f11',
            'editor.lineHighlightBackground': '#1b2535',
            'editorMinimap.background': '#0c0d0f',
            'editorMinimap.selectionHighlight': '#263347',
            'minimapSlider.background': '#2a2c3140',
            'minimapSlider.hoverBackground': '#2a2c3180',
            'minimapSlider.activeBackground': '#2a2c31',
            'editorWidget.background': '#16171a',
            'editorWidget.border': '#2d3139',
            'input.background': '#0e0f11',
            'input.foreground': '#e6edf3',
            'input.border': '#353a45',
            'inputOption.activeBorder': '#3b82f6',
            'inputOption.activeBackground': '#1e3a8a80',
            'editor.findMatchBackground': '#515c6b90',
            'editor.findMatchHighlightBackground': '#31435e70'
          }
        });

        const container = document.getElementById('editorContainer');
        if (!container) return reject(new Error('editorContainer element not found'));

        window.editor = monaco.editor.create(container, {
          theme: 'wwtbam-dark',
          automaticLayout: true,
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontLigatures: true,
          minimap: { enabled: true, scale: 1 },
          scrollBeyondLastLine: false,
          padding: { top: 12, bottom: 12 },
          renderIndentGuides: true,
          bracketPairColorization: { enabled: true },
          wordWrap: 'on',
          maxTokenizationLineLength: 20000,
          find: {
            addExtraSpaceOnTop: false,
            autoFindInSelection: 'multiline',
            seedSearchStringFromSelection: 'always'
          }
        });

        // High-precision layout recalibration on zoom/resize
        window.addEventListener('resize', () => {
          if (window.editor) {
            window.editor.updateOptions({ pixelRatio: window.devicePixelRatio || 1 });
            window.editor.layout();
          }
        });

        window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, saveEditorContent);
        window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, openFind);
        window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, openReplace);
        monacoLoaded = true;
        // Apply persisted editor light-mode now that Monaco is ready
        if (settings.editorLightMode) applyEditorLightMode(true);
        resolve(window.editor);
      } catch (err) {
        reject(err);
      }
    });
  });

  return monacoInitPromise;
}

function loadMonaco() {
  ensureMonacoLoaded().catch(err => console.warn('Monaco lazy load deferred:', err));
}

function editorAction(type) {
  if (!window.editor) return;
  switch (type) {
    case 'undo': window.editor.trigger('keyboard', 'undo', null); break;
    case 'redo': window.editor.trigger('keyboard', 'redo', null); break;
  }
}

// ─── MONACO FIND & REPLACE LOGIC ───
function openFind() {
  if (!window.editor) return;
  const action = window.editor.getAction('actions.find');
  if (action) {
    action.run();
  } else {
    window.editor.trigger('toolbar', 'actions.find');
  }
}

function openReplace() {
  if (!window.editor) return;
  const action = window.editor.getAction('editor.action.startFindReplaceAction');
  if (action) {
    action.run();
  } else {
    window.editor.trigger('toolbar', 'editor.action.startFindReplaceAction');
  }
}

function toggleFindBar() {
  openFind();
}

function findNext() {
  if (!window.editor) return;
  const action = window.editor.getAction('editor.action.nextMatchFindAction');
  if (action) action.run();
}

function findPrev() {
  if (!window.editor) return;
  const action = window.editor.getAction('editor.action.previousMatchFindAction');
  if (action) action.run();
}

function replaceOne() {
  openReplace();
}

function replaceAll() {
  openReplace();
}

let currentImageURL = null;
async function loadFile(path) {
  currentFilePath = path;
  setDirty(false);
  const topBarTitle = document.getElementById('editorOpenFile');
  if (topBarTitle) topBarTitle.textContent = path;
  renderFileList();

  const record = await getFile(path);
  if (!record) return;

  const ext = path.split('.').pop().toLowerCase();
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
  const isEditable = ['js', 'css', 'html', 'htm', 'xml', 'txt', 'json', 'ts', 'cpp', 'cs'].includes(ext) || !path.includes('.');

  const editorContainer = document.getElementById('editorContainer');
  const imagePreview = document.getElementById('editorImagePreview');
  const emptyState = document.getElementById('editorEmptyState');

  if (currentImageURL) { URL.revokeObjectURL(currentImageURL); currentImageURL = null; }
  switchTab('editor');

  if (isImage) {
    if (editorContainer) editorContainer.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (imagePreview) {
      currentImageURL = URL.createObjectURL(record.blob);
      imagePreview.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; max-height: 100%; max-width: 100%;">
          <img src="${currentImageURL}" style="max-width: 85%; max-height: 70vh; border-radius: 8px; box-shadow: 0 16px 40px rgba(0,0,0,0.6); object-fit: contain; border: 1px solid var(--edit-border);">
          <div style="margin-top: 16px; color: var(--edit-text-muted); font-size: 12px; font-family: 'JetBrains Mono', monospace;">
            <strong>${path}</strong> — ${Math.round(record.blob.size / 1024)} KB
          </div>
        </div>`;
      imagePreview.style.display = 'flex';
    }
  } else if (isEditable) {
    if (imagePreview) imagePreview.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (editorContainer) editorContainer.style.display = 'block';

    try {
      const editor = await ensureMonacoLoaded();
      const text = await record.blob.text();
      let language = getMonacoLanguage(ext);
      if (language === 'plaintext' && (text.trim().startsWith('<?xml') || text.trim().startsWith('<Question') || text.trim().startsWith('<Root'))) {
        language = 'xml';
      }

      if (editorModel) editorModel.dispose();
      editorModel = monaco.editor.createModel(text, language);
      editor.setModel(editorModel);

      // Ensure dimensions are accurately measured
      setTimeout(() => {
        if (window.editor) window.editor.layout();
      }, 50);

      editorModel.onDidChangeContent(() => {
        setDirty(true);
      });
    } catch (err) {
      console.error('Failed to initialize Monaco Editor for file:', err);
    }
  } else {
    if (editorContainer) editorContainer.style.display = 'none';
    if (imagePreview) imagePreview.style.display = 'none';
    if (emptyState) {
      emptyState.innerHTML = `
        <span style="font-size: 40px;">${getFileIcon(path)}</span>
        <p style="color: var(--edit-text-muted); font-size: 13px; margin: 0;">"${path}" is a binary file and cannot be edited as text.</p>`;
      emptyState.style.display = 'flex';
    }
  }
}

function getFileIcon(p) {
  const ext = p.split('.').pop().toLowerCase();
  switch (ext) {
    case 'html': return '🌐'; case 'js': return '📜'; case 'css': return '🎨'; case 'xml': return '📝';
    case 'ts': case 'cpp': case 'cs': return '⚙️';
    case 'png': case 'jpg': case 'jpeg': case 'webp': case 'gif': return '🖼️';
    case 'mp3': case 'wav': return '🎵';
    case 'ttf': case 'otf': case 'woff': case 'woff2': return '🔤';
    default: return '📄';
  }
}
function getMonacoLanguage(ext) {
  switch (ext) {
    case 'js': return 'javascript'; case 'css': return 'css'; case 'html': return 'html'; case 'xml': return 'xml';
    case 'ts': return 'typescript'; case 'cpp': return 'cpp'; case 'cs': return 'csharp';
    default: return 'plaintext';
  }
}
async function saveEditorContent() {
  if (!currentFilePath || !editorModel) return;
  const content = editorModel.getValue();
  const mimeType = getLoaderMimeType(currentFilePath);
  await saveFile(currentFilePath, new Blob([content], { type: mimeType }), mimeType);
  setDirty(false);
  hardRefresh();
}

// ─── UPLOAD ───
const WHITELIST = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'html', 'css', 'js', 'ts', 'cpp', 'cs', 'mp3', 'wav', 'ogg', 'xml', 'ttf', 'otf', 'woff', 'woff2', 'txt', 'json'];

function triggerFileUpload() {
  const input = document.getElementById('fileUploadInput');
  if (!input) return;
  // Snapshot the current selection NOW — before the programmatic .click() fires
  // a synthetic document click that would otherwise deselect via the global handler.
  const snapPath = selectedPath;
  const snapType = selectedType;
  input.value = '';
  input.onchange = (e) => handleFileUpload(e.target.files, false, snapPath, snapType);
  input.click();
}

function triggerFolderUpload() {
  const input = document.getElementById('folderUploadInput');
  if (!input) return;
  // Same snapshot logic as triggerFileUpload.
  const snapPath = selectedPath;
  const snapType = selectedType;
  input.value = '';
  input.onchange = (e) => handleFileUpload(e.target.files, true, snapPath, snapType);
  input.click();
}

async function handleFolderUpload(files) {
  if (!files || !files.length) return;
  await handleFileUpload(files, true);
}

async function handleFileUpload(files, isFolderUpload = false, snapPath = selectedPath, snapType = selectedType) {
  if (!files || !files.length) return;
  const fileArray = Array.from(files);
  const invalid = fileArray.filter(f => !WHITELIST.includes(f.name.split('.').pop().toLowerCase()));
  if (invalid.length > 0) {
    document.getElementById('restrictionOverlay').classList.add('active');
    return;
  }

  // Determine target directory using the snapshotted selection (not the live global,
  // which may have been cleared by the deselect handler before this runs):
  // 1. If a folder was selected → place inside that folder
  // 2. If a file was selected  → place inside that file's parent folder
  // 3. If nothing was selected → place in root directory
  let targetDir = "";
  if (snapPath) {
    if (snapType === 'directory') {
      targetDir = snapPath;
    } else if (snapType === 'file' && snapPath.includes('/')) {
      targetDir = snapPath.substring(0, snapPath.lastIndexOf('/'));
    }
    if (targetDir && !targetDir.endsWith('/')) targetDir += '/';
  }

  const toast = showNotification(`Uploading ${fileArray.length} file(s)...`, true);

  try {
    let firstUploaded = null;
    let completed = 0;

    // Bulk Conflict Check
    let conflictPolicy = 'allow'; // 'replace' or 'skip'
    if (settings.promptConflict) {
      let hasConflict = false;
      for (const file of fileArray) {
        const rawPath = file.webkitRelativePath || file.name;
        const destPath = targetDir + (rawPath.split('/').length > 1 && rawPath.toLowerCase().includes('olga') ? rawPath.split('/').slice(1).join('/') : rawPath);
        const existing = await getFile(destPath);
        if (existing) { hasConflict = true; break; }
      }

      if (hasConflict) {
        const choice = await showConflictModal("You already have a file(s) with the same name. Overwrite anyway?");
        if (choice === 'cancel') {
          toast.remove();
          return;
        }
        conflictPolicy = choice; // 'replace' or 'skip'
      }
    }

    for (const file of fileArray) {
      const rawPath = file.webkitRelativePath || file.name;
      const destPath = targetDir + (rawPath.split('/').length > 1 && rawPath.toLowerCase().includes('olga') ? rawPath.split('/').slice(1).join('/') : rawPath);

      if (conflictPolicy === 'skip') {
        const existing = await getFile(destPath);
        if (existing) {
          completed++;
          continue;
        }
      }

      if (!firstUploaded) firstUploaded = destPath;
      await saveFile(destPath, file, file.type || getLoaderMimeType(destPath));
      completed++;
      toast.setProgress((completed / fileArray.length) * 100);
      toast.setTitle(`Uploading ${completed}/${fileArray.length} files...`);
    }

    if (targetDir) {
      expandedFolders.add(targetDir.replace(/\/$/, ''));
    }
    await renderFileList();
    if (firstUploaded) {
      selectedPath = firstUploaded;
      selectedType = 'file';
      highlightSelectedRow();
    }

    toast.setComplete(`Uploaded ${completed} file(s) successfully!`, true);
    hardRefresh();
  } catch (err) {
    toast.setComplete('Upload failed: ' + err.message, false);
  }
}

// ─── HELPERS ───
function eToggle(el) {
  if (el.hasAttribute('data-off')) el.removeAttribute('data-off');
  else el.setAttribute('data-off', '');
}

/* The Sandbox Guide body. Rendered into both the DevBar's Sandbox Guide panel and the
   Guide & preferences modal, so the prose lives in exactly one place. */
const GUIDE_HTML = `
  <div class="info-hero">
    <h3 class="info-title">WWTBAM HTML5 CONTROLLER ONLINE GUIDE</h3>
    <p class="info-subtitle">This guide will teach you the basics of using the WWTBAM HTML5 sandbox. It’s
      actually super straightforward if you’ve used it before. All you need to do is load up the website and
      use the controller just like what you’d do with a local environment.</p>
    <p class="info-subtitle" style="margin-top: 8px;">Available variations include a bit of Project Rave,
      Project Olga (all variants except Olga V3), Project Hot Seat,
      and Project Classic.</p>
  </div>

  <div class="info-grid-2">
    <div class="info-card">
      <h4>What if I don’t know how to use the controller in the first place?</h4>
      <p>Well… sucks to suck, as GD Colon once said. There is a keystrokes tutorial in Kuby’s Project files.
        You should take a look at that file because I’m too lazy to cite them here.</p>
    </div>
    <div class="info-card">
      <h4>How does this work?</h4>
      <p>This website uses IndexedDB for storing the controller’s file and Monaco Editor for the editor
        interface. As for processing the files, there is a Service Worker just for that.</p>
      <p style="margin-top: 6px;">The default controller is stored on a Cloudflare R2 “database” (or whatever
        you call that thing), and it goes into your memory the moment you load the controller. So… no server
        needed, and I can still host this thing on GitHub! All modifications you make to the sandbox are saved
        in your browser’s cache. If you need to reset everything, you can head to the settings menu.</p>
    </div>
  </div>

  <div class="info-grid-2" style="margin-top: 14px;">
    <div class="info-card">
      <h4>What other special keybinds are used here that I should remember?</h4>
      <p>The only two special keybinds you’ll ever need here are <span class="key-badge">Esc</span> and <span
          class="key-badge">Backspace</span>. The former brings up the file explorer &amp; editor, and the
        latter brings up a top bar that can get you back to the main page.</p>
      <p style="margin-top: 6px;">Make sure that you don’t set any functions to use this key, as it will cause
        conflicts with the sandbox.</p>
      <p style="margin-top: 6px;">Also, if you use UniKey or EVKey, remember to switch to the English
        keyboard, as using the Vietnamese keyboard will trigger the top bar every few key presses.</p>
    </div>
    <div class="info-card">
      <h4>I need to use another graphics set!</h4>
      <p>For now, you have to manually upload all your custom graphics to your controller.</p>
      <p style="margin-top: 6px;"><strong>IMPORTANT:</strong> Before uploading the graphics, make sure your
        Images folder is highlighted. Otherwise, all your files will be at the main directory, and
        multi-select + in-explorer drag-and-drop have not been implemented yet.</p>
      <p style="margin-top: 6px;">If enough people like the idea, I will upload all graphic variations of the
        controller to the database, as long as they don’t exceed 10 GB in size.</p>
    </div>
  </div>

  <div class="info-warn" style="margin-top: 16px;">
    <p>Also, please keep in mind that this is a work in progress, and any features you see here are subject to
      change. Also there's like a million bugs that I'm not going to bother fix (or maybe I will but in like a
      year or two).</p>
  </div>

  <div class="info-disc">
    <p><strong>DISCLAIMER:</strong> The set of HTML5 controllers are based on and are modified versions of the
      classic edition of "Who Wants to Be a Millionaire?". All rights go to their original owners. This
      website is a non-commercial project created for educational and research purposes. I am not affiliated
      with, sponsored by, or endorsed by Sony or any owner of the ‘Who Wants to Be a Millionaire?’ program.
      All identifying elements of the original program used here fall within the scope of Fair Use and are not
      intended for commercial competition.</p>
  </div>
`;

/* The three General Preferences toggles, rendered into both the DevBar Settings panel
   and the Guide & preferences modal. One list, two surfaces. */
const SETTING_TOGGLES = [
  {
    key: 'promptConflict', idSuffix: 'ConflictPrompt',
    label: 'Prompt before overwriting files',
    desc: 'Show a conflict confirmation modal when uploading a file with a name that already exists in the destination folder.',
    title: 'Toggle prompt before overwrite'
  },
  {
    key: 'menuLightMode', idSuffix: 'MenuLightMode',
    label: 'Menu Light Mode',
    desc: 'Switch the file manager, settings panel, and graphic selector to a light colour scheme.',
    title: 'Toggle Menu Light Mode'
  },
  {
    key: 'editorLightMode', idSuffix: 'EditorLightMode',
    label: 'Editor Light Mode',
    desc: 'Switch the Monaco code editor to a light theme with a white background and dark text.',
    title: 'Toggle Editor Light Mode'
  }
];

/* Side effect to run when a preference changes. Keys without one only need persisting. */
const SETTING_EFFECTS = {
  menuLightMode: applyMenuLightMode,
  editorLightMode: applyEditorLightMode
};

function settingToggleRowsHtml(idPrefix) {
  return SETTING_TOGGLES.map(t => {
    const id = idPrefix + t.idSuffix;
    return `
      <div class="sg-row">
        <div class="sg-row-left">
          <h4>${t.label}</h4>
          <p>${t.desc}</p>
        </div>
        <div class="sg-row-right">
          <label class="ios-switch" for="${id}" title="${t.title}">
            <input type="checkbox" id="${id}" data-setting="${t.key}">
            <span class="ios-switch-track">
              <span class="ios-switch-thumb"></span>
            </span>
          </label>
        </div>
      </div>`;
  }).join('');
}

/* Wire every rendered toggle, in either surface. Keyed off data-setting rather than id
   so the two copies cannot fight over getElementById, which returns only the first. */
function syncSettingToggles() {
  document.querySelectorAll('input[data-setting]').forEach(input => {
    const key = input.getAttribute('data-setting');
    input.checked = !!settings[key];
    input.onchange = (e) => {
      settings[key] = e.target.checked;
      localStorage.setItem('sandbox-settings', JSON.stringify(settings));
      const effect = SETTING_EFFECTS[key];
      if (effect) effect(settings[key]);
      // Mirror onto the same preference's other switch so the surfaces never disagree.
      document.querySelectorAll(`input[data-setting="${key}"]`).forEach(other => {
        if (other !== e.target) other.checked = e.target.checked;
      });
    };
  });
}

/* Fill both guide surfaces and both toggle lists once, then wire them. */
function renderGuideSurfaces() {
  const targets = [
    ['infoPanelBody', GUIDE_HTML],
    ['guideModalBody', GUIDE_HTML],
    ['settingsToggleRows', settingToggleRowsHtml('setting')],
    ['guideToggleRows', settingToggleRowsHtml('guideSetting')]
  ];
  for (const [id, html] of targets) {
    const el = document.getElementById(id);
    if (el && !el.innerHTML.trim()) el.innerHTML = html;
  }
  syncSettingToggles();
}

function isGuideModalOpen() {
  const overlay = document.getElementById('guideOverlay');
  return !!overlay && overlay.classList.contains('active');
}

function openGuideModal() {
  const overlay = document.getElementById('guideOverlay');
  if (!overlay) return;
  renderGuideSurfaces();
  overlay.classList.add('active');
}

function closeGuideModal() {
  const overlay = document.getElementById('guideOverlay');
  if (overlay) overlay.classList.remove('active');
}

function initSettingsUI() {
  syncSettingToggles();

  const diagVariant = document.getElementById('diagVariant');
  if (diagVariant) {
    const v = selectedVariant || localStorage.getItem('wwtbam-variant') || 'olga';
    const f = selectedFormat || localStorage.getItem('wwtbam-format') || '12';
    diagVariant.textContent = `${nameMap[v] || v} (${FORMAT_LABELS[f] || f})`;
  }
}

/** Toggle the body class that drives the CSS light-mode overrides for the Menu. */
function applyMenuLightMode(enabled) {
  document.body.classList.toggle('menu-light-mode', enabled);
}

/**
 * Switch Monaco Editor between dark ('wwtbam-dark') and light ('wwtbam-light') themes.
 * Defines 'wwtbam-light' on first call, so Monaco must already be loaded.
 */
function applyEditorLightMode(enabled) {
  if (!window.monaco) return; // Monaco not loaded yet; theme is applied on init instead
  if (!window._wwtbamLightDefined) {
    monaco.editor.defineTheme('wwtbam-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#f8fafc',
        'editor.lineHighlightBackground': '#e8f0fb',
        'editorWidget.background': '#ffffff',
        'editorWidget.border': '#d0d5de',
        'input.background': '#f0f2f5',
        'input.foreground': '#0f1117',
        'input.border': '#c5cad4',
        'inputOption.activeBorder': '#2563eb',
        'inputOption.activeBackground': '#dbeafe',
        'editor.findMatchBackground': '#bfdbfe90',
        'editor.findMatchHighlightBackground': '#dbeafe70'
      }
    });
    window._wwtbamLightDefined = true;
  }
  if (window.editor) {
    monaco.editor.setTheme(enabled ? 'wwtbam-light' : 'wwtbam-dark');
  }
}
function hardRefresh() { const f = document.getElementById('controllerFrame'); if (f) { f.src = 'about:blank'; setTimeout(() => f.src = `/controller/sandbox/?t=${Date.now()}`, 100); } }
async function restoreDefaultQuestions() {
  if (confirm('Restore defaults?')) {
    const [qRes, sqRes] = await Promise.all([fetch('https://pub-2d06308cf53245df865e113b0745c6d9.r2.dev/questions.xml'), fetch('https://pub-2d06308cf53245df865e113b0745c6d9.r2.dev/switchQuestions.xml')]);
    if (qRes.ok) await saveFile('questions/questions.xml', await qRes.blob(), 'application/xml');
    if (sqRes.ok) await saveFile('questions/switchQuestions.xml', await sqRes.blob(), 'application/xml');
    renderFileList(); hardRefresh();
  }
}
function resetSandbox() {
  if (localStorage.getItem('skip-reset-confirm') === 'true') {
    if (confirm('Reset entire sandbox and wipe all data?')) {
      executeResetSandbox();
    }
    return;
  }

  const modal = document.getElementById('resetConfirmOverlay');
  const input = document.getElementById('resetConfirmInput');
  const btn = document.getElementById('resetExecuteBtn');
  const chk = document.getElementById('skipResetConfirmCheckbox');
  if (!modal || !input || !btn) return;
  input.value = '';
  btn.disabled = true;
  if (chk) chk.checked = false;
  modal.classList.add('active');
  input.focus();
  input.oninput = () => {
    btn.disabled = input.value.trim().toUpperCase() !== 'RESET';
  };
  input.onkeydown = (e) => {
    if (e.key === 'Enter' && !btn.disabled) executeResetSandbox();
    if (e.key === 'Escape') closeResetConfirmModal();
  };
}

function closeResetConfirmModal() {
  const modal = document.getElementById('resetConfirmOverlay');
  if (modal) modal.classList.remove('active');
}

async function executeResetSandbox() {
  const chk = document.getElementById('skipResetConfirmCheckbox');
  if (chk && chk.checked) {
    localStorage.setItem('skip-reset-confirm', 'true');
  }

  closeResetConfirmModal();
  const toast = showNotification('Resetting sandbox...', true);
  try {
    sessionStorage.removeItem('wwtbam-variant');
    sessionStorage.removeItem('wwtbam-format');
    localStorage.removeItem('wwtbam-variant');
    localStorage.removeItem('wwtbam-format');
    await clearAll();
    toast.setComplete('Sandbox reset! Reloading...', true);
    setTimeout(() => location.reload(), 800);
  } catch (err) {
    toast.setComplete('Reset failed: ' + err.message, false);
  }
}

let query = '';
let openGroups = new Set(['olga', 'rave', 'classic']);
// Must name a real item id in `groups` — renderDetail dereferences the match unguarded.
// The format is read off that item so the two can never disagree at first paint.
let selectedVariantId = 'olga';
let selectedFormatId = allMenuItems().find(x => x.id === selectedVariantId)?.defaultFormat || '12';

function allMenuItems() {
  return groups.flatMap(g => g.items.map(it => ({ ...it, groupId: g.id })));
}

function filteredGroups() {
  const q = query.trim().toLowerCase();
  if (!q) return groups.map(g => ({ ...g, items: g.items }));
  return groups
    .map(g => ({ ...g, items: g.items.filter(it => it.name.toLowerCase().includes(q)) }))
    .filter(g => g.items.length > 0);
}

function renderList() {
  const scroll = document.getElementById('list-scroll');
  if (!scroll) return;
  const fg = filteredGroups();

  if (fg.length === 0) {
    scroll.innerHTML = `<div class="list-empty">No variations match "${query}".</div>`;
    return;
  }

  scroll.innerHTML = '';
  fg.forEach(g => {
    const isOpen = query.trim() ? true : openGroups.has(g.id);
    const header = document.createElement('div');
    header.className = 'group-header' + (isOpen ? ' open' : '');
    header.innerHTML = `
      <span class="ch"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></span>
      <span class="group-name">${g.name}</span>
      <span class="group-count">${g.items.length}</span>`;
    header.onclick = () => {
      if (openGroups.has(g.id)) openGroups.delete(g.id); else openGroups.add(g.id);
      renderList();
    };
    scroll.appendChild(header);

    const body = document.createElement('div');
    body.className = 'group-body';
    body.style.display = isOpen ? '' : 'none';
    g.items.forEach(it => {
      const row = document.createElement('div');
      row.className = 'vrow' + (it.id === selectedVariantId ? ' sel' : '');
      row.innerHTML = `
        <div class="radio"><div class="radio-dot"></div></div>
        <span class="vrow-name">${it.name}</span>
        ${it.tag ? `<span class="vrow-tag">${it.tag}</span>` : ''}`;
      row.onclick = () => selectVariant(it.id, g.id);
      body.appendChild(row);
    });
    scroll.appendChild(body);
  });
}

function selectVariant(id, groupId) {
  selectedVariantId = id;
  openGroups.add(groupId);
  const item = allMenuItems().find(x => x.id === id);
  if (item) selectedFormatId = item.defaultFormat;
  renderList();
  renderDetail();
  updateFooter();
}

function renderDetail() {
  const pane = document.getElementById('detail-pane');
  if (!pane) return;
  if (!selectedVariantId) {
    pane.innerHTML = `
      <div class="detail-empty">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.3"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>
        <p>Select a variation from the list to see details.</p>
      </div>`;
    return;
  }
  const item = allMenuItems().find(x => x.id === selectedVariantId);
  const group = groups.find(g => g.id === item.groupId);

  let formatHtml = '';
  if (item.formats.length === 1) {
    formatHtml = `
      <div class="format-block">
        <div class="format-title">Game format</div>
        <div class="format-single">This variation only supports the ${item.formats[0].label}.</div>
      </div>`;
  } else {
    formatHtml = `
      <div class="format-block">
        <div class="format-title">Game format</div>
        <div class="format-options" id="format-options"></div>
      </div>`;
  }

  pane.innerHTML = `
    <div class="detail-content">
      <div class="detail-eyebrow">${group.name}</div>
      <div class="detail-name">${item.name}${item.tag ? `<span class="detail-tag">${item.tag}</span>` : ''}</div>
      <div class="detail-desc">${item.desc}</div>
      ${formatHtml}
    </div>`;

  if (item.formats.length > 1) {
    const optsEl = document.getElementById('format-options');
    item.formats.forEach(f => {
      const opt = document.createElement('div');
      opt.className = 'fopt' + (f.id === selectedFormatId ? ' sel' : '');
      opt.innerHTML = `<div class="radio"><div class="radio-dot"></div></div><span class="fopt-label">${f.label}</span><span class="fopt-desc">${f.desc}</span>`;
      opt.onclick = () => { selectedFormatId = f.id; renderDetail(); updateFooter(); };
      optsEl.appendChild(opt);
    });
  }
}

function updateFooter() {
  const btn = document.getElementById('start-btn');
  if (btn) btn.disabled = !selectedVariantId;
}

function initMenu() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.oninput = (e) => {
      query = e.target.value;
      renderList();
    };
  }
  renderList();
  renderDetail();
  updateFooter();
}

async function startWithSelection() {
  if (!selectedVariantId) return;
  const item = allMenuItems().find(x => x.id === selectedVariantId);
  if (!item) return;

  const variant = item.variantKey;
  const format = selectedFormatId || item.defaultFormat;

  selectedVariant = variant;
  selectedFormat = format;

  sessionStorage.setItem('wwtbam-variant', selectedVariant);
  sessionStorage.setItem('wwtbam-format', selectedFormat);
  localStorage.setItem('wwtbam-variant', selectedVariant);
  localStorage.setItem('wwtbam-format', selectedFormat);

  await downloadAndBootVariant(selectedVariant, selectedFormat);
}

async function downloadAndBootVariant(variant, format) {
  const selectionOverlay = document.getElementById('selectionOverlay');
  if (selectionOverlay) selectionOverlay.classList.remove('active');

  const loadingScreen = document.getElementById('loadingScreen');
  if (loadingScreen) {
    loadingScreen.style.display = 'flex';
    loadingScreen.classList.remove('hidden');
  }

  // A (variant, format) pair missing from VARIANTS used to fall through to the Olga 12q
  // fallback below, booting the wrong controller with no signal to the user. Fail loudly.
  if (!VARIANTS[variant]?.[format]) {
    console.error(`No bundle URL registered for variant "${variant}" with format "${format}".`, {
      variant,
      format,
      knownVariants: Object.keys(VARIANTS),
      formatsForVariant: VARIANTS[variant] ? Object.keys(VARIANTS[variant]) : null
    });
    if (loadingScreen) loadingScreen.style.display = 'none';
    const errorScreen = document.getElementById('errorScreen');
    if (errorScreen) {
      errorScreen.classList.add('active');
      errorScreen.style.display = 'flex';
      const errMsg = document.getElementById('errorMessage');
      if (errMsg) errMsg.textContent = `No bundle is registered for "${variant}" in the ${format}-question format.`;
    }
    return;
  }

  const zipUrl = (VARIANTS[variant] && VARIANTS[variant][format]) || VARIANTS['olga']['12'];
  const progressBar = document.getElementById('progressBar');
  const loadingStatus = document.getElementById('loadingStatus');

  try {
    // Ensure service worker is registered before downloading
    await registerControllerServiceWorker();

    if (loadingStatus) loadingStatus.textContent = 'Downloading controller bundle...';
    const savedCount = await loadBundle(zipUrl, (loaded, total) => {
      if (total > 0) {
        const pct = Math.round((loaded / total) * 100);
        if (progressBar) progressBar.style.width = pct + '%';
        if (loadingStatus) loadingStatus.textContent = `Downloading bundle... ${pct}%`;
      } else {
        if (loadingStatus) loadingStatus.textContent = `Downloading bundle... (${Math.round(loaded / 1024)} KB)`;
      }
    });

    // loadBundle returns the number of entries written to IndexedDB. A valid but empty
    // archive would otherwise boot an empty sandbox that 404s on every request.
    if (savedCount === 0) {
      throw new Error(`The bundle downloaded from ${zipUrl} contained no usable files.`);
    }

    if (loadingStatus) loadingStatus.textContent = 'Starting controller sandbox...';
    await bootController();
  } catch (err) {
    console.error('Failed to load controller bundle:', err);
    if (loadingScreen) loadingScreen.style.display = 'none';
    const errorScreen = document.getElementById('errorScreen');
    if (errorScreen) {
      errorScreen.classList.add('active');
      errorScreen.style.display = 'flex';
      const errMsg = document.getElementById('errorMessage');
      if (errMsg) errMsg.textContent = 'Unable to load the controller bundle: ' + err.message;
    }
  }
}

async function bootController() {
  if ('serviceWorker' in navigator && navigator.serviceWorker) {
    await registerControllerServiceWorker();
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => {
        const timeout = setTimeout(r, 800);
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          clearTimeout(timeout);
          r();
        }, { once: true });
      });
    }
  }

  // Ensure selection overlay is hidden when booting
  const selectionOverlay = document.getElementById('selectionOverlay');
  if (selectionOverlay) selectionOverlay.classList.remove('active');

  const frame = document.getElementById('controllerFrame');
  if (frame) {
    frame.src = '/controller/sandbox/';
    frame.style.display = 'block';
  }
  const topBar = document.getElementById('topBar');
  if (topBar) {
    if (localStorage.getItem('topbar-hidden') === 'true') {
      topBar.style.display = 'none';
      document.body.classList.add('topbar-hidden');
    } else {
      topBar.style.display = 'flex';
      document.body.classList.remove('topbar-hidden');
    }
  }

  const loadingScreen = document.getElementById('loadingScreen');
  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 600);
  }
}

// ─── SWITCH VARIANT PANEL ───
// Reads `groups`, `VARIANTS` and `FORMAT_LABELS`; it owns no catalogue of its own.
// State is namespaced away from the pre-boot selection menu, which shares this document
// and keeps its own `query` / `selectedVariantId` / `selectedFormatId`.
let vsQuery = '';
let vsPickedId = null;
let vsPickedFormat = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function vsFilteredGroups() {
  const q = vsQuery.trim().toLowerCase();
  if (!q) return groups.map(g => ({ ...g, items: g.items }));
  return groups
    .map(g => ({
      ...g,
      items: g.items.filter(it =>
        it.name.toLowerCase().includes(q) ||
        g.name.toLowerCase().includes(q) ||
        it.formats.some(f => (FORMAT_LABELS[f.id] || f.id).toLowerCase().includes(q))
      )
    }))
    .filter(g => g.items.length > 0);
}

function renderSwitchNav() {
  const nav = document.getElementById('vsNav');
  if (!nav) return;
  const shown = vsFilteredGroups();

  if (shown.length === 0) {
    nav.innerHTML = `<div class="vs-empty">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <p>No variant matches <code>${escapeHtml(vsQuery)}</code></p>
    </div>`;
    return;
  }

  nav.innerHTML = shown.map(g => `
    <div class="vs-group">${escapeHtml(g.name)}<span class="vs-group-count">${g.items.length}</span></div>
    ${g.items.map(it => `
      <button class="vs-item${it.id === vsPickedId ? ' sel' : ''}" data-id="${escapeHtml(it.id)}">
        <span class="vs-radio"><i></i></span>
        <span class="vs-item-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</span>
        ${it.variantKey === selectedVariant ? '<span class="vs-chip">Current</span>' : ''}
      </button>`).join('')}`).join('');
}

function renderSwitchDetail() {
  const pane = document.getElementById('vsPane');
  const goBtn = document.getElementById('vsGo');
  const goLabel = document.getElementById('vsGoLabel');
  if (!pane) return;

  const item = allMenuItems().find(x => x.id === vsPickedId);
  if (!item) {
    pane.innerHTML = `<div class="vs-empty">
      <svg viewBox="0 0 24 24"><path d="M4 8h13l-3.2-3.2M20 16H7l3.2 3.2"/></svg>
      <p>Pick a variant on the left to see its formats.</p>
    </div>`;
    if (goBtn) goBtn.disabled = true;
    return;
  }

  const group = groups.find(g => g.id === item.groupId);
  pane.innerHTML = `
    <p class="vs-eyebrow">${escapeHtml(group ? group.name : '')}</p>
    <h3 class="vs-name">${escapeHtml(item.name)}</h3>
    <p class="vs-desc">${escapeHtml(item.desc)}</p>
    <p class="vs-label">Game format</p>
    <div class="vs-formats">
      ${item.formats.map(f => `
        <button class="vs-fmt${f.id === vsPickedFormat ? ' sel' : ''}" data-format="${escapeHtml(f.id)}">
          <span class="vs-radio"><i></i></span>
          <span>${escapeHtml(FORMAT_LABELS[f.id] || f.id)}</span>
        </button>`).join('')}
    </div>`;

  const isCurrent = item.variantKey === selectedVariant && vsPickedFormat === selectedFormat;
  if (goBtn) goBtn.disabled = !vsPickedFormat;
  if (goLabel) goLabel.textContent = isCurrent ? 'Reload variant' : 'Switch variant';
}

function vsPick(id) {
  const item = allMenuItems().find(x => x.id === id);
  if (!item) return;
  vsPickedId = id;
  // Carry the running format across when the target supports it, so switching graphics
  // does not silently change the question count too.
  vsPickedFormat = item.formats.some(f => f.id === selectedFormat)
    ? selectedFormat
    : item.defaultFormat;
  renderSwitchNav();
  renderSwitchDetail();
}

function renderSwitchPanel() {
  if (!vsPickedId) {
    const current = allMenuItems().find(x => x.variantKey === selectedVariant);
    vsPick(current ? current.id : allMenuItems()[0].id);
    return;
  }
  renderSwitchNav();
  renderSwitchDetail();
}

function isVariantSwitchModalOpen() {
  const overlay = document.getElementById('vsConfirmOverlay');
  return !!overlay && overlay.classList.contains('active');
}

function openVariantSwitchModal() {
  const item = allMenuItems().find(x => x.id === vsPickedId);
  if (!item || !vsPickedFormat) return;

  // Opted out of the confirmation: go straight through. The footer warning about the
  // sandbox being erased is on screen the whole time, so the click is still informed.
  if (localStorage.getItem('skip-variant-switch-confirm') === 'true') {
    confirmVariantSwitch();
    return;
  }

  const chk = document.getElementById('vsSkipConfirmCheckbox');
  if (chk) chk.checked = false;
  const title = document.getElementById('vsConfirmTitle');
  if (title) {
    const label = FORMAT_LABELS[vsPickedFormat] || vsPickedFormat;
    title.textContent = `Switch to ${item.name} — ${label}?`;
  }
  const overlay = document.getElementById('vsConfirmOverlay');
  if (overlay) overlay.classList.add('active');
  const cancel = document.getElementById('vsConfirmCancel');
  if (cancel) cancel.focus();
}

function closeVariantSwitchModal() {
  const overlay = document.getElementById('vsConfirmOverlay');
  if (overlay) overlay.classList.remove('active');
}

async function confirmVariantSwitch() {
  const item = allMenuItems().find(x => x.id === vsPickedId);
  if (!item || !vsPickedFormat) return;
  const variant = item.variantKey;
  const format = vsPickedFormat;

  // Only persisted once the switch is actually confirmed, so cancelling never
  // silently disables the prompt.
  const chk = document.getElementById('vsSkipConfirmCheckbox');
  if (chk && chk.checked) {
    localStorage.setItem('skip-variant-switch-confirm', 'true');
  }

  closeVariantSwitchModal();
  if (devBarVisible) toggleDevBar();

  selectedVariant = variant;
  selectedFormat = format;
  sessionStorage.setItem('wwtbam-variant', variant);
  sessionStorage.setItem('wwtbam-format', format);
  localStorage.setItem('wwtbam-variant', variant);
  localStorage.setItem('wwtbam-format', format);

  // The old bundle must be gone before the new one is written. saveFile overwrites by
  // lowercased path, so without this every file the new bundle does not happen to
  // replace survives and keeps being served alongside it.
  await clearAll();
  await downloadAndBootVariant(variant, format);
}

function wireSwitchPanel() {
  const nav = document.getElementById('vsNav');
  if (nav) nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.vs-item');
    if (btn) vsPick(btn.getAttribute('data-id'));
  });

  const pane = document.getElementById('vsPane');
  if (pane) pane.addEventListener('click', (e) => {
    const btn = e.target.closest('.vs-fmt');
    if (!btn) return;
    vsPickedFormat = btn.getAttribute('data-format');
    renderSwitchDetail();
  });

  const search = document.getElementById('vsSearch');
  if (search) search.addEventListener('input', (e) => {
    vsQuery = e.target.value;
    renderSwitchNav();
  });

  const overlay = document.getElementById('vsConfirmOverlay');
  if (overlay) overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeVariantSwitchModal();
  });
}

function showConflictModal(msg) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('conflictOverlay');
    document.getElementById('conflictMsg').textContent = msg;
    overlay.classList.add('active');
    const cleanup = (choice) => {
      overlay.classList.remove('active');
      resolve(choice);
    };
    document.getElementById('conflictReplaceBtn').onclick = () => cleanup('replace');
    document.getElementById('conflictSkipBtn').onclick = () => cleanup('skip');
    // Also handle click outside to cancel
    overlay.onclick = (e) => { if (e.target === overlay) cleanup('cancel'); };
  });
}

function showNotification(title, isProgress = false) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-title" id="toastTitle">${title}</span>
      ${isProgress ? '<div class="toast-progress"><div class="toast-bar" id="toastBar" style="width: 0%;"></div></div>' : ''}
    </div>
    <div id="toastAction"></div>
  `;
  container.appendChild(toast);

  return {
    setTitle: (newTitle) => toast.querySelector('#toastTitle').textContent = newTitle,
    setProgress: (percent) => { if (toast.querySelector('#toastBar')) toast.querySelector('#toastBar').style.width = percent + '%'; },
    setComplete: (finalMsg, showRefresh) => {
      toast.querySelector('#toastTitle').textContent = finalMsg;
      if (toast.querySelector('.toast-progress')) toast.querySelector('.toast-progress').style.display = 'none';
      if (showRefresh) {
        const actionArea = toast.querySelector('#toastAction');
        const btn = document.createElement('button');
        btn.className = 'toast-btn';
        btn.textContent = 'Refresh now';
        btn.onclick = () => { hardRefresh(); toast.remove(); };
        actionArea.appendChild(btn);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close-btn';
        closeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg>';
        closeBtn.onclick = () => toast.remove();
        actionArea.appendChild(closeBtn);
      } else {
        setTimeout(() => toast.remove(), 5000);
      }
    },
    remove: () => toast.remove()
  };
}

function toggleTopBar() {
  const topBar = document.getElementById('topBar');
  if (!topBar) return;
  const isHidden = topBar.style.display === 'none' || document.body.classList.contains('topbar-hidden');
  if (isHidden) {
    document.body.classList.remove('topbar-hidden');
    topBar.style.display = 'flex';
    localStorage.setItem('topbar-hidden', 'false');
  } else {
    document.body.classList.add('topbar-hidden');
    topBar.style.display = 'none';
    localStorage.setItem('topbar-hidden', 'true');
  }
}

document.addEventListener('keydown', (e) => {
  // Escape priority chain — first match wins, so a modal never closes the whole DevBar.
  if (e.key === 'Escape') {
    e.preventDefault();
    if (isVariantSwitchModalOpen()) {
      closeVariantSwitchModal();   // confirmation modal open -> dismiss just the modal
    } else if (isGuideModalOpen()) {
      closeGuideModal();           // guide modal open -> dismiss just the modal
    } else if (devBarVisible) {
      toggleDevBar();              // DevBar open -> close it
    } else {
      toggleDevBar();              // otherwise -> open it
    }
  }

  // "/" jumps to the switch panel's search box, but only while that panel is the one
  // showing and the caret is not already in a field.
  if (e.key === '/' && devBarVisible && activeTab === 'switch') {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag !== 'input' && tag !== 'textarea' && !e.target.isContentEditable) {
      e.preventDefault();
      const box = document.getElementById('vsSearch');
      if (box) box.focus();
    }
  }

  // Silently capture Backquote (Tilde) to prevent dead-key focus locking
  if (e.key === '`') {
    e.preventDefault();
    // We do NOT toggleDevBar here as per user request (conflicts with other apps)
  }

  if (e.key === 'Backspace' && !devBarVisible) {
    // Prevent accidental Backspace triggers if typing
    const t = (e.target.tagName || '').toLowerCase();
    if (t !== 'input' && t !== 'textarea' && !e.target.isContentEditable) {
      e.preventDefault();
      toggleTopBar();
    }
  }
});

// Relay from Iframe
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'toggle-topbar') {
    toggleTopBar();
  }
  if (e.data && e.data.type === 'toggle-devbar') {
    toggleDevBar();
  }
});

// Restore preference on init
if (localStorage.getItem('topbar-hidden') === 'true') {
  document.body.classList.add('topbar-hidden');
}

async function registerControllerServiceWorker() {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker) return;
  try {
    const registration = await navigator.serviceWorker.register(`/controller/sw.js?v=${CONTROLLER_SW_VERSION}`, {
      scope: '/controller/',
      updateViaCache: 'none'
    });
    await registration.update().catch(() => { });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
  }
}

async function init() {
  // Immediately render the graphic variation menu UI
  initMenu();
  wireSwitchPanel();
  renderGuideSurfaces();

  const guideOverlay = document.getElementById('guideOverlay');
  if (guideOverlay) guideOverlay.addEventListener('click', (e) => {
    if (e.target === guideOverlay) closeGuideModal();
  });

  // Register Service Worker in the background
  registerControllerServiceWorker().catch(() => { });

  // ─── SESSION MANAGEMENT ───
  try {
    const hasData = await hasBundle();

    if (hasData && selectedVariant) {
      await bootController();
    } else {
      // No data or no selection: Show the selection overlay
      const selOverlay = document.getElementById('selectionOverlay');
      if (selOverlay) selOverlay.classList.add('active');
      // Ensure loading screen is hidden
      const loadingScreen = document.getElementById('loadingScreen');
      if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        loadingScreen.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('Initialization failed:', err);
    const selOverlay = document.getElementById('selectionOverlay');
    if (selOverlay) selOverlay.classList.add('active');
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
      loadingScreen.style.display = 'none';
    }
  }
}


// Click outside file row/card to deselect current folder/file
document.addEventListener('click', (e) => {
  const isInteractive = e.target.closest('.file-row, .file-card, .ra, .inline-input, .new-row, .panel-header-actions, .edit-top-bar, .rail-btn, .modal, .toast');
  if (!isInteractive && devBarVisible && activeTab === 'files') {
    if (selectedPath !== null) {
      selectedPath = null;
      selectedType = null;
      highlightSelectedRow();
    }
  }
});

init();

// Apply persisted light-mode settings immediately on page load
applyMenuLightMode(settings.menuLightMode);
// Editor light mode is applied after Monaco loads (see ensureMonacoLoaded -> resolve hook below)

window.toggleDevBar = toggleDevBar; window.switchTab = switchTab; window.handleFileUpload = handleFileUpload; window.loadFile = loadFile;
window.resetSandbox = resetSandbox; window.closeResetConfirmModal = closeResetConfirmModal; window.executeResetSandbox = executeResetSandbox; window.hardRefresh = hardRefresh; window.restoreDefaultQuestions = restoreDefaultQuestions;
window.toggleFolder = toggleFolder; window.handleRowClick = handleRowClick; window.renameFileWrapper = renameFileWrapper;
window.renameFolderWrapper = renameFolderWrapper; window.deleteFolderWrapper = deleteFolderWrapper; window.createNewFolder = () => inlineNewItem('folder'); window.createNewFile = () => inlineNewItem('file');
window.deleteFileWrapper = deleteFileWrapper; window.editorAction = editorAction; window.toggleTopBar = toggleTopBar;
window.toggleFindBar = toggleFindBar; window.openFind = openFind; window.openReplace = openReplace;
window.findNext = findNext; window.findPrev = findPrev;
window.replaceOne = replaceOne; window.replaceAll = replaceAll;
window.startWithSelection = startWithSelection; window.selectVariant = selectVariant;
window.openVariantSwitchModal = openVariantSwitchModal; window.closeVariantSwitchModal = closeVariantSwitchModal; window.confirmVariantSwitch = confirmVariantSwitch;
window.openGuideModal = openGuideModal; window.closeGuideModal = closeGuideModal;
window.inlineNewItem = inlineNewItem; window.setFileView = setFileView; window.eToggle = eToggle; window.renderFileList = renderFileList;
window.saveEditorContent = saveEditorContent; window.triggerFileUpload = triggerFileUpload; window.triggerFolderUpload = triggerFolderUpload; window.handleFolderUpload = handleFolderUpload;

