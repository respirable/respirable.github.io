/**
 * sw.js — Service Worker for WWTBAM Controller Sandbox
 * Acts as a "Virtual IIS Server" by intercepting fetch requests
 * from the controller iframe and serving files from IndexedDB.
 */

const DB_NAME = 'wwtbam-controller';
const DB_VERSION = 10; // Bump to ensure clean start
const STORE_NAME = 'files';
const CONTROLLER_SCOPE = '/controller/sandbox/';
const R2_HOST = 'pub-2d06308cf53245df865e113b0745c6d9.r2.dev';

// ─── SERVICE WORKER LIFECYCLE ───

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// ─── MIME TYPES ───

const MIME_TYPES = {
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
    '.txt': 'text/plain',
    '.url': 'text/plain',
};

function getMimeType(path) {
    const ext = '.' + path.split('.').pop().toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
}

// ─── DATABASE HELPERS ───

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (db.objectStoreNames.contains(STORE_NAME)) {
                try { db.deleteObjectStore(STORE_NAME); } catch (err) {}
            }
            db.createObjectStore(STORE_NAME, { keyPath: 'path' });
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getFileFromDB(path) {
    const db = await openDB();
    const cleanPath = path.toLowerCase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(cleanPath);
        request.onsuccess = () => {
            const record = request.result;
            if (!record) return resolve(null);
            // Reconstruct Blob from stored ArrayBuffer (or handle legacy Blob records)
            const source = record.data || record.blob;
            const blob = (source instanceof Blob) ? source : new Blob([source], { type: record.mimeType || 'application/octet-stream' });
            resolve({ path: record.path, blob, mimeType: record.mimeType });
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getFileByCandidates(candidates) {
    for (const key of candidates) {
        const record = await getFileFromDB(key);
        if (record && record.blob) return { key, record };
    }
    return null;
}

function getStorageKeyCandidates(path) {
    const cleanPath = String(path || '').replace(/^\/+/, '').toLowerCase();
    const candidates = [cleanPath];
    const fileName = cleanPath.split('/').pop();

    if (fileName === 'questions.xml') {
        candidates.push('questions/questions.xml', 'questions.xml');
    } else if (fileName === 'switchquestions.xml') {
        candidates.push('questions/switchquestions.xml', 'switchquestions.xml');
    }

    return [...new Set(candidates)];
}

// ─── FETCH INTERCEPTOR ───

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Intercept sandbox files and old bundles that still point question XML at R2.
    if (url.pathname.startsWith(CONTROLLER_SCOPE)) {
        event.respondWith(handleSandboxRequest(event, url));
        return;
    }

    if (isCloudQuestionXmlRequest(url)) {
        event.respondWith(handleQuestionXmlRequest(event, url));
    }
});

function isCloudQuestionXmlRequest(url) {
    if (url.hostname !== R2_HOST) return false;
    const path = url.pathname.toLowerCase();
    return path.endsWith('/questions.xml') || path.endsWith('/switchquestions.xml');
}

async function handleSandboxRequest(event, url) {
    // 1. Normalize the storage key
    let storageKey = url.pathname.replace(CONTROLLER_SCOPE, '');
    storageKey = decodeURIComponent(storageKey);

    // Strip leading slashes
    while (storageKey.startsWith('/')) {
        storageKey = storageKey.substring(1);
    }

    // Default to default.html
    if (storageKey === '' || storageKey === '/') {
        storageKey = 'default.html';
    }

    // 2. Diagnostic logging for debugging
    console.log('[SW] Looking up key:', storageKey.toLowerCase());

    try {
        // 3. Try IndexedDB first
        const resolved = await getFileByCandidates(getStorageKeyCandidates(storageKey));
        const record = resolved?.record || null;

        if (record && record.blob) {
            const mimeType = record.mimeType || getMimeType(resolved.key || storageKey);
            const rangeHeader = event.request.headers.get('Range');
            
            // Handle Media Range Requests (206 Partial Content)
            if (rangeHeader && (mimeType.startsWith('audio/') || mimeType.startsWith('video/'))) {
                const blob = record.blob;
                const total = blob.size;
                const parts = rangeHeader.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
                
                if (start >= total || end >= total || start > end) {
                    return new Response(null, {
                        status: 416,
                        headers: { 'Content-Range': `bytes */${total}` }
                    });
                }
                
                const chunk = blob.slice(start, end + 1);
                return new Response(chunk, {
                    status: 206,
                    headers: {
                        'Content-Range': `bytes ${start}-${end}/${total}`,
                        'Accept-Ranges': 'bytes',
                        'Content-Length': chunk.size,
                        'Content-Type': mimeType,
                        'Cache-Control': 'no-store, max-age=0',
                    }
                });
            }

            // Normal 200 OK Response
            return new Response(record.blob, {
                status: 200,
                headers: {
                    'Content-Type': mimeType,
                    'Cache-Control': 'no-store, max-age=0',
                },
            });
        }

        // 4. Fallback: Try the real network before giving up
        try {
            // Hardcoded Cloud Fallback for XML files per user request
            if (storageKey.toLowerCase().endsWith('questions.xml')) {
                const cloudUrl = storageKey.toLowerCase().includes('switch')
                    ? 'https://pub-2d06308cf53245df865e113b0745c6d9.r2.dev/switchQuestions.xml'
                    : 'https://pub-2d06308cf53245df865e113b0745c6d9.r2.dev/questions.xml';
                
                console.log('[SW] DB Miss. Falling back to Cloud R2:', cloudUrl);
                const cloudRes = await fetch(cloudUrl);
                if (cloudRes.ok) return cloudRes;
            }

            const networkResponse = await fetch(event.request);
            if (networkResponse.ok) return networkResponse;
        } catch (_) {}

        // 5. Final 404 with diagnostic breadcrumbs
        return new Response(`File not found in sandbox: "${storageKey}"`, { 
            status: 404,
            headers: { 'Content-Type': 'text/plain' }
        });

    } catch (err) {
        return new Response('Service Worker error: ' + err.message, {
            status: 500,
            headers: { 'Content-Type': 'text/plain' },
        });
    }
}

async function handleQuestionXmlRequest(event, url) {
    const storageKey = url.pathname.toLowerCase().endsWith('/switchquestions.xml')
        ? 'questions/switchquestions.xml'
        : 'questions/questions.xml';

    try {
        const resolved = await getFileByCandidates(getStorageKeyCandidates(storageKey));
        if (resolved?.record?.blob) {
            return new Response(resolved.record.blob, {
                status: 200,
                headers: {
                    'Content-Type': resolved.record.mimeType || 'application/xml',
                    'Cache-Control': 'no-store',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        const cloudRes = await fetch(event.request);
        if (cloudRes.ok) return cloudRes;
    } catch (err) {
        return new Response('Service Worker XML error: ' + err.message, {
            status: 500,
            headers: {
                'Content-Type': 'text/plain',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }

    return new Response(`Question XML not found: "${storageKey}"`, {
        status: 404,
        headers: {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
