/**
 * One-off maintenance script: remove the known seed/demo Dishes and their
 * Storage images from the Supabase project.
 *
 * This script is intentionally explicit and conservative:
 *   - It only ever targets the exact IDs/signatures listed in DEMO_DISHES.
 *   - It ABORTS if any targeted row does not match the expected name + imagePath,
 *     so it can never delete an unrelated record.
 *   - Nothing is deleted unless the `--confirm` flag is passed (dry-run by default).
 *
 * Usage (after reviewing the dry-run output):
 *   node prisma/remove-demo-dishes.js            # dry-run, prints what WOULD happen
 *   node prisma/remove-demo-dishes.js --confirm  # actually deletes
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { deleteImage } = require('../src/services/image.service');

const DEMO_DISHES = [
  { id: 10, name: 'Bò Wagyu Nướng Sốt Tiêu', imagePath: 'beef.jpg' },
  { id: 11, name: 'Cua Tuyết Sốt Bơ Tỏi', imagePath: 'crab.jpg' },
  { id: 12, name: 'Matcha Latte Sữa Tươi Kem Béo', imagePath: 'mattcha.jpg' },
  { id: 13, name: 'Sashimi Cá Hồi Tươi Thượng Hạng', imagePath: 'sashimi.jpg' },
  { id: 14, name: 'Sushi Thập Cẩm Nghệ Nhân', imagePath: 'sushi.jpg' }
];

async function main() {
  const confirm = process.argv.includes('--confirm');
  const ids = DEMO_DISHES.map((d) => d.id);

  const found = await prisma.dish.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
  const foundById = new Map(found.map((d) => [d.id, d]));

  console.log(`Found ${found.length}/${DEMO_DISHES.length} targeted demo dishes.\n`);

  // Safety: verify signatures before any deletion
  const mismatches = [];
  for (const expected of DEMO_DISHES) {
    const actual = foundById.get(expected.id);
    if (!actual) continue; // already removed
    if (actual.name !== expected.name || actual.imagePath !== expected.imagePath) {
      mismatches.push({ expected, actual: { id: actual.id, name: actual.name, imagePath: actual.imagePath } });
    }
  }

  if (mismatches.length > 0) {
    console.error('ABORT: target signature mismatch. No data was deleted.');
    console.error(JSON.stringify(mismatches, null, 2));
    process.exitCode = 1;
    return;
  }

  for (const expected of DEMO_DISHES) {
    const actual = foundById.get(expected.id);
    if (actual) {
      console.log(`  [${confirm ? 'DELETE' : 'WOULD DELETE'}] Dish #${actual.id} "${actual.name}" (image: ${actual.imagePath})`);
    } else {
      console.log(`  [SKIP] Dish #${expected.id} already absent.`);
    }
  }
  console.log('');

  for (const expected of DEMO_DISHES) {
    console.log(`  [${confirm ? 'DELETE' : 'WOULD DELETE'}] Storage object "${expected.imagePath}" in bucket.`);
  }
  console.log('');

  if (!confirm) {
    console.log('Dry-run only. Re-run with --confirm to apply.');
    return;
  }

  // Delete dish rows (join rows cascade automatically)
  const delResult = await prisma.dish.deleteMany({ where: { id: { in: ids } } });
  console.log(`Deleted ${delResult.count} dish row(s).`);

  // Remove Storage images
  for (const expected of DEMO_DISHES) {
    await deleteImage(expected.imagePath);
    console.log(`Storage cleanup requested for "${expected.imagePath}".`);
  }

  // Verify
  const remaining = await prisma.dish.findMany({ where: { id: { in: ids } } });
  console.log(`\nVerification: ${remaining.length} of the targeted demo dishes remain (expected 0).`);
}

main()
  .catch((e) => { console.error('REMOVE DEMO ERROR:', e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
