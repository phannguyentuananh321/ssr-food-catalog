# Ấm Vị — Food Catalog SSR Website

Ứng dụng web hiển thị và quản lý danh mục ẩm thực (Food Catalog), xây dựng theo kiến trúc **Server-Side Rendering (SSR)** thực thụ: mỗi lần truy cập, server truy vấn database rồi render HTML hoàn chỉnh bằng EJS.

Nguồn dữ liệu nghiệp vụ **duy nhất** là **PostgreSQL (Supabase)** thông qua Prisma ORM. Supabase Storage chỉ dùng để lưu **file ảnh**.

Giao diện theo ngôn ngữ **Warm Cream — Modern Food Editorial**: thanh lịch, ấm cúng, tập trung vào trải nghiệm hình ảnh món ăn.

---

## 1. Technical Stack (Công Nghệ Sử Dụng)

| Thành phần | Công nghệ | Phiên bản | Vai trò trong dự án |
| :--- | :--- | :--- | :--- |
| Runtime | **Node.js** (CommonJS) | 18+ (khuyến nghị LTS) | Chạy server và các script CLI |
| Web framework | **Express** | 4.x | Định tuyến, middleware, xử lý HTTP |
| View engine | **EJS** | 3.x | Render HTML phía server |
| Layout | **express-ejs-layouts** | 2.x | Layout chung `layouts/main.ejs`, tách `<script>`/`<style>` theo trang |
| ORM | **Prisma** | 6.x | Truy vấn & quản lý schema, migration |
| Database | **PostgreSQL (Supabase)** | — | Lưu toàn bộ dữ liệu nghiệp vụ (Dish, Chef, Ingredient, quan hệ) |
| File storage | **Supabase Storage** | — | Lưu file ảnh món ăn / đầu bếp / nguyên liệu |
| Xác thực dữ liệu | **Zod** | 3.x | Validate input form phía server |
| Upload file | **Multer** (`memoryStorage`) | 1.x | Nhận ảnh upload, chỉ JPEG/PNG/WEBP, tối đa 5MB |
| CSS / UI | **Tailwind CSS + DaisyUI** | 4.x / 5.x | Utility CSS + component library |
| HTTP method | **method-override** | 3.x | Cho phép form HTML gửi `PATCH`/`DELETE` qua `_method` |
| Config | **dotenv** | 16.x | Đọc biến môi trường từ `.env` |
| Dev tooling | **nodemon** | 3.x | Auto-reload khi phát triển |
| Hiệu ứng client | **Vanta.js + Three.js** | CDN | Hiệu ứng nền hero (client-side, có fallback) |
| Kiểm thử | Custom runner (`node tests/run-tests.js`) | — | Unit test + tích hợp DB (opt-in) |

> Toàn bộ dependency nằm trong `package.json`. `@prisma/client` + `@supabase/supabase-js` là thư viện chính ở runtime.

---

## 2. Kiến Trúc Ứng Dụng (MVC + SSR)

Luồng xử lý một request:

```
Trình duyệt
   │  HTTP (GET/POST/PATCH/DELETE)
   ▼
Express Routes         src/routes/*.routes.js
   │
   ▼
Controllers            src/controllers/*.controller.js
   │  (đọc input, gọi service, chọn view)
   ▼
Services               src/services/*.service.js
   │  (logic nghiệp vụ, validate quan hệ, gọi Prisma)
   ▼
Prisma Client          src/lib/prisma.js
   │
   ▼
PostgreSQL (Supabase)  ← dữ liệu nghiệp vụ
   +
Supabase Storage       ← chỉ file ảnh (imagePath lưu đường dẫn tương đối)
   │
   ▼
EJS View               src/views/**  → HTML hoàn chỉnh trả về trình duyệt
```

Đặc điểm SSR:
- Không có REST API JSON riêng cho nghiệp vụ; HTML được render trực tiếp từ dữ liệu DB.
- Mọi thao tác ghi đi theo mô hình **PRG (Post-Redirect-Get)**: `POST/PATCH/DELETE` thành công → `303 See Other` + query status, tránh submit trùng khi refresh.

