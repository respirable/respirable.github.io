/* ═══════════════════════════════════════════════════════════
   app.js — Main application controller
   No home screen. Launches straight into a sample level,
   or loads from URL hash if present.
   ═══════════════════════════════════════════════════════════ */

(() => {
    'use strict';

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    /* ── DOM refs ───────────────────────────────────────── */

    // Views
    const viewPlay   = $('#view-play');
    const viewCreate = $('#view-create');

    // Play
    const beatSquare      = $('#beat-square');
    const beatProgressBar = $('#beat-progress-bar');
    const btnReplay       = $('#btn-replay');
    const playHint        = $('#play-hint');
    const answersContainer = $('#answers-container');
    const answerBtns      = $$('.answer-btn');

    // Reveal
    const revealArea       = $('#reveal-area');
    const revealResult     = $('#reveal-result');
    const revealAnswer     = $('#reveal-answer');
    const revealVideoWrap  = $('#reveal-video-wrap');
    const revealSyncRow    = $('#reveal-sync-row');
    const revealBeatSquare = $('#reveal-beat-square');
    const btnPlayWithMusic = $('#btn-play-with-music');
    const btnNextLevel     = $('#btn-next-level');
    const btnGoCreate      = $('#btn-go-create');

    // Nav links
    const linkToCreate = $('#link-to-create');
    const linkToPlay   = $('#link-to-play');

    // Create
    const inputYtUrl      = $('#input-yt-url');
    const inputStartTime  = $('#input-start-time');
    const recordBeatSquare = $('#record-beat-square');
    const recorderTimer   = $('#recorder-timer');
    const btnStartRecord  = $('#btn-start-record');
    const btnPreviewRecord = $('#btn-preview-record');
    const btnResetRecord  = $('#btn-reset-record');
    const btnKeybind      = $('#btn-keybind');
    const btnGenerateLink = $('#btn-generate-link');
    const shareOutput     = $('#share-output');
    const inputShareLink  = $('#input-share-link');
    const btnCopyLink     = $('#btn-copy-link');
    const copyToast       = $('#copy-toast');
    const inputHint       = $('#input-hint');
    const btnShowHint     = $('#btn-show-hint');
    const hintDisplay     = $('#hint-display');
    const diffIcon        = $('#diff-icon');
    const qTabsContainer  = $('#q-tabs-container');
    const btnAddQTab      = $('#btn-add-q-tab');


    /* ── State ──────────────────────────────────────────── */
    let currentLevel = null;
    let currentLevelIndex = 0;
    let recordedBeats = [];
    let hasAnswered = false;
    let revealSyncRaf = null;

    // Keybind state
    let recordKeybind = localStorage.getItem('beatguess-keybind') || 'Enter';
    let isListeningForKeybind = false;
    btnKeybind.textContent = recordKeybind;

    let selectedDiff = 'easy';
    let customLevelsList = [];
    let currentEditIndex = 0;


    /* ── View navigation ────────────────────────────────── */
    function showView(view) {
        [viewPlay, viewCreate].forEach(v => v.classList.add('hidden'));
        view.classList.remove('hidden');
        // Re-trigger animation
        view.style.animation = 'none';
        view.offsetHeight; // force reflow
        view.style.animation = '';
        window.scrollTo(0, 0);
    }


    /* ── Play mode ──────────────────────────────────────── */
    function loadLevel(level) {
        currentLevel = level;
        hasAnswered = false;

        // Reset UI
        revealArea.classList.add('hidden');
        revealVideoWrap.classList.add('hidden');
        revealSyncRow.classList.add('hidden');
        beatSquare.classList.remove('lit');
        beatProgressBar.style.width = '0%';
        playHint.textContent = '';
        hintDisplay.classList.add('hidden');
        hintDisplay.textContent = '';

        if (level.h) {
            btnShowHint.classList.remove('hidden');
        } else {
            btnShowHint.classList.add('hidden');
        }
        
        diffIcon.src = `/images/${level.d || 'normal'}.png`;

        answerBtns.forEach((btn, i) => {
            btn.textContent = level.o[i];
            btn.className = 'answer-btn';
            btn.disabled = false;
        });

        showView(viewPlay);

        // Auto-play rhythm after brief pause
        setTimeout(() => playBeat(), 400);
    }

    function playBeat() {
        if (!currentLevel) return;
        BeatEngine.stop();
        beatSquare.classList.remove('lit');
        beatProgressBar.style.width = '0%';
        playHint.textContent = '';
        
        BeatEngine.play(beatSquare, currentLevel.b, {
            onProgress: (pct) => {
                beatProgressBar.style.width = (pct * 100) + '%';
            },
            onEnd: () => {
                beatProgressBar.style.width = '100%';
                playHint.textContent = 'your turn — pick one.';
            },
        });
    }

    function handleAnswer(index) {
        if (hasAnswered) return;
        hasAnswered = true;

        const correct = index === currentLevel.a;

        answerBtns.forEach((btn, i) => {
            if (i === currentLevel.a) {
                btn.classList.add('correct');
            } else if (i === index && !correct) {
                btn.classList.add('wrong');
            } else {
                btn.classList.add('dimmed');
            }
            btn.disabled = true;
        });

        setTimeout(() => showReveal(correct), 900);
    }


    /* ── Reveal ─────────────────────────────────────────── */
    function showReveal(correct) {
        BeatEngine.stop();

        revealResult.textContent = correct ? '🎉 correct!' : '😬 nope.';
        revealResult.className = 'reveal-result ' + (correct ? 'correct' : 'wrong');
        revealAnswer.textContent = 'answer: ' + currentLevel.o[currentLevel.a];

        if (currentLevelIndex >= SampleLevels.length - 1) {
            btnNextLevel.textContent = '↻ restart';
        } else {
            btnNextLevel.textContent = 'next →';
        }

        // Show video section only if level has a YouTube video
        if (currentLevel.v) {
            revealVideoWrap.classList.remove('hidden');
            revealSyncRow.classList.remove('hidden');
            YTPlayer.init('yt-player-container', currentLevel.v);
        } else {
            revealVideoWrap.classList.add('hidden');
            revealSyncRow.classList.add('hidden');
        }

        revealArea.classList.remove('hidden');

        // Scroll reveal into view
        setTimeout(() => {
            revealArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }

    function playRevealSync() {
        if (!currentLevel || !currentLevel.v) return;

        const startSec = currentLevel.s || 0;
        YTPlayer.playFrom(startSec);

        revealBeatSquare.classList.remove('lit');
        cancelAnimationFrame(revealSyncRaf);

        const beats = currentLevel.b;
        const totalDur = beats.reduce((max, [s, d]) => Math.max(max, s + d), 0);

        const syncTick = () => {
            const vt = YTPlayer.getCurrentTime();
            const elapsed = (vt - startSec) * 1000;

            if (elapsed > totalDur + 500) {
                revealBeatSquare.classList.remove('lit');
                return;
            }

            let isLit = false;
            for (const [s, d] of beats) {
                if (elapsed >= s && elapsed < s + d) {
                    isLit = true;
                    break;
                }
            }
            revealBeatSquare.classList.toggle('lit', isLit);
            revealSyncRaf = requestAnimationFrame(syncTick);
        };

        setTimeout(() => {
            revealSyncRaf = requestAnimationFrame(syncTick);
        }, 300);
    }

    function nextLevel() {
        cancelAnimationFrame(revealSyncRaf);
        YTPlayer.stopVideo();
        BeatEngine.stop();

        currentLevelIndex = (currentLevelIndex + 1) % SampleLevels.length;
        loadLevel(SampleLevels[currentLevelIndex]);
    }


    /* ── Create mode ────────────────────────────────────── */
    function resetCreateForm() {
        recordedBeats = [];
        inputYtUrl.value = '';
        inputStartTime.value = '0';
        inputHint.value = '';
        $$('.answer-row input[type="text"]').forEach(i => { i.value = ''; });
        $('#radio-0').checked = true;
        
        // Reset difficulty selector
        $$('.diff-option').forEach(el => el.classList.remove('selected'));
        $('.diff-option[data-diff="easy"]').classList.add('selected');
        selectedDiff = 'easy';

        recorderTimer.textContent = '0.0s / 30.0s';
        recordBeatSquare.classList.remove('lit', 'recording');
        btnPreviewRecord.disabled = true;
        btnResetRecord.disabled = true;
        shareOutput.classList.add('hidden');
        btnStartRecord.textContent = '⏺ start recording';
        btnStartRecord.disabled = false;
    }

    function saveCurrentTab() {
        customLevelsList[currentEditIndex] = {
            ytUrl: inputYtUrl.value.trim(),
            ytStart: inputStartTime.value,
            b: [...recordedBeats],
            o: [
                $('#input-answer-0').value.trim() || 'Option A',
                $('#input-answer-1').value.trim() || 'Option B',
                $('#input-answer-2').value.trim() || 'Option C',
                $('#input-answer-3').value.trim() || 'Option D',
            ],
            a: parseInt($('input[name="correct-answer"]:checked').value),
            h: inputHint.value.trim(),
            d: selectedDiff
        };
    }

    function loadTab(idx) {
        currentEditIndex = idx;
        const data = customLevelsList[idx] || {};

        inputYtUrl.value = data.ytUrl || '';
        inputStartTime.value = data.ytStart || '0';
        recordedBeats = data.b ? [...data.b] : [];
        if (data.o) {
            $('#input-answer-0').value = data.o[0] || '';
            $('#input-answer-1').value = data.o[1] || '';
            $('#input-answer-2').value = data.o[2] || '';
            $('#input-answer-3').value = data.o[3] || '';
        } else {
            $$('.answer-row input[type="text"]').forEach(i => { i.value = ''; });
        }
        $(`#radio-${data.a !== undefined ? data.a : 0}`).checked = true;
        inputHint.value = data.h || '';

        $$('.diff-option').forEach(el => el.classList.remove('selected'));
        selectedDiff = data.d || 'easy';
        const matchingDiffEl = $(`.diff-option[data-diff="${selectedDiff}"]`);
        if (matchingDiffEl) matchingDiffEl.classList.add('selected');

        if (recordedBeats.length > 0) {
            btnPreviewRecord.disabled = false;
            btnResetRecord.disabled = false;
            const totalDurMs = recordedBeats.reduce((max, [s, d]) => Math.max(max, s + d), 0);
            recorderTimer.textContent = (totalDurMs / 1000).toFixed(1) + 's / 30.0s';
        } else {
            recorderTimer.textContent = '0.0s / 30.0s';
            btnPreviewRecord.disabled = true;
            btnResetRecord.disabled = true;
        }

        renderTabs();
    }

    function renderTabs() {
        // Clear all tabs except the Add button which might be re-injected
        qTabsContainer.innerHTML = '';
        const numTabs = Math.max(customLevelsList.length, 1);
        
        for (let i = 0; i < numTabs; i++) {
            const btn = document.createElement('button');
            btn.className = 'q-tab' + (i === currentEditIndex ? ' active' : '');
            btn.textContent = 'Q' + (i + 1);
            btn.addEventListener('click', () => {
                saveCurrentTab();
                loadTab(i);
            });
            qTabsContainer.appendChild(btn);
        }

        if (numTabs < 5) {
            const addBtn = document.createElement('button');
            addBtn.className = 'q-tab add';
            addBtn.title = 'Add Question';
            addBtn.textContent = '+';
            addBtn.addEventListener('click', () => {
                saveCurrentTab();
                loadTab(numTabs);
            });
            qTabsContainer.appendChild(addBtn);
        }
    }

    function resetCreateView() {
        customLevelsList = [];
        resetCreateForm();
        shareOutput.classList.add('hidden');
        recordBeatSquare.classList.remove('lit', 'recording');
        btnStartRecord.textContent = '⏺ start recording';
        btnStartRecord.disabled = false;
        
        loadTab(0);
    }

    function handleStartRecord() {
        if (BeatEngine.isRecording()) {
            BeatEngine.stopRecording();
            return;
        }

        recordedBeats = [];
        btnStartRecord.textContent = '⏹ stop';
        btnPreviewRecord.disabled = true;
        btnResetRecord.disabled = true;

        BeatEngine.startRecording(recordBeatSquare, {
            maxDuration: 30000,
            onTick: (elapsedMs) => {
                recorderTimer.textContent =
                    (elapsedMs / 1000).toFixed(1) + 's / 30.0s';
            },
            onEnd: (beats) => {
                recordedBeats = beats;
                btnStartRecord.textContent = '⏺ start recording';
                btnStartRecord.disabled = false;
                btnPreviewRecord.disabled = beats.length === 0;
                btnResetRecord.disabled = beats.length === 0;
                if (beats.length === 0) {
                    recorderTimer.textContent = '0.0s / 30.0s';
                }
            },
        });
    }

    function handlePreviewRecord() {
        if (recordedBeats.length === 0) return;
        BeatEngine.play(recordBeatSquare, recordedBeats, {
            onEnd: () => { recordBeatSquare.classList.remove('lit'); }
        });
    }

    function handleResetRecord() {
        BeatEngine.stop();
        BeatEngine.stopRecording();
        recordedBeats = [];
        recorderTimer.textContent = '0.0s / 30.0s';
        recordBeatSquare.classList.remove('lit', 'recording');
        btnPreviewRecord.disabled = true;
        btnResetRecord.disabled = true;
        btnStartRecord.textContent = '⏺ start recording';
        btnStartRecord.disabled = false;
    }

    function handleGenerateLink() {
        saveCurrentTab();

        let finalLevels = [];
        for (let i = 0; i < customLevelsList.length; i++) {
            const data = customLevelsList[i];
            
            // Skip totally empty questions
            if (!data || !data.b || data.b.length === 0) continue;

            let videoId = null;
            if (data.ytUrl) {
                videoId = Share.extractVideoId(data.ytUrl);
                if (!videoId) {
                    alert(`Q${i+1}: Invalid YouTube link! Please fix or remove it.`);
                    loadTab(i);
                    return;
                }
            }

            for (let j = 0; j < 4; j++) {
                if (!data.o[j]) {
                    alert(`Q${i+1}: Please fill in option ${String.fromCharCode(65 + j)}.`);
                    loadTab(i);
                    return;
                }
            }

            const levelData = {
                o: data.o,
                a: data.a,
                b: data.b,
                d: data.d,
            };

            if (data.h) levelData.h = data.h;

            if (videoId) {
                levelData.v = videoId;
                levelData.s = parseFloat(data.ytStart) || 0;
            }
            
            finalLevels.push(levelData);
        }

        if (finalLevels.length === 0) {
            alert("you haven't correctly recorded any beats in any question yet!");
            return;
        }

        const url = Share.buildUrl(finalLevels);
        inputShareLink.value = url;
        shareOutput.classList.remove('hidden');

        setTimeout(() => {
            shareOutput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }

    function handleCopyLink() {
        inputShareLink.select();
        navigator.clipboard.writeText(inputShareLink.value).then(() => {
            copyToast.classList.remove('hidden');
            setTimeout(() => copyToast.classList.add('hidden'), 2000);
        });
    }


    /* ── Keybind system ─────────────────────────────────── */
    function startKeybindListen() {
        isListeningForKeybind = true;
        btnKeybind.textContent = '...';
        btnKeybind.classList.add('listening');
    }

    function setKeybind(key) {
        recordKeybind = key;
        localStorage.setItem('beatguess-keybind', key);
        btnKeybind.textContent = key;
        btnKeybind.classList.remove('listening');
        isListeningForKeybind = false;
    }

    // Global keydown handler
    document.addEventListener('keydown', (e) => {
        // Keybind reassignment mode
        if (isListeningForKeybind) {
            e.preventDefault();
            setKeybind(e.key);
            return;
        }

        // Don't trigger keybind when typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Keybind triggers record start/stop in Create view
        if (e.key === recordKeybind && !viewCreate.classList.contains('hidden')) {
            e.preventDefault();
            handleStartRecord();
        }
    });


    /* ── Event wiring ───────────────────────────────────── */

    // Play view
    btnReplay.addEventListener('click', playBeat);
    btnShowHint.addEventListener('click', () => {
        hintDisplay.textContent = currentLevel?.h || 'no hint available.';
        hintDisplay.classList.toggle('hidden');
    });
    answerBtns.forEach(btn => {
        btn.addEventListener('click', () => handleAnswer(parseInt(btn.dataset.index)));
    });

    // Reveal
    btnPlayWithMusic.addEventListener('click', playRevealSync);
    btnNextLevel.addEventListener('click', nextLevel);
    btnGoCreate.addEventListener('click', () => {
        cancelAnimationFrame(revealSyncRaf);
        YTPlayer.stopVideo();
        BeatEngine.stop();
        resetCreateView();
        showView(viewCreate);
    });

    // Nav links
    linkToCreate.addEventListener('click', (e) => {
        e.preventDefault();
        BeatEngine.stop();
        resetCreateView();
        showView(viewCreate);
    });
    linkToPlay.addEventListener('click', (e) => {
        e.preventDefault();
        BeatEngine.stop();
        BeatEngine.stopRecording();
        // Pick a random sample
        currentLevelIndex = Math.floor(Math.random() * SampleLevels.length);
        loadLevel(SampleLevels[currentLevelIndex]);
    });

    btnStartRecord.addEventListener('click', handleStartRecord);
    btnPreviewRecord.addEventListener('click', handlePreviewRecord);
    btnResetRecord.addEventListener('click', handleResetRecord);
    btnKeybind.addEventListener('click', startKeybindListen);
    btnGenerateLink.addEventListener('click', handleGenerateLink);
    btnCopyLink.addEventListener('click', handleCopyLink);

    $$('.diff-option').forEach(opt => {
        opt.addEventListener('click', () => {
            $$('.diff-option').forEach(el => el.classList.remove('selected'));
            opt.classList.add('selected');
            selectedDiff = opt.dataset.diff;
        });
    });


    /* ── Init ───────────────────────────────────────────── */
    function init() {
        // Check URL for a shared level
        const sharedLevels = Share.readFromUrl();
        if (sharedLevels && sharedLevels.length > 0) {
            SampleLevels.splice(0, SampleLevels.length, ...sharedLevels);
            currentLevelIndex = 0;
            loadLevel(SampleLevels[0]);
            return;
        }

        // Check if URL has #create
        if (window.location.hash === '#create') {
            resetCreateForm();
            showView(viewCreate);
            return;
        }

        // Default: play a random sample immediately
        currentLevelIndex = Math.floor(Math.random() * SampleLevels.length);
        loadLevel(SampleLevels[currentLevelIndex]);
    }

    window.addEventListener('hashchange', () => {
        const sharedLevels = Share.readFromUrl();
        if (sharedLevels && sharedLevels.length > 0) {
            cancelAnimationFrame(revealSyncRaf);
            YTPlayer.stopVideo();
            BeatEngine.stop();
            SampleLevels.splice(0, SampleLevels.length, ...sharedLevels);
            currentLevelIndex = 0;
            loadLevel(SampleLevels[0]);
        }
    });

    init();

})();
