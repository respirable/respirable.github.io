// ── Global Variables ──
let currentTestData = null;
window.uploadedImages = []; // Stores base64 strings of uploaded diagram images
let contrastMode = 'normal';
let textSizeMode = 'normal';
const sessionIntegrity = {
  leftTestInterfaceCount: 0,
  lastHiddenAt: 0,
  lastExitSignalAt: 0,
  reminderShownForCurrentExit: false,
  reviewModeStarted: false
};

window.IELTSApp = {
  notify,
  showResultModal,
  resetSessionIntegrity,
  stopSessionIntegrity,
  getSessionIntegrity,
  isIntegrityWatchActive
};


function backToEditor() {
  closeOptionsMenu();
  document.getElementById('test-view').style.display = 'none';
  document.getElementById('input-view').style.display = 'flex';
  // Clear shared URL state if present
  if (window.location.hash || window.location.search) {
    history.replaceState(null, '', window.location.pathname);
  }
}

function openOptionsMenu() {
  const menu = document.getElementById('options-menu');
  if (menu) {
    showOptionsPanel('main');
    syncOptionsMenuState();
    menu.style.display = 'block';
  }
}

function closeOptionsMenu() {
  const menu = document.getElementById('options-menu');
  if (menu) menu.style.display = 'none';
}

function showOptionsPanel(panel) {
  const panels = {
    main: document.getElementById('options-main-panel'),
    contrast: document.getElementById('options-contrast-panel'),
    'text-size': document.getElementById('options-text-size-panel')
  };
  for (const [name, el] of Object.entries(panels)) {
    if (el) el.style.display = name === panel ? 'block' : 'none';
  }
  syncOptionsMenuState();
}

function setContrastMode(mode) {
  contrastMode = mode;
  const testView = document.getElementById('test-view');
  if (testView) {
    testView.classList.remove('contrast-white-black', 'contrast-yellow-black');
    if (mode === 'white-black') testView.classList.add('contrast-white-black');
    if (mode === 'yellow-black') testView.classList.add('contrast-yellow-black');
  }
  syncOptionsMenuState();
}

function setTextSizeMode(mode) {
  textSizeMode = mode;
  const testView = document.getElementById('test-view');
  if (testView) {
    testView.classList.remove('text-size-large', 'text-size-xlarge');
    if (mode === 'large') testView.classList.add('text-size-large');
    if (mode === 'xlarge') testView.classList.add('text-size-xlarge');
  }
  syncOptionsMenuState();
}

function syncOptionsMenuState() {
  const contrastEl = document.getElementById('contrast-option-state');
  const sizeEl = document.getElementById('text-size-option-state');
  if (contrastEl) {
    contrastEl.textContent = contrastMode === 'yellow-black'
      ? 'Yellow on black'
      : contrastMode === 'white-black'
        ? 'White on black'
        : 'Normal';
  }
  if (sizeEl) {
    sizeEl.textContent = textSizeMode === 'xlarge' ? 'Extra large' : textSizeMode === 'large' ? 'Large' : 'Normal';
  }

  document.querySelectorAll('[data-contrast-choice]').forEach(row => {
    row.classList.toggle('selected', row.getAttribute('data-contrast-choice') === contrastMode);
  });
  document.querySelectorAll('[data-text-size-choice]').forEach(row => {
    row.classList.toggle('selected', row.getAttribute('data-text-size-choice') === textSizeMode);
  });
}

// ── Sharing ──
function handleShare() {
  if (!currentTestData) return;
  document.getElementById('share-modal').style.display = 'flex';
}

async function shareViaSupabase() {
  try {
    const url = await Sharing.saveTestToSupabase(currentTestData);
    await navigator.clipboard.writeText(url);
    const fb = document.getElementById('share-supabase-feedback');
    fb.style.display = 'block';
    setTimeout(() => fb.style.display = 'none', 3000);
  } catch (err) {
    notify('error', 'Failed to save to cloud: ' + err.message);
  }
}

function closeShareModal(e) {
  if (!e || e.target === e.currentTarget) {
    document.getElementById('share-modal').style.display = 'none';
  }
}

// ── Load Shared ──
function closeResultModal(e) {
  if (!e || e.target === e.currentTarget) {
    document.getElementById('result-modal').style.display = 'none';
  }
}

