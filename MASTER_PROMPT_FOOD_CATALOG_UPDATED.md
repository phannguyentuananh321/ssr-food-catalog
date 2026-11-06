# MASTER PROMPT — BUILD FOOD CATALOG SSR WEBSITE

## 0. VAI TRÒ VÀ MỤC TIÊU

Bạn là Senior Full-Stack Engineer, Software Architect, UI/UX Engineer và QA Engineer. Nhiệm vụ của bạn là trực tiếp kiểm tra repository hiện tại, thiết kế, triển khai, kiểm thử và hoàn thiện website danh mục thực phẩm bằng SSR.

Đây là nhiệm vụ IMPLEMENTATION thực tế, không phải bài tập chỉ sinh code minh họa, viết kế hoạch hoặc tạo mockup.

**Mục tiêu:** xây dựng website có giao diện hoàn chỉnh, dữ liệu lấy từ database, CRUD thực sự hoạt động, quản lý ảnh an toàn, responsive và có cấu trúc dễ bảo trì.

### Quy tắc ưu tiên tuyệt đối

1. Tuân thủ các yêu cầu trong prompt này.
2. Nếu repository có tài liệu đặc tả hoặc quy tắc dự án hiện hành, đọc và đối chiếu trước khi sửa code.
3. Tôn trọng cấu trúc và chức năng đang hoạt động của repository; không phá hỏng những phần không liên quan.
4. Ưu tiên thư viện chính thức, component có sẵn và giải pháp đã được duy trì tốt thay vì tự viết lại chức năng thư viện đã cung cấp.
5. Không tự ý đổi stack, bỏ tính năng, thu hẹp phạm vi hoặc thay database bằng dữ liệu giả.
6. Khi có điểm chưa xác định, kiểm tra code và tài liệu liên quan trước. Chọn giải pháp đơn giản, an toàn và tương thích nhất trong phạm vi yêu cầu; ghi lại giả định. Chỉ hỏi lại nếu thiếu thông tin thiết yếu khiến không thể tiếp tục an toàn.
7. Không tuyên bố tính năng hoàn thành nếu chưa triển khai và kiểm chứng.
8. Không dừng ở bước lập kế hoạch. Sau khi kiểm tra repository và xác định các thông tin cần thiết, hãy thực hiện công việc đến mức hoàn thành tối đa có thể trong môi trường được cấp.

---

## 1. QUY TRÌNH LÀM VIỆC BẮT BUỘC

### Bước 1 — Khảo sát repository

Trước khi sửa code:

- Xác định thư mục gốc, package manager, scripts và các dependency hiện có.
- Đọc `package.json`, README, cấu hình môi trường mẫu, Prisma schema, migration, routes, controllers, services, views, CSS và JavaScript liên quan.
- Kiểm tra repository đang ở trạng thái nào, những chức năng nào đã có và những chức năng nào còn thiếu.
- Kiểm tra phiên bản Node.js, Express, Prisma, Tailwind, DaisyUI và các thư viện liên quan.
- Kiểm tra dự án đang dùng Prisma phiên bản nào, cấu hình generator và cơ chế kết nối PostgreSQL hiện tại.
- Kiểm tra khả năng tương thích giữa các phiên bản thư viện trước khi cài hoặc nâng cấp.
- Không xóa hoặc ghi đè các file hiện có chỉ để khớp với cấu trúc mẫu trong prompt.

Nếu repository đã có một chức năng tương đương và hoạt động đúng, hãy tái sử dụng hoặc hoàn thiện nó thay vì tạo thêm một implementation trùng lặp.

### Bước 2 — Xác định phạm vi và kế hoạch

Tạo hoặc cập nhật tài liệu triển khai, bao gồm:

- `docs/implementation/MASTER_SPEC.md`
- `docs/implementation/PROGRESS.md`

Nếu dự án đã có tài liệu tương đương, hãy cập nhật tài liệu hiện hành thay vì tạo tài liệu trùng lặp.

Chia công việc thành các phase nhỏ, có tiêu chí nghiệm thu cụ thể. Ghi trạng thái `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED` hoặc `COMPLETE` cho từng phase.

Không đánh dấu một phase `COMPLETE` khi còn lỗi nghiêm trọng, tính năng chính chưa hoạt động hoặc kiểm thử bắt buộc chưa được thực hiện.

### Bước 3 — Triển khai tuần tự

- Hoàn thành từng phase theo thứ tự phụ thuộc.
- Ưu tiên hoàn thiện một luồng `Dish` end-to-end trước khi nhân rộng quy ước phù hợp cho `Chef` và `Ingredient`.
- Mỗi phase phải bao gồm giao diện, backend, database, validation, lỗi, bảo mật và kiểm thử tương ứng.
- Sau mỗi phase, chạy các kiểm tra phù hợp và cập nhật tiến độ.
- Không chỉ tạo file rồi bỏ trống controller, route hoặc service.
- Không tạo nút giả, route no-op, dữ liệu giả thay thế database hoặc TODO cho tính năng bắt buộc.
- Nếu gặp blocker bên ngoài khả năng truy cập, hoàn thiện phần độc lập có thể làm được, ghi rõ blocker và không giả vờ đã kiểm chứng.

### Bước 4 — Kiểm tra cuối

Chạy các lệnh lint, typecheck nếu có, test, build và các kiểm tra thực tế phù hợp với repository.

Kiểm tra cả trường hợp thành công, validation thất bại, dữ liệu không tồn tại, lỗi database, lỗi Storage và giao diện mobile.

Cuối cùng, cung cấp báo cáo về những gì đã hoàn thành, những gì đã kiểm thử, kết quả thực tế và các blocker còn lại.

---

## 2. STACK CÔNG NGHỆ BẮT BUỘC

### Backend và SSR

- Node.js
- Express
- EJS
- Prisma ORM
- PostgreSQL trên Supabase
- `method-override` cho các HTML form cần gửi PATCH và DELETE.
- `dotenv` nếu phù hợp với cấu hình môi trường hiện tại.
- Một thư viện validation phía server: ưu tiên tái sử dụng thư viện hiện có; nếu chưa có, chọn Zod hoặc express-validator, không cài cả hai chỉ để làm cùng một nhiệm vụ.

