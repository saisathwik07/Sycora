const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: true,
  service: process.env.SMTP_SERVICE,
  auth: {
    user: process.env.SMTP_MAIL,
    pass: process.env.SMTP_APP_PASS,
  },
});

async function sendPasswordResetEmail(to, resetToken) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
  const resetLink = `${frontendUrl}/reset-password/${resetToken}`;

  const mailOptions = {
    from: `"Syncora" <${process.env.SMTP_MAIL}>`,
    to,
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Password Reset</h2>
        <p>You requested a password reset. Click the button below to create a new password:</p>
        <a href="${resetLink}"
           style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #fff;
                  text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #6b7280; font-size: 14px;">
          This link expires in <strong>1 hour</strong>. If you didn't request this, ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          If the button doesn't work, copy and paste this URL into your browser:<br/>
          <a href="${resetLink}" style="color: #2563eb;">${resetLink}</a>
        </p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendPasswordResetEmail };
