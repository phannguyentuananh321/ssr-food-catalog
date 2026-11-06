const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateDish, normalizeIdList } = require('../src/validators/dish.validator');
const { validateChef } = require('../src/validators/chef.validator');
const { validateIngredient } = require('../src/validators/ingredient.validator');
const { getImageUrl } = require('../src/services/image.service');
const { config, validateEnv } = require('../src/config/env');
const { normalizePage, normalizeLimit, normalizeViewMode, buildPagination } = require('../src/lib/pagination');
const { parseBookmarkIds, MAX_IDS_PER_TYPE } = require('../src/services/bookmark.service');
const { buildDocumentExpression, buildSearchFilter } = require('../src/services/search.service');
const { validateRegister, validateLogin, validatePasswordReset, validateOtp } = require('../src/validators/auth.validator');
const { isAdminUser, isEmailVerified, safeNextPath, requireAuth, requireAdmin } = require('../src/middleware/auth');
const { lockSecondsForFailureCount, buildLoginIdentifier, buildRegistrationIdentifier } = require('../src/services/auth-throttle.service');
const { isTurnstileConfigured, isTurnstileTestKey } = require('../src/services/turnstile.service');
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
    assert.strictEqual(result.data.relationsSubmitted, true);
  });

  // 3. Chef Validator Tests
  console.log('\n3. Kiểm tra Chef Validator:');
  it('Validate thành công đầu bếp hợp lệ', () => {
    const input = {
      name: 'Chef Nguyễn Thanh Tùng',
      title: 'Bếp trưởng',
      experience: '18 năm kinh nghiệm',
      isFeatured: 'on'
    };
    const result = validateChef(input);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.isFeatured, true);
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
  console.log('\n11. Regression giao diện mới (bookmark, relation search):');
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

  it('Layout nạp đủ script client mới', () => {
    const layout = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', 'layouts', 'main.ejs'), 'utf8');
    ['bookmarks.js', 'catalog-pagination.js', 'share-page.js', 'bookmarks-page.js', 'admin-relation-search.js'].forEach((file) => {
      assert.ok(layout.includes(`/js/${file}`), `Layout thiếu ${file}`);
    });
  });

  // 12. Authentication & Authorization (unit + source checks)
  console.log('\n12. Xác thực & phân quyền:');
  it('Auth validators: đăng ký hợp lệ, email chuẩn hoá, mật khẩu khớp', () => {
    const ok = validateRegister({
      username: 'Nguyen_Van_A',
      email: '  User@Example.COM ',
      password: 'UiTest!23456',
      confirmPassword: 'UiTest!23456'
    });
    assert.strictEqual(ok.success, true);
    assert.strictEqual(ok.data.email, 'user@example.com');
  });

  it('Auth validators: từ chối username sai ký tự/độ dài và mật khẩu không khớp', () => {
    const badName = validateRegister({ username: 'a b', email: 'a@b.co', password: 'UiTest!23456', confirmPassword: 'UiTest!23456' });
    assert.strictEqual(badName.success, false);
    assert.ok(badName.errors.username);

    const shortPw = validateRegister({ username: 'abcdef', email: 'a@b.co', password: 'short', confirmPassword: 'short' });
    assert.strictEqual(shortPw.success, false);
    assert.ok(shortPw.errors.password);

    const mismatch = validateRegister({ username: 'abcdef', email: 'a@b.co', password: 'UiTest!23456', confirmPassword: 'UiTest!99999' });
    assert.strictEqual(mismatch.success, false);
    assert.ok(mismatch.errors.confirmPassword);

    assert.strictEqual(validateLogin({ email: 'not-an-email', password: 'x' }).success, false);
    assert.strictEqual(validateOtp({ email: 'a@b.co', token: '123456' }).success, true);
    assert.strictEqual(validatePasswordReset({ password: 'UiTest!23456', confirmPassword: 'UiTest!23456' }).success, true);
  });

  it('Chính sách khoá đăng nhập: 0/30s/5ph/30ph theo số lần sai', () => {
    assert.strictEqual(lockSecondsForFailureCount(0), 0);
    assert.strictEqual(lockSecondsForFailureCount(1), 0);
    assert.strictEqual(lockSecondsForFailureCount(2), 0);
    assert.strictEqual(lockSecondsForFailureCount(3), 30);
    assert.strictEqual(lockSecondsForFailureCount(4), 5 * 60);
    assert.strictEqual(lockSecondsForFailureCount(5), 30 * 60);
    assert.strictEqual(lockSecondsForFailureCount(50), 30 * 60, 'Không vượt quá 30 phút');
  });

  it('Login identifier là hash SHA-256 ổn định theo IP + email chuẩn hoá', () => {
    const a = buildLoginIdentifier('127.0.0.1', 'User@Example.com ');
    const b = buildLoginIdentifier('127.0.0.1', 'user@example.com');
    assert.strictEqual(a, b);
    assert.strictEqual(a.length, 64);
    assert.ok(/^[0-9a-f]+$/.test(a));
    assert.notStrictEqual(a, buildLoginIdentifier('127.0.0.2', 'user@example.com'));
    assert.notStrictEqual(a, buildLoginIdentifier('127.0.0.1', 'other@example.com'));
    assert.notStrictEqual(buildRegistrationIdentifier('127.0.0.1'), a);
  });

  it('Chỉ email admin đã xác minh mới được coi là admin (không tin role từ client)', () => {
    if (!config.ADMIN_EMAIL) {
      console.log('    (bỏ qua so khớp: chưa cấu hình ADMIN_EMAIL)');
      return;
    }
    assert.strictEqual(isAdminUser({ email: config.ADMIN_EMAIL, email_confirmed_at: '2026-01-01T00:00:00Z' }), true);
    assert.strictEqual(isAdminUser({ email: config.ADMIN_EMAIL.toUpperCase(), email_confirmed_at: '2026-01-01T00:00:00Z' }), true);
    assert.strictEqual(isAdminUser({ email: config.ADMIN_EMAIL, email_confirmed_at: null }), false, 'Email chưa xác minh không phải admin');
    assert.strictEqual(isAdminUser({ email: 'other@example.com', email_confirmed_at: '2026-01-01T00:00:00Z', role: 'admin' }), false);
    assert.strictEqual(isAdminUser({ email: config.ADMIN_EMAIL, email_confirmed_at: '2026-01-01T00:00:00Z', user_metadata: { role: 'admin' } }), true, 'Metadata không làm thay đổi kết quả');
    assert.strictEqual(isEmailVerified({ confirmed_at: '2026-01-01T00:00:00Z' }), true);
    assert.strictEqual(isEmailVerified({}), false);
  });

  it('safeNextPath chặn open redirect', () => {
    assert.strictEqual(safeNextPath('/dishes'), '/dishes');
    assert.strictEqual(safeNextPath('/admin/dishes?page=2'), '/admin/dishes?page=2');
    assert.strictEqual(safeNextPath('//evil.example/x'), null);
    assert.strictEqual(safeNextPath('https://evil.example'), null);
    assert.strictEqual(safeNextPath('\\\\evil.example'), null);
    assert.strictEqual(safeNextPath(''), null);
    assert.strictEqual(safeNextPath(undefined), null);
  });

  it('requireAuth trả JSON 401 cho API và redirect 303 cho trang HTML', () => {
    const makeRes = () => {
      const res = { statusCode: 200, headers: {} };
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (body) => { res.body = body; return res; };
      res.redirect = (code, url) => { res.statusCode = code; res.redirectTo = url; return res; };
      res.render = (view) => { res.rendered = view; return res; };
      return res;
    };
    const jsonRes = makeRes();
    requireAuth({ user: null, originalUrl: '/api/dishes', accepts: () => 'json' }, jsonRes, () => { throw new Error('không được next'); });
    assert.strictEqual(jsonRes.statusCode, 401);
    assert.strictEqual(jsonRes.body.error, 'UNAUTHENTICATED');

    const htmlRes = makeRes();
    requireAuth({ user: null, originalUrl: '/dishes', accepts: () => 'html' }, htmlRes, () => { throw new Error('không được next'); });
    assert.strictEqual(htmlRes.statusCode, 303);
    assert.ok(htmlRes.redirectTo.startsWith('/auth/login?next='));
  });

  it('requireAdmin: user thường nhận 403 (JSON/trang), admin được đi tiếp', () => {
    const makeRes = () => {
      const res = { statusCode: 200 };
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (body) => { res.body = body; return res; };
      res.render = (view) => { res.rendered = view; return res; };
      res.redirect = (code, url) => { res.statusCode = code; res.redirectTo = url; return res; };
      return res;
    };
    const regular = { email: 'regular@example.com', email_confirmed_at: '2026-01-01T00:00:00Z' };

    const jsonRes = makeRes();
    requireAdmin({ user: regular, originalUrl: '/admin/api/dishes', accepts: () => 'json' }, jsonRes, () => { throw new Error('không được next'); });
    assert.strictEqual(jsonRes.statusCode, 403);
    assert.strictEqual(jsonRes.body.error, 'FORBIDDEN');

    const htmlRes = makeRes();
    requireAdmin({ user: regular, originalUrl: '/admin/dishes', path: '/admin/dishes', accepts: () => 'html' }, htmlRes, () => { throw new Error('không được next'); });
    assert.strictEqual(htmlRes.statusCode, 403);
    assert.strictEqual(htmlRes.rendered, 'errors/403');

    if (config.ADMIN_EMAIL) {
      let passed = false;
      requireAdmin(
        { user: { email: config.ADMIN_EMAIL, email_confirmed_at: '2026-01-01T00:00:00Z' }, originalUrl: '/admin/dishes', accepts: () => 'html' },
        makeRes(),
        () => { passed = true; }
      );
      assert.strictEqual(passed, true);
    }
  });

  it('Đăng xuất chỉ nhận POST; không có route GET /logout', () => {
    const routes = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'auth.routes.js'), 'utf8');
    assert.ok(routes.includes("router.post('/logout'"), 'Thiếu POST /logout');
    assert.ok(!/router\.get\(\s*['"]\/logout/.test(routes), 'Không được có GET /logout');
  });

  it('Không tự hash/lưu mật khẩu: không dùng bcrypt/argon2, schema không có password hash', () => {
    const files = ['src/controllers/auth.controller.js', 'src/services/auth-throttle.service.js', 'src/middleware/auth.js'];
    files.forEach((file) => {
      const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
      assert.ok(!/require\(['"](bcrypt|argon2)/.test(source), `${file} không được tự hash mật khẩu`);
      assert.ok(!source.includes('passwordHash') && !source.includes('password_hash'), `${file} không được lưu password hash`);
    });
    const schema = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');
    assert.ok(!/password(Hash|_hash)?\s+String/.test(schema), 'Schema không được có cột mật khẩu');
  });

  it('Không log token/mật khẩu trong mã xác thực', () => {
    ['src/controllers/auth.controller.js', 'src/middleware/auth.js', 'src/lib/supabase-server.js', 'src/services/turnstile.service.js'].forEach((file) => {
      const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
      assert.ok(!/console\.log\(/.test(source), `${file} không được console.log`);
      assert.ok(!/access_token|refresh_token/i.test(source.replace(/refreshToken:/g, '')), `${file} không được log token`);
    });
  });

  it('Turnstile xác minh phía server và secret chỉ đọc từ env', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'turnstile.service.js'), 'utf8');
    assert.ok(source.includes('challenges.cloudflare.com/turnstile/v0/siteverify'), 'Thiếu siteverify');
    assert.ok(source.includes('config.TURNSTILE_SECRET_KEY'), 'Thiếu đọc secret từ env');
    assert.strictEqual(typeof isTurnstileConfigured(), 'boolean');
    const loginView = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', 'auth', 'login.ejs'), 'utf8');
    assert.ok(loginView.includes('cf-turnstile'), 'Trang đăng nhập thiếu widget CAPTCHA');
    const registerView = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', 'auth', 'register.ejs'), 'utf8');
    assert.ok(registerView.includes('cf-turnstile'), 'Trang đăng ký thiếu widget CAPTCHA');
  });

  it('Turnstile: nhận diện test key và production fail closed', () => {
    assert.strictEqual(
      isTurnstileTestKey('1x00000000000000000000AA', '1x0000000000000000000000000000000AA'),
      true,
      'Phải nhận diện cặp test key official'
    );
    assert.strictEqual(
      isTurnstileTestKey('3x00000000000000000000FF', '3x0000000000000000000000000000000AA'),
      true,
      'Phải nhận diện test key luôn chặn'
    );
    assert.strictEqual(
      isTurnstileTestKey('0x4AAAAAAABrealSiteKey', '0x4AAAAAAABrealSecretKey'),
      false,
      'Key thật (0x...) không được coi là test key'
    );

    const envSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'config', 'env.js'), 'utf8');
    assert.ok(envSource.includes('isTurnstileTestKey()'), 'Thiếu guard test key trong config');
    assert.ok(
      /isProduction\s*&&\s*isTurnstileTestKey/.test(envSource),
      'Production phải chặn Turnstile test key'
    );
    const turnstileSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'turnstile.service.js'), 'utf8');
    assert.ok(turnstileSource.includes("test-key-in-production"), 'siteverify phải fail closed khi gặp test key ở production');
  });

  it('Gửi lại email xác minh: báo lỗi khi Supabase hết quota email', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'auth.controller.js'), 'utf8');
    const start = source.indexOf('async function resendVerification');
    const end = source.indexOf('async function renderForgotPage');
    assert.ok(start > -1 && end > start, 'Không tìm thấy resendVerification');
    const block = source.slice(start, end);
    assert.ok(block.includes('over_email_send_rate_limit'), 'resend-verification phải xử lý over_email_send_rate_limit');
    assert.ok(block.includes('429'), 'resend-verification phải trả 429 khi hết quota');
  });

  it('Express gắn auth trước khi chặn toàn site; router admin có requireAdmin', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
    const attachIndex = appSource.indexOf('app.use(attachAuth)');
    const guardIndex = appSource.indexOf('app.use(requireAuth)');
    assert.ok(attachIndex > -1 && guardIndex > -1 && attachIndex < guardIndex, 'Thứ tự attachAuth/requireAuth chưa đúng');
    const adminRoutes = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'admin.routes.js'), 'utf8');
    assert.ok(adminRoutes.includes('router.use(requireAdmin)'), 'Router admin thiếu requireAdmin');
    const header = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', 'partials', 'header.ejs'), 'utf8');
    assert.ok(header.includes('isAdmin'), 'Header phải ẩn khu quản trị với user thường');
  });

  it('Có migration cho UserProfile và bảng throttle', () => {
    const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');
    const dirs = fs.readdirSync(migrationsDir).filter((name) => name.includes('add_auth_profiles_throttles'));
    assert.ok(dirs.length === 1, 'Thiếu migration add_auth_profiles_throttles');
    const sql = fs.readFileSync(path.join(migrationsDir, dirs[0], 'migration.sql'), 'utf8');
    ['UserProfile', 'LoginThrottle', 'RegistrationThrottle', 'usernameLower'].forEach((token) => {
      assert.ok(sql.includes(token), `Migration thiếu ${token}`);
    });
  });


  const runDb = ['1', 'true', 'yes'].includes(String(process.env.RUN_DB_TESTS).toLowerCase());
  console.log('\n13. Kiểm thử tích hợp database (RUN_DB_TESTS):');
  if (!runDb) {
    console.log('  ⚠ Bỏ qua (đặt RUN_DB_TESTS=1 để chạy trên database thật).');
  } else {
    const prisma = require('../src/lib/prisma');
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

      await itAsync('Một nguyên liệu dùng trong nhiều Dish / một Chef nấu nhiều Dish', async () => {
        const d1 = await dishService.createDish({ name: `__IT_D1_${Date.now()}__`, category: 'Test', price: 1, ingredientIds: [ingA.id], chefIds: [chefA.id], relationsSubmitted: true }, null);
        const d2 = await dishService.createDish({ name: `__IT_D2_${Date.now()}__`, category: 'Test', price: 1, ingredientIds: [ingA.id], chefIds: [chefA.id], relationsSubmitted: true }, null);
        created.dishes.push(d1.id, d2.id);
        const ing = await ingredientService.getIngredientById(ingA.id);
        const chef = await chefService.getChefById(chefA.id);
        assert.ok(ing.dishes.length >= 2, 'Ingredient phải liên kết nhiều Dish');
        assert.ok(chef.dishes.length >= 2, 'Chef phải liên kết nhiều Dish');
      });

      await itAsync('Từ chối ID quan hệ không tồn tại', async () => {
        await assert.rejects(
          () => dishService.createDish({ name: `__IT_BAD_${Date.now()}__`, category: 'Test', price: 1, ingredientIds: [99999999], chefIds: [], relationsSubmitted: true }, null)
        );
      });

      await itAsync('Cập nhật đồng bộ quan hệ đúng theo lựa chọn', async () => {
        const dish = await dishService.createDish({ name: `__IT_SYNC_${Date.now()}__`, category: 'Test', price: 1, ingredientIds: [ingA.id, ingB.id], chefIds: [chefA.id], relationsSubmitted: true }, null);
        created.dishes.push(dish.id);
        await dishService.updateDish(dish.id, { name: dish.name, category: 'Test', price: 1, ingredientIds: [ingA.id], chefIds: [chefA.id, chefB.id], relationsSubmitted: true }, null);
        const full = await dishService.getDishById(dish.id);
        assert.deepStrictEqual(full.ingredients.map((r) => r.ingredientId).sort(), [ingA.id]);
        assert.deepStrictEqual(full.chefs.map((r) => r.chefId).sort(), [chefA.id, chefB.id].sort());
      });

      await itAsync('Tìm kiếm full-text + bỏ dấu chạy trong PostgreSQL', async () => {
        const unique = Date.now();
        const dish = await dishService.createDish({
          name: `Phở Bò __IT_${unique}__`, category: 'Món nước', price: 55000,
          ingredientIds: [], chefIds: [], relationsSubmitted: true
        }, null);
        created.dishes.push(dish.id);

        const found = await dishService.getDishes({ q: 'pho bo', page: 1, limit: 50 });
        assert.ok(found.dishes.some((row) => row.id === dish.id), 'Phải tìm thấy khi gõ không dấu');

        const priceFiltered = await dishService.getDishes({ q: 'pho bo', minPrice: 60000, page: 1, limit: 50 });
        assert.ok(!priceFiltered.dishes.some((row) => row.id === dish.id), 'Bộ lọc giá phải kết hợp với tìm kiếm');
      });

      await itAsync('Tìm kiếm Chef và Ingredient cũng chạy bằng SQL', async () => {
        const chefName = `Đầu Bếp Phở __IT_${Date.now()}__`;
        const chef = await prisma.chef.create({ data: { name: chefName } });
        const ingredientName = `Hồi An __IT_${Date.now()}__`;
        const ingredient = await prisma.ingredient.create({ data: { name: ingredientName } });
        created.chefs.push(chef.id);
        created.ingredients.push(ingredient.id);

        const chefs = await chefService.getChefs({ q: 'dau bep pho', page: 1, limit: 50 });
        assert.ok(chefs.chefs.some((row) => row.id === chef.id), 'Chef phải tìm được bằng FTS không dấu');

        const ingredients = await ingredientService.getIngredients({ q: 'hoi an', page: 1, limit: 50 });
        assert.ok(ingredients.ingredients.some((row) => row.id === ingredient.id), 'Ingredient phải tìm được bằng FTS không dấu');
      });

      await itAsync('Không thay đổi quan hệ khi form không gửi relationsSubmitted', async () => {
        const dish = await dishService.createDish({ name: `__IT_KEEP_${Date.now()}__`, category: 'Test', price: 1, ingredientIds: [ingA.id], chefIds: [chefA.id], relationsSubmitted: true }, null);
        created.dishes.push(dish.id);
        await dishService.updateDish(dish.id, { name: dish.name, category: 'Test', price: 2, ingredientIds: [], chefIds: [], relationsSubmitted: false }, null);
        const full = await dishService.getDishById(dish.id);
        assert.strictEqual(full.ingredients.length, 1);
        assert.strictEqual(full.chefs.length, 1);
      });

      await itAsync('Xóa Dish chỉ xóa join rows, KHÔNG xóa Chef/Ingredient', async () => {
        const dish = await dishService.createDish({ name: `__IT_DEL_${Date.now()}__`, category: 'Test', price: 1, ingredientIds: [ingA.id], chefIds: [chefA.id], relationsSubmitted: true }, null);
        await dishService.deleteDish(dish.id);
        assert.strictEqual(await prisma.dishIngredient.count({ where: { dishId: dish.id } }), 0);
        assert.strictEqual(await prisma.dishChef.count({ where: { dishId: dish.id } }), 0);
        assert.ok(await prisma.chef.findUnique({ where: { id: chefA.id } }));
        assert.ok(await prisma.ingredient.findUnique({ where: { id: ingA.id } }));
      });

      await itAsync('Chặn xóa Chef/Ingredient đang được sử dụng', async () => {
        const dish = await dishService.createDish({ name: `__IT_BLOCK_${Date.now()}__`, category: 'Test', price: 1, ingredientIds: [ingA.id], chefIds: [chefA.id], relationsSubmitted: true }, null);
        created.dishes.push(dish.id);
        await assert.rejects(() => chefService.deleteChef(chefA.id));
        await assert.rejects(() => ingredientService.deleteIngredient(ingA.id));
      });
    } finally {
      await cleanup();
      await prisma.$disconnect().catch(() => {});
    }
  }

  // 14. Login throttle integration (opt-in, real database)
  console.log('\n14. Throttle đăng nhập trên database (RUN_DB_TESTS):');
  if (!runDb) {
    console.log('  ⚠ Bỏ qua (đặt RUN_DB_TESTS=1 để chạy trên database thật).');
  } else {
    const prisma = require('../src/lib/prisma');
    const {
      recordLoginFailure,
      getLoginStatus,
      resetLoginFailures,
      consumeRegistrationAttempt
    } = require('../src/services/auth-throttle.service');

    const loginId = buildLoginIdentifier(`test-${Date.now()}`, 'throttle@example.com');
    const registrationIp = `test-reg-${Date.now()}`;

    try {
      await itAsync('Sai 1–2 lần không khoá; lần 3 khoá 30 giây', async () => {
        const first = await recordLoginFailure(loginId);
        assert.strictEqual(first.locked, false);
        assert.strictEqual(first.failureCount, 1);

        const second = await recordLoginFailure(loginId);
        assert.strictEqual(second.locked, false);
        assert.strictEqual(second.failureCount, 2);

        const third = await recordLoginFailure(loginId);
        assert.strictEqual(third.locked, true);
        assert.ok(third.retryAfterSeconds >= 29 && third.retryAfterSeconds <= 30, `retry=${third.retryAfterSeconds}`);
        assert.strictEqual(third.captchaRequired, true);
      });

      await itAsync('Hết thời gian chờ KHÔNG reset bộ đếm; lần 4 khoá 5 phút, lần 5 khoá 30 phút', async () => {
        await prisma.loginThrottle.update({ where: { identifier: loginId }, data: { lockedUntil: new Date(Date.now() - 1000) } });
        const expired = await getLoginStatus(loginId);
        assert.strictEqual(expired.locked, false);
        assert.strictEqual(expired.failureCount, 3, 'Bộ đếm phải giữ nguyên sau khi hết hạn khoá');

        const fourth = await recordLoginFailure(loginId);
        assert.strictEqual(fourth.failureCount, 4);
        assert.ok(fourth.retryAfterSeconds >= 299 && fourth.retryAfterSeconds <= 300, `retry=${fourth.retryAfterSeconds}`);

        await prisma.loginThrottle.update({ where: { identifier: loginId }, data: { lockedUntil: new Date(Date.now() - 1000) } });
        const fifth = await recordLoginFailure(loginId);
        assert.strictEqual(fifth.failureCount, 5);
        assert.ok(fifth.retryAfterSeconds >= 1799 && fifth.retryAfterSeconds <= 1800, `retry=${fifth.retryAfterSeconds}`);
      });

      await itAsync('Chỉ reset khi đăng nhập thành công (resetLoginFailures)', async () => {
        await resetLoginFailures(loginId);
        const status = await getLoginStatus(loginId);
        assert.strictEqual(status.failureCount, 0);
        assert.strictEqual(status.locked, false);
        assert.strictEqual(status.captchaRequired, false);
      });

      await itAsync('Giới hạn đăng ký theo IP dùng cửa sổ thời gian cố định', async () => {
        let last = null;
        for (let i = 0; i < config.REGISTRATION_LIMIT; i++) {
          last = await consumeRegistrationAttempt(registrationIp);
          assert.strictEqual(last.allowed, true);
        }
        const blocked = await consumeRegistrationAttempt(registrationIp);
        assert.strictEqual(blocked.allowed, false);
        assert.ok(blocked.retryAfterSeconds > 0);
        assert.strictEqual(last.remaining, 0);
      });
    } finally {
      await prisma.loginThrottle.deleteMany({ where: { identifier: loginId } }).catch(() => {});
      const regIdentifiers = [buildRegistrationIdentifier(registrationIp)];
      await prisma.registrationThrottle.deleteMany({ where: { identifier: { in: regIdentifiers } } }).catch(() => {});
      await prisma.$disconnect().catch(() => {});
    }
  }

  console.log('\n---------------------------------------------');
  console.log(`KẾT QUẢ: ${passedTests}/${totalTests} tests hoàn thành thành công!`);
  console.log('---------------------------------------------\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

run();