**Kiến trúc phải là SSR thực sự.**

Express nhận request, xử lý dữ liệu bằng server-side code và Prisma, sau đó render HTML bằng EJS. Trình duyệt nhận HTML đã được render.

Không chuyển dự án thành React SPA, Next.js, Vue SPA hoặc kiến trúc frontend độc lập.

Không sử dụng `localStorage`, dữ liệu JavaScript phía client hoặc JSON tĩnh làm nguồn dữ liệu chính thay thế PostgreSQL.

### Database

- PostgreSQL là nguồn dữ liệu chính.
- Prisma là lớp truy cập database.
- Schema, migration và seed phải nhất quán.
- Không sử dụng SQLite, JSON file hoặc database khác thay thế PostgreSQL.
- Không lưu dữ liệu production bằng mảng hard-code trong controller.
- Không tự ý reset hoặc xóa dữ liệu database hiện có.

### CSS và component

Sử dụng Tailwind CSS CLI + DaisyUI.

Ưu tiên Tailwind CSS 4 và DaisyUI 5 nếu tương thích với repository và môi trường cài đặt. Trước khi cài đặt, kiểm tra version, peer dependencies và hướng dẫn chính thức tương ứng.

Nếu dự án chưa có cấu hình CSS phù hợp, sử dụng bộ dependency tương thích theo hướng:

- `tailwindcss`
- `@tailwindcss/cli`
- `daisyui`

CSS đầu vào khai báo Tailwind và plugin DaisyUI theo đúng cú pháp của phiên bản được chọn. CLI build CSS thành file tĩnh, Express phục vụ file đó từ `public/`.

Không tự viết lại navbar, button, badge, table, input, select, alert, modal hoặc pagination nếu DaisyUI hay thư viện hiện có đã cung cấp giải pháp phù hợp.

Có thể tùy chỉnh theme, spacing, typography và component để đạt đúng thiết kế; không cần chấp nhận giao diện mặc định của thư viện nếu nó không phù hợp.

### Hiệu ứng nền

Sử dụng Vanta.js + Three.js cho hero của trang công khai.

- Chỉ khởi tạo hiệu ứng phía client.
- Không khởi tạo WebGL hoặc truy cập browser API trong lúc render EJS phía server.
- Kiểm tra phiên bản Vanta và Three.js tương thích.
- Có fallback bằng CSS hoặc ảnh tĩnh.
- Không bật hiệu ứng mặc định ở trang quản trị.
- Cleanup instance và event listener phù hợp.
- Hỗ trợ `prefers-reduced-motion`.
- Không để hiệu ứng che chữ, che nút hoặc cản trở thao tác.
- Không để lỗi WebGL khiến trang chính không hoạt động.

Nếu hiệu ứng thất bại, website vẫn phải sử dụng bình thường.

### Quản lý package

- Dùng package manager hiện có.
- Không nâng cấp hàng loạt dependency nếu không cần thiết.
- Không thêm thư viện chỉ vì có thể dùng; mọi dependency phải có mục đích rõ ràng.
- Không tự viết lại chức năng đã có trong thư viện được lựa chọn.
- Nếu cần thêm thư viện, kiểm tra tài liệu chính thức, khả năng tương thích và bảo trì trước khi thêm.
- Không sử dụng thư viện deprecated khi có giải pháp được duy trì tốt hơn mà tương thích với stack.

---

## 3. PHẠM VI WEBSITE

Website có ba đối tượng nghiệp vụ chính:

1. `Dish` — món ăn.
2. `Chef` — đầu bếp.
3. `Ingredient` — nguyên liệu.

Mỗi đối tượng phải có các chức năng CRUD phù hợp với phạm vi bên dưới.

### Số trang

Mục tiêu thiết kế là 15 trang chính:

- 3 đối tượng.
- Mỗi đối tượng có 5 trang chính:
  1. Trang danh sách công khai.
  2. Trang chi tiết công khai.
  3. Trang danh sách quản trị.
  4. Trang thêm mới.
  5. Trang chỉnh sửa.

Tổng cộng 3 × 5 = 15 trang chính.

Trang xác nhận xóa không tạo thành trang thứ sáu: sử dụng modal hoặc vùng xác nhận trên trang quản trị danh sách.

Các trang dùng chung như 404, lỗi hệ thống hoặc trang đăng nhập nếu cần là trang hỗ trợ, không tính vào 15 trang chính.

Tái sử dụng EJS layouts, partials và component để tránh sao chép code giao diện.

Không tạo ba hệ thống độc lập có code gần như giống nhau nếu có thể chia sẻ implementation một cách hợp lý.

---

## 4. THIẾT KẾ GIAO DIỆN ĐÃ CHỐT

### Ngôn ngữ thiết kế

Tên phong cách: **Warm Cream — Modern Food Editorial**.

Định hướng:

- Ấm áp, sạch sẽ, hiện đại, ngon mắt và đáng tin cậy.
- Hình ảnh món ăn là yếu tố thị giác chính.
- Khoảng trắng thoáng, typography có phân cấp rõ.
- Bo góc vừa phải, bóng nhẹ.
- Không dùng quá nhiều gradient, glassmorphism, neon hoặc animation.
- Không tạo cảm giác website được ghép từ những component không đồng nhất.
- Ưu tiên thư viện và design token dùng chung.

### Bảng màu đề xuất

- Warm Cream: `#FAF5EC` — nền chính.
- Ivory: `#FFFDF8` — card, form và vùng nội dung.
- Olive Green: `#354B35` — CTA, button chính và điểm nhấn.
- Terracotta: `#B86F45` — điểm nhấn phụ.
- Charcoal: `#292820` — chữ chính.
- Sand: `#E9E0D2` — viền, phân cách và nền phụ.

Định nghĩa theme dùng chung, tránh hard-code nhiều mã màu không nhất quán trong các file.

Đảm bảo tương phản và trạng thái focus dễ nhìn.

### Typography

