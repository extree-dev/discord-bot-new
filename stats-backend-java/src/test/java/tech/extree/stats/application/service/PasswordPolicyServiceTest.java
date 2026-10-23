package tech.extree.stats.application.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/**
 * Тесты PasswordPolicyService. HIBP-проверка (isBreached) ходит в сеть —
 * в юнит-тестах мы её не вызываем напрямую (она fail-open), а проверяем
 * всё, что можно проверить офлайн: длину, топ-1000, вхождение email/name/
 * nickname. Реальный пароль с брешью — это интеграционный тест, не тут.
 */
class PasswordPolicyServiceTest {

    private final PasswordPolicyService service = new PasswordPolicyService();

    @Test
    void rejectsTooShort() {
        // 11 символов — меньше MIN_LENGTH (12)
        var r = service.validate("Abcdef12345", "a@b.com", "Name", "nick");
        assertFalse(r.valid());
    }

    @Test
    void rejectsTooLong() {
        var r = service.validate("a".repeat(201), "a@b.com", "Name", "nick");
        assertFalse(r.valid());
    }

    @Test
    void rejectsTopWeakPassword() {
        // "password" — в топ-1000 fallback-списка. 8 символов, но даже если бы
        // было 12 — всё равно отклонили бы по списку.
        var r = service.validate("password", "a@b.com", "Name", "nick");
        assertFalse(r.valid());
    }

    @Test
    void rejectsPasswordContainingEmail() {
        // Содержит "alice" из email — отклонить.
        var r = service.validate("Alice-Secure-Pass-99", "alice@example.com", "Alice", "alice");
        assertFalse(r.valid());
    }

    @Test
    void rejectsPasswordContainingName() {
        var r = service.validate("John-Secure-Pass-99", "a@b.com", "John", "johnny");
        assertFalse(r.valid());
    }

    @Test
    void rejectsPasswordContainingNickname() {
        var r = service.validate("nickname-Secure-99", "a@b.com", "Name", "nickname");
        assertFalse(r.valid());
    }

    @Test
    void rejectsNullPassword() {
        var r = service.validate(null, "a@b.com", "Name", "nick");
        assertFalse(r.valid());
    }

    @Test
    void acceptsStrongPassword() {
        // 16 символов, не из топ-1000, не содержит email/name/nickname.
        // HIBP может ответить 200 и сказать "не в бреши" — но даже если
        // HIBP недоступен, isBreached возвращает false (fail-open), так что
        // тест стабилен без сети.
        var r = service.validate("Tr0ub4dor&3xyZ!q", "a@b.com", "Name", "nick");
        assertTrue(r.valid(), "strong password must be accepted");
    }
}
