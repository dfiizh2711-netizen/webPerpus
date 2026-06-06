// ==========================================================
// DigiLibrary — Main Application Controller (Supabase Version)
// ==========================================================

import { 
    signIn, 
    signUp, 
    signOut, 
    getCurrentUser, 
    getUserProfile, 
    updateProfile, 
    changePassword 
} from './js/auth.js';

import { 
    fetchCategories, 
    fetchBooks, 
    fetchBookById, 
    fetchPopularBooks, 
    createBook, 
    updateBook, 
    deleteBook, 
    fetchAllBooksAdmin 
} from './js/books.js';

import { 
    borrowBook, 
    returnBook, 
    fetchActiveBorrowings, 
    fetchBorrowingHistory, 
    fetchAllBorrowings, 
    fetchOverdueBorrowings, 
    adminCreateBorrowing, 
    adminUpdateBorrowing, 
    adminDeleteBorrowing, 
    fetchDashboardStats, 
    fetchBorrowingReport 
} from './js/borrowings.js';

import { 
    fetchAllCategories, 
    createCategory, 
    updateCategory, 
    deleteCategory, 
    fetchAllMembers, 
    updateMember, 
    deleteMember 
} from './js/admin.js';

import { 
    initDarkMode, 
    toggleDarkMode, 
    initModals, 
    openModal, 
    closeModal, 
    showToast, 
    showLoading, 
    hideLoading 
} from './js/utils/ui.js';

import { 
    getTodayISO, 
    escapeHtml, 
    renderPagination, 
    debounce, 
    formatDate, 
    exportCSV 
} from './js/utils/helpers.js';

import { 
    SUPABASE_URL, 
    SUPABASE_ANON_KEY, 
    supabaseClient 
} from './js/config/supabase.js';

// State App
let currentUser = null;
let currentProfile = null;

let currentBooksPage = 1;
let currentHistoryPage = 1;
let booksSearchTerm = '';
let booksCategoryId = '';

let currentAdminBooksPage = 1;
let allAdminBooksData = [];
let adminBooksSearchTerm = '';
let adminBooksCategoryId = '';

let allMembersData = [];
let currentAdminMembersPage = 1;

let allAdminsData = [];
let currentAdminAdminsPage = 1;

let allAdminCategoriesData = [];
let adminBorrowStatusFilter = '';

// Client Supabase Sementara (Tanpa Persist Session) untuk membuat anggota baru oleh Admin
const tempSupabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
}) : null;

// ---------- Inisialisasi App ----------
function initApp() {
    initDarkMode();
    initModals();

    setupNavigation();
    setupTopBar();
    setupProfileForm();
    setupAuth();
    loadSessionUser();

    // Tombol "Jelajahi Buku" di Beranda
    const exploreBtn = document.getElementById('explore-books-btn');
    if (exploreBtn) {
        exploreBtn.addEventListener('click', () => {
            document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
            document.getElementById('books-view').classList.add('active');
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            const booksNav = document.querySelector('[data-view="books-view"]');
            if (booksNav) booksNav.classList.add('active');
            loadBooksView();
        });
    }

    // Input Pencarian Global
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) {
        globalSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const term = e.target.value.trim();
                document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

                if (currentProfile && currentProfile.role === 'admin') {
                    document.getElementById('admin-books').classList.add('active');
                    const adminNav = document.querySelector('[data-view="admin-books"]');
                    if (adminNav) adminNav.classList.add('active');

                    const adminSearch = document.getElementById('admin-books-search');
                    if (adminSearch) {
                        adminSearch.value = term;
                        adminBooksSearchTerm = term.toLowerCase();
                        currentAdminBooksPage = 1;
                        loadAdminBooksView();
                    }
                } else {
                    document.getElementById('books-view').classList.add('active');
                    const booksNav = document.querySelector('[data-view="books-view"]');
                    if (booksNav) booksNav.classList.add('active');

                    const libSearch = document.getElementById('books-search-input');
                    if (libSearch) {
                        libSearch.value = term;
                        booksSearchTerm = term.toLowerCase();
                        currentBooksPage = 1;
                        loadBooksView();
                    }
                }
            }
        });
    }
}

// ---------- Autentikasi & Sesi ----------
async function loadSessionUser() {
    showLoading();
    try {
        const user = await getCurrentUser();
        if (user) {
            currentUser = user;
            currentProfile = await getUserProfile(user.id);
            if (currentProfile) {
                showDashboard();
            } else {
                // Tunggu database trigger selesai memproses profiles jika lambat
                setTimeout(async () => {
                    currentProfile = await getUserProfile(user.id);
                    if (currentProfile) {
                        showDashboard();
                    } else {
                        await signOut();
                    }
                }, 1500);
            }
        } else {
            document.getElementById('auth-wrapper').style.display = 'flex';
            document.getElementById('app-dashboard').style.display = 'none';
        }
    } catch (err) {
        console.warn('Gagal memuat sesi pengguna', err);
    } finally {
        hideLoading();
    }
}

