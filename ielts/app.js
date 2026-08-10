// ── Global Variables ──
let currentTestData = null;
window.uploadedImages = []; // Stores base64 strings of uploaded diagram images
let activePracticeMode = 'reading';
let contrastMode = 'normal';
let textSizeMode = 'normal';
let resultHasBeenDisplayed = false;
const sessionIntegrity = {
  leftTestInterfaceCount: 0,
  lastHiddenAt: 0,
  lastExitSignalAt: 0,
  pendingBlurTimer: null,
  pendingBlurStartedAt: 0,
  reminderShownForCurrentExit: false,
  reviewModeStarted: false
};

let currentWritingTestData = null;
let currentWritingTask = 1;
let writingTask1Response = '';
let writingTask2Response = '';
let writingTask1ImageData = null;
let writingTimerSeconds = 60 * 60;
let writingTimerInterval = null;
let writingTimerPaused = false;
let writingTimerSpeedMultiplier = 1;
let lastWritingTimerTickAt = 0;
let writingSpeedTimerUsed = false;
let writingSpeedTimerLocked = false;
let writingSpeedTimerFailedAttempts = 0;
let emergencyScoreLocked = false;
let emergencyScoreFailedAttempts = 0;
let creatorState = null;
let creatorCurrentPartIndex = 0;
let creatorActiveTableCell = null;
let creatorDirty = false;

const CREATOR_LIMITS = {
  maxParts: 3,
  maxSections: 10,
  maxQuestions: 40,
  maxQuestionsPerPart: 14,
  maxOptions: 9
};

const CREATOR_TYPES = [
  'heading_match',
  'multiple_choice',
  'true_false_notgiven',
  'summary_completion',
  'matching_features',
  'matching_endings',
  'matching_information',
  'table_completion',
  'flowchart_completion',
  'diagram_completion',
  'short_answer'
];


const WRITING_TASK_CONFIG = {
  1: {
    preamble: 'You should spend about 20 minutes on this task.',
    minWords: 150,
    wordRequirement: 'Write at least 150 words.'
  },
  2: {
    preamble: 'You should spend about 40 minutes on this task.',
    minWords: 250,
    wordRequirement: 'Write at least 250 words.'
  }
};

const WRITING_FORMAT_PROMPT = `You are an IELTS Writing question formatter. Clean up the raw question text for a test interface.

RULES:
1. Fix obvious typos and formatting issues.
2. Preserve the original meaning exactly. Do not paraphrase.
3. Do not add task labels, timing instructions, or word-count instructions.
4. Return only valid JSON with this shape: { "formattedText": "<cleaned question text>" }`;

window.IELTSApp = {
  notify,
  showResultModal,
  resetSessionIntegrity,
  stopSessionIntegrity,
  getSessionIntegrity,
  isIntegrityWatchActive
};

function switchPracticeMode(mode) {
  activePracticeMode = ['writing', 'listening'].includes(mode) ? mode : 'reading';
  const isWriting = activePracticeMode === 'writing';
  const isListening = activePracticeMode === 'listening';
  const isReading = activePracticeMode === 'reading';

  document.getElementById('mode-reading-btn')?.classList.toggle('active', isReading);
  document.getElementById('mode-writing-btn')?.classList.toggle('active', isWriting);
  document.getElementById('mode-listening-btn')?.classList.toggle('active', isListening);
  document.getElementById('reading-menu-panel')?.classList.toggle('active', isReading);
  document.getElementById('writing-menu-panel')?.classList.toggle('active', isWriting);
  document.getElementById('listening-menu-panel')?.classList.toggle('active', isListening);

  const title = document.getElementById('input-title');
  const subtitle = document.getElementById('input-subtitle');
  if (title) {
    title.textContent = isWriting
      ? 'IELTS Writing Practice Generator'
      : isListening
        ? 'IELTS Listening Practice Generator'
        : 'IELTS Reading Practice Generator';
  }
  if (subtitle) {
    subtitle.innerHTML = isWriting
      ? 'Allows you to easily create an IELTS Writing test interface with your own questions. Not sure if it is 100% accurate to the real deal <b>[EARLY BETA. SOME FEATURES MAY ALSO NOT WORK PROPERLY.]</b>'
      : isListening
        ? 'IELTS Listening practice tests are currently under development.'
        : "Paste your raw passage and question set, add a diagram if the task needs one, and generate a shareable practice interface. <b>[SUPER EARLY BETA. MANY FUNCTIONS WILL NOT WORK PROPERLY, AS THE PARSER PROMPT ISN'T OPTIMIZED ENOUGH.]</b>";
  }

  hideValidation();
  setLoadingMessage(isWriting ? 'Formatting your questions...' : 'AI is parsing your IELTS text...');
}

function toggleAiParserPanel() {
  const panel = document.getElementById('ai-parser-panel');
  const chevron = document.getElementById('ai-parser-chevron');
  const btn = document.querySelector('#ai-parser-card .action-card-trigger');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
  if (btn) btn.setAttribute('aria-expanded', String(!isOpen));
}

function backToEditor() {
  closeOptionsMenu();
  if (activePracticeMode === 'creator') {
    creatorState = null;
    creatorDirty = false;
  }
  stopWritingTimer();
  Renderer.stopTimer?.();
  activePracticeMode = activePracticeMode === 'writing' ? 'writing' : 'reading';
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
    showOptionsPanel(activePracticeMode === 'creator' ? 'creator' : 'main');
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
    creator: document.getElementById('options-creator-panel'),
    contrast: document.getElementById('options-contrast-panel'),
    'text-size': document.getElementById('options-text-size-panel')
  };
  for (const [name, el] of Object.entries(panels)) {
    if (el) el.style.display = name === panel ? 'block' : 'none';
  }
  
  const audioConfig = document.getElementById('listening-audio-config-block');
  if (audioConfig) {
    const isListening = document.getElementById('listening-creator-workspace') && document.getElementById('listening-creator-workspace').style.display === 'block';
    audioConfig.style.display = (panel === 'creator' && isListening) ? 'block' : 'none';
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
  const emergencyScoreOption = document.getElementById('emergency-score-option');
  const writingSpeedTimerOption = document.getElementById('writing-speed-timer-option');
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

  if (emergencyScoreOption) {
    emergencyScoreOption.style.display = hasEmergencyScorePin() && !resultHasBeenDisplayed && !emergencyScoreLocked ? '' : 'none';
  }
  if (writingSpeedTimerOption) {
    const canUseWritingSpeed = activePracticeMode === 'writing'
      && hasWritingSpeedTimerPin()
      && !writingSpeedTimerUsed
      && !writingSpeedTimerLocked;
    writingSpeedTimerOption.style.display = canUseWritingSpeed ? '' : 'none';
  }
}