### Chứng minh đây là SSR (kiểm chứng được)

SSR không phải nhãn tự gán. Dưới đây là bằng chứng cụ thể trong mã nguồn và cách tự kiểm chứng trên máy.

**A. Bằng chứng trong mã nguồn**

| # | Bằng chứng | Vị trí | Chi tiết |
| :--- | :--- | :--- | :--- |
| 1 | Express cấu hình EJS làm view engine | `src/app.js` | `app.set('view engine', 'ejs')` + `express-ejs-layouts` |
| 2 | Controller **render HTML**, không trả JSON | `src/controllers/*.controller.js`, `src/middleware/error-handler.js` | **35** lời gọi `.render(...)` (33 ở controllers + 2 ở middleware lỗi), **0** `res.json`/`res.send` |
| 3 | Route `GET` gọi controller render | `src/routes/dish.routes.js` | `router.get('/', dishController.renderPublicList)` |
| 4 | Controller truy vấn DB rồi đưa dữ liệu vào view | `src/controllers/dish.controller.js` | `getDishes()` → `res.render('dishes/index', { dishes, ... })` |
| 5 | View nội suy dữ liệu bằng thẻ EJS phía server | `src/views/dishes/show.ejs` | `<%= dish.name %>`, `<%= Number(dish.price).toLocaleString('vi-VN') + ' ₫' %>` |
| 6 | **Không** có client framework / fetch dữ liệu | toàn bộ `src/views/**` | tìm `fetch(` / `axios` / `react` / `vue` → **0 kết quả** |

**B. Tự kiểm chứng trên máy (khi server đang chạy)**

**1) HTML thô từ server đã chứa sẵn dữ liệu món ăn và giá.**
```bash
curl http://localhost:3000/dishes
```
Kết quả thực tế khi chạy (`Invoke-WebRequest`):
```
STATUS=200
CONTENT-TYPE=text/html; charset=utf-8
LENGTH=41208
--- HTML snippet (server-rendered) ---
<!-- 4. Price in prominent Olive Green -->
<div class="text-lg font-bold text-[#354B35]">
  70.000 ₫
</div>
```
→ Giá `70.000 ₫` do **server** format (`toLocaleString('vi-VN')`) và nhúng thẳng vào HTML, không phải JS dựng sau khi tải trang.

**2) Tắt JavaScript rồi tải lại trang.**
DevTools → Settings → Debugger → **Disable JavaScript** → mở lại `/dishes`. Danh sách món, giá, mô tả **vẫn hiển thị đầy đủ**. Nếu là CSR (React/Vue/Angular…), trang sẽ trắng vì không còn JS để dựng DOM.

**3) View Page Source (Ctrl+U).**
Toàn bộ tên món, giá, danh mục nằm sẵn trong mã nguồn HTML ban đầu (không phải các thẻ rỗng chờ JS).

**4) Không có REST API cho nghiệp vụ.**
Gửi request yêu cầu JSON vẫn nhận HTML:
```
Accept: application/json  →  Content-Type: text/html; charset=utf-8
Body bắt đầu bằng: <!DOCTYPE html>
```

> Kết luận: dữ liệu được lấy từ PostgreSQL và nhúng vào HTML **ngay trên server** cho mỗi request → đây là SSR thật, không phải CSR.

### Cấu trúc thư mục

```
CODEBLOCK5/
├── prisma/
│   ├── schema.prisma              # Định nghĩa model & quan hệ
│   ├── migrations/                # Lịch sử migration (init + quan hệ)
│   ├── seed.js                    # Seeder demo (opt-in, idempotent)
│   ├── add-dishes.js              # Script thêm món (additive, idempotent)
│   └── remove-demo-dishes.js      # Script dọn món demo (có --confirm)
├── public/
│   ├── css/input.css              # Nguồn Tailwind
│   ├── css/output.css             # CSS đã build (serve tĩnh)
│   └── images/                    # Placeholder, favicon…
├── src/
│   ├── app.js                     # Khởi tạo Express app
│   ├── config/env.js              # Đọc & kiểm tra biến môi trường
│   ├── lib/prisma.js              # Prisma Client singleton
│   ├── routes/                    # dish / chef / ingredient / admin routes
│   ├── controllers/               # Điều phối request → service → view
│   ├── services/                  # Logic nghiệp vụ (Prisma, Storage, ảnh)
│   ├── validators/                # Schema Zod
│   ├── middleware/                # Xử lý 404, 500
│   └── views/                     # EJS: layouts, partials, dishes, chefs, ingredients, errors
├── tests/run-tests.js             # Bộ test
├── .env.example                   # Mẫu biến môi trường
└── package.json
```

