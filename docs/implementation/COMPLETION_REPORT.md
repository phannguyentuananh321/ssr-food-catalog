# BÁO CÁO HOÀN THÀNH — FOOD CATALOG UPGRADE

Ngày: 2026-11-06 · Môi trường kiểm thử: local (`http://localhost:3000`), PostgreSQL Supabase thật.

Quy ước trạng thái:
- **Đã thực hiện**: code + kiểm thử thành công, có bằng chứng.
- **Một phần**: code có, nhưng một phần phụ thuộc cấu hình/dịch vụ ngoài chưa kiểm thử được.
- **Chưa thực hiện**: chưa code hoặc không áp dụng.

> Điểm khác biệt kiến trúc đã thống nhất: dự án là **Express + EJS SSR**, không phải React SPA. Vì vậy:
> - “React Context tại root app” → trạng thái bookmark dùng module JS toàn cục (`window.AmViBookmarks`) + sự kiện `amvi:bookmarks-changed`.
> - Session Supabase dùng **cookie HttpOnly qua `@supabase/ssr`** thay vì session trong RAM/localStorage.

## 1. Đối chiếu quyết định

| # | Quyết định | Trạng thái | Ghi chú / bằng chứng |
| :--- | :--- | :--- | :--- |
| 1.1 | Public Dishes/Chefs/Ingredients: 3 chế độ phân trang (numbered, load more, infinite) | Đã thực hiện | `?mode=pages\|load-more\|infinite&page=N`; JSON fragment `/api/*`; kiểm thử trình duyệt cả 3 chế độ |
| 1.2 | Admin chỉ numbered pagination | Đã thực hiện | View admin dùng partial pagination số trang; kiểm thử `/admin/dishes?page=2` |
| 1.3 | URL biểu diễn trang hiện tại | Đã thực hiện | `page` + `mode` giữ nguyên khi search/filter/sort; reload đúng trang |
| 1.4 | Không phá search/filter/sort; xử lý rỗng/trang cuối | Đã thực hiện | Kiểm thử kết hợp q + category + giá + sort + page |
| 2.1 | Bookmark Dishes/Chefs/Ingredients | Đã thực hiện | `window.AmViBookmarks`, nút trên card + trang chi tiết |
| 2.2 | LocalStorage `am_vi_bookmarks` chỉ lưu ID | Đã thực hiện | `{ dishes: [], chefs: [], ingredients: [] }`; kiểm thử reload giữ bookmark |
| 2.3 | Trang `/bookmarks` lấy dữ liệu mới theo ID | Đã thực hiện | `/api/bookmarks` hydrate từ PostgreSQL; bỏ lưu trực tiếp trên trang |
| 2.4 | Tự loại ID đã bị xóa khỏi DB | Đã thực hiện | `validIds` trả về → client prune localStorage; kiểm thử xóa bản ghi |
| 3 | Chia sẻ đúng trang hiện tại, không khôi phục item cũ | Đã thực hiện | URL chỉ chứa `mode` + `page`; mở trực tiếp/reload chỉ tải trang đó. Clipboard bị chặn ở trình duyệt headless nên đã stub `navigator.clipboard.writeText` để xác minh URL |
| 4.1 | PostgreSQL Full-text Search | Đã thực hiện | `to_tsvector('simple', immutable_unaccent(...)) @@ websearch_to_tsquery(...)`; kiểm thử DB thật |
| 4.2 | Fuzzy Search (`pg_trgm` + `unaccent`) | Đã thực hiện | Toán tử `%`, `similarity()`, `position()`; migration bật extension |
| 4.3 | Không lọc bằng JavaScript, không dịch vụ ngoài | Đã thực hiện | Test kiểm tra service dùng SQL; không có search engine riêng |
| 4.4 | Áp dụng cho cả 3 thực thể | Đã thực hiện | Kiểm thử FTS không dấu cho Dish/Chef/Ingredient |
| 5 | Lọc khoảng giá + sort tăng/giảm chỉ cho Dishes | Đã thực hiện | `minPrice`, `maxPrice`, `price-asc`, `price-desc`; kiểm thử kết hợp tìm kiếm |
| 6.1 | 2 thanh tìm kiếm Chef/Ingredient trong form admin | Đã thực hiện | `GET /admin/api/chefs?q=`, `/admin/api/ingredients?q=` |
| 6.2 | Tìm kiếm server bằng ILIKE, không FTS, không tải toàn bộ | Đã thực hiện | `contains` + `mode: 'insensitive'`, giới hạn 10 kết quả |
| 6.3 | Debounce, chọn/bỏ chọn, giữ lựa chọn khi đổi từ khóa | Đã thực hiện | 300ms + `AbortController`; chip + hidden input; kiểm thử trình duyệt |
| 6.4 | Edit preload đúng quan hệ; save đúng ID | Đã thực hiện | Kiểm thử tạo/sửa Dish với nhiều Chef/Ingredient |
| 7.1 | Đăng ký email/password, username duy nhất ở DB | Đã thực hiện | `UserProfile.usernameLower` UNIQUE; test trùng username (khác hoa/thường) → 409 |
| 7.2 | Xác minh email (OTP/confirmation) | Một phần | OTP + callback `token_hash` đã code; việc gửi email thật phụ thuộc SMTP/template Supabase (chưa cấu hình) |
| 7.3 | CAPTCHA đăng ký + rate limit đăng ký | Đã thực hiện | Turnstile widget hiện trên form; thiếu token → 400; token hợp lệ qua `siteverify`; rate limit theo IP. Đang dùng **official test keys**, thay key thật khi deploy |
| 7.4 | Supabase Auth sở hữu hash mật khẩu | Đã thực hiện | Không có bcrypt/argon2, không cột password hash; test kiểm tra source + schema |
| 7.5 | Đăng nhập + CAPTCHA từ lần sai thứ 3 | Đã thực hiện | Lần sai thứ 3 hiện widget; lần 4 thiếu token → 400; token hợp lệ được chấp nhận (đang dùng test keys) |
| 7.6 | Chờ 30s/5ph/30ph; không reset khi hết hạn; chỉ reset khi thành công | Đã thực hiện | Test DB thật: lần 3→30s, lần 4→300s, lần 5→1800s, hết hạn giữ bộ đếm, reset chỉ khi thành công |
| 7.7 | Backend kiểm tra chờ; không bypass bằng API trực tiếp | Đã thực hiện | POST trực tiếp khi đang khoá → 429 (không có endpoint đăng nhập thay thế) |
| 7.8 | Kết hợp IP + tài khoản | Đã thực hiện | Khoá theo `sha256(IP + email chuẩn hoá)`; đánh đổi: đổi IP có thể thử lại (ghi nhận) |
| 7.9 | Không lộ trạng thái tài khoản | Đã thực hiện | Lỗi đăng nhập chung; email chưa xác minh trả 403 sau khi mật khẩu đúng |
| 7.10 | Session/token qua Supabase SDK | Đã thực hiện | Cookie HttpOnly `Path=/`, `SameSite=Lax`, `Secure` production; kiểm thử đăng nhập qua curl |
| 7.11 | Express xác minh Access Token | Đã thực hiện | `attachAuth` gọi `supabase.auth.getUser()` mỗi request |
| 7.12 | Không session table/RAM; không token trong URL/log | Đã thực hiện | Không có bảng session; test source không `console.log` token |
| 7.13 | Quên mật khẩu bằng Supabase recovery | Một phần | Trang + endpoint + generic notice hoạt động; gửi email thật phụ thuộc SMTP |
| 7.14 | Đăng xuất bằng `signOut()`, POST, xóa UI | Đã thực hiện | `POST /auth/logout` → 303, cookie auth bị xóa; request sau đó → 303 login. `GET /auth/logout` → 404 |
| 7.15 | Turnstile server-side, secret chỉ ở server | Đã thực hiện | `siteverify` thật với test secret; production thiếu key → fail closed |
| 8.1 | Admin duy nhất theo `ADMIN_EMAIL` server env | Đã thực hiện | Không hardcode trong view/JS; so khớp sau khi chuẩn hoá |
| 8.2 | Tài khoản mới mặc định user; không tự nâng quyền | Đã thực hiện | Không có API/role selection; test với role/metadata giả không có tác dụng |
| 8.3 | Xác minh Access Token + email verified + `ADMIN_EMAIL` → 403 nếu sai | Đã thực hiện | Ma trận test: admin 200; user thường 403; chưa đăng nhập 401/303 |
| 8.4 | Bảo vệ `/admin/*` và toàn bộ API CRUD | Đã thực hiện | `router.use(requireAdmin)`; DELETE/POST trực tiếp bị 403/303 |
| 8.5 | Không đưa Service Role Key ra frontend | Đã thực hiện | Chỉ dùng trong service phía server/script; không có trong view/JS |
| 9.1 | API yêu cầu đăng nhập phải xác minh token | Đã thực hiện | `/api/*` 401 khi chưa đăng nhập |
| 9.2 | Kiểm tra quyền sở hữu dữ liệu | Không áp dụng | Không có dữ liệu riêng theo user (bookmark lưu client-side) |
| 10 | Không xóa dữ liệu/migration cũ | Đã thực hiện | Chỉ thêm migration mới; dữ liệu test đã dọn |
| 11 | README + báo cáo | Đã thực hiện | README mục 4, 9, 10, 11 và file này |