function initOptionsChoiceUI() {
  const checkIcon = `
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10.2L8 14.2L16 5.8" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;

  document.querySelectorAll('.choice-check').forEach((node) => {
    node.setAttribute('aria-hidden', 'true');
    node.innerHTML = checkIcon;
  });

  document.querySelectorAll('.options-preview').forEach((preview) => {
    if (preview.children.length === 0) {
      preview.innerHTML = '<span></span><span></span><span></span>';
    }
    preview.setAttribute('aria-hidden', 'true');
  });
}

// ── Sharing ──
function handleShare() {
  const listeningWorkspace = document.getElementById('listening-creator-workspace');
  if (listeningWorkspace && listeningWorkspace.style.display !== 'none') {
    if (typeof triggerSaveListeningTest === 'function') {
      return triggerSaveListeningTest();
    }
  }
  if (activePracticeMode === 'creator') {
    if (typeof creatorShare === 'function') {
      return creatorShare();
    }
  }
  const payload = getActiveSharePayload();
  if (!payload) {
    notify('warning', 'There is no active test to share.');
    return;
  }
  document.getElementById('share-modal').style.display = 'flex';
}

async function shareViaSupabase() {
  try {
    const payload = getActiveSharePayload();
    if (!payload) {
      notify('warning', 'There is no active test to share.');
      return;
    }
    const url = await Sharing.saveTestToSupabase(payload);
    await navigator.clipboard.writeText(url);
    const fb = document.getElementById('share-supabase-feedback');
    if (fb) {
      fb.style.display = 'block';
      setTimeout(() => fb.style.display = 'none', 3000);
    }
  } catch (err) {
    notify('error', 'Failed to save to cloud: ' + err.message);
  }
}

function getActiveSharePayload() {
  if (activePracticeMode === 'writing' && currentWritingTestData) {
    saveCurrentWritingResponse();
    return {
      mode: 'writing',
      task1: currentWritingTestData.task1 || null,
      task2: currentWritingTestData.task2 || null,
      speedTimerPin: currentWritingTestData.speedTimerPin || ''
    };
  }

  if (activePracticeMode === 'listening' || window.currentListeningTestData) {
    return window.currentListeningTestData || null;
  }

  return currentTestData || null;
}


function closeShareModal(e) {
  const isExplicitCloseButton = !!e?.currentTarget?.closest?.('.modal-close');
  if (!e || e.target === e.currentTarget || isExplicitCloseButton) {
    document.getElementById('share-modal').style.display = 'none';
  }
}

function toggleEmergencyScorePinInput() {
  const enabled = document.getElementById('emergency-score-enabled')?.checked;
  const row = document.getElementById('emergency-score-pin-row');
  const input = document.getElementById('emergency-score-pin');
  if (row) row.style.display = enabled ? 'block' : 'none';
  if (!enabled && input) input.value = '';
}

function toggleWritingSpeedTimerPinInput() {
  const enabled = document.getElementById('writing-speed-timer-enabled')?.checked;
  const row = document.getElementById('writing-speed-timer-pin-row');
  const input = document.getElementById('writing-speed-timer-pin');
  if (row) row.style.display = enabled ? 'block' : 'none';
  if (!enabled && input) input.value = '';
}

function sanitizePinInput(input) {
  if (!input) return;
  input.value = String(input.value || '').replace(/\D/g, '').slice(0, 8);
}

function readEmergencyScorePinConfig() {
  const enabled = document.getElementById('emergency-score-enabled')?.checked;
  if (!enabled) return '';

  const input = document.getElementById('emergency-score-pin');
  sanitizePinInput(input);
  const pin = String(input?.value || '').trim();
  if (!/^\d{6,8}$/.test(pin)) {
    showValidation('error', 'Emergency Score Viewer PIN must be 6-8 digits.');
    return null;
  }
  return pin;
}

function attachEmergencyScorePin(data, pin) {
  if (!data || typeof data !== 'object') return;
  if (/^\d{6,8}$/.test(String(pin || ''))) {
    data.emergencyScorePin = String(pin);
  } else {
    delete data.emergencyScorePin;
  }
}

function hasEmergencyScorePin() {
  return /^\d{6,8}$/.test(String(currentTestData?.emergencyScorePin || ''));
}

function readWritingSpeedTimerPinConfig() {
  const enabled = document.getElementById('writing-speed-timer-enabled')?.checked;
  if (!enabled) return '';

  const input = document.getElementById('writing-speed-timer-pin');
  sanitizePinInput(input);
  const pin = String(input?.value || '').trim();
  if (!/^\d{6,8}$/.test(pin)) {
    showValidation('error', 'Writing Timer Speed-up PIN must be 6-8 digits.');
    return null;
  }
  return pin;
}

function hasWritingSpeedTimerPin() {
  return /^\d{6,8}$/.test(String(currentWritingTestData?.speedTimerPin || ''));
}

function openEmergencyScoreModal() {
  if (emergencyScoreLocked) {
    notify('warning', 'Emergency Score Viewer is disabled for this session.');
    syncOptionsMenuState();
    return;
  }
  if (!hasEmergencyScorePin()) {
    notify('warning', 'Emergency Score Viewer is not enabled for this test.');
    return;
  }

  closeOptionsMenu();
  const modal = document.getElementById('emergency-score-modal');
  const input = document.getElementById('emergency-score-pin-check');
  const error = document.getElementById('emergency-score-error');
  const pinPanel = document.getElementById('emergency-score-pin-panel');
  const choicePanel = document.getElementById('emergency-score-choice-panel');
  const title = document.getElementById('emergency-modal-title');
  if (input) input.value = '';
  if (error) {
    error.style.display = 'none';
    const span = error.querySelector('span') || error;
    span.textContent = '';
  }
  if (pinPanel) pinPanel.style.display = 'block';
  if (choicePanel) choicePanel.style.display = 'none';
  if (title) title.textContent = 'Check Score';
  if (modal) modal.style.display = 'flex';
  window.setTimeout(() => input?.focus(), 0);
}

function closeEmergencyScoreModal(e) {
  const isExplicitCloseButton = !!e?.currentTarget?.closest?.('.modal-close');
  if (!e || e.target === e.currentTarget || isExplicitCloseButton) {
    document.getElementById('emergency-score-modal').style.display = 'none';
  }
}

function submitEmergencyScorePin() {
  const input = document.getElementById('emergency-score-pin-check');
  const error = document.getElementById('emergency-score-error');
  sanitizePinInput(input);

  const enteredPin = String(input?.value || '').trim();
  if (enteredPin !== String(currentTestData?.emergencyScorePin || '')) {
    emergencyScoreFailedAttempts += 1;
    if (emergencyScoreFailedAttempts >= 3) {
      emergencyScoreLocked = true;
      closeEmergencyScoreModal();
      syncOptionsMenuState();
      notify('warning', 'Emergency Score Viewer was disabled after 3 incorrect PIN attempts.');
      return;
    }
    if (error) {
      const msg = `Incorrect PIN. ${3 - emergencyScoreFailedAttempts} attempt${3 - emergencyScoreFailedAttempts === 1 ? '' : 's'} remaining.`;
      const span = error.querySelector('span') || error;
      span.textContent = msg;
      error.style.display = 'flex';
    }
    return;
  }

  const snapshot = Renderer.getScoreSnapshot?.();
  if (!snapshot?.hasAnswerKey) {
    if (error) {
      const span = error.querySelector('span') || error;
      span.textContent = 'No answer key is available for this test.';
      error.style.display = 'flex';
    }
    return;
  }

  const pinPanel = document.getElementById('emergency-score-pin-panel');
  const choicePanel = document.getElementById('emergency-score-choice-panel');
  const title = document.getElementById('emergency-modal-title');
  if (pinPanel) pinPanel.style.display = 'none';
  if (choicePanel) choicePanel.style.display = 'block';
  if (title) title.textContent = 'Emergency Options';
}

function applyEmergencyAction(action) {
  if (action === 'stop_timer') {
    Renderer.pauseTimer?.();
    Renderer.lockAnswers?.();
    stopSessionIntegrity();
    closeEmergencyScoreModal();
    notify('success', 'Timer has been stopped. Your answers are now locked.');
  } else if (action === 'stop_timer_and_check') {
    closeEmergencyScoreModal();
    Renderer.checkAnswers?.();
  }
}


function openWritingSpeedTimerModal() {
  if (writingSpeedTimerLocked || writingSpeedTimerUsed) {
    syncOptionsMenuState();
    notify('warning', 'Timer speed-up is no longer available for this session.');
    return;
  }
  if (!hasWritingSpeedTimerPin()) {
    notify('warning', 'Timer speed-up is not enabled for this writing test.');
    return;
  }

  closeOptionsMenu();
  const modal = document.getElementById('writing-speed-timer-modal');
  const input = document.getElementById('writing-speed-pin-check');
  const error = document.getElementById('writing-speed-error');
  const pinPanel = document.getElementById('writing-speed-pin-panel');
  const choicePanel = document.getElementById('writing-speed-choice-panel');
  if (input) input.value = '';
  if (error) {
    error.style.display = 'none';
    const span = error.querySelector('span') || error;
    span.textContent = '';
  }
  if (pinPanel) pinPanel.style.display = 'block';
  if (choicePanel) choicePanel.style.display = 'none';
  if (modal) modal.style.display = 'flex';
  window.setTimeout(() => input?.focus(), 0);
}

function closeWritingSpeedTimerModal(e) {
  const isExplicitCloseButton = !!e?.currentTarget?.closest?.('.modal-close');
  if (!e || e.target === e.currentTarget || isExplicitCloseButton) {
    document.getElementById('writing-speed-timer-modal').style.display = 'none';
  }
}

function submitWritingSpeedTimerPin() {
  const input = document.getElementById('writing-speed-pin-check');
  const error = document.getElementById('writing-speed-error');
  sanitizePinInput(input);

  const enteredPin = String(input?.value || '').trim();
  if (enteredPin !== String(currentWritingTestData?.speedTimerPin || '')) {
    writingSpeedTimerFailedAttempts += 1;
    if (writingSpeedTimerFailedAttempts >= 3) {
      writingSpeedTimerLocked = true;
      closeWritingSpeedTimerModal();
      syncOptionsMenuState();
      notify('warning', 'Writing timer speed-up was disabled after 3 incorrect PIN attempts.');
      return;
    }
    if (error) {
      const msg = `Incorrect PIN. ${3 - writingSpeedTimerFailedAttempts} attempt${3 - writingSpeedTimerFailedAttempts === 1 ? '' : 's'} remaining.`;
      const span = error.querySelector('span') || error;
      span.textContent = msg;
      error.style.display = 'flex';
    }
    return;
  }

  document.getElementById('writing-speed-pin-panel').style.display = 'none';
  document.getElementById('writing-speed-choice-panel').style.display = 'block';
}

function applyWritingTimerSpeed(multiplier) {
  const value = Number(multiplier);
  if (![3, 5, 10, 20, 30].includes(value) || writingSpeedTimerUsed || writingSpeedTimerLocked) return;
  writingTimerSpeedMultiplier = value;
  lastWritingTimerTickAt = Date.now();
  writingSpeedTimerUsed = true;
  restartWritingTimerInterval();
  closeWritingSpeedTimerModal();
  syncOptionsMenuState();
  notify('success', `Writing timer is now running ${value}x faster.`);
}

// ── Load Shared ──
function closeResultModal(e) {
  if (!e || e.target === e.currentTarget) {
    document.getElementById('result-modal').style.display = 'none';
  }
}

function buildScoreboardWarningMessage() {
  const resultMessages = [];
  if (currentTestData?.answerKeySource === 'generated') {
    resultMessages.push('No answer key was detected in the raw text, so the answers were generated from the passage automatically.');
  } else if (currentTestData?.answerKeySource === 'missing') {
    resultMessages.push('No answer key was detected in the raw text, and automatic answer-key generation did not return usable answers.');
  }

  if (sessionIntegrity.leftTestInterfaceCount > 0) {
    resultMessages.push(`btw i noticed that you left the page ${sessionIntegrity.leftTestInterfaceCount} times. so... maybe this score was heavily buffed.`);
  }

  return resultMessages.join('\n\n');
}

function toggleOpenRouterModelRow(rowId, providerValue) {
  const row = document.getElementById(rowId);
  if (row) row.style.display = providerValue === 'openrouter' ? '' : 'none';
}

function toggleReadingActionMenu() {
  const menu = document.getElementById('reading-action-menu');
  if (!menu) return;

  const isVisible = menu.style.display === 'block';
  menu.style.display = isVisible ? 'none' : 'block';

  // Close menu when clicking outside
  if (!isVisible) {
    document.addEventListener('click', function closeMenuOnClickOutside(e) {
      const wrapper = document.querySelector('.action-dropdown-wrapper');
      if (wrapper && !wrapper.contains(e.target)) {
        menu.style.display = 'none';
        document.removeEventListener('click', closeMenuOnClickOutside);
      }
    });
  }
}

async function handleParse() {
  const rawText = document.getElementById('raw-input').value.trim();
  const provider = document.getElementById('ai-provider').value;
  const apiKey = document.getElementById('api-key').value.trim();
  const autoGenerateAnswerKey = document.getElementById('auto-answer-key')?.checked !== false;
  const openrouterModel = provider === 'openrouter'
    ? (document.getElementById('openrouter-model')?.value || 'deepseek/deepseek-chat-v3-0324:free')
    : undefined;

  hideValidation();
  const emergencyScorePin = readEmergencyScorePinConfig();
  if (emergencyScorePin === null) return;

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
  setLoadingMessage('AI is parsing your IELTS text...');
  try {
    const parsed = await Parser.parse(rawText, provider, apiKey, { autoGenerateAnswerKey, openrouterModel });
    attachDiagramImages(parsed);
    attachEmergencyScorePin(parsed, emergencyScorePin);
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

async function handleDemo() {
  hideValidation();

  toggleLoading(true);
  setLoadingMessage('Loading the demo test...');
  try {
    const response = await fetch('./sample-data.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to load the demo test.');
    }
    const data = await response.json();
    attachEmergencyScorePin(data, '000000');
    const schemaCheck = Validator.validateSchema(data);
    if (!schemaCheck.valid) {
      showValidation('error', schemaCheck.errors.join('\n'));
      return;
    }
    showTest(data);
  } catch (error) {
    showValidation('error', error.message || 'Failed to load the demo test.');
  } finally {
    toggleLoading(false);
    setLoadingMessage('AI is parsing your IELTS text...');
  }
}

function setTestShellMode(mode) {
  const isWriting = mode === 'writing';
  const isCreator = mode === 'creator';
  const testView = document.getElementById('test-view');
  if (testView) {
    testView.classList.toggle('writing-active', isWriting);
    testView.classList.toggle('creator-active', isCreator);
  }

  document.querySelectorAll('.reading-test-section').forEach((el) => {
    el.style.display = isWriting ? 'none' : '';
  });
  document.querySelectorAll('.writing-test-section').forEach((el) => {
    el.style.display = isWriting ? 'flex' : 'none';
  });

  const shareButton = document.getElementById('share-test-button');
  if (shareButton) shareButton.style.display = '';
}

function showTest(data) {
  activePracticeMode = 'reading';
  currentTestData = data;
  resultHasBeenDisplayed = false;
  emergencyScoreLocked = false;
  emergencyScoreFailedAttempts = 0;
  resetSessionIntegrity();
  stopWritingTimer();
  setTestShellMode('reading');
  restoreReadingToolbar();
  closeOptionsMenu();
  syncOptionsMenuState();
  document.getElementById('input-view').style.display = 'none';
  document.getElementById('test-view').style.display = 'flex';
  Renderer.render(data);
}

function restoreReadingToolbar() {
  const toolbar = document.querySelector('#passage-panel .passage-toolbar');
  if (!toolbar) return;
  toolbar.innerHTML = `
    <button class="help-btn" type="button" onclick="Renderer.clearAnnotations()">Clear</button>
    <button class="help-btn" type="button">Help</button>
  `;
}

function openReadingCreator() {
  activePracticeMode = 'creator';
  currentTestData = null;
  resultHasBeenDisplayed = false;
  creatorDirty = false;
  creatorCurrentPartIndex = 0;
  creatorState = createBlankCreatorState();
  resetSessionIntegrity();
  stopSessionIntegrity();
  stopWritingTimer();
  Renderer.stopTimer?.();
  setTestShellMode('creator');
  closeOptionsMenu();
  document.getElementById('input-view').style.display = 'none';
  document.getElementById('test-view').style.display = 'flex';
  const timer = document.getElementById('timer-display');
  if (timer) timer.textContent = 'Creator Panel';
  const partLabel = document.getElementById('part-label');
  const partInstruction = document.getElementById('part-instruction');
  if (partLabel) partLabel.textContent = 'Creator';
  if (partInstruction) partInstruction.textContent = 'Build a Reading test manually. No tokens were harmed.';
  renderCreatorPanel();
}

function createBlankCreatorState() {
  return {
    parts: [createCreatorPart(1)],
    answerKey: {},
    answerKeySource: 'detected'
  };
}

function createCreatorPart(partNumber) {
  return {
    partNumber,
    passage: {
      title: `Untitled Reading Passage ${partNumber}`,
      sections: [{ heading: 'A', paragraphs: [''], questionMarker: null }]
    },
    questionGroups: []
  };
}

function getCreatorPart() {
  return creatorState?.parts?.[creatorCurrentPartIndex] || null;
}

function creatorNumberToRoman(value) {
  const map = [
    ['m', 1000], ['cm', 900], ['d', 500], ['cd', 400],
    ['c', 100], ['xc', 90], ['l', 50], ['xl', 40],
    ['x', 10], ['ix', 9], ['v', 5], ['iv', 4], ['i', 1]
  ];
  let num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return String(value || '');
  let out = '';
  for (const [roman, amount] of map) {
    while (num >= amount) {
      out += roman;
      num -= amount;
    }
  }
  return out;
}

function cleanCreatorOptionLabel(value) {
  return String(value || '')
    .trim()
    .replace(/^[A-Z][\.)]\s+/, '')
    .replace(/^[ivxlcdm]+[\.)]\s+/i, '')
    .trim();
}

function creatorAllSectionsLabelled(part = getCreatorPart()) {
  const sections = part?.passage?.sections || [];
  return sections.every(section => {
    const heading = String(section.heading || '').trim();
    return /^[A-J]$/i.test(heading);
  });
}

function getCreatorSectionChoices(part = getCreatorPart()) {
  const sections = part?.passage?.sections || [];
  return sections.slice(0, CREATOR_LIMITS.maxSections).map((section, index) => {
    const fallback = String.fromCharCode(65 + index);
    const heading = String(section.heading || '').trim();
    return /^[A-J]$/i.test(heading) ? heading.toUpperCase() : fallback;
  });
}

function getCreatorQuestionNumbersForGroup(group) {
  const nums = [];
  if (group?.type === 'summary_completion' || group?.type === 'note_completion') {
    String(group.summaryText || '').replace(/_{3,}(\d+)_{3,}/g, (_, n) => { nums.push(Number(n)); });
  } else if (group?.type === 'table_completion') {
    (group.tableRows || []).forEach(row => {
      row.forEach(cell => {
        String(cell || '').replace(/_{3,}(\d+)_{3,}/g, (_, n) => { nums.push(Number(n)); });
      });
    });
  } else if (group?.type === 'flowchart_completion') {
    (group.questions || []).forEach(node => {
      String(node.statement || node.text || '').replace(/_{3,}(\d+)_{3,}/g, (_, n) => { nums.push(Number(n)); });
    });
  } else {
    for (const q of (group?.questions || [])) {
      const label = q.numbers || q.number;
      const parsed = parseCreatorRange(label);
      if (parsed) nums.push(...parsed.numbers);
      else if (Number.isFinite(Number(label))) nums.push(Number(label));
    }
  }
  if (!nums.length && group?.questionRange) nums.push(...getQuestionNumbersFromRange(group?.questionRange));
  return Array.from(new Set(nums.filter(n => Number.isInteger(n) && n >= 1 && n <= 40))).sort((a, b) => a - b);
}

function getCreatorPartQuestionCount(part = getCreatorPart()) {
  return (part?.questionGroups || []).reduce((sum, group) => sum + getCreatorQuestionNumbersForGroup(group).length, 0);
}

function getCreatorNextQuestionNumber(part = getCreatorPart()) {
  const used = new Set((part?.questionGroups || []).flatMap(group => getCreatorQuestionNumbersForGroup(group)));
  for (let num = 1; num <= 40; num++) {
    if (!used.has(num)) return num;
  }
  return null;
}

function combineCreatorNumberList(numbers) {
  const nums = Array.from(new Set((numbers || []).map(Number).filter(n => Number.isInteger(n)))).sort((a, b) => a - b);
  if (!nums.length) return '';
  return nums.length === 1 ? String(nums[0]) : `${nums[0]}-${nums[nums.length - 1]}`;
}

function syncCreatorGroupRangeFromQuestions(group) {
  if (!group) return '';
  const label = combineCreatorNumberList(getCreatorQuestionNumbersForGroup(group));
  group.questionRange = label;
  return label;
}

function getCreatorDisplayRange(group) {
  const label = group?.questionRange || combineCreatorNumberList(getCreatorQuestionNumbersForGroup(group));
  return label ? `Q${label}` : 'Q0';
}

function syncCreatorDynamicOptions(part = getCreatorPart()) {
  if (!part) return;
  const sectionChoices = getCreatorSectionChoices(part);
  for (const group of (part.questionGroups || [])) {
    if (group.type === 'matching_information') {
      group.options = sectionChoices.slice();
    }
    if (group.type === 'heading_match') {
      for (const q of (group.questions || [])) {
        if (!sectionChoices.includes(q.section)) q.section = sectionChoices[0] || 'A';
      }
    }
  }
}

function creatorPreserveCaret(actionFn) {
  const activeEl = document.activeElement;
  let inputFocusInfo = null;
  let markerInserted = false;
  let activeEditable = null;

  if (activeEl) {
    if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') {
      const card = activeEl.closest('.creator-qs-card');
      const cardIndex = card ? card.getAttribute('data-qs-index') : null;
      if (cardIndex !== null) {
        const inputs = Array.from(card.querySelectorAll('input, textarea'));
        const elementIndex = inputs.indexOf(activeEl);
        inputFocusInfo = {
          type: 'card',
          cardIndex,
          elementIndex,
          selectionStart: activeEl.selectionStart,
          selectionEnd: activeEl.selectionEnd
        };
      } else {
        const allInputs = Array.from(document.querySelectorAll('input, textarea'));
        const elementIndex = allInputs.indexOf(activeEl);
        inputFocusInfo = {
          type: 'global',
          elementIndex,
          selectionStart: activeEl.selectionStart,
          selectionEnd: activeEl.selectionEnd
        };
      }
    } else {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        let node = range.startContainer;
        let isEditable = false;
        while (node) {
          if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('contenteditable') && node.getAttribute('contenteditable') === 'true') {
            isEditable = true;
            activeEditable = node;
            break;
          }
          node = node.parentNode;
        }

        if (isEditable && activeEditable) {
          try {
            const markerNode = document.createTextNode('\uE000');
            range.insertNode(markerNode);
            activeEditable.dispatchEvent(new Event('input', { bubbles: true }));
            markerInserted = true;
          } catch (err) {
            console.error('Failed to insert caret marker:', err);
          }
        }
      }
    }
  }

  actionFn();

  if (inputFocusInfo) {
    let targetInput = null;
    if (inputFocusInfo.type === 'card') {
      const card = document.querySelector(`.creator-qs-card[data-qs-index="${inputFocusInfo.cardIndex}"]`);
      if (card) {
        const inputs = Array.from(card.querySelectorAll('input, textarea'));
        targetInput = inputs[inputFocusInfo.elementIndex];
      }
    } else {
      const allInputs = Array.from(document.querySelectorAll('input, textarea'));
      targetInput = allInputs[inputFocusInfo.elementIndex];
    }

    if (targetInput) {
      try {
        targetInput.focus();
        targetInput.setSelectionRange(inputFocusInfo.selectionStart, inputFocusInfo.selectionEnd);
      } catch (e) {
        console.error('Failed to restore input focus:', e);
      }
    }
  }

  if (markerInserted) {
    const editables = document.querySelectorAll('[contenteditable="true"]');
    for (const el of editables) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let textNode = null;
      while (textNode = walker.nextNode()) {
        const idx = textNode.nodeValue.indexOf('\uE000');
        if (idx !== -1) {
          const val = textNode.nodeValue;
          textNode.nodeValue = val.substring(0, idx) + val.substring(idx + 1);
          try {
            el.focus();
            const range = document.createRange();
            const sel2 = window.getSelection();
            range.setStart(textNode, idx);
            range.setEnd(textNode, idx);
            sel2.removeAllRanges();
            sel2.addRange(range);
          } catch (e) {
            console.error('Error placing cursor:', e);
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return;
        }
      }
    }
  }
}

function renderCreatorPanel() {
  if (!creatorState) return;
  creatorPreserveCaret(() => {
    syncCreatorDynamicOptions();
    renderCreatorPassageEditor();
    renderCreatorQuestionBuilder();
    renderCreatorBottomNav();
  });
}

function renderCreatorPassageEditor() {
  const part = getCreatorPart();
  // Sync sections mode to creator toggle
  part.passage.sectionsMode = creatorShowSections;
  const el = document.getElementById('passage-content');
  const toolbar = document.querySelector('#passage-panel .passage-toolbar');

  if (toolbar) {
    toolbar.innerHTML = `
      <div class="creator-toolbar-group">
        <button class="creator-toolbar-btn ${creatorShowSections ? 'is-active' : ''}" type="button" onclick="creatorToggleSectionsMode()" title="Toggle Section Mode">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
          Toggle Sections
        </button>
        ${creatorShowSections ? `
          <button class="creator-toolbar-btn" type="button" onclick="creatorAddSection()" title="Add a new section">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            Add Section
          </button>
          <button class="creator-toolbar-btn" type="button" onmousedown="event.preventDefault()" onclick="creatorSplitSelectionIntoSection()" title="Split selected text into a new section">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><path d="M12 20v-2"/><path d="M12 6v-2"/></svg>
            Split
          </button>
        ` : ''}
      </div>
      <div style="flex:1"></div>
      <div class="creator-toolbar-group">
        <button class="creator-toolbar-btn" type="button" onclick="creatorAddPart()" title="Add a new part">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          Create Part
        </button>
        <button class="creator-toolbar-btn is-danger" type="button" onclick="creatorRemoveCurrentPart()" title="Remove the current part">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `;
  }
  if (!part || !el) return;

  let html = `
    <div class="creator-editor ${creatorShowSections ? 'show-sections' : ''}">
       <div class="creator-editor-inner">
        <div class="creator-passage-header" style="margin-bottom: 24px;">
          <input id="creator-title" class="creator-ghost-input creator-ghost-title"
            value="${escAttr(part.passage.title || '')}"
            oninput="creatorUpdateTitle(this.value)"
            placeholder="Passage Title" />

          <input id="creator-subtitle" class="creator-ghost-input creator-ghost-subtitle"
            value="${escAttr(part.passage.subtitle || '')}"
            oninput="creatorUpdateSubtitle(this.value)"
            placeholder="Passage Subtitle (optional)" />
        </div>

        <div class="creator-passage-body">`;

  part.passage.sections.forEach((section, index) => {
    // Always ensure section has a label
    if (!section.heading) section.heading = String.fromCharCode(65 + index);
    const label = section.heading;
    const sectionTextValue = escHtml((section.paragraphs || []).join('\n\n')).replace(/<br>/g, '\n');

    html += `
      <div class="creator-passage-section group" data-section-index="${index}">
        <div class="creator-section-marker-wrap">
          <div class="creator-section-marker">
            ${escHtml(label)}
          </div>
          <div class="creator-section-connector-line"></div>
        </div>

        <textarea class="creator-section-textarea creator-section-text"
          rows="1"
          data-section-index="${index}"
          oninput="creatorUpdateSection(${index}, this.value); this.style.height = ''; this.style.height = this.scrollHeight + 'px'"
          placeholder="Write your passage content here..."
          style="height: auto;">${sectionTextValue}</textarea>

        <div class="creator-section-side-actions">
          <button type="button" class="creator-side-btn is-danger" onmousedown="event.preventDefault()" onclick="creatorRemoveSection(${index})" title="Remove Section">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>
      </div>`;
  });

  html += '</div></div></div>';
  el.innerHTML = html;

  // Auto-resize all textareas after render
  el.querySelectorAll('.creator-section-textarea').forEach(tx => {
    tx.style.height = 'auto';
    tx.style.height = tx.scrollHeight + 'px';
  });
}

/* ── New Creator variables ── */
let creatorShowTypePicker = false;
let creatorMCQPickerOpen = false;
let creatorShowSections = false;

function creatorToggleSectionsMode() {
  const part = getCreatorPart();
  if (creatorShowSections) {
    const hasSectionBasedGroups = (part?.questionGroups || []).some(g => g.type === 'matching_information' || g.type === 'heading_match');
    if (hasSectionBasedGroups) {
      notify('error', 'Cannot turn off Section Mode because Matching Heading or Matching Information question types exist in this part.');
      return;
    }
  }

  creatorShowSections = !creatorShowSections;

  if (creatorShowSections) {
    if (part) {
      part.passage.sections.forEach((s, i) => {
        if (!s.heading) s.heading = String.fromCharCode(65 + i);
      });
    }
  }

  renderCreatorPanel();
}

function creatorShowMCQPicker() {
  creatorShowTypePicker = false;
  creatorMCQPickerOpen = true;
  renderCreatorPanel();
}

function renderCreatorQuestionBuilder() {
  const part = getCreatorPart();
  const el = document.getElementById('questions-content');
  if (!part || !el) return;

  const groupCount = part.questionGroups.length;

  let html = `
    <div class="creator-builder">
      <div class="creator-builder-header">
        <div class="creator-builder-header-left">
          <h3>
            <svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12l2 2 4-4"/></svg>
            Question Builder
          </h3>
          <p>Create and manage question sets. Each set is rendered with its own editable fields.</p>
        </div>
        ${groupCount > 0 ? `<span class="creator-questions-badge has-questions">${groupCount} set${groupCount !== 1 ? 's' : ''}</span>` : ''}
      </div>`;

  if (groupCount === 0 && !creatorShowTypePicker && !creatorMCQPickerOpen) {
    // Empty state
    html += `
      <div class="creator-empty-state">
        <div class="creator-empty-icon">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <div class="creator-empty-title">No question sets yet</div>
        <div class="creator-empty-desc">Click the button below to choose a question type and start building your IELTS reading test.</div>
        <button class="creator-btn-big" type="button" onclick="creatorShowTypePicker = true; renderCreatorPanel();">
          <svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          Create Question Set
        </button>
      </div>`;
  } else if (creatorShowTypePicker) {
    // Type picker grid
    html += `
      <div class="creator-type-picker">
        <div class="creator-type-picker-title">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          Choose a question type
        </div>
        <div class="creator-type-grid">
          ${CREATOR_TYPES.map(type => {
      const label = type === 'true_false_notgiven' ? 'true/false or yes/no' : type.replace(/_/g, ' ');
      const TYPE_ICONS = {
        'heading_match': '<path d="M6 12h12"/><path d="M6 20V4"/><path d="M18 20V4"/>',
        'multiple_choice': '<circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>',
        'true_false_notgiven': '<path d="M9 12l2 2 4-4"/><path d="M12 3l7 4v5c0 4.5-2.8 7.7-7 9-4.2-1.3-7-4.5-7-9V7l7-4z"/>',
        'yes_no_notgiven': '<path d="M9 12l2 2 4-4"/><path d="M12 3l7 4v5c0 4.5-2.8 7.7-7 9-4.2-1.3-7-4.5-7-9V7l7-4z"/>',
        'summary_completion': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
        'note_completion': '<path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"/><polygon points="18 2 22 6 12 16 8 16 8 12 18 2"/>',
        'table_completion': '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="9" x2="9" y2="21"/>',
        'flowchart_completion': '<circle cx="12" cy="5" r="3"/><circle cx="6" cy="19" r="3"/><circle cx="18" cy="19" r="3"/><line x1="10.5" y1="7.5" x2="7.5" y2="16.5"/><line x1="13.5" y1="7.5" x2="16.5" y2="16.5"/>',
        'diagram_completion': '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
        'matching_features': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
        'matching_endings': '<path d="M19.439 7.85c-.049.322-.059.648-.029.975.11 1.28.847 2.378 1.942 2.946A2 2 0 0 1 20 15h-2a2 2 0 0 0-2 2v2a2 2 0 0 1-3.864.732c-.445-1.196-1.558-1.996-2.836-1.996-1.278 0-2.391.8-2.836 1.996A2 2 0 0 1 2.561 19c-.049-.322-.059-.648-.029-.975.11-1.28.847-2.378 1.942-2.946A2 2 0 0 0 6 11.5v-2a2 2 0 0 0-2-2A2 2 0 0 1 5.864 3.732c.445 1.196 1.558 1.996 2.836 1.996 1.278 0 2.391-.8 2.836-1.996A2 2 0 0 1 15.439 4h2a2 2 0 0 1 2 2z"/>',
        'matching_information': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
        'short_answer': '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
        'sentence_completion': '<path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h10"/>',
      };
      let iconSvg = TYPE_ICONS[type] || '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>';

      // Check constraints
      let disabled = false;
      let disabledReason = '';
      const lastGroup = part.questionGroups?.[part.questionGroups.length - 1];

      // No duplicate consecutive types
      if (lastGroup && lastGroup.type === type) {
        disabled = true;
        disabledReason = ' title="Cannot create the same type consecutively. Use a different type first."';
      }

      if (type === 'matching_information' || type === 'heading_match') {
        if (!creatorShowSections) {
          disabled = true;
          disabledReason = ' title="Section Mode must be ON to use this question type"';
        } else if (type === 'matching_information' && part.questionGroups.some(g => g.type === 'matching_information')) {
          disabled = true;
          disabledReason = ' title="Only one Matching Information set per passage allowed"';
        }
      }

      const onclick = disabled ? 'return false;' : (type === 'multiple_choice' ? 'creatorShowMCQPicker()' : `creatorCreateSet('${type}')`);
      const disabledStyle = disabled ? ' style="opacity:0.5;pointer-events:none;" class="creator-type-btn disabled"' : ' class="creator-type-btn"';
      return `
              <button ${disabledStyle} type="button" onclick="${onclick}"${disabledReason}>
                <svg viewBox="0 0 24 24">${iconSvg}</svg>
                <span>${escHtml(label)}</span>
                <span class="creator-type-btn-small-label">${getSetCountLabel(type)}</span>
              </button>`;
    }).join('')}
        </div>
        <div style="margin-top:12px;text-align:center;">
          <button class="creator-mini-btn" type="button" onclick="creatorShowTypePicker = false; renderCreatorPanel();">Cancel</button>
        </div>
      </div>`;
  } else if (creatorMCQPickerOpen) {
    // Multiple-choice mode sub-picker
    html += `
      <div class="creator-type-picker">
        <div class="creator-type-picker-title">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          Choose a Multiple Choice mode
        </div>
        <div class="creator-type-grid">
          <button class="creator-type-btn" type="button" onclick="creatorCreateSet('multiple_choice','single')">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
            <span>Pick 1 out of 4</span>
            <span class="creator-type-btn-small-label">One answer each &middot; add more questions</span>
          </button>
          <button class="creator-type-btn" type="button" onclick="creatorCreateSet('multiple_choice','two')">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
            <span>Pick 2 out of 5</span>
            <span class="creator-type-btn-small-label">Fixed 2-question set</span>
          </button>
          <button class="creator-type-btn" type="button" onclick="creatorCreateSet('multiple_choice','three')">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
            <span>Pick 3 out of 7</span>
            <span class="creator-type-btn-small-label">Fixed 3-question set</span>
          </button>
        </div>
        <div style="margin-top:12px;text-align:center;">
          <button class="creator-mini-btn" type="button" onclick="creatorMCQPickerOpen = false; renderCreatorPanel();">Cancel</button>
        </div>
      </div>`;
  }

  // Question set cards
  if (groupCount > 0) {
    html += `<div class="creator-qs-list">`;
    part.questionGroups.forEach((group, index) => {
      html += renderCreatorQSCard(group, index, part);
    });
    html += `</div>`;
  }

  // "Add Another Set" button when there are existing sets
  if (groupCount > 0) {
    html += `
      <div style="margin-top:14px;text-align:center;">
        <button class="creator-btn-secondary" type="button" onclick="creatorShowTypePicker = true; renderCreatorPanel();" style="padding:10px 20px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          Add Another Set
        </button>
      </div>`;
  }

  html += `</div>`;
  el.innerHTML = html;
}

function getSetCountLabel(type) {
  if (type === 'heading_match') return 'List → Sections';
  if (type === 'multiple_choice') return 'Choose answer';
  if (type === 'true_false_notgiven') return 'T / F / NG';
  if (type === 'yes_no_notgiven') return 'Y / N / NG';
  if (type === 'summary_completion') return 'Gap-fill';
  if (type === 'matching_features') return 'Features grid';
  if (type === 'matching_endings') return 'Drag endings';
  if (type === 'matching_information') return 'Info → paragraph';
  if (type === 'sentence_completion') return 'Sentence ends';
  if (type === 'note_completion') return 'Notes';
  if (type === 'table_completion') return 'Table';
  if (type === 'flowchart_completion') return 'Flowchart';
  if (type === 'diagram_completion') return 'Label diagram';
  if (type === 'short_answer') return 'Write answer';

  return '';
}

/* ── WYSIWYG live preview for a question set ── */
function renderCreatorFlowchartBuilder(group, index) {
  let html = '<div class="flowchart-builder-container" style="display:flex; flex-direction:column; gap:20px; font-family: Arial, sans-serif;">';

  html += `
    <div class="flowchart-toolbar-redesign" style="display:flex; align-items:center; gap:10px; padding:12px 20px; background:#fff; border:1px solid #e2e8f0; border-radius:16px; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
      <button type="button" class="creator-mini-btn" style="background:#0969da; color:white; border:none; padding:8px 16px;" onclick="creatorAddFlowNode(${index})">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        Add Step
      </button>
      <button type="button" class="creator-mini-btn" style="padding:8px 16px;" onclick="creatorInsertGapAtCursor(${index}, 'flowchart')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        Insert Gap
      </button>
      <div style="flex:1"></div>
      <div style="font-size:10px; font-weight:900; color:#94a3b8; text-transform:uppercase; letter-spacing:0.1em; display:flex; align-items:center; gap:8px;">
        Flowchart Builder
        <span style="background:#f1f5f9; color:#0969da; padding:2px 8px; border-radius:4px;">${(group.questions || []).length} Steps</span>
      </div>
    </div>`;

  html += '<div class="flowchart-canvas-redesign custom-scrollbar" style="overflow-y:auto; max-height:600px;">';

  const nodes = group.questions || [];
  nodes.forEach((node, ni) => {
    const nodeColor = node.color || '#3b82f6';
    const statement = node.statement || node.text || '';
    const nodeWidth = Number(node.width || 240);
    const nodeHeight = Number(node.height || 80);
    const arrowDir = node.arrow || 'down';

    const rendered = escHtml(statement).replace(/_{3,}(\d+)_{3,}/g, (match, num) => {
      return `<span class="wysiwyg-gap-pill" contenteditable="false">${num}</span>`;
    });

    html += `
      <div class="flex flex-col items-center group" style="display:flex; flex-direction:column; align-items:center;">
        <div class="flowchart-node-redesign" style="--node-color:${nodeColor}; --node-width:${nodeWidth}px; --node-height:${nodeHeight}px;" data-node-index="${ni}">
          
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
            <span class="flowchart-node-tag">Step ${ni + 1}</span>
            <div style="display:flex; align-items:center; gap:4px;">
              <input type="color" value="${nodeColor}" onchange="creatorUpdateFlowNodeColor(${index},${ni},this.value)" style="width:16px; height:16px; border:none; padding:0; cursor:pointer; background:none;"/>
              <button type="button" class="text-slate-300 hover:text-red-500" onclick="creatorRemoveFlowNode(${index},${ni})" title="Remove Step" style="border:none; background:none; cursor:pointer; font-size:16px;">&times;</button>
            </div>
          </div>

          <div class="flowchart-node-editable creator-flowchart-node-editable wysiwyg-editable-summary" contenteditable="true"
            data-node-index="${ni}"
            oninput="creatorUpdateFlowNodeText(${index},${ni},this)"
            style="min-height:40px;">${rendered}</div>

          <!-- Controls for size -->
          <div style="position:absolute; bottom:6px; right:6px; display:flex; gap:4px; opacity:0; group-hover:opacity-100 transition:opacity 0.2s;" class="flowchart-node-resize-controls">
            <input type="number" value="${nodeWidth}" onchange="creatorUpdateFlowNodeSize(${index},${ni},'width',this.value)" style="width:35px; font-size:8px; border:1px solid #e2e8f0; border-radius:2px; padding:0 1px;"/>
            <input type="number" value="${nodeHeight}" onchange="creatorUpdateFlowNodeSize(${index},${ni},'height',this.value)" style="width:35px; font-size:8px; border:1px solid #e2e8f0; border-radius:2px; padding:0 1px;"/>
          </div>

          <!-- Move controls -->
          <div style="position:absolute; left:-30px; top:50%; transform:translateY(-50%); display:flex; flex-direction:column; gap:4px; opacity:0; group-hover:opacity-100 transition:opacity 0.2s;" class="flowchart-node-move-controls">
            <button type="button" onclick="creatorMoveFlowNode(${index},${ni},-1)" style="border:1px solid #e2e8f0; background:white; border-radius:4px; cursor:pointer;" ${ni === 0 ? 'disabled' : ''}>&uarr;</button>
            <button type="button" onclick="creatorMoveFlowNode(${index},${ni},1)" style="border:1px solid #e2e8f0; background:white; border-radius:4px; cursor:pointer;" ${ni === nodes.length - 1 ? 'disabled' : ''}>&darr;</button>
          </div>
        </div>`;

    if (ni < nodes.length - 1) {
      html += `
        <div class="flowchart-arrow-redesign">
          <div style="font-size:24px; font-weight:900; color:#cbd5e1;">${arrowDir === 'down' ? '↓' : arrowDir === 'up' ? '↑' : arrowDir === 'both' ? '↕' : '—'}</div>
          <select onchange="creatorUpdateFlowNodeArrow(${index},${ni},this.value)" style="position:absolute; left:30px; font-size:10px; border:1px solid #e2e8f0; border-radius:4px; padding:2px; color:#64748b; background:white; outline:none;">
            <option value="down" ${arrowDir === 'down' ? 'selected' : ''}>Down</option>
            <option value="up" ${arrowDir === 'up' ? 'selected' : ''}>Up</option>
            <option value="both" ${arrowDir === 'both' ? 'selected' : ''}>Both</option>
            <option value="none" ${arrowDir === 'none' ? 'selected' : ''}>None</option>
          </select>
        </div>`;
    }

    html += '</div>';
  });

  if (!nodes.length) {
    html += '<div class="creator-empty-inline">No flowchart boxes yet. Click "Add Step" to begin.</div>';
  }
  html += '</div>';

  // Answer key section for Flowchart
  const rangeNums = getCreatorQuestionNumbersForGroup(group);
  if (rangeNums.length > 0) {
    html += `
      <div style="margin-top:24px; padding:20px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
          <h3 style="font-size:11px; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:0.1em;">Answer Key Mapping</h3>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:12px;">
          ${rangeNums.map(num => {
      const ans = creatorState.answerKey?.[String(num)] || '';
      return `
              <div style="display:flex; align-items:center; gap:10px; background:white; padding:8px 12px; border-radius:10px; border:1px solid #e2e8f0;">
                <div style="width:28px; height:28px; background:#eff6ff; color:#0969da; border-radius:6px; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:11px; flex-shrink:0;">${num}</div>
                <input type="text" value="${escAttr(ans)}" onchange="creatorUpdateAnswerKey(${num}, this.value)" placeholder="Enter answer..." style="flex:1; border:none; outline:none; font-size:13px; color:#1e293b;"/>
              </div>
            `;
    }).join('')}
        </div>
      </div>`;
  }

  html += '</div>';
  return html;
}

function renderCreatorWYSIWYGPreview(group, index) {
  const type = group.type;
  let html = '<div class="creator-wysiwyg-section">';

  if (type === 'heading_match') {
    // Heading pills as editable pills
    html += '<div class="wysiwyg-heading-list" style="display:flex; flex-direction:column; gap:8px;">';
    html += '<div class="flex items-center justify-between mb-2"><h4 class="creator-qs-field-label">List of Headings</h4></div>';
    (group.headingOptions || []).forEach((opt, i) => {
      const roman = creatorNumberToRoman(i + 1);
      const cleaned = cleanCreatorOptionLabel(opt);
      html += `
        <div class="heading-pill" style="display:flex; align-items:center; gap:5px; background:#fff; padding:4px 16px; border-radius:5px; border:1px solid #eef0f3; box-shadow:0 1px 4px rgba(15,23,42,.12); margin-bottom:10px; cursor:default; width:max-content; max-width:100%;">
          <span style="font-size:1rem; font-weight:700;">${roman}.</span>
          <input class="pill-input" value="${escAttr(cleaned)}"
            onchange="creatorUpdateHeadingOption(${index},${i},this.value)"
            placeholder="Heading text…"
            style="flex:1; border:none; background:transparent; font-size:1rem; font-weight:700; color:#0f172a; outline:none; min-width:300px;"/>
          <button class="mapping-remove-btn" type="button"
            onclick="creatorRemoveHeadingOption(${index},${i})" title="Remove" style="margin-left:8px; display:flex; align-items:center; justify-content:center; background:transparent; border:none; color:#94a3b8; cursor:pointer;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>`;
    });
    html += `<button class="creator-toolbar-btn" type="button" onclick="creatorAddHeadingOption(${index})" style="margin-top:8px; border:1px dashed #e2e8f0;">+ Add Heading</button>`;
    html += '</div>';

    // Example Heading Selection
    html += '<div class="wysiwyg-example-heading" style="margin-top:20px; padding:16px; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; display:flex; flex-direction:column; gap:12px;">';
    html += '<h4 class="creator-qs-field-label" style="margin:0; font-size: 14px; font-weight:600; color:var(--text-main);">Example Heading Question</h4>';
    html += '<div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap;">';

    // Section Dropdown
    html += '<div style="display:flex; flex-direction:column; gap:4px; flex:1; min-width: 120px;">';
    html += '<span class="mapping-quest-label" style="font-size:11px; font-weight:600; text-transform:uppercase; color:var(--muted);">Example Section</span>';
    html += `<select class="creator-qs-input" style="padding:6px 8px; border-radius:6px; font-size:13px; background:white; border:1px solid #cbd5e1; outline:none; height:34px;" 
              onchange="creatorSetHeadingMatchExampleSection(${index}, this.value)">`;
    html += '<option value="">— None —</option>';
    const sectionOptions = getCreatorSectionChoices();
    sectionOptions.forEach(letter => {
      const isSelected = group.exampleSection === letter;
      html += `<option value="${letter}"${isSelected ? ' selected' : ''}>Section ${letter}</option>`;
    });
    html += '</select>';
    html += '</div>';

    // Heading Dropdown
    html += '<div style="display:flex; flex-direction:column; gap:4px; flex:2; min-width: 200px;">';
    html += '<span class="mapping-quest-label" style="font-size:11px; font-weight:600; text-transform:uppercase; color:var(--muted);">Example Heading Option</span>';
    html += `<select class="creator-qs-input" style="padding:6px 8px; border-radius:6px; font-size:13px; background:white; border:1px solid #cbd5e1; outline:none; height:34px;" 
              onchange="creatorSetHeadingMatchExampleHeading(${index}, this.value)">`;
    html += '<option value="">— None —</option>';
    (group.headingOptions || []).forEach((opt, oi) => {
      const roman = creatorNumberToRoman(oi + 1);
      const cleaned = cleanCreatorOptionLabel(opt);
      const isSelected = group.exampleHeading === cleaned;
      html += `<option value="${escAttr(cleaned)}"${isSelected ? ' selected' : ''}>${roman}. ${escHtml(cleaned)}</option>`;
    });
    html += '</select>';
    html += '</div>';

    html += '</div>';
    html += '</div>';

    // Section mapping redesign
    html += '<div class="wysiwyg-section-map" style="margin-top:24px;">';
    html += '<div class="flex items-center justify-between mb-4"><h4 class="creator-qs-field-label">Question → Section Mapping</h4></div>';

    (group.questions || []).forEach((q, i) => {
      const options = sectionOptions.length ? sectionOptions : ['A'];
      const mappedSections = new Set(
        (group.questions || [])
          .filter((_, qi) => qi !== i)
          .map(otherQ => otherQ.section)
          .filter(Boolean)
      );

      // Add a check to prevent mapping to the example section
      const exampleSec = group.exampleSection;

      html += `
        <div class="wysiwyg-section-row-redesign">
          <div class="mapping-quest-info" style="flex: 0 0 auto;">
            <span class="mapping-quest-label">Quest.</span>
            <span class="mapping-quest-num">${String(q.number).padStart(2, '0')}</span>
          </div>

          <div class="mapping-section-info" style="flex: 1 1 auto;">
            <span class="mapping-quest-label">Section</span>
            <div class="mapping-section-pills">
              ${options.map(letter => {
        const isSelected = q.section === letter;
        const isMappedByOther = mappedSections.has(letter) || (exampleSec === letter);
        return `
                  <button type="button" class="mapping-pill ${isSelected ? 'is-active' : ''}"
                    ${isMappedByOther ? 'disabled' : ''}
                    onclick="creatorUpdateSectionMapping(${index},${i},'${letter}')"
                    title="${exampleSec === letter ? 'Used as example' : (isMappedByOther ? 'Already mapped' : `Map to Section ${letter}`)}">
                    ${letter}
                  </button>`;
      }).join('')}
            </div>
          </div>

          <div class="mapping-answer-info" style="flex: 0 1 220px; display:flex; flex-direction:column; gap:4px; min-width: 140px; max-width: 220px;">
            <span class="mapping-quest-label" style="font-size:11px; font-weight:600; text-transform:uppercase; color:var(--muted);">Answer Key</span>
            <select class="creator-qs-input" style="padding:4px 8px; border-radius:6px; font-size:13px; background:white; border:1px solid #cbd5e1; outline:none; height:30px; width:100%; text-overflow:ellipsis;" 
              onchange="creatorSetHeadingMatchAnswer(${index}, ${i}, this.value)">
              <option value="">— Select Heading —</option>
              ${(group.headingOptions || []).map((opt, oi) => {
        const roman = creatorNumberToRoman(oi + 1);
        const cleaned = cleanCreatorOptionLabel(opt);
        const currentAns = creatorState?.answerKey?.[String(q.number)] || '';
        const isSelected = cleaned === cleanCreatorOptionLabel(currentAns);
        const isExample = cleaned === cleanCreatorOptionLabel(group.exampleHeading || '');
        return `<option value="${escAttr(cleaned)}"${isSelected ? ' selected' : ''}${isExample ? ' disabled' : ''}>${roman}. ${escHtml(cleaned)}${isExample ? ' (example)' : ''}</option>`;
      }).join('')}
            </select>
          </div>

          <button class="mapping-remove-btn" type="button" onclick="creatorRemoveQuestionFromSet(${index},${i})" title="Remove question" style="margin-left:8px; flex: 0 0 auto;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>`;
    });

    html += `<button class="creator-toolbar-btn" type="button" onclick="creatorAddQuestionToSet(${index})" style="margin-top:12px; border:1px dashed #e2e8f0;">+ Add Link</button>`;
    html += '</div>';

  } else if (type === 'multiple_choice') {
    const fixedSet = Number(group.selectCount || 1) > 1;
    (group.questions || []).forEach((q, qi) => {
      const numbers = fixedSet ? getCreatorQuestionNumbersForGroup(group) : [q.number];
      const correctSet = new Set(
        numbers.flatMap(n => {
          const val = creatorState?.answerKey?.[String(n)] || '';
          return val.split(',').map(s => s.trim()).filter(Boolean);
        })
      );
      html += '<div class="wysiwyg-mcq-card">';
      html += `
        <div class="wysiwyg-mcq-stem">
          <strong>${escHtml(String(q.numbers || q.number))}.</strong>
          <input value="${escAttr(q.stem || '')}"
            onchange="creatorUpdateMCQStem(${index},${qi},this.value)"
            placeholder="Question stem…"/>
          ${!fixedSet ? `<button class="creator-qs-icon-btn is-danger" type="button" onclick="creatorRemoveQuestionFromSet(${index},${qi})" title="Remove question">&times;</button>` : ''}
        </div>`;
      (q.options || []).forEach((opt, oi) => {
        const letter = String.fromCharCode(65 + oi);
        const isChecked = correctSet.has(letter);
        html += `
          <div class="wysiwyg-option-row">
            <input type="${fixedSet ? 'checkbox' : 'radio'}" ${fixedSet ? '' : `name="creator-mcq-correct-${index}-${qi}"`} ${isChecked ? 'checked' : ''} onchange="creatorToggleMCQAnswer(${index},${qi},'${letter}')" title="Mark as correct answer"/>
            <span class="opt-letter">${letter}.</span>
            <input class="opt-input" value="${escAttr(opt)}"
              onchange="creatorUpdateMCQOption(${index},${qi},${oi},this.value)"
              placeholder="Option ${letter}…"/>
          </div>`;
      });
      html += '</div>';
    });
    if (!fixedSet) {
      html += `<button class="creator-mini-btn" type="button" onclick="creatorAddQuestionToSet(${index})">+ Add question</button>`;
    }

  } else if (type === 'true_false_notgiven' || type === 'yes_no_notgiven') {
    const isYN = type === 'yes_no_notgiven';
    const choices = isYN ? ['YES', 'NO', 'NOT GIVEN'] : ['TRUE', 'FALSE', 'NOT GIVEN'];
    html += `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span class="creator-qs-field-label" style="margin:0;">Type:</span>
        <button class="creator-mini-btn${!isYN ? ' is-active' : ''}" type="button" onclick="creatorSetTFNGVariant(${index},false)">True / False / NG</button>
        <button class="creator-mini-btn${isYN ? ' is-active' : ''}" type="button" onclick="creatorSetTFNGVariant(${index},true)">Yes / No / NG</button>
      </div>`;
    (group.questions || []).forEach((q, qi) => {
      const currentAnswer = String(creatorState?.answerKey?.[String(q.number)] || '').toUpperCase();
      html += '<div class="wysiwyg-tfng-item">';
      html += `
        <div class="wysiwyg-tfng-stem">
          <strong>${escHtml(String(q.number))}.</strong>
          <input value="${escAttr(q.statement || '')}"
            onchange="creatorUpdateTFNGStatement(${index},${qi},this.value)"
            placeholder="Enter statement…"/>
          <button class="creator-qs-icon-btn is-danger" type="button" onclick="creatorRemoveQuestionFromSet(${index},${qi})" title="Remove question">&times;</button>
        </div>
        <div class="wysiwyg-tfng-choices">
          ${choices.map(c => `<label><input type="radio" name="creator-tfng-${index}-${qi}" ${currentAnswer === c ? 'checked' : ''} onchange="creatorSetTFNGAnswer(${index},${qi},'${c}')"/> ${c}</label>`).join('')}
        </div>`;
      html += '</div>';
    });
    html += `<button class="creator-mini-btn" type="button" onclick="creatorAddQuestionToSet(${index})">+ Add question</button>`;

  } else if (type === 'summary_completion' || type === 'note_completion') {
    const isNote = type === 'note_completion';
    // Summary/Note heading editor
    html += `<div style="margin-bottom:12px;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
        <span style="font-size:.75rem; font-weight:700; text-transform:uppercase; color:var(--muted); letter-spacing:.04em;">${isNote ? 'Note' : 'Summary'} Heading</span>
        ${group.summaryHeading ? `<button class="creator-mini-btn is-danger" type="button" onclick="creatorSetSummaryHeading(${index},'')" title="Remove heading" style="padding:2px 6px; font-size:.75rem;">✕ Remove</button>` : ''}
      </div>
      <input class="creator-qs-input" value="${escAttr(group.summaryHeading || '')}"
        oninput="creatorSetSummaryHeading(${index},this.value)"
        placeholder="Optional heading (e.g. ${isNote ? 'Impact of climate change' : 'Summary of Paragraph A'})…"
        style="width:100%; padding:10px 12px; border:1px solid #e2e8f0; border-radius:10px; font-size:.88rem; background:white;"/>
    </div>`;

    // Word bank pills
    if (group.options && group.options.length) {
      html += '<div class="wysiwyg-wordbank" style="margin-bottom:12px; padding:12px; background:#f8fafc; border-radius:10px; border:1px solid #f1f5f9;">';
      html += '<div style="font-size:.7rem; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:8px;">Word Bank</div>';
      html += '<div style="display:flex; flex-wrap:wrap; gap:8px;">';
      (group.options || []).forEach((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        html += `
          <div class="wysiwyg-wordbank-pill" style="display:flex; align-items:center; gap:6px; background:white; padding:4px 10px; border-radius:8px; border:1px solid #e2e8f0;">
            <span style="font-weight:800;color:var(--accent);font-size:.82rem;">${letter}</span>
            <input class="pill-input" value="${escAttr(opt)}"
              onchange="creatorUpdateWordBankOption(${index},${i},this.value)"
              placeholder="word…"
              style="border:none; outline:none; background:transparent; font-size:.84rem; width:80px;"/>
            <button class="pill-remove" type="button" onclick="creatorRemoveWordBankOption(${index},${i})" title="Remove" style="color:#ef4444; border:none; background:none; cursor:pointer; font-weight:bold;">&times;</button>
          </div>`;
      });
      html += `<button class="creator-mini-btn" type="button" onclick="creatorAddWordBankOption(${index})" style="border:1px dashed #cbd5e1;">+ Word</button>`;
      html += '</div></div>';
    }

    // Main text editor with gaps
    html += '<div class="wysiwyg-summary-wrap" style="position:relative; background:white; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">';
    html += `
      <div style="padding:8px 12px; background:#f8fafc; border-bottom:1px solid #f1f5f9; display:flex; gap:8px; align-items:center;">
        <button class="creator-mini-btn" type="button" onmousedown="event.preventDefault()" onclick="creatorInsertGapAtCursor(${index}, 'summary')" title="Insert a numbered gap at the cursor">+ Gap</button>
        <button class="creator-mini-btn" type="button" onmousedown="event.preventDefault()" onclick="creatorAddSummarySubheading(${index})" title="Add a subheading">+ Subheading</button>
        <button class="creator-mini-btn" type="button" onmousedown="event.preventDefault()" onclick="creatorAddSummaryBullet(${index})" title="Add a bullet point">+ Bullet</button>
        <div style="flex:1"></div>
        <button class="creator-mini-btn" type="button" onclick="creatorAddWordBankOption(${index})" title="Add a word bank options list">${group.options && group.options.length ? '✓ Word Bank' : '+ Word Bank'}</button>
      </div>`;

    const textToRender = isNote ? (group.noteText || group.summaryText || '') : (group.summaryText || '');
    const renderedText = escHtml(textToRender).replace(/_{3,}(\d+)_{3,}/g, (match, num) => {
      return `&#8203;<span class="wysiwyg-gap-inline" contenteditable="false"><span class="gap-num">${num}</span></span>&#8203;`;
    });

    html += `<div class="wysiwyg-editable-summary" contenteditable="true"
      oninput="creatorUpdateSummaryText(${index},this)"
      style="white-space:pre-wrap; line-height:2.2; min-height:100px; padding:16px; outline:none; font-size:.9rem; color:#334155;"
      placeholder="${isNote ? 'Start typing your notes here...' : 'Type your summary text here...'}">${renderedText}</div>`;

    // Gap/Answer indicators
    const range = parseCreatorRange(group.questionRange);
    if (range && range.numbers.length > 0) {
      const hasWordBank = group.options && group.options.length > 0;
      html += '<div style="background:#fcfdfd; border-top:1px solid #f1f5f9; padding:12px 16px;">';
      html += '<span style="font-size:.7rem; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; display:block; margin-bottom:10px;">Answer Key</span>';
      html += '<div style="display:flex; flex-direction:column; gap:10px;">';
      range.numbers.forEach(num => {
        const currentAnswer = creatorState?.answerKey?.[String(num)] || '';
        if (hasWordBank) {
          // Show pill-based answer selection (like heading match) when word bank exists
          html += `<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span class="wysiwyg-gap-inline" style="padding:1px 8px; min-width:32px; flex-shrink:0; cursor:default;"><span class="gap-num">${num}</span></span>
            <span style="font-size:.75rem; font-weight:600; color:var(--muted); white-space:nowrap;">Correct option:</span>
            ${(group.options || []).map((opt, oi) => {
            const letter = String.fromCharCode(65 + oi);
            const optText = String(opt || '').replace(/^[A-Z][.)]\s+/, '');
            const isSelected = currentAnswer === letter;
            return `<button type="button" class="mapping-pill${isSelected ? ' is-active' : ''}"
                onclick="creatorUpdateAnswerKey(${num},'${letter}')"
                title="${escAttr(optText)}"
                style="font-size:.8rem; padding:3px 10px;">${letter}</button>`;
          }).join('')}
            ${currentAnswer ? `<span style="font-size:.78rem; color:#16a34a; font-weight:600;">✓ ${escHtml(currentAnswer)}. ${escHtml((group.options[currentAnswer.charCodeAt(0) - 65] || '').replace(/^[A-Z][.)]\s+/, '').substring(0, 40))}</span>` : ''}
          </div>`;
        } else {
          html += `<div style="display:flex; align-items:center; gap:10px;">
            <span class="wysiwyg-gap-inline" style="padding:1px 8px; min-width:32px; flex-shrink:0; cursor:default;"><span class="gap-num">${num}</span></span>
            <input type="text" value="${escAttr(currentAnswer)}" placeholder="Correct answer…"
              onchange="creatorUpdateAnswerKey(${num}, this.value)"
              style="flex:1; padding:6px 10px; border:1px solid #d1d5db; border-radius:8px; font-size:.85rem; background:white; outline:none; transition:border-color 0.2s;"/>
          </div>`;
        }
      });
      html += '</div></div>';
    }
    html += '</div>';

  } else if (type === 'table_completion') {
    const headers = group.tableHeaders || ['Notes', 'Details'];
    const rows = group.tableRows || [];
    const colWidths = group.tableColumnWidths || headers.map(() => 0); // 0 means auto
    const rowHeights = group.tableRowHeights || rows.map(() => 0);

    html += `
      <div class="creator-table-toolbar-redesign" style="display:flex; flex-direction:column; gap:6px; padding:10px 12px; background:#fff; border:1px solid #e2e8f0; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.04); margin-bottom:8px;">
        <!-- Row 1: Structure -->
        <div style="display:flex; align-items:center; gap:5px;">
          <button type="button" class="creator-mini-btn" onclick="creatorAddTableRow(${index})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            Add Row
          </button>
          <button type="button" class="creator-mini-btn" onclick="creatorAddTableColumn(${index})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            Add Col
          </button>
          <button type="button" class="creator-mini-btn" onmousedown="event.preventDefault()" onclick="creatorDeleteCurrentTableRow(${index})" style="color:#ef4444;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>
            Del Row
          </button>
          <button type="button" class="creator-mini-btn" onmousedown="event.preventDefault()" onclick="creatorDeleteCurrentTableColumn(${index})" style="color:#ef4444;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="12" y1="5" x2="12" y2="19"/></svg>
            Del Col
          </button>
          <div style="width:1px; height:18px; background:#e2e8f0; margin:0 3px;"></div>
          <button type="button" class="creator-mini-btn" style="background:#0969da; color:white; border:none;" onmousedown="event.preventDefault()" onclick="creatorInsertGapAtCursor(${index}, 'table')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            Insert Gap
          </button>
        </div>

        <div style="height:1px; background:#f1f5f9;"></div>

        <!-- Row 2: Cell formatting (icon-only) -->
        <div style="display:flex; align-items:center; gap:3px;">
          <button type="button" class="creator-mini-btn" onmousedown="event.preventDefault()" onclick="creatorToolbarAction(${index}, 'bold')" title="Bold" style="width:26px;height:26px;padding:0;display:flex;align-items:center;justify-content:center;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 12a4 4 0 0 0 0-8H6v8"/><path d="M15 20a4 4 0 0 0 0-8H6v8Z"/></svg>
          </button>
          <button type="button" class="creator-mini-btn" onmousedown="event.preventDefault()" onclick="creatorToolbarAction(${index}, 'italic')" title="Italic" style="width:26px;height:26px;padding:0;display:flex;align-items:center;justify-content:center;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>
          </button>
          <button type="button" class="creator-mini-btn" onmousedown="event.preventDefault()" onclick="creatorToolbarAction(${index}, 'bullet')" title="Bullet List" style="width:26px;height:26px;padding:0;display:flex;align-items:center;justify-content:center;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
          </button>
          <button type="button" class="creator-mini-btn" onmousedown="event.preventDefault()" onclick="creatorToolbarAction(${index}, 'subheading')" title="Subheading" style="width:26px;height:26px;padding:0;display:flex;align-items:center;justify-content:center;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8M4 18V6M12 18V6"/><text x="14" y="17" font-family="Segoe UI, sans-serif" font-size="9" font-weight="bold" fill="currentColor" stroke="none">3</text></svg>
          </button>
          <div style="width:1px; height:18px; background:#e2e8f0; margin:0 2px;"></div>
          <button type="button" class="creator-mini-btn" onmousedown="event.preventDefault()" onclick="creatorToolbarAction(${index}, 'align', 'left')" title="Align Left" style="width:26px;height:26px;padding:0;display:flex;align-items:center;justify-content:center;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="17" x2="3" y1="10" y2="10"/><line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="3" y1="18" y2="18"/><line x1="17" x2="3" y1="14" y2="14"/></svg>
          </button>
          <button type="button" class="creator-mini-btn" onmousedown="event.preventDefault()" onclick="creatorToolbarAction(${index}, 'align', 'center')" title="Align Center" style="width:26px;height:26px;padding:0;display:flex;align-items:center;justify-content:center;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="10" y2="10"/><line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="3" y1="18" y2="18"/><line x1="18" x2="6" y1="14" y2="14"/></svg>
          </button>
          <div style="width:1px; height:18px; background:#e2e8f0; margin:0 2px;"></div>
          <button type="button" class="creator-mini-btn" onmousedown="event.preventDefault()" onclick="creatorToolbarAction(${index}, 'merge-right')" title="Merge Right" style="width:26px;height:26px;padding:0;display:flex;align-items:center;justify-content:center;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/><path d="m14 9 3 3-3 3"/></svg>
          </button>
          <button type="button" class="creator-mini-btn" onmousedown="event.preventDefault()" onclick="creatorToolbarAction(${index}, 'merge-down')" title="Merge Down" style="width:26px;height:26px;padding:0;display:flex;align-items:center;justify-content:center;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 12h14"/><path d="m9 14 3 3 3-3"/></svg>
          </button>
          <button type="button" class="creator-mini-btn" onmousedown="event.preventDefault()" onclick="creatorToolbarAction(${index}, 'split')" title="Split Merged Cell" style="width:26px;height:26px;padding:0;display:flex;align-items:center;justify-content:center;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14" stroke-dasharray="3 3"/><path d="m10 12-2-2 2-2"/><path d="m14 12 2-2-2-2"/></svg>
          </button>
        </div>

      </div>`;

    html += '<div class="wysiwyg-table-wrap-redesign custom-scrollbar" style="overflow-x:auto;">';
    html += '<table class="wysiwyg-table-redesign">';
    html += '<colgroup>';
    headers.forEach((h, hi) => {
      const w = colWidths[hi] ? `${colWidths[hi]}px` : 'auto';
      html += `<col style="width:${w};">`;
    });
    html += '</colgroup>';

    html += '<thead><tr>';
    headers.forEach((h, hi) => {
      html += `
        <th style="position:relative; font-family: Arial, sans-serif;">
          <div style="display:flex; align-items:center; gap:8px;">
            <input value="${escAttr(h)}"
              onchange="creatorUpdateTableHeader(${index},${hi},this.value)"
              placeholder="Header..."
              style="flex:1; border:none; background:transparent; font:inherit; font-weight:900; color:inherit; outline:none;"/>
          </div>
          <div class="creator-table-col-handle" onmousedown="creatorStartTableColResize(event, ${index}, ${hi})"></div>
        </th>`;
    });
    html += '</tr></thead><tbody>';

    rows.forEach((row, ri) => {
      const h = rowHeights[ri] ? `${rowHeights[ri]}px` : 'auto';
      html += `<tr style="height:${h}; background: white;">`;
      headers.forEach((h, ci) => {
        if (creatorIsCellCovered(group, ri, ci)) return;

        const cell = row[ci] || '';
        const style = group.tableCellStyles?.[`${ri}-${ci}`] || {};
        const cellStyle = [
          `text-align:${style.align || 'left'}`,
          style.bold ? 'font-weight:700' : '',
          style.italic ? 'font-style:italic' : '',
          style.bg ? `background:${style.bg}` : '',
          'font-family: Arial, sans-serif'
        ].filter(Boolean).join(';');

        const merge = group.tableCellMerge?.[`${ri}-${ci}`];
        const colspanAttr = merge ? ` colspan="${merge.colspan}"` : '';
        const rowspanAttr = merge ? ` rowspan="${merge.rowspan}"` : '';

        const rendered = escHtml(cell).replace(/_{3,}(\d+)_{3,}/g, (match, num) => {
          return `<span class="wysiwyg-gap-pill" contenteditable="false">${num}</span>`;
        });

        html += `
          <td style="${cellStyle};"${colspanAttr}${rowspanAttr}>
            <div class="creator-table-cell-editable-redesign" contenteditable="true"
              data-row="${ri}" data-cell="${ci}"
              oninput="creatorUpdateTableCell(${index},${ri},${ci},this)"
              onfocus="creatorActiveTableCell = { index: ${index}, ri: ${ri}, ci: ${ci} }"
              placeholder="Cell content...">${rendered}</div>
          </td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    html += '</div>';

    if (!rows.length) {
      html += '<div class="creator-empty-inline" style="margin-top:16px;">This table is empty. Click "Add Row" to begin.</div>';
    }

    // Answer Key Section for Table
    const rangeNums = getCreatorQuestionNumbersForGroup(group);
    if (rangeNums.length > 0) {
      html += `
        <div style="margin-top:24px; padding:20px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
            <svg class="text-[#64748b]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            <h3 style="font-size:11px; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:0.1em;">Answer Key</h3>
          </div>
          <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:12px;">
            ${rangeNums.map(num => {
        const ans = creatorState.answerKey?.[String(num)] || '';
        return `
                <div style="display:flex; align-items:center; gap:10px; background:white; padding:8px 12px; border-radius:10px; border:1px solid #e2e8f0; transition:all 0.2s;" onfocuswithin="this.style.borderColor='#0969da'; this.style.boxShadow='0 0 0 3px rgba(9,105,218,0.05)'" onfocusout="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'">
                  <div style="width:28px; height:28px; background:#eff6ff; color:#0969da; border-radius:6px; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:11px; flex-shrink:0;">${num}</div>
                  <input type="text" value="${escAttr(ans)}" onchange="creatorUpdateAnswerKey(${num}, this.value)" placeholder="Enter answer..." style="flex:1; border:none; outline:none; font-size:13px; color:#1e293b;"/>
                </div>
              `;
      }).join('')}
          </div>
        </div>`;
    }
  } else if (type === 'flowchart_completion') {
    html += renderCreatorFlowchartBuilder(group, index);

  } else if (type === 'diagram_completion') {
    html += '<div style="margin-bottom:16px; display:flex; flex-direction:column; gap:20px; font-family: Arial, sans-serif;">';

    // Image section
    html += `
      <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:16px;">
        <label style="font-size:10px; font-weight:900; text-transform:uppercase; color:var(--muted); display:block; margin-bottom:12px; letter-spacing:0.1em;">1. Diagram Image</label>
        ${group.diagramImage ? `
          <div style="position:relative; margin-bottom:12px; display:inline-block;">
            <img src="${escAttr(group.diagramImage)}" alt="Diagram preview" style="max-width:100%; max-height:300px; border-radius:8px; border:1px solid #f1f5f9;"/>
            <button type="button" onclick="creatorUpdateSetDiagram(${index},null)" style="position:absolute; top:-8px; right:-8px; background:#ef4444; color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.1);">&times;</button>
          </div>
        ` : `
          <div style="padding:40px; background:#fcfdfd; border:2px dashed #cbd5e1; border-radius:12px; text-align:center; color:#64748b; margin-bottom:12px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:8px; opacity:0.5;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <div style="font-size:14px;">No image uploaded</div>
          </div>
        `}
        <input class="creator-qs-input" type="file" accept="image/*" onchange="creatorUpdateSetDiagram(${index},this)" style="font-size:12px;"/>
      </div>`;

    // Configuration section
    const questionCount = (group.questions || []).length;
    html += `
      <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:16px;">
        <label style="font-size:10px; font-weight:900; text-transform:uppercase; color:var(--muted); display:block; margin-bottom:12px; letter-spacing:0.1em;">2. Answer Key</label>
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px; padding-bottom:20px; border-bottom:1px solid #f1f5f9;">
          <span style="font-size:14px; font-weight:700; color:#334155;">Number of gaps:</span>
          <input type="number" min="1" max="15" value="${questionCount}" 
            onchange="creatorUpdateDiagramGapCount(${index}, this.value)"
            style="width:70px; padding:8px; border:1px solid #d1d5db; border-radius:10px; font-size:14px; text-align:center; outline:none; font-weight:800; color:#0969da; background:#eff6ff;"/>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:12px;">
          ${(group.questions || []).map((q, qi) => {
      const currentAnswer = creatorState.answerKey?.[String(q.number)] || '';
      return `
              <div style="display:flex; align-items:center; gap:10px; background:#f8fafc; padding:10px; border-radius:10px; border:1px solid #eef2f6;">
                <div style="width:28px; height:28px; background:#3b82f6; color:white; border-radius:6px; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:11px; flex-shrink:0;">${q.number}</div>
                <input type="text" value="${escAttr(currentAnswer)}" 
                  onchange="creatorUpdateAnswerKey(${q.number}, this.value)"
                  placeholder="Expected answer..."
                  style="flex:1; padding:6px 10px; border:1px solid #d1d5db; border-radius:8px; font-size:13px; background:white; outline:none; transition:all 0.2s;" onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onfocusout="this.style.borderColor='#d1d5db'; this.style.boxShadow='none'"/>
              </div>
            `;
    }).join('')}
        </div>
      </div>`;

    html += '</div>';

  } else if (['matching_features', 'matching_information'].includes(type)) {
    const rawOptions = type === 'matching_information' ? getCreatorSectionChoices() : (group.options || []);
    const options = rawOptions.map(opt => cleanCreatorOptionLabel(opt));
    const gridCols = `minmax(120px, 1fr) repeat(${options.length}, minmax(48px, 56px)) 32px`;
    html += `<div class="wysiwyg-matching-grid" style="grid-template-columns:${gridCols};display:grid;gap:0;border:1px solid #d1d5db;border-radius:6px;overflow:hidden;">`;
    html += '<div class="mg-header" style="border-right:1px solid #e2e8f0;"></div>';
    options.forEach((opt, oi) => {
      const letter = String.fromCharCode(65 + oi);
      html += `<div class="mg-header">${letter}</div>`;
    });
    html += '<div class="mg-header"></div>';
    (group.questions || []).forEach((q, qi) => {
      const qNum = q.number;
      const currentAnswer = creatorState?.answerKey?.[String(qNum)] || '';
      html += `<div class="mg-stem" style="grid-column:1;">`;
      html += `<span style="font-weight:800;min-width:20px;">${escHtml(String(q.number))}.</span>`;
      html += `<input value="${escAttr(q.statement || q.stem || '')}"
        onchange="creatorUpdateMatchingStatement(${index},${qi},this.value)"
        placeholder="Statement…"
        style="border:none;background:transparent;font:inherit;font-size:.84rem;flex:1;padding:2px;"/>`;
      html += '</div>';
      options.forEach((opt, oi) => {
        const letter = String.fromCharCode(65 + oi);
        const isSelected = currentAnswer === letter;
        html += `<div class="mg-cell"><input type="radio" name="creator-match-${index}-${qi}" ${isSelected ? 'checked' : ''} onchange="creatorSetMatchingFeatureAnswer(${index},${qi},'${letter}')" title="Mark as correct answer"/></div>`;
      });
      html += `<div class="mg-cell"><button class="creator-qs-icon-btn is-danger" type="button" onclick="creatorRemoveQuestionFromSet(${index},${qi})" title="Remove statement">&times;</button></div>`;
    });
    html += '</div>';

    if (type === 'matching_features') {
      const maxMatchingQuestions = 7;
      const questionCount = (group.questions || []).length;
      const canAddQuestion = questionCount < maxMatchingQuestions;
      html += `<button class="creator-mini-btn" type="button" onclick="creatorAddQuestionToSet(${index})" style="margin-top:8px;" ${!canAddQuestion ? 'disabled' : ''}>${canAddQuestion ? '+ Add statement' : `Max ${maxMatchingQuestions} questions`}</button>`;
      // Options list below
      html += '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">';
      rawOptions.forEach((opt, oi) => {
        const letter = String.fromCharCode(65 + oi);
        const cleaned = cleanCreatorOptionLabel(opt);
        html += `<div style="font-size:.82rem;padding:4px 8px;background:#f8fafc;border-radius:4px;display:flex;align-items:center;gap:4px;">
          <strong>${letter}.</strong> <input value="${escAttr(cleaned)}"
                onchange="creatorUpdateMatchingOption(${index},${oi},this.value)"
                style="border:none;background:transparent;font:inherit;font-size:.82rem;min-width:60px;padding:2px;"/>
               <button class="creator-mini-btn is-danger" type="button" onclick="creatorRemoveMatchingOption(${index},${oi})" title="Remove option" style="padding:0 4px;font-size:.7rem;">&times;</button>
        </div>`;
      });
      const maxOptions = 8;
      const canAddOption = rawOptions.length < maxOptions;
      html += `<button class="creator-mini-btn" type="button" onclick="creatorAddMatchingOption(${index})" style="padding:4px 8px;" ${!canAddOption ? 'disabled' : ''}>${canAddOption ? '+ Add option' : `Max ${maxOptions} options`}</button>`;
      html += '</div>';
    } else {
      const maxMatchingQuestions = 8;
      const questionCount = (group.questions || []).length;
      const partCanAdd = getCreatorPartQuestionCount(getCreatorPart()) < CREATOR_LIMITS.maxQuestionsPerPart;
      const canAddQuestion = questionCount < maxMatchingQuestions && partCanAdd;
      const buttonLabel = !partCanAdd
        ? `Max ${CREATOR_LIMITS.maxQuestionsPerPart} questions in this part`
        : (questionCount < maxMatchingQuestions ? '+ Add statement' : `Max ${maxMatchingQuestions} questions`);
      html += `<button class="creator-mini-btn" type="button" onclick="creatorAddQuestionToSet(${index})" style="margin-top:8px;" ${!canAddQuestion ? 'disabled' : ''}>${canAddQuestion ? '+ Add statement' : `Max ${maxMatchingQuestions} questions`}</button>`;
    }
    html += '</div>';

  } else if (type === 'matching_endings') {
    const rawOptions = group.options || [];
    const options = rawOptions.map(opt => String(opt || '').replace(/^[A-Z][.)]\s+/, ''));

    // ── Endings List (editable, like MCQ options list) ──
    html += `<div style="border:1px solid #e2e8f0; border-radius:10px; background:#fff; overflow:hidden; margin-bottom:14px;">`;
    html += `<div style="padding:10px 14px 8px; background:#f8fafc; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; justify-content:space-between;">
      <span style="font-size:.72rem; font-weight:700; text-transform:uppercase; color:var(--muted); letter-spacing:.05em;">Endings List</span>
    </div>`;
    html += `<div style="padding:8px 14px 10px; display:flex; flex-direction:column; gap:4px;">`;
    options.forEach((opt, oi) => {
      const letter = String.fromCharCode(65 + oi);
      html += `<div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid #f8fafc;">
        <span style="font-weight:800; font-size:.88rem; min-width:22px; color:#475569; flex-shrink:0;">${letter}.</span>
        <input value="${escAttr(opt)}"
          onchange="creatorUpdateMatchingOption(${index},${oi},this.value)"
          placeholder="Ending text…"
          style="flex:1; border:none; background:transparent; font:inherit; font-size:.88rem; padding:3px 4px; outline:none; color:#1e293b;"/>
        <button class="creator-mini-btn is-danger" type="button" onclick="creatorRemoveMatchingOption(${index},${oi})" title="Remove ending" style="padding:2px 6px; flex-shrink:0;">&times;</button>
      </div>`;
    });
    const maxOptions = 8;
    const canAddOption = options.length < maxOptions;
    html += `<button class="creator-mini-btn" type="button" onclick="creatorAddMatchingOption(${index})" style="margin-top:6px;" ${!canAddOption ? 'disabled' : ''}>${canAddOption ? '+ Add ending' : `Max ${maxOptions} options`}</button>`;
    html += `</div></div>`;

    // ── Stems with answer selection ──
    html += `<div style="border:1px solid #e2e8f0; border-radius:10px; background:#fff; overflow:hidden;">`;
    html += `<div style="padding:10px 14px 8px; background:#f8fafc; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; justify-content:space-between;">
      <span style="font-size:.72rem; font-weight:700; text-transform:uppercase; color:var(--muted); letter-spacing:.05em;">Sentence Stems</span>
    </div>`;
    html += `<div style="padding:8px 14px 10px; display:flex; flex-direction:column; gap:10px;">`;
    (group.questions || []).forEach((q, qi) => {
      const qNum = q.number;
      const currentAnswer = creatorState?.answerKey?.[String(qNum)] || '';
      html += `<div style="padding:10px 12px; background:#f8fafc; border-radius:8px; border:1px solid #e9ecef;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
          <span style="font-weight:800; font-size:.9rem; min-width:26px; color:#1e293b; flex-shrink:0;">${escHtml(String(q.number))}.</span>
          <input value="${escAttr(q.stem || q.statement || '')}"
            onchange="creatorUpdateMatchingStatement(${index},${qi},this.value)"
            placeholder="Sentence stem (the beginning of the sentence)…"
            style="flex:1; border:none; border-bottom:1.5px dashed #cbd5e1; background:transparent; font:inherit; font-size:.88rem; padding:3px 4px; outline:none;"/>
          <button class="creator-qs-icon-btn is-danger" type="button" onclick="creatorRemoveQuestionFromSet(${index},${qi})" title="Remove stem" style="flex-shrink:0;">&times;</button>
        </div>
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; padding-left:34px;">
          <span style="font-size:.75rem; font-weight:600; color:var(--muted); margin-right:4px; white-space:nowrap;">Correct ending:</span>
          ${options.map((opt, oi) => {
        const letter = String.fromCharCode(65 + oi);
        const isSelected = currentAnswer === letter;
        return `<button type="button"
              class="mapping-pill${isSelected ? ' is-active' : ''}"
              onclick="creatorSetMatchingEndingAnswer(${index},${qi},'${letter}')"
              title="${escAttr(opt)}"
              style="font-size:.8rem; padding:3px 10px;">
              ${letter}
            </button>`;
      }).join('')}
        </div>
        ${currentAnswer ? `<div style="margin-top:6px; padding-left:34px; font-size:.8rem; color:#16a34a; font-weight:600;">
          ✓ ${escHtml(String.fromCharCode(65 + (currentAnswer.charCodeAt(0) - 65)))}. ${escHtml((options[currentAnswer.charCodeAt(0) - 65] || '').substring(0, 60))}${(options[currentAnswer.charCodeAt(0) - 65] || '').length > 60 ? '…' : ''}
        </div>` : ''}
      </div>`;
    });
    const maxMatchingQuestions = 8;
    const questionCount = (group.questions || []).length;
    const canAddQuestion = questionCount < maxMatchingQuestions;
    html += `<button class="creator-mini-btn" type="button" onclick="creatorAddQuestionToSet(${index})" style="margin-top:4px;" ${!canAddQuestion ? 'disabled' : ''}>${canAddQuestion ? '+ Add stem' : `Max ${maxMatchingQuestions} questions`}</button>`;
    html += `</div></div>`;


  } else if (type === 'sentence_completion') {
    const maxSentenceQuestions = 8;
    const sentenceQuestionCount = (group.questions || []).length;
    const canAddSentenceQuestion = sentenceQuestionCount < maxSentenceQuestions;

    html += '<div style="display:flex; flex-direction:column; gap:16px;">';
    html += '<div style="font-size:.7rem; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; margin-bottom:-4px;">Sentences</div>';

    (group.questions || []).forEach((q, qi) => {
      const currentAnswer = creatorState.answerKey?.[String(q.number)] || '';
      const rendered = escHtml(q.statement || '').replace(/_{3,}(\d+)_{3,}/g, (match, num) => {
        return `&#8203;<span class="wysiwyg-gap-inline" contenteditable="false"><span class="gap-num">${num}</span></span>&#8203;`;
      });
      html += `
        <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:16px; position:relative; transition:box-shadow 0.2s; box-shadow:0 1px 2px rgba(0,0,0,0.05);" onmouseover="this.style.boxShadow='0 4px 6px -1px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow='0 1px 2px rgba(0,0,0,0.05)'">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
            <div style="background:#3b82f6; color:white; width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:.9rem; flex-shrink:0;">${String(q.number)}</div>
            <div class="creator-sentence-editable" contenteditable="true" data-qindex="${qi}"
              oninput="creatorUpdateSentenceStatement(${index},${qi},this)"
              style="flex:1; border:none; border-bottom:2px solid #f1f5f9; background:transparent; font-size:.95rem; font-weight:500; padding:6px 0; outline:none; color:#1e293b; transition:border-color 0.2s; min-height:30px;" onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#f1f5f9'" placeholder="Type sentence here (use Insert Gap for the blank)...">${rendered}</div>
            <button class="creator-qs-icon-btn" type="button" onmousedown="event.preventDefault()" onclick="creatorInsertGapAtCursor(${index}, 'sentence')" title="Insert Gap" style="background:#eff6ff; color:#0969da; border-radius:6px; padding:6px 10px; font-size:12px; font-weight:bold; flex-shrink:0;">+ Gap</button>
            <button class="creator-qs-icon-btn is-danger" type="button" onclick="creatorRemoveQuestionFromSet(${index},${qi})" title="Remove question" style="background:#fef2f2; color:#ef4444; border-radius:6px; padding:6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
          <div style="display:flex; align-items:center; gap:12px; padding-left:44px;">
            <span style="font-size:.75rem; font-weight:700; color:#64748b; text-transform:uppercase; min-width:60px;">Answer:</span>
            <input type="text" value="${escAttr(currentAnswer)}" placeholder="Type expected answer…"
              onchange="creatorUpdateAnswerKey(${q.number}, this.value)"
              style="flex:1; padding:8px 12px; border:1px solid #d1d5db; border-radius:8px; background:#f8fafc; font-size:.88rem; color:#0f172a; outline:none; transition:all 0.2s;" onfocus="this.style.borderColor='#3b82f6'; this.style.background='white'"/>
          </div>
        </div>`;
    });

    if (canAddSentenceQuestion) {
      html += `
        <button class="creator-btn-secondary" type="button" onclick="creatorAddQuestionToSet(${index})" style="padding:12px; border:2px dashed #e2e8f0; background:#fcfdfd; border-radius:12px; width:100%; color:#64748b; font-weight:600; display:flex; align-items:center; justify-content:center; gap:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          Add Another Sentence
        </button>`;
    } else {
      html += `<div style="text-align:center; font-size:.8rem; color:var(--muted); font-style:italic;">Maximum ${maxSentenceQuestions} questions reached for this set.</div>`;
    }
    html += '</div>';

  } else if (type === 'short_answer') {
    const maxShortAnswerQuestions = 10;
    const shortAnswerQuestionCount = (group.questions || []).length;
    const canAddShortAnswerQuestion = shortAnswerQuestionCount < maxShortAnswerQuestions;

    html += '<div style="display:flex; flex-direction:column; gap:16px;">';
    html += '<div style="font-size:.7rem; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; margin-bottom:-4px;">Questions & Answers</div>';

    (group.questions || []).forEach((q, qi) => {
      const currentAnswer = creatorState.answerKey?.[String(q.number)] || '';
      html += `
        <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:16px; position:relative; transition:box-shadow 0.2s; box-shadow:0 1px 2px rgba(0,0,0,0.05);" onmouseover="this.style.boxShadow='0 4px 6px -1px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow='0 1px 2px rgba(0,0,0,0.05)'">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
            <div style="background:#3b82f6; color:white; width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:.9rem; flex-shrink:0;">${String(q.number)}</div>
            <input value="${escAttr(q.statement || '')}"
              onchange="creatorUpdateShortAnswerStatement(${index},${qi},this.value)"
              placeholder="Type question here (e.g. What year did the research begin?)"
              style="flex:1; border:none; border-bottom:2px solid #f1f5f9; background:transparent; font-size:.95rem; font-weight:500; padding:6px 0; outline:none; color:#1e293b; transition:border-color 0.2s;" onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#f1f5f9'"/>
            <button class="creator-qs-icon-btn is-danger" type="button" onclick="creatorRemoveQuestionFromSet(${index},${qi})" title="Remove question" style="background:#fef2f2; color:#ef4444; border-radius:6px; padding:6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
          <div style="display:flex; align-items:center; gap:12px; padding-left:44px;">
            <span style="font-size:.75rem; font-weight:700; color:#64748b; text-transform:uppercase; min-width:60px;">Answer:</span>
            <input type="text" value="${escAttr(currentAnswer)}" placeholder="Type expected answer…"
              onchange="creatorUpdateAnswerKey(${q.number}, this.value)"
              style="flex:1; padding:8px 12px; border:1px solid #d1d5db; border-radius:8px; background:#f8fafc; font-size:.88rem; color:#0f172a; outline:none; transition:all 0.2s;" onfocus="this.style.borderColor='#3b82f6'; this.style.background='white'"/>
          </div>
        </div>`;
    });

    if (canAddShortAnswerQuestion) {
      html += `
        <button class="creator-btn-secondary" type="button" onclick="creatorAddQuestionToSet(${index})" style="padding:12px; border:2px dashed #e2e8f0; background:#fcfdfd; border-radius:12px; width:100%; color:#64748b; font-weight:600; display:flex; align-items:center; justify-content:center; gap:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          Add Another Question
        </button>`;
    } else {
      html += `<div style="text-align:center; font-size:.8rem; color:var(--muted); font-style:italic;">Maximum ${maxShortAnswerQuestions} questions reached for this set.</div>`;
    }
    html += '</div>';
  }

  html += '</div>'; // .creator-wysiwyg-section
  return html;
}

