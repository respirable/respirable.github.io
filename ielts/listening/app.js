// ── IELTS Listening Creator & Player Application ──

const LISTENING_LIMITS = {
  maxParts: 4,
  minParts: 1,
  maxQuestionsPerPart: 10,
  maxQuestions: 40,
  maxOptions: 9,
};

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
if (typeof window.escHtml === 'undefined') { window.escHtml = esc; }
if (typeof window.escAttr === 'undefined') { window.escAttr = esc; }

const LISTENING_TYPES = [
  'multiple_choice',
  'form_completion',
  'note_completion',
  'table_completion',
  'flowchart_completion',
  'summary_completion',
  'sentence_completion',
  'short_answer',
  'matching',
  'map_labelling',
  'diagram_completion',
];

const LISTENING_TYPE_LABELS = {
  multiple_choice:      'Multiple Choice',
  form_completion:      'Form Completion',
  note_completion:      'Note Completion',
  table_completion:     'Table Completion',
  flowchart_completion: 'Flowchart Completion',
  summary_completion:   'Summary Completion',
  sentence_completion:  'Sentence Completion',
  short_answer:         'Short Answer',
  matching:             'Matching',
  map_labelling:        'Map / Plan Labelling',
  diagram_completion:   'Diagram Labelling',
};

const LISTENING_DEFAULT_INSTRUCTIONS = {
  multiple_choice:      'Choose the correct letter, A, B or C.\nWrite the correct letter in boxes on your answer sheet.',
  form_completion:      'Complete the form below.\nWrite ONE WORD AND/OR A NUMBER for each answer.',
  note_completion:      'Complete the notes below.\nWrite ONE WORD AND/OR A NUMBER for each answer.',
  table_completion:     'Complete the table below.\nWrite ONE WORD AND/OR A NUMBER for each answer.',
  flowchart_completion: 'Complete the flow-chart below.\nWrite ONE WORD AND/OR A NUMBER for each answer.',
  summary_completion:   'Complete the summary below.\nWrite ONE WORD ONLY for each answer.',
  sentence_completion:  'Complete the sentences below.\nWrite ONE WORD ONLY for each answer.',
  short_answer:         'Answer the questions below.\nWrite NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
  matching:             'Match each item with the correct option.\nWrite the correct letter next to the questions.',
  map_labelling:        'Label the map below.\nChoose the correct letter from the box and write it next to the questions.',
  diagram_completion:   'Label the diagram below.\nWrite ONE WORD AND/OR A NUMBER for each answer.',
};

// ── App State Variables ──
let listeningCreatorState = null;
let activeCreatorPartIndex = 0;
let listeningCreatorShowTypePicker = false;
let listeningPlayerTestData = null;
let listeningActivePlayerPartIndex = 0;
let listeningPlayerAnswers = {};
let listeningIsTestChecked = false;
let listeningTestTimerInterval = null;
let listeningTestTimerSeconds = 0;
let listeningTestTimerPaused = false;
let listeningLastTimerTickAt = 0;
let listeningActiveFocusedQuestion = null;
let partAudioPlayed = {};
let listeningContrastMode = 'normal';
let listeningTextSizeMode = 'normal';
let listeningCustomTimeLimitSeconds = null; // null = use default (audio + 2 min)

// Ensure contrast/textSize globals exist when running as standalone (without ielts/app.js)
// Note: these are declared with `let` in ielts/app.js; when running standalone we use window properties instead
if (typeof contrastMode === 'undefined') { window.contrastMode = 'normal'; }
if (typeof textSizeMode === 'undefined') { window.textSizeMode = 'normal'; }

// Drag and drop states
let draggedOptionText = null;
let selectedDropOption = null;

// Cheat detection state
const listeningSessionIntegrity = {
  leftTestInterfaceCount: 0,
  lastHiddenAt: 0,
  lastExitSignalAt: 0,
  reminderShownForCurrentExit: false,
  pendingBlurTimer: null,
  pendingBlurStartedAt: 0,
  reviewModeStarted: false
};

// ── Page Router / Initializer ──
// Handled by ielts/app.js now

// ── Security Guards & Cheat Detection (Lockdown Mode) ──
function setupGlobalSecurityGuards() {
  // Contextmenu blocker
  document.addEventListener('contextmenu', (event) => {
    if (isPlayerActive() && !listeningSessionIntegrity.reviewModeStarted) {
      event.preventDefault();
      listeningNotify('warning', 'Right-clicking is disabled during the exam.');
    }
  });

  // Ctrl+C, Ctrl+V, Ctrl+U blocker
  document.addEventListener('keydown', (event) => {
    if (!isPlayerActive() || listeningSessionIntegrity.reviewModeStarted) return;
    const key = String(event.key || '').toLowerCase();
    if ((event.ctrlKey || event.metaKey) && (key === 'c' || key === 'v' || key === 'u' || key === 'i')) {
      event.preventDefault();
      event.stopPropagation();
      listeningNotify('warning', 'Clipboard actions and inspect-element shortcut are blocked during the exam.');
    }
  }, true);

  // Tab switching / Window blur detection
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && isPlayerActive() && !listeningSessionIntegrity.reviewModeStarted) {
      clearPendingBlur();
      registerIntegrityExit();
    } else if (document.visibilityState === 'visible' && isPlayerActive() && !listeningSessionIntegrity.reviewModeStarted) {
      maybeShowIntegrityReminder();
    }
  });

  window.addEventListener('blur', () => {
    if (isPlayerActive() && !listeningSessionIntegrity.reviewModeStarted && document.visibilityState === 'visible') {
      schedulePendingBlur();
    }
  });

  window.addEventListener('focus', () => {
    clearPendingBlur();
    if (isPlayerActive() && !listeningSessionIntegrity.reviewModeStarted) {
      maybeShowIntegrityReminder();
    }
  });
}

function isPlayerActive() {
  const testView = document.getElementById('test-view');
  return testView && (testView.style.display === 'flex' || testView.style.display === 'block');
}

function schedulePendingBlur() {
  clearPendingBlur();
  listeningSessionIntegrity.pendingBlurStartedAt = Date.now();
  listeningSessionIntegrity.pendingBlurTimer = window.setTimeout(() => {
    listeningSessionIntegrity.pendingBlurTimer = null;
    if (isPlayerActive() && !listeningSessionIntegrity.reviewModeStarted && !document.hasFocus()) {
      registerIntegrityExit();
    }
  }, 1200);
}

function clearPendingBlur() {
  if (listeningSessionIntegrity.pendingBlurTimer) {
    window.clearTimeout(listeningSessionIntegrity.pendingBlurTimer);
    listeningSessionIntegrity.pendingBlurTimer = null;
  }
  listeningSessionIntegrity.pendingBlurStartedAt = 0;
}

function registerIntegrityExit() {
  const now = Date.now();
  if (now - listeningSessionIntegrity.lastExitSignalAt < 800) return;
  listeningSessionIntegrity.leftTestInterfaceCount += 1;
  listeningSessionIntegrity.lastHiddenAt = now;
  listeningSessionIntegrity.lastExitSignalAt = now;
  listeningSessionIntegrity.reminderShownForCurrentExit = false;
}

function maybeShowIntegrityReminder() {
  if (listeningSessionIntegrity.leftTestInterfaceCount === 0 || listeningSessionIntegrity.reminderShownForCurrentExit) return;
  listeningSessionIntegrity.reminderShownForCurrentExit = true;
  listeningNotify(
    'warning',
    'Warning: Navigating away from the exam window has been detected. This is flagged as suspicious behavior.',
    6000
  );
}

// ── Creator Mode Logic ──
function _internalOpenListeningCreator() {
  document.getElementById('input-view').style.display = 'none';
  document.getElementById('test-view').style.display = 'flex';
  const ws = document.getElementById('listening-creator-workspace');
  if (ws) {
    ws.style.display = 'block';
    ws.style.overflowY = 'auto';
    ws.style.flex = '1';
    ws.style.minHeight = '0';
    ws.style.backgroundColor = '#fff';
  }
  const inner = document.querySelector('#listening-creator-workspace .creator-editor-inner');
  if (inner) {
    inner.style.margin = '0';
    inner.style.marginLeft = '0';
  }
  
  activePracticeMode = 'creator';
  setTestShellMode('creator');
  if (typeof setContrastMode === 'function') setContrastMode('normal');
  if (typeof setTextSizeMode === 'function') setTextSizeMode('normal');
  
  const timer = document.getElementById('timer-display');
  if (timer) {
    timer.innerText = 'Listening Creator Panel';
    timer.style.color = '#000';
    timer.style.fontWeight = '700';
  }

  const splitPane = document.getElementById('listening-split-pane');
  if (splitPane) splitPane.style.display = 'none';
  const bottomNav = document.getElementById('listening-bottom-nav');
  if (bottomNav) bottomNav.style.display = 'flex';
  
  document.querySelectorAll('.reading-test-section, .writing-test-section').forEach(el => el.style.display = 'none');

  if (!listeningCreatorState) {
    listeningCreatorState = createBlankListeningState();
  }
  activeCreatorPartIndex = 0;
  renderCreator();
}
window.openListeningCreator = _internalOpenListeningCreator;
window.listeningAppOpenCreator = _internalOpenListeningCreator;

function closeListeningCreator() {
  document.getElementById('listening-creator-workspace').style.display = 'none';
  document.getElementById('test-view').style.display = 'none';
  document.getElementById('input-view').style.display = 'flex';
  
  // Restore normal header content
  document.getElementById('timer-display').innerText = '';
  document.getElementById('timer-display').style.color = '';
  document.getElementById('timer-display').style.fontWeight = '';
}

function createBlankListeningState() {
  return {
    type: 'listening',
    title: 'Untitled IELTS Listening Test',
    audioUrl: '',
    audioScript: '',
    _audioFile: null,
    audioDuration: 0,
    parts: [createBlankPartState(1)],
    answerKey: {}
  };
}

function createBlankPartState(partNum) {
  return {
    partNumber: partNum,
    context: '',
    questionGroups: []
  };
}

function renderCreator() {
  // Title
  document.getElementById('listening-test-title-input').value = listeningCreatorState.title || '';

  // Global Audio Details
  const testAudioUrl = document.getElementById('creator-test-audio-url');
  if (testAudioUrl) testAudioUrl.value = listeningCreatorState.audioUrl || '';
  
  const testTranscript = document.getElementById('creator-test-transcript');
  if (testTranscript) testTranscript.value = listeningCreatorState.audioScript || '';

  if (listeningCreatorState._audioFile) {
    document.getElementById('audio-upload-prompt').textContent = 'Change audio file';
    document.getElementById('audio-file-name').textContent = `${listeningCreatorState._audioFile.name} (${Math.round(listeningCreatorState.audioDuration || 0)}s)`;
    document.getElementById('audio-file-details').style.display = 'flex';
  } else {
    document.getElementById('audio-upload-prompt').textContent = 'Click to upload Mp3, Wav or M4a audio file';
    document.getElementById('audio-file-details').style.display = 'none';
  }

  // Parts Tabs
  renderCreatorPartsTabs();

  // Active Part info
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  
  // Note: we removed creator-part-title-label from UI in favor of tabs only, but keep just in case
  const partTitle = document.getElementById('creator-part-title-label');
  if (partTitle) partTitle.textContent = `PART ${part.partNumber} CONFIGURATION`;

  // Question Groups
  renderQuestionGroupsList();
  // Question Tracker Nav Bar
  renderCreatorQuestionTracker();
}

function updateTestField(field, val) {
  listeningCreatorState[field] = val;
}

function updateListeningTitle(val) {
  listeningCreatorState.title = val;
}

function renderCreatorPartsTabs() {
  const container = document.getElementById('listening-nav-parts');
  if (!container) return;
  container.innerHTML = '';

  listeningCreatorState.parts.forEach((part, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `nav-part-btn ${index === activeCreatorPartIndex ? 'active' : ''}`;
    btn.textContent = `Part ${part.partNumber}`;
    btn.onclick = () => {
      activeCreatorPartIndex = index;
      renderCreator();
    };
    container.appendChild(btn);
  });

  if (listeningCreatorState.parts.length < LISTENING_LIMITS.maxParts) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'nav-part-btn';
    addBtn.style.cssText = 'font-weight:700; color:#2563eb; border-color:#2563eb40;';
    addBtn.textContent = '+ Add Part';
    addBtn.onclick = addCreatorPart;
    container.appendChild(addBtn);
  }

  // Clear the questions area in creator mode (question pills shown only in player mode)
  const questionsContainer = document.getElementById('listening-nav-questions');
  if (questionsContainer) questionsContainer.innerHTML = '';

  // Update prev/next arrow states
  const prevBtn = document.getElementById('listening-nav-arrow-prev');
  const nextBtn = document.getElementById('listening-nav-arrow-next');
  if (prevBtn) prevBtn.disabled = (activeCreatorPartIndex === 0);
  if (nextBtn) nextBtn.disabled = (activeCreatorPartIndex === listeningCreatorState.parts.length - 1);
}


function addCreatorPart() {
  if (listeningCreatorState.parts.length >= LISTENING_LIMITS.maxParts) return;
  const newPartNum = listeningCreatorState.parts.length + 1;
  listeningCreatorState.parts.push(createBlankPartState(newPartNum));
  activeCreatorPartIndex = listeningCreatorState.parts.length - 1;
  renderCreator();
}

function deleteActivePart() {
  if (listeningCreatorState.parts.length <= 1) {
    listeningNotify('error', 'A listening test must contain at least 1 part.');
    return;
  }
  listeningCreatorState.parts.splice(activeCreatorPartIndex, 1);
  // Re-number remaining parts
  listeningCreatorState.parts.forEach((p, idx) => {
    p.partNumber = idx + 1;
  });
  activeCreatorPartIndex = Math.max(0, activeCreatorPartIndex - 1);
  renderCreator();
}

