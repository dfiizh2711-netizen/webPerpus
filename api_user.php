<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/koneksi.php';

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['message' => 'Unauthorized']);
    exit;
}

$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$userId = $_SESSION['user']['id'];

if ($action === 'home') {
    // 8 popular books (using top 8 newest for now, since we don't have borrow counts)
    $res = $koneksi->query("SELECT b.*, c.name as category_name FROM books b LEFT JOIN categories c ON b.category_id = c.id ORDER BY b.created_at DESC LIMIT 8");
    $popular = [];
    while($row = $res->fetch_assoc()) $popular[] = $row;

    // Active borrows for current user (borrowed or overdue or return_pending)
    $stmt = $koneksi->prepare("SELECT b.*, bk.title as book_title, bk.cover_url as book_cover FROM borrowings b JOIN books bk ON b.book_id = bk.id WHERE b.user_id = ? AND b.status IN ('borrowed', 'overdue', 'return_pending') ORDER BY b.created_at DESC LIMIT 3");
    $stmt->bind_param("s", $userId);
    $stmt->execute();
    $res = $stmt->get_result();
    $activeBorrows = [];
    while($row = $res->fetch_assoc()) $activeBorrows[] = $row;

    // User stats
    $stmt = $koneksi->prepare("SELECT 
        COUNT(*) as total_borrowed,
        SUM(IF(status='borrowed' OR status='overdue' OR status='return_pending', 1, 0)) as active_borrowed,
        SUM(IF(status='returned', 1, 0)) as returned,
        SUM(IF(status='overdue' OR (status='borrowed' AND return_date < CURRENT_DATE) OR (status='return_pending' AND return_date < CURRENT_DATE), 1, 0)) as overdue
        FROM borrowings WHERE user_id = ?");
    $stmt->bind_param("s", $userId);
    $stmt->execute();
    $stats = $stmt->get_result()->fetch_assoc();

    $resTotal = $koneksi->query("SELECT COUNT(*) as total FROM books");
    $totalBooks = $resTotal->fetch_assoc()['total'];

    echo json_encode([
        'popular' => $popular,
        'activeBorrows' => $activeBorrows,
        'stats' => [
            'totalBorrowed' => (int)$stats['total_borrowed'],
            'activeBorrowed' => (int)$stats['active_borrowed'],
            'returned' => (int)$stats['returned'],
            'overdue' => (int)$stats['overdue'],
            'totalBooks' => (int)$totalBooks
        ]
    ]);
    exit;
}

if ($action === 'books') {
    $res = $koneksi->query("SELECT b.*, c.name as category_name FROM books b LEFT JOIN categories c ON b.category_id = c.id ORDER BY b.title ASC");
    $books = [];
    while($row = $res->fetch_assoc()) $books[] = $row;

    $res2 = $koneksi->query("SELECT * FROM categories ORDER BY name ASC");
    $cats = [];
    while($row = $res2->fetch_assoc()) $cats[] = $row;

    echo json_encode(['books' => $books, 'categories' => $cats]);
    exit;
}

if ($action === 'borrow') {
    $bookId = $_POST['book_id'] ?? '';
    
    // Check if user already borrowed this book and hasn't returned it
    $stmt = $koneksi->prepare("SELECT id FROM borrowings WHERE user_id = ? AND book_id = ? AND status IN ('pending', 'borrowed', 'overdue')");
    $stmt->bind_param("ss", $userId, $bookId);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        http_response_code(400);
        echo json_encode(['message' => 'Anda sedang meminjam buku ini.']);
        exit;
    }

    // Check stock
    $stmt = $koneksi->prepare("SELECT stock FROM books WHERE id = ?");
    $stmt->bind_param("s", $bookId);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res->num_rows === 0) {
        http_response_code(404);
        echo json_encode(['message' => 'Buku tidak ditemukan.']);
        exit;
    }
    $book = $res->fetch_assoc();
    if ($book['stock'] <= 0) {
        http_response_code(400);
        echo json_encode(['message' => 'Stok buku habis.']);
        exit;
    }

    // Insert (id is auto-increment)
    $returnDate = date('Y-m-d', strtotime('+7 days'));
    $stmt = $koneksi->prepare("INSERT INTO borrowings (user_id, book_id, return_date, status) VALUES (?, ?, ?, 'pending')");
    $stmt->bind_param("iis", $userId, $bookId, $returnDate);
    if ($stmt->execute()) {
        // Kurangi stok sementara karena di-booking (opsional, tp di app.js mock dikurangi langsung)
        $koneksi->query("UPDATE books SET stock = stock - 1 WHERE id = " . (int)$bookId);
        echo json_encode(['status' => 'ok']);
    } else {
        http_response_code(500);
        echo json_encode(['message' => 'Gagal meminjam buku.']);
    }
    exit;
}

if ($action === 'history') {
    $stmt = $koneksi->prepare("SELECT b.*, bk.title as book_title, bk.cover_url as book_cover FROM borrowings b JOIN books bk ON b.book_id = bk.id WHERE b.user_id = ? ORDER BY b.created_at DESC");
    $stmt->bind_param("s", $userId);
    $stmt->execute();
    $res = $stmt->get_result();
    $history = [];
    while($row = $res->fetch_assoc()) $history[] = $row;
    echo json_encode(['history' => $history]);
    exit;
}

if ($action === 'request_return') {
    $id = $_POST['id'] ?? '';
    $stmt = $koneksi->prepare("UPDATE borrowings SET status = 'return_pending' WHERE id = ? AND user_id = ? AND status IN ('borrowed', 'overdue')");
    $stmt->bind_param("is", $id, $userId);
    if ($stmt->execute() && $stmt->affected_rows > 0) {
        echo json_encode(['status' => 'ok']);
    } else {
        http_response_code(400);
        echo json_encode(['message' => 'Gagal memproses pengajuan pengembalian.']);
    }
    exit;
}

http_response_code(400);
echo json_encode(['message' => 'Invalid action']);
