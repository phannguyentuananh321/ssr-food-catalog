# Ấm Vị — Food Catalog SSR Website

Ứng dụng web hiển thị và quản lý danh mục ẩm thực (Food Catalog) xây dựng theo kiến trúc **Server-Side Rendering (SSR)** thực thụ với Express, EJS, Prisma ORM, PostgreSQL (Supabase), Supabase Storage và Tailwind CSS + DaisyUI.

Giao diện được thiết kế theo ngôn ngữ **Warm Cream — Modern Food Editorial**: thanh lịch, ngon mắt, ấm cúng và tập trung vào trải nghiệm hình ảnh món ăn.

---

## 1. Cấu Trúc Tổng Quan (Phạm Vi 15 Trang Chính)

Dự án bao gồm 3 đối tượng nghiệp vụ chính, mỗi đối tượng có 5 trang chuyên biệt (3 × 5 = 15 trang):

| Thực Thể | 1. Danh Sách Công Khai | 2. Chi Tiết Công Khai | 3. Quản Trị Danh Sách | 4. Thêm Mới | 5. Chỉnh Sửa |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Dish (Món ăn)** | `GET /dishes` | `GET /dishes/:id` | `GET /admin/dishes` | `GET /admin/dishes/new` | `GET /admin/dishes/:id/edit` |
| **Chef (Đầu bếp)** | `GET /chefs` | `GET /chefs/:id` | `GET /admin/chefs` | `GET /admin/chefs/new` | `GET /admin/chefs/:id/edit` |
| **Ingredient (Nguyên liệu)** | `GET /ingredients` | `GET /ingredients/:id` | `GET /admin/ingredients` | `GET /admin/ingredients/new` | `GET /admin/ingredients/:id/edit` |

Các trang hỗ trợ:
- `GET /`: Tự động chuyển hướng (303 Redirect) sang `/dishes`.
- `404 Not Found`: Trang thông báo không tìm thấy nội dung.
- `500 Server Error`: Trang thông báo lỗi hệ thống thân thiện, bảo mật không lộ stack trace.

---

## 2. Ngôn Ngữ Thiết Kế & Hiệu Ứng

- **Bảng màu Warm Cream**:
  - `Warm Cream` (`#FAF5EC`): Nền chính trang web.
  - `Ivory` (`#FFFDF8`): Nền card, container và bảng dữ liệu.
  - `Olive Green` (`#354B35`): CTA chính, nút bấm và hiển thị giá tiền nổi bật.
  - `Terracotta` (`#B86F45`): Điểm nhấn phụ, tag danh mục, badge nổi bật.
  - `Charcoal` (`#292820`): Màu chữ tiêu đề và nội dung chính.
  - `Sand` (`#E9E0D2`): Đường viền, đường phân cách và nền phụ.
- **Card Món Ăn**: Khung ảnh ngang tỉ lệ chuẩn **4:3** (`aspect-4-3`), `object-fit: cover`, có placeholder fallback tự động.
- **Hero Trang Công Khai**: Áp dụng **Option 3** (Hero Slider + Món Nổi Bật Tuyển Chọn).
- **Vanta.js + Three.js**: Hiệu ứng sương mù/dòng chảy nhẹ nhàng chỉ chạy ở client-side trên hero banner, hỗ trợ `prefers-reduced-motion` và có fallback tĩnh an toàn.
- **Giao Diện Quản Trị**: Áp dụng **Option 2** (Data Table chuyên nghiệp, modal xác nhận xóa an toàn).

---

## 3. Biến Môi Trường (.env)

Tất cả cấu hình môi trường được quản lý tại file `.env` ở thư mục gốc (không commit vào Git):

| Biến | Mục Đích | Bắt Buộc | Mô Tả & Cách Lấy Giá Trị |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Môi trường chạy | Tùy chọn | `development` hoặc `production` (mặc định: `development`) |
| `PORT` | Cổng HTTP Server | Tùy chọn | Cổng lắng nghe của Express (mặc định: `3000`) |
| `APP_BASE_URL` | URL gốc của ứng dụng | Tùy chọn | Mặc định: `http://localhost:3000` |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL | **Bắt buộc** | Lấy từ **Supabase Dashboard** -> Project Settings -> Database -> Connection String (URI / Pooler) |
| `DIRECT_URL` | Chuỗi kết nối trực tiếp | Tùy chọn | Dùng cho Prisma migrate khi qua transaction pooler |
| `SUPABASE_URL` | Endpoint dự án Supabase | **Bắt buộc cho Storage** | Lấy từ **Supabase Dashboard** -> Project Settings -> API -> Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret Key phía Server | **Bắt buộc cho Storage** | Lấy từ **Supabase Dashboard** -> Project Settings -> API -> `service_role` (Secret) |
| `SUPABASE_STORAGE_BUCKET` | Tên bucket lưu ảnh | Tùy chọn | Tên bucket trong Supabase Storage (mặc định: `dish-images`) |
| `SEED_DEMO` | Bật seed dữ liệu demo | Tùy chọn | Chỉ dùng cho môi trường demo/dev. Ví dụ `SEED_DEMO=true`. Không dùng ở production |
| `SESSION_SECRET` | Khóa mã hóa phiên | Tùy chọn | Chuỗi ngẫu nhiên bảo mật (tối thiểu 32 ký tự) |

---

## 4. Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### Bước 1: Cài đặt Dependencies
```bash
npm install
```

### Bước 2: Cấu hình Môi Trường
Sao chép `.env.example` thành `.env` và điền connection string PostgreSQL và Supabase Storage:
```bash
cp .env.example .env
```

