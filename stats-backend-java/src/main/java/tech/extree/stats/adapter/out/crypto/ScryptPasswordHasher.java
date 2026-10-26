package tech.extree.stats.adapter.out.crypto;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import org.bouncycastle.crypto.generators.SCrypt;
import org.bouncycastle.util.encoders.Hex;
import org.springframework.stereotype.Component;
import tech.extree.stats.application.port.out.PasswordHasher;

/**
 * Байт-в-байт совместим с ../../stats-backend/users.js: формат хранения
 * {@code salt:hex(scrypt(password, salt, N=16384, r=8, p=1, 64))}, где
 * salt — 32-символьная hex-строка (crypto.randomBytes(16).toString('hex')
 * в Node), а в сам scrypt как параметр "соль" идут UTF-8 байты ЭТОЙ
 * СТРОКИ (32 байта), а не 16 исходных случайных байт — ровно так, как
 * Node передаёт строку в scryptSync. N/r/p — документированные дефолты
 * crypto.scryptSync при вызове без options. Перепутать любую из этих
 * деталей значит выдать другой хеш на тот же пароль — верифицировано
 * тестом против хеша, реально посчитанного users.hashPassword (Node).
 */
@Component
public class ScryptPasswordHasher implements PasswordHasher {

    private static final int COST_N = 16384;
    private static final int BLOCK_SIZE_R = 8;
    private static final int PARALLELIZATION_P = 1;
    private static final int KEY_LENGTH_BYTES = 64;

    private final SecureRandom secureRandom = new SecureRandom();

    @Override
    public String hash(String password) {
        byte[] saltBytes = new byte[16];
        secureRandom.nextBytes(saltBytes);
        String salt = Hex.toHexString(saltBytes);
        String hash = Hex.toHexString(deriveKey(password, salt));
        return salt + ":" + hash;
    }

    @Override
    public boolean verify(String password, String stored) {
        if (stored == null) {
            return false;
        }
        String[] parts = stored.split(":", 2);
        if (parts.length != 2 || parts[0].isEmpty() || parts[1].isEmpty()) {
            return false;
        }
        byte[] candidate = deriveKey(password, parts[0]);
        byte[] expected;
        try {
            expected = Hex.decode(parts[1]);
        } catch (Exception e) {
            return false;
        }
        return candidate.length == expected.length && MessageDigest.isEqual(candidate, expected);
    }

    private static byte[] deriveKey(String password, String salt) {
        return SCrypt.generate(
                password.getBytes(StandardCharsets.UTF_8),
                salt.getBytes(StandardCharsets.UTF_8),
                COST_N,
                BLOCK_SIZE_R,
                PARALLELIZATION_P,
                KEY_LENGTH_BYTES);
    }
}
