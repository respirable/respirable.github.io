/**
 * loader.js — Cloud Bundle Fetcher for WWTBAM Controller Sandbox
 * Downloads the controller .zip from a cloud host (GitHub Releases),
 * extracts files using JSZip, and saves them to IndexedDB.
 */

/** MIME type lookup based on file extension */
const LOADER_MIME_TYPES = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.mp4': 'video/mp4',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject',
};

function getLoaderMimeType(path) {
    const ext = '.' + path.split('.').pop().toLowerCase();
    return LOADER_MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Load the controller bundle into IndexedDB.
 * @param {string} zipUrl - URL to the controller .zip file
 * @param {function} onProgress - Callback with (loaded, total) for progress updates
 * @returns {Promise<void>}
 */
async function loadBundle(zipUrl, onProgress) {
    // Step 1: Download the zip with progress tracking
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

    // Step 2: Extract files using JSZip
    const zip = await JSZip.loadAsync(arrayBuffer);
    const entries = Object.keys(zip.files);

    // Normalize all paths within the zip to use forward slashes
    const normalizedEntries = entries.map(e => e.replace(/\\/g, '/'));

    // Find the root folder by looking for where default.html is located
    let rootPrefix = '';
    const defaultIndex = normalizedEntries.findIndex(e => e.endsWith('default.html'));
    if (defaultIndex !== -1) {
        const fullPath = normalizedEntries[defaultIndex];
        rootPrefix = fullPath.substring(0, fullPath.length - 'default.html'.length);
    } else {
        // Fallback: try to find the standard top-level folder
        const firstEntry = normalizedEntries.find((e, idx) => !zip.files[entries[idx]].dir);
        if (firstEntry && firstEntry.includes('/')) {
            const parts = firstEntry.split('/');
            const candidate = parts[0] + '/';
            if (normalizedEntries.every(e => e.startsWith(candidate) || zip.files[entries[normalizedEntries.indexOf(e)]].dir)) {
                rootPrefix = candidate;
            }
        }
    }

    // Step 3: Save each file to IndexedDB
    const fileEntriesIndices = entries.map((e, i) => i).filter(i => !zip.files[entries[i]].dir);
    let savedCount = 0;

    for (const idx of fileEntriesIndices) {
        const entryName = entries[idx];
        const normalizedName = normalizedEntries[idx];
        const extension = normalizedName.split('.').pop().toLowerCase();
        
        let fileData;
        
        // AUTO-PATCHING: Patch legacy synchronous JS calls
        if (extension === 'js' || extension === 'html' || extension === 'htm') {
            let content = await zip.files[entryName].async('string');
            
            // Fix 1: Stop synchronous AJAX deadlocks (required for Service Workers)
            content = content.replace(/async:\s*false/g, 'async: true');
            
            // Fix 2: Force Cloud R2 URLs for questions (per user request)
            content = content.replace(/Questions\/questions\.xml/gi, 'https://pub-2d06308cf53245df865e113b0745c6d9.r2.dev/questions.xml');
            content = content.replace(/Questions\/switchQuestions\.xml/gi, 'https://pub-2d06308cf53245df865e113b0745c6d9.r2.dev/switchQuestions.xml');

            // Fix 3: Inject Backspace Relay for Immersive Mode (In ALL HTML files)
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
                content = content.replace('</body>', relayScript + '</body>');
            }

            fileData = new Blob([content], { type: getLoaderMimeType(normalizedName) });
        } else {
            // Binary files (images, sounds, etc)
            fileData = await zip.files[entryName].async('blob');
        }

        // Strip the root folder prefix to get the relative path
        const relativePath = normalizedName.startsWith(rootPrefix) 
            ? normalizedName.substring(rootPrefix.length) 
            : normalizedName;

        if (relativePath) {
            const mimeType = getLoaderMimeType(relativePath);
            await saveFile(relativePath, fileData, mimeType);
            savedCount++;
        }
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
