// ── IELTS Listening Sharing Module ──
// Mirrors ielts/sharing.js but uses the listening-specific Supabase table + storage bucket.

const ListeningSharing = (() => {
  const SUPABASE_URL = 'https://suvassbrvlbxbwhsqgdc.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1dmFzc2JydmxieGJ3aHNxZ2RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODkyNTAsImV4cCI6MjA5NjA2NTI1MH0.yunN4Ohg-qEisscVxWkAKD-d2nMNsJInxoZEGtSuwx4';
  const TABLE_NAME = 'ielts_listening_tests';
  const STORAGE_BUCKET = 'listening-audio';
  const SHORT_CODE_LENGTH = 8;

  const supabase = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  function createShortCode(length = SHORT_CODE_LENGTH) {
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const values = new Uint8Array(length);
    crypto.getRandomValues(values);
    return Array.from(values, v => alphabet[v % alphabet.length]).join('');
  }

  function getShareIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('t') || params.get('id') || '';
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
  }

  // ── Upload a single audio File to Supabase Storage ──
  // Returns the public URL, or throws on failure.
  async function uploadAudio(file) {
    if (!supabase) throw new Error('Supabase not available.');
    const ext = file.name.split('.').pop() || 'mp3';
    const path = `${createShortCode(12)}.${ext}`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw new Error('Audio upload failed: ' + error.message);
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function insertWithShortCode(payload) {
    let lastError = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const shareCode = createShortCode();
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert([{ ...payload, share_code: shareCode }])
        .select('id, share_code')
        .single();
      if (!error) return data;
      lastError = error;
      const msg = `${error.message || ''} ${error.details || ''}`.toLowerCase();
      if (!msg.includes('duplicate') && !msg.includes('unique')) throw error;
    }
    throw lastError || new Error('Could not create a unique share code.');
  }

  // ── Save a full listening test to Supabase ──
  // Automatically uploads any local blob/base64 audio before saving.
  async function saveTestToSupabase(data, onProgress) {
    if (!supabase) throw new Error('Supabase is not available.');

    // Upload audio files that are still local data URLs / blobs
    const parts = data.parts || [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part._audioFile) {
        onProgress?.(`Uploading Part ${i + 1} audio…`);
        const url = await uploadAudio(part._audioFile);
        part.audioUrl = url;
        delete part._audioFile;
      }
    }

    const title = data.title || 'Untitled IELTS Listening Test';
    const payload = { title, test_data: data };
    onProgress?.('Saving test data…');
    const record = await insertWithShortCode(payload);
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?t=${encodeURIComponent(record.share_code)}`;
  }

  async function loadTestFromSupabase(shareId) {
    if (!supabase || !shareId) return null;
    const id = String(shareId).trim();
    const query = supabase.from(TABLE_NAME).select('test_data').limit(1);
    const request = isUuid(id) ? query.eq('id', id) : query.eq('share_code', id);
    const { data, error } = await request.maybeSingle();
    if (error) { console.error('Failed to load listening test:', error.message); return null; }
    return data?.test_data || null;
  }

  return { getShareIdFromURL, saveTestToSupabase, loadTestFromSupabase, uploadAudio };
})();
