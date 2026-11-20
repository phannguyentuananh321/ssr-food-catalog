# ĐẶC TẢ KỸ THUẬT: PHÂN QUYỀN (RBAC) VÀ BẢO VỆ 2 LỚP (MFA / TOTP)
**Dự án**: Ấm Vị (Food Editorial SSR — Express 4, EJS, Prisma, PostgreSQL on Supabase)  
**Ngày chốt đặc tả**: 20/11/2026  
**Mục đích**: Tài liệu này đóng vai trò kim chỉ nam ghi lại toàn bộ các quyết định kiến trúc và quy chuẩn bảo mật đã được thống nhất. Mọi Agent và lập trình viên khi triển khai bắt buộc phải đọc và tuân thủ tuyệt đối, không được tự ý thay đổi hoặc làm lạc đề.

---

## 1. PHÂN QUYỀN RBAC (ROLE-BASED ACCESS CONTROL)

### 1.1 Quyết định kiến trúc: Dùng RBAC thuần túy (BỎ ABAC)
* **Không áp dụng ABAC**: Giữ nguyên vẹn cấu trúc cơ sở dữ liệu các bảng `Dish`, `Chef`, `Ingredient`. **Tuyệt đối không thêm** các cột `authorId` hay `status` (draft/published) vào các bảng thực thể ẩm thực.
* Bảng `User` trong database đã có sẵn cột `role String @default("viewer")`.

### 1.2 Ma trận phân quyền 3 Vai trò (Role Matrix)

| Hành động / Tuyến đường | `viewer` *(Mặc định)* | `editor` *(Biên tập viên)* | `admin` *(Quản trị viên)* |
| :--- | :---: | :---: | :---: |
| **Xem danh mục công khai** (`/dishes`, `/chefs`, `/ingredients`, `/bookmarks`) |  Cho phép |  Cho phép |  Cho phép |
| **Vào khu vực quản trị** (`GET /admin/*`) | ❌ Chặn (**403**) |  Cho phép |  Cho phép |
| **Thêm & Sửa dữ liệu** (`POST`, `PATCH /admin/*`) | ❌ Chặn (**403**) |  Cho phép |  Cho phép |
| **Xóa dữ liệu** (`DELETE /admin/*`) | ❌ Chặn (**403**) | ❌ Chặn (**403**) |  **Duy nhất Admin** |

### 1.3 Quy tắc kiểm tra bảo mật ở Backend
1. **Ẩn nút trên UI không phải là bảo mật**:
   * Template EJS có thể ẩn nút Xóa với `editor` và `viewer` để phục vụ trải nghiệm người dùng (UX).
   * **Bắt buộc kiểm tra ở Backend trên từng route**: Router DELETE (`/admin/dishes/:id`, `/admin/chefs/:id`, `/admin/ingredients/:id`) bắt buộc phải bọc middleware `requireRole(['admin'])`. Kẻ xấu gửi request cURL / Postman `DELETE` kèm session của `editor` hoặc `viewer` lập tức nhận mã lỗi **HTTP 403 Forbidden**.
2. **Không tin tưởng dữ liệu Client gửi lên**:
   * Danh tính và `role` được lấy **100% từ Server Session & Database (`req.user.role`)**.
   * Bỏ qua mọi trường `role` hay `managerId` gửi qua form HTML / body payload.
3. **Kiểm tra độc lập giữa đọc (GET) và ghi (PATCH/DELETE)**:
   * Mở được form sửa (`GET`) không bảo đảm được ghi (`PATCH`). Mỗi request ghi phải được thẩm định quyền độc lập.

### 1.4 Quy trình 3 Cổng khi Sửa/Ghi dữ liệu
Khi có request thao tác dữ liệu (ví dụ `PATCH /admin/dishes/:id`), hệ thống phải đi qua đúng 3 cổng:
* **Cổng 1 (Session / Authentication)**: Đã đăng nhập chưa?  
  *(Chưa ➔ `401 Unauthorized` hoặc redirect `303` về `/login`)*.
