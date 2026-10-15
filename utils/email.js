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

async function sendVerificationCode(email, code, username, guildName) {
    const html = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
            <div style="background:#1a0008;padding:32px;text-align:center;border-radius:16px 16px 0 0;">
                <span style="color:#fff;font-size:28px;font-weight:800;font-style:italic;">Majestic</span>
                <span style="background:#ff2d6f;color:#fff;font-size:12px;padding:4px 10px;border-radius:8px;margin-left:8px;">ID</span>
            </div>
            <div style="background:#fff;padding:40px;text-align:center;">
                <h1 style="font-size:24px;margin:0 0 16px;">Подтверждение входа</h1>
                <p style="color:#555;">Чтобы войти в учётную запись <b>${username}</b>, введите код:</p>
                <div style="background:#f0f0f2;border-radius:10px;padding:16px;font-family:monospace;font-size:28px;letter-spacing:8px;font-weight:700;">
                    ${code}
                </div>
                <p style="color:#999;font-size:12px;margin-top:24px;">
                    Код действует 10 минут. Если вы не запрашивали — просто проигнорируйте это письмо.
                </p>
            </div>
            <div style="padding:24px;text-align:center;font-size:12px;color:#999;">
                ${guildName ?? 'Discord-сервер'}
            </div>
        </div>
    `;

    await getResend().emails.send({
        from: 'Majestic ID <no-reply@extree.tech>',
        to: email,
        subject: 'Код подтверждения',
        html,
    });
}

module.exports = { generateEmailCode, sendVerificationCode };