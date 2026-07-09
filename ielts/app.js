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
  activePracticeMode = mode === 'writing' ? 'writing' : 'reading';
  const isWriting = activePracticeMode === 'writing';

  document.getElementById('mode-reading-btn')?.classList.toggle('active', !isWriting);
  document.getElementById('mode-writing-btn')?.classList.toggle('active', isWriting);
  document.getElementById('reading-menu-panel')?.classList.toggle('active', !isWriting);
  document.getElementById('writing-menu-panel')?.classList.toggle('active', isWriting);

  const title = document.getElementById('input-title');
  const subtitle = document.getElementById('input-subtitle');
  if (title) {
    title.textContent = isWriting ? 'IELTS Writing Practice Generator' : 'IELTS Reading Practice Generator';
  }
  if (subtitle) {
    subtitle.innerHTML = isWriting
      ? 'Allows you to easily create an IELTS Writing test interface with your own questions. Not sure if it is 100% accurate to the real deal <b>[EARLY BETA. SOME FEATURES MAY ALSO NOT WORK PROPERLY.]</b>'
      : "Paste your raw passage and question set, add a diagram if the task needs one, and generate a shareable practice interface. <b>[SUPER EARLY BETA. MANY FUNCTIONS WILL NOT WORK PROPERLY, AS THE PARSER PROMPT ISN'T OPTIMIZED ENOUGH.]</b>";
  }

  hideValidation();
  setLoadingMessage(isWriting ? 'Formatting your questions...' : 'AI is parsing your IELTS text...');
}


function backToEditor() {
  closeOptionsMenu();
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
  if (!getActiveSharePayload()) return;
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
    fb.style.display = 'block';
    setTimeout(() => fb.style.display = 'none', 3000);
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

async function handleParse() {
  const rawText = document.getElementById('raw-input').value.trim();
  const provider = document.getElementById('ai-provider').value;
  const apiKey = document.getElementById('api-key').value.trim();
  const autoGenerateAnswerKey = document.getElementById('auto-answer-key')?.checked !== false;

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
    const parsed = await Parser.parse(rawText, provider, apiKey, { autoGenerateAnswerKey });
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

function openReadingCreator() {
  showValidation('info', 'The manual passage creator interface is currently under development. For now, please use "Create With Legacy AI Parser" to generate tests from your passage and questions.');
}

function setTestShellMode(mode) {
  const isWriting = mode === 'writing';
  const testView = document.getElementById('test-view');
  if (testView) testView.classList.toggle('writing-active', isWriting);

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
  closeOptionsMenu();
  syncOptionsMenuState();
  document.getElementById('input-view').style.display = 'none';
  document.getElementById('test-view').style.display = 'flex';
  Renderer.render(data);
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
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
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
    if (isTestVisible() && event.target.closest?.('#test-view')) {
      event.preventDefault();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!isTestVisible()) return;
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
  switchPracticeMode(window.location.hash === '#writing' ? 'writing' : 'reading');
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
