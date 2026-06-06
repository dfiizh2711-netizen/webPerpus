<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/koneksi.php';

// Cek apakah admin
if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['message' => 'Akses ditolak']);
    exit;
}

$action = $_GET['action'] ?? ($_POST['action'] ?? '');

if ($action === 'stats') {
    // 1. Total Buku
    $res = $koneksi->query("SELECT COUNT(*) as total FROM books");
    $totalBooks = $res->fetch_assoc()['total'];

    // 2. Total Anggota (user)
    $res = $koneksi->query("SELECT COUNT(*) as total FROM users WHERE role = 'user'");
    $totalMembers = $res->fetch_assoc()['total'];

    // 3. Sedang Dipinjam
    $res = $koneksi->query("SELECT COUNT(*) as total FROM borrowings WHERE status = 'borrowed'");
    $activeBorrow = $res->fetch_assoc()['total'];

    // 4. Terlambat
    $res = $koneksi->query("SELECT COUNT(*) as total FROM borrowings WHERE status = 'overdue' OR (status = 'borrowed' AND return_date < CURRENT_DATE)");
    $overdue = $res->fetch_assoc()['total'];

    // 5. Total Dikembalikan
    $res = $koneksi->query("SELECT COUNT(*) as total FROM borrowings WHERE status = 'returned'");
    $returned = $res->fetch_assoc()['total'];

    // 6. Total Kategori
    $res = $koneksi->query("SELECT COUNT(*) as total FROM categories");
    $totalCats = $res->fetch_assoc()['total'];

    echo json_encode([
        'totalBooks' => (int)$totalBooks,
        'totalMembers' => (int)$totalMembers,
        'activeBorrow' => (int)$activeBorrow,
        'overdue' => (int)$overdue,
        'returned' => (int)$returned,
        'totalCats' => (int)$totalCats
    ]);
    exit;
}

if ($action === 'members') {
    $res = $koneksi->query("SELECT id, name, email, role, created_at, avatar_url FROM users WHERE role='user' ORDER BY created_at DESC");
    $members = [];
    while($row = $res->fetch_assoc()) $members[] = $row;
    echo json_encode(['members' => $members]);
    exit;
}

if ($action === 'admins') {
    $res = $koneksi->query("SELECT id, name, email, role, created_at, avatar_url FROM users WHERE role='admin' ORDER BY created_at DESC");
    $admins = [];
    while($row = $res->fetch_assoc()) $admins[] = $row;
    echo json_encode(['admins' => $admins]);
    exit;
}

if ($action === 'books') {
    $res = $koneksi->query("SELECT b.*, c.name as category_name FROM books b LEFT JOIN categories c ON b.category_id = c.id ORDER BY b.created_at DESC");
    $books = [];
    while($row = $res->fetch_assoc()) $books[] = $row;
    echo json_encode(['books' => $books]);
    exit;
}

if ($action === 'borrowings') {
    $res = $koneksi->query("SELECT b.*, u.name as user_name, bk.title as book_title, bk.cover_url as book_cover FROM borrowings b JOIN users u ON b.user_id = u.id JOIN books bk ON b.book_id = bk.id ORDER BY b.created_at DESC");
    $borrowings = [];
    while($row = $res->fetch_assoc()) $borrowings[] = $row;
    echo json_encode(['borrowings' => $borrowings]);
    exit;
}

if ($action === 'approve_borrow') {
    $id = $_POST['id'] ?? '';
    $stmt = $koneksi->prepare("UPDATE borrowings SET status = 'borrowed' WHERE id = ?");
    $stmt->bind_param("s", $id);
    $stmt->execute();
    echo json_encode(['status' => 'ok']);
    exit;
}

if ($action === 'return_borrow') {
    $id = $_POST['id'] ?? '';
    $stmt = $koneksi->prepare("UPDATE borrowings SET status = 'returned', actual_return_date = CURRENT_DATE WHERE id = ?");
    $stmt->bind_param("s", $id);
    if($stmt->execute()){
        $res = $koneksi->query("SELECT book_id FROM borrowings WHERE id = '$id'");
        if($row = $res->fetch_assoc()){
            $koneksi->query("UPDATE books SET stock = stock + 1 WHERE id = '{$row['book_id']}'");
        }
    }
    echo json_encode(['status' => 'ok']);
    exit;
}

