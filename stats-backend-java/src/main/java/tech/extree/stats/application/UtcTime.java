package tech.extree.stats.application;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Тот же формат, что Date.prototype.toUTCString() в Node — используется в текстах писем-уведомлений. */
public final class UtcTime {

    private static final DateTimeFormatter FORMATTER =
            DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss 'GMT'", Locale.US).withZone(ZoneOffset.UTC);

    private UtcTime() {}

    public static String format(Instant instant) {
        return FORMATTER.format(instant);
    }

    public static String now() {
        return format(Instant.now());
    }
}