/* ── Render a single question set as an editable WYSIWYG card ── */
function renderCreatorQSCard(group, index, part) {
  const type = group.type;
  const range = escHtml(getCreatorDisplayRange(group));
  const typeLabel = type.replace(/_/g, ' ');
  const answersForGroup = getAnswersForGroup(group);
  const answersOpen = window._creatorAnswersOpen?.[index] || false;

  let bodyHtml = '';

  // WYSIWYG Preview (primary editing surface)
  bodyHtml += renderCreatorWYSIWYGPreview(group, index);

  return `
    <div class="creator-qs-card" data-qs-index="${index}">
      <div class="creator-qs-card-header">
        <span class="creator-qs-card-range">${range}</span>
        <span class="creator-qs-card-type">${escHtml(typeLabel)}</span>
        <div class="creator-qs-card-actions">
          <button class="creator-qs-icon-btn is-danger" type="button" onclick="creatorRemoveQuestionSet(${index})" title="Delete Question Set">
            <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      <div class="creator-qs-card-body">
        <textarea class="creator-ghost-input"
          style="width: 100%; font-size: 0.9rem; font-style: italic; color: #475569; margin-bottom: 16px; line-height: 1.5; resize: none; overflow: hidden; background: transparent; border: 1px solid transparent; padding: 4px; border-radius: 4px; transition: border-color 0.2s;"
          onfocus="this.style.borderColor='#e2e8f0'; this.style.background='#fff'"
          onblur="this.style.borderColor='transparent'; this.style.background='transparent'"
          oninput="creatorUpdateSetField(${index}, 'instructions', this.value); this.style.height = ''; this.style.height = this.scrollHeight + 'px'"
          placeholder="Instructions...">${escHtml(group.instructions || '')}</textarea>
        ${bodyHtml}
      </div>
    </div>`;
}

