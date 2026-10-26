package tech.extree.stats.application.port.out;

/** Шифрование TOTP-секрета перед хранением в stats_user_totp_secrets. */
public interface TotpSecretCodec {

    String encrypt(String plainSecret);

    /** Расшифровать; на старых незашифрованных записях возвращает вход как есть. */
    String decrypt(String stored);
}