async function handleParse() {
  const rawText = document.getElementById('raw-input').value.trim();
  const provider = document.getElementById('ai-provider').value;
  const apiKey = document.getElementById('api-key').value.trim();
  const autoGenerateAnswerKey = document.getElementById('auto-answer-key')?.checked !== false;

  hideValidation();
  const preCheck = Validator.validatePreAI(rawText);
  if (!preCheck.valid) {
    showValidation('error', preCheck.errors.join('\n'));
    return;
  }
  if (!apiKey) {
    showValidation('error', 'Please enter an API key for the selected AI provider.');
    return;
  }

  toggleLoading(true);
  try {
    const parsed = await Parser.parse(rawText, provider, apiKey, { autoGenerateAnswerKey });
    attachDiagramImages(parsed);
    const schemaCheck = Validator.validateSchema(parsed);
    if (!schemaCheck.valid) {
      showValidation('error', schemaCheck.errors.join('\n'));
      return;
    }
    showTest(parsed);
  } catch (error) {
    showValidation('error', error.message || 'AI parsing failed.');
  } finally {
    toggleLoading(false);
  }
}

function showTest(data) {
  currentTestData = data;
  resetSessionIntegrity();
  closeOptionsMenu();
  document.getElementById('input-view').style.display = 'none';
  document.getElementById('test-view').style.display = 'flex';
  Renderer.render(data);
}

function handleDiagramUpload(event) {
  const files = Array.from(event.target.files || []);
  const status = document.getElementById('diagram-upload-status');
  window.uploadedImages = [];
  if (!files.length) {
    if (status) {
      status.textContent = 'No images uploaded';
      status.style.display = 'none';
    }
    return;
  }

  Promise.all(files.map(file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  }))).then(images => {
    window.uploadedImages = images;
    if (status) {
      status.textContent = `${images.length} diagram image${images.length === 1 ? '' : 's'} uploaded`;
      status.style.display = 'block';
    }
  }).catch(() => {
    notify('error', 'Failed to read one of the uploaded diagram images.');
  });
}

function attachDiagramImages(data) {
  const images = window.uploadedImages || [];
  let imageIndex = 0;
  for (const part of data.parts || []) {
    for (const group of part.questionGroups || []) {
      if (group.type === 'diagram_completion' && !group.diagramImage) {
        if (!images[imageIndex]) {
          throw new Error(`Diagram completion questions ${group.questionRange} require an uploaded diagram image.`);
        }
        group.diagramImage = images[imageIndex++];
      }
    }
  }
}

// ── Validation UI ──
function showValidation(type, message) {
  const el = document.getElementById('validation-feedback');
  el.className = `validation-feedback validation-${type}`;
  el.querySelector('.validation-message').textContent = message;
  el.style.display = 'flex';
}

function hideValidation() {
  document.getElementById('validation-feedback').style.display = 'none';
}

// ── Loading UI ──
function toggleLoading(show) {
  document.getElementById('loading-overlay').style.display = show ? 'block' : 'none';
  document.getElementById('btn-parse').disabled = show;
}

function notify(type, message, duration = 4200) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  if (type === 'warning' && container.querySelector('.toast-warning.show')) {
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  window.setTimeout(() => {
    toast.classList.remove('show');
    window.setTimeout(() => toast.remove(), 220);
  }, duration);
}

function showResultModal({ score, total, warningMessage = '' }) {
  stopSessionIntegrity();
  const summaryEl = document.getElementById('result-summary');
  const metaEl = document.getElementById('result-meta');
  const breakdownEl = document.getElementById('result-breakdown');
  const warningEl = document.getElementById('result-warning');
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const bandEstimate = getBandEstimate(percentage);

  summaryEl.textContent = `${score} / ${total}`;
  metaEl.textContent = `${score} correct, ${total - score} incorrect or unanswered.`;
  if (breakdownEl) {
    breakdownEl.innerHTML = `
      <div class="result-stat">
        <span class="result-stat-label">Percent</span>
        <strong>${percentage}%</strong>
      </div>
      <div class="result-stat">
        <span class="result-stat-label">Band estimate</span>
        <strong>${bandEstimate.band}</strong>
      </div>
      <div class="result-comment">
        <span class="result-stat-label">Comment</span>
        <p>${bandEstimate.comment}</p>
      </div>
    `;
  }

  if (warningMessage) {
    warningEl.textContent = warningMessage;
    warningEl.style.display = 'block';
  } else {
    warningEl.style.display = 'none';
    warningEl.textContent = '';
  }

  document.getElementById('result-modal').style.display = 'flex';
  Renderer.pauseTimer();
}