function renderMCQPreview(group) {
  const lines = [];
  (group.questions || []).forEach((q, i) => {
    if (i > 0) lines.push('---');
    lines.push(`${q.number}. ${q.stem || ''}`);
    (q.options || []).forEach(opt => {
      const letter = String.fromCharCode(65 + (q.options.indexOf(opt)));
      lines.push(`${letter}. ${opt}`);
    });
  });
  return escHtml(lines.join('\n'));
}

function renderMCQPreviewSeamless(group) {
  const lines = [];
  (group.questions || []).forEach((q, i) => {
    lines.push(`${q.number}. ${q.stem || ''}<br>`);
    (q.options || []).forEach(opt => {
      const letter = String.fromCharCode(65 + (q.options.indexOf(opt)));
      lines.push(`${letter}. ${opt}<br>`);
    });
  });
  return escHtml(lines.join(''));
}

function renderCompletionPreview(group, type) {
  const lines = [];
  if (type === 'note_completion') {
    (group.questions || []).forEach(q => lines.push(`- ${q.statement}`));
  } else if (type === 'flowchart_completion') {
    (group.questions || []).forEach((q, i) => lines.push(`Step ${i + 1}: ${q.statement}`));
  } else {
    (group.questions || []).forEach(q => lines.push(`${q.number}. ${q.statement}`));
  }
  return escHtml(lines.join('\n'));
}

function renderTablePreview(group) {
  return escHtml((group.tableRows || []).map(row => row.join(' | ')).join('\n'));
}

function renderAnswersInline(group, index) {
  const numbers = getCreatorQuestionNumbersForGroup(group);
  if (!numbers.length) return '<div style="color:var(--muted);font-size:.8rem;">No questions yet. Add gaps/questions before testing or sharing.</div>';
  return numbers.map(num => {
    const ansKey = String(num);
    const answer = creatorState?.answerKey?.[ansKey] || '';
    if (group.type === 'heading_match') {
      const options = (group.headingOptions || []).map((option, i) => ({ value: creatorNumberToRoman(i + 1), text: cleanCreatorOptionLabel(option) })).filter(option => option.text);
      return `
        <div class="creator-qs-answer-row">
          <span class="creator-qs-answer-num">Q${num}</span>
          <select class="creator-qs-answer-input" onchange="creatorSetAnswer(${num},this.value)">
            <option value="">Select heading...</option>
            ${options.map(option => `<option value="${option.value}"${String(answer).trim().toLowerCase() === option.value ? ' selected' : ''}>${option.value}. ${escHtml(option.text)}</option>`).join('')}
          </select>
        </div>`;
    }
    return `
      <div class="creator-qs-answer-row">
        <span class="creator-qs-answer-num">Q${num}</span>
        <input class="creator-qs-answer-input" value="${escAttr(answer)}" placeholder="Answer..." onchange="creatorSetAnswer(${num},this.value)" />
      </div>`;
  }).join('');
}

function getAnswersForGroup(group) {
  const numbers = getCreatorQuestionNumbersForGroup(group);
  if (!numbers.length || !creatorState) return {};
  const result = {};
  numbers.forEach(num => {
    const key = String(num);
    result[key] = creatorState.answerKey?.[key] || '';
  });
  return result;
}

/* ── Creator Set CRUD ── */
function creatorCreateSet(type, mcqMode) {
  const part = getCreatorPart();
  if (!part) return;

  // Validate MCQ variants - can't have both "pick 2" and "pick 3" in same passage
  if (type === 'multiple_choice' && (mcqMode === 'two' || mcqMode === 'three')) {
    const existingMCQVariant = part.questionGroups.find(g => g.type === 'multiple_choice' && (g.selectCount === 2 || g.selectCount === 3));
    if (existingMCQVariant) {
      const existingLabel = existingMCQVariant.selectCount === 2 ? 'Pick 2 out of 5' : 'Pick 3 out of 7';
      const newLabel = mcqMode === 'two' ? 'Pick 2 out of 5' : 'Pick 3 out of 7';
      if ((mcqMode === 'two' && existingMCQVariant.selectCount === 3) || (mcqMode === 'three' && existingMCQVariant.selectCount === 2)) {
        notify('error', `This passage already has a "${existingLabel}" MCQ. Cannot add "${newLabel}" in the same passage (only one variant allowed).`);
        return;
      }
    }
  }

  // Find next available range
  const usedNumbers = new Set(part.questionGroups.flatMap(group => getCreatorQuestionNumbersForGroup(group)));
  let start = 1;
  while (usedNumbers.has(start)) start++;

  let count;
  if (type === 'table_completion' || type === 'summary_completion') count = 0;
  else if (type === 'multiple_choice') count = mcqMode === 'two' ? 2 : mcqMode === 'three' ? 3 : 1;
  else count = 1;

  if (getCreatorPartQuestionCount(part) + count > CREATOR_LIMITS.maxQuestionsPerPart) {
    notify('warning', `Each part can have at most ${CREATOR_LIMITS.maxQuestionsPerPart} questions. Delete an existing question before adding more.`);
    return;
  }
  const end = start + count - 1;
  const rangeLabel = count === 0 ? '' : (count === 1 ? String(start) : `${start}-${end}`);
  const range = count === 0 ? { label: '', numbers: [] } : parseCreatorRange(rangeLabel);
  if (!range) { notify('error', 'Could not create range.'); return; }

  // Build default answers with placeholders
  const answers = {};
  range.numbers.forEach(n => { answers[String(n)] = '[Answer]'; });

  // Build skeleton group
  const group = buildCreatorSkeletonGroup(type, range, part, mcqMode);

  part.questionGroups.push(group);
  Object.assign(creatorState.answerKey, answers);
  applyCreatorHeadingMarkers(part);
  part.questionRange = combineCreatorRanges(part.questionGroups);
  creatorDirty = true;
  creatorShowTypePicker = false;
  creatorMCQPickerOpen = false;
  renderCreatorPanel();
  notify('success', `Added ${rangeLabel || 'Q0'} (${type.replace(/_/g, ' ')})`);
}

