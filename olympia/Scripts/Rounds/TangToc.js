/*
 * Olympia Controller - Tăng tốc (round 3): the STEP functions.
 * Which key calls which step is in KeyboardController.js (search for "round == 'tt'").
 *
 *   F3 / Left after VCNV   title card + tt_start
 *   Left     (title)       question 1: question bar + contents frame (picture / video, not yet
 *                          playing) + tt_open_question
 *   Right    (question)    timer N s (20/20/30/30; Olympia 23: 10/20/30/40) + tt_<N>s; a video starts playing now
 *   (host)                 types the four answers and times on the control panel
 *   Right    (timer)       timer/music/video stopped; question graphics off; the ANSWER TREE
 *                          (all branches right, sorted by time) + tt_open_answers
 *   1-4      (question / timer / answers)  toggle "seat N was right" - no points yet
 *   B        (answers / graded)  REVIEW: tree off, the question frame back at once with the
 *                          question's answer picture (<answerMedia>) or its own picture / paused
 *                          video; B again: the tree back exactly as it was. Right is ignored meanwhile.
 *   Right    (answers)     GRADE: right seats ranked by time -> 40/30/20/10 (ties share, no gap),
 *                          wrong branches monochrome, vcnv_row_correct / vcnv_row_wrong (reused)
 *   Right    (graded)      tree off -> blank ... after question 4: graphics off -> finished
 *   Right    (blank)       next question
 *   Left     (finished)    -> done;   Left (done) -> Về đích
 *
 * TangTocSequenceCounter (table in Variables.js):
 *   0 idle  1 title  2 question  3 timer  4 answers  5 graded  6 blank  7 finished  8 done
 * Ranking is GameVariables.ttRankPoints() (Variables.js) - shared with the panel's preview.
 */

function tangTocQuestions() { return window.GameVariables.TangTocQuestions || []; }
function tangTocCurrent() { return tangTocQuestions()[window.GameVariables.TangTocIndex - 1] || null; }

/* question / timer / answers: the steps where 1-4 mark a seat right */
function tangTocCanMark() {
	var c = window.GameVariables.TangTocSequenceCounter;
	return c >= 2 && c <= 4;
}

function tangTocBlankSeats(v) {
	var o = {};
	window.GameVariables.Players.forEach(function (p) { o[p.seat] = v; });
	return o;
}

function tangTocResetQuestionState() {
	window.GameVariables.TangTocAnswers = tangTocBlankSeats('');
	window.GameVariables.TangTocTimes = tangTocBlankSeats(null);
	window.GameVariables.TangTocCorrectSeats = [];
	window.GameVariables.TangTocAutoMarked = [];
	window.GameVariables.TangTocAwarded = {};
	window.GameVariables.IsTangTocReviewing = false;
}

function tangTocResetState() {
	tangTocStopTimer();
	window.GameVariables.TangTocIndex = 0;
	window.GameVariables.TangTocCount = tangTocQuestions().length || 4;
	window.GameVariables.TangTocSeconds = 0;
	window.GameVariables.TangTocQuestion = '';
	window.GameVariables.TangTocAnswer = '';
	window.GameVariables.TangTocMediaType = '';
	window.GameVariables.TangTocMediaSrc = '';
	tangTocResetQuestionState();
}

/* ---------- steps ---------- */

function tangTocShowTitle() {
	showTitleCard('tt');
	startGeneralSound('tt_start.mp3');
	window.GameVariables.TangTocSequenceCounter = 1;
}

function tangTocShowQuestion(index) {
	var q = tangTocQuestions()[index - 1] || { text: '', media: { type: 'image', src: '' }, answer: '', seconds: window.GameVariables.Timings.TANG_TOC[index - 1] || 20 };
	/* nothing to show (no text, no picture / video): never written, or its file is broken */
	if (!q.text && !(q.media && q.media.src)) { q = Object.assign({}, q, { text: window.GameVariables.MissingQuestionText }); }
	window.GameVariables.TangTocIndex = index;
	window.GameVariables.TangTocSeconds = q.seconds;
	window.GameVariables.TangTocQuestion = q.text;
	window.GameVariables.TangTocAnswer = q.answer;
	window.GameVariables.TangTocMediaType = q.media.type;
	window.GameVariables.TangTocMediaSrc = q.media.src;
	tangTocResetQuestionState();
	hideAnswerTree();
	setTangTocQuestion(q);
	showRoundGraphics();   /* answers hidden with ',' while grading: the next question shows again */
	showTangTocFrame();
	startGeneralSound('tt_open_question.mp3');
	window.GameVariables.TangTocSequenceCounter = 2;
}

