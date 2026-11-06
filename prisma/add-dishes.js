/**
 * Additive data script: insert 10 Vietnamese dishes with their main ingredients
 * and the real Dish–Ingredient relations.
 *
 * Safety rules:
 *   - ADDITIVE ONLY: never deletes or overwrites existing rows.
 *   - IDEMPOTENT: matches by name (case-insensitive). Existing Dishes are skipped;
 *     existing Ingredients are reused. Running twice creates no duplicates.
 *   - Does NOT touch Chefs or images (imagePath stays null, no Chef relations added).
 *   - Ingredients not present in the catalog below are still created if they are
 *     listed with metadata; otherwise the script aborts before writing.
 *
 * Usage:
 *   node prisma/add-dishes.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Ingredient catalog: only NEW ingredients that do not exist yet.
// Existing ingredients with the same name are reused automatically.
// Categories match the values suggested by the Ingredient form.
// ---------------------------------------------------------------------------
const INGREDIENT_CATALOG = {
  // Nông sản truyền thống (tinh bột / sợi)
  'Bánh phở': { category: 'Nông sản truyền thống', unit: 'gram', description: 'Sợi phở tươi làm từ gạo.' },
  'Bún tươi': { category: 'Nông sản truyền thống', unit: 'gram', description: 'Bún sợi nhỏ tươi.' },
  'Bánh mì': { category: 'Nông sản truyền thống', unit: 'ổ', description: 'Bánh mì vỏ giòn.' },
  'Gạo tấm': { category: 'Nông sản truyền thống', unit: 'gram', description: 'Gạo tấm dùng cho cơm tấm.' },
  'Bún sợi to': { category: 'Nông sản truyền thống', unit: 'gram', description: 'Bún sợi to đặc trưng của Bún bò Huế.' },
  'Bánh tráng': { category: 'Nông sản truyền thống', unit: 'cái', description: 'Bánh tráng dùng để cuốn.' },
  'Bột gạo': { category: 'Nông sản truyền thống', unit: 'gram', description: 'Bột gạo pha bột bánh xèo.' },
  'Mì Quảng': { category: 'Nông sản truyền thống', unit: 'gram', description: 'Sợi mì Quảng.' },
  'Đậu phộng': { category: 'Nông sản truyền thống', unit: 'gram', description: 'Đậu phộng rang.' },
  'Đậu đỏ': { category: 'Nông sản truyền thống', unit: 'gram', description: 'Đậu đỏ nấu chè.' },
  'Đậu xanh': { category: 'Nông sản truyền thống', unit: 'gram', description: 'Đậu xanh nấu chè.' },
  'Nước cốt dừa': { category: 'Nông sản truyền thống', unit: 'ml', description: 'Nước cốt dừa.' },
  'Nước dừa tươi': { category: 'Nông sản truyền thống', unit: 'ml', description: 'Nước dừa tươi.' },

  // Thịt & Thủy hải sản
  'Xương bò': { category: 'Thịt & Thủy hải sản', unit: 'gram', description: 'Xương bò ninh nước dùng.' },
  'Thịt heo ba chỉ': { category: 'Thịt & Thủy hải sản', unit: 'gram', description: 'Thịt heo ba chỉ.' },
  'Thịt heo xay': { category: 'Thịt & Thủy hải sản', unit: 'gram', description: 'Thịt heo xay.' },
  'Thịt heo': { category: 'Thịt & Thủy hải sản', unit: 'gram', description: 'Thịt heo.' },
  'Sườn heo': { category: 'Thịt & Thủy hải sản', unit: 'gram', description: 'Sườn heo nướng.' },
  'Giò heo': { category: 'Thịt & Thủy hải sản', unit: 'gram', description: 'Giò heo.' },
  'Tôm': { category: 'Thịt & Thủy hải sản', unit: 'gram', description: 'Tôm tươi.' },
  'Thịt gà': { category: 'Thịt & Thủy hải sản', unit: 'gram', description: 'Thịt gà.' },
  'Xương gà': { category: 'Thịt & Thủy hải sản', unit: 'gram', description: 'Xương gà ninh nước dùng.' },
  'Cá basa': { category: 'Thịt & Thủy hải sản', unit: 'gram', description: 'Cá basa kho tộ.' },
  'Trứng gà': { category: 'Thịt & Thủy hải sản', unit: 'quả', description: 'Trứng gà.' },

  // Rau tươi
  'Hành tây': { category: 'Rau tươi', unit: 'gram', description: 'Hành tây.' },
  'Đu đủ xanh': { category: 'Rau tươi', unit: 'gram', description: 'Đu đủ xanh bào.' },
  'Dưa leo': { category: 'Rau tươi', unit: 'gram', description: 'Dưa leo.' },
  'Xà lách': { category: 'Rau tươi', unit: 'gram', description: 'Xà lách.' },
  'Giá đỗ': { category: 'Rau tươi', unit: 'gram', description: 'Giá đỗ.' },

  // Thảo mộc tự nhiên
  'Gừng': { category: 'Thảo mộc tự nhiên', unit: 'gram', description: 'Gừng.' },
  'Sả': { category: 'Thảo mộc tự nhiên', unit: 'cây', description: 'Sả.' },
  'Hành lá': { category: 'Thảo mộc tự nhiên', unit: 'bó', description: 'Hành lá.' },
  'Thạch lá dứa': { category: 'Thảo mộc tự nhiên', unit: 'gram', description: 'Thạch lá dứa.' },

  // Gia vị truyền thống
  'Mắm ruốc': { category: 'Gia vị truyền thống', unit: 'gram', description: 'Mắm ruốc Huế.' }
};

// ---------------------------------------------------------------------------
// Dishes to add. `ingredients` are the MAIN ingredients only.
// ---------------------------------------------------------------------------
const DISHES = [
  {
    name: 'Phở bò truyền thống',
    category: 'Món nước',
    price: 70000,
    description: 'Nước dùng xương bò ninh trong, bánh phở mềm, thịt bò thái mỏng.',
    ingredients: ['Bánh phở', 'Thịt bò', 'Xương bò', 'Hành tây', 'Gừng']
  },
  {
    name: 'Bún chả Hà Nội',
    category: 'Món nướng',
    price: 55000,
    description: 'Chả viên và chả miếng nướng than hoa, ăn kèm bún và rau sống.',
    ingredients: ['Bún tươi', 'Thịt heo ba chỉ', 'Thịt heo xay', 'Cà rốt', 'Đu đủ xanh']
  },
  {
    name: 'Bánh mì thịt nướng',
    category: 'Món chính',
    price: 35000,
    description: 'Bánh mì giòn kẹp thịt heo nướng sả, dưa leo và cà rốt.',
    ingredients: ['Bánh mì', 'Thịt heo', 'Sả', 'Dưa leo', 'Cà rốt']
  },
  {
    name: 'Cơm tấm sườn nướng',
    category: 'Món chính',
    price: 65000,
    description: 'Cơm tấm ăn kèm sườn heo nướng, trứng và rau.',
    ingredients: ['Gạo tấm', 'Sườn heo', 'Trứng gà', 'Dưa leo', 'Cà rốt']
  },
  {
    name: 'Bún bò Huế',
    category: 'Món nước',
    price: 65000,
    description: 'Nước dùng đậm đà vị sả và mắm ruốc, bún sợi to, thịt bò và giò heo.',
    ingredients: ['Bún sợi to', 'Thịt bò', 'Xương bò', 'Giò heo', 'Sả', 'Mắm ruốc']
  },
  {
    name: 'Gỏi cuốn tôm thịt',
    category: 'Món cuốn',
    price: 45000,
    description: 'Cuốn bánh tráng với tôm, thịt heo, bún tươi và xà lách.',
    ingredients: ['Bánh tráng', 'Tôm', 'Thịt heo', 'Bún tươi', 'Xà lách']
  },
  {
    name: 'Bánh xèo miền Tây',
    category: 'Món chiên',
    price: 50000,
    description: 'Bánh xèo giòn rụm nhân tôm, thịt heo ba chỉ và giá đỗ.',
    ingredients: ['Bột gạo', 'Tôm', 'Thịt heo ba chỉ', 'Giá đỗ', 'Nước cốt dừa']
  },
  {
    name: 'Mì Quảng gà',
    category: 'Món nước',
    price: 55000,
    description: 'Mì Quảng với gà, tôm và nước dùng từ xương gà, rắc đậu phộng.',
    ingredients: ['Mì Quảng', 'Thịt gà', 'Xương gà', 'Tôm', 'Đậu phộng']
  },
  {
    name: 'Cá kho tộ',
    category: 'Món chính',
    price: 90000,
    description: 'Cá basa kho nước dừa tươi trong nồi đất, thơm mùi hành lá.',
    ingredients: ['Cá basa', 'Nước dừa tươi', 'Hành lá']
  },
  {
    name: 'Chè ba màu',
    category: 'Tráng miệng',
    price: 25000,
    description: 'Chè mát gồm đậu đỏ, đậu xanh, thạch lá dứa và nước cốt dừa.',
    ingredients: ['Đậu đỏ', 'Đậu xanh', 'Nước cốt dừa', 'Thạch lá dứa']
  }
];

const createdIngredients = [];
const reusedIngredients = [];
const createdDishes = [];
const skippedDishes = [];

/**
 * Find an Ingredient by name (case-insensitive) or create it from the catalog.
 */
