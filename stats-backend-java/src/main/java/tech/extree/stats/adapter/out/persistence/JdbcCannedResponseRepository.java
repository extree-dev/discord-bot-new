package tech.extree.stats.adapter.out.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import tech.extree.stats.application.port.out.CannedResponseRepository;
import tech.extree.stats.domain.CannedResponse;

/** Та же таблица/SQL, что ../../stats-backend/cannedResponses.js (Node). */
@Repository
public class JdbcCannedResponseRepository implements CannedResponseRepository {

    private static final RowMapper<CannedResponse> ROW_MAPPER =
            (rs, rowNum) -> new CannedResponse(rs.getString("id"), rs.getString("title"), rs.getString("body"));

    private final JdbcTemplate jdbcTemplate;

    public JdbcCannedResponseRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<CannedResponse> list() {
        return jdbcTemplate.query("SELECT id, title, body FROM stats_canned_responses ORDER BY title ASC", ROW_MAPPER);
    }

    @Override
    public String create(String title, String body) {
        String id = UUID.randomUUID().toString();
        jdbcTemplate.update("INSERT INTO stats_canned_responses (id, title, body) VALUES (?, ?, ?)", id, title, body);
        return id;
    }

    @Override
    public void delete(String id) {
        jdbcTemplate.update("DELETE FROM stats_canned_responses WHERE id = ?", id);
    }
}
