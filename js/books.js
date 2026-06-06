// ============================================
// Books Module
// ============================================
import { supabaseClient } from './config/supabase.js';
import { showToast, showLoading, hideLoading } from './utils/ui.js';

const PAGE_SIZE = 12;

// ---------- Fetch Categories ----------
export async function fetchCategories() {
    const { data, error } = await supabaseClient
        .from('categories')
        .select('*')
        .order('name');
    if (error) { showToast('Gagal memuat kategori', 'error'); return []; }
    return data;
}

// ---------- Fetch Books ----------
export async function fetchBooks({ page = 1, search = '', categoryId = '' } = {}) {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabaseClient
        .from('books')
        .select('*, categories(name)', { count: 'exact' });

    if (search) query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
    if (categoryId) query = query.eq('category_id', categoryId);

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) { showToast('Gagal memuat buku', 'error'); return { books: [], total: 0, totalPages: 0 }; }
    return { books: data, total: count, totalPages: Math.ceil(count / PAGE_SIZE) };
}

// ---------- Fetch Single Book ----------
export async function fetchBookById(bookId) {
    const { data, error } = await supabaseClient
        .from('books')
        .select('*, categories(name)')
        .eq('id', bookId)
        .single();
    if (error) { showToast('Buku tidak ditemukan', 'error'); return null; }
    return data;
}

// ---------- Fetch Popular Books ----------
export async function fetchPopularBooks(limit = 8) {
    const { data, error } = await supabaseClient
        .from('books')
        .select('*, categories(name)')
        .gt('stock', 0)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) return [];
    return data;
}

// ---------- Admin: Create Book ----------
export async function createBook(bookData) {
    showLoading();
    const { data, error } = await supabaseClient
        .from('books')
        .insert(bookData)
        .select()
        .single();
    hideLoading();
    if (error) { showToast('Gagal menambah buku: ' + error.message, 'error'); throw error; }
    showToast('Buku berhasil ditambahkan', 'success');
    return data;
}

// ---------- Admin: Update Book ----------
export async function updateBook(bookId, bookData) {
    showLoading();
    const { data, error } = await supabaseClient
        .from('books')
        .update(bookData)
        .eq('id', bookId)
        .select()
        .single();
    hideLoading();
    if (error) { showToast('Gagal update buku: ' + error.message, 'error'); throw error; }
    showToast('Buku berhasil diupdate', 'success');
    return data;
}

// ---------- Admin: Delete Book ----------
export async function deleteBook(bookId) {
    showLoading();
    const { error } = await supabaseClient.from('books').delete().eq('id', bookId);
    hideLoading();
    if (error) { showToast('Gagal hapus buku: ' + error.message, 'error'); throw error; }
    showToast('Buku berhasil dihapus', 'success');
}

// ---------- Admin: Fetch All Books (no pagination limit) ----------
export async function fetchAllBooksAdmin({ page = 1, search = '', categoryId = '' } = {}) {
    const PAGE = 15;
    const from = (page - 1) * PAGE;
    const to = from + PAGE - 1;

    let query = supabaseClient
        .from('books')
        .select('*, categories(name)', { count: 'exact' });

    if (search) query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
    if (categoryId) query = query.eq('category_id', categoryId);

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) { showToast('Gagal memuat buku', 'error'); return { books: [], total: 0, totalPages: 0 }; }
    return { books: data, total: count, totalPages: Math.ceil(count / PAGE) };
}
