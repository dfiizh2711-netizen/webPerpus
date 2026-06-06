// ============================================
// Profile Module
// ============================================
import { supabaseClient } from './config/supabase.js';
import { showToast } from './utils/ui.js';
import { formatDate } from './utils/helpers.js';

// ---------- Render Profile View ----------
export function renderProfile(container, profile, stats) {
    if (!container) return;
    container.innerHTML = `
        <div class="profile-card">
            <div class="profile-header">
                <img src="${profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=d96c6c&color=fff&size=120`}" 
                     alt="${profile.name}" class="profile-avatar">
                <div class="profile-info">
                    <h2>${profile.name}</h2>
                    <p class="profile-email"><i class="ph ph-envelope"></i> ${profile.email}</p>
                    <p class="profile-role"><i class="ph ph-user-circle"></i> ${profile.role === 'admin' ? 'Administrator' : 'Anggota'}</p>
                    <p class="profile-joined"><i class="ph ph-calendar"></i> Bergabung ${formatDate(profile.created_at)}</p>
                </div>
            </div>
            <div class="profile-stats">
                <div class="stat-item">
                    <span class="stat-number">${stats.totalBorrowed || 0}</span>
                    <span class="stat-label">Total Pinjam</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.activeBorrowed || 0}</span>
                    <span class="stat-label">Sedang Dipinjam</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.returned || 0}</span>
                    <span class="stat-label">Dikembalikan</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.overdue || 0}</span>
                    <span class="stat-label">Terlambat</span>
                </div>
            </div>
        </div>

        <div class="profile-edit-section">
            <h3>Edit Profil</h3>
            <form id="profile-edit-form">
                <div class="form-group">
                    <label for="profile-name">Nama</label>
                    <input type="text" id="profile-name" value="${profile.name}" class="input-field" required>
                </div>
                <button type="submit" class="btn-primary">
                    <i class="ph ph-floppy-disk"></i> Simpan Perubahan
                </button>
            </form>
        </div>
    `;
}

// ---------- Get User Stats ----------
export async function getUserStats(userId) {
    const { data: all } = await supabaseClient
        .from('borrowings')
        .select('status')
        .eq('user_id', userId);

    if (!all) return { totalBorrowed: 0, activeBorrowed: 0, returned: 0, overdue: 0 };

    return {
        totalBorrowed: all.length,
        activeBorrowed: all.filter(b => b.status === 'borrowed').length,
        returned: all.filter(b => b.status === 'returned').length,
        overdue: all.filter(b => b.status === 'overdue').length
    };
}
