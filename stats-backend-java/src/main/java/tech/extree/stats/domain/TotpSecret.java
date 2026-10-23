package tech.extree.stats.domain;

import java.time.Instant;
import java.util.List;

/** Зеркало строки stats_user_totp_secrets. */
public record TotpSecret(
        String userId,
        String secret,
        Instant enabledAt,
        List<String> recoveryCodesHashed,
        Instant createdAt,
        Instant updatedAt) {

    public boolean isEnabled() {
        return enabledAt != null;
    }
}