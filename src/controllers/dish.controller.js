const dishService = require('../services/dish.service');
const { validateDish, normalizeIdList } = require('../validators/dish.validator');
const { getImageUrl } = require('../services/image.service');

const SUCCESS_MESSAGES = {
  create: 'Đã thêm món ăn mới vào thực đơn thành công!',
  update: 'Đã cập nhật thông tin món ăn thành công!',
  delete: 'Đã xóa món ăn khỏi hệ thống thành công!'
};

/**
 * Build the locals needed to render the create/edit form, including the
 * available Ingredient and Chef options and the currently selected IDs.
 */
async function buildFormLocals({ dish, errors, errorMessage }) {
  const { ingredients, chefs } = await dishService.getRelationOptions();
  const selectedIngredientIds = normalizeIdList(dish ? dish.ingredientIds : []);
  const selectedChefIds = normalizeIdList(dish ? dish.chefIds : []);
  return {
    dish,
    errors: errors || {},
    errorMessage,
    ingredientOptions: ingredients,
    chefOptions: chefs,
    selectedIngredientIds,
    selectedChefIds
  };
}

/**
 * 1. Public List Page (Option 3: Hero Slider + Món Nổi Bật + Search/Filter/Sort/Pagination)
 */
async function renderPublicList(req, res, next) {
  try {
    const { q, category, minPrice, maxPrice, sort, page } = req.query;

    const [dishData, featuredDishes, categories] = await Promise.all([
      dishService.getDishes({ q, category, minPrice, maxPrice, sort, page }),
      dishService.getFeaturedDishes(4),
      dishService.getCategories()
    ]);

    res.render('dishes/index', {
      pageTitle: 'Thực Đơn Tinh Tuyển',
      currentPath: req.path,
      dishes: dishData.dishes,
      pagination: dishData.pagination,
      featuredDishes,
      categories,
      queryParams: req.query,
      enableVanta: true,
      getImageUrl
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 2. Public Detail Page
 */
async function renderPublicDetail(req, res, next) {
  try {
    const dish = await dishService.getDishById(req.params.id);
    if (!dish) {
      return res.status(404).render('errors/404', {
        pageTitle: 'Không Tìm Thấy Món Ăn',
        currentPath: req.path
      });
    }

    res.render('dishes/show', {
      pageTitle: `${dish.name} | Chi Tiết Món Ăn`,
      currentPath: req.path,
      dish,
      getImageUrl
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 3. Admin Data Table List Page (Option 2: Data Table)
 */
async function renderAdminList(req, res, next) {
  try {
    const { q, category, page, success, error } = req.query;

    const [dishData, categories] = await Promise.all([
      dishService.getDishes({ q, category, page, limit: 10 }),
      dishService.getCategories()
    ]);

    const successMessage = SUCCESS_MESSAGES[success] || null;
    const errorMessage = error || null;

    res.render('dishes/admin-index', {
      pageTitle: 'Quản Lý Món Ăn',
      currentPath: req.path,
      dishes: dishData.dishes,
      pagination: dishData.pagination,
      categories,
      queryParams: req.query,
      successMessage,
      errorMessage,
      getImageUrl
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 4. Admin Create Form Page
 */
async function renderCreateForm(req, res, next) {
  try {
    const categories = await dishService.getCategories();
    const locals = await buildFormLocals({
      dish: {
        name: '',
        category: categories[0] || 'Món chính',
        price: '',
        description: '',
        isFeatured: false
      },
      errors: {}
    });

    res.render('dishes/form', {
      pageTitle: 'Thêm Món Ăn Mới',
      currentPath: '/admin/dishes',
      isEdit: false,
      categories,
      getImageUrl,
      ...locals
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 4. Submit Create Action (PRG)
 */
async function create(req, res, next) {
  const categories = await dishService.getCategories().catch(() => []);
  try {
    const validation = validateDish(req.body);

    if (!validation.success) {
      const locals = await buildFormLocals({
        dish: req.body,
        errors: validation.errors,
        errorMessage: 'Vui lòng kiểm tra lại các trường thông tin bị lỗi.'
      });
      return res.status(422).render('dishes/form', {
        pageTitle: 'Thêm Món Ăn Mới',
        currentPath: '/admin/dishes',
        isEdit: false,
        categories,
        getImageUrl,
        ...locals
      });
    }

    await dishService.createDish(validation.data, req.file);
    // PRG 303 Redirect
    res.redirect(303, '/admin/dishes?success=create');
  } catch (error) {
    console.error('[CREATE DISH CONTROLLER ERROR]:', error);
    const errors = error.code === 'RELATION_VALIDATION' ? { relations: error.message } : {};
    try {
      const locals = await buildFormLocals({
        dish: req.body,
        errors,
        errorMessage: error.code === 'RELATION_VALIDATION'
          ? error.message
          : `Lỗi khi lưu món ăn: ${error.message}`
      });
      return res.status(error.code === 'RELATION_VALIDATION' ? 422 : 500).render('dishes/form', {
        pageTitle: 'Thêm Món Ăn Mới',
        currentPath: '/admin/dishes',
        isEdit: false,
        categories,
        getImageUrl,
        ...locals
      });
    } catch (e) {
      next(error);
    }
  }
}

/**
 * 5. Admin Edit Form Page
 */
async function renderEditForm(req, res, next) {
  try {
    const [dish, categories] = await Promise.all([
      dishService.getDishById(req.params.id),
      dishService.getCategories()
    ]);

    if (!dish) {
      return res.status(404).render('errors/404', {
        pageTitle: 'Không Tìm Thấy Món Ăn',
        currentPath: '/admin/dishes'
      });
    }

    const locals = await buildFormLocals({ dish, errors: {} });

    res.render('dishes/form', {
      pageTitle: `Chỉnh Sửa: ${dish.name}`,
      currentPath: '/admin/dishes',
      isEdit: true,
      categories,
      getImageUrl,
      ...locals
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 5. Submit Update Action (PRG with PATCH via method-override)
 */
async function update(req, res, next) {
  const categories = await dishService.getCategories().catch(() => []);
  try {
    const validation = validateDish(req.body);

    if (!validation.success) {
      const existing = await dishService.getDishById(req.params.id);
      const locals = await buildFormLocals({
        dish: {
          ...req.body,
          id: req.params.id,
          imagePath: existing ? existing.imagePath : null
        },
        errors: validation.errors,
        errorMessage: 'Vui lòng kiểm tra lại các trường thông tin bị lỗi.'
      });
      return res.status(422).render('dishes/form', {
        pageTitle: `Chỉnh Sửa: ${req.body.name || 'Món Ăn'}`,
        currentPath: '/admin/dishes',
        isEdit: true,
        categories,
        getImageUrl,
        ...locals
      });
    }

    await dishService.updateDish(req.params.id, validation.data, req.file);
    // PRG 303 Redirect
    res.redirect(303, '/admin/dishes?success=update');
  } catch (error) {
    console.error('[UPDATE DISH CONTROLLER ERROR]:', error);
    try {
      const existing = await dishService.getDishById(req.params.id);
      const isRelationError = error.code === 'RELATION_VALIDATION';
      const locals = await buildFormLocals({
        dish: {
          ...req.body,
          id: req.params.id,
          imagePath: existing ? existing.imagePath : null
        },
        errors: isRelationError ? { relations: error.message } : {},
        errorMessage: isRelationError ? error.message : `Lỗi khi cập nhật món ăn: ${error.message}`
      });
      return res.status(isRelationError ? 422 : 500).render('dishes/form', {
        pageTitle: `Chỉnh Sửa: ${req.body.name || 'Món Ăn'}`,
        currentPath: '/admin/dishes',
        isEdit: true,
        categories,
        getImageUrl,
        ...locals
      });
    } catch (e) {
      next(error);
    }
  }
}

/**
 * Submit Delete Action (PRG with DELETE via method-override)
 */
async function remove(req, res, next) {
  try {
    await dishService.deleteDish(req.params.id);
    // PRG 303 Redirect
    res.redirect(303, '/admin/dishes?success=delete');
  } catch (error) {
    console.error('[DELETE DISH CONTROLLER ERROR]:', error);
    res.redirect(303, `/admin/dishes?error=${encodeURIComponent('Không thể xóa món ăn: ' + error.message)}`);
  }
}

module.exports = {
  renderPublicList,
  renderPublicDetail,
  renderAdminList,
  renderCreateForm,
  create,
  renderEditForm,
  update,
  remove
};