- Tiêu đề có thể dùng serif thanh lịch hoặc display font phù hợp với phong cách ẩm thực.
- Nội dung, bảng, form và nút dùng sans-serif dễ đọc.
- Chỉ thêm font ngoài nếu có lý do rõ ràng và tải font hợp lý.
- Không dùng nhiều font không cần thiết.

---

## 5. TRANG CÔNG KHAI — OPTION 3: HERO SLIDER + MÓN NỔI BẬT

Đây là thiết kế chính cho trang công khai của cả ba đối tượng, với nội dung phù hợp từng đối tượng.

### Cấu trúc

1. Header.
2. Hero section.
3. Thanh tìm kiếm và bộ lọc.
4. Khu vực danh sách dạng card.
5. Pagination.
6. Footer.

### Header

- Logo/tên website.
- Liên kết điều hướng đến trang chủ và ba danh mục `Dish`, `Chef`, `Ingredient`.
- Có trạng thái active cho mục hiện tại.
- Responsive.
- Không tự tạo chức năng đăng nhập, giỏ hàng hoặc tài khoản nếu chưa được yêu cầu.

### Hero section

- Tiêu đề có tính nhận diện.
- Mô tả ngắn.
- Hình ảnh nổi bật.
- CTA dẫn đến danh sách.
- Vanta.js + Three.js tạo nền động nhẹ.
- Hero không chiếm quá nhiều chiều cao khiến người dùng phải cuộn lâu mới thấy danh sách.
- Nội dung quan trọng vẫn hiển thị khi JavaScript không chạy.

Có thể dùng slider để chuyển giữa các món ăn nổi bật nếu dữ liệu có sẵn. Không hard-code món ăn nổi bật trong production.

Ưu tiên thao tác chuyển slide bằng nút điều khiển rõ ràng. Nếu dùng autoplay, phải có khả năng dừng và không gây khó chịu.

Không bắt buộc có slider riêng cho trang Chef hoặc Ingredient nếu không có nội dung phù hợp. Có thể tái sử dụng cấu trúc hero nhưng thay nội dung theo đối tượng.

### Khu vực danh sách

- Nền tĩnh Warm Cream.
- Không chạy Vanta trên toàn bộ danh sách.
- Có tiêu đề danh sách.
- Có tổng số kết quả nếu truy vấn cung cấp.
- Có tìm kiếm, lọc danh mục, lọc khoảng giá và sắp xếp.
- Có trạng thái không có dữ liệu.
- Có pagination server-side.
- Dữ liệu phải được lấy từ PostgreSQL bằng Prisma.

Không bắt buộc áp dụng bộ lọc giá cho Chef hoặc Ingredient nếu chúng không có trường giá. Thiết kế bộ lọc theo ý nghĩa nghiệp vụ và schema thật.

---

## 6. CARD MÓN ĂN

### Tỉ lệ ảnh

Bắt buộc sử dụng ảnh ngang tỷ lệ 4:3 cho card món ăn.

- Ảnh đồng nhất kích thước hiển thị.
- Dùng `object-fit: cover` phù hợp.
- Không kéo giãn ảnh.
- Có placeholder nếu không có ảnh hoặc ảnh tải lỗi.
- Có alt text phù hợp.
- Không để một ảnh lỗi phá vỡ bố cục lưới.

### Thứ tự nội dung card

1. Ảnh.
2. Danh mục nếu có.
3. Tên món.
4. Giá.
5. Mô tả ngắn.
6. Nút “Xem chi tiết”.

Quy tắc:

- Tên món tối đa khoảng hai dòng trên card.
- Giá nổi bật bằng màu Olive Green.
- Mô tả giới hạn độ dài để card đồng đều.
- Card có padding, border, radius và shadow nhất quán.
- Hover chỉ dùng hiệu ứng nhẹ.
- Không phóng ảnh quá mức.
- Không tự thêm rating, lượt bán, badge khuyến mãi hoặc trạng thái tồn kho nếu chưa có dữ liệu và yêu cầu.
- Card lấy toàn bộ thông tin từ dữ liệu server.
- CTA phải dẫn đến route chi tiết thật.

### Responsive grid

- Mobile nhỏ: 1–2 cột tùy độ rộng thực tế.
- Mobile thông thường: 2 cột khi đủ không gian.
- Tablet: 2–3 cột.
- Desktop: mặc định 3 cột.
- Màn hình rộng: tối đa 4 cột nếu ảnh vẫn đủ lớn.

Ưu tiên khả năng đọc và kích thước ảnh hơn việc cố hiển thị nhiều card.

---

## 7. TÌM KIẾM, LỌC VÀ SẮP XẾP

Các chức năng chính trên danh sách món ăn:

### Search

- Tìm theo tên món.
- Thực hiện ở server.
- Dùng truy vấn Prisma phù hợp.
- Không tải toàn bộ database xuống client để lọc.
- Không ghép SQL trực tiếp từ input người dùng.

### Category filter

- Lọc theo danh mục có trong schema thật.
- Cho phép chọn tất cả danh mục.
- Kết hợp được với tìm kiếm, khoảng giá và sắp xếp.
- Không giả định category đã tồn tại trước khi kiểm tra schema.
- Nếu cần bổ sung category, thiết kế model hoặc field rõ ràng và tạo migration phù hợp.

### Price filter

- Giá tối thiểu và tối đa.
- Validate input ở server.
- Không chấp nhận giá âm.
- Kiểm tra trường hợp giá tối thiểu lớn hơn giá tối đa.
- Lọc trên database.
- Không áp dụng bộ lọc giá cho đối tượng không có trường giá.

### Sort

Đối với Dish, hỗ trợ:

- Tên A–Z.
- Giá tăng dần.
- Giá giảm dần.
- Mới nhất nếu có trường thời gian phù hợp như `createdAt`.

Giá trị sort đến từ danh sách cho phép. Không đưa tên cột tùy ý từ người dùng vào truy vấn.

### Query string

Dùng URL thể hiện trạng thái bộ lọc, ví dụ:

`/dishes?q=pho&category=mon-nuoc&minPrice=30000&maxPrice=100000&sort=price-asc&page=1`

