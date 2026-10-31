/*
 * Olympia Controller - every setting and every piece of game state.
 *
 * Same layout as the WWTBAM (Olga) controller's Variables.js: ONE object, window.GameVariables,
 * with plain variables grouped by kind. Loaded first by BOTH pages (default.html = graphics,
 * control.html = control panel).
 *
 * Only the "Initialization Variables" block is meant to be edited by hand.
 *
 * Each round is driven by a SEQUENCE COUNTER (like QuestionSequenceCounter in Olga). The number
 * says which step the round is on; the table next to each counter says what every number means.
 * The same tables (…PhaseNames) are what the control panel prints.
 */
(function (gameVariables) {

	/* ==================================================================================== */
	/* Initialization Variables                                                             */
	/* ==================================================================================== */

	/* Round ids and the names shown on the control panel. F1..F5 switch rounds in this order. */
	gameVariables.Rounds = { KHOI_DONG: 'kd', VCNV: 'vcnv', TANG_TOC: 'tt', VE_DICH: 'vd', TIEBREAK: 'tb' };
	gameVariables.RoundNames = { kd: 'Khởi động', vcnv: 'Vượt chướng ngại vật', tt: 'Tăng tốc', vd: 'Về đích', tb: 'Câu hỏi phụ' };

	/* Points */
	gameVariables.Points = {
		KD_CORRECT: 10,                         /* Khởi động: a right answer */
		KD_WRONG_INDIVIDUAL: 0,                 /* Khởi động individual turn: a wrong answer (no deduction) */
		KD_WRONG_COMMON: -5,                    /* Khởi động common turn: a wrong answer by the seat that buzzed */
		VCNV_ROW: 10,                           /* VCNV: a row answered right (paid when the row is graded) */
		VCNV_OBSTACLE: { 1: 60, 2: 50, 3: 40, 4: 30 },   /* VCNV: the obstacle, by the number of rows opened when it is solved */
		VCNV_CENTER: 10,                        /* VCNV: the centre question */
		VCNV_AFTER_CENTER: 20,                  /* VCNV: the obstacle once the centre question has been asked (right or wrong) */
		TANG_TOC_RANK: [40, 30, 20, 10],        /* Tăng tốc: fastest right answer first; ties share, no gap */
		VE_DICH_STEAL_WRONG_RATIO: 0.5          /* Về đích: a wrong steal costs the stealer this share of the question's value */
	};

	/* Timings (seconds) */
	gameVariables.Timings = {
		KD_THINK: 3,                            /* Khởi động: Space countdown */
		KD_QUESTIONS_PER_PLAYER: 6,             /* Khởi động: questions per contestant in the individual turn */
		KD_COMMON_QUESTIONS: 12,                /* Khởi động: questions in the common turn */
		VCNV_DECIDE: 15,                        /* VCNV: row question clock and the last-chance window */
		TANG_TOC: [20, 20, 30, 30],             /* Tăng tốc: clock of questions 1-4 (tangtoc.xml may override) */
		VE_DICH_STEAL: 5,                       /* Về đích: steal window */
		VE_DICH_ANSWER: { 20: 15, 30: 20 },     /* Về đích: clock per question value */
		TIEBREAK_ANSWER: 15,                    /* Câu hỏi phụ: buzzer clock (tb_15s.ogg) */
		TIEBREAK_MAX_QUESTIONS: 3               /* Câu hỏi phụ: questions in a set (more in the file are ignored) */
	};

	/* What a question shows when it was never written, or its set / file is broken (Init.js,
	 * QuestionSet.js; every round: a missing or empty question). */
	gameVariables.MissingQuestionText = 'Bạn / BTC chưa thiết lập bộ câu hỏi/câu hỏi này, hoặc bộ câu hỏi/câu hỏi này đang bị lỗi. Nếu là BTC, hãy vào phần Quản lý câu hỏi để kiểm tra lại ngay.';
	gameVariables.QuestionsUnset = false;   /* a room with no set chosen / a broken one: no file is read (QuestionSet.js) */

	/* Data files (XML, edited by hand - see the comment at the top of each file) */
	gameVariables.DataFiles = {
		players: 'Questions/players.xml',
		khoidong: 'Questions/khoidong.xml',
		vcnv: 'Questions/vcnv.xml',
		tangtoc: 'Questions/tangtoc.xml',
		vedich: 'Questions/vedich.xml',
		tiebreak: 'Questions/cauhoiphu.xml'     /* missing in Questions/: the sample in Demo/ is used */
	};

	/* Sound channels (see AudioControl.js for what each one is for). */
	gameVariables.AudioChannels = ['RoundBedSound', 'TimerSound', 'BuzzerSound', 'ResultSound', 'StingerSound', 'StarSound', 'AmbientSound'];

	/* Sound files: key = file in Sounds/; every key listed here has a real file. */
	gameVariables.SoundMap = {
		/* Khởi động */
		'kd_start.mp3': true,                   /* Left: round title card */
		'kd_ready.ogg': true,                   /* Left: contestant chosen / common turn ready */
		'kd_open_question.mp3': true,           /* Left: graphics in */
		'kd_60s.mp3': true,                     /* bed for one turn - loop points in BedLoops */
		'kd_correct.mp3': true,                 /* Up */
		'kd_wrong.ogg': true,                   /* Down */
		'kd_complete.ogg': true,                /* 1 s after the graphics leave */
		'kd_buzz.mp3': true,                    /* 1-4: buzzer (also the Về đích steal buzz) */
		/* general */
		'score_summary.oga': true,              /* M: one file, plays through the whole summary */
		'blank.ogg': true,                      /* . : filler sting, any time */
		/* Vượt chướng ngại vật */
		'vcnv_start.mp3': true,                 /* Left: round title card */
		'vcnv_open_board.mp3': true,            /* Left: board in */
		'vcnv_select_row.mp3': true,            /* 1-4 / 5: row selected */
		'vcnv_open_question.mp3': true,         /* Right: question revealed */
		'vcnv_15s.mp3': true,                   /* Right: 15 s clock (also the last-chance window) */
		'tb_15s.ogg': true,                     /* Câu hỏi phụ: Right: 15 s clock */
		'vcnv_open_answers.ogg': true,          /* Right: answer tree */
		'vcnv_row_correct.mp3': true,           /* Right: row graded, somebody right (also Tăng tốc) */
		'vcnv_row_wrong.mp3': true,             /* Right: row graded, nobody right; 0: CNV all wrong (also Tăng tốc) */
		'vcnv_open_picture.mp3': true,          /* Right: picture quarter opens */
		'vcnv_signal.mp3': true,                /* Q/W/E/R: contestant signals for the CNV */
		'vcnv_solved.mp3': true,                /* CNV solved */
		/* Tăng tốc */
		'tt_start.mp3': true,                   /* Left: round title card */
		'tt_open_question.mp3': true,           /* Left / Right: question in */
		'tt_20s.mp3': true,                     /* Right: 20 s clock */
		'tt_30s.mp3': true,                     /* Right: 30 s clock */
		'tt_open_answers.mp3': true,            /* Right: answer tree */
		/* Về đích */
		'vd_start.mp3': true,                   /* F4 / Left: round title card */
		'vd_ready.mp3': true,                   /* Left: contestant called to the stage */
		'vd_choose.ogg': true,                  /* Left: choose screen */
		'vd_pick.ogg': true,                    /* 2 / 3: value picked */
		'vd_open_question.mp3': true,           /* Left: question group in (once per package) */
		'vd_star.mp3': true,                    /* S: Ngôi sao hy vọng placed (plays once) */
		'vd_15s.mp3': true,                     /* Right: clock of a 20-point question */
		'vd_20s.mp3': true,                     /* Right: clock of a 30-point question */
		'vd_correct.ogg': true,                 /* Up: right (contestant on stage or stealer) */
		'vd_wrong.ogg': true,                   /* Down: wrong steal (a wrong main answer only opens the 5 s music) */
		'vd_5s.mp3': true,                      /* Down: 5 s steal window music (runs out even after a buzz) */
		'vd_turn_complete.mp3': true            /* Right after question 3: one contestant's turn over */
	};

	/* Beds with loop points: [intro][loopStart <-> loopEnd][outro], seconds into the file.
	 * While looping, reaching loopEnd seeks back to loopStart. releaseLongPassiveSound() (called when
	 * the LAST question of the turn appears) seeks forward to releaseTo so the outro plays out -
	 * unless the bed is already within releaseSlack seconds of releaseTo, then it is left alone. */
	gameVariables.BedLoops = {
		'kd_60s.mp3': { loopStart: 30, loopEnd: 50, releaseTo: 49, releaseSlack: 2 }
	};

	/* Two-screen sync (BroadcastChannel + localStorage). Change only if two shows share one browser. */
	gameVariables.SyncChannelName = 'olympia';
	gameVariables.SyncStateKey = 'olympia.state';
	gameVariables.SyncAuthorityKey = 'olympia.authority';
	gameVariables.NamesKey = 'olympia.names';       /* localStorage: names typed on the control panel - beat players.xml */

	/* Green screen (chroma key). When on, background.png is replaced by a flat colour except while the
	 * VCNV graphics, a Tăng tốc question or an answer tree is on screen; no round title cards, no F6
	 * board. Toggled any time from the control panel; this is only the state the page starts in. */
	gameVariables.GreenScreenMode = false;          /* true = start in green-screen mode */
	gameVariables.GreenScreenColor = '#00B140';      /* the key colour */

	/* ==================================================================================== */
	/* Sequence Counters - one per round. DO NOT EDIT BY HAND.                              */
	/* ==================================================================================== */

	/* Khởi động
	 *   0 - idle         nothing on screen yet
	 *   1 - title        title card up
	 *   2 - ready        contestant called (individual) / "get ready" sting (common)
	 *   3 - set          question bar + contestant bars in, no question yet
	 *   4 - question     a question is on the bar
	 *   5 - done         one individual turn over, the next contestant is waiting
	 *   6 - finished     individual turns over (Left opens the common turn) / common turn over (Left -> VCNV) */
	gameVariables.KhoiDongSequenceCounter = 0;
	gameVariables.KhoiDongPhaseNames = ['idle', 'title', 'ready', 'set', 'question', 'done', 'finished'];

	/* Vượt chướng ngại vật
	 *   0 - idle          1 - title          2 - board (pick a row)
	 *   3 - rowSelected   (circles cyan, question not shown yet - U undoes)
	 *   4 - rowQuestion   (question on the bar)          5 - rowTimer    (15 s bar running / ran out)
	 *   6 - rowAnswers    (answer tree up)               7 - rowGraded   (tree graded)
	 *   8 - rowBack       (tree off, board back)
	 *   9 - guessing      (someone signalled for the obstacle - row keys frozen)
	 *  10 - finalWindow   (last-chance 15 s on the empty bar)
	 *  11 - finished      (obstacle solved or revealed)  12 - done       (graphics off, Left -> Tăng tốc) */
	gameVariables.VcnvSequenceCounter = 0;
	gameVariables.VcnvPhaseNames = ['idle', 'title', 'board', 'rowSelected', 'rowQuestion', 'rowTimer', 'rowAnswers', 'rowGraded', 'rowBack', 'guessing', 'finalWindow', 'finished', 'done'];

	/* Tăng tốc
	 *   0 - idle   1 - title   2 - question (frame up, clock not started)   3 - timer (clock running / ran out)
	 *   4 - answers (answer tree up)   5 - graded (points given)   6 - blank (bare background before the next question)
	 *   7 - finished (after question 4, graphics off)   8 - done (Left -> Về đích) */
	gameVariables.TangTocSequenceCounter = 0;
	gameVariables.TangTocPhaseNames = ['idle', 'title', 'question', 'timer', 'answers', 'graded', 'blank', 'finished', 'done'];

	/* Về đích
	 *   0 - idle         1 - title        2 - stageCall (contestant called, sound only)
	 *   3 - choose       (choose screen: 2 / 3 pick 20 / 30, U drops the last pick)
	 *   4 - ready        (question group up, bar empty - the star may be placed)
	 *   5 - question     (text on the bar)                 6 - timer (answer clock running / ran out)
	 *   7 - steal        (5 s steal window after a wrong answer)   8 - stealAnswer (someone buzzed to steal)
	 *   9 - answered     (question decided)                10 - blank (turn over, bare background)
	 *  11 - finished     (all four turns over)            12 - done (graphics off) */
	gameVariables.VeDichSequenceCounter = 0;
	gameVariables.VeDichPhaseNames = ['idle', 'title', 'stageCall', 'choose', 'ready', 'question', 'timer', 'steal', 'stealAnswer', 'answered', 'blank', 'finished', 'done'];

	/* Câu hỏi phụ (tie-break for first place - same graphics as the Khởi động individual turn)
	 *   0 - idle       nothing on screen; Left picks the seats tied for first + kd_ready
	 *   1 - ready      seats chosen, "get ready" sting played
	 *   2 - set        question bar (timer skin) + contestant bars in, no question yet
	 *   3 - question   question on the bar, clock not started - a buzz now is "early" (can only be wrong)
	 *   4 - timer      15 s clock running / ran out - first buzz answers
	 *   5 - closed     question over: a winner (Left ends the round) or nobody (Right: next question)
	 *   6 - finished   winner decided, graphics off */
	gameVariables.TieBreakSequenceCounter = 0;
	gameVariables.TieBreakPhaseNames = ['idle', 'ready', 'set', 'question', 'timer', 'closed', 'finished'];

	/* ==================================================================================== */
	/* Boolean Variables                                                                    */
	/* ==================================================================================== */

	gameVariables.IsBackgroundShowing = false;
	gameVariables.IsScoreboardShowing = true;        /* key 0: the whole contestant-bar strip on / off */
	gameVariables.MatchId = null;                    /* StateSync.js matchId(): one id per match, kept by GameSave.js */
	gameVariables.BoardScreenShowing = false;        /* the F6 "current results" board is up */
	gameVariables.IsGreenScreenOn = gameVariables.GreenScreenMode;   /* green-screen mode right now */
	gameVariables.IsRoundGraphicsHidden = false;     /* key ',': VCNV graphics / Tăng tốc frame + answers hidden */

	gameVariables.IsKhoiDongQuestionResolved = false;    /* common turn: Up/Down already pressed for this question */

	gameVariables.IsVcnvTimerRunning = false;        /* 15 s bar under the question */
	gameVariables.IsVcnvTimerDone = false;
	gameVariables.IsVcnvCenterOpened = false;        /* centre question answered right -> middle cover off (the prize drops to VCNV_AFTER_CENTER as soon as it is asked) */
	gameVariables.IsVcnvFinalWindowUsed = false;     /* the last-chance 15 s window has been run */
	gameVariables.IsVcnvFinalWindowExpired = false;  /* ...and it ran out */
	gameVariables.IsVcnvSolved = false;

	gameVariables.IsTangTocReviewing = false;        /* B: question frame shown instead of the tree */
	gameVariables.IsTangTocTimerRunning = false;
	gameVariables.IsTangTocTimerDone = false;

	gameVariables.IsVeDichOrderManual = false;       /* host fixed the playing order from the panel */
	gameVariables.IsVeDichQuestionRevealed = false;  /* the question text is on the bar */
	gameVariables.IsVeDichStarUsed = false;          /* this contestant already placed the star */
	gameVariables.IsVeDichTimerRunning = false;
	gameVariables.IsVeDichTimerFrozen = false;       /* answered right: the bar stays where it stopped */
	gameVariables.IsVeDichTimerDone = false;

	gameVariables.IsTieBreakTimerRunning = false;
	gameVariables.IsTieBreakTimerDone = false;
	gameVariables.IsTieBreakTimerPaused = false;     /* held while a buzz waits for its verdict */
	gameVariables.IsTieBreakBuzzEarly = false;      /* the buzz was pressed before the 15 s clock started */

	/* built-once flags of the graphics */
	gameVariables.IsObstacleBoardBuilt = false;
	gameVariables.IsTangTocFrameBuilt = false;
	gameVariables.IsVeDichBuilt = false;
	gameVariables.IsStarClipAvailable = false;
	gameVariables.IsAnswerTreeShowing = false;
	gameVariables.IsAnswerTreeInstant = false;      /* the tree on screen came back complete (no entrance) */

	/* ==================================================================================== */
	/* Number Variables                                                                     */
	/* ==================================================================================== */

	gameVariables.ActiveSeat = null;                 /* contestant on stage / who buzzed first */

	gameVariables.KhoiDongSeat = null;               /* individual turn: the contestant playing */
	gameVariables.KhoiDongQuestionIndex = 0;
	gameVariables.KhoiDongQuestionCount = 6;
	gameVariables.KhoiDongTurn = 0;                  /* Olympia 23 (Rules.js): turn 1-3 of the common turns */
	gameVariables.KhoiDongQuestionOffset = 0;        /* Olympia 23: <common> questions used by the earlier turns */
	gameVariables.KhoiDongBuzzSeat = null;           /* common turn: seat that locked the buzzer */
	gameVariables.KdOwnWrong = 0;                    /* Luật rừng individual turn: wrongs so far (1st free, then -5) */
	gameVariables.KdOwnStreak = 0;                   /* Luật rừng: rights in a row (3 = one bonus question) */
	gameVariables.KdOwnBonus = 0;                    /* Luật rừng: bonus questions won (at most 4) */
	gameVariables.IsKdOwnTimeUp = false;             /* Luật rừng: the 60 s ran out */
	gameVariables.KdOwnClockStarted = false;         /* Luật rừng: the 60 s clock is this turn's */
	gameVariables.KdTurnWrong = {};                  /* Luật rừng common turns: seat -> wrongs in this turn */

	gameVariables.VcnvCurrentRow = null;             /* 1..4 while a row is open, 5 = centre */
	gameVariables.VcnvOpenedCount = 0;               /* rows put to the contestants so far - sets the CNV prize */
	gameVariables.VcnvPhaseBeforeGuess = null;       /* counter to go back to after an all-wrong CNV answer */
	gameVariables.VcnvSolvedBy = null;

	gameVariables.TangTocIndex = 0;                  /* 1..4 */
	gameVariables.TangTocCount = 4;
	gameVariables.TangTocSeconds = 0;

	gameVariables.VeDichTurn = 0;                    /* 1..4 - position in the order of the contestant on stage */
	gameVariables.VeDichSeat = null;                 /* contestant on stage */
	gameVariables.VeDichQuestionIndex = 0;           /* 1..3 within the turn */
	gameVariables.VeDichValue = 0;                   /* this question's value */
	gameVariables.VeDichSeconds = 0;
	gameVariables.VeDichStar = null;                 /* question index the Ngôi sao hy vọng is on */
	gameVariables.VeDichStealSeat = null;

	gameVariables.TieBreakQuestionIndex = 0;         /* 1.. - questions put so far */
	gameVariables.TieBreakBuzzSeat = null;           /* seat that locked the buzzer */
	gameVariables.TieBreakWinner = null;             /* first right answer: first place */

	/* ==================================================================================== */
	/* String Variables                                                                     */
	/* ==================================================================================== */

	gameVariables.SyncMode = 'authority';            /* 'authority' (default.html) or 'remote' (control.html) */
	gameVariables.CurrentRound = gameVariables.Rounds.KHOI_DONG;

	gameVariables.KhoiDongMode = 'individual';       /* 'individual' (4 turns of 6) | 'common' (12 questions, buzzers) */
	gameVariables.KhoiDongStartIndex = null;         /* emergency recovery: the question the next Right opens (Recovery.js) */
	gameVariables.IsProgressRestored = false;        /* an emergency recovery has been applied on this page */
	gameVariables.KhoiDongCurrentQuestion = '';
	gameVariables.KhoiDongCurrentAnswer = '';
	gameVariables.KhoiDongLastResult = null;         /* 'correct' | 'wrong' | 'noanswer' */

	gameVariables.VcnvCurrentQuestion = '';
	gameVariables.VcnvCurrentAnswer = '';            /* host only */
	gameVariables.VcnvKeyword = '';                  /* host only */

	gameVariables.TangTocQuestion = '';
	gameVariables.TangTocAnswer = '';
	gameVariables.TangTocMediaType = '';
	gameVariables.TangTocMediaSrc = '';

	gameVariables.VeDichQuestion = '';
	gameVariables.VeDichAnswer = '';                 /* host only */
	gameVariables.VeDichResult = null;               /* 'correct' | 'wrong' for the contestant on stage */
	gameVariables.VeDichStealResult = null;          /* 'correct' | 'wrong' for the stealer */
	gameVariables.VeDichTimerKind = null;            /* 'answer' | 'steal' */

	gameVariables.TieBreakCurrentQuestion = '';
	gameVariables.TieBreakCurrentAnswer = '';        /* host only */
	gameVariables.TieBreakLastResult = null;         /* 'correct' | 'wrong' | 'early' (wrong, buzzed before the clock) | 'none' */

	/* ==================================================================================== */
	/* Array / Object Variables                                                             */
	/* ==================================================================================== */

	gameVariables.Players = [];                      /* seat is 1..4 and is NOT the index: use getPlayer(seat) */
	gameVariables.BuzzOrder = [];                    /* seats in the order they buzzed for the current question */

	gameVariables.VcnvRows = [];                     /* x5 { status: closed|open|correct|wrong, correctSeats, answers, autoMarked } - [4] = centre */
	gameVariables.VcnvQueue = [];                    /* seats that signalled for the CNV, in press order */
	gameVariables.VcnvEliminated = [];               /* seats out of the round (wrong CNV answer) */

	gameVariables.TangTocAnswers = { 1: '', 2: '', 3: '', 4: '' };      /* typed by the host */
	gameVariables.TangTocTimes = { 1: null, 2: null, 3: null, 4: null };
	gameVariables.TangTocCorrectSeats = [];
	gameVariables.TangTocAutoMarked = [];            /* seats marked by the answer auto-check */
	gameVariables.TangTocAwarded = {};               /* seat -> points, after grading */

	gameVariables.VeDichOrder = [];                  /* playing order: those done, then the rest by score */
	gameVariables.VeDichDone = [];                   /* seats whose turn is over */
	gameVariables.VeDichValues = [];                 /* the three chosen values (20/30) in choosing order */

	gameVariables.TieBreakSeats = [];                /* seats playing the tie-break (tied for first) */
	gameVariables.TieBreakEliminated = [];           /* seats out of the CURRENT question (wrong / early buzz) */

	/* questions, filled by getAllQuestionsForGame() in Init.js */
	gameVariables.KhoiDongQuestions = { individual: {}, common: [] };
	gameVariables.VcnvData = null;                   /* { keyword, image, rows:[{text,answer}x4], center } */
	gameVariables.TangTocQuestions = [];             /* [{ text, media, answerMedia, answer, seconds }] */
	gameVariables.VeDichQuestions = {};              /* { seat: { 20: [...], 30: [...] } } */
	gameVariables.TieBreakQuestions = [];            /* [{ text, answer }] - put in order, as many as needed */

	/* published for the control panel (read by StateSync.js - keep these names) */
	gameVariables.SummaryState = { showing: false, index: -1, order: [], entry: null };   /* score summary (key M) */
	gameVariables.TimerState = null;                 /* the running clock */
	gameVariables.BedState = null;                   /* the round bed position */

	/* ==================================================================================== */
	/* Audio Variables - the seven channels, one HTMLAudioElement each (AudioControl.js)     */
	/* ==================================================================================== */

	gameVariables.RoundBedSound = null;
	gameVariables.TimerSound = null;
	gameVariables.BuzzerSound = null;
	gameVariables.ResultSound = null;
	gameVariables.StingerSound = null;
	gameVariables.StarSound = null;
	gameVariables.AmbientSound = null;
	gameVariables.BedFile = null;
	gameVariables.BedLoopStart = 0;
	gameVariables.BedLoopEnd = 0;
	gameVariables.BedReleaseTo = 0;
	gameVariables.BedReleaseSlack = 0;
	gameVariables.IsBedLooping = false;

	/* ==================================================================================== */
	/* Interval / Timeout Variables                                                         */
	/* ==================================================================================== */

	gameVariables.CurrentClock = null;               /* { mode, duration, t0, onTick, onDone, raf, label } - TimerControl.js */
	gameVariables.BedWatchInterval = null;
	gameVariables.FadeIntervals = {};
	gameVariables.ContestantBarRevealTimeouts = [];
	gameVariables.BarsRevealId = 0;                  /* +1 per one-by-one entrance, for the screens */
	gameVariables.AnswerTreeTimeouts = [];
	gameVariables.AnswerTreeAnimationFrame = null;
	gameVariables.AnswerTreeOptions = {};
	gameVariables.ChooseScreenTimeout = null;
	gameVariables.QuestionGroupTimeout = null;
	gameVariables.KhoiDongCompleteTimeout = null;

	/* ==================================================================================== */
	/* Helper Functions - pure, shared by both pages (the control panel calls some of them) */
	/* ==================================================================================== */

	gameVariables.createPlayer = function (seat, fullName, school) {
		return {
			seat: seat,
			fullName: fullName || ('Thí sinh ' + seat),
			school: school || '',
			score: 0,
			isEliminatedFromVCNV: false,
			isBuzzed: false,
			isOnStage: false,
			kdDone: false
		};
	};

	gameVariables.getPlayer = function (seat) {
		for (var i = 0; i < gameVariables.Players.length; i++) {
			if (gameVariables.Players[i].seat === seat) { return gameVariables.Players[i]; }
		}
		return null;
	};

	/* Display name = last two words of the full name ("Nguyễn Hoàng Nguyên Vũ" -> "Nguyên Vũ").
	 * The placeholder "Thí sinh N" is shown in full. */
	gameVariables.displayName = function (player) {
		var full = String(player.fullName || '').trim();
		if (/^Thí sinh \d+$/.test(full)) { return full; }
		return full.split(/\s+/).slice(-2).join(' ');
	};

	/* Về đích playing order: highest score first, ties by seat number. players: [{seat, score}]. */
	gameVariables.vdOrder = function (players) {
		return (players || []).slice().sort(function (a, b) { return (b.score - a.score) || (a.seat - b.seat); })
			.map(function (p) { return p.seat; });
	};

	/* Seats sharing the highest score (players: [{seat, score}]) - who plays the Câu hỏi phụ. */
	gameVariables.topScoreSeats = function (players) {
		var list = players || [];
		if (!list.length) { return []; }
		var top = Math.max.apply(null, list.map(function (p) { return p.score; }));
		return list.filter(function (p) { return p.score === top; }).map(function (p) { return p.seat; }).sort();
	};

	/* Tăng tốc ranking. times: { seat: seconds|null }, correctSeats: [seat]. Only correct seats
	 * score; faster first; equal times share the same points and the next distinct time takes the
	 * NEXT rank (no gap): 1.25, 1.25, 2.29 -> 40, 40, 30. A correct seat without a time ranks after
	 * all timed ones. Returns { seat: points }. */
	gameVariables.ttRankPoints = function (times, correctSeats) {
		var rank = gameVariables.Points.TANG_TOC_RANK;
		var list = (correctSeats || []).map(function (seat) {
			var t = times && times[seat];
			return { seat: seat, t: (typeof t === 'number' && !isNaN(t)) ? t : Infinity };
		}).sort(function (a, b) { return a.t - b.t; });
		var out = {}, level = -1, prev = null;
		list.forEach(function (e) {
			if (prev === null || e.t !== prev) { level += 1; prev = e.t; }
			out[e.seat] = rank[Math.min(level, rank.length - 1)] || 0;
		});
		return out;
	};

	/* Answer auto-check: case, punctuation and spacing do not matter; "a / b" in the XML answer
	 * accepts either. */
	gameVariables.normalizeAnswer = function (s) {
		return String(s || '').normalize('NFC').toLowerCase()
			.replace(/[.,;:!?'"“”‘’\-–—_()\[\]\/\\]+/g, ' ')
			.replace(/\s+/g, ' ').trim();
	};
	gameVariables.answerMatches = function (given, expected) {
		var g = gameVariables.normalizeAnswer(given);
		if (!g) { return false; }
		var alts = [String(expected || '')];
		String(expected || '').split(/[\/,;]|\(|\)/).forEach(function (a) { alts.push(a); });
		return alts.some(function (a) { var e = gameVariables.normalizeAnswer(a); return e && e === g; });
	};

	/* Letters that count toward a VCNV answer length: everything except whitespace. */
	gameVariables.vcnvLength = function (text) { return String(text || '').replace(/\s+/g, '').length; };

})(window.GameVariables = window.GameVariables || {});
