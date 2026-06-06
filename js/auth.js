// ============================================
// Authentication Module
// ============================================
import { supabaseClient } from './config/supabase.js';
import { showToast, showLoading, hideLoading } from './utils/ui.js';

// ---------- Sign Up ----------
export async function signUp(email, password, name) {
    showLoading();
    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: { data: { name } }
        });
        if (error) throw error;
        hideLoading();
        showToast('Registrasi berhasil! Silakan cek email untuk verifikasi.', 'success');
        return data;
    } catch (err) {
        hideLoading();
        showToast(err.message || 'Registrasi gagal', 'error');
        throw err;
    }
}

// ---------- Sign In ----------
export async function signIn(email, password) {
    showLoading();
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        hideLoading();
        showToast('Login berhasil!', 'success');
        return data;
    } catch (err) {
        hideLoading();
        showToast(err.message || 'Login gagal', 'error');
        throw err;
    }
}

// ---------- Sign Out ----------
export async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        showToast('Logout gagal', 'error');
    } else {
        showToast('Berhasil logout', 'success');
        setTimeout(() => window.location.reload(), 600);
    }
}

// ---------- Get Current User ----------
export async function getCurrentUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}

// ---------- Get User Profile ----------
export async function getUserProfile(userId) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) return null;
    return data;
}

// ---------- Update Profile ----------
export async function updateProfile(userId, updates) {
    showLoading();
    const { data, error } = await supabaseClient
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
    hideLoading();
    if (error) {
        showToast('Gagal update profil: ' + error.message, 'error');
        throw error;
    }
    showToast('Profil berhasil diupdate', 'success');
    return data;
}

// ---------- Change Password ----------
export async function changePassword(newPassword) {
    showLoading();
    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
    hideLoading();
    if (error) {
        showToast('Gagal ubah password: ' + error.message, 'error');
        throw error;
    }
    showToast('Password berhasil diubah', 'success');
}

// ---------- Check if Admin ----------
export async function isAdmin(userId) {
    const profile = await getUserProfile(userId);
    return profile?.role === 'admin';
}

// ---------- Auth State Listener ----------
export function onAuthStateChange(callback) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}
