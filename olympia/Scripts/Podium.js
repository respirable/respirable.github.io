/*
 * Olympia Controller - one contestant's score screen: podium.html?room=CODE&seat=N.
 * No account, no password: the room code is enough (it shows only what the stage shows), and
 * no stage needs to be open (the last saved state is shown until a live one arrives).
 * Name and score come from the public state, written exactly as the stage's F6 board writes
 * them (ScoreBoardScreenControl.js refreshBoardScreen: display name in capitals, rounded score).
 */
(function () {
	var $ = function (s) { return document.querySelector(s); };
	var params = new URLSearchParams(location.search);
	var code = (params.get('room') || '').trim().toUpperCase();
	var seat = parseInt(params.get('seat'), 10);
	var room = null, everHeard = false;

	function status(text) { $('#status').textContent = text || ''; }

	function onState(snap) {
		everHeard = true;
		var p = (snap.players || []).filter(function (x) { return x.seat === seat; })[0];
		if (!p) { return; }
		var name = String(p.displayName || ('Thí sinh ' + seat)).toUpperCase();
		/* during the Câu hỏi phụ no score is shown (same as the stage's name-only bars) */
		var tb = snap.roundState && snap.roundState.tb;
		var hideScore = snap.currentRound === 'tb' && tb && ['ready', 'set', 'question', 'timer', 'closed'].indexOf(tb.phase) !== -1;
		var score = hideScore ? '' : String(Math.round(p.score || 0));
		/* a seat not in the Câu hỏi phụ: the same card, empty */
		if (hideScore && (tb.seats || []).indexOf(seat) === -1) { name = ''; }
		if ($('#name').textContent !== name) { $('#name').textContent = name; }
		if ($('#score').textContent !== score) { $('#score').textContent = score; }
		document.title = 'Bảng điểm ' + seat + (name ? ' — ' + name : '');
	}

	function start() {
		if (!/^[A-Z0-9]{4,12}$/.test(code) || !(seat >= 1 && seat <= 4)) {
			status('Link chưa đúng: cần dạng podium.html?room=MÃPHÒNG&seat=1 (ghế 1-4).');
			return;
		}
		$('#name').textContent = 'THÍ SINH ' + seat;
		/* Works with no stage open: the state the stage last saved comes first, live updates
		 * follow whenever a stage runs the room. Only a real problem shows a strip. */
		room = window.OlympiaPublicRoom.connect(code, {
			presence: { role: 'podium', seat: seat },   /* the control panel shows this podium as connected */
			onState: onState,
			onStatus: function (st, detail) {
				if (st === 'error') { status(detail); }
				else if (st === 'offline') { status(everHeard ? '' : 'Không kết nối được phòng ' + code + ' - kiểm tra mã phòng / mạng.'); }
				else { status(''); }
			}
		});
	}

	start();
})();
