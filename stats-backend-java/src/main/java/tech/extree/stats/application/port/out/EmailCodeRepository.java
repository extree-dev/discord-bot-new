package tech.extree.stats.application.port.out;

import java.time.Instant;
import java.util.Optional;
import tech.extree.stats.domain.EmailCode;

/** Соответствует emailCodes.js (Node) — коды подтверждения email при регистрации. */
public interface EmailCodeRepository {
    void upsertCode(String email, String code, Instant expiresAt);

    Optional<EmailCode> getCode(String email);

    void registerFailedAttempt(String email);

    void deleteCode(String email);
}
