package tech.extree.stats.adapter.out.persistence;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import tech.extree.stats.application.port.out.SessionRepository;
import tech.extree.stats.domain.LoginSession;

/**
 * Реестр сессий в stats_sessions (см. stats-backend/db.js). Токен в
 * cookie — 32 случайных байта в hex (та же длина, что у токенов сброса
 * пароля, JdbcPasswordResetRepository), но в базе лежит не он сам, а его
 * SHA-256 — утечка БД (бэкап, SQL-инъекция) не отдаёт рабочие токены,
 * только хэши, из которых токен не восстановить. Та же логика, что
 * recovery-коды 2FA (TotpService.sha256) — используем тот же паттерн.
 */
@Repository
public class JdbcSessionRepository implements SessionRepository {

    private static final Duration REMEMBER_TTL = Duration.ofDays(7);
    // Сессия без "запомнить меня" живёт в браузере только до закрытия вкладки
    // (cookie без Max-Age), но раньше (чисто stateless AES-GCM) срок действия
    // самого токена вообще никак не ограничивался, пока открыта вкладка —
    // теперь явный потолок и для неё, отдельно от того, что решает браузер.
    private static final Duration SESSION_ONLY_TTL = Duration.ofHours(24);

    private static final RowMapper<LoginSession> ROW_MAPPER = (rs, rowNum) -> new LoginSession(
            rs.getString("id"), rs.getString("sub"), rs.getString("user_id"), rs.getTimestamp("created_at").getTime());

    private final JdbcTemplate jdbcTemplate;
    private final SecureRandom secureRandom = new SecureRandom();

    public JdbcSessionRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Created create(String sub, String userId, String ip, String userAgent, boolean rememberMe) {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        String token = HexFormat.of().formatHex(bytes);
        String id = sha256(token);
        Instant expiresAt = Instant.now().plus(rememberMe ? REMEMBER_TTL : SESSION_ONLY_TTL);

        jdbcTemplate.update(
                "INSERT INTO stats_sessions (id, sub, user_id, ip, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
                id, sub, userId, ip, userAgent, java.sql.Timestamp.from(expiresAt));

        return new Created(token, id);
    }

    @Override
    public Optional<LoginSession> validate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return Optional.empty();
        }
        String id = sha256(rawToken);
        var rows = jdbcTemplate.query(
                "SELECT id, sub, user_id, created_at FROM stats_sessions "
                        + "WHERE id = ? AND revoked_at IS NULL AND expires_at > now()",
                ROW_MAPPER,
                id);
        if (rows.isEmpty()) {
            return Optional.empty();
        }
        // Не критично для самой проверки — не ждём результата и не валим
        // запрос, если он почему-то не прошёл.
        jdbcTemplate.update("UPDATE stats_sessions SET last_seen_at = now() WHERE id = ?", id);
        return Optional.of(rows.get(0));
    }

    @Override
    public void revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        jdbcTemplate.update(
                "UPDATE stats_sessions SET revoked_at = now() WHERE id = ? AND revoked_at IS NULL", sha256(rawToken));
    }

    @Override
    public void revokeById(String userId, String sessionId) {
        jdbcTemplate.update(
                "UPDATE stats_sessions SET revoked_at = now() "
                        + "WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
                sessionId,
                userId);
    }

    private static String sha256(String token) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 недоступен", e);
        }
    }
}
