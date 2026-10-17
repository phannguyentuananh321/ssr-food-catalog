const prisma = require('../lib/prisma');
const imageService = require('./image.service');

async function getChefs({ q, page = 1, limit = 9 }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const take = Math.max(1, Math.min(50, parseInt(limit, 10) || 9));
  const skip = (pageNum - 1) * take;

  const where = {};
  if (q && q.trim()) {
    where.name = {
      contains: q.trim(),
      mode: 'insensitive'
    };
  }

  const [totalItems, chefs] = await Promise.all([
    prisma.chef.count({ where }),
    prisma.chef.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        _count: { select: { dishes: true } }
      }
    })
  ]);

  const totalPages = Math.ceil(totalItems / take) || 1;

  return {
    chefs,
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
