

const BeatEngine = (() => {

    /* ── Playback ───────────────────────────────────────── */

    let _playbackTimeouts = [];
    let _playbackRafId = null;
    let _playbackStart = 0;
    let _playbackDuration = 0;

    /**
     * Play a beat array on a given square element.
     * @param {HTMLElement} squareEl  – element that gets .lit toggled
     * @param {Array}       beats     – [[startMs, durMs], ...]
     * @param {Object}      opts
     *   opts.onProgress(pct)         – called during playback with 0‒1 progress
     *   opts.onEnd()                 – called when the last beat finishes
     * @returns {{ stop: Function }}  – call .stop() to abort
     */
    function play(squareEl, beats, opts = {}) {
        stop(); // clear any prior playback

        if (!beats || beats.length === 0) {
            opts.onEnd?.();
            return { stop };
        }

        // Compute total duration (last beat end)
        _playbackDuration = beats.reduce((max, [s, d]) => Math.max(max, s + d), 0);
        _playbackStart = performance.now();

        // Schedule each beat
        beats.forEach(([startMs, durMs]) => {
            const tOn = setTimeout(() => {
                squareEl.classList.add('lit');
            }, startMs);

            const tOff = setTimeout(() => {
                squareEl.classList.remove('lit');
            }, startMs + durMs);

            _playbackTimeouts.push(tOn, tOff);
        });

        // End callback
        const tEnd = setTimeout(() => {
            squareEl.classList.remove('lit');
            cancelAnimationFrame(_playbackRafId);
            opts.onEnd?.();
        }, _playbackDuration + 30); // small buffer
        _playbackTimeouts.push(tEnd);

        // Progress ticker
        if (opts.onProgress) {
            const tick = () => {
                const elapsed = performance.now() - _playbackStart;
                const pct = Math.min(elapsed / _playbackDuration, 1);
                opts.onProgress(pct);
                if (pct < 1) {
                    _playbackRafId = requestAnimationFrame(tick);
                }
            };
            _playbackRafId = requestAnimationFrame(tick);
        }

        return { stop };
    }

    function stop() {
        _playbackTimeouts.forEach(clearTimeout);
        _playbackTimeouts = [];
        cancelAnimationFrame(_playbackRafId);
    }


    /* ── Recording ──────────────────────────────────────── */

    let _recording = false;
    let _recordStart = 0;
    let _recordBeats = [];
    let _currentBeatStart = null;
    let _recordLimit = 30000; // 30 seconds
    let _recordRafId = null;
    let _recordTimerTimeout = null;
    let _recordCallbacks = {};
    let _recordSquare = null;

    /**
     * Begin a recording session.
     * The user presses/holds the squareEl; releases create beat entries.
     * @param {HTMLElement} squareEl
     * @param {Object} opts

     */
    function startRecording(squareEl, opts = {}) {
        stopRecording();

        _recordLimit = opts.maxDuration || 30000;
        _recordCallbacks = opts;
        _recordSquare = squareEl;
        _recording = true;
        _recordStart = performance.now();
        _recordBeats = [];
        _currentBeatStart = null;

        squareEl.classList.add('recording');

        // Pointer events
        squareEl.addEventListener('pointerdown', _onPointerDown);
        squareEl.addEventListener('pointerup', _onPointerUp);
        squareEl.addEventListener('pointerleave', _onPointerUp);
        squareEl.addEventListener('pointercancel', _onPointerUp);

        // Timer tick
        const tick = () => {
            if (!_recording) return;
            const elapsed = performance.now() - _recordStart;
            opts.onTick?.(elapsed);
            if (elapsed >= _recordLimit) {
                _finishCurrentBeat();
                stopRecording();
                return;
            }
            _recordRafId = requestAnimationFrame(tick);
        };
        _recordRafId = requestAnimationFrame(tick);

        // Hard limit timeout
        _recordTimerTimeout = setTimeout(() => {
            if (_recording) {
                _finishCurrentBeat();
                stopRecording();
            }
        }, _recordLimit + 50);
    }

    function _onPointerDown(e) {
        if (!_recording) return;
        e.preventDefault();
        _recordSquare.classList.add('lit');
        _currentBeatStart = performance.now() - _recordStart;
    }

    function _onPointerUp(e) {
        if (!_recording) return;
        e.preventDefault();
        _finishCurrentBeat();
    }

    function _finishCurrentBeat() {
        if (_currentBeatStart === null) return;
        const now = performance.now() - _recordStart;
        const dur = now - _currentBeatStart;
        if (dur > 15) { // ignore tiny accidental taps < 15ms
            _recordBeats.push([Math.round(_currentBeatStart), Math.round(dur)]);
        }
        _currentBeatStart = null;
        _recordSquare?.classList.remove('lit');
    }

    function stopRecording() {
        if (!_recording && _recordBeats.length === 0) return;
        _recording = false;
        cancelAnimationFrame(_recordRafId);
        clearTimeout(_recordTimerTimeout);

        if (_recordSquare) {
            _recordSquare.classList.remove('recording', 'lit');
            _recordSquare.removeEventListener('pointerdown', _onPointerDown);
            _recordSquare.removeEventListener('pointerup', _onPointerUp);
            _recordSquare.removeEventListener('pointerleave', _onPointerUp);
            _recordSquare.removeEventListener('pointercancel', _onPointerUp);
        }

        _recordCallbacks.onEnd?.([..._recordBeats]);
    }

    function isRecording() { return _recording; }
    function getRecordedBeats() { return [..._recordBeats]; }


    /* ── Public API ─────────────────────────────────────── */
    return {
        play,
        stop,
        startRecording,
        stopRecording,
        isRecording,
        getRecordedBeats,
    };

})();
