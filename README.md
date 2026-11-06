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
| Xác thực | **Tự triển khai** (`express-session`, `argon2`, `nodemailer`) | — | Session + Cookie `sid` (Prisma Store), Argon2id, OTP 6 số, Password Reset, SMTP email |
| CAPTCHA | **Google reCAPTCHA v2** | — | Chống bot ở đăng ký và bắt buộc sau 3 lần đăng nhập sai |
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

**User — tài khoản người dùng**

| Cột | Kiểu | Ghi chú |
| :--- | :--- | :--- |
| `id` | String, PK | Mã định danh duy nhất (cuid) |
| `email` | String | Email người dùng nhập vào |
| `emailNormalized` | String, UNIQUE | Email đã chuẩn hoá (trim + lowercase) |
| `displayName` | String, null | Tên hiển thị (tối đa 50 ký tự) |
| `passwordHash` | String | Mật khẩu băm bằng Argon2id (OWASP recommendation) |
| `role` | String | Mặc định `'viewer'` |
| `status` | String | `'pending'` (chờ kích hoạt OTP) hoặc `'active'` (đã kích hoạt) |
| `emailVerifiedAt` | Timestamp, null | Thời điểm xác minh email thành công |
| `createdAt` / `updatedAt` | Timestamp | |

Không ghi password, passwordHash hay mã OTP vào log/response.

**ActivationChallenge — thử thách kích hoạt tài khoản qua OTP**

| Cột | Kiểu | Ghi chú |
| :--- | :--- | :--- |
| `id` | String, PK | cuid |
| `userId` | String, UNIQUE, FK → `User.id` | Quan hệ 1-1, `ON DELETE CASCADE` |
| `purpose` | String | Mặc định `'activation'` |
| `otpHash` | String | HMAC-SHA256(`OTP_PEPPER`, `userId:purpose:otp`) |
| `expiresAt` | Timestamp | Hạn sử dụng mã OTP (10 phút) |
| `usedAt` | Timestamp, null | Thời điểm đã kích hoạt |
| `attempts` | Int | Số lần nhập sai (tối đa 5 lần) |
| `lockedUntil` | Timestamp, null | Thời điểm mở khoá nếu nhập sai 5 lần (khoá 15 phút) |
| `lastSentAt` | Timestamp | Thời điểm gửi OTP gần nhất (chống spam 60s) |
| `sendCount` | Int | Số lần đã gửi trong cửa sổ (tối đa 5 lần / giờ) |
| `sendWindowStart` | Timestamp | Thời điểm bắt đầu cửa sổ gửi mã |

**PasswordReset — token đặt lại mật khẩu**

| Cột | Kiểu | Ghi chú |
| :--- | :--- | :--- |
| `id` | String, PK | cuid |
| `userId` | String, FK → `User.id` | `ON DELETE CASCADE` (index: `userId`) |
| `tokenHash` | String, UNIQUE | SHA-256 của token ngẫu nhiên 32 bytes (`base64url`) |
| `expiresAt` | Timestamp | Hạn sử dụng token (15 phút) |
| `usedAt` | Timestamp, null | Thời điểm token được sử dụng |
| `createdAt` | Timestamp | |

**Session — lưu trữ phiên làm việc phía server (Prisma Session Store)**

| Cột | Kiểu | Ghi chú |
| :--- | :--- | :--- |
| `sid` | String, PK | Session ID tương ứng với cookie `sid` |
| `userId` | String, null, FK → `User.id` | `ON DELETE CASCADE` (null đối với khách ẩn danh) |
| `data` | Text | Dữ liệu session tuần tự hóa JSON (lưu token CSRF, flash, ...) |
| `expiresAt` | Timestamp | Hạn hết hạn session (index: `expiresAt`, `userId`) |
| `createdAt` | Timestamp | |

Tự động quét dọn các session hết hạn định kỳ mỗi 10 phút.

**RateLimit — bộ đếm giới hạn tốc độ và chống brute force**

