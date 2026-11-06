const prisma = require('../lib/prisma');
const { getImageUrl } = require('../services/image.service');

const MAX_QUERY_LENGTH = 100;
const RESULT_LIMIT = 10;

function normalizeQuery(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sendJsonError(res, message, status = 500) {
  res.status(status).json({ error: message });
}

/**
 * Server-side Chef lookup for the admin Dish form. Deliberately uses a plain
 * case-insensitive name search (ILIKE) — not full-text/fuzzy search.
 */
async function searchChefs(req, res) {
  const q = normalizeQuery(req.query.q);
  if (!q) return res.json({ items: [] });
  if (q.length > MAX_QUERY_LENGTH) {
    return sendJsonError(res, 'Từ khóa tìm kiếm quá dài.', 400);
  }

  try {
    const chefs = await prisma.chef.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      select: { id: true, name: true, title: true, experience: true, imagePath: true },
      orderBy: { name: 'asc' },
      take: RESULT_LIMIT
    });

    res.json({
      items: chefs.map((chef) => ({ ...chef, imageUrl: getImageUrl(chef.imagePath) }))
    });
  } catch (error) {
    console.error('[ADMIN CHEF SEARCH ERROR]:', error);
    sendJsonError(res, 'Không thể tìm kiếm đầu bếp lúc này.');
  }
}

/**
 * Server-side Ingredient lookup for the admin Dish form.
 */
async function searchIngredients(req, res) {
  const q = normalizeQuery(req.query.q);
  if (!q) return res.json({ items: [] });
  if (q.length > MAX_QUERY_LENGTH) {
    return sendJsonError(res, 'Từ khóa tìm kiếm quá dài.', 400);
  }

  try {
    const ingredients = await prisma.ingredient.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      select: { id: true, name: true, unit: true, category: true, imagePath: true },
      orderBy: { name: 'asc' },
      take: RESULT_LIMIT
    });

    res.json({
      items: ingredients.map((ingredient) => ({
        ...ingredient,
        imageUrl: getImageUrl(ingredient.imagePath)
      }))
    });
  } catch (error) {
    console.error('[ADMIN INGREDIENT SEARCH ERROR]:', error);
    sendJsonError(res, 'Không thể tìm kiếm nguyên liệu lúc này.');
  }
}

module.exports = {
  searchChefs,
  searchIngredients
};
