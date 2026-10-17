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

### Bước 3: Đồng bộ Database & Sinh Prisma Client
Nếu kết nối trực tiếp đến PostgreSQL:
```bash
# Đẩy schema lên database
npm run prisma:push

# Hoặc chạy migration
npm run prisma:migrate
```

### Bước 4: Nạp Dữ Liệu Mẫu (Seed Data)
Nạp dữ liệu phong phú gồm các món ăn Việt Nam truyền thống, danh sách đầu bếp và nguyên liệu:
```bash
npm run prisma:seed
```

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