Đây là ví dụ định hướng; tên query parameter phải nhất quán với implementation.

- Giữ bộ lọc khi chuyển trang.
- Thay đổi bộ lọc đưa về trang đầu.
- URL có thể được bookmark và tải lại.
- Không dùng GET để thay đổi dữ liệu.

### Pagination

- Thực hiện ở server bằng Prisma.
- Không lấy toàn bộ bản ghi chỉ để phân trang trong trình duyệt.
- Có nút trước/sau và số trang khi phù hợp.
- Không cho page hoặc page size bất hợp lệ gây truy vấn không an toàn.
- Giữ search/filter/sort khi chuyển trang.

---

## 8. TRANG CHI TIẾT

### Dish

Hiển thị các field thực sự có trong database, dự kiến:

- Ảnh chính.
- Tên món.
- Danh mục.
- Giá.
- Mô tả.
- Thông tin liên quan nếu schema có.

### Chef

Hiển thị dữ liệu thực tế của đầu bếp, ví dụ tên, ảnh đại diện nếu có, mô tả và kinh nghiệm nếu schema có.

### Ingredient

Hiển thị dữ liệu thực tế của nguyên liệu, ví dụ tên, ảnh nếu có, mô tả, đơn vị nếu schema có.

Các field trên là định hướng thiết kế. Trước khi triển khai, phải kiểm tra schema hiện có và thống nhất schema cuối cùng; không tự tạo dữ liệu production giả để lấp nội dung.

### Trạng thái

- ID không hợp lệ hoặc không tìm thấy: 404 phù hợp.
- Không để server crash.
- Ảnh lỗi: placeholder.
- Nội dung dài phải wrap đúng.
- Mobile: ảnh lên trước, thông tin xuống dưới.
- Có điều hướng quay lại danh sách.
- Không tự thêm giỏ hàng, đặt món, đánh giá hoặc tính năng thanh toán nếu chưa có trong phạm vi.

---

## 9. TRANG QUẢN TRỊ — OPTION 2: DATA TABLE

Giao diện quản trị ưu tiên hiệu suất thao tác và khả năng đọc dữ liệu.

### Bố cục

- Header quản trị.
- Tiêu đề trang và mô tả ngắn.
- Nút thêm mới.
- Thanh tìm kiếm.
- Bộ lọc phù hợp đối tượng.
- Bảng dữ liệu.
- Pagination.
- Thông báo thành công/lỗi.

### Bảng Dish

Các cột dự kiến:

1. Thumbnail ảnh 4:3.
2. Tên món và ID.
3. Danh mục.
4. Giá.
5. Thời gian tạo/cập nhật nếu có.
6. Thao tác: sửa, xóa.

### Bảng Chef và Ingredient

Dùng bảng nhất quán, nhưng chỉ hiển thị cột phù hợp schema.

### Thao tác

- Thêm: mở trang tạo mới.
- Sửa: mở form đã điền dữ liệu hiện tại.
- Xóa: mở modal xác nhận.
- Modal chỉ hiển thị xác nhận, không xóa dữ liệu.
- Xóa thật bằng DELETE qua method-override.
- Có thông báo thành công hoặc thất bại.
- Có trạng thái loading khi thực sự cần.
- Không tạo nút chỉ để trang trí.
- Trên mobile, bảng có thể scroll ngang hoặc chuyển thành layout phù hợp; không làm mất các thao tác quan trọng.

### Form thêm/sửa

- Label rõ ràng.
- Required field được thể hiện đúng.
- Lỗi xuất hiện gần trường tương ứng.
- Giữ lại dữ liệu đã nhập khi validation thất bại.
- Có trạng thái gửi form và ngăn submit lặp không cần thiết.
- Có nút lưu và quay lại.
- Upload ảnh có preview nếu phù hợp.
- Cho phép giữ ảnh hiện tại khi không chọn ảnh mới.
- Không yêu cầu người dùng tự nhập URL ảnh nếu quy trình upload file đã được chọn.

---

## 10. QUẢN LÝ ẢNH — SUPABASE STORAGE

### Quyết định kiến trúc

- Ảnh món ăn lưu trong Supabase Storage.
- PostgreSQL lưu `imagePath` hoặc URL tham chiếu đến ảnh.
- Không lưu nội dung ảnh dạng binary trực tiếp trong PostgreSQL.
- Không lưu ảnh thành base64 trong database.
- Không lưu file ảnh upload vào thư mục public của ứng dụng như nơi lưu trữ production lâu dài.
- Ưu tiên lưu `imagePath` làm đường dẫn tương đối trong bucket nếu phù hợp với cách phục vụ ảnh.

Tên bucket dự kiến: `dish-images`.

### Upload

Sử dụng `@supabase/supabase-js` nếu tương thích với project và API hiện hành.

Sử dụng middleware upload phù hợp, ưu tiên Multer nếu chưa có giải pháp tương đương.

Form upload phải dùng `multipart/form-data`.

Luồng tạo Dish:

1. Validate dữ liệu text và file.
2. Kiểm tra định dạng và kích thước ảnh.
3. Sinh tên file an toàn, duy nhất.
4. Upload lên Supabase Storage.
5. Lưu đường dẫn ảnh và thông tin Dish vào PostgreSQL qua Prisma.
6. Redirect sau khi thành công.
7. Xử lý và dọn file vừa upload nếu bước database thất bại và việc dọn file là an toàn.

### Sửa ảnh

- Nếu không chọn ảnh mới, giữ nguyên ảnh hiện tại.
- Nếu chọn ảnh mới, upload ảnh mới và cập nhật đường dẫn.
- Chỉ xóa ảnh cũ sau khi đã xác nhận việc cập nhật database thành công.
- Có xử lý khi upload thành công nhưng database thất bại.
- Không để lỗi Storage làm hỏng dữ liệu món ăn mà không có cách khôi phục hoặc thông báo rõ.

### Xóa món ăn

