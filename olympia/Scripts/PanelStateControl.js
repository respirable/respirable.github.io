/*
 * Olympia Controller - what the control panel is told about each round.
 *
 * The control panel (control.html / ControlPanel.js) was written against one object per round
 * with the step as a word ('rowTimer', 'steal'...). The game itself keeps plain variables and a
 * number per round (Variables.js). This file is the one place that turns the second into the
 * first; StateSync.js calls it every time it sends the state to the panel.
 *
 * Adding a variable the panel should see = add one line here (and read it in ControlPanel.js).
 */

/* seats whose written answer is not blank (a yes/no, never the text) */
function seatsWithAnswers(answers) {
	return Object.keys(answers || {}).filter(function (s) { return String(answers[s] || '').trim() !== ''; }).map(Number);
}


/* Câu hỏi phụ - shared by the panel and the public state; the answer only goes to the panel */
function tieBreakStateFor(panel) {
	var g = window.GameVariables, c = g.TieBreakSequenceCounter;
	var o = {
		phase: g.TieBreakPhaseNames[c],
		seats: g.TieBreakSeats,
		eliminated: g.TieBreakEliminated,
		questionIndex: g.TieBreakQuestionIndex,
		currentQuestion: (c >= 3 && c <= 5) ? g.TieBreakCurrentQuestion : '',
		buzzSeat: g.TieBreakBuzzSeat,
		buzzEarly: g.IsTieBreakBuzzEarly,
		winner: g.TieBreakWinner,
		lastResult: g.TieBreakLastResult,
		timerRunning: g.IsTieBreakTimerRunning,
		timerDone: g.IsTieBreakTimerDone,
		timerPaused: g.IsTieBreakTimerPaused,
		lastQuestion: g.TieBreakQuestionIndex >= tieBreakQuestionLimit()
	};
	if (panel) {
		o.topSeats = g.topScoreSeats(g.Players);     /* who Left would pick (seats with the highest score) */
		o.questionCount = tieBreakQuestionLimit();
		o.currentQuestion = g.TieBreakCurrentQuestion;
		o.currentAnswer = g.TieBreakCurrentAnswer;
	}
	return o;
}

/* What players, the audience and the podiums are sent (pub:CODE). Only what the stage itself is
 * showing at that moment - never an answer, the obstacle keyword or another seat's writing
 * before the graphics reveal them. */