function tangTocShowFirstQuestion() {
	hideTitleCard();
	tangTocResetState();
	tangTocShowQuestion(1);
}

/* the clock music: tt_<N>s.mp3 for an N s clock. tt_10s / tt_40s (Olympia 23 rules) are used once
 * they are in Sounds/ (checked once here); until then the nearest one plays (10 -> 20 s, 40 -> 30 s). */
var TANG_TOC_CLOCK_FILES = {};
['tt_10s.mp3', 'tt_40s.mp3'].forEach(function (f) {
	try { fetch('Sounds/' + f, { method: 'HEAD' }).then(function (r) { TANG_TOC_CLOCK_FILES[f] = !!(r && r.ok); }).catch(function () {}); } catch (e) { /* offline */ }
});
function tangTocClockSound(dur) {
	var own = 'tt_' + dur + 's.mp3';
	if (dur === 20 || dur === 30 || TANG_TOC_CLOCK_FILES[own]) { return own; }
	return dur >= 30 ? 'tt_30s.mp3' : 'tt_20s.mp3';
}

/* from: seconds already gone (a clock resumed after a crash: the clip and the music jump there too) */
function tangTocStartTimer(from) {
	var dur = window.GameVariables.TangTocSeconds || 20;
	window.GameVariables.IsTangTocTimerRunning = true;
	window.GameVariables.IsTangTocTimerDone = false;
	startTangTocTimer();
	var video = from > 0 && document.querySelector('.ttDiv .ttMediaVideo.on');
	if (video) { try { video.currentTime = from; } catch (e) { /* not seekable yet */ } }
	playTangTocVideo();
	startShortPassiveSound(tangTocClockSound(dur));
	seekShortPassiveSound(from);
	startClock({
		mode: 'down', duration: dur, label: 'tt_q' + window.GameVariables.TangTocIndex, startAt: from,
		onTick: function (remaining) { setTangTocTimer(1 - remaining / dur); },
		onDone: function () {
			setTangTocTimer(1);
			window.GameVariables.IsTangTocTimerRunning = false;
			window.GameVariables.IsTangTocTimerDone = true;
			window.GameVariables.changed();
		}
	});
	window.GameVariables.TangTocSequenceCounter = 3;
}

/* The clock running out does NOT stop a video - a clip longer than the time limit plays on until
 * the host moves to the answers or the graphics go away. */
function tangTocStopTimer() {
	if (window.GameVariables.IsTangTocTimerRunning) {
		stopClock();
		stopShortPassiveSound();
	}
	window.GameVariables.IsTangTocTimerRunning = false;
	window.GameVariables.IsTangTocTimerDone = false;
	hideTangTocTimer();
	stopTangTocVideo();
}

/* display order for the tree: everyone with a time, fastest first; the rest last */
function tangTocTreeEntries() {
	return window.GameVariables.Players.map(function (p) {
		var t = window.GameVariables.TangTocTimes[p.seat];
		var hasTime = typeof t === 'number' && !isNaN(t);
		return { seat: p.seat, name: window.GameVariables.displayName(p), answer: window.GameVariables.TangTocAnswers[p.seat] || '', time: hasTime ? t : null };
	}).sort(function (a, b) {
		var ta = a.time === null ? Infinity : a.time, tb = b.time === null ? Infinity : b.time;
		return (ta - tb) || (a.seat - b.seat);
	});
}

function tangTocRevealAnswers() {
	tangTocStopTimer();
	hideTangTocFrame();
	showRoundGraphics();   /* the answers always come up, even after ',' - with the background */
	showAnswerTree(tangTocTreeEntries(), null, { layout: 'right', showTime: true });
	startGeneralSound('tt_open_answers.mp3');
	window.GameVariables.TangTocSequenceCounter = 4;
}

/* 1-4: toggle "seat was right"; a hand decision overrides the auto-check */
function tangTocMarkCorrect(seat) {
	if (!window.GameVariables.getPlayer(seat)) { return; }
	var i = window.GameVariables.TangTocCorrectSeats.indexOf(seat);
	if (i === -1) { window.GameVariables.TangTocCorrectSeats.push(seat); } else { window.GameVariables.TangTocCorrectSeats.splice(i, 1); }
	var a = window.GameVariables.TangTocAutoMarked.indexOf(seat);
	if (a !== -1) { window.GameVariables.TangTocAutoMarked.splice(a, 1); }
}