---

## 3. Thiết Kế Database

Database dùng **PostgreSQL** trên Supabase, định nghĩa bằng Prisma trong `prisma/schema.prisma`.

### 3.1 Sơ đồ quan hệ (ERD)

```
                         ┌──────────────────┐
                         │      Dish        │
                         │  (Món ăn)        │
                         ├──────────────────┤
                         │ id (PK)          │
                         │ name             │
                         │ description      │
                         │ price            │
                         │ category         │
                         │ imagePath        │
                         │ isFeatured       │
                         │ createdAt        │
                         │ updatedAt        │
                         └───┬──────────┬───┘
                             │ 1        │ 1
                             │          │
              ┌──────────────▼──┐    ┌──▼───────────────┐
              │  DishIngredient  │    │    DishChef      │
              │ (bảng nối M:N)   │    │ (bảng nối M:N)   │
              ├──────────────────┤    ├──────────────────┤
              │ id (PK)          │    │ id (PK)          │
              │ dishId (FK)      │    │ dishId (FK)      │
              │ ingredientId (FK)│    │ chefId (FK)      │
              │ createdAt        │    │ createdAt        │
              │ UNIQUE(dish,ing) │    │ UNIQUE(dish,chef)│
              └────────┬─────────┘    └────────┬─────────┘
                       │ N                     │ N
              ┌────────▼─────────┐    ┌────────▼─────────┐
              │   Ingredient     │    │      Chef        │
              │  (Nguyên liệu)   │    │   (Đầu bếp)      │
              ├──────────────────┤    ├──────────────────┤
              │ id (PK)          │    │ id (PK)          │
              │ name             │    │ name             │
              │ category         │    │ title            │
              │ description      │    │ description      │
              │ unit             │    │ experience       │
              │ imagePath        │    │ imagePath        │
              │ createdAt        │    │ isFeatured       │
              │ updatedAt        │    │ createdAt        │
              └──────────────────┘    │ updatedAt        │
                                      └──────────────────┘
```

### 3.2 Các bảng (model)

**Dish — Món ăn**

| Cột | Kiểu | Ghi chú |
| :--- | :--- | :--- |
| `id` | Int, PK, auto-increment | |
| `name` | Text, bắt buộc | Tên món |
| `description` | Text, null | Mô tả |
| `price` | Int, mặc định `0` | Giá (VND) |
| `category` | Text, mặc định `"Món chính"` | Danh mục |
| `imagePath` | Text, null | Đường dẫn ảnh **tương đối** trong bucket |
| `isFeatured` | Boolean, mặc định `false` | Nổi bật ở hero |
| `createdAt` / `updatedAt` | Timestamp | Tự động |

Index: `category`, `price`, `createdAt`.

**Chef — Đầu bếp**

| Cột | Kiểu | Ghi chú |
| :--- | :--- | :--- |
| `id` | Int, PK | |
| `name` | Text, bắt buộc | |
| `title` | Text, null | Chức danh |
| `description` | Text, null | Tiểu sử |
| `experience` | Text, null | Kinh nghiệm |
| `imagePath` | Text, null | Đường dẫn ảnh tương đối |
| `isFeatured` | Boolean, mặc định `false` | |
| `createdAt` / `updatedAt` | Timestamp | |

Index: `createdAt`.

**Ingredient — Nguyên liệu**

| Cột | Kiểu | Ghi chú |
| :--- | :--- | :--- |
| `id` | Int, PK | |
| `name` | Text, bắt buộc | |
| `category` | Text, null, mặc định `"Gia vị"` | Phân loại |
| `description` | Text, null | |
| `unit` | Text, null, mặc định `"gram"` | Đơn vị tính |
| `imagePath` | Text, null | |
| `createdAt` / `updatedAt` | Timestamp | |

