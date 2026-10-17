# SPECIFICATION: FOOD CATALOG SSR WEBSITE

## 1. Mục tiêu và Kiến trúc tổng quan
Xây dựng ứng dụng Food Catalog SSR hoàn chỉnh dựa trên Express, EJS, Prisma ORM, PostgreSQL (Supabase) và Supabase Storage.
Giao diện áp dụng ngôn ngữ thiết kế **Warm Cream — Modern Food Editorial** với Tailwind CSS và DaisyUI.

## 2. Các thực thể dữ liệu (Data Models)
1. **Dish (Món ăn)**
   - `id`: Int / UUID (CUID/Int autoincrement)
   - `name`: String (Bắt buộc, 2-100 ký tự)
   - `description`: String (Mô tả chi tiết)
   - `price`: Int / Decimal (VND, >= 0)
   - `category`: String (vd: Món nước, Món xào, Món nướng, Tráng miệng, Đồ uống)
   - `imagePath`: String (Đường dẫn tương đối trong Supabase Storage bucket `dish-images` hoặc URL fallback)
   - `isFeatured`: Boolean (Dùng cho Hero Slider / Món nổi bật)
   - `createdAt`, `updatedAt`: DateTime

2. **Chef (Đầu bếp)**
   - `id`: Int / UUID
   - `name`: String (Bắt buộc, 2-100 ký tự)
   - `title`: String (vd: Bếp trưởng, Chuyên gia ẩm thực Việt)
   - `description`: String (Tiểu sử, phong cách nấu ăn)
   - `experience`: String / Int (vd: "15 năm kinh nghiệm", "Master Chef")
   - `imagePath`: String (Ảnh đại diện trong bucket)
   - `createdAt`, `updatedAt`: DateTime

3. **Ingredient (Nguyên liệu)**
   - `id`: Int / UUID
   - `name`: String (Bắt buộc, 2-100 ký tự)
   - `category`: String (vd: Rau thơm, Thịt & Hải sản, Gia vị truyền thống, Nông sản)
   - `description`: String (Đặc tính, nguồn gốc)
   - `unit`: String (vd: gram, kg, bó, muỗng)
   - `imagePath`: String (Ảnh minh họa)
   - `createdAt`, `updatedAt`: DateTime

## 3. Hệ thống 15 Trang cốt lõi (3 thực thể x 5 trang)
- **Dish**:
  1. `GET /dishes` - Trang danh sách công khai (Hero slider món nổi bật, tìm kiếm theo tên, lọc category, lọc khoảng giá min-max, sắp xếp A-Z / Giá tăng / Giá giảm / Mới nhất, phân trang server-side, card 4:3)
  2. `GET /dishes/:id` - Trang chi tiết công khai (Hình ảnh lớn, thông tin đầy đủ, danh mục, giá nổi bật Olive Green, nút quay lại)
  3. `GET /admin/dishes` - Trang quản trị danh sách (Bảng data-table DaisyUI, thumbnail 4:3, tìm kiếm, lọc, phân trang, nút Thêm mới, Sửa, Xóa mở modal xác nhận)
  4. `GET /admin/dishes/new` - Form thêm mới (upload ảnh multipart, preview ảnh, validation server-side với Zod, giữ input cũ khi lỗi)
  5. `GET /admin/dishes/:id/edit` - Form cập nhật (giữ ảnh hiện tại nếu không chọn ảnh mới, preview ảnh mới)
- **Chef**:
  6. `GET /chefs` - Trang danh sách công khai
  7. `GET /chefs/:id` - Trang chi tiết công khai
  8. `GET /admin/chefs` - Trang quản trị danh sách
  9. `GET /admin/chefs/new` - Form thêm mới đầu bếp
  10. `GET /admin/chefs/:id/edit` - Form cập nhật đầu bếp
- **Ingredient**:
  11. `GET /ingredients` - Trang danh sách công khai
  12. `GET /ingredients/:id` - Trang chi tiết công khai
  13. `GET /admin/ingredients` - Trang quản trị danh sách
  14. `GET /admin/ingredients/new` - Form thêm mới nguyên liệu
  15. `GET /admin/ingredients/:id/edit` - Form cập nhật nguyên liệu

Trang hỗ trợ:
- `GET /` - Redirect về `/dishes` hoặc trang chủ
- `404 Not Found` - Trang báo lỗi thân thiện chuẩn giao diện Warm Cream
- `500 Server Error` - Trang lỗi hệ thống không lộ stack trace

## 4. Giao diện & Hiệu ứng
- **Bảng màu Warm Cream**:
  - Warm Cream: `#FAF5EC` (nền trang)
  - Ivory: `#FFFDF8` (nền card & container)
  - Olive Green: `#354B35` (nút chính, CTA, giá tiền nổi bật)
  - Terracotta: `#B86F45` (accent, tag, badge)
  - Charcoal: `#292820` (văn bản chính)
  - Sand: `#E9E0D2` (đường viền, separator)
- **Vanta.js + Three.js**:
  - Chỉ chạy client-side trên hero banner của trang công khai
  - Kiểm tra `prefers-reduced-motion`
  - Fallback an toàn bằng CSS background hình ảnh nếu WebGL tắt hoặc lỗi thư viện
  - Cleanup instance và không bật ở trang admin
- **Card món ăn**:
  - Khung ảnh ngang đúng tỉ lệ 4:3 (`aspect-[4/3]`)
  - `object-fit: cover`
  - Placeholder khi ảnh lỗi

## 5. Quy tắc HTTP & PRG (Post/Redirect/Get)
- `POST /admin/:entity` -> Thành công -> `303 Redirect` về `/admin/:entity?success=create`
- `PATCH /admin/:entity/:id` (via `method-override`) -> Thành công -> `303 Redirect` về `/admin/:entity?success=update`
- `DELETE /admin/:entity/:id` (via `method-override`) -> Thành công -> `303 Redirect` về `/admin/:entity?success=delete`
- GET tuyệt đối không làm thay đổi trạng thái database

## 6. Lưu trữ ảnh (Supabase Storage)
- Upload qua `multer` bộ nhớ tạm (`memoryStorage`), kiểm tra mimetype (`image/jpeg`, `image/png`, `image/webp`) và giới hạn kích thước (tối đa 5MB).
- Upload lên Supabase Storage bucket `dish-images` bằng `@supabase/supabase-js`.
- PostgreSQL chỉ lưu `imagePath`. Phục vụ ảnh qua public URL của Supabase hoặc proxy fallback.
- Xử lý partial failure: Nếu upload storage thành công nhưng database insert lỗi, xóa file vừa upload để tránh orphan file. Khi update ảnh mới thành công trong database mới dọn ảnh cũ.

## 7. Quản lý cấu hình & Bảo mật
- Tất cả cấu hình tập trung trong `.env`, nạp qua `src/config/env.js`.
- Báo rõ biến bắt buộc nếu thiếu mà không in lộ giá trị.
- Không đưa secret ra client hay commit vào Git.