* **Cổng 2 (RBAC / Role)**: Role có quyền sửa không?  
  *(Role `viewer` ➔ Chặn ngay với mã lỗi `403 Forbidden`)*.
* **Cổng 3 (Resource Existence)**: Món ăn/thực thể có tồn tại trong Database không?  
  *(Không tồn tại ➔ Lỗi `404 Not Found`)*.
* **Handler Ghi**: Chỉ được phép chạy sau khi đã vượt qua đầy đủ 3 cổng trên.

---

## 2. QUẢN LÝ VÀ CHỈ ĐỊNH VAI TRÒ (BOOTSTRAP VIA .ENV)

### 2.1 Cấu hình trong `.env`
Hệ thống sử dụng cơ chế cấu hình Bootstrap trong `.env` để tự động hóa 100% khi chạy demo và vận hành:

```env
# 1. Email Admin tối cao:
INITIAL_ADMIN_EMAIL=phananhngof@gmail.com

# 2. Danh sách Email các Editor trong nhóm (cách nhau bởi dấu phẩy):
INITIAL_EDITOR_EMAILS=editor1@gmail.com,editor2@gmail.com
```

### 2.2 Cơ chế tự động gán quyền tại thời điểm đăng ký:
* Khi user đăng ký mới:
  * Nếu email chuẩn hóa khớp `INITIAL_ADMIN_EMAIL` ➔ Gán `role = 'admin'`.
  * Nếu email chuẩn hóa nằm trong `INITIAL_EDITOR_EMAILS` ➔ Gán `role = 'editor'`.
  * Tất cả các email còn lại ➔ Gán `role = 'viewer'`.

---

## 3. XÁC THỰC 2 LỚP MFA (GOOGLE AUTHENTICATOR & TOTP)

### 3.1 Tính chất: Hoàn toàn Tùy chọn (Optional / Opt-in)
* Mặc định khi đăng ký, tài khoản có `twoFactorEnabled = false`. Người dùng vẫn đăng nhập bình thường bằng Email + Mật khẩu.
* Chỉ người dùng nào chủ động vào trang Cài đặt bảo mật (`/settings/security`) bật lên thì từ lần đăng nhập sau mới yêu cầu bước 2.

### 3.2 Kích hoạt và Vô hiệu hóa 2FA
1. **Bật 2FA (Chống lỗi kích hoạt dở dang)**:
   * Khi người dùng bấm "Bật 2FA", server sinh mã secret tạm thời (`tempSecret`) và vẽ mã QR.
   * **Chỉ khi nào** người dùng dùng app quét và nhập đúng mã 6 số đầu tiên gửi lên server xác nhận thành công thì server mới chính thức lưu secret và đặt `twoFactorEnabled = true`.
2. **Tắt 2FA (Chống chiếm đoạt phiên - Re-authentication)**:
   * Khi muốn Tắt 2FA, người dùng **bắt buộc phải nhập đồng thời 2 yếu tố**:
     1. Mật khẩu hiện tại (Password xác thực qua Argon2id).
     2. Mã xác thực 6 chữ số (TOTP) đang chạy trên Google Authenticator.
   * Cả 2 yếu tố đều đúng thì mới cho phép tắt 2FA.

### 3.3 Chặn các "Đường vòng" ở bước MFA (MFA Bypass Prevention)
1. **Chặn rò rỉ phiên lơ lửng (Pre-Auth Leak)**:
   * Ở Bước 1 (Mật khẩu đúng), **tuyệt đối KHÔNG gán `req.session.userId`**.
   * Chỉ gán session tạm thời bị hạn chế:  
     `req.session.mfaPending = { userId, expiresAt: Date.now() + 5*60*1000, attempts: 0 }` (thời hạn tối đa 5 phút).
   * Middleware `attachUser` chỉ đọc `session.userId`. Người ở trạng thái `mfaPending` đối với toàn bộ các route khác vẫn là khách chưa đăng nhập (`req.user = null`), cố tình vào `/admin/*` sẽ bị chặn ngay.
