package tech.extree.stats.adapter.out.persistence;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import tech.extree.stats.application.port.out.SupportTicketRepository;
import tech.extree.stats.domain.SupportTicket;
import tech.extree.stats.domain.TicketReply;

/** Та же таблица/SQL, что ../../stats-backend/supportTickets.js (Node). */
@Repository
public class JdbcSupportTicketRepository implements SupportTicketRepository {

    private static final long RESEND_COOLDOWN_SECONDS = 60;

    private static final RowMapper<SupportTicket> FULL_ROW_MAPPER =
            (rs, rowNum) -> new SupportTicket(
                    rs.getString("id"),
                    rs.getString("user_id"),
                    rs.getString("email"),
                    rs.getString("subject"),
                    rs.getString("message"),
                    rs.getString("category"),
                    rs.getString("status"),
                    rs.getString("view_token"),
                    rs.getLong("ticket_number"),
                    rs.getTimestamp("created_at").toInstant());

    // Для списка админки — без текста сообщения, та же экономия, что у
    // Node (listTickets в supportTickets.js не тянет message).
    private static final RowMapper<SupportTicket> SUMMARY_ROW_MAPPER =
            (rs, rowNum) -> new SupportTicket(
                    null,
                    null,
                    rs.getString("email"),
                    rs.getString("subject"),
                    null,
                    rs.getString("category"),
                    rs.getString("status"),
                    null,
                    rs.getLong("ticket_number"),
                    rs.getTimestamp("created_at").toInstant());

    // Для поиска в админ-палитре — только то, что реально показывается
    // в результатах (номер/email/subject/status).
    private static final RowMapper<SupportTicket> SEARCH_ROW_MAPPER =
            (rs, rowNum) -> new SupportTicket(
                    null,
                    null,
                    rs.getString("email"),
                    rs.getString("subject"),
                    null,
                    null,
                    rs.getString("status"),
                    null,
                    rs.getLong("ticket_number"),
                    null);

    private static final RowMapper<TicketReply> REPLY_ROW_MAPPER =
            (rs, rowNum) -> new TicketReply(
                    rs.getString("id"), rs.getString("author"), rs.getString("message"), rs.getTimestamp("created_at").toInstant());

    private final JdbcTemplate jdbcTemplate;
    private final SecureRandom secureRandom = new SecureRandom();

    public JdbcSupportTicketRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public SupportTicket createTicket(String userId, String email, String subject, String message, String category) {
        String id = UUID.randomUUID().toString();
        String viewToken = generateViewToken();
        Long ticketNumber = jdbcTemplate.queryForObject(
                "INSERT INTO stats_support_tickets (id, user_id, email, subject, message, category, view_token) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING ticket_number",
                Long.class,
                id,
                userId,
                email,
                subject,
                message,
                category,
                viewToken);
        return new SupportTicket(id, userId, email, subject, message, category, null, viewToken, ticketNumber, null);
    }

    @Override
    public boolean isOnCooldown(String email) {
        return lastCreatedAt("SELECT created_at FROM stats_support_tickets WHERE email = ? ORDER BY created_at DESC LIMIT 1", email);
    }

    @Override
    public boolean isReplyOnCooldown(String ticketId) {
        return lastCreatedAt(
                "SELECT created_at FROM stats_support_ticket_replies "
                        + "WHERE ticket_id = ? AND author = 'user' ORDER BY created_at DESC LIMIT 1",
                ticketId);
    }

    private boolean lastCreatedAt(String sql, String param) {
        List<Instant> rows = jdbcTemplate.query(sql, (rs, rowNum) -> rs.getTimestamp("created_at").toInstant(), param);
        return rows.stream()
                .findFirst()
                .map(createdAt -> createdAt.isAfter(Instant.now().minusSeconds(RESEND_COOLDOWN_SECONDS)))
                .orElse(false);
    }

    @Override
    public List<SupportTicket> listTickets(String status) {
        if (status != null) {
            return jdbcTemplate.query(
                    "SELECT ticket_number, email, subject, category, status, created_at FROM stats_support_tickets "
                            + "WHERE status = ? ORDER BY created_at DESC LIMIT 200",
                    SUMMARY_ROW_MAPPER,
                    status);
        }
        return jdbcTemplate.query(
                "SELECT ticket_number, email, subject, category, status, created_at FROM stats_support_tickets "
                        + "ORDER BY created_at DESC LIMIT 200",
                SUMMARY_ROW_MAPPER);
    }

    @Override
    public List<SupportTicket> searchTickets(String likeQuery) {
        return jdbcTemplate.query(
                "SELECT ticket_number, email, subject, status FROM stats_support_tickets " +
                        "WHERE lower(subject) LIKE ? OR lower(email) LIKE ? OR CAST(ticket_number AS TEXT) LIKE ? " +
                        "ORDER BY created_at DESC LIMIT 5",
                SEARCH_ROW_MAPPER, likeQuery, likeQuery, likeQuery);
    }

    @Override
    public Optional<SupportTicket> getTicketByNumber(long ticketNumber) {
        List<SupportTicket> rows = jdbcTemplate.query(
                "SELECT id, user_id, email, subject, message, category, status, view_token, ticket_number, created_at "
                        + "FROM stats_support_tickets WHERE ticket_number = ?",
                FULL_ROW_MAPPER,
                ticketNumber);
        return rows.stream().findFirst();
    }

    @Override
    public Optional<SupportTicket> getTicketByToken(String viewToken) {
        List<SupportTicket> rows = jdbcTemplate.query(
                "SELECT id, user_id, email, subject, message, category, status, view_token, ticket_number, created_at "
                        + "FROM stats_support_tickets WHERE view_token = ?",
                FULL_ROW_MAPPER,
                viewToken);
        return rows.stream().findFirst();
    }

    @Override
    public List<TicketReply> listReplies(String ticketId) {
        return jdbcTemplate.query(
                "SELECT id, author, message, created_at FROM stats_support_ticket_replies "
                        + "WHERE ticket_id = ? ORDER BY created_at ASC",
                REPLY_ROW_MAPPER,
                ticketId);
    }

    @Override
    public void addReply(String ticketId, String author, String message) {
        jdbcTemplate.update(
                "INSERT INTO stats_support_ticket_replies (id, ticket_id, author, message) VALUES (?, ?, ?, ?)",
                UUID.randomUUID().toString(),
                ticketId,
                author,
                message);
    }

    @Override
    public void setStatus(String ticketId, String status) {
        jdbcTemplate.update("UPDATE stats_support_tickets SET status = ? WHERE id = ?", status, ticketId);
    }

    private String generateViewToken() {
        byte[] bytes = new byte[24];
        secureRandom.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
