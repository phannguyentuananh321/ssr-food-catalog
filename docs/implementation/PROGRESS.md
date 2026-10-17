# PROJECT IMPLEMENTATION PROGRESS

## Bảng Trạng Thái Các Phase

| Phase | Mô tả công việc | Trạng thái | Tiêu chí nghiệm thu |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Khảo sát, khởi tạo dự án, dependencies, config `.env` & `.gitignore` | `COMPLETE` | `package.json` chuẩn, scripts build/dev/migrate/seed, `.env.example`, `.env`, git repo không lộ secret |
| **Phase 2** | Database Layer: Prisma Schema, Client & Seed Data | `COMPLETE` | Schema đầy đủ cho `Dish`, `Chef`, `Ingredient`; Prisma Client singleton; file `seed.js` phong phú ẩm thực Việt |
| **Phase 3** | Storage & Upload Service (Supabase Storage) | `COMPLETE` | Middleware Multer memory storage, Supabase storage service với dọn orphan file, partial failure & fallback |
| **Phase 4** | Layouts, UI Theme Warm Cream, Tailwind CSS + DaisyUI, Vanta.js | `COMPLETE` | Theme Warm Cream chuẩn bảng màu, Tailwind 4 + DaisyUI 5 build thành công `output.css`, EJS layout & partials, Vanta client script |
| **Phase 5** | Dish Entity End-to-End (5 trang) | `COMPLETE` | 5 trang: Public list (Option 3 Hero slider + 4:3 cards + search/filter/sort/paginate), detail, admin list (Option 2 Data table), create, edit |
| **Phase 6** | Chef Entity End-to-End (5 trang) | `COMPLETE` | 5 trang: Public list, detail, admin list, create, edit; upload chân dung 4:3, PRG 303 |
| **Phase 7** | Ingredient Entity End-to-End (5 trang) | `COMPLETE` | 5 trang: Public list, detail, admin list, create, edit; upload ảnh 4:3, PRG 303 |
| **Phase 8** | Validation, Error Handling, Security, 404 & 500 Pages | `COMPLETE` | Zod validators, sanitize output, modal confirm delete, method-override PATCH/DELETE, 404 & 500 views |
| **Phase 9** | Kiểm thử, Verification, Build & Documentation | `COMPLETE` | Test suite 12/12 passed, build:css thành công, README hoàn chỉnh, tài liệu đặc tả đầy đủ |

## Chi tiết thực hiện theo thời gian thực
- **Phase 1**: Khởi tạo repository Git, cài đặt Express 4, EJS, express-ejs-layouts, Prisma 6, Supabase JS, Tailwind 4, DaisyUI 5, Zod, Multer. Cấu hình `.gitignore` bảo vệ tuyệt đối secrets. Tạo `.env.example` và `.env`.
- **Phase 2**: Thiết kế `prisma/schema.prisma` cho 3 model `Dish`, `Chef`, `Ingredient`. Tạo `src/lib/prisma.js` singleton và `prisma/seed.js` nạp dữ liệu mẫu.
- **Phase 3**: Xây dựng `src/middleware/upload.js` và `src/services/image.service.js` kết nối Supabase Storage bucket `dish-images`, hỗ trợ preview ảnh và dọn dẹp file khi xảy ra lỗi.
- **Phase 4**: Cấu hình theme Warm Cream với các mã màu `#FAF5EC`, `#FFFDF8`, `#354B35`, `#B86F45`, `#292820`, `#E9E0D2`. Xây dựng layout `main.ejs`, partials `header.ejs`, `footer.ejs`, `alerts.ejs`, `pagination.ejs` và hiệu ứng Vanta.js client-side.
- **Phase 5**: Hoàn thiện 5 trang Dish: `index.ejs`, `show.ejs`, `admin-index.ejs`, `form.ejs` (dùng chung create/edit), xử lý tìm kiếm tên, lọc danh mục, lọc khoảng giá min/max, sắp xếp 5 tiêu chí và phân trang server-side.
- **Phase 6**: Hoàn thiện 5 trang Chef với đầy đủ CRUD, validation Zod và PRG redirect.
- **Phase 7**: Hoàn thiện 5 trang Ingredient với đầy đủ CRUD, validation Zod và PRG redirect.
- **Phase 8**: Hoàn thiện hệ thống bắt lỗi `src/middleware/error-handler.js`, trang lỗi 404/500 và modal xác nhận xóa bằng method-override DELETE.
- **Phase 9**: Tạo và chạy bộ kiểm thử `tests/run-tests.js` (12/12 pass), biên dịch CSS minified, viết `README.md` chi tiết.

