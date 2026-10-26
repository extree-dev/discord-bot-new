package tech.extree.stats.domain;

/**
 * Запись в серверном реестре сессий (stats_sessions) — то, во что
 * превращается непрозрачный токен из cookie после валидации по базе.
 * Не путать с {@link Session} — тем (чисто stateless, AES-GCM) до сих пор
 * пользуется только Pre2faService для короткоживущего шага между вводом
 * пароля и TOTP-кода, где обращение к базе было бы лишним.
 *
 * <p>sub/userId — то же разделение, что было раньше зашито в саму cookie:
 * RSO-вход (Riot) заполняет только sub, email-аккаунт — только userId,
 * ровно одно из двух.
 */
public record LoginSession(String id, String sub, String userId, long createdAtMillis) {

    public boolean isEmailAccount() {
        return userId != null;
    }
}
