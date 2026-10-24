/*
 * Olympia Controller - online settings. The anon key is meant to be public (it only grants what
 * the database's row-level security allows). NEVER put the service_role key here.
 */
window.OlympiaConfig = {
	/* Cloudflare Turnstile site key for "Yêu cầu một tài khoản" (public, like the anon key). Empty:
	 * Cloudflare's always-pass test key on localhost, and the form refuses to send elsewhere. */
	turnstileSiteKey: '0x4AAAAAAFjviUg_Q1Kj5rRq',
	supabaseUrl: 'https://kxlvylpijyuiqdrlnarg.supabase.co',
	supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bHZ5bHBpanl1aXFkcmxuYXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0OTAyNjEsImV4cCI6MjEwODA2NjI2MX0.gx_JE3HhQqOszxY2dNUCZUTjkOTJxfppBiApGsr0a3M'
};
