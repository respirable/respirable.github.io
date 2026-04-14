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
let selectedVariant = sessionStorage.getItem('wwtbam-variant') || null;
let selectedFormat = sessionStorage.getItem('wwtbam-format') || null;

const VARIANTS = {
  'olga': {
    '12': 'https://pub-2d06308cf53245df865e113b0745c6d9.r2.dev/OlgaV2.5_12q.zip',
    '15': 'https://pub-2d06308cf53245df865e113b0745c6d9.r2.dev/OlgaV2.5.zip'
  },
  '1998_classic': {
    '15': 'https://pub-2d06308cf53245df865e113b0745c6d9.r2.dev/1998_Classic.zip'
  },
  '1999_endemol': {
    '15': 'https://pub-2d06308cf53245df865e113b0745c6d9.r2.dev/1999_Endemol.zip'
  }
};

function showNotification(message, isProgress = false) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-title">${message}</span>
      ${isProgress ? '<div class="toast-progress"><div class="toast-bar" style="width: 0%"></div></div>' : ''}
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
  return toast;
}

function toggleNewMenu() {
  const menu = document.getElementById('newMenu');
  menu.classList.toggle('active');
}

// Close menus when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.fab-container')) {
    document.getElementById('newMenu').classList.remove('active');
  }
});
let activeTab = 'files';
let expandedFolders = new Set(['questions', 'scripts', 'images']);
let lastClickTime = 0;
let lastClickPath = null;

// Settings (persist in localStorage)
let settings = JSON.parse(localStorage.getItem('sandbox-settings') || '{"promptConflict": true}');

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
    wav: { color: '#f85149', svg: '<path d="M12,3V13.55C11.41,13.21 10.73,13 10,13C7.79,13 6,14.79 6,17C6,19.21 7.79,21 10,21C12.21,21 14,19.21 14,17V7H18V3H12Z"/>' }
  };

  const config = icons[ext] || { color: '#848d97', svg: '<path d="M13,9V3.5L18.5,9M6,2C4.89,2 4,2.89 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6Z"/>' };
  return `<svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: ${config.color}; display: block;">${config.svg}</svg>`;
}

function isMobileDevice() {
  return (navigator.maxTouchPoints > 1 && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)) ||
    (window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(hover: none)').matches) ||
    (window.screen.width < 768);
}

// ─── MENU & TABS ───
function toggleDevBar() {
  devBarVisible = !devBarVisible;
  const overlay = document.getElementById('editMenuOverlay');
  overlay.classList.toggle('active', devBarVisible);
  if (devBarVisible) {
    switchTab(activeTab);
    renderFileList();
    initSettingsUI();
    if (!monacoLoaded) loadMonaco();
    else window.editor.layout();
  }
}

