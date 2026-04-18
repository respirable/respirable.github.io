/* ═══════════════════════════════════════════════════════════
   youtube.js — YouTube IFrame Player API wrapper
   The API script is loaded lazily (only when needed).
   ═══════════════════════════════════════════════════════════ */

const YTPlayer = (() => {

    let _player = null;
    let _apiLoaded = false;
    let _apiReady = false;
    let _readyPromiseResolve = null;
    let _readyPromise = null;

    /**
     * Ensure the YouTube IFrame API script is loaded.
     * Returns a promise that resolves when the API is ready.
     */
    function _ensureApi() {
        if (_readyPromise) return _readyPromise;

        _readyPromise = new Promise(resolve => {
            _readyPromiseResolve = resolve;

            if (_apiReady) { resolve(); return; }

            // Set global callback before loading script
            window.onYouTubeIframeAPIReady = () => {
                _apiReady = true;
                resolve();
            };

            if (!_apiLoaded) {
                _apiLoaded = true;
                const tag = document.createElement('script');
                tag.src = 'https://www.youtube.com/iframe_api';
                document.head.appendChild(tag);
            }
        });

        return _readyPromise;
    }

    /**
     * Initialise (or re-initialise) the player.
     * @param {string} containerId – DOM id of the container div
     * @param {string} videoId     – YouTube video ID
     * @param {Object} opts
     * @returns {Promise<YT.Player>}
     */
    async function init(containerId, videoId, opts = {}) {
        await _ensureApi();

        // Destroy existing player
        if (_player) {
            try { _player.destroy(); } catch (_) {}
            _player = null;
        }

        return new Promise((resolve) => {
            _player = new YT.Player(containerId, {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: {
                    autoplay: 0,
                    controls: 1,
                    modestbranding: 1,
                    rel: 0,
                    fs: 0,
                },
                events: {
                    onReady: (e) => {
                        opts.onReady?.(e);
                        resolve(_player);
                    },
                    onStateChange: (e) => {
                        opts.onStateChange?.(e);
                    },
                },
            });
        });
    }

    function playFrom(startSeconds) {
        if (!_player) return;
        _player.seekTo(startSeconds, true);
        _player.playVideo();
    }

    function pause() {
        if (!_player) return;
        _player.pauseVideo();
    }

    function stopVideo() {
        if (!_player) return;
        try { _player.stopVideo(); } catch (_) {}
    }

    function getCurrentTime() {
        if (!_player) return 0;
        return _player.getCurrentTime();
    }

    function isPlaying() {
        if (!_player) return false;
        try { return _player.getPlayerState() === YT.PlayerState.PLAYING; } catch (_) { return false; }
    }

    function getPlayer() { return _player; }

    return { init, playFrom, pause, stopVideo, getCurrentTime, isPlaying, getPlayer };

})();