async function ensureIngredient(name) {
  const existing = await prisma.ingredient.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } }
  });
  if (existing) {
    reusedIngredients.push({ id: existing.id, name: existing.name });
    return existing.id;
  }

  const meta = INGREDIENT_CATALOG[name];
  if (!meta) {
    throw new Error(
      `Nguyên liệu mới "${name}" chưa có metadata trong INGREDIENT_CATALOG. ` +
      'Bổ sung metadata rồi chạy lại để tránh ghi dữ liệu thiếu thông tin.'
    );
  }

  const created = await prisma.ingredient.create({
    data: { name, category: meta.category, unit: meta.unit, description: meta.description }
  });
  createdIngredients.push({ id: created.id, name: created.name, category: created.category, unit: created.unit });
  return created.id;
}

async function main() {
  console.log('=== ADD 10 DISHES (additive, idempotent) ===\n');

  for (const dish of DISHES) {
    const existingDish = await prisma.dish.findFirst({
      where: { name: { equals: dish.name, mode: 'insensitive' } }
    });
    if (existingDish) {
      skippedDishes.push({ id: existingDish.id, name: existingDish.name });
      console.log(`[SKIP] Dish đã tồn tại: "${existingDish.name}" (#${existingDish.id})`);
      continue;
    }

    const ingredientIds = [];
    for (const ingredientName of dish.ingredients) {
      ingredientIds.push(await ensureIngredient(ingredientName));
    }

    const newDish = await prisma.$transaction(async (tx) => {
      const created = await tx.dish.create({
        data: {
          name: dish.name,
          category: dish.category,
          price: dish.price,
          description: dish.description,
          imagePath: null,
          isFeatured: false
        }
      });
      if (ingredientIds.length) {
        await tx.dishIngredient.createMany({
          data: ingredientIds.map((ingredientId) => ({ dishId: created.id, ingredientId }))
        });
      }
      return created;
    });

    createdDishes.push({ id: newDish.id, name: newDish.name, ingredientCount: ingredientIds.length });
    console.log(`[+] Created Dish #${newDish.id} "${newDish.name}" với ${ingredientIds.length} nguyên liệu.`);
  }

  // -------------------------------------------------------------------------
  // Report + verification straight from the database
  // -------------------------------------------------------------------------
  console.log('\n=== KẾT QUẢ ===');
  console.log(`Dish mới tạo: ${createdDishes.length}`);
  for (const d of createdDishes) console.log(`  #${d.id} | ${d.name}`);
  console.log(`Dish bỏ qua (đã tồn tại): ${skippedDishes.length}`);
  for (const d of skippedDishes) console.log(`  #${d.id} | ${d.name}`);
  console.log(`Ingredient mới tạo: ${createdIngredients.length}`);
  for (const i of createdIngredients) console.log(`  #${i.id} | ${i.name} (${i.category}, ${i.unit})`);
  console.log(`Ingredient tái sử dụng: ${reusedIngredients.length}`);
  for (const i of reusedIngredients) console.log(`  #${i.id} | ${i.name}`);

  console.log('\n=== XÁC MINH QUAN HỆ TỪ DATABASE ===');
  for (const dish of DISHES) {
    const row = await prisma.dish.findFirst({
      where: { name: { equals: dish.name, mode: 'insensitive' } },
      include: { ingredients: { include: { ingredient: true } } }
    });
    if (!row) {
      console.log(`  [!] KHÔNG TÌM THẤY "${dish.name}"`);
      continue;
    }
    const names = row.ingredients.map((r) => r.ingredient.name).sort();
    const expected = [...dish.ingredients].sort();
    const ok = JSON.stringify(names) === JSON.stringify(expected);
    console.log(`  ${ok ? 'OK ' : 'FAIL'} #${row.id} ${row.name} (${names.length}) -> ${names.join(', ')}`);
    if (!ok) console.log(`        mong đợi: ${expected.join(', ')}`);
  }
}

main()
  .catch((e) => { console.error('ADD DISHES ERROR:', e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
