package tech.extree.stats.adapter.out.persistence;

import java.sql.Timestamp;
import java.time.Instant;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tech.extree.stats.application.port.out.LoginAttemptRepository;

@Repository
public class JdbcLoginAttemptRepository implements LoginAttemptRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcLoginAttemptRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void record(String email, String ip, String country, boolean success, String reason) {
        jdbcTemplate.update(
                "INSERT INTO stats_login_attempts (email, ip, country, success, reason) VALUES (?, ?, ?, ?, ?)",
                email, ip, country, success, reason);
    }

    @Override
    public int countFailuresSince(String email, Instant since) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM stats_login_attempts " +
                        "WHERE email = ? AND success = false AND created_at >= ?",
                Integer.class, email, Timestamp.from(since));
        return count == null ? 0 : count;
    }
}