- Hiển thị xác nhận trước.
- Không xóa qua GET.
- Xử lý quan hệ database nếu có.
- Xóa hoặc lên lịch dọn ảnh liên quan theo chính sách đã chọn.
- Database và Storage không nằm trong cùng transaction; phải xử lý partial failure.
- Nếu database đã xóa nhưng Storage lỗi, ghi nhận lỗi và có cơ chế retry/dọn file mồ côi.
- Không xóa ảnh nếu không xác định chắc chắn ảnh thuộc đối tượng được phép xóa.
- Không để xóa một món làm ảnh dùng chung bởi bản ghi khác biến mất ngoài ý muốn.

### Public/private bucket

Ảnh món ăn được phép công khai có thể sử dụng public bucket.

Nếu dùng public bucket:

- Hiểu rằng URL có thể được truy cập bởi người có URL.
- Không lưu ảnh nhạy cảm trong bucket này.
- Không xem public URL là cơ chế phân quyền.

Nếu bucket private, thiết kế URL truy cập có chữ ký hoặc cơ chế phục vụ ảnh phù hợp.

### Bảo mật

- Không đưa service-role key vào EJS, HTML, JavaScript client hoặc Git.
- Chỉ thao tác upload/xóa từ server có kiểm soát.
- Kiểm tra file size.
- Allowlist định dạng ảnh.
- Không chỉ dựa vào phần mở rộng file hoặc Content-Type từ client.
- Sinh tên file ở server.
- Không cho client tự gửi đường dẫn tùy ý để xóa file.
- Cấu hình bucket policy và quyền truy cập phù hợp.
- Có `.env.example` chỉ chứa tên biến và placeholder không bí mật.

Không giả định Storage đã sẵn sàng chỉ vì PostgreSQL đã kết nối. Cần xác minh bucket và quyền truy cập trong môi trường thực tế.

Nếu thiếu credentials hoặc không thể truy cập Supabase, hãy hoàn thiện implementation, kiểm thử phần độc lập và báo rõ bước cần người dùng cấu hình. Không giả vờ upload thật đã thành công.

---

## 11. HTTP METHOD VÀ PRG — BẮT BUỘC

Nguyên tắc:

**GET chỉ đọc, tuyệt đối không thay đổi dữ liệu.**

### Các route dự kiến

- `GET /dishes` — danh sách.
- `GET /dishes/:id` — chi tiết.
- `GET /admin/dishes` — danh sách quản trị.
- `GET /admin/dishes/new` — form thêm.
- `POST /admin/dishes` — tạo mới.
- `GET /admin/dishes/:id/edit` — form sửa.
- `PATCH /admin/dishes/:id` — cập nhật.
- `GET /admin/dishes/:id/delete-confirmation` hoặc modal trên danh sách — chỉ xác nhận.
- `DELETE /admin/dishes/:id` — xóa.

Điều chỉnh URL nếu cần để nhất quán với cấu trúc hiện có, nhưng phải giữ nguyên ngữ nghĩa HTTP.

Áp dụng quy ước tương tự cho Chef và Ingredient.

### method-override

- Dùng `method-override` cho form POST biểu diễn PATCH/DELETE.
- Đăng ký middleware đúng thứ tự, trước router.
- Không yêu cầu AJAX để thực hiện CRUD.
- Form HTML truyền thống phải hoạt động.

### PRG

Sau khi POST/PATCH/DELETE thành công:

- Redirect về trang phù hợp bằng HTTP `303 See Other`.
- Không render lại trang kết quả ghi theo cách khiến refresh gửi lại POST.
- Dùng flash message/session chỉ nếu có cấu hình phù hợp; không tự thêm session dependency nếu chưa cần. Có thể dùng query status có kiểm soát hoặc cơ chế hiện có.
- PRG không thay thế validation, authorization hoặc database constraint.

### Validation và lỗi

- Validate ở server.
- Không tin dữ liệu từ client.
- ID phải hợp lệ.
- Xử lý duplicate, missing fields, giá không hợp lệ, file lỗi và record không tồn tại.
- Không gửi stack trace cho người dùng.
- Không che giấu lỗi bằng cách trả thành công giả.

---

## 12. XÁC THỰC VÀ PHÂN QUYỀN QUẢN TRỊ

Kiểm tra repository và yêu cầu dự án hiện hành trước khi quyết định cơ chế xác thực.

Nếu đã có authentication/authorization, tái sử dụng và hoàn thiện nó.

Nếu chưa có, không để các route quản trị có khả năng thay đổi dữ liệu được truy cập công khai trong production.

Không tự ý triển khai một hệ thống đăng nhập sơ sài hoặc lưu password không an toàn chỉ để đánh dấu tính năng admin hoàn thành.

Nếu thiếu thông tin cần thiết về cách đăng nhập hoặc tạo tài khoản admin, có thể:

- Hoàn thiện phần UI và CRUD độc lập.
- Chuẩn bị middleware phân quyền theo kiến trúc rõ ràng.
- Không công khai quyền ghi dữ liệu trong môi trường production.
- Ghi cụ thể blocker và quyết định cần người dùng xác nhận.

Mọi kiểm tra quyền phải thực hiện ở server, không chỉ ẩn nút trên giao diện.

---

## 13. CẤU TRÚC DỰ ÁN MỤC TIÊU

Tái sử dụng cấu trúc hiện tại nếu đã hợp lý. Nếu bắt đầu từ repository trống, ưu tiên cấu trúc:

food-catalog-ssr/
- prisma/
  - schema.prisma
  - migrations/
  - seed.js
- src/
  - app.js
  - routes/
    - dish.routes.js
    - chef.routes.js
    - ingredient.routes.js
  - controllers/
    - dish.controller.js
    - chef.controller.js
    - ingredient.controller.js
  - services/
    - dish.service.js
    - image.service.js
  - validators/
  - middleware/
    - validate.js
    - upload.js
    - error-handler.js
    - authorization.js nếu cần
  - lib/
    - prisma.js
    - supabase.js
  - views/
    - layouts/
      - main.ejs
    - partials/
      - header.ejs
      - footer.ejs
      - alerts.ejs
    - dishes/
    - chefs/
    - ingredients/
    - admin/
    - errors/
- public/
  - css/
    - input.css
    - output.css
  - js/
    - vanta-background.js
  - images/
    - fallback-background.jpg
