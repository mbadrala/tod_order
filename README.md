# ТОД ОЙМС — Захиалгын систем

React + Vite (frontend) + Slim 4 PHP (API) + SQLite технологи дээр бүтсэн борлуулалт, тайлангийн систем.

---

## Агуулга

- [Хөгжүүлэлтийн орчинд ажиллуулах](#хөгжүүлэлтийн-орчинд-ажиллуулах)
- [cPanel дээр байршуулах](#cpanel-дээр-байршуулах)
- [Тохиргоо](#тохиргоо)
- [Файлын бүтэц](#файлын-бүтэц)

---

## Хөгжүүлэлтийн орчинд ажиллуулах

### Шаардлага

- PHP 8.1+
- Composer
- Node.js 20+
- pnpm

### 1. API (backend)

```bash
cd api

# Composer багцууд суулгах
composer install

# Тохиргооны файл үүсгэх
cp .env.example .env

# .env файлыг засварлах — JWT_SECRET, ADMIN_PASSWORD-оо солих
# CORS_ALLOWED_ORIGINS дээр localhost-оо нэмэх:
#    CORS_ALLOWED_ORIGINS=https://order.todsocks.mn,http://localhost:5173

# Хөгжүүлэлтийн сервер ажиллуулах
php -S localhost:8888 router.php
```

API `http://localhost:8888` хаягаар асна.

Анхны хэрэглэгч админ автоматаар үүснэ (username: `admin`, password: `.env` дахь `ADMIN_PASSWORD`).

### 2. Frontend

```bash
cd app

# npm багцууд суулгах
pnpm install

# .env файл засварлах (app/.env):
#    VITE_API_URL=http://localhost:8888

# Хөгжүүлэлтийн сервер ажиллуулах
pnpm run dev
```

Frontend `http://localhost:5173` хаягаар асна.

### 3. Seed өгөгдөл (заавал биш)

20,000 борлуулалт, 1,000 бараа, 100 харилцагч, 4 хэрэглэгчтэй тест өгөгдөл үүсгэх:

```bash
cd api
php seed.php
```

**Анхаар:** Өмнөх бүх өгөгдлийг устгаад шинээр үүсгэнэ.

---

## cPanel дээр байршуулах

### Шаардлага

- cPanel хостинг (PHP 8.1+, mod_rewrite дэмжсэн Apache)
- subdomain: `api.todsocks.mn` (API), `order.todsocks.mn` (frontend)
- Composer хандалт (SSH эсвэл cPanel Terminal)

### API байршуулах

1. **Локал дээр composer багцууд суулгах:**

   ```bash
   cd api
   composer install --no-dev
   ```

2. **ZIP хийхдээ `storage/` фолдерыг хасч, cPanel File Manager эсвэл FTP-ээр upload хийх.**

   `storage/` фолдерыг **ZIP-д оруулахгүй байх** — учир нь:
   - `database.sqlite` нь локал тест өгөгдөлтэй, production дээр шинээр үүснэ
   - `uploads/` доторх файлууд сервер дээр тусад нь байрших ёстой
   - `logs/` нь сервер дээр автоматаар үүсдэг

   API нь `api.todsocks.mn` subdomain-ын **document root** дээр байрших ёстой (жишээ нь бүх файл `/api.todsocks.mn/` дотор). API-н файлуудыг тусдаа subdirectory руу биш шууд subdomain-ын root руу зөөх хэрэгтэй.

   **Анхаар:** Subdomain үүсгэхдээ cPanel дээр "Subdomains" хэсэгт `api.todsocks.mn` үүсгээд document root-ийг `/api.todsocks.mn` гэж тохируулна. Дараа нь ZIP-ны агуулгыг тэр фолдер руу задлана.

3. **Storage фолдер болон зөвшөөрөл:**

   ZIP-с `storage/` хасагдсан тул сервер дээр гар аргаар үүсгэх:

   `/api.todsocks.mn/` дотор:
   - **`storage/`** фолдер үүсгэх
   - Дотор нь:
     - **`database.sqlite`** — хоосон файл (File Manager → Create File)
     - **`uploads/`** фолдер
     - **`logs/`** фолдер

   Дараа нь зөвшөөрөл тохируулах:
   - `storage/` фолдер дээр баруун товч → **Change Permissions**
   - **755** (Write: Owner, Read+Execute: Owner/Group/Public) — энэ нь SQLite-д бичихэд хангалттай ихэнх тохиолдолд
   - **777** (хэрэв 755 ажиллахгүй бол — SQLite бичихэд 777 шаардлагатай байж болно)

4. **.env файл үүсгэх:**

   `.env.example` файлыг хуулж `.env` гэж нэрлээд (cPanel File Manager-ийн Copy функц) дараах утгуудыг оруулах:

   ```
   JWT_SECRET=random-32-тэмдэгт-тэмдэгт
   ADMIN_PASSWORD=нууц-үг-ээ-бичих
   DB_PATH=storage/database.sqlite
   UPLOAD_DIR=storage/uploads
   CORS_ALLOWED_ORDIGINS=https://order.todsocks.mn
   ```

   **phpdotenv open_basedir асуудал:** Зарим cPanel хостингууд дээр `phpdotenv` `.env` файлыг уншихад `open_basedir` хязгаарлалт саад болдог. Хэрэв 500 алдаа гарвал:
   - `.env` файл болон `config/settings.php`-г `api.todsocks.mn` root дотор байрлуулсан эсэхээ шалгах
   - cPanel-ийн **"MultiPHP INI Editor"** → `open_basedir`-г шалгах
   - Эсвэл cPanel-ийн **"Environment Variables"** секцээр хувьсагчдыг тохируулах

5. **.htaccess шалгах:**

   `api/.htaccess` дараах агуулгатай эсэхийг шалгах:

   ```htaccess
   RewriteEngine On
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule ^ public/index.php [QSA,L]
   ```

   **Хэрэв subdomain биш, `order.todsocks.mn/api/` дотор байрлаж байвал** (жишээ нь main domain-ын доорх folder) `public/index.php`-д SCRIPT_NAME-ийг тохируулах шаардлагатай.

### Frontend байршуулах

1. **Локал дээр build хийх:**

   ```bash
   cd app

   # .env файлд API URL-ээ тохируулах (app/.env):
   #    VITE_API_URL=https://api.todsocks.mn

   pnpm run build
   ```

2. **`app/dist/` фолдерын агуулгыг ZIP хийж, `order.todsocks.mn` document root руу зөөх.**

   (cPanel File Manager эсвэл FTP-ээр — dist/ фолдерын **доторх** файлуудыг (index.html, assets/ гэх мэт) шууд root руу задлах)

3. **SPA routing-д .htaccess үүсгэх:**

   cPanel File Manager дээр `order.todsocks.mn` root дотор `.htaccess` файл үүсгэж дараах агуулгыг бичих:

   ```htaccess
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

   Энэ нь React Router-ийн бүх замыг (жишээ нь `/sales`, `/clients`) `index.html` руу дамжуулна. Без нь 404 алдаа гарахаас сэргийлнэ.

---

## Тохиргоо

### API (`api/.env`)

| Хувьсагч | Тайлбар |
|---|---|
| `JWT_SECRET` | JWT токен гарын үсэг. 32+ тэмдэгт random string |
| `ADMIN_PASSWORD` | Админ хэрэглэгчийн нууц үг (анх удаа ажиллахад автоматаар үүснэ) |
| `DB_PATH` | SQLite файлын зам (default: `storage/database.sqlite`) |
| `UPLOAD_DIR` | Файл хадгалах зам (default: `storage/uploads`) |
| `CORS_ALLOWED_ORIGINS` | Зөвшөөрөгдсөн origin-ууд (таслалаар тусгаарлана) |

### Frontend (`app/.env`)

| Хувьсагч | Тайлбар |
|---|---|
| `VITE_API_URL` | API-ийн бүтэн URL. Dev дээр `http://localhost:8888`, prod дээр `https://api.todsocks.mn` |

---

## Файлын бүтэц

```
tod_order/
├── api/
│   ├── config/
│   │   └── settings.php       # Dotenv + тохиргоо
│   │   └── database.php        # SQLite схемийн тодорхойлолт + seed админ
│   ├── public/
│   │   └── index.php           # Slim router, middleware, CORS
│   ├── src/
│   │   └── Controllers/
│   │       ├── AuthController.php
│   │       ├── BankAccountController.php
│   │       ├── ClientController.php
│   │       ├── FileController.php
│   │       ├── LogController.php
│   │       ├── ProductController.php
│   │       ├── ReportController.php
│   │       └── SaleController.php
│   │   └── Middleware/
│   │       └── AuthMiddleware.php
│   ├── storage/
│   │   ├── database.sqlite
│   │   ├── logs/
│   │   └── uploads/
│   ├── composer.json
│   ├── .env.example
│   ├── router.php              # Dev серверийн router
│   ├── seed.php                # CLI тест өгөгдөл үүсгэгч
│   └── .htaccess               # Apache rewrite rules
│
├── app/
│   ├── src/
│   │   ├── components/
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   └── utils.ts
│   │   ├── pages/
│   │   └── App.tsx
│   ├── public/
│   ├── package.json
│   ├── .env
│   ├── vite.config.ts
│   └── dist/                   # Build хийсэн файлууд
│
└── README.md
```

---

## Хэрэгтэй командууд

```bash
# API хөгжүүлэлт
cd api && php -S localhost:8888 router.php

# Frontend хөгжүүлэлт
cd app && pnpm run dev

# Frontend build
cd app && pnpm run build

# Seed өгөгдөл
cd api && php seed.php

# Composer багц нэмэх
cd api && composer require vendor/package

# npm багц нэмэх
cd app && pnpm add package-name
```
