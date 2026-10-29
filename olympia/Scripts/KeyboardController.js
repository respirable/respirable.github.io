/*
 * Olympia Controller - EVERY key of the show, in one place (same idea as Olga's KeyboardController).
 * DO NOT HOLD KEYS DOWN - single, firm presses (e.repeat is ignored).
 *
 *   Key            Round use                                   Global use
 *   ------------   -----------------------------------------   --------------------------------
 *   Left / Right   the step keys of every round                -
 *   Up / Down      right / wrong                               -
 *   Space          Khởi động 3 s clock                         -
 *   1 2 3 4        buzz / row / seat right / steal             buzz-flag toggle (outside a round)
 *   5  U           VCNV centre question / unselect; VĐ unpick  -
 *   Q W E R        VCNV: seat 1-4 signals for the obstacle     -
 *   0              VCNV: everyone who signalled was wrong      show / hide the contestant bars
 *   2 3 S          Về đích: pick 20 / 30, place the star       -
 *   B              Tăng tốc: review the question frame         -
 *   Backspace      KĐ: clear the buzz; VCNV: drop last signal  -
 *   M              -                                           score summary: open / next / close
 *   F6             -                                           "current results" board on / off
 *   .              -                                           the "ô trống" filler sting
 *   ,              -                                           green screen only - KĐ / VCNV / Tăng tốc / phụ: hide / show the round graphics
 *   Z / X          -                                           +10 / -5 on the active seat (fallback)
 *   F1..F5         -                                           switch round: KĐ, VCNV, TT, VĐ, phụ
 *
 * A key is first offered to the round being played (handleRoundKey). If that round has no use for
 * the key, it goes to the global keys (handleGlobalKey).
 *
 * The step numbers used below are the round's SEQUENCE COUNTER - see the tables in Variables.js:
 *   KĐ    0 idle 1 title 2 ready 3 set 4 question 5 done 6 finished
 *   VCNV  0 idle 1 title 2 board 3 rowSelected 4 rowQuestion 5 rowTimer 6 rowAnswers 7 rowGraded
 *         8 rowBack 9 guessing 10 finalWindow 11 finished 12 done
 *   TT    0 idle 1 title 2 question 3 timer 4 answers 5 graded 6 blank 7 finished 8 done
 *   VĐ    0 idle 1 title 2 stageCall 3 choose 4 ready 5 question 6 timer 7 steal 8 stealAnswer
 *         9 answered 10 blank 11 finished 12 done
 *   phụ   0 idle 1 ready 2 set 3 question 4 timer 5 closed 6 finished
 */

var ROUND_BY_F_KEY = { F1: 'kd', F2: 'vcnv', F3: 'tt', F4: 'vd', F5: 'tb' };
var SEAT_BY_SIGNAL_KEY = { q: 1, w: 2, e: 3, r: 4 };

/* keys whose browser default must be suppressed on both pages */
var SWALLOWED_KEYS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backspace'];

