// ── IELTS Listening Creator — State & Constants ──

const LISTENING_LIMITS = {
  maxParts: 4,
  minParts: 1,
  maxQuestionsPerPart: 10,
  maxQuestions: 40,
  maxOptions: 9,
};

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
  multiple_choice:   'Multiple Choice',
  form_completion:   'Form Completion',
  note_completion:   'Note Completion',
  table_completion:  'Table Completion',
  flowchart_completion: 'Flowchart Completion',
  summary_completion: 'Summary Completion',
  sentence_completion: 'Sentence Completion',
  short_answer:      'Short Answer',
  matching:          'Matching',
  map_labelling:     'Map / Plan Labelling',
  diagram_completion: 'Diagram Labelling',
};

const LISTENING_TYPE_ICONS = {
  multiple_choice:      '<circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>',
  form_completion:      '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10"/><path d="M7 12h6"/><path d="M7 16h8"/>',
  note_completion:      '<path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"/><polygon points="18 2 22 6 12 16 8 16 8 12 18 2"/>',
  table_completion:     '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="9" x2="9" y2="21"/>',
  flowchart_completion: '<circle cx="12" cy="5" r="3"/><circle cx="6" cy="19" r="3"/><circle cx="18" cy="19" r="3"/><line x1="10.5" y1="7.5" x2="7.5" y2="16.5"/><line x1="13.5" y1="7.5" x2="16.5" y2="16.5"/>',
  summary_completion:   '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  sentence_completion:  '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h10"/>',
  short_answer:         '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  matching:             '<path d="M5 9l4 3-4 3"/><path d="M12 6h7"/><path d="M12 12h7"/><path d="M12 18h7"/>',
  map_labelling:        '<circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 13 8 13s8-7.75 8-13a8 8 0 0 0-8-8z"/>',
  diagram_completion:   '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
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
  matching:             'Match each item with the correct option.\nWrite the correct letter in boxes on your answer sheet.',
  map_labelling:        'Label the map below.\nChoose the correct letter from the box and write it next to questions on your answer sheet.',
  diagram_completion:   'Label the diagram below.\nWrite ONE WORD AND/OR A NUMBER for each answer.',
};

// ── Creator State ──
let listeningCreatorState = null;
let listeningCreatorPartIndex = 0;
let listeningCreatorDirty = false;
let listeningCreatorShowTypePicker = false;
let listeningCreatorMCQPickerOpen = false;

function getListeningCreatorPart() {
  return listeningCreatorState?.parts?.[listeningCreatorPartIndex] || null;
}

function listeningGetNextQuestionNumber(part) {
  const used = new Set(
    (part.questionGroups || []).flatMap(g => listeningGetGroupNumbers(g))
  );
  for (let n = 1; n <= LISTENING_LIMITS.maxQuestions; n++) {
    if (!used.has(n)) return n;
  }
  return null;
}

function listeningGetGroupNumbers(group) {
  return listeningParseRange(group.questionRange)?.numbers || [];
}

function listeningParseRange(label) {
  const s = String(label || '').trim();
  const rangeMatch = s.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    if (end >= start) {
      const numbers = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      return { label: s, numbers };
    }
  }
  const singleMatch = s.match(/^(\d+)$/);
  if (singleMatch) {
    const n = Number(singleMatch[1]);
    return { label: s, numbers: [n] };
  }
  return null;
}

function listeningCountPartQuestions(part) {
  return (part.questionGroups || []).reduce((sum, g) => sum + listeningGetGroupNumbers(g).length, 0);
}

function listeningCombineRanges(groups) {
  const nums = (groups || []).flatMap(g => listeningGetGroupNumbers(g)).sort((a, b) => a - b);
  if (!nums.length) return '';
  return nums.length === 1 ? String(nums[0]) : `${nums[0]}-${nums[nums.length - 1]}`;
}

function listeningNotify(type, msg) {
  // Reuse the existing notify() from ielts/app.js if available, else console
  if (typeof notify === 'function') { notify(type, msg); return; }
  console[type === 'error' ? 'error' : 'log']('[Listening]', msg);
}

function escAttrL(s) { return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escHtmlL(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
