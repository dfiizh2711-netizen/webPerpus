// ============================================
// Supabase Client Configuration
// Ganti dengan kredensial project Anda
// ============================================

export const SUPABASE_URL = 'https://xgakidcfjwjovqykltoh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnYWtpZGNmandqb3ZxeWtsdG9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1Mjk0ODAsImV4cCI6MjA5NjEwNTQ4MH0.GvuOPvZBb48H66aaHVHGOaRJNbu9VB3e1YkGruQKH4s';

// Gunakan Supabase dari CDN global (window.supabase)
const { createClient } = window.supabase;

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