function switchTab(tabId) {
  activeTab = tabId;
  const titleMap = { 'files': 'My Files', 'editor': 'Editor', 'info': 'Sandbox Guide', 'settings': 'Settings' };
  const titleEl = document.getElementById('currentTabTitle');
  if (titleEl) titleEl.textContent = titleMap[tabId] || 'Editor';
  document.querySelectorAll('.nav-rail-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const tabBtn = document.getElementById(`tabBtn-${tabId}`);
  const tabContent = document.getElementById(`tab-${tabId}`);
  if (tabBtn) tabBtn.classList.add('active');
  if (tabContent) tabContent.classList.add('active');
  if (tabId === 'editor' && window.editor) window.editor.layout();
}

// ─── IMMERSIVE MODE ───
function toggleTopBar() {
  document.body.classList.toggle('topbar-hidden');
  localStorage.setItem('topbar-hidden', document.body.classList.contains('topbar-hidden'));
}

// ─── SELECTION SCREEN LOGIC ───
function openFormatPicker(variantId) {
  selectedVariant = variantId;
  
  if (variantId === '1998_classic' || variantId === '1999_endemol') {
    selectedFormat = '15';
    startWithSelection(true);
  } else {
    document.getElementById('formatOverlay').classList.add('active');
  }
}

function closeFormatPicker() {
  document.getElementById('formatOverlay').classList.remove('active');
}

async function startWithSelection(skipDom = false) {
  let format = '15';
  
  if (!skipDom) {
    const formats = document.getElementsByName('gameFormat');
    for (const f of formats) {
      if (f.checked) {
        format = f.value;
        break;
      }
    }
    selectedFormat = format;
  }
  sessionStorage.setItem('wwtbam-variant', selectedVariant);
  sessionStorage.setItem('wwtbam-format', selectedFormat);
  
  document.getElementById('formatOverlay').classList.remove('active');
  document.getElementById('selectionOverlay').classList.remove('active');
  
  const zipUrl = VARIANTS[selectedVariant][selectedFormat];
  
  // Show loading screen and boot
  document.getElementById('loadingScreen').classList.remove('hidden');
  document.getElementById('loadingScreen').style.display = 'flex';
  
  try {
    const l = await loadBundle(zipUrl, (loaded, total) => {
      const pb = document.getElementById('progressBar');
      if (pb) pb.style.width = Math.round((loaded / total) * 100) + '%';
    });
    await bootController();
  } catch (err) {
    console.error("Selection Boot Error:", err);
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('errorScreen').style.display = 'flex';
    document.getElementById('errorMessage').textContent = "Failed to load the selected variant.";
  }
}

// ─── DRIVE-STYLE FILE LIST ───
async function renderFileList() {
  const container = document.getElementById('fileList');
  const paths = (await getAllPaths()).filter(p => !p.endsWith('/.keep'));
  if (paths.length === 0) {
    container.innerHTML = '<div class="no-file-selected" style="padding: 100px 0;"><p>No files uploaded yet.</p></div>';
    return;
  }
  const tree = buildFileTree(paths);
  container.innerHTML = renderTreeRecursive(tree, '');
  highlightSelectedRow();
}

function buildFileTree(paths) {
  const root = { _files: [], _folders: {} };
  paths.forEach(path => {
    const parts = path.split('/');
    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const folder = parts[i];
      if (!current._folders[folder]) current._folders[folder] = { _files: [], _folders: {} };
      current = current._folders[folder];
    }
    current._files.push(path);
  });
  return root;
}

