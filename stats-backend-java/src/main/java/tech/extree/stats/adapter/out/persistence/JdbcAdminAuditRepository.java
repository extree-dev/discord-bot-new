package tech.extree.stats.adapter.out.persistence;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import tech.extree.stats.application.port.out.AdminAuditRepository;
import tech.extree.stats.domain.AdminAuditEntry;

@Repository
public class JdbcAdminAuditRepository implements AdminAuditRepository {

    private static final RowMapper<AdminAuditEntry> ROW_MAPPER = (rs, n) -> new AdminAuditEntry(
            rs.getLong("id"),
            rs.getString("admin_id"),
            rs.getString("admin_email"),
            rs.getString("action"),
            rs.getString("target_type"),
            rs.getString("target_id"),
            rs.getString("metadata"),
            rs.getString("ip"),
            rs.getTimestamp("created_at").toInstant());

    private final JdbcTemplate jdbcTemplate;

    public JdbcAdminAuditRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void record(String adminId, String action, String targetType, String targetId, String metadata, String ip) {
        jdbcTemplate.update(
                "INSERT INTO stats_admin_audit (admin_id, action, target_type, target_id, metadata, ip) " +
                        "VALUES (?, ?, ?, ?, CAST(? AS jsonb), ?)",
                adminId, action, targetType, targetId, metadata, ip);
    }

    @Override
    public List<AdminAuditEntry> list(int limit, int offset) {
        return jdbcTemplate.query(
                "SELECT a.id, a.admin_id, u.email AS admin_email, a.action, a.target_type, a.target_id, " +
                        "a.metadata::text AS metadata, a.ip, a.created_at " +
                        "FROM stats_admin_audit a JOIN stats_users u ON u.id = a.admin_id " +
                        "ORDER BY a.created_at DESC LIMIT ? OFFSET ?",
                ROW_MAPPER, limit, offset);
    }
}