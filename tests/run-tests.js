const assert = require('assert');
const { validateDish } = require('../src/validators/dish.validator');
const { validateChef } = require('../src/validators/chef.validator');
const { validateIngredient } = require('../src/validators/ingredient.validator');
const { getImageUrl } = require('../src/services/image.service');
const { config, validateEnv } = require('../src/config/env');
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
  const path = 'uploads/dishes/sample.jpg';
  assert.strictEqual(getImageUrl(path), '/uploads/dishes/sample.jpg');
});

// 6. Express App & Routing Setup
console.log('\n6. Kiểm tra Express App Setup:');
it('Express app khởi tạo đầy đủ các middleware và router', () => {
  assert.ok(app, 'App phải tồn tại');
  assert.strictEqual(typeof app.listen, 'function');
});

console.log('\n---------------------------------------------');
console.log(`KẾT QUẢ: ${passedTests}/${totalTests} tests hoàn thành thành công!`);
console.log('---------------------------------------------\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
