package tech.extree.stats.adapter.in.web.dto;

/** Тело POST /auth/reset-password. totpCode — опционален, нужен только
 * если на аккаунте включена 2FA (сервер в этом случае сначала отвечает
 * TOTP_REQUIRED, фронт повторяет запрос с тем же token+password и
 * добавленным кодом). */
public record ResetPasswordRequest(String token, String password, String totpCode) {}
