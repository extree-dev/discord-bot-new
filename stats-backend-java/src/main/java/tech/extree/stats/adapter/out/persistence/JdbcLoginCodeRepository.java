package tech.extree.stats.adapter.out.persistence;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import tech.extree.stats.application.port.out.LoginCodeRepository;
import tech.extree.stats.domain.LoginCode;

/** Та же таблица/SQL, что ../../stats-backend/loginCodes.js (Node). */
@Repository
public class JdbcLoginCodeRepository implements LoginCodeRepository {

    private static final RowMapper<LoginCode> ROW_MAPPER =
            (rs, rowNum) -> new LoginCode(
                    rs.getString("code"),
                    rs.getInt("attempts"),
                    rs.getString("ip"),
                    rs.getString("country"),
                    rs.getString("city"),
                    rs.getBoolean("remember"),
                    rs.getTimestamp("expires_at").toInstant(),
                    rs.getTimestamp("created_at").toInstant());

    private final JdbcTemplate jdbcTemplate;

    public JdbcLoginCodeRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void upsertCode(
            String email, String code, String ip, String country, String city, boolean remember, Instant expiresAt) {
        jdbcTemplate.update(
                "INSERT INTO stats_login_codes (email, code, attempts, ip, country, city, remember, expires_at, created_at) "
                        + "VALUES (?, ?, 0, ?, ?, ?, ?, ?, now()) "
                        + "ON CONFLICT (email) DO UPDATE "
                        + "SET code = EXCLUDED.code, attempts = 0, ip = EXCLUDED.ip, country = EXCLUDED.country, "
                        + "city = EXCLUDED.city, remember = EXCLUDED.remember, expires_at = EXCLUDED.expires_at, "
                        + "created_at = now()",
                email,
                code,
                ip,
                country,
                city,
                remember,
                Timestamp.from(expiresAt));
    }

    @Override
    public Optional<LoginCode> getCode(String email) {
        List<LoginCode> rows = jdbcTemplate.query(
                "SELECT code, attempts, ip, country, city, remember, expires_at, created_at "
                        + "FROM stats_login_codes WHERE email = ?",
                ROW_MAPPER,
                email);
        return rows.stream().findFirst();
    }

    @Override
    public void registerFailedAttempt(String email) {
        jdbcTemplate.update("UPDATE stats_login_codes SET attempts = attempts + 1 WHERE email = ?", email);
    }

    @Override
    public void deleteCode(String email) {
        jdbcTemplate.update("DELETE FROM stats_login_codes WHERE email = ?", email);
    }
}
