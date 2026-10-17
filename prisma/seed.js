/**
 * Optional DEMO data seeder.
 *
 * Safety rules (see docs/implementation/MASTER_SPEC.md):
 *   - This seeder NEVER deletes business data.
 *   - It is IDEMPOTENT: running it multiple times does not create duplicates.
 *   - It only runs when explicitly opted-in, via EITHER:
 *         node prisma/seed.js --demo
 *         SEED_DEMO=true node prisma/seed.js
 *   - It refuses to run when NODE_ENV=production.
 *   - Demo records are only meant for development/demo environments; production
 *     data must be managed through the admin UI backed by PostgreSQL.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEMO_INGREDIENTS = [
  { name: 'Bánh phở tươi', category: 'Nông sản', unit: 'gram', description: 'Sợi phở dẻo mềm làm từ gạo tẻ.' },
  { name: 'Thịt bò tái', category: 'Thịt & Hải sản', unit: 'gram', description: 'Thịt bò thăn thái lát mỏng.' },
  { name: 'Hành lá', category: 'Rau thơm', unit: 'bó', description: 'Hành lá tươi thơm.' },
  { name: 'Nước dùng xương', category: 'Gia vị truyền thống', unit: 'lít', description: 'Nước dùng ninh từ xương ống.' }
];

const DEMO_CHEFS = [
  { name: 'Bếp Trưởng Minh', title: 'Bếp trưởng', experience: '15 năm kinh nghiệm', description: 'Chuyên ẩm thực Việt truyền thống.' },
  { name: 'Đầu Bếp Lan', title: 'Sous Chef', experience: '8 năm kinh nghiệm', description: 'Phụ trách món nước và món cuốn.' }
];

const DEMO_DISHES = [
  {
    name: 'Phở Bò Tái Lăn',
    category: 'Món nước',
    price: 65000,
    description: 'Nước dùng thanh ngọt, bánh phở mềm, thịt bò tái lăn thơm.',
    isFeatured: true,
    ingredients: ['Bánh phở tươi', 'Thịt bò tái', 'Hành lá', 'Nước dùng xương'],
    chefs: ['Bếp Trưởng Minh', 'Đầu Bếp Lan']
  },
  {
    name: 'Bún Chả Hà Nội',
    category: 'Món nướng',
    price: 55000,
    description: 'Chả nướng than hoa ăn kèm bún và rau sống.',
    isFeatured: false,
    ingredients: ['Hành lá'],
    chefs: ['Bếp Trưởng Minh']
  },
  {
    name: 'Trà Sen Ướp Hương',
    category: 'Đồ uống',
    price: 30000,
    description: 'Trà ướp hương sen thanh mát.',
    isFeatured: false,
    ingredients: [],
    chefs: []
  }
];

async function upsertByName(model, data) {
  const existing = await prisma[model].findFirst({ where: { name: data.name } });
  if (existing) {
    const updated = await prisma[model].update({ where: { id: existing.id }, data });
    console.log(`[=] Updated ${model}: ${data.name}`);
    return updated;
  }
  const created = await prisma[model].create({ data });
  console.log(`[+] Created ${model}: ${data.name}`);
  return created;
}

async function main() {
  const optIn = process.argv.includes('--demo') || ['1', 'true', 'yes'].includes(String(process.env.SEED_DEMO).toLowerCase());

  if (process.env.NODE_ENV === 'production') {
    console.error('[SEED REFUSED] NODE_ENV=production. Demo seeding is disabled in production.');
    process.exitCode = 1;
    return;
  }

  if (!optIn) {
    console.log('--- Demo seed skipped ---');
    console.log('This seeder is OPT-IN and never runs automatically.');
    console.log('To insert demo data into a development database, run one of:');
    console.log('  node prisma/seed.js --demo');
    console.log('  SEED_DEMO=true node prisma/seed.js');
    return;
  }

  console.log('--- Seeding DEMO data (idempotent, non-destructive) ---');

  // 1. Ingredients
  const ingredientByName = new Map();
  for (const ingredient of DEMO_INGREDIENTS) {
    const row = await upsertByName('ingredient', ingredient);
    ingredientByName.set(row.name, row.id);
  }

  // 2. Chefs
  const chefByName = new Map();
  for (const chef of DEMO_CHEFS) {
    const row = await upsertByName('chef', chef);
    chefByName.set(row.name, row.id);
  }

  // 3. Dishes + relations
  for (const dish of DEMO_DISHES) {
    const { ingredients, chefs, ...dishData } = dish;
    const row = await upsertByName('dish', { ...dishData, imagePath: null });

    const ingredientRows = ingredients
      .map((name) => ingredientByName.get(name))
      .filter(Boolean)
      .map((ingredientId) => ({ dishId: row.id, ingredientId }));
    const chefRows = chefs
      .map((name) => chefByName.get(name))
      .filter(Boolean)
      .map((chefId) => ({ dishId: row.id, chefId }));

    if (ingredientRows.length) {
      await prisma.dishIngredient.createMany({ data: ingredientRows, skipDuplicates: true });
    }
    if (chefRows.length) {
      await prisma.dishChef.createMany({ data: chefRows, skipDuplicates: true });
    }
  }

  console.log('--- Demo seed complete (no existing data was deleted). ---');
}

main()
  .catch((e) => {
    console.error('[SEED ERROR]:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