function showDashboard() {
    document.getElementById('auth-wrapper').style.display = 'none';
    document.getElementById('app-dashboard').style.display = 'flex';

    document.getElementById('user-display-name').textContent = currentProfile.name;
    const greetingName = document.getElementById('user-greeting-name');
    if (greetingName) greetingName.textContent = currentProfile.name;
    document.getElementById('user-avatar-img').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentProfile.name)}&background=d96c6c&color=fff`;

    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    if (currentProfile.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
        document.querySelectorAll('.user-only').forEach(el => el.style.display = 'none');
        document.getElementById('admin-dashboard').classList.add('active');
        const adminNav = document.querySelector('[data-view="admin-dashboard"]');
        if (adminNav) adminNav.classList.add('active');
        loadAdminDashboardView();
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.user-only').forEach(el => el.style.display = '');
        document.getElementById('home-view').classList.add('active');
        const homeNav = document.querySelector('[data-view="home-view"]');
        if (homeNav) homeNav.classList.add('active');
        loadHomeView();
    }
}

function setupAuth() {
    // Switch login & register
    document.getElementById('go-register').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('register-container').style.display = 'flex';
    });
    document.getElementById('go-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-container').style.display = 'none';
        document.getElementById('login-container').style.display = 'flex';
    });

    // Password visibility toggle
    document.querySelectorAll('.toggle-pw').forEach(icon => {
        icon.addEventListener('click', () => {
            const input = document.getElementById(icon.dataset.target);
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('ph-eye', 'ph-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('ph-eye-slash', 'ph-eye');
            }
        });
    });

    // Tab Login (User vs Admin)
    const tabUser = document.getElementById('tab-login-user');
    const tabAdmin = document.getElementById('tab-login-admin');
    const roleInput = document.getElementById('login-role');
    const loginTitle = document.getElementById('login-title');

    tabUser.addEventListener('click', (e) => {
        e.preventDefault();
        tabUser.classList.add('active');
        tabUser.style.color = 'var(--primary-color)';
        tabUser.style.borderBottomColor = 'var(--primary-color)';
        tabAdmin.classList.remove('active');
        tabAdmin.style.color = 'var(--text-light)';
        tabAdmin.style.borderBottomColor = 'transparent';
        roleInput.value = 'user';
        loginTitle.textContent = 'Login User';
    });

    tabAdmin.addEventListener('click', (e) => {
        e.preventDefault();
        tabAdmin.classList.add('active');
        tabAdmin.style.color = 'var(--primary-color)';
        tabAdmin.style.borderBottomColor = 'var(--primary-color)';
        tabUser.classList.remove('active');
        tabUser.style.color = 'var(--text-light)';
        tabUser.style.borderBottomColor = 'transparent';
        roleInput.value = 'admin';
        loginTitle.textContent = 'Login Admin';
    });

    // Login Form Submit
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const role = document.getElementById('login-role').value;

        try {
            const data = await signIn(email, password);
            if (!data.user) throw new Error('Autentikasi gagal');
            
            const profile = await getUserProfile(data.user.id);
            if (!profile) throw new Error('Profil Anda belum dibuat di database.');
            
            if (role === 'admin' && profile.role !== 'admin') {
                await signOut();
                throw new Error('Maaf, akun Anda tidak memiliki hak akses Admin.');
            }

            currentUser = data.user;
            currentProfile = profile;
            showDashboard();
        } catch (err) {
            showToast(err.message || 'Login gagal, periksa email & password Anda.', 'error');
        }
    });

    // Register Form Submit
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;

        if (password.length < 6) {
            showToast('Password minimal 6 karakter', 'warning');
            return;
        }

        try {
            const data = await signUp(email, password, name);
            if (data.session) {
                currentUser = data.user;
                currentProfile = await getUserProfile(data.user.id);
                showToast('Registrasi berhasil!', 'success');
                showDashboard();
            } else {
                showToast('Registrasi berhasil! Silakan periksa email Anda untuk verifikasi.', 'success');
                document.getElementById('register-container').style.display = 'none';
                document.getElementById('login-container').style.display = 'flex';
            }
        } catch (err) {
            showToast(err.message || 'Registrasi gagal.', 'error');
        }
    });

    // Forgot Password Form Submit (Supabase Reset Flow)
    document.getElementById('forgot-link').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('forgot-container').style.display = 'flex';
    });

    document.getElementById('go-login-from-forgot').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('forgot-container').style.display = 'none';
        document.getElementById('login-container').style.display = 'flex';
    });

    document.getElementById('forgot-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value.trim();
        try {
            showLoading();
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/index.html'
            });
            hideLoading();
            if (error) throw error;
            showToast('Email reset password berhasil dikirim! Silakan periksa inbox Anda.', 'success');
            document.getElementById('forgot-form').reset();
            document.getElementById('forgot-container').style.display = 'none';
            document.getElementById('login-container').style.display = 'flex';
        } catch (err) {
            hideLoading();
            showToast(err.message || 'Gagal memproses reset password.', 'error');
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', doLogout);
    document.getElementById('dropdown-logout').addEventListener('click', (e) => {
        e.preventDefault();
        doLogout();
    });
}

async function doLogout() {
    showLoading();
    try {
        await signOut();
        currentUser = null;
        currentProfile = null;
        document.getElementById('app-dashboard').style.display = 'none';
        document.getElementById('auth-wrapper').style.display = 'flex';
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('register-container').style.display = 'none';
        document.getElementById('forgot-container').style.display = 'none';
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
    } catch (err) {
        console.warn('Gagal logout', err);
    } finally {
        hideLoading();
    }
}

// ---------- Navigasi Menu ----------
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-menu .nav-item, .nav-item-link');
    const views = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-view');
            if (!targetId) return;

            navItems.forEach(nav => {
                if (nav.classList.contains('nav-item')) nav.classList.remove('active');
            });
            if (item.classList.contains('nav-item')) item.classList.add('active');

            views.forEach(view => view.classList.remove('active'));
            const targetView = document.getElementById(targetId);
            if (targetView) targetView.classList.add('active');

            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('open');
                document.getElementById('sidebar-overlay').classList.remove('show');
            }

            // Load data for view
            switch(targetId) {
                case 'home-view': loadHomeView(); break;
                case 'books-view': loadBooksView(); break;
                case 'borrow-view': loadBorrowView(); break;
                case 'history-view': loadHistoryView(); break;
                case 'profile-view': loadProfileView(); break;
                case 'admin-dashboard': loadAdminDashboardView(); break;
                case 'admin-books': loadAdminBooksView(); break;
                case 'admin-categories': loadAdminCategoriesView(); break;
                case 'admin-borrowings': loadAdminBorrowingsView(); break;
                case 'admin-members': loadAdminMembersView(); break;
                case 'admin-admins': loadAdminAdminsView(); break;
                case 'admin-reports': loadAdminReportsView(); break;
            }
        });
    });
}

function setupTopBar() {
    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebar-overlay').classList.add('show');
    });

    document.getElementById('sidebar-overlay').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('show');
    });

    document.getElementById('dark-mode-btn').addEventListener('click', toggleDarkMode);
    document.getElementById('dark-toggle-topbar').addEventListener('click', toggleDarkMode);

    document.getElementById('user-menu-trigger').addEventListener('click', () => {
        document.getElementById('user-dropdown').classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-profile')) {
            document.getElementById('user-dropdown').classList.remove('show');
        }
    });
}

// ---------- View: Beranda (User) ----------
async function loadHomeView() {
    if (!currentUser) return;
    try {
        const [
            { count: totalBooks },
            { count: activeBorrowed },
            { count: overdue },
            popular,
            activeBorrows
        ] = await Promise.all([
            supabaseClient.from('books').select('*', { count: 'exact', head: true }),
            supabaseClient.from('borrowings').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).in('status', ['borrowed', 'overdue', 'pending', 'return_pending']),
            supabaseClient.from('borrowings').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).eq('status', 'overdue'),
            fetchPopularBooks(8),
            fetchActiveBorrowings(currentUser.id)
        ]);

        document.getElementById('stat-my-borrowed').textContent = activeBorrowed || 0;
        document.getElementById('stat-overdue').textContent = overdue || 0;
        document.getElementById('stat-total-books').textContent = totalBooks || 0;

        const popContainer = document.getElementById('popular-books-container');
        popContainer.innerHTML = '';
        if (popular.length === 0) {
            popContainer.innerHTML = '<p class="text-muted" style="margin-left: 20px;">Belum ada buku populer.</p>';
        } else {
            popular.forEach(b => {
                const div = document.createElement('div');
                div.className = 'book-card';
                div.innerHTML = `
                    <img src="${escapeHtml(b.cover_url || 'https://via.placeholder.com/150x200')}" alt="Cover">
                    <h3>${escapeHtml(b.title)}</h3>
                    <div class="book-author">${escapeHtml(b.author)}</div>
                `;
                div.addEventListener('click', () => openBookDetail(b));
                popContainer.appendChild(div);
            });
        }

        const borrowsContainer = document.getElementById('home-borrowed-list');
        borrowsContainer.innerHTML = '';
        if (activeBorrows.length === 0) {
            borrowsContainer.innerHTML = '<p class="text-muted">Tidak ada peminjaman aktif.</p>';
        } else {
            activeBorrows.slice(0, 3).forEach(b => {
                const isOverdueItem = b.status === 'overdue';
                const isPending = b.status === 'pending';
                const isReturnPending = b.status === 'return_pending';
                
                let badge = '';
                if (isOverdueItem) badge = '<span class="status-badge status-overdue">Terlambat</span>';
                else if (isPending) badge = '<span class="status-badge status-pending" style="background:#ff9800; color:#fff;">Menunggu</span>';
                else if (isReturnPending) badge = '<span class="status-badge status-pending" style="background:#ff9800; color:#fff;">Menunggu Konfirmasi</span>';

                const div = document.createElement('div');
                div.className = 'borrowed-item-home';
                div.innerHTML = `
                    <div class="bh-info">
                        <strong>${escapeHtml(b.books?.title)}</strong>
                        <small>Batas: ${formatDate(b.return_date)}</small>
                    </div>
                    ${badge}
                `;
                borrowsContainer.appendChild(div);
            });
        }
    } catch (err) {
        console.error('Failed to load home view', err);
    }
}

// ---------- View: Koleksi Buku (User) ----------
let apiBooksCache = null;
let apiCatsCache = null;

async function loadBooksView() {
    if (!apiBooksCache) {
        try {
            const [booksRes, categories] = await Promise.all([
                supabaseClient.from('books').select('*, categories(name)').order('created_at', { ascending: false }),
                fetchCategories()
            ]);
            apiBooksCache = booksRes.data || [];
            apiCatsCache = categories || [];
        } catch (e) {
            console.error(e);
            apiBooksCache = [];
            apiCatsCache = [];
        }
    }

    const catSelect = document.getElementById('category-filter');
    if (catSelect.options.length <= 1 && apiCatsCache.length > 0) {
        apiCatsCache.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            catSelect.appendChild(opt);
        });
        
        catSelect.addEventListener('change', () => {
            booksCategoryId = catSelect.value;
            currentBooksPage = 1;
            renderBooksList();
        });
        
        const searchInput = document.getElementById('books-search-input');
        searchInput.addEventListener('input', debounce((e) => {
            booksSearchTerm = e.target.value.toLowerCase();
            currentBooksPage = 1;
            renderBooksList();
        }, 300));
    }
    
    renderBooksList();
}

function renderBooksList() {
    const grid = document.getElementById('books-grid-container');
    if (!apiBooksCache) return;
    
    let filtered = apiBooksCache;
    if (booksSearchTerm) {
        filtered = filtered.filter(b => 
            (b.title || '').toLowerCase().includes(booksSearchTerm) || 
            (b.author || '').toLowerCase().includes(booksSearchTerm)
        );
    }
    if (booksCategoryId) {
        filtered = filtered.filter(b => b.category_id == booksCategoryId);
    }

    const PAGE_SIZE = 12;
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
    const start = (currentBooksPage - 1) * PAGE_SIZE;
    const pagedBooks = filtered.slice(start, start + PAGE_SIZE);

    grid.innerHTML = '';
    if (pagedBooks.length === 0) {
        grid.innerHTML = '<p class="text-muted">Buku tidak ditemukan.</p>';
    } else {
        pagedBooks.forEach(b => {
            const catName = b.categories?.name || 'Uncategorized';
            const card = document.createElement('div');
            card.className = 'book-card';
            card.innerHTML = `
                <div class="book-cover-wrapper">
                    <img src="${escapeHtml(b.cover_url || 'https://via.placeholder.com/150x200')}" alt="Cover">
                    ${b.stock <= 0 ? '<div class="out-of-stock-overlay">Habis</div>' : ''}
                </div>
                <div class="book-info">
                    <span class="book-cat">${escapeHtml(catName)}</span>
                    <h3>${escapeHtml(b.title)}</h3>
                    <p class="author">${escapeHtml(b.author)}</p>
                </div>
            `;
            card.addEventListener('click', () => openBookDetail(b));
            grid.appendChild(card);
        });
    }

    renderPagination(document.getElementById('books-pagination'), currentBooksPage, totalPages, (page) => {
        currentBooksPage = page;
        renderBooksList();
    });
}

function openBookDetail(book) {
    document.getElementById('modal-book-title').textContent = book.title;
    document.getElementById('modal-book-author').textContent = book.author;
    document.getElementById('modal-book-category').textContent = book.categories?.name || 'Uncategorized';
    document.getElementById('modal-book-stock').textContent = `Stok: ${book.stock}`;
    document.getElementById('modal-book-desc').textContent = book.description || 'Tidak ada deskripsi.';
    document.getElementById('modal-book-cover').src = book.cover_url || 'https://via.placeholder.com/150x200';
    
    const borrowDateInput = document.getElementById('borrow-date');
    const returnDateInput = document.getElementById('return-date');
    const btn = document.getElementById('borrow-confirm-btn');
    
    const today = getTodayISO();
    borrowDateInput.value = today;
    borrowDateInput.min = today;
    
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    returnDateInput.value = nextWeek.toISOString().split('T')[0];
    returnDateInput.min = today;

    const nikInput = document.getElementById('borrow-nik');
    const dobInput = document.getElementById('borrow-dob');
    
    nikInput.value = '';
    dobInput.value = '';

    borrowDateInput.addEventListener('change', function() {
        returnDateInput.min = this.value;
        if (returnDateInput.value < this.value) {
            returnDateInput.value = this.value;
        }
    });

    if (book.stock <= 0) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-warning"></i> Stok Habis';
        btn.onclick = null;
    } else {
        btn.disabled = false;
        btn.innerHTML = '<i class="ph ph-book-bookmark"></i> Ajukan Peminjaman';
        btn.onclick = async () => {
            if (!nikInput.value || nikInput.value.length !== 16) {
                showToast('NIK harus 16 digit', 'warning');
                return;
            }
            if (!dobInput.value) {
                showToast('Tanggal lahir harus diisi', 'warning');
                return;
            }
            if (!borrowDateInput.value || !returnDateInput.value) {
                showToast('Tanggal harus diisi', 'warning');
                return;
            }
            if (returnDateInput.value < borrowDateInput.value) {
                showToast('Tanggal kembali tidak valid', 'warning');
                return;
            }

            btn.disabled = true;
            btn.innerHTML = 'Memproses...';
            try {
                // Kita ajukan peminjaman dengan status 'pending' (seperti versi PHP)
                // user_id, book_id, borrowDate, returnDate
                const { error } = await supabaseClient.from('borrowings').insert({
                    user_id: currentUser.id,
                    book_id: book.id,
                    borrow_date: borrowDateInput.value,
                    return_date: returnDateInput.value,
                    status: 'pending'
                });

                if (error) throw error;

                // Kurangi stok buku
                await supabaseClient.from('books').update({ stock: book.stock - 1 }).eq('id', book.id);

                showToast('Pengajuan peminjaman berhasil, menunggu verifikasi Admin.', 'success');
                closeModal('book-detail-modal');

                // Update cache stock lokal
                if (apiBooksCache) {
                    const bCache = apiBooksCache.find(x => x.id === book.id);
                    if (bCache) bCache.stock -= 1;
                }
                loadHomeView();
            } catch (err) {
                showToast(err.message || 'Gagal meminjam buku', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="ph ph-book-bookmark"></i> Ajukan Peminjaman';
            }
        };
    }

    openModal('book-detail-modal');
}

// ---------- View: Peminjaman Aktif (User) ----------
async function loadBorrowView() {
    const container = document.getElementById('active-borrowings-container');
    if (!currentUser) return;
    try {
        const activeBorrows = await fetchActiveBorrowings(currentUser.id);
        
        container.innerHTML = '';
        if (activeBorrows.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ph ph-books"></i>
                    <p>Anda belum meminjam buku apapun.</p>
                    <button class="btn-primary" onclick="document.querySelector('[data-view=books-view]').click()">Cari Buku</button>
                </div>
            `;
            return;
        }

        activeBorrows.forEach(b => {
            const isOverdueItem = b.status === 'overdue' || (b.status === 'borrowed' && new Date(b.return_date) < new Date());
            const isPending = b.status === 'pending';
            const isReturnPending = b.status === 'return_pending';
            
            let statusText = '';
            if (isPending) statusText = '<span class="status-badge status-pending" style="background:#ff9800; color:#fff; margin-bottom:10px;">Menunggu</span>';
            else if (isReturnPending) statusText = '<span class="status-badge status-pending" style="background:#ff9800; color:#fff; margin-bottom:10px;">Menunggu Konfirmasi</span>';
            else if (isOverdueItem) statusText = '<span class="status-badge status-overdue" style="margin-bottom:10px;">Terlambat</span>';

            const div = document.createElement('div');
            div.className = 'borrowed-item' + (isOverdueItem ? ' overdue' : '');
            div.innerHTML = `
                <div class="borrowed-book-info">
                    <img src="${escapeHtml(b.books?.cover_url || 'https://via.placeholder.com/150')}" alt="Cover" class="borrowed-cover">
                    <div>
                        <span class="book-title">${escapeHtml(b.books?.title)}</span>
                    </div>
                </div>
                <div class="borrowed-dates">
                    <div class="borrow-date"><i class="ph ph-calendar-plus"></i> Pinjam: ${formatDate(b.borrow_date)}</div>
                    <div class="return-date ${isOverdueItem ? 'text-danger' : ''}"><i class="ph ph-calendar-check"></i> Kembali: ${formatDate(b.return_date)}</div>
                </div>
                <div style="display:flex; align-items:center; gap: 1rem;">
                    ${statusText}
                    <button class="btn-secondary detail-btn">Detail</button>
                </div>
            `;
            
            div.querySelector('.detail-btn').addEventListener('click', () => {
                openBorrowDetail(b);
            });

            container.appendChild(div);
        });
    } catch (e) {
        console.error("Gagal load borrow view:", e);
    }
}