## 2. Chức năng đã triển khai

- Phân trang 3 chế độ public + numbered cho admin, giữ trạng thái trên URL.
- Bookmark 3 loại, trang `/bookmarks`, tự dọn ID đã xóa.
- Chia sẻ trang hiện tại.
- FTS + fuzzy search PostgreSQL cho 3 thực thể; lọc/sắp xếp giá cho Dish.
- Tìm kiếm server-side Chef/Ingredient trong form admin.
- Đăng ký, xác minh email (OTP/link), đăng nhập, quên/đặt lại mật khẩu, đăng xuất.
- Chống brute force theo bậc, CAPTCHA Turnstile từ lần sai thứ 3, rate limit đăng ký theo IP.
- Admin duy nhất theo `ADMIN_EMAIL`; chặn toàn bộ API quản trị ở backend.
- Chặn toàn site sau đăng nhập (trừ `/auth/*` và static).

## 3. File chính thêm/sửa

**Thêm mới**
- `src/lib/supabase-server.js` — Supabase client theo request + cookie.
- `src/middleware/auth.js` — `attachAuth`, `requireAuth`, `requireAdmin`, `isAdminUser`, `safeNextPath`.
- `src/controllers/auth.controller.js` — toàn bộ luồng auth.
- `src/routes/auth.routes.js` — route `/auth/*`.
- `src/validators/auth.validator.js` — Zod cho register/login/reset/OTP.
- `src/services/auth-throttle.service.js` — khoá đăng nhập + rate limit đăng ký.
- `src/services/turnstile.service.js` — xác minh CAPTCHA server-side.
- `src/views/auth/{login,register,verify,forgot-password,reset-password}.ejs`.
- `src/views/errors/403.ejs`.
- `prisma/migrations/20261106010000_add_auth_profiles_throttles/migration.sql`.
- `docs/implementation/COMPLETION_REPORT.md`.

