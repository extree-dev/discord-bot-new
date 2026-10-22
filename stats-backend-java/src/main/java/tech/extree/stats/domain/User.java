package tech.extree.stats.domain;

import java.time.Instant;

public record User(
        String id,
        String email,
        String passwordHash,
        Instant emailVerifiedAt,
        String riotPuuid,
        String name,
        String nickname,
        String avatarUrl,
        boolean isVerified,
        boolean isBanned,
        boolean isAdmin // <-- НОВОЕ ПОЛЕ
) {
    public boolean emailVerified() {
        return emailVerifiedAt != null;
    }

    public boolean riotLinked() {
        return riotPuuid != null;
    }
}