---

# REFACTOR ĐỢT 2 — QUAN HỆ DISH–CHEF–INGREDIENT & SỬA LỖI XÓA

> Các phase dưới đây phản ánh trạng thái **thực tế đã kiểm chứng** trong đợt refactor mới. Không đánh dấu COMPLETE chỉ vì đã viết code.

| Phase | Mô tả | Trạng thái | Bằng chứng kiểm chứng |
| :--- | :--- | :--- | :--- |
| **R1** | Khảo sát database thật + backup dữ liệu | `COMPLETE` | Truy vấn read-only: `dishes=6, chefs=1, ingredients=0`; backup JSON tại `backups/` (6 dish / 1 chef / 0 ingredient) |
| **R2** | Sửa lỗi nút Xóa (script bị layout nuốt) | `COMPLETE` | HTML `/admin/dishes` sau sửa chứa `function openDeleteModal`; test e2e delete 303 + bản ghi biến mất |
| **R3** | Schema M:N (`DishIngredient`, `DishChef`) + migration | `COMPLETE` | `prisma migrate status` → "Database schema is up to date!" (2 migration: baseline + relations) |
| **R4** | Xóa 5 món demo (#10–#14) + ảnh demo trong bucket | `COMPLETE` | `remove-demo-dishes.js --confirm` xóa 5 dòng; verify còn `dishes=1` (#15), bucket root hết ảnh demo |
| **R5** | Form Dish chọn nhiều Ingredient/Chef + trang chi tiết hai chiều | `COMPLETE` | Smoke test: tạo Dish với 2 nguyên liệu + 2 đầu bếp; detail Dish/Chef/Ingredient hiển thị quan hệ đúng |
| **R6** | Quy tắc quan hệ tùy chọn + chặn xóa Chef/Ingredient đang dùng | `COMPLETE` | Test: Dish không quan hệ tạo được; xóa Chef/Ingredient in-use bị chặn (RESTRICT + guard) |
| **R7** | Viết lại seed idempotent/opt-in; loại bỏ `sync-supabase.js` | `COMPLETE` | `prisma/seed.js` không xóa dữ liệu, từ chối production; `sync-supabase.js` đã xóa |
| **R8** | Cập nhật test & tài liệu | `COMPLETE` | `npm test` 16/16; `RUN_DB_TESTS=1 npm test` 24/24; README + MASTER_SPEC cập nhật |
| **R9** | Xác thực trang quản trị `/admin` | `NOT_STARTED` | Ngoài phạm vi đợt này (đã ghi nhận rủi ro trong README mục 8) |

## Ghi chú refactor
- **Nguyên nhân lỗi Xóa:** `app.set('layout extractScripts', true)` nhưng `layouts/main.ejs` thiếu `<%- script %>`, khiến script định nghĩa `openDeleteModal` bị loại khỏi HTML → nút Xóa báo `ReferenceError`. Đã thêm `<%- script %>` và `<%- style %>`.
- **Nguồn dữ liệu:** duy nhất PostgreSQL/Supabase qua Prisma; đã xác nhận không có hard-code/JSON làm nguồn dữ liệu.
- **Đổi quy tắc nghiệp vụ:** bỏ ràng buộc "mỗi Dish phải có ≥1 Ingredient và ≥1 Chef"; quan hệ là tùy chọn theo yêu cầu mới.
- **Dữ liệu đã xóa:** Dish #10–#14 (demo). **Giữ:** Dish #15 "Nước thánh", Chef #4 "Lê Lương Lánh". Bảng Ingredient chưa có dữ liệu.
- **Chưa thực hiện trên Supabase:** không có thao tác thủ công nào ngoài `migrate deploy` và xóa demo đã nêu; không reset database, không drop bảng.