function getDefaultInstructionsForType(type, mcqMode) {
  switch (type) {
    case 'heading_match':
      return 'Choose the correct heading for each section from the list of headings below.\nWrite the correct number, i-x, in boxes on your answer sheet.';
    case 'multiple_choice':
      if (mcqMode === 'two') return 'Choose TWO letters, A-E.\nWrite the correct letters in boxes on your answer sheet.';
      if (mcqMode === 'three') return 'Choose THREE letters, A-G.\nWrite the correct letters in boxes on your answer sheet.';
      return 'Choose the correct letter, A, B, C or D.\nWrite the correct letter in boxes on your answer sheet.';
    case 'true_false_notgiven':
      return 'Do the following statements agree with the information given in the Reading Passage?\n\nIn boxes on your answer sheet, write\nTRUE if the statement agrees with the information\nFALSE if the statement contradicts the information\nNOT GIVEN if there is no information on this';
    case 'yes_no_notgiven':
      return 'Do the following statements agree with the claims of the writer in the Reading Passage?\n\nIn boxes on your answer sheet, write\nYES if the statement agrees with the claims of the writer\nNO if the statement contradicts the claims of the writer\nNOT GIVEN if it is impossible to say what the writer thinks about this';
    case 'summary_completion':
      return 'Complete the summary below.\nChoose NO MORE THAN TWO WORDS from the passage for each answer.\nWrite your answers in boxes on your answer sheet.';
    case 'note_completion':
      return 'Complete the notes below.\nChoose ONE WORD ONLY from the passage for each answer.\nWrite your answers in boxes on your answer sheet.';
    case 'table_completion':
      return 'Complete the table below.\nChoose NO MORE THAN TWO WORDS from the passage for each answer.\nWrite your answers in boxes on your answer sheet.';
    case 'flowchart_completion':
      return 'Complete the flow-chart below.\nChoose NO MORE THAN TWO WORDS from the passage for each answer.\nWrite your answers in boxes on your answer sheet.';
    case 'diagram_completion':
      return 'Label the diagram below.\nChoose NO MORE THAN TWO WORDS from the passage for each answer.\nWrite your answers in boxes on your answer sheet.';
    case 'matching_features':
      return 'Look at the following statements and the list of features below.\nMatch each statement with the correct feature.\nWrite the correct letter in boxes on your answer sheet.';
    case 'matching_endings':
      return 'Complete each sentence with the correct ending, A-G, below.\nWrite the correct letter in boxes on your answer sheet.';
    case 'matching_information':
      return 'Which section contains the following information?\nWrite the correct letter in boxes on your answer sheet.\nNB You may use any letter more than once.';
    case 'short_answer':
      return 'Answer the questions below.\nChoose NO MORE THAN THREE WORDS AND/OR A NUMBER from the passage for each answer.\nWrite your answers in boxes on your answer sheet.';
    case 'sentence_completion':
      return 'Complete the sentences below.\nChoose ONE WORD ONLY from the passage for each answer.\nWrite your answers in boxes on your answer sheet.';
    default:
      return 'Read the passage and answer the questions below.';
  }
}

function buildCreatorSkeletonGroup(type, range, part, mcqMode) {
  const numbers = range.numbers;
  const group = { type, questionRange: range.label, instructions: getDefaultInstructionsForType(type, mcqMode), questions: [] };

  if (type === 'heading_match') {
    const sections = getCreatorSectionChoices(part);
    group.headingOptions = part.passage.sections.map((s, i) => s.heading && /^[A-J]$/i.test(s.heading) ? `Heading for section ${s.heading.toUpperCase()}` : (s.heading || `Heading for section ${String.fromCharCode(65 + i)}`));
    group.questions = numbers.map((n, i) => ({ number: n, section: sections[i % Math.max(1, sections.length)] || 'A', answer: null }));
  } else if (type === 'multiple_choice') {
    if (mcqMode === 'two' || mcqMode === 'three') {
      const optionCount = mcqMode === 'two' ? 5 : 7;
      group.selectCount = mcqMode === 'two' ? 2 : 3;
      group.fixedSlotCount = true;
      group.questions = [{ numbers: range.label, stem: '', options: Array.from({ length: optionCount }, () => '') }];
    } else {
      group.selectCount = 1;
      group.questions = numbers.map((n) => ({ number: n, stem: '', options: ['', '', '', ''] }));
    }
  } else if (type === 'true_false_notgiven' || type === 'yes_no_notgiven') {
    group.questions = numbers.map(n => ({ number: n, statement: '' }));
  } else if (type === 'summary_completion' || type === 'note_completion') {
    group.summaryText = type === 'note_completion' ? numbers.map(n => `- ___${n}___`).join('\n') : '';
    group.summaryHeading = '';
    group.questions = [];
  } else if (type === 'table_completion') {
    group.tableHeaders = ['Notes', 'Details'];
    group.tableRows = [];
    group.tableColumnWidths = [180, 280];
    group.tableRowHeights = [];
    group.tableCellStyles = {};
    group.questions = [];
  } else if (type === 'flowchart_completion') {
    group.questions = numbers.map((n, i) => ({ number: n, statement: `Step ${i + 1}: ___${n}___`, text: `Step ${i + 1}`, color: '#3b82f6', arrow: 'down', width: 180, height: 66 }));
  } else if (type === 'diagram_completion') {
    group.diagramImage = window.creatorDiagramImageData || '';
    group.questions = numbers.map(n => ({ number: n, statement: `___${n}___` }));
  } else if (['matching_features', 'matching_endings', 'matching_information'].includes(type)) {
    group.options = type === 'matching_information'
      ? getCreatorSectionChoices(part)
      : ['Option 1', 'Option 2', 'Option 3'];
    group.questions = numbers.map(n => ({ number: n, statement: '', stem: '' }));
  } else if (type === 'short_answer') {
    group.questions = numbers.map(n => ({ number: n, statement: `___${n}___` }));
  }

  return group;
}

/* ── Inline field updates ── */
/* ── WYSIWYG Update Handlers ── */
function creatorUpdateWYSIWYGAndRender(index) {
  creatorDirty = true;
}
function creatorUpdateHeadingOption(index, optIndex, value) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group) return;
  group.headingOptions[optIndex] = value.trim();
  creatorDirty = true;
}
function creatorRemoveHeadingOption(index, optIndex) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group || !group.headingOptions) return;
  group.headingOptions.splice(optIndex, 1);
  creatorDirty = true;
  renderCreatorPanel();
}
function creatorAddHeadingOption(index) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group) return;
  group.headingOptions = group.headingOptions || [];
  if (group.headingOptions.length >= 11) {
    notify('warning', 'Matching Headings can have at most 11 heading options.');
    return;
  }
  group.headingOptions.push('New heading');
  creatorDirty = true;
  renderCreatorPanel();
}
function creatorUpdateSectionMapping(index, qIndex, value) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group?.questions?.[qIndex]) return;

  if (group.exampleSection === value) {
    group.exampleSection = null;
    group.exampleHeading = null;
  }

  group.questions[qIndex].section = value;
  applyCreatorHeadingMarkers(part);
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorSetHeadingMatchAnswer(groupIndex, qIndex, headingText) {
  const group = getCreatorPart()?.questionGroups[groupIndex];
  if (!group || !group.questions?.[qIndex]) return;
  const q = group.questions[qIndex];
  if (!q.number) return;

  // Prevent selecting the example heading as a question answer
  const exampleHeading = cleanCreatorOptionLabel(group.exampleHeading || '');
  const chosenCleaned = cleanCreatorOptionLabel(headingText);
  if (exampleHeading && chosenCleaned && chosenCleaned === exampleHeading) {
    notify('warning', 'This heading is already used as the example. Choose a different heading.');
    renderCreatorPanel();
    return;
  }

  creatorState.answerKey[String(q.number)] = headingText;
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorSetHeadingMatchExampleSection(index, value) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group) return;
  group.exampleSection = value || null;

  if (value) {
    (group.questions || []).forEach(q => {
      if (q.section === value) {
        q.section = '';
      }
    });
  }

  applyCreatorHeadingMarkers(part);
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorSetHeadingMatchExampleHeading(index, value) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group) return;

  if (value) {
    const chosenCleaned = cleanCreatorOptionLabel(value);
    const isAnswer = (group.questions || []).some(q => {
      const ans = creatorState.answerKey[String(q.number)];
      return ans && cleanCreatorOptionLabel(ans) === chosenCleaned;
    });
    if (isAnswer) {
      notify('warning', 'This heading is already assigned to a question. Choose a different heading or change the question answer first.');
      renderCreatorPanel();
      return;
    }
  }

  group.exampleHeading = value || null;
  applyCreatorHeadingMarkers(part);
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorUpdateAnswerKey(num, value) {
  if (!creatorState) return;
  creatorState.answerKey[String(num)] = value.trim();
  creatorDirty = true;
  renderCreatorPanel();
}
function creatorUpdateMCQStem(index, qIndex, value) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group?.questions?.[qIndex]) return;
  group.questions[qIndex].stem = value;
  creatorDirty = true;
}
function creatorUpdateMCQOption(index, qIndex, optIndex, value) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group?.questions?.[qIndex]?.options) return;
  group.questions[qIndex].options[optIndex] = value;
  creatorDirty = true;
}
function creatorToggleMCQAnswer(index, qIndex, letter) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group || !group.questions?.[qIndex]) return;
  const q = group.questions[qIndex];
  const fixedSet = Number(group.selectCount || 1) > 1;

  if (fixedSet) {
    // For pick 2/3 MCQs, get all question numbers from the range
    const allNumbers = getCreatorQuestionNumbersForGroup(group);
    if (!allNumbers || allNumbers.length === 0) return;

    const current = creatorState.answerKey[String(allNumbers[0])] || '';
    let answers = current.split(',').map(s => s.trim()).filter(s => s && s !== '[Answer]');

    // Toggle the letter
    if (answers.includes(letter)) {
      answers = answers.filter(a => a !== letter);
    } else {
      answers.push(letter);
    }

    // Set same answer for all questions in the range
    const answerStr = answers.sort().join(', ');
    allNumbers.forEach(n => {
      creatorState.answerKey[String(n)] = answerStr;
    });
  } else {
    // Single-select MCQ
    const qNum = q.number;
    if (!qNum) return;
    const current = creatorState.answerKey[String(qNum)] || '';
    creatorState.answerKey[String(qNum)] = current === letter ? '' : letter;
  }

  creatorDirty = true;
  renderCreatorPanel();
}

function creatorUpdateTFNGStatement(index, qIndex, value) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group?.questions?.[qIndex]) return;
  group.questions[qIndex].statement = value;
  creatorDirty = true;
}

function creatorSetTFNGAnswer(index, qIndex, choice) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group || !group.questions?.[qIndex]) return;
  const q = group.questions[qIndex];
  if (q.number) {
    creatorState.answerKey[String(q.number)] = choice;
    creatorDirty = true;
    renderCreatorPanel();
  }
}

function creatorSetMatchingEndingAnswer(index, qIndex, letter) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group || !group.questions?.[qIndex]) return;
  const q = group.questions[qIndex];
  if (q.number) {
    creatorState.answerKey[String(q.number)] = letter;
    creatorDirty = true;
    renderCreatorPanel();
  }
}

function creatorSetMatchingInformationAnswer(index, qIndex, letter) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group || !group.questions?.[qIndex]) return;
  const q = group.questions[qIndex];
  if (q.number) {
    creatorState.answerKey[String(q.number)] = letter;
    creatorDirty = true;
    renderCreatorPanel();
  }
}

function creatorSetMatchingFeatureAnswer(index, qIndex, letter) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group || !group.questions?.[qIndex]) return;
  const q = group.questions[qIndex];
  if (q.number) {
    creatorState.answerKey[String(q.number)] = letter;

    // Check if letter is used more than once for matching information
    if (group.type === 'matching_information') {
      const letterCounts = {};
      (group.questions || []).forEach(qu => {
        const ans = creatorState.answerKey[String(qu.number)];
        if (ans) {
          letterCounts[ans] = (letterCounts[ans] || 0) + 1;
        }
      });
      if (letterCounts[letter] === 2) {
        notify('info', 'Note: "You may use any letter more than once." will appear on the real test.');
      }
    }

    creatorDirty = true;
    renderCreatorPanel();
  }
}
function creatorUpdateMatchingOption(index, optIndex, value) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group?.options) return;
  // Preserve the letter prefix when updating
  const letter = String.fromCharCode(65 + optIndex);
  group.options[optIndex] = `${letter}. ${value.replace(/^[A-Z][.)]\s+/, '')}`;
  creatorDirty = true;
}

function creatorUpdateWordBankOption(index, optIndex, value) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group?.options) return;
  group.options[optIndex] = value;
  creatorDirty = true;
}
function creatorRemoveWordBankOption(index, optIndex) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group?.options) return;
  group.options.splice(optIndex, 1);
  creatorDirty = true;
  renderCreatorPanel();
}
function creatorAddWordBankOption(index) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group) return;
  group.options = group.options || [];
  group.options.push('newword');
  creatorDirty = true;
  renderCreatorPanel();
}
function creatorSetSummaryHeading(index, value) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group) return;
  const oldHadHeading = !!group.summaryHeading;
  group.summaryHeading = value;
  const newHadHeading = !!value;
  creatorDirty = true;
  // Only re-render if the presence of the heading changed (to show/hide the Remove button)
  if (oldHadHeading !== newHadHeading) {
    renderCreatorPanel();
  }
}

function creatorAddSummarySubheading(index) {
  const el = document.querySelector(`.creator-qs-card[data-qs-index="${index}"] .wysiwyg-editable-summary:not(.creator-flowchart-node-editable)`);
  if (!el) return;
  el.focus();
  document.execCommand('insertText', false, '\n### Subheading');
  creatorUpdateSummaryText(index, el);
  renderCreatorPanel();
}

function creatorAddSummaryBullet(index) {
  const el = document.querySelector(`.creator-qs-card[data-qs-index="${index}"] .wysiwyg-editable-summary:not(.creator-flowchart-node-editable)`);
  if (!el) return;
  el.focus();
  document.execCommand('insertText', false, '\n• Bullet point');
  creatorUpdateSummaryText(index, el);
  renderCreatorPanel();
}

function creatorUpdateSummaryText(index, elementOrText) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group) return;

  if (typeof elementOrText === 'string') {
    group.summaryText = elementOrText;
    if (group.type === 'note_completion') {
      group.noteText = elementOrText;
    }
  } else {
    const val = extractTextFromContentEditable(elementOrText);
    group.summaryText = val;
    if (group.type === 'note_completion') {
      group.noteText = val;
    }
  }

  const gapNums = [];
  String(group.summaryText || '').replace(/_{3,}(\d+)_{3,}/g, (_, n) => { gapNums.push(Number(n)); });
  const sortedNums = Array.from(new Set(gapNums)).sort((a, b) => a - b);

  // Sync group questions list
  group.questions = sortedNums.map(n => ({ number: n, statement: `___${n}___` }));

  // Ensure answers exist in answerKey
  sortedNums.forEach(number => {
    const key = String(number);
    if (!creatorState.answerKey[key]) creatorState.answerKey[key] = '';
  });

  // Sync group questionRange
  if (sortedNums.length) {
    const min = Math.min(...sortedNums);
    const max = Math.max(...sortedNums);
    group.questionRange = sortedNums.length === 1 ? String(min) : `${min}-${max}`;
  } else {
    group.questionRange = '';
  }

  if (part) part.questionRange = combineCreatorRanges(part.questionGroups);
  creatorDirty = true;
}

function creatorUpdateSentenceStatement(index, qIndex, elementOrText) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group?.questions?.[qIndex]) return;
  if (typeof elementOrText === 'string') {
    group.questions[qIndex].statement = elementOrText;
  } else {
    const clone = elementOrText.cloneNode(true);
    clone.querySelectorAll('.wysiwyg-gap-inline').forEach(gap => {
      const num = gap.querySelector('.gap-num')?.textContent;
      gap.replaceWith(`___${num}___`);
    });
    let text = clone.textContent || clone.innerText || '';
    text = text.replace(/\u200B/g, ''); // Remove zero-width spaces
    group.questions[qIndex].statement = text;
  }
  creatorDirty = true;
}
function creatorUpdateNoteLine(index, lineIndex, innerText) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group) return;
  const text = group.noteText || '';
  const lines = String(text).split(/\n+/).map(l => l.trim()).filter(Boolean);
  if (lines[lineIndex] !== undefined) {
    lines[lineIndex] = String(lines[lineIndex] || '').replace(/[^-•]\s*.+/, (typeof innerText === 'string' ? innerText : ''));
    // simpler: just replace the whole noteText with re-joined lines after adjusting
  }
  // For simplicity, we won't rewrite full noteText here — just flag dirty
  creatorDirty = true;
}
function creatorUpdateTableHeader(index, headerIndex, value) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group?.tableHeaders) return;
  group.tableHeaders[headerIndex] = value;
  creatorDirty = true;
}
function creatorUpdateTableCell(index, ri, ci, element) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group || !group.tableRows[ri]) return;

  group.tableRows[ri][ci] = extractTextFromContentEditable(element);
  creatorSyncTableQuestions(index);
  creatorDirty = true;
}

function creatorSyncTableQuestions(index) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group || group.type !== 'table_completion') return;
  const found = [];
  for (const row of (group.tableRows || [])) {
    for (const cell of (row || [])) {
      for (const match of String(cell || '').matchAll(/_{3,}(\d+)_{3,}/g)) {
        const number = Number(match[1]);
        if (Number.isInteger(number) && !found.includes(number)) found.push(number);
      }
    }
  }
  group.questions = found.sort((a, b) => a - b).map(number => ({ number, statement: `___${number}___` }));
  syncCreatorGroupRangeFromQuestions(group);
  found.forEach(number => {
    const key = String(number);
    if (!creatorState.answerKey[key]) creatorState.answerKey[key] = '[Answer]';
  });
  part.questionRange = combineCreatorRanges(part.questionGroups);
}

function creatorCreateTableGap(index) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group || group.type !== 'table_completion') return;
  if (getCreatorPartQuestionCount(part) >= CREATOR_LIMITS.maxQuestionsPerPart) {
    notify('warning', `Each part can have at most ${CREATOR_LIMITS.maxQuestionsPerPart} questions. Delete an existing question before adding another table gap.`);
    return;
  }
  const next = getCreatorNextQuestionNumber(part);
  if (!next) {
    notify('warning', 'No question numbers are available.');
    return;
  }
  group.tableHeaders = group.tableHeaders?.length ? group.tableHeaders : ['Notes', 'Details'];
  group.tableRows = group.tableRows || [];
  const colCount = Math.max(1, group.tableHeaders.length);
  let inserted = false;
  for (const row of group.tableRows) {
    while (row.length < colCount) row.push('');
    const emptyIndex = row.findIndex(cell => !String(cell || '').trim());
    if (emptyIndex !== -1) {
      row[emptyIndex] = `___${next}___`;
      inserted = true;
      break;
    }
  }
  if (!inserted) {
    const row = Array.from({ length: colCount }, () => '');
    row[0] = `___${next}___`;
    group.tableRows.push(row);
    group.tableRowHeights = group.tableRowHeights || [];
    group.tableRowHeights.push(48);
  }
  creatorSyncTableQuestions(index);
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorAddTableRow(index) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group || group.type !== 'table_completion') return;
  const colCount = Math.max(1, (group.tableHeaders || ['Notes', 'Details']).length);
  group.tableHeaders = group.tableHeaders?.length ? group.tableHeaders : ['Notes', 'Details'];
  group.tableRows = group.tableRows || [];
  group.tableRows.push(Array.from({ length: colCount }, () => ''));
  group.tableRowHeights = group.tableRowHeights || [];
  group.tableRowHeights.push(48);
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorAddTableColumn(index) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group || group.type !== 'table_completion') return;
  group.tableHeaders = group.tableHeaders?.length ? group.tableHeaders : ['Notes', 'Details'];
  if (group.tableHeaders.length >= CREATOR_LIMITS.maxOptions) {
    notify('warning', 'Tables can have at most 9 columns in the creator.');
    return;
  }
  group.tableHeaders.push(`Column ${group.tableHeaders.length + 1}`);
  group.tableColumnWidths = group.tableColumnWidths || group.tableHeaders.map(() => 180);
  group.tableColumnWidths.push(180);
  (group.tableRows || []).forEach(row => row.push(''));
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorRemoveTableRow(index, rowIndex) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group || !group.tableRows) return;
  group.tableRows.splice(rowIndex, 1);
  if (group.tableRowHeights) group.tableRowHeights.splice(rowIndex, 1);
  creatorSyncTableQuestions(index);
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorRemoveTableColumn(index, colIndex) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group || !group.tableHeaders) return;
  if (group.tableHeaders.length <= 1) {
    notify('warning', 'A table must have at least one column.');
    return;
  }
  group.tableHeaders.splice(colIndex, 1);
  if (group.tableColumnWidths) group.tableColumnWidths.splice(colIndex, 1);
  (group.tableRows || []).forEach(row => row.splice(colIndex, 1));
  creatorSyncTableQuestions(index);
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorDeleteCurrentTableRow(index) {
  if (!creatorActiveTableCell || creatorActiveTableCell.index !== index) {
    notify('warning', 'Click inside a cell first to set the target row.');
    return;
  }
  creatorRemoveTableRow(index, creatorActiveTableCell.ri);
}

function creatorDeleteCurrentTableColumn(index) {
  if (!creatorActiveTableCell || creatorActiveTableCell.index !== index) {
    notify('warning', 'Click inside a cell first to set the target column.');
    return;
  }
  creatorRemoveTableColumn(index, creatorActiveTableCell.ci);
}

function creatorUpdateTableColumnWidth(index, colIndex, value) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group) return;
  group.tableColumnWidths = group.tableColumnWidths || [];
  group.tableColumnWidths[colIndex] = Math.max(50, Math.min(600, Number(value) || 180));
  creatorDirty = true;
}

function creatorUpdateTableRowHeight(index, rowIndex, value) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group) return;
  group.tableRowHeights = group.tableRowHeights || [];
  group.tableRowHeights[rowIndex] = Math.max(28, Math.min(180, Number(value) || 48));
  creatorDirty = true;
}

function creatorIsCellCovered(group, ri, ci) {
  if (!group.tableCellMerge) return false;
  for (const [key, merge] of Object.entries(group.tableCellMerge)) {
    const [mri, mci] = key.split('-').map(Number);
    if (mri === ri && mci === ci) continue; // It is the merge origin
    if (ri >= mri && ri < mri + merge.rowspan && ci >= mci && ci < mci + merge.colspan) {
      return true;
    }
  }
  return false;
}

function creatorMergeTableCellRight(index, ri, ci) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group) return;
  const colCount = group.tableHeaders.length;
  if (ci >= colCount - 1) {
    notify('warning', 'Cannot merge right: last column reached.');
    return;
  }

  group.tableCellMerge = group.tableCellMerge || {};
  const cellKey = `${ri}-${ci}`;
  const current = group.tableCellMerge[cellKey] || { colspan: 1, rowspan: 1 };
  const targetCol = ci + current.colspan;
  if (targetCol >= colCount) {
    notify('warning', 'Cannot merge right: last column reached.');
    return;
  }

  // Append content from all cells that will be merged
  for (let r = ri; r < ri + current.rowspan; r++) {
    const targetVal = group.tableRows[r][targetCol];
    if (targetVal && targetVal !== '#merged') {
      group.tableRows[ri][ci] = (group.tableRows[ri][ci] + ' ' + targetVal).trim();
    }
    group.tableRows[r][targetCol] = '#merged';
  }

  current.colspan += 1;
  group.tableCellMerge[cellKey] = current;
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorMergeTableCellDown(index, ri, ci) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group) return;
  const rowCount = group.tableRows.length;
  if (ri >= rowCount - 1) {
    notify('warning', 'Cannot merge down: last row reached.');
    return;
  }

  group.tableCellMerge = group.tableCellMerge || {};
  const cellKey = `${ri}-${ci}`;
  const current = group.tableCellMerge[cellKey] || { colspan: 1, rowspan: 1 };
  const targetRow = ri + current.rowspan;
  if (targetRow >= rowCount) {
    notify('warning', 'Cannot merge down: last row reached.');
    return;
  }

  // Append content from all cells that will be merged
  for (let c = ci; c < ci + current.colspan; c++) {
    const targetVal = group.tableRows[targetRow][c];
    if (targetVal && targetVal !== '#merged') {
      group.tableRows[ri][ci] = (group.tableRows[ri][ci] + ' ' + targetVal).trim();
    }
    group.tableRows[targetRow][c] = '#merged';
  }

  current.rowspan += 1;
  group.tableCellMerge[cellKey] = current;
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorSplitTableCell(index, ri, ci) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group) return;

  group.tableCellMerge = group.tableCellMerge || {};
  const cellKey = `${ri}-${ci}`;
  const current = group.tableCellMerge[cellKey];
  if (!current) return; // not merged

  // Restore '#merged' cells to empty strings
  for (let r = ri; r < ri + current.rowspan; r++) {
    for (let c = ci; c < ci + current.colspan; c++) {
      if (r === ri && c === ci) continue;
      group.tableRows[r][c] = '';
    }
  }

  delete group.tableCellMerge[cellKey];
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorToggleTableCellStyle(index, rowIndex, cellIndex, field) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group) return;
  group.tableCellStyles = group.tableCellStyles || {};
  const key = `${rowIndex}-${cellIndex}`;
  group.tableCellStyles[key] = group.tableCellStyles[key] || {};
  group.tableCellStyles[key][field] = !group.tableCellStyles[key][field];
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorAddTableCellBullet(index, ri, ci) {
  const el = document.querySelector(`.creator-table-cell-editable-redesign[data-row="${ri}"][data-cell="${ci}"]`);
  if (!el) return;
  el.focus();
  document.execCommand('insertText', false, '\n• Bullet point');
  creatorUpdateTableCell(index, ri, ci, el);
  renderCreatorPanel();
}

function creatorAddTableCellSubheading(index, ri, ci) {
  const el = document.querySelector(`.creator-table-cell-editable-redesign[data-row="${ri}"][data-cell="${ci}"]`);
  if (!el) return;
  el.focus();
  document.execCommand('insertText', false, '\n### Subheading');
  creatorUpdateTableCell(index, ri, ci, el);
  renderCreatorPanel();
}

