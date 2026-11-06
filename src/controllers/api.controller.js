const dishService = require('../services/dish.service');
const chefService = require('../services/chef.service');
const ingredientService = require('../services/ingredient.service');
const bookmarkService = require('../services/bookmark.service');
const { getImageUrl } = require('../services/image.service');

function renderFragment(req, view, locals) {
  return new Promise((resolve, reject) => {
    req.app.render(view, locals, (error, html) => {
      if (error) reject(error);
      else resolve(html);
    });
  });
}

function sendJsonError(res, message, status = 500) {
  res.status(status).json({ error: message });
}

/**
 * JSON endpoint used by Load More / Infinite Scroll. Returns server-rendered
 * HTML fragments so the browser never has to duplicate card markup.
 */
async function listDishes(req, res) {
  try {
    const { q, category, minPrice, maxPrice, sort, page } = req.query;
    const data = await dishService.getDishes({ q, category, minPrice, maxPrice, sort, page });
    const html = await renderFragment(req, 'partials/dish-cards', {
      dishes: data.dishes,
      getImageUrl
    });
    res.json({ html, pagination: data.pagination });
  } catch (error) {
    console.error('[API DISHES ERROR]:', error);
    sendJsonError(res, 'Không thể tải thêm món ăn.');
  }
}

async function listChefs(req, res) {
  try {
    const { q, page } = req.query;
    const data = await chefService.getChefs({ q, page });
    const html = await renderFragment(req, 'partials/chef-cards', {
      chefs: data.chefs,
      getImageUrl
    });
    res.json({ html, pagination: data.pagination });
  } catch (error) {
    console.error('[API CHEFS ERROR]:', error);
    sendJsonError(res, 'Không thể tải thêm đầu bếp.');
  }
}

async function listIngredients(req, res) {
  try {
    const { q, category, page } = req.query;
    const data = await ingredientService.getIngredients({ q, category, page });
    const html = await renderFragment(req, 'partials/ingredient-cards', {
      ingredients: data.ingredients,
      getImageUrl
    });
    res.json({ html, pagination: data.pagination });
  } catch (error) {
    console.error('[API INGREDIENTS ERROR]:', error);
    sendJsonError(res, 'Không thể tải thêm nguyên liệu.');
  }
}

/**
 * Resolve bookmarked IDs to fresh records + rendered cards. The browser keeps
 * only IDs in localStorage; this endpoint is the single source of real data.
 */
async function resolveBookmarks(req, res) {
  try {
    const dishIds = bookmarkService.parseBookmarkIds(req.query.dishes);
    const chefIds = bookmarkService.parseBookmarkIds(req.query.chefs);
    const ingredientIds = bookmarkService.parseBookmarkIds(req.query.ingredients);

    const data = await bookmarkService.resolveBookmarks({ dishIds, chefIds, ingredientIds });

    const [dishesHtml, chefsHtml, ingredientsHtml] = await Promise.all([
      renderFragment(req, 'partials/dish-cards', { dishes: data.dishes, getImageUrl }),
      renderFragment(req, 'partials/chef-cards', { chefs: data.chefs, getImageUrl }),
      renderFragment(req, 'partials/ingredient-cards', {
        ingredients: data.ingredients,
        getImageUrl
      })
    ]);

    res.set('Cache-Control', 'no-store');
    res.json({
      html: {
        dishes: dishesHtml,
        chefs: chefsHtml,
        ingredients: ingredientsHtml
      },
      validIds: {
        dishes: data.dishes.map((item) => item.id),
        chefs: data.chefs.map((item) => item.id),
        ingredients: data.ingredients.map((item) => item.id)
      }
    });
  } catch (error) {
    console.error('[API BOOKMARKS ERROR]:', error);
    sendJsonError(res, 'Không thể tải danh sách đã lưu.');
  }
}

module.exports = {
  listDishes,
  listChefs,
  listIngredients,
  resolveBookmarks
};
