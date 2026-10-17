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
 * Query dishes with search, filter, sort and server-side pagination.
 * Includes relation counts (ingredients/chefs) for admin and public cards.
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
      take,
      include: {
        _count: { select: { ingredients: true, chefs: true } }
      }
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
    take: limit,
    include: {
      _count: { select: { ingredients: true, chefs: true } }
    }
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
 * Get a single dish by ID, including its full ingredient and chef relations
 * (queried from PostgreSQL — never hard-coded).
 */
async function getDishById(id) {
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) return null;
  return prisma.dish.findUnique({
    where: { id: numericId },
    include: {
      ingredients: {
        include: { ingredient: true },
        orderBy: { ingredientId: 'asc' }
      },
      chefs: {
        include: { chef: true },
        orderBy: { chefId: 'asc' }
      }
    }
  });
}

/**
 * Options available to link from a Dish form (existing ingredients & chefs only).
 * The Dish form never creates Ingredient/Chef records.
 */
async function getRelationOptions() {
  const [ingredients, chefs] = await Promise.all([
    prisma.ingredient.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, unit: true, category: true, imagePath: true }
    }),
    prisma.chef.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, title: true, experience: true, imagePath: true }
    })
  ]);
  return { ingredients, chefs };
}

/**
 * Ensure every provided relation ID references an existing record.
 * Returns a human-readable error message, or null when all IDs are valid.
 */
async function validateRelationIds({ ingredientIds = [], chefIds = [] }) {
  const [foundIngredients, foundChefs] = await Promise.all([
    ingredientIds.length
      ? prisma.ingredient.findMany({ where: { id: { in: ingredientIds } }, select: { id: true } })
      : Promise.resolve([]),
    chefIds.length
      ? prisma.chef.findMany({ where: { id: { in: chefIds } }, select: { id: true } })
      : Promise.resolve([])
  ]);

  const foundIngredientIds = new Set(foundIngredients.map((r) => r.id));
  const foundChefIds = new Set(foundChefs.map((r) => r.id));

  const unknownIngredients = ingredientIds.filter((id) => !foundIngredientIds.has(id));
  const unknownChefs = chefIds.filter((id) => !foundChefIds.has(id));

  if (unknownIngredients.length === 0 && unknownChefs.length === 0) {
    return null;
  }

  const parts = [];
  if (unknownIngredients.length) {
    parts.push(`nguyên liệu không tồn tại: #${unknownIngredients.join(', #')}`);
  }
  if (unknownChefs.length) {
    parts.push(`đầu bếp không tồn tại: #${unknownChefs.join(', #')}`);
  }
  return `Không thể lưu vì ${parts.join('; ')}. Vui lòng chọn lại từ danh sách hợp lệ.`;
}

/**
 * Create a new dish (relations are optional).
 */
async function createDish(data, file) {
  const ingredientIds = data.ingredientIds || [];
  const chefIds = data.chefIds || [];

  const relationError = await validateRelationIds({ ingredientIds, chefIds });
  if (relationError) {
    const err = new Error(relationError);
    err.code = 'RELATION_VALIDATION';
    throw err;
  }

  let uploadedPath = null;
  if (file) {
    const uploadResult = await imageService.uploadImage(file, 'dishes');
    uploadedPath = uploadResult.path;
  }

  try {
    const newDish = await prisma.$transaction(async (tx) => {
      const dish = await tx.dish.create({
        data: {
          name: data.name,
          category: data.category,
          price: data.price,
          description: data.description || null,
          imagePath: uploadedPath || null,
          isFeatured: data.isFeatured || false
        }
      });

      if (ingredientIds.length) {
        await tx.dishIngredient.createMany({
          data: ingredientIds.map((ingredientId) => ({ dishId: dish.id, ingredientId }))
        });
      }
      if (chefIds.length) {
        await tx.dishChef.createMany({
          data: chefIds.map((chefId) => ({ dishId: dish.id, chefId }))
        });
      }
      return dish;
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
 * Update an existing dish. Relation lists are only synchronised when the form
 * actually submitted them (relationsSubmitted), so a malformed request can never
 * silently wipe existing relations. Unchanged relations are left untouched.
 */
async function updateDish(id, data, file) {
  const existingDish = await getDishById(id);
  if (!existingDish) {
    throw new Error('Món ăn không tồn tại hoặc đã bị xóa.');
  }

  const ingredientIds = data.ingredientIds || [];
  const chefIds = data.chefIds || [];

  const relationError = await validateRelationIds({ ingredientIds, chefIds });
  if (relationError) {
    const err = new Error(relationError);
    err.code = 'RELATION_VALIDATION';
    throw err;
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

  const syncRelations = data.relationsSubmitted === true;

  try {
    const updatedDish = await prisma.$transaction(async (tx) => {
      const dish = await tx.dish.update({
        where: { id: existingDish.id },
        data: updateData
      });

      if (syncRelations) {
        const currentIngredientIds = existingDish.ingredients.map((row) => row.ingredientId);
        const currentChefIds = existingDish.chefs.map((row) => row.chefId);

        const ingredientsToAdd = ingredientIds.filter((i) => !currentIngredientIds.includes(i));
        const ingredientsToRemove = currentIngredientIds.filter((i) => !ingredientIds.includes(i));
        const chefsToAdd = chefIds.filter((i) => !currentChefIds.includes(i));
        const chefsToRemove = currentChefIds.filter((i) => !chefIds.includes(i));

        if (ingredientsToRemove.length) {
          await tx.dishIngredient.deleteMany({
            where: { dishId: dish.id, ingredientId: { in: ingredientsToRemove } }
          });
        }
        if (chefsToRemove.length) {
          await tx.dishChef.deleteMany({
            where: { dishId: dish.id, chefId: { in: chefsToRemove } }
          });
        }
        if (ingredientsToAdd.length) {
          await tx.dishIngredient.createMany({
            data: ingredientsToAdd.map((ingredientId) => ({ dishId: dish.id, ingredientId }))
          });
        }
        if (chefsToAdd.length) {
          await tx.dishChef.createMany({
            data: chefsToAdd.map((chefId) => ({ dishId: dish.id, chefId }))
          });
        }
      }

      return dish;
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
 * Delete a dish. Join rows (DishIngredient / DishChef) are removed via
 * ON DELETE CASCADE on the join tables; Chef and Ingredient records are never
 * deleted as a side effect.
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
  SORT_OPTIONS,
  getDishes,
  getFeaturedDishes,
  getCategories,
  getDishById,
  getRelationOptions,
  validateRelationIds,
  createDish,
  updateDish,
  deleteDish
};