function updateActivePartField(field, val) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  part[field] = val;
}

// ── Audio Upload Handling with 60s minimum limit ──
function handleAudioUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const audioObj = new Audio(URL.createObjectURL(file));
  audioObj.addEventListener('loadedmetadata', () => {
    const duration = audioObj.duration;
    if (duration < 60) {
      listeningNotify('error', 'Validation Error: Audio file must be at least 60 seconds (1 minute) long.');
      // Clear file inputs
      removeAudioFile(event);
      return;
    }

    listeningCreatorState.audioDuration = duration;
    listeningCreatorState._audioFile = file;
    listeningCreatorState.audioUrl = URL.createObjectURL(file);
    renderCreator();
    listeningNotify('success', `Audio uploaded. Detected duration: ${Math.round(duration)} seconds.`);
  });

  audioObj.addEventListener('error', () => {
    listeningNotify('error', 'Failed to read audio file. Please use standard Mp3, Wav, or M4a files.');
    removeAudioFile(event);
  });
}

function removeAudioFile(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  listeningCreatorState._audioFile = null;
  listeningCreatorState.audioUrl = '';
  listeningCreatorState.audioDuration = 0;
  const input = document.getElementById('audio-file-input');
  if (input) input.value = '';
  renderCreator();
}

// ── Question Groups Editor List ──
function showTypePicker() {
  creatorShowTypePicker = true;
  renderCreator();
}

function addQuestionGroupOfType(type) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  let nextQ = 1;
  listeningCreatorState.parts.forEach((p) => {
    p.questionGroups.forEach((g) => {
      const parsed = parseRange(g.questionRange);
      if (parsed.length > 0) {
        const max = Math.max(...parsed);
        if (max >= nextQ) nextQ = max + 1;
      }
    });
  });

  if (nextQ > LISTENING_LIMITS.maxQuestions) {
    listeningNotify('error', 'Maximum limit of 40 questions reached.');
    return;
  }

  let totalQsInPart = 0;
  part.questionGroups.forEach(g => {
    totalQsInPart += parseRange(g.questionRange).length;
  });
  if (totalQsInPart >= 10) {
    listeningNotify('error', 'Maximum limit of 10 questions per part reached.');
    return;
  }

  const spaceLeft = 10 - totalQsInPart;
  const numQsToAdd = 1;
  const newRange = `${nextQ}`;

  const isGapGroup = ['form_completion', 'note_completion', 'summary_completion', 'sentence_completion', 'short_answer'].includes(type);
  const gapHtml = `&nbsp;<span class="wysiwyg-gap-token" contenteditable="false" data-qnum="${nextQ}" style="display:inline-block; background:#e2e8f0; color:#334155; padding:2px 8px; border-radius:4px; font-weight:700; border:1px solid #cbd5e1; user-select:none;">${nextQ}</span>&nbsp;`;

  part.questionGroups.push({
    type: type,
    questionRange: newRange,
    instructions: LISTENING_DEFAULT_INSTRUCTIONS[type] || '',
    questions: isGapGroup || type === 'table_completion' ? [] : [{ number: nextQ, stem: '', label: '', statement: '', options: type === 'multiple_choice' ? ['Option A', 'Option B', 'Option C'] : [] }],
    options: type === 'multiple_choice' ? ['Option A', 'Option B', 'Option C'] : [],
    hasWordBank: false,
    summaryText: isGapGroup ? gapHtml : ''
  });

  creatorShowTypePicker = false;
  renderCreator();
}

