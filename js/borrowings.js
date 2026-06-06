// ============================================
// Borrowings Module
// ============================================
import { supabaseClient } from './config/supabase.js';
import { showToast, showLoading, hideLoading } from './utils/ui.js';
import { formatDate, getDaysUntil } from './utils/helpers.js';

const PAGE_SIZE = 10;

// ---------- Borrow a Book ----------
export async function borrowBook(userId, bookId, borrowDate, returnDate) {
    showLoading();
    try {
        const { data: book, error: bookErr } = await supabaseClient
            .from('books').select('stock, title').eq('id', bookId).single();
        if (bookErr || !book) throw new Error('Buku tidak ditemukan');
        if (book.stock <= 0) throw new Error('Stok buku habis');

        const { data: existing } = await supabaseClient
            .from('borrowings').select('id')
            .eq('user_id', userId).eq('book_id', bookId).eq('status', 'borrowed').single();
        if (existing) throw new Error('Anda sudah meminjam buku ini');

        const { error: borrowErr } = await supabaseClient.from('borrowings').insert({
            user_id: userId, book_id: bookId,
            borrow_date: borrowDate, return_date: returnDate, status: 'borrowed'
        });
        if (borrowErr) throw borrowErr;

        await supabaseClient.from('books').update({ stock: book.stock - 1 }).eq('id', bookId);

        hideLoading();
        showToast(`Berhasil meminjam "${book.title}"`, 'success');
        return true;
    } catch (err) {
        hideLoading();
        showToast(err.message || 'Gagal meminjam buku', 'error');
        return false;
    }
}

// ---------- Return a Book ----------
export async function returnBook(borrowingId) {
    showLoading();
    try {
        const { data: borrowing, error: bErr } = await supabaseClient
            .from('borrowings').select('*, books(stock, title)').eq('id', borrowingId).single();
        if (bErr || !borrowing) throw new Error('Data peminjaman tidak ditemukan');

        await supabaseClient.from('borrowings').update({
            status: 'returned',
            actual_return_date: new Date().toISOString().split('T')[0]
        }).eq('id', borrowingId);

        await supabaseClient.from('books')
            .update({ stock: (borrowing.books?.stock || 0) + 1 })
            .eq('id', borrowing.book_id);

        hideLoading();
        showToast(`"${borrowing.books?.title}" berhasil dikembalikan`, 'success');
        return true;
    } catch (err) {
        hideLoading();
        showToast(err.message || 'Gagal mengembalikan buku', 'error');
        return false;
    }
}

// ---------- Fetch Active Borrowings ----------
export async function fetchActiveBorrowings(userId) {
    const { data, error } = await supabaseClient
        .from('borrowings')
        .select('*, books(title, author, cover_url)')
        .eq('user_id', userId)
        .in('status', ['borrowed', 'overdue', 'pending', 'return_pending'])
        .order('borrow_date', { ascending: false });
    if (error) { showToast('Gagal memuat peminjaman aktif', 'error'); return []; }
    return data;
}

// ---------- Fetch Borrowing History (user) ----------
export async function fetchBorrowingHistory(userId, page = 1) {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await supabaseClient
        .from('borrowings')
        .select('*, books(title, author, cover_url)', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);
    if (error) { showToast('Gagal memuat riwayat', 'error'); return { borrowings: [], total: 0, totalPages: 0 }; }
    return { borrowings: data, total: count, totalPages: Math.ceil(count / PAGE_SIZE) };
}

// ---------- Admin: Fetch All Borrowings ----------
export async function fetchAllBorrowings({ page = 1, status = '' } = {}) {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabaseClient
        .from('borrowings')
        .select('*, books(title, author), profiles(name, email)', { count: 'exact' });

    if (status) query = query.eq('status', status);
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) { showToast('Gagal memuat data peminjaman', 'error'); return { borrowings: [], total: 0, totalPages: 0 }; }
    return { borrowings: data, total: count, totalPages: Math.ceil(count / PAGE_SIZE) };
}

