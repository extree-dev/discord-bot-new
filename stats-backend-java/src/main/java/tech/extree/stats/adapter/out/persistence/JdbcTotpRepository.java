package tech.extree.stats.adapter.out.persistence;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import tech.extree.stats.application.port.out.TotpRepository;
import tech.extree.stats.domain.TotpSecret;

@Repository
public class JdbcTotpRepository implements TotpRepository {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final RowMapper<TotpSecret> ROW_MAPPER = (rs, n) -> {
        List<String> codes;
        try {
            codes = objectMapper.readValue(rs.getString("recovery_codes_hashed"), new TypeReference<List<String>>() {});
        } catch (Exception e) {
            codes = List.of();
        }
        return new TotpSecret(
                rs.getString("user_id"),
                rs.getString("secret_encrypted"),
                toInstant(rs.getTimestamp("enabled_at")),
                codes,
                toInstant(rs.getTimestamp("created_at")),
                toInstant(rs.getTimestamp("updated_at")));
    };

    private static Instant toInstant(Timestamp ts) {
        return ts != null ? ts.toInstant() : null;
    }

    public JdbcTotpRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Optional<TotpSecret> findByUserId(String userId) {
        List<TotpSecret> rows = jdbcTemplate.query(
                "SELECT user_id, secret_encrypted, enabled_at, recovery_codes_hashed, created_at, updated_at " +
                        "FROM stats_user_totp_secrets WHERE user_id = ?",
                ROW_MAPPER, userId);
        return rows.stream().findFirst();
    }

    @Override
    public void upsertPending(String userId, String secret, List<String> recoveryCodesHashed) {
        try {
            String codesJson = objectMapper.writeValueAsString(recoveryCodesHashed);
            jdbcTemplate.update(
                    "INSERT INTO stats_user_totp_secrets (user_id, secret_encrypted, recovery_codes_hashed) " +
                            "VALUES (?, ?, CAST(? AS jsonb)) " +
                            "ON CONFLICT (user_id) DO UPDATE " +
                            "SET secret_encrypted = EXCLUDED.secret_encrypted, " +
                            "    recovery_codes_hashed = EXCLUDED.recovery_codes_hashed, " +
                            "    enabled_at = NULL, updated_at = now()",
                    userId, secret, codesJson);
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось сохранить TOTP-секрет", e);
        }
    }

    @Override
    public void enable(String userId, Instant now) {
        jdbcTemplate.update(
                "UPDATE stats_user_totp_secrets SET enabled_at = ?, updated_at = now() WHERE user_id = ?",
                Timestamp.from(now), userId);
    }

    @Override
    public void delete(String userId) {
        jdbcTemplate.update("DELETE FROM stats_user_totp_secrets WHERE user_id = ?", userId);
    }

    @Override
    public void updateRecoveryCodes(String userId, List<String> hashedCodes) {
        try {
            String codesJson = objectMapper.writeValueAsString(hashedCodes);
            jdbcTemplate.update(
                    "UPDATE stats_user_totp_secrets SET recovery_codes_hashed = CAST(? AS jsonb), updated_at = now() " +
                            "WHERE user_id = ?",
                    codesJson, userId);
        } catch (Exception e) {
            throw new IllegalStateException("Не удалось обновить recovery-коды", e);
        }
    }

    @Override
    public void removeRecoveryCode(String userId, String hashedCode) {
        jdbcTemplate.update(
                "UPDATE stats_user_totp_secrets " +
                        "SET recovery_codes_hashed = recovery_codes_hashed - ?::text, updated_at = now() " +
                        "WHERE user_id = ?",
                hashedCode, userId);
    }
}