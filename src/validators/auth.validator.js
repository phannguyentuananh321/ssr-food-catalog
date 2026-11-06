const { z } = require('zod');

const emailSchema = z.string({ required_error: 'Email là bắt buộc' })
  .trim()
  .toLowerCase()
  .email('Email không hợp lệ')
  .max(254, 'Email quá dài');

const passwordSchema = z.string({ required_error: 'Mật khẩu là bắt buộc' })
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .max(72, 'Mật khẩu không được vượt quá 72 ký tự');

const registerSchema = z.object({
  username: z.string({ required_error: 'Tên đăng nhập là bắt buộc' })
    .trim()
    .min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự')
    .max(32, 'Tên đăng nhập không được vượt quá 32 ký tự')
    .regex(/^[\p{L}\p{N}_]+$/u, 'Tên đăng nhập chỉ gồm chữ, số và dấu gạch dưới'),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string({ required_error: 'Vui lòng xác nhận mật khẩu' })
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword']
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: 'Mật khẩu là bắt buộc' }).min(1, 'Mật khẩu là bắt buộc').max(200)
});

const passwordResetSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string({ required_error: 'Vui lòng xác nhận mật khẩu' })
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword']
});

const otpSchema = z.object({
  email: emailSchema,
  token: z.string({ required_error: 'Mã xác minh là bắt buộc' }).trim().min(4, 'Mã xác minh không hợp lệ').max(12)
});

function flattenIssues(result) {
  const errors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] || 'form';
    if (!errors[field]) errors[field] = issue.message;
  }
  return errors;
}

function validateRegister(data) {
  const result = registerSchema.safeParse(data);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: flattenIssues(result) };
}

function validateLogin(data) {
  const result = loginSchema.safeParse(data);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: flattenIssues(result) };
}

function validatePasswordReset(data) {
  const result = passwordResetSchema.safeParse(data);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: flattenIssues(result) };
}

function validateOtp(data) {
  const result = otpSchema.safeParse(data);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: flattenIssues(result) };
}

module.exports = {
  registerSchema,
  loginSchema,
  passwordResetSchema,
  otpSchema,
  validateRegister,
  validateLogin,
  validatePasswordReset,
  validateOtp
};