**Sửa**
- `src/app.js` — `attachAuth`, `/auth`, `requireAuth` toàn site, `trust proxy` production.
- `src/routes/admin.routes.js` — `router.use(requireAdmin)`.
- `src/views/partials/header.ejs` — nav theo trạng thái đăng nhập, ẩn admin với user thường.
- `prisma/schema.prisma` — `UserProfile`, `LoginThrottle`, `RegistrationThrottle`.
- `src/config/env.js` — Admin/Turnstile/registration env + validate production.
- `.env.example`, `.env`, `README.md`, `tests/run-tests.js`.

## 4. Database / migration / extension

- Migration mới: `20261106010000_add_auth_profiles_throttles` (3 bảng, unique index username).
- Extension đã bật trước đó: `pg_trgm`, `unaccent` (schema `extensions`) + hàm `public.immutable_unaccent`.
- Không xóa migration/bảng/dữ liệu nào. Đã xóa **dữ liệu test** do quá trình kiểm thử tạo ra (các auth user test + profile + throttle rows).

## 5. Biến môi trường cần cấu hình

| Biến | Ghi chú |
| :--- | :--- |
| `SUPABASE_ANON_KEY` | Bắt buộc cho Auth |
| `ADMIN_EMAIL` | **Đã set `phananhngof@gmail.com`** (tài khoản Supabase đã xác minh) |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Đang dùng **official test keys** (`1x000...AA`); thay key thật trước khi deploy |
| `REGISTRATION_LIMIT`, `REGISTRATION_WINDOW_MINUTES` | Mặc định 5 / 60 phút |
| `APP_BASE_URL` | Dùng cho `emailRedirectTo`; production phải là domain thật |

