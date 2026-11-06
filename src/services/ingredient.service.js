const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');
const imageService = require('./image.service');
const searchService = require('./search.service');
const { normalizePage, normalizeLimit, buildPagination } = require('../lib/pagination');

async function getIngredients({ q, category, page = 1, limit = 9 }) {
  const pageNum = normalizePage(page);
  const take = normalizeLimit(limit, 9);
  const skip = (pageNum - 1) * take;

  const categoryValue = category && category !== 'all' && category.trim()
    ? category.trim()
    : null;
  const term = q && q.trim() ? q.trim() : '';

  if (term) {
    const filters = [];
    if (categoryValue) filters.push(Prisma.sql`"category" = ${categoryValue}`);

    const { ids, totalItems } = await searchService.findMatchingIds({
      entity: 'ingredient',
      q: term,
      filters,
      take,
      skip
    });

    const rows = ids.length
      ? await prisma.ingredient.findMany({
          where: { id: { in: ids } },
          include: { _count: { select: { dishes: true } } }
        })
      : [];

    const rowsById = new Map(rows.map((row) => [row.id, row]));
    const ingredients = ids.map((id) => rowsById.get(id)).filter(Boolean);

    return {
      ingredients,
      pagination: buildPagination({ totalItems, page: pageNum, limit: take })
    };
  }

  const where = {};
  if (categoryValue) {
    where.category = categoryValue;
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

  return {
    ingredients,
    pagination: buildPagination({ totalItems, page: pageNum, limit: take })
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
