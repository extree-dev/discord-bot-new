// Отправка писем с кодом подтверждения через отдельный iCloud-почтовый
// ящик, заведённый специально под Extree Stats — осознанно не
// переиспользует utils/email.js бота (тот шлёт через Resend с адреса
// no-reply@extree.tech): Extree Stats независимый продукт, и даже
// отправитель писем у него свой, не завязанный на инфраструктуру бота.
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
    if (!transporter) {
        if (!process.env.STATS_MAIL_USER || !process.env.STATS_MAIL_APP_PASSWORD) {
            throw new Error('STATS_MAIL_USER/STATS_MAIL_APP_PASSWORD не заданы в .env');
        }
        // smtp.mail.me.com — SMTP-сервер iCloud Mail, 587/STARTTLS с
        // app-specific password (обычный пароль Apple ID для SMTP не
        // принимается, см. appleid.apple.com → Sign-In and Security).
        transporter = nodemailer.createTransport({
            host: 'smtp.mail.me.com',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.STATS_MAIL_USER,
                pass: process.env.STATS_MAIL_APP_PASSWORD,
            },
        });
    }
    return transporter;
}

function renderVerificationEmail({ code }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;line-height:1px;color:#f4f5f7;max-height:0;max-width:0;opacity:0;overflow:hidden;">
Your Extree Stats verification code: ${code}. Expires in 10 minutes.
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;padding:48px 16px;">
<tr><td align="center">
  <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0"
         style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                color:#111111;">
    <tr><td style="padding:40px 40px 0;">
      <span style="font-size:16px;font-weight:700;letter-spacing:-0.2px;color:#111111;">Extree</span>
      <span style="display:inline-block;background:#ff4d5e;color:#ffffff;font-size:9px;font-weight:700;
                   letter-spacing:0.5px;padding:3px 6px;border-radius:4px;margin-left:8px;vertical-align:middle;">STATS</span>
    </td></tr>
    <tr><td style="padding:32px 40px 0;">
      <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-0.3px;">Verify your email</h1>
    </td></tr>
    <tr><td style="padding:16px 40px 0;">
      <p style="margin:0;font-size:15px;line-height:1.6;color:#555555;">
        Enter this code to confirm your email and finish creating your Extree Stats account.
      </p>
    </td></tr>
    <tr><td style="padding:32px 40px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center" style="background:#f4f5f7;border-radius:12px;padding:28px 24px;">
          <span style="font-family:'SF Mono','Courier New',Consolas,monospace;font-size:36px;font-weight:600;
                       letter-spacing:10px;color:#111111;white-space:nowrap;">${code}</span>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:16px 40px 40px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#888888;text-align:center;">
        Code expires in 10 minutes. Didn't request this? You can ignore this email.
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendVerificationCode(email, code) {
    const fromAddress = process.env.STATS_MAIL_FROM || `Extree Stats <${process.env.STATS_MAIL_USER}>`;
    await getTransporter().sendMail({
        from: fromAddress,
        to: email,
        subject: 'Verify your email — Extree Stats',
        html: renderVerificationEmail({ code }),
    });
}

module.exports = { sendVerificationCode, renderVerificationEmail };