- docs/
  - implementation/
    - MASTER_SPEC.md
    - PROGRESS.md
- .env
- .env.example
- .gitignore
- package.json
- README.md

Không bắt buộc phải tạo toàn bộ file ngay từ đầu. Chỉ tạo file thực sự cần thiết.

### Phân tách trách nhiệm

- Routes: khai báo URL, method và middleware.
- Controllers: điều phối request, response, render và redirect.
- Services: nghiệp vụ cần tái sử dụng và tích hợp bên ngoài.
- Validators: kiểm tra dữ liệu đầu vào.
- Middleware: upload, authorization và error handling.
- Lib: khởi tạo Prisma/Supabase client.
- Views: EJS templates và partials.
- Prisma: schema, migration và seed.
- Public: CSS đã build, JS client và ảnh tĩnh.

Không lạm dụng abstraction cho những chức năng quá nhỏ; đồng thời không nhồi toàn bộ logic vào một file `app.js`.

---

## 14. DATABASE VÀ DATA MODEL

Trước khi thiết kế schema, kiểm tra database và schema hiện tại.

Các model cốt lõi cần có hoặc được ánh xạ hợp lý:

### Dish

Dữ liệu dự kiến:

- `id`
- `name`
- `description`
- `price`
- `imagePath`
- `createdAt`
- `updatedAt`

Danh mục cần được định nghĩa rõ dưới dạng field hoặc model quan hệ nếu cần.

### Chef

Dữ liệu dự kiến:

- `id`
- `name`
- `description`
- `experience` nếu phạm vi nghiệp vụ yêu cầu
- `imagePath` nếu đầu bếp có ảnh
- `createdAt`
- `updatedAt`

### Ingredient

Dữ liệu dự kiến:

- `id`
- `name`
- `description`
- `unit` nếu nghiệp vụ yêu cầu
- `imagePath` nếu nguyên liệu có ảnh
- `createdAt`
- `updatedAt`

Các field trên là đề xuất ban đầu, không phải lý do để phá schema đang hoạt động.

### Quy tắc

- Không thêm quan hệ Dish–Chef–Ingredient nếu chưa xác định nhu cầu nghiệp vụ.
- Nếu cần quan hệ, thiết kế foreign key và constraint rõ ràng.
- Dùng kiểu dữ liệu giá tiền phù hợp; tránh floating-point không cần thiết cho tiền.
- Không cho phép giá trị âm nếu nghiệp vụ không hỗ trợ.
- Có unique constraint cho những field thật sự cần duy nhất.
- Dùng migration có kiểm soát.
- Không reset database production.
- Seed chỉ dùng cho dữ liệu phát triển/demo có chủ đích.
- Không tự ý tạo dữ liệu mẫu giả trong môi trường production.

---

## 15. VANTA.JS + THREE.JS — QUY TẮC CLIENT-SIDE

Tích hợp Vanta vào hero trang công khai bằng cách sử dụng thư viện, không tự viết lại particle/WebGL engine.

- Kiểm tra tài liệu và API đúng với version được cài.
- Khởi tạo sau khi DOM có phần tử đích.
- Không khởi tạo trong module được thực thi lúc SSR.
- Chỉ load code hiệu ứng ở những trang cần dùng.
- Có CSS fallback độc lập.
- Có cleanup khi component/hiệu ứng không còn sử dụng.
- Kiểm tra lỗi tải thư viện và lỗi WebGL.
- Tôn trọng reduced motion.
- Không bật ở admin mặc định.
- Không để animation cản trở nội dung chính.
- Nếu Vanta không hoạt động, hero vẫn có hình ảnh, nội dung và CTA đầy đủ.

---

## 15A. QUẢN LÝ TOÀN BỘ BIẾN MÔI TRƯỜNG TRONG MỘT FILE `.env`

**Quy tắc bắt buộc:** mọi thông tin cấu hình môi trường, API key, credential, URL dịch vụ, cổng chạy và secret mà ứng dụng cần phải được tập trung trong duy nhất file `.env` ở thư mục gốc. Không hard-code các giá trị này trong source code, EJS, CSS, JavaScript phía client, migration, seed hoặc script chạy ứng dụng.

### Quy tắc bảo mật và nguồn cấu hình

1. Tạo và đọc `.env` từ thư mục gốc bằng `dotenv` (hoặc cơ chế tương đương đã có trong project) trước khi khởi tạo Prisma, Supabase client hoặc đọc biến môi trường ở bất kỳ module nào.
2. `.env` là nguồn cấu hình cục bộ duy nhất do người phát triển quản lý. Không tạo thêm các file chứa secret như `.env.local`, `.env.production`, `.env.development` hoặc file key riêng, trừ khi nền tảng triển khai bắt buộc dùng cơ chế quản lý secret riêng; nếu vậy phải ghi rõ ngoại lệ và không sao chép secret vào repository.
3. Tạo `.env.example` chỉ liệt kê tên biến và giá trị placeholder không bí mật. Không sao chép giá trị thật từ `.env` vào `.env.example`.
4. Đảm bảo `.env`, file backup của `.env` và mọi file chứa credential đều nằm trong `.gitignore`. Kiểm tra `git status` và lịch sử thay đổi trước khi kết thúc để tránh commit secret.
5. Không yêu cầu người dùng gửi secret lên chat, log hoặc báo cáo. Không in giá trị secret ra terminal, log, error response hoặc báo cáo cuối.
6. Không bao giờ đưa Supabase service-role key, database password hoặc secret khác vào EJS/HTML, biến `PUBLIC_*`, JavaScript phía client hay bất kỳ bundle/file nào được phục vụ công khai.
7. Nếu secret đã bị commit hoặc lộ, không chỉ xóa khỏi code; phải hướng dẫn thu hồi/rotate key bị lộ và kiểm tra lịch sử Git.
8. Tạo module cấu hình tập trung (ví dụ `src/config/env.js`) để kiểm tra biến bắt buộc ngay khi khởi động. Báo tên biến còn thiếu nhưng không in giá trị secret. Dừng khởi động với thông báo dễ hiểu nếu cấu hình bắt buộc không hợp lệ.
9. Không đặt API key nếu dự án không sử dụng dịch vụ tương ứng. Không bịa key, URL hoặc credential. Các biến tùy chọn phải có mặc định an toàn được ghi rõ.
10. Các secret trên môi trường hosting phải được nhập qua secret/environment settings của nhà cung cấp; không commit `.env` lên Git để triển khai. Điều này là ngoại lệ triển khai cần thiết, không phải lý do tạo thêm file secret trong repository.