function renderTreeRecursive(node, currentPath) {
  let html = '';
  const folders = Object.keys(node._folders).sort();
  folders.forEach(name => {
    const fullPath = currentPath ? `${currentPath}/${name}` : name;
    const isCollapsed = !expandedFolders.has(fullPath);
    html += `
      <div class="tree-folder ${isCollapsed ? 'collapsed' : ''}" id="folder-${fullPath}">
        <div class="tree-folder-header border-row ${selectedPath === fullPath ? 'selected' : ''}" 
             data-path="${fullPath}" data-type="folder"
             onclick="handleRowClick(event, '${fullPath}', true)">
          <span class="folder-toggle-icon">▼</span>
          <span class="folder-icon" style="color: #ecc94b; line-height: 1; display: flex; align-items: center;">
             <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: currentColor;"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
          </span>
          <span class="folder-name">${name}</span>
          <div class="row-actions">
            <button onclick="event.stopPropagation(); renameFolderWrapper('${fullPath}')" title="Rename Folder">
               <svg viewBox="0 0 24 24"><path d="M20.71,7.04C21.1,6.65 21.1,6.01 20.71,5.63L18.37,3.29C17.99,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87L20.71,7.04M3,17.25V21H6.75L17.81,9.93L14.07,6.19L3,17.25Z"/></svg>
            </button>
            <button class="delete-btn" onclick="event.stopPropagation(); deleteFolderWrapper('${fullPath}')" title="Delete Folder">
               <svg viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19V4M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>
            </button>
          </div>
        </div>
        <div class="tree-folder-content">${renderTreeRecursive(node._folders[name], fullPath)}</div>
      </div>
    `;
  });
  const files = node._files.sort();
  files.forEach(path => {
    const name = path.split('/').pop();
    const ext = path.split('.').pop().toLowerCase();
    html += `
      <div class="file-row border-row ${selectedPath === path ? 'selected' : ''}" 
           data-path="${path}" data-type="file"
           onclick="handleRowClick(event, '${path}', false)">
        <div class="file-name-cell">
           <span class="file-icon-cell">${getFileIcon(path)}</span>
           <span class="file-label">${name}</span>
        </div>
        <span>${ext.toUpperCase()} File</span>
        <span style="opacity: 0.5; font-size: 12px;">${path}</span>
        <div class="row-actions">
            <button onclick="event.stopPropagation(); renameFileWrapper('${path}')" title="Rename File">
               <svg viewBox="0 0 24 24"><path d="M20.71,7.04C21.1,6.65 21.1,6.01 20.71,5.63L18.37,3.29C17.99,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87L20.71,7.04M3,17.25V21H6.75L17.81,9.93L14.07,6.19L3,17.25Z"/></svg>
            </button>
            <button class="delete-btn" onclick="event.stopPropagation(); deleteFileWrapper('${path}')" title="Delete File">
               <svg viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19V4M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>
            </button>
        </div>
      </div>
    `;
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
  document.querySelectorAll('.border-row').forEach(el => {
    el.classList.toggle('selected', el.getAttribute('data-path') === selectedPath);
  });
}

function toggleFolder(path) {
  if (expandedFolders.has(path)) expandedFolders.delete(path);
  else expandedFolders.add(path);
  renderFileList();
}

// ─── FOLDER CREATION ───
async function createNewFolder() {
  let parentDir = "";
  if (selectedPath) {
    if (selectedType === 'file') {
      const parts = selectedPath.split('/');
      parentDir = parts.slice(0, -1).join('/');
    } else {
      parentDir = selectedPath;
    }
    if (parentDir && !parentDir.endsWith('/')) parentDir += '/';
  }
  const folderName = prompt("Enter folder name:", "New Folder");
  if (!folderName) return;
  const fullPath = parentDir + folderName + "/.keep";
  await saveFile(fullPath, new Blob(["placeholder"], { type: "text/plain" }), "text/plain");
  expandedFolders.add(parentDir + folderName);
  renderFileList();
}

// ─── RENAME & DELETE ───
async function renameFileWrapper(oldPath) {
  const oldName = oldPath.split('/').pop();
  const newName = prompt(`Rename "${oldName}" to:`, oldName);
  if (!newName || newName === oldName) return;
  const parts = oldPath.split('/'); parts[parts.length - 1] = newName;
  const newPath = parts.join('/');
  const record = await getFile(oldPath);
  if (record) {
    await saveFile(newPath, record.blob, record.mimeType);
    await deleteFile(oldPath);
    if (currentFilePath === oldPath) currentFilePath = newPath;
    if (selectedPath === oldPath) selectedPath = newPath;
    renderFileList(); hardRefresh();
  }
}

async function renameFolderWrapper(oldPrefix) {
  const oldName = oldPrefix.split('/').pop();
  const newName = prompt(`Rename folder "${oldName}" to:`, oldName);
  if (!newName || newName === oldName) return;
  const newPrefix = oldPrefix.substring(0, oldPrefix.lastIndexOf('/') + 1) + newName;
  const allPaths = await getAllPaths();
  const affected = allPaths.filter(p => p.startsWith(oldPrefix + '/') || p === oldPrefix);
  for (const path of affected) {
    const newPath = newPrefix + path.substring(oldPrefix.length);
    const record = await getFile(path);
    if (record) { await saveFile(newPath, record.blob, record.mimeType); await deleteFile(path); }
  }
  if (expandedFolders.has(oldPrefix)) { expandedFolders.delete(oldPrefix); expandedFolders.add(newPrefix); }
  if (selectedPath === oldPrefix) selectedPath = newPrefix;
  renderFileList(); hardRefresh();
}

async function deleteFolderWrapper(prefix) {
  if (confirm(`Delete folder "${prefix}"?`)) {
    const allPaths = await getAllPaths();
    const affected = allPaths.filter(p => p.startsWith(prefix + '/') || p === prefix);
    for (const path of affected) await deleteFile(path);
    renderFileList(); hardRefresh();
  }
}

async function deleteFileWrapper(path) {
  if (confirm(`Delete "${path}"?`)) {
    await deleteFile(path);
    if (currentFilePath === path) { currentFilePath = null; resetEditorPlaceholder(); }
    renderFileList();
  }
}

// ─── MONACO ───
function loadMonaco() {
  require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs' } });
  require(['vs/editor/editor.main'], function () {
    document.fonts.ready.then(() => {
      window.editor = monaco.editor.create(document.getElementById('editorContainer'), {
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
        fontLigatures: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        padding: { top: 16, bottom: 16 },
        renderIndentGuides: true,
        bracketPairColorization: { enabled: true },
        // Fix for zoom and pixel ratio misalignment
        pixelRatio: window.devicePixelRatio || 1,
        fixedOverflowWidgets: true,
        wordWrap: 'on'
      });

      // High-precision layout recalibration on zoom/resize
      window.addEventListener('resize', () => {
        if (window.editor) {
          window.editor.updateOptions({ pixelRatio: window.devicePixelRatio || 1 });
          window.editor.layout();
        }
      });

      // Ensure fonts are measured correctly after loading
      document.fonts.ready.then(() => {
        if (monaco && monaco.editor) monaco.editor.remeasureFonts();
        if (window.editor) window.editor.layout();
      });
      window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, saveEditorContent);
      window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, toggleFindBar);
      monacoLoaded = true;
    });
  });
}

