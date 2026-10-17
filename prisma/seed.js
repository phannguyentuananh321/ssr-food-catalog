const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Chỉ giữ lại những món ăn có ảnh thực tế trong Supabase Storage bucket `dish-images`
const supabaseDishes = [
  {
    name: 'Bò Wagyu Nướng Sốt Tiêu',
    category: 'Món nướng',
    price: 250000,
    isFeatured: true,
    imagePath: 'beef.jpg',
    description: 'Thịt bò hảo hạng nướng xém cạnh mềm mọng, đượm sốt tiêu đen thơm lừng đậm đà.'
  },
  {
    name: 'Cua Tuyết Sốt Bơ Tỏi',
    category: 'Hải sản',
    price: 320000,
    isFeatured: true,
    imagePath: 'crab.jpg',
    description: 'Cua tươi ngon chắc thịt xào cùng bơ lạt Pháp và tỏi phi thơm nức mũi.'
  },
  {
    name: 'Matcha Latte Sữa Tươi Kem Béo',
    category: 'Đồ uống',
    price: 45000,
    isFeatured: true,
    imagePath: 'mattcha.jpg',
    description: 'Bột matcha thượng hạng hòa quyện sữa tươi thanh trùng và lớp bọt kem béo ngậy ngọt dịu.'
  },
  {
    name: 'Sashimi Cá Hồi Tươi Thượng Hạng',
    category: 'Món tươi sống',
    price: 185000,
    isFeatured: true,
    imagePath: 'sashimi.jpg',
    description: 'Từng lát cá hồi tươi béo ngậy cắt lát dày vừa vặn, ăn kèm wasabi cay nồng và lá tía tô.'
  },
  {
    name: 'Sushi Thập Cẩm Nghệ Nhân',
    category: 'Món chính',
    price: 160000,
    isFeatured: true,
    imagePath: 'sushi.jpg',
    description: 'Cơm giấm dẻo thơm kết hợp các loại hải sản tươi sống chọn lọc tạo nên hương vị nguyên bản tinh tế.'
  }
];

async function main() {
  console.log('--- Đồng bộ chỉ dữ liệu có trong Supabase Storage ---');

  // Xóa các món không có ảnh trong Supabase
  const supabaseImageFiles = supabaseDishes.map(d => d.imagePath);
  await prisma.dish.deleteMany({
    where: {
      imagePath: {
        notIn: supabaseImageFiles
      }
    }
  });

  // Cập nhật hoặc tạo mới 5 món từ Supabase
  for (const dish of supabaseDishes) {
    const existing = await prisma.dish.findFirst({ where: { imagePath: dish.imagePath } });
    if (!existing) {
      await prisma.dish.create({ data: dish });
      console.log(`[+] Đã tạo món ăn: ${dish.name} (${dish.imagePath})`);
    } else {
      await prisma.dish.update({
        where: { id: existing.id },
        data: dish
      });
      console.log(`[✓] Đã cập nhật món ăn: ${dish.name} (${dish.imagePath})`);
    }
  }

  console.log('--- Hoàn tất! Hiện tại toàn bộ dữ liệu 100% là ảnh từ Supabase Storage. ---');
}

main()
  .catch((e) => {
    console.error('[SEED ERROR]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
