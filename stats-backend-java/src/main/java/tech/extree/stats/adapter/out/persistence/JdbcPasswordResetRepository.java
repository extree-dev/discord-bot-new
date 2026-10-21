package tech.extree.stats.adapter.out.persistence;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import tech.extree.stats.application.port.out.PasswordResetRepository;
import tech.extree.stats.domain.PasswordReset;

/**
 * Та же таблица/SQL, что ../../stats-backend/passwordResets.js (Node) —
 * 32 случайных байта в hex (не 6-значный код: это ссылка для клика, не
 * значение для ручного ввода, см. комментарий в оригинале).
 */
@Repository
public class JdbcPasswordResetRepository implements PasswordResetRepository {

    private static final long TOKEN_TTL_MINUTES = 30;
    private static final long RESEND_COOLDOWN_SECONDS = 60;

    private static final RowMapper<PasswordReset> ROW_MAPPER =
            (rs, rowNum) -> new PasswordReset(
                    rs.getString("token"),
                    rs.getString("user_id"),
                    rs.getString("email"),
                    rs.getTimestamp("expires_at").toInstant(),
                    rs.getTimestamp("created_at").toInstant());

    private final JdbcTemplate jdbcTemplate;
    private final SecureRandom secureRandom = new SecureRandom();

    public JdbcPasswordResetRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public String createReset(String userId, String email) {
        // Новый запрос инвалидирует предыдущие ссылки этого аккаунта — как и Node.
        jdbcTemplate.update("DELETE FROM stats_password_resets WHERE user_id = ?", userId);
        String token = generateToken();
        jdbcTemplate.update(
                "INSERT INTO stats_password_resets (token, user_id, email, expires_at, created_at) "
                        + "VALUES (?, ?, ?, ?, now())",
                token,
                userId,
                email,
                java.sql.Timestamp.from(Instant.now().plus(TOKEN_TTL_MINUTES, ChronoUnit.MINUTES)));
        return token;
    }

    @Override
    public Optional<PasswordReset> getReset(String token) {
        List<PasswordReset> rows = jdbcTemplate.query(
                "SELECT token, user_id, email, expires_at, created_at FROM stats_password_resets WHERE token = ?",
                ROW_MAPPER,
                token);
        return rows.stream().findFirst();
    }

    @Override
    public void deleteReset(String token) {
        jdbcTemplate.update("DELETE FROM stats_password_resets WHERE token = ?", token);
    }

    @Override
    public boolean isOnCooldown(String email) {
        List<Instant> rows = jdbcTemplate.query(
                "SELECT created_at FROM stats_password_resets WHERE email = ? ORDER BY created_at DESC LIMIT 1",
                (rs, rowNum) -> rs.getTimestamp("created_at").toInstant(),
                email);
        return rows.stream()
                .findFirst()
                .map(createdAt -> createdAt.isAfter(Instant.now().minusSeconds(RESEND_COOLDOWN_SECONDS)))
                .orElse(false);
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
