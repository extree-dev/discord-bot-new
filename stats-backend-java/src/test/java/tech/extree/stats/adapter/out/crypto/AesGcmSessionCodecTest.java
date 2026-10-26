package tech.extree.stats.adapter.out.crypto;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import tech.extree.stats.domain.Session;

/**
 * Решающий тест для всей этой фазы перехода: токен ниже получен РЕАЛЬНЫМ
 * вызовом encryptSession из ../../../../../../stats-backend/session.js
 * (Node), с тем же секретом. Если этот тест падает — Java-сервис не
 * сможет прочитать ни одну cookie, выданную Node, и переключать на него
 * трафик нельзя.
 */
class AesGcmSessionCodecTest {

    private static final String SECRET = "test-compat-secret-value-1234567890";
    // Сгенерировано: node -e "require('./stats-backend/session').encryptSession(...)"
    private static final String NODE_ISSUED_TOKEN =
            "YJcjlFyhmM9TgYg22u1pHzszRxUfJaMt3h397la8H2xpIvVOgVodiuA0zxhlIDs6Sh5mCXbpWl1znWG-OE68sMU6sETkb6hQABv_OSgK";

    @Test
    void decryptsATokenIssuedByTheNodeServiceByteForByte() {
        AesGcmSessionCodec codec = new AesGcmSessionCodec(SECRET);

        Optional<Session> result = codec.decrypt(NODE_ISSUED_TOKEN);

        assertThat(result).isPresent();
        assertThat(result.get().userId()).isEqualTo("user-abc-123");
        assertThat(result.get().issuedAt()).isEqualTo(1700000000000L);
        assertThat(result.get().sub()).isNull();
    }

    @Test
    void returnsEmptyForATokenEncryptedWithADifferentSecret() {
        AesGcmSessionCodec codec = new AesGcmSessionCodec("a-completely-different-secret");

        assertThat(codec.decrypt(NODE_ISSUED_TOKEN)).isEmpty();
    }

    @Test
    void returnsEmptyForGarbageInput() {
        AesGcmSessionCodec codec = new AesGcmSessionCodec(SECRET);

        assertThat(codec.decrypt("not-a-valid-token")).isEmpty();
    }

    @Test
    void encryptsAndDecryptsItsOwnTokenRoundTrip() {
        AesGcmSessionCodec codec = new AesGcmSessionCodec(SECRET);
        Session original = new Session(null, "user-xyz-999", 1700000005000L);

        String token = codec.encrypt(original);
        Optional<Session> decoded = codec.decrypt(token);

        assertThat(decoded).contains(original);
    }

    // Проверено вручную (не как JUnit — нет Node-рантайма в этом модуле),
    // см. PR: токен, выпущенный encrypt() здесь, был скормлен Node'овому
    // decryptSession(token, SECRET) и расшифровался в тот же {userId,
    // issuedAt} — то есть cookie, выпущенная Java-сервисом, тоже понятна
    // Node, если трафик на переходный период распределён в обе стороны.
}