function openBorrowDetail(b) {
    document.getElementById('ticket-borrow-title').textContent = b.books?.title || '-';
    document.getElementById('ticket-borrow-cover').src = b.books?.cover_url || 'https://via.placeholder.com/150x200';
    document.getElementById('ticket-borrow-date').textContent = formatDate(b.borrow_date);
    document.getElementById('ticket-borrow-due').textContent = formatDate(b.return_date);
    
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
    document.getElementById('ticket-view').classList.add('active');

    document.getElementById('btn-back-ticket').onclick = () => {
        document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
        document.getElementById('borrow-view').classList.add('active');
    };

    document.getElementById('btn-download-ticket').onclick = () => {
        const captureArea = document.getElementById('ticket-capture-area');
        if (typeof window.html2canvas !== 'undefined') {
            window.html2canvas(captureArea, { backgroundColor: null }).then(canvas => {
                const link = document.createElement('a');
                link.download = `Tiket-${(b.books?.title || 'Buku').replace(/\s+/g, '-')}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                showToast('Tiket berhasil diunduh', 'success');
            });
        } else {
            showToast('html2canvas tidak terpasang', 'error');
        }
    };
}

// ---------- View: Riwayat Peminjaman (User) ----------
async function loadHistoryView() {
    const tbody = document.getElementById('history-tbody');
    if (!currentUser) return;
    try {
        const { borrowings, total, totalPages } = await fetchBorrowingHistory(currentUser.id, currentHistoryPage);
        
        tbody.innerHTML = '';
        if (borrowings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Belum ada riwayat peminjaman</td></tr>';
        } else {
            borrowings.forEach(b => {
                let statusHtml = '';
                if (b.status === 'returned') statusHtml = '<span class="status-badge status-returned">Dikembalikan</span>';
                else if (b.status === 'overdue') statusHtml = '<span class="status-badge status-overdue">Terlambat</span>';
                else if (b.status === 'pending') statusHtml = '<span class="status-badge status-pending" style="background:#ff9800; color:#fff;">Menunggu</span>';
                else if (b.status === 'return_pending') statusHtml = '<span class="status-badge status-pending" style="background:#ff9800; color:#fff;">Menunggu Konfirmasi</span>';
                else statusHtml = '<span class="status-badge status-borrowed">Dipinjam</span>';

                let actionHtml = '-';
                if (b.status === 'borrowed' || b.status === 'overdue') {
                    actionHtml = `<button class="btn-secondary request-return-btn" data-id="${b.id}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Kembalikan</button>`;
                }

                tbody.innerHTML += `
                    <tr>
                        <td>
                            <div class="table-book">
                                <img src="${escapeHtml(b.books?.cover_url || 'https://via.placeholder.com/50')}" alt="Cover" class="table-cover">
                                <div>
                                    <div class="table-title">${escapeHtml(b.books?.title)}</div>
                                </div>
                            </div>
                        </td>
                        <td>${formatDate(b.borrow_date)}</td>
                        <td>${formatDate(b.return_date)}</td>
                        <td>${b.actual_return_date ? formatDate(b.actual_return_date) : '-'}</td>
                        <td>${statusHtml}</td>
                        <td>${actionHtml}</td>
                    </tr>
                `;
            });
        }

        document.querySelectorAll('.request-return-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                btn.disabled = true;
                btn.textContent = 'Memproses...';
                try {
                    const { error } = await supabaseClient
                        .from('borrowings')
                        .update({ status: 'return_pending' })
                        .eq('id', id);
                    if (error) throw error;
                    
                    showToast('Pengajuan pengembalian diajukan ke admin', 'success');
                    loadHistoryView();
                } catch(err) {
                    showToast('Gagal mengajukan pengembalian', 'error');
                    btn.disabled = false;
                    btn.textContent = 'Kembalikan';
                }
            });
        });

        renderPagination(document.getElementById('history-pagination'), currentHistoryPage, totalPages, (page) => {
            currentHistoryPage = page;
            loadHistoryView();
        });
    } catch(e) {
        console.error("Gagal memuat riwayat", e);
    }
}

