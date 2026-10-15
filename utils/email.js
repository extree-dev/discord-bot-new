const { Resend } = require('resend');

let resend = null;

function getResend() {
    if (!resend) {
        if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY не задан в .env');
        }
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
}

function generateEmailCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

// Рендер HTML письма. Вынесен в отдельную функцию, чтобы можно было
// посмотреть письмо в браузере (см. scripts/preview-email.js) или в
// тестах без реальной отправки через Resend.
function renderVerificationEmail({ code, username, guildName, requestedAt }) {
    const now = requestedAt ? new Date(requestedAt) : new Date();
    const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Код подтверждения почты</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
<div style="display:none;font-size:1px;line-height:1px;color:#f4f5f7;max-height:0;max-width:0;opacity:0;overflow:hidden;">
Код подтверждения почты: ${code}. Действует 10 минут.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#f4f5f7;padding:48px 16px;">
<tr><td align="center">

  <table role="presentation" width="540" cellpadding="0" cellspacing="0" border="0"
         style="max-width:540px;width:100%;background:#ffffff;border-radius:16px;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                color:#111111;">

    <!-- Шапка: бренд -->
    <tr><td style="padding:40px 40px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td>
        <span style="font-size:16px;font-weight:700;letter-spacing:-0.2px;color:#111111;vertical-align:middle;">
          Extree
        </span>
        <span style="display:inline-block;background:#111111;color:#ffffff;
                     font-size:9px;font-weight:700;letter-spacing:0.5px;
                     padding:3px 6px;border-radius:4px;margin-left:8px;vertical-align:middle;">
          BOT
        </span>
      </td></tr></table>
    </td></tr>

    <!-- Заголовок -->
    <tr><td style="padding:40px 40px 0;">
      <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-0.3px;color:#111111;">
        Подтверждение почты
      </h1>
    </td></tr>

    <!-- Тело -->
    <tr><td style="padding:16px 40px 0;">
      <p style="margin:0;font-size:15px;line-height:1.6;color:#555555;">
        Привет, <strong style="color:#111111;font-weight:600;">${username}</strong>.
        Введите код ниже, чтобы подтвердить, что вы человек, и получить доступ к сообществу.
      </p>
    </td></tr>

    <!-- Код -->
    <tr><td style="padding:40px 40px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center" style="background:#f4f5f7;border-radius:12px;padding:32px 24px;">
          <span style="font-family:'SF Mono','Courier New',Consolas,monospace;
                       font-size:40px;font-weight:600;letter-spacing:12px;
                       color:#111111;white-space:nowrap;line-height:1;">
            ${code}
          </span>
        </td></tr>
      </table>
    </td></tr>

    <!-- Meta: срок и время -->
    <tr><td style="padding:16px 40px 0;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#888888;text-align:center;">
        Код действует 10 минут
      </p>
    </td></tr>

    <tr><td style="padding:8px 40px 0;">
      <p style="margin:0;font-size:12px;line-height:1.5;color:#aaaaaa;text-align:center;">
        Запрошено: ${dateStr}
      </p>
    </td></tr>

    <!-- Разделитель -->
    <tr><td style="padding:40px 40px 0;">
      <div style="height:1px;background:#eeeeee;line-height:1px;font-size:0;">&nbsp;</div>
    </td></tr>

    <!-- Блок безопасности -->
    <tr><td style="padding:32px 40px 0;">
      <p style="margin:0 0 12px;font-size:15px;line-height:1.5;font-weight:600;color:#111111;">
        Не запрашивали этот код?
      </p>

      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#555555;">
        Кто-то указал вашу почту при верификации в Discord-сообществе.
        Доступ к сообществу не будет выдан без этого кода — можно ничего не делать.
      </p>

      <p style="margin:0 0 12px;font-size:14px;line-height:1.5;font-weight:600;color:#111111;">
        Если хотите перестраховаться
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;">
        <tr>
          <td width="20" valign="top" style="font-size:14px;line-height:1.6;color:#888888;padding:0 0 8px;">1.</td>
          <td style="font-size:14px;line-height:1.6;color:#555555;padding:0 0 8px;">
            Смените пароль от почтового ящика
          </td>
        </tr>
        <tr>
          <td width="20" valign="top" style="font-size:14px;line-height:1.6;color:#888888;padding:0 0 8px;">2.</td>
          <td style="font-size:14px;line-height:1.6;color:#555555;padding:0 0 8px;">
            Включите двухфакторную аутентификацию на почте
          </td>
        </tr>
        <tr>
          <td width="20" valign="top" style="font-size:14px;line-height:1.6;color:#888888;">3.</td>
          <td style="font-size:14px;line-height:1.6;color:#555555;">
            Напишите нам — поможем разобраться
          </td>
        </tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
        <tr><td style="background:#111111;border-radius:10px;">
          <a href="mailto:support@extree.tech?subject=Не%20запрашивал%20код%20подтверждения%20Extree%20Bot"
             style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:600;
                    color:#ffffff;text-decoration:none;letter-spacing:-0.1px;">
            support@extree.tech
          </a>
        </td></tr>
      </table>

      <p style="margin:0;font-size:12px;line-height:1.6;color:#888888;">
        Никому не сообщайте код — ни в Discord, ни в личных сообщениях.
        Администрация Extree никогда его не спрашивает.
      </p>
    </td></tr>

    <!-- Нижний отступ карточки -->
    <tr><td style="padding:0 0 40px;"></td></tr>

  </table>

  <!-- Футер -->
  <table role="presentation" width="540" cellpadding="0" cellspacing="0" border="0"
         style="max-width:540px;width:100%;">
    <tr><td align="center" style="padding:24px 16px 0;
                                   font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
                                   font-size:11px;line-height:1.5;color:#aaaaaa;letter-spacing:0.2px;">
      ${guildName ? `${guildName} · ` : ''}Extree Bot
    </td></tr>
  </table>

</td></tr>
</table>
</body>
</html>`;
}

async function sendVerificationCode(email, code, username, guildName) {
    const html = renderVerificationEmail({ code, username, guildName });

    await getResend().emails.send({
        from: 'Extree ID <no-reply@extree.tech>',
        to: email,
        subject: 'Код подтверждения входа',
        html,
    });
}

module.exports = { generateEmailCode, sendVerificationCode, renderVerificationEmail };
