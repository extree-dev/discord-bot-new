package tech.extree.stats.adapter.out.persistence;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tech.extree.stats.application.port.out.LoginEventRepository;

/**
 * Та же таблица/SQL, что ../../stats-backend/loginEvents.js (Node),
 * включая обрезку истории до MAX_EVENTS_PER_USER записей на пользователя.
 */
@Repository
public class JdbcLoginEventRepository implements LoginEventRepository {

    private static final int MAX_EVENTS_PER_USER = 20;

    private final JdbcTemplate jdbcTemplate;

    public JdbcLoginEventRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void recordLogin(String userId, String ip, String country, String city) {
        jdbcTemplate.update(
                "INSERT INTO stats_login_events (id, user_id, ip, country, city) VALUES (?, ?, ?, ?, ?)",
                UUID.randomUUID().toString(),
                userId,
                ip,
                country,
                city);
        jdbcTemplate.update(
                "DELETE FROM stats_login_events "
                        + "WHERE user_id = ? AND id NOT IN ("
                        + "  SELECT id FROM stats_login_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
                        + ")",
                userId,
                userId,
                MAX_EVENTS_PER_USER);
    }
}
