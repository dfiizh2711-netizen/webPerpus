// ============================================
// Supabase Client Configuration
// Ganti dengan kredensial project Anda
// ============================================

export const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';

// Gunakan Supabase dari CDN global (window.supabase)
const { createClient } = window.supabase;

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
