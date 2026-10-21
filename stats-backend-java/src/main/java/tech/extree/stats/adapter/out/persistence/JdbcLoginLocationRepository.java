package tech.extree.stats.adapter.out.persistence;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tech.extree.stats.application.port.out.LoginLocationRepository;

/** Та же таблица/SQL, что ../../stats-backend/loginLocations.js (Node). */
@Repository
public class JdbcLoginLocationRepository implements LoginLocationRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcLoginLocationRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public boolean hasAnyKnownLocation(String userId) {
        Boolean exists = jdbcTemplate.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM stats_known_locations WHERE user_id = ?)", Boolean.class, userId);
        return Boolean.TRUE.equals(exists);
    }

    @Override
    public boolean isKnownLocation(String userId, String country) {
        if (country == null) {
            return true;
        }
        Boolean exists = jdbcTemplate.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM stats_known_locations WHERE user_id = ? AND country = ?)",
                Boolean.class,
                userId,
                country);
        return Boolean.TRUE.equals(exists);
    }

    @Override
    public void rememberLocation(String userId, String country, String city, String ip) {
        if (country == null) {
            return;
        }
        jdbcTemplate.update(
                "INSERT INTO stats_known_locations (user_id, country, city, last_ip, created_at, last_seen_at) "
                        + "VALUES (?, ?, ?, ?, now(), now()) "
                        + "ON CONFLICT (user_id, country) DO UPDATE "
                        + "SET city = EXCLUDED.city, last_ip = EXCLUDED.last_ip, last_seen_at = now()",
                userId,
                country,
                city,
                ip);
    }
}