### Bước 3: Quản Lý Schema Database (Prisma Migrate) & Sinh Prisma Client
Database được quản lý bằng **Prisma Migrate**. Áp dụng migration lên database hiện có (an toàn, không xóa dữ liệu):
```bash
# Áp dụng các migration đang chờ (không reset, không mất dữ liệu)
npm run prisma:migrate:deploy

# Kiểm tra trạng thái migration
npm run prisma:migrate:status

# Sinh Prisma Client sau khi đổi schema
npm run prisma:generate
```
> Không dùng `prisma migrate reset` hay `db push --accept-data-loss` trên database có dữ liệu thật.

### Bước 4: Nạp Dữ Liệu Mẫu (TÙY CHỌN — chỉ cho môi trường demo)
Seeder là **tùy chọn (opt-in)**, **idempotent** và **không bao giờ xóa dữ liệu** thật. Mặc định `npm run prisma:seed` sẽ KHÔNG ghi gì nếu chưa bật:
```bash
# Cách 1: truyền cờ --demo
npm run prisma:seed:demo

# Cách 2: bật biến môi trường (macOS/Linux)
SEED_DEMO=true npm run prisma:seed
```
Seeder tự từ chối chạy khi `NODE_ENV=production`. Dữ liệu nghiệp vụ thật phải được quản lý qua giao diện quản trị và lưu trong PostgreSQL.

### Bước 5: Biên dịch CSS (Tailwind CLI & DaisyUI)
```bash
# Build CSS một lần
npm run build:css

# Hoặc theo dõi thay đổi tự động khi phát triển
npm run watch:css
```

### Bước 6: Khởi Động Ứng Dụng
```bash
# Chế độ phát triển (auto-reload với nodemon)
npm run dev

# Chế độ thông thường
npm start
```
Mở trình duyệt tại: [http://localhost:3000](http://localhost:3000)

### Bước 7: Chạy Kiểm Thử (Test Suite)
```bash
npm test
```

---

## 5. Quy Chuẩn HTTP Method & PRG (Post-Redirect-Get)

- `GET`: Chỉ đọc dữ liệu, tuyệt đối không làm thay đổi trạng thái database.
- `POST`: Tạo mới tài nguyên qua multipart/form-data.
- `PATCH`: Cập nhật tài nguyên (gửi qua HTML Form sử dụng `method-override` với trường ẩn `_method=PATCH`).
- `DELETE`: Xóa tài nguyên (gửi qua HTML Form sử dụng `method-override` với trường ẩn `_method=DELETE`).
- Sau mỗi thao tác ghi dữ liệu thành công, server thực hiện `303 See Other Redirect` kèm query status để chống submit trùng lặp khi người dùng refresh trình duyệt.

---

## 6. Mô Hình Dữ Liệu & Quan Hệ

Nguồn dữ liệu nghiệp vụ duy nhất là **PostgreSQL (Supabase)** thông qua Prisma. Supabase Storage chỉ lưu file ảnh.

- **Dish ↔ Ingredient**: quan hệ nhiều-nhiều qua bảng nối tường minh `DishIngredient` (`dishId`, `ingredientId`, unique cặp khóa).
- **Dish ↔ Chef**: quan hệ nhiều-nhiều qua bảng nối tường minh `DishChef` (`dishId`, `chefId`, unique cặp khóa).
- Quan hệ là **tùy chọn**: một món ăn có thể có 0..n nguyên liệu và 0..n đầu bếp. Trang chi tiết hiển thị thông báo thân thiện khi chưa có dữ liệu quan hệ.
- Trang chi tiết Chef và Ingredient liệt kê các món ăn liên quan, truy vấn trực tiếp từ database (không hard-code).
- Không lưu danh sách nguyên liệu/đầu bếp dưới dạng CSV/JSON trong bảng `Dish`.

### Quy Tắc Xóa
- Xóa **Dish**: chỉ xóa bản ghi Dish và các dòng nối của chính nó (`ON DELETE CASCADE` trên bảng nối). **Không** xóa Chef/Ingredient.
- Xóa **Chef/Ingredient** đang được món ăn sử dụng: **bị chặn** ở cả tầng ứng dụng (thông báo rõ ràng) và database (`ON DELETE RESTRICT`). Gỡ liên kết khỏi Dish trước khi xóa.
- Xóa luôn dùng phương thức `DELETE` (qua `method-override`) và redirect `303`; `GET` không bao giờ thay đổi dữ liệu.

### Ảnh & imagePath
- `imagePath` chỉ lưu **đường dẫn tương đối** trong bucket `dish-images` (ví dụ `dishes/<tên file>.jpg`). URL công khai được tạo từ bucket + relative path.
- Upload dùng Multer `memoryStorage`, chỉ nhận `image/jpeg`, `image/png`, `image/webp`, tối đa 5MB. Nếu DB ghi thất bại sau khi upload, file vừa upload được dọn; ảnh cũ chỉ bị xóa sau khi DB cập nhật thành công.

---

## 7. Kiểm Thử

```bash
# Test đơn vị (không cần database)
npm test

# Test tích hợp trên database thật (tạo rồi tự dọn dẹp dữ liệu test)
# macOS/Linux:
RUN_DB_TESTS=1 npm test
```

Bộ test bao gồm: validator Zod, chuẩn hoá danh sách ID quan hệ, xử lý quan hệ tùy chọn (Dish không có Chef/Ingredient), và các test tích hợp CRUD + quan hệ + quy tắc xóa chạy trên PostgreSQL.

---

## 8. Lưu Ý Bảo Mật (Đã Biết)

- Các route `/admin` hiện **chưa có xác thực**; không nên public ghi dữ liệu ở production. Đây là hạng mục ngoài phạm vi bản refactor này và được ghi nhận để xử lý riêng.
- Không commit `.env`; secret chỉ nằm trong biến môi trường của nền tảng triển khai.
