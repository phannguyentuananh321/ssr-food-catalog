const prisma = require('../lib/prisma');
const imageService = require('./image.service');

const SORT_OPTIONS = {
  'newest': { createdAt: 'desc' },
  'price-asc': { price: 'asc' },
  'price-desc': { price: 'desc' },
  'name-asc': { name: 'asc' },
  'name-desc': { name: 'desc' }
};

/**
 * Query dishes with search, filter, sort and server-side pagination
 */
async function getDishes({ q, category, minPrice, maxPrice, sort = 'newest', page = 1, limit = 9 }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const take = Math.max(1, Math.min(50, parseInt(limit, 10) || 9));
  const skip = (pageNum - 1) * take;

  const where = {};

  // Search by dish name
  if (q && q.trim()) {
    where.name = {
      contains: q.trim(),
      mode: 'insensitive'
    };
  }

  // Filter by category
  if (category && category !== 'all' && category.trim()) {
    where.category = category.trim();
  }

  // Filter by price range
  const priceFilter = {};
  if (minPrice !== undefined && minPrice !== '' && !isNaN(Number(minPrice))) {
    const minVal = Math.max(0, Number(minPrice));
    priceFilter.gte = minVal;
  }
  if (maxPrice !== undefined && maxPrice !== '' && !isNaN(Number(maxPrice))) {
    const maxVal = Math.max(0, Number(maxPrice));
    priceFilter.lte = maxVal;
  }
  if (Object.keys(priceFilter).length > 0) {
    where.price = priceFilter;
  }

  // Safe sort ordering
  const orderBy = SORT_OPTIONS[sort] || SORT_OPTIONS['newest'];

  const [totalItems, dishes] = await Promise.all([
    prisma.dish.count({ where }),
    prisma.dish.findMany({
      where,
      orderBy,
      skip,
      take
    })
  ]);

  const totalPages = Math.ceil(totalItems / take) || 1;

  return {
    dishes,
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

/**
 * Get featured dishes for Hero section / slider
 */
async function getFeaturedDishes(limit = 4) {
  return prisma.dish.findMany({
    where: { isFeatured: true },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

/**
 * Get all unique dish categories
 */
async function getCategories() {
  const dishes = await prisma.dish.findMany({
    select: { category: true },
    distinct: ['category']
  });
  return dishes.map((d) => d.category).filter(Boolean);
}

/**
 * Get a single dish by ID
 */
async function getDishById(id) {
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) return null;
  return prisma.dish.findUnique({
    where: { id: numericId }
  });
}

/**
 * Create a new dish with safe image upload
 */
async function createDish(data, file) {
  let uploadedPath = null;

  if (file) {
    const uploadResult = await imageService.uploadImage(file, 'dishes');
    uploadedPath = uploadResult.path;
  }

  try {
    const newDish = await prisma.dish.create({
      data: {
        name: data.name,
        category: data.category,
        price: data.price,
        description: data.description || null,
        imagePath: uploadedPath || null,
        isFeatured: data.isFeatured || false
      }
    });
    return newDish;
  } catch (err) {
    // Partial failure: cleanup newly uploaded image if database insert failed
    if (uploadedPath) {
      await imageService.deleteImage(uploadedPath);
    }
    throw err;
  }
}

/**
 * Update an existing dish
 */
async function updateDish(id, data, file) {
  const existingDish = await getDishById(id);
  if (!existingDish) {
    throw new Error('Món ăn không tồn tại hoặc đã bị xóa.');
  }

  let newUploadedPath = null;
  if (file) {
    const uploadResult = await imageService.uploadImage(file, 'dishes');
    newUploadedPath = uploadResult.path;
  }

  const updateData = {
    name: data.name,
    category: data.category,
    price: data.price,
    description: data.description || null,
    isFeatured: data.isFeatured !== undefined ? data.isFeatured : existingDish.isFeatured
  };

  if (newUploadedPath) {
    updateData.imagePath = newUploadedPath;
  }

  try {
    const updatedDish = await prisma.dish.update({
      where: { id: existingDish.id },
      data: updateData
    });

    // If new image was uploaded and database update succeeded, cleanup the old image
    if (newUploadedPath && existingDish.imagePath) {
      await imageService.deleteImage(existingDish.imagePath);
    }

    return updatedDish;
  } catch (err) {
    // Partial failure cleanup
    if (newUploadedPath) {
      await imageService.deleteImage(newUploadedPath);
    }
    throw err;
  }
}

/**
 * Delete a dish and its corresponding storage image
 */
async function deleteDish(id) {
  const existingDish = await getDishById(id);
  if (!existingDish) {
    throw new Error('Món ăn không tồn tại hoặc đã bị xóa.');
  }

  const deleted = await prisma.dish.delete({
    where: { id: existingDish.id }
  });

  if (existingDish.imagePath) {
    await imageService.deleteImage(existingDish.imagePath);
  }

  return deleted;
}

module.exports = {
  getDishes,
  getFeaturedDishes,
  getCategories,
  getDishById,
  createDish,
  updateDish,
  deleteDish
};
