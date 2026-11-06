const prisma = require('../lib/prisma');
const imageService = require('./image.service');
const searchService = require('./search.service');
const { normalizePage, normalizeLimit, buildPagination } = require('../lib/pagination');

async function getChefs({ q, page = 1, limit = 9 }) {
  const pageNum = normalizePage(page);
  const take = normalizeLimit(limit, 9);
  const skip = (pageNum - 1) * take;
  const term = q && q.trim() ? q.trim() : '';

  if (term) {
    const { ids, totalItems } = await searchService.findMatchingIds({
      entity: 'chef',
      q: term,
      take,
      skip
    });

    const rows = ids.length
      ? await prisma.chef.findMany({
          where: { id: { in: ids } },
          include: { _count: { select: { dishes: true } } }
        })
      : [];

    const rowsById = new Map(rows.map((row) => [row.id, row]));
    const chefs = ids.map((id) => rowsById.get(id)).filter(Boolean);

    return {
      chefs,
      pagination: buildPagination({ totalItems, page: pageNum, limit: take })
    };
  }

  const [totalItems, chefs] = await Promise.all([
    prisma.chef.count(),
    prisma.chef.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        _count: { select: { dishes: true } }
      }
    })
  ]);

  return {
    chefs,
    pagination: buildPagination({ totalItems, page: pageNum, limit: take })
  };
}

async function getChefById(id) {
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) return null;
  return prisma.chef.findUnique({
    where: { id: numericId },
    include: {
      dishes: {
        include: { dish: true },
        orderBy: { dishId: 'asc' }
      }
    }
  });
}

async function createChef(data, file) {
  let uploadedPath = null;
  if (file) {
    const uploadResult = await imageService.uploadImage(file, 'chefs');
    uploadedPath = uploadResult.path;
  }

  try {
    const newChef = await prisma.chef.create({
      data: {
        name: data.name,
        title: data.title || null,
        description: data.description || null,
        experience: data.experience || null,
        imagePath: uploadedPath || null,
        isFeatured: data.isFeatured || false
      }
    });
    return newChef;
  } catch (err) {
    if (uploadedPath) {
      await imageService.deleteImage(uploadedPath);
    }
    throw err;
  }
}

async function updateChef(id, data, file) {
  const existingChef = await getChefById(id);
  if (!existingChef) {
    throw new Error('Đầu bếp không tồn tại hoặc đã bị xóa.');
  }

  let newUploadedPath = null;
  if (file) {
    const uploadResult = await imageService.uploadImage(file, 'chefs');
    newUploadedPath = uploadResult.path;
  }

  const updateData = {
    name: data.name,
    title: data.title || null,
    description: data.description || null,
    experience: data.experience || null,
    isFeatured: data.isFeatured !== undefined ? data.isFeatured : existingChef.isFeatured
  };

  if (newUploadedPath) {
    updateData.imagePath = newUploadedPath;
  }

  try {
    const updatedChef = await prisma.chef.update({
      where: { id: existingChef.id },
      data: updateData
    });

    if (newUploadedPath && existingChef.imagePath) {
      await imageService.deleteImage(existingChef.imagePath);
    }

    return updatedChef;
  } catch (err) {
    if (newUploadedPath) {
      await imageService.deleteImage(newUploadedPath);
    }
    throw err;
  }
}

async function deleteChef(id) {
  const existingChef = await getChefById(id);
  if (!existingChef) {
    throw new Error('Đầu bếp không tồn tại hoặc đã bị xóa.');
  }

  if (existingChef.dishes.length > 0) {
    throw new Error(
      `Không thể xóa đầu bếp "${existingChef.name}" vì đang phụ trách ${existingChef.dishes.length} món ăn. ` +
      'Vui lòng gỡ liên kết với các món ăn trước.'
    );
  }

  const deleted = await prisma.chef.delete({
    where: { id: existingChef.id }
  });

  if (existingChef.imagePath) {
    await imageService.deleteImage(existingChef.imagePath);
  }

  return deleted;
}

module.exports = {
  getChefs,
  getChefById,
  createChef,
  updateChef,
  deleteChef
};