Index: `category`, `createdAt`.

**DishIngredient — bảng nối Dish ↔ Ingredient (nhiều-nhiều tường minh)**

| Cột | Kiểu | Ghi chú |
| :--- | :--- | :--- |
| `id` | Int, PK | |
| `dishId` | Int, FK → `Dish.id` | `ON DELETE CASCADE` |
| `ingredientId` | Int, FK → `Ingredient.id` | `ON DELETE RESTRICT` |
| `createdAt` | Timestamp | |

Ràng buộc: `UNIQUE(dishId, ingredientId)` — một món không thể gắn trùng một nguyên liệu hai lần.

**DishChef — bảng nối Dish ↔ Chef (nhiều-nhiều tường minh)**

| Cột | Kiểu | Ghi chú |
| :--- | :--- | :--- |
| `id` | Int, PK | |
| `dishId` | Int, FK → `Dish.id` | `ON DELETE CASCADE` |
| `chefId` | Int, FK → `Chef.id` | `ON DELETE RESTRICT` |
| `createdAt` | Timestamp | |

Ràng buộc: `UNIQUE(dishId, chefId)`.

### 3.3 Quy tắc thiết kế quan trọng

- **Quan hệ là TÙY CHỌN**: một món có thể có **0..n** nguyên liệu và **0..n** đầu bếp. Form và validator **không** bắt buộc chọn nguyên liệu/đầu bếp. Trang chi tiết hiển thị thông báo thân thiện ("Chưa cập nhật…") khi chưa có quan hệ.
- **Không lưu quan hệ dạng CSV/JSON** trong cột của `Dish`. Quan hệ luôn là bản ghi thật trong bảng nối, truy vấn trực tiếp từ database.
- **Không gộp nguyên liệu khác nhau**: `Bánh phở`, `Bún tươi`, `Bún sợi to`, `Mì Quảng` là các bản ghi riêng; `Thịt bò` / `Thịt heo` / `Sườn heo` / `Thịt heo xay` / `Thịt gà` cũng tách riêng.
- **Tái sử dụng nguyên liệu**: cùng một nguyên liệu (ví dụ `Cà rốt`, `Tôm`) được nối tới nhiều món qua nhiều dòng trong `DishIngredient`.

### 3.4 Quy tắc xóa (Delete rules)

| Hành động | Kết quả |
| :--- | :--- |
| Xóa **Dish** | Chỉ xóa bản ghi Dish + các dòng nối của chính nó (`ON DELETE CASCADE`). **Không** xóa Chef/Ingredient. |
| Xóa **Chef/Ingredient** đang được dùng | **Bị chặn** ở cả 2 tầng: ứng dụng báo lỗi rõ ràng, database dùng `ON DELETE RESTRICT`. Phải gỡ liên kết khỏi các Dish trước. |
| Xóa luôn qua **HTTP DELETE** | Dùng `method-override` (`_method=DELETE`) và redirect `303`. `GET` không bao giờ thay đổi dữ liệu. |

### 3.5 Migration

Database được quản lý bằng **Prisma Migrate**:

| Migration | Nội dung |
| :--- | :--- |
| `20260101000000_init` | Baseline: bảng `Dish`, `Chef`, `Ingredient` + index |
| `20261017000000_add_dish_chef_ingredient_relations` | Thêm bảng nối `DishIngredient`, `DishChef` + index + khóa ngoại |

- Áp dụng an toàn (không xóa dữ liệu): `npm run prisma:migrate:deploy`
- Kiểm tra trạng thái: `npm run prisma:migrate:status`
- **Không** dùng `prisma migrate reset` hay `db push --accept-data-loss` trên database có dữ liệu thật.

### 3.6 Ảnh & `imagePath`

