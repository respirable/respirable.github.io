

const Validator = (() => {

  // Common English words for language detection
  const COMMON_WORDS = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with',
    'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'her', 'she', 'or',
    'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about',
    'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
    'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than',
    'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two',
    'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give',
    'day', 'most', 'us', 'is', 'was', 'are', 'were', 'been', 'has', 'had', 'did', 'been', 'said', 'each',
    'more', 'very', 'many', 'much', 'should', 'may', 'such', 'still', 'between', 'own', 'under', 'never',
    'same', 'another', 'while', 'last', 'might', 'great', 'old', 'must', 'before', 'through', 'where'
  ]);

  const CODE_PATTERNS = /(<\w+[\s>]|<\/\w+>|\{[\s\S]*\}|function\s*\(|import\s+|const\s+|let\s+|var\s+|=>|console\.\w+|document\.\w+)/g;

  /**
   * Layer 1: Pre-AI structural validation
   * Returns { valid: boolean, errors: string[], warnings: string[] }
   */
  function validatePreAI(rawText) {
    const errors = [];
    const warnings = [];
    const text = (rawText || '').trim();

    // 1. Minimum length
    if (text.length < 200) {
      errors.push('Input is too short to be a valid IELTS reading passage. Please include the full passage and questions.');
    }

    // 2. Maximum length
    if (text.length > 30000) {
      errors.push('Input is too long (over 30,000 characters). Please paste one test part at a time.');
    }

    // 3. Contains question indicators
    const questionPattern = /(?:question|q)\s*\d+|^\s*\d{1,2}(?:[\.)]\s*|\s*$)/im;
    const questionRangePattern = /(?:questions?|boxes?)\s+\d+\s*[-\u2013]\s*\d+/i;
    if (!questionPattern.test(text) && !questionRangePattern.test(text)) {
      errors.push('No question numbers detected. Please include the questions along with the passage text.');
    }

    // 4. Contains passage text (at least 3 paragraphs of substantial length)
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 50);
    if (paragraphs.length < 2) {
      errors.push('Not enough passage text detected. An IELTS reading passage should have multiple paragraphs.');
    }

    // 5. Language check — at least 40% of words should be common English
    const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    if (words.length > 20) {
      const englishCount = words.filter(w => COMMON_WORDS.has(w)).length;
      const ratio = englishCount / words.length;
      if (ratio < 0.15) {
        errors.push("The input doesn't appear to be in English. IELTS Reading passages should be in English.");
      }
    }

    // 6. Not code/markup
    const codeMatches = (text.match(CODE_PATTERNS) || []).length;
    if (codeMatches > 5) {
      errors.push('This input looks like code or markup, not an IELTS reading passage.');
    }

    // Warnings
    if (text.length > 0 && text.length < 500 && errors.length === 0) {
      warnings.push('The input seems short for a full IELTS passage. Make sure you included the complete text.');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Layer 2: Post-AI schema validation
   * Validates the parsed JSON structure
   */
  function validateSchema(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      errors.push('AI returned invalid data. Please try again.');
      return { valid: false, errors, warnings: [] };
    }

    if (!Array.isArray(data.parts) || data.parts.length === 0) {
      errors.push('AI response is missing the required "parts" structure.');
      return { valid: false, errors, warnings: [] };
    }

    for (const part of data.parts) {
      if (!part.passage || !part.passage.title) {
        errors.push(`Part ${part.partNumber || '?'}: Missing passage title.`);
      }
      if (!part.passage || !Array.isArray(part.passage.sections) || part.passage.sections.length === 0) {
        errors.push(`Part ${part.partNumber || '?'}: Missing passage content.`);
      }
      if (!Array.isArray(part.questionGroups) || part.questionGroups.length === 0) {
        errors.push(`Part ${part.partNumber || '?'}: No questions were parsed.`);
      }

      // Validate question groups
      if (part.questionGroups) {
        const validTypes = ['heading_match', 'multiple_choice', 'true_false_notgiven', 'yes_no_notgiven', 'summary_completion', 'matching_features', 'matching_endings', 'diagram_completion', 'short_answer', 'matching', 'matching_information', 'sentence_completion', 'note_completion', 'table_completion', 'flowchart_completion'];
        const hasHeadingMatch = part.questionGroups.some(group => group.type === 'heading_match');
        const markers = (part.passage?.sections || [])
          .map(s => s.questionMarker)
          .filter(marker => marker !== null && marker !== undefined);
        if (!hasHeadingMatch && markers.length > 0) {
          errors.push(`Part ${part.partNumber || '?'}: Passage question markers are only valid for matching headings.`);
        }
        for (const group of part.questionGroups) {
          if (!validTypes.includes(group.type)) {
            errors.push(`Unknown question type: "${group.type}". Expected one of: ${validTypes.join(', ')}`);
          }
          if (!Array.isArray(group.questions) || group.questions.length === 0) {
            errors.push(`Question group "${group.questionRange}": No questions found.`);
          } else {
            const expectedCount = countRangeSlots(group.questionRange);
            const actualCount = countQuestionSlots(group.questions);
            if (expectedCount !== null && actualCount < expectedCount) {
              errors.push(`Question group "${group.questionRange}": Parsed ${actualCount} answer slot(s), but the range requires ${expectedCount}.`);
            }
          }
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings: [] };
  }

  function countRangeSlots(range) {
    const match = String(range || '').match(/(\d+)\s*[-–]\s*(\d+)/);
    if (!match) return null;
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    return end - start + 1;
  }

  function countQuestionSlots(questions) {
    return questions.reduce((total, q) => {
      const label = q.numbers || q.number;
      const rangeCount = countRangeSlots(label);
      return total + (rangeCount || 1);
    }, 0);
  }

  /**
   * Layer 3: Content heuristic validation
   */
  function validateContent(data) {
    const warnings = [];
    const errors = [];

    for (const part of data.parts) {
      // Check passage has actual content
      const passageText = (part.passage?.sections || [])
        .flatMap(s => s.paragraphs || [])
        .join(' ');

      const passageWords = passageText.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 2);
      if (passageWords.length > 20) {
        const englishCount = passageWords.filter(w => COMMON_WORDS.has(w)).length;
        if (englishCount / passageWords.length < 0.15) {
          errors.push(`Part ${part.partNumber}: The passage text appears to contain nonsensical content.`);
        }
      }

      // Check total question count
      let totalQ = 0;
      for (const group of (part.questionGroups || [])) {
        totalQ += (group.questions || []).length;
      }
      if (totalQ < 5 || totalQ > 20) {
        warnings.push(`Part ${part.partNumber}: Unusual number of questions (${totalQ}). Standard IELTS has 10-15 per part.`);
      }

      // Heading match: more options than questions
      for (const group of (part.questionGroups || [])) {
        if (group.type === 'heading_match') {
          const optionCount = (group.headingOptions || []).length;
          const qCount = (group.questions || []).length;
          if (optionCount <= qCount) {
            warnings.push(`Heading match questions should have more heading options (${optionCount}) than blanks (${qCount}).`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  return { validatePreAI, validateSchema, validateContent };
})();

