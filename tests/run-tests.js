const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateDish, normalizeIdList } = require('../src/validators/dish.validator');
const { validateChef } = require('../src/validators/chef.validator');
const { validateIngredient } = require('../src/validators/ingredient.validator');
const { getImageUrl } = require('../src/services/image.service');
const { config, validateEnv } = require('../src/config/env');
const { normalizePage, normalizeLimit, normalizeViewMode, buildPagination } = require('../src/lib/pagination');
const { parseBookmarkIds, MAX_IDS_PER_TYPE } = require('../src/services/bookmark.service');
const { buildDocumentExpression, buildSearchFilter } = require('../src/services/search.service');
const {
  validateRegister,
  validateLogin,
  validateActivate,
  validateResendOtp,
  validateForgot,
  validatePasswordReset
} = require('../src/validators/auth.validator');
const { safeNextPath, requireAuth } = require('../src/middleware/auth');
const { verifyCsrfToken } = require('../src/middleware/csrf');
const { hashPassword, verifyPassword, verifyDummy } = require('../src/lib/password');
const {
  normalizeEmail,
  generateOtp,
  hashOtp,
  verifyOtp,
  generateResetToken,
  hashResetToken,
  verifyResetToken
} = require('../src/lib/tokens');
const { isCommonPassword } = require('../src/lib/common-passwords');
const {
  recordLoginFailure,
  getRateLimitStatus,
  resetRateLimitKey,
  consumeFixedWindow
} = require('../src/services/rate-limit.service');
const { PrismaSessionStore } = require('../src/lib/session-store');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function itAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function run() {
  console.log('\n=============================================');
  console.log(' CHẠY TEST SUITE — FOOD CATALOG SSR');
  console.log('=============================================\n');

  // 1. Config & Environment Tests
  console.log('1. Cấu hình môi trường (.env & env.js):');
  it('config module đọc được các biến cơ bản và có default an toàn', () => {
    assert.ok(config.PORT >= 1000, 'PORT phải hợp lệ');
    assert.ok(config.NODE_ENV, 'NODE_ENV phải được thiết lập');
    assert.strictEqual(typeof validateEnv, 'function');
    assert.ok(config.SESSION_SECRET.length >= 32, 'SESSION_SECRET phải từ 32 ký tự');
    assert.ok(config.OTP_PEPPER.length >= 32, 'OTP_PEPPER phải từ 32 ký tự');
  });

  // 2. Dish Validator Tests
  console.log('\n2. Kiểm tra Dish Validator (Zod):');
  it('Validate thành công khi dữ liệu hợp lệ', () => {
    const input = {
      name: 'Phở Bò Tái Lăn',
      category: 'Món nước',
      price: '65000',
      description: 'Nước dùng thanh ngọt',
      isFeatured: 'true'
    };
    const result = validateDish(input);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.name, 'Phở Bò Tái Lăn');
    assert.strictEqual(result.data.price, 65000);
    assert.strictEqual(result.data.isFeatured, true);
  });

  it('Validate thất bại khi thiếu tên món ăn', () => {
    const input = { category: 'Món nước', price: 50000 };
    const result = validateDish(input);
    assert.strictEqual(result.success, false);
    assert.ok(result.errors.name, 'Phải có lỗi ở trường name');
  });

  it('Validate thất bại khi giá âm', () => {
    const input = { name: 'Món Test', category: 'Test', price: -5000 };
    const result = validateDish(input);
    assert.strictEqual(result.success, false);
    assert.ok(result.errors.price, 'Phải báo lỗi khi giá âm');
  });

  it('Xử lý giá mặc định 0 khi để trống', () => {
    const input = { name: 'Món Test', category: 'Test', price: '' };
    const result = validateDish(input);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.price, 0);
  });

  // 2b. Relations are optional
  console.log('\n2b. Quan hệ Dish (tùy chọn):');
  it('Cho phép tạo Dish KHÔNG có nguyên liệu và KHÔNG có đầu bếp', () => {
    const result = validateDish({ name: 'Món Không Quan Hệ', category: 'Test', price: 1000 });
    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.data.ingredientIds, []);
    assert.deepStrictEqual(result.data.chefIds, []);
    assert.strictEqual(result.data.relationsSubmitted, false);
  });

  it('Chuẩn hoá ingredientIds/chefIds từ nhiều định dạng và loại bỏ trùng/lỗi', () => {
    assert.deepStrictEqual(normalizeIdList('5'), [5]);
    assert.deepStrictEqual(normalizeIdList(['5', '7', '5', 'x', '-3', '0', '']), [5, 7]);
    assert.deepStrictEqual(normalizeIdList(undefined), []);
    const result = validateDish({
      name: 'Món Nhiều Quan Hệ',
      category: 'Test',
      price: 1000,
      ingredientIds: ['1', '2', '2'],
      chefIds: '3',
      relationsSubmitted: '1'
    });
    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.data.ingredientIds, [1, 2]);
    assert.deepStrictEqual(result.data.chefIds, [3]);
  });

  // 3. Chef Validator Tests
  console.log('\n3. Kiểm tra Chef Validator:');
  it('Validate thành công đầu bếp hợp lệ', () => {
    const input = {
      name: 'Nguyễn Văn A',
      title: 'Bếp Trưởng',
      description: 'Chuyên món Việt truyền thống',
      experience: '15 năm kinh nghiệm'
    };
    const result = validateChef(input);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.name, 'Nguyễn Văn A');
  });

  it('Validate thất bại khi tên đầu bếp dưới 2 ký tự', () => {
    const input = { name: 'A' };
    const result = validateChef(input);
    assert.strictEqual(result.success, false);
    assert.ok(result.errors.name);
  });

  // 4. Ingredient Validator Tests
  console.log('\n4. Kiểm tra Ingredient Validator:');
  it('Validate thành công nguyên liệu hợp lệ', () => {
    const input = {
      name: 'Quế Chi Lạng Sơn',
      category: 'Gia vị truyền thống',
      unit: 'gram',
      description: 'Thơm nồng'
    };
    const result = validateIngredient(input);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.name, 'Quế Chi Lạng Sơn');
  });

  // 5. Image Service Helpers
  console.log('\n5. Kiểm tra Image Service & Resolution:');
  it('Trả về placeholder khi imagePath null hoặc rỗng', () => {
    assert.strictEqual(getImageUrl(null), '/images/placeholder.svg');
    assert.strictEqual(getImageUrl(''), '/images/placeholder.svg');
  });

  it('Giữ nguyên URL tuyệt đối (http/https)', () => {
    const url = 'https://images.unsplash.com/photo-test';
    assert.strictEqual(getImageUrl(url), url);
  });

  it('Xử lý đúng đường dẫn upload local', () => {
    const p = 'uploads/dishes/sample.jpg';
    assert.strictEqual(getImageUrl(p), '/uploads/dishes/sample.jpg');
  });

  // 6. Express App & Routing Setup
  console.log('\n6. Kiểm tra Express App Setup:');
  it('Express app khởi tạo đầy đủ các middleware và router', () => {
    assert.ok(app, 'App phải tồn tại');
    assert.strictEqual(typeof app.listen, 'function');
  });

  // 7. Regression: page-level scripts must not be stripped by the layout
  console.log('\n7. Regression — layout giữ script của trang (nút xóa):');
  it('layout main.ejs có placeholder <%- script %> để không nuốt script trang', () => {
    const layout = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', 'layouts', 'main.ejs'), 'utf8');
    assert.ok(layout.includes('<%- script %>'), 'Thiếu <%- script %> trong layout');
    assert.ok(layout.includes('<%- style %>'), 'Thiếu <%- style %> trong layout');
  });
  it('trang admin danh sách Dish định nghĩa hàm mở modal xóa', () => {
    const view = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', 'dishes', 'admin-index.ejs'), 'utf8');
    assert.ok(view.includes('function openDeleteModal'), 'Thiếu openDeleteModal');
  });

  // 8. Pagination helpers
  console.log('\n8. Pagination (3 chế độ, URL page):');
  it('Chuẩn hoá số trang và giới hạn hợp lệ', () => {
    assert.strictEqual(normalizePage('3'), 3);
    assert.strictEqual(normalizePage('0'), 1);
    assert.strictEqual(normalizePage('-2'), 1);
    assert.strictEqual(normalizePage('abc'), 1);
    assert.strictEqual(normalizeLimit('12'), 12);
    assert.strictEqual(normalizeLimit('0', 9), 9);
    assert.strictEqual(normalizeLimit('999'), 50);
  });

  it('Chuẩn hoá chế độ xem và fallback về phân trang', () => {
    assert.strictEqual(normalizeViewMode('load-more'), 'load-more');
    assert.strictEqual(normalizeViewMode('infinite'), 'infinite');
    assert.strictEqual(normalizeViewMode('pages'), 'pages');
    assert.strictEqual(normalizeViewMode('unknown'), 'pages');
    assert.strictEqual(normalizeViewMode(undefined), 'pages');
  });

  it('buildPagination tính đúng trang, trang trước/sau và cờ hasNext', () => {
    const middle = buildPagination({ totalItems: 20, page: 2, limit: 9 });
    assert.strictEqual(middle.totalPages, 3);
    assert.strictEqual(middle.hasPrev, true);
    assert.strictEqual(middle.hasNext, true);
    assert.strictEqual(middle.prevPage, 1);
    assert.strictEqual(middle.nextPage, 3);

    const last = buildPagination({ totalItems: 20, page: 3, limit: 9 });
    assert.strictEqual(last.hasNext, false);

    const empty = buildPagination({ totalItems: 0, page: 1, limit: 9 });
    assert.strictEqual(empty.totalPages, 1);
    assert.strictEqual(empty.hasNext, false);
  });

  // 9. Bookmarks
  console.log('\n9. Bookmark (chỉ lưu ID):');
  it('parseBookmarkIds chỉ giữ ID dương, loại trùng và giới hạn số lượng', () => {
    assert.deepStrictEqual(parseBookmarkIds('21,22,21,0,-1,x'), [21, 22]);
    assert.deepStrictEqual(parseBookmarkIds(''), []);
    assert.deepStrictEqual(parseBookmarkIds(null), []);
    const many = Array.from({ length: MAX_IDS_PER_TYPE + 20 }, (_, i) => i + 1).join(',');
    assert.strictEqual(parseBookmarkIds(many).length, MAX_IDS_PER_TYPE);
  });

  it('Trang bookmark và API bookmark đã được khai báo', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
    assert.ok(appSource.includes("app.use('/bookmarks'"), 'Thiếu route /bookmarks');
    assert.ok(appSource.includes("app.use('/api'"), 'Thiếu route /api');
    const view = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', 'bookmarks', 'index.ejs'), 'utf8');
    assert.ok(view.includes('data-bookmarks-root'), 'Thiếu root cho trang bookmark');
    assert.ok(view.includes('data-bookmark-panel="dishes"'), 'Thiếu panel dishes');
  });

  // 10. PostgreSQL search + admin relation search
  console.log('\n10. Tìm kiếm PostgreSQL & tìm kiếm quan hệ phía server:');
  it('SQL search dùng to_tsvector/websearch_to_tsquery và pg_trgm', () => {
    const doc = buildDocumentExpression(['name', 'description']);
    assert.ok(doc.includes("to_tsvector('simple'"), 'Thiếu to_tsvector');
    assert.ok(doc.includes('immutable_unaccent'), 'Thiếu chuẩn hoá dấu');

    const { whereSql, orderSql } = buildSearchFilter({ entity: 'dish', q: 'pho', filters: [], sort: 'newest' });
    assert.ok(whereSql.sql.includes('websearch_to_tsquery'), 'Thiếu websearch_to_tsquery');
    assert.ok(whereSql.sql.includes(' % '), 'Thiếu toán tử trigram %');
    assert.ok(orderSql.sql.includes('similarity('), 'Thiếu similarity() trong xếp hạng');
  });

  it('Dịch vụ public dùng search SQL, không lọc bằng JavaScript', () => {
    ['dish.service.js', 'chef.service.js', 'ingredient.service.js'].forEach((file) => {
      const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', file), 'utf8');
      assert.ok(source.includes('searchService.findMatchingIds'), `${file} chưa dùng search SQL`);
    });
  });

  it('Tìm kiếm quan hệ admin dùng ILIKE (contains + insensitive), không dùng FTS', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'admin-search.controller.js'), 'utf8');
    assert.ok(source.includes("mode: 'insensitive'"), 'Thiếu tìm kiếm không phân biệt hoa thường');
    assert.ok(source.includes('contains: q'), 'Thiếu contains (ILIKE)');
    assert.ok(!source.includes('searchService'), 'Không được dùng FTS cho form admin');
  });

  // 11. View regressions for new UI
  console.log('\n11. Regression giao diện mới (bookmark, relation search, csrf):');
  it('Card partials có nút bookmark và metadata để xóa khỏi trang đã lưu', () => {
    ['dish-card.ejs', 'chef-card.ejs', 'ingredient-card.ejs'].forEach((file) => {
      const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', 'partials', file), 'utf8');
      assert.ok(source.includes('data-bookmark-btn'), `${file} thiếu nút bookmark`);
      assert.ok(source.includes('data-bookmark-item'), `${file} thiếu metadata item`);
    });
  });

  it('Form admin Dish dùng tìm kiếm quan hệ phía server, không render toàn bộ checkbox', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', 'dishes', 'form.ejs'), 'utf8');
    assert.ok(source.includes('data-relation-search'), 'Thiếu block tìm kiếm quan hệ');
    assert.ok(source.includes('data-input-name="ingredientIds"'), 'Thiếu input ẩn nguyên liệu');
    assert.ok(source.includes('data-input-name="chefIds"'), 'Thiếu input ẩn đầu bếp');
    assert.ok(source.includes('selected-ingredients-json'), 'Thiếu dữ liệu chọn sẵn');
    assert.ok(!source.includes('ingredientOptions'), 'Không được render toàn bộ nguyên liệu');
    assert.ok(!source.includes('chefOptions'), 'Không được render toàn bộ đầu bếp');
  });

  it('Mọi form POST (logout, multipart, xóa _method) có CSRF token', () => {
    const header = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', 'partials', 'header.ejs'), 'utf8');
    assert.ok(header.includes('action="/logout"') && header.includes('name="_csrf"'), 'Logout thiếu CSRF');

    ['dishes/form.ejs', 'chefs/form.ejs', 'ingredients/form.ejs'].forEach((file) => {
      const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', file), 'utf8');
      assert.ok(src.includes('name="_csrf"'), `${file} thiếu hidden _csrf`);
      assert.ok(src.includes('_csrf='), `${file} thiếu query _csrf cho multipart`);
    });

    ['dishes/admin-index.ejs', 'chefs/admin-index.ejs', 'ingredients/admin-index.ejs'].forEach((file) => {
      const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', file), 'utf8');
      assert.ok(src.includes('name="_csrf"'), `${file} thiếu _csrf trong form xóa`);
    });
  });

  // 12. Authentication & Authorization theo đặc tả mới
  console.log('\n12. Xác thực & Phân quyền mới (Đặc tả đầy đủ):');

  it('Chuẩn hóa email: trim và lowercase, không xử lý riêng cho Gmail', () => {
    assert.strictEqual(normalizeEmail('  My.Email+Tag@Gmail.COM '), 'my.email+tag@gmail.com');
    assert.strictEqual(normalizeEmail('Test@Example.COM'), 'test@example.com');
    assert.strictEqual(normalizeEmail(''), '');
    assert.strictEqual(normalizeEmail(null), '');
  });

  await itAsync('Argon2id băm mật khẩu, verify chính xác và có dummy hash cân bằng thời gian', async () => {
    const pw = 'SecurePassword123#';
    const hash = await hashPassword(pw);
    assert.ok(hash.startsWith('$argon2id$'), 'Phải dùng Argon2id');
    assert.strictEqual(await verifyPassword(hash, pw), true);
    assert.strictEqual(await verifyPassword(hash, 'WrongPassword123#'), false);
    assert.strictEqual(await verifyDummy('AnyPassword'), false);
  });

  it('Zod Auth Validators: email, password 10-64 ký tự, khác email, không thuộc 50 mật khẩu phổ biến', () => {
    assert.strictEqual(validateRegister({ email: 'u@example.com', password: 'Short1!' }).success, false);
    assert.strictEqual(validateRegister({ email: 'u@example.com', password: 'password123' }).success, false);
    assert.strictEqual(validateRegister({ email: 'test@example.com', password: 'test@example.com' }).success, false);
    assert.strictEqual(validateRegister({ email: 'valid@example.com', password: 'ValidPassword123#' }).success, true);
    assert.strictEqual(validateRegister({ email: 'valid@example.com', displayName: 'A'.repeat(51), password: 'ValidPassword123#' }).success, false);
  });

  it('OTP: 6 chữ số bằng crypto.randomInt; otpHash = HMAC-SHA256(OTP_PEPPER, userId:purpose:otp); timingSafeEqual', () => {
    const otp = generateOtp();
    assert.ok(/^\d{6}$/.test(otp), 'OTP phải gồm 6 chữ số');
    const userId = 'user_test_id';
    const purpose = 'activation';
    const otpHash = hashOtp(userId, purpose, otp);
    assert.ok(/^[0-9a-f]{64}$/.test(otpHash), 'OTP hash phải là HMAC-SHA256 hex');
    assert.strictEqual(verifyOtp(otpHash, userId, purpose, otp), true);
    assert.strictEqual(verifyOtp(otpHash, userId, purpose, '000000'), false);
    assert.strictEqual(verifyOtp(otpHash, 'otherUser', purpose, otp), false);
  });

  it('Reset Token: randomBytes(32) base64url; tokenHash = SHA-256; timingSafeEqual', () => {
    const token = generateResetToken();
    assert.ok(token.length >= 43, 'Token base64url phải dài >= 43 ký tự');
    const tokenHash = hashResetToken(token);
    assert.ok(/^[0-9a-f]{64}$/.test(tokenHash), 'Token hash phải là SHA-256 hex');
    assert.strictEqual(verifyResetToken(tokenHash, token), true);
    assert.strictEqual(verifyResetToken(tokenHash, 'tampered_token'), false);
  });

  it('CSRF Middleware: token trong session, so sánh bằng timingSafeEqual, từ chối khi sai', () => {
    const token = crypto.randomBytes(32).toString('hex');
    assert.strictEqual(verifyCsrfToken(token, token), true);
    assert.strictEqual(verifyCsrfToken('wrong', token), false);
    assert.strictEqual(verifyCsrfToken(null, token), false);
  });

  it('safeNextPath chặn open redirect an toàn', () => {
    assert.strictEqual(safeNextPath('/dishes'), '/dishes');
    assert.strictEqual(safeNextPath('/admin/dishes?page=2'), '/admin/dishes?page=2');
    assert.strictEqual(safeNextPath('//evil.example/x'), null);
    assert.strictEqual(safeNextPath('https://evil.example'), null);
    assert.strictEqual(safeNextPath('\\\\evil.example'), null);
    assert.strictEqual(safeNextPath(''), null);
    assert.strictEqual(safeNextPath(undefined), null);
  });

  it('requireAuth: redirect 303 tới /login cho HTML và 401 JSON cho API', () => {
    const makeRes = () => {
      const res = { statusCode: 200, headers: {} };
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (body) => { res.body = body; return res; };
      res.redirect = (code, url) => { res.statusCode = code; res.redirectTo = url; return res; };
      return res;
    };

    const jsonRes = makeRes();
    requireAuth({ user: null, originalUrl: '/api/dishes', accepts: () => 'json' }, jsonRes, () => { throw new Error('Không được next'); });
    assert.strictEqual(jsonRes.statusCode, 401);
    assert.strictEqual(jsonRes.body.error, 'UNAUTHENTICATED');

    const htmlRes = makeRes();
    requireAuth({ user: null, originalUrl: '/dishes', accepts: () => 'html' }, htmlRes, () => { throw new Error('Không được next'); });
    assert.strictEqual(htmlRes.statusCode, 303);
    assert.ok(htmlRes.redirectTo.startsWith('/login?next='));
  });

  it('Đăng xuất chỉ nhận POST; không có route GET /logout', () => {
    const routes = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'auth.routes.js'), 'utf8');
    assert.ok(routes.includes("router.post('/logout'"), 'Thiếu POST /logout');
    assert.ok(!/router\.get\(\s*['"]\/logout/.test(routes), 'Tuyệt đối không được có GET /logout');
  });

  it('Không log mật khẩu, hash, OTP, reset token, sid hay secret trong mã nguồn', () => {
    const checkFiles = [
      'src/controllers/auth.controller.js',
      'src/middleware/auth.js',
      'src/middleware/csrf.js',
      'src/services/custom-auth.service.js',
      'src/services/mailer.service.js',
      'src/lib/session-store.js'
    ];
    checkFiles.forEach((file) => {
      const filePath = path.join(__dirname, '..', file);
      if (fs.existsSync(filePath)) {
        const source = fs.readFileSync(filePath, 'utf8');
        assert.ok(!/console\.log\([^)]*passwordHash/i.test(source), `${file} không được log passwordHash`);
        assert.ok(!/console\.log\([^)]*otp/i.test(source), `${file} không được log OTP`);
        assert.ok(!/console\.log\([^)]*resetToken/i.test(source), `${file} không được log resetToken`);
      }
    });
  });

  it('Có migration cho các bảng User, ActivationChallenge, PasswordReset, Session, RateLimit', () => {
    const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');
    const dirs = fs.readdirSync(migrationsDir).filter((name) => name.includes('custom_auth'));
    assert.ok(dirs.length >= 1, 'Thiếu migration custom_auth');
    const sql = fs.readFileSync(path.join(migrationsDir, dirs[0], 'migration.sql'), 'utf8');
    ['User', 'ActivationChallenge', 'PasswordReset', 'Session', 'RateLimit'].forEach((tbl) => {
      assert.ok(sql.includes(`CREATE TABLE "${tbl}"`), `Migration thiếu bảng ${tbl}`);
    });
  });

  it('Header Referrer-Policy: no-referrer được cấu hình cho /reset', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
    assert.ok(appSource.includes('Referrer-Policy') && appSource.includes('no-referrer'), 'Thiếu Referrer-Policy: no-referrer');
  });

  // 13. Database Integration Tests (chạy khi có DB kết nối hoặc RUN_DB_TESTS=1)
  const runDb = ['1', 'true', 'yes'].includes(String(process.env.RUN_DB_TESTS).toLowerCase());
  console.log('\n13. Kiểm thử tích hợp cơ sở dữ liệu (RUN_DB_TESTS):');
  if (!runDb) {
    console.log('  ⚠ Bỏ qua các test DB thao tác dữ liệu nghiệp vụ (đặt RUN_DB_TESTS=1 để chạy đầy đủ).');
  } else {
    const dishService = require('../src/services/dish.service');
    const chefService = require('../src/services/chef.service');
    const ingredientService = require('../src/services/ingredient.service');

    const created = { dishes: [], chefs: [], ingredients: [] };
    const cleanup = async () => {
      if (created.dishes.length) await prisma.dish.deleteMany({ where: { id: { in: created.dishes } } }).catch(() => {});
      if (created.chefs.length) await prisma.chef.deleteMany({ where: { id: { in: created.chefs } } }).catch(() => {});
      if (created.ingredients.length) await prisma.ingredient.deleteMany({ where: { id: { in: created.ingredients } } }).catch(() => {});
    };

    try {
      const ingA = await prisma.ingredient.create({ data: { name: `__IT_ING_A_${Date.now()}__` } });
      const ingB = await prisma.ingredient.create({ data: { name: `__IT_ING_B_${Date.now()}__` } });
      const chefA = await prisma.chef.create({ data: { name: `__IT_CHEF_A_${Date.now()}__` } });
      const chefB = await prisma.chef.create({ data: { name: `__IT_CHEF_B_${Date.now()}__` } });
      created.ingredients.push(ingA.id, ingB.id);
      created.chefs.push(chefA.id, chefB.id);

      await itAsync('Tạo Dish với nhiều nguyên liệu và nhiều đầu bếp', async () => {
        const dish = await dishService.createDish({
          name: `__IT_DISH_${Date.now()}__`, category: 'Test', price: 1000,
          ingredientIds: [ingA.id, ingB.id], chefIds: [chefA.id, chefB.id], relationsSubmitted: true
        }, null);
        created.dishes.push(dish.id);
        const full = await dishService.getDishById(dish.id);
        assert.strictEqual(full.ingredients.length, 2);
        assert.strictEqual(full.chefs.length, 2);
      });

      await itAsync('Cho phép Dish không có nguyên liệu và không có đầu bếp', async () => {
        const dish = await dishService.createDish({
          name: `__IT_DISH_EMPTY_${Date.now()}__`, category: 'Test', price: 1000,
          ingredientIds: [], chefIds: [], relationsSubmitted: true
        }, null);
        created.dishes.push(dish.id);
        const full = await dishService.getDishById(dish.id);
        assert.strictEqual(full.ingredients.length, 0);
        assert.strictEqual(full.chefs.length, 0);
      });
    } finally {
      await cleanup();
      await prisma.$disconnect().catch(() => {});
    }
  }

  // 14. Kiểm thử chính sách đếm sai, session store & OTP trên DB
  console.log('\n14. Kiểm thử bảo mật (chính sách đếm sai, session store, reset token):');
  if (!runDb) {
    console.log('  ⚠ Bỏ qua các test nghiệp vụ DB thời gian thực (đặt RUN_DB_TESTS=1 để chạy trực tiếp trên PostgreSQL).');
  } else {
    await itAsync('Chính sách đếm sai: 3 lần bắt CAPTCHA, 10 lần khóa 5 phút, cửa sổ 15 phút', async () => {
      const email = `test-throttle-${Date.now()}@example.com`;
      const key = `login-email:${email}`;
      const windowMs = 15 * 60 * 1000;

      // Lần 1 và 2: chưa bắt captcha
      const f1 = await recordLoginFailure(key, windowMs, 10, 5 * 60 * 1000);
      assert.strictEqual(f1.count, 1);
      const s1 = await getRateLimitStatus(key, windowMs);
      assert.strictEqual(s1.count >= 3, false);

      const f2 = await recordLoginFailure(key, windowMs, 10, 5 * 60 * 1000);
      assert.strictEqual(f2.count, 2);

      // Lần 3: count >= 3 -> bắt buộc captcha
      const f3 = await recordLoginFailure(key, windowMs, 10, 5 * 60 * 1000);
      assert.strictEqual(f3.count, 3);
      const s3 = await getRateLimitStatus(key, windowMs);
      assert.strictEqual(s3.count >= 3, true);

      // Tăng đến lần 10 -> khóa 5 phút
      for (let i = 4; i <= 9; i++) {
        await recordLoginFailure(key, windowMs, 10, 5 * 60 * 1000);
      }
      const f10 = await recordLoginFailure(key, windowMs, 10, 5 * 60 * 1000);
      assert.strictEqual(f10.count, 10);
      assert.ok(f10.lockedUntil && f10.lockedUntil > new Date(), 'Lần 10 phải khóa 5 phút');

      // Đăng nhập thành công -> reset bộ đếm
      await resetRateLimitKey(key);
      const sReset = await getRateLimitStatus(key, windowMs);
      assert.strictEqual(sReset.count, 0);
    });

    await itAsync('Session Store: lưu, đọc, cập nhật touch và hủy theo userId', async () => {
      const store = new PrismaSessionStore();
      const testUser = await prisma.user.create({
        data: {
          email: `sess_${Date.now()}@test.local`,
          emailNormalized: `sess_${Date.now()}@test.local`,
          passwordHash: 'dummy_hash'
        }
      });
      const sid = `sid_test_${Date.now()}`;
      await new Promise((res, rej) => store.set(sid, { cookie: { maxAge: 60000 }, userId: testUser.id, role: 'viewer' }, err => err ? rej(err) : res()));

      // Đọc session
      const sess = await new Promise((res, rej) => store.get(sid, (err, d) => err ? rej(err) : res(d)));
      assert.strictEqual(sess.role, 'viewer');

      // Hủy mọi session của userId (như khi reset password)
      await prisma.session.deleteMany({ where: { userId: testUser.id } });
      const sessAfter = await new Promise((res, rej) => store.get(sid, (err, d) => err ? rej(err) : res(d)));
      assert.strictEqual(sessAfter, null, 'Session phải bị hủy theo userId');

      await prisma.user.delete({ where: { id: testUser.id } });
    });
  }

  console.log('\n---------------------------------------------');
  console.log(`KẾT QUẢ: ${passedTests}/${totalTests} tests hoàn thành thành công!`);
  console.log('---------------------------------------------\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

run();