### Danh sách biến môi trường dự kiến

Điều chỉnh theo thư viện và phiên bản thực tế; chỉ giữ biến thực sự được sử dụng.

```dotenv
# App
NODE_ENV=development
PORT=3000
APP_BASE_URL=http://localhost:3000

# PostgreSQL / Prisma — thay bằng connection string lấy từ Supabase Dashboard
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
# Chỉ khai báo nếu Prisma version / cách triển khai thực sự cần URL direct riêng:
DIRECT_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require

# Supabase project — server-side only
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_SIDE_SECRET_KEY
SUPABASE_STORAGE_BUCKET=dish-images

# Admin authentication — chỉ giữ nếu cơ chế xác thực đã chọn cần chúng
SESSION_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
# Ví dụ OAuth nếu dự án thực sự triển khai OAuth; không tạo nếu không dùng:
# GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
# GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
```

Đây là mẫu tên biến, không phải credential dùng được. `DATABASE_URL` và `DIRECT_URL` phải theo đúng cấu hình Prisma, Supabase connection method và môi trường triển khai. Không mặc định bắt buộc cả hai nếu phiên bản Prisma/cấu hình hiện tại không cần. Dùng pooler URL cho runtime khi phù hợp và direct connection URL cho migration khi hướng dẫn chính thức của cấu hình đang dùng yêu cầu.

### Cách sử dụng trong code

- Tất cả module phải lấy cấu hình từ một module config đã validate hoặc từ `process.env` sau khi `.env` được nạp đúng thứ tự.
- Khởi tạo Prisma từ `DATABASE_URL` theo cách được hỗ trợ bởi phiên bản Prisma hiện tại.
- Khởi tạo Supabase client phía server từ `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` chỉ khi cần thao tác đặc quyền; không expose client/key đó cho browser.
- Dùng `SUPABASE_STORAGE_BUCKET` thay vì hard-code tên bucket ở nhiều nơi.
- Dùng `PORT`, `NODE_ENV` và `APP_BASE_URL` thay vì hard-code cấu hình runtime.
- Không để `dotenv` tự ghi đè biến môi trường đã được nền tảng triển khai cung cấp nếu điều đó gây hành vi ngoài dự kiến; kiểm tra hành vi mặc định và cấu hình có chủ đích.
- Không đặt secret vào `package.json` scripts hoặc command line nếu có thể truyền an toàn qua environment.
- Nếu cần tạo secret ngẫu nhiên, hướng dẫn người dùng sinh bằng công cụ phù hợp; không tự bịa một giá trị dùng cho production.

### Kiểm tra nghiệm thu riêng cho `.env`

- [ ] Có một `.env` tại thư mục gốc để người phát triển cấu hình tất cả biến môi trường cần thiết.
- [ ] Có `.env.example` chỉ chứa placeholder, không có secret thật.
- [ ] `.gitignore` loại trừ `.env` và các bản backup/secret tương ứng.
- [ ] Ứng dụng báo rõ biến bắt buộc nào bị thiếu mà không lộ giá trị.
- [ ] Không hard-code credential hoặc URL môi trường trong source code.
- [ ] Không có secret trong HTML, EJS render output, JavaScript client, CSS, log hoặc Git.
- [ ] README liệt kê từng biến, mục đích, bắt buộc/tùy chọn và cách lấy giá trị từ dashboard chính thức.
- [ ] Kiểm tra bằng tìm kiếm source và `git status`/diff; không in nội dung `.env` trong báo cáo.
- [ ] Nếu thiếu credentials thật, tiếp tục hoàn thiện phần không phụ thuộc dịch vụ và báo blocker; tuyệt đối không tuyên bố kết nối thành công.

---

## 16. BẢO MẬT

Các yêu cầu tối thiểu:

1. `.env` không được commit.
2. Không đưa secret vào frontend.
3. Không ghép SQL từ input.
4. Dùng Prisma theo cách an toàn.
5. Validate input phía server.
6. Escape nội dung người dùng khi render EJS; không sử dụng raw output với dữ liệu chưa được kiểm soát.
7. Có 404 và error handler.
8. Có authorization cho thao tác admin.
9. Có giới hạn kích thước file upload.
10. Allowlist loại ảnh.
11. Tên file không được tin từ client.
12. Không xóa file Storage theo đường dẫn tùy ý do người dùng gửi.
13. GET không làm thay đổi dữ liệu.
14. Không hiển thị stack trace hoặc secret trong response production.
15. Cấu hình bảo mật phù hợp với môi trường production.
16. Không thêm CORS mở rộng, middleware hoặc dependency bảo mật không cần thiết.
17. Kiểm tra CSRF phù hợp với mô hình xác thực và session thực tế nếu sử dụng cookie/session cho admin.
18. Không tuyên bố an toàn tuyệt đối khi chưa thực hiện kiểm thử.

---

## 17. KIỂM THỬ BẮT BUỘC

### CRUD

- Tạo thành công.
- Đọc danh sách và chi tiết.
- Sửa thành công.
- Xóa thành công.
- Xác nhận xóa không thay đổi dữ liệu trước khi gửi yêu cầu xóa thật.
- ID không tồn tại.
- ID sai định dạng.
- Dữ liệu bắt buộc bị thiếu.
- Dữ liệu không hợp lệ.
- Duplicate theo constraint nếu có.
- Refresh sau redirect không tạo bản ghi trùng.
- Dữ liệu tồn tại sau khi restart server.

### Search/filter/sort

- Search có kết quả.
- Search không có kết quả.
- Kết hợp search + category + price + sort.
- Giá âm.
- Giá min > max.
- Sort value không hợp lệ.
- Page không hợp lệ.
- Giữ filter khi chuyển trang.
- Không có SQL injection thông qua query parameters.

