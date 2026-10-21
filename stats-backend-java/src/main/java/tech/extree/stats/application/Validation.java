package tech.extree.stats.application;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Зеркало ../../stats-backend/validation.js, правило в правило —
 * расхождение здесь означает, что Java-сервис принимает/отклоняет
 * другие пароли или email, чем Node, и для одного и того же аккаунта
 * поведение двух сервисов разойдётся.
 */
public final class Validation {

    private static final Pattern EMAIL_RE = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern NICKNAME_RE = Pattern.compile("^[a-zA-Z0-9_]{3,24}$");
    private static final Pattern HAS_LETTER = Pattern.compile("[a-zA-Z]");
    private static final Pattern HAS_DIGIT = Pattern.compile("[0-9]");

    private Validation() {}

    public static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    public static boolean isValidEmail(String email) {
        return email != null && EMAIL_RE.matcher(email).matches();
    }

    public static boolean isValidPassword(String password) {
        if (password == null || password.length() < 8 || password.length() > 200) {
            return false;
        }
        return HAS_LETTER.matcher(password).find() && HAS_DIGIT.matcher(password).find();
    }

    public static boolean isValidName(String name) {
        return name != null && !name.trim().isEmpty() && name.trim().length() <= 100;
    }

    public static boolean isValidNickname(String nickname) {
        return nickname != null && NICKNAME_RE.matcher(nickname).matches();
    }

    public static boolean isValidSubject(String subject) {
        return subject != null && !subject.trim().isEmpty() && subject.trim().length() <= 200;
    }

    public static boolean isValidMessage(String message) {
        return message != null && !message.trim().isEmpty() && message.trim().length() <= 5000;
    }

    // Ключи категорий заявок — те же, что в pages/support фронтенда
    // (Node), не отображаемые надписи, чтобы текст можно было поменять
    // без миграции данных.
    private static final List<String> SUPPORT_CATEGORIES = List.of("account", "bug", "billing", "other");

    public static boolean isValidCategory(String category) {
        return category != null && SUPPORT_CATEGORIES.contains(category);
    }
}
