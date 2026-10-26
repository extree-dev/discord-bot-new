package tech.extree.stats.application.port.out;

import java.time.Instant;
import java.util.Optional;
import tech.extree.stats.domain.LoginCode;

/** Соответствует loginCodes.js (Node) — коды подтверждения входа с нового места, stats_login_codes. */
public interface LoginCodeRepository {
    void upsertCode(String email, String code, String ip, String country, String city, boolean remember, Instant expiresAt);

    Optional<LoginCode> getCode(String email);

    void registerFailedAttempt(String email);

    void deleteCode(String email);
}
