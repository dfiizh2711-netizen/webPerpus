<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/koneksi.php';

function sendJson($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function generateUuid() {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

$action = $_SERVER['REQUEST_METHOD'] === 'GET'
    ? ($_GET['action'] ?? '')
    : ($_POST['action'] ?? '');

if ($action === 'current') {
    sendJson(['user' => $_SESSION['user'] ?? null]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(['message' => 'Method not allowed'], 405);
}

switch ($action) {
    case 'login':
        $email = trim($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';
        $role = $_POST['role'] ?? 'user';

        if ($email === '' || $password === '') {
            sendJson(['message' => 'Email dan password harus diisi'], 400);
        }

        $stmt = $koneksi->prepare('SELECT id, name, email, password, role, avatar_url FROM users WHERE email = ? AND role = ? LIMIT 1');
        $stmt->bind_param('ss', $email, $role);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();
        $stmt->close();

        if (!$user) {
            sendJson(['message' => 'Email, password, atau role salah'], 401);
        }

        $isValid = false;
        if (password_verify($password, $user['password'])) {
            $isValid = true;
            // Update to plaintext so it matches the new system
            $updateStmt = $koneksi->prepare('UPDATE users SET password = ? WHERE id = ?');
            $updateStmt->bind_param('si', $password, $user['id']);
            $updateStmt->execute();
            $updateStmt->close();
        } else if ($password === $user['password']) {
            $isValid = true;
        }

        if (!$isValid) {
            sendJson(['message' => 'Email, password, atau role salah'], 401);
        }

        unset($user['password']);
        $_SESSION['user'] = $user;
        sendJson(['user' => $user]);
        break;

    case 'register':
        $name = trim($_POST['name'] ?? '');
        $email = trim($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';

        if ($name === '' || $email === '' || $password === '') {
            sendJson(['message' => 'Nama, email, dan password harus diisi'], 400);
        }
        if (strlen($password) < 6) {
            sendJson(['message' => 'Password minimal 6 karakter'], 400);
        }

        $stmt = $koneksi->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result->num_rows > 0) {
            $stmt->close();
            sendJson(['message' => 'Email sudah terdaftar'], 409);
        }
        $stmt->close();

        $stmt = $koneksi->prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
        $role = 'user';
        $stmt->bind_param('ssss', $name, $email, $password, $role);
        if (!$stmt->execute()) {
            $stmt->close();
            sendJson(['message' => 'Gagal mendaftar: ' . $koneksi->error], 500);
        }
        $newId = $koneksi->insert_id;
        $stmt->close();

        $user = [
            'id' => $newId,
            'name' => $name,
            'email' => $email,
            'role' => $role,
            'avatar_url' => null
        ];

        $_SESSION['user'] = $user;
        sendJson(['user' => $user]);
        break;

    case 'reset_password':
        $email = trim($_POST['email'] ?? '');
        $newPassword = $_POST['new_password'] ?? '';
        $role = $_POST['role'] ?? 'user';
        $adminName = trim($_POST['admin_name'] ?? '');

        if ($email === '' || $newPassword === '') {
            sendJson(['message' => 'Email dan password baru harus diisi'], 400);
        }
        if (strlen($newPassword) < 6) {
            sendJson(['message' => 'Password minimal 6 karakter'], 400);
        }

        $stmt = $koneksi->prepare('SELECT id, role, name FROM users WHERE email = ? LIMIT 1');
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $res = $stmt->get_result();
        $user = $res->fetch_assoc();
        if (!$user) {
            $stmt->close();
            sendJson(['message' => 'Email tidak terdaftar'], 404);
        }
        $stmt->close();

        if ($user['role'] !== $role) {
            sendJson(['message' => 'Role tidak sesuai dengan email terdaftar'], 403);
        }

        if ($user['role'] === 'admin') {
            if ($adminName === '' || strtolower($adminName) !== strtolower($user['name'])) {
                sendJson(['message' => 'Verifikasi gagal: Nama admin tidak cocok'], 403);
            }
        }

        $stmt = $koneksi->prepare('UPDATE users SET password = ? WHERE email = ?');
        $stmt->bind_param('ss', $newPassword, $email);
        if (!$stmt->execute()) {
            $stmt->close();
            sendJson(['message' => 'Gagal mengubah password'], 500);
        }
        $stmt->close();

        sendJson(['message' => 'Password berhasil diganti']);
        break;

    case 'logout':
        unset($_SESSION['user']);
        sendJson(['message' => 'Logout berhasil']);
        break;

    default:
        sendJson(['message' => 'Aksi tidak dikenal'], 400);
}
