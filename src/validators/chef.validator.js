const { z } = require('zod');

const chefSchema = z.object({
  name: z.string({ required_error: 'Tên đầu bếp là bắt buộc' })
    .trim()
    .min(2, 'Tên đầu bếp phải có ít nhất 2 ký tự')
    .max(100, 'Tên đầu bếp không được vượt quá 100 ký tự'),
  title: z.string().trim().optional().or(z.literal('')),
  description: z.string().trim().optional().or(z.literal('')),
  experience: z.string().trim().optional().or(z.literal('')),
  isFeatured: z.preprocess(
    (val) => val === 'true' || val === 'on' || val === true || val === 1 || val === '1',
    z.boolean().default(false)
  )
});

function validateChef(data) {
  const result = chefSchema.safeParse(data);
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
  chefSchema,
  validateChef
};
