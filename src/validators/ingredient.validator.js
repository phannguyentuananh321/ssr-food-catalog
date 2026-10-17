const { z } = require('zod');

const ingredientSchema = z.object({
  name: z.string({ required_error: 'Tên nguyên liệu là bắt buộc' })
    .trim()
    .min(2, 'Tên nguyên liệu phải có ít nhất 2 ký tự')
    .max(100, 'Tên nguyên liệu không được vượt quá 100 ký tự'),
  category: z.string().trim().optional().or(z.literal('')),
  description: z.string().trim().optional().or(z.literal('')),
  unit: z.string().trim().optional().or(z.literal(''))
});

function validateIngredient(data) {
  const result = ingredientSchema.safeParse(data);
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
  ingredientSchema,
  validateIngredient
};