/* Returns true when the round used the key ("swallowed" = used, even if nothing happened). */
function handleRoundKey(key, round) {
	var lower = key.length === 1 ? key.toLowerCase() : key;
	var kd = window.GameVariables.KhoiDongSequenceCounter;
	var vcnv = window.GameVariables.VcnvSequenceCounter;
	var tt = window.GameVariables.TangTocSequenceCounter;
	var vd = window.GameVariables.VeDichSequenceCounter;
	var tb = window.GameVariables.TieBreakSequenceCounter;
	var common = window.GameVariables.KhoiDongMode == 'common';

	if (key == 'ArrowLeft') // key 'left arrow' for starting a round and stepping between contestants / screens
	{
		if (round == 'kd') {
			if (window.GameVariables.Rules === 'o23') {                     /* Olympia 23: three common turns */
				if (kd == 0) { khoiDongShowTitle(); }
				else if (kd == 1) { khoiDongO23Ready(1); }
				else if (kd == 2) { khoiDongCommonOpenQuestionBar(); }
				else if (kd == 5) { khoiDongO23Ready((window.GameVariables.KhoiDongTurn || 0) + 1); }
				else if (kd == 6) { switchRound('vcnv'); }
			}
			else if (common) {
				if (kd == 0) { khoiDongCommonReady(); }
				else if (kd == 2) { khoiDongCommonOpenQuestionBar(); }
				else if (kd == 6) { switchRound('vcnv'); }                 /* on to Vượt chướng ngại vật */
			}
			else if (kd == 0) { khoiDongShowTitle(); }
			else if (kd == 1 || kd == 5) { khoiDongCallNextContestant(); }
			else if (kd == 2) { khoiDongOpenQuestionBar(); }
			else if (kd == 6) { khoiDongEnterCommon(); }
			return true;
		}
		else if (round == 'vcnv') {
			if (vcnv == 0) { vcnvShowTitle(); }
			else if (vcnv == 1) { vcnvShowBoard(); }
			else if (vcnv == 11) { vcnvFinishRound(); }
			else if (vcnv == 12) { switchRound('tt'); }                     /* on to Tăng tốc */
			return true;
		}
		else if (round == 'tt') {
			if (tt == 0) { tangTocShowTitle(); }
			else if (tt == 1) { tangTocShowFirstQuestion(); }
			else if (tt == 7) { tangTocFinishRound(); }
			else if (tt == 8) { switchRound('vd'); }                        /* on to Về đích */
			return true;
		}
		else if (round == 'vd') {
			if (vd == 0) { veDichShowTitle(); }
			else if (vd == 1) { veDichFirstTurn(); }
			else if (vd == 2) { veDichOpenChooseScreen(); }
			else if (vd == 3) { if (window.GameVariables.VeDichValues.length == VE_DICH_PICKS) { veDichPrepareFirstQuestion(); } }
			else if (vd == 10) { veDichNextTurn(); }
			else if (vd == 11) { veDichFinishRound(); }
			return true;
		}
		else if (round == 'tb') {
			if (tb == 0) { tieBreakReady(); }
			else if (tb == 1) { tieBreakOpenQuestionBar(); }
			else if (tb == 5) { tieBreakFinish(); }                         /* somebody won, or no question left */
			return true;
		}
	}
	else if (key == 'ArrowRight') // key 'right arrow' for the next step of the question
	{
		if (round == 'kd') {
			if (kd == 3) {
				/* question 1 - or, after an emergency recovery (Recovery.js), the question to resume at */
				var first = window.GameVariables.KhoiDongStartIndex || 1;
				window.GameVariables.KhoiDongStartIndex = null;
				khoiDongShowQuestion(first);
				if (first > 1) { startLongPassiveSound('kd_60s.mp3'); }   /* khoiDongShowQuestion starts the bed on question 1 only */
			}
			else if (kd == 4) { khoiDongNextQuestion(); }
			return true;
		}
		else if (round == 'vcnv') {
			if (vcnv == 9) { vcnvDropTree(); }   /* someone signalled mid-tree: back to the main CNV graphics, still guessing */
				else if (vcnvIsRowStep() && vcnvAllEliminated()) { vcnvRevealEverything(); }   /* nobody left to play */
			else if (vcnv == 2 && vcnvFinalWindowAvailable()) { vcnvStartFinalWindow(); }
			else if (vcnv == 10) { if (window.GameVariables.IsVcnvFinalWindowExpired) { vcnvRevealEverything(); } }   /* Right early does nothing */
			else if (vcnv == 3) { vcnvRevealQuestion(); }
			else if (vcnv == 4) { vcnvStartTimer(); }
			else if (vcnv == 5) { vcnvRevealAnswers(); }
			else if (vcnv == 6) { vcnvGradeRow(); }
			else if (vcnv == 7) { vcnvBackToBoard(); }
			else if (vcnv == 8) { vcnvFinishRow(); }
			return true;
		}
		else if (round == 'tt') {
			if (window.GameVariables.IsTangTocReviewing) { return true; }     /* come back to the tree (B) before moving on */
			if (tt == 2) { tangTocStartTimer(); }
			else if (tt == 3) { tangTocRevealAnswers(); }
			else if (tt == 4) { tangTocGradeQuestion(); }
			else if (tt == 5) { tangTocClearTree(); }
			else if (tt == 6) { tangTocNextQuestion(); }
			return true;
		}
		else if (round == 'vd') {
			if (vd == 4) { veDichRevealQuestion(); }
			else if (vd == 5) { veDichStartTimer(); }
			else if (vd == 7) { if (window.GameVariables.VeDichStealSeat === null) { veDichCloseQuestion(); } }
			else if (vd == 9) { veDichCloseQuestion(); }
			return true;
		}
		else if (round == 'tb') {
			if (tb == 2) { tieBreakNextQuestion(); }
			else if (tb == 3) { tieBreakStartTimer(); }
			else if (tb == 5 && window.GameVariables.TieBreakWinner === null) { tieBreakNextQuestion(); }   /* nobody right: another question */
			return true;
		}
	}
	else if (key == 'ArrowUp') // key 'up arrow' for a right answer
	{
		if (round == 'kd') {
			if (kd == 4) { if (common) { khoiDongJudgeCommonCorrect(); } else { khoiDongJudgeIndividualCorrect(); } }
			return true;
		}
		else if (round == 'vd') {
			if (vd == 6) { veDichAnswerCorrect(); }
			else if (vd == 8) { veDichStealCorrect(); }
			return true;
		}
		else if (round == 'tb') { tieBreakJudgeCorrect(); return true; }       /* checks the step and the early buzz itself */
		else if (round == 'vcnv' || round == 'tt') { return true; }            /* not used in these rounds */
	}
	else if (key == 'ArrowDown') // key 'down arrow' for a wrong answer / time up
	{
		if (round == 'kd') {
			if (kd == 4) { if (common) { khoiDongJudgeCommonWrong(); } else { khoiDongJudgeIndividualWrong(); } }
			return true;
		}
		else if (round == 'vd') {
			if (vd == 6) { veDichAnswerWrong(); }
			else if (vd == 8) { veDichStealWrong(); }
			return true;
		}
		else if (round == 'tb') { tieBreakJudgeWrong(); return true; }
		else if (round == 'vcnv' || round == 'tt') { return true; }            /* not used in these rounds */
	}
	else if (key == ' ') // key 'space' for the Khởi động 3 s think clock
	{
		if (round == 'kd') {
			if (kd == 4) { startThinkClock(window.GameVariables.Timings.KD_THINK); }
			return true;
		}
		else if (round == 'vcnv' || round == 'tt' || round == 'vd' || round == 'tb') { return true; }   /* not used in these rounds */
	}
	else if (key == 'Backspace') // key 'backspace' for clearing a mistaken buzz / signal
	{
		if (round == 'kd') {
			if (common && kd == 4) { khoiDongClearBuzz(); }
			return true;
		}
		else if (round == 'vcnv') {
			if (vcnvIsRowStep() || vcnv == 9) { vcnvUnsignal(); }
			return true;
		}
		else if (round == 'tb') {
			if (window.GameVariables.TieBreakBuzzSeat !== null) { tieBreakClearBuzz(); }
			return true;
		}
	}
	else if (key == '1' || key == '2' || key == '3' || key == '4') // keys '1'-'4' for seat N (buzz, row, right, 20/30 pick, steal)
	{
		var seat = parseInt(key, 10);
		if (round == 'kd') {
			if (common) { khoiDongBuzz(seat); }                                /* individual turn: not used */
			return true;
		}
		else if (round == 'vcnv') {
			if (vcnv == 2) { vcnvSelectRow(seat); }
			else if (vcnv >= 4 && vcnv <= 6) { vcnvMarkRowCorrect(seat); }
			else if (vcnv == 9) { vcnvGuessCorrect(seat); }
			return true;
		}
		else if (round == 'tt') {
			if (tangTocCanMark()) { tangTocMarkCorrect(seat); }
			return true;
		}
		else if (round == 'vd') {
			if (vd == 3) { if (seat == 2) { veDichPick(20); } else if (seat == 3) { veDichPick(30); } }
			else if (vd == 7) { veDichStealBuzz(seat); }
			return true;
		}
		else if (round == 'tb') { tieBreakBuzz(seat); return true; }
	}
	else if (key == '5') // key '5' for the VCNV centre question
	{
		if (round == 'vcnv') {
			if (vcnv == 2) { vcnvSelectRow(VCNV_CENTER); }
			return true;
		}
	}
	else if (key == '0') // key '0' for "everyone who signalled was wrong" (VCNV, while guessing only)
	{
		if (round == 'vcnv' && vcnv == 9) { vcnvGuessAllWrong(); return true; }
		/* anywhere else 0 is the global contestant-bars toggle */
	}
	else if (lower == 'q' || lower == 'w' || lower == 'e' || lower == 'r') // keys 'q','w','e','r' for VCNV seat 1-4 signalling for the obstacle
	{
		if (round == 'vcnv') {
			var signalSeat = SEAT_BY_SIGNAL_KEY[lower];
			if (vcnv == 9) {
				if (vcnvInQueue(signalSeat)) { vcnvGuessCorrect(signalSeat); }     /* one of the signallers was right */
				else { vcnvSignal(signalSeat); }                                  /* a late signaller joins */
			}
			else if (vcnvIsRowStep()) { vcnvSignal(signalSeat); }
			return true;
		}
	}
	else if (lower == 'u') // key 'u' for undoing a row selection (VCNV) / the last pick (VĐ)
	{
		if (round == 'vcnv') {
			if (vcnv == 3) { vcnvUnselectRow(); }
			return true;
		}
		else if (round == 'vd') {
			if (vd == 3) { veDichUnpick(); }
			return true;
		}
	}
	else if (lower == 's') // key 's' for the Ngôi sao hy vọng (VĐ)
	{
		if (round == 'vd') { veDichPlaceStar(); return true; }
	}
	else if (lower == 'b') // key 'b' for reviewing the question frame (TT)
	{
		if (round == 'tt') {
			if (tt == 4 || tt == 5) { tangTocToggleReview(); }
			return true;
		}
	}
	return false;
}

