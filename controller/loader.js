/**
 * loader.js — Cloud Bundle Fetcher for WWTBAM Controller Sandbox
 * Downloads the controller .zip from a cloud host (GitHub Releases / Cloudflare R2),
 * extracts files using JSZip, and saves them to IndexedDB.
 */

/** MIME type lookup based on file extension */
/* Must stay in sync with MIME_TYPES in sw.js:25-51 — see docs/variant-contract.md §4. */
const LOADER_MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject',
    '.txt': 'text/plain; charset=utf-8',
    '.url': 'text/plain; charset=utf-8',
};

function getLoaderMimeType(path) {
    const ext = '.' + path.split('.').pop().toLowerCase();
    return LOADER_MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Auto-patch HTML and JS contents for sandbox compatibility.
 */
function patchSandboxContent(content, normalizedName) {
    // Fix 1: Stop synchronous AJAX deadlocks (required for Service Workers)
    content = content.replace(/async:\s*false/g, 'async: true');

    // Fix 2: Keep question XML inside the sandbox so edited IndexedDB files are used.
    content = content.replace(/https:\/\/pub-2d06308cf53245df865e113b0745c6d9\.r2\.dev\/questions\.xml/gi, '/controller/sandbox/questions/questions.xml');
    content = content.replace(/https:\/\/pub-2d06308cf53245df865e113b0745c6d9\.r2\.dev\/switchQuestions\.xml/gi, '/controller/sandbox/questions/switchQuestions.xml');

    // Fix 3: Inject Backspace/Esc Relay for Sandbox and Topbar Controls
    if (normalizedName.endsWith('.html') || normalizedName.endsWith('.htm')) {
        const relayScript = `
        <script>
        document.addEventListener('keydown', (e) => {
            const t = (e.target.tagName || "").toLowerCase();
            const isInput = t === "input" || t === "textarea" || e.target.isContentEditable;
            
            if (e.key === "Backspace" && !isInput) {
                e.preventDefault();
                window.parent.postMessage({ type: "toggle-topbar" }, "*");
            }
            if (e.key === "Escape" && !isInput) {
                e.preventDefault();
                window.parent.postMessage({ type: "toggle-devbar" }, "*");
            }
            if (e.code === "Backquote") {
                e.preventDefault(); // Dead-key silent guard
            }
        });
        </script>`;
        if (/<\/body>/i.test(content)) {
            content = content.replace(/<\/body>/i, relayScript + '</body>');
        } else {
            content += relayScript;
        }
    }
    return content;
}

/**
 * Extract files from an ArrayBuffer archive (ZIP or RAR).
 * @param {ArrayBuffer} arrayBuffer 
 * @returns {Promise<Array<{ path: string, isText: boolean, getText: () => Promise<string>, getBlob: () => Promise<Blob> }>>}
 */
async function extractArchiveEntries(arrayBuffer) {
    const uint8 = new Uint8Array(arrayBuffer);
    const isRar = uint8.length >= 4 && uint8[0] === 0x52 && uint8[1] === 0x61 && uint8[2] === 0x72 && uint8[3] === 0x21;

    if (isRar) {
        // Load node-unrar-js standalone bundle with resolved imports
        const { createExtractorFromData } = await import('https://esm.sh/node-unrar-js@2.0.2/es2022/node-unrar-js.bundle.mjs');
        let wasmRes = await fetch('https://cdn.jsdelivr.net/npm/node-unrar-js@2.0.2/esm/js/unrar.wasm').catch(() => null);
        if (!wasmRes || !wasmRes.ok) {
            wasmRes = await fetch('https://unpkg.com/node-unrar-js@2.0.2/esm/js/unrar.wasm');
        }
        if (!wasmRes.ok) {
            throw new Error('Failed to fetch unrar WASM binary: ' + wasmRes.statusText);
        }
        const wasmBinary = await wasmRes.arrayBuffer();
        const extractor = await createExtractorFromData({ data: arrayBuffer, wasmBinary });
        const extracted = extractor.extract();

        const results = [];
        for (const file of extracted.files) {
            const header = file.fileHeader;
            if (header.flags && header.flags.directory) continue;
            if (!file.extraction) continue;

            const normalizedPath = header.name.replace(/\\/g, '/');
            const dataBytes = file.extraction;
            const ext = normalizedPath.split('.').pop().toLowerCase();
            const isText = ['js', 'html', 'htm', 'css', 'json', 'xml', 'txt'].includes(ext);

            results.push({
                path: normalizedPath,
                isText,
                getText: async () => new TextDecoder('utf-8').decode(dataBytes),
                getBlob: async () => new Blob([dataBytes], { type: getLoaderMimeType(normalizedPath) })
            });
        }
        return results;
    } else {
        // ZIP format via JSZip
        const zip = await JSZip.loadAsync(arrayBuffer);
        const entries = Object.keys(zip.files);
        const results = [];

        for (const entryName of entries) {
            const entry = zip.files[entryName];
            if (entry.dir) continue;
            const normalizedPath = entryName.replace(/\\/g, '/');
            const ext = normalizedPath.split('.').pop().toLowerCase();
            const isText = ['js', 'html', 'htm', 'css', 'json', 'xml', 'txt'].includes(ext);

            results.push({
                path: normalizedPath,
                isText,
                getText: async () => entry.async('string'),
                getBlob: async () => entry.async('blob')
            });
        }
        return results;
    }
}

/**
 * Load the controller bundle into IndexedDB.
 * @param {string} zipUrl - URL to the controller .zip or .rar file
 * @param {function} onProgress - Callback with (loaded, total) for progress updates
 * @returns {Promise<number>} - Number of files saved
 */
async function loadBundle(zipUrl, onProgress) {
    // Step 1: Download the archive with progress tracking
    const response = await fetch(zipUrl);
    if (!response.ok) {
        throw new Error('Failed to download bundle: ' + response.statusText);
    }

    const contentLength = response.headers.get('Content-Length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (onProgress) onProgress(loaded, total);
    }

    const blob = new Blob(chunks);
    const arrayBuffer = await blob.arrayBuffer();

    // Step 2: Extract files from archive (ZIP or RAR)
    const archiveEntries = await extractArchiveEntries(arrayBuffer);
    const paths = archiveEntries.map(e => e.path);

    // Find root prefix by looking for default.html or index.html
    let rootPrefix = '';
    const defaultIndex = paths.findIndex(p => {
        const lower = p.toLowerCase();
        return lower.endsWith('default.html') || lower.endsWith('default.htm') || lower.endsWith('index.html') || lower.endsWith('index.htm');
    });

    if (defaultIndex !== -1) {
        const fullPath = paths[defaultIndex];
        const slashIdx = fullPath.lastIndexOf('/');
        rootPrefix = slashIdx !== -1 ? fullPath.substring(0, slashIdx + 1) : '';
    } else {
        // Fallback: try to find common top-level folder
        if (paths.length > 0 && paths[0].includes('/')) {
            const candidate = paths[0].split('/')[0] + '/';
            if (paths.every(p => p.startsWith(candidate))) {
                rootPrefix = candidate;
            }
        }
    }

    // Step 3: Save each file to IndexedDB
    let savedCount = 0;

    for (const entry of archiveEntries) {
        const normalizedName = entry.path;
        const relativePath = normalizedName.startsWith(rootPrefix)
            ? normalizedName.substring(rootPrefix.length)
            : normalizedName;

        if (!relativePath) continue;

        let fileData;
        if (entry.isText) {
            let content = await entry.getText();
            content = patchSandboxContent(content, relativePath);
            fileData = new Blob([content], { type: getLoaderMimeType(relativePath) });
        } else {
            fileData = await entry.getBlob();
        }

        const mimeType = getLoaderMimeType(relativePath);
        await saveFile(relativePath, fileData, mimeType);
        savedCount++;
    }

    return savedCount;
}

/**
 * Load the controller from local files (for development/testing).
 * Reads files from the _reference folder structure and stores them in IndexedDB.
 * @param {FileList|File[]} files - Files selected via input or drag-and-drop
 * @param {function} onProgress - Callback with (loaded, total)
 * @returns {Promise<number>} - Number of files saved
 */
async function loadFromLocalFiles(files, onProgress) {
    const total = files.length;
    let saved = 0;

    for (const file of files) {
        // Use webkitRelativePath if available (folder upload), otherwise just the name
        let relativePath = file.webkitRelativePath || file.name;

        // Strip the first folder segment (the upload folder name)
        const parts = relativePath.split('/');
        if (parts.length > 1) {
            parts.shift(); // Remove root folder name
            relativePath = parts.join('/');
        }

        if (relativePath) {
            const mimeType = file.type || getLoaderMimeType(relativePath);
            await saveFile(relativePath, file, mimeType);
            saved++;
            if (onProgress) onProgress(saved, total);
        }
    }

    return saved;
}