function buildRoundStateForPublic() {
	var g = window.GameVariables;
	var vcnvPhase = g.VcnvSequenceCounter, ttPhase = g.TangTocSequenceCounter;
	var vcnvAllShown = g.IsVcnvSolved || vcnvPhase >= 11;
	var vcnvData = g.VcnvData || { rows: [] };
	var vcnvTreeUp = vcnvPhase === 6 || vcnvPhase === 7;   /* the row's answer tree is on screen */
	var vcnvCurrent = g.VcnvCurrentRow ? (g.VcnvRows || [])[g.VcnvCurrentRow - 1] : null;
	/* which picture covers are off - read from the stage itself, so it is exactly what is seen */
	var coversOpen = Array.prototype.map.call(document.querySelectorAll('.vcnvDiv .vcnvCover.open'), function (el) {
		return el.classList.contains('vcnvCoverMiddle') ? 'middle' : el.className.replace(/.*vcnvCover(\d).*/, '$1');
	});
	function cells(answer) { return String(answer || '').replace(/\s+/g, '').split('').slice(0, typeof VCNV_MAX_CELLS === 'number' ? VCNV_MAX_CELLS : 10); }
	return {
		kd: {
			phase: g.KhoiDongPhaseNames[g.KhoiDongSequenceCounter],
			mode: g.KhoiDongMode,
			seat: g.KhoiDongSeat,
			questionIndex: g.KhoiDongQuestionIndex,
			questionCount: g.KhoiDongQuestionCount,
			currentQuestion: g.KhoiDongCurrentQuestion,
			buzzSeat: g.KhoiDongBuzzSeat,
			resolved: g.IsKhoiDongQuestionResolved
		},
		vcnv: {
			phase: g.VcnvPhaseNames[vcnvPhase],
			currentRow: g.VcnvCurrentRow,
			openedCount: g.VcnvOpenedCount,
			rows: (g.VcnvRows || []).map(function (r, i) {
				var data = i < 4 ? (vcnvData.rows || [])[i] : vcnvData.center;
				var shown = (r.status === 'correct' || vcnvAllShown) && data;
				return {
					status: r.status,
					answered: seatsWithAnswers(r.answers),
					length: data ? cells(data.answer).length : 0,                /* the circles are on screen */
					letters: shown ? cells(data.answer) : null,
					answer: shown ? (data.answer || '') : ''
				};
			}),
			image: '',            /* never the picture's address: the covered picture goes as an asset (VcnvPublicImage.js) */
			imageKey: '',         /* filled by StateSync.js with the asset's key */
			coversOpen: coversOpen,
			title: (typeof obstacleTitleText === 'function') ? obstacleTitleText() : '',
			treeAnswers: vcnvTreeUp && vcnvCurrent ? vcnvCurrent.answers : null,
			treeCorrect: vcnvPhase === 7 && vcnvCurrent ? vcnvCurrent.correctSeats : null,
			centerOpened: g.IsVcnvCenterOpened,
			queue: g.VcnvQueue,
			eliminated: g.VcnvEliminated,
			currentQuestion: g.VcnvCurrentQuestion,
			keyword: vcnvAllShown ? g.VcnvKeyword : '',
			keywordLength: g.vcnvLength ? g.vcnvLength(g.VcnvKeyword || '') : 0,
			solved: g.IsVcnvSolved,
			solvedBy: g.VcnvSolvedBy
		},
		tt: {
			phase: g.TangTocPhaseNames[ttPhase],
			index: g.TangTocIndex,
			count: g.TangTocCount,
			seconds: g.TangTocSeconds,
			question: ttPhase >= 2 ? g.TangTocQuestion : '',
			mediaType: ttPhase >= 2 && ttPhase <= 5 ? g.TangTocMediaType : '',
			mediaSrc: ttPhase >= 2 && ttPhase <= 5 ? g.TangTocMediaSrc : '',
			answered: seatsWithAnswers(g.TangTocAnswers),
			answers: (ttPhase === 4 || ttPhase === 5) ? g.TangTocAnswers : null,   /* the answer tree is up */
			times: (ttPhase === 4 || ttPhase === 5) ? g.TangTocTimes : null,
			correctSeats: ttPhase === 5 ? g.TangTocCorrectSeats : null
		},
		vd: {
			phase: g.VeDichPhaseNames[g.VeDichSequenceCounter],
			turn: g.VeDichTurn,
			seat: g.VeDichSeat,
			values: g.VeDichValues,
			qIndex: g.VeDichQuestionIndex,
			value: g.VeDichValue,
			question: g.IsVeDichQuestionRevealed ? g.VeDichQuestion : '',
			star: g.VeDichStar,
			result: g.VeDichResult,
			stealSeat: g.VeDichStealSeat,
			stealResult: g.VeDichStealResult,
			timerKind: g.VeDichTimerKind
		},
		tb: tieBreakStateFor(false)
	};
}

/* What is on the stage RIGHT NOW, read from the stage's own DOM - for the audience screen, which
 * redraws it with the same graphics modules (Scripts/AudienceMirror.js). Every text is the text
 * on screen, and the answer tree's entries are only sent while the tree is up, so nothing here
 * is ahead of the stage. Keep each field cheap: this runs on every publish. */