2. **Chặn truy cập thẳng URL**:
   * Các route `/login/2fa` bắt buộc kiểm tra `req.session.mfaPending`. Nếu không có hoặc đã hết hạn ➔ Hủy session và chuyển hướng `303` về `/login`.
3. **Phạm vi bảo vệ**:
   * Mọi Form SSR, API đăng nhập và mọi route cấp phiên làm việc hoặc token đều bắt buộc phải trải qua bước MFA nếu tài khoản đã kích hoạt 2FA.

### 3.4 Chính sách chống Brute-force mã 6 số & Tích hợp CAPTCHA
* Mã TOTP bị giới hạn tối đa **5 lần nhập sai**.
* **Khi nhập sai quá 5 lần**:
  * Hủy ngay lập tức phiên tạm `mfaPending`.
  * Tăng bộ đếm và khóa tạm thời tài khoản/IP trong bảng `RateLimit` (**Khóa 15 phút, trả về mã lỗi HTTP 429 Too Many Requests**).
  * Khi quay trở lại trang `/login`, form đăng nhập **bắt buộc phải kích hoạt widget Google reCAPTCHA v2** để chống script tấn công tự động tiếp diễn.

---

## 4. MÃ DỰ PHÒNG (RECOVERY CODES)

Khi người dùng mất điện thoại, hỏng máy hoặc mất app Google Authenticator, mã dự phòng là giải pháp khôi phục duy nhất:

1. **Hiển thị duy nhất một lần**:
   * Cấp 8–10 mã dự phòng ngẫu nhiên khi người dùng kích hoạt 2FA thành công.
   * Mã bản rõ chỉ hiển thị trên màn hình đúng một lần duy nhất kèm nút sao chép / tải file text.
2. **Nguyên tắc lưu trữ trong Database**:
   * **Tuyệt đối không lưu mã thô (plain text)**.
   * Server chỉ lưu bản băm **`SHA-256`** và trường **`usedAt`** (tương tự thiết kế bảng `PasswordReset` ở Block 8).
   * Mỗi mã chỉ có giá trị sử dụng **đúng 1 lần duy nhất (Single-use)**. Khi sử dụng thành công, cập nhật `usedAt = now()`.
3. **Sinh nhóm mới (Regenerate Codes)**:
   * Khi người dùng bấm tạo lại nhóm mã dự phòng mới, toàn bộ các mã cũ chưa dùng sẽ lập tức bị vô hiệu hóa hoàn toàn.
4. **Giới hạn số lần thử**:
   * Recovery code được dùng thay thế cho mã TOTP tại bước MFA, do đó chịu chung quy tắc bảo vệ: tối đa 5 lần thử sai, quá 5 lần sẽ bị hủy phiên tạm và kích hoạt RateLimit/CAPTCHA.

---

## 5. BẢNG TỔNG KẾT MÃ LỖI HTTP CHUẨN

| Tình huống thực tế | Mã HTTP Status | Hành vi hệ thống |
| :--- | :---: | :--- |
| Chưa đăng nhập truy cập route nội bộ | **`401 Unauthorized`** | Redirect `303` về `/login?next=...` (với HTML) |
| Đã đăng nhập nhưng không đủ quyền (ví dụ `viewer` vào `/admin`, `editor` gửi lệnh `DELETE`) | **`403 Forbidden`** | Render view `src/views/errors/403.ejs` hoặc trả JSON `{ error: 'FORBIDDEN' }` |
| Bản ghi cần sửa/xóa không tồn tại | **`404 Not Found`** | Render view `src/views/errors/404.ejs` |
| Nhập sai mã 2FA quá 5 lần / Đang bị khóa brute-force | **`429 Too Many Requests`** | Render view `src/views/errors/429.ejs` |