function editorAction(type) {
  if (!window.editor) return;
  switch (type) {
    case 'undo': window.editor.trigger('keyboard', 'undo', null); break;
    case 'redo': window.editor.trigger('keyboard', 'redo', null); break;
  }
}

// ─── CUSTOM FIND & REPLACE LOGIC ───
function toggleFindBar() {
  if (activeTab !== 'editor') return;
  const bar = document.getElementById('editorFindBar');
  bar.classList.toggle('active');
  if (bar.classList.contains('active')) {
    document.getElementById('findInput').focus();
    document.getElementById('findInput').select();
  }
}

function findNext() {
  if (!window.editor) return;
  const query = document.getElementById('findInput').value;
  if (!query) return;
  const model = window.editor.getModel();
  const result = model.findNextMatch(query, window.editor.getSelection().getEndPosition(), false, false, null, true);
  if (result) {
    window.editor.setSelection(result.range);
    window.editor.revealRangeInCenter(result.range);
  }
}

function findPrev() {
  if (!window.editor) return;
  const query = document.getElementById('findInput').value;
  if (!query) return;
  const model = window.editor.getModel();
  const result = model.findPreviousMatch(query, window.editor.getSelection().getStartPosition(), false, false, null, true);
  if (result) {
    window.editor.setSelection(result.range);
    window.editor.revealRangeInCenter(result.range);
  }
}

function replaceOne() {
  if (!window.editor) return;
  const replaceText = document.getElementById('replaceInput').value;
  const selection = window.editor.getSelection();
  if (selection.isEmpty()) { findNext(); return; }
  window.editor.executeEdits('custom-find-replace', [{ range: selection, text: replaceText }]);
  findNext();
}

function replaceAll() {
  if (!window.editor) return;
  const query = document.getElementById('findInput').value;
  const replaceText = document.getElementById('replaceInput').value;
  if (!query) return;
  const model = window.editor.getModel();
  const matches = model.findMatches(query, false, false, false, null, true);
  const edits = matches.map(m => ({ range: m.range, text: replaceText }));
  window.editor.executeEdits('custom-find-replace', edits);
}

