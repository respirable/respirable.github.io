/*
 * Olympia Controller - score summary panel (key M), shown between rounds.
 *
 * One panel, one contestant at a time, lowest score first:
 *   M   (hidden)      snapshot the scores, order them, show the lowest - panel zooms in, music starts
 *   M   (showing)     next contestant up - name and score replaced instantly
 *   M   (at the top)  panel disappears instantly; the music plays out (it is short)
 *
 * Refused while any round graphics are on screen (question bar, contestant bars...).
 * Order: ascending score; equal scores -> lower seat first. Fixed when the panel opens.
 * State is SummaryState (published to the control panel).
 */

function scoreSummaryOrder() {
	return window.GameVariables.Players.slice()
		.sort(function (a, b) { return (a.score - b.score) || (a.seat - b.seat); })
		.map(function (p) { return p.seat; });
}

function renderScoreSummary(seat) {
	var p = window.GameVariables.getPlayer(seat);
	window.GameVariables.SummaryState.entry = p ? { seat: p.seat, name: window.GameVariables.displayName(p), score: p.score } : null;
	if (!p) { return; }
	var name = document.querySelector('.summaryDiv .summaryNameP');
	var score = document.querySelector('.summaryDiv .summaryScoreP');
	if (name) { name.textContent = window.GameVariables.displayName(p); }
	if (score) { score.textContent = String(p.score); }
}

/* Anything of a round still on screen? (shared with the F6 board) */
function areRoundGraphicsOnScreen() {
	var vcnvOver = window.GameVariables.VcnvSequenceCounter >= 11;      /* finished / done */
	var ttOver = window.GameVariables.TangTocSequenceCounter >= 7;      /* finished / done */
	var vdOver = window.GameVariables.VeDichSequenceCounter >= 11;      /* finished / done */
	if (isTangTocFrameShowing() && !ttOver) { return true; }
	if (isVeDichShowing() && !vdOver) { return true; }
	return isTitleCardShowing() ||
	       isQuestionBarShowing() ||
	       isAnyContestantBarShown() ||
	       (isObstacleBoardShowing() && !vcnvOver) ||
	       isAnswerTreeShowing();
}

function isScoreSummaryShowing() { return !!window.GameVariables.SummaryState.showing; }

/* The M key. */
function stepScoreSummary() {
	var S = window.GameVariables.SummaryState;
	if (!S.showing) {
		if (areRoundGraphicsOnScreen()) {
			console.warn('[Summary] blocked - hide the round graphics (question bar / bars) first');
			return;
		}
		/* a solved / fully revealed VCNV board may still be up: take it down first */
		if (isObstacleBoardShowing() && window.GameVariables.VcnvSequenceCounter == 11) { vcnvFinishRound(); }
		S.order = scoreSummaryOrder();
		if (!S.order.length) { return; }
		S.index = 0;
		S.showing = true;
		renderScoreSummary(S.order[0]);
		var root = document.querySelector('.summaryDiv');
		if (root) { root.classList.remove('offstage'); }   /* zoom entrance (CSS transition) */
		startLifelinePassiveSound('score_summary.oga');    /* own channel: neither buzzer nor result sting can cut it */
		console.log('[Summary] open, order ' + S.order.join(' > '));
	}
	else if (S.index < S.order.length - 1) {
		S.index += 1;
		renderScoreSummary(S.order[S.index]);   /* instant swap */
	}
	else {
		hideScoreSummary();
	}
	window.GameVariables.changed();
}

/* Instant hide; also used when the round changes. The music is NOT stopped. */
function hideScoreSummary() {
	var root = document.querySelector('.summaryDiv');
	if (root) {
		root.classList.add('noTransition');
		root.classList.add('offstage');
		void root.offsetWidth;
		root.classList.remove('noTransition');
	}
	var S = window.GameVariables.SummaryState;
	S.showing = false;
	S.index = -1;
	S.order = [];
	S.entry = null;
	window.GameVariables.changed();
}
