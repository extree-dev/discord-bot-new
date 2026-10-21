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

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Пользователю — подтверждение, что заявка получена. Простой текстовый
// стиль вместо карточки с кнопкой (см. обсуждение при добавлении —
// ориентир: как выглядят письма Riot Games Player Support) — это должно
// читаться как письмо от живого человека, не как маркетинговая рассылка.
// Ссылка на просмотр/ответ — обычная ссылка в тексте, не большая кнопка;
// сам тред всё равно живёт на сайте (ticketUrl), не в переписке по почте.
function renderSupportTicketConfirmationEmail({ ticketNumber, subject, ticketUrl }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>We got your request</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;line-height:1px;color:#ffffff;max-height:0;max-width:0;opacity:0;overflow:hidden;">
We got your support request. Ticket #${ticketNumber}.
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
<tr><td align="center">
  <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0"
         style="max-width:580px;width:100%;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                color:#1a1a1a;padding:32px 24px;">
    <tr><td style="padding-bottom:24px;font-size:12.5px;color:#888888;">
      Extree Stats Support
    </td></tr>
    <tr><td style="font-size:15px;line-height:1.7;">
      Hi there,<br><br>
      Thanks for reaching out — we got your message (<strong>${escapeHtml(subject)}</strong>) and will reply as soon as we can.
      <br><br>
      You can view it, and reply whenever you want, here: <a href="${ticketUrl}" style="color:#ff4d5e;">${ticketUrl}</a>.
      We'll also email you the moment we reply.
      <br><br>
      Best regards,<br>
      Extree Stats Support
    </td></tr>
    <tr><td style="padding-top:32px;">
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:0 0 16px;">
      <p style="margin:0;font-size:12.5px;line-height:1.6;color:#999999;">
        Ticket #${escapeHtml(String(ticketNumber))}. Didn't send this request? Contact
        <a href="mailto:support@extree.tech" style="color:#999999;">support@extree.tech</a>.
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

// Пользователю — у тикета появился ответ от поддержки. Тот же простой
// текстовый стиль, что и у подтверждения заявки выше — adminName берётся
// из stats_users.name отвечавшего админа (см. server.js), с фолбэком на
// "Support", если имя в профиле не заполнено.
function renderSupportTicketReplyEmail({ ticketNumber, message, adminName, ticketUrl }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>New reply to your ticket</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;line-height:1px;color:#ffffff;max-height:0;max-width:0;opacity:0;overflow:hidden;">
${escapeHtml(adminName)} replied to your support ticket #${escapeHtml(String(ticketNumber))}.
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
<tr><td align="center">
  <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0"
         style="max-width:580px;width:100%;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                color:#1a1a1a;padding:32px 24px;">
    <tr><td style="padding-bottom:24px;">
      <span style="font-size:14px;font-weight:700;">${escapeHtml(adminName)}</span>
      <span style="font-size:12.5px;color:#888888;"> (Extree Stats Support)</span>
    </td></tr>
    <tr><td style="font-size:15px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(message)}</td></tr>
    <tr><td style="padding-top:24px;font-size:15px;line-height:1.7;">
      Best regards,<br>
      ${escapeHtml(adminName)}<br>
      Extree Stats Support
    </td></tr>
    <tr><td style="padding-top:32px;">
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:0 0 16px;">
      <p style="margin:0;font-size:12.5px;line-height:1.6;color:#999999;">
        Reply on ticket #${escapeHtml(String(ticketNumber))}: <a href="${ticketUrl}" style="color:#999999;">${ticketUrl}</a>.
        Didn't open this ticket? Contact
        <a href="mailto:support@extree.tech" style="color:#999999;">support@extree.tech</a>.
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

// Внутреннее письмо команде поддержки (support@extree.tech) с содержимым
// заявки — отвечаем теперь в админке (/admin/tickets/:number, ссылка
// ниже), а не "Ответить" в почтовом клиенте: тред живёт на сайте,
// Reply-To всё ещё указывает на отправителя просто на случай, если
// админку кто-то не найдёт.
const SUPPORT_CATEGORY_LABELS = {
    account: 'Account & login',
    bug: 'Bug report',
    billing: 'Billing',
    other: 'Other',
};

function renderSupportTicketNotificationEmail({ ticketNumber, email, subject, message, category, userId, adminUrl }) {
    const categoryLabel = SUPPORT_CATEGORY_LABELS[category] || 'Other';
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>New support ticket</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;color:#111111;">
    <tr><td style="padding:28px 32px 0;">
      <h1 style="margin:0;font-size:18px;font-weight:700;">New Extree Stats support ticket</h1>
    </td></tr>
    <tr><td style="padding:16px 32px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13.5px;color:#333333;">
        <tr><td style="padding:4px 0;color:#888888;width:84px;">Ticket</td><td style="padding:4px 0;font-family:'SF Mono','Courier New',Consolas,monospace;">#${escapeHtml(String(ticketNumber))}</td></tr>
        <tr><td style="padding:4px 0;color:#888888;">From</td><td style="padding:4px 0;">${escapeHtml(email)}${userId ? ' (signed in)' : ' (not signed in)'}</td></tr>
        <tr><td style="padding:4px 0;color:#888888;">Category</td><td style="padding:4px 0;">${escapeHtml(categoryLabel)}</td></tr>
        <tr><td style="padding:4px 0;color:#888888;">Subject</td><td style="padding:4px 0;">${escapeHtml(subject)}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:20px 32px 0;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#888888;">Message</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#111111;white-space:pre-wrap;">${escapeHtml(message)}</p>
    </td></tr>
    <tr><td style="padding:24px 32px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="background:#ff4d5e;border-radius:10px;">
          <a href="${adminUrl}" style="display:inline-block;padding:12px 24px;font-size:13.5px;font-weight:700;
             color:#ffffff;text-decoration:none;">Reply in admin</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

// Пользователь ответил в своём тикете — та же карточка, что уведомление о
// новой заявке выше, просто без категории (ответ не меняет её).
function renderSupportTicketUserReplyEmail({ ticketNumber, email, subject, message, adminUrl }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>New reply on a support ticket</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;color:#111111;">
    <tr><td style="padding:28px 32px 0;">
      <h1 style="margin:0;font-size:18px;font-weight:700;">New reply on an Extree Stats ticket</h1>
    </td></tr>
    <tr><td style="padding:16px 32px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13.5px;color:#333333;">
        <tr><td style="padding:4px 0;color:#888888;width:84px;">Ticket</td><td style="padding:4px 0;font-family:'SF Mono','Courier New',Consolas,monospace;">#${escapeHtml(String(ticketNumber))}</td></tr>
        <tr><td style="padding:4px 0;color:#888888;">From</td><td style="padding:4px 0;">${escapeHtml(email)}</td></tr>
        <tr><td style="padding:4px 0;color:#888888;">Subject</td><td style="padding:4px 0;">${escapeHtml(subject)}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:20px 32px 0;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#888888;">Reply</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#111111;white-space:pre-wrap;">${escapeHtml(message)}</p>
    </td></tr>
    <tr><td style="padding:24px 32px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="background:#ff4d5e;border-radius:10px;">
          <a href="${adminUrl}" style="display:inline-block;padding:12px 24px;font-size:13.5px;font-weight:700;
             color:#ffffff;text-decoration:none;">Reply in admin</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

// Код подтверждения смены email — уходит на НОВЫЙ адрес (доказательство
// владения им), тот же визуальный язык, что renderVerificationEmail.
function renderEmailChangeCodeEmail({ code }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Confirm your new email</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;line-height:1px;color:#f4f5f7;max-height:0;max-width:0;opacity:0;overflow:hidden;">
Your Extree Stats email change code: ${code}. Expires in 10 minutes.
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
      <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-0.3px;">Confirm your new email</h1>
    </td></tr>
    <tr><td style="padding:16px 40px 0;">
      <p style="margin:0;font-size:15px;line-height:1.6;color:#555555;">
        Enter this code to confirm this is your email and finish updating your Extree Stats account.
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

// Уходит на СТАРЫЙ адрес в момент запроса смены — если это не сам
// владелец, у него есть шанс среагировать до того, как смена завершится
// (сменить пароль, написать в поддержку), а не только постфактум.
function renderEmailChangeNoticeEmail({ newEmail }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Email change requested</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;padding:48px 16px;">
<tr><td align="center">
  <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;color:#111111;">
    <tr><td style="padding:40px 40px 0;">
      <span style="font-size:16px;font-weight:700;letter-spacing:-0.2px;color:#111111;">Extree</span>
      <span style="display:inline-block;background:#ff4d5e;color:#ffffff;font-size:9px;font-weight:700;
                   letter-spacing:0.5px;padding:3px 6px;border-radius:4px;margin-left:8px;vertical-align:middle;">STATS</span>
    </td></tr>
    <tr><td style="padding:32px 40px 0;">
      <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-0.3px;">Email change requested</h1>
    </td></tr>
    <tr><td style="padding:16px 40px 40px;">
      <p style="margin:0;font-size:15px;line-height:1.6;color:#555555;">
        Someone requested changing the email on your Extree Stats account to <strong>${escapeHtml(newEmail)}</strong>.
        Nothing changes yet — they still need to confirm it from that inbox.
      </p>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#888888;">
        Wasn't you? Change your password right away and contact
        <a href="mailto:support@extree.tech" style="color:#ff4d5e;text-decoration:none;">support@extree.tech</a>.
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

// Финальное письмо — уходит и на старый, и на новый адрес, когда смена
// уже завершена (тот же приём, что у крупных сервисов: обе стороны видят
// факт свершившегося изменения, не только запрос).
function renderEmailChangedEmail({ oldEmail, newEmail }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Your email was changed</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;padding:48px 16px;">
<tr><td align="center">
  <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;color:#111111;">
    <tr><td style="padding:40px 40px 0;">
      <span style="font-size:16px;font-weight:700;letter-spacing:-0.2px;color:#111111;">Extree</span>
      <span style="display:inline-block;background:#ff4d5e;color:#ffffff;font-size:9px;font-weight:700;
                   letter-spacing:0.5px;padding:3px 6px;border-radius:4px;margin-left:8px;vertical-align:middle;">STATS</span>
    </td></tr>
    <tr><td style="padding:32px 40px 0;">
      <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-0.3px;">Your email was changed</h1>
    </td></tr>
    <tr><td style="padding:16px 40px 40px;">
      <p style="margin:0;font-size:15px;line-height:1.6;color:#555555;">
        The email on your Extree Stats account was changed from <strong>${escapeHtml(oldEmail)}</strong> to
        <strong>${escapeHtml(newEmail)}</strong>. You'll sign in with the new address from now on.
      </p>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#888888;">
        Wasn't you? Contact <a href="mailto:support@extree.tech" style="color:#ff4d5e;text-decoration:none;">support@extree.tech</a> right away.
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

// Уведомление о смене пароля — общее для /auth/account/change-password
// (из настроек, уже залогинен) и /auth/reset-password (по ссылке из
// письма "забыл пароль"): в обоих случаях владельцу стоит знать, что
// пароль поменялся, тем же визуальным языком, что renderSignInNotificationEmail.
function renderPasswordChangedEmail({ ip, country, city, time }) {
    const location = formatLocation({ country, city });
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Your password was changed</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;line-height:1px;color:#f4f5f7;max-height:0;max-width:0;opacity:0;overflow:hidden;">
Your Extree Stats password was just changed from ${location}.
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
      <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-0.3px;">Your password was changed</h1>
    </td></tr>
    <tr><td style="padding:16px 40px 0;">
      <p style="margin:0;font-size:15px;line-height:1.6;color:#555555;">
        The password for your Extree Stats account was just changed. If this was you, no action is needed.
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
        Didn't do this? Contact
        <a href="mailto:support@extree.tech" style="color:#ff4d5e;text-decoration:none;">support@extree.tech</a>
        right away.
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

async function sendEmailChangeCode(newEmail, { code }) {
    const fromAddress = process.env.STATS_MAIL_FROM || `Extree Stats <${process.env.STATS_MAIL_USER}>`;
    await getTransporter().sendMail({
        from: fromAddress,
        to: newEmail,
        subject: 'Confirm your new email — Extree Stats',
        html: renderEmailChangeCodeEmail({ code }),
    });
}

async function sendEmailChangeNotice(oldEmail, { newEmail }) {
    const fromAddress = process.env.STATS_MAIL_FROM || `Extree Stats <${process.env.STATS_MAIL_USER}>`;
    await getTransporter().sendMail({
        from: fromAddress,
        to: oldEmail,
        subject: 'Email change requested — Extree Stats',
        html: renderEmailChangeNoticeEmail({ newEmail }),
    });
}

async function sendEmailChanged(to, { oldEmail, newEmail }) {
    const fromAddress = process.env.STATS_MAIL_FROM || `Extree Stats <${process.env.STATS_MAIL_USER}>`;
    await getTransporter().sendMail({
        from: fromAddress,
        to,
        subject: 'Your email was changed — Extree Stats',
        html: renderEmailChangedEmail({ oldEmail, newEmail }),
    });
}

async function sendPasswordChanged(email, { ip, country, city, time }) {
    const fromAddress = process.env.STATS_MAIL_FROM || `Extree Stats <${process.env.STATS_MAIL_USER}>`;
    await getTransporter().sendMail({
        from: fromAddress,
        to: email,
        subject: 'Your password was changed — Extree Stats',
        html: renderPasswordChangedEmail({ ip, country, city, time }),
    });
}

async function sendSupportTicketConfirmation(email, { ticketNumber, subject, ticketUrl }) {
    const fromAddress = process.env.STATS_MAIL_FROM || `Extree Stats <${process.env.STATS_MAIL_USER}>`;
    await getTransporter().sendMail({
        from: fromAddress,
        to: email,
        subject: `We got your request — Extree Stats #${ticketNumber}`,
        html: renderSupportTicketConfirmationEmail({ ticketNumber, subject, ticketUrl }),
    });
}

async function sendSupportTicketNotification({ ticketNumber, email, subject, message, category, userId, adminUrl }) {
    const fromAddress = process.env.STATS_MAIL_FROM || `Extree Stats <${process.env.STATS_MAIL_USER}>`;
    await getTransporter().sendMail({
        from: fromAddress,
        to: 'support@extree.tech',
        replyTo: email,
        subject: `[Ticket #${ticketNumber}] ${subject}`,
        html: renderSupportTicketNotificationEmail({
            ticketNumber,
            email,
            subject,
            message,
            category,
            userId,
            adminUrl,
        }),
    });
}

// Поддержке ответили на тикет — уведомляем пользователя. Полный текст
// ответа теперь в самом письме (см. renderSupportTicketReplyEmail) — не
// только ссылка, чтобы можно было прочитать ответ не открывая сайт.
async function sendSupportTicketReply(email, { ticketNumber, subject, message, adminName, ticketUrl }) {
    const fromAddress = process.env.STATS_MAIL_FROM || `Extree Stats <${process.env.STATS_MAIL_USER}>`;
    await getTransporter().sendMail({
        from: fromAddress,
        to: email,
        subject: `Re: ${subject} — Extree Stats #${ticketNumber}`,
        html: renderSupportTicketReplyEmail({ ticketNumber, message, adminName: adminName || 'Support', ticketUrl }),
    });
}

// Пользователь ответил в своём тикете — уведомляем поддержку.
async function sendSupportTicketUserReply({ ticketNumber, email, subject, message, adminUrl }) {
    const fromAddress = process.env.STATS_MAIL_FROM || `Extree Stats <${process.env.STATS_MAIL_USER}>`;
    await getTransporter().sendMail({
        from: fromAddress,
        to: 'support@extree.tech',
        replyTo: email,
        subject: `Re: [Ticket #${ticketNumber}] ${subject}`,
        html: renderSupportTicketUserReplyEmail({ ticketNumber, email, subject, message, adminUrl }),
    });
}

module.exports = {
    sendVerificationCode,
    sendSignInNotification,
    sendNewLocationCode,
    sendPasswordResetEmail,
    sendEmailChangeCode,
    sendEmailChangeNotice,
    sendEmailChanged,
    sendPasswordChanged,
    sendSupportTicketConfirmation,
    sendSupportTicketNotification,
    sendSupportTicketReply,
    sendSupportTicketUserReply,
    renderVerificationEmail,
    renderSignInNotificationEmail,
    renderNewLocationCodeEmail,
    renderPasswordResetEmail,
    renderEmailChangeCodeEmail,
    renderEmailChangeNoticeEmail,
    renderEmailChangedEmail,
    renderPasswordChangedEmail,
    renderSupportTicketConfirmationEmail,
    renderSupportTicketReplyEmail,
    renderSupportTicketUserReplyEmail,
    renderSupportTicketNotificationEmail,
};
