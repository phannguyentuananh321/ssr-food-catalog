const prisma = require('../lib/prisma');

const MAX_IDS_PER_TYPE = 200;

/**
 * Parse a comma-separated ID list from the query string into a bounded,
 * de-duplicated list of positive integers.
 */
function parseBookmarkIds(value) {
  if (typeof value !== 'string' || !value.trim()) return [];
  const ids = value
    .split(',')
    .map((part) => parseInt(part, 10))
    .filter((id) => Number.isInteger(id) && id > 0);
  return Array.from(new Set(ids)).slice(0, MAX_IDS_PER_TYPE);
}

function orderByIds(rows, ids) {
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => rowsById.get(id)).filter(Boolean);
}

/**
 * Resolve bookmarked IDs against the database so the bookmark page always shows
 * the latest data. IDs that no longer exist are simply absent from the result.
 */
async function resolveBookmarks({ dishIds = [], chefIds = [], ingredientIds = [] }) {
  const [dishes, chefs, ingredients] = await Promise.all([
    dishIds.length
      ? prisma.dish.findMany({
          where: { id: { in: dishIds } },
          include: { _count: { select: { ingredients: true, chefs: true } } }
        })
      : Promise.resolve([]),
    chefIds.length
      ? prisma.chef.findMany({
          where: { id: { in: chefIds } },
          include: { _count: { select: { dishes: true } } }
        })
      : Promise.resolve([]),
    ingredientIds.length
      ? prisma.ingredient.findMany({
          where: { id: { in: ingredientIds } },
          include: { _count: { select: { dishes: true } } }
        })
      : Promise.resolve([])
  ]);

  return {
    dishes: orderByIds(dishes, dishIds),
    chefs: orderByIds(chefs, chefIds),
    ingredients: orderByIds(ingredients, ingredientIds)
  };
}

module.exports = {
  MAX_IDS_PER_TYPE,
  parseBookmarkIds,
  resolveBookmarks
};