function creatorSetTableCellStyle(index, rowIndex, cellIndex, field, value) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group) return;
  group.tableCellStyles = group.tableCellStyles || {};
  const key = `${rowIndex}-${cellIndex}`;
  group.tableCellStyles[key] = group.tableCellStyles[key] || {};
  group.tableCellStyles[key][field] = value;
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorToolbarAction(index, action, ...args) {
  if (!creatorActiveTableCell || creatorActiveTableCell.index !== index) {
    notify('warning', 'Please click inside a table cell first to apply formatting.');
    return;
  }
  const { ri, ci } = creatorActiveTableCell;
  if (action === 'bold') {
    creatorToggleTableCellStyle(index, ri, ci, 'bold');
  } else if (action === 'italic') {
    creatorToggleTableCellStyle(index, ri, ci, 'italic');
  } else if (action === 'bullet') {
    creatorAddTableCellBullet(index, ri, ci);
  } else if (action === 'subheading') {
    creatorAddTableCellSubheading(index, ri, ci);
  } else if (action === 'align') {
    creatorSetTableCellStyle(index, ri, ci, 'align', args[0]);
  } else if (action === 'merge-right') {
    creatorMergeTableCellRight(index, ri, ci);
  } else if (action === 'merge-down') {
    creatorMergeTableCellDown(index, ri, ci);
  } else if (action === 'split') {
    creatorSplitTableCell(index, ri, ci);
  }
}
function creatorRemoveFlowNode(index, nodeIndex) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group?.questions?.length) return;

  if (nodeIndex !== undefined) {
    // Remove specific node by index
    const removed = group.questions.splice(nodeIndex, 1)[0];
    if (removed?.number) delete creatorState.answerKey[String(removed.number)];
  } else {
    // Remove last node (legacy behavior)
    const removed = group.questions.pop();
    if (removed?.number) delete creatorState.answerKey[String(removed.number)];
  }

  syncCreatorGroupRangeFromQuestions(group);
  if (part) part.questionRange = combineCreatorRanges(part.questionGroups);
  creatorDirty = true;
  renderCreatorPanel();
}
function creatorUpdateFlowNodeText(index, nodeIndex, elementOrText) {
  const group = getCreatorPart()?.questionGroups[index];
  const node = group?.questions?.[nodeIndex] || group?.flowNodes?.[nodeIndex];
  if (!node) return;

  if (typeof elementOrText === 'string') {
    node.statement = elementOrText;
    node.text = elementOrText;
  } else {
    const text = extractTextFromContentEditable(elementOrText);
    node.statement = text;
    node.text = text;
  }

  const nums = getCreatorQuestionNumbersForGroup(group);
  if (nums.length) {
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    group.questionRange = nums.length === 1 ? String(min) : `${min}-${max}`;
  } else {
    group.questionRange = '';
  }

  creatorDirty = true;
}
function creatorUpdateFlowNodeColor(index, nodeIndex, value) {
  const group = getCreatorPart()?.questionGroups[index];
  const node = group?.questions?.[nodeIndex] || group?.flowNodes?.[nodeIndex];
  if (!node) return;
  node.color = value;
  creatorDirty = true;
  renderCreatorPanel();
}
function creatorUpdateFlowNodeArrow(index, nodeIndex, value) {
  const group = getCreatorPart()?.questionGroups[index];
  const node = group?.questions?.[nodeIndex] || group?.flowNodes?.[nodeIndex];
  if (!node) return;
  node.arrow = value;
  creatorDirty = true;
  renderCreatorPanel();
}
function creatorMoveFlowNode(index, nodeIndex, direction) {
  const group = getCreatorPart()?.questionGroups[index];
  const nodes = group?.questions || group?.flowNodes;
  if (!nodes) return;

  const targetIndex = nodeIndex + direction;
  if (targetIndex < 0 || targetIndex >= nodes.length) return;

  const temp = nodes[nodeIndex];
  nodes[nodeIndex] = nodes[targetIndex];
  nodes[targetIndex] = temp;

  creatorDirty = true;
  renderCreatorPanel();
}
function creatorUpdateFlowNodeSize(index, nodeIndex, field, value) {
  const group = getCreatorPart()?.questionGroups[index];
  const node = group?.questions?.[nodeIndex] || group?.flowNodes?.[nodeIndex];
  if (!node || !['width', 'height'].includes(field)) return;
  const min = field === 'width' ? 90 : 44;
  const max = field === 'width' ? 360 : 220;
  node[field] = Math.max(min, Math.min(max, Number(value) || (field === 'width' ? 180 : 66)));
  creatorDirty = true;
}
function creatorUpdateFlowNodeBranch(index, nodeIndex, value) {
  const group = getCreatorPart()?.questionGroups[index];
  const node = group?.questions?.[nodeIndex] || group?.flowNodes?.[nodeIndex];
  if (!node) return;
  const num = Number(value);
  node.branchTo = Number.isInteger(num) && num > 0 ? num : '';
  creatorDirty = true;
}

function creatorStartFlowNodeResize(e, index, nodeIndex, direction) {
  e.preventDefault();
  const group = getCreatorPart()?.questionGroups[index];
  const node = group?.questions?.[nodeIndex];
  if (!node) return;

  const startX = e.clientX;
  const startY = e.clientY;
  const startWidth = Number(node.width || 180);
  const startHeight = Number(node.height || 66);

  const handleMouseMove = (moveEvent) => {
    const deltaX = moveEvent.clientX - startX;
    const deltaY = moveEvent.clientY - startY;

    if (direction === 'right' || direction === 'both') {
      const newWidth = Math.max(90, Math.min(360, startWidth + deltaX));
      node.width = newWidth;
    }
    if (direction === 'bottom' || direction === 'both') {
      const newHeight = Math.max(44, Math.min(220, startHeight + deltaY));
      node.height = newHeight;
    }

    creatorDirty = true;
    renderCreatorPanel();
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

function creatorStartTableColumnResize(e, index, colIndex) {
  e.preventDefault();
  const group = getCreatorPart()?.questionGroups[index];
  if (!group) return;

  const colWidths = group.tableColumnWidths || [];
  const startX = e.clientX;
  const startWidth = Number(colWidths[colIndex] || 50);
  let renderTimeout = null;

  const handleMouseMove = (moveEvent) => {
    const deltaX = moveEvent.clientX - startX;
    const newWidth = Math.max(8, Math.min(90, startWidth + (deltaX * 0.5)));
    colWidths[colIndex] = newWidth;
    group.tableColumnWidths = colWidths;
    creatorDirty = true;

    // Debounce render to improve performance
    if (renderTimeout) clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => renderCreatorPanel(), 50);
  };

  const handleMouseUp = () => {
    if (renderTimeout) clearTimeout(renderTimeout);
    renderCreatorPanel();
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

function creatorStartTableRowResize(e, index, rowIndex) {
  e.preventDefault();
  const group = getCreatorPart()?.questionGroups[index];
  if (!group) return;

  const rowHeights = group.tableRowHeights || [];
  const startY = e.clientY;
  const startHeight = Number(rowHeights[rowIndex] || 48);
  let renderTimeout = null;

  const handleMouseMove = (moveEvent) => {
    const deltaY = moveEvent.clientY - startY;
    const newHeight = Math.max(24, Math.min(200, startHeight + (deltaY * 0.5)));
    rowHeights[rowIndex] = newHeight;
    group.tableRowHeights = rowHeights;
    creatorDirty = true;

    // Debounce render to improve performance
    if (renderTimeout) clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => renderCreatorPanel(), 50);
  };

  const handleMouseUp = () => {
    if (renderTimeout) clearTimeout(renderTimeout);
    renderCreatorPanel();
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

function creatorUpdateMatchingStatement(index, qIndex, value) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group?.questions?.[qIndex]) return;
  group.questions[qIndex].statement = value;
  group.questions[qIndex].stem = value;
  creatorDirty = true;
  // For matching_endings, update the display in real time
  if (group.type === 'matching_endings') {
    renderCreatorPanel();
  }
}

function creatorUpdateMatchingOption(index, optIndex, value) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group || !group.options) return;
  const letter = String.fromCharCode(65 + optIndex);
  group.options[optIndex] = `${letter}. ${value.trim()}`;
  creatorDirty = true;
  renderCreatorPanel();
}
function creatorAddMatchingOption(index) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group) return;
  group.options = group.options || [];

  // Check maximum options limit for matching types
  if ((group.type === 'matching_features' || group.type === 'matching_endings' || group.type === 'matching_information') && group.options.length >= 8) {
    notify('warning', 'Maximum 8 options allowed for this question type.');
    return;
  }

  const nextLetter = String.fromCharCode(65 + group.options.length);
  group.options.push(`${nextLetter}. New option`);
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorRemoveMatchingOption(index, optIndex) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group || !group.options) return;
  const letterToDelete = String.fromCharCode(65 + optIndex);

  const isAssigned = (group.questions || []).some(q => {
    return creatorState.answerKey[String(q.number)] === letterToDelete;
  });
  if (isAssigned) {
    notify('warning', `Option ${letterToDelete} cannot be deleted because it is mapped to a question.`);
    return;
  }

  group.options.splice(optIndex, 1);

  group.options = group.options.map((opt, i) => {
    const letter = String.fromCharCode(65 + i);
    return `${letter}. ${String(opt).replace(/^[A-Z][.)]\s+/, '')}`;
  });

  // Shift answers down for letters greater than the deleted letter
  (group.questions || []).forEach(q => {
    const ans = creatorState.answerKey[String(q.number)];
    if (ans && ans.charCodeAt(0) > letterToDelete.charCodeAt(0)) {
      creatorState.answerKey[String(q.number)] = String.fromCharCode(ans.charCodeAt(0) - 1);
    }
  });

  creatorDirty = true;
  renderCreatorPanel();
}
function creatorUpdateShortAnswerStatement(index, qIndex, value) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group?.questions?.[qIndex]) return;
  group.questions[qIndex].statement = value;
  creatorDirty = true;
}

function creatorUpdateSetField(index, field, value) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group) return;
  if (field === 'instructions') group.instructions = value;
  else if (field === 'summaryText') group.summaryText = value;
  else if (field === 'bodyText') {
    if (group.type === 'note_completion') group.noteText = value;
    else {
      // For sentence_completion, short_answer, flowchart_completion, rebuild questions from lines
      const lines = value.split('\n').filter(Boolean);
      group.questions = lines.map((line, i) => {
        const num = group.questions[i]?.number || (parseCreatorRange(group.questionRange)?.numbers[i] || i + 1);
        const match = line.match(/^(?:\d+[.)]\s*)?(.*)/);
        return { ...(group.questions[i] || {}), number: num, statement: (match ? match[1] : line).trim() || `___${num}___` };
      });
    }
  } else if (field === 'selectCount') group.selectCount = value;
  creatorDirty = true;
}

function creatorUpdateSetRange(index, value) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group) return;

  const newRange = parseCreatorRange(value);
  if (!newRange) {
    notify('warning', 'Invalid range format. Use "5" or "1-5".');
    return;
  }

  const oldRange = parseCreatorRange(group.questionRange);
  const currentCountWithoutGroup = getCreatorPartQuestionCount(part) - getCreatorQuestionNumbersForGroup(group).length;
  if (currentCountWithoutGroup + newRange.numbers.length > CREATOR_LIMITS.maxQuestionsPerPart) {
    notify('warning', `Each part can have at most ${CREATOR_LIMITS.maxQuestionsPerPart} questions. Delete an existing question before expanding this range.`);
    return;
  }
  group.questionRange = newRange.label;

  // Update answer keys
  if (oldRange && creatorState) {
    oldRange.numbers.forEach(num => delete creatorState.answerKey[String(num)]);
    newRange.numbers.forEach(num => {
      if (!creatorState.answerKey[String(num)]) {
        creatorState.answerKey[String(num)] = '[Answer]';
      }
    });
  }

  // Adjust questions array to match new range
  const currentQuestions = group.questions || [];
  group.questions = newRange.numbers.map((num, i) => {
    return currentQuestions[i] || { number: num, statement: '', stem: '' };
  });

  applyCreatorHeadingMarkers(part);
  part.questionRange = combineCreatorRanges(part.questionGroups);
  creatorDirty = true;
  renderCreatorPanel();
  notify('success', `Range updated to ${newRange.label}`);
}

function creatorUpdateSetQuestions(index, value) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group) return;
  const lines = value.split('\n').filter(Boolean);
  const range = parseCreatorRange(group.questionRange);
  const numbers = range?.numbers || [];
  const nextQuestions = lines.map((line, i) => {
    const num = numbers[i] || i + 1;
    const match = line.match(/^(\d{1,2})(?:[\.)=])\s*(.*)/);
    if (match) return { number: Number(match[1]), statement: match[2].trim(), stem: match[2].trim(), section: match[2].trim() };
    return { number: num, statement: line.trim(), stem: line.trim(), section: line.trim() };
  });
  const currentCountWithoutGroup = getCreatorPartQuestionCount(part) - getCreatorQuestionNumbersForGroup(group).length;
  const nextCount = Array.from(new Set(nextQuestions.map(q => q.number))).length;
  if (currentCountWithoutGroup + nextCount > CREATOR_LIMITS.maxQuestionsPerPart) {
    notify('warning', `Each part can have at most ${CREATOR_LIMITS.maxQuestionsPerPart} questions. Delete an existing question before adding more.`);
    return;
  }
  group.questions = nextQuestions;
  applyCreatorHeadingMarkers(part);
  creatorDirty = true;
}

function creatorUpdateSetHeadingOptions(index, value) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group) return;
  group.headingOptions = value.split('\n').filter(Boolean);
  creatorDirty = true;
}

function creatorUpdateSetOptions(index, value) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group) return;
  group.options = value.split('\n').filter(Boolean);
  creatorDirty = true;
}

function creatorUpdateSetMCQ(index, value) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group) return;

  // Parse seamless format with <br> tags
  const questions = [];
  const questionBlocks = value.split(/\d+\.\s+/).filter(Boolean);
  const range = parseCreatorRange(group.questionRange);
  const numbers = range?.numbers || [];

  questionBlocks.forEach((block, blockIndex) => {
    const parts = block.split(/<br\s*\/?>/i).map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return;

    const stem = parts[0];
    const options = parts.slice(1)
      .filter(line => /^[A-Z][.)]\s+/.test(line))
      .map(opt => opt.replace(/^[A-Z][. )]\s*/, '').trim());

    questions.push({
      number: numbers[blockIndex] || (blockIndex + 1),
      stem: stem,
      options: options.length ? options : ['Option A', 'Option B', 'Option C', 'Option D']
    });
  });

  group.questions = questions.length ? questions : [{ number: numbers[0] || 1, stem: '', options: ['A.', 'B.', 'C.', 'D.'] }];
  creatorDirty = true;
}

function creatorUpdateSetTableHeaders(index, value) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group) return;
  group.tableHeaders = value.split('|').map(s => s.trim()).filter(Boolean);
  const colCount = Math.max(1, group.tableHeaders.length);
  group.tableColumnWidths = (group.tableColumnWidths || []).slice(0, colCount);
  while (group.tableColumnWidths.length < colCount) group.tableColumnWidths.push(180);
  (group.tableRows || []).forEach(row => {
    while (row.length < colCount) row.push('');
    if (row.length > colCount) row.length = colCount;
  });
  creatorSyncTableQuestions(index);
  creatorDirty = true;
}

function creatorUpdateSetTableRows(index, value) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group) return;
  const rows = value.split('\n').filter(Boolean).map(row => row.split('|').map(c => c.trim()));
  const gapNums = [];
  rows.forEach(row => row.forEach(cell => {
    for (const match of String(cell || '').matchAll(/_{2,}(\d+)_{2,}/g)) {
      const num = Number(match[1]);
      if (Number.isInteger(num) && !gapNums.includes(num)) gapNums.push(num);
    }
  }));
  const currentCountWithoutGroup = getCreatorPartQuestionCount(part) - getCreatorQuestionNumbersForGroup(group).length;
  if (currentCountWithoutGroup + gapNums.length > CREATOR_LIMITS.maxQuestionsPerPart) {
    notify('warning', `Each part can have at most ${CREATOR_LIMITS.maxQuestionsPerPart} questions. Delete an existing question before adding more table gaps.`);
    return;
  }
  group.tableRows = rows;
  creatorSyncTableQuestions(index);
  creatorDirty = true;
}

function creatorUpdateSetLabels(index, value) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group) return;
  const lines = value.split('\n').filter(Boolean);
  const range = parseCreatorRange(group.questionRange);
  const numbers = range?.numbers || [];
  group.questions = lines.map((line, i) => ({ number: numbers[i] || i + 1, statement: line.trim() }));
  creatorDirty = true;
}

function creatorUpdateSetDiagram(index, input) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group) return;

  if (input === null) {
    group.diagramImage = '';
    creatorDirty = true;
    renderCreatorPanel();
    return;
  }

  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    group.diagramImage = reader.result;
    creatorDirty = true;
    renderCreatorPanel();
  };
  reader.readAsDataURL(file);
}

function creatorUpdateDiagramGapCount(index, value) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group) return;

  const newCount = Math.max(1, Math.min(9, parseInt(value) || 1));
  const currentCount = (group.questions || []).length;

  if (newCount > currentCount) {
    // Add gaps
    for (let i = currentCount; i < newCount; i++) {
      const nextNum = getCreatorNextQuestionNumber(part);
      if (nextNum) {
        group.questions.push({ number: nextNum, statement: `___${nextNum}___` });
        creatorState.answerKey[String(nextNum)] = '[Answer]';
      }
    }
  } else if (newCount < currentCount) {
    // Remove gaps
    const removed = group.questions.splice(newCount);
    removed.forEach(q => delete creatorState.answerKey[String(q.number)]);
  }

  syncCreatorGroupRangeFromQuestions(group);
  if (part) part.questionRange = combineCreatorRanges(part.questionGroups);
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorUpdateDiagramLabelText(index, qIndex, value) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group?.questions?.[qIndex]) return;

  const q = group.questions[qIndex];
  q.statement = `${value} ___${q.number}___`.trim();
  creatorDirty = true;
}

function creatorInsertGapInline(index, field) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group) return;
  const range = parseCreatorRange(group.questionRange);
  if (!range) { notify('warning', 'No valid range.'); return; }
  const textarea = document.querySelector(`[data-qs-card="${index}"] textarea`) || event?.target?.closest?.('.creator-qs-card')?.querySelector('textarea');
  // Find next unused gap number
  const body = group.summaryText || '';
  const used = Array.from(body.matchAll(/_{2,}(\d+)_{2,}/g)).map(m => Number(m[1]));
  const next = range.numbers.find(n => !used.includes(n));
  if (!next) { notify('warning', 'All gaps inserted.'); return; }
  group.summaryText = (group.summaryText || '') + `___${next}___`;
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorInsertGapInlineBody(index) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group) return;
  const range = parseCreatorRange(group.questionRange);
  if (!range) { notify('warning', 'No valid range.'); return; }
  const text = group.noteText || group.questions.map(q => q.statement).join('\n') || '';
  const used = Array.from(text.matchAll(/_{2,}(\d+)_{2,}/g)).map(m => Number(m[1]));
  const next = range.numbers.find(n => !used.includes(n));
  if (!next) { notify('warning', 'All gaps inserted.'); return; }
  // Append to bodyText field
  const field = group.type === 'note_completion' ? 'noteText' : 'bodyText';
  if (field === 'noteText') group.noteText = (group.noteText || '') + ` ___${next}___`;
  else {
    // For sentence/flowchart, append to last question
    const last = group.questions[group.questions.length - 1];
    if (last) last.statement += ` ___${next}___`;
  }
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorSetAnswer(num, value) {
  if (!creatorState) return;
  const val = value.trim();

  let needsRender = false;
  const part = getCreatorPart();

  if (part) {
    for (const group of part.questionGroups) {
      if (group.type === 'heading_match') {
        const numbers = getCreatorQuestionNumbersForGroup(group);
        if (numbers.includes(num)) {
          if (val) {
            numbers.forEach(n => {
              if (n !== num && creatorState.answerKey[String(n)] === val) {
                creatorState.answerKey[String(n)] = '';
                needsRender = true;
              }
            });
          }
          break;
        }
      } else if (group.type === 'multiple_choice' && Number(group.selectCount || 1) > 1) {
        const numbers = getCreatorQuestionNumbersForGroup(group);
        if (numbers.includes(num)) {
          numbers.forEach(n => {
            if (creatorState.answerKey[String(n)] !== val) {
              creatorState.answerKey[String(n)] = val;
              needsRender = true;
            }
          });
          break;
        }
      }
    }
  }

  creatorState.answerKey[String(num)] = val;
  creatorDirty = true;
  if (needsRender) {
    renderCreatorPanel();
  }
}

function creatorInsertGapAtCursor(index, context) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group) return;

  const nextNum = getCreatorNextQuestionNumber(part);
  if (!nextNum) {
    notify('warning', 'No more question numbers available.');
    return;
  }

  const sel = window.getSelection();
  if (!sel.rangeCount) {
    notify('warning', 'Place the cursor inside the text area first.');
    return;
  }

  const range = sel.getRangeAt(0);
  let container = sel.anchorNode;
  while (container && container.nodeType !== 1) container = container.parentNode;

  // Check more specific classes first (flowchart node has both classes, check it first)
  const isFlowchart = container?.classList.contains('creator-flowchart-node-editable');
  const isSummary = !isFlowchart && container?.classList.contains('wysiwyg-editable-summary');
  const isTableCell = container?.classList.contains('creator-table-cell-editable') || container?.classList.contains('creator-table-cell-editable-redesign');
  const isSentence = container?.classList.contains('creator-sentence-editable');
  const isDiagram = container?.classList.contains('creator-diagram-label-editable');

  if (!container || (!isSummary && !isTableCell && !isSentence && !isDiagram && !isFlowchart)) {
    notify('warning', 'Place the cursor inside the text area first.');
    return;
  }

  const span = document.createElement('span');
  span.className = 'wysiwyg-gap-inline';
  span.contentEditable = 'false';
  span.innerHTML = `<span class="gap-num">${nextNum}</span>`;

  range.deleteContents();
  range.insertNode(span);

  const space = document.createTextNode('\u00A0'); // Non-breaking space
  span.after(space);

  range.setStartAfter(space);
  range.setEndAfter(space);
  sel.removeAllRanges();
  sel.addRange(range);

  // Handle in order of most-specific first to avoid flowchart nodes matching summary check
  if (isFlowchart) {
    const nodeIndex = Number(container.getAttribute('data-node-index'));
    creatorUpdateFlowNodeText(index, nodeIndex, container);
    renderCreatorPanel();
  } else if (isSummary) {
    creatorUpdateSummaryText(index, container);
    renderCreatorPanel();
  } else if (isTableCell) {
    const row = Number(container.getAttribute('data-row'));
    const cell = Number(container.getAttribute('data-cell'));
    creatorUpdateTableCell(index, row, cell, container);
    renderCreatorPanel();
  } else if (isSentence) {
    const qIndex = Number(container.getAttribute('data-qindex'));
    creatorUpdateSentenceStatement(index, qIndex, container);
    renderCreatorPanel();
  } else if (isDiagram) {
    const qIndex = Number(container.getAttribute('data-qindex'));
    creatorUpdateDiagramLabel(index, qIndex, container);
  }
}

function creatorToggleAnswers(index) {
  if (!window._creatorAnswersOpen) window._creatorAnswersOpen = {};
  window._creatorAnswersOpen[index] = !window._creatorAnswersOpen[index];
  renderCreatorPanel();
}

function creatorRemoveQuestionSet(index) {
  const part = getCreatorPart();
  if (!part?.questionGroups[index]) return;
  const removed = part.questionGroups.splice(index, 1)[0];
  getCreatorQuestionNumbersForGroup(removed).forEach(num => delete creatorState.answerKey[num]);
  applyCreatorHeadingMarkers(part);
  part.questionRange = combineCreatorRanges(part.questionGroups);
  creatorDirty = true;
  creatorShowTypePicker = false;
  renderCreatorPanel();
}

function creatorAddQuestionToSet(index) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group) return;

  // Check type-specific limits
  if (group.type === 'matching_features' && (group.questions || []).length >= 7) {
    notify('warning', 'Matching Features questions are limited to 7 maximum.');
    return;
  }
  if (group.type === 'matching_endings' && (group.questions || []).length >= 8) {
    notify('warning', 'Matching Endings questions are limited to 8 maximum.');
    return;
  }
  if (group.type === 'sentence_completion' && (group.questions || []).length >= 8) {
    notify('warning', 'Sentence Completion questions are limited to 8 maximum.');
    return;
  }
  if (group.type === 'matching_information' && (group.questions || []).length >= 8) {
    notify('warning', 'Matching Information questions are limited to 8 maximum.');
    return;
  }
  if (group.type === 'short_answer' && (group.questions || []).length >= 8) {
    notify('warning', 'Short Answer questions are limited to 8 maximum.');
    return;
  }

  if (getCreatorPartQuestionCount(part) >= CREATOR_LIMITS.maxQuestionsPerPart) {
    notify('warning', `Each part can have at most ${CREATOR_LIMITS.maxQuestionsPerPart} questions.`);
    return;
  }

  const nextNum = getCreatorNextQuestionNumber(part);
  if (!nextNum) {
    notify('warning', 'No more question numbers available.');
    return;
  }

  let nextSection = 'A';
  if (group.type === 'heading_match') {
    const usedSections = new Set(
      (group.questions || []).map(q => q.section).filter(Boolean)
    );
    // Also exclude the example section
    if (group.exampleSection) usedSections.add(group.exampleSection);
    const availableSections = part.passage.sections
      .map((_, i) => String.fromCharCode(65 + i))
      .filter(s => !usedSections.has(s));
    if (availableSections.length === 0) {
      notify('warning', 'All sections are already mapped. Add more passage sections first.');
      return;
    }
    nextSection = availableSections[0];
  }

  const newQuestion = { number: nextNum, statement: '', stem: '', section: nextSection };
  if (group.type === 'multiple_choice') {
    newQuestion.options = ['', '', '', ''];
  }

  if (!group.questions) group.questions = [];
  group.questions.push(newQuestion);

  if (creatorState) {
    creatorState.answerKey[String(nextNum)] = '[Answer]';
  }

  // Ensure questions stay sorted by number
  creatorSortGroupQuestions(group);

  syncCreatorGroupRangeFromQuestions(group);
  applyCreatorHeadingMarkers(part);
  part.questionRange = combineCreatorRanges(part.questionGroups);

  creatorDirty = true;
  renderCreatorPanel();
}

function creatorSortGroupQuestions(group) {
  // Sort questions by their current number (does not reassign numbers)
  if (!group || !group.questions || !group.questions.length) return;
  group.questions.sort((a, b) => (a.number || 0) - (b.number || 0));
}


function creatorRenumberAllPartQuestions(part) {
  // Renumber ALL questions across ALL groups in the part sequentially starting from 1.
  // This ensures that deleting Q1 correctly shifts Q2→Q1, Q3→Q2, etc.
  if (!part || !creatorState) return;

  // Collect all questions in order across groups (groups are already in display order)
  const allQuestions = [];
  for (const group of (part.questionGroups || [])) {
    const qs = group.questions || [];
    qs.sort((a, b) => (a.number || 0) - (b.number || 0));
    for (const q of qs) {
      allQuestions.push({ q, group });
    }
  }

  // Build a mapping from old number → answer, so we can reassign after renumbering
  const oldAnswerKey = { ...creatorState.answerKey };

  // Assign sequential numbers and migrate answer keys
  let nextNum = 1;
  for (const { q } of allQuestions) {
    const oldNum = q.number;
    const newNum = nextNum++;
    if (oldNum !== newNum) {
      // Migrate answer key entry
      if (oldAnswerKey[String(oldNum)] !== undefined) {
        creatorState.answerKey[String(newNum)] = oldAnswerKey[String(oldNum)];
        // Only delete the old key if it won't be overwritten by a later migration
        delete creatorState.answerKey[String(oldNum)];
      } else if (creatorState.answerKey[String(oldNum)] !== undefined) {
        delete creatorState.answerKey[String(oldNum)];
      }
      q.number = newNum;
    }
  }
}

function creatorRemoveQuestionFromSet(index, qIndex) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group || !group.questions?.[qIndex]) return;

  const removed = group.questions.splice(qIndex, 1)[0];
  if (removed?.number && creatorState) {
    delete creatorState.answerKey[String(removed.number)];
  }

  // Renumber ALL groups in the part sequentially to close any gaps
  creatorRenumberAllPartQuestions(part);

  // Sync ranges for each group
  for (const g of (part.questionGroups || [])) {
    syncCreatorGroupRangeFromQuestions(g);
  }
  applyCreatorHeadingMarkers(part);
  part.questionRange = combineCreatorRanges(part.questionGroups);

  creatorDirty = true;
  renderCreatorPanel();
}


