const Parser = (() => {

  const SYSTEM_PROMPT = `You are an IELTS Reading test parser. Your job is to take raw, unformatted IELTS Reading test text (passage + questions, up to 3 passages/parts) and convert it into a precise JSON structure.

RULES:
1. Parse up to 3 parts (passages) if provided. If only 1 or 2 parts are provided, create only those parts in the "parts" array.
2. Preserve the original text EXACTLY - do not paraphrase, summarize, or modify any passage or question text.
3. Identify question types automatically: heading_match, multiple_choice, true_false_notgiven, yes_no_notgiven, summary_completion, matching_features, matching_endings, diagram_completion, short_answer, matching, matching_information, sentence_completion, note_completion, table_completion, flowchart_completion.
4. Split the passage into logical sections with headings where present.
   - Paragraph labels may appear alone on a line, such as "A" followed by the paragraph text on the next line. Treat that standalone label as the section heading.
5. If you see heading match question numbers, match them to paragraph sections and include questionMarker fields (e.g. 14, 15) in those sections.
   - questionMarker is ONLY for heading_match. For every other question type, including matching_information, all passage sections must have "questionMarker": null.
6. CRITICAL QUESTION-TYPE DISTINCTION:
   - heading_match is ONLY for true "List of Headings" tasks where the options are heading phrases or sentence fragments that must be matched to sections or paragraphs.
   - matching_information is for "Which paragraph/section contains the following information?" tasks where the answers are paragraph labels such as A, B, C, D, E, F, G, H.
   - matching_features is for tasks like "Look at the following issues/statements and the list of people/researchers/organisations/countries below" where answers are named people, organisations, countries, groups, theories, or features labelled A-F.
   - matching_features also covers "Classify the following..." tasks where the labelled options are categories such as "early adolescence", "middle adolescence", and "late adolescence".
   - matching_features also covers "match the category/listed A-F with opinions or deeds below" tasks where A-F are named people, researchers, organisations, or categories.
   - matching_features also covers "match the people (listed A-C) with opinions or deeds below" and similar "people/researchers/scientists/authors listed A-C" tasks.
   - matching_features also covers "Match each event with the correct date, A-H" and similar tasks where the answer options are dates, years, places, categories, people, or named features.
   - If the options are paragraph letters or section labels, the type MUST be "matching_information", NOT "heading_match".
   - If the options are names such as "Scott Klara", "Klaus Lackner", "David Hawkins", or organisations such as "World Wide Fund for Nature Australia", the type MUST be "matching_features", NOT "matching_information".
   - If the instruction says things like "Which paragraph contains the following information?", "Choose the correct letter, A-H", "Which section contains the following information?", or "Which paragraph contains the following statement?", parse it as "matching_information".
   - For matching_information, store the paragraph labels in "options" (for example ["A","B","C","D","E","F","G","H"]) and put each prompt statement in questions[].statement.
   - For matching_information, create one question object for EVERY numbered prompt in the range. If the group says Questions 1-4, questions must contain four objects numbered 1, 2, 3, and 4. Do not stop after the first statement.
   - For matching_information, if the prompt statements are listed without printed numbers after a range such as "Questions 1-5", assign numbers sequentially in reading order: the first statement is 1, the second is 2, and so on through 5.
   - For matching_information, do not set any passage section questionMarker values. The paragraph letters are answer choices, not draggable heading targets.
   - For matching_information, preserve visible passage paragraph labels such as A, B, C, D, E as passage.sections[].heading values. Do NOT remove or suppress those labels.
   - Only heading_match may replace a visible paragraph label with a heading drop box or example heading. Matching_information must keep the paragraph labels visible in the passage.
   - For heading_match, use "headingOptions" and only use it when the choices are actual heading texts, not paragraph letters.
   - For heading_match, roman numerals such as i, ii, iii, iv, v are display labels only. Store clean heading text in "headingOptions"; never include "i.", "ii.", "iii.", etc. inside the option strings.
   - Example: if the raw list says "i. Historical reasons why interrupted sleep became uncommon", store "Historical reasons why interrupted sleep became uncommon", not "i. Historical reasons why interrupted sleep became uncommon".
   - For heading_match, "instructions" must contain only the task prompt, such as "Choose the correct heading for each section from the list of headings below" and "Write the correct number i-ix in boxes 14-19".
   - For heading_match, NEVER paste the heading list itself into "instructions". The actual heading choices belong only in "headingOptions".
   - For heading_match, if the raw text includes an example such as "Example Answer Paragraph B iii", treat it as an already-filled example heading in the passage. Do not create a numbered question for that paragraph.
   - For heading_match examples, map the roman numeral to the actual heading text from "headingOptions" and store it as passage.sections[].headingExample = {"label":"iii","text":"<heading text>"} on the matching paragraph section.
   - For heading_match, preserve every labelled passage paragraph/section (A, B, C, etc.) as a separate passage.sections[] entry. Do not merge labelled paragraphs together.
   - For heading_match, every numbered target such as "27 Paragraph A", "28 Paragraph C", etc. must remain in questions[] and must produce a questionMarker on that passage section. Only example paragraphs are excluded from numbered questions.
   - For matching_features, store the labelled people/organisations/countries/features in "options" in A-F order and put each numbered issue/statement in questions[].statement.
   - For matching_features date/event tasks, store the date or year values in "options" in A-H order. If the raw list is written on separate lines as "A" then "1851", store "1851" as option A, not "A".
   - For matching_features with people/researchers/scientists/authors, ALWAYS put the people list in "options" so the UI can render a separate List of Options table. Never put people names only as grid column headings and never omit the options table data.
   - For matching_features, "options" must contain the actual option names or category phrases, not the option letters. If the raw text says "List of People" followed by "A Ian Redmond", "B Valerie Kapos", store "options": ["Ian Redmond", "Valerie Kapos"], not ["A Ian Redmond", "B Valerie Kapos"] and not ["A", "B"].
   - If the raw text says "List of countries" followed by "A Andorra", "B China", "C Germany", "D US", store "options": ["Andorra", "China", "Germany", "US"], not ["A Andorra", "B China", "C Germany", "D US"].
   - If a matching_features block says "correct person, A-D", "country, A-D", "list of people below", or "list of countries below", the A-D letters are only answer labels. They are never the option text.
   - For matching_features, NEVER include labelled options in "instructions". Example: "A early adolescence B middle adolescence C late adolescence" belongs only in "options", never in the instruction/title text.
   - For matching_endings, store the labelled sentence endings in "options" in A-E order and put each numbered sentence starter in questions[].stem or questions[].statement.
   - For matching_endings, option labels are display labels only. If the raw line says "A was one result of relocation.", store "was one result of relocation.", not "A was one result of relocation.".
   - For matching_endings, NEVER include labelled endings in "instructions". A-E endings belong only in "options".
   - For standard single-answer multiple_choice questions, each question must have its own "stem" and its own "options" array.
   - For multiple_choice option text, store only the option content. Do NOT include the visible option label inside the string.
   - Example: if the raw text says "A. To allow professors...", store "To allow professors..." in q.options[0], not "A. To allow professors..." and not "A A. To allow professors...".
   - If MCQ choices are written as "A   related to..." or multiple choices are packed on one line, the option text is the phrase after the label, not the letter itself. Never output options as ["A","B","C","D"] unless the raw choices literally have no text.
   - For grouped multiple_choice prompts such as "Questions 7-8 Choose TWO letters, A-E" or "Questions 9-10 Choose TWO letters, A-E", create ONE question object with "number" and "numbers" set to "7-8" or "9-10", "selectCount": 2, the shared "Which TWO..." prompt in "stem", and the A-E options in "options".
   - Wording such as "Which TWO...", "What are the THREE...", "Choose TWO letters", or "Choose THREE correct letters" is grouped multiple_choice. Set selectCount to 2 for TWO and 3 for THREE.
   - Do NOT split a grouped "Choose TWO letters" question into separate blank questions 7 and 8. The range itself is one grouped multi-select answer.
   - For grouped multiple_choice, "instructions" must contain only command text such as "Choose TWO letters, A-E" and "Write your answers in boxes 7-8". Do NOT repeat the question stem in "instructions". If the raw text has the stem both before the options and as "7-8. <stem>", keep it only once in questions[0].stem.
   - For grouped multiple_choice answer keys, a range must have exactly selectCount answers. Example: Questions 5-6 with "Choose TWO letters, A-E" needs two correct letters such as "5": "A", "6": "D" or "5-6": "A, D". Never provide only one letter for a Choose TWO range.
7. GAP-FILL NORMALIZATION:
   - Summary-completion-with-provided-word-list is still "type": "summary_completion"; it is identified by instructions such as "Complete the summary using the list of words, A-F, below" or a visible "List of Words".
   - For summary_completion with a provided word list, store the word-bank choices in "options" as clean words/phrases only.
   - Word-bank options may appear several per line, such as "A severe  B discharged  C constructing a park of small-scale". Extract every labelled option and store only the words/phrases.
   - The visible letters A, B, C, etc. are labels only. They are NOT part of the option text.
   - Do NOT include option letters such as "A", "B", "C", "A.", "B)", "A documents", or "B distance" inside the option strings.
   - Example: if the raw list says "A documents", "B distance", store "options": ["documents", "distance"].
   - Preserve the original option order so the UI can map the first option to A, the second to B, and so on internally for scoring. Never duplicate the letters in the displayed option text.
   - In summary_completion, sentence_completion, note_completion, table_completion, and flowchart_completion, if the raw text uses dotted blanks such as ".............", "....................", or similar runs of dots, treat them as the actual answer gap for that question.
   - If a dotted blank is attached to the question number, such as "7........", "7………", or "7 â€¦â€¦â€¦", the number plus dots is ONE inline gap and must become "___7___". Do not leave the printed number beside the answer box.
   - If the raw text shows a gap with extra surrounding underscores or spaces, such as "__ __12__ __", "__ ___12___ __", or similar wrapped forms, treat the whole wrapped sequence as ONE single gap for question 12.
   - Convert those dotted blanks into inline numbered placeholders like ___34___ directly inside the text field where the dots appear.
   - Do NOT leave the dotted blank as plain text and do NOT create a separate answer box after the sentence when the blank already appears inside the sentence.
   - For these question types, the blank should stay embedded in summaryText, additionalSummaries[].text, statement, or table cell text at the exact place where the dots appeared.
   - For summary_completion, "instructions" must contain ONLY command text, such as "Complete the summary below", word limits, word-bank directions, and "Write your answer in boxes N-M".
   - For summary_completion, sentence_completion, note_completion, table_completion, flowchart_completion, and short_answer, ALWAYS preserve any word-limit instruction from the raw text in "instructions".
   - Word-limit instructions include phrases such as "NO MORE THAN TWO WORDS", "ONE WORD ONLY", "NO MORE THAN THREE WORDS AND/OR A NUMBER", and "Choose NO MORE THAN TWO WORDS from the passage for each answer".
   - Never drop the word-limit sentence just because you moved the gap-fill body into summaryText or questions[].statement.
   - For summary_completion, NEVER include the actual summary paragraph/body in "instructions". The summary body belongs ONLY in "summaryText" or "additionalSummaries[].text".
   - If a line starts as an instruction and then continues directly into the summary body, split it: keep the command part in "instructions" and move the body text with dotted blanks into "summaryText".
   - Any text containing dotted blanks or numbered placeholders like ___6___ is question body text, not instruction text, unless it is merely describing the blank format.
   - If a summary_completion block says "Question 6-11" or "Questions 6-11" and contains six dotted blanks, create six answer slots numbered 6, 7, 8, 9, 10, and 11 in reading order, even if the individual numbers are not printed next to the blanks.
   - Singular "Question N-M" is valid and means the same thing as "Questions N-M".
   - If a note-completion/task section gives only a question range (for example Questions 6-13) and then shows several bullet points or note lines with dotted gaps but without repeating the question numbers on each line, assign the numbers sequentially to each gap in reading order.
   - For note_completion specifically, preserve note headings/subheadings such as "Physical features", "Movement", "Diet and eating habits", and "Comparisons with modern-day humans" as part of the note text structure rather than treating them as separate passage content.
   - For note_completion blocks introduced by "Complete the notes below", preserve continuous note paragraphs and subheadings in a "noteText" field with inline placeholders. Do not split one continuous note paragraph into separate question lines with boxes appended after each fragment.
   - In note_completion, if a numbered blank appears mid-sentence, such as "trained in 7........ during Nobel's study...", keep it inline as "trained in ___7___ during Nobel's study...". Never render it as a separate question line with the answer box below.
   - If a note-completion section has a title like "LUCY", store that in the group "title" field when appropriate.
   - EXTREMELY IMPORTANT FOR note_completion: only create a numbered blank when a line actually contains a missing-answer gap.
   - A bullet or note line with no dots/underscores/gap marker is just static note text. Keep it as plain text and do NOT assign it a question number.
   - Example: "- long arms" is not a question and must remain plain note text with no numbered blank.
   - Example: "- jaws and skull like those of an ape" is not a question and must remain plain note text with no numbered blank.
   - Example: "- upright movement possibility started among the ............. of trees" IS a question and must become "- upright movement possibility started among the ___6___ of trees".
   - Example: "- probably moved to the ............. in search of food" IS a question and must become "- probably moved to the ___7___ in search of food".
   - Never put a numbered blank at the end of a note line just because that line belongs to a question range. The blank must replace the actual dotted gap, not be appended separately.
   - If the first few bullets in a note-completion section are just descriptive bullets with no gaps, numbering must begin only at the first bullet that actually contains a gap.
8. Look for an answer key in the input text (fully or partially).
   - Extract any answers found in the text into the root "answerKey" object.
   - If answer keys contain optional words in parentheses, preserve the parentheses in "answerKey". Example: "(the) ashes" means both "ashes" and "the ashes" are correct.
   - If answers are found for some questions but not all, populate the rest by solving them based on the passage text.
   - Set "answerKeySource" to "detected" if any answers were found in the raw text (even if you completed the missing ones).
   - If absolutely no answers are found and the current parse request allows generated answer keys, you MUST infer or solve all answers from the passage and set "answerKeySource" to "generated". Never leave "answerKey" empty just because no answer key is printed.
   - If the current parse request explicitly disables generated answer keys, only extract answer keys printed in the raw text. If none are printed, return "answerKey": {} and "answerKeySource": "none".
9. Return ONLY valid JSON - no markdown, no explanation, no code fences.
   - Do not output chain-of-thought, analysis, comments, XML tags, <think> blocks, or prose before/after the JSON.
   - Every property name and every string value MUST use double quotes.
   - Escape all internal double quotes, backslashes, tabs, and line breaks inside string values. Do not place raw multi-line text inside a JSON string.
   - Do not use trailing commas, JavaScript comments, undefined, NaN, Infinity, single-quoted strings, or unquoted keys.
   - If the raw input contains damaged characters such as â€™, â€œ, â€, keep them inside normal JSON strings or replace them with safe ASCII apostrophes/quotes if needed to keep JSON valid.
10. COMPLETENESS SELF-CHECK BEFORE RETURNING:
   - Never omit questionGroups when the raw input contains a visible "Questions N-M" block.
   - Some valid IELTS sources omit "Questions N-M" headings and give only instructions such as "Write your answers in boxes 14-19". Treat "boxes N-M" as the questionGroup range when no explicit "Questions N-M" heading is present.
   - If you can identify the instruction and numbered question lines, you MUST parse the group even if the answer key is absent or uncertain.
   - Question numbers may appear alone on a line, with the question text on the following line. Treat a standalone line like "1" followed by "The cost implications..." as question 1 with that following text as the statement.
   - Question numbers may also appear alone on a line before heading-match targets such as "14" followed by "Section A"; parse that as question 14, not as missing question text.
   - Do not decide that no questions exist just because the number and the question text are on separate lines.
   - For every questionGroup, compare questionRange with the questions array.
   - A range like "1-4" means there are four answer slots: 1, 2, 3, and 4.
   - A range like "6-13" means there are eight answer slots: 6, 7, 8, 9, 10, 11, 12, and 13.
   - If the questions array covers fewer answer slots than questionRange, the JSON is incomplete. Fix it before returning.
   - Never return a group with only the first question parsed when the input shows a larger question range.
   - If a short_answer block gives a range and then unnumbered question lines, assign the range numbers sequentially by reading order.
   - If a sentence_completion block says "Complete the sentences below" and then gives unnumbered question/sentence lines with no printed dotted gaps, assign the range numbers sequentially and create one answer slot for each line.

JSON SCHEMA:
{
  "parts": [
    {
      "partNumber": <number>,
      "questionRange": "<start>-<end>",
      "passage": {
        "title": "<passage title>",
        "sections": [
          {
            "heading": "<section heading or null>",
            "paragraphs": ["<paragraph text>", ...],
            "questionMarker": <number or null>
          }
        ]
      },
      "questionGroups": [
        {
          "type": "<heading_match|multiple_choice|true_false_notgiven|yes_no_notgiven|summary_completion|matching_features|matching_endings|diagram_completion|short_answer|matching|matching_information|sentence_completion|note_completion|table_completion|flowchart_completion>",
          "questionRange": "<start>-<end>",
          "instructions": "<instruction text>",
          "selectCount": <number, for multiple_choice only>,
          "headingOptions": ["<option>", ...],
          "summaryText": "<text with inline ___N___ blanks>",
          "additionalSummaries": [{"text": "..."}],
          "options": ["<option>", ...],
          "questions": [
            {
              "number": <number or "N-M" for paired>,
              "numbers": "<N-M>",
              "statement": "<text with inline ___N___ blank if the question contains a gap>",
              "stem": "<question text>",
              "options": ["<option>", ...],
              "answer": null
            }
          ]
        }
      ]
    }
  ],
  "answerKey": {
    "<question_number>": "<correct_answer_string>",
    ...
  },
  "answerKeySource": "<detected|generated|none>"
}

EXAMPLES OF QUESTION TYPE DETECTION:
- "Choose the correct heading" -> heading_match
- "List of Headings" -> heading_match
- "Which paragraph contains the following information?" -> matching_information
- "Choose the correct letter, A-H" when A-H are paragraph labels -> matching_information
- "Which section contains the following information?" -> matching_information
- "Look at the following issues/statements and the list of people/organisations/countries below" -> matching_features
- "Match each issue with the correct person or organization, A-F" -> matching_features
- "Look at questions 18-22 and the list of countries below. Match each statement with a country" -> matching_features
- "Use the information in the passage to match the category (listed A-F) with opinions or deeds below" -> matching_features
- "Classify the following developments as characterising A/B/C categories" -> matching_features
- "Match each event with the correct date, A-H" -> matching_features with the date/year values in options
- "Complete each sentence with the correct ending, A-E, below" -> matching_endings
- "Choose TWO correct answers" or "Choose TWO letters, A-E" -> multiple_choice (selectCount: 2)
- "Choose THREE correct letters among A-E" -> multiple_choice (selectCount: 3). Use one grouped question with "number" and "numbers" set to "N-M", the shared stem in "stem", and A-E answer choices in "options".
- "TRUE / FALSE / NOT GIVEN" -> true_false_notgiven
- "YES / NO / NOT GIVEN" -> yes_no_notgiven
- "Complete the summary", "Complete the following summary", or "Write NO MORE THAN" -> summary_completion
- Dotted blanks like "............." inside a gap-fill sentence -> convert to inline ___N___ placeholder at that exact position
- Bullet-point notes with a question range and dotted gaps -> note_completion with sequentially numbered inline blanks
- Bullet-point notes with NO gap marker -> keep as plain note text, not a numbered question
- "Label the diagram" or "diagram below" -> diagram_completion
- "Look at the following statements and the list of researchers below" -> matching_features`;

  async function parse(rawText, provider, apiKey, options = {}) {
    const parseOptions = normalizeParseOptions(options);
    let parsed;
    if (provider === 'gemini') {
      parsed = await parseWithGemini(rawText, apiKey, parseOptions);
    } else if (provider === 'openai') {
      parsed = await parseWithOpenAI(rawText, apiKey, parseOptions);
    } else if (provider === 'groq') {
      parsed = await parseWithGroq(rawText, apiKey, parseOptions);
    } else {
      throw new Error('Unknown AI provider: ' + provider);
    }

    return ensureAnswerKeyIfNeeded(parsed, rawText, provider, apiKey, parseOptions);
  }

  function normalizeParseOptions(options = {}) {
    return {
      autoGenerateAnswerKey: options.autoGenerateAnswerKey !== false
    };
  }

  function buildParseUserPrompt(rawText, options = {}) {
    const answerKeyInstruction = options.autoGenerateAnswerKey
      ? 'Answer-key mode: If the raw text has no answer key, solve the passage and generate a complete answerKey for every parsed question. Set answerKeySource to "generated".'
      : 'Answer-key mode: Do NOT solve or infer missing answers. Only extract answer keys that are explicitly printed in the raw text. If none are printed, return answerKey as {} and answerKeySource as "none".';

    return `Parse this IELTS Reading test into JSON. /no_think
${answerKeyInstruction}
Return one valid JSON object only. Do not include reasoning, comments, markdown, or text outside the JSON object.

${rawText}`;
  }

  async function parseWithGroq(rawText, apiKey, options = {}) {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const body = {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildParseUserPrompt(rawText, options) }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Groq API error: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Groq returned empty response.');

    return repairParsedDataV2(JSON.parse(cleanJsonText(text)), rawText, options);
  }

  async function parseWithGemini(rawText, apiKey, options = {}) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const body = {
      contents: [{
        parts: [
          { text: SYSTEM_PROMPT },
          { text: buildParseUserPrompt(rawText, options) }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned empty response.');

    return repairParsedDataV2(JSON.parse(cleanJsonText(text)), rawText, options);
  }

  async function parseWithOpenAI(rawText, apiKey, options = {}) {
    const url = 'https://api.openai.com/v1/chat/completions';
    const body = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildParseUserPrompt(rawText, options) }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('OpenAI returned empty response.');

    return repairParsedDataV2(JSON.parse(cleanJsonText(text)), rawText, options);
  }

  async function ensureAnswerKeyIfNeeded(data, rawText, provider, apiKey, options = {}) {
    normalizeAnswerKeyStateV2(data, options);
    if (!options.autoGenerateAnswerKey || hasCompleteAnswerKeyV2(data)) return data;
    const hadDetectedAnswerKey = hasAnswerKeyV2(data) && data.answerKeySource === 'detected';

    const prompt = `You are an IELTS Reading answer-key generator.
Use RAW_INPUT and PARSED_JSON to solve every parsed question.
Return ONLY valid JSON with this exact shape:
{
  "answerKey": {
    "1": "answer",
    "2": "answer"
  },
  "answerKeySource": "generated"
}
Rules:
- Include one answer for every parsed question number.
- For multiple-answer questions, join letters with comma + space, e.g. "A, C".
- For grouped multiple_choice ranges, provide exactly selectCount answers. Example: if Questions 5-6 says Choose TWO letters, return two letters as "5": "A", "6": "D" or "5-6": "A, D"; never return only one letter for the whole range.
- For matching, multiple choice, TRUE/FALSE/NOT GIVEN, and YES/NO/NOT GIVEN, use the visible answer labels.
- For gap-fill answers, use the exact word or phrase from the passage where possible.
- Do not include explanations, markdown, or text outside the JSON object.`;

    const payload = `RAW_INPUT:
${rawText}

PARSED_JSON:
${JSON.stringify(data)}`;

    try {
      const result = await callJsonModel(provider, apiKey, prompt, payload);
      if (result?.answerKey && typeof result.answerKey === 'object' && Object.keys(result.answerKey).length > 0) {
        data.answerKey = result.answerKey;
        data.answerKeySource = hadDetectedAnswerKey ? 'detected' : 'generated';
      } else {
        data.answerKey = {};
        data.answerKeySource = 'missing';
      }
    } catch (error) {
      data.answerKey = {};
      data.answerKeySource = 'missing';
    }
    return data;
  }

  async function reviewParse(rawText, parsedJson, correctedJson, provider, apiKey) {
    const prompt = `You are auditing an IELTS Reading parser output.
Compare RAW_INPUT with PARSED_JSON and optional CORRECTED_JSON.
Return ONLY valid JSON with this exact shape:
{
  "detectedErrors": ["short error description"],
  "likelyCause": "short explanation",
  "correctedJson": { },
  "promptFixSuggestion": "specific parser prompt rule to add or change",
  "repairRuleSuggestion": "specific deterministic repair rule if useful, otherwise empty string",
  "affectedQuestionTypes": ["matching_features"],
  "confidence": "low|medium|high"
}
Use CORRECTED_JSON as the source of truth if it is provided and valid. If PARSED_JSON is already correct, return an empty detectedErrors array and put PARSED_JSON in correctedJson.`;

    const payload = `RAW_INPUT:\n${rawText}\n\nPARSED_JSON:\n${JSON.stringify(parsedJson, null, 2)}\n\nCORRECTED_JSON:\n${correctedJson ? JSON.stringify(correctedJson, null, 2) : 'null'}\n\nCURRENT_PARSER_PROMPT:\n${SYSTEM_PROMPT}`;
    const result = await callJsonModel(provider, apiKey, prompt, payload);
    return normalizeReviewResult(result, parsedJson);
  }

  async function callJsonModel(provider, apiKey, systemPrompt, userPrompt) {
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }, { text: userPrompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Gemini API error: ${err.error?.message || res.statusText}`);
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Gemini returned empty response.');
      return JSON.parse(cleanJsonText(text));
    }

    const isGroq = provider === 'groq';
    const url = isGroq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    const model = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o - mini';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${isGroq ? '/no_think\n' : ''}${userPrompt}` }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`${isGroq ? 'Groq' : 'OpenAI'} API error: ${err.error?.message || res.statusText}`);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error(`${isGroq ? 'Groq' : 'OpenAI'} returned empty response.`);
    return JSON.parse(cleanJsonText(text));
  }

  function normalizeReviewResult(result, parsedJson) {
    return {
      detectedErrors: Array.isArray(result?.detectedErrors) ? result.detectedErrors : [],
      likelyCause: String(result?.likelyCause || ''),
      correctedJson: result?.correctedJson && typeof result.correctedJson === 'object' ? repairParsedDataV2(result.correctedJson, '') : parsedJson,
      promptFixSuggestion: String(result?.promptFixSuggestion || ''),
      repairRuleSuggestion: String(result?.repairRuleSuggestion || ''),
      affectedQuestionTypes: Array.isArray(result?.affectedQuestionTypes) ? result.affectedQuestionTypes : [],
      confidence: ['low', 'medium', 'high'].includes(result?.confidence) ? result.confidence : 'medium'
    };
  }

  function cleanJsonText(text) {
    if (!text) return '';
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '');
    }
    return cleaned.trim();
  }

  function repairParsedData(data, rawText) {
    if (!data || typeof data !== 'object') return data;

    const matchingInfoGroups = extractMatchingInformationGroups(rawText);
    if (matchingInfoGroups.length === 0) return data;

    if (!Array.isArray(data.parts) || data.parts.length === 0) {
      data.parts = [{
        partNumber: 1,
        questionRange: matchingInfoGroups[0].questionRange,
        passage: extractPassageFallback(rawText),
        questionGroups: []
      }];
    }

    for (const group of matchingInfoGroups) {
      const part = findLikelyPart(data.parts, group) || data.parts[0];
      if (!Array.isArray(part.questionGroups)) part.questionGroups = [];

      const exactIndex = part.questionGroups.findIndex(existing => existing.questionRange === group.questionRange);
      const overlappingIndex = exactIndex === -1
        ? part.questionGroups.findIndex(existing => rangesOverlap(existing.questionRange, group.questionRange))
        : -1;
      const existingIndex = exactIndex !== -1 ? exactIndex : overlappingIndex;

      if (existingIndex === -1) {
        part.questionGroups.push(group);
      } else {
        const existing = part.questionGroups[existingIndex];
        const expectedCount = countRangeSlots(group.questionRange);
        const actualCount = countQuestionSlots(existing.questions || []);
        if (
          (exactIndex !== -1 && existing.type === 'heading_match') ||
          (exactIndex !== -1 && existing.type !== group.type) ||
          !Array.isArray(existing.questions) ||
          actualCount < expectedCount
        ) {
          part.questionGroups[existingIndex] = group;
        } else if (exactIndex === -1 && existing.type === 'heading_match') {
          part.questionGroups.push(group);
        }
      }

      if (!part.questionRange || part.questionRange === '0-0') {
        part.questionRange = group.questionRange;
      }
      if (part.passage?.sections) {
        part.passage.sections.forEach(section => {
          section.questionMarker = null;
        });
      }
    }

    return data;
  }

  function extractMatchingInformationGroups(rawText) {
    const text = String(rawText || '').replace(/\r\n/g, '\n');
    const groups = [];
    const blockPattern = /questions?\s+(\d{1,2})\s*[-–]\s*(\d{1,2})([\s\S]*?)(?=\n\s*questions?\s+\d{1,2}\s*[-–]\s*\d{1,2}\b|$)/gi;
    let match;

    while ((match = blockPattern.exec(text)) !== null) {
      const start = Number(match[1]);
      const end = Number(match[2]);
      const block = match[3] || '';
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
      if (!isMatchingInformationBlock(block)) continue;

      const options = extractParagraphOptions(block);
      const questions = extractNumberedStatements(block, start, end);
      if (questions.length !== end - start + 1) continue;

      groups.push({
        type: 'matching_information',
        questionRange: `${start}-${end}`,
        instructions: extractInstructions(block, start),
        options,
        questions: questions.map(q => ({
          number: q.number,
          statement: q.statement,
          answer: null
        }))
      });
    }

    return groups;
  }

  function isMatchingInformationBlock(block) {
    const text = block.toLowerCase();
    return (
      /which\s+(paragraph|section)\s+contains/.test(text) ||
      /choose\s+the\s+correct\s+letter\s*,?\s*[a-z]\s*[-–]\s*[a-z]/i.test(block)
    ) && !/list\s+of\s+headings|choose\s+the\s+correct\s+heading/.test(text);
  }

  function extractParagraphOptions(block) {
    const rangeMatch = block.match(/\b([A-Z])\s*[-–]\s*([A-Z])\b/);
    const start = rangeMatch ? rangeMatch[1].charCodeAt(0) : 65;
    const end = rangeMatch ? rangeMatch[2].charCodeAt(0) : 72;
    const options = [];
    for (let code = start; code <= end; code++) {
      options.push(String.fromCharCode(code));
    }
    return options;
  }

  function extractNumberedStatements(block, start, end) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const questions = [];

    for (let i = 0; i < lines.length; i++) {
      const lineMatch = lines[i].match(/^(\d{1,2})[\.)]?\s+(.+)$/);
      if (!lineMatch) continue;

      const number = Number(lineMatch[1]);
      if (number < start || number > end) continue;

      let statement = lineMatch[2].trim();
      while (
        i + 1 < lines.length &&
        !/^\d{1,2}[\.)]?\s+/.test(lines[i + 1]) &&
        !/^questions?\s+\d{1,2}\s*[-–]\s*\d{1,2}/i.test(lines[i + 1])
      ) {
        i++;
        statement += ' ' + lines[i].trim();
      }
      questions.push({ number, statement: normalizeQuestionTextV2(statement) });
    }

    return questions;
  }

  function extractInstructions(block, firstQuestionNumber) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const instructionLines = [];
    for (const line of lines) {
      if (new RegExp(`^${firstQuestionNumber}[\\.)]?\\s+`).test(line)) break;
      instructionLines.push(line);
    }
    return instructionLines.join(' ');
  }

  function extractPassageFallback(rawText) {
    const text = String(rawText || '').replace(/\r\n/g, '\n');
    const questionIndex = text.search(/\n\s*questions?\s+\d{1,2}\s*[-–]\s*\d{1,2}/i);
    const passageText = (questionIndex >= 0 ? text.slice(0, questionIndex) : text).trim();
    const lines = passageText.split('\n').map(line => line.trim()).filter(Boolean);
    const title = lines[0] || 'IELTS Reading Passage';
    const sections = [];
    let current = null;

    for (const line of lines.slice(1)) {
      const standaloneLabel = line.match(/^([A-Z])$/);
      if (standaloneLabel) {
        current = { heading: standaloneLabel[1], paragraphs: [], questionMarker: null };
        sections.push(current);
        continue;
      }
      const paragraphLabel = line.match(/^([A-Z])[\.)]\s+(.+)$/);
      if (paragraphLabel) {
        current = { heading: paragraphLabel[1], paragraphs: [paragraphLabel[2]], questionMarker: null };
        sections.push(current);
      } else if (current) {
        current.paragraphs.push(line);
      } else {
        sections.push({ heading: null, paragraphs: [line], questionMarker: null });
      }
    }

    return {
      title,
      sections: sections.length > 0 ? sections : [{ heading: null, paragraphs: [passageText], questionMarker: null }]
    };
  }

  function findLikelyPart(parts, group) {
    return parts.find(part => rangesOverlap(part.questionRange, group.questionRange)) || parts[0];
  }

  function rangesOverlap(a, b) {
    const rangeA = parseRange(a);
    const rangeB = parseRange(b);
    if (!rangeA || !rangeB) return false;
    return rangeA.start <= rangeB.end && rangeB.start <= rangeA.end;
  }

  function parseRange(range) {
    const match = String(range || '').match(/(\d+)\s*[-–]\s*(\d+)/);
    if (!match) return null;
    return { start: Number(match[1]), end: Number(match[2]) };
  }

  function countRangeSlots(range) {
    const parsed = parseRange(range);
    if (!parsed || parsed.end < parsed.start) return 1;
    return parsed.end - parsed.start + 1;
  }

  function countQuestionSlots(questions) {
    return questions.reduce((total, q) => {
      return total + countRangeSlots(q.numbers || q.number);
    }, 0);
  }

  function repairParsedDataV2(data, rawText, options = {}) {
    if (!data || typeof data !== 'object') return data;
    normalizePassageSectionLabelsV2(data);
    restoreHeadingMatchPassageSectionsV2(data, rawText);
    safelyRestoreMatchingInformationPassageLabelsV2(data, rawText);
    normalizeHeadingMatchGroupsV2(data);
    normalizeSummaryWordBankGroupsV2(data);
    normalizeMatchingFeaturesGroupsV2(data);
    normalizeMatchingEndingsGroupsV2(data);
    normalizeGapPlaceholdersV2(data);
    sanitizeSummaryCompletionInstructionsV2(data);
    sanitizeHeadingMatchInstructionsV2(data);
    preserveWordLimitInstructionsV2(data, rawText);
    normalizeHeadingMatchExamplesV2(data, rawText);
    normalizeMultipleChoiceGroupsV2(data);
    normalizeQuestionTextPrefixesV2(data);
    sanitizeOptionTextFromInstructionsV2(data);
    normalizeAnswerKeyStateV2(data, options);
    const repairGroups = extractRepairQuestionGroupsV2(rawText);
    if (repairGroups.length === 0) {
      normalizeQuestionMarkersV2(data);
      return data;
    }

    if (!Array.isArray(data.parts) || data.parts.length === 0) {
      data.parts = [{
        partNumber: 1,
        questionRange: combineQuestionRangeV2(repairGroups),
        passage: extractPassageFallbackV2(rawText),
        questionGroups: []
      }];
    }

    for (const group of repairGroups) {
      const part = findLikelyPartV2(data.parts, group) || data.parts[0];
      if (!Array.isArray(part.questionGroups)) part.questionGroups = [];

      const exactIndex = part.questionGroups.findIndex(existing => existing.questionRange === group.questionRange);
      const overlapIndex = exactIndex === -1
        ? part.questionGroups.findIndex(existing => rangesOverlapV2(existing.questionRange, group.questionRange))
        : -1;
      const existingIndex = exactIndex !== -1 ? exactIndex : overlapIndex;

      if (existingIndex === -1) {
        part.questionGroups.push(group);
      } else {
        const existing = part.questionGroups[existingIndex];
        const expectedCount = countRangeSlotsV2(group.questionRange);
        const actualCount = countQuestionSlotsV2(existing.questions || []);
        if (
          (exactIndex !== -1 && existing.type === 'heading_match') ||
          (exactIndex !== -1 && existing.type !== group.type) ||
          shouldPreferRepairGroupV2(existing, group) ||
          !Array.isArray(existing.questions) ||
          actualCount < expectedCount
        ) {
          part.questionGroups[existingIndex] = group;
        } else if (exactIndex === -1 && existing.type === 'heading_match') {
          part.questionGroups.push(group);
        }
      }

      const range = combineQuestionRangeV2(part.questionGroups);
      if (range) part.questionRange = range;
      normalizeQuestionMarkersV2(data);
    }

    normalizePassageSectionLabelsV2(data);
    restoreHeadingMatchPassageSectionsV2(data, rawText);
    safelyRestoreMatchingInformationPassageLabelsV2(data, rawText);
    normalizeHeadingMatchGroupsV2(data);
    normalizeSummaryWordBankGroupsV2(data);
    normalizeMatchingFeaturesGroupsV2(data);
    normalizeMatchingEndingsGroupsV2(data);
    normalizeGapPlaceholdersV2(data);
    sanitizeSummaryCompletionInstructionsV2(data);
    sanitizeHeadingMatchInstructionsV2(data);
    preserveWordLimitInstructionsV2(data, rawText);
    normalizeHeadingMatchExamplesV2(data, rawText);
    normalizeMultipleChoiceGroupsV2(data);
    normalizeQuestionTextPrefixesV2(data);
    sanitizeOptionTextFromInstructionsV2(data);
    normalizeAnswerKeyStateV2(data, options);
    normalizeQuestionMarkersV2(data);
    return data;
  }

  function normalizePassageSectionLabelsV2(data) {
    for (const part of (data.parts || [])) {
      for (const section of (part.passage?.sections || [])) {
        if (String(section.heading || '').trim()) {
          const cleanHeading = String(section.heading).trim().match(/^([A-Z])(?:[\.)])?$/);
          if (cleanHeading) section.heading = cleanHeading[1];
          continue;
        }

        const firstParagraph = String(section.paragraphs?.[0] || '');
        const labeledParagraph = firstParagraph.match(/^([A-Z])[\.)]\s+(.+)$/);
        if (!labeledParagraph) continue;

        section.heading = labeledParagraph[1];
        section.paragraphs[0] = labeledParagraph[2].trim();
      }
    }
  }

  function restoreHeadingMatchPassageSectionsV2(data, rawText) {
    if (!rawText || !Array.isArray(data.parts)) return;

    const fallbackPassage = extractPassageFallbackV2(rawText);
    const fallbackSections = fallbackPassage.sections || [];
    const fallbackLabels = new Set(
      fallbackSections
        .map(section => String(section.heading || '').trim().toUpperCase())
        .filter(label => /^[A-Z]$/.test(label))
    );
    if (fallbackLabels.size < 2) return;

    for (const part of data.parts) {
      const headingGroups = (part.questionGroups || []).filter(group => group.type === 'heading_match');
      if (headingGroups.length === 0) continue;

      const neededLabels = new Set();
      for (const group of headingGroups) {
        for (const question of (group.questions || [])) {
          const label = String(question.section || question.statement || '')
            .match(/\b(?:section|paragraph)?\s*([A-Z])\b/i)?.[1];
          if (label) neededLabels.add(label.toUpperCase());
        }
      }
      if (neededLabels.size === 0) continue;

      const existingSections = part.passage?.sections || [];
      const existingLabels = new Set(
        existingSections
          .map(section => String(section.heading || '').trim().toUpperCase())
          .filter(label => /^[A-Z]$/.test(label))
      );

      const missingNeededLabel = [...neededLabels].some(label => !existingLabels.has(label));
      const labelsWereMerged = existingLabels.size < Math.min(neededLabels.size, fallbackLabels.size);
      if (!missingNeededLabel && !labelsWereMerged) continue;

      if (!part.passage) part.passage = {};
      part.passage.title = part.passage.title || fallbackPassage.title;
      part.passage.sections = fallbackSections.map(section => ({
        heading: section.heading,
        paragraphs: [...(section.paragraphs || [])],
        questionMarker: null
      }));
    }
  }

  function safelyRestoreMatchingInformationPassageLabelsV2(data, rawText) {
    try {
      restoreMatchingInformationPassageLabelsV2(data, rawText);
    } catch (error) {
      // Label restoration is a repair pass; parsing should not fail if raw text is unusual.
    }
  }

  function restoreMatchingInformationPassageLabelsV2(data, rawText) {
    if (!rawText || !Array.isArray(data.parts)) return;

    const fallbackPassage = extractPassageFallbackV2(rawText);
    const fallbackSections = fallbackPassage.sections || [];
    const fallbackLabels = fallbackSections
      .map(section => String(section.heading || '').trim().toUpperCase())
      .filter(label => /^[A-Z]$/.test(label));
    if (fallbackLabels.length < 2) return;

    for (const part of data.parts) {
      const groups = part.questionGroups || [];
      const hasHeadingMatch = groups.some(group => group.type === 'heading_match');
      const hasMatchingInformation = groups.some(group => group.type === 'matching_information');
      if (hasHeadingMatch || !hasMatchingInformation) continue;

      const existingSections = part.passage?.sections || [];
      const existingLabels = existingSections
        .map(section => String(section.heading || '').trim().toUpperCase())
        .filter(label => /^[A-Z]$/.test(label));

      if (existingLabels.length >= fallbackLabels.length) continue;

      if (!part.passage) part.passage = {};
      part.passage.title = part.passage.title || fallbackPassage.title;
      part.passage.sections = fallbackSections.map(section => ({
        heading: section.heading,
        paragraphs: [...(section.paragraphs || [])],
        questionMarker: null
      }));
    }
  }

  function normalizeGapPlaceholdersV2(data) {
    for (const part of (data.parts || [])) {
      for (const group of (part.questionGroups || [])) {
        if (typeof group.summaryText === 'string') {
          group.summaryText = normalizeInlineGapTokensV2(group.summaryText);
        }
        if (typeof group.noteText === 'string') {
          group.noteText = normalizeInlineGapTokensV2(group.noteText);
        }
        if (Array.isArray(group.additionalSummaries)) {
          group.additionalSummaries = group.additionalSummaries.map(item => ({
            ...item,
            text: normalizeInlineGapTokensV2(item.text)
          }));
        }
        for (const question of (group.questions || [])) {
          if (typeof question.statement === 'string') {
            question.statement = normalizeInlineGapTokensV2(question.statement);
          }
          if (typeof question.stem === 'string') {
            question.stem = normalizeInlineGapTokensV2(question.stem);
          }
          if (typeof question.question === 'string') {
            question.question = normalizeInlineGapTokensV2(question.question);
          }
        }
      }
    }
  }

  function normalizeInlineGapTokensV2(text) {
    return String(text || '')
      .replace(/(?:_\s*)+(___\d+___)(?:\s*_)+/g, '$1')
      .replace(/(?:_\s*)+(__(?:\d+)__)(?:\s*_)+/g, '$1')
      .replace(/(?:_\s*)+(\.{3,})(?:\s*_)+/g, '$1')
      .replace(/_{2,}\s*(___\d+___)\s*_{2,}/g, '$1')
      .replace(/__(\d{1,2})__/g, '___$1___');
  }

  function shouldPreferRepairGroupV2(existing, repairGroup) {
    if (!existing || !repairGroup || existing.type !== repairGroup.type) return false;

    if (existing.type === 'matching_features') {
      const existingOptions = Array.isArray(existing.options)
        ? existing.options.map(option => String(option || '').trim())
        : [];
      const repairOptions = Array.isArray(repairGroup.options)
        ? repairGroup.options.map(option => String(option || '').trim())
        : [];
      const existingOnlyLetters = existingOptions.length > 0 && existingOptions.every((option, index) => {
        const letter = String.fromCharCode(65 + index);
        return option.toUpperCase() === letter || option.toUpperCase() === `${letter}.`;
      });
      const repairHasRealText = repairOptions.some(option => option.length > 1 && !/^[A-Z][\.)]?$/.test(option));
      if (existingOnlyLetters && repairHasRealText) return true;
    }

    if (existing.type === 'multiple_choice') {
      const existingQuestions = existing.questions || [];
      const repairQuestions = repairGroup.questions || [];
      const missingStem = existingQuestions.some(question => !String(question.stem || '').trim());
      const duplicatedLabels = existingQuestions.some(question => (question.options || []).some(option => /^[A-Z][\.)]?\s+/.test(String(option || '').trim())));
      const existingOnlyLetters = existingQuestions.some(question => {
        const options = question.options || [];
        return options.length > 0 && options.every((option, index) => String(option || '').trim().toUpperCase() === String.fromCharCode(65 + index));
      });
      const repairHasRealOptions = repairQuestions.some(question => (question.options || []).some(option => String(option || '').trim().length > 1));
      const leakedGroupedStem = Number(existing.selectCount || 1) > 1 && existingQuestions.some(question =>
        instructionContainsQuestionStemV2(existing.instructions, question.stem)
      );
      return (missingStem || duplicatedLabels || leakedGroupedStem || (existingOnlyLetters && repairHasRealOptions)) && repairQuestions.every(question => String(question.stem || '').trim());
    }

    if (existing.type === 'summary_completion') {
      const existingSummary = String(existing.summaryText || '').trim();
      const repairSummary = String(repairGroup.summaryText || '').trim();
      const missingSummaryBody = !existingSummary || !/___\d{1,2}___/.test(existingSummary);
      const existingOptions = Array.isArray(existing.options) ? existing.options : [];
      const repairOptions = Array.isArray(repairGroup.options) ? repairGroup.options : [];
      const existingOnlyLetters = existingOptions.length > 0 && existingOptions.every((option, index) => {
        const letter = String.fromCharCode(65 + index);
        return String(option || '').trim().toUpperCase() === letter;
      });
      const repairHasRealOptions = repairOptions.some(option => String(option || '').trim().length > 1);
      return (missingSummaryBody && /___\d{1,2}___/.test(repairSummary)) || (existingOnlyLetters && repairHasRealOptions);
    }

    if (existing.type === 'heading_match') {
      const leakedInstructions = /list\s+of\s+headings\s+[ivxlcdm]+[\.)]?\s+/i.test(String(existing.instructions || ''));
      return leakedInstructions && (repairGroup.headingOptions || []).length > 0;
    }

    return false;
  }

  function sanitizeSummaryCompletionInstructionsV2(data) {
    for (const part of (data.parts || [])) {
      for (const group of (part.questionGroups || [])) {
        if (group.type !== 'summary_completion') continue;
        group.instructions = cleanSummaryInstructionTextV2(group.instructions, group.questionRange);
      }
    }
  }

  function sanitizeHeadingMatchInstructionsV2(data) {
    for (const part of (data.parts || [])) {
      for (const group of (part.questionGroups || [])) {
        if (group.type !== 'heading_match') continue;
        group.instructions = cleanHeadingInstructionTextV2(group.instructions);
      }
    }
  }

  function preserveWordLimitInstructionsV2(data, rawText) {
    if (!rawText) return;
    const blocks = getQuestionBlocksV2(rawText);
    const wordLimitTypes = new Set([
      'summary_completion',
      'sentence_completion',
      'note_completion',
      'table_completion',
      'flowchart_completion',
      'short_answer'
    ]);

    for (const part of (data.parts || [])) {
      for (const group of (part.questionGroups || [])) {
        if (!wordLimitTypes.has(group.type)) continue;
        if (instructionHasWordLimitV2(group.instructions)) continue;

        const rawBlock = findQuestionBlockForRangeV2(blocks, group.questionRange);
        if (!rawBlock) continue;

        const wordLimitInstruction = extractWordLimitInstructionV2(rawBlock.block);
        if (!wordLimitInstruction) continue;

        group.instructions = tidyInstructionPunctuationV2(
          [group.instructions, wordLimitInstruction].filter(Boolean).join(' ')
        );
      }
    }
  }

  function findQuestionBlockForRangeV2(blocks, questionRange) {
    const parsed = parseRangeV2(questionRange);
    if (!parsed) return null;
    return blocks.find(block => block.start === parsed.start && block.end === parsed.end)
      || blocks.find(block => block.start <= parsed.start && block.end >= parsed.end)
      || null;
  }

  function extractWordLimitInstructionV2(block) {
    const lines = String(block || '')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    const matches = [];
    for (const line of lines) {
      if (isWordLimitInstructionLineV2(line)) {
        matches.push(line.replace(/\s+/g, ' ').trim());
      }
    }
    return [...new Set(matches)].join(' ');
  }

  function instructionHasWordLimitV2(value) {
    return isWordLimitInstructionLineV2(String(value || ''));
  }

  function isWordLimitInstructionLineV2(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return /\bNO\s+MORE\s+THAN\s+(?:ONE|TWO|THREE|FOUR|\d+)\s+WORDS?(?:\s+AND\/OR\s+A\s+NUMBER)?\b/i.test(text)
      || /\b(?:ONE|TWO|THREE|FOUR|\d+)\s+WORDS?\s+ONLY\b/i.test(text)
      || /\bONE\s+WORD\s+ONLY\b/i.test(text)
      || /\bNO\s+MORE\s+THAN\s+(?:ONE|TWO|THREE|FOUR|\d+)\s+WORDS?\s+AND\s+A\s+NUMBER\b/i.test(text)
      || /\bNO\s+MORE\s+THAN\s+(?:ONE|TWO|THREE|FOUR|\d+)\s+WORDS?\s+OR\s+A\s+NUMBER\b/i.test(text);
  }

  function cleanHeadingInstructionTextV2(instructions) {
    let text = String(instructions || '').replace(/\s+/g, ' ').trim();
    if (!text) return text;
    text = text.replace(/\s*\bList\s+of\s+Headings\b[\s\S]*$/i, '');
    text = text.replace(/^[\s.:-]*list\s+of\s+headings\s+[ivxlcdm]+[\.)]?[\s\S]*$/i, '');
    return tidyInstructionPunctuationV2(text);
  }

  function normalizeHeadingMatchExamplesV2(data, rawText) {
    if (!rawText || !Array.isArray(data.parts)) return;

    for (const { start, end, block } of getQuestionBlocksV2(rawText)) {
      if (!/list\s+of\s+headings|choose\s+the\s+most\s+suitable\s+heading|choose\s+the\s+correct\s+heading/i.test(block)) continue;

      const group = findHeadingMatchGroupByRangeV2(data, `${start}-${end}`);
      const headingOptions = (group?.headingOptions?.length ? group.headingOptions : extractRomanHeadingOptionsV2(block)) || [];
      const examples = extractHeadingMatchExamplesV2(block, headingOptions);
      if (examples.length === 0) continue;

      const part = findLikelyPartV2(data.parts, { questionRange: `${start}-${end}`, type: 'heading_match' }) || data.parts[0];
      for (const example of examples) {
        const section = (part.passage?.sections || []).find(item =>
          String(item.heading || '').trim().toUpperCase() === example.section
        );
        if (!section) continue;
        section.questionMarker = null;
        section.headingExample = { label: example.label, text: example.text };
      }
    }
  }

  function findHeadingMatchGroupByRangeV2(data, questionRange) {
    for (const part of (data.parts || [])) {
      const group = (part.questionGroups || []).find(item =>
        item.type === 'heading_match' && item.questionRange === questionRange
      );
      if (group) return group;
    }
    return null;
  }

  function extractHeadingMatchExamplesV2(block, headingOptions) {
    const text = normalizeParserTextV2(block);
    const examples = [];
    const pattern = /\b(?:Paragraph|Section)\s+([A-Z])\s+([ivxlcdm]+)\b/gi;
    let match;

    while ((match = pattern.exec(text))) {
      const before = text.slice(Math.max(0, match.index - 80), match.index);
      if (!/\bExample\b/i.test(before)) continue;
      const label = match[2].toLowerCase();
      const optionIndex = romanToNumberV2(label) - 1;
      const optionText = headingOptions[optionIndex];
      if (!optionText) continue;
      examples.push({
        section: match[1].toUpperCase(),
        label,
        text: optionText
      });
    }

    return examples;
  }

  function romanToNumberV2(value) {
    const map = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
    const chars = String(value || '').toLowerCase().split('');
    let total = 0;
    for (let i = 0; i < chars.length; i++) {
      const current = map[chars[i]] || 0;
      const next = map[chars[i + 1]] || 0;
      total += current < next ? -current : current;
    }
    return total;
  }

  function normalizeMultipleChoiceGroupsV2(data) {
    for (const part of (data.parts || [])) {
      for (const group of (part.questionGroups || [])) {
        if (group.type !== 'multiple_choice') continue;
        for (const question of (group.questions || [])) {
          question.stem = stripGroupedRangePrefixV2(question.stem, group.questionRange);
          question.options = (question.options || []).map(stripChoiceLabelV2);
        }
        if (Number(group.selectCount || 1) > 1) {
          const stems = (group.questions || []).map(question => question.stem).filter(Boolean);
          for (const stem of stems) {
            group.instructions = removeQuestionStemFromInstructionsV2(group.instructions, stem);
          }
          group.instructions = cleanGroupedMultipleChoiceInstructionTextV2(group.instructions);
        }
      }
    }
  }

  function normalizeQuestionTextPrefixesV2(data) {
    for (const part of (data.parts || [])) {
      for (const group of (part.questionGroups || [])) {
        for (const question of (group.questions || [])) {
          const number = question.number;
          if (typeof number !== 'number' && !/^\d+$/.test(String(number || ''))) continue;
          if (typeof question.statement === 'string') {
            question.statement = stripLeadingQuestionNumberV2(question.statement, number);
          }
          if (typeof question.stem === 'string') {
            question.stem = stripLeadingQuestionNumberV2(question.stem, number);
          }
          if (typeof question.question === 'string') {
            question.question = stripLeadingQuestionNumberV2(question.question, number);
          }
        }
      }
    }
  }

  function stripGroupedRangePrefixV2(value, questionRange) {
    const text = String(value || '').trim();
    const range = parseRangeV2(questionRange);
    if (!range) return text.replace(/^\d{1,2}\s*-\s*\d{1,2}[\.)]?\s+/, '').trim();
    return text
      .replace(new RegExp(`^${range.start}\\s*-\\s*${range.end}[\\.)]?\\s+`), '')
      .trim();
  }

  function instructionContainsQuestionStemV2(instructions, stem) {
    const instructionText = normalizeComparableTextV2(instructions);
    const stemText = normalizeComparableTextV2(stem);
    return stemText.length > 20 && instructionText.includes(stemText);
  }

  function removeQuestionStemFromInstructionsV2(instructions, stem) {
    const text = String(instructions || '').replace(/\s+/g, ' ').trim();
    const stemText = String(stem || '').replace(/\s+/g, ' ').trim();
    if (!text || !stemText) return text;
    const index = normalizeComparableTextV2(text).indexOf(normalizeComparableTextV2(stemText));
    if (index === -1) return text;

    const loweredStemStart = stemText.slice(0, 24).toLowerCase();
    const realIndex = text.toLowerCase().indexOf(loweredStemStart);
    if (realIndex === -1) return text;
    return tidyInstructionPunctuationV2(text.slice(0, realIndex));
  }

  function cleanGroupedMultipleChoiceInstructionTextV2(instructions) {
    const text = String(instructions || '').replace(/\s+/g, ' ').trim();
    if (!text) return text;
    const matches = text.match(/\b(?:choose\s+(?:two|three|four|\d+)\s+(?:correct\s+)?(?:answers?|letters?)(?:\s+among\s+[A-Z]\s*-\s*[A-Z]|\s*,?\s+[A-Z]\s*(?:,|\s+or\s+|-)\s*[A-Z])?|write\s+(?:your\s+answers?|the\s+correct\s+letters?)\b[^.?!]*(?:[.?!]|$))/gi);
    return tidyInstructionPunctuationV2((matches || [text]).join(' '));
  }

  function normalizeComparableTextV2(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/^\d{1,2}\s*-\s*\d{1,2}[\.)]?\s+/, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function cleanSummaryInstructionTextV2(instructions, questionRange) {
    let text = String(instructions || '').replace(/\s+/g, ' ').trim();
    if (!text) return text;

    const leakIndex = findSummaryBodyLeakIndexV2(text);
    if (leakIndex === -1) return text;

    const beforeLeak = text.slice(0, leakIndex).trim();
    const answerSheetMatch = beforeLeak.match(/^(.*?\b(?:write|put|type)\s+(?:your\s+)?answers?\s+in\s+boxes?\s+\d+\s*-\s*\d+\s+on\s+your\s+answer\s+sheet)\b/i);
    if (answerSheetMatch) return tidyInstructionPunctuationV2(answerSheetMatch[1]);

    const range = parseRangeV2(questionRange);
    const rangePattern = range
      ? new RegExp(`^(.*?\\bboxes?\\s+${range.start}\\s*-\\s*${range.end}\\b(?:\\s+on\\s+your\\s+answer\\s+sheet)?)`, 'i')
      : null;
    const rangeMatch = rangePattern ? beforeLeak.match(rangePattern) : null;
    if (rangeMatch) return tidyInstructionPunctuationV2(rangeMatch[1]);

    const commandSentences = beforeLeak
      .split(/(?<=[.!?])\s+/)
      .filter(sentence => /^(complete|choose|write|use|you may|list of words|word list)\b/i.test(sentence.trim()));
    return tidyInstructionPunctuationV2(commandSentences.join(' ') || beforeLeak);
  }

  function findSummaryBodyLeakIndexV2(text) {
    const gapMatch = text.match(/\.{5,}|___\d+___|__\d+__/);
    if (!gapMatch) return -1;

    const beforeGap = text.slice(0, gapMatch.index);
    const summaryStartPatterns = [
      /\b[A-Z][a-z]+(?:\s+[a-z'’-]+){1,8}\s+(?:is|are|was|were|can|could|may|might|has|have|had|do|does|did|will|would|should)\s+[^.]*$/i,
      /\bthe\s+[a-z'’-]+(?:\s+[a-z'’-]+){1,8}\s+(?:is|are|was|were|can|could|may|might|has|have|had|will|would|should)\s+[^.]*$/i
    ];

    for (const pattern of summaryStartPatterns) {
      const match = beforeGap.match(pattern);
      if (match) return match.index;
    }

    const lastInstructionEnd = Math.max(
      beforeGap.toLowerCase().lastIndexOf('answer sheet') + 'answer sheet'.length,
      beforeGap.toLowerCase().lastIndexOf('summary below') + 'summary below'.length,
      beforeGap.toLowerCase().lastIndexOf('list of words') + 'list of words'.length
    );
    return lastInstructionEnd > 0 ? lastInstructionEnd : gapMatch.index;
  }

  function tidyInstructionPunctuationV2(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.!?;:])/g, '$1')
      .trim();
  }

  function normalizeQuestionMarkersV2(data) {
    for (const part of (data.parts || [])) {
      if (!Array.isArray(part.passage?.sections)) continue;
      part.passage.sections.forEach(section => {
        section.questionMarker = null;
      });
      const headingGroups = (part.questionGroups || []).filter(group => group.type === 'heading_match');
      if (headingGroups.length === 0) continue;

      for (const group of headingGroups) {
        for (const question of (group.questions || [])) {
          const sectionLabel = String(question.section || question.statement || '').match(/\b(?:section|paragraph)?\s*([A-Z])\b/i)?.[1];
          if (!sectionLabel) continue;
          const section = part.passage.sections.find(item => String(item.heading || '').trim().toUpperCase() === sectionLabel.toUpperCase());
          if (section) section.questionMarker = question.number;
        }

        const assignedCount = part.passage.sections.filter(section => Number.isFinite(Number(section.questionMarker))).length;
        if (assignedCount > 0) continue;

        const sectionRangeMatch = String(group.instructions || '').match(/\b(?:sections?|paragraphs?)\s+([A-Z])\s*[-–]\s*([A-Z])\b/i);
        const exampleSectionLabel = (part.passage.sections || [])
          .find(section => section?.headingExample && /^[A-Z]$/i.test(String(section.heading || '').trim()))
          ?.heading;

        let targetLabels = [];
        if (sectionRangeMatch) {
          const startCode = sectionRangeMatch[1].toUpperCase().charCodeAt(0);
          const endCode = sectionRangeMatch[2].toUpperCase().charCodeAt(0);
          for (let code = startCode; code <= endCode; code++) {
            targetLabels.push(String.fromCharCode(code));
          }
        } else {
          targetLabels = (part.passage.sections || [])
            .map(section => String(section.heading || '').trim().toUpperCase())
            .filter(label => /^[A-Z]$/.test(label));
          if (exampleSectionLabel) {
            targetLabels = targetLabels.filter(label => label !== String(exampleSectionLabel).trim().toUpperCase());
          }
        }

        const filteredSections = (part.passage.sections || []).filter(section =>
          targetLabels.includes(String(section.heading || '').trim().toUpperCase())
        );

        if (filteredSections.length !== (group.questions || []).length) continue;

        for (let i = 0; i < filteredSections.length; i++) {
          filteredSections[i].questionMarker = group.questions[i]?.number ?? null;
        }
      }
    }
  }

  function sanitizeOptionTextFromInstructionsV2(data) {
    for (const part of (data.parts || [])) {
      for (const group of (part.questionGroups || [])) {
        if (!['matching_features', 'matching_endings'].includes(group.type) || !Array.isArray(group.options)) continue;
        group.instructions = stripOptionsFromInstructionV2(group.instructions, group.options);
      }
    }
  }

  function stripOptionsFromInstructionV2(instructions, options) {
    let cleaned = String(instructions || '').trim();
    if (!cleaned || !options.length) return cleaned;

    for (let i = 0; i < options.length; i++) {
      const letter = String.fromCharCode(65 + i);
      const option = escapeRegExpV2(String(options[i] || '').trim());
      if (!option) continue;
      cleaned = cleaned.replace(new RegExp(`\\s*${letter}[\\.)]?\\s+${option}`, 'gi'), '');
    }
    return cleaned.replace(/\s{2,}/g, ' ').trim();
  }

  function escapeRegExpV2(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalizeSummaryWordBankGroupsV2(data) {
    for (const part of (data.parts || [])) {
      for (const group of (part.questionGroups || [])) {
        if (group.type !== 'summary_completion' || !Array.isArray(group.options)) continue;
        group.options = group.options
          .map(option => stripWordBankLabelV2(option))
          .filter(Boolean);
      }
    }
  }

  function normalizeHeadingMatchGroupsV2(data) {
    for (const part of (data.parts || [])) {
      for (const group of (part.questionGroups || [])) {
        if (group.type !== 'heading_match' || !Array.isArray(group.headingOptions)) continue;
        group.headingOptions = group.headingOptions
          .map(option => stripHeadingLabelV2(option))
          .filter(Boolean);
      }
    }
  }

  function normalizeMatchingFeaturesGroupsV2(data) {
    for (const part of (data.parts || [])) {
      for (const group of (part.questionGroups || [])) {
        if (group.type !== 'matching_features' || !Array.isArray(group.options)) continue;
        group.options = group.options.map(stripChoiceLabelV2).filter(Boolean);
      }
    }
  }

  function normalizeMatchingEndingsGroupsV2(data) {
    for (const part of (data.parts || [])) {
      for (const group of (part.questionGroups || [])) {
        if (group.type !== 'matching_endings') continue;
        if (Array.isArray(group.options)) {
          group.options = group.options.map(stripChoiceLabelV2).filter(Boolean);
        }
        for (const question of (group.questions || [])) {
          if (question.stem) question.stem = stripLeadingQuestionNumberV2(question.stem, question.number);
          if (question.statement) question.statement = stripLeadingQuestionNumberV2(question.statement, question.number);
        }
      }
    }
  }

  function stripLeadingQuestionNumberV2(value, number) {
    const text = String(value || '').trim();
    if (!number) return text;
    return text.replace(new RegExp(`^${escapeRegExpV2(String(number))}[\\.)]?\\s+`), '').trim();
  }

  function hasAnswerKeyV2(data) {
    return !!(data?.answerKey && typeof data.answerKey === 'object' && Object.keys(data.answerKey).length > 0);
  }

  function hasCompleteAnswerKeyV2(data) {
    if (!hasAnswerKeyV2(data)) return false;
    const groups = getAllQuestionGroupsV2(data);
    for (const group of groups) {
      if (group?.type !== 'multiple_choice' || Number(group.selectCount || 1) <= 1) continue;
      for (const question of (group.questions || [])) {
        const rangeLabel = String(question.numbers || question.number || group.questionRange || '').trim();
        const range = parseRangeV2(rangeLabel);
        const selectCount = Number(group.selectCount || 1);
        if (!range || selectCount <= 1) continue;
        const rangeAnswers = splitAnswerListForParserV2(data.answerKey[rangeLabel]);
        if (rangeAnswers.length >= selectCount) continue;

        let covered = 0;
        for (let number = range.start; number <= range.end; number++) {
          if (splitAnswerListForParserV2(data.answerKey[String(number)]).length > 0) covered += 1;
        }
        if (covered < Math.min(selectCount, range.end - range.start + 1)) return false;
      }
    }
    return true;
  }

  function getAllQuestionGroupsV2(data) {
    const groups = [];
    for (const part of (data?.parts || [])) {
      for (const group of (part.questionGroups || [])) {
        groups.push(group);
      }
    }
    return groups;
  }

  function splitAnswerListForParserV2(value) {
    if (value == null) return [];
    if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
    return String(value)
      .split(/\s*(?:,|;|\/|\band\b|\bor\b)\s*/i)
      .map(item => item.trim())
      .filter(Boolean);
  }

  function normalizeAnswerKeyStateV2(data, options = {}) {
    if (!data || typeof data !== 'object') return;
    if (options.autoGenerateAnswerKey === false && data.answerKeySource === 'generated') {
      data.answerKey = {};
      data.answerKeySource = 'none';
      return;
    }
    if (!data.answerKey || typeof data.answerKey !== 'object') data.answerKey = {};
    if (hasAnswerKeyV2(data)) {
      if (!data.answerKeySource || data.answerKeySource === 'none' || data.answerKeySource === 'missing') {
        data.answerKeySource = 'detected';
      }
      return;
    }
    data.answerKeySource = options.autoGenerateAnswerKey === false ? 'none' : (data.answerKeySource || 'missing');
  }

  function stripWordBankLabelV2(option) {
    return stripChoiceLabelV2(option);
  }

  function stripChoiceLabelV2(option) {
    return String(option || '').trim().replace(/^[A-Z][\.)]?\s+/, '').trim();
  }

  function stripHeadingLabelV2(option) {
    return String(option || '')
      .trim()
      .replace(/^[ivxlcdm]+[\.)]\s+/i, '')
      .replace(/^[ivxlcdm]+\s+(?=[A-Z])/, '')
      .trim();
  }

  function extractRepairQuestionGroupsV2(rawText) {
    return [
      ...extractHeadingMatchGroupsV2(rawText),
      ...extractMatchingFeaturesGroupsV2(rawText),
      ...extractMatchingEndingsGroupsV2(rawText),
      ...extractMatchingInformationGroupsV2(rawText),
      ...extractTFNGGroupsV2(rawText),
      ...extractNoteCompletionGroupsV2(rawText),
      ...extractSummaryCompletionGroupsV2(rawText),
      ...extractInlineGapCompletionGroupsV2(rawText),
      ...extractMultipleChoiceGroupsV2(rawText),
      ...extractStandardMultipleChoiceGroupsV2(rawText),
      ...extractSingleMultipleChoiceGroupsV2(rawText),
      ...extractShortAnswerGroupsV2(rawText),
      ...extractSentenceCompletionGroupsV2(rawText)
    ].sort((a, b) => parseRangeV2(a.questionRange).start - parseRangeV2(b.questionRange).start);
  }

  function extractHeadingMatchGroupsV2(rawText) {
    const groups = [];
    for (const { start, end, block } of getQuestionBlocksV2(rawText)) {
      if (!/list\s+of\s+headings|choose\s+the\s+correct\s+heading/i.test(block)) continue;
      const headingOptions = extractRomanHeadingOptionsV2(block);
      const questions = extractHeadingMatchQuestionsV2(block, start, end);
      if (headingOptions.length === 0 || questions.length !== end - start + 1) continue;

      groups.push({
        type: 'heading_match',
        questionRange: `${start}-${end}`,
        instructions: extractInstructionsV2(block, start),
        headingOptions,
        questions: questions.map(q => ({
          number: q.number,
          section: q.section,
          answer: null
        }))
      });
    }
    return groups;
  }

  function extractRomanHeadingOptionsV2(block) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const listIndex = lines.findIndex(line => /^list\s+of\s+headings/i.test(line));
    if (listIndex === -1) return [];

    const options = [];
    for (const line of lines.slice(listIndex + 1)) {
      if (/^\d{1,2}(?:[\.)]?\s+|[\.)]?$)/.test(line)) break;
      const match = line.match(/^(?:[ivxlcdm]+)[\.)]?\s+(.+)$/i);
      if (match) options.push(match[1].trim());
    }
    return options;
  }

  function extractHeadingMatchQuestionsV2(block, start, end) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const questions = [];
    for (let i = 0; i < lines.length; i++) {
      const inlineMatch = lines[i].match(/^(\d{1,2})[\.)]?\s+(Section|Paragraph)\s+([A-Z])$/i);
      const standaloneMatch = lines[i].match(/^(\d{1,2})[\.)]?$/);
      let number = null;
      let section = null;

      if (inlineMatch) {
        number = Number(inlineMatch[1]);
        section = inlineMatch[3].toUpperCase();
      } else if (standaloneMatch && i + 1 < lines.length) {
        const nextMatch = lines[i + 1].match(/^(Section|Paragraph)\s+([A-Z])$/i);
        if (!nextMatch) continue;
        number = Number(standaloneMatch[1]);
        section = nextMatch[2].toUpperCase();
        i++;
      }

      if (number !== null && number >= start && number <= end) {
        questions.push({ number, section });
      }
    }
    return questions;
  }

  function extractMatchingFeaturesGroupsV2(rawText) {
    const groups = [];
    for (const { start, end, block } of getQuestionBlocksV2(rawText)) {
      if (!isMatchingFeaturesBlockV2(block)) continue;
      const questions = extractNumberedStatementsV2(block, start, end);
      const options = extractLetteredOptionsV2(block, start);
      if (questions.length !== end - start + 1 || options.length === 0) continue;

      groups.push({
        type: 'matching_features',
        questionRange: `${start}-${end}`,
        instructions: extractInstructionsV2(block, start),
        options,
        questions: questions.map(q => ({ number: q.number, statement: q.statement, answer: null }))
      });
    }
    return groups;
  }

  function extractMatchingEndingsGroupsV2(rawText) {
    const groups = [];
    for (const { start, end, block } of getQuestionBlocksV2(rawText)) {
      if (!/complete\s+each\s+sentence\s+with\s+the\s+correct\s+ending/i.test(block)) continue;
      const questions = extractNumberedStatementsV2(block, start, end);
      const options = extractLetteredOptionsV2(block, start);
      if (questions.length !== end - start + 1 || options.length === 0) continue;

      groups.push({
        type: 'matching_endings',
        questionRange: `${start}-${end}`,
        instructions: extractInstructionsV2(block, start),
        options,
        questions: questions.map(q => ({ number: q.number, stem: q.statement, answer: null }))
      });
    }
    return groups;
  }

  function extractMatchingInformationGroupsV2(rawText) {
    const groups = [];
    for (const { start, end, block } of getQuestionBlocksV2(rawText)) {
      if (!isMatchingInformationBlockV2(block)) continue;
      const questions = extractNumberedStatementsV2(block, start, end);
      if (questions.length === 0) {
        questions.push(...extractSequentialStatementsV2(block, start, end, {
          skipPatterns: [
            /^reading\s+passage\b/i,
            /^which\s+(paragraph|section)\s+contains\b/i,
            /^write\s+the\s+correct\s+letter\b/i,
            /^choose\s+the\s+correct\s+letter\b/i,
            /^nb\b/i
          ]
        }));
      }
      if (questions.length !== end - start + 1) continue;

      groups.push({
        type: 'matching_information',
        questionRange: `${start}-${end}`,
        instructions: extractInstructionsV2(block, start),
        options: extractParagraphOptionsV2(block),
        questions: questions.map(q => ({ number: q.number, statement: q.statement, answer: null }))
      });
    }
    return groups;
  }

  function extractShortAnswerGroupsV2(rawText) {
    const groups = [];
    for (const { start, end, block } of getQuestionBlocksV2(rawText)) {
      if (!/choose\s+no\s+more\s+than/i.test(block) || !/for\s+each\s+answer/i.test(block)) continue;
      if (/complete\s+the\s+(summary|sentences?|notes?|table|flow-?chart)/i.test(block)) continue;

      const questions = extractNumberedStatementsV2(block, start, end);
      if (questions.length === 0) {
        questions.push(...extractSequentialStatementsV2(block, start, end, {
          requireQuestionLike: true,
          skipPatterns: [
            /^choose\s+no\s+more\s+than/i,
            /^write\s+your\s+answer/i
          ]
        }));
      }
      if (questions.length !== end - start + 1) continue;

      groups.push({
        type: 'short_answer',
        questionRange: `${start}-${end}`,
        instructions: extractInstructionsV2(block, start),
        questions: questions.map(q => ({ number: q.number, question: q.statement, answer: null }))
      });
    }
    return groups;
  }

  function extractTFNGGroupsV2(rawText) {
    const groups = [];
    for (const { start, end, block } of getQuestionBlocksV2(rawText)) {
      if (!/\btrue\b[\s\S]*\bfalse\b[\s\S]*\bnot\s+given\b/i.test(block)) continue;
      const questions = extractNumberedStatementsV2(block, start, end);
      if (questions.length !== end - start + 1) continue;

      groups.push({
        type: 'true_false_notgiven',
        questionRange: `${start}-${end}`,
        instructions: extractInstructionsV2(block, start),
        questions: questions.map(q => ({ number: q.number, statement: q.statement, answer: null }))
      });
    }
    return groups;
  }

  function extractSummaryCompletionGroupsV2(rawText) {
    const groups = [];
    for (const { start, end, block } of getQuestionBlocksV2(rawText)) {
      if (!/complete\s+(?:the\s+)?(?:following\s+)?summary/i.test(block)) continue;
      const expected = end - start + 1;
      const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
      const textLines = lines.filter(line =>
        line !== '.' &&
        !/^questions?\s+\d{1,2}\s*-\s*\d{1,2}/i.test(line) &&
        !/^complete\s+(?:the\s+)?(?:following\s+)?summary/i.test(line) &&
        !/^list\s+of\s+words/i.test(line) &&
        extractPackedLetteredOptionsV2(line).length === 0 &&
        !/^using\s+no\s+more\s+than/i.test(line) &&
        !/^choose\s+/i.test(line) &&
        !/^write\s+/i.test(line)
      );
      let nextNumber = start;
      let slotCount = 0;
      const seenNumbers = new Set();
      const summaryText = textLines.join(' ').replace(/\b(\d{1,2})\s*\.{5,}|(?:_\s*)+_{2,}(\d{1,2})_{2,}(?:\s*_)+|\.{5,}/g, (match, dottedNum, wrappedNum) => {
        const explicitNum = dottedNum || wrappedNum;
        if (explicitNum) {
          const number = Number(explicitNum);
          if (number >= start && number <= end && !seenNumbers.has(number)) {
            seenNumbers.add(number);
            slotCount++;
            return `___${number}___`;
          }
          return `___${explicitNum}___`;
        }

        while (seenNumbers.has(nextNumber) && nextNumber <= end) {
          nextNumber++;
        }
        if (nextNumber > end) return '_____';
        seenNumbers.add(nextNumber);
        slotCount++;
        return `___${nextNumber++}___`;
      });
      if (slotCount !== expected) continue;
      groups.push({
        type: 'summary_completion',
        questionRange: `${start}-${end}`,
        instructions: extractInstructionsV2(block, start),
        options: extractWordBankOptionsV2(block),
        summaryText,
        questions: Array.from({ length: expected }, (_, index) => ({
          number: start + index,
          statement: `___${start + index}___`,
          answer: null
        }))
      });
    }
    return groups;
  }

  function extractNoteCompletionGroupsV2(rawText) {
    const groups = [];
    for (const { start, end, block } of getQuestionBlocksV2(rawText)) {
      if (!/complete\s+the\s+notes?\s+below/i.test(block)) continue;
      const expected = end - start + 1;
      const lines = normalizeParserTextV2(block).split('\n').map(line => line.trim()).filter(Boolean);
      const bodyLines = lines.filter(line =>
        !/^questions?\s+\d{1,2}\s*-\s*\d{1,2}/i.test(line) &&
        !/^complete\s+the\s+notes?\s+below/i.test(line) &&
        !/^choose\s+/i.test(line) &&
        !/^write\s+/i.test(line)
      );
      if (bodyLines.length === 0) continue;

      const title = isNoteHeadingLineV2(bodyLines[0]) ? bodyLines[0] : '';
      const noteBodyLines = title ? bodyLines.slice(1) : bodyLines;
      const noteText = numberNoteCompletionGapsV2(buildNoteTextV2(noteBodyLines), start, end);
      const placeholders = new Set(Array.from(noteText.matchAll(/___(\d{1,2})___/g)).map(match => Number(match[1])));
      if (placeholders.size !== expected) continue;

      groups.push({
        type: 'note_completion',
        questionRange: `${start}-${end}`,
        instructions: extractNoteCompletionInstructionsV2(block),
        title,
        noteText,
        questions: Array.from({ length: expected }, (_, index) => ({
          number: start + index,
          statement: `___${start + index}___`,
          answer: null
        }))
      });
    }
    return groups;
  }

  function buildNoteTextV2(lines) {
    const blocks = [];
    let current = '';
    for (const line of lines) {
      const normalizedLine = normalizeNoteLineV2(line);
      if (isNoteHeadingLineV2(normalizedLine)) {
        if (current) blocks.push(current.trim());
        blocks.push(normalizedLine);
        current = '';
        continue;
      }
      if (/^[-•]\s+/.test(normalizedLine) || /\.{5,}|_{2,}/.test(normalizedLine)) {
        if (current) blocks.push(current.trim());
        blocks.push(normalizedLine);
        current = '';
        continue;
      }
      current = current ? `${current} ${normalizedLine}` : normalizedLine;
    }
    if (current) blocks.push(current.trim());
    return blocks.join('\n');
  }

  function normalizeNoteLineV2(line) {
    return String(line || '')
      .replace(/^(?:â€¢|•)\s*/, '- ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isNoteHeadingLineV2(line) {
    const text = String(line || '').trim();
    if (!text || text.length > 90) return false;
    if (/^[-•]\s+/.test(text)) return false;
    if (/\.{5,}|_{2,}|___\d+___/.test(text)) return false;
    if (/[.!?]$/.test(text)) return false;
    return /[A-Za-z]/.test(text);
  }

  function numberNoteCompletionGapsV2(text, start, end) {
    let nextNumber = start;
    const seen = new Set();
    const withExplicit = String(text || '').replace(/\b(\d{1,2})\s*\.{3,}/g, (match, explicitNum) => {
      const number = Number(explicitNum);
      if (number >= start && number <= end) {
        seen.add(number);
        return `___${number}___`;
      }
      return match;
    });

    return withExplicit.replace(/\.{5,}/g, () => {
      while (seen.has(nextNumber) && nextNumber <= end) nextNumber++;
      if (nextNumber > end) return '_____';
      seen.add(nextNumber);
      return `___${nextNumber++}___`;
    });
  }

  function extractNoteCompletionInstructionsV2(block) {
    return normalizeParserTextV2(block)
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .filter(line =>
        /^questions?\s+\d{1,2}\s*-\s*\d{1,2}/i.test(line) ||
        /^complete\s+the\s+notes?\s+below/i.test(line) ||
        /^choose\s+/i.test(line) ||
        /^write\s+/i.test(line)
      )
      .join(' ');
  }

  function extractSentenceCompletionGroupsV2(rawText) {
    const groups = [];
    for (const { start, end, block } of getQuestionBlocksV2(rawText)) {
      if (/complete\s+the\s+notes?\s+below/i.test(block)) continue;
      if (!/complete\s+the\s+sentences?\s+below/i.test(block) && !/_{2,}|\.{3,}/.test(block)) continue;
      const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
      const statements = lines.filter(line => /\.{3,}|_{2,}/.test(line));
      const expected = end - start + 1;
      if (statements.length === 0 && /complete\s+the\s+sentences?\s+below/i.test(block)) {
        const sequential = extractSequentialStatementsV2(block, start, end, {
          requireQuestionLike: false,
          skipPatterns: [
            /^complete\s+the\s+sentences?\s+below/i,
            /^write\s+no\s+more\s+than/i,
            /^write\s+your\s+answers?\b/i,
            /^choose\s+no\s+more\s+than/i
          ]
        });
        if (sequential.length !== expected) continue;
        groups.push({
          type: 'sentence_completion',
          questionRange: `${start}-${end}`,
          instructions: extractInstructionsV2(block, start),
          questions: sequential.map(q => ({
            number: q.number,
            statement: q.statement,
            answer: null
          }))
        });
        continue;
      }
      if (statements.length !== expected) continue;

      groups.push({
        type: 'sentence_completion',
        questionRange: `${start}-${end}`,
        instructions: lines.filter(line =>
          /^questions?\s+\d{1,2}\s*-\s*\d{1,2}/i.test(line) ||
          /^write\s+/i.test(line) ||
          /complete\s+the\s+sentences?\s+below/i.test(line)
        ).join(' '),
        questions: statements.map((statement, index) => {
          const number = start + index;
          return {
            number,
            statement: statement.replace(/\.{3,}|_{2,}/, `___${number}___`),
            answer: null
          };
        })
      });
    }
    return groups;
  }

  function extractInlineGapCompletionGroupsV2(rawText) {
    const groups = [];
    for (const { start, end, block } of getQuestionBlocksV2(rawText)) {
      if (/complete\s+the\s+notes?\s+below/i.test(block)) continue;
      if (!/complete\s+the\s+sentences?\s+below/i.test(block) || /correct\s+ending/i.test(block)) continue;
      const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
      const questions = [];
      for (let i = 0; i < lines.length; i++) {
        const numberMatch = lines[i].match(/^(\d{1,2})[\.)]?$/);
        if (!numberMatch) continue;
        const number = Number(numberMatch[1]);
        if (number < start || number > end) continue;
        const previous = findPreviousQuestionTextLineV2(lines, i);
        if (previous) questions.push({ number, statement: `${previous} ___${number}___`, answer: null });
      }
      if (questions.length !== end - start + 1) continue;
      groups.push({
        type: 'sentence_completion',
        questionRange: `${start}-${end}`,
        instructions: extractInstructionsV2(block, start),
        questions
      });
    }
    return groups;
  }

  function findPreviousQuestionTextLineV2(lines, index) {
    for (let i = index - 1; i >= 0; i--) {
      const line = String(lines[i] || '').trim();
      if (!line) continue;
      if (/^questions?\s+\d{1,2}\s*-\s*\d{1,2}/i.test(line)) return '';
      if (/^(complete|choose|write|use|look at|classify|list of headings)\b/i.test(line)) continue;
      if (/^\d{1,2}[\.)]?(?:\s+|$)/.test(line)) return '';
      return line;
    }
    return '';
  }

  function extractStandardMultipleChoiceGroupsV2(rawText) {
    const groups = [];
    for (const { start, end, block } of getQuestionBlocksV2(rawText)) {
      if (isGroupedMultipleChoiceBlockV2(block)) continue;
      if ((!/choose\s+the\s+correct\s+letter/i.test(block) && !/^[A-D][\.)]\s+/m.test(block)) || /correct\s+ending/i.test(block)) continue;
      const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
      const questions = [];
      for (let i = 0; i < lines.length; i++) {
        const questionMatch = lines[i].match(/^(\d{1,2})[\.)]?\s*(.*)$/);
        if (!questionMatch) continue;
        const number = Number(questionMatch[1]);
        if (number < start || number > end) continue;
        let stem = questionMatch[2].trim();
        if ((!stem || /^[A-Z][\.)]?\s*$/.test(stem)) && i + 1 < lines.length) {
          let cursor = i + 1;
          while (cursor < lines.length && /^[A-Z][\.)]?\s*$/.test(lines[cursor].trim())) {
            cursor++;
          }
          if (cursor < lines.length && !/^[A-Z][\.)]?\s+/.test(lines[cursor].trim())) {
            stem = lines[cursor].trim();
            i = cursor;
          }
        }
        const options = [];
        while (i + 1 < lines.length) {
          const next = lines[i + 1].trim();
          if (/^\d{1,2}[\.)]?(?:\s+|$)/.test(next) || /^questions?\s+\d{1,2}\s*-\s*\d{1,2}/i.test(next)) break;
          const packedOptions = extractPackedLetteredOptionsV2(next);
          if (packedOptions.length > 1) {
            options.push(...packedOptions);
            i++;
            continue;
          }
          const inlineOption = next.match(/^([A-Z])[\.)]?\s+(.+)$/);
          if (inlineOption) {
            options.push(inlineOption[2].trim());
            i++;
            continue;
          }
          const letterOnly = next.match(/^([A-Z])[\.)]?$/);
          if (letterOnly && i + 2 < lines.length) {
            options.push(lines[i + 2].trim());
            i += 2;
            continue;
          }
          i++;
        }
        if (stem && options.length >= 2) questions.push({ number, stem, options, answer: null });
      }
      if (questions.length !== end - start + 1) continue;
      groups.push({
        type: 'multiple_choice',
        questionRange: `${start}-${end}`,
        instructions: extractInstructionsV2(block, start),
        selectCount: 1,
        questions
      });
    }
    return groups;
  }

  function extractSingleMultipleChoiceGroupsV2(rawText) {
    const groups = [];
    const text = normalizeParserTextV2(rawText);
    const pattern = /\bQuestion\s+(\d{1,2})\b([\s\S]*?)(?=\n\s*Question\s+\d{1,2}\b|\n\s*Answers?\s*:|$)/gi;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const number = Number(match[1]);
      const block = match[2] || '';
      if (isGroupedMultipleChoiceBlockV2(block)) continue;
      if (!/choose\s+the\s+correct\s+letter/i.test(block) && !/^[A-D][\.)]\s+/m.test(block)) continue;

      const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
      const stem = lines.find(line =>
        !/^choose\s+the\s+correct\s+letter/i.test(line) &&
        !/^answers?\s*:/i.test(line) &&
        !/^[A-D][\.)]\s+/.test(line)
      ) || '';
      const options = lines
        .flatMap(line => extractPackedLetteredOptionsV2(line).length ? extractPackedLetteredOptionsV2(line) : (/^[A-D][\.)]\s+/.test(line) ? [line.replace(/^[A-D][\.)]\s+/, '').trim()] : []))
        .filter(Boolean);

      if (options.length < 2) continue;
      groups.push({
        type: 'multiple_choice',
        questionRange: `${number}-${number}`,
        instructions: extractInstructionsV2(`Question ${number}\n${block}`, number),
        selectCount: 1,
        questions: [{
          number,
          stem: normalizeQuestionTextV2(stem),
          options,
          answer: null
        }]
      });
    }

    return groups;
  }

  function extractMultipleChoiceGroupsV2(rawText) {
    const groups = [];
    for (const { start, end, block } of getQuestionBlocksV2(rawText)) {
      const selectMatch = block.match(/choose?s?\s+(two|three|four|\d+)\s+correct\s+answers?/i);
      const selectLettersMatch = block.match(/choose\s+(two|three|four|\d+)\s+correct\s+letters?/i);
      const selectAmongMatch = block.match(/choose\s+(two|three|four|\d+)\s+correct\s+letters?\s+among\s+[A-Z]\s*-\s*[A-Z]/i);
      const selectPlainLettersMatch = block.match(/choose\s+(two|three|four|\d+)\s+letters?\s*,?\s+[A-Z]\s*-\s*[A-Z]/i);
      const selectSource = selectMatch || selectLettersMatch || selectAmongMatch || selectPlainLettersMatch;
      if (!selectSource) continue;

      const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
      const firstOptionIndex = lines.findIndex(line => /^[A-Z][\.)]?\s+/.test(line));
      if (firstOptionIndex === -1) continue;

      const explicitStemIndex = lines.findIndex(line => new RegExp(`^${start}\\s*-\\s*${end}\\b`).test(line));
      const stemIndex = explicitStemIndex !== -1
        ? explicitStemIndex
        : findGroupedMultipleChoiceStemIndexV2(lines, firstOptionIndex);
      if (stemIndex === -1) continue;

      const selectCount = wordNumberToNumberV2(selectSource[1]);
      const stem = normalizeQuestionTextV2(lines[stemIndex].replace(new RegExp(`^${start}\\s*-\\s*${end}[\\.)]?\\s*`), '').trim());
      const options = lines.slice(firstOptionIndex)
        .filter(line => !/^questions?\s+\d{1,2}\s*-\s*\d{1,2}/i.test(line))
        .flatMap(line => extractPackedLetteredOptionsV2(line).length ? extractPackedLetteredOptionsV2(line) : (/^[A-Z][\.)]?\s+/.test(line) ? [line.replace(/^[A-Z][\.)]?\s+/, '').trim()] : []))
        .filter(Boolean);

      if (options.length < selectCount) continue;
      groups.push({
        type: 'multiple_choice',
        questionRange: `${start}-${end}`,
        instructions: extractGroupedMultipleChoiceInstructionsV2(lines, stemIndex),
        selectCount,
        questions: [{
          number: `${start}-${end}`,
          numbers: `${start}-${end}`,
          stem,
          options,
          answer: null
        }]
      });
    }
    return groups;
  }

  function extractGroupedMultipleChoiceInstructionsV2(lines, stemIndex) {
    return lines
      .slice(0, stemIndex)
      .filter(line => {
        if (/^questions?\s+\d{1,2}\s*-\s*\d{1,2}/i.test(line)) return false;
        if (/^choose\s+(two|three|four|\d+)\s+(?:correct\s+)?(?:answers?|letters?)/i.test(line)) return true;
        if (/^write\s+your\s+answers?\b/i.test(line)) return true;
        if (/^write\s+the\s+correct\s+letters?\b/i.test(line)) return true;
        return false;
      })
      .join(' ')
      .trim();
  }

  function findGroupedMultipleChoiceStemIndexV2(lines, firstOptionIndex) {
    for (let i = firstOptionIndex - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line) continue;
      if (/^write\s+your\s+answers?\b/i.test(line)) continue;
      if (/^choose\s+(two|three|four|\d+)\s+(?:correct\s+)?(answers?|letters?)/i.test(line)) continue;
      if (/^questions?\s+\d{1,2}\s*-\s*\d{1,2}/i.test(line)) continue;
      return i;
    }
    return -1;
  }

  function isGroupedMultipleChoiceBlockV2(block) {
    return /choose\s+(two|three|four|\d+)\s+(?:correct\s+)?(?:answers?|letters?)(?:\s+among\s+[A-Z]\s*-\s*[A-Z]|\s*,?\s+[A-Z]\s*-\s*[A-Z])?/i.test(String(block || ''));
  }

  function getQuestionBlocksV2(rawText) {
    const text = normalizeParserTextV2(rawText);
    const blocks = [];
    const pattern = /questions?\s+(\d{1,2})\s*-\s*(\d{1,2})([\s\S]*?)(?=\n\s*questions?\s+\d{1,2}\s*-\s*\d{1,2}\b|$)/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const start = Number(match[1]);
      const end = Number(match[2]);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        blocks.push({ start, end, block: match[3] || '' });
      }
    }
    const singlePattern = /\bquestion\s+(\d{1,2})\b(?!\s*[-\u2013]\s*\d)([\s\S]*?)(?=\n\s*questions?\s+\d{1,2}\s*-\s*\d{1,2}\b|\n\s*question\s+\d{1,2}\b|\n\s*answers?\s*:|$)/gi;
    while ((match = singlePattern.exec(text)) !== null) {
      const start = Number(match[1]);
      const duplicate = blocks.some(block => start >= block.start && start <= block.end);
      if (Number.isFinite(start) && !duplicate) {
        blocks.push({ start, end: start, block: match[2] || '' });
      }
    }

    if (blocks.length > 0) {
      return blocks.sort((a, b) => a.start - b.start || a.end - b.end);
    }

    const boxesPattern = /boxes?\s+(\d{1,2})\s*-\s*(\d{1,2})([\s\S]*?)(?=\n(?:choose|complete|write|use|look|classify|reading passage|questions?)\b[\s\S]{0,240}?boxes?\s+\d{1,2}\s*-\s*\d{1,2}\b|$)/gi;
    while ((match = boxesPattern.exec(text)) !== null) {
      const start = Number(match[1]);
      const end = Number(match[2]);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        const context = collectInstructionContextBeforeRangeV2(text, match.index, start, end);
        blocks.push({ start, end, block: `${context}${match[3] || ''}` });
      }
    }
    return blocks;
  }

  function collectInstructionContextBeforeRangeV2(text, matchIndex, start, end) {
    const before = text.slice(0, matchIndex);
    const lines = before.split('\n');
    const collected = [];
    const instructionPattern = /^(?:reading passage|choose|complete|write|use|look at|classify|list of headings)\b/i;
    const currentLinePrefix = lines[lines.length - 1]?.trim() || '';

    if (instructionPattern.test(currentLinePrefix)) {
      collected.unshift(`${currentLinePrefix} boxes ${start}-${end}`);
      lines.pop();
    }

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) {
        if (collected.length > 0) break;
        continue;
      }
      if (!instructionPattern.test(line)) break;
      collected.unshift(line);
      if (collected.length >= 4) break;
    }

    return collected.length ? `${collected.join('\n')}\n` : '';
  }

  function normalizeParserTextV2(rawText) {
    return String(rawText || '')
      .replace(/\r\n/g, '\n')
      .replace(/(?:â€¦|…)/g, '...')
      .replace(/â€“|â€”|–|—/g, '-')
      .replace(/ï»¿/g, '')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"');
  }

  function normalizeQuestionTextV2(text) {
    return String(text || '')
      .replace(/^\d{1,2}[\.)]?\s+/, '')
      .replace(/^\d{1,2}(?:\s+|$)/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function isMatchingInformationBlockV2(block) {
    const text = block.toLowerCase();
    return (
      /which\s+(paragraph|section)\s+contains/.test(text) ||
      /(reading\s+passage|text)\s+(?:has|contains)\s+\w+\s+(?:paragraphs|sections)/.test(text)
    ) && !/list\s+of\s+headings|choose\s+the\s+correct\s+heading/.test(text);
  }

  function isMatchingFeaturesBlockV2(block) {
    const text = block.toLowerCase();
    return (
      /classify\s+the\s+following/.test(text) ||
      /look\s+at\s+the\s+following\s+(issues|statements|people|researchers|features|countries)/.test(text) ||
      /look\s+at\s+questions?\s+\d{1,2}\s*-\s*\d{1,2}\s+and\s+the\s+list\s+of\s+\w+\s+below/.test(text) ||
      /list\s+of\s+(people|organisations|organizations|researchers|scientists|features|theories|countries|persons|places|dates|years)/.test(text) ||
      /match\s+each\s+(issue|statement|person|feature|event|date|year)\s+with\s+(a|the\s+correct)\s+/.test(text) ||
      /match\s+each\s+\w+\s+with\s+the\s+correct\s+(date|year|person|place|country|category|group)\b/.test(text) ||
      /match\s+the\s+categor(?:y|ies)\b/.test(text) ||
      /match\s+the\s+(people|persons|researchers|scientists|authors|writers|experts|individuals)\s*\(\s*listed\s+[a-z]\s*-\s*[a-z]\s*\)/.test(text) ||
      /(people|persons|researchers|scientists|authors|writers|experts|individuals)\s*\(\s*listed\s+[a-z]\s*-\s*[a-z]\s*\)\s+with\s+(opinions?|deeds?|statements?|features?)/.test(text) ||
      /listed\s+[a-z]\s*-\s*[a-z]\s+with\s+(opinions?|deeds?|statements?|features?)/.test(text)
    ) && !/which\s+(paragraph|section)\s+contains/.test(text);
  }

  function extractParagraphOptionsV2(block) {
    const rangeMatch = block.match(/\b([A-Z])\s*-\s*([A-Z])\b/);
    const start = rangeMatch ? rangeMatch[1].charCodeAt(0) : 65;
    const end = rangeMatch ? rangeMatch[2].charCodeAt(0) : 72;
    const options = [];
    for (let code = start; code <= end; code++) options.push(String.fromCharCode(code));
    return options;
  }

  function extractNumberedStatementsV2(block, start, end) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const questions = [];
    for (let i = 0; i < lines.length; i++) {
      const lineMatch = lines[i].match(/^(\d{1,2})[\.)]?\s+(.+)$/);
      const standaloneMatch = lines[i].match(/^(\d{1,2})[\.)]?$/);
      if (standaloneMatch) {
        const number = Number(standaloneMatch[1]);
        if (number < start || number > end) continue;
        const statementParts = [];
        while (
          i + 1 < lines.length &&
          !/^\d{1,2}[\.)]?(?:\s+|$)/.test(lines[i + 1]) &&
          !/^questions?\s+\d{1,2}\s*-\s*\d{1,2}/i.test(lines[i + 1]) &&
          !/^list\s+of\b/i.test(lines[i + 1])
        ) {
          i++;
          statementParts.push(lines[i].trim());
        }
        const statement = statementParts.join(' ').trim();
        if (statement) questions.push({ number, statement });
        continue;
      }
      if (!lineMatch) continue;
      const number = Number(lineMatch[1]);
      if (number < start || number > end) continue;
      let statement = lineMatch[2].trim();
      while (
        i + 1 < lines.length &&
        !/^\d{1,2}[\.)]?(?:\s+|$)/.test(lines[i + 1]) &&
        !/^questions?\s+\d{1,2}\s*-\s*\d{1,2}/i.test(lines[i + 1]) &&
        !/^list\s+of\b/i.test(lines[i + 1])
      ) {
        i++;
        statement += ' ' + lines[i].trim();
      }
      questions.push({ number, statement });
    }
    return questions;
  }

  function extractSequentialStatementsV2(block, start, end, options = {}) {
    const expected = end - start + 1;
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const candidates = [];
    const skipPatterns = [
      /^questions?\s+\d{1,2}\s*-\s*\d{1,2}/i,
      ...(options.skipPatterns || [])
    ];

    for (const line of lines) {
      if (skipPatterns.some(pattern => pattern.test(line))) continue;
      if (/^\d{1,2}[\.)]?(?:\s+|$)/.test(line)) continue;
      if (/^list\s+of\b/i.test(line)) continue;
      if (options.requireQuestionLike && !/[?？]\s*\.?$/.test(line)) continue;
      candidates.push(line.replace(/\s+\.$/, '.').trim());
    }

    if (candidates.length < expected) return [];
    return candidates.slice(0, expected).map((statement, index) => ({
      number: start + index,
      statement
    }));
  }

  function extractLetteredListOptionsV2(block) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const listIndex = lines.findIndex(line => /^list\s+of\b/i.test(line));
    if (listIndex === -1) return [];
    const options = [];
    for (let i = listIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^questions?\s+\d{1,2}\s*-\s*\d{1,2}/i.test(line)) break;
      const match = line.match(/^([A-Z])[\.)]?\s+(.+)$/);
      if (match) {
        options.push(match[2].trim());
        continue;
      }

      const standaloneLabel = line.match(/^([A-Z])[\.)]?$/);
      if (!standaloneLabel) continue;

      let cursor = i + 1;
      while (cursor < lines.length && !lines[cursor].trim()) cursor++;
      if (cursor >= lines.length) break;
      const value = lines[cursor].trim();
      if (/^questions?\s+\d{1,2}\s*-\s*\d{1,2}/i.test(value)) break;
      if (/^\d{1,2}[\.)]?(?:\s+|$)/.test(value)) break;
      if (/^list\s+of\b/i.test(value)) break;
      if (/^[A-Z][\.)]?$/.test(value)) continue;
      options.push(value);
      i = cursor;
    }
    return options;
  }

  function extractLetteredOptionsV2(block, firstQuestionNumber) {
    const listed = extractLetteredListOptionsV2(block);
    if (listed.length) return listed;

    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const options = [];
    const laterOptions = [];
    for (const line of lines) {
      if (new RegExp(`^${firstQuestionNumber}(?:[\\.)]?\\s+|[\\.)]?$)`).test(line)) break;
      const match = line.match(/^([A-Z])[\.)]?\s+(.+)$/);
      if (match) options.push(match[2].trim());
    }
    if (options.length) return options;

    for (const line of lines) {
      const match = line.match(/^([A-Z])[\.)]?\s+(.+)$/);
      if (match) laterOptions.push(match[2].trim());
    }
    return laterOptions;
  }

  function extractWordBankOptionsV2(block) {
    const lines = normalizeParserTextV2(block).split('\n').map(line => line.trim()).filter(Boolean);
    const options = [];
    const listIndex = lines.findIndex(line => /list\s+of\s+words|words\s+and\s+phrases/i.test(line));
    const startIndex = listIndex === -1 ? 0 : listIndex + 1;

    for (const line of lines.slice(startIndex)) {
      if (/^questions?\s+\d{1,2}\s*-\s*\d{1,2}/i.test(line)) break;
      if (/^\d{1,2}[\.)]?\s+/.test(line) || /\.{5,}|___\d+___/.test(line)) continue;
      const lineOptions = extractPackedLetteredOptionsV2(line);
      if (lineOptions.length) options.push(...lineOptions);
    }

    return options.map(stripWordBankLabelV2).filter(Boolean);
  }

  function extractPackedLetteredOptionsV2(line) {
    const text = String(line || '').replace(/\s+/g, ' ').trim();
    if (!text) return [];
    const matches = [];
    const pattern = /(?:^|\s{2,}|\s(?=[A-Z][\.)]\s))([A-Z])[\.)]?\s+(.+?)(?=\s{2,}[A-Z][\.)]?\s+|\s[A-Z][\.)]\s+|$)/g;
    let match;
    while ((match = pattern.exec(String(line || ''))) !== null) {
      const value = String(match[2] || '').trim();
      if (value) matches.push(value);
    }
    if (matches.length) return matches;

    const single = text.match(/^([A-Z])[\.)]?\s+(.+)$/);
    return single ? [single[2].trim()] : [];
  }

  function extractInstructionsV2(block, firstQuestionNumber) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const instructions = [];
    for (const line of lines) {
      if (new RegExp(`^${firstQuestionNumber}(?:[\\.)]?\\s+|[\\.)]?$)`).test(line)) break;
      instructions.push(line);
    }
    return instructions.join(' ');
  }

  function extractPassageFallbackV2(rawText) {
    const text = normalizeParserTextV2(rawText);
    const questionIndex = text.search(/\n\s*questions?\s+\d{1,2}\s*-\s*\d{1,2}/i);
    const passageText = (questionIndex >= 0 ? text.slice(0, questionIndex) : text).trim();
    const lines = passageText.split('\n').map(line => line.trim()).filter(Boolean);
    const sections = [];
    let current = null;
    for (const line of lines.slice(1)) {
      const standaloneLabel = line.match(/^([A-Z])$/);
      if (standaloneLabel) {
        current = { heading: standaloneLabel[1], paragraphs: [], questionMarker: null };
        sections.push(current);
        continue;
      }
      const paragraphLabel = line.match(/^([A-Z])[\.)]\s+(.+)$/);
      if (paragraphLabel) {
        current = { heading: paragraphLabel[1], paragraphs: [paragraphLabel[2]], questionMarker: null };
        sections.push(current);
      } else if (current) {
        current.paragraphs.push(line);
      } else {
        sections.push({ heading: null, paragraphs: [line], questionMarker: null });
      }
    }
    return {
      title: lines[0] || 'IELTS Reading Passage',
      sections: sections.length ? sections : [{ heading: null, paragraphs: [passageText], questionMarker: null }]
    };
  }

  function findLikelyPartV2(parts, group) {
    return parts.find(part => rangesOverlapV2(part.questionRange, group.questionRange)) || parts[0];
  }

  function rangesOverlapV2(a, b) {
    const rangeA = parseRangeV2(a);
    const rangeB = parseRangeV2(b);
    if (!rangeA || !rangeB) return false;
    return rangeA.start <= rangeB.end && rangeB.start <= rangeA.end;
  }

  function parseRangeV2(range) {
    const match = normalizeParserTextV2(range).match(/(\d+)\s*-\s*(\d+)/);
    if (!match) return null;
    return { start: Number(match[1]), end: Number(match[2]) };
  }

  function countRangeSlotsV2(range) {
    const parsed = parseRangeV2(range);
    if (!parsed || parsed.end < parsed.start) return 1;
    return parsed.end - parsed.start + 1;
  }

  function countQuestionSlotsV2(questions) {
    return questions.reduce((total, q) => total + countRangeSlotsV2(q.numbers || q.number), 0);
  }

  function combineQuestionRangeV2(groups) {
    const ranges = groups.map(group => parseRangeV2(group.questionRange)).filter(Boolean);
    if (!ranges.length) return null;
    return `${Math.min(...ranges.map(range => range.start))}-${Math.max(...ranges.map(range => range.end))}`;
  }

  function wordNumberToNumberV2(value) {
    const words = { two: 2, three: 3, four: 4 };
    const normalized = String(value || '').toLowerCase();
    return words[normalized] || Number(normalized) || 1;
  }

  return { parse, reviewParse, getSystemPrompt: () => SYSTEM_PROMPT };
})();
