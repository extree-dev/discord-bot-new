package tech.extree.stats.application.service;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * Политика паролей: минимум 12 символов, не из топ-1000 слабых, не в HIBP
 * (k-anonymity), не равен email/name/nickname.
 */
@Service
public class PasswordPolicyService {

    private static final int MIN_LENGTH = 12;
    private static final int MAX_LENGTH = 200;

    private final Set<String> weakPasswords = loadWeakPasswords();
    private final RestClient restClient = RestClient.create();

    /** result: valid=true — пароль ок, иначе reason. НЕ accessor isOk(), чтобы не конфликтовать с record. */
    public record Result(boolean valid, String reason) {
        public static Result ok() { return new Result(true, null); }
        public static Result fail(String r) { return new Result(false, r); }
    }

    public Result validate(String password, String email, String name, String nickname) {
        if (password == null) return Result.fail("weak_password");
        String p = password.trim();
        if (p.length() < MIN_LENGTH || p.length() > MAX_LENGTH) return Result.fail("weak_password");
        if (weakPasswords.contains(p.toLowerCase(Locale.ROOT))) return Result.fail("weak_password");

        String em = email == null ? "" : email.toLowerCase(Locale.ROOT);
        String nm = name == null ? "" : name.trim().toLowerCase(Locale.ROOT);
        String nn = nickname == null ? "" : nickname.trim().toLowerCase(Locale.ROOT);
        String pl = p.toLowerCase(Locale.ROOT);
        if (!em.isEmpty() && (pl.contains(em) || em.contains(pl))) return Result.fail("weak_password");
        if (!nm.isEmpty() && (pl.equals(nm) || pl.contains(nm))) return Result.fail("weak_password");
        if (!nn.isEmpty() && (pl.equals(nn) || pl.contains(nn))) return Result.fail("weak_password");

        if (isBreached(p)) return Result.fail("password_breached");

        return Result.ok();
    }

    private boolean isBreached(String password) {
        try {
            String sha1 = sha1Hex(password).toUpperCase(Locale.ROOT);
            String prefix = sha1.substring(0, 5);
            String suffix = sha1.substring(5);
            String body = restClient.get()
                    .uri("https://api.pwnedpasswords.com/range/{prefix}", prefix)
                    .header("Add-Padding", "true")
                    .retrieve()
                    .body(String.class);
            if (body == null) return false;
            for (String line : body.split("\\r?\\n")) {
                int colon = line.indexOf(':');
                if (colon <= 0) continue;
                if (line.substring(0, colon).equalsIgnoreCase(suffix)) return true;
            }
            return false;
        } catch (Exception e) {
            return false;  // fail-open — HIBP недоступен
        }
    }

    private static String sha1Hex(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] digest = md.digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("SHA-1 недоступен", e);
        }
    }

    private static Set<String> loadWeakPasswords() {
        Set<String> out = new HashSet<>();
        try (InputStream in = PasswordPolicyService.class.getResourceAsStream("/weak_passwords.txt")) {
            if (in == null) {
                String[] fallback = {
                        "123456", "password", "12345678", "qwerty", "123456789", "12345",
                        "1234", "111111", "1234567", "dragon", "123123", "baseball",
                        "abc123", "football", "monkey", "letmein", "696969", "shadow",
                        "master", "666666", "qwertyuiop", "123321", "mustang", "1234567890",
                        "michael", "654321", "pussy", "superman", "1qaz2wsx", "7777777",
                        "fuckyou", "121212", "000000", "qazwsx", "123qwe", "killer",
                        "trustno1", "jordan", "jennifer", "zxcvbnm", "asdfgh", "hunter",
                        "buster", "soccer", "harley", "batman", "andrew", "tigger",
                        "sunshine", "iloveyou", "fuckme", "2000", "charlie", "robert",
                        "thomas", "hockey", "ranger", "daniel", "starwars", "klaster",
                        "112233", "george", "asshole", "computer", "michelle", "jessica",
                        "pepper", "1111", "zxcvbn", "555555", "11111111", "131313",
                        "freedom", "777777", "pass", "fuck", "maggie", "159753",
                        "aaaaaa", "ginger", "princess", "joshua", "cheese", "amanda",
                        "summer", "love", "ashley", "6969", "nicole", "chelsea",
                        "biteme", "matthew", "access", "yankees", "987654321", "dallas",
                        "austin", "thunder", "taylor", "matrix",
                };
                for (String s : fallback) out.add(s);
                return out;
            }
            try (BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                String line;
                while ((line = r.readLine()) != null) {
                    String t = line.trim().toLowerCase(Locale.ROOT);
                    if (!t.isEmpty() && !t.startsWith("#")) out.add(t);
                }
            }
        } catch (Exception e) {
            // ignore
        }
        return out;
    }
}