- `imagePath` chỉ lưu **đường dẫn tương đối** trong bucket `dish-images` (ví dụ `dishes/<tên-file>.jpg`, `chefs/<tên-file>.jpg`). URL công khai được ghép từ `SUPABASE_URL` + bucket + relative path.
- Upload dùng Multer `memoryStorage`, chỉ nhận `image/jpeg`, `image/png`, `image/webp`, tối đa 5MB.
- Nếu ghi DB thất bại sau khi upload → file vừa upload được dọn. Ảnh cũ chỉ bị xóa **sau khi** DB cập nhật thành công.

---

## 4. Biến Môi Trường (`.env`)

Sao chép `.env.example` thành `.env` ở thư mục gốc (**không commit `.env`**):

| Biến | Bắt buộc | Mô tả & cách lấy |
| :--- | :--- | :--- |
| `NODE_ENV` | Tùy chọn | `development` (mặc định) hoặc `production` |
| `PORT` | Tùy chọn | Cổng HTTP server (mặc định `3000`) |
| `APP_BASE_URL` | Tùy chọn | URL gốc (mặc định `http://localhost:3000`) |
| `DATABASE_URL` | **Bắt buộc** | Chuỗi kết nối PostgreSQL. Supabase Dashboard → Project Settings → Database → Connection String (Pooler) |
| `DIRECT_URL` | Khuyến nghị | Kết nối trực tiếp cho Prisma CLI/migrate (khi runtime dùng transaction pooler) |
| `SUPABASE_URL` | Bắt buộc cho upload ảnh | Project URL. Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Bắt buộc cho upload ảnh | `service_role` key (secret, chỉ ở server) |
| `SUPABASE_STORAGE_BUCKET` | Tùy chọn | Tên bucket (mặc định `dish-images`) |
| `SESSION_SECRET` | Tùy chọn | Chuỗi bí mật ≥ 32 ký tự |
| `SEED_DEMO` | Tùy chọn | `true` để cho phép seed demo (chỉ dev/demo) |

---

## 5. Hướng Dẫn Chạy Web (Từng Bước)

### Chuẩn bị (Prerequisites)
- **Node.js 18+** và **npm** đã cài (`node -v`, `npm -v`).
- Một project **Supabase** (miễn phí) đã tạo.
- Trong Supabase Storage: tạo bucket tên **`dish-images`** và để chế độ **public** (hoặc đặt `SUPABASE_STORAGE_BUCKET` theo tên khác).

---

### Bước 1 — Cài dependencies
```bash
npm install
```

### Bước 2 — Tạo file cấu hình môi trường
```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```
Mở `.env` và điền tối thiểu:
- `DATABASE_URL` (và nên có `DIRECT_URL`)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=dish-images`

### Bước 3 — Sinh Prisma Client
```bash
npm run prisma:generate
```

### Bước 4 — Áp dụng migration lên database
Với database **mới (rỗng)**, lệnh này tạo toàn bộ bảng:
```bash
npm run prisma:migrate:deploy
```
Kiểm tra lại:
```bash
npm run prisma:migrate:status
# Kỳ vọng: "Database schema is up to date!"
```

### Bước 5 — Build CSS (Tailwind + DaisyUI)
```bash
npm run build:css
```
> Khi đang phát triển, có thể chạy `npm run watch:css` ở một terminal riêng để CSS tự build lại mỗi khi sửa.

### Bước 6 — Khởi động web
```bash
# Chế độ phát triển (tự reload khi sửa code)
npm run dev

# Hoặc chạy thường
npm start
```
Mở trình duyệt:
- Trang công khai: **http://localhost:3000/dishes**
- Trang quản trị: **http://localhost:3000/admin/dishes**

---

### Bước 7 (Tùy chọn) — Nạp dữ liệu mẫu
Seeder là **opt-in**, **idempotent** và **không bao giờ xóa dữ liệu thật**. Mặc định `npm run prisma:seed` sẽ không ghi gì nếu chưa bật:
```bash
# Cách 1: dùng cờ --demo
npm run prisma:seed:demo

# Cách 2: bật biến môi trường
#   macOS/Linux:  SEED_DEMO=true npm run prisma:seed
#   Windows PowerShell:  $env:SEED_DEMO="true"; npm run prisma:seed
```
Seeder tự **từ chối chạy khi `NODE_ENV=production`**.

### Bước 8 (Tùy chọn) — Chạy kiểm thử
```bash
# Unit test (không cần DB)
npm test