if ($action === 'categories') {
    $res = $koneksi->query("SELECT * FROM categories ORDER BY name ASC");
    $cats = [];
    while($row = $res->fetch_assoc()) $cats[] = $row;
    echo json_encode(['categories' => $cats]);
    exit;
}

$postAction = $_POST['action'] ?? '';
if ($postAction === 'save_book') {
    $id = $_POST['id'] ?? null;
    $title = $_POST['title'] ?? '';
    $author = $_POST['author'] ?? '';
    $category_id = $_POST['category_id'] ?? null;
    if ($category_id === '') $category_id = null;
    $stock = (int)($_POST['stock'] ?? 0);
    $cover_url = $_POST['cover_url'] ?? '';
    $description = $_POST['description'] ?? '';

    if ($title === '' || $author === '' || empty($category_id)) {
        http_response_code(400);
        echo json_encode(['message' => 'Judul, Penulis, dan Kategori wajib diisi']);
        exit;
    }

    if ($id) {
        $stmt = $koneksi->prepare("UPDATE books SET title=?, author=?, category_id=?, stock=?, cover_url=?, description=? WHERE id=?");
        $stmt->bind_param("ssiissi", $title, $author, $category_id, $stock, $cover_url, $description, $id);
    } else {
        $stmt = $koneksi->prepare("INSERT INTO books (title, author, category_id, stock, cover_url, description) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("ssiiss", $title, $author, $category_id, $stock, $cover_url, $description);
    }
    
    if ($stmt->execute()) {
        echo json_encode(['status' => 'ok']);
    } else {
        http_response_code(500);
        echo json_encode(['message' => 'Gagal menyimpan buku']);
    }
    exit;
}

if ($action === 'save_member') {
    $id = $_POST['id'] ?? null;
    $name = $_POST['name'] ?? '';
    $email = $_POST['email'] ?? '';
    $password = $_POST['password'] ?? '';
    $role = $_POST['role'] ?? 'user';

    if ($name === '' || $email === '' || $role === '') {
        http_response_code(400);
        echo json_encode(['message' => 'Nama, email, dan role wajib diisi']);
        exit;
    }

    if ($id) {
        if ($password !== '') {
            $stmt = $koneksi->prepare("UPDATE users SET name=?, email=?, password=?, role=? WHERE id=?");
            $stmt->bind_param("ssssi", $name, $email, $password, $role, $id);
        } else {
            $stmt = $koneksi->prepare("UPDATE users SET name=?, email=?, role=? WHERE id=?");
            $stmt->bind_param("sssi", $name, $email, $role, $id);
        }
    } else {
        if ($password === '') {
            http_response_code(400);
            echo json_encode(['message' => 'Password wajib diisi untuk anggota baru']);
            exit;
        }
        // Check if email exists
        $stmt = $koneksi->prepare("SELECT id FROM users WHERE email=?");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        if ($stmt->get_result()->num_rows > 0) {
            http_response_code(400);
            echo json_encode(['message' => 'Email sudah terdaftar']);
            exit;
        }
        $stmt->close();
        
        $stmt = $koneksi->prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("ssss", $name, $email, $password, $role);
    }

    if ($stmt->execute()) {
        echo json_encode(['status' => 'ok']);
    } else {
        http_response_code(500);
        echo json_encode(['message' => 'Gagal menyimpan anggota: ' . $koneksi->error]);
    }
    exit;
}

if ($action === 'delete_member') {
    $id = (int)($_POST['id'] ?? 0);
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['message' => 'ID tidak valid']);
        exit;
    }
    // Prevent deleting yourself
    if ($id == $_SESSION['user']['id']) {
        http_response_code(403);
        echo json_encode(['message' => 'Tidak bisa menghapus akun Anda sendiri']);
        exit;
    }
    $stmt = $koneksi->prepare("DELETE FROM users WHERE id = ?");
    $stmt->bind_param("i", $id);
    if ($stmt->execute()) {
        echo json_encode(['status' => 'ok']);
    } else {
        http_response_code(500);
        echo json_encode(['message' => 'Gagal menghapus: ' . $koneksi->error]);
    }
    exit;
}


http_response_code(400);
echo json_encode(['message' => 'Action tidak valid']);
