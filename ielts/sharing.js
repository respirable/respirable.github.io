const Sharing = (() => {
  const SUPABASE_URL = 'https://suvassbrvlbxbwhsqgdc.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1dmFzc2JydmxieGJ3aHNxZ2RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODkyNTAsImV4cCI6MjA5NjA2NTI1MH0.yunN4Ohg-qEisscVxWkAKD-d2nMNsJInxoZEGtSuwx4';
  const TABLE_NAME = 'ielts_tests';
  const SHORT_CODE_LENGTH = 8;

  const supabase = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  function getBaseURL() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
  }

  function createShortCode(length = SHORT_CODE_LENGTH) {
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const values = new Uint8Array(length);
    crypto.getRandomValues(values);
    return Array.from(values, value => alphabet[value % alphabet.length]).join('');
  }

  function getShareIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('t') || params.get('id') || '';
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
      const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
      if (!message.includes('duplicate') && !message.includes('unique')) {
        throw error;
      }
    }

    throw lastError || new Error('Could not create a unique share code.');
  }

  async function insertWithUuidOnly(payload) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert([payload])
      .select('id')
      .single();

    if (error) throw error;
    return data;
  }

  async function saveTestToSupabase(data) {
    if (!supabase) {
      throw new Error('Supabase is not available. Check that the Supabase CDN script loaded.');
    }

    const title = data?.mode === 'writing'
      ? 'Untitled IELTS Writing Test'
      : data.parts?.[0]?.passage?.title || 'Untitled IELTS Reading Test';
    const payload = { title, test_data: data };

    try {
      const record = await insertWithShortCode(payload);
      return `${getBaseURL()}?t=${encodeURIComponent(record.share_code)}`;
    } catch (error) {
      const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
      const missingShortCodeColumn = message.includes('share_code') || message.includes('schema cache');
      if (!missingShortCodeColumn) {
        throw new Error('Failed to save: ' + (error.message || 'Unknown Supabase error'));
      }

      const record = await insertWithUuidOnly(payload);
      return `${getBaseURL()}?id=${encodeURIComponent(record.id)}`;
    }
  }

  async function loadTestFromSupabase(shareId) {
    if (!supabase || !shareId) return null;

    const normalizedId = String(shareId).trim();
    const query = supabase.from(TABLE_NAME).select('test_data').limit(1);
    const request = isUuid(normalizedId)
      ? query.eq('id', normalizedId)
      : query.eq('share_code', normalizedId);

    const { data, error } = await request.maybeSingle();
    if (error) {
      console.error('Failed to load shared test:', error.message);
      return null;
    }

    return data?.test_data || null;
  }

  return {
    getShareIdFromURL,
    saveTestToSupabase,
    loadTestFromSupabase
  };
})();