## 6. Thao tác thủ công còn lại

1. **Supabase → Authentication → URL Configuration**: thêm `http://localhost:3000/auth/callback?next=/dishes` và `...?next=/auth/reset-password`.
2. **Supabase → Email Templates**: đổi Confirm signup / Reset password sang link `token_hash` (xem README Bước 2b) để xác minh chéo thiết bị.
3. **Supabase → SMTP Settings**: cấu hình SMTP riêng. Email mặc định của Supabase bị giới hạn gửi rất thấp — trong phiên kiểm thử đã gặp `over_email_send_rate_limit`; đây là lý do form đăng ký báo *“Hệ thống gửi email xác minh đang tạm đạt giới hạn”*. Có thể chờ quota reset, cấu hình SMTP, hoặc tạm tắt *Confirm email* khi demo.
4. **Cloudflare Turnstile**: hiện dùng test keys (`1x000...AA`) — widget hiện và `siteverify` luôn pass. Tạo widget thật rồi thay 2 key; có thể bật thêm CAPTCHA trong Supabase Attack Protection.
5. **Admin**: `ADMIN_EMAIL=phananhngof@gmail.com` đã khớp tài khoản đã xác minh — đăng nhập lại và mở `/admin/dishes`.
6. **Bảo mật**: DB password và Supabase keys từng được dán trong chat; nên rotate chúng và không commit `.env`.

## 7. Kết quả kiểm thử

| Hạng mục | Kết quả |
| :--- | :--- |
| `npm test` | **41/41 pass** |
| `RUN_DB_TESTS=1 npm test` | **55/55 pass** (gồm FTS/fuzzy + throttle + CRUD quan hệ) |
| `npm run build:css` | Thành công |
| Đăng nhập user thường | Cookie `Path=/; HttpOnly; SameSite=Lax`; `/dishes` 200, `/bookmarks` 200, `/api/dishes` 200 |
| Phân quyền admin | admin `/admin/dishes` 200, API search 200; user thường 403; chưa đăng nhập 401 (API) / 303 (trang) |
| Gọi trực tiếp mutation | user thường DELETE/POST → 403; chưa đăng nhập → 303 |
| Khoá đăng nhập | Lần 1–2 → 401; lần 3 → 429 + 30s; hết hạn → lần 4 → 429 + 300s; DB test lần 5 → 1800s; hết hạn không reset; reset khi thành công |
| Open redirect | `next=https://…`, `next=//…`, `next=\\…` → về `/dishes`; `next=/bookmarks` → `/bookmarks` |
| Email chưa xác minh | Đăng nhập đúng mật khẩu → 403 “Email chưa được xác minh” |
| Trùng username | `NguYenVanA` vs `nguyenvana` → 409 |
| Đăng xuất | POST → 303, cookie bị xóa, `/dishes` sau đó → 303; GET → 404 |
| CAPTCHA đăng ký | Widget Turnstile render, token được tạo; POST thiếu token → 400; token hợp lệ qua `siteverify` (test keys) |
| CAPTCHA đăng nhập | 3 lần sai → 429 + widget; lần 4 thiếu token sau hết khoá → 400; token hợp lệ được chấp nhận |
| UI | Trang login/register render đúng trên trình duyệt |

## 8. Chưa hoàn thành / hạn chế

- **Gửi email thật** (xác minh + reset) chưa kiểm thử do Supabase email rate limit và chưa có SMTP riêng.
- **Turnstile test keys** luôn pass, nên chưa thể kiểm thử trường hợp challenge thất bại; cần thay key thật để có CAPTCHA đúng nghĩa ở production.
- **Refresh token theo thời gian** chưa test trực tiếp (do token sống 1 giờ); việc refresh do SDK đảm nhiệm.
- Tài khoản test đã xóa; database hiện chỉ còn `phananhngof@gmail.com` (tài khoản Admin do người dùng tạo, đã xác minh).
- Tài khoản Admin hiện chưa có `UserProfile` (tạo qua Supabase Dashboard thay vì form), nên header hiển thị email thay vì username — không ảnh hưởng đăng nhập/quyền.
- Mỗi request gọi `supabase.auth.getUser()` (round-trip tới Supabase Auth) — đơn giản, đúng bảo mật, nhưng tốn latency; có thể cache ngắn nếu cần tối ưu.
