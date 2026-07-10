// ── IELTS Listening Validator ──
// Validates the listening test data schema before launching the test or sharing.

const ListeningValidator = (() => {

  const VALID_TYPES = [
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
    'diagram_completion'
  ];

  function parseRange(range) {
    const s = String(range || '');
    const rangeMatch = s.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (end >= start) return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
    const single = s.match(/^(\d+)$/);
    if (single) return [Number(single[1])];
    return [];
  }

  function validateSchema(data) {
    const errors = [];
    const warnings = [];

    if (!data || data.type !== 'listening') {
      errors.push('Invalid test data: missing or incorrect type field.');
      return { valid: false, errors, warnings };
    }

    if (!Array.isArray(data.parts) || data.parts.length === 0) {
      errors.push('Listening test must have at least 1 part.');
      return { valid: false, errors, warnings };
    }

    if (data.parts.length > 4) {
      errors.push('Listening test cannot exceed 4 parts.');
    }

    let totalQuestions = 0;

    for (const part of data.parts) {
      const pn = part.partNumber || '?';

      if (!Array.isArray(part.questionGroups) || part.questionGroups.length === 0) {
        errors.push(`Part ${pn}: No question groups defined.`);
        continue;
      }

      for (const group of part.questionGroups) {
        if (!VALID_TYPES.includes(group.type)) {
          errors.push(`Part ${pn}: Unknown question type "${group.type}".`);
        }

        const rangeNums = parseRange(group.questionRange);

        // Groups with questions array
        if (!['form_completion', 'map_labelling', 'matching'].includes(group.type) || group.questions) {
          if (!Array.isArray(group.questions) || group.questions.length === 0) {
            errors.push(`Part ${pn}, group "${group.questionRange}": No questions defined.`);
          }
        }

        // form_completion specific: questions must exist
        if (group.type === 'form_completion') {
          if (!Array.isArray(group.questions) || group.questions.length === 0) {
            errors.push(`Part ${pn}: form_completion group "${group.questionRange}" has no question fields.`);
          }
        }

        // map_labelling specific: must have mapImageUrl or we just warn
        if (group.type === 'map_labelling') {
          if (!group.mapImageUrl && !group.mapImageData) {
            warnings.push(`Part ${pn}: map_labelling group "${group.questionRange}" has no image uploaded.`);
          }
          if (!Array.isArray(group.options) || group.options.length === 0) {
            errors.push(`Part ${pn}: map_labelling group "${group.questionRange}" must have a list of answer options.`);
          }
        }

        totalQuestions += rangeNums.length;
      }

      // Check answer key coverage
      const partRange = parseRange(part.questionRange);
      if (data.answerKey) {
        partRange.forEach(n => {
          const key = String(n);
          if (!data.answerKey[key] || data.answerKey[key] === '[Answer]') {
            warnings.push(`Part ${pn}: Question ${n} has no answer in the answer key.`);
          }
        });
      }
    }

    if (totalQuestions === 0) {
      errors.push('The test has no questions.');
    } else if (totalQuestions > 40) {
      errors.push(`Total question count (${totalQuestions}) exceeds the 40-question maximum.`);
    } else if (totalQuestions < 4) {
      warnings.push(`Only ${totalQuestions} question(s) defined. A standard IELTS Listening test has 40.`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  return { validateSchema };
})();
