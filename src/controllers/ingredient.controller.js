const ingredientService = require('../services/ingredient.service');
const { validateIngredient } = require('../validators/ingredient.validator');
const { getImageUrl } = require('../services/image.service');

const SUCCESS_MESSAGES = {
  create: 'Đã thêm nguyên liệu mới thành công!',
  update: 'Đã cập nhật thông tin nguyên liệu thành công!',
  delete: 'Đã xóa nguyên liệu khỏi hệ thống thành công!'
};

/**
 * 1. Public Ingredient List
 */
async function renderPublicList(req, res, next) {
  try {
    const { q, category, page } = req.query;
    const [data, categories] = await Promise.all([
      ingredientService.getIngredients({ q, category, page }),
      ingredientService.getIngredientCategories()
    ]);

    res.render('ingredients/index', {
      pageTitle: 'Nguyên Liệu Bản Địa & Gia Vị Tinh Tuyển',
      currentPath: req.path,
      ingredients: data.ingredients,
      pagination: data.pagination,
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
 * 2. Public Ingredient Detail
 */
async function renderPublicDetail(req, res, next) {
  try {
    const ingredient = await ingredientService.getIngredientById(req.params.id);
    if (!ingredient) {
      return res.status(404).render('errors/404', {
        pageTitle: 'Không Tìm Thấy Nguyên Liệu',
        currentPath: req.path
      });
    }

    res.render('ingredients/show', {
      pageTitle: `${ingredient.name} | Nguyên Liệu`,
      currentPath: req.path,
      ingredient,
      getImageUrl
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 3. Admin Ingredient List (Data Table)
 */
async function renderAdminList(req, res, next) {
  try {
    const { q, category, page, success, error } = req.query;
    const [data, categories] = await Promise.all([
      ingredientService.getIngredients({ q, category, page, limit: 10 }),
      ingredientService.getIngredientCategories()
    ]);

    const successMessage = SUCCESS_MESSAGES[success] || null;
    const errorMessage = error || null;

    res.render('ingredients/admin-index', {
      pageTitle: 'Quản Lý Nguyên Liệu',
      currentPath: req.path,
      ingredients: data.ingredients,
      pagination: data.pagination,
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
 * 4. Admin Create Form
 */
async function renderCreateForm(req, res, next) {
  try {
    const categories = await ingredientService.getIngredientCategories();
    res.render('ingredients/form', {
      pageTitle: 'Thêm Nguyên Liệu Mới',
      currentPath: '/admin/ingredients',
      isEdit: false,
      ingredient: {
        name: '',
        category: categories[0] || 'Gia vị truyền thống',
        unit: 'gram',
        description: ''
      },
      categories,
      errors: {},
      getImageUrl
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 4. Submit Create Action (PRG)
 */
async function create(req, res, next) {
  try {
    const validation = validateIngredient(req.body);

    if (!validation.success) {
      const categories = await ingredientService.getIngredientCategories();
      return res.status(422).render('ingredients/form', {
        pageTitle: 'Thêm Nguyên Liệu Mới',
        currentPath: '/admin/ingredients',
        isEdit: false,
        ingredient: req.body,
        categories,
        errors: validation.errors,
        errorMessage: 'Vui lòng kiểm tra lại các trường thông tin bị lỗi.',
        getImageUrl
      });
    }

    await ingredientService.createIngredient(validation.data, req.file);
    res.redirect(303, '/admin/ingredients?success=create');
  } catch (error) {
    console.error('[CREATE INGREDIENT ERROR]:', error);
    try {
      const categories = await ingredientService.getIngredientCategories();
      res.status(500).render('ingredients/form', {
        pageTitle: 'Thêm Nguyên Liệu Mới',
        currentPath: '/admin/ingredients',
        isEdit: false,
        ingredient: req.body,
        categories,
        errors: {},
        errorMessage: `Lỗi khi lưu nguyên liệu: ${error.message}`,
        getImageUrl
      });
    } catch (e) {
      next(error);
    }
  }
}

/**
 * 5. Admin Edit Form
 */
async function renderEditForm(req, res, next) {
  try {
    const [ingredient, categories] = await Promise.all([
      ingredientService.getIngredientById(req.params.id),
      ingredientService.getIngredientCategories()
    ]);

    if (!ingredient) {
      return res.status(404).render('errors/404', {
        pageTitle: 'Không Tìm Thấy Nguyên Liệu',
        currentPath: '/admin/ingredients'
      });
    }

    res.render('ingredients/form', {
      pageTitle: `Chỉnh Sửa: ${ingredient.name}`,
      currentPath: '/admin/ingredients',
      isEdit: true,
      ingredient,
      categories,
      errors: {},
      getImageUrl
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 5. Submit Update Action (PRG with PATCH)
 */
async function update(req, res, next) {
  try {
    const validation = validateIngredient(req.body);

    if (!validation.success) {
      const [existing, categories] = await Promise.all([
        ingredientService.getIngredientById(req.params.id),
        ingredientService.getIngredientCategories()
      ]);

      return res.status(422).render('ingredients/form', {
        pageTitle: `Chỉnh Sửa: ${req.body.name || 'Nguyên Liệu'}`,
        currentPath: '/admin/ingredients',
        isEdit: true,
        ingredient: {
          ...req.body,
          id: req.params.id,
          imagePath: existing ? existing.imagePath : null
        },
        categories,
        errors: validation.errors,
        errorMessage: 'Vui lòng kiểm tra lại các trường thông tin bị lỗi.',
        getImageUrl
      });
    }

    await ingredientService.updateIngredient(req.params.id, validation.data, req.file);
    res.redirect(303, '/admin/ingredients?success=update');
  } catch (error) {
    console.error('[UPDATE INGREDIENT ERROR]:', error);
    try {
      const [existing, categories] = await Promise.all([
        ingredientService.getIngredientById(req.params.id),
        ingredientService.getIngredientCategories()
      ]);
      res.status(500).render('ingredients/form', {
        pageTitle: `Chỉnh Sửa: ${req.body.name || 'Nguyên Liệu'}`,
        currentPath: '/admin/ingredients',
        isEdit: true,
        ingredient: {
          ...req.body,
          id: req.params.id,
          imagePath: existing ? existing.imagePath : null
        },
        categories,
        errors: {},
        errorMessage: `Lỗi khi cập nhật nguyên liệu: ${error.message}`,
        getImageUrl
      });
    } catch (e) {
      next(error);
    }
  }
}

/**
 * Submit Delete Action (PRG with DELETE)
 */
async function remove(req, res, next) {
  try {
    await ingredientService.deleteIngredient(req.params.id);
    res.redirect(303, '/admin/ingredients?success=delete');
  } catch (error) {
    console.error('[DELETE INGREDIENT ERROR]:', error);
    res.redirect(303, `/admin/ingredients?error=${encodeURIComponent('Không thể xóa nguyên liệu: ' + error.message)}`);
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
