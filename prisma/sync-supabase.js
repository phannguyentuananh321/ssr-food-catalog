const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncSupabaseImages() {
  console.log('--- Đang đồng bộ ảnh trực tiếp từ Supabase Bucket dish-images ---');

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

  for (const item of supabaseDishes) {
    const existing = await prisma.dish.findFirst({
      where: {
        OR: [
          { name: item.name },
          { imagePath: item.imagePath }
        ]
      }
    });

    if (existing) {
      await prisma.dish.update({
        where: { id: existing.id },
        data: item
      });
      console.log(`[✓] Đã cập nhật món: ${item.name} -> ảnh Supabase: ${item.imagePath}`);
    } else {
      await prisma.dish.create({
        data: item
      });
      console.log(`[+] Đã thêm mới món: ${item.name} -> ảnh Supabase: ${item.imagePath}`);
    }
  }

  console.log('--- Đồng bộ ảnh từ Supabase Storage hoàn tất! ---');
}

syncSupabaseImages()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
