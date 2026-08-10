/**
 * db.js — IndexedDB Helper for WWTBAM Controller Sandbox
 * Stores and retrieves controller files (HTML, CSS, JS, images, sounds, fonts)
 * in the browser's local IndexedDB storage.
 */

const DB_NAME = 'wwtbam-controller';
const DB_VERSION = 10;
const STORE_NAME = 'files';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            // Force a full wipe of the old schema to ensure case-insensitive keys are generated fresh
            if (db.objectStoreNames.contains(STORE_NAME)) {
                db.deleteObjectStore(STORE_NAME);
            }
            db.createObjectStore(STORE_NAME, { keyPath: 'path' });
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

/** Convert a Blob/File to ArrayBuffer for safe IndexedDB storage */
async function blobToBuffer(blob) {
    if (blob instanceof ArrayBuffer) return blob;
    if (blob instanceof Blob || blob instanceof File) return await blob.arrayBuffer();
    // Already a buffer-like object
    if (blob && blob.byteLength !== undefined) return blob;
    return blob;
}

/** Save a file to IndexedDB (stored as ArrayBuffer for Safari compatibility) */
async function saveFile(path, blob, mimeType) {
    const db = await openDB();
    const buffer = await blobToBuffer(blob);
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ path: path.toLowerCase(), data: buffer, mimeType: mimeType || '' });
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

/** Retrieve a file from IndexedDB by path (reconstructs Blob from stored ArrayBuffer) */
async function getFile(path) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(path.toLowerCase());
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

/** Check if the controller bundle is already cached */
async function hasBundle() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const countReq = store.count();
        countReq.onsuccess = () => resolve(countReq.result > 0);
        countReq.onerror = (e) => reject(e.target.error);
    });
}

/** Get the total number of stored files */
async function getFileCount() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const countReq = store.count();
        countReq.onsuccess = () => resolve(countReq.result);
        countReq.onerror = (e) => reject(e.target.error);
    });
}

/** Clear all stored files (reset sandbox) */
async function clearAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

/** Get all stored file paths for the Explorer */
async function getAllPaths() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (e) => reject(e.target.error);
    });
}

/** Delete a file by path */
async function deleteFile(path) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(path.toLowerCase());
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

/** Rename a file in IndexedDB */
async function renameFile(oldPath, newPath) {
    const record = await getFile(oldPath);
    if (!record) throw new Error('Source file not found');
    
    await saveFile(newPath, record.blob, record.mimeType);
    await deleteFile(oldPath);
}
