package tech.extree.stats.domain;

import java.time.Instant;

/**
 * Зеркало stats_users (см. ../../stats-backend/db.js) — чистый домен, без
 * Spring/JDBC-аннотаций: это то, что видят порты и сервисы, маппинг
 * строки БД в этот объект — забота адаптера (JdbcUserRepository), не
 * домена.
 */
public record User(
        String id,
        String email,
        String passwordHash,
        Instant emailVerifiedAt,
        String riotPuuid,
        String name,
        String nickname) {

    public boolean emailVerified() {
        return emailVerifiedAt != null;
    }

    public boolean riotLinked() {
        return riotPuuid != null;
    }
}
