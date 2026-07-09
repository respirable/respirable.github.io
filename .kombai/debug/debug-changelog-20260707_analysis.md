# Debug Issues Identified

## Issue #1: T/F/NG Type Switching - Questions Lost
**Root Cause:** The function `creatorUpdateTFNGStatement` is called at line 1249 in the HTML but **does not exist in the codebase**. When user tries to edit a statement, the call fails silently, making it appear questions are lost when switching types.

**Location:** Line 1249 - HTML calls `creatorUpdateTFNGStatement(${index},${qi},this.value)` but no such function exists

**Fix:** Create the missing function `creatorUpdateTFNGStatement` to update question statements

## Issue #2: Sentence Completion Gap Typing - Can't Type Outside Gap
**Root Cause:** Gaps are now `contenteditable="true"` but the span itself is constrained. When user tries to type outside the gap, the text flow is broken because gaps are inline-block or have fixed dimensions.

**Location:** Lines 1321, 1345, 1353, 1367 - gaps have `contenteditable="true"` but may need better integration with surrounding text flow

**Fix:** Ensure gaps integrate naturally with text flow, or implement custom input handling for gap content

## Issue #3: Matching Endings - Options Reset on Answer Selection
**Root Cause:** In `creatorSetMatchingEndingAnswer` (line 2205), the function calls `renderCreatorPanel()` which re-renders the entire matching_endings section. The rendering code at line 1670 recreates the options array by stripping prefixes from `group.options`, then re-renders all the HTML. This causes the options list to appear "reset" from the user's perspective.

**Location:** Line 2205-2213 - `creatorSetMatchingEndingAnswer` calls `renderCreatorPanel()` which re-renders and potentially resets visual state

**Fix:** When updating answers, don't call full `renderCreatorPanel()` - instead just update the answer in the UI without re-rendering the options section
