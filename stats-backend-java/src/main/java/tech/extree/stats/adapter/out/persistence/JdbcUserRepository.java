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

/**
 * Читает ту же таблицу stats_users, что users.js (Node) — схема ещё
 * создаётся/мигрируется Node-сервисом (db.js, ensureSchema), этот
 * адаптер только читает, DDL сюда намеренно не продублирован: пока оба
 * сервиса работают с одной БД, источник истины для схемы один.
 */
@Repository
public class JdbcUserRepository implements UserRepository {

    private static final RowMapper<User> USER_ROW_MAPPER =
            (rs, rowNum) -> new User(
                    rs.getString("id"),
                    rs.getString("email"),
                    rs.getString("password_hash"),
                    toInstant(rs.getTimestamp("email_verified_at")),
                    rs.getString("riot_puuid"),
                    rs.getString("name"),
                    rs.getString("nickname"));

    // upsertUnverifiedUser/markEmailVerified в users.js возвращают только
    // id, email, email_verified_at (RETURNING) — остальные поля User тут
    // не нужны ни одному вызывающему коду, оставляем null, как и Node не
    // отдаёт их из этих функций.
    private static final RowMapper<User> UPSERT_RESULT_ROW_MAPPER =
            (rs, rowNum) -> new User(
                    rs.getString("id"), rs.getString("email"), null, toInstant(rs.getTimestamp("email_verified_at")),
                    null, null, null);

    // updatePasswordHash/updateEmail в users.js возвращают только id, email
    // (RETURNING) — то же сокращение, что у UPSERT_RESULT_ROW_MAPPER выше.
    private static final RowMapper<User> ID_EMAIL_ROW_MAPPER =
            (rs, rowNum) -> new User(rs.getString("id"), rs.getString("email"), null, null, null, null, null);

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
                "SELECT id, email, password_hash, email_verified_at, riot_puuid, name, nickname "
                        + "FROM stats_users WHERE id = ?",
                USER_ROW_MAPPER,
                id);
        return rows.stream().findFirst();
    }

    @Override
    public Optional<User> findByEmail(String email) {
        List<User> rows = jdbcTemplate.query(
                "SELECT id, email, password_hash, email_verified_at, riot_puuid, name, nickname "
                        + "FROM stats_users WHERE email = ?",
                USER_ROW_MAPPER,
                email);
        return rows.stream().findFirst();
    }

    @Override
    public User upsertUnverifiedUser(String email, String passwordHash, String name, String nickname) {
        try {
            return jdbcTemplate.queryForObject(
                    "INSERT INTO stats_users (id, email, password_hash, name, nickname) "
                            + "VALUES (?, ?, ?, ?, ?) "
                            + "ON CONFLICT (email) DO UPDATE "
                            + "SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name, "
                            + "nickname = EXCLUDED.nickname "
                            + "RETURNING id, email, email_verified_at",
                    UPSERT_RESULT_ROW_MAPPER,
                    UUID.randomUUID().toString(),
                    email,
                    passwordHash,
                    name,
                    nickname);
        } catch (DuplicateKeyException e) {
            // ON CONFLICT (email) выше уже разрешает конфликт по email —
            // единственный другой UNIQUE на этой таблице (stats_users_nickname_key,
            // см. db.js) может всплыть только из-за чужого nickname.
            throw new NicknameTakenException(nickname);
        }
    }

    @Override
    public Optional<User> markEmailVerified(String email) {
        List<User> rows = jdbcTemplate.query(
                "UPDATE stats_users SET email_verified_at = now() WHERE email = ? "
                        + "RETURNING id, email, email_verified_at",
                UPSERT_RESULT_ROW_MAPPER,
                email);
        return rows.stream().findFirst();
    }

    @Override
    public Optional<User> updatePasswordHash(String userId, String passwordHash) {
        List<User> rows = jdbcTemplate.query(
                "UPDATE stats_users SET password_hash = ? WHERE id = ? RETURNING id, email",
                ID_EMAIL_ROW_MAPPER,
                passwordHash,
                userId);
        return rows.stream().findFirst();
    }

    @Override
    public Optional<User> updateEmail(String userId, String newEmail) {
        List<User> rows = jdbcTemplate.query(
                "UPDATE stats_users SET email = ?, email_verified_at = now() WHERE id = ? RETURNING id, email",
                ID_EMAIL_ROW_MAPPER,
                newEmail,
                userId);
        return rows.stream().findFirst();
    }
}