function getBandEstimate(percentage) {
  const bands = [
    { min: 98, band: '9', comment: "You either googled your way here or you're a snake." },
    { min: 93, band: '8.5', comment: "Ur now as good as me... or you're just a lucky-ahh person." },
    { min: 88, band: '8', comment: 'Ur now as good as me... or you are just a lucky-ahh person.' },
    { min: 82, band: '7.5', comment: 'Very kool! Hope you can maintain this score... even though it is expected from you.' },
    { min: 75, band: '7', comment: "Congrats, ig. Nothing special 'bout that score." },
    { min: 66, band: '6.5', comment: 'You must have fell for all the traps that the writer set up.' },
    { min: 62, band: '6', comment: 'You may have been trolled or you really stutter when you see a native speaker.' },
    { min: 48, band: '5.5', comment: 'You may have been trolled or you really stutter when you see a native speaker.' },
    { min: 38, band: '5', comment: 'You may have been trolled or you really stutter when you see a native speaker.' },
    { min: 32, band: '4.5', comment: 'Son you should go watch busy beavers.' },
    { min: 25, band: '4', comment: 'Son you should go watch busy beavers.' },
    { min: 0, band: '<3.5', comment: 'Son you should go watch busy beavers.' }
  ];
  return bands.find(entry => percentage >= entry.min) || bands[bands.length - 1];
}

function resetSessionIntegrity() {
  sessionIntegrity.leftTestInterfaceCount = 0;
  sessionIntegrity.lastHiddenAt = 0;
  sessionIntegrity.lastExitSignalAt = 0;
  sessionIntegrity.reminderShownForCurrentExit = false;
  sessionIntegrity.reviewModeStarted = false;
}

function stopSessionIntegrity() {
  sessionIntegrity.reviewModeStarted = true;
  sessionIntegrity.reminderShownForCurrentExit = true;
}

function getSessionIntegrity() {
  return { ...sessionIntegrity };
}

function setupSessionIntegrityTracking() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && isIntegrityWatchActive()) {
      registerIntegrityExit();
      return;
    }

    if (document.visibilityState === 'visible' && isIntegrityWatchActive()) {
      maybeShowIntegrityReminder();
    }
  });

  window.addEventListener('blur', () => {
    if (!isIntegrityWatchActive() || document.visibilityState === 'hidden') return;
    registerIntegrityExit();
  });

  window.addEventListener('focus', () => {
    if (isIntegrityWatchActive()) {
      maybeShowIntegrityReminder();
    }
  });
}

function registerIntegrityExit() {
  const now = Date.now();
  if (now - sessionIntegrity.lastExitSignalAt < 800) return;
  sessionIntegrity.leftTestInterfaceCount += 1;
  sessionIntegrity.lastHiddenAt = now;
  sessionIntegrity.lastExitSignalAt = now;
  sessionIntegrity.reminderShownForCurrentExit = false;
}

function maybeShowIntegrityReminder() {
  if (sessionIntegrity.leftTestInterfaceCount === 0 || sessionIntegrity.reminderShownForCurrentExit) {
    return;
  }

  sessionIntegrity.reminderShownForCurrentExit = true;
  notify(
    'warning',
    'You thought I wouldn\'t notice you Googling? Try better next time. I can see you trying to look up the answers.',
    6500
  );
}

function isTestVisible() {
  return document.getElementById('test-view').style.display !== 'none';
}

function isIntegrityWatchActive() {
  return isTestVisible()
    && !sessionIntegrity.reviewModeStarted
    && document.getElementById('answer-modal').style.display !== 'flex'
    && document.getElementById('result-modal').style.display !== 'flex';
}

// Pane Resizer
function setupResizer() {
  const resizer = document.getElementById('pane-resizer');
  if (!resizer) return;
  const left = document.getElementById('passage-panel');
  const right = document.getElementById('questions-panel');
  let isResizing = false;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const container = document.querySelector('.split-pane');
    const rect = container.getBoundingClientRect();
    const offset = e.clientX - rect.left;
    const pct = (offset / rect.width) * 100;
    if (pct > 20 && pct < 80) {
      left.style.flex = `0 0 ${pct}%`;
      right.style.flex = `0 0 ${100 - pct}%`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      resizer.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}

function setupTestInterfaceGuards() {
  document.addEventListener('contextmenu', (event) => {
    if (isTestVisible() && event.target.closest?.('#test-view')) {
      event.preventDefault();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!isTestVisible()) return;
    const key = String(event.key || '').toLowerCase();
    if ((event.ctrlKey || event.metaKey) && (key === 'f' || key === 'u')) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

async function loadSharedTestFromURL() {
  const id = Sharing.getShareIdFromURL();
  if (!id) return;

  toggleLoading(true);
  try {
    const data = await Sharing.loadTestFromSupabase(id);
    if (!data) {
      showValidation('error', 'Shared test could not be found or is no longer available.');
      return;
    }
    const schemaCheck = Validator.validateSchema(data);
    if (!schemaCheck.valid) {
      showValidation('error', schemaCheck.errors.join('\n'));
      return;
    }
    showTest(data);
  } catch (error) {
    showValidation('error', error.message || 'Failed to load shared test.');
  } finally {
    toggleLoading(false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupResizer();
  setupSessionIntegrityTracking();
  setupTestInterfaceGuards();
  loadSharedTestFromURL();
});