// ---------- View: Profil Saya (User) ----------
async function loadProfileView() {
    if (!currentProfile) return;
    document.getElementById('profile-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentProfile.name)}&background=d96c6c&color=fff&size=120`;
    document.getElementById('profile-name-display').textContent = currentProfile.name;
    document.getElementById('profile-email-display').innerHTML = `<i class="ph ph-envelope"></i> ${currentProfile.email}`;
    
    const roleBadge = document.getElementById('profile-role-badge');
    if (currentProfile.role === 'admin') {
        roleBadge.textContent = 'Admin';
        roleBadge.style.background = 'linear-gradient(135deg, #d96c6c, #c0392b)';
    } else {
        roleBadge.textContent = 'Anggota';
        roleBadge.style.background = '';
    }
    
    document.getElementById('profile-joined').textContent = `Bergabung: ${formatDate(currentProfile.created_at)}`;

    // Statistik peminjaman
    const statsRow = document.querySelector('.profile-stats-row');
    if (statsRow) {
        if (currentProfile.role === 'admin') {
            statsRow.style.display = 'none';
        } else {
            statsRow.style.display = '';
            try {
                const [
                    { count: totalBorrowed },
                    { count: activeBorrowed },
                    { count: returned },
                    { count: overdue }
                ] = await Promise.all([
                    supabaseClient.from('borrowings').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id),
                    supabaseClient.from('borrowings').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).in('status', ['borrowed', 'overdue', 'pending', 'return_pending']),
                    supabaseClient.from('borrowings').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).eq('status', 'returned'),
                    supabaseClient.from('borrowings').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).eq('status', 'overdue')
                ]);

                document.getElementById('pstat-total').textContent = totalBorrowed || 0;
                document.getElementById('pstat-active').textContent = activeBorrowed || 0;
                document.getElementById('pstat-returned').textContent = returned || 0;
                document.getElementById('pstat-overdue').textContent = overdue || 0;
            } catch(e) { console.error(e); }
        }
    }

    document.getElementById('edit-name').value = currentProfile.name;
    document.getElementById('edit-email').value = currentProfile.email;
}