function creatorSetTFNGVariant(index, isYN) {
  const group = getCreatorPart()?.questionGroups[index];
  if (!group) return;

  const oldType = group.type;
  const newType = isYN ? 'yes_no_notgiven' : 'true_false_notgiven';
  if (oldType !== newType) {
    const map = isYN
      ? { 'TRUE': 'YES', 'FALSE': 'NO' }
      : { 'YES': 'TRUE', 'NO': 'FALSE' };

    (group.questions || []).forEach(q => {
      if (q.number) {
        const current = String(creatorState.answerKey[String(q.number)] || '').toUpperCase();
        if (map[current]) {
          creatorState.answerKey[String(q.number)] = map[current];
        }
      }
    });
  }

  group.type = newType;
  creatorDirty = true;
  renderCreatorPanel();
}

function renderCreatorBottomNav() {
  const partsEl = document.getElementById('nav-parts');
  const questionsEl = document.getElementById('nav-questions');
  if (!partsEl || !questionsEl || !creatorState) return;
  partsEl.innerHTML = creatorState.parts.map((part, index) => {
    const active = index === creatorCurrentPartIndex ? ' active' : '';
    return `<button class="nav-part-btn${active}" type="button" onclick="creatorSwitchPart(${index})">Part ${part.partNumber}</button>`;
  }).join('');
  // The creator doesn't have a functional per-question nav (unlike the live test), so leave this empty.
  questionsEl.innerHTML = '';
}

function creatorTypeChanged() {
  const type = document.getElementById('creator-group-type')?.value || '';
  const completionTypes = new Set(['summary_completion', 'sentence_completion', 'note_completion', 'table_completion', 'flowchart_completion', 'diagram_completion', 'short_answer']);
  const optionTypes = new Set(['heading_match', 'multiple_choice', 'summary_completion', 'matching_features', 'matching_endings', 'matching_information']);
  document.getElementById('creator-body-wrap').style.display = completionTypes.has(type) ? '' : 'none';
  document.getElementById('creator-gap-actions')?.classList.toggle('is-hidden', !completionTypes.has(type));
  document.getElementById('creator-options-wrap').style.display = optionTypes.has(type) ? '' : 'none';
  document.getElementById('creator-diagram-wrap').style.display = type === 'diagram_completion' ? '' : 'none';
  const selectCount = document.getElementById('creator-select-count');
  if (selectCount) selectCount.disabled = type !== 'multiple_choice';
  creatorSyncGapState();
}

function creatorSyncGapState() {
  const status = document.getElementById('creator-gap-status');
  if (!status) return;
  const range = parseCreatorRange(document.getElementById('creator-group-range')?.value || '');
  if (!range) {
    status.textContent = 'Enter a range like 1-5 before inserting gaps.';
    return;
  }
  const body = document.getElementById('creator-group-body')?.value || '';
  const used = Array.from(body.matchAll(/_{2,}(\d+)_{2,}/g)).map(match => Number(match[1]));
  const next = range.numbers.find(num => !used.includes(num));
  status.textContent = next ? `Next gap: ${next}` : 'All gaps in this range have been inserted.';
}

function creatorUpdateTitle(value) {
  const part = getCreatorPart();
  if (!part) return;
  part.passage.title = value.trim() || `Untitled Reading Passage ${part.partNumber}`;
  creatorDirty = true;
}

function creatorUpdateSubtitle(value) {
  const part = getCreatorPart();
  if (!part) return;
  part.passage.subtitle = value.trim();
  creatorDirty = true;
}

function creatorUpdateSection(index, value) {
  const section = getCreatorPart()?.passage.sections[index];
  if (!section) return;
  section.paragraphs = String(value || '').split(/\n{2,}/).map(text => text.trim()).filter(Boolean);
  if (!section.paragraphs.length) section.paragraphs = [''];
  creatorDirty = true;
}

function creatorAddSection() {
  const part = getCreatorPart();
  if (!part) return;
  if (part.passage.sections.length >= CREATOR_LIMITS.maxSections) {
    notify('warning', 'A part can have at most 10 sections, A-J.');
    return;
  }
  part.passage.sections.push({
    heading: String.fromCharCode(65 + part.passage.sections.length),
    paragraphs: [''],
    questionMarker: null
  });
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorRemoveSection(index) {
  const part = getCreatorPart();
  if (!part) return;

  const sectionLabel = String.fromCharCode(65 + index);

  // Check if mapped to a question for Matching Headings
  const isMappedToHeading = (part.questionGroups || []).some(group => {
    if (group.type !== 'heading_match') return false;
    return (group.questions || []).some(q => q.section === sectionLabel);
  });

  // Check if answer to a question for Matching Information
  const isAnswerToMatchingInfo = (part.questionGroups || []).some(group => {
    if (group.type !== 'matching_information') return false;
    return (group.questions || []).some(q => {
      const ans = creatorState?.answerKey?.[String(q.number)];
      return ans === sectionLabel;
    });
  });

  if (isMappedToHeading) {
    notify('warning', `Section ${sectionLabel} cannot be deleted because it is mapped to a Matching Headings question.`);
    return;
  }

  if (isAnswerToMatchingInfo) {
    notify('warning', `Section ${sectionLabel} cannot be deleted because it is the answer to a Matching Information question.`);
    return;
  }

  if (part.passage.sections.length <= 1) {
    notify('warning', 'A passage needs at least one section.');
    return;
  }
  part.passage.sections.splice(index, 1);
  relabelCreatorSections(part);
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorToggleSectionLabel(index) {
  // Labels are always on — sections always carry their letter heading.
  // This function is kept for backward compatibility but does nothing.
}

function creatorRemoveSectionLabels() {
  const part = getCreatorPart();
  if (!part) return;
  part.passage.sections.forEach(section => {
    section.heading = null;
    section.questionMarker = null;
    delete section.headingExample;
  });
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorSplitSelectionIntoSection() {
  const active = document.activeElement;
  if (!active?.classList?.contains('creator-section-text')) {
    notify('warning', 'Select text inside a passage section first.');
    return;
  }
  const part = getCreatorPart();
  if (!part) return;

  const index = Number(active.getAttribute('data-section-index'));
  const cursorStart = active.selectionStart;
  const cursorEnd = active.selectionEnd;

  let beforeText = '';
  let selectedText = '';
  let afterText = '';

  if (cursorStart === cursorEnd) {
    // Split at the cursor's location
    if (part.passage.sections.length >= CREATOR_LIMITS.maxSections) {
      notify('warning', 'A part can have at most 10 sections, A-J.');
      return;
    }
    beforeText = active.value.slice(0, cursorStart).trim();
    afterText = active.value.slice(cursorStart).trim();
    if (!beforeText && !afterText) {
      notify('warning', 'Move the cursor inside the text to split.');
      return;
    }

    const beforeParas = beforeText.split(/\n{2,}/).map(t => t.trim()).filter(Boolean);
    part.passage.sections[index].paragraphs = beforeParas.length ? beforeParas : [''];

    const afterParas = afterText.split(/\n{2,}/).map(t => t.trim()).filter(Boolean);
    part.passage.sections.splice(index + 1, 0, {
      heading: String.fromCharCode(65 + index + 1),
      paragraphs: afterParas.length ? afterParas : [''],
      questionMarker: null
    });
  } else {
    // Split: highlighted text becomes a section, and anything AFTER it becomes another section
    selectedText = active.value.slice(cursorStart, cursorEnd).trim();
    if (!selectedText) {
      notify('warning', 'Select the text that should become the new section.');
      return;
    }
    beforeText = active.value.slice(0, cursorStart).trim();
    afterText = active.value.slice(cursorEnd).trim();

    const newSections = [];

    // If beforeText is non-empty, current section stays as beforeText.
    // Otherwise, current section becomes selectedText.
    if (beforeText) {
      const beforeParas = beforeText.split(/\n{2,}/).map(t => t.trim()).filter(Boolean);
      part.passage.sections[index].paragraphs = beforeParas.length ? beforeParas : [''];

      // selectedText is pushed to the next section
      newSections.push({
        heading: '',
        paragraphs: selectedText.split(/\n{2,}/).map(t => t.trim()).filter(Boolean),
        questionMarker: null
      });
    } else {
      const selectedParas = selectedText.split(/\n{2,}/).map(t => t.trim()).filter(Boolean);
      part.passage.sections[index].paragraphs = selectedParas.length ? selectedParas : [''];
    }

    // If afterText is non-empty, it becomes the next section
    if (afterText) {
      newSections.push({
        heading: '',
        paragraphs: afterText.split(/\n{2,}/).map(t => t.trim()).filter(Boolean),
        questionMarker: null
      });
    }

    if (newSections.length > 0) {
      if (part.passage.sections.length + newSections.length > CREATOR_LIMITS.maxSections) {
        notify('warning', `Splitting would exceed the maximum limit of ${CREATOR_LIMITS.maxSections} sections.`);
        return;
      }
      part.passage.sections.splice(index + 1, 0, ...newSections);
    }
  }

  relabelCreatorSections(part);
  creatorDirty = true;
  renderCreatorPanel();
}

function relabelCreatorSections(part) {
  // Always assign A-J labels to all sections
  part.passage.sections.forEach((section, index) => {
    section.heading = String.fromCharCode(65 + index);
  });
}

function creatorAddPart() {
  if (!creatorState || creatorState.parts.length >= CREATOR_LIMITS.maxParts) {
    notify('warning', 'A manual test can have at most 3 parts.');
    return;
  }
  creatorState.parts.push(createCreatorPart(creatorState.parts.length + 1));
  creatorCurrentPartIndex = creatorState.parts.length - 1;
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorRemoveCurrentPart() {
  if (!creatorState || creatorState.parts.length <= 1) {
    notify('warning', 'A manual test needs at least one part.');
    return;
  }
  const removed = creatorState.parts.splice(creatorCurrentPartIndex, 1)[0];
  for (const group of removed.questionGroups || []) {
    getQuestionNumbersFromRange(group.questionRange).forEach(num => delete creatorState.answerKey[num]);
  }
  creatorState.parts.forEach((part, index) => {
    part.partNumber = index + 1;
  });
  creatorCurrentPartIndex = Math.max(0, Math.min(creatorCurrentPartIndex, creatorState.parts.length - 1));
  creatorDirty = true;
  renderCreatorPanel();
}

function creatorSwitchPart(index) {
  if (!creatorState?.parts[index]) return;
  creatorCurrentPartIndex = index;
  renderCreatorPanel();
}

function creatorResetGroupForm() {
  ['creator-group-range', 'creator-group-instructions', 'creator-group-options', 'creator-group-body', 'creator-group-questions', 'creator-answer-key-lines'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const select = document.getElementById('creator-select-count');
  if (select) select.value = '1';
  window.creatorDiagramImageData = '';
  creatorSyncGapState();
}

function creatorInsertGap() {
  const range = parseCreatorRange(document.getElementById('creator-group-range')?.value || '');
  const body = document.getElementById('creator-group-body');
  if (!range || !body) {
    notify('warning', 'Enter a valid question range before inserting gaps.');
    return;
  }
  const used = Array.from(body.value.matchAll(/_{2,}(\d+)_{2,}/g)).map(match => Number(match[1]));
  const next = range.numbers.find(num => !used.includes(num));
  if (!next) {
    notify('warning', 'All gaps in this range are already inserted.');
    return;
  }
  const insertion = `___${next}___`;
  const start = body.selectionStart ?? body.value.length;
  const end = body.selectionEnd ?? body.value.length;
  body.value = `${body.value.slice(0, start)}${insertion}${body.value.slice(end)}`;
  body.focus();
  body.selectionStart = body.selectionEnd = start + insertion.length;
  creatorSyncGapState();
}

function creatorReadDiagramImage(event) {
  const file = event.target.files?.[0];
  window.creatorDiagramImageData = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    window.creatorDiagramImageData = reader.result;
    notify('success', 'Diagram image attached to this group.');
  };
  reader.onerror = () => notify('error', 'Failed to read the diagram image.');
  reader.readAsDataURL(file);
}

function creatorAddQuestionGroup() {
  try {
    const part = getCreatorPart();
    if (!part) return;
    const rangeText = document.getElementById('creator-group-range')?.value || '';
    const range = parseCreatorRange(rangeText);
    if (!range) throw new Error('Enter a valid question range like 1-5.');
    if (countCreatorQuestionsTotal() + range.numbers.length > CREATOR_LIMITS.maxQuestions) {
      throw new Error('A test can contain at most 40 questions.');
    }

    const type = document.getElementById('creator-group-type')?.value || '';
    const instructions = (document.getElementById('creator-group-instructions')?.value || '').trim();
    const optionText = document.getElementById('creator-group-options')?.value || '';
    const options = parseCreatorOptions(optionText);
    const optionBlocks = parseCreatorOptionBlocks(optionText);
    const body = (document.getElementById('creator-group-body')?.value || '').trim();
    const questionLines = parseCreatorQuestionLines(document.getElementById('creator-group-questions')?.value || '', range);
    const selectCount = Number(document.getElementById('creator-select-count')?.value || 1);
    const answers = parseCreatorAnswerKeyLines(document.getElementById('creator-answer-key-lines')?.value || '');
    const group = buildCreatorQuestionGroup({ type, range, instructions, options, optionBlocks, body, questionLines, selectCount });

    validateCreatorGroupDraft(group, answers, range);
    part.questionGroups.push(group);
    Object.assign(creatorState.answerKey, answers);
    applyCreatorHeadingMarkers(part);
    part.questionRange = combineCreatorRanges(part.questionGroups);
    creatorDirty = true;
    creatorResetGroupForm();
    renderCreatorPanel();
    notify('success', `Added questions ${range.label}.`);
  } catch (error) {
    notify('error', error.message || 'Could not add that question group.');
  }
}

function buildCreatorQuestionGroup({ type, range, instructions, options, optionBlocks, body, questionLines, selectCount }) {
  const group = {
    type,
    questionRange: range.label,
    instructions,
    questions: []
  };

  if (['heading_match'].includes(type)) {
    group.headingOptions = limitCreatorOptions(options);
    group.questions = questionLines.length ? questionLines.map((q, i) => ({
      number: q.number,
      section: normalizeCreatorSectionTarget(q.text) || String.fromCharCode(65 + i),
      answer: null
    })) : range.numbers.map((number, i) => ({ number, section: String.fromCharCode(65 + i), answer: null }));
    return group;
  }

  if (type === 'multiple_choice') {
    group.selectCount = Math.max(1, Math.min(3, selectCount || 1));
    if (group.selectCount > 1) {
      group.questions = [{ numbers: range.label, stem: questionLines[0]?.text || '', options: limitCreatorOptions(options) }];
    } else {
      group.questions = questionLines.map((q, index) => ({
        number: q.number,
        stem: q.text,
        options: limitCreatorOptions(optionBlocks[index] || options)
      }));
    }
    return group;
  }

  if (type === 'true_false_notgiven' || type === 'yes_no_notgiven') {
    group.questions = questionLines.map(q => ({ number: q.number, statement: q.text }));
    return group;
  }

  if (type === 'summary_completion') {
    if (options.length) group.options = limitCreatorOptions(options);
    group.summaryText = body || range.numbers.map(num => `___${num}___`).join(' ');
    group.questions = range.numbers.map(number => ({ number, statement: `___${number}___` }));
    return group;
  }

  if (type === 'note_completion') {
    group.noteText = body || range.numbers.map(num => `- ___${num}___`).join('\n');
    group.questions = range.numbers.map(number => ({ number, statement: `___${number}___` }));
    return group;
  }

  if (type === 'table_completion') {
    const rows = body.split(/\n+/).map(row => row.split('|').map(cell => cell.trim())).filter(row => row.some(Boolean));
    group.tableHeaders = rows.shift() || ['Notes', 'Details'];
    group.tableRows = rows.length ? rows : range.numbers.map(num => [`___${num}___`, '']);
    group.questions = range.numbers.map(number => ({ number, statement: `___${number}___` }));
    return group;
  }

  if (type === 'flowchart_completion') {
    group.questions = range.numbers.map((number, i) => ({
      number,
      statement: questionLines[i]?.text || `Step ${i + 1}: ___${number}___`
    }));
    return group;
  }

  if (type === 'diagram_completion') {
    group.diagramImage = window.creatorDiagramImageData || '';
    group.questions = range.numbers.map(number => ({ number, statement: `___${number}___` }));
    return group;
  }

  if (type === 'sentence_completion' || type === 'short_answer') {
    group.questions = range.numbers.map((number, i) => ({
      number,
      statement: questionLines[i]?.text || `___${number}___`
    }));
    return group;
  }

  if (['matching_features', 'matching_endings', 'matching_information'].includes(type)) {
    group.options = type === 'matching_information' && !options.length
      ? inferCreatorSectionOptions()
      : limitCreatorOptions(options);
    group.questions = questionLines.map(q => ({
      number: q.number,
      statement: q.text,
      stem: q.text
    }));
    return group;
  }

  return group;
}

function validateCreatorGroupDraft(group, answers, range) {
  if (!CREATOR_TYPES.includes(group.type)) throw new Error('Unsupported question type.');
  if (!group.instructions) throw new Error('Instructions are required.');
  if (!group.questions?.length) throw new Error('Add question prompts or insert completion gaps for the selected range.');
  const slotCount = group.questions.reduce((total, q) => total + (parseCreatorRange(q.numbers || q.number)?.numbers.length || 1), 0);
  if (slotCount < range.numbers.length) {
    throw new Error(`Questions ${range.label} needs ${range.numbers.length} answer slots, but only ${slotCount} were created.`);
  }
  const questionOptionCounts = (group.questions || []).map(q => (q.options || []).length);
  const optionCount = Math.max((group.options || group.headingOptions || []).length, ...questionOptionCounts, 0);
  if (['heading_match', 'multiple_choice', 'summary_completion', 'matching_features', 'matching_endings', 'matching_information'].includes(group.type) && optionCount > CREATOR_LIMITS.maxOptions) {
    throw new Error('This question type can have no more than 9 options.');
  }
  if (['heading_match', 'multiple_choice', 'matching_features', 'matching_endings', 'matching_information'].includes(group.type) && optionCount < 2) {
    throw new Error('This question type needs at least two options.');
  }
  if (group.type === 'diagram_completion' && !group.diagramImage) {
    throw new Error('Diagram completion requires an uploaded diagram image.');
  }
  for (const number of range.numbers) {
    if (!String(answers[number] || '').trim()) {
      throw new Error(`Missing answer key for question ${number}.`);
    }
  }
}

function creatorRemoveQuestionGroup(index) {
  const part = getCreatorPart();
  if (!part?.questionGroups[index]) return;
  const removed = part.questionGroups.splice(index, 1)[0];
  getCreatorQuestionNumbersForGroup(removed).forEach(num => delete creatorState.answerKey[num]);
  applyCreatorHeadingMarkers(part);
  part.questionRange = combineCreatorRanges(part.questionGroups);
  creatorDirty = true;
  renderCreatorPanel();
}

function applyCreatorHeadingMarkers(part) {
  part.passage.sections.forEach(section => {
    section.questionMarker = null;
    delete section.headingExample;
  });
  for (const group of part.questionGroups) {
    if (group.type !== 'heading_match') continue;

    // Set example if defined
    if (group.exampleSection && group.exampleHeading) {
      const target = String(group.exampleSection).toUpperCase();
      const section = part.passage.sections.find((sec, index) => {
        const label = String(sec.heading || String.fromCharCode(65 + index)).toUpperCase();
        return label === target;
      });
      if (section) {
        section.headingExample = {
          label: '',
          text: group.exampleHeading
        };
      }
    }

    for (const q of group.questions || []) {
      const target = String(q.section || '').toUpperCase();
      const section = part.passage.sections.find((sec, index) => {
        const label = String(sec.heading || String.fromCharCode(65 + index)).toUpperCase();
        return label === target;
      });
      if (section) {
        if (section.headingExample) {
          continue;
        }
        section.questionMarker = q.number;
      }
    }
  }
}

function parseCreatorRange(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?$/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2] || match[1]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > 40) return null;
  return {
    start,
    end,
    label: start === end ? String(start) : `${start}-${end}`,
    numbers: Array.from({ length: end - start + 1 }, (_, i) => start + i)
  };
}

function getQuestionNumbersFromRange(range) {
  return parseCreatorRange(range)?.numbers || [];
}

function parseCreatorOptions(value) {
  return String(value || '')
    .split(/\n+/)
    .map(line => line.trim().replace(/^[A-Zivxlcdm]+[\.)]?\s+/i, '').trim())
    .filter(line => !/^-{3,}$/.test(line))
    .filter(Boolean)
    .slice(0, CREATOR_LIMITS.maxOptions);
}

function parseCreatorOptionBlocks(value) {
  return String(value || '')
    .split(/\n\s*-{3,}\s*\n/g)
    .map(block => parseCreatorOptions(block))
    .filter(block => block.length);
}

function parseCreatorQuestionLines(value, range) {
  const lines = String(value || '').split(/\n+/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  return lines.map((line, index) => {
    const match = line.match(/^(\d{1,2})(?:[\.)])?\s*(.*)$/);
    const fallback = range.numbers[index] || range.numbers[range.numbers.length - 1];
    return {
      number: match ? Number(match[1]) : fallback,
      text: (match ? match[2] : line).trim()
    };
  }).filter(q => range.numbers.includes(q.number));
}

function parseCreatorAnswerKeyLines(value) {
  const answers = {};
  String(value || '').split(/\n+/).map(line => line.trim()).filter(Boolean).forEach(line => {
    const match = line.match(/^(\d{1,2})\s*(?:=|:|-)\s*(.+)$/);
    if (!match) return;
    answers[match[1]] = match[2].trim();
  });
  return answers;
}

function normalizeCreatorSectionTarget(text) {
  const match = String(text || '').match(/\b([A-J])\b/i);
  return match ? match[1].toUpperCase() : '';
}

function inferCreatorSectionOptions() {
  const part = getCreatorPart();
  return (part?.passage.sections || [])
    .map(section => section.heading)
    .filter(Boolean);
}

function limitCreatorOptions(options) {
  return (options || []).slice(0, CREATOR_LIMITS.maxOptions);
}

function countCreatorQuestionsTotal() {
  return (creatorState?.parts || []).reduce((sum, part) => {
    return sum + (part.questionGroups || []).reduce((groupSum, group) => groupSum + getCreatorQuestionNumbersForGroup(group).length, 0);
  }, 0);
}

function combineCreatorRanges(groups) {
  const nums = groups.flatMap(group => getCreatorQuestionNumbersForGroup(group));
  if (!nums.length) return '';
  return `${Math.min(...nums)}-${Math.max(...nums)}`;
}

function buildCreatorTestData() {
  if (!creatorState) throw new Error('Creator is not active.');
  const data = JSON.parse(JSON.stringify(creatorState));
  const seenQuestions = new Set();
  data.parts.forEach((part, index) => {
    if (part.passage) {
      part.passage.sectionsMode = creatorShowSections;
    }
    syncCreatorDynamicOptions(part);
    for (const group of (part.questionGroups || [])) {
      if (group.type === 'heading_match') {
        group.headingOptions = (group.headingOptions || []).map(cleanCreatorOptionLabel).filter(Boolean);
      }
      if (group.type === 'table_completion') {
        syncCreatorGroupRangeFromQuestions(group);
      }
      if (group.type === 'diagram_completion' && !group.diagramImage) {
        throw new Error(`Part ${index + 1}: diagram completion requires an uploaded diagram image.`);
      }
      if (!getCreatorQuestionNumbersForGroup(group).length) {
        throw new Error(`Part ${index + 1}: ${group.type.replace(/_/g, ' ')} has 0 questions. Add at least one question before testing or sharing.`);
      }
    }
    part.partNumber = index + 1;
    part.questionRange = combineCreatorRanges(part.questionGroups);
    if (getCreatorPartQuestionCount(part) > CREATOR_LIMITS.maxQuestionsPerPart) {
      throw new Error(`Part ${index + 1}: each part can have at most ${CREATOR_LIMITS.maxQuestionsPerPart} questions.`);
    }
    for (const group of part.questionGroups || []) {
      for (const number of getCreatorQuestionNumbersForGroup(group)) {
        if (seenQuestions.has(number)) throw new Error(`Question ${number} is used more than once.`);
        seenQuestions.add(number);
        if (!String(data.answerKey?.[String(number)] || '').trim()) {
          throw new Error(`Part ${index + 1}: missing answer key for question ${number}.`);
        }
      }
    }
    part.passage.title = String(part.passage.title || `Untitled Reading Passage ${index + 1}`).trim();
    part.passage.sections = part.passage.sections.map(section => ({
      heading: section.heading || null,
      paragraphs: (section.paragraphs || []).map(p => String(p || '').trim()).filter(Boolean),
      questionMarker: section.questionMarker ?? null,
      ...(section.headingExample ? { headingExample: section.headingExample } : {})
    })).filter(section => section.paragraphs.length);
  });
  if (!Object.keys(data.answerKey || {}).length) throw new Error('Answer key is required before testing or sharing.');
  const schemaCheck = Validator.validateSchema(data);
  if (!schemaCheck.valid) throw new Error(schemaCheck.errors.join('\n'));
  return data;
}

function creatorExit() {
  if (document.getElementById('listening-creator-workspace') && document.getElementById('listening-creator-workspace').style.display === 'block') {
    closeOptionsMenu();
    return closeListeningCreator();
  }
  closeOptionsMenu();
  backToEditor();
}

async function creatorShare() {
  if (document.getElementById('listening-creator-workspace') && document.getElementById('listening-creator-workspace').style.display === 'block') {
    closeOptionsMenu();
    return triggerSaveListeningTest();
  }
  try {
    const data = buildCreatorTestData();
    closeOptionsMenu();
    const url = await Sharing.saveTestToSupabase(data);
    await navigator.clipboard.writeText(url);
    notify('success', 'Manual test saved and share link copied.');
    creatorDirty = false;
  } catch (error) {
    notify('error', error.message || 'Could not share the manual test.');
  }
}

function openCreatorTestModal() {
  if (document.getElementById('listening-creator-workspace') && document.getElementById('listening-creator-workspace').style.display === 'block') {
    closeOptionsMenu();
    return previewListeningTest();
  }
  try {
    buildCreatorTestData();
  } catch (error) {
    notify('error', error.message || 'Fix the manual test before launching.');
    return;
  }
  closeOptionsMenu();
  const modal = document.getElementById('creator-test-modal');
  if (modal) modal.style.display = 'flex';
}

function closeCreatorTestModal(event) {
  const isExplicitCloseButton = !!event?.currentTarget?.closest?.('.modal-close');
  if (!event || event.target?.id === 'creator-test-modal' || isExplicitCloseButton) {
    const modal = document.getElementById('creator-test-modal');
    if (modal) modal.style.display = 'none';
  }
}

function toggleCreatorPinInput() {
  const enabled = document.getElementById('creator-emergency-enabled')?.checked;
  const row = document.getElementById('creator-emergency-pin-row');
  if (row) row.style.display = enabled ? 'block' : 'none';
}

function creatorStartTest() {
  try {
    const data = buildCreatorTestData();
    const enabled = document.getElementById('creator-emergency-enabled')?.checked;
    const pin = String(document.getElementById('creator-emergency-pin')?.value || '').trim();
    if (enabled) {
      if (!/^\d{6,8}$/.test(pin)) throw new Error('Emergency Score Viewer PIN must be 6-8 digits.');
      attachEmergencyScorePin(data, pin);
    }
    document.getElementById('creator-test-modal').style.display = 'none';
    creatorState = null;
    creatorDirty = false;
    showTest(data);
  } catch (error) {
    notify('error', error.message || 'Could not launch the manual test.');
  }
}

function handleWritingTask1ImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    writingTask1ImageData = reader.result;
    const preview = document.getElementById('writing-task1-preview');
    const hint = document.getElementById('writing-task1-drop-hint');
    const fileName = document.getElementById('writing-task1-file-name');
    if (preview) {
      preview.src = reader.result;
      preview.style.display = 'block';
    }
    if (fileName) fileName.textContent = file.name || 'Image selected';
    if (hint) hint.style.display = 'none';
  };
  reader.onerror = () => notify('error', 'Failed to read the Task 1 image.');
  reader.readAsDataURL(file);
}

