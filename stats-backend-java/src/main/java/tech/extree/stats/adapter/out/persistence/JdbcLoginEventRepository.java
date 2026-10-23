package tech.extree.stats.adapter.out.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import tech.extree.stats.application.port.out.LoginEventRepository;
import tech.extree.stats.domain.LoginEvent;

/**
 * Та же таблица/SQL, что ../../stats-backend/loginEvents.js (Node),
 * включая обрезку истории до MAX_EVENTS_PER_USER записей на пользователя.
 */
@Repository
public class JdbcLoginEventRepository implements LoginEventRepository {

    private static final int MAX_EVENTS_PER_USER = 20;

    private static final RowMapper<LoginEvent> ROW_MAPPER =
            (rs, rowNum) -> new LoginEvent(
                    rs.getString("id"),
                    rs.getString("ip"),
                    rs.getString("country"),
                    rs.getString("city"),
                    rs.getTimestamp("created_at").toInstant(), rs.getString("user_agent"));

    private final JdbcTemplate jdbcTemplate;

    public JdbcLoginEventRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void recordLogin(String userId, String ip, String country, String city, String userAgent) {
        jdbcTemplate.update(
                "INSERT INTO stats_login_events (id, user_id, ip, country, city) VALUES (?, ?, ?, ?, ?, ?)", UUID.randomUUID().toString(), userId, ip, country, city, userAgent);
        jdbcTemplate.update(
                "DELETE FROM stats_login_events "
                        + "WHERE user_id = ? AND id NOT IN ("
                        + "  SELECT id FROM stats_login_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
                        + ")",
                userId,
                userId,
                MAX_EVENTS_PER_USER);
    }

    @Override
    public List<LoginEvent> listRecent(String userId, int limit) {
        return jdbcTemplate.query(
                "SELECT id, ip, country, city, created_at, user_agent FROM stats_login_events "
                        + "WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                ROW_MAPPER,
                userId,
                limit);
    }

    @Override
    public boolean deleteById(String userId, String eventId) {
        Integer deleted = jdbcTemplate.update(
                "DELETE FROM stats_login_events WHERE id = ? AND user_id = ?",
                eventId, userId);
        return deleted != null && deleted > 0;
    }
}