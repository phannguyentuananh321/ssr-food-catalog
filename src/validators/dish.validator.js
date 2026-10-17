const { z } = require('zod');

const dishSchema = z.object({
  name: z.string({ required_error: 'Tên món ăn là bắt buộc' })
    .trim()
    .min(2, 'Tên món ăn phải có ít nhất 2 ký tự')
    .max(100, 'Tên món ăn không được vượt quá 100 ký tự'),
  price: z.preprocess(
    (val) => (val === '' || val === undefined ? 0 : Number(val)),
    z.number({ invalid_type_error: 'Giá món ăn phải là một số hợp lệ' })
      .min(0, 'Giá món ăn không thể âm')
  ),
  category: z.string({ required_error: 'Danh mục món ăn là bắt buộc' })
    .trim()
    .min(1, 'Vui lòng chọn hoặc nhập danh mục món ăn'),
  description: z.string().trim().optional().or(z.literal('')),
  isFeatured: z.preprocess(
    (val) => val === 'true' || val === 'on' || val === true || val === 1 || val === '1',
    z.boolean().default(false)
  )
});

/**
 * Validate dish input data
 * @param {object} data 
 * @returns {{ success: boolean, data?: object, errors?: Record<string, string> }}
 */
function validateDish(data) {
  const result = dishSchema.safeParse(data);
  if (!result.success) {
    const errors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (!errors[field]) {
        errors[field] = issue.message;
      }
    }
    return { success: false, errors };
  }
  return { success: true, data: result.data };
}

module.exports = {
  dishSchema,
  validateDish
};
