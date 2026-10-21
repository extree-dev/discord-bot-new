package tech.extree.stats.adapter.out.crypto;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Решающий тест, как и AesGcmSessionCodecTest: хеш ниже получен реальным
 * вызовом users.hashPassword('CorrectHorseBattery9') в Node
 * (../../../../../../stats-backend/users.js). Если verify() здесь не
 * подтверждает этот хеш — ни один существующий пользователь не сможет
 * войти через Java-сервис со своим текущим паролем.
 */
class ScryptPasswordHasherTest {

    private static final String PASSWORD = "CorrectHorseBattery9";
    // node -e "console.log(require('./stats-backend/users').hashPassword('CorrectHorseBattery9'))"
    private static final String NODE_GENERATED_HASH =
            "6e49e74e082d484413122bd14fbf9b53:"
                    + "1cd6aa48b2d90367b851dc1af8e00d133cd8d67f3d7e75836276b5eab96effdb210f2e68504ffc89bf323794039f1610cbf317030a0206a1e254fe9df88f033e";

    private final ScryptPasswordHasher hasher = new ScryptPasswordHasher();

    @Test
    void verifiesAPasswordHashedByTheNodeService() {
        assertThat(hasher.verify(PASSWORD, NODE_GENERATED_HASH)).isTrue();
    }

    @Test
    void rejectsTheWrongPasswordAgainstANodeGeneratedHash() {
        assertThat(hasher.verify("wrongpassword", NODE_GENERATED_HASH)).isFalse();
    }

    @Test
    void hashesIssuedHereAreInTurnVerifiableHere() {
        String hash = hasher.hash("another-password-1");

        assertThat(hasher.verify("another-password-1", hash)).isTrue();
        assertThat(hasher.verify("not-it", hash)).isFalse();
    }

    @Test
    void rejectsMalformedStoredValues() {
        assertThat(hasher.verify(PASSWORD, null)).isFalse();
        assertThat(hasher.verify(PASSWORD, "no-colon-here")).isFalse();
        assertThat(hasher.verify(PASSWORD, "")).isFalse();
    }
}