function buildSceneForPublic() {
	var g = window.GameVariables;
	function q(sel) { return document.querySelector(sel); }
	function on(sel) { var e = q(sel); return !!(e && !e.classList.contains('offstage')); }
	function txt(sel) { var e = q(sel); return e ? e.textContent : ''; }
	function has(sel) { return !!q(sel); }
	function cellState(row) {
		var c = q('.vcnvDiv .vcnvStrip' + row + ' .vcnvCell');
		if (!c) { return ''; }
		return c.classList.contains('revealed') ? 'revealed' : c.classList.contains('wrong') ? 'wrong' : c.classList.contains('selected') ? 'selected' : '';
	}
	function media(scope) {
		var img = q(scope + ' .ttMediaImg.on'), video = q(scope + ' .ttMediaVideo.on');
		if (video) { return { type: 'video', src: video.getAttribute('src') || '' }; }
		if (img) { return { type: 'image', src: img.getAttribute('src') || '' }; }
		return { type: 'image', src: '' };
	}

	var title = q('.titleCardDiv.visible img.current');
	var treeUp = on('.vcnvTreeDiv');
	var tree = null;
	if (treeUp) {
		var isTT = g.CurrentRound === 'tt';
		var entries = isTT ? (typeof tangTocTreeEntries === 'function' ? tangTocTreeEntries() : [])
			: (typeof vcnvTreeEntries === 'function' ? vcnvTreeEntries() : []);
		tree = {
			layout: isTT ? 'right' : '',
			showTime: isTT,
			instant: !!g.IsAnswerTreeInstant,   /* brought back (Tăng tốc B): the screens skip the entrance too */
			entries: entries,
			wrong: Array.prototype.map.call(document.querySelectorAll('.vcnvTreeDiv .treeBranch.wrong'), function (b) { return Number(b.getAttribute('data-seat')); })
		};
	}
	var barImg = q('.questionBarDiv .questionBarImg');
	var vdTimer = q('.vdDiv .vdTimerDiv');
	return {
		titleCard: title ? title.getAttribute('data-round') : null,
		questionBar: {
			on: on('.questionBarDiv'),
			variant: barImg && /without/.test(barImg.getAttribute('src') || '') ? 'plain' : 'timer',
			text: txt('.questionBarDiv .questionTextP'),
			clock: has('.questionBarDiv .questionClockP.visible') ? txt('.questionBarDiv .questionClockP') : '',
			timer: has('.questionBarDiv .questionTimerDiv.visible')
		},
		bars: {
			/* per seat: the look a round gave the bar (ScoreboardControl.js contestantBarLook) */
			look: (function () {
				var out = {};
				document.querySelectorAll('.scoreboardDiv .contestantBar').forEach(function (b) {
					out[b.id.replace('contestantBar', '')] = { plain: b.classList.contains('plain'), absent: b.classList.contains('absent'), grey: b.classList.contains('eliminated') };
				});
				return out;
			})(),
			shown: Array.prototype.map.call(document.querySelectorAll('.scoreboardDiv .contestantBar.shown'), function (b) { return Number(b.id.replace('contestantBar', '')); }),
			revealId: g.BarsRevealId || 0,   /* ScoreboardControl.js revealContestantBars */
			grey: Array.prototype.map.call(document.querySelectorAll('.scoreboardDiv .contestantBar.eliminated'), function (b) { return Number(b.id.replace('contestantBar', '')); }),
			stripOn: !!g.IsScoreboardShowing
		},
		vcnv: {
			on: on('.vcnvDiv'),
			title: txt('.vcnvDiv .vcnvBoardTitleP'),
			question: txt('.vcnvDiv .vcnvQuestionTextP'),
			cells: [1, 2, 3, 4].map(cellState),
			timer: has('.vcnvDiv .vcnvTimerDiv.visible')
		},
		tree: tree,
		tt: {
			on: on('.ttDiv'),
			still: has('.ttDiv .ttGroupDiv.noAnim'),
			text: txt('.ttDiv .ttQuestionTextP'),
			media: media('.ttDiv'),
			timer: has('.ttDiv .ttTimerDiv.visible')
		},
		vd: {
			on: on('.vdDiv'),
			choose: has('.vdDiv .vdChooseDiv.on'),
			values: (g.VeDichValues || []).slice(),
			group: has('.vdDiv .vdQuestionGroup.on'),
			onStage: g.VeDichSeat,
			steal: g.VeDichStealSeat,
			text: txt('.vdDiv .vdQuestionTextP'),
			header: txt('.vdDiv .vdScoreHeaderP'),
			score: txt('.vdDiv .vdScoreP'),
			star: has('.vdDiv video.vdStar.on'),
			timer: !!(vdTimer && vdTimer.classList.contains('visible')),
			reverse: !!(vdTimer && vdTimer.classList.contains('reverse'))
		},
		board: on('.boardScreenDiv'),
		/* green screen (key Q on the panel) and ',' - only stage screens copy these, not the audience */
		stage: {
			green: g.IsGreenScreenOn ? (g.GreenScreenColor || '') : '',
			background: !!g.IsBackgroundShowing,
			hidden: g.IsRoundGraphicsHidden ? (g.CurrentRound || '') : null
		},
		summary: { on: on('.summaryDiv'), name: txt('.summaryDiv .summaryNameP'), score: txt('.summaryDiv .summaryScoreP') }
	};
}