### Image upload

- Upload ảnh hợp lệ.
- Không chọn ảnh.
- File quá lớn.
- File giả định dạng ảnh.
- File type không được hỗ trợ.
- Upload Storage thất bại.
- Database thất bại sau upload.
- Thay ảnh.
- Không chọn ảnh mới khi sửa.
- Xóa món và dọn ảnh.
- Storage lỗi sau khi database đã thay đổi.
- URL/đường dẫn ảnh không hợp lệ.
- Không lộ service-role key.

### UI/UX

- Desktop, tablet, mobile.
- Hero fallback.
- Vanta lỗi không làm trang crash.
- Ảnh lỗi có placeholder.
- Form giữ lại dữ liệu sau validation thất bại.
- Empty state.
- 404.
- Button và form hoạt động thật.
- Không có lỗi console nghiêm trọng.
- Không có horizontal overflow không mong muốn.
- Kiểm tra focus, keyboard navigation và reduced motion.

### Chạy kiểm tra

Dùng scripts hiện có trước. Nếu còn thiếu, bổ sung scripts hợp lý trong `package.json`.

Không báo “all tests passed” nếu chưa thực sự chạy. Ghi rõ kiểm tra nào chưa thể chạy do thiếu database, credentials, network hoặc dịch vụ bên ngoài.

---

## 18. TỐI ƯU VÀ CHẤT LƯỢNG CODE

Ưu tiên:

- Tái sử dụng thư viện đã có.
- Dùng DaisyUI thay vì tự xây lại component phổ biến.
- Dùng Prisma thay vì viết SQL thủ công khi Prisma đáp ứng tốt.
- Dùng Supabase Storage API thay vì tự xây hệ thống lưu file.
- Dùng Vanta.js thay vì tự viết WebGL background.
- Dùng middleware upload phù hợp thay vì tự viết parser multipart.
- Dùng thư viện validation đã chọn thay vì tạo framework validation riêng.
- Dùng EJS layouts/partials để tránh copy-paste giao diện.
- Dùng query và pagination phía database.
- Giữ dependency ở mức tối thiểu hợp lý.
- Không tạo kiến trúc quá phức tạp cho một website CRUD.

Không được hiểu “tái sử dụng thư viện” là cài dependency cho mọi thứ. Nếu HTML, CSS hoặc Express đã xử lý tốt chức năng đơn giản, hãy dùng giải pháp gốc.

Không tự viết lại tính năng thư viện đã tồn tại chỉ vì muốn kiểm soát nhiều hơn.

Không thêm animation không có trong đặc tả.

Không thêm chức năng ngoài phạm vi nếu nó làm tăng độ phức tạp hoặc rủi ro.

---

## 19. ĐIỀU KIỆN NGHIỆM THU CUỐI

Chỉ coi dự án hoàn thành khi đáp ứng được các mục sau hoặc báo cáo rõ mục nào đang bị blocker:

- [ ] Đã khảo sát repository trước khi sửa.
- [ ] Stack chính vẫn là Express + EJS + Prisma + PostgreSQL/Supabase.
- [ ] SSR hoạt động thực sự.
- [ ] Có đủ trang chính theo phạm vi 3 × 5.
- [ ] CRUD hoạt động với dữ liệu PostgreSQL.
- [ ] GET chỉ đọc dữ liệu.
- [ ] PRG và method-override hoạt động đúng.
- [ ] Search, category, price và sort hoạt động phía server cho Dish.
- [ ] Pagination giữ trạng thái bộ lọc.
- [ ] Ảnh được upload lên Supabase Storage.
- [ ] PostgreSQL lưu imagePath/URL đúng.
- [ ] Có xử lý lỗi và partial failure giữa Storage và database.
- [ ] Giao diện Warm Cream được triển khai nhất quán.
- [ ] Trang công khai dùng Option 3.
- [ ] Trang quản trị dùng Option 2.
- [ ] Ảnh card món ăn có tỷ lệ 4:3.
- [ ] Vanta chỉ chạy nhẹ ở hero công khai và có fallback.
- [ ] Tailwind CLI + DaisyUI build CSS thành công.
- [ ] Responsive ở mobile, tablet và desktop.
- [ ] Không còn nút giả hoặc TODO cho tính năng bắt buộc.
- [ ] Các test có thể chạy đã được thực hiện.
- [ ] Secrets không bị commit hoặc đưa vào frontend.
- [ ] README hướng dẫn cài đặt, cấu hình môi trường, migration, seed và chạy dự án.
- [ ] PROGRESS.md phản ánh đúng trạng thái thực tế.

---

## 20. BÁO CÁO CUỐI CÙNG

Sau khi triển khai, cung cấp báo cáo ngắn gọn nhưng đầy đủ:

1. Tóm tắt kiến trúc cuối cùng.
2. Những tính năng đã triển khai.
3. Những file hoặc khu vực chính đã thay đổi.
4. Dependency mới được thêm và lý do.
5. Migration/schema đã thay đổi.
6. Cách cấu hình PostgreSQL/Supabase và Storage.
7. Các lệnh cài đặt, migrate, seed, build CSS, chạy dev và test.
8. Kết quả kiểm thử thực tế.
9. Những vấn đề còn tồn tại.
10. Những bước cần người dùng thực hiện thủ công, chẳng hạn cung cấp credentials hoặc cấu hình bucket.
11. Trạng thái từng phase trong `PROGRESS.md`.

Không chỉ đưa ra code snippet rồi kết thúc. Hãy thực sự sửa repository trong phạm vi công cụ và quyền truy cập được cấp.

Không tự nhận đã kết nối database, upload ảnh, build hoặc test nếu chưa thực hiện thành công.

**BẮT ĐẦU NGAY:** khảo sát repository hiện tại, đọc các tài liệu liên quan, lập kế hoạch theo phase và triển khai tuần tự theo toàn bộ đặc tả trên. Không viết lại đặc tả thành một câu trả lời lý thuyết thay cho việc thực hiện công việc.
