<?php

function getDatabase(string $dbPath): PDO
{
    $pdo = new PDO("sqlite:$dbPath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $pdo;
}

function initializeDatabase(PDO $pdo): void
{
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_admin INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT (datetime('now')),
            updated_at DATETIME DEFAULT (datetime('now'))
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            original_name TEXT NOT NULL,
            stored_name TEXT NOT NULL,
            mime_type TEXT,
            size INTEGER,
            created_at DATETIME DEFAULT (datetime('now')),
            updated_at DATETIME DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT (datetime('now')),
            updated_at DATETIME DEFAULT (datetime('now'))
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            client_code TEXT,
            name TEXT NOT NULL,
            phone TEXT,
            owner_name TEXT,
            outdoor_photo TEXT,
            indoor_photo TEXT,
            district TEXT,
            subdistrict TEXT,
            neighborhood TEXT,
            building_door TEXT,
            status TEXT,
            created_at DATETIME DEFAULT (datetime('now')),
            updated_at DATETIME DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ");

    // migration: add client_code column for existing databases
    try {
        $pdo->exec("ALTER TABLE clients ADD COLUMN client_code TEXT");
    } catch (\Exception $e) {
        // column already exists
    }

    // unique index on client_code
    try {
        $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_client_code ON clients(client_code)");
    } catch (\Exception $e) {
        // index already exists
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_date TEXT NOT NULL,
            client_code TEXT,
            client_name TEXT,
            client_phone TEXT,
            slip_number TEXT,
            status TEXT NOT NULL DEFAULT 'final',
            total_amount REAL NOT NULL DEFAULT 0,
            cash_amount REAL NOT NULL DEFAULT 0,
            deferred_amount REAL NOT NULL DEFAULT 0,
            discount_amount REAL NOT NULL DEFAULT 0,
            user_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT (datetime('now')),
            updated_at DATETIME DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ");

    // migration: add status column for existing databases
    try {
        $pdo->exec("ALTER TABLE sales ADD COLUMN status TEXT NOT NULL DEFAULT 'final'");
    } catch (\Exception $e) {
        // column already exists
    }

    // migration: add account_name to bank_accounts
    try {
        $pdo->exec("ALTER TABLE bank_accounts ADD COLUMN account_name TEXT NOT NULL DEFAULT ''");
    } catch (\Exception $e) {
        // column already exists
    }

    // migration: add account_name to sale_bank_allocations
    try {
        $pdo->exec("ALTER TABLE sale_bank_allocations ADD COLUMN account_name TEXT NOT NULL DEFAULT ''");
    } catch (\Exception $e) {
        // column already exists
    }

    // migration: add is_locked column
    try {
        $pdo->exec("ALTER TABLE sales ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0");
    } catch (\Exception $e) {
        // column already exists
    }

    // migration: add cash_amount and deferred_amount columns
    try {
        $pdo->exec("ALTER TABLE sales ADD COLUMN cash_amount REAL NOT NULL DEFAULT 0");
    } catch (\Exception $e) {
        // column already exists
    }
    try {
        $pdo->exec("ALTER TABLE sales ADD COLUMN deferred_amount REAL NOT NULL DEFAULT 0");
    } catch (\Exception $e) {
        // column already exists
    }
    try {
        $pdo->exec("ALTER TABLE sales ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0");
    } catch (\Exception $e) {
        // column already exists
    }
    try {
        $pdo->exec("ALTER TABLE reports ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0");
    } catch (\Exception $e) {
        // column already exists
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            product_code TEXT NOT NULL,
            product_name TEXT NOT NULL,
            amount REAL NOT NULL DEFAULT 1,
            unit_price REAL NOT NULL DEFAULT 0,
            sum_price REAL NOT NULL DEFAULT 0,
            FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS bank_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bank_name TEXT NOT NULL,
            account_number TEXT NOT NULL,
            account_name TEXT NOT NULL DEFAULT '',
            created_at DATETIME DEFAULT (datetime('now')),
            updated_at DATETIME DEFAULT (datetime('now'))
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS sale_bank_allocations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            bank_account_id INTEGER NOT NULL,
            bank_name TEXT NOT NULL,
            account_number TEXT NOT NULL,
            account_name TEXT NOT NULL DEFAULT '',
            amount REAL NOT NULL DEFAULT 0,
            FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            sale_date TEXT NOT NULL,
            client_code TEXT,
            client_name TEXT,
            client_phone TEXT,
            slip_number TEXT,
            total_amount REAL NOT NULL DEFAULT 0,
            cash_amount REAL NOT NULL DEFAULT 0,
            deferred_amount REAL NOT NULL DEFAULT 0,
            discount_amount REAL NOT NULL DEFAULT 0,
            product_code TEXT NOT NULL,
            product_name TEXT NOT NULL,
            item_amount REAL NOT NULL DEFAULT 1,
            unit_price REAL NOT NULL DEFAULT 0,
            sum_price REAL NOT NULL DEFAULT 0,
            user_id INTEGER NOT NULL,
            user_name TEXT,
            created_at DATETIME DEFAULT (datetime('now'))
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS report_bank_allocations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_id INTEGER NOT NULL,
            bank_account_id INTEGER NOT NULL,
            bank_name TEXT NOT NULL,
            account_number TEXT NOT NULL,
            account_name TEXT NOT NULL DEFAULT '',
            amount REAL NOT NULL DEFAULT 0,
            FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
        )
    ");

    // Indexes for query performance on larger datasets
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_reports_sale_date_id ON reports(sale_date DESC, id DESC)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_reports_sale_id ON reports(sale_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_sales_sale_date_id ON sales(sale_date DESC, id DESC)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id)");
}

function seedAdmin(PDO $pdo): void
{
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute(['admin']);

    if (!$stmt->fetch()) {
        $password = $_ENV['ADMIN_PASSWORD'] ?? 'admin';
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = $pdo->prepare(
            "INSERT INTO users (name, username, password_hash, is_admin, created_at) VALUES (?, ?, ?, 1, ?)"
        );
        $stmt->execute(['Administrator', 'admin', $hash, date('Y-m-d H:i:s')]);
    }
}
