package tech.extree.stats.adapter.out.persistence;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.NicknameTakenException;
import tech.extree.stats.domain.User;

@Repository
public class JdbcUserRepository implements UserRepository {

    private static final RowMapper<User> USER_ROW_MAPPER = (rs, rowNum) -> new User(
            rs.getString("id"),
            rs.getString("email"),
            rs.getString("password_hash"),
            toInstant(rs.getTimestamp("email_verified_at")),
            rs.getString("riot_puuid"),
            rs.getString("name"),
            rs.getString("nickname"),
            rs.getString("avatar_url"),
            rs.getBoolean("is_verified"),
            rs.getBoolean("is_banned"),
            rs.getBoolean("is_admin"));

    private static final RowMapper<User> UPSERT_RESULT_ROW_MAPPER = (rs, rowNum) -> new User(
            rs.getString("id"), rs.getString("email"), null,
            toInstant(rs.getTimestamp("email_verified_at")),
            null, null, null, null, false, false, false);

    private static final RowMapper<User> ID_EMAIL_ROW_MAPPER = (rs, rowNum) -> new User(
            rs.getString("id"), rs.getString("email"), null, null, null, null, null, null, false, false, false);

    // Для поиска в админ-палитре — только то, что реально показывается
    // в результатах (id/email/name/nickname).
    private static final RowMapper<User> SEARCH_ROW_MAPPER = (rs, rowNum) -> new User(
            rs.getString("id"), rs.getString("email"), null, null, null,
            rs.getString("name"), rs.getString("nickname"), null, false, false, false);

    private final JdbcTemplate jdbcTemplate;

    public JdbcUserRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static Instant toInstant(Timestamp ts) {
        return ts != null ? ts.toInstant() : null;
    }

    @Override
    public Optional<User> findById(String id) {
        List<User> rows = jdbcTemplate.query(
                "SELECT id, email, password_hash, email_verified_at, riot_puuid, name, nickname, avatar_url, is_verified, is_banned, is_admin " +
                        "FROM stats_users WHERE id = ?",
                USER_ROW_MAPPER, id);
        return rows.stream().findFirst();
    }

    @Override
    public Optional<User> findByEmail(String email) {
        List<User> rows = jdbcTemplate.query(
                "SELECT id, email, password_hash, email_verified_at, riot_puuid, name, nickname, avatar_url, is_verified, is_banned, is_admin " +
                        "FROM stats_users WHERE email = ?",
                USER_ROW_MAPPER, email);
        return rows.stream().findFirst();
    }

    @Override
    public User upsertUnverifiedUser(String email, String passwordHash, String name, String nickname) {
        try {
            return jdbcTemplate.queryForObject(
                    "INSERT INTO stats_users (id, email, password_hash, name, nickname) " +
                            "VALUES (?, ?, ?, ?, ?) " +
                            "ON CONFLICT (email) DO UPDATE " +
                            "SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name, nickname = EXCLUDED.nickname " +
                            "RETURNING id, email, email_verified_at",
                    UPSERT_RESULT_ROW_MAPPER,
                    UUID.randomUUID().toString(), email, passwordHash, name, nickname);
        } catch (DuplicateKeyException e) {
            throw new NicknameTakenException(nickname);
        }
    }

    @Override
    public Optional<User> markEmailVerified(String email) {
        List<User> rows = jdbcTemplate.query(
                "UPDATE stats_users SET email_verified_at = now() WHERE email = ? RETURNING id, email, email_verified_at",
                UPSERT_RESULT_ROW_MAPPER, email);
        return rows.stream().findFirst();
    }

    @Override
    public Optional<User> updatePasswordHash(String userId, String passwordHash) {
        List<User> rows = jdbcTemplate.query(
                "UPDATE stats_users SET password_hash = ? WHERE id = ? RETURNING id, email",
                ID_EMAIL_ROW_MAPPER, passwordHash, userId);
        return rows.stream().findFirst();
    }

    @Override
    public Optional<User> updateEmail(String userId, String newEmail) {
        List<User> rows = jdbcTemplate.query(
                "UPDATE stats_users SET email = ?, email_verified_at = now() WHERE id = ? RETURNING id, email",
                ID_EMAIL_ROW_MAPPER, newEmail, userId);
        return rows.stream().findFirst();
    }

    @Override
    public void updateAvatar(String userId, String avatarUrl) {
        jdbcTemplate.update("UPDATE stats_users SET avatar_url = ? WHERE id = ?", avatarUrl, userId);
    }

    @Override
    public void setVerified(String userId, boolean isVerified) {
        jdbcTemplate.update("UPDATE stats_users SET is_verified = ? WHERE id = ?", isVerified, userId);
    }

    @Override
    public void setBanned(String userId, boolean isBanned) {
        jdbcTemplate.update("UPDATE stats_users SET is_banned = ? WHERE id = ?", isBanned, userId);
    }

    @Override
    public void setAdmin(String userId, boolean isAdmin) {
        jdbcTemplate.update("UPDATE stats_users SET is_admin = ? WHERE id = ?", isAdmin, userId);
    }

    @Override
    public void deleteById(String userId) {
        jdbcTemplate.update("DELETE FROM stats_users WHERE id = ?", userId);
    }

    @Override
    public List<User> findAllUsers() {
        return jdbcTemplate.query(
                "SELECT id, email, password_hash, email_verified_at, riot_puuid, name, nickname, avatar_url, is_verified, is_banned, is_admin " +
                        "FROM stats_users ORDER BY id DESC LIMIT 100",
                USER_ROW_MAPPER);
    }

    @Override
    public List<User> searchUsers(String likeQuery) {
        return jdbcTemplate.query(
                "SELECT id, email, name, nickname FROM stats_users " +
                        "WHERE lower(email) LIKE ? OR lower(coalesce(name, '')) LIKE ? OR lower(coalesce(nickname, '')) LIKE ? " +
                        "ORDER BY created_at DESC LIMIT 5",
                SEARCH_ROW_MAPPER, likeQuery, likeQuery, likeQuery);
    }
}