let currentImageURL = null;
async function loadFile(path) {
  currentFilePath = path;
  renderFileList();
  const record = await getFile(path);
  if (!record) return;
  const ext = path.split('.').pop().toLowerCase();
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
  const isEditable = ['js', 'css', 'html', 'htm', 'xml', 'txt', 'json', 'ts', 'cpp', 'cs'].includes(ext);
  const container = document.getElementById('editorContainer');
  if (currentImageURL) { URL.revokeObjectURL(currentImageURL); currentImageURL = null; }
  switchTab('editor');
  if (isImage) {
    container.innerHTML = ''; currentImageURL = URL.createObjectURL(record.blob);
    container.innerHTML = `<div class="image-preview-container"><img src="${currentImageURL}"><div class="image-preview-meta"><strong>${path}</strong> — ${Math.round(record.blob.size / 1024)} KB</div></div>`;
    if (editorModel) editorModel = null;
  } else if (isEditable) {
    if (container.querySelector('.no-file-selected') || container.querySelector('.image-preview-container')) container.innerHTML = '';
    const text = await record.blob.text();
    const language = getMonacoLanguage(ext);
    if (editorModel) editorModel.dispose();
    editorModel = monaco.editor.createModel(text, language);
    window.editor.setModel(editorModel);
  } else {
    container.innerHTML = `<div class="no-file-selected"><span style="font-size: 48px; color: #fff;">${getFileIcon(path)}</span><p style="color: #fff !important;">"${path}" is a binary file and cannot be edited.</p></div>`;
    if (editorModel) editorModel = null;
  }
}

function getFileIcon(p) {
  const ext = p.split('.').pop().toLowerCase();
  switch (ext) {
    case 'html': return '🌐'; case 'js': return '📜'; case 'css': return '🎨'; case 'xml': return '📝';
    case 'ts': case 'cpp': case 'cs': return '⚙️';
    case 'png': case 'jpg': case 'jpeg': case 'webp': case 'gif': return '🖼️';
    case 'mp3': case 'wav': return '🎵';
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
  hardRefresh();
}

// ─── UPLOAD ───
const WHITELIST = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'html', 'css', 'js', 'ts', 'cpp', 'cs', 'mp3', 'wav', 'xml'];
async function handleFileUpload(files) {
  if (!files.length) return;
  const fileArray = Array.from(files);
  const invalid = fileArray.filter(f => !WHITELIST.includes(f.name.split('.').pop().toLowerCase()));
  if (invalid.length > 0) {
    document.getElementById('restrictionOverlay').classList.add('active');
    return;
  }

  const toast = showNotification('Preparing upload...', true);
  
  try {
    let firstUploaded = null;
    let targetDir = "";
    if (selectedPath) {
      if (selectedType === 'file') {
        const parts = selectedPath.split('/');
        targetDir = parts.slice(0, -1).join('/');
      } else {
        targetDir = selectedPath;
      }
      if (targetDir && !targetDir.endsWith('/')) targetDir += '/';
    }

    // Bulk Conflict Check
    let conflictPolicy = 'allow'; // 'replace' or 'skip'
    if (settings.promptConflict) {
      let hasConflict = false;
      for (const file of fileArray) {
        const rawPath = file.webkitRelativePath || file.name;
        const path = targetDir + (rawPath.split('/').length > 1 && rawPath.toLowerCase().includes('olga') ? rawPath.split('/').slice(1).join('/') : rawPath);
        const existing = await getFile(path);
        if (existing) { hasConflict = true; break; }
      }

      if (hasConflict) {
        const choice = await showConflictModal("You already have a file(s) with the same name as a file(s) in the selected folder. Overwrite anyway?");
        if (choice === 'cancel') {
          toast.remove();
          return;
        }
        conflictPolicy = choice; // 'replace' or 'skip'
      }
    }

    let completed = 0;
    for (const file of fileArray) {
      const rawPath = file.webkitRelativePath || file.name;
      const path = targetDir + (rawPath.split('/').length > 1 && rawPath.toLowerCase().includes('olga') ? rawPath.split('/').slice(1).join('/') : rawPath);

      if (conflictPolicy === 'skip') {
        const existing = await getFile(path);
        if (existing) {
          completed++;
          continue;
        }
      }

      if (!firstUploaded) firstUploaded = path;
      await saveFile(path, file, file.type || getLoaderMimeType(path));
      completed++;
      toast.setProgress((completed / fileArray.length) * 100);
      toast.setTitle(`Uploading ${completed}/${fileArray.length} files...`);
    }

    await renderFileList();
    if (firstUploaded) {
      const row = document.querySelector(`[data-path="${firstUploaded}"]`);
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      selectedPath = firstUploaded; highlightSelectedRow();
    }
    
    toast.setComplete('Upload successful!', true);
  } catch (err) {
    toast.setComplete('Upload failed: ' + err.message, false);
  }
}

