const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');
const imageService = require('./image.service');
const searchService = require('./search.service');
const { normalizePage, normalizeLimit, buildPagination } = require('../lib/pagination');

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
  const pageNum = normalizePage(page);
  const take = normalizeLimit(limit, 9);
  const skip = (pageNum - 1) * take;

  const categoryValue = category && category !== 'all' && category.trim()
    ? category.trim()
    : null;

  const minValue = minPrice !== undefined && minPrice !== '' && !isNaN(Number(minPrice))
    ? Math.max(0, Number(minPrice))
    : null;
  const maxValue = maxPrice !== undefined && maxPrice !== '' && !isNaN(Number(maxPrice))
    ? Math.max(0, Number(maxPrice))
    : null;

  const term = q && q.trim() ? q.trim() : '';

  // PostgreSQL full-text + fuzzy search. Only the matching ID page is returned
  // from the database; the rows are hydrated afterwards with Prisma.
  if (term) {
    const filters = [];
    if (categoryValue) filters.push(Prisma.sql`"category" = ${categoryValue}`);
    if (minValue !== null) filters.push(Prisma.sql`"price" >= ${minValue}`);
    if (maxValue !== null) filters.push(Prisma.sql`"price" <= ${maxValue}`);

    const { ids, totalItems } = await searchService.findMatchingIds({
      entity: 'dish',
      q: term,
      filters,
      sort,
      take,
      skip
    });

    const rows = ids.length
      ? await prisma.dish.findMany({
          where: { id: { in: ids } },
          include: {
            _count: { select: { ingredients: true, chefs: true } }
          }
        })
      : [];

    const rowsById = new Map(rows.map((row) => [row.id, row]));
    const dishes = ids.map((id) => rowsById.get(id)).filter(Boolean);

    return {
      dishes,
      pagination: buildPagination({ totalItems, page: pageNum, limit: take })
    };
  }

  const where = {};

  if (categoryValue) {
    where.category = categoryValue;
  }

  const priceFilter = {};
  if (minValue !== null) priceFilter.gte = minValue;
  if (maxValue !== null) priceFilter.lte = maxValue;
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

  return {
    dishes,
    pagination: buildPagination({ totalItems, page: pageNum, limit: take })
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
 * Load only the Chef/Ingredient records that are currently selected in the Dish
 * form. The admin form no longer loads the full relation lists into the page.
 */
async function getRelationSummaries({ ingredientIds = [], chefIds = [] }) {
  const [ingredients, chefs] = await Promise.all([
    ingredientIds.length
      ? prisma.ingredient.findMany({
          where: { id: { in: ingredientIds } },
          select: { id: true, name: true, unit: true, category: true, imagePath: true }
        })
      : Promise.resolve([]),
    chefIds.length
      ? prisma.chef.findMany({
          where: { id: { in: chefIds } },
          select: { id: true, name: true, title: true, experience: true, imagePath: true }
        })
      : Promise.resolve([])
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
  getRelationSummaries,
  validateRelationIds,
  createDish,
  updateDish,
  deleteDish
};