# Test tích hợp trên database thật (tự tạo rồi dọn dữ liệu test)
#   macOS/Linux:  RUN_DB_TESTS=1 npm test
#   Windows PowerShell:  $env:RUN_DB_TESTS="1"; npm test
```

---

### Xử lý sự cố thường gặp (Troubleshooting)

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
| :--- | :--- | :--- |
| `[CONFIG WARNING] Missing required environment variable(s): DATABASE_URL` | Chưa tạo `.env` hoặc thiếu biến | Tạo `.env` từ `.env.example` và điền `DATABASE_URL` |
| `Can't reach database server` | Sai connection string / chưa bật mạng / cần `?sslmode=require` | Kiểm tra lại `DATABASE_URL`, thêm `?sslmode=require` |
| Giao diện mất style (trắng trơn) | Chưa build CSS | Chạy `npm run build:css` rồi tải lại trang |
| Upload ảnh lỗi `supabase` / ảnh không hiện | Thiếu `SUPABASE_URL`/`SERVICE_ROLE_KEY` hoặc bucket chưa public | Điền biến Supabase, tạo bucket `dish-images` public |
| `Prisma Client ... did not initialize` | Chưa generate sau khi đổi schema | Chạy `npm run prisma:generate` |
| Port 3000 đã bị chiếm | Ứng dụng khác dùng cổng | Đổi `PORT` trong `.env` |

---

## 6. Danh Sách Trang Chính (15 Trang Nghiệp Vụ)

Mỗi đối tượng có 5 trang (3 × 5 = 15):

| Thực thể | 1. Danh sách công khai | 2. Chi tiết công khai | 3. Quản trị danh sách | 4. Thêm mới | 5. Chỉnh sửa |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Dish** | `GET /dishes` | `GET /dishes/:id` | `GET /admin/dishes` | `GET /admin/dishes/new` | `GET /admin/dishes/:id/edit` |
| **Chef** | `GET /chefs` | `GET /chefs/:id` | `GET /admin/chefs` | `GET /admin/chefs/new` | `GET /admin/chefs/:id/edit` |
| **Ingredient** | `GET /ingredients` | `GET /ingredients/:id` | `GET /admin/ingredients` | `GET /admin/ingredients/new` | `GET /admin/ingredients/:id/edit` |

Trang hỗ trợ:
- `GET /` → redirect `303` sang `/dishes`.
- `404 Not Found` và `500 Server Error` (không lộ stack trace).

---

## 7. Quy Chuẩn HTTP & PRG (Post-Redirect-Get)

- `GET`: chỉ đọc dữ liệu, **không** thay đổi database.
- `POST`: tạo mới (multipart/form-data).
- `PATCH`: cập nhật (form HTML dùng `method-override` + hidden `_method=PATCH`).
- `DELETE`: xóa (form HTML dùng `method-override` + hidden `_method=DELETE`).
- Sau mỗi thao tác ghi thành công → `303 See Other` kèm query status để chống submit trùng khi refresh.

---

## 8. Kiểm Thử

Bộ test gồm:
- Validator Zod (Dish/Chef/Ingredient) và chuẩn hoá danh sách ID quan hệ.
- Xử lý **quan hệ tùy chọn** (Dish không có Chef/Ingredient vẫn hợp lệ).
- Tích hợp CRUD + quan hệ nhiều-nhiều + quy tắc xóa, chạy trên PostgreSQL thật (bật bằng `RUN_DB_TESTS=1`).

```bash
npm test
```

---

## 9. Lưu Ý Bảo Mật (Đã Biết)

- Các route `/admin` hiện **chưa có xác thực**; không nên public ghi dữ liệu ở production. Hạng mục này ngoài phạm vi bản refactor hiện tại, được ghi nhận để xử lý riêng.
- **Không commit `.env`** — secret chỉ nằm trong biến môi trường của nền tảng triển khai.
- `SUPABASE_SERVICE_ROLE_KEY` là khóa đặc quyền cao, chỉ dùng phía server.