function setupProfileForm() {
    const editForm = document.getElementById('profile-edit-form');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = document.getElementById('edit-name').value.trim();
            if (!newName) return;
            
            try {
                showLoading();
                await updateProfile(currentUser.id, { name: newName });
                currentProfile.name = newName;
                loadProfileView();
                document.getElementById('user-display-name').textContent = newName;
                const greetingName = document.getElementById('user-greeting-name');
                if (greetingName) greetingName.textContent = newName;
                document.getElementById('user-avatar-img').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(newName)}&background=d96c6c&color=fff`;
            } catch(e) {
                console.error(e);
            } finally {
                hideLoading();
            }
        });
    }

    const pwForm = document.getElementById('change-password-form');
    if (pwForm) {
        pwForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPw = document.getElementById('new-password').value;
            if (newPw.length < 6) {
                showToast('Password minimal 6 karakter', 'warning');
                return;
            }
            try {
                await changePassword(newPw);
                pwForm.reset();
            } catch(e) {
                console.error(e);
            }
        });
    }
}

// ==========================================================
// ADMIN VIEWS
// ==========================================================

// ---------- Admin: Dashboard ----------
async function loadAdminDashboardView() {
    try {
        const stats = await fetchDashboardStats();
        
        document.getElementById('adm-total-books').textContent = stats.totalBooks || 0;
        document.getElementById('adm-total-members').textContent = stats.totalMembers || 0;
        document.getElementById('adm-active-borrow').textContent = stats.activeBorrow || 0;
        document.getElementById('adm-overdue').textContent = stats.overdue || 0;
        document.getElementById('adm-returned').textContent = stats.returned || 0;
        document.getElementById('adm-total-cats').textContent = stats.totalCats || 0;

        // Fetch borrowings (limit 15 for table & dashboard alerts)
        const { borrowings } = await fetchAllBorrowings({ page: 1 });

        // Load overdue list
        const overdueList = document.getElementById('admin-overdue-list');
        if (overdueList) {
            overdueList.innerHTML = '';
            const overdueItems = await fetchOverdueBorrowings();
            if (overdueItems.length === 0) {
                overdueList.innerHTML = '<p class="text-center">Tidak ada buku yang terlambat.</p>';
            } else {
                overdueItems.forEach(b => {
                    const uName = b.profiles?.name || 'User';
                    overdueList.innerHTML += `
                        <div class="overdue-item">
                            <div class="overdue-info">
                                <strong>${escapeHtml(b.books?.title)}</strong>
                                <span class="text-light text-sm" style="display:block;">Peminjam: ${escapeHtml(uName)} | Batas: ${formatDate(b.return_date)}</span>
                            </div>
                            <button class="btn-secondary warn-btn" data-email="${b.profiles?.email}" style="color: var(--danger-color); border-color: var(--danger-color);"><i class="ph ph-warning"></i> Peringatkan</button>
                        </div>
                    `;
                });
                document.querySelectorAll('.warn-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        showToast(`Peringatan email disimulasikan ke: ${btn.dataset.email}`, 'success');
                    });
                });
            }
        }

        // Recent borrowings
        const recentTbody = document.getElementById('admin-recent-borrowings');
        if (recentTbody) {
            recentTbody.innerHTML = '';
            const recentItems = borrowings.slice(0, 5);
            if (recentItems.length === 0) {
                recentTbody.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada peminjaman terbaru</td></tr>';
            } else {
                recentItems.forEach(b => {
                    let statusHtml = '';
                    if (b.status === 'pending') statusHtml = '<span class="status-badge status-pending" style="background:#ff9800; color:#fff;">Menunggu</span>';
                    else if (b.status === 'returned') statusHtml = '<span class="status-badge status-returned">Dikembalikan</span>';
                    else if (b.status === 'overdue') statusHtml = '<span class="status-badge status-overdue">Terlambat</span>';
                    else if (b.status === 'return_pending') statusHtml = '<span class="status-badge status-pending" style="background:#ff9800; color:#fff;">Menunggu Kembali</span>';
                    else statusHtml = '<span class="status-badge status-borrowed">Dipinjam</span>';

                    recentTbody.innerHTML += `
                        <tr>
                            <td><strong>${escapeHtml(b.profiles?.name || 'User')}</strong></td>
                            <td>${escapeHtml(b.books?.title)}</td>
                            <td>${formatDate(b.borrow_date)}</td>
                            <td>${formatDate(b.return_date)}</td>
                            <td>${statusHtml}</td>
                        </tr>
                    `;
                });
            }
        }
    } catch (e) {
        console.error("Gagal memuat dashboard admin:", e);
    }
}

// ---------- Admin: Kelola Buku ----------
async function loadAdminBooksView() {
    const tbody = document.getElementById('admin-books-tbody');
    if (!tbody) return;

    try {
        const { books, total, totalPages } = await fetchAllBooksAdmin({ 
            page: currentAdminBooksPage, 
            search: adminBooksSearchTerm, 
            categoryId: adminBooksCategoryId 
        });
        allAdminBooksData = books;

        tbody.innerHTML = '';
        if (books.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Belum ada buku</td></tr>';
        } else {
            books.forEach(b => {
                tbody.innerHTML += `
                    <tr>
                        <td><img src="${b.cover_url || 'https://via.placeholder.com/50x70'}" alt="Cover" style="width:50px; height:70px; object-fit:cover; border-radius:4px;"></td>
                        <td>${escapeHtml(b.title)}</td>
                        <td>${escapeHtml(b.author)}</td>
                        <td>${escapeHtml(b.categories?.name || '-')}</td>
                        <td>${b.stock}</td>
                        <td>
                            <button class="btn-icon btn-edit-book" data-id="${b.id}" title="Edit"><i class="ph ph-pencil-simple"></i></button>
                            <button class="btn-icon btn-delete-book" data-id="${b.id}" title="Hapus" style="color:var(--danger-color);"><i class="ph ph-trash"></i></button>
                        </td>
                    </tr>
                `;
            });

            // Bind Edit Books
            document.querySelectorAll('.btn-edit-book').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    editBook(id);
                });
            });

            // Bind Delete Books
            document.querySelectorAll('.btn-delete-book').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    if (confirm('Apakah Anda yakin ingin menghapus buku ini?')) {
                        try {
                            await deleteBook(id);
                            loadAdminBooksView();
                        } catch(e) {
                            console.error(e);
                        }
                    }
                });
            });

            renderPagination(document.getElementById('admin-books-pagination'), currentAdminBooksPage, totalPages, (page) => {
                currentAdminBooksPage = page;
                loadAdminBooksView();
            });
        }
    } catch(e) {
        console.error(e);
    }
}

// Bind search filter untuk buku admin (sekali saja)
const adminSearchInput = document.getElementById('admin-books-search');
if (adminSearchInput && !adminSearchInput.dataset.bound) {
    adminSearchInput.dataset.bound = "true";
    adminSearchInput.addEventListener('input', debounce((e) => {
        adminBooksSearchTerm = e.target.value.toLowerCase();
        currentAdminBooksPage = 1;
        loadAdminBooksView();
    }, 300));
}

async function editBook(id) {
    const book = allAdminBooksData.find(b => b.id == id);
    if (!book) return;
    
    document.getElementById('book-form').reset();
    document.getElementById('book-form-id').value = book.id;
    document.getElementById('book-form-title').textContent = 'Edit Buku';
    
    document.getElementById('bf-title').value = book.title || '';
    document.getElementById('bf-author').value = book.author || '';
    document.getElementById('bf-stock').value = book.stock || 0;
    document.getElementById('bf-cover').value = book.cover_url || '';
    document.getElementById('bf-desc').value = book.description || '';
    
    const catSelect = document.getElementById('bf-category');
    catSelect.innerHTML = '<option value="">Pilih Kategori</option>';
    try {
        const cats = await fetchCategories();
        cats.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            if (c.id == book.category_id) opt.selected = true;
            catSelect.appendChild(opt);
        });
    } catch(e) {}
    
    openModal('book-form-modal');
}

// Handler Add Book & Submit Book Form
const addBookBtn = document.getElementById('add-book-btn');
if (addBookBtn && !addBookBtn.dataset.bound) {
    addBookBtn.dataset.bound = "true";
    addBookBtn.addEventListener('click', async () => {
        document.getElementById('book-form').reset();
        document.getElementById('book-form-id').value = '';
        document.getElementById('book-form-title').textContent = 'Tambah Buku';
        
        const catSelect = document.getElementById('bf-category');
        catSelect.innerHTML = '<option value="">Pilih Kategori</option>';
        try {
            const cats = await fetchCategories();
            cats.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                catSelect.appendChild(opt);
            });
        } catch(e) {}
        
        openModal('book-form-modal');
    });

    document.getElementById('book-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = 'Memproses...';

        const bookId = document.getElementById('book-form-id').value;
        const bookData = {
            title: document.getElementById('bf-title').value,
            author: document.getElementById('bf-author').value,
            category_id: document.getElementById('bf-category').value || null,
            stock: parseInt(document.getElementById('bf-stock').value) || 0,
            cover_url: document.getElementById('bf-cover').value || null,
            description: document.getElementById('bf-desc').value || null
        };

        try {
            if (bookId) {
                await updateBook(bookId, bookData);
            } else {
                await createBook(bookData);
            }
            closeModal('book-form-modal');
            loadAdminBooksView();
        } catch(err) {
            console.error(err);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="ph ph-floppy-disk"></i> Simpan';
        }
    });
}

// ---------- Admin: Kelola Kategori (Baru Di-wire!) ----------
async function loadAdminCategoriesView() {
    const tbody = document.getElementById('admin-cats-tbody');
    if (!tbody) return;

    try {
        const cats = await fetchAllCategories();
        allAdminCategoriesData = cats;
        tbody.innerHTML = '';
        if (cats.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center">Belum ada kategori</td></tr>';
        } else {
            cats.forEach(c => {
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${escapeHtml(c.name)}</strong></td>
                        <td>${formatDate(c.created_at)}</td>
                        <td>
                            <button class="btn-icon btn-edit-cat" data-id="${c.id}" title="Edit"><i class="ph ph-pencil-simple"></i></button>
                            <button class="btn-icon btn-delete-cat" data-id="${c.id}" title="Hapus" style="color:var(--danger-color);"><i class="ph ph-trash"></i></button>
                        </td>
                    </tr>
                `;
            });

            // Bind edit
            document.querySelectorAll('.btn-edit-cat').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const cat = allAdminCategoriesData.find(x => x.id == id);
                    if (!cat) return;
                    document.getElementById('cat-form-id').value = cat.id;
                    document.getElementById('cf-name').value = cat.name;
                    document.getElementById('cat-form-title').textContent = 'Edit Kategori';
                    openModal('cat-form-modal');
                });
            });

            // Bind delete
            document.querySelectorAll('.btn-delete-cat').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    if (confirm('Yakin ingin menghapus kategori ini? Buku yang terhubung akan bernilai uncategorized.')) {
                        try {
                            await deleteCategory(id);
                            loadAdminCategoriesView();
                        } catch(e) {
                            console.error(e);
                        }
                    }
                });
            });
        }
    } catch(e) {
        console.error(e);
    }
}