/* Keys that work in every round. Returns true when used. */
function handleGlobalKey(key) {
	var lower = key.length === 1 ? key.toLowerCase() : key;

	if (key == '0') { toggleScoreboard(); return true; }                                  // key '0' - contestant bars on / off
	if (key == '1' || key == '2' || key == '3' || key == '4') {                          // keys '1'-'4' outside a round - buzz-flag toggle
		var seat = parseInt(key, 10), p = window.GameVariables.getPlayer(seat);
		if (p) { setContestantBuzzed(seat, !p.isBuzzed); }
		return true;
	}
	if (lower == 'm') { stepScoreSummary(); return true; }                                // key 'm'  - score summary
	if (key == 'F6') { toggleBoardScreen(); return true; }                                // key 'F6' - results board
	if (key == '.') { startGeneralSound('blank.ogg'); return true; }                      // key '.'  - filler sting
	if (key == ',') {                                                                    // key ','  - green screen only: hide / show the KĐ, VCNV, Tăng tốc graphics
		var r = window.GameVariables.CurrentRound;
		if (window.GameVariables.IsGreenScreenOn && (r == 'kd' || r == 'vcnv' || r == 'tt' || r == 'tb')) { toggleRoundGraphics(); }
		return true;
	}
	if (lower == 'z' && window.GameVariables.ActiveSeat) { addScore(window.GameVariables.ActiveSeat, 10); return true; }   // key 'z' - +10 (fallback)
	if (lower == 'x' && window.GameVariables.ActiveSeat) { addScore(window.GameVariables.ActiveSeat, -5); return true; }   // key 'x' - -5 (fallback)
	if (ROUND_BY_F_KEY[key]) { switchRound(ROUND_BY_F_KEY[key]); return true; }           // keys F1-F5 - switch round
	return false;
}