function tangTocGradeQuestion() {
	var pts = window.GameVariables.ttRankPoints(window.GameVariables.TangTocTimes, window.GameVariables.TangTocCorrectSeats);
	window.GameVariables.TangTocAwarded = pts;
	Object.keys(pts).forEach(function (seat) { addScore(parseInt(seat, 10), pts[seat]); });
	gradeAnswerTree(window.GameVariables.TangTocCorrectSeats);
	/* same "right" / "wrong" stings as a VCNV row */
	startLongActiveSound(window.GameVariables.TangTocCorrectSeats.length ? 'vcnv_row_correct.mp3' : 'vcnv_row_wrong.mp3');
	window.GameVariables.TangTocSequenceCounter = 5;
}

/* B while the tree is up: frame with the answer picture <-> the tree, state untouched */
function tangTocToggleReview() {
	var q = tangTocCurrent();
	if (!window.GameVariables.IsTangTocReviewing) {
		hideAnswerTree();
		showTangTocQuestionStill((q && q.answerMedia) || (q && q.media) || { type: 'image', src: window.GameVariables.TangTocMediaSrc });
		window.GameVariables.IsTangTocReviewing = true;
		return;
	}
	hideTangTocQuestionStill();
	showAnswerTree(tangTocTreeEntries(), null, { layout: 'right', showTime: true, instant: true });   /* the same tree again: no entrance */
	if (window.GameVariables.TangTocSequenceCounter == 5) { gradeAnswerTree(window.GameVariables.TangTocCorrectSeats); }
	window.GameVariables.IsTangTocReviewing = false;
}

/* tree away; a beat on the bare background before the next question (or the end) */
function tangTocClearTree() {
	window.GameVariables.IsTangTocReviewing = false;
	hideTangTocQuestionStill();
	hideAnswerTree();
	if (window.GameVariables.TangTocIndex < window.GameVariables.TangTocCount) {
		window.GameVariables.TangTocSequenceCounter = 6;
		return;
	}
	hideTangTocFrame();
	window.GameVariables.TangTocSequenceCounter = 7;
}

function tangTocNextQuestion() {
	if (window.GameVariables.TangTocIndex < window.GameVariables.TangTocCount) { tangTocShowQuestion(window.GameVariables.TangTocIndex + 1); }
}

function tangTocFinishRound() {
	tangTocStopTimer();
	hideAnswerTree();
	hideTangTocFrame();
	window.GameVariables.TangTocSequenceCounter = 8;
}

/* ---------- control panel ---------- */

/* answers: {seat: text}, times: {seat: seconds|''} - partial updates allowed. A typed answer
 * that matches the question's answer is auto-marked right (1-4 may still un-mark it). */
function tangTocSetAnswers(answers, times) {
	var canMark = tangTocCanMark();
	window.GameVariables.Players.forEach(function (p) {
		var s = p.seat;
		if (answers && Object.prototype.hasOwnProperty.call(answers, s)) {
			window.GameVariables.TangTocAnswers[s] = String(answers[s] || '').trim();
			if (canMark) {
				var hit = window.GameVariables.answerMatches(window.GameVariables.TangTocAnswers[s], window.GameVariables.TangTocAnswer);
				var marked = window.GameVariables.TangTocCorrectSeats.indexOf(s) !== -1;
				var auto = window.GameVariables.TangTocAutoMarked.indexOf(s) !== -1;
				if (hit && !marked) { window.GameVariables.TangTocCorrectSeats.push(s); window.GameVariables.TangTocAutoMarked.push(s); }
				else if (!hit && marked && auto) {
					window.GameVariables.TangTocCorrectSeats.splice(window.GameVariables.TangTocCorrectSeats.indexOf(s), 1);
					window.GameVariables.TangTocAutoMarked.splice(window.GameVariables.TangTocAutoMarked.indexOf(s), 1);
				}
			}
		}
		if (times && Object.prototype.hasOwnProperty.call(times, s)) {
			var v = parseFloat(String(times[s]).replace(',', '.'));
			window.GameVariables.TangTocTimes[s] = (isNaN(v) || v < 0) ? null : Math.round(v * 100) / 100;
		}
	});
}

/* Restart the round from the title (scores untouched). */
function tangTocReset() {
	tangTocStopTimer();
	hideAnswerTree();
	hideTitleCard();
	hideTangTocFrame();
	showRoundGraphics();
	tangTocResetState();
	window.GameVariables.TangTocSequenceCounter = 0;
}

/* Jump to question N (re-run it); its answers/times start blank. */
function tangTocGoto(n) {
	if (!(n >= 1 && n <= (tangTocQuestions().length || 4))) { return; }
	tangTocStopTimer();
	hideTitleCard();
	tangTocShowQuestion(n);
}
