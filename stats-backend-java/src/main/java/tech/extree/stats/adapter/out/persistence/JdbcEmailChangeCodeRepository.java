package tech.extree.stats.adapter.out.persistence;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import tech.extree.stats.application.port.out.EmailChangeCodeRepository;
import tech.extree.stats.domain.EmailChangeCode;

/** Та же таблица/SQL, что ../../stats-backend/emailChangeCodes.js (Node). */
@Repository
public class JdbcEmailChangeCodeRepository implements EmailChangeCodeRepository {

    private static final RowMapper<EmailChangeCode> ROW_MAPPER =
            (rs, rowNum) -> new EmailChangeCode(
                    rs.getString("new_email"),
                    rs.getString("code"),
                    rs.getInt("attempts"),
                    rs.getTimestamp("expires_at").toInstant(),
                    rs.getTimestamp("created_at").toInstant());

    private final JdbcTemplate jdbcTemplate;

    public JdbcEmailChangeCodeRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void upsertCode(String userId, String newEmail, String code, Instant expiresAt) {
        jdbcTemplate.update(
                "INSERT INTO stats_email_change_codes (user_id, new_email, code, attempts, expires_at, created_at) "
                        + "VALUES (?, ?, ?, 0, ?, now()) "
                        + "ON CONFLICT (user_id) DO UPDATE "
                        + "SET new_email = EXCLUDED.new_email, code = EXCLUDED.code, attempts = 0, "
                        + "expires_at = EXCLUDED.expires_at, created_at = now()",
                userId,
                newEmail,
                code,
                Timestamp.from(expiresAt));
    }

    @Override
    public Optional<EmailChangeCode> getCode(String userId) {
        List<EmailChangeCode> rows = jdbcTemplate.query(
                "SELECT new_email, code, attempts, expires_at, created_at "
                        + "FROM stats_email_change_codes WHERE user_id = ?",
                ROW_MAPPER,
                userId);
        return rows.stream().findFirst();
    }

    @Override
    public void registerFailedAttempt(String userId) {
        jdbcTemplate.update("UPDATE stats_email_change_codes SET attempts = attempts + 1 WHERE user_id = ?", userId);
    }

    @Override
    public void deleteCode(String userId) {
        jdbcTemplate.update("DELETE FROM stats_email_change_codes WHERE user_id = ?", userId);
    }
}
