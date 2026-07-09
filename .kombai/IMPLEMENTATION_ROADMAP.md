# IELTS Creator Interface - Implementation Roadmap

**Status:** Partially Complete  
**Last Updated:** Session 2  
**Commit:** f56b95c (3-button menu + matching info warning)

---

## ✅ COMPLETED

### 1. Main Menu - 3 Big Buttons
- **Files:** `ielts/index.html` (lines 112-154)
- **Status:** DONE - All 3 buttons functional
- Buttons:
  - "Create Practice Passage Manually" → `openReadingCreator()`
  - "Test Demo Passage" → `handleDemo()`
  - "Create With Legacy AI Parser" → `handleParse()`
- **CSS:** `styles.css` lines 2321-2385 (`.btn-action-large`, responsive design)

### 2. Matching Information Warning
- **File:** `renderer.js` lines 963-996
- **Status:** DONE - Displays "You may use any letter more than once" when letter used multiple times in test

---

## ⏳ IN PROGRESS / TODO

### 3. Section Toggle Locking (CRITICAL)
**Location:** `ielts/app.js`

**Function 1: creatorToggleSectionsMode()** (around line 942)
```javascript
// NEED: Add check to prevent toggle OFF if Matching Heading or Matching Information exists
if (creatorShowSections && hasMatchingQuestions) {
  notify('warning', 'Section Toggle cannot be turned off while...');
  return; // prevent toggle
}
```

**Function 2: creatorCreateSet()** (around line 2149)  
```javascript
// NEED: Add check to prevent creating Matching types without Section Toggle ON
if ((type === 'heading_match' || type === 'matching_information') && !creatorShowSections) {
  notify('error', 'Section Toggle must be enabled...');
  return;
}
```

---

### 4. Summary Completion Answer Inputs
**Location:** `ielts/app.js` renderCreatorWYSIWYGPreview() for `summary_completion` (around line 1457)

**Need:** After summary text editor, add answer key section:
```javascript
// Show input fields for Q1, Q2, Q3... based on question range
const range = parseCreatorRange(group.questionRange);
if (range && range.numbers.length > 0) {
  range.numbers.forEach(num => {
    // Input for answer to question num
  });
}
```

---

### 5. Short Answer Questions Overhaul
**Location:** `ielts/app.js` renderCreatorWYSIWYGPreview() for `short_answer` (lines 2248-2314)

**Issues:**
- Answer key section rendered inside forEach loop (duplicated N times)
- Should only appear once at bottom

**Fix:** Move answer key section outside the forEach loop, render once

---

### 6. Flowchart Completion Fix
**Location:** `ielts/app.js` renderCreatorFlowchartBuilder() (lines 1191-1222)

**Issues:**
- Two answer key blocks rendered (lines 1191-1203 correct, lines 1206-1220 duplicate)

**Fix:** Remove the duplicate answer key section (lines 1206-1220)

---

### 7. Note Completion + Summary Merge
**Locations:**
- Summary: `ielts/app.js` renderCreatorWYSIWYGPreview() line ~1457
- Note: `ielts/app.js` renderCreatorWYSIWYGPreview() line ~1718
- Flowchart: `ielts/app.js` renderCreatorFlowchartBuilder() line ~1123

**Need:**
- Merge note_completion interface into summary_completion
- Allow bullet points AND regular text
- Support gaps in both

---

### 8. Diagram Completion Simplification
**Location:** `ielts/app.js` renderCreatorWYSIWYGPreview() for `diagram_completion` (lines 2013-2024)

**Need:**
- Remove complex label editor
- Add simple "Number of gaps:" input
- Show Q1, Q2, Q3... inputs for manual answers
- Keep diagram upload

---

### 9. Answer Validation with Parentheses/Slash Logic
**Location:** `ielts/renderer.js` function `isAnswerCorrect()` (lines 1795-1802)

**Logic needed:**
```javascript
// (text) = optional - either with or without "text" is correct
// (opt1/opt2) = either option1 OR option2 is correct
// No parentheses = must match exactly

Examples:
- Input: "(Claude)/GG" → User can answer "Claude", "GG", or "Claude/GG" → PASS
- Input: "(Claude/GG)" → User can answer "Claude", "GG", or "Claude/GG" → PASS
- Input: "Claude (Haiku)" → User can answer "Claude" or "Claude Haiku" → PASS
- Input: "Claude" → Must be exactly "Claude" → PASS only if exact match
```

---

## Reference Docs

### Key Functions
- `creatorToggleSectionsMode()` - Toggle sections on/off
- `creatorCreateSet(type, mcqMode)` - Create question set
- `renderCreatorWYSIWYGPreview(group, index)` - Main WYSIWYG editor
- `isAnswerCorrect(userValue, correctValue)` - Answer validation

### Question Types
- `heading_match` - Requires sections
- `matching_information` - Requires sections  
- `matching_endings` - Sentence with ending selection
- `matching_features` - Feature matching grid
- `summary_completion` - Fill in summary text
- `note_completion` - Fill in note points
- `flowchart_completion` - Fill in flowchart steps
- `diagram_completion` - Label diagram parts
- `short_answer` - Type answer
- etc.

---

## Testing Checklist

- [ ] 3 buttons load correct interfaces
- [ ] Section toggle blocks when Matching types exist
- [ ] Can't create Matching types without toggle
- [ ] Summary completion shows answer inputs
- [ ] Short answer answer key displays once
- [ ] Flowchart answer key displays once
- [ ] Answer validation handles parentheses correctly
- [ ] Answer validation handles slashes correctly
- [ ] Diagram completion simplification works