function buildRoundStateForPanel() {
	var g = window.GameVariables;
	return {
		kd: {
			phase: g.KhoiDongPhaseNames[g.KhoiDongSequenceCounter],
			mode: g.KhoiDongMode,
			seat: g.KhoiDongSeat,
			questionIndex: g.KhoiDongQuestionIndex,
			questionCount: g.KhoiDongQuestionCount,
			currentQuestion: g.KhoiDongCurrentQuestion,
			currentAnswer: g.KhoiDongCurrentAnswer,
			lastResult: g.KhoiDongLastResult,
			buzzSeat: g.KhoiDongBuzzSeat,
			resolved: g.IsKhoiDongQuestionResolved
		},
		vcnv: {
			phase: g.VcnvPhaseNames[g.VcnvSequenceCounter],
			timerRunning: g.IsVcnvTimerRunning,
			timerDone: g.IsVcnvTimerDone,
			currentRow: g.VcnvCurrentRow,
			openedCount: g.VcnvOpenedCount,
			rows: g.VcnvRows,
			centerOpened: g.IsVcnvCenterOpened,
			finalUsed: g.IsVcnvFinalWindowUsed,
			finalExpired: g.IsVcnvFinalWindowExpired,
			queue: g.VcnvQueue,
			eliminated: g.VcnvEliminated,
			currentQuestion: g.VcnvCurrentQuestion,
			currentAnswer: g.VcnvCurrentAnswer,
			keyword: g.VcnvKeyword,
			solved: g.IsVcnvSolved,
			solvedBy: g.VcnvSolvedBy
		},
		tt: {
			phase: g.TangTocPhaseNames[g.TangTocSequenceCounter],
			index: g.TangTocIndex,
			count: g.TangTocCount,
			seconds: g.TangTocSeconds,
			question: g.TangTocQuestion,
			answer: g.TangTocAnswer,
			mediaType: g.TangTocMediaType,
			mediaSrc: g.TangTocMediaSrc,
			answers: g.TangTocAnswers,
			times: g.TangTocTimes,
			correctSeats: g.TangTocCorrectSeats,
			autoMarked: g.TangTocAutoMarked,
			awarded: g.TangTocAwarded,
			reviewing: g.IsTangTocReviewing,
			timerRunning: g.IsTangTocTimerRunning,
			timerDone: g.IsTangTocTimerDone
		},
		vd: {
			phase: g.VeDichPhaseNames[g.VeDichSequenceCounter],
			order: g.VeDichOrder,
			orderManual: g.IsVeDichOrderManual,
			turn: g.VeDichTurn,
			seat: g.VeDichSeat,
			done: g.VeDichDone,
			values: g.VeDichValues,
			qIndex: g.VeDichQuestionIndex,
			value: g.VeDichValue,
			question: g.VeDichQuestion,
			answer: g.VeDichAnswer,
			seconds: g.VeDichSeconds,
			revealed: g.IsVeDichQuestionRevealed,
			star: g.VeDichStar,
			starUsed: g.IsVeDichStarUsed,
			result: g.VeDichResult,
			stealSeat: g.VeDichStealSeat,
			stealResult: g.VeDichStealResult,
			timerRunning: g.IsVeDichTimerRunning,
			timerDone: g.IsVeDichTimerDone,
			timerKind: g.VeDichTimerKind
		},
		tb: tieBreakStateFor(true)
	};
}