| Cột | Kiểu | Ghi chú |
| :--- | :--- | :--- |
| `key` | String, PK | Khóa định danh (ví dụ `login-ip:<ip>`, `login-email:<email>`, `register-ip:<ip>`) |
| `count` | Int | Số lần vi phạm/yêu cầu trong cửa sổ |
| `windowStart` | Timestamp | Bắt đầu cửa sổ cố định |
| `lockedUntil` | Timestamp, null | Thời điểm mở khóa nếu bị tạm khóa do vi phạm |

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
| `20261106000000_add_search_extensions` | Bật `pg_trgm` + `unaccent`, tạo hàm `public.immutable_unaccent(text)` và GIN index FTS/trigram cho `Dish`, `Chef`, `Ingredient` |
| `20261106020000_custom_auth` | Xóa `UserProfile`, `LoginThrottle`, `RegistrationThrottle`; Tạo các bảng cho hệ thống xác thực tự quản: `User` (lưu Argon2id hash), `ActivationChallenge` (HMAC OTP 6 số), `PasswordReset` (token SHA-256), `Session` (DB session store), `RateLimit` (chống brute force) |

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
| `DATABASE_URL` | **Bắt buộc** | Chuỗi kết nối PostgreSQL. Supabase Dashboard → Project Settings → Database → Connection String |
| `DIRECT_URL` | Khuyến nghị | Kết nối trực tiếp cho Prisma CLI/migrate (khi runtime dùng connection pooler) |
| `SESSION_SECRET` | **Bắt buộc** | Chuỗi bí mật ký cookie session (tối thiểu 32 ký tự ngẫu nhiên) |
| `OTP_PEPPER` | **Bắt buộc** | Khóa bí mật HMAC để băm mã OTP kích hoạt (tối thiểu 32 ký tự ngẫu nhiên) |
| `RECAPTCHA_SITE_KEY` | Bắt buộc cho form | Google reCAPTCHA v2 (Checkbox "I'm not a robot") Site Key để hiển thị widget |
| `RECAPTCHA_SECRET_KEY` | Bắt buộc server | Google reCAPTCHA v2 Secret Key dùng xác minh server qua Google siteverify |
| `SMTP_HOST` | Bắt buộc gửi mail | Địa chỉ SMTP server (ví dụ `smtp.gmail.com` hoặc `localhost` khi dev) |
| `SMTP_PORT` | Bắt buộc gửi mail | Cổng SMTP (`465` cho SSL/TLS hoặc `587` cho STARTTLS) |
| `SMTP_USER` | Bắt buộc gửi mail | Tên người dùng / email SMTP (ví dụ tài khoản Gmail của bạn) |
| `SMTP_PASS` | Bắt buộc gửi mail | Mật khẩu SMTP (nếu dùng Gmail, bắt buộc dùng **Mật khẩu ứng dụng / App Password**) |
| `MAIL_FROM` | Tùy chọn | Địa chỉ hiển thị người gửi (mặc định `"Ấm Vị" <no-reply@amvi.local>`) |
| `SUPABASE_URL` | Bắt buộc cho ảnh | Project URL Supabase dùng cho Storage (Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | Bắt buộc cho ảnh | `service_role` key (secret, **chỉ ở server**, dùng upload ảnh món/bếp) |
| `SUPABASE_STORAGE_BUCKET` | Tùy chọn | Tên bucket (mặc định `dish-images`) |
| `REGISTRATION_LIMIT` / `REGISTRATION_WINDOW_MINUTES` | Tùy chọn | Giới hạn đăng ký theo IP (mặc định 5 lần / 60 phút) |
| `SEED_DEMO` | Tùy chọn | `true` để cho phép seed demo (chỉ dev/demo) |

---

## 5. Hướng Dẫn Chạy Web (Từng Bước)

### Chuẩn bị (Prerequisites)
- **Node.js 18+** và **npm** đã cài (`node -v`, `npm -v`).
- Một project **Supabase** (dùng PostgreSQL và Storage).
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
Mở `.env` và điền:
- `DATABASE_URL` (và `DIRECT_URL`)
- `SESSION_SECRET` và `OTP_PEPPER` (chuỗi ngẫu nhiên dài ≥ 32 ký tự)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=dish-images`
- Cấu hình SMTP gửi mail & Google reCAPTCHA v2 (xem Bước 2b)

### Bước 2b — Cấu hình SMTP Email và Google reCAPTCHA v2

**a) Cấu hình SMTP gửi email (kích hoạt tài khoản OTP & quên mật khẩu)**
- Ứng dụng gửi email trực tiếp qua SMTP bằng **Nodemailer**, hoàn toàn độc lập với dịch vụ email của Supabase.
- **Dùng Gmail**:
  1. Đăng nhập tài khoản Google → Quản lý Tài khoản Google → **Bảo mật**.
  2. Bật **Xác minh 2 bước** (2-Step Verification).
  3. Tìm kiếm **Mật khẩu ứng dụng** (App Passwords) → Tạo mật khẩu mới cho ứng dụng (ví dụ đặt tên `AmVi Web`).
  4. Copy mật khẩu ứng dụng 16 ký tự vừa tạo vào `.env`:
     ```env
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=465
     SMTP_USER=email-cua-ban@gmail.com
     SMTP_PASS=mat_khau_ung_dung_16_ky_tu
     MAIL_FROM="Ấm Vị <email-cua-ban@gmail.com>"
     ```
- **Khi dev/test cục bộ chưa có SMTP**: Mailer service được thiết kế tự động bắt lỗi kết nối SMTP (`ECONNREFUSED`) và ghi log fallback an toàn mà không làm crash ứng dụng.

**b) Cấu hình Google reCAPTCHA v2 ("I'm not a robot")**
- Truy cập [Google reCAPTCHA Console](https://www.google.com/recaptcha/admin):
  1. Chọn loại **reCAPTCHA v2** -> Huy hiệu hộp kiểm "Tôi không phải là người máy" (Checkbox).
  2. Thêm tên miền: `localhost`, `127.0.0.1`, và tên miền production của bạn.
  3. Lấy **Site Key** và **Secret Key** dán vào `.env`:
     ```env
     RECAPTCHA_SITE_KEY=your_recaptcha_site_key
     RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
     ```
- **Khóa thử nghiệm (Test Keys) của Google** (mặc định đã điền sẵn trong `.env.example`):
  - `RECAPTCHA_SITE_KEY=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI`
  - `RECAPTCHA_SECRET_KEY=6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe`
  - Sử dụng test keys cho phép checkbox luôn hợp lệ khi kiểm thử cục bộ. Trên production, bắt buộc thay bằng cặp khóa thật để đảm bảo an toàn.

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
- `GET /` → redirect `303` sang `/dishes` (hoặc `/login` nếu chưa đăng nhập).
- `GET /bookmarks` → trang “Danh Sách Đã Lưu” (dữ liệu thật tải từ PostgreSQL theo ID trong `localStorage`).
- `GET /api/dishes|chefs|ingredients?page=N&...` → JSON `{ html, pagination }` cho chế độ Tải thêm / Cuộn vô hạn.
- `GET /api/bookmarks?dishes=&chefs=&ingredients=` → HTML card + `validIds` để dọn ID đã bị xóa khỏi DB.
- `GET /admin/api/chefs?q=` và `GET /admin/api/ingredients?q=` → tìm kiếm ILIKE phía server cho form món ăn.
- Auth: `GET/POST /login`, `GET/POST /register`, `GET/POST /activate`, `POST /activate/resend`, `GET/POST /forgot`, `GET/POST /reset`, `POST /logout`.
- `403 Forbidden` (CSRF token không hợp lệ), `404 Not Found`, `429 Too Many Requests` (vượt ngưỡng Rate limit / tạm khóa brute force), `500 Server Error` (lỗi hệ thống, không lộ stack trace).

---

## 7. Quy Chuẩn HTTP & PRG (Post-Redirect-Get)

### 7.1 Nguyên tắc bắt buộc: sửa dữ liệu KHÔNG dùng `GET`

> **`GET` chỉ được dùng để ĐỌC.** Mọi thao tác tạo / sửa / xoá dữ liệu **tuyệt đối không** dùng `GET`, mà dùng `POST` / `PATCH` / `DELETE`.

| Hành động | Method HTTP dùng (thay cho GET) | Form HTML gửi đi | Route tiêu biểu |
| :--- | :--- | :--- | :--- |
| **Đọc / tìm kiếm / lọc** | `GET` (an toàn, chỉ đọc) | `<form method="GET">` | `GET /dishes`, `GET /admin/dishes` |
| **Tạo mới** | `POST` | `<form method="POST" enctype="multipart/form-data">` | `POST /admin/dishes` |
| **Cập nhật** | `PATCH` | `<form method="POST">` + hidden `_method=PATCH` | `PATCH /admin/dishes/:id` |
| **Xoá** | `DELETE` | `<form method="POST">` + hidden `_method=DELETE` | `DELETE /admin/dishes/:id` |

Vì HTML form chỉ hỗ trợ `GET`/`POST`, các method `PATCH`/`DELETE` được gửi qua **`method-override`** bằng trường ẩn `_method`.

### 7.2 Vì sao `GET` không thể sửa dữ liệu (đảm bảo ở tầng thư viện)

- Thư viện `method-override` mặc định **chỉ xử lý request `POST`** (`methods = ['POST']` trong `method-override/index.js`). Do đó:
  - `GET /admin/dishes/5?_method=DELETE` → **không** bị đổi thành `DELETE`, rơi vào `404`.
  - Chỉ `POST ...?_method=DELETE` (hoặc body `_method`) mới trở thành `DELETE`.
- Tất cả route ghi đều khai báo bằng `router.post(...)`, `router.patch(...)`, `router.delete(...)` — **không** có route ghi nào là `router.get(...)` (`src/routes/admin.routes.js`).
- Các hàm ghi trong controller (`create` / `update` / `remove`) chỉ được gắn vào route `POST`/`PATCH`/`DELETE`.

Kiểm chứng nhanh (an toàn, dùng ID không tồn tại):

| Request | Kết quả |
| :--- | :--- |
| `GET /admin/dishes/999999` | `404` |
| `GET /admin/dishes/999999?_method=DELETE` | `404` ← **GET không sửa được dữ liệu** |
| `POST /admin/dishes/999999?_method=DELETE` | `303` (đi tới handler xoá) |
| `DELETE /admin/dishes/999999` | `303` |

### 7.3 PRG (Post-Redirect-Get)

- Sau mỗi thao tác ghi thành công → **`303 See Other`** kèm query status (`?success=...` / `?error=...`) để chống submit trùng khi người dùng refresh.
- Sau `303`, trình duyệt luôn quay về một `GET` để hiển thị kết quả — nghĩa là response cuối cùng hiển thị cho người dùng luôn là một trang `GET` an toàn.

---

## 8. Tính Năng Nâng Cao (Public Catalog)

### 8.1 Ba chế độ phân trang

| Chế độ | Giá trị URL | Cách hoạt động |
| :--- | :--- | :--- |
| Phân trang | `?mode=pages&page=N` | Server render đúng trang N; link số trang giữ nguyên bộ lọc/tìm kiếm |
| Tải thêm | `?mode=load-more&page=N` | Nút “Tải thêm” gọi `GET /api/{entity}?page=N+1`, nối HTML card vào lưới |
| Cuộn vô hạn | `?mode=infinite&page=N` | `IntersectionObserver` tự gọi API khi tới cuối danh sách |

- URL **luôn** thể hiện trang hiện tại. Sau mỗi lần tải thêm, `history.replaceState` cập nhật `page` mới.
- Mở trực tiếp hoặc tải lại link `?page=3` chỉ hiển thị **trang 3**, không hiển thị lại các trang đã cuộn trước đó.
- Trạng thái rỗng, trang cuối (`hasNext = false`) và lỗi mạng đều có thông báo riêng; lỗi tải thêm cho phép bấm thử lại.

### 8.2 Bookmark (chỉ lưu ID)

- Key `localStorage`: `am_vi_bookmarks`, đúng dạng `{ "dishes": [21,22], "chefs": [15], "ingredients": [12] }`.
- **Không** lưu bản ghi đầy đủ vào trình duyệt. Trang `/bookmarks` gọi `/api/bookmarks` để lấy dữ liệu mới nhất từ PostgreSQL.
- ID đã bị xóa khỏi DB sẽ được tự động dọn khỏi `localStorage` qua `validIds`.
- Nút “Lưu / Đã lưu” có trên thẻ danh sách và trang chi tiết; bỏ lưu trực tiếp trên trang `/bookmarks` sẽ xóa card khỏi danh sách.
- Đồng bộ giữa nhiều tab qua sự kiện `storage`; các component cập nhật qua sự kiện `amvi:bookmarks-changed`.

### 8.3 Chia sẻ trang hiện tại

- Nút “Chia sẻ trang này” dùng `navigator.share` nếu có, nếu không sao chép URL hiện tại vào clipboard.
- URL chia sẻ chỉ chứa trang đang xem (`page=N`), không chứa toàn bộ dữ liệu đã tải trước đó.

### 8.4 Tìm kiếm Full-text + Fuzzy trong PostgreSQL

- Migration `20261106000000_add_search_extensions` bật `pg_trgm`, `unaccent` và tạo `public.immutable_unaccent(text)` (wrapper `IMMUTABLE` để dùng được trong expression index).
- Mỗi truy vấn tìm kiếm kết hợp **trong SQL**:
  1. `to_tsvector('simple', immutable_unaccent(...)) @@ websearch_to_tsquery('simple', immutable_unaccent($1))`
  2. Fuzzy tên: `immutable_unaccent(name) % immutable_unaccent($1)` (trigram)
  3. Substring không dấu cho từ khóa ngắn: `position(lower(...) in lower(...)) > 0`
- Xếp hạng: `ts_rank(...) * 2 + similarity(...)`.
- Bộ lọc danh mục và khoảng giá (chỉ Dish) được ghép trong cùng câu SQL; sau đó chỉ các ID của trang hiện tại được hydrate bằng Prisma để giữ quan hệ `_count`.
- Không có dịch vụ tìm kiếm riêng và không lọc dữ liệu bằng JavaScript.

### 8.5 Tìm kiếm Chef/Ingredient phía server trong form admin

- Hai ô tìm kiếm độc lập gọi `GET /admin/api/chefs?q=` và `GET /admin/api/ingredients?q=`.
- Dùng ILIKE (`contains` + `mode: 'insensitive'`), giới hạn 10 kết quả, **không** dùng FTS/fuzzy.
- Debounce 300ms, `AbortController` hủy request cũ; có trạng thái đang tải / rỗng / lỗi.
- Lựa chọn được giữ khi đổi từ khóa; chip đã chọn + hidden input `chefIds` / `ingredientIds` được gửi khi lưu.
- Form chỉ tải các bản ghi đã chọn (khi sửa) — không render toàn bộ danh sách Chef/Ingredient ra HTML.

---

## 9. Xác Thực & Phân Quyền (Tự Triển Khai)

### 9.1 Phạm vi bảo vệ

- **Công khai (không cần đăng nhập)**: Trang chủ (`/`), danh mục món ăn (`/dishes`), đầu bếp (`/chefs`), nguyên liệu (`/ingredients`), trang chi tiết, tìm kiếm FTS/fuzzy, danh sách đã lưu (`/bookmarks`), API phân trang/cuộn vô hạn (`/api/*`), các trang xác thực (`/login`, `/register`, `/activate`, `/activate/resend`, `/forgot`, `/reset`) và file tĩnh (`/css`, `/js`, `/images`). Khách vãng lai có thể tự do khám phá và lưu bookmark.
- **Yêu cầu đăng nhập (`requireAuth`)**: Toàn bộ khu vực quản trị (`/admin/*`: danh sách quản lý, form tạo mới, chỉnh sửa, thao tác cập nhật/xóa món ăn, đầu bếp, nguyên liệu).
- Khi chưa đăng nhập mà truy cập `/admin/*`, trình duyệt được redirect `303` tới `/login?next=...` (có kiểm tra chống open redirect); API admin (`/admin/api/*`) trả `401 JSON`.

### 9.2 Session, Cookie & CSRF Protection

- `express-session` kết hợp với custom Prisma Store lưu tại bảng `Session` trong PostgreSQL.
- Cookie tên `sid`: `httpOnly: true`, `sameSite: 'lax'`, `secure` khi production (trust proxy 1 hop), `path: '/'`, `rolling: true`, `resave: false`. Thời hạn 24 giờ cho phiên đăng nhập, phiên ẩn danh 30 phút. Định kỳ dọn session hết hạn mỗi 10 phút.
- Đăng nhập thành công gọi `req.session.regenerate()` để cấp `sid` mới chống session fixation.
- Middleware `attachUser` nạp `User` từ DB theo `session.userId`, chỉ chấp nhận status `active`, ngược lại hủy session.
- CSRF Protection: Token ngẫu nhiên lưu trong session (đổi khi login), kiểm tra với mọi request thay đổi trạng thái (`POST`, `PATCH`, `DELETE`). Token được đọc từ body hoặc query `?_csrf=` để các form multipart upload ảnh vẫn xác thực hợp lệ. Mọi form POST (logout, form xóa `_method`, form tạo/sửa) đều có token `_csrf`.

### 9.3 Đăng ký & Kích hoạt tài khoản

1. Rate limit `register-ip:<ip>` 5 lần / 60 phút (vượt thì trả `429`).
2. Xác minh Google reCAPTCHA v2 phía server (fail closed).
3. Validate dữ liệu bằng Zod: email chuẩn hóa (trim + lowercase), password 10–64 ký tự, khác email và không nằm trong ~50 mật khẩu thông dụng, displayName tối đa 50 ký tự.
4. Mật khẩu được băm bằng **Argon2id** (OWASP recommendation). Nếu email đã tồn tại, hệ thống thực hiện verify với dummy hash để cân bằng thời gian (chống timing attack), không tạo bản ghi trùng và trả cùng một thông báo chung.
5. Tài khoản mới tạo ở trạng thái `status: 'pending'`, `role: 'viewer'`. Sinh mã OTP 6 chữ số ngẫu nhiên (`crypto.randomInt`), lưu hash HMAC-SHA256 (`OTP_PEPPER`) trong `ActivationChallenge` (hạn 10 phút, attempts 0, sendCount 1) và gửi qua SMTP Nodemailer.
6. Kích hoạt tài khoản (`POST /activate`): Trong một transaction, cập nhật có điều kiện (`usedAt: null`), kiểm tra attempts < 5, chưa hết hạn, hash khớp. Thành công chuyển `status: 'active'`, `303` sang `/login` (không tự đăng nhập). Sai tăng attempts, nhập sai 5 lần thì khóa 15 phút (`status 429`).
7. Gửi lại mã kích hoạt (`POST /activate/resend`): Cách lần gửi trước tối thiểu 60 giây, tối đa 5 lần/giờ. Sinh OTP mới, attempts giữ nguyên, đang khóa thì trả `429`.

### 9.4 Đăng nhập & Chống dò mật khẩu (Brute Force)

- Bộ đếm lưu trong bảng `RateLimit`: `login-email:<emailNormalized>` và `login-ip:<ip>`, cửa sổ cố định 15 phút tính từ lần sai đầu.
- Thứ tự xử lý:
  1. Nếu IP hoặc Email đang `lockedUntil` thì trả `429`, kể cả CAPTCHA đúng, không kiểm tra password.
  2. Nếu số lần sai của email từ 3 trở lên thì bắt buộc giải reCAPTCHA hợp lệ. Thiếu hoặc sai thì render lại form kèm widget reCAPTCHA, không kiểm tra password.
  3. Tra user theo email chuẩn hóa, verify Argon2id (user không tồn tại thì verify với hash giả).
  4. Sai: tăng bộ đếm email và IP, trả thông báo lỗi chung duy nhất. Email sai 10 lần thì khóa 5 phút; IP sai 30 lần trong 15 phút thì khóa 5 phút.
  5. Password đúng nhưng tài khoản `pending`: không tạo session, không tính là một lần sai, báo cần kích hoạt kèm link tới `/activate`.
  6. Thành công: `req.session.regenerate()` (sid mới), gán `userId`, xóa bộ đếm `login-email` (không xóa `login-ip`), `303` tới `next` an toàn hoặc `/dishes`.

### 9.5 Đăng xuất

- `POST /logout` (có kiểm tra CSRF token, không có route `GET /logout`): hủy bản ghi session ở DB store trước, xóa cookie `sid` và `303` về `/login`. Dùng lại `sid` cũ sau khi đăng xuất bị từ chối truy cập.

### 9.6 Quên mật khẩu & Đặt lại mật khẩu

- `POST /forgot`: Rate limit `forgot-email` 3 lần/giờ và `forgot-ip` 10 lần/giờ (vượt trả `429`). Luôn trả cùng thông báo chung («Nếu email đã đăng ký, hướng dẫn đã được gửi.»).
- Với tài khoản `active`: Vô hiệu token cũ, sinh token ngẫu nhiên 32 bytes (`base64url`), lưu SHA-256 `tokenHash` trong bảng `PasswordReset` (hạn 15 phút). Gửi link `APP_BASE_URL/reset?token=...` qua SMTP không đồng bộ (không làm lộ thời gian). Tài khoản `pending`: không gửi gì.
- Trang `/forgot` luôn hiển thị dòng chữ cố định «Chưa nhận được mã kích hoạt? Gửi lại mã» trỏ tới `/activate`.
- `GET /reset?token=`: Chỉ hiện form nếu token hợp lệ (chưa dùng, chưa hết hạn). GET **không bao giờ** thay đổi dữ liệu hay đặt `usedAt`. Header `Referrer-Policy: no-referrer`.
- `POST /reset`: Validate mật khẩu mới; trong một transaction kiểm tra token hợp lệ, cập nhật `passwordHash`, đặt `usedAt = now`, vô hiệu mọi token chưa dùng của user, **XÓA mọi Session** có `userId` đó; gửi email thông báo đã đổi mật khẩu (không chứa password); `303` tới `/login`; không tự đăng nhập. Header `Referrer-Policy: no-referrer`.

---

## 10. Kiểm Thử

Bộ test tự động (`npm test`) gồm:
- Validator Zod (Dish/Chef/Ingredient/Auth) và chuẩn hoá danh sách ID quan hệ.
- Quy chuẩn mật khẩu: 10–64 ký tự, khác email, cấm danh sách 50 mật khẩu phổ biến nhất.
- Xử lý **quan hệ tùy chọn** (Dish không có Chef/Ingredient vẫn hợp lệ).
- Helper phân trang (3 chế độ), bookmark ID parsing, cấu trúc SQL FTS/trigram.
- Regression view: card có nút bookmark, form admin tìm kiếm quan hệ không render toàn bộ dữ liệu, layout nạp đủ script.
- Thư viện xác thực tự quản:
  - Băm mật khẩu bằng Argon2id + dummy verify cân bằng thời gian khi user không tồn tại.
  - OTP 6 số ngẫu nhiên băm bằng HMAC-SHA256 (`OTP_PEPPER`), so sánh bằng `timingSafeEqual`.
  - Token đặt lại mật khẩu 32 bytes ngẫu nhiên (`base64url`), băm bằng SHA-256.
  - Session store Prisma trên database: `get`, `set`, `destroy`, `touch`, dọn dẹp phiên hết hạn.
  - CSRF protection: sinh token ngẫu nhiên lưu session, kiểm tra với mọi request POST/PATCH/DELETE.
  - Rate limiting & chống dò mật khẩu: RateLimit helper, khóa 5 phút khi sai 10 lần, bắt reCAPTCHA khi sai từ 3 lần.
  - Chặn open redirect an toàn khi chuyển hướng sau đăng nhập.
  - Header `Referrer-Policy: no-referrer` bảo vệ trang đặt lại mật khẩu.
  - Tuyệt đối không log thông tin nhạy cảm (password, hash, OTP, reset token, session ID).
- Tích hợp cơ sở dữ liệu thật (bật bằng `RUN_DB_TESTS=1`):
  - Kích hoạt OTP transaction với cập nhật có điều kiện (`usedAt: null`), chống race condition.
  - Đặt lại mật khẩu thành công tự động hủy toàn bộ session của tài khoản đó trong database.
  - Rate limiting ghi nhận và khóa trực tiếp trên bảng `RateLimit`.

```bash
# Chạy 39 test đơn vị (không cần kết nối database)
npm test

# Chạy toàn bộ 43 test tích hợp (yêu cầu database PostgreSQL)
# PowerShell:
$env:RUN_DB_TESTS="1"; npm test
# Bash:
RUN_DB_TESTS=1 npm test
```

---

## 11. Chức Năng Đã Hoàn Thành

| Nhóm | Trạng thái |
| :--- | :--- |
| Phân trang 3 chế độ (Dishes/Chefs/Ingredients) + URL `page` | Hoàn thành |
| Bookmark `am_vi_bookmarks` + trang `/bookmarks` + dọn ID đã xoá | Hoàn thành |
| Chia sẻ trang hiện tại | Hoàn thành |
| PostgreSQL Full-text + Fuzzy (pg_trgm/unaccent) | Hoàn thành |
| Lọc/sắp xếp giá (chỉ Dishes) | Hoàn thành |
| Tìm kiếm Chef/Ingredient phía server trong form admin | Hoàn thành |
| Xác thực tự triển khai (Argon2id, OTP 6 số qua Nodemailer SMTP, Quên/Đặt lại mật khẩu) | Hoàn thành |
| Quản lý phiên bằng Express Session + Cookie `sid` lưu trong bảng PostgreSQL Session | Hoàn thành |
| Bảo vệ biểu mẫu toàn diện với mã chống giả mạo CSRF Token | Hoàn thành |
| Chống brute force bằng RateLimit (cửa sổ 15p, sai 3 lần bắt reCAPTCHA, sai 10 lần khóa 5p) | Hoàn thành |
| Xác minh người dùng bằng Google reCAPTCHA v2 phía server qua Google siteverify | Hoàn thành |
| Phân quyền truy cập `requireAuth` cho khu vực quản trị (`/admin/*`) | Hoàn thành |

---
