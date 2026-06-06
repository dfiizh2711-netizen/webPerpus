// ============================================
// Admin Module — Categories & Members CRUD
// ============================================
import { supabaseClient } from './config/supabase.js';
import { showToast, showLoading, hideLoading } from './utils/ui.js';

// ---------- Categories ----------

export async function fetchAllCategories() {
    const { data, error } = await supabaseClient.from('categories').select('*').order('name');
    if (error) { showToast('Gagal memuat kategori', 'error'); return []; }
    return data;
}

export async function createCategory(name) {
    showLoading();
    const { data, error } = await supabaseClient.from('categories').insert({ name }).select().single();
    hideLoading();
    if (error) { showToast('Gagal tambah kategori: ' + error.message, 'error'); throw error; }
    showToast('Kategori ditambahkan', 'success');
    return data;
}

export async function updateCategory(id, name) {
    showLoading();
    const { data, error } = await supabaseClient.from('categories').update({ name }).eq('id', id).select().single();
    hideLoading();
    if (error) { showToast('Gagal update kategori: ' + error.message, 'error'); throw error; }
    showToast('Kategori diupdate', 'success');
    return data;
}

export async function deleteCategory(id) {
    showLoading();
    const { error } = await supabaseClient.from('categories').delete().eq('id', id);
    hideLoading();
    if (error) { showToast('Gagal hapus kategori: ' + error.message, 'error'); throw error; }
    showToast('Kategori dihapus', 'success');
}

// ---------- Members ----------

export async function fetchAllMembers({ page = 1, search = '' } = {}) {
    const PAGE = 15;
    const from = (page - 1) * PAGE;
    const to = from + PAGE - 1;

    let query = supabaseClient
        .from('profiles')
        .select('*', { count: 'exact' });

    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) { showToast('Gagal memuat anggota', 'error'); return { members: [], total: 0, totalPages: 0 }; }
    return { members: data, total: count, totalPages: Math.ceil(count / PAGE) };
}

export async function updateMember(id, updates) {
    showLoading();
    const { data, error } = await supabaseClient
        .from('profiles').update(updates).eq('id', id).select().single();
    hideLoading();
    if (error) { showToast('Gagal update anggota: ' + error.message, 'error'); throw error; }
    showToast('Anggota diupdate', 'success');
    return data;
}

export async function deleteMember(id) {
    showLoading();
    const { error } = await supabaseClient.from('profiles').delete().eq('id', id);
    hideLoading();
    if (error) { showToast('Gagal hapus anggota: ' + error.message, 'error'); throw error; }
    showToast('Anggota dihapus', 'success');
}
