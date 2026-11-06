const nodemailer = require('nodemailer');
const { config } = require('../config/env');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    if (config.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465,
        auth: config.SMTP_USER ? {
          user: config.SMTP_USER,
          pass: config.SMTP_PASS
        } : undefined
      });
    } else {
      // Fallback stub in development if SMTP is unconfigured
      transporter = {
        sendMail: async (options) => {
          // KHÔNG ghi OTP, token vào log
          console.log(`[MAILER DEV] Simulated email sent to ${options.to} (subject: ${options.subject})`);
          return { messageId: 'simulated' };
        }
      };
    }
  }
  return transporter;
}

/**
 * Gửi OTP kích hoạt tài khoản
 * Tuyệt đối không log OTP!
 */
async function sendActivationOtp(email, otp) {
  const mailer = getTransporter();
  const mailOptions = {
    from: config.MAIL_FROM,
    to: email,
    subject: 'Mã xác thực kích hoạt tài khoản — Ấm Vị',
    text: `Xin chào,\n\nMã kích hoạt tài khoản của bạn là: ${otp}\nMã có hiệu lực trong 10 phút.\n\nNếu bạn không yêu cầu mã này, vui lòng bỏ qua email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e9e0d2; border-radius: 12px; background: #fffdf8;">
        <h2 style="color: #354b35;">Xác thực tài khoản Ấm Vị</h2>
        <p>Xin chào,</p>
        <p>Mã kích hoạt tài khoản của bạn là:</p>
        <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #354b35; padding: 12px 20px; background: #faf5ec; border-radius: 8px; text-align: center; margin: 16px 0;">
          ${otp}
        </div>
        <p style="color: #7a7062; font-size: 14px;">Mã này có hiệu lực trong vòng <strong>10 phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
      </div>
    `
  };
  return mailer.sendMail(mailOptions);
}

/**
 * Gửi email link đặt lại mật khẩu
 * Tuyệt đối không log link có chứa token!
 */
async function sendPasswordResetLink(email, resetUrl) {
  const mailer = getTransporter();
  const mailOptions = {
    from: config.MAIL_FROM,
    to: email,
    subject: 'Yêu cầu đặt lại mật khẩu — Ấm Vị',
    text: `Xin chào,\n\nBạn vừa yêu cầu đặt lại mật khẩu cho tài khoản tại Ấm Vị.\nVui lòng truy cập đường dẫn sau để đặt mật khẩu mới:\n${resetUrl}\n\nĐường dẫn có hiệu lực trong 15 phút.\nNếu bạn không yêu cầu, vui lòng bỏ qua email này.`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e9e0d2; border-radius: 12px; background: #fffdf8;">
        <h2 style="color: #354b35;">Đặt lại mật khẩu Ấm Vị</h2>
        <p>Xin chào,</p>
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nhấp vào nút bên dưới để tiến hành:</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="background: #354b35; color: #fffdf8; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
            Đặt Lại Mật Khẩu
          </a>
        </div>
        <p style="color: #7a7062; font-size: 14px;">Liên kết này có hiệu lực trong vòng <strong>15 phút</strong> và chỉ dùng được một lần duy nhất.</p>
      </div>
    `
  };
  return mailer.sendMail(mailOptions);
}

/**
 * Gửi email thông báo đã đổi mật khẩu thành công
 * Không chứa mật khẩu!
 */
async function sendPasswordChangedNotice(email) {
  const mailer = getTransporter();
  const mailOptions = {
    from: config.MAIL_FROM,
    to: email,
    subject: 'Mật khẩu tài khoản đã được thay đổi — Ấm Vị',
    text: `Xin chào,\n\nMật khẩu tài khoản Ấm Vị của bạn đã được thay đổi thành công.\nNếu bạn không thực hiện thay đổi này, hãy liên hệ ngay với quản trị viên để bảo vệ tài khoản.`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e9e0d2; border-radius: 12px; background: #fffdf8;">
        <h2 style="color: #354b35;">Mật khẩu đã được thay đổi</h2>
        <p>Xin chào,</p>
        <p>Mật khẩu tài khoản Ấm Vị của bạn vừa được thay đổi thành công.</p>
        <p style="color: #c95135; font-size: 14px;">Nếu bạn không thực hiện hành động này, hãy thông báo ngay với quản trị viên để được hỗ trợ kịp thời.</p>
      </div>
    `
  };
  return mailer.sendMail(mailOptions);
}

module.exports = {
  sendActivationOtp,
  sendPasswordResetLink,
  sendPasswordChangedNotice
};