// ---------- Admin: Fetch Overdue ----------
export async function fetchOverdueBorrowings() {
    const { data, error } = await supabaseClient
        .from('borrowings')
        .select('*, books(title), profiles(name, email)')
        .in('status', ['borrowed', 'overdue'])
        .lt('return_date', new Date().toISOString().split('T')[0])
        .order('return_date');
    if (error) return [];
    return data;
}

// ---------- Admin: Create Borrowing ----------
export async function adminCreateBorrowing(payload) {
    showLoading();
    try {
        const { data: book } = await supabaseClient
            .from('books').select('stock, title').eq('id', payload.book_id).single();
        if (!book) throw new Error('Buku tidak ditemukan');
        if (book.stock <= 0 && payload.status === 'borrowed') throw new Error('Stok buku habis');

        const { error } = await supabaseClient.from('borrowings').insert(payload);
        if (error) throw error;

        if (payload.status === 'borrowed') {
            await supabaseClient.from('books').update({ stock: book.stock - 1 }).eq('id', payload.book_id);
        }

        hideLoading();
        showToast('Peminjaman berhasil ditambahkan', 'success');
        return true;
    } catch (err) {
        hideLoading();
        showToast(err.message, 'error');
        return false;
    }
}

// ---------- Admin: Update Borrowing ----------
export async function adminUpdateBorrowing(id, payload) {
    showLoading();
    const { error } = await supabaseClient.from('borrowings').update(payload).eq('id', id);
    hideLoading();
    if (error) { showToast('Gagal update: ' + error.message, 'error'); return false; }
    showToast('Peminjaman diupdate', 'success');
    return true;
}

// ---------- Admin: Delete Borrowing ----------
export async function adminDeleteBorrowing(id) {
    showLoading();
    const { error } = await supabaseClient.from('borrowings').delete().eq('id', id);
    hideLoading();
    if (error) { showToast('Gagal hapus: ' + error.message, 'error'); return false; }
    showToast('Peminjaman dihapus', 'success');
    return true;
}

// ---------- Admin: Dashboard Stats ----------
export async function fetchDashboardStats() {
    const [
        { count: totalBooks },
        { count: totalMembers },
        { count: activeBorrow },
        { count: overdue },
        { count: returned },
        { count: totalCats }
    ] = await Promise.all([
        supabaseClient.from('books').select('*', { count: 'exact', head: true }),
        supabaseClient.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'user'),
        supabaseClient.from('borrowings').select('*', { count: 'exact', head: true }).eq('status', 'borrowed'),
        supabaseClient.from('borrowings').select('*', { count: 'exact', head: true }).eq('status', 'overdue'),
        supabaseClient.from('borrowings').select('*', { count: 'exact', head: true }).eq('status', 'returned'),
        supabaseClient.from('categories').select('*', { count: 'exact', head: true })
    ]);
    return { totalBooks, totalMembers, activeBorrow, overdue, returned, totalCats };
}

// ---------- Admin: Report ----------
export async function fetchBorrowingReport({ fromDate, toDate, page = 1 } = {}) {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabaseClient
        .from('borrowings')
        .select('*, books(title, author), profiles(name, email)', { count: 'exact' });

    if (fromDate) query = query.gte('borrow_date', fromDate);
    if (toDate)   query = query.lte('borrow_date', toDate);

    query = query.order('borrow_date', { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) { showToast('Gagal memuat laporan', 'error'); return { borrowings: [], total: 0, totalPages: 0 }; }
    return { borrowings: data, total: count, totalPages: Math.ceil(count / PAGE_SIZE) };
}

// ---------- Render helpers ----------
export function getStatusBadge(status) {
    const map = {
        borrowed: ['status-borrowed', 'Dipinjam'],
        returned: ['status-returned', 'Dikembalikan'],
        overdue:  ['status-overdue',  'Terlambat']
    };
    const [cls, label] = map[status] || ['status-borrowed', status];
    return `<span class="status-badge ${cls}">${label}</span>`;
}
