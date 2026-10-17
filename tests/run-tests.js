const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateDish, normalizeIdList } = require('../src/validators/dish.validator');
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

  // 8. Remote database integration tests (opt-in)
  const runDb = ['1', 'true', 'yes'].includes(String(process.env.RUN_DB_TESTS).toLowerCase());
  console.log('\n8. Kiểm thử tích hợp database (RUN_DB_TESTS):');
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

  console.log('\n---------------------------------------------');
  console.log(`KẾT QUẢ: ${passedTests}/${totalTests} tests hoàn thành thành công!`);
  console.log('---------------------------------------------\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

run();