// Form Kategori Handler (sekali saja)
const addCatBtn = document.getElementById('add-cat-btn');
if (addCatBtn && !addCatBtn.dataset.bound) {
    addCatBtn.dataset.bound = "true";
    addCatBtn.addEventListener('click', () => {
        document.getElementById('cat-form').reset();
        document.getElementById('cat-form-id').value = '';
        document.getElementById('cat-form-title').textContent = 'Tambah Kategori';
        openModal('cat-form-modal');
    });

    document.getElementById('cat-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('cat-form-id').value;
        const name = document.getElementById('cf-name').value.trim();
        if (!name) return;

        try {
            if (id) {
                await updateCategory(id, name);
            } else {
                await createCategory(name);
            }
            closeModal('cat-form-modal');
            loadAdminCategoriesView();
        } catch(e) {
            console.error(e);
        }
    });
}

// ---------- Admin: Kelola Peminjaman ----------
async function loadAdminBorrowingsView() {
    const tbody = document.getElementById('admin-borrowings-tbody');
    if (!tbody) return;
    try {
        const { borrowings } = await fetchAllBorrowings({ 
            page: 1, 
            status: adminBorrowStatusFilter 
        });
        
        tbody.innerHTML = '';
        if (borrowings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Belum ada data peminjaman</td></tr>';
        } else {
            borrowings.forEach(b => {
                const uName = b.profiles?.name || 'User';
                let statusHtml = '';
                if (b.status === 'pending') statusHtml = '<span class="status-badge status-pending" style="background:#ff9800; color:#fff;">Menunggu</span>';
                else if (b.status === 'returned') statusHtml = '<span class="status-badge status-returned">Dikembalikan</span>';
                else if (b.status === 'overdue') statusHtml = '<span class="status-badge status-overdue">Terlambat</span>';
                else if (b.status === 'return_pending') statusHtml = '<span class="status-badge status-pending" style="background:#ff9800; color:#fff;">Menunggu Kembali</span>';
                else statusHtml = '<span class="status-badge status-borrowed">Dipinjam</span>';

                let actionHtml = '';
                if (b.status === 'pending') {
                    actionHtml = `<button class="btn-primary confirm-borrow-btn" data-id="${b.id}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Terima</button>`;
                } else if (b.status === 'borrowed' || b.status === 'overdue' || b.status === 'return_pending') {
                    actionHtml = `<button class="btn-secondary confirm-return-btn" data-id="${b.id}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Kembali</button>`;
                } else {
                    actionHtml = `<span class="text-light">-</span>`;
                }

                tbody.innerHTML += `
                    <tr>
                        <td><strong>${escapeHtml(uName)}</strong><br><small>Email: ${escapeHtml(b.profiles?.email)}</small></td>
                        <td>${escapeHtml(b.books?.title)}</td>
                        <td>${formatDate(b.borrow_date)}</td>
                        <td>${formatDate(b.return_date)}</td>
                        <td>${statusHtml}</td>
                        <td>${actionHtml}</td>
                    </tr>
                `;
            });
            
            document.querySelectorAll('.confirm-borrow-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.getAttribute('data-id');
                    await supabaseClient.from('borrowings').update({ status: 'borrowed' }).eq('id', id);
                    showToast('Peminjaman diterima', 'success');
                    loadAdminBorrowingsView();
                });
            });
            
            document.querySelectorAll('.confirm-return-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.getAttribute('data-id');
                    await returnBook(id);
                    loadAdminBorrowingsView();
                });
            });
        }
    } catch(e) {
        console.error(e);
    }
}

// Bind Filter Peminjaman
const borrowFilterSelect = document.getElementById('admin-borrow-status-filter');
if (borrowFilterSelect && !borrowFilterSelect.dataset.bound) {
    borrowFilterSelect.dataset.bound = "true";
    borrowFilterSelect.addEventListener('change', (e) => {
        adminBorrowStatusFilter = e.target.value;
        loadAdminBorrowingsView();
    });
}

