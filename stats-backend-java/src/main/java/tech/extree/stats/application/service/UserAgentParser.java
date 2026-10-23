package tech.extree.stats.application.service;

/**
 * Простой парсер User-Agent: "Chrome on Windows", "Safari on macOS", и т.д.
 * Без сторонних библиотек — покрывает 95% реальных браузеров. Не идеален
 * (не различает Chrome на Android vs Chrome на iOS), но для "Unknown Device"
 * во вкладке Active Sessions этого достаточно.
 */
public final class UserAgentParser {

    private UserAgentParser() {}

    public static String describe(String ua) {
        if (ua == null || ua.isBlank()) return "Unknown device";
        String u = ua.toLowerCase();

        String browser;
        if (u.contains("edg/")) browser = "Edge";
        else if (u.contains("opr/") || u.contains("opera")) browser = "Opera";
        else if (u.contains("chrome/") && !u.contains("chromium")) browser = "Chrome";
        else if (u.contains("firefox/")) browser = "Firefox";
        else if (u.contains("safari/") && !u.contains("chrome")) browser = "Safari";
        else if (u.contains("curl/")) browser = "curl";
        else if (u.contains("postman")) browser = "Postman";
        else browser = null;

        String os;
        if (u.contains("windows nt")) os = "Windows";
        else if (u.contains("mac os x") || u.contains("macintosh")) os = "macOS";
        else if (u.contains("android")) os = "Android";
        else if (u.contains("iphone") || u.contains("ipad") || u.contains("ios")) os = "iOS";
        else if (u.contains("linux")) os = "Linux";
        else os = null;

        if (browser != null && os != null) return browser + " on " + os;
        if (browser != null) return browser;
        if (os != null) return os;
        return "Unknown device";
    }
}
