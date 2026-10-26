package tech.extree.stats.application;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Зеркало ../../stats-backend/validation.js, правило в правило —
 * расхождение здесь означает, что Java-сервис принимает/отклоняет
 * другие пароли или email, чем Node, и для одного и того же аккаунта
 * поведение двух сервисов разойдётся.
 *
 * parseRiotId добавлен для Riot Lookup (см. RiotLookupService) —
 * один в один с одноимённой функцией validation.js: gameName допускает
 * практически любые символы (ники бывают на любом языке), поэтому тут
 * только санитарная проверка длины, а не строгий regex; tagLine у Riot
 * всегда 3-5 букв/цифр.
 */
public final class Validation {

    private static final Pattern EMAIL_RE = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern NICKNAME_RE = Pattern.compile("^[a-zA-Z0-9_]{3,24}$");
    private static final Pattern HAS_LETTER = Pattern.compile("[a-zA-Z]");
    private static final Pattern HAS_DIGIT = Pattern.compile("[0-9]");

    // Riot ID: "ИмяИгрока#Тег". gameName 1-16 символов (любые, включая
    // юникод); tagLine 3-5 букв/цифр. Окончательно валидирует сам Riot
    // API (404, если такого аккаунта нет).
    private static final Pattern RIOT_TAG_RE = Pattern.compile("^[A-Za-z0-9]{3,5}$");

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

    /** Разобранный Riot ID — null, если строка не соответствует формату. */
    public record RiotId(String gameName, String tagLine) {}

    /** 1:1 с parseRiotId в validation.js. null — невалидный ввод. */
    public static RiotId parseRiotId(String rawRiotId) {
        if (rawRiotId == null) {
            return null;
        }
        String trimmed = rawRiotId.trim();
        int hashIndex = trimmed.lastIndexOf('#');
        if (hashIndex <= 0 || hashIndex == trimmed.length() - 1) {
            return null;
        }
        String gameName = trimmed.substring(0, hashIndex);
        String tagLine = trimmed.substring(hashIndex + 1);
        if (gameName.length() < 1 || gameName.length() > 16) {
            return null;
        }
        if (!RIOT_TAG_RE.matcher(tagLine).matches()) {
            return null;
        }
        return new RiotId(gameName, tagLine);
    }
}