// Bind Add Borrowing Admin (Menambah data manual oleh admin)
const addBorrowingBtn = document.getElementById('add-borrowing-btn');
if (addBorrowingBtn && !addBorrowingBtn.dataset.bound) {
    addBorrowingBtn.dataset.bound = "true";
    addBorrowingBtn.addEventListener('click', async () => {
        document.getElementById('borrowing-form').reset();
        document.getElementById('borrowing-form-id').value = '';
        document.getElementById('borrowing-form-title').textContent = 'Tambah Peminjaman';

        const userSelect = document.getElementById('bform-user');
        const bookSelect = document.getElementById('bform-book');
        
        userSelect.innerHTML = '<option value="">Pilih Anggota</option>';
        bookSelect.innerHTML = '<option value="">Pilih Buku</option>';
        
        try {
            // Load members and books
            const [membersRes, booksRes] = await Promise.all([
                supabaseClient.from('profiles').select('id, name').eq('role', 'user'),
                supabaseClient.from('books').select('id, title').gt('stock', 0)
            ]);
            
            (membersRes.data || []).forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.name;
                userSelect.appendChild(opt);
            });

            (booksRes.data || []).forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.id;
                opt.textContent = b.title;
                bookSelect.appendChild(opt);
            });
        } catch(e) { console.error(e); }

        document.getElementById('bform-borrow-date').value = getTodayISO();
        const returnDate = new Date();
        returnDate.setDate(returnDate.getDate() + 7);
        document.getElementById('bform-return-date').value = returnDate.toISOString().split('T')[0];

        openModal('borrowing-form-modal');
    });

    document.getElementById('borrowing-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;

        const payload = {
            user_id: document.getElementById('bform-user').value,
            book_id: parseInt(document.getElementById('bform-book').value),
            borrow_date: document.getElementById('bform-borrow-date').value,
            return_date: document.getElementById('bform-return-date').value,
            status: document.getElementById('bform-status').value
        };

        try {
            const success = await adminCreateBorrowing(payload);
            if (success) {
                closeModal('borrowing-form-modal');
                loadAdminBorrowingsView();
            }
        } catch(err) {
            console.error(err);
        } finally {
            btn.disabled = false;
        }
    });
}

// ---------- Admin: Kelola Anggota ----------
async function loadAdminMembersView() {
    try {
        const { members } = await fetchAllMembers({ page: 1 });
        allMembersData = members;
        renderMembersList();
    } catch(e) { console.error(e); }
}

function renderMembersList() {
    const tbody = document.getElementById('admin-members-tbody');
    if (!tbody) return;
    
    const search = (document.getElementById('admin-member-search')?.value || '').toLowerCase();
    const filtered = allMembersData.filter(m => 
        (m.name && m.name.toLowerCase().includes(search)) || 
        (m.email && m.email.toLowerCase().includes(search))
    );
    
    const PAGE_SIZE = 10;
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
    const start = (currentAdminMembersPage - 1) * PAGE_SIZE;
    const pagedMembers = filtered.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = '';
    if (pagedMembers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Belum ada anggota</td></tr>';
    } else {
        pagedMembers.forEach(m => {
            const avatar = m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=random`;
            tbody.innerHTML += `
                <tr>
                    <td><img src="${avatar}" alt="Avatar" style="width:40px; height:40px; border-radius:50%;"></td>
                    <td>${escapeHtml(m.name)}</td>
                    <td>${escapeHtml(m.email)}</td>
                    <td>${m.created_at ? formatDate(m.created_at) : '-'}</td>
                    <td>
                        <button class="btn-icon btn-edit-member" data-id="${m.id}" title="Edit"><i class="ph ph-pencil-simple"></i></button>
                        <button class="btn-icon btn-delete-member" data-id="${m.id}" title="Hapus" style="color:#e74c3c;"><i class="ph ph-trash"></i></button>
                    </td>
                </tr>
            `;
        });

        // Bind Edit
        document.querySelectorAll('.btn-edit-member').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                editMember(id);
            });
        });

        // Bind Delete
        document.querySelectorAll('.btn-delete-member').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                deleteMemberById(id, 'user');
            });
        });

        const pagBar = document.getElementById('admin-members-pagination');
        if (pagBar) {
            renderPagination(pagBar, currentAdminMembersPage, totalPages, (page) => {
                currentAdminMembersPage = page;
                renderMembersList();
            });
        }
    }
}

// Bind search input anggota (sekali saja)
const adminMemberSearch = document.getElementById('admin-member-search');
if (adminMemberSearch && !adminMemberSearch.dataset.bound) {
    adminMemberSearch.dataset.bound = "true";
    adminMemberSearch.addEventListener('input', () => {
        currentAdminMembersPage = 1;
        renderMembersList();
    });
}

function editMember(id) {
    const member = allMembersData.find(m => m.id == id);
    if (!member) return;
    
    document.getElementById('member-edit-form').reset();
    document.getElementById('member-edit-id').value = member.id;
    document.getElementById('member-form-title').textContent = 'Edit Anggota';
    
    document.getElementById('me-name').value = member.name || '';
    document.getElementById('me-email').value = member.email || '';
    document.getElementById('me-role').disabled = false;
    document.getElementById('me-role').value = member.role || 'user';
    document.getElementById('me-password').value = '';
    
    document.getElementById('me-password-hint').style.display = 'inline';
    document.getElementById('me-password').required = false;
    
    openModal('member-edit-modal');
}

// Bind Add Member Form Submit (sekali saja)
const addMemberBtn = document.getElementById('add-member-btn');
if (addMemberBtn && !addMemberBtn.dataset.bound) {
    addMemberBtn.dataset.bound = "true";
    addMemberBtn.addEventListener('click', () => {
        document.getElementById('member-edit-form').reset();
        document.getElementById('member-edit-id').value = '';
        document.getElementById('member-form-title').textContent = 'Tambah Anggota';
        document.getElementById('me-password-hint').style.display = 'none';
        document.getElementById('me-password').required = true;
        document.getElementById('me-role').disabled = false;
        openModal('member-edit-modal');
    });

    document.getElementById('member-edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = 'Memproses...';

        const id = document.getElementById('member-edit-id').value;
        const name = document.getElementById('me-name').value.trim();
        const email = document.getElementById('me-email').value.trim();
        const password = document.getElementById('me-password').value;
        const role = document.getElementById('me-role').value;

        try {
            if (!id) {
                // Gunakan tempSupabase untuk mendaftar user agar Admin tidak otomatis log out
                if (!tempSupabase) throw new Error('Supabase client temporer tidak tersedia.');
                
                const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
                    email,
                    password,
                    options: { data: { name } }
                });
                if (signUpError) throw signUpError;
                
                // Beri jeda 1.5 detik agar trigger handle_new_user di DB selesai menyisipkan ke profiles
                setTimeout(async () => {
                    await supabaseClient
                        .from('profiles')
                        .update({ role })
                        .eq('id', signUpData.user.id);

                    showToast('Anggota berhasil ditambahkan', 'success');
                    closeModal('member-edit-modal');
                    loadAdminMembersView();
                }, 1500);
            } else {
                // Edit Anggota
                await updateMember(id, { name, role });
                closeModal('member-edit-modal');
                if (document.getElementById('member-edit-form').dataset.targetView === 'admins') {
                    loadAdminAdminsView();
                } else {
                    loadAdminMembersView();
                }
            }
        } catch(err) {
            showToast(err.message || 'Gagal menyimpan data.', 'error');
            btn.disabled = false;
            btn.innerHTML = 'Simpan';
        } finally {
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = 'Simpan';
            }, 2000);
        }
    });
}

// ---------- Admin: Kelola Admin ----------
async function loadAdminAdminsView() {
    try {
        const { data, error } = await supabaseClient.from('profiles').select('*').eq('role', 'admin').order('created_at', { ascending: false });
        if (error) throw error;
        allAdminsData = data || [];
        renderAdminsList();
    } catch(e) { console.error(e); }
}

function renderAdminsList() {
    const tbody = document.getElementById('admin-admins-tbody');
    if (!tbody) return;

    const search = (document.getElementById('admin-admin-search')?.value || '').toLowerCase();
    const filtered = allAdminsData.filter(m =>
        (m.name && m.name.toLowerCase().includes(search)) ||
        (m.email && m.email.toLowerCase().includes(search))
    );

    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada admin</td></tr>';
        return;
    }

    filtered.forEach(m => {
        const avatar = m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=d96c6c&color=fff`;
        const isCurrentAdmin = m.id === currentUser?.id;
        tbody.innerHTML += `
            <tr>
                <td><img src="${avatar}" alt="Avatar" style="width:40px;height:40px;border-radius:50%;"></td>
                <td>
                    <strong>${escapeHtml(m.name)}</strong>
                    ${isCurrentAdmin ? '<span style="font-size:0.75em;color:var(--primary-color);margin-left:6px;">(Anda)</span>' : ''}
                </td>
                <td>${escapeHtml(m.email)}</td>
                <td>${m.created_at ? formatDate(m.created_at) : '-'}</td>
                <td>
                    <button class="btn-icon btn-edit-admin" data-id="${m.id}" title="Edit"><i class="ph ph-pencil-simple"></i></button>
                    ${!isCurrentAdmin ? `<button class="btn-icon btn-delete-admin" data-id="${m.id}" title="Hapus" style="color:#e74c3c;"><i class="ph ph-trash"></i></button>` : ''}
                </td>
            </tr>
        `;
    });

    // Bind Edit Admin
    document.querySelectorAll('.btn-edit-admin').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            editAdminAccount(id);
        });
    });

    // Bind Delete Admin
    document.querySelectorAll('.btn-delete-admin').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            deleteMemberById(id, 'admin');
        });
    });
}