function isFormTarget(t) {
	if (!t) { return false; }
	var tag = (t.tagName || '').toLowerCase();
	return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
}

/* ---------- the entry points StateSync.js and the control panel call (names must stay) ---------- */

window.GameVariables.Keyboard = {

	/* A key press on the graphics page (or relayed from the control panel). */
	dispatch: function (key) {
		/* the F6 board freezes the show: nothing but F6 (and the "." sting) gets through */
		if (window.GameVariables.BoardScreenShowing && key !== 'F6' && key !== '.') { return true; }
		var handled;
		try { handled = handleRoundKey(key, window.GameVariables.CurrentRound); }
		catch (e) { console.error('[Keyboard] round error on key', key, e); handled = true; }
		handled = handled || handleGlobalKey(key);
		if (handled) { window.GameVariables.changed(); }
		return handled;
	},

	/* The same key, but forced onto one round (control-panel buttons: kdKey, vcnvKey, ttKey, vdKey). */
	dispatchTo: function (roundId, key) {
		var handled;
		try { handled = handleRoundKey(key, roundId); }
		catch (e) { console.error('[Keyboard] round error on key', key, e); handled = true; }
		if (handled) { window.GameVariables.changed(); }
		return handled;
	},

	switchRound: function (roundId) { switchRound(roundId); },

	init: function () {
		document.addEventListener('keydown', function (e) {
			if (isFormTarget(e.target)) { return; }
			if (document.querySelector('dialog[open]')) { return; }   /* a dialog (control panel recovery) has the keyboard */
			if (SWALLOWED_KEYS.indexOf(e.key) !== -1) { e.preventDefault(); }
			if (e.repeat) { return; }

			/* control.html: Ctrl+Z undoes the last action's points (MatchLog.js), it is not a show key */
			if (window.GameVariables.SyncMode === 'remote' && (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
				e.preventDefault();
				window.GameVariables.Sync.sendCommand('undoScore', {});
				return;
			}
			if (window.GameVariables.SyncMode === 'remote') { window.GameVariables.Sync.sendKey(e.key, e.code); }   /* control.html: relay */
			else { window.GameVariables.Keyboard.dispatch(e.key); }
		});
	}
};
