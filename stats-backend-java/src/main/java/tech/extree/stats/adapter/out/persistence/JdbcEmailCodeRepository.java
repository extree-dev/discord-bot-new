package tech.extree.stats.adapter.out.persistence;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import tech.extree.stats.application.port.out.EmailCodeRepository;
import tech.extree.stats.domain.EmailCode;

/** Байт-в-байт та же таблица/SQL, что ../../stats-backend/emailCodes.js (Node). */
@Repository
public class JdbcEmailCodeRepository implements EmailCodeRepository {

    private static final RowMapper<EmailCode> ROW_MAPPER =
            (rs, rowNum) -> new EmailCode(
                    rs.getString("code"),
                    rs.getInt("attempts"),
                    rs.getTimestamp("expires_at").toInstant(),
                    rs.getTimestamp("created_at").toInstant());

    private final JdbcTemplate jdbcTemplate;

    public JdbcEmailCodeRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void upsertCode(String email, String code, Instant expiresAt) {
        jdbcTemplate.update(
                "INSERT INTO stats_email_codes (email, code, attempts, expires_at, created_at) "
                        + "VALUES (?, ?, 0, ?, now()) "
                        + "ON CONFLICT (email) DO UPDATE "
                        + "SET code = EXCLUDED.code, attempts = 0, expires_at = EXCLUDED.expires_at, "
                        + "created_at = now()",
                email,
                code,
                Timestamp.from(expiresAt));
    }

    @Override
    public Optional<EmailCode> getCode(String email) {
        List<EmailCode> rows = jdbcTemplate.query(
                "SELECT code, attempts, expires_at, created_at FROM stats_email_codes WHERE email = ?",
                ROW_MAPPER,
                email);
        return rows.stream().findFirst();
    }

    @Override
    public void registerFailedAttempt(String email) {
        jdbcTemplate.update("UPDATE stats_email_codes SET attempts = attempts + 1 WHERE email = ?", email);
    }

    @Override
    public void deleteCode(String email) {
        jdbcTemplate.update("DELETE FROM stats_email_codes WHERE email = ?", email);
    }
}
