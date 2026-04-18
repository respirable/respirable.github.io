/* ═══════════════════════════════════════════════════════════
   share.js — Encode / Decode level data into shareable URLs
   Uses LZString for compression.
   ═══════════════════════════════════════════════════════════ */

const Share = (() => {

    /**
     * Level data shape:
     * {
     *   v: string|null,     // YouTube video ID (optional, null = no video)
     *   s: number,          // start time in seconds (only relevant if v exists)
     *   o: string[4],       // 4 answer options
     *   a: number,          // correct answer index (0-3)
     *   b: number[][],      // beat array [[startMs, durMs], ...]
     * }
     */

    function encode(levelData) {
        const json = JSON.stringify(levelData);
        return LZString.compressToEncodedURIComponent(json);
    }

    function decode(encoded) {
        try {
            const json = LZString.decompressFromEncodedURIComponent(encoded);
            if (!json) return null;
            let data = JSON.parse(json);
            
            // Backwards compatibility: if it's a single object, wrap it in an array
            if (!Array.isArray(data)) {
                data = [data];
            }
            
            // Validate all levels in the array
            for (const level of data) {
                if (!Array.isArray(level.o) || !Array.isArray(level.b)) return null;
            }
            
            return data;
        } catch (e) {
            console.warn('Share.decode failed:', e);
            return null;
        }
    }

    function buildUrl(levelData) {
        const encoded = encode(levelData);
        const base = window.location.origin + window.location.pathname;
        return base + '#q=' + encoded;
    }

    function readFromUrl() {
        const hash = window.location.hash;
        if (!hash.startsWith('#q=')) return null;
        const encoded = hash.slice(3);
        return decode(encoded);
    }

    /**
     * Extract YouTube video ID from various URL formats.
     * Returns null if input is empty/blank (intentionally optional).
     */
    function extractVideoId(input) {
        if (!input || !input.trim()) return null;
        input = input.trim();

        const patterns = [
            /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
            /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
            /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        ];
        for (const re of patterns) {
            const m = input.match(re);
            if (m) return m[1];
        }

        if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

        return null;
    }

    return { encode, decode, buildUrl, readFromUrl, extractVideoId };

})();