function setupWritingDragDrop() {
  const zone = document.getElementById('writing-task1-drop-zone');
  const input = document.getElementById('writing-task1-diagram');
  if (!zone || !input) return;

  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('drag-over');
    const file = event.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    handleWritingTask1ImageUpload({ target: input });
  });
}

async function handleWritingDemo() {
  hideValidation();
  activePracticeMode = 'writing';
  const speedTimerPin = readWritingSpeedTimerPinConfig();
  if (speedTimerPin === null) return;
  toggleLoading(true);
  setLoadingMessage('Loading the writing demo test...');
  try {
    const response = await fetch('./writing/writing-sample-data.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load the writing demo test.');
    const data = await response.json();
    data.speedTimerPin = speedTimerPin || data.speedTimerPin || '';
    showWritingTest(data);
  } catch (error) {
    showValidation('error', error.message || 'Failed to load the writing demo test.');
  } finally {
    toggleLoading(false);
    setLoadingMessage('Formatting your questions...');
  }
}

async function handleWritingGenerate() {
  const task1Text = document.getElementById('writing-task1-input')?.value.trim() || '';
  const task2Text = document.getElementById('writing-task2-input')?.value.trim() || '';
  const provider = document.getElementById('writing-ai-provider')?.value || 'groq';
  const apiKey = document.getElementById('writing-api-key')?.value.trim() || '';

  hideValidation();
  activePracticeMode = 'writing';
  const speedTimerPin = readWritingSpeedTimerPinConfig();
  if (speedTimerPin === null) return;

  if (!task1Text && !task2Text) {
    showValidation('error', 'Please enter at least one writing task question.');
    return;
  }
  if (task1Text && !writingTask1ImageData) {
    showValidation('error', 'Task 1 requires a diagram image. Upload or drop the diagram before generating the writing test.');
    return;
  }

  toggleLoading(true);
  setLoadingMessage(apiKey ? 'AI is formatting your writing questions...' : 'Generating your writing test...');
  try {
    const task1Prompt = task1Text && apiKey ? await formatWritingQuestion(task1Text, provider, apiKey) : task1Text;
    const task2Prompt = task2Text && apiKey ? await formatWritingQuestion(task2Text, provider, apiKey) : task2Text;
    showWritingTest({
      task1: task1Text ? {
        prompt: task1Prompt,
        image: writingTask1ImageData || null,
        preamble: WRITING_TASK_CONFIG[1].preamble,
        wordRequirement: WRITING_TASK_CONFIG[1].wordRequirement
      } : null,
      task2: task2Text ? {
        prompt: task2Prompt,
        image: null,
        preamble: WRITING_TASK_CONFIG[2].preamble,
        wordRequirement: WRITING_TASK_CONFIG[2].wordRequirement
      } : null,
      speedTimerPin
    });
  } catch (error) {
    showValidation('error', error.message || 'Failed to generate writing test.');
  } finally {
    toggleLoading(false);
    setLoadingMessage('Formatting your questions...');
  }
}

async function formatWritingQuestion(text, provider, apiKey) {
  if (!text || !apiKey) return text;

  const endpoints = {
    openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', model: 'google/gemini-2.0-flash:free' },
    groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
    openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
    gemini: { url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, model: null }
  };
  const config = endpoints[provider];
  if (!config) return text;

  try {
    let result = '';
    if (provider === 'gemini') {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${WRITING_FORMAT_PROMPT}\n\nRaw question text:\n${text}` }] }],
          generationConfig: { temperature: 0.1 }
        })
      });
      const data = await response.json();
      result = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      const authToken = normalizeBearerTokenForRequest(apiKey);
      if (!authToken && provider === 'openrouter') {
        throw new Error('OpenRouter API key is missing. Paste your OpenRouter key in the API Key field.');
      }
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      };
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = window.location.href;
        headers['X-Title'] = 'IELTS Practice Generator';
        headers['X-OpenRouter-Title'] = 'IELTS Practice Generator';
      }
      const response = await fetch(config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: WRITING_FORMAT_PROMPT },
            { role: 'user', content: text }
          ],
          temperature: 0.1
        })
      });
      const data = await response.json();
      result = data?.choices?.[0]?.message?.content || '';
    }

    const cleaned = String(result).replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed.formattedText || text;
  } catch {
    return text;
  }
}

function normalizeBearerTokenForRequest(apiKey) {
  return String(apiKey || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+/g, '');
}

function normalizeWritingTask(task, taskNum) {
  if (!task) return null;
  return {
    prompt: String(task.prompt || '').trim(),
    image: task.image || null,
    preamble: task.preamble || WRITING_TASK_CONFIG[taskNum].preamble,
    wordRequirement: task.wordRequirement || WRITING_TASK_CONFIG[taskNum].wordRequirement
  };
}

function normalizeWritingSpeedTimerPin(pin) {
  const value = String(pin || '').trim();
  return /^\d{6,8}$/.test(value) ? value : '';
}

function getWritingTestDurationSeconds(testData = currentWritingTestData) {
  let totalMinutes = 0;
  if (testData?.task1) totalMinutes += 20;
  if (testData?.task2) totalMinutes += 40;
  return Math.max(1, totalMinutes) * 60;
}

function showWritingTest(data) {
  activePracticeMode = 'writing';
  currentTestData = null;
  currentWritingTestData = {
    task1: normalizeWritingTask(data.task1, 1),
    task2: normalizeWritingTask(data.task2, 2),
    speedTimerPin: normalizeWritingSpeedTimerPin(data.speedTimerPin)
  };
  writingTask1Response = '';
  writingTask2Response = '';
  currentWritingTask = currentWritingTestData.task1 ? 1 : 2;
  resultHasBeenDisplayed = false;
  writingTimerSpeedMultiplier = 1;
  writingSpeedTimerUsed = false;
  writingSpeedTimerLocked = false;
  writingSpeedTimerFailedAttempts = 0;
  resetSessionIntegrity();
  Renderer.stopTimer?.();
  setTestShellMode('writing');
  closeOptionsMenu();
  syncOptionsMenuState();

  document.getElementById('input-view').style.display = 'none';
  document.getElementById('test-view').style.display = 'flex';
  document.getElementById('writing-area').disabled = false;

  renderWritingTaskNav();
  renderWritingTask(currentWritingTask);
  startWritingTimer();
}

function renderWritingTaskNav() {
  const nav = document.getElementById('writing-task-nav');
  if (!nav || !currentWritingTestData) return;
  let html = '';
  if (currentWritingTestData.task1) {
    html += `<button class="nav-part-btn${currentWritingTask === 1 ? ' active' : ''}" type="button" onclick="switchWritingTask(1)">Task 1</button>`;
  }
  if (currentWritingTestData.task2) {
    html += `<button class="nav-part-btn${currentWritingTask === 2 ? ' active' : ''}" type="button" onclick="switchWritingTask(2)">Task 2</button>`;
  }
  nav.innerHTML = html;
}

function renderWritingTask(taskNum) {
  const task = currentWritingTestData?.[`task${taskNum}`];
  if (!task) return;

  const label = document.getElementById('writing-part-label');
  const instruction = document.getElementById('writing-part-instruction');
  if (label) label.textContent = `Writing Task ${taskNum}`;
  if (instruction) instruction.textContent = task.preamble;

  const prompt = document.getElementById('writing-prompt-content');
  if (prompt) {
    if (taskNum === 2) {
      prompt.innerHTML = `
        <p class="writing-topic-intro">Write about the following topic:</p>
        <div class="writing-prompt-box writing-topic-box">${escHtml(task.prompt)}</div>
        <p class="writing-word-requirement">${escHtml(task.wordRequirement)}</p>
        <p class="writing-extra-instruction">Give reasons for your answer and include any relevant examples from your own knowledge or experience.</p>
      `;
    } else {
      prompt.innerHTML = `
        <div class="writing-prompt-box">${escHtml(task.prompt)}</div>
        ${task.image ? `<div class="writing-task-image-wrap"><img class="writing-task-image" src="${escAttr(task.image)}" alt="Writing Task ${taskNum} visual prompt"></div>` : ''}
        <p class="writing-word-requirement">${escHtml(task.wordRequirement)}</p>
      `;
    }
  }

  const area = document.getElementById('writing-area');
  if (area) {
    area.value = taskNum === 1 ? writingTask1Response : writingTask2Response;
    area.placeholder = `Write your Task ${taskNum} response here...`;
    area.focus();
  }
  updateWritingWordCount();
  renderWritingTaskNav();
}

function switchWritingTask(taskNum) {
  if (!currentWritingTestData?.[`task${taskNum}`] || taskNum === currentWritingTask) return;
  saveCurrentWritingResponse();
  currentWritingTask = taskNum;
  renderWritingTask(taskNum);
}

function navigateWritingPrev() {
  if (currentWritingTask === 2 && currentWritingTestData?.task1) switchWritingTask(1);
}

function navigateWritingNext() {
  if (currentWritingTask === 1 && currentWritingTestData?.task2) switchWritingTask(2);
}

function saveCurrentWritingResponse() {
  const area = document.getElementById('writing-area');
  if (!area) return;
  if (currentWritingTask === 1) writingTask1Response = area.value;
  if (currentWritingTask === 2) writingTask2Response = area.value;
}

function startWritingTimer() {
  stopWritingTimer();
  writingTimerSeconds = getWritingTestDurationSeconds();
  writingTimerPaused = false;
  lastWritingTimerTickAt = Date.now();
  updateWritingTimerDisplay();
  restartWritingTimerInterval();
}

function restartWritingTimerInterval() {
  if (writingTimerInterval) {
    window.clearInterval(writingTimerInterval);
    writingTimerInterval = null;
  }
  const intervalMs = Math.max(34, Math.round(1000 / Math.max(1, writingTimerSpeedMultiplier)));
  writingTimerInterval = window.setInterval(tickWritingTimer, intervalMs);
}

function tickWritingTimer() {
  if (writingTimerPaused) {
    lastWritingTimerTickAt = Date.now();
    return;
  }
  const now = Date.now();
  const msPerDisplayedSecond = 1000 / Math.max(1, writingTimerSpeedMultiplier);
  const elapsedDisplayedSeconds = Math.floor((now - lastWritingTimerTickAt) / msPerDisplayedSecond);
  if (elapsedDisplayedSeconds <= 0) return;
  lastWritingTimerTickAt += elapsedDisplayedSeconds * msPerDisplayedSecond;
  writingTimerSeconds = Math.max(0, writingTimerSeconds - elapsedDisplayedSeconds);
  updateWritingTimerDisplay();
  if (writingTimerSeconds <= 0) {
    stopWritingTimer();
    lockWritingResponses();
    showWritingTimeoutModal();
  }
}

function stopWritingTimer() {
  if (writingTimerInterval) {
    window.clearInterval(writingTimerInterval);
    writingTimerInterval = null;
  }
}

function updateWritingTimerDisplay() {
  const el = document.getElementById('timer-display');
  if (!el) return;
  const mins = Math.floor(writingTimerSeconds / 60);
  const secs = writingTimerSeconds % 60;
  el.textContent = `${mins} minutes, ${secs.toString().padStart(2, '0')} seconds remaining`;
  el.classList.remove('warning', 'danger', 'paused');
  if (writingTimerSeconds <= 120) el.classList.add('danger');
  else if (writingTimerSeconds <= 300) el.classList.add('warning');
  if (writingTimerPaused) {
    el.classList.add('paused');
    el.textContent += ' (paused)';
  }
}

function lockWritingResponses() {
  saveCurrentWritingResponse();
  const area = document.getElementById('writing-area');
  if (area) area.disabled = true;
  stopSessionIntegrity();
}

function updateWritingWordCount() {
  const area = document.getElementById('writing-area');
  const countEl = document.getElementById('writing-word-count');
  if (!area || !countEl) return;
  const count = countWritingWords(area.value);
  countEl.textContent = String(count);
  const minWords = WRITING_TASK_CONFIG[currentWritingTask]?.minWords || 150;
  countEl.classList.toggle('word-ok', count >= minWords);
  countEl.classList.toggle('word-low', count < minWords);
}

function countWritingWords(text) {
  const trimmed = String(text || '').trim();
  return trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
}

function showWritingTimeoutModal() {
  saveCurrentWritingResponse();
  resultHasBeenDisplayed = true;
  syncOptionsMenuState();
  stopSessionIntegrity();

  const task1Count = currentWritingTestData?.task1 ? countWritingWords(writingTask1Response) : null;
  const task2Count = currentWritingTestData?.task2 ? countWritingWords(writingTask2Response) : null;
  const totalCount = (task1Count || 0) + (task2Count || 0);
  const exitCount = sessionIntegrity.leftTestInterfaceCount;
  const spedUp = writingTimerSpeedMultiplier > 1;

  const summaryEl = document.getElementById('result-summary');
  const metaEl = document.getElementById('result-meta');
  const breakdownEl = document.getElementById('result-breakdown');
  const warningEl = document.getElementById('result-warning');

  if (summaryEl) summaryEl.textContent = 'Time is up';
  if (metaEl) {
    metaEl.textContent = `Your essays are locked. The keyboard has been politely escorted out of the building.`;
  }
  if (breakdownEl) {
    const taskStats = [];
    if (task1Count !== null) {
      taskStats.push(`
        <div class="result-stat">
          <span class="result-stat-label">Task 1 word count</span>
          <strong>${task1Count}</strong>
        </div>
      `);
    }
    if (task2Count !== null) {
      taskStats.push(`
        <div class="result-stat">
          <span class="result-stat-label">Task 2 word count</span>
          <strong>${task2Count}</strong>
        </div>
      `);
    }
    taskStats.push(`
      <div class="result-stat">
        <span class="result-stat-label">Total words</span>
        <strong>${totalCount}</strong>
      </div>
    `);
    if (exitCount > 0) {
      taskStats.push(`
        <div class="result-stat">
          <span class="result-stat-label">Interface exits</span>
          <strong>${exitCount}</strong>
        </div>
      `);
    }
    breakdownEl.innerHTML = taskStats.join('');
  }

  if (warningEl) {
    const warningMessages = [];
    if (spedUp) {
      warningMessages.push(`btw i noticed that you sped up the timer by ${writingTimerSpeedMultiplier}x. that ain't tuff boi.`);
    }
    if (exitCount > 0) {
      warningMessages.push(`i also found out you exited the interface ${exitCount} times. were you trying to copy the sample band 9 essays?`);
    }
    warningEl.textContent = warningMessages.join('\n\n');
    warningEl.style.display = warningMessages.length ? 'block' : 'none';
  }

  document.getElementById('result-modal').style.display = 'flex';
}

function escHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML.replace(/\n/g, '<br>');
}

function escAttr(text) {
  return escHtml(text).replace(/"/g, '&quot;');
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
  ['btn-parse', 'btn-reading-demo', 'btn-writing-generate', 'btn-writing-demo'].forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.disabled = show;
  });
}

function setLoadingMessage(message) {
  const el = document.querySelector('.loading-text');
  if (el) el.textContent = message;
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
  resultHasBeenDisplayed = true;
  syncOptionsMenuState();
  stopSessionIntegrity();
  const summaryEl = document.getElementById('result-summary');
  const metaEl = document.getElementById('result-meta');
  const breakdownEl = document.getElementById('result-breakdown');
  const warningEl = document.getElementById('result-warning');
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const bandEstimate = getBandEstimate(percentage);

  summaryEl.textContent = `${score} / ${total}`;
  metaEl.textContent = `${score} correct, ${total - score} incorrect or unanswered.`;
  const incorrect = total - score;
  const skipped = 0;
  if (breakdownEl) {
    breakdownEl.innerHTML = `
      <div class="result-stat stat-correct">
        <span class="result-stat-label">Correct</span>
        <strong>${score}</strong>
      </div>
      <div class="result-stat stat-incorrect">
        <span class="result-stat-label">Incorrect / Unanswered</span>
        <strong>${incorrect}</strong>
      </div>
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
  clearPendingIntegrityBlur();
  sessionIntegrity.leftTestInterfaceCount = 0;
  sessionIntegrity.lastHiddenAt = 0;
  sessionIntegrity.lastExitSignalAt = 0;
  sessionIntegrity.reminderShownForCurrentExit = false;
  sessionIntegrity.reviewModeStarted = false;
}

function stopSessionIntegrity() {
  clearPendingIntegrityBlur();
  sessionIntegrity.reviewModeStarted = true;
  sessionIntegrity.reminderShownForCurrentExit = true;
}

function getSessionIntegrity() {
  return { ...sessionIntegrity };
}

function setupSessionIntegrityTracking() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && isIntegrityWatchActive()) {
      clearPendingIntegrityBlur();
      registerIntegrityExit();
      return;
    }

    if (document.visibilityState === 'visible' && isIntegrityWatchActive()) {
      maybeShowIntegrityReminder();
    }
  });

  window.addEventListener('blur', () => {
    if (!isIntegrityWatchActive() || document.visibilityState === 'hidden') return;
    schedulePendingIntegrityBlur();
  });

  window.addEventListener('focus', () => {
    clearPendingIntegrityBlur();
    if (isIntegrityWatchActive()) {
      maybeShowIntegrityReminder();
    }
  });
}

function schedulePendingIntegrityBlur() {
  clearPendingIntegrityBlur();
  sessionIntegrity.pendingBlurStartedAt = Date.now();
  sessionIntegrity.pendingBlurTimer = window.setTimeout(() => {
    sessionIntegrity.pendingBlurTimer = null;
    if (!isIntegrityWatchActive() || document.visibilityState !== 'visible' || document.hasFocus()) return;
    registerIntegrityExit();
  }, 1500);
}

function clearPendingIntegrityBlur() {
  if (sessionIntegrity.pendingBlurTimer) {
    window.clearTimeout(sessionIntegrity.pendingBlurTimer);
    sessionIntegrity.pendingBlurTimer = null;
  }
  sessionIntegrity.pendingBlurStartedAt = 0;
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
  return activePracticeMode !== 'creator'
    && isTestVisible()
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

function setupWritingResizer() {
  const resizer = document.getElementById('writing-pane-resizer');
  if (!resizer) return;
  const left = document.getElementById('writing-prompt-panel');
  const right = document.getElementById('writing-response-panel');
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
    const container = document.getElementById('writing-split-pane');
    const rect = container.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    if (pct > 24 && pct < 76) {
      left.style.flex = `0 0 ${pct}%`;
      right.style.flex = `0 0 ${100 - pct}%`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    resizer.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}

function setupTestInterfaceGuards() {
  document.addEventListener('contextmenu', (event) => {
    if (activePracticeMode === 'creator') return;
    if (isTestVisible() && event.target.closest?.('#test-view')) {
      event.preventDefault();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (activePracticeMode === 'creator' || !isTestVisible()) return;
    const key = String(event.key || '').toLowerCase();
    if ((event.ctrlKey || event.metaKey) && (key === 'c' || key === 'v' || key === 'f' || key === 'u')) {
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
    if (data.mode === 'writing') {
      switchPracticeMode('writing');
      showWritingTest(data.writingTestData || data);
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
  let initialMode = 'reading';
  if (window.location.hash === '#writing') initialMode = 'writing';
  else if (window.location.hash === '#listening') initialMode = 'listening';
  switchPracticeMode(initialMode);
  initOptionsChoiceUI();
  toggleEmergencyScorePinInput();
  toggleWritingSpeedTimerPinInput();
  document.getElementById('emergency-score-pin')?.addEventListener('input', (event) => {
    sanitizePinInput(event.target);
  });
  document.getElementById('emergency-score-pin-check')?.addEventListener('input', (event) => {
    sanitizePinInput(event.target);
  });
  document.getElementById('emergency-score-pin-check')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitEmergencyScorePin();
    }
  });
  document.getElementById('writing-speed-timer-pin')?.addEventListener('input', (event) => {
    sanitizePinInput(event.target);
  });
  document.getElementById('writing-speed-pin-check')?.addEventListener('input', (event) => {
    sanitizePinInput(event.target);
  });
  document.getElementById('writing-speed-pin-check')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitWritingSpeedTimerPin();
    }
  });
  setupResizer();
  setupWritingResizer();
  setupWritingDragDrop();
  setupSessionIntegrityTracking();
  setupTestInterfaceGuards();
  document.getElementById('writing-area')?.addEventListener('input', () => {
    saveCurrentWritingResponse();
    updateWritingWordCount();
  });
  loadSharedTestFromURL();
});

/* ── Table Drag Resizing ── */
window.creatorStartTableColResize = function (e, index, colIndex) {
  e.preventDefault();
  const startX = e.clientX;
  const th = e.target.closest('th') || e.target.closest('td');
  if (!th) return;
  const table = th.closest('table');
  const col = table?.querySelector('colgroup')?.children[colIndex];
  const startWidth = th.getBoundingClientRect().width;

  document.body.style.cursor = 'col-resize';

  function onMouseMove(moveEvent) {
    const delta = moveEvent.clientX - startX;
    const newWidth = Math.max(50, startWidth + delta);
    if (col) col.style.width = newWidth + 'px';
    th.style.width = newWidth + 'px';
  }

  function onMouseUp(upEvent) {
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    const finalWidth = th.getBoundingClientRect().width;
    creatorUpdateTableColumnWidth(index, colIndex, Math.round(finalWidth));
    renderCreatorPanel();
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};

window.creatorStartTableRowResize = function (e, index, rowIndex) {
  e.preventDefault();
  const startY = e.clientY;
  const tr = e.target.closest('tr');
  if (!tr) return;
  const startHeight = tr.getBoundingClientRect().height;

  document.body.style.cursor = 'row-resize';

  function onMouseMove(moveEvent) {
    const delta = moveEvent.clientY - startY;
    const newHeight = Math.max(28, startHeight + delta);
    tr.style.height = newHeight + 'px';
  }

  function onMouseUp(upEvent) {
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    const finalHeight = tr.getBoundingClientRect().height;
    creatorUpdateTableRowHeight(index, rowIndex, Math.round(finalHeight));
    renderCreatorPanel();
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};


function extractTextFromContentEditable(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll('.wysiwyg-gap-inline, .wysiwyg-gap-pill').forEach(gap => {
    const numEl = gap.querySelector('.gap-num');
    const num = numEl ? numEl.textContent : gap.textContent;
    gap.replaceWith('___' + num.replace(/[^\d]/g, '') + '___');
  });

  let html = clone.innerHTML;
  html = html.replace(/<br\s*[\/]?>/gi, '\n');
  html = html.replace(/<\/div>/gi, '\n');
  html = html.replace(/<\/p>/gi, '\n');
  html = html.replace(/<[^>]+>/g, '');
  html = html.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return html.replace(/\u200B/g, '').trim();
}

/* ── Flowchart Missing Functions ── */
function creatorAddFlowNode(index) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group) return;

  // Ensure we use group.questions to store nodes
  if (!group.questions) group.questions = [];
  const nodes = group.questions;

  const nextNum = getCreatorNextQuestionNumber(part);

  if (nextNum) {
    nodes.push({ number: nextNum, statement: `Step ${nodes.length + 1}: ___${nextNum}___`, text: `Step ${nodes.length + 1}`, color: '#3b82f6', arrow: 'down', width: 180, height: 66 });
  } else {
    nodes.push({ number: null, statement: `Step ${nodes.length + 1}`, text: `Step ${nodes.length + 1}`, color: '#3b82f6', arrow: 'down', width: 180, height: 66 });
  }

  const nums = getCreatorQuestionNumbersForGroup(group);
  if (nums.length) {
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    group.questionRange = nums.length === 1 ? String(min) : `${min}-${max}`;
  }

  creatorDirty = true;
  renderCreatorPanel();
}

function creatorRemoveFlowNode(index) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group || !group.questions || group.questions.length === 0) return;

  group.questions.pop();

  const nums = getCreatorQuestionNumbersForGroup(group);
  if (nums.length) {
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    group.questionRange = nums.length === 1 ? String(min) : `${min}-${max}`;
  } else {
    group.questionRange = '';
  }

  creatorDirty = true;
  renderCreatorPanel();
}

function creatorMoveFlowNode(index, nodeIndex, direction) {
  const part = getCreatorPart();
  const group = part?.questionGroups[index];
  if (!group || !group.questions) return;

  const nodes = group.questions;
  if (nodeIndex < 0 || nodeIndex >= nodes.length) return;

  const newIndex = nodeIndex + direction;
  if (newIndex < 0 || newIndex >= nodes.length) return;

  const temp = nodes[nodeIndex];
  nodes[nodeIndex] = nodes[newIndex];
  nodes[newIndex] = temp;

  creatorDirty = true;
  renderCreatorPanel();
}

// Global Listening Forwarders (overridden when listening/app.js loads)
if (typeof window.openListeningCreator !== 'function') {
  window.openListeningCreator = function() {
    if (typeof window.listeningAppOpenCreator === 'function') {
      window.listeningAppOpenCreator();
    } else {
      console.warn('Listening Creator module is loading...');
    }
  };
}

if (typeof window.handleListeningDemo !== 'function') {
  window.handleListeningDemo = function() {
    if (typeof window.loadDemoTest === 'function') {
      window.loadDemoTest();
    } else {
      console.warn('Listening Demo module is loading...');
    }
  };
}
