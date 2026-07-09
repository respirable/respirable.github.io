

const Renderer = (() => {

  let testData = null;
  let currentPartIndex = 0;
  let answers = {};
  let isChecked = false;
  let answersLocked = false;
  let timerInterval = null;
  let timerSeconds = 0;
  let timerPaused = false;
  let lastTimerTickAt = 0;
  let passageSnapshots = {};
  let passageNotes = {};
  let noteCounter = 0;
  let annotationControlsReady = false;

  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function startTimer(numParts) {
    stopTimer();
    timerSeconds = numParts * 20 * 60; // 20 minutes per passage
    timerPaused = false;
    lastTimerTickAt = Date.now();
    updateTimerDisplay();
    startTimerInterval();
  }

  function startTimerInterval() {
    stopTimer();
    timerInterval = setInterval(() => {
      if (timerPaused) {
        lastTimerTickAt = Date.now();
        return;
      }
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastTimerTickAt) / 1000);
      if (elapsedSeconds <= 0) return;
      lastTimerTickAt += elapsedSeconds * 1000;
      timerSeconds = Math.max(0, timerSeconds - elapsedSeconds);
      if (timerSeconds <= 0) {
        timerSeconds = 0;
        stopTimer();
        handleTimeUp();
      }
      updateTimerDisplay();
    }, 1000);
  }

  function handleTimeUp() {
    if (isChecked) return;
    if (testData?.answerKey && Object.keys(testData.answerKey).length > 0) {
      checkAnswers();
      return;
    }
    lockAnswers();
    window.IELTSApp?.notify?.('warning', 'Time is up. Answers are now locked.');
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function pauseTimer() {
    timerPaused = true;
    updateTimerDisplay();
  }

  function resumeTimer() {
    timerPaused = false;
    lastTimerTickAt = Date.now();
    updateTimerDisplay();
  }

  let activeQuestionLabel = null;

  function updateTimerDisplay() {
    const el = document.getElementById('timer-display');
    if (!el) return;
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    el.textContent = `${mins} minutes, ${secs.toString().padStart(2, '0')} seconds remaining`;
    el.classList.remove('warning', 'danger', 'paused');
    if (timerSeconds <= 120) {
      el.classList.add('danger');
    } else if (timerSeconds <= 300) {
      el.classList.add('warning');
    }
    if (timerPaused) {
      el.classList.add('paused');
      el.textContent += ' (paused)';
    }
  }

  function render(data) {
    testData = data;
    currentPartIndex = 0;
    answers = {};
    isChecked = false;
    answersLocked = false;
    passageSnapshots = {};
    passageNotes = {};
    noteCounter = 0;

    startTimer(testData.parts.length);
    setupAnnotationControls();

    renderPart(0);
    renderBottomNav();
  }

  function renderPart(index) {
    currentPartIndex = index;
    const part = testData.parts[index];
    if (!part) return;

    let firstNum = null;
    if (part.questionGroups && part.questionGroups.length > 0) {
      const firstGroup = part.questionGroups[0];
      if (firstGroup.questions && firstGroup.questions.length > 0) {
        const firstQ = firstGroup.questions[0];
        firstNum = getQuestionLabel(firstQ);
      }
    }
    activeQuestionLabel = firstNum;

    document.getElementById('part-label').textContent = `Part ${part.partNumber}`;
    document.getElementById('part-instruction').textContent =
      `Read the text and answer questions ${part.questionRange}.`;

    renderPassage(part);

    renderQuestions(part.questionGroups);

    restoreAnswers();

    if (isChecked) {
      applyValidationStyling();
    }
  }

  function renderPassage(partOrPassage) {
    const part = partOrPassage?.passage ? partOrPassage : null;
    const passage = part?.passage || partOrPassage;
    const hasHeadingMatch = !!part?.questionGroups?.some(group => group.type === 'heading_match');
    const el = document.getElementById('passage-content');
    const savedHtml = passageSnapshots[currentPartIndex];
    if (savedHtml) {
      el.innerHTML = savedHtml;
      renderNotesPanel();
      return;
    }

    let html = `<h2>${esc(passage.title)}</h2>`;
    if (passage.subtitle) {
      html += `<p class="passage-subtitle" style="font-style:italic;color:var(--muted);margin-top:-8px;margin-bottom:20px;font-size:1.1rem;line-height:1.4;">${esc(passage.subtitle)}</p>`;
    }

    for (const section of passage.sections) {
      // Check if this section has a heading match slot
      if (hasHeadingMatch && section.questionMarker) {
        const qNum = section.questionMarker;
        const savedAnswer = answers[qNum];
        html += `
          <div class="heading-drop-zone" id="drop-zone-${qNum}" data-q="${qNum}" 
               ondragover="Renderer.allowDrop(event)" ondragleave="Renderer.dragLeave(event)" ondrop="Renderer.dropHeading(event)">
            <span class="slot-num">${qNum}</span>
            <span class="slot-text">${savedAnswer ? esc(savedAnswer) : 'Drop heading here'}</span>
            ${savedAnswer ? `<button class="slot-clear" onclick="Renderer.clearSlot(${qNum}, event)">&times;</button>` : ''}
          </div>`;
      } else if (hasHeadingMatch && section.headingExample) {
        html += `
          <div class="heading-drop-zone heading-example-zone" aria-label="Example heading">
            <span class="slot-num">Example</span>
            <span class="slot-heading">${esc(section.headingExample.text || '')}</span>
          </div>`;
      } else if (section.heading) {
        html += `<h3>${esc(section.heading)}</h3>`;
      }
      for (const para of (section.paragraphs || [])) {
        html += `<p>${esc(para)}</p>`;
      }
    }

    el.innerHTML = html;
    renderNotesPanel();
  }

  function getAnnotationSelectionRange() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

    const range = selection.getRangeAt(0);
    const startBlock = closestAnnotationTextBlock(range.startContainer);
    const endBlock = closestAnnotationTextBlock(range.endContainer);
    if (!startBlock || !endBlock || startBlock !== endBlock) return null;
    return range;
  }

  function hasAnnotationTextSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
    return !!getAnnotationSelectionRange() && selection.toString().trim().length > 0;
  }

  function closestAnnotationTextBlock(node) {
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!element || element.closest?.('input, textarea, select, button, .heading-drop-zone, .diagram-container')) return null;
    return element.closest?.('#passage-content p, #questions-content .question-stem, #questions-content .question-option label, #questions-content .question-group-instructions, #questions-content .summary-text, #questions-content .flowchart-step, #questions-content .matching-info-statement') || null;
  }

  function saveAnnotationSnapshot() {
    const passageEl = document.getElementById('passage-content');
    if (passageEl) passageSnapshots[currentPartIndex] = passageEl.innerHTML;
  }

  function wrapSelection(className, attrs = {}) {
    const range = getAnnotationSelectionRange();
    if (!range) {
      window.IELTSApp?.notify?.('warning', 'Select text inside one passage or question line first.');
      return null;
    }

    const span = document.createElement('span');
    span.className = className;
    for (const [key, value] of Object.entries(attrs)) {
      span.setAttribute(key, value);
    }

    try {
      range.surroundContents(span);
    } catch (error) {
      span.appendChild(range.extractContents());
      range.insertNode(span);
    }
    window.getSelection()?.removeAllRanges();
    saveAnnotationSnapshot();
    return span;
  }

  function highlightSelection() {
    const existingHighlight = getSelectedHighlight();
    if (existingHighlight) {
      removeSelectedHighlightPortion(existingHighlight);
      hideAnnotationPopover();
      return;
    }

    if (wrapSelection('passage-highlight')) {
      hideAnnotationPopover();
    }
  }

  function addNoteToSelection() {
    const existingNote = getSelectedNoteAnchor();
    if (existingNote) {
      showNote(existingNote.getAttribute('data-note-id'));
      return;
    }

    const noteAnchor = wrapSelection('passage-note-anchor');
    if (!noteAnchor) return;

    attachNoteToElement(noteAnchor);
  }

  function attachNoteToElement(element) {
    const noteId = `note-${Date.now()}-${noteCounter++}`;
    element.classList.add('passage-note-anchor');
    element.setAttribute('data-note-id', noteId);
    element.setAttribute('onclick', `Renderer.showNote('${noteId}', event)`);

    if (!passageNotes[currentPartIndex]) passageNotes[currentPartIndex] = [];
    passageNotes[currentPartIndex].push({
      id: noteId,
      text: '',
      excerpt: element.textContent.trim().slice(0, 120)
    });
    saveAnnotationSnapshot();
    showNote(noteId);
  }

  function getSelectedHighlight() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    const startRoot = getAnnotationRoot(range.startContainer);
    const endRoot = getAnnotationRoot(range.endContainer);
    if (!startRoot || startRoot !== endRoot) return null;

    const ancestor = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentElement
      : range.commonAncestorContainer;
    const directHighlight = ancestor?.closest?.('.passage-highlight');
    if (directHighlight && startRoot.contains(directHighlight)) return directHighlight;

    return Array.from(startRoot.querySelectorAll('.passage-highlight'))
      .find(highlight => range.intersectsNode(highlight)) || null;
  }

  function getSelectedNoteAnchor() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    const ancestor = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentElement
      : range.commonAncestorContainer;
    const directNote = ancestor?.closest?.('.passage-note-anchor');
    if (directNote) return directNote;
    const root = getAnnotationRoot(range.commonAncestorContainer);
    return Array.from(root?.querySelectorAll?.('.passage-note-anchor') || [])
      .find(note => range.intersectsNode(note)) || null;
  }

  function getAnnotationRoot(node) {
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    return element?.closest?.('#passage-content, #questions-content') || null;
  }

  function removeHighlight(highlight) {
    const parent = highlight.parentNode;
    while (highlight.firstChild) parent.insertBefore(highlight.firstChild, highlight);
    parent.removeChild(highlight);
    parent.normalize();
  }

  function removeSelectedHighlightPortion(highlight) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      removeHighlight(highlight);
      saveAnnotationSnapshot();
      return;
    }

    const range = selection.getRangeAt(0);
    if (!highlight.contains(range.startContainer) || !highlight.contains(range.endContainer)) {
      removeHighlight(highlight);
      saveAnnotationSnapshot();
      return;
    }

    const beforeRange = document.createRange();
    beforeRange.selectNodeContents(highlight);
    beforeRange.setEnd(range.startContainer, range.startOffset);

    const selectedRange = range.cloneRange();

    const afterRange = document.createRange();
    afterRange.selectNodeContents(highlight);
    afterRange.setStart(range.endContainer, range.endOffset);

    const beforeFragment = beforeRange.cloneContents();
    const selectedFragment = selectedRange.cloneContents();
    const afterFragment = afterRange.cloneContents();
    const parent = highlight.parentNode;
    const replacement = document.createDocumentFragment();

    appendHighlightCloneIfNotEmpty(replacement, highlight, beforeFragment);
    replacement.appendChild(selectedFragment);
    appendHighlightCloneIfNotEmpty(replacement, highlight, afterFragment);

    parent.replaceChild(replacement, highlight);
    parent.normalize();
    window.getSelection()?.removeAllRanges();
    saveAnnotationSnapshot();
  }

  function appendHighlightCloneIfNotEmpty(parent, source, fragment) {
    if (!fragment.textContent.trim()) return;
    const span = source.cloneNode(false);
    span.removeAttribute('title');
    span.appendChild(fragment);
    parent.appendChild(span);
  }

  function showNote(noteId, event = null) {
    if (event && hasAnnotationTextSelection()) {
      return;
    }
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    renderNotesPanel(noteId, event?.currentTarget || findNoteAnchor(noteId));
  }

  function renderNotesPanel(activeNoteId = null, anchor = null) {
    const panel = getFloatingNotePanel();
    const notes = passageNotes[currentPartIndex] || [];
    const note = notes.find(item => item.id === activeNoteId);
    if (!note) {
      panel.innerHTML = '';
      panel.style.display = 'none';
      return;
    }

    panel.style.display = 'block';
    panel.innerHTML = `
      <div class="note-card" data-note-card="${esc(note.id)}">
        <div class="note-excerpt">${esc(note.excerpt || 'Selected text')}</div>
        <textarea class="note-textarea" rows="2" placeholder="Type your note..." oninput="Renderer.updateNote('${esc(note.id)}', this.value)">${esc(note.text)}</textarea>
        <button type="button" class="note-delete-btn" onclick="Renderer.deleteNote('${esc(note.id)}')">Delete note</button>
      </div>
    `;
    positionNotePanel(panel, anchor || findNoteAnchor(activeNoteId));

    const textarea = panel.querySelector(`[data-note-card="${CSS.escape(activeNoteId)}"] textarea`);
    textarea?.focus();
  }

  function getFloatingNotePanel() {
    let panel = document.getElementById('floating-note-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'floating-note-panel';
      panel.className = 'floating-note-panel';
      document.body.appendChild(panel);
    }
    return panel;
  }

  function positionNotePanel(panel, anchor) {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const panelWidth = panel.offsetWidth || 280;
    const panelHeight = panel.offsetHeight || 130;
    const left = Math.max(12, Math.min(window.innerWidth - panelWidth - 12, rect.left + rect.width / 2 - panelWidth / 2));
    const top = Math.max(12, rect.top - panelHeight - 10);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function findNoteAnchor(noteId) {
    if (!noteId) return null;
    return document.querySelector(`.passage-note-anchor[data-note-id="${CSS.escape(noteId)}"]`);
  }

  function updateNote(noteId, value) {
    const notes = passageNotes[currentPartIndex] || [];
    const note = notes.find(item => item.id === noteId);
    if (note) note.text = value;
  }

  function deleteNote(noteId) {
    const anchor = findNoteAnchor(noteId);
    if (anchor) unwrapAnnotationElement(anchor);
    passageNotes[currentPartIndex] = (passageNotes[currentPartIndex] || []).filter(note => note.id !== noteId);
    hideFloatingNotePanel();
    saveAnnotationSnapshot();
  }

  function hideFloatingNotePanel() {
    const panel = document.getElementById('floating-note-panel');
    if (panel) panel.style.display = 'none';
  }

  function unwrapAnnotationElement(element) {
    const parent = element.parentNode;
    if (!parent) return;
    while (element.firstChild) parent.insertBefore(element.firstChild, element);
    parent.removeChild(element);
    parent.normalize();
  }

  function setupAnnotationControls() {
    if (annotationControlsReady) return;
    annotationControlsReady = true;

    document.addEventListener('selectionchange', () => {
      updateAnnotationControls();
    });
    document.addEventListener('mouseup', () => {
      setTimeout(updateAnnotationControls, 0);
    });
    document.addEventListener('keyup', () => {
      updateAnnotationControls();
    });
    document.addEventListener('mousedown', (event) => {
      const panel = document.getElementById('floating-note-panel');
      if (
        panel?.style.display !== 'none' &&
        !panel.contains(event.target) &&
        !event.target.closest?.('.passage-note-anchor')
      ) {
        hideFloatingNotePanel();
      }
    });
  }

  function updateAnnotationControls() {
    const popover = document.getElementById('annotation-popover');
    const range = getAnnotationSelectionRange();
    if (!popover || !range) {
      hideAnnotationPopover();
      return;
    }

    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      hideAnnotationPopover();
      return;
    }

    hideFloatingNotePanel();

    const host = document.getElementById('test-view');
    const hostRect = host?.getBoundingClientRect?.() || { top: 0, left: 0, width: document.documentElement.clientWidth };
    const popoverWidth = popover.offsetWidth || 220;
    const top = Math.max(8, rect.bottom - hostRect.top + 8);
    const left = Math.min(
      hostRect.width - popoverWidth - 12,
      Math.max(12, rect.left - hostRect.left)
    );

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    updateAnnotationPopoverState();
    popover.classList.add('visible');
  }

  function hideAnnotationPopover() {
    const popover = document.getElementById('annotation-popover');
    if (popover) popover.classList.remove('visible');
  }

  function updateAnnotationPopoverState() {
    const label = document.getElementById('annotation-highlight-label');
    if (!label) return;
    label.textContent = getSelectedHighlight() ? 'Remove Highlight' : 'Highlight';
  }

  function clearAnnotations() {
    passageSnapshots[currentPartIndex] = null;
    passageNotes[currentPartIndex] = [];
    document.querySelectorAll('#passage-content .passage-note-anchor, #passage-content .passage-highlight, #questions-content .passage-note-anchor, #questions-content .passage-highlight').forEach(annotation => {
      unwrapAnnotationElement(annotation);
    });
    hideFloatingNotePanel();
    renderPassage(testData.parts[currentPartIndex]);
    window.IELTSApp?.notify?.('success', 'Cleared notes and highlights for this passage.');
  }

  function renderQuestions(groups) {
    const el = document.getElementById('questions-content');
    let html = '';

    for (const group of groups) {
      html += `<div class="question-group" data-type="${group.type}">`;
      html += `<div class="question-group-header">Questions ${esc(group.questionRange)}</div>`;
      html += `<div class="question-group-instructions">${esc(group.instructions)}</div>`;

      switch (group.type) {
        case 'heading_match':
          html += renderHeadingMatch(group);
          break;
        case 'multiple_choice':
          html += renderMultipleChoice(group);
          break;
        case 'true_false_notgiven':
        case 'yes_no_notgiven':
          html += renderTFNG(group);
          break;
        case 'summary_completion':
          html += renderSummaryCompletion(group);
          break;
        case 'matching_features':
          html += renderMatchingFeatures(group);
          break;
        case 'matching_endings':
          html += renderMatchingEndings(group);
          break;
        case 'matching_information':
          html += isMatchingFeaturesLikeInformationGroup(group)
            ? renderMatchingFeatures(group)
            : renderMatchingInformation(group);
          break;
        case 'sentence_completion':
          html += renderSentenceCompletion(group);
          break;
        case 'note_completion':
          html += renderNoteCompletion(group);
          break;
        case 'table_completion':
          html += renderTableCompletion(group);
          break;
        case 'flowchart_completion':
          html += renderFlowchartCompletion(group);
          break;
        case 'diagram_completion':
          html += renderDiagramCompletion(group);
          break;
        case 'short_answer':
          html += renderShortAnswer(group);
          break;
        case 'matching':
          html += renderMatching(group);
          break;
        default:
          html += `<p style="color:var(--error);">Unknown question type: ${esc(group.type)}</p>`;
      }

      html += `</div>`;
    }

    el.innerHTML = html;

    // Attach change/input event listeners to save answers dynamically
    attachInputListeners();
  }

  function renderHeadingMatch(group) {
    let html = '<div class="heading-list heading-match-list">';

    const options = (group.headingOptions || []).map(normalizeHeadingOption).filter(Boolean);
    group.headingOptions = options;
    const assigned = new Set(Object.values(answers));

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const isAssigned = assigned.has(opt);
      const displayStyle = isAssigned ? 'display: none;' : '';
      html += `
        <div class="heading-pill" draggable="true" ondragstart="Renderer.dragHeading(event)" data-text="${esc(opt)}" style="${displayStyle}">
          <span>${esc(opt)}</span>
        </div>`;
    }
    html += '</div>';
    return html;
  }

  function renderMultipleChoice(group) {
    let html = '';
    for (const q of (group.questions || [])) {
      const label = q.numbers || q.number;
      const isMulti = (group.selectCount || 1) > 1;
      const inputType = isMulti ? 'checkbox' : 'radio';
      const name = `q_${label}`;

      html += `<div class="question-item" data-q-item="${label}">`;
      if (q.stem) {
        html += `<div class="question-stem">${esc(String(label))}. ${esc(q.stem)}</div>`;
      }
      for (let i = 0; i < (q.options || []).length; i++) {
        const id = `${name}_${i}`;
        const optionLetter = String.fromCharCode(65 + i); // A, B, C, D...
        const limitAttr = isMulti ? ` data-select-limit="${group.selectCount}"` : '';
        html += `<div class="question-option">
          <input type="${inputType}" name="${name}" id="${id}" value="${optionLetter}" data-q-num="${label}"${limitAttr} />
          <label for="${id}"><strong>${optionLetter}.</strong> ${esc(q.options[i])}</label>
        </div>`;
      }
      html += `</div>`;
    }
    return html;
  }

  function renderTFNG(group) {
    let html = '';
    const isYN = group.type === 'yes_no_notgiven';
    const choices = isYN ? ['YES', 'NO', 'NOT GIVEN'] : ['TRUE', 'FALSE', 'NOT GIVEN'];

    for (const q of (group.questions || [])) {
      const name = `q_${q.number}`;
      html += `<div class="question-item" data-q-item="${q.number}">`;
      html += `<div class="question-stem">${q.number}. ${esc(q.statement)}</div>`;
      for (const choice of choices) {
        const id = `${name}_${choice}`;
        html += `<div class="question-option">
          <input type="radio" name="${name}" id="${id}" value="${choice}" data-q-num="${q.number}" />
          <label for="${id}">${choice}</label>
        </div>`;
      }
      html += `</div>`;
    }
    return html;
  }

  function renderSummaryCompletion(group) {
    const groupKey = `summary_${group.questionRange}`;
    let html = '<div class="summary-text">';

    if (group.options && group.options.length > 0) {
      html += '<div class="summary-wordbank">';
      html += '<div class="heading-label">List of Words</div>';
      for (let i = 0; i < group.options.length; i++) {
        const letter = String.fromCharCode(65 + i);
        const optionText = normalizeWordBankOption(group.options[i]);
        html += `<div class="summary-option-pill" draggable="true" data-summary-group="${groupKey}" data-letter="${letter}" data-option-text="${esc(optionText)}" ondragstart="Renderer.dragSummaryOption(event)">
          <span>${esc(optionText)}</span>
        </div>`;
      }
      html += '</div>';
    }

    // Main summary text with blanks
    if (group.summaryText) {
      html += parseSummaryBlanks(group.summaryText, groupKey, !!group.options?.length);
    }
    html += '</div>';

    // Additional summary paragraphs
    if (group.additionalSummaries) {
      for (const s of group.additionalSummaries) {
        html += `<div class="summary-text">${parseSummaryBlanks(s.text, groupKey, !!group.options?.length)}</div>`;
      }
    }

    return html;
  }

  function renderGapInput(qNum, extraClass = '', placeholder = qNum, inlineStyle = '', extraAttrs = '') {
    const styleAttr = inlineStyle ? ` style="${inlineStyle}"` : '';
    const classAttr = `summary-blank${extraClass ? ' ' + extraClass : ''}`;
    return `<input type="text" class="${classAttr}" data-q="${qNum}" placeholder="${esc(String(placeholder))}" aria-label="Answer for question ${esc(String(qNum))}"${styleAttr}${extraAttrs ? ' ' + extraAttrs : ''} />`;
  }

  function parseSummaryBlanks(text, groupKey = '', useWordBank = false) {
    const normalizedText = String(text || '')
      .replace(/(?:_\s*)+(___\d+___)(?:\s*_)+/g, '$1')
      .replace(/(?:_\s*)+(__(?:\d+)__)(?:\s*_)+/g, '$1');

    return esc(normalizedText).replace(/_{2,}(\d+)_{2,}|_{3,}(\d+)_{3,}/g, (match, shortNum, longNum) => {
      const num = shortNum || longNum;
      const attrs = useWordBank
        ? `data-summary-group="${groupKey}" readonly ondragover="Renderer.allowDrop(event)" ondragleave="Renderer.dragLeave(event)" ondrop="Renderer.dropSummaryOption(event)"`
        : '';
      const extraClass = useWordBank ? ' summary-choice-blank' : '';
      return renderGapInput(num, extraClass, num, '', attrs);
    });
  }

  function dragSummaryOption(ev) {
    if (answersLocked) {
      ev.preventDefault();
      return;
    }
    const pill = ev.currentTarget;
    const payload = {
      groupKey: pill.getAttribute('data-summary-group'),
      letter: pill.getAttribute('data-letter'),
      text: pill.getAttribute('data-option-text') || ''
    };
    ev.dataTransfer.setData('application/json', JSON.stringify(payload));
    ev.dataTransfer.effectAllowed = 'move';
    pill.classList.add('dragging');
  }

  function dropSummaryOption(ev) {
    ev.preventDefault();
    ev.currentTarget.classList.remove('dragover');
    if (answersLocked) return;

    let payload = null;
    try {
      payload = JSON.parse(ev.dataTransfer.getData('application/json'));
    } catch (error) {
      return;
    }

    const input = ev.currentTarget;
    const groupKey = input.getAttribute('data-summary-group');
    const qNum = input.getAttribute('data-q');
    if (!payload || payload.groupKey !== groupKey || !payload.letter || !qNum) return;

    answers[qNum] = payload.letter;
    input.value = formatSummaryChoiceDisplay(payload.letter, payload.text);
    input.setAttribute('data-selected-letter', payload.letter);
    input.setAttribute('data-selected-text', payload.text || '');
    input.placeholder = '';
    updateQuestionState(qNum, true);
    refreshSummaryOptionPills(groupKey);
  }

  function formatSummaryChoiceDisplay(letter, text) {
    return normalizeWordBankOption(text || letter);
  }

  function normalizeWordBankOption(option) {
    return String(option || '').trim().replace(/^[A-Z][\.)]?\s+/, '');
  }

  function refreshSummaryOptionPills(groupKey) {
    const usedLetters = new Set(
      Array.from(document.querySelectorAll(`.summary-choice-blank[data-summary-group="${groupKey}"]`))
        .map((input) => answers[input.getAttribute('data-q')])
        .filter(Boolean)
    );

    document.querySelectorAll(`.summary-option-pill[data-summary-group="${groupKey}"]`).forEach((pill) => {
      const isUsed = usedLetters.has(pill.getAttribute('data-letter'));
      pill.classList.toggle('used', isUsed);
      pill.setAttribute('aria-hidden', isUsed ? 'true' : 'false');
      pill.setAttribute('draggable', isUsed ? 'false' : 'true');
    });
  }

  function renderMatchingFeatures(group) {
    const options = (group.options || []).map(normalizeChoiceLabel);
    const gridColumns = `minmax(260px, 1.8fr) repeat(${options.length}, minmax(56px, 72px))`;
    const mobileGridColumns = `minmax(220px, 1.6fr) repeat(${options.length}, minmax(48px, 56px))`;
    let html = '<div class="matching-features-wrap">';
    html += `<div class="matching-features-grid" style="--grid-columns:${gridColumns}; --grid-columns-mobile:${mobileGridColumns};">`;
    html += '<div class="matching-features-header matching-features-stem"></div>';
    for (let i = 0; i < options.length; i++) {
      const letter = String.fromCharCode(65 + i);
      html += `<div class="matching-features-header">${letter}</div>`;
    }

    for (const q of (group.questions || [])) {
      const stem = q.statement || q.stem || '';
      html += `<div class="matching-features-stem" data-q-item="${q.number}">
        <span class="matching-features-number">${esc(String(q.number))}</span>
        <span>${esc(stem)}</span>
      </div>`;
      for (let i = 0; i < options.length; i++) {
        const letter = String.fromCharCode(65 + i);
        const id = `match_feature_${q.number}_${letter}`;
        html += `<label class="matching-features-cell" for="${id}">
          <input type="radio" id="${id}" name="q_${q.number}" value="${letter}" data-q-num="${q.number}" />
        </label>`;
      }
    }
    html += '</div>';

    html += '<table class="matching-feature-options" aria-label="Matching options"><tbody>';
    html += '<tr><th colspan="2">List of Options</th></tr>';
    for (let i = 0; i < options.length; i++) {
      const letter = String.fromCharCode(65 + i);
      html += `<tr><td>${letter}</td><td>${esc(options[i])}</td></tr>`;
    }
    html += '</tbody></table></div>';
    return html;
  }

  function isMatchingFeaturesLikeInformationGroup(group) {
    if (group?.type !== 'matching_information') return false;
    const options = group.options || [];
    if (!options.length) return false;
    return options.some(option => !/^[A-Z]$/.test(String(option || '').trim()));
  }

  function renderMatchingOptions(group) {
    let html = '<div class="heading-list" style="margin-bottom:16px;">';
    html += `<div class="heading-label">List of Options</div>`;
    for (let i = 0; i < (group.options || []).length; i++) {
      html += `<div style="font-size:0.88rem; font-weight:600; margin-bottom:4px;"><strong>${String.fromCharCode(65 + i)}.</strong> ${esc(group.options[i])}</div>`;
    }
    html += '</div>';

    for (const q of (group.questions || [])) {
      html += `<div class="question-item" data-q-item="${q.number}" style="margin-bottom:12px;">
        <div class="question-stem">${q.number}. ${esc(q.statement || q.stem || '')}</div>
        <select class="config-select" style="max-width:120px; padding:6px; margin-top:4px;" data-q="${q.number}">
          <option value="">Select...</option>`;
      for (let i = 0; i < (group.options || []).length; i++) {
        const val = String.fromCharCode(65 + i);
        html += `<option value="${val}">${val}</option>`;
      }
      html += `</select></div>`;
    }
    return html;
  }

  function renderMatchingEndings(group) {
    const options = (group.options || []).map(normalizeChoiceLabel);
    let html = '<div class="matching-endings">';
    const groupQuestionNumbers = new Set((group.questions || []).map(q => String(q.number)));
    const assignedLetters = new Set(
      Object.entries(answers)
        .filter(([questionNumber]) => groupQuestionNumbers.has(String(questionNumber)))
        .map(([, answer]) => answer)
    );

    for (const q of (group.questions || [])) {
      const savedLetter = answers[q.number];
      const optionIndex = savedLetter ? savedLetter.charCodeAt(0) - 65 : -1;
      const savedText = optionIndex >= 0 ? options[optionIndex] : '';

      html += `<div class="matching-ending-question" data-q-item="${q.number}">
        <div class="matching-ending-stem">${esc(q.stem || q.statement || '')}</div>
        <div class="matching-ending-slot ${savedLetter ? 'filled' : ''}" data-q="${q.number}"
          ondragover="Renderer.allowDrop(event)" ondragleave="Renderer.dragLeave(event)" ondrop="Renderer.dropMatchingEnding(event)">
          <span class="matching-ending-slot-text">${savedLetter ? esc(savedText) : esc(String(q.number))}</span>
          ${savedLetter ? `<button class="slot-clear" onclick="Renderer.clearMatchingEnding(${q.number}, event)">&times;</button>` : ''}
        </div>
      </div>`;
    }

    html += '<div class="matching-ending-options">';
    for (let i = 0; i < options.length; i++) {
      const letter = String.fromCharCode(65 + i);
      const displayStyle = assignedLetters.has(letter) ? 'display:none;' : '';
      html += `<div class="matching-ending-pill" draggable="true" ondragstart="Renderer.dragMatchingEnding(event)"
        data-letter="${letter}" data-text="${esc(options[i])}" style="${displayStyle}">
        <span>${esc(options[i])}</span>
      </div>`;
    }
    html += '</div></div>';
    return html;
  }

  function normalizeChoiceLabel(value) {
    return String(value || '').trim().replace(/^[A-Z][\.)]?\s+/, '');
  }

  function normalizeHeadingOption(value) {
    return String(value || '')
      .trim()
      .replace(/^[ivxlcdm]+[\.)]\s+/i, '')
      .replace(/^[ivxlcdm]+\s+(?=[A-Z])/, '');
  }

  function renderDiagramCompletion(group) {
    const imgSrc = group.diagramImage;
    if (!imgSrc) {
      throw new Error(`Diagram completion questions ${group.questionRange} require an uploaded diagram image.`);
    }

    let html = `
      <div class="diagram-container">
        <img src="${imgSrc}" class="diagram-img" alt="Diagram for questions ${group.questionRange}" />
      </div>
      <div class="diagram-answers">`;

    for (const q of (group.questions || [])) {
      html += `
        <div class="diagram-answer-item" data-q-item="${q.number}">
          ${renderGapInput(q.number, '', q.number, 'width: 126px;')}
        </div>`;
    }
    html += '</div>';
    return html;
  }

  function renderShortAnswer(group) {
    let html = '';
    for (const q of (group.questions || [])) {
      html += `<div class="question-item" data-q-item="${q.number}">
        <div class="question-stem">${q.number}. ${esc(q.stem || q.statement || '')}</div>
        ${renderGapInput(q.number, '', q.number, 'width: 280px; margin-top: 6px;')}
      </div>`;
    }
    return html;
  }

  function renderMatching(group) {
    // matching lists / sections mapping
    return renderMatchingOptions(group);
  }

  function renderMatchingInformation(group) {
    let options = group.options;
    if (!options || options.length === 0) {
      const part = testData.parts[currentPartIndex];
      const sectionCount = part.passage?.sections?.length || 5;
      options = [];
      for (let i = 0; i < sectionCount; i++) {
        options.push(String.fromCharCode(65 + i)); // A, B, C...
      }
    }

    // Check if any answer is used more than once
    const answerCounts = {};
    let hasMultipleAnswers = false;
    for (const q of (group.questions || [])) {
      const qNum = String(q.number);
      const ans = answers[qNum];
      if (ans) {
        answerCounts[ans] = (answerCounts[ans] || 0) + 1;
        if (answerCounts[ans] > 1) {
          hasMultipleAnswers = true;
        }
      }
    }

    const gridColumns = `minmax(260px, 1.8fr) repeat(${options.length}, minmax(56px, 72px))`;
    const mobileGridColumns = `minmax(220px, 1.6fr) repeat(${options.length}, minmax(48px, 56px))`;
    let html = '<div class="heading-list matching-grid-wrap">';
    html += '<div class="heading-label">Choose the correct paragraph for each statement.</div>';
    if (hasMultipleAnswers) {
      html += '<div class="heading-label" style="color: var(--muted); font-size: 0.85rem; margin-top: 6px; margin-bottom: 8px;">You may use any letter more than once.</div>';
    }
    html += `<div class="matching-grid" style="--grid-columns:${gridColumns}; --grid-columns-mobile:${mobileGridColumns};">`;
    html += '<div class="matching-grid-header matching-grid-stem"></div>';
    for (const opt of options) {
      html += `<div class="matching-grid-header">${esc(opt)}</div>`;
    }

    for (const q of (group.questions || [])) {
      const stem = `${q.number}. ${q.statement || q.stem || ''}`;
      html += `<div class="matching-grid-stem" data-q-item="${q.number}">${esc(stem)}</div>`;
      for (const opt of options) {
        const id = `match_info_${q.number}_${opt}`;
        html += `<label class="matching-grid-cell" for="${id}">
          <input type="radio" id="${id}" name="q_${q.number}" value="${opt}" data-q-num="${q.number}" />
        </label>`;
      }
    }
    html += '</div></div>';
    return html;
  }

  function renderSentenceCompletion(group) {
    let html = '';
    for (const q of (group.questions || [])) {
      html += `<div class="question-item" data-q-item="${q.number}" style="margin-bottom:12px; line-height:1.6;">`;
      const stmt = q.statement || q.stem || '';
      if (/_{2,}(\d+)?_{2,}/.test(stmt)) {
        const replaced = esc(stmt).replace(/_{2,}(\d+)?_{2,}/g, (match, num) => {
          const qNum = num || q.number;
          return renderGapInput(qNum, '', qNum, 'width: 126px; margin: 0 4px;');
        });
        html += `${q.number}. ${replaced}`;
      } else {
        html += `${q.number}. ${esc(stmt)} ${renderGapInput(q.number, '', q.number, 'width: 126px; margin-left: 6px;')}`;
      }
      html += `</div>`;
    }
    return html;
  }

  function renderNoteCompletion(group) {
    let html = '<div class="summary-text" style="background: #fafafa; border: 1px solid var(--border); padding: 16px; border-radius: 6px;">';
    if (group.title) {
      html += `<h4 style="margin-top:0; margin-bottom:10px;">${esc(group.title)}</h4>`;
    }
    if (group.noteText) {
      const lines = String(group.noteText || '').split(/\n+/).map(line => line.trim()).filter(Boolean);
      let listOpen = false;
      for (const line of lines) {
        if (isNoteHeadingLine(line)) {
          if (listOpen) {
            html += '</ul>';
            listOpen = false;
          }
          html += `<h4 style="margin:14px 0 6px;">${esc(line)}</h4>`;
        } else if (/^[-•]\s+/.test(line)) {
          if (!listOpen) {
            html += '<ul style="margin:0 0 10px; padding-left:20px; line-height:1.7;">';
            listOpen = true;
          }
          html += `<li style="margin-bottom:6px;">${parseSummaryBlanks(line.replace(/^[-•]\s+/, ''))}</li>`;
        } else {
          if (listOpen) {
            html += '</ul>';
            listOpen = false;
          }
          html += `<p style="margin:0 0 10px; line-height:1.7;">${parseSummaryBlanks(line)}</p>`;
        }
      }
      if (listOpen) html += '</ul>';
      html += '</div>';
      return html;
    }
    html += '<ul style="margin: 0; padding-left: 20px; line-height:1.7;">';
    for (const q of (group.questions || [])) {
      html += `<li data-q-item="${q.number}" style="margin-bottom: 8px;">`;
      const text = q.statement || q.stem || '';
      if (/_{2,}(\d+)?_{2,}/.test(text)) {
        const replaced = esc(text).replace(/_{2,}(\d+)?_{2,}/g, (match, num) => {
          const qNum = num || q.number;
          return renderGapInput(qNum, '', qNum, 'width: 126px; margin: 0 4px;');
        });
        html += replaced;
      } else {
        html += `${esc(text)} ${renderGapInput(q.number, '', q.number, 'width: 126px; margin-left: 6px;')}`;
      }
      html += `</li>`;
    }
    html += '</ul></div>';
    return html;
  }

  function isNoteHeadingLine(line) {
    const text = String(line || '').trim();
    if (!text || text.length > 90) return false;
    if (/^[-•]\s+/.test(text)) return false;
    if (/_{2,}\d*_{2,}/.test(text)) return false;
    if (/[.!?]$/.test(text)) return false;
    return /[A-Za-z]/.test(text);
  }

  function renderTableCompletion(group) {
    if (!group.tableHeaders || !group.tableRows) {
      return renderNoteCompletion(group);
    }
    let html = '<div style="overflow-x:auto; margin: 16px 0;">';
    html += '<table style="width:100%; border-collapse: collapse; border: 1px solid var(--border); font-size:0.88rem;">';
    html += '<thead><tr style="background:#f5f6f8; border-bottom: 2px solid var(--border);">';
    for (const h of group.tableHeaders) {
      html += `<th style="padding:10px; border:1px solid var(--border); text-align:left;">${esc(h)}</th>`;
    }
    html += '</tr></thead><tbody>';
    for (const row of group.tableRows) {
      html += '<tr>';
      for (const cell of row) {
        html += `<td style="padding:10px; border:1px solid var(--border); line-height:1.5;">`;
        if (/_{2,}(\d+)_{2,}/.test(cell)) {
          const replaced = esc(cell).replace(/_{2,}(\d+)_{2,}/g, (match, num) => {
            return renderGapInput(num, '', num, 'width: 100px; padding: 4px; font-size: 0.8rem;');
          });
          html += replaced;
        } else {
          html += esc(cell);
        }
        html += `</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
  }

  function renderFlowchartCompletion(group) {
    let html = '<div style="display:flex; flex-direction:column; gap:14px; margin: 16px 0; align-items:center;">';
    const steps = group.questions || [];
    for (let i = 0; i < steps.length; i++) {
      const q = steps[i];
      const color = q.color || 'var(--accent)';
      const width = Number(q.width || 320);
      const height = Number(q.height || 72);
      html += `
        <div class="diagram-container" data-q-item="${q.number}" style="margin: 0; padding:16px; text-align:left; background:#fafafa; border:2px solid ${esc(color)}; min-width:${Math.max(160, width)}px; min-height:${Math.max(48, height)}px; max-width:100%;">
          <div style="font-weight:700; margin-bottom:8px; color:var(--accent);">Step ${i + 1}</div>
          <div>`;
      const text = q.statement || q.stem || '';
      if (/_{2,}(\d+)?_{2,}/.test(text)) {
        const replaced = esc(text).replace(/_{2,}(\d+)?_{2,}/g, (match, num) => {
          const qNum = num || q.number;
          return renderGapInput(qNum, '', qNum, 'width: 126px; margin: 0 4px;');
        });
        html += replaced;
      } else {
        html += `${esc(text)} ${renderGapInput(q.number, '', q.number, 'width: 126px; margin-left: 6px;')}`;
      }
      html += `</div></div>`;
      if (i < steps.length - 1) {
        const arrow = q.arrow || 'down';
        const arrowText = arrow === 'up' ? '↑' : arrow === 'right' ? '→' : arrow === 'left' ? '←' : arrow === 'both' ? '↕' : arrow === 'branch' ? `↘ branch to ${esc(String(q.branchTo || i + 2))}` : arrow === 'none' ? '' : '↓';
        if (arrowText) html += `<div style="text-align:center; color:var(--muted); font-size:1.2rem;">${arrowText}</div>`;
      }
      if (false && i < steps.length - 1) {
        html += '<div style="text-align:center; color:var(--muted); font-size:1.2rem;">↓</div>';
      }
    }
    html += '</div>';
    return html;
  }

  function renderBottomNav() {
    const partsEl = document.getElementById('nav-parts');

    // Part tabs
    let partsHTML = '';
    for (let i = 0; i < testData.parts.length; i++) {
      const p = testData.parts[i];
      const active = i === currentPartIndex ? ' active' : '';
      const totalQ = countQuestions(p);
      const answeredQ = countAnsweredQuestions(p);
      partsHTML += `<button class="nav-part-btn${active}" onclick="Renderer.goToPart(${i})">
        Part ${p.partNumber} <span id="part-count-${i}" style="font-weight:400; margin-left:4px; font-size:.72rem;">${answeredQ} of ${totalQ}</span>
      </button>`;
    }
    partsEl.innerHTML = partsHTML;

    // Question buttons for current part
    renderQuestionNav();
  }

  function renderQuestionNav() {
    const questionsEl = document.getElementById('nav-questions');
    const part = testData.parts[currentPartIndex];
    let html = '';

    for (const group of (part.questionGroups || [])) {
      for (const q of (group.questions || [])) {
        const label = getQuestionLabel(q);
        const activeClass = String(label) === String(activeQuestionLabel) ? ' active' : '';
        const answeredClass = answers[label] ? ' answered' : '';
        html += `<button class="nav-q-btn${answeredClass}" id="nav-q-${label}" onclick="Renderer.scrollToQuestion('${label}')">${label}</button>`;
      }
    }
    questionsEl.innerHTML = html;
  }

  function getQuestionLabel(question) {
    return String(question?.numbers || question?.number || '').trim();
  }

  function getQuestionSequence() {
    const sequence = [];
    for (let partIndex = 0; partIndex < (testData?.parts || []).length; partIndex++) {
      const part = testData.parts[partIndex];
      for (const group of (part.questionGroups || [])) {
        for (const question of (group.questions || [])) {
          const label = getQuestionLabel(question);
          if (label) sequence.push({ partIndex, label });
        }
      }
    }
    return sequence;
  }

  function countQuestions(part) {
    let count = 0;
    for (const g of (part.questionGroups || [])) {
      for (const q of (g.questions || [])) {
        count += countRangeSlots(q.numbers || q.number);
      }
    }
    return count;
  }

  function countAnsweredQuestions(part) {
    let count = 0;
    for (const g of (part.questionGroups || [])) {
      for (const q of (g.questions || [])) {
        const num = q.numbers || q.number;
        if (!answers[num]) continue;
        count += countAnsweredSlots(num, answers[num]);
      }
    }
    return count;
  }

  function countRangeSlots(label) {
    const match = String(label || '').match(/^(\d+)\s*-\s*(\d+)$/);
    if (!match) return 1;
    const start = Number(match[1]);
    const end = Number(match[2]);
    return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start + 1 : 1;
  }

  function countAnsweredSlots(label, value) {
    const rangeSlots = countRangeSlots(label);
    if (rangeSlots === 1) return value ? 1 : 0;
    const selected = String(value || '').split(',').map(item => item.trim()).filter(Boolean);
    return Math.min(rangeSlots, selected.length || 1);
  }

  function goToPart(index) {
    if (!testData || index < 0 || index >= testData.parts.length) return;
    renderPart(index);
    renderBottomNav();
    // Scroll panels to top
    document.getElementById('passage-panel').scrollTop = 0;
    document.getElementById('questions-panel').scrollTop = 0;
  }

  function navigatePrev() {
    navigateQuestionByOffset(-1);
  }

  function navigateNext() {
    navigateQuestionByOffset(1);
  }

  function navigateQuestionByOffset(offset) {
    const sequence = getQuestionSequence();
    if (sequence.length === 0) return;

    let index = sequence.findIndex(item =>
      item.partIndex === currentPartIndex && String(item.label) === String(activeQuestionLabel)
    );

    if (index === -1) {
      index = sequence.findIndex(item => item.partIndex === currentPartIndex);
    }

    const nextIndex = Math.max(0, Math.min(sequence.length - 1, index + offset));
    const target = sequence[nextIndex];
    if (!target) return;

    if (target.partIndex !== currentPartIndex) {
      renderPart(target.partIndex);
      renderBottomNav();
    }
    scrollToQuestion(target.label);
  }

  function updateNavHighlights() {
    document.querySelectorAll('.nav-part-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === currentPartIndex);
    });
  }

  // ── Drag & Drop Handlers ──
  function dragHeading(ev) {
    if (answersLocked) {
      ev.preventDefault();
      return;
    }
    ev.dataTransfer.setData("text/plain", ev.currentTarget.getAttribute("data-text"));
    ev.currentTarget.style.opacity = '0.5';
  }

  function dragMatchingEnding(ev) {
    if (answersLocked) {
      ev.preventDefault();
      return;
    }
    ev.dataTransfer.setData('application/json', JSON.stringify({
      letter: ev.currentTarget.getAttribute('data-letter'),
      text: ev.currentTarget.getAttribute('data-text')
    }));
    ev.currentTarget.style.opacity = '0.5';
  }

  document.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('heading-pill') || e.target.classList.contains('matching-ending-pill') || e.target.classList.contains('summary-option-pill')) {
      e.target.style.opacity = '1';
      e.target.classList.remove('dragging');
    }
  });

  function allowDrop(ev) {
    if (answersLocked) return;
    ev.preventDefault();
    ev.currentTarget.classList.add('dragover');
  }

  function dragLeave(ev) {
    ev.currentTarget.classList.remove('dragover');
  }

  function dropHeading(ev) {
    ev.preventDefault();
    ev.currentTarget.classList.remove('dragover');
    if (answersLocked) return;

    const text = ev.dataTransfer.getData("text/plain");
    const qNum = ev.currentTarget.getAttribute("data-q");

    if (text && qNum) {
      answers[qNum] = text;

      // Update drop zone content
      ev.currentTarget.querySelector('.slot-text').textContent = text;
      ev.currentTarget.querySelector('.slot-text').classList.add('slot-heading');

      // Add clear button if not already present
      if (!ev.currentTarget.querySelector('.slot-clear')) {
        const btn = document.createElement('button');
        btn.className = 'slot-clear';
        btn.innerHTML = '&times;';
        btn.onclick = (e) => clearSlot(qNum, e);
        ev.currentTarget.appendChild(btn);
      }

      // Update nav state
      updateQuestionState(qNum, true);

      // Hide matched pill
      refreshHeadingPills();
    }
  }

  function dropMatchingEnding(ev) {
    ev.preventDefault();
    ev.currentTarget.classList.remove('dragover');
    if (answersLocked) return;

    const raw = ev.dataTransfer.getData('application/json');
    if (!raw) return;

    const payload = JSON.parse(raw);
    const qNum = ev.currentTarget.getAttribute('data-q');
    if (!payload.letter || !qNum) return;

    answers[qNum] = payload.letter;
    ev.currentTarget.classList.add('filled');
    ev.currentTarget.querySelector('.matching-ending-slot-text').textContent = payload.text;

    if (!ev.currentTarget.querySelector('.slot-clear')) {
      const btn = document.createElement('button');
      btn.className = 'slot-clear';
      btn.innerHTML = '&times;';
      btn.onclick = (e) => clearMatchingEnding(qNum, e);
      ev.currentTarget.appendChild(btn);
    }

    updateQuestionState(qNum, true);
    refreshMatchingEndingPills();
  }

  function clearSlot(qNum, ev) {
    if (ev) ev.stopPropagation();
    if (answersLocked) return;
    delete answers[qNum];

    // Refresh passage panel or manually reset drop zone
    const zone = document.getElementById(`drop-zone-${qNum}`);
    if (zone) {
      zone.querySelector('.slot-text').textContent = 'Drop heading here';
      zone.querySelector('.slot-text').classList.remove('slot-heading');
      const btn = zone.querySelector('.slot-clear');
      if (btn) btn.remove();
    }

    updateQuestionState(qNum, false);

    // Show pill again
    refreshHeadingPills();
  }

  function clearMatchingEnding(qNum, ev) {
    if (ev) ev.stopPropagation();
    if (answersLocked) return;
    delete answers[qNum];

    const slot = document.querySelector(`.matching-ending-slot[data-q="${qNum}"]`);
    if (slot) {
      slot.classList.remove('filled');
      slot.querySelector('.matching-ending-slot-text').textContent = qNum;
      const btn = slot.querySelector('.slot-clear');
      if (btn) btn.remove();
    }

    updateQuestionState(qNum, false);
    refreshMatchingEndingPills();
  }

  function refreshHeadingPills() {
    const assigned = new Set(Object.values(answers));
    document.querySelectorAll('.heading-pill').forEach(pill => {
      const text = pill.getAttribute('data-text');
      if (assigned.has(text)) {
        pill.style.display = 'none';
      } else {
        pill.style.display = 'flex';
      }
    });
  }

  function refreshMatchingEndingPills() {
    const assigned = new Set(
      Array.from(document.querySelectorAll('.matching-ending-slot[data-q]'))
        .map(slot => answers[slot.getAttribute('data-q')])
        .filter(Boolean)
    );

    document.querySelectorAll('.matching-ending-pill').forEach(pill => {
      const letter = pill.getAttribute('data-letter');
      pill.style.display = assigned.has(letter) ? 'none' : 'flex';
    });
  }

  // ── Answer Event Listeners ──
  function attachInputListeners() {
    // Inputs (text boxes, selects)
    document.querySelectorAll('#questions-content input[type="text"], #questions-content select').forEach(el => {
      const handler = (e) => {
        if (answersLocked) return;
        const qNum = e.target.getAttribute('data-q');
        if (qNum) {
          const val = e.target.value.trim();
          if (val) {
            answers[qNum] = val;
          } else {
            delete answers[qNum];
          }
          updateQuestionState(qNum, !!val);
        }
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });

    // Radios and Checkboxes
    document.querySelectorAll('#questions-content input[type="radio"], #questions-content input[type="checkbox"]').forEach(el => {
      el.addEventListener('change', (e) => {
        if (answersLocked) {
          e.preventDefault();
          restoreAnswers();
          return;
        }
        const qNum = e.target.getAttribute('data-q-num');
        const name = e.target.name;

        if (qNum) {
          const selectLimit = Number(e.target.getAttribute('data-select-limit') || 0);
          if (e.target.type === 'checkbox' && selectLimit > 0) {
            const selected = document.querySelectorAll(`input[name="${name}"]:checked`);
            if (selected.length > selectLimit) {
              e.target.checked = false;
              return;
            }
          }
          const inputs = document.querySelectorAll(`input[name="${name}"]:checked`);
          if (inputs.length > 0) {
            const vals = Array.from(inputs).map(i => i.value).join(', ');
            answers[qNum] = vals;
          } else {
            delete answers[qNum];
          }
          updateQuestionState(qNum, inputs.length > 0);
          syncMultiChoiceLimits(name);
        }
      });
    });
    syncMultiChoiceLimits();
  }

  function syncMultiChoiceLimits(targetName = '') {
    if (answersLocked) return;
    const selector = targetName
      ? `#questions-content input[type="checkbox"][data-select-limit][name="${targetName}"]`
      : '#questions-content input[type="checkbox"][data-select-limit]';
    const boxes = Array.from(document.querySelectorAll(selector));
    const names = new Set(boxes.map(box => box.name));

    for (const name of names) {
      const groupBoxes = Array.from(document.querySelectorAll(`#questions-content input[type="checkbox"][data-select-limit][name="${name}"]`));
      const limit = Number(groupBoxes[0]?.getAttribute('data-select-limit') || 0);
      if (!limit) continue;
      const checkedCount = groupBoxes.filter(box => box.checked).length;
      for (const box of groupBoxes) {
        box.disabled = checkedCount >= limit && !box.checked;
      }
    }
  }

  function restoreAnswers() {
    // Restore text values
    document.querySelectorAll('#questions-content input[type="text"], #questions-content select').forEach(el => {
      const qNum = el.getAttribute('data-q');
      if (qNum && answers[qNum]) {
        if (el.classList.contains('summary-choice-blank')) {
          const groupKey = el.getAttribute('data-summary-group');
          const pill = document.querySelector(`.summary-option-pill[data-summary-group="${groupKey}"][data-letter="${answers[qNum]}"]`);
          const text = normalizeWordBankOption(pill?.getAttribute('data-option-text') || '');
          el.value = formatSummaryChoiceDisplay(answers[qNum], text);
          el.setAttribute('data-selected-letter', answers[qNum]);
          el.setAttribute('data-selected-text', text);
        } else {
          el.value = answers[qNum];
        }
      }
    });

    // Restore radio/checkbox states
    document.querySelectorAll('#questions-content input[type="radio"], #questions-content input[type="checkbox"]').forEach(el => {
      const qNum = el.getAttribute('data-q-num');
      if (qNum && answers[qNum]) {
        const list = answers[qNum].split(', ').map(s => s.trim());
        if (list.includes(el.value)) {
          el.checked = true;
        }
      }
    });

    // Sync heading pills visibility
    refreshHeadingPills();
    refreshMatchingEndingPills();
    document.querySelectorAll('.summary-option-pill[data-summary-group]').forEach((pill) => {
      refreshSummaryOptionPills(pill.getAttribute('data-summary-group'));
    });
    syncMultiChoiceLimits();
    lockAnswerInputsIfNeeded();
  }

  function lockAnswers() {
    answersLocked = true;
    lockAnswerInputsIfNeeded();
  }

  function lockAnswerInputsIfNeeded() {
    if (!answersLocked) return;
    document.querySelectorAll('#questions-content input, #questions-content select, #questions-content textarea').forEach(el => {
      el.disabled = true;
      el.setAttribute('aria-disabled', 'true');
    });
    document.querySelectorAll('.heading-drop-zone, .matching-ending-slot, .summary-choice-blank').forEach(el => {
      el.classList.add('answers-locked');
      el.removeAttribute('ondrop');
      el.removeAttribute('ondragover');
      el.removeAttribute('ondragleave');
    });
    document.querySelectorAll('.slot-clear').forEach(btn => {
      btn.disabled = true;
      btn.style.display = 'none';
    });
    document.querySelectorAll('.heading-pill, .matching-ending-pill, .summary-option-pill').forEach(pill => {
      pill.setAttribute('draggable', 'false');
      pill.classList.add('answers-locked');
    });
  }

  function updateQuestionState(qNum, answered) {
    const btn = document.getElementById(`nav-q-${qNum}`);
    if (btn) {
      btn.classList.toggle('answered', answered);
    }
    // Update count in part tabs
    for (let i = 0; i < testData.parts.length; i++) {
      const p = testData.parts[i];
      const countEl = document.getElementById(`part-count-${i}`);
      if (countEl) {
        countEl.textContent = `${countAnsweredQuestions(p)} of ${countQuestions(p)}`;
      }
    }
  }

  function scrollToQuestion(label) {
    activeQuestionLabel = String(label || '').trim();
    renderQuestionNav();
    const el = document.querySelector(`[data-q-item="${label}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add brief highlight flash
      el.style.transition = 'background-color 0.5s';
      el.style.backgroundColor = '#fff9e6';
      setTimeout(() => { el.style.backgroundColor = ''; }, 1000);
    }
    // Also scroll text inputs inside summary paragraphs
    const textEl = document.querySelector(`.summary-blank[data-q="${label}"]`);
    if (textEl) {
      textEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      textEl.focus();
    }
  }

  // ── Verification: Check Answers ──
  function checkAnswers() {
    if (!testData.answerKey || Object.keys(testData.answerKey).length === 0) {
      if (window.IELTSApp?.notify) {
        const message = testData.answerKeySource === 'none'
          ? 'Answer-key generation was disabled, and no answer key was detected.'
          : 'No answer key available for this test.';
        window.IELTSApp.notify('warning', message);
      }
      return;
    }

    isChecked = true;
    lockAnswers();
    window.IELTSApp?.stopSessionIntegrity?.();
    applyValidationStyling();

    // Calculate score
    let score = 0;
    let total = 0;
    for (const entry of getAnswerKeyEntries()) {
      const { key, correct } = entry;
      total++;
      const isCorrect = isAnswerKeyEntryCorrect(entry);

      if (isCorrect) {
        score++;
      }
    }

    const sessionIntegrity = window.IELTSApp?.getSessionIntegrity?.();
    const resultMessages = [];
    if (testData.answerKeySource === 'generated') {
      resultMessages.push('No answer key was detected in the raw text, so the answers were generated from the passage automatically.');
    } else if (testData.answerKeySource === 'missing') {
      resultMessages.push('No answer key was detected in the raw text, and automatic answer-key generation did not return usable answers.');
    }
    if (sessionIntegrity && sessionIntegrity.leftTestInterfaceCount > 0) {
      resultMessages.push(`btw i noticed that you left the page ${sessionIntegrity.leftTestInterfaceCount} times. so... maybe this score was heavily buffed.`);
    }
    const warningMessage = resultMessages.join('\n\n');

    if (window.IELTSApp?.showResultModal) {
      window.IELTSApp.showResultModal({ score, total, warningMessage });
    }
  }

  function getScoreSnapshot() {
    if (!testData?.answerKey || Object.keys(testData.answerKey).length === 0) {
      return { score: 0, total: 0, hasAnswerKey: false };
    }

    let score = 0;
    let total = 0;
    for (const entry of getAnswerKeyEntries()) {
      total++;
      if (isAnswerKeyEntryCorrect(entry)) {
        score++;
      }
    }

    return { score, total, hasAnswerKey: true };
  }

  function applyValidationStyling() {
    if (!testData.answerKey) return;

    // Clear previous badges
    document.querySelectorAll('.correct-answer-badge').forEach(el => el.remove());
    document.querySelectorAll('.is-correct, .is-incorrect').forEach(el => {
      el.classList.remove('is-correct', 'is-incorrect');
    });

    const answerKeyEntries = getAnswerKeyEntries();
    const groupedCorrectDisplays = getGroupedCorrectDisplays(answerKeyEntries);

    for (const entry of answerKeyEntries) {
      const { key, correct } = entry;
      const correctVal = String(correct || '').trim();
      const displayCorrectVal = entry.groupedChoiceRange
        ? (groupedCorrectDisplays.get(entry.groupedChoiceRange.label) || correctVal)
        : correctVal;
      const userVal = getAnswerForQuestionKey(key);
      const isCorrect = isAnswerKeyEntryCorrect(entry);

      // Style bottom nav
      const navBtn = document.getElementById(`nav-q-${key}`) || document.getElementById(`nav-q-${findAnswerRangeForKey(key)}`);
      if (navBtn) {
        navBtn.classList.remove('answered');
        navBtn.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');
        // Red color or green color styling
        navBtn.style.backgroundColor = isCorrect ? '#e6f4ea' : '#fce8e6';
        navBtn.style.color = isCorrect ? 'var(--success)' : 'var(--error)';
        navBtn.style.borderColor = isCorrect ? 'var(--success)' : 'var(--error)';
      }

      // Style drag & drop slots in passage
      const dropZone = document.getElementById(`drop-zone-${key}`);
      if (dropZone) {
        const headingCorrectDisplay = getHeadingCorrectDisplay(key, correctVal);
        dropZone.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');
        if (!isCorrect) {
          const badge = document.createElement('span');
          badge.className = 'correct-answer-badge';
          badge.textContent = `Correct: ${headingCorrectDisplay || correctVal}`;
          dropZone.appendChild(badge);
        }
      }

      const endingSlot = document.querySelector(`.matching-ending-slot[data-q="${key}"]`);
      if (endingSlot) {
        endingSlot.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');
        if (!isCorrect && !endingSlot.querySelector('.correct-answer-badge')) {
          const badge = document.createElement('span');
          badge.className = 'correct-answer-badge';
          badge.textContent = `Correct: ${correctVal}`;
          endingSlot.appendChild(badge);
        }
      }

      // Style input fields (text, select) in question panel
      document.querySelectorAll(`[data-q="${key}"]`).forEach(input => {
        input.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');
        if (input.classList.contains('summary-blank')) {
          setGapCorrectAnswerHover(input, correctVal);
          return;
        }
        if (!isCorrect) {
          const parent = input.parentElement;
          if (parent && !parent.querySelector('.correct-answer-badge')) {
            const badge = document.createElement('span');
            badge.className = 'correct-answer-badge';
            badge.textContent = `Correct: ${correctVal}`;
            parent.appendChild(badge);
          }
        }
      });

      // Style multiple choice / radio choices
      const itemSelector = findAnswerRangeForKey(key) || key;
      document.querySelectorAll(`[data-q-item="${itemSelector}"]`).forEach(item => {
        // Highlight correct options or wrong options
        item.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');
        if (!isCorrect) {
          if (!item.querySelector('.correct-answer-badge')) {
            const badge = document.createElement('span');
            badge.className = 'correct-answer-badge';
            badge.textContent = `Correct: ${displayCorrectVal}`;
            const badgeTarget = item.querySelector('.question-stem') || item;
            badgeTarget.appendChild(badge);
          } else if (entry.groupedChoiceRange) {
            item.querySelector('.correct-answer-badge').textContent = `Correct: ${displayCorrectVal}`;
          }
        }
      });
    }

    lockAnswerInputsIfNeeded();
  }

  function isAnswerCorrect(userValue, correctValue) {
    const normalizedUser = normalizeComparableAnswer(userValue);
    if (!normalizedUser) return false;
    const accepted = getAcceptedAnswerVariants(correctValue).map(normalizeComparableAnswer);
    if (accepted.includes(normalizedUser)) return true;
    const selectedValues = String(userValue || '').split(',').map(normalizeComparableAnswer).filter(Boolean);
    return selectedValues.some(value => accepted.includes(value));
  }

  function isAnswerKeyEntryCorrect(entry) {
    const headingOption = getHeadingOptionForCorrectAnswer(entry.key, entry.correct);
    if (headingOption) {
      return normalizeComparableAnswer(getAnswerForQuestionKey(entry.key)) === normalizeComparableAnswer(headingOption);
    }

    if (entry?.groupedChoiceRange) {
      const selectedValues = splitAnswerList(getAnswerForQuestionKey(entry.key))
        .map(normalizeComparableAnswer)
        .filter(Boolean);
      if (selectedValues.length === 0) return false;

      const correctParts = splitAnswerList(entry.correct);
      const correctValue = correctParts.length > 1 && entry.groupedChoiceIndex != null
        ? correctParts[entry.groupedChoiceIndex]
        : entry.correct;
      const accepted = getAcceptedAnswerVariants(correctValue).map(normalizeComparableAnswer);
      return selectedValues.some(value => accepted.includes(value));
    }

    return isAnswerCorrect(getAnswerForQuestionKey(entry.key), entry.correct);
  }

  function getHeadingCorrectDisplay(key, correctValue) {
    const option = getHeadingOptionForCorrectAnswer(key, correctValue);
    if (!option) return '';
    return option;
  }

  function getHeadingOptionForCorrectAnswer(key, correctValue) {
    const group = findHeadingMatchGroupForQuestion(key);
    if (!group || !Array.isArray(group.headingOptions)) return '';

    const raw = String(correctValue || '').trim();
    if (!raw) return '';
    const directMatch = group.headingOptions.find(option =>
      normalizeComparableAnswer(option) === normalizeComparableAnswer(raw)
    );
    if (directMatch) return directMatch;

    const romanIndex = romanToNumber(raw) - 1;
    if (romanIndex >= 0 && romanIndex < group.headingOptions.length) {
      return group.headingOptions[romanIndex];
    }

    const numericIndex = Number(raw) - 1;
    if (Number.isInteger(numericIndex) && numericIndex >= 0 && numericIndex < group.headingOptions.length) {
      return group.headingOptions[numericIndex];
    }

    return '';
  }

  function findHeadingMatchGroupForQuestion(key) {
    const keyText = String(key || '').trim();
    for (const part of (testData?.parts || [])) {
      for (const group of (part.questionGroups || [])) {
        if (group.type !== 'heading_match') continue;
        const hasQuestion = (group.questions || []).some(question => String(question.number) === keyText);
        if (hasQuestion) return group;
      }
    }
    return null;
  }

  function romanToNumber(value) {
    const roman = String(value || '').trim().toLowerCase();
    if (!/^[ivxlcdm]+$/.test(roman)) return 0;
    const map = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
    let total = 0;
    for (let i = 0; i < roman.length; i++) {
      const current = map[roman[i]] || 0;
      const next = map[roman[i + 1]] || 0;
      total += current < next ? -current : current;
    }
    return total;
  }

  function numberToRoman(value) {
    const map = [
      ['m', 1000], ['cm', 900], ['d', 500], ['cd', 400],
      ['c', 100], ['xc', 90], ['l', 50], ['xl', 40],
      ['x', 10], ['ix', 9], ['v', 5], ['iv', 4], ['i', 1]
    ];
    let num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return String(value || '');
    let result = '';
    for (const [roman, amount] of map) {
      while (num >= amount) {
        result += roman;
        num -= amount;
      }
    }
    return result;
  }

  function getGroupedCorrectDisplays(entries) {
    const displays = new Map();
    const grouped = new Map();

    for (const entry of entries) {
      if (!entry.groupedChoiceRange) continue;
      const label = entry.groupedChoiceRange.label;
      if (!grouped.has(label)) grouped.set(label, []);
      grouped.get(label).push(entry);
    }

    for (const [label, groupEntries] of grouped.entries()) {
      const ordered = [...groupEntries].sort((a, b) => Number(a.key) - Number(b.key));
      const values = ordered.map(entry => String(entry.correct || '').trim()).filter(Boolean);
      displays.set(label, values.join(', '));
    }

    return displays;
  }

  function getAnswerKeyEntries() {
    const answerKey = testData?.answerKey || {};
    const rawKeys = Object.keys(answerKey);
    const individualKeys = new Set(rawKeys.filter(key => /^\d+$/.test(key)));
    const entries = [];
    const groupedChoiceRanges = getGroupedMultipleChoiceRanges();

    for (const rawKey of rawKeys) {
      const range = parseQuestionRangeLabel(rawKey);
      if (range && range.end > range.start) {
        const answersInRange = splitAnswerList(answerKey[rawKey]);
        const rangeLength = range.end - range.start + 1;
        for (let number = range.start; number <= range.end; number++) {
          const key = String(number);
          if (individualKeys.has(key)) continue;
          const index = number - range.start;
          entries.push({
            key,
            sourceKey: rawKey,
            correct: answersInRange.length === rangeLength ? answersInRange[index] : (answersInRange[index] || ''),
            groupedChoiceRange: groupedChoiceRanges.get(rawKey) || null,
            groupedChoiceIndex: index
          });
        }
        continue;
      }

      const groupedRangeKey = findGroupedRangeForQuestionKey(rawKey, groupedChoiceRanges);
      const groupedRange = groupedRangeKey ? groupedChoiceRanges.get(groupedRangeKey) : null;
      entries.push({
        key: rawKey,
        sourceKey: rawKey,
        correct: answerKey[rawKey],
        groupedChoiceRange: groupedRange || null,
        groupedChoiceIndex: groupedRange ? Number(rawKey) - groupedRange.start : null
      });
    }

    return entries.sort((a, b) => parseInt(a.key, 10) - parseInt(b.key, 10));
  }

  function getGroupedMultipleChoiceRanges() {
    const ranges = new Map();
    for (const part of (testData?.parts || [])) {
      for (const group of (part.questionGroups || [])) {
        if (group.type !== 'multiple_choice' || Number(group.selectCount || 1) <= 1) continue;
        for (const question of (group.questions || [])) {
          const label = String(question.numbers || question.number || group.questionRange || '').trim();
          const range = parseQuestionRangeLabel(label);
          if (!range) continue;
          ranges.set(label, {
            ...range,
            label,
            selectCount: Number(group.selectCount || range.end - range.start + 1)
          });
        }
      }
    }
    return ranges;
  }

  function findGroupedRangeForQuestionKey(key, groupedChoiceRanges) {
    const keyNumber = Number(key);
    if (!Number.isFinite(keyNumber)) return '';
    for (const [label, range] of groupedChoiceRanges.entries()) {
      if (keyNumber >= range.start && keyNumber <= range.end) return label;
    }
    return '';
  }

  function parseQuestionRangeLabel(label) {
    const match = String(label || '').match(/^(\d+)\s*-\s*(\d+)$/);
    if (!match) return null;
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    return { start, end };
  }

  function splitAnswerList(value) {
    const raw = String(value || '').trim();
    if (!raw) return [];
    const normalized = raw.replace(/\s+\band\b\s+/gi, ', ');
    let parts = normalized.split(/\s*[,;/]\s*/).map(item => item.trim()).filter(Boolean);
    if (parts.length === 1 && /^[A-Z](?:\s+[A-Z])+$/.test(parts[0])) {
      parts = parts[0].split(/\s+/).filter(Boolean);
    }
    return parts;
  }

  function getAnswerForQuestionKey(key) {
    if (answers[key]) return String(answers[key] || '').trim();
    const range = findAnswerRangeForKey(key);
    return range ? String(answers[range] || '').trim() : '';
  }

  function findAnswerRangeForKey(key) {
    const keyNumber = Number(key);
    if (!Number.isFinite(keyNumber)) return '';
    return Object.keys(answers).find(label => {
      const match = String(label).match(/^(\d+)\s*-\s*(\d+)$/);
      if (!match) return false;
      const start = Number(match[1]);
      const end = Number(match[2]);
      return keyNumber >= start && keyNumber <= end;
    }) || '';
  }

  function normalizeComparableAnswer(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.,;:!?]+$/g, '');
  }

  function getAcceptedAnswerVariants(correctValue) {
    const raw = String(correctValue || '').trim();
    if (!raw) return [''];

    const variants = new Set([raw]);
    if (/\([^)]*\)/.test(raw)) {
      const parts = raw.split(/(\([^)]*\))/g).filter(part => part !== '');
      let combinations = [''];
      for (const part of parts) {
        const optional = part.match(/^\(([^)]*)\)$/);
        if (optional) {
          combinations = [
            ...combinations,
            ...combinations.map(value => `${value} ${optional[1]}`)
          ];
        } else {
          combinations = combinations.map(value => `${value} ${part}`);
        }
      }
      combinations.forEach(value => variants.add(value.replace(/\s+/g, ' ').trim()));
    }

    return [...variants].filter(Boolean);
  }

  function setGapCorrectAnswerHover(input, correctVal) {
    if (!correctVal) {
      input.removeAttribute('data-correct-answer');
      input.removeAttribute('title');
      input.removeAttribute('aria-description');
      input.onmouseenter = null;
      input.onmousemove = null;
      input.onmouseleave = null;
      return;
    }

    const displayAnswer = resolveGapCorrectAnswer(input, correctVal);
    input.setAttribute('data-correct-answer', displayAnswer);
    input.removeAttribute('title');
    input.setAttribute('aria-description', `Correct: ${displayAnswer}`);
    input.onmouseenter = showGapAnswerTooltip;
    input.onmousemove = moveGapAnswerTooltip;
    input.onmouseleave = hideGapAnswerTooltip;
  }

  function resolveGapCorrectAnswer(input, correctVal) {
    if (input.classList.contains('summary-choice-blank')) {
      const groupKey = input.getAttribute('data-summary-group');
      const letter = String(correctVal || '').trim().toUpperCase().match(/^[A-Z]/)?.[0] || '';
      const pill = document.querySelector(`.summary-option-pill[data-summary-group="${groupKey}"][data-letter="${letter}"]`);
      const optionText = normalizeWordBankOption(pill?.getAttribute('data-option-text') || '');
      if (optionText) return optionText;
    }
    return normalizeWordBankOption(correctVal);
  }

  function showGapAnswerTooltip(event) {
    const answer = event.currentTarget.getAttribute('data-correct-answer');
    if (!answer) return;
    const tooltip = getGapAnswerTooltip();
    tooltip.textContent = `Correct: ${answer}`;
    tooltip.style.display = 'block';
    moveGapAnswerTooltip(event);
  }

  function moveGapAnswerTooltip(event) {
    const tooltip = document.getElementById('gap-answer-tooltip');
    if (!tooltip || tooltip.style.display === 'none') return;
    tooltip.style.left = `${event.clientX + 12}px`;
    tooltip.style.top = `${event.clientY + 14}px`;
  }

  function hideGapAnswerTooltip() {
    const tooltip = document.getElementById('gap-answer-tooltip');
    if (tooltip) tooltip.style.display = 'none';
  }

  function getGapAnswerTooltip() {
    let tooltip = document.getElementById('gap-answer-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'gap-answer-tooltip';
      tooltip.className = 'gap-answer-tooltip';
      document.body.appendChild(tooltip);
    }
    return tooltip;
  }

  function showAnswerKeyModal() {
    if (!testData.answerKey || Object.keys(testData.answerKey).length === 0) return;
    lockAnswers();
    window.IELTSApp?.stopSessionIntegrity?.();

    const contentEl = document.getElementById('answer-key-content');
    let html = '<table style="width:100%; border-collapse: collapse; font-size:0.9rem;">';
    html += '<thead><tr style="border-bottom:2.5px solid var(--border); text-align:left;"><th style="padding:8px 12px;">Q#</th><th style="padding:8px 12px;">Correct Answer</th></tr></thead><tbody>';

    for (const { key, correct } of getAnswerKeyEntries()) {
      html += `<tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:8px 12px; font-weight:700; color:var(--accent);">${key}</td><td style="padding:8px 12px; font-weight:600;">${esc(correct)}</td></tr>`;
    }

    html += '</tbody></table>';
    contentEl.innerHTML = html;

    document.getElementById('answer-modal').style.display = 'flex';
    pauseTimer();
  }

  return {
    render,
    goToPart,
    dragHeading,
    dragMatchingEnding,
    dragSummaryOption,
    allowDrop,
    dragLeave,
    dropHeading,
    dropMatchingEnding,
    dropSummaryOption,
    clearSlot,
    clearMatchingEnding,
    scrollToQuestion,
    checkAnswers,
    getScoreSnapshot,
    showAnswerKeyModal,
    highlightSelection,
    addNoteToSelection,
    showNote,
    updateNote,
    deleteNote,
    clearAnnotations,
    navigatePrev,
    navigateNext,
    lockAnswers,
    stopTimer,
    pauseTimer,
    resumeTimer
  };
})();

function navigatePrev() {
  Renderer.navigatePrev();
}

function navigateNext() {
  Renderer.navigateNext();
}

// Close Answer Modal
function closeAnswerModal(e) {
  if (!e || e.target === e.currentTarget) {
    document.getElementById('answer-modal').style.display = 'none';
  }
}