// Bind search input admin (sekali saja)
const adminAdminSearch = document.getElementById('admin-admin-search');
if (adminAdminSearch && !adminAdminSearch.dataset.bound) {
    adminAdminSearch.dataset.bound = "true";
    adminAdminSearch.addEventListener('input', renderAdminsList);
}

// Bind Add Admin Button (sekali saja)
const addAdminBtn = document.getElementById('add-admin-btn');
if (addAdminBtn && !addAdminBtn.dataset.bound) {
    addAdminBtn.dataset.bound = "true";
    addAdminBtn.addEventListener('click', () => {
        document.getElementById('member-edit-form').reset();
        document.getElementById('member-edit-id').value = '';
        document.getElementById('member-form-title').textContent = 'Tambah Admin';
        document.getElementById('me-password-hint').style.display = 'none';
        document.getElementById('me-password').required = true;
        document.getElementById('me-role').value = 'admin';
        document.getElementById('me-role').disabled = true;
        document.getElementById('member-edit-form').dataset.targetView = 'admins';
        openModal('member-edit-modal');
    });
}

function editAdminAccount(id) {
    const member = allAdminsData.find(m => m.id == id);
    if (!member) return;

    document.getElementById('member-edit-form').reset();
    document.getElementById('member-edit-id').value = member.id;
    document.getElementById('member-form-title').textContent = 'Edit Admin';

    document.getElementById('me-name').value = member.name || '';
    document.getElementById('me-email').value = member.email || '';
    document.getElementById('me-role').value = 'admin';
    document.getElementById('me-role').disabled = true;
    document.getElementById('me-password').value = '';

    document.getElementById('me-password-hint').style.display = 'inline';
    document.getElementById('me-password').required = false;

    document.getElementById('member-edit-form').dataset.targetView = 'admins';

    openModal('member-edit-modal');
}

// ---------- Admin: Laporan ----------
let reportsCachedData = [];

async function loadAdminReportsView() {
    const tbody = document.getElementById('report-tbody');
    if (!tbody) return;

    const fromDate = document.getElementById('report-from').value;
    const toDate = document.getElementById('report-to').value;

    try {
        const { borrowings } = await fetchBorrowingReport({ 
            fromDate, 
            toDate, 
            page: 1 
        });
        reportsCachedData = borrowings;

        tbody.innerHTML = '';
        if (borrowings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Tidak ada peminjaman dalam periode ini</td></tr>';
        } else {
            borrowings.forEach(b => {
                const uName = b.profiles?.name || 'User';
                let statusHtml = '';
                if (b.status === 'pending') statusHtml = '<span class="status-badge status-pending" style="background:#ff9800; color:#fff;">Menunggu</span>';
                else if (b.status === 'returned') statusHtml = '<span class="status-badge status-returned">Dikembalikan</span>';
                else if (b.status === 'overdue') statusHtml = '<span class="status-badge status-overdue">Terlambat</span>';
                else statusHtml = '<span class="status-badge status-borrowed">Dipinjam</span>';

                tbody.innerHTML += `
                    <tr>
                        <td><strong>${escapeHtml(uName)}</strong></td>
                        <td>${escapeHtml(b.books?.title)}</td>
                        <td>${formatDate(b.borrow_date)}</td>
                        <td>${formatDate(b.return_date)}</td>
                        <td>${b.actual_return_date ? formatDate(b.actual_return_date) : '-'}</td>
                        <td>${statusHtml}</td>
                    </tr>
                `;
            });
        }
    } catch(e) { console.error(e); }
}

// Bind Filter & Export Laporan (sekali saja)
const filterReportBtn = document.getElementById('report-filter-btn');
if (filterReportBtn && !filterReportBtn.dataset.bound) {
    filterReportBtn.dataset.bound = "true";
    filterReportBtn.addEventListener('click', loadAdminReportsView);

    const exportBtn = document.getElementById('export-report-btn');
    exportBtn.addEventListener('click', () => {
        if (reportsCachedData.length === 0) {
            showToast('Tidak ada data untuk diekspor', 'warning');
            return;
        }
        const headers = ['Nama Anggota', 'Judul Buku', 'Tanggal Pinjam', 'Batas Kembali', 'Tanggal Dikembalikan', 'Status'];
        const rows = reportsCachedData.map(b => [
            b.profiles?.name || 'User',
            b.books?.title || '',
            b.borrow_date,
            b.return_date,
            b.actual_return_date || '-',
            b.status
        ]);
        exportCSV(headers, rows, `Laporan-Peminjaman-${getTodayISO()}.csv`);
    });
}

// ---------- Hapus Member/Admin ----------
window.deleteMemberById = async function(id, type) {
    const label = type === 'admin' ? 'admin' : 'anggota';
    if (!confirm(`Apakah Anda yakin ingin menghapus ${label} ini? Tindakan ini tidak bisa dibatalkan.`)) return;

    try {
        // Hapus dari profiles
        const { error } = await supabaseClient.from('profiles').delete().eq('id', id);
        if (error) throw error;

        showToast(`${label.charAt(0).toUpperCase() + label.slice(1)} berhasil dihapus dari database profil.`, 'success');
        if (type === 'admin') {
            loadAdminAdminsView();
        } else {
            loadAdminMembersView();
        }
    } catch(err) {
        showToast(err.message, 'error');
    }
};

// ---------- Load Listener ----------
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
