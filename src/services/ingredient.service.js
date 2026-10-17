const prisma = require('../lib/prisma');
const imageService = require('./image.service');

async function getIngredients({ q, category, page = 1, limit = 9 }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const take = Math.max(1, Math.min(50, parseInt(limit, 10) || 9));
  const skip = (pageNum - 1) * take;

  const where = {};
  if (q && q.trim()) {
    where.name = {
      contains: q.trim(),
      mode: 'insensitive'
    };
  }
  if (category && category !== 'all' && category.trim()) {
    where.category = category.trim();
  }

  const [totalItems, ingredients] = await Promise.all([
    prisma.ingredient.count({ where }),
    prisma.ingredient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        _count: { select: { dishes: true } }
      }
    })
  ]);

  const totalPages = Math.ceil(totalItems / take) || 1;

  return {
    ingredients,
    pagination: {
      totalItems,
      totalPages,
      page: pageNum,
      limit: take,
      hasPrev: pageNum > 1,
      hasNext: pageNum < totalPages,
      prevPage: pageNum - 1,
      nextPage: pageNum + 1
    }
  };
}

async function getIngredientCategories() {
  const results = await prisma.ingredient.findMany({
    select: { category: true },
    distinct: ['category']
  });
  return results.map(r => r.category).filter(Boolean);
}

async function getIngredientById(id) {
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) return null;
  return prisma.ingredient.findUnique({
    where: { id: numericId },
    include: {
      dishes: {
        include: { dish: true },
        orderBy: { dishId: 'asc' }
      }
    }
  });
}

async function createIngredient(data, file) {
  let uploadedPath = null;
  if (file) {
    const uploadResult = await imageService.uploadImage(file, 'ingredients');
    uploadedPath = uploadResult.path;
  }

  try {
    const newIngredient = await prisma.ingredient.create({
      data: {
        name: data.name,
        category: data.category || null,
        description: data.description || null,
        unit: data.unit || null,
        imagePath: uploadedPath || null
      }
    });
    return newIngredient;
  } catch (err) {
    if (uploadedPath) {
      await imageService.deleteImage(uploadedPath);
    }
    throw err;
  }
}

async function updateIngredient(id, data, file) {
  const existing = await getIngredientById(id);
  if (!existing) {
    throw new Error('Nguyên liệu không tồn tại hoặc đã bị xóa.');
  }

  let newUploadedPath = null;
  if (file) {
    const uploadResult = await imageService.uploadImage(file, 'ingredients');
    newUploadedPath = uploadResult.path;
  }

  const updateData = {
    name: data.name,
    category: data.category || null,
    description: data.description || null,
    unit: data.unit || null
  };

  if (newUploadedPath) {
    updateData.imagePath = newUploadedPath;
  }

  try {
    const updated = await prisma.ingredient.update({
      where: { id: existing.id },
      data: updateData
    });

    if (newUploadedPath && existing.imagePath) {
      await imageService.deleteImage(existing.imagePath);
    }

    return updated;
  } catch (err) {
    if (newUploadedPath) {
      await imageService.deleteImage(newUploadedPath);
    }
    throw err;
  }
}

async function deleteIngredient(id) {
  const existing = await getIngredientById(id);
  if (!existing) {
    throw new Error('Nguyên liệu không tồn tại hoặc đã bị xóa.');
  }

  if (existing.dishes.length > 0) {
    throw new Error(
      `Không thể xóa nguyên liệu "${existing.name}" vì đang được dùng trong ${existing.dishes.length} món ăn. ` +
      'Vui lòng gỡ liên kết với các món ăn trước.'
    );
  }

  const deleted = await prisma.ingredient.delete({
    where: { id: existing.id }
  });

  if (existing.imagePath) {
    await imageService.deleteImage(existing.imagePath);
  }

  return deleted;
}

module.exports = {
  getIngredients,
  getIngredientCategories,
  getIngredientById,
  createIngredient,
  updateIngredient,
  deleteIngredient
};
