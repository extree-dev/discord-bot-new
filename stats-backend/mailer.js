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

function formatLocation({ country, city }) {
    if (!country) return 'an unknown location';
    return city ? `${city}, ${country}` : country;
}

// Тот же визуальный язык, что renderVerificationEmail (светлая карточка,
// моноширинный блок) — осознанно, не переизобретаем стиль письма для
// каждого нового триггера (см. обсуждение дизайна писем в этой сессии).
function renderSignInNotificationEmail({ ip, country, city, time }) {
    const location = formatLocation({ country, city });
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>New sign-in to your account</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;line-height:1px;color:#f4f5f7;max-height:0;max-width:0;opacity:0;overflow:hidden;">
New sign-in to your Extree Stats account from ${location}.
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
      <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-0.3px;">New sign-in to your account</h1>
    </td></tr>
    <tr><td style="padding:16px 40px 0;">
      <p style="margin:0;font-size:15px;line-height:1.6;color:#555555;">
        Your Extree Stats account was just signed in to. If this was you, no action is needed.
      </p>
    </td></tr>
    <tr><td style="padding:28px 40px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;border-radius:12px;">
        <tr><td style="padding:18px 22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13.5px;color:#333333;">
            <tr><td style="padding:4px 0;color:#888888;width:84px;">Time</td><td style="padding:4px 0;">${time}</td></tr>
            <tr><td style="padding:4px 0;color:#888888;">Location</td><td style="padding:4px 0;">${location}</td></tr>
            <tr><td style="padding:4px 0;color:#888888;">IP address</td><td style="padding:4px 0;font-family:'SF Mono','Courier New',Consolas,monospace;">${ip ?? 'unknown'}</td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:20px 40px 40px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#888888;">
        Don't recognize this? Change your Extree Stats password and contact
        <a href="mailto:support@extree.tech" style="color:#ff4d5e;text-decoration:none;">support@extree.tech</a>.
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

function renderNewLocationCodeEmail({ code, ip, country, city }) {
    const location = formatLocation({ country, city });
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Confirm this sign-in</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;line-height:1px;color:#f4f5f7;max-height:0;max-width:0;opacity:0;overflow:hidden;">
Your Extree Stats sign-in code: ${code}. A sign-in attempt came from ${location}.
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
      <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-0.3px;">Confirm this sign-in</h1>
    </td></tr>
    <tr><td style="padding:16px 40px 0;">
      <p style="margin:0;font-size:15px;line-height:1.6;color:#555555;">
        Someone just tried to sign in to your Extree Stats account from <strong>${location}</strong>
        (IP ${ip ?? 'unknown'}) — a place we haven't seen before. If this was you, enter the code below to continue.
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
        Code expires in 10 minutes. Wasn't you? Change your password and contact
        <a href="mailto:support@extree.tech" style="color:#ff4d5e;text-decoration:none;">support@extree.tech</a>.
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

function renderPasswordResetEmail({ resetUrl }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;line-height:1px;color:#f4f5f7;max-height:0;max-width:0;opacity:0;overflow:hidden;">
Reset your Extree Stats password. This link expires in 30 minutes.
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
      <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-0.3px;">Reset your password</h1>
    </td></tr>
    <tr><td style="padding:16px 40px 0;">
      <p style="margin:0;font-size:15px;line-height:1.6;color:#555555;">
        We got a request to reset the password for your Extree Stats account. Click the button below to choose a
        new one.
      </p>
    </td></tr>
    <tr><td style="padding:28px 40px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="background:#ff4d5e;border-radius:10px;">
          <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;font-size:14.5px;font-weight:700;
             color:#ffffff;text-decoration:none;">Reset password</a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:20px 40px 40px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#888888;">
        This link expires in 30 minutes and can only be used once. Didn't request this? You can ignore this email —
        your password won't change.
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

async function sendSignInNotification(email, { ip, country, city, time }) {
    const fromAddress = process.env.STATS_MAIL_FROM || `Extree Stats <${process.env.STATS_MAIL_USER}>`;
    await getTransporter().sendMail({
        from: fromAddress,
        to: email,
        subject: 'New sign-in to your account — Extree Stats',
        html: renderSignInNotificationEmail({ ip, country, city, time }),
    });
}

async function sendNewLocationCode(email, code, { ip, country, city }) {
    const fromAddress = process.env.STATS_MAIL_FROM || `Extree Stats <${process.env.STATS_MAIL_USER}>`;
    await getTransporter().sendMail({
        from: fromAddress,
        to: email,
        subject: 'Confirm this sign-in — Extree Stats',
        html: renderNewLocationCodeEmail({ code, ip, country, city }),
    });
}

async function sendPasswordResetEmail(email, resetUrl) {
    const fromAddress = process.env.STATS_MAIL_FROM || `Extree Stats <${process.env.STATS_MAIL_USER}>`;
    await getTransporter().sendMail({
        from: fromAddress,
        to: email,
        subject: 'Reset your password — Extree Stats',
        html: renderPasswordResetEmail({ resetUrl }),
    });
}

module.exports = {
    sendVerificationCode,
    sendSignInNotification,
    sendNewLocationCode,
    sendPasswordResetEmail,
    renderVerificationEmail,
    renderSignInNotificationEmail,
    renderNewLocationCodeEmail,
    renderPasswordResetEmail,
};