// ─── HELPERS ───
function initSettingsUI() {
  const pc = document.getElementById('settingConflictPrompt');
  if (pc) {
    pc.checked = settings.promptConflict;
    pc.onchange = (e) => { settings.promptConflict = e.target.checked; localStorage.setItem('sandbox-settings', JSON.stringify(settings)); };
  }
}
function hardRefresh() { const f = document.getElementById('controllerFrame'); if (f) { f.src = 'about:blank'; setTimeout(() => f.src = '/controller/sandbox/', 100); } }
async function restoreDefaultQuestions() {
  if (confirm('Restore defaults?')) {
    const [qRes, sqRes] = await Promise.all([fetch('https://pub-2d06308cf53245df865e113b0745c6d9.r2.dev/questions.xml'), fetch('https://pub-2d06308cf53245df865e113b0745c6d9.r2.dev/switchQuestions.xml')]);
    if (qRes.ok) await saveFile('questions/questions.xml', await qRes.blob(), 'application/xml');
    if (sqRes.ok) await saveFile('questions/switchQuestions.xml', await sqRes.blob(), 'application/xml');
    renderFileList(); hardRefresh();
  }
}
async function resetSandbox() { 
  if (confirm('Wipe Sandbox? This will also reset your graphic selection.')) { 
    sessionStorage.removeItem('wwtbam-variant');
    sessionStorage.removeItem('wwtbam-format');
    await clearAll(); 
    location.reload(); 
  } 
}
async function bootController() { document.getElementById('controllerFrame').src = '/controller/sandbox/'; document.getElementById('controllerFrame').style.display = 'block'; document.getElementById('topBar').style.display = 'flex'; setTimeout(() => document.getElementById('loadingScreen').classList.add('hidden'), 800); }

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

document.addEventListener('keydown', (e) => {
  // Handle Esc as DevBar toggle
  if (e.key === 'Escape') {
    e.preventDefault();
    toggleDevBar();
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

async function init() {
  if ('serviceWorker' in navigator) await navigator.serviceWorker.register('/controller/sw.js', { scope: '/controller/' });
  
  // ─── SESSION MANAGEMENT ───
  // Unconditionally wipe data on EVERY load (fully stateless on revisit/refresh)
  console.log("Clearing sandbox data for new visit...");
  await clearAll();
  sessionStorage.removeItem('wwtbam-variant');
  sessionStorage.removeItem('wwtbam-format');
  selectedVariant = null;
  selectedFormat = null;

  const hasData = await hasBundle();
  
  if (hasData && selectedVariant) {
    await bootController();
  } else {
    // No data or no selection: Show the selection overlay
    document.getElementById('selectionOverlay').classList.add('active');
    // Ensure loading screen is hidden if it was showing
    document.getElementById('loadingScreen').style.display = 'none';
  }
}

init();

window.toggleDevBar = toggleDevBar; window.switchTab = switchTab; window.handleFileUpload = handleFileUpload; window.loadFile = loadFile;
window.resetSandbox = resetSandbox; window.hardRefresh = hardRefresh; window.restoreDefaultQuestions = restoreDefaultQuestions;
window.toggleFolder = toggleFolder; window.handleRowClick = handleRowClick; window.renameFileWrapper = renameFileWrapper;
window.renameFolderWrapper = renameFolderWrapper; window.deleteFolderWrapper = deleteFolderWrapper; window.createNewFolder = createNewFolder;
window.deleteFileWrapper = deleteFileWrapper; window.editorAction = editorAction; window.toggleTopBar = toggleTopBar;
window.toggleFindBar = toggleFindBar; window.findNext = findNext; window.findPrev = findPrev;
window.replaceOne = replaceOne; window.replaceAll = replaceAll;
window.openFormatPicker = openFormatPicker; window.closeFormatPicker = closeFormatPicker; window.startWithSelection = startWithSelection;
