const chefService = require('../services/chef.service');
const { validateChef } = require('../validators/chef.validator');
const { getImageUrl } = require('../services/image.service');

const SUCCESS_MESSAGES = {
  create: 'Đã thêm hồ sơ đầu bếp mới thành công!',
  update: 'Đã cập nhật thông tin đầu bếp thành công!',
  delete: 'Đã xóa đầu bếp khỏi hệ thống thành công!'
};

/**
 * 1. Public Chef List
 */
async function renderPublicList(req, res, next) {
  try {
    const { q, page } = req.query;
    const chefData = await chefService.getChefs({ q, page });

    res.render('chefs/index', {
      pageTitle: 'Đội Ngũ Đầu Bếp Tinh Hoa',
      currentPath: req.path,
      chefs: chefData.chefs,
      pagination: chefData.pagination,
      queryParams: req.query,
      enableVanta: true,
      getImageUrl
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 2. Public Chef Detail
 */
async function renderPublicDetail(req, res, next) {
  try {
    const chef = await chefService.getChefById(req.params.id);
    if (!chef) {
      return res.status(404).render('errors/404', {
        pageTitle: 'Không Tìm Thấy Đầu Bếp',
        currentPath: req.path
      });
    }

    res.render('chefs/show', {
      pageTitle: `${chef.name} | Đầu Bếp`,
      currentPath: req.path,
      chef,
      getImageUrl
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 3. Admin Chef List (Data Table)
 */
async function renderAdminList(req, res, next) {
  try {
    const { q, page, success, error } = req.query;
    const chefData = await chefService.getChefs({ q, page, limit: 10 });

    const successMessage = SUCCESS_MESSAGES[success] || null;
    const errorMessage = error || null;

    res.render('chefs/admin-index', {
      pageTitle: 'Quản Lý Đầu Bếp',
      currentPath: req.path,
      chefs: chefData.chefs,
      pagination: chefData.pagination,
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
function renderCreateForm(req, res) {
  res.render('chefs/form', {
    pageTitle: 'Thêm Đầu Bếp Mới',
    currentPath: '/admin/chefs',
    isEdit: false,
    chef: {
      name: '',
      title: '',
      experience: '',
      description: '',
      isFeatured: false
    },
    errors: {},
    getImageUrl
  });
}

/**
 * 4. Submit Create Action (PRG)
 */
async function create(req, res, next) {
  try {
    const validation = validateChef(req.body);

    if (!validation.success) {
      return res.status(422).render('chefs/form', {
        pageTitle: 'Thêm Đầu Bếp Mới',
        currentPath: '/admin/chefs',
        isEdit: false,
        chef: req.body,
        errors: validation.errors,
        errorMessage: 'Vui lòng kiểm tra lại các trường thông tin bị lỗi.',
        getImageUrl
      });
    }

    await chefService.createChef(validation.data, req.file);
    res.redirect(303, '/admin/chefs?success=create');
  } catch (error) {
    console.error('[CREATE CHEF ERROR]:', error);
    res.status(500).render('chefs/form', {
      pageTitle: 'Thêm Đầu Bếp Mới',
      currentPath: '/admin/chefs',
      isEdit: false,
      chef: req.body,
      errors: {},
      errorMessage: `Lỗi khi lưu đầu bếp: ${error.message}`,
      getImageUrl
    });
  }
}

/**
 * 5. Admin Edit Form
 */
async function renderEditForm(req, res, next) {
  try {
    const chef = await chefService.getChefById(req.params.id);
    if (!chef) {
      return res.status(404).render('errors/404', {
        pageTitle: 'Không Tìm Thấy Đầu Bếp',
        currentPath: '/admin/chefs'
      });
    }

    res.render('chefs/form', {
      pageTitle: `Chỉnh Sửa: ${chef.name}`,
      currentPath: '/admin/chefs',
      isEdit: true,
      chef,
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
    const validation = validateChef(req.body);

    if (!validation.success) {
      const existing = await chefService.getChefById(req.params.id);
      return res.status(422).render('chefs/form', {
        pageTitle: `Chỉnh Sửa: ${req.body.name || 'Đầu Bếp'}`,
        currentPath: '/admin/chefs',
        isEdit: true,
        chef: {
          ...req.body,
          id: req.params.id,
          imagePath: existing ? existing.imagePath : null
        },
        errors: validation.errors,
        errorMessage: 'Vui lòng kiểm tra lại các trường thông tin bị lỗi.',
        getImageUrl
      });
    }

    await chefService.updateChef(req.params.id, validation.data, req.file);
    res.redirect(303, '/admin/chefs?success=update');
  } catch (error) {
    console.error('[UPDATE CHEF ERROR]:', error);
    const existing = await chefService.getChefById(req.params.id);
    res.status(500).render('chefs/form', {
      pageTitle: `Chỉnh Sửa: ${req.body.name || 'Đầu Bếp'}`,
      currentPath: '/admin/chefs',
      isEdit: true,
      chef: {
        ...req.body,
        id: req.params.id,
        imagePath: existing ? existing.imagePath : null
      },
      errors: {},
      errorMessage: `Lỗi khi cập nhật đầu bếp: ${error.message}`,
      getImageUrl
    });
  }
}

/**
 * Submit Delete Action (PRG with DELETE)
 */
async function remove(req, res, next) {
  try {
    await chefService.deleteChef(req.params.id);
    res.redirect(303, '/admin/chefs?success=delete');
  } catch (error) {
    console.error('[DELETE CHEF ERROR]:', error);
    res.redirect(303, `/admin/chefs?error=${encodeURIComponent('Không thể xóa đầu bếp: ' + error.message)}`);
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