function renderQuestionGroupsList() {
  const container = document.getElementById('creator-question-groups-list');
  container.innerHTML = '';
  
  const countBadge = document.getElementById('creator-questions-count-badge');
  if (countBadge) {
    let totalQs = 0;
    listeningCreatorState.parts.forEach((p) => {
      p.questionGroups.forEach((g) => {
        totalQs += parseRange(g.questionRange).length;
      });
    });
    countBadge.textContent = `${totalQs} Questions`;
  }

  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  
  if (part.questionGroups.length === 0 && !creatorShowTypePicker) {
    container.innerHTML = `
      <div class="creator-empty-state">
        <div class="creator-empty-icon">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <div class="creator-empty-title">No question sets yet</div>
        <div class="creator-empty-desc">Choose a question type and start building your IELTS listening test.</div>
        <button class="creator-btn-big" type="button" onclick="showTypePicker()">
          <svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          Create Question Set
        </button>
      </div>
    `;
    return;
  }

  part.questionGroups.forEach((group, gIdx) => {
    const card = document.createElement('div');
    card.className = 'creator-qs-card';
    card.dataset.qsIndex = gIdx;
    
    card.innerHTML = `
      <div class="creator-qs-card-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="creator-qs-card-range">${esc(group.questionRange || '')}</span>
          <span class="creator-qs-card-type">${LISTENING_TYPE_LABELS[group.type] || group.type}</span>
        </div>
        <div class="creator-qs-card-actions">
          <button class="creator-qs-icon-btn is-danger" type="button" onclick="deleteQuestionGroup(${gIdx})" title="Delete Set">
            <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>

      <div class="creator-qs-card-body">
        <div class="config-row" style="margin-bottom:16px; display:flex; gap:12px; align-items:flex-start;">
          <div style="flex:1;">
            <label class="input-label" style="font-size:11px; font-weight:700; color:#475569; text-transform:uppercase;">Instructions</label>
            <textarea class="creator-ghost-input" style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 12px; font-size:13px; width: 100%; box-sizing:border-box;" rows="2" placeholder="Instructions..." oninput="updateGroupInstructions(${gIdx}, this.value)">${group.instructions || ''}</textarea>
          </div>
        </div>

        <div id="group-editor-container-${gIdx}">
          <!-- Render specific question builder details -->
        </div>
      </div>
    `;
    container.appendChild(card);
    renderSpecificGroupEditor(group, gIdx);
  });

  if (creatorShowTypePicker) {
    const pickerOverlay = document.createElement('div');
    pickerOverlay.className = 'creator-type-picker';
    pickerOverlay.style.marginTop = part.questionGroups.length > 0 ? '20px' : '0';

    const LISTENING_TYPE_ICONS = {
      multiple_choice:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>',
      form_completion:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg>',
      note_completion:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/></svg>',
      table_completion:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="9" x2="9" y2="21"/></svg>',
      flowchart_completion:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="8" height="5" rx="1"/><rect x="14" y="3" width="8" height="5" rx="1"/><rect x="8" y="16" width="8" height="5" rx="1"/><path d="M6 8v4M18 8v4M6 12h12M12 12v4"/></svg>',
      summary_completion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 10h16M4 14h10"/></svg>',
      sentence_completion:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h10M4 17h12"/><path d="M16 14l3 3-3 3"/></svg>',
      short_answer:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      matching:           '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/><line x1="5" y1="9" x2="5" y2="15"/><line x1="19" y1="9" x2="19" y2="15"/><circle cx="12" cy="9" r="1" fill="currentColor"/><circle cx="12" cy="15" r="1" fill="currentColor"/></svg>',
      map_labelling:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
      diagram_labelling:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="9" cy="9" r="2"/><path d="M13 9h4M13 13h4M9 13h.01"/></svg>',
    };
    
    pickerOverlay.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <div class="creator-type-picker-title">
          <svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          Select Question Type
        </div>
        <button class="creator-qs-icon-btn" type="button" onclick="creatorShowTypePicker = false; renderCreator();">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="creator-type-grid">
        ${LISTENING_TYPES.map(t => `
          <button class="creator-type-btn has-icon" type="button" onclick="addQuestionGroupOfType('${t}')">
            <span class="creator-type-btn-icon">${LISTENING_TYPE_ICONS[t] || ''}</span>
            <span class="creator-type-btn-label">${LISTENING_TYPE_LABELS[t]}</span>
          </button>
        `).join('')}
      </div>
    `;
    container.appendChild(pickerOverlay);
  } else if (part.questionGroups.length > 0) {
    const addBtnContainer = document.createElement('div');
    addBtnContainer.style.marginTop = '24px';
    addBtnContainer.style.textAlign = 'center';
    addBtnContainer.innerHTML = `
      <button class="creator-btn-big" type="button" onclick="showTypePicker()">
        <svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        Add Question Set
      </button>
    `;
    container.appendChild(addBtnContainer);
  }
}

function updateGroupRange(gIdx, rangeVal) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  part.questionGroups[gIdx].questionRange = rangeVal;
  // Re-render answers sidebar
  renderAnswerKeySidebar();
}

function deleteQuestionGroup(gIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const group = part.questionGroups[gIdx];
  if (!group) return;

  // Cleanup answers from state
  const qNums = parseRange(group.questionRange);
  qNums.forEach(n => {
    delete listeningCreatorState.answerKey[String(n)];
  });
  if (group.questions) {
    group.questions.forEach(q => {
      delete listeningCreatorState.answerKey[String(q.number)];
    });
  }
  
  part.questionGroups.splice(gIdx, 1);
  renderCreator();
}

function updateGroupInstructions(gIdx, val) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  part.questionGroups[gIdx].instructions = val;
}

// ── Specific Question Editors (WYSIWYG Mode) ──
function renderSpecificGroupEditor(group, gIdx) {
  const editorDiv = document.getElementById(`group-editor-container-${gIdx}`);
  if (!editorDiv) return;

  const qNums = parseRange(group.questionRange);
  if (qNums.length === 0) {
    editorDiv.innerHTML = `<div style="color:#ef4444; font-size:0.8rem;">Invalid question range (e.g. 1-5).</div>`;
    return;
  }

  // Synchronize group.questions array size
  while (group.questions.length < qNums.length) {
    group.questions.push({ number: qNums[group.questions.length], stem: '', label: '', statement: '', options: ['Option A', 'Option B', 'Option C'] });
  }
  if (group.questions.length > qNums.length) {
    group.questions.splice(qNums.length);
  }
  group.questions.forEach((q, idx) => {
    q.number = qNums[idx];
  });

  if (group.type === 'multiple_choice') {
    editorDiv.innerHTML = `
      <div class="creator-wysiwyg-section" style="display:flex; flex-direction:column; gap:16px;">
        ${group.questions.map((q, qIdx) => {
          const currentAns = listeningCreatorState.answerKey[String(q.number)] || '';
          return `
            <div class="wysiwyg-mcq-card" style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
              <div class="wysiwyg-mcq-stem" style="display:flex; gap:10px; align-items:center; margin-bottom:12px;">
                <strong style="font-size:0.95rem; color:#0f766e; min-width:30px;">Q${q.number}.</strong>
                <input class="creator-qs-input" style="flex:1; font-weight:600; font-size:0.9rem;" value="${escAttr(q.stem || '')}"
                  oninput="updateQField(${gIdx}, ${qIdx}, 'stem', this.value)"
                  placeholder="Question stem..."/>
                <button class="creator-qs-icon-btn is-danger" type="button" onclick="creatorRemoveQuestionFromGroup(${gIdx}, ${qIdx})" title="Remove question">&times;</button>
              </div>
              <div style="display:flex; flex-direction:column; gap:8px; margin-left:36px;">
                ${(q.options || []).map((opt, optIdx) => {
                  const letter = String.fromCharCode(65 + optIdx);
                  const isChecked = currentAns === letter;
                  return `
                    <div class="wysiwyg-option-row" style="display:flex; gap:8px; align-items:center;">
                      <input type="radio" name="creator-mcq-${gIdx}-${qIdx}" ${isChecked ? 'checked' : ''} onchange="updateAnswerKey(${q.number}, '${letter}')" title="Mark as correct answer"/>
                      <span style="font-weight:700; font-size:0.85rem; color:#475569; width:20px;">${letter}.</span>
                      <input class="creator-qs-input" style="flex:1; font-size:0.85rem; padding:5px 8px;" value="${escAttr(opt || '')}"
                        oninput="updateQOption(${gIdx}, ${qIdx}, ${optIdx}, this.value)"
                        placeholder="Option ${letter}..."/>
                      <button class="creator-mini-btn" type="button" onclick="creatorRemoveOptionFromQ(${gIdx}, ${qIdx}, ${optIdx})" style="color:#ef4444; padding:2px 6px;">✕</button>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
        <button class="creator-mini-btn" type="button" onclick="creatorAddQuestionToGroup(${gIdx})" style="align-self:flex-start; font-weight:700;">+ Add Question</button>
      </div>
    `;
  } else if (['form_completion', 'note_completion', 'summary_completion', 'sentence_completion', 'short_answer'].includes(group.type)) {
    const hasWordBank = !['form_completion', 'note_completion'].includes(group.type);
    if (hasWordBank && group.hasWordBank === undefined) {
      group.hasWordBank = group.options && group.options.length > 0;
    }
    const isWordBankOn = group.hasWordBank;

    editorDiv.innerHTML = `
      <div class="creator-wysiwyg-section" style="display:flex; flex-direction:column; gap:12px;">
        <div style="margin-bottom:8px;">
          <input class="creator-qs-input" value="${escAttr(group.summaryHeading || '')}"
            oninput="updateGroupField(${gIdx}, 'summaryHeading', this.value)"
            placeholder="Section / Heading Title (optional)..."
            style="width:100%; padding:8px 12px; border:1px solid #e2e8f0; border-radius:8px; font-size:0.88rem; font-weight:600; background:white;"/>
        </div>
        
        <div class="wysiwyg-summary-wrap" style="background:white; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <div style="padding:8px 12px; background:#f8fafc; border-bottom:1px solid #f1f5f9; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <button class="creator-mini-btn" type="button" onclick="document.execCommand('bold', false, null)" title="Bold" style="font-weight:bold;">B</button>
            <button class="creator-mini-btn" type="button" onclick="document.execCommand('italic', false, null)" title="Italic" style="font-style:italic;">I</button>
            <button class="creator-mini-btn" type="button" onclick="document.execCommand('insertUnorderedList', false, null)" title="Bullet List">• List</button>
            <button class="creator-mini-btn" type="button" onclick="document.execCommand('formatBlock', false, 'H3')" title="Subheading">H3</button>
            <div style="width:1px; height:20px; background:#cbd5e1; margin:0 4px;"></div>
            <button class="creator-mini-btn" type="button" onclick="creatorInsertGapAtCursor(${gIdx}, 'summary')" title="Insert a gap token" style="background:#0284c7; color:white; font-weight:bold;">+ Insert Gap</button>
            ${hasWordBank ? `<button class="creator-mini-btn" type="button" onclick="toggleWordBank(${gIdx})" title="Toggle word bank options" style="${isWordBankOn ? 'background:#0ea5e9; color:white; font-weight:bold; border-color:#0ea5e9;' : 'background:#f1f5f9; color:#475569;'}">${isWordBankOn ? '✓ Word Bank (ON)' : 'Word Bank (OFF)'}</button>` : ''}
          </div>
          
          <div style="padding:12px;">
            <div class="creator-ghost-input" contenteditable="true" 
              style="width:100%; min-height:150px; border:1px solid #cbd5e1; border-radius:8px; padding:12px; font-size:0.9rem; line-height:1.6; font-family:inherit; box-sizing:border-box; outline:none;"
              placeholder="Type text with blanks..."
              onblur="updateGroupField(${gIdx}, 'summaryText', this.innerHTML); updateGroupRangeFromHTML(${gIdx}, this.innerHTML);"
              oninput="updateGroupRangeFromHTML(${gIdx}, this.innerHTML);">${group.summaryText || ''}</div>
          </div>
        </div>

        ${hasWordBank && isWordBankOn ? `
          <div class="wysiwyg-wordbank" style="padding:12px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0;">
            <div style="font-size:.7rem; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:8px;">Word Bank Choices</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${(group.options || []).map((opt, i) => {
                const letter = String.fromCharCode(65 + i);
                return `
                  <div class="wysiwyg-wordbank-pill" style="display:flex; align-items:center; gap:6px; background:white; padding:4px 10px; border-radius:8px; border:1px solid #e2e8f0;">
                    <span style="font-weight:800;color:#2563eb;font-size:.82rem;">${letter}</span>
                    <input class="pill-input" value="${escAttr(opt)}"
                      onchange="creatorUpdateWordBankOption(${gIdx},${i},this.value)"
                      placeholder="word..."
                      style="border:none; outline:none; background:transparent; font-size:.84rem; width:90px;"/>
                    <button class="pill-remove" type="button" onclick="creatorRemoveWordBankOption(${gIdx},${i})" title="Remove" style="color:#ef4444; border:none; background:none; cursor:pointer; font-weight:bold;">&times;</button>
                  </div>`;
              }).join('')}
              <button class="creator-mini-btn" type="button" onclick="creatorAddWordBankOption(${gIdx})" style="border:1px dashed #cbd5e1;">+ Word</button>
            </div>
          </div>
        ` : ''}

        <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
          <div style="font-size:0.75rem; font-weight:700; color:#475569; text-transform:uppercase;">Questions & Answer Keys</div>
          ${parseRange(group.questionRange).map(qNum => {
            const currentAns = listeningCreatorState.answerKey[String(qNum)] || '';
            return `
              <div style="display:flex; gap:10px; align-items:center; background:white; padding:10px; border-radius:8px; border:1px solid #e2e8f0;">
                <strong style="font-size:0.88rem; color:#0f766e; width:35px;">Q${qNum}</strong>
                <input class="creator-qs-input" style="width:200px; font-size:0.85rem;" placeholder="Correct answer..." value="${escAttr(currentAns)}" oninput="updateAnswerKey(${qNum}, this.value)"/>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } else if (group.type === 'table_completion') {
    if (!group.tableHeaders) group.tableHeaders = ['Column 1', 'Column 2', 'Column 3'];
    if (!group.tableRows) {
      const qNum = qNums[0] || 1;
      const gapHtml = `&nbsp;<span class="wysiwyg-gap-token" contenteditable="false" data-qnum="${qNum}" style="display:inline-block; background:#e2e8f0; color:#334155; padding:2px 8px; border-radius:4px; font-weight:700; border:1px solid #cbd5e1; user-select:none;">${qNum}</span>&nbsp;`;
      group.tableRows = [['Cell 1', 'Cell 2', gapHtml]];
    }

    editorDiv.innerHTML = `
      <div class="creator-wysiwyg-section" style="display:flex; flex-direction:column; gap:12px;">
        <div class="creator-table-toolbar" style="display:flex; gap:6px; align-items:center; padding:8px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
          <button type="button" class="creator-mini-btn" onclick="addTableRow(${gIdx})">+ Add Row</button>
          <button type="button" class="creator-mini-btn" onclick="addTableColumn(${gIdx})">+ Add Col</button>
          <button type="button" class="creator-mini-btn" onclick="creatorInsertGapAtCursor(${gIdx}, 'table')">+ Insert Gap</button>
        </div>
        
        <div style="overflow-x:auto; background:white; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
          <style>
            .creator-table-editable { white-space:pre-wrap; }
            td:hover .creator-table-cell-tools { opacity:1 !important; }
            th:hover .creator-th-delete { opacity:1 !important; }
          </style>
          <table id="creator-table-${gIdx}" style="width:100%; border-collapse:collapse; font-size:0.88rem;">
            <thead>
              <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;">
                ${(group.tableHeaders || []).map((h, hIdx) => {
                  const text = typeof h === 'object' ? h.text : h;
                  const width = typeof h === 'object' ? h.width : '';
                  return `
                  <th style="padding:0; border:1px solid #cbd5e1; text-align:left; vertical-align:top; position:relative; min-width:80px; width:${width || 'auto'};">
                    <button class="creator-mini-btn creator-th-delete" type="button" onclick="deleteTableColumn(${gIdx}, ${hIdx})" style="position:absolute; top:2px; right:2px; color:#ef4444; padding:2px 4px; opacity:0; transition:opacity 0.2s; background:white; border:1px solid #cbd5e1; z-index:20;" title="Delete Column">✕</button>
                    <div contenteditable="true" class="creator-table-editable" onblur="updateTableHeaderCell(${gIdx}, ${hIdx}, 'text', this.innerHTML)" style="padding:6px; min-height:24px; font-weight:700; font-size:0.85rem; outline:none; cursor:text;">${text}</div>
                    <div class="col-resizer" onmousedown="initColResize(event, ${gIdx}, ${hIdx})" style="position:absolute; top:0; right:-3px; bottom:0; width:6px; cursor:col-resize; z-index:10; background:transparent;"></div>
                  </th>
                  `;
                }).join('')}
              </tr>
            </thead>
            <tbody>
              ${(group.tableRows || []).map((row, rIdx) => `
                <tr>
                  ${row.map((cell, cIdx) => {
                    if (typeof cell === 'object' && cell.hidden) return '';
                    const text = typeof cell === 'object' ? cell.text : cell;
                    const colspan = typeof cell === 'object' ? cell.colspan || 1 : 1;
                    const rowspan = typeof cell === 'object' ? cell.rowspan || 1 : 1;
                    const height = typeof cell === 'object' ? cell.height : '';
                    return `
                    <td style="padding:0; border:1px solid #cbd5e1; vertical-align:top; position:relative; height:${height || 'auto'}; min-height:40px;" colspan="${colspan}" rowspan="${rowspan}">
                      <div contenteditable="true" class="creator-table-editable" onblur="updateTableCell(${gIdx}, ${rIdx}, ${cIdx}, 'text', this.innerHTML)" style="padding:6px; min-height:100%; font-size:0.85rem; outline:none; cursor:text;">${text}</div>
                      
                      <div class="creator-table-cell-tools" style="position:absolute; top:2px; right:2px; display:flex; gap:2px; opacity:0; transition:opacity 0.2s;">
                        <button class="creator-mini-btn" type="button" onclick="mergeCellRight(${gIdx}, ${rIdx}, ${cIdx})" style="padding:2px 4px; font-size:10px; background:white; border:1px solid #cbd5e1;" title="Merge Right">→</button>
                        <button class="creator-mini-btn" type="button" onclick="mergeCellDown(${gIdx}, ${rIdx}, ${cIdx})" style="padding:2px 4px; font-size:10px; background:white; border:1px solid #cbd5e1;" title="Merge Down">↓</button>
                      </div>

                      ${cIdx === 0 ? `<div class="row-resizer" onmousedown="initRowResize(event, ${gIdx}, ${rIdx})" style="position:absolute; bottom:-3px; left:0; right:0; height:6px; cursor:row-resize; z-index:10; background:transparent;"></div>` : ''}
                    </td>
                    `;
                  }).join('')}
                  <td style="padding:4px; width:30px; text-align:center; border:none; vertical-align:top;">
                    <button class="creator-mini-btn" type="button" onclick="deleteTableRow(${gIdx}, ${rIdx})" style="color:#ef4444; padding:4px 8px;" title="Delete Row">✕</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (group.type === 'matching') {
    if (!group.options) group.options = ['A Option', 'B Option', 'C Option'];
    editorDiv.innerHTML = `
      <div class="creator-wysiwyg-section" style="display:flex; flex-direction:column; gap:16px;">
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px;">
          <div style="font-size:0.75rem; font-weight:700; color:#475569; text-transform:uppercase; margin-bottom:8px;">Matching Options</div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${(group.options || []).map((opt, oIdx) => {
              const letter = String.fromCharCode(65 + oIdx);
              const optText = opt.replace(/^[A-Z][.)]\s*/, '');
              return `
                <div style="display:flex; gap:8px; align-items:center; background:white; padding:4px 10px; border-radius:6px; border:1px solid #e2e8f0;">
                  <strong style="color:#2563eb; font-size:0.88rem; width:20px;">${letter}.</strong>
                  <input class="creator-qs-input" style="flex:1; font-size:0.85rem;" value="${escAttr(optText)}" oninput="updateMatchingOptionItem(${gIdx}, ${oIdx}, this.value)"/>
                  <button class="creator-mini-btn" type="button" onclick="deleteMatchingOptionItem(${gIdx}, ${oIdx})" style="color:#ef4444;">✕</button>
                </div>
              `;
            }).join('')}
            <button class="creator-mini-btn" type="button" onclick="addMatchingOptionItem(${gIdx})" style="align-self:flex-start; margin-top:4px;">+ Add Choice Option</button>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px;">
          <div style="font-size:0.75rem; font-weight:700; color:#475569; text-transform:uppercase;">Questions</div>
          ${group.questions.map((q, qIdx) => {
            const currentAns = listeningCreatorState.answerKey[String(q.number)] || '';
            return `
              <div style="display:flex; gap:10px; align-items:center; background:white; padding:10px; border-radius:8px; border:1px solid #e2e8f0;">
                <strong style="font-size:0.88rem; color:#0f766e; width:35px;">Q${q.number}</strong>
                <input class="creator-qs-input" style="flex:1; font-size:0.85rem;" placeholder="Question statement..." value="${escAttr(q.statement || '')}" oninput="updateQField(${gIdx}, ${qIdx}, 'statement', this.value)"/>
                <select class="creator-qs-input" style="width:130px; font-size:0.85rem; font-weight:600;" onchange="updateAnswerKey(${q.number}, this.value)">
                  <option value="">Select Option</option>
                  ${(group.options || []).map((opt, oIdx) => {
                    const letter = String.fromCharCode(65 + oIdx);
                    const optText = opt.replace(/^[A-Z][.)]\s*/, '');
                    const isSelected = currentAns === letter;
                    return `<option value="${letter}" ${isSelected ? 'selected' : ''}>${letter}. ${escAttr(optText)}</option>`;
                  }).join('')}
                </select>
                <button class="creator-mini-btn" type="button" onclick="creatorRemoveQuestionFromGroup(${gIdx}, ${qIdx})" style="color:#ef4444;">✕</button>
              </div>
            `;
          }).join('')}
          <button class="creator-mini-btn" type="button" onclick="creatorAddQuestionToGroup(${gIdx})" style="align-self:flex-start; font-weight:700;">+ Add Question</button>
        </div>
      </div>
    `;
  } else if (['map_labelling', 'diagram_completion'].includes(group.type)) {
    const isDragDrop = group.mapMode === 'drag_drop';
    editorDiv.innerHTML = `
      <div class="creator-wysiwyg-section" style="display:flex; flex-direction:column; gap:16px;">
        <!-- Mode Switcher -->
        <div style="display:flex; align-items:center; justify-content:space-between; background:#f1f5f9; padding:8px 12px; border-radius:8px; border:1px solid #cbd5e1;">
          <span style="font-size:0.82rem; font-weight:700; color:#334155; text-transform:uppercase;">Answer Type Mode</span>
          <div style="display:flex; gap:6px;">
            <button class="creator-mini-btn ${!isDragDrop ? 'active' : ''}" type="button" onclick="setGroupMapMode(${gIdx}, 'manual_text')" style="${!isDragDrop ? 'background:#0284c7; color:white; font-weight:700;' : ''}">⌨️ Manually-Typed Gaps</button>
            <button class="creator-mini-btn ${isDragDrop ? 'active' : ''}" type="button" onclick="setGroupMapMode(${gIdx}, 'drag_drop')" style="${isDragDrop ? 'background:#0284c7; color:white; font-weight:700;' : ''}">🧩 Drag & Drop Options</button>
          </div>
        </div>

        <div class="audio-uploader-zone" onclick="document.getElementById('map-image-input-${gIdx}').click()" style="padding:16px; border:2px dashed #cbd5e1; border-radius:10px; text-align:center; cursor:pointer; background:#f8fafc;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom:4px; color:#64748b;"><rect x="3" y="3" width="18" height="14" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <div style="font-weight:600; font-size:0.88rem; color:#334155;">Upload Map / Diagram Image</div>
          <input type="file" id="map-image-input-${gIdx}" style="display:none;" accept="image/*" onchange="handleMapImageUpload(${gIdx}, event)">
        </div>
        ${group.mapImageUrl ? `<img class="map-labelling-image-preview" src="${group.mapImageUrl}" style="max-width:100%; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:8px;">` : ''}

        ${isDragDrop ? `
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px;">
            <div style="font-size:0.75rem; font-weight:700; color:#475569; text-transform:uppercase; margin-bottom:8px;">Map / Diagram Choices</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${(group.options || []).map((opt, oIdx) => {
                const letter = String.fromCharCode(65 + oIdx);
                const optText = opt.replace(/^[A-Z][.)]\s*/, '');
                return `
                  <div style="display:flex; gap:6px; align-items:center; background:white; padding:4px 10px; border-radius:6px; border:1px solid #e2e8f0;">
                    <strong style="color:#2563eb; font-size:0.85rem;">${letter}.</strong>
                    <input class="creator-qs-input" style="width:110px; font-size:0.85rem;" value="${escAttr(optText)}" oninput="updateMapOptionItem(${gIdx}, ${oIdx}, this.value)"/>
                    <button class="creator-mini-btn" type="button" onclick="deleteMapOptionItem(${gIdx}, ${oIdx})" style="color:#ef4444;">✕</button>
                  </div>
                `;
              }).join('')}
              <button class="creator-mini-btn" type="button" onclick="addMapOptionItem(${gIdx})">+ Choice</button>
            </div>
          </div>
        ` : ''}

        <div style="display:flex; flex-direction:column; gap:8px;">
          <div style="font-size:0.75rem; font-weight:700; color:#475569; text-transform:uppercase;">Questions &amp; Answer Keys</div>
          ${group.questions.map((q, qIdx) => {
            const currentAns = listeningCreatorState.answerKey[String(q.number)] || '';
            return `
              <div style="display:flex; gap:10px; align-items:center; background:white; padding:10px; border-radius:8px; border:1px solid #e2e8f0;">
                <strong style="font-size:0.88rem; color:#0f766e; width:35px;">Q${q.number}</strong>
                <input class="creator-qs-input" style="flex:1; font-size:0.85rem;" placeholder="e.g. Structure near main entrance..." value="${escAttr(q.label || '')}" oninput="updateQField(${gIdx}, ${qIdx}, 'label', this.value)"/>
                ${isDragDrop ? `
                  <select class="creator-qs-input" style="width:130px; font-size:0.85rem; font-weight:600;" onchange="updateAnswerKey(${q.number}, this.value)">
                    <option value="">Select Option</option>
                    ${(group.options || []).map((opt, oIdx) => {
                      const letter = String.fromCharCode(65 + oIdx);
                      const optText = opt.replace(/^[A-Z][.)]\s*/, '');
                      const isSelected = currentAns === letter;
                      return `<option value="${letter}" ${isSelected ? 'selected' : ''}>${letter}. ${escAttr(optText)}</option>`;
                    }).join('')}
                  </select>
                ` : `
                  <input class="creator-qs-input" style="width:160px; font-size:0.85rem;" placeholder="Correct answer..." value="${escAttr(currentAns)}" oninput="updateAnswerKey(${q.number}, this.value)"/>
                `}
                <button class="creator-mini-btn" type="button" onclick="creatorRemoveQuestionFromGroup(${gIdx}, ${qIdx})" style="color:#ef4444;">✕</button>
              </div>
            `;
          }).join('')}
          <button class="creator-mini-btn" type="button" onclick="creatorAddQuestionToGroup(${gIdx})" style="align-self:flex-start; font-weight:700;">+ Add Question</button>
        </div>
      </div>
    `;
  }
}

// ── WYSIWYG Helper Functions ──
function setGroupMapMode(gIdx, mode) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const group = part.questionGroups[gIdx];
  group.mapMode = mode;
  renderCreator();
}
function creatorAddOptionToQ(gIdx, qIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const q = part.questionGroups[gIdx].questions[qIdx];
  if (!q.options) q.options = [];
  const nextChar = String.fromCharCode(65 + q.options.length);
  q.options.push(`Option ${nextChar}`);
  renderCreator();
}

function creatorRemoveOptionFromQ(gIdx, qIdx, optIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const q = part.questionGroups[gIdx].questions[qIdx];
  q.options.splice(optIdx, 1);
  renderCreator();
}

function creatorAddQuestionToGroup(gIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  let totalQsInPart = 0;
  part.questionGroups.forEach(g => {
    totalQsInPart += parseRange(g.questionRange).length;
  });
  if (totalQsInPart >= 10) {
    listeningNotify('error', 'Maximum limit of 10 questions per part reached.');
    return;
  }

  const group = part.questionGroups[gIdx];
  const qNums = parseRange(group.questionRange);
  let nextNum = 1;
  if (qNums.length > 0) {
    nextNum = Math.max(...qNums) + 1;
  }
  const minNum = qNums.length > 0 ? Math.min(...qNums) : nextNum;
  group.questionRange = minNum === nextNum ? `${minNum}` : `${minNum}-${nextNum}`;
  group.questions.push({ number: nextNum, stem: '', label: '', statement: '', options: ['Option A', 'Option B', 'Option C'] });
  renderCreator();
}

function creatorRemoveQuestionFromGroup(gIdx, qIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const group = part.questionGroups[gIdx];
  const q = group.questions[qIdx];
  if (q && q.number) {
    delete listeningCreatorState.answerKey[String(q.number)];
  }
  group.questions.splice(qIdx, 1);
  if (group.questions.length > 0) {
    const nums = group.questions.map(q => q.number);
    group.questionRange = nums.length === 1 ? `${nums[0]}` : `${Math.min(...nums)}-${Math.max(...nums)}`;
  } else {
    group.questionRange = '';
  }
  renderCreator();
}

function creatorInsertGapAtCursor(gIdx, type) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  let totalQsInPart = 0;
  part.questionGroups.forEach(g => {
    totalQsInPart += parseRange(g.questionRange).length;
  });
  if (totalQsInPart >= 10) {
    listeningNotify('error', 'Maximum limit of 10 questions per part reached.');
    return;
  }

  const group = part.questionGroups[gIdx];
  let nextNum = 1;
  listeningCreatorState.parts.forEach(p => {
    p.questionGroups.forEach(g => {
      const parsed = parseRange(g.questionRange);
      if (parsed.length > 0) {
        const max = Math.max(...parsed);
        if (max >= nextNum) nextNum = max + 1;
      }
    });
  });

  const gapToken = `___${nextNum}___`;
  const gapHtml = `&nbsp;<span class="wysiwyg-gap-token" contenteditable="false" data-qnum="${nextNum}" style="display:inline-block; background:#e2e8f0; color:#334155; padding:2px 8px; border-radius:4px; font-weight:700; border:1px solid #cbd5e1; user-select:none;">${nextNum}</span>&nbsp;`;
  
  if (type === 'summary' || type === 'note') {
    group.summaryText = (group.summaryText || '') + gapHtml;
    const qNums = parseRange(group.questionRange);
    const newNums = [...qNums, nextNum];
    group.questionRange = `${Math.min(...newNums)}-${Math.max(...newNums)}`;
    listeningCreatorState.answerKey[String(nextNum)] = '[Answer]';
  } else if (type === 'table') {
    if (!group.tableRows || group.tableRows.length === 0) {
      group.tableRows = [[{text: gapHtml, colspan: 1, rowspan: 1, hidden: false, width: '', height: ''}]];
    } else {
      let cell = group.tableRows[group.tableRows.length - 1][0];
      if (typeof cell !== 'object') cell = { text: cell, colspan: 1, rowspan: 1, hidden: false, width: '', height: '' };
      cell.text = (cell.text || '') + ' ' + gapHtml;
      group.tableRows[group.tableRows.length - 1][0] = cell;
    }
    const qNums = parseRange(group.questionRange);
    const newNums = [...qNums, nextNum];
    group.questionRange = `${Math.min(...newNums)}-${Math.max(...newNums)}`;
    listeningCreatorState.answerKey[String(nextNum)] = '[Answer]';
  }
  renderCreator();
}

function addTableColumn(gIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const group = part.questionGroups[gIdx];
  if (!group.tableHeaders) group.tableHeaders = [];
  const colNum = group.tableHeaders.length + 1;
  group.tableHeaders.push(`Column ${colNum}`);
  if (group.tableRows) {
    group.tableRows.forEach(row => row.push(''));
  }
  renderCreator();
}

function updateTableHeaderCell(gIdx, hIdx, field, val) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  let h = part.questionGroups[gIdx].tableHeaders[hIdx];
  h = typeof h === 'object' ? h : { text: h, width: '' };
  h[field] = val;
  part.questionGroups[gIdx].tableHeaders[hIdx] = h;
}

function updateTableHeaderSize(gIdx, hIdx, width) {
  updateTableHeaderCell(gIdx, hIdx, 'width', width);
}

function updateTableCell(gIdx, rIdx, cIdx, val) {
  // deprecated, handled by the other updateTableCell
}

function addMatchingOptionItem(gIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const group = part.questionGroups[gIdx];
  if (!group.options) group.options = [];
  const letter = String.fromCharCode(65 + group.options.length);
  group.options.push(`Option ${letter}`);
  renderCreator();
}

function updateMatchingOptionItem(gIdx, oIdx, val) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const letter = String.fromCharCode(65 + oIdx);
  part.questionGroups[gIdx].options[oIdx] = `${letter} ${val}`;
}

function deleteMatchingOptionItem(gIdx, oIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  part.questionGroups[gIdx].options.splice(oIdx, 1);
  renderCreator();
}

function addMapOptionItem(gIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const group = part.questionGroups[gIdx];
  if (!group.options) group.options = [];
  const letter = String.fromCharCode(65 + group.options.length);
  group.options.push(`Option ${letter}`);
  renderCreator();
}

function updateMapOptionItem(gIdx, oIdx, val) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const letter = String.fromCharCode(65 + oIdx);
  part.questionGroups[gIdx].options[oIdx] = `${letter} ${val}`;
}

function deleteMapOptionItem(gIdx, oIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  part.questionGroups[gIdx].options.splice(oIdx, 1);
  renderCreator();
}

function creatorAddWordBankOption(gIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const group = part.questionGroups[gIdx];
  if (!group.options) group.options = [];
  const letter = String.fromCharCode(65 + group.options.length);
  group.options.push(`Word ${letter}`);
  renderCreator();
}

function creatorUpdateWordBankOption(gIdx, oIdx, val) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  part.questionGroups[gIdx].options[oIdx] = val;
}

function creatorRemoveWordBankOption(gIdx, oIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  part.questionGroups[gIdx].options.splice(oIdx, 1);
  renderCreator();
}

function toggleWordBank(gIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const group = part.questionGroups[gIdx];
  group.hasWordBank = !group.hasWordBank;
  if (group.hasWordBank && (!group.options || group.options.length === 0)) {
    group.options = ['Word A', 'Word B', 'Word C'];
  }
  renderCreator();
}

function updateGroupRangeFromHTML(gIdx, html) {
  const nums = [];
  const m1 = html.match(/_{3,}(\d+)_{3,}/g);
  if (m1) m1.forEach(m => nums.push(parseInt(m.replace(/_/g, ''), 10)));
  const m2 = html.match(/data-qnum="(\d+)"/g);
  if (m2) m2.forEach(m => nums.push(parseInt(m.match(/\d+/)[0], 10)));
  
  const uniqueNums = [...new Set(nums)].filter(n => !isNaN(n));
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const group = part.questionGroups[gIdx];

  if (uniqueNums.length > 0) {
    const min = Math.min(...uniqueNums);
    const max = Math.max(...uniqueNums);
    group.questionRange = min === max ? `${min}` : `${min}-${max}`;
    uniqueNums.forEach(n => {
      if (!listeningCreatorState.answerKey[String(n)]) {
        listeningCreatorState.answerKey[String(n)] = '[Answer]';
      }
    });
    group.questions = uniqueNums.map(n => ({ number: n, statement: '', label: '', stem: '' }));
  } else {
    group.questionRange = '';
    group.questions = [];
  }
}

function recalculateTableQuestionRange(gIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const group = part.questionGroups[gIdx];
  const nums = [];
  if (group.tableRows) {
    group.tableRows.forEach(row => {
      row.forEach(cell => {
        if (cell && typeof cell === 'object' && !cell.hidden) {
          const m = (cell.text || '').match(/data-qnum="(\d+)"/g);
          if (m) m.forEach(x => nums.push(parseInt(x.match(/\d+/)[0], 10)));
        } else if (typeof cell === 'string') {
          const m = cell.match(/data-qnum="(\d+)"/g);
          if (m) m.forEach(x => nums.push(parseInt(x.match(/\d+/)[0], 10)));
        }
      });
    });
  }
  const uniqueNums = [...new Set(nums)].filter(n => !isNaN(n));
  if (uniqueNums.length > 0) {
    const min = Math.min(...uniqueNums);
    const max = Math.max(...uniqueNums);
    group.questionRange = min === max ? `${min}` : `${min}-${max}`;
    uniqueNums.forEach(n => {
      if (!listeningCreatorState.answerKey[String(n)]) {
        listeningCreatorState.answerKey[String(n)] = '[Answer]';
      }
    });
    group.questions = uniqueNums.map(n => ({ number: n, statement: '', label: '', stem: '' }));
  } else {
    group.questionRange = '';
    group.questions = [];
  }
}

function updateQField(gIdx, qIdx, field, val) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  part.questionGroups[gIdx].questions[qIdx][field] = val;
}

function updateQOption(gIdx, qIdx, optIdx, val) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  part.questionGroups[gIdx].questions[qIdx].options[optIdx] = val;
}

function updateGroupField(gIdx, field, val) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  part.questionGroups[gIdx][field] = val;
}

function updateMatchingOptions(gIdx, val) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  part.questionGroups[gIdx].options = val.split('\n').map(s => s.trim()).filter(Boolean);
  renderCreator();
}

function addMapOptionItem(gIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const group = part.questionGroups[gIdx];
  if (!group.options) group.options = [];
  const letter = String.fromCharCode(65 + group.options.length);
  group.options.push(`${letter}. New Choice`);
  renderCreator();
}

function updateMapOptionItem(gIdx, oIdx, val) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const group = part.questionGroups[gIdx];
  const letter = String.fromCharCode(65 + oIdx);
  group.options[oIdx] = `${letter}. ${val}`;
}

function deleteMapOptionItem(gIdx, oIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const group = part.questionGroups[gIdx];
  group.options.splice(oIdx, 1);
  // Re-letter remaining options
  group.options = group.options.map((opt, i) => {
    const letter = String.fromCharCode(65 + i);
    const cleanText = opt.replace(/^[A-Z][.)]\s*/, '');
    return `${letter}. ${cleanText}`;
  });
  renderCreator();
}

function updateMapOptions(gIdx, val) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  part.questionGroups[gIdx].options = val.split(',').map(s => s.trim()).filter(Boolean);
  renderCreator();
}

function handleMapImageUpload(gIdx, event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const part = listeningCreatorState.parts[activeCreatorPartIndex];
    part.questionGroups[gIdx].mapImageUrl = e.target.result;
    renderCreator();
  };
  reader.readAsDataURL(file);
}

// Table logic helpers
function updateTableHeaders(gIdx, val) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  part.questionGroups[gIdx].tableHeaders = val.split(',').map(s => s.trim()).filter(Boolean);
  renderCreator();
}

function updateTableRow(gIdx, rIdx, val) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  part.questionGroups[gIdx].tableRows[rIdx] = val.split(',').map(s => s.trim());
}

function upgradeCell(cell) {
  if (typeof cell !== 'object') return { text: cell, colspan: 1, rowspan: 1, hidden: false, width: '', height: '' };
  return cell;
}

function updateTableCell(gIdx, rIdx, cIdx, field, val) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  let cell = part.questionGroups[gIdx].tableRows[rIdx][cIdx];
  cell = upgradeCell(cell);
  cell[field] = field === 'colspan' || field === 'rowspan' ? parseInt(val, 10) || 1 : val;
  part.questionGroups[gIdx].tableRows[rIdx][cIdx] = cell;
  
  if (field === 'text') {
    recalculateTableQuestionRange(gIdx);
    renderCreator();
  }
}

function updateTableCellSize(gIdx, rIdx, cIdx, width, height) {
  updateTableCell(gIdx, rIdx, cIdx, 'width', width);
  updateTableCell(gIdx, rIdx, cIdx, 'height', height);
}

function addTableRow(gIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const group = part.questionGroups[gIdx];
  if (!group.tableRows) group.tableRows = [];
  const colCount = group.tableHeaders ? group.tableHeaders.length : 1;
  const newRow = Array(colCount).fill('');
  group.tableRows.push(newRow);
  recalculateTableQuestionRange(gIdx);
  renderCreator();
}

function deleteTableRow(gIdx, rIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  part.questionGroups[gIdx].tableRows.splice(rIdx, 1);
  recalculateTableQuestionRange(gIdx);
  renderCreator();
}

function deleteTableColumn(gIdx, cIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const group = part.questionGroups[gIdx];
  group.tableHeaders.splice(cIdx, 1);
  if (group.tableRows) {
    group.tableRows.forEach(row => row.splice(cIdx, 1));
  }
  recalculateTableQuestionRange(gIdx);
  renderCreator();
}

function deleteTableCell(gIdx, rIdx, cIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const group = part.questionGroups[gIdx];
  let cell = upgradeCell(group.tableRows[rIdx][cIdx]);
  cell.hidden = true;
  group.tableRows[rIdx][cIdx] = cell;
  recalculateTableQuestionRange(gIdx);
  renderCreator();
}

let tableResizeState = null;
function initColResize(e, gIdx, colIdx) {
  e.preventDefault();
  const th = e.target.closest('th');
  tableResizeState = { type: 'col', gIdx, colIdx, startX: e.clientX, startWidth: th.offsetWidth };
  document.addEventListener('mousemove', handleTableResize);
  document.addEventListener('mouseup', stopTableResize);
}
function initRowResize(e, gIdx, rowIdx) {
  e.preventDefault();
  const tr = e.target.closest('tr');
  tableResizeState = { type: 'row', gIdx, rowIdx, startY: e.clientY, startHeight: tr.offsetHeight };
  document.addEventListener('mousemove', handleTableResize);
  document.addEventListener('mouseup', stopTableResize);
}
function handleTableResize(e) {
  if (!tableResizeState) return;
  if (tableResizeState.type === 'col') {
    const diff = e.clientX - tableResizeState.startX;
    const newW = Math.max(40, tableResizeState.startWidth + diff);
    const ths = document.querySelectorAll(`#creator-table-${tableResizeState.gIdx} th`);
    if(ths[tableResizeState.colIdx]) ths[tableResizeState.colIdx].style.width = newW + 'px';
  } else {
    const diff = e.clientY - tableResizeState.startY;
    const newH = Math.max(30, tableResizeState.startHeight + diff);
    const trs = document.querySelectorAll(`#creator-table-${tableResizeState.gIdx} tbody tr`);
    if(trs[tableResizeState.rowIdx]) {
      const td = trs[tableResizeState.rowIdx].querySelector('td');
      if(td) td.style.height = newH + 'px';
    }
  }
}
function stopTableResize(e) {
  if (!tableResizeState) return;
  if (tableResizeState.type === 'col') {
    const diff = e.clientX - tableResizeState.startX;
    const newW = Math.max(40, tableResizeState.startWidth + diff);
    updateTableHeaderCell(tableResizeState.gIdx, tableResizeState.colIdx, 'width', newW + 'px');
  } else {
    const diff = e.clientY - tableResizeState.startY;
    const newH = Math.max(30, tableResizeState.startHeight + diff);
    updateTableCell(tableResizeState.gIdx, tableResizeState.rowIdx, 0, 'height', newH + 'px');
  }
  tableResizeState = null;
  document.removeEventListener('mousemove', handleTableResize);
  document.removeEventListener('mouseup', stopTableResize);
  renderCreator();
}

function mergeCellRight(gIdx, rIdx, cIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const group = part.questionGroups[gIdx];
  let cell = upgradeCell(group.tableRows[rIdx][cIdx]);
  let nextCIdx = cIdx + cell.colspan;
  if (nextCIdx < group.tableHeaders.length) {
    let nextCell = upgradeCell(group.tableRows[rIdx][nextCIdx]);
    nextCell.hidden = true;
    group.tableRows[rIdx][nextCIdx] = nextCell;
    cell.colspan += nextCell.colspan || 1;
    group.tableRows[rIdx][cIdx] = cell;
    recalculateTableQuestionRange(gIdx);
    renderCreator();
  }
}

function mergeCellDown(gIdx, rIdx, cIdx) {
  const part = listeningCreatorState.parts[activeCreatorPartIndex];
  const group = part.questionGroups[gIdx];
  let cell = upgradeCell(group.tableRows[rIdx][cIdx]);
  let nextRIdx = rIdx + cell.rowspan;
  if (nextRIdx < group.tableRows.length) {
    let nextCell = upgradeCell(group.tableRows[nextRIdx][cIdx]);
    nextCell.hidden = true;
    group.tableRows[nextRIdx][cIdx] = nextCell;
    cell.rowspan += nextCell.rowspan || 1;
    group.tableRows[rIdx][cIdx] = cell;
    recalculateTableQuestionRange(gIdx);
    renderCreator();
  }
}

// ── Inline Answer Key Rendering ──
function renderAnswersInline(group, gIdx) {
  const qNums = parseRange(group.questionRange);
  if (qNums.length === 0) {
    return `<div style="font-size: 13px; color: #ef4444;">Invalid question range.</div>`;
  }
  return qNums.map(num => {
    const ansKey = String(num);
    const answer = listeningCreatorState.answerKey[ansKey] || '';
    return `
      <div class="creator-qs-answer-row" style="display: flex; align-items: center; gap: 8px;">
        <span class="creator-qs-answer-num" style="font-weight: 700; width: 45px; font-size: 13px; color: #475569;">Q${num}:</span>
        <input class="creator-qs-input" style="flex: 1;" value="${esc(answer)}" placeholder="Answer..." oninput="updateAnswerKey(${num}, this.value)" />
      </div>
    `;
  }).join('');
}

function updateAnswerKey(num, val) {
  listeningCreatorState.answerKey[String(num)] = val;
}

// ── Preview Launch Modal Controls ──
function previewListeningTest() {
  const errorMsg = getTestValidationError();
  if (errorMsg) {
    listeningNotify('error', 'Test Validation Failed:\n' + errorMsg);
    return;
  }
  document.getElementById('creator-launch-modal').style.display = 'flex';
}

function closeLaunchModal() {
  document.getElementById('creator-launch-modal').style.display = 'none';
}

function getTestValidationError() {
  const errors = [];
  if (listeningCreatorState.parts.length === 0) {
    errors.push('The test must have at least 1 part.');
  }

  let totalQuestions = 0;
  listeningCreatorState.parts.forEach((part, idx) => {
    // Check audio
    if (!part.audioUrl && !part._audioFile) {
      errors.push(`Part ${part.partNumber}: No audio uploaded or audio URL provided.`);
    }
    // Check questions
    let partQuestions = 0;
    part.questionGroups.forEach((group) => {
      const parsed = parseRange(group.questionRange);
      partQuestions += parsed.length;
      totalQuestions += parsed.length;
    });

    if (partQuestions === 0) {
      errors.push(`Part ${part.partNumber}: No question groups configured.`);
    }
  });

  if (totalQuestions > LISTENING_LIMITS.maxQuestions) {
    errors.push(`Total questions (${totalQuestions}) exceed the maximum permitted (${LISTENING_LIMITS.maxQuestions}).`);
  }

  return errors.length > 0 ? errors.join('\n') : null;
}

function startPreviewTest() {
  const emergencyEnabled = document.getElementById('emergency-view-enabled').checked;
  closeLaunchModal();

  const finalTestData = JSON.parse(JSON.stringify(listeningCreatorState));
  finalTestData.emergencyView = emergencyEnabled;

  loadTestInPlayer(finalTestData);
}

// ── Share Test Logic ──
async function triggerSaveListeningTest() {
  const errorMsg = getTestValidationError();
  if (errorMsg) {
    listeningNotify('error', 'Test Validation Failed:\n' + errorMsg);
    return;
  }

  listeningNotify('info', 'Preparing test for upload...', 2000);

  try {
    const url = await ListeningSharing.saveTestToSupabase(listeningCreatorState, (msg) => {
      listeningNotify('info', msg, 3000);
    });

    window.prompt('Your listening test has been uploaded successfully! Share this link with candidates:', url);
  } catch (error) {
    listeningNotify('error', 'Failed to save test: ' + error.message);
  }
}

// ── Test Player Workspace Engine ──
async function loadDemoTest() {
  toggleLoading(true);
  try {
    // Determine the correct path for sample-data.json.
    // When loaded from ielts/index.html the base is /ielts/,
    // but the file lives at /ielts/listening/sample-data.json.
    // Detect by checking if the current path already includes /listening/.
    const isStandalone = window.location.pathname.includes('/listening/');
    const dataPath = isStandalone ? './sample-data.json' : './listening/sample-data.json';
    const res = await fetch(dataPath);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    loadTestInPlayer(data);
  } catch (error) {
    listeningNotify('error', 'Failed to load listening demo data.');
  } finally {
    toggleLoading(false);
  }
}

async function loadSharedTest(shareCode) {
  toggleLoading(true);
  try {
    const data = await ListeningSharing.loadTestFromSupabase(shareCode);
    if (!data) {
      listeningNotify('error', 'Shared test could not be found or has been deleted.');
      openListeningCreator();
      return;
    }
    loadTestInPlayer(data);
  } catch (error) {
    listeningNotify('error', 'Failed to retrieve test data: ' + error.message);
    openListeningCreator();
  } finally {
    toggleLoading(false);
  }
}

function loadTestInPlayer(testData) {
  listeningPlayerTestData = testData;
  listeningActivePlayerPartIndex = 0;
  listeningPlayerAnswers = {};
  listeningIsTestChecked = false;
  listeningActiveFocusedQuestion = null;
  partAudioPlayed = {};

  // Toggle visible workspace panels
  document.getElementById('input-view').style.display = 'none';
  document.getElementById('test-view').style.display = 'flex';
  const creatorWs = document.getElementById('listening-creator-workspace');
  if (creatorWs) creatorWs.style.display = 'none';
  
  // Restore normal header for player (standalone app only — main app has its own header)
  const timerDisplay = document.getElementById('timer-display');
  if (timerDisplay) {
    timerDisplay.innerText = '';
    timerDisplay.style.color = '';
    timerDisplay.style.fontWeight = '';
  }
  // Only replace header-right in standalone listening app (it has listening-specific buttons)
  const headerRight = document.querySelector('.ielts-header-right');
  const isStandalone = window.location.pathname.includes('/listening/');
  if (headerRight && isStandalone) {
    headerRight.innerHTML = `
    <button class="header-icon-btn" type="button" aria-label="Signal status" title="Connected">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h.01"></path><path d="M8.5 16.5a5 5 0 0 1 7 0"></path><path d="M5 13a10 10 0 0 1 14 0"></path><path d="M1.5 9.5a15 15 0 0 1 21 0"></path>
      </svg>
    </button>
    <button id="share-test-button" class="header-icon-btn" type="button" onclick="handleShare()" aria-label="Share test" title="Share Test">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
      </svg>
    </button>
    <button class="header-icon-btn" type="button" onclick="listening_openOptionsMenu()" aria-label="Open options" title="Settings">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    </button>
  `;
  }
  
  const splitPane = document.getElementById('listening-split-pane');
  if (splitPane) splitPane.style.display = 'flex';
  const listeningPartHeader = document.getElementById('listening-part-header');
  if (listeningPartHeader) listeningPartHeader.style.display = 'flex';
  const bottomNav = document.getElementById('listening-bottom-nav');
  // In integrated app the listening-bottom-nav is always shown in player mode;
  // in standalone the creator bottom nav is outside #test-view and should be hidden during test
  const isStandalonePage = window.location.pathname.includes('/listening/');
  if (bottomNav) bottomNav.style.display = isStandalonePage ? 'none' : 'flex';

  // Show all listening-test-section elements and hide others
  document.querySelectorAll('.reading-test-section, .writing-test-section').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.listening-test-section').forEach(el => {
    // Only show top-level sections (split-pane and part-header); nav handled above
    if (el.id === 'listening-split-pane' || el.id === 'listening-part-header') el.style.display = el.id === 'listening-split-pane' ? 'flex' : 'flex';
  });

  // Setup security tracking
  listeningSessionIntegrity.leftTestInterfaceCount = 0;
  listeningSessionIntegrity.reviewModeStarted = false;

  // Calculate timer seconds: use custom limit if set, else audio duration + 2 minutes
  let totalAudioDuration = listeningPlayerTestData.audioDuration || 240;

  if (listeningCustomTimeLimitSeconds !== null) {
    listeningTestTimerSeconds = Math.max(60, listeningCustomTimeLimitSeconds);
  } else {
    // Default: (duration of audio) + 2 mins, minimum 3 minutes
    listeningTestTimerSeconds = Math.max(180, totalAudioDuration + 120);
  }
  listeningTestTimerPaused = false;
  listeningLastTimerTickAt = Date.now();
  startTestTimer();

  renderPlayerAudio();
  renderPlayerPart();
  renderPlayerFooter();
}

function exitListeningTest() {
  stopTestTimer();
  // Reset audio
  const audio = document.getElementById('listening-audio-element');
  if (audio) {
    audio.pause();
    audio.src = '';
  }
  
  // Restore normal high contrast styles
  listening_setContrastMode('normal');

  openListeningCreator();
}

// ── Timer Logic ──
function startTestTimer() {
  stopTestTimer();
  updateTimerDisplay();
  listeningTestTimerInterval = window.setInterval(() => {
    if (listeningTestTimerPaused) {
      listeningLastTimerTickAt = Date.now();
      return;
    }
    const now = Date.now();
    const elapsed = Math.floor((now - listeningLastTimerTickAt) / 1000);
    if (elapsed <= 0) return;
    listeningLastTimerTickAt += elapsed * 1000;
    listeningTestTimerSeconds = Math.max(0, listeningTestTimerSeconds - elapsed);
    if (listeningTestTimerSeconds <= 0) {
      stopTestTimer();
      handleTimeUp();
    }
    updateTimerDisplay();
  }, 1000);
}

function stopTestTimer() {
  if (listeningTestTimerInterval) {
    window.clearInterval(listeningTestTimerInterval);
    listeningTestTimerInterval = null;
  }
}

function updateTimerDisplay() {
  // Prefer listening-timer-pill (in both standalone and main app), fall back to timer-display
  const el = document.getElementById('listening-timer-pill') || document.getElementById('timer-display');
  if (!el) return;
  const mins = Math.floor(listeningTestTimerSeconds / 60);
  const secs = listeningTestTimerSeconds % 60;
  const text = `${mins} minute${mins !== 1 ? 's' : ''}, ${secs.toString().padStart(2, '0')} seconds remaining`;
  el.textContent = text;
  // Also keep timer-display in sync when it's a separate element
  const td = document.getElementById('timer-display');
  if (td && td !== el) td.textContent = text;
}

function handleTimeUp() {
  listeningNotify('warning', 'Time is up! Submitting your answers automatically.');
  submitListeningTest();
}

// ── Play-Once Audio Player Implementation ──
function renderPlayerAudio() {
  const audio = document.getElementById('listening-audio-element');
  const label = document.getElementById('audio-status-label');
  if (!audio) return;

  audio.src = listeningPlayerTestData.audioUrl || '';
  audio.load();
  
  if (label) {
    label.innerHTML = '🔇 Audio stopped';
    label.classList.remove('is-playing');
  }

  // Attach ended listener
  audio.onended = () => {
    if (label) {
      label.innerHTML = '🔇 Audio completed';
      label.classList.remove('is-playing');
    }
  };

  // Autoplay since the test has just started
  startAudioPlayback();
}

function startAudioPlayback() {
  const audio = document.getElementById('listening-audio-element');
  const label = document.getElementById('audio-status-label');
  if (!audio) return;

  audio.play().then(() => {
    if (label) {
      label.innerHTML = '🔊 Audio is Playing';
      label.classList.add('is-playing');
    }
  }).catch((err) => {
    console.warn('Playback failed or was prevented:', err);
    listeningNotify('warning', 'Audio autoplay is pending. Click anywhere on the page to start playing.');
    
    const startOnGesture = () => {
      audio.play().then(() => {
        if (label) {
          label.innerHTML = '🔊 Audio is Playing';
          label.classList.add('is-playing');
        }
        document.removeEventListener('click', startOnGesture);
      }).catch(e => console.error(e));
    };
    document.addEventListener('click', startOnGesture);
  });
}

// ── Render Player Test Questions ──
function renderPlayerPart() {
  const part = listeningPlayerTestData.parts[listeningActivePlayerPartIndex];
  
  // Set Official Part instruction texts
  const partTitleEl = document.getElementById('player-part-title');
  const partDescEl = document.getElementById('player-part-desc');
  if (partTitleEl) partTitleEl.textContent = `Part ${part.partNumber}`;
  // Only show the question range instruction (strip any context/intro sentence)
  if (partDescEl) {
    const qRange = part.questionRange || getPartQuestionRange(part);
    partDescEl.textContent = `Listen carefully and answer Questions ${qRange}.`;
  }

  // Handle nav arrow disabled statuses — support both standalone and embedded IDs
  const prevBtn = document.getElementById('listening-nav-arrow-prev') || document.getElementById('nav-arrow-prev');
  const nextBtn = document.getElementById('listening-nav-arrow-next') || document.getElementById('nav-arrow-next');
  if (prevBtn) prevBtn.disabled = (listeningActivePlayerPartIndex === 0);
  if (nextBtn) nextBtn.disabled = (listeningActivePlayerPartIndex === listeningPlayerTestData.parts.length - 1);

  const container = document.getElementById('player-questions-container');
  container.innerHTML = '';

  part.questionGroups.forEach((group, gIdx) => {
    const block = document.createElement('div');
    block.style.marginBottom = '40px';

    // Header & Instructions + Help Icon
    let html = `
      <div class="group-title">Questions ${group.questionRange}</div>
      <a class="help-float-right" onclick="showHelpInfo()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/><line x1="12" y1="15" x2="12.01" y2="15"/><path d="M8 12h8"/></svg> Help
      </a>
      <div class="group-instructions">${esc(group.instructions || '')}</div>
    `;

    // Render questions based on type
    if (group.type === 'multiple_choice') {
      html += `
        <div style="display:flex; flex-direction:column; gap:20px; padding-left:4px;">
          ${group.questions.map((q) => `
            <div>
              <div style="font-weight:600; font-size:14px; margin-bottom:8px;">
                <span style="font-weight:700; margin-right:4px;">${q.number}</span> ${esc(q.stem || '')}
              </div>
              <div style="display:flex; flex-direction:column; gap:8px; padding-left:14px;">
                ${(q.options || []).map((opt, oIdx) => {
                  const letter = String.fromCharCode(65 + oIdx);
                  const checked = listeningPlayerAnswers[String(q.number)] === letter ? 'checked' : '';
                  const disabled = listeningIsTestChecked ? 'disabled' : '';
                  return `
                    <label style="display:flex; gap:8px; align-items:center; cursor:pointer; font-size:13.5px;">
                      <input type="radio" name="q-${q.number}" value="${letter}" ${checked} ${disabled} 
                             onfocus="setActiveFocusQuestion(${q.number})"
                             onchange="saveAnswer(${q.number}, '${letter}')">
                      <span style="font-weight:700; color:#666; width:16px;">${letter}</span>
                      <span>${esc(opt)}</span>
                    </label>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (['form_completion', 'short_answer'].includes(group.type)) {
      html += `
        <div style="display:flex; flex-direction:column; gap:14px;">
          ${group.questions.map((q) => {
            const val = listeningPlayerAnswers[String(q.number)] || '';
            const disabled = listeningIsTestChecked ? 'readonly' : '';
            const statement = q.statement || `___${q.number}___`;
            
            // Replace placeholder with text inputs
            const inputField = `<input type="text" class="listening-text-gap-input" data-q="${q.number}" value="${esc(val)}" ${disabled} onfocus="setActiveFocusQuestion(${q.number})" oninput="saveAnswer(${q.number}, this.value)">`;
            const renderedStatement = statement.replace(/___(\d+)___/g, inputField);
            
            return `
              <div style="display:flex; align-items:center; gap:8px;">
                ${q.label ? `<span style="font-weight:700; min-width:90px; color:#444; font-size:13.5px;">${esc(q.label)}</span>` : ''}
                <div style="flex:1; font-size:13.5px;">
                  <span style="font-weight:700; margin-right:4px;">${q.number}</span>
                  ${renderedStatement}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (['note_completion', 'summary_completion', 'flowchart_completion', 'sentence_completion'].includes(group.type)) {
      const disabled = listeningIsTestChecked ? 'readonly' : '';
      const text = group.summaryText || '';
      
      const renderedText = text.replace(/___(\d+)___/g, (match, qNum) => {
        const val = listeningPlayerAnswers[String(qNum)] || '';
        return `<input type="text" class="listening-text-gap-input" data-q="${qNum}" value="${esc(val)}" ${disabled} onfocus="setActiveFocusQuestion(${qNum})" oninput="saveAnswer(${qNum}, this.value)">`;
      });

      html += `
        <div style="padding-left:4px;">
          ${group.summaryHeading ? `<h3 style="color:#000; margin-bottom:12px; font-size:14px; font-weight:700;">${esc(group.summaryHeading)}</h3>` : ''}
          <div style="line-height:1.8; font-size:13.5px; white-space:pre-line;">
            ${renderedText}
          </div>
        </div>
      `;
    } else if (group.type === 'table_completion') {
      const disabled = listeningIsTestChecked ? 'readonly' : '';
      const headers = group.tableHeaders || [];
      const rows = group.tableRows || [];

      html += `
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; margin-top:8px;">
            <thead>
              <tr style="background:#f5f5f5; border-bottom: 2px solid #bbb;">
                ${headers.map(h => {
                  const text = typeof h === 'object' ? h.text : h;
                  const width = typeof h === 'object' && h.width ? `width:${h.width};` : '';
                  return `<th style="border:1px solid #d3d3d3; padding:10px; text-align:left; font-weight:700; font-size:13px; color:#111; ${width}">${esc(text)}</th>`;
                }).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `
                <tr style="border-bottom: 1px solid #d3d3d3;">
                  ${row.map(cell => {
                    if (typeof cell === 'object' && cell.hidden) return '';
                    const text = typeof cell === 'object' ? cell.text : cell;
                    const colspan = typeof cell === 'object' && cell.colspan > 1 ? `colspan="${cell.colspan}"` : '';
                    const rowspan = typeof cell === 'object' && cell.rowspan > 1 ? `rowspan="${cell.rowspan}"` : '';
                    const height = typeof cell === 'object' && cell.height ? `height:${cell.height};` : '';
                    const renderedCell = text.replace(/___(\d+)___/g, (match, qNum) => {
                      const val = listeningPlayerAnswers[String(qNum)] || '';
                      return `<input type="text" class="listening-text-gap-input" data-q="${qNum}" value="${esc(val)}" ${disabled} onfocus="setActiveFocusQuestion(${qNum})" oninput="saveAnswer(${qNum}, this.value)">`;
                    });
                    return `<td style="border:1px solid #d3d3d3; padding:10px; font-size:13.5px; ${height}" ${colspan} ${rowspan}>${renderedCell}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (group.type === 'matching') {
      // Matching options - drag-and-drop to slots
      const optionsList = group.options || [];
      
      html += `
        <div class="matching-matching-container">
          <!-- Items List -->
          <div class="matching-items-list">
            <div class="column-header">People</div>
            ${group.questions.map((q) => {
              const val = listeningPlayerAnswers[String(q.number)] || '';
              const dropzoneClass = val ? 'matching-dropzone filled' : 'matching-dropzone';
              const targetClass = listeningActiveFocusedQuestion === q.number ? 'matching-dropzone active-target' : '';
              const displayVal = val || q.number;

              return `
                <div class="matching-item-row">
                  <span style="font-weight:600;"><span style="color:#000; font-weight:700; margin-right:4px;">${q.number}</span> ${esc(q.statement || '')}</span>
                  <div class="${dropzoneClass} ${targetClass}"
                       ondragover="handleDragOver(event)" 
                       ondragleave="handleDragLeave(event)" 
                       ondrop="handleDrop(event, ${q.number})"
                       onclick="handleDropzoneClick(${q.number})">
                    ${esc(displayVal)}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Options Stack -->
          <div class="matching-options-panel">
            <div class="column-header">Staff Responsibilities</div>
            <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-start;">
              ${optionsList.map(opt => {
                const optText = opt.trim();
                const isSelected = selectedDropOption === optText ? 'selected-for-drop' : '';
                return `
                  <div class="draggable-option-pill ${isSelected}" 
                       draggable="true" 
                       ondragstart="handleDragStart(event, '${esc(optText)}')"
                       onclick="handleOptionClick(this, '${esc(optText)}')">
                    ${esc(optText)}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    } else if (['map_labelling', 'diagram_completion'].includes(group.type)) {
      const isDragDrop = group.mapMode === 'drag_drop' || (group.options && group.options.length > 0);
      const optionsList = group.options || [];

      html += `
        ${group.mapImageUrl ? `
          <div style="text-align:center; margin-bottom:24px; padding:16px; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0;">
            <img class="map-labelling-image-preview" src="${group.mapImageUrl}" style="max-width:100%; max-height:420px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          </div>
        ` : ''}

        ${!isDragDrop ? `
          <!-- Manually-Typed Answers in Separate Gap Boxes Below Image -->
          <div style="display:flex; flex-direction:column; gap:12px; max-width:680px; margin:0 auto;">
            ${group.questions.map((q) => {
              const val = listeningPlayerAnswers[String(q.number)] || '';
              const disabled = listeningIsTestChecked ? 'readonly' : '';
              return `
                <div style="display:flex; align-items:center; gap:12px; background:white; padding:10px 16px; border-radius:8px; border:1.5px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                  <span style="font-weight:700; font-size:0.95rem; color:#0f172a; min-width:32px;">${q.number}</span>
                  ${q.label ? `<span style="font-weight:600; font-size:0.9rem; color:#475569; min-width:180px;">${esc(q.label)}</span>` : ''}
                  <input type="text" class="listening-text-gap-input" data-q="${q.number}" value="${esc(val)}" ${disabled}
                    onfocus="setActiveFocusQuestion(${q.number})"
                    oninput="saveAnswer(${q.number}, this.value)"
                    placeholder="Type answer here..."
                    style="flex:1; border:1px solid #cbd5e1; border-radius:6px; padding:6px 12px; font-weight:600; font-size:0.9rem; outline:none;" />
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <!-- Drag-and-Drop / Option Selection Below Map -->
          <div class="matching-matching-container">
            <!-- Items List -->
            <div class="matching-items-list">
              <div class="column-header">Questions</div>
              ${group.questions.map((q) => {
                const val = listeningPlayerAnswers[String(q.number)] || '';
                const dropzoneClass = val ? 'matching-dropzone filled' : 'matching-dropzone';
                const targetClass = listeningActiveFocusedQuestion === q.number ? 'matching-dropzone active-target' : '';
                const displayVal = val || q.number;

                return `
                  <div class="matching-item-row">
                    <span style="font-weight:600;"><span style="color:#000; font-weight:700; margin-right:4px;">${q.number}</span> ${esc(q.label || '')}</span>
                    <div class="${dropzoneClass} ${targetClass}"
                         ondragover="handleDragOver(event)" 
                         ondragleave="handleDragLeave(event)" 
                         ondrop="handleDrop(event, ${q.number})"
                         onclick="handleDropzoneClick(${q.number})">
                      ${esc(displayVal)}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Options Stack -->
            <div class="matching-options-panel">
              <div class="column-header">Labels</div>
              <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:flex-start;">
                ${optionsList.map(opt => {
                  const optText = opt.trim();
                  const isSelected = selectedDropOption === optText ? 'selected-for-drop' : '';
                  return `
                    <div class="draggable-option-pill ${isSelected}" 
                         draggable="true" 
                         ondragstart="handleDragStart(event, '${esc(optText)}')"
                         onclick="handleOptionClick(this, '${esc(optText)}')">
                      ${esc(optText)}
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        `}
      `;
    }

    block.innerHTML = html;
    container.appendChild(block);
  });
}

function focusQuestion(qNum) {
  setActiveFocusQuestion(qNum);

  // Scroll the focused element into view
  setTimeout(() => {
    const inp = document.querySelector(`input[data-q="${qNum}"], input[name="q-${qNum}"]`);
    if (inp) {
      inp.focus();
      inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);
}

function setActiveFocusQuestion(qNum) {
  listeningActiveFocusedQuestion = qNum;
  renderPlayerFooter();
}

function saveAnswer(qNum, value) {
  listeningPlayerAnswers[String(qNum)] = value;
  
  // Rerender bottom footer so bold/underline updates
  renderPlayerFooter();
}

// ── Draggable Options Handlers ──
function handleDragStart(ev, text) {
  draggedOptionText = text;
  ev.dataTransfer.setData('text/plain', text);
}

function handleDragOver(ev) {
  ev.preventDefault();
  ev.currentTarget.classList.add('active-drag-over');
}

function handleDragLeave(ev) {
  ev.currentTarget.classList.remove('active-drag-over');
}

function handleDrop(ev, qNum) {
  ev.preventDefault();
  ev.currentTarget.classList.remove('active-drag-over');
  const text = ev.dataTransfer.getData('text/plain') || draggedOptionText;
  if (text) {
    saveDragAnswer(qNum, text);
  }
}

function handleOptionClick(element, text) {
  document.querySelectorAll('.draggable-option-pill').forEach(el => el.classList.remove('selected-for-drop'));
  selectedDropOption = text;
  element.classList.add('selected-for-drop');
}

function handleDropzoneClick(qNum) {
  setActiveFocusQuestion(qNum);

  if (selectedDropOption) {
    saveDragAnswer(qNum, selectedDropOption);
    document.querySelectorAll('.draggable-option-pill').forEach(el => el.classList.remove('selected-for-drop'));
    selectedDropOption = null;
  } else {
    // If clicked while filled, clear it
    if (listeningPlayerAnswers[String(qNum)]) {
      saveDragAnswer(qNum, '');
    }
  }
}

function saveDragAnswer(qNum, text) {
  listeningPlayerAnswers[String(qNum)] = text;
  renderPlayerPart();
  renderPlayerFooter();
}

// ── Test Footer Navigation ──
function renderPlayerFooter() {
  // Support both standalone (nav-parts) and embedded-in-main-app (listening-nav-parts) IDs
  const partsContainer = document.getElementById('listening-nav-parts') || document.getElementById('nav-parts');
  const questionsContainer = document.getElementById('listening-nav-questions') || document.getElementById('nav-questions');
  if (!partsContainer || !questionsContainer) return;

  partsContainer.innerHTML = '';
  questionsContainer.innerHTML = '';

  // 1. Render Part buttons in nav-parts
  listeningPlayerTestData.parts.forEach((p, idx) => {
    const isCurrentPart = (idx === listeningActivePlayerPartIndex);
    const btn = document.createElement('button');
    btn.className = `nav-part-btn ${isCurrentPart ? 'active' : ''}`;
    btn.type = 'button';
    btn.textContent = `Part ${p.partNumber}`;
    btn.onclick = () => {
      listeningActivePlayerPartIndex = idx;
      listeningActiveFocusedQuestion = null;
      renderPlayerPart();
      renderPlayerFooter();
    };
    partsContainer.appendChild(btn);
  });

  // 2. Render Question buttons in nav-questions for the active part
  const activePart = listeningPlayerTestData.parts[listeningActivePlayerPartIndex];
  const qNums = getPartQuestionNumbers(activePart);

  qNums.forEach((n) => {
    const isAnswered = listeningPlayerAnswers[String(n)] && listeningPlayerAnswers[String(n)] !== '';
    const isActive = (n === listeningActiveFocusedQuestion);
    const btn = document.createElement('button');
    btn.className = `nav-q-btn ${isAnswered ? 'answered' : ''} ${isActive ? 'active' : ''}`;
    btn.type = 'button';
    btn.textContent = n;
    btn.onclick = () => {
      focusQuestion(n);
    };
    questionsContainer.appendChild(btn);
  });
}

function getPartQuestionNumbers(part) {
  const nums = [];
  part.questionGroups.forEach((g) => {
    const parsed = parseRange(g.questionRange);
    parsed.forEach(n => {
      if (!nums.includes(n)) nums.push(n);
    });
  });
  nums.sort((a, b) => a - b);
  return nums;
}

// Derives a human-readable range string like "1–10" from a part's question groups
function getPartQuestionRange(part) {
  const nums = getPartQuestionNumbers(part);
  if (nums.length === 0) return '';
  if (nums.length === 1) return String(nums[0]);
  return `${nums[0]}–${nums[nums.length - 1]}`;
}

function navigatePrevPart() {
  if (listeningActivePlayerPartIndex > 0) {
    listeningActivePlayerPartIndex--;
    listeningActiveFocusedQuestion = null;
    renderPlayerPart();
    renderPlayerFooter();
  }
}

function navigateNextPart() {
  if (listeningActivePlayerPartIndex < listeningPlayerTestData.parts.length - 1) {
    listeningActivePlayerPartIndex++;
    listeningActiveFocusedQuestion = null;
    renderPlayerPart();
    renderPlayerFooter();
  }
}

// ── Options Menu Settings ──
function openSettingsMenu() {
  document.getElementById('options-menu').style.display = 'block';
  showOptionsPanel('main');
}

// Opens the options menu in "creator" mode (from the creator header hamburger)
function openCreatorOptionsMenu() {
  document.getElementById('options-menu').style.display = 'block';
  syncSettingsPanelUI();
  showOptionsPanel('creator');
}

function closeOptionsMenu() {
  document.getElementById('options-menu').style.display = 'none';
}

function closeSettingsMenu() {
  closeOptionsMenu();
}

function showOptionsPanel(panel) {
  const panelIds = {
    main: 'options-main-panel',
    creator: 'options-creator-panel',
    contrast: 'options-contrast-panel',
    'text-size': 'options-text-size-panel',
    settings: 'options-settings-panel'
  };
  for (const [name, id] of Object.entries(panelIds)) {
    const el = document.getElementById(id);
    if (el) el.style.display = name === panel ? 'block' : 'none';
  }
  if (panel === 'settings') syncSettingsPanelUI();
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
  // Sync contrast label (player panel + creator panel)
  const label = contrastMode === 'yellow-black' ? 'Yellow on black' : contrastMode === 'white-black' ? 'White on black' : 'Normal';
  const sizeLabel = textSizeMode === 'xlarge' ? 'Extra large' : textSizeMode === 'large' ? 'Large' : 'Normal';
  ['contrast-option-state', 'contrast-option-state-creator'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = label;
  });
  ['text-size-option-state', 'text-size-option-state-creator'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = sizeLabel;
  });
  document.querySelectorAll('[data-contrast-choice]').forEach(row => {
    row.classList.toggle('selected', row.getAttribute('data-contrast-choice') === contrastMode);
  });
  document.querySelectorAll('[data-text-size-choice]').forEach(row => {
    row.classList.toggle('selected', row.getAttribute('data-text-size-choice') === textSizeMode);
  });
}

// ── Settings Sub-Panel (Audio & Timer) ──
function syncSettingsPanelUI() {
  // Sync audio file state
  const hasFile = listeningCreatorState && listeningCreatorState._audioFile;
  const hasUrl = listeningCreatorState && listeningCreatorState.audioUrl;
  const promptEl = document.getElementById('settings-audio-upload-prompt');
  const detailsEl = document.getElementById('settings-audio-details');
  const nameEl = document.getElementById('settings-audio-name');
  const durationEl = document.getElementById('settings-audio-duration');
  const urlEl = document.getElementById('settings-audio-url');

  if (hasFile) {
    if (promptEl) promptEl.textContent = 'Change audio file';
    if (nameEl) nameEl.textContent = listeningCreatorState._audioFile.name;
    if (durationEl) durationEl.textContent = `Duration: ${Math.round(listeningCreatorState.audioDuration || 0)}s (${Math.round((listeningCreatorState.audioDuration || 0) / 60)}m ${Math.round((listeningCreatorState.audioDuration || 0) % 60)}s)`;
    if (detailsEl) detailsEl.style.display = 'flex';
  } else {
    if (promptEl) promptEl.textContent = 'Click to upload Mp3, Wav or M4a';
    if (detailsEl) detailsEl.style.display = 'none';
  }
  if (urlEl) urlEl.value = (hasUrl && !hasFile) ? (listeningCreatorState.audioUrl || '') : '';

  // Sync time limit
  const isCustom = listeningCustomTimeLimitSeconds !== null;
  const defaultRadio = document.getElementById('timelimit-default');
  const customRadio = document.getElementById('timelimit-custom');
  const customRow = document.getElementById('custom-timelimit-row');
  const defaultLabel = document.getElementById('default-timelimit-label');
  const customMinInput = document.getElementById('custom-timelimit-minutes');

  if (defaultRadio) defaultRadio.checked = !isCustom;
  if (customRadio) customRadio.checked = isCustom;
  if (customRow) customRow.style.display = isCustom ? 'block' : 'none';

  const audioDur = listeningCreatorState ? (listeningCreatorState.audioDuration || 0) : 0;
  const defaultSecs = Math.max(180, audioDur + 120);
  const defaultMins = Math.round(defaultSecs / 60);
  if (defaultLabel) {
    defaultLabel.textContent = audioDur > 0
      ? `audio (${Math.round(audioDur)}s) + 2 min = ${defaultMins} min`
      : 'audio length + 2 min';
  }
  if (isCustom && customMinInput && !customMinInput.value) {
    customMinInput.value = Math.round(listeningCustomTimeLimitSeconds / 60);
  }
}

function handleSettingsAudioUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const audioObj = new Audio(URL.createObjectURL(file));
  audioObj.addEventListener('loadedmetadata', () => {
    const duration = audioObj.duration;
    if (duration < 60) {
      listeningNotify('error', 'Audio file must be at least 60 seconds long.');
      return;
    }
    listeningCreatorState.audioDuration = duration;
    listeningCreatorState._audioFile = file;
    listeningCreatorState.audioUrl = URL.createObjectURL(file);
    // Also sync the main creator audio section
    renderCreator();
    syncSettingsPanelUI();
    listeningNotify('success', `Audio uploaded. Duration: ${Math.round(duration)}s.`);
  });
  audioObj.addEventListener('error', () => {
    listeningNotify('error', 'Failed to read audio file.');
  });
}

function removeSettingsAudio(event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  listeningCreatorState._audioFile = null;
  listeningCreatorState.audioUrl = '';
  listeningCreatorState.audioDuration = 0;
  const input = document.getElementById('settings-audio-input');
  if (input) input.value = '';
  renderCreator();
  syncSettingsPanelUI();
}

function applySettingsAudioUrl(val) {
  if (listeningCreatorState) {
    listeningCreatorState.audioUrl = val;
    // If a URL is manually entered, clear any uploaded file reference
    listeningCreatorState._audioFile = null;
    listeningCreatorState.audioDuration = 0;
  }
}

function onTimeLimitModeChange(value) {
  const customRow = document.getElementById('custom-timelimit-row');
  if (customRow) customRow.style.display = value === 'custom' ? 'block' : 'none';
  if (value === 'default') {
    listeningCustomTimeLimitSeconds = null;
  }
}

function applyCustomTimeLimit() {
  const input = document.getElementById('custom-timelimit-minutes');
  if (!input) return;
  const mins = parseInt(input.value, 10);
  if (mins > 0 && mins <= 180) {
    listeningCustomTimeLimitSeconds = mins * 60;
  }
}

function saveSettings() {
  const customRadio = document.getElementById('timelimit-custom');
  if (customRadio && customRadio.checked) {
    applyCustomTimeLimit();
  } else {
    listeningCustomTimeLimitSeconds = null;
  }
  listeningNotify('success', 'Settings saved.');
}

// ── Creator Question Tracker Nav Bar ──
function renderCreatorQuestionTracker() {
  const tracker = document.getElementById('creator-question-tracker');
  const pillsContainer = document.getElementById('creator-question-tracker-pills');
  if (!tracker || !pillsContainer || !listeningCreatorState) return;

  // Gather all question numbers across all parts
  const allNums = [];
  listeningCreatorState.parts.forEach(part => {
    part.questionGroups.forEach(group => {
      const parsed = parseRange(group.questionRange);
      parsed.forEach(n => { if (!allNums.includes(n)) allNums.push(n); });
    });
  });
  allNums.sort((a, b) => a - b);

  if (allNums.length === 0) {
    tracker.style.display = 'none';
    return;
  }

  tracker.style.display = 'block';
  pillsContainer.innerHTML = '';

  // Group by part for colour coding
  const qPartMap = {};
  listeningCreatorState.parts.forEach((part, pIdx) => {
    part.questionGroups.forEach(group => {
      const parsed = parseRange(group.questionRange);
      parsed.forEach(n => { qPartMap[n] = pIdx; });
    });
  });

  const partColors = ['#2563eb', '#0f766e', '#7c3aed', '#b45309'];

  allNums.forEach(n => {
    const partIdx = qPartMap[n] ?? 0;
    const color = partColors[partIdx % partColors.length];
    const pill = document.createElement('span');
    pill.title = `Q${n} — Part ${partIdx + 1}`;
    pill.style.cssText = `
      display: inline-flex; align-items: center; justify-content: center;
      width: 30px; height: 30px; border-radius: 6px;
      font-size: 12px; font-weight: 700; cursor: default;
      background: ${color}18; color: ${color};
      border: 1.5px solid ${color}40;
      transition: all 0.15s;
    `;
    pill.textContent = n;
    pillsContainer.appendChild(pill);
  });
}

function showHelpInfo() {
  listeningNotify('info', 'Help: Drag options from the box on the right and drop them into the target gaps on the left, or simply click an option and then click a gap.', 8000);
}

// ── Grading & Result Display ──
function submitListeningTest() {
  if (listeningIsTestChecked) return;
  listeningIsTestChecked = true;
  stopTestTimer();

  // Reset audio
  const audio = document.getElementById('listening-audio-element');
  if (audio) audio.pause();

  listeningSessionIntegrity.reviewModeStarted = true;

  // Calculate score
  const key = listeningPlayerTestData.answerKey || {};
  let score = 0;
  let total = 0;
  const breakdownRows = [];

  // Gather all question numbers
  const qNums = [];
  listeningPlayerTestData.parts.forEach((part) => {
    part.questionGroups.forEach((group) => {
      const parsed = parseRange(group.questionRange);
      parsed.forEach(n => {
        if (!qNums.includes(n)) qNums.push(n);
      });
    });
  });
  qNums.sort((a, b) => a - b);
  total = qNums.length;

  let unanswered = 0;
  qNums.forEach((n) => {
    const studentAns = String(listeningPlayerAnswers[String(n)] || '').trim().toLowerCase();
    const correctAns = String(key[String(n)] || '').trim().toLowerCase();
    const isCorrect = studentAns === correctAns && correctAns !== '';
    if (isCorrect) score++;
    if (!listeningPlayerAnswers[String(n)] || String(listeningPlayerAnswers[String(n)]).trim() === '') {
      unanswered++;
    }

    breakdownRows.push(`
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px; font-weight:700;">Q${n}</td>
        <td style="padding:8px; color: ${studentAns ? '#334155' : '#94a3b8'};">${studentAns ? esc(listeningPlayerAnswers[String(n)]) : '(No Answer)'}</td>
        <td style="padding:8px; font-weight:600; color:#0f766e;">${esc(key[String(n)] || '')}</td>
        <td style="padding:8px; text-align:center;">
          ${isCorrect 
            ? `<span style="color:#0f766e; font-weight:700;">✔ Correct</span>` 
            : `<span style="color:#ef4444; font-weight:700;">✘ Incorrect</span>`}
        </td>
      </tr>
    `);
  });

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const band = calculateIeltsListeningBand(score);
  const incorrect = total - score;

  // Show summary in modal
  const summaryEl = document.getElementById('result-summary');
  const metaEl = document.getElementById('result-meta');
  const breakdownEl = document.getElementById('result-breakdown');
  const warningEl = document.getElementById('result-warning');

  if (summaryEl) summaryEl.textContent = `${score} / ${total}`;
  if (metaEl) {
    metaEl.textContent = `${score} correct, ${incorrect} incorrect or unanswered.`;
  }

  if (breakdownEl) {
    breakdownEl.innerHTML = `
      <div class="result-stat stat-correct">
        <span class="result-stat-label">Correct</span>
        <strong>${score}</strong>
      </div>
      <div class="result-stat stat-incorrect">
        <span class="result-stat-label">Incorrect</span>
        <strong>${incorrect - unanswered}</strong>
      </div>
      <div class="result-stat stat-skipped">
        <span class="result-stat-label">Unanswered</span>
        <strong>${unanswered}</strong>
      </div>
      <div class="result-stat">
        <span class="result-stat-label">Band estimate</span>
        <strong>${band}</strong>
      </div>
      <div class="result-comment">
        <span class="result-stat-label">Comment</span>
        <p>${getListeningBandComment(band)}</p>
      </div>
    `;
  }

  if (warningEl) {
    if (listeningSessionIntegrity.leftTestInterfaceCount > 0) {
      warningEl.textContent = `Warning: Navigating away from the exam window was detected ${listeningSessionIntegrity.leftTestInterfaceCount} times. This behavior has been flagged.`;
      warningEl.style.display = 'block';
    } else {
      warningEl.style.display = 'none';
      warningEl.textContent = '';
    }
  }

  // Display results modal — populate content dynamically if listening-specific IDs are missing
  const resultModal = document.getElementById('result-modal');
  if (resultModal) {
    // If the listening-specific element IDs don't exist, write into the modal body directly
    if (!summaryEl && !breakdownEl) {
      const modalBody = resultModal.querySelector('.modal-body');
      if (modalBody) {
        modalBody.innerHTML = `
          <div style="text-align:center; padding: 16px 0 8px;">
            <div style="font-size: 3rem; font-weight: 900; color: #1e40af;">${score} / ${total}</div>
            <div style="font-size: 1rem; color: #64748b; margin-top: 4px;">${score} correct &bull; ${incorrect - unanswered} incorrect &bull; ${unanswered} unanswered</div>
            <div style="font-size: 1.4rem; font-weight: 700; margin-top: 12px;">Estimated Band: <span style="color:#0f766e;">${band}</span></div>
            <div style="font-size: 0.9rem; color:#475569; margin-top: 8px;">${getListeningBandComment(band)}</div>
          </div>
          <hr style="margin:16px 0; border:none; border-top:1px solid #e2e8f0;">
          <table style="width:100%; font-size:13px; border-collapse:collapse;">
            <thead><tr style="background:#f1f5f9;">
              <th style="padding:8px; text-align:left;">Q</th>
              <th style="padding:8px; text-align:left;">Your Answer</th>
              <th style="padding:8px; text-align:left;">Correct Answer</th>
              <th style="padding:8px; text-align:center;">Result</th>
            </tr></thead>
            <tbody>${breakdownRows.join('')}</tbody>
          </table>
        `;
      }
    }
    resultModal.style.display = 'flex';
  }

  // Mark/highlight inputs in the test view
  applyValidationStyling(key);
}

function getListeningBandComment(band) {
  const b = parseFloat(band);
  if (isNaN(b)) return "Need more practice. Try reviewing the script and listening again.";
  if (b >= 9.0) return "You either googled your way here or you're a snake.";
  if (b >= 8.0) return "Ur now as good as me... or you're just a lucky-ahh person.";
  if (b >= 7.5) return "Very kool! Hope you can maintain this score... even though it is expected from you.";
  if (b >= 7.0) return "Congrats, ig. Nothing special 'bout that score.";
  if (b >= 6.0) return "Not bad, but you can do better. Keep practicing.";
  return "Need more practice. Try reviewing the script and listening again.";
}

function calculateIeltsListeningBand(score) {
  if (score >= 39) return '9.0';
  if (score >= 37) return '8.5';
  if (score >= 35) return '8.0';
  if (score >= 32) return '7.5';
  if (score >= 30) return '7.0';
  if (score >= 26) return '6.5';
  if (score >= 23) return '6.0';
  if (score >= 18) return '5.5';
  if (score >= 15) return '5.0';
  if (score >= 10) return '4.0';
  return '3.5';
}

function applyValidationStyling(key) {
  document.querySelectorAll('input[data-q]').forEach((inp) => {
    const qNum = inp.getAttribute('data-q');
    const studentAns = String(inp.value || '').trim().toLowerCase();
    const correctAns = String(key[qNum] || '').trim().toLowerCase();

    inp.style.borderWidth = '2px';
    if (studentAns === correctAns && correctAns !== '') {
      inp.style.borderColor = '#0f766e';
      inp.style.background = '#f0fdfa';
    } else {
      inp.style.borderColor = '#ef4444';
      inp.style.background = '#fef2f2';
    }
  });

  // Highlight matching dropzones
  document.querySelectorAll('.matching-dropzone').forEach((dz) => {
    // Dropzone text is the student answer
    const textContent = dz.textContent.trim();
    // Try to find the question number. It might be in the parent row or data attributes, or simple index.
    // In our HTML: <div class="matching-dropzone" ... onclick="handleDropzoneClick(number)">
    const match = dz.getAttribute('onclick').match(/handleDropzoneClick\((\d+)/);
    if (match) {
      const qNum = match[1];
      const studentAns = String(listeningPlayerAnswers[String(qNum)] || '').trim().toLowerCase();
      const correctAns = String(key[qNum] || '').trim().toLowerCase();
      
      dz.style.borderWidth = '2px';
      if (studentAns === correctAns && correctAns !== '') {
        dz.style.borderColor = '#0f766e';
        dz.style.background = '#f0fdfa';
      } else {
        dz.style.borderColor = '#ef4444';
        dz.style.background = '#fef2f2';
      }
    }
  });

  // Highlight select dropdowns
  document.querySelectorAll('select[onchange^="saveAnswer"]').forEach((sel) => {
    const match = sel.getAttribute('onchange').match(/saveAnswer\((\d+)/);
    if (match) {
      const qNum = match[1];
      const studentAns = String(sel.value || '').trim().toLowerCase();
      const correctAns = String(key[qNum] || '').trim().toLowerCase();
      
      sel.style.borderWidth = '2px';
      if (studentAns === correctAns && correctAns !== '') {
        sel.style.borderColor = '#0f766e';
        sel.style.background = '#f0fdfa';
      } else {
        sel.style.borderColor = '#ef4444';
        sel.style.background = '#fef2f2';
      }
    }
  });
}

function closeResultModal(event) {
  if (event && event.target !== event.currentTarget && !event.target.closest('.modal-close')) return;
  document.getElementById('result-modal').style.display = 'none';
}

// ── Shared Utilities ──
function parseRange(rangeStr) {
  const s = String(rangeStr || '').trim();
  const rangeMatch = s.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    if (end >= start) {
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
  }
  const singleMatch = s.match(/^(\d+)$/);
  if (singleMatch) {
    return [Number(singleMatch[1])];
  }
  return [];
}

function listeningNotify(type, msg, duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) {
    console.log(`[Toast ${type}] ${msg}`);
    return;
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">${esc(msg)}</div>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function toggleLoading(show) {
  // Optional loading screen placeholder
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _internalHandleListeningDemo() { loadDemoTest(); }
window.handleListeningDemo = _internalHandleListeningDemo;
window.loadDemoTest = loadDemoTest;

// ── Listening Creator Bottom Nav helpers ──
function listeningCreatorNavPrev() {
  if (activeCreatorPartIndex > 0) {
    activeCreatorPartIndex--;
    renderCreator();
  }
}

function listeningCreatorNavNext() {
  if (listeningCreatorState && activeCreatorPartIndex < listeningCreatorState.parts.length - 1) {
    activeCreatorPartIndex++;
    renderCreator();
  }
}
