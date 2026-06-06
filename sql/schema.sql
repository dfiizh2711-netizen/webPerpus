-- ============================================
-- Sistem Peminjaman Buku Perpustakaan - MySQL Schema
-- Sesuaikan untuk hosting MySQL / phpMyAdmin
-- ============================================

-- Hapus tabel lama jika ada agar struktur diperbarui
DROP TABLE IF EXISTS borrowings;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS categories;

-- 1. Tabel Kategori
CREATE TABLE IF NOT EXISTS categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Tabel Pengguna
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('user','admin') NOT NULL DEFAULT 'user',
    avatar_url VARCHAR(255) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Tabel Buku
CREATE TABLE IF NOT EXISTS books (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    category_id INT UNSIGNED DEFAULT NULL,
    stock INT NOT NULL DEFAULT 0,
    cover_url TEXT DEFAULT NULL,
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_books_category FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Tabel Peminjaman
CREATE TABLE IF NOT EXISTS borrowings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    book_id INT UNSIGNED NOT NULL,
    borrow_date DATE NOT NULL DEFAULT (CURRENT_DATE),
    return_date DATE NOT NULL,
    actual_return_date DATE DEFAULT NULL,
    status ENUM('pending','borrowed','returned','overdue') NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_borrowings_user FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_borrowings_book FOREIGN KEY (book_id)
        REFERENCES books(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_books_category ON books(category_id);
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_borrowings_user ON borrowings(user_id);
CREATE INDEX idx_borrowings_status ON borrowings(status);
CREATE INDEX idx_borrowings_return_date ON borrowings(return_date);

-- ============================================
-- Seed Data: Kategori
-- ============================================
INSERT INTO categories (name) VALUES
    ('Fiksi'),
    ('Non-Fiksi'),
    ('Sains'),
    ('Sejarah'),
    ('Teknologi'),
    ('Fantasi'),
    ('Sastra')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ============================================
-- Seed Data: Pengguna
-- ============================================
INSERT INTO users (name, email, password, role, avatar_url) VALUES
    ('Admin Perpus', 'admin@perpus.com', '$2y$10$z8WPVLgmNjqPz/Lyau9cluKzxvGf8LXF6FxhA5fi9FqNPxTPB8E6y', 'admin', NULL),
    ('Test User', 'user@perpus.com', '$2y$10$z8WPVLgmNjqPz/Lyau9cluKzxvGf8LXF6FxhA5fi9FqNPxTPB8E6y', 'user', NULL)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ============================================
-- Seed Data: Buku
-- ============================================
INSERT INTO books (title, author, category_id, stock, cover_url, description) VALUES
    (
        'Pengantar Pemrograman',
        'Budi Santoso',
        (SELECT id FROM categories WHERE name = 'Teknologi' LIMIT 1),
        10,
        'assets/books/book1.jpg',
        'Buku dasar pemrograman untuk pemula dengan contoh JavaScript dan PHP.'
    ),
    (
        'Sejarah Perpustakaan Modern',
        'Siti Aminah',
        (SELECT id FROM categories WHERE name = 'Non-Fiksi' LIMIT 1),
        5,
        'assets/books/book2.jpg',
        'Ringkasan perkembangan sistem perpustakaan dari era klasik hingga digital.'
    ),
    (
        'Desain UI/UX untuk Aplikasi',
        'Indra Wijaya',
        (SELECT id FROM categories WHERE name = 'Teknologi' LIMIT 1),
        7,
        'assets/books/book3.jpg',
        'Panduan membuat tampilan aplikasi modern dan responsif menggunakan desain SaaS.'
    )
ON DUPLICATE KEY UPDATE title = VALUES(title);
