const { z } = require('zod');
const { isCommonPassword } = require('../lib/common-passwords');
const { normalizeEmail } = require('../lib/tokens');

const emailSchema = z.string({ required_error: 'Vui lòng nhập email' })
  .trim()
  .email('Email không đúng định dạng');

const passwordSchema = z.string({ required_error: 'Vui lòng nhập mật khẩu' })
  .min(10, 'Mật khẩu phải có từ 10 đến 64 ký tự')
  .max(64, 'Mật khẩu phải có từ 10 đến 64 ký tự')
  .refine((val) => !isCommonPassword(val), {
    message: 'Mật khẩu quá phổ biến và dễ đoán. Vui lòng chọn mật khẩu mạnh hơn'
  });

const registerSchema = z.object({
  email: emailSchema,
  displayName: z.string()
    .trim()
    .max(50, 'Tên hiển thị tối đa 50 ký tự')
    .optional()
    .or(z.literal('')),
  username: z.string().trim().max(50).optional().or(z.literal('')),
  password: passwordSchema,
  confirmPassword: z.string().optional()
}).superRefine((data, ctx) => {
  const normEmail = normalizeEmail(data.email);
  const passwordLower = (data.password || '').toLowerCase();

  // Mật khẩu khác email
  if (data.email && (passwordLower === data.email.toLowerCase() || (normEmail && passwordLower === normEmail))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Mật khẩu không được trùng với email',
      path: ['password']
    });
  }

  if (data.confirmPassword !== undefined && data.confirmPassword !== data.password) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Mật khẩu xác nhận không khớp',
      path: ['confirmPassword']
    });
  }
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: 'Vui lòng nhập mật khẩu' }).min(1, 'Vui lòng nhập mật khẩu')
});

const activateSchema = z.object({
  email: emailSchema,
  otp: z.string({ required_error: 'Vui lòng nhập mã OTP' }).trim().regex(/^\d{6}$/, 'Mã OTP gồm 6 chữ số')
});

const resendOtpSchema = z.object({
  email: emailSchema
});

const forgotSchema = z.object({
  email: emailSchema
});

const passwordResetSchema = z.object({
  token: z.string({ required_error: 'Token không hợp lệ' }).min(1, 'Token không hợp lệ'),
  password: passwordSchema,
  confirmPassword: z.string().optional()
}).superRefine((data, ctx) => {
  if (data.confirmPassword !== undefined && data.confirmPassword !== data.password) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Mật khẩu xác nhận không khớp',
      path: ['confirmPassword']
    });
  }
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

function validateActivate(data) {
  const result = activateSchema.safeParse(data);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: flattenIssues(result) };
}

function validateResendOtp(data) {
  const result = resendOtpSchema.safeParse(data);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: flattenIssues(result) };
}

function validateForgot(data) {
  const result = forgotSchema.safeParse(data);
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

module.exports = {
  emailSchema,
  passwordSchema,
  registerSchema,
  loginSchema,
  activateSchema,
  resendOtpSchema,
  forgotSchema,
  passwordResetSchema,
  flattenIssues,
  validateRegister,
  validateLogin,
  validateActivate,
  validateResendOtp,
  validateForgot,
  validatePasswordReset
};
