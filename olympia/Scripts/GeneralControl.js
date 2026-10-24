/*
 * Olympia Controller - things that concern the whole show rather than one round
 * (Olga keeps playLightsDownSound(), playBackgroundSound()... in its GeneralControl.js).
 *
 *   switchRound(roundId)   F1..F5, and Left at the end of a round: tidy up the round being
 *                          left, then enter the new one
 *   pressKey(key)          the same as pressing a key on this page (handy in the browser console)
 */

/* Green screen: whether background.png shows depends on the round, the answer tree and the ','
 * key (refreshStageBackground in StageControl.js). changed() already runs after every key, every
 * control-panel command and every timer end, so it is wrapped here once instead of calling the
 * refresh from every step function. (changed() itself is defined in StateSync.js.) */
(function () {
	var publish = window.GameVariables.changed;
	window.GameVariables.changed = function () {
		refreshStageBackground();
		publish();
	};
})();

function switchRound(roundId) {
	if (!roundId || window.GameVariables.CurrentRound === roundId) { return; }
	leaveRound(window.GameVariables.CurrentRound);
	window.GameVariables.CurrentRound = roundId;
	clearBuzzers();
	if (isScoreSummaryShowing()) { hideScoreSummary(); }
	enterRound(roundId);
	console.log('[Round] ->', roundId);
	window.GameVariables.changed();
}

/* The round's graphics come down; its counter is kept, so F-keying back resumes where it was. */
function leaveRound(roundId) {
	if (roundId == 'kd') {
		hideThinkClock();
		stopLongPassiveSound();
		showRoundGraphics();
	}
	else if (roundId == 'vcnv') {
		vcnvStopTimer();
		hideAnswerTree();
		hideTitleCard();
		hideObstacleBoard();
		showRoundGraphics();
	}
	else if (roundId == 'tt') {
		tangTocStopTimer();
		hideAnswerTree();
		hideTitleCard();
		hideTangTocFrame();
		showRoundGraphics();
	}
	else if (roundId == 'vd') {
		veDichStopTimer();
		hideTitleCard();
		hideVeDich();
		setContestantOnStage(null);
	}
	else if (roundId == 'tb') {
		tieBreakLeave();
	}
}

/* Jumping into a round that has not started is the same as its first Left: title card + sting.
 * (Khởi động and the Câu hỏi phụ wait for the first Left.) */
function enterRound(roundId) {
	if (roundId == 'vcnv') {
		if (window.GameVariables.VcnvSequenceCounter == 0) { vcnvShowTitle(); }
	}
	else if (roundId == 'tt') {
		if (window.GameVariables.TangTocSequenceCounter == 0) { tangTocShowTitle(); }
	}
	else if (roundId == 'vd') {
		if (window.GameVariables.VeDichSequenceCounter == 0) { veDichShowTitle(); }
	}
	else if (roundId == 'tb') {
		tieBreakEnter();   /* no title card: the first Left picks the seats */
	}
}

function pressKey(key) { return window.GameVariables.Keyboard.dispatch(key); }
