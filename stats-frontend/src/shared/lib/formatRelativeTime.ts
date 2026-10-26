// SRP: только форматирование даты. Используется везде, где бэкенд отдаёт
// ISO-строку или "Wed, 21 Oct 2026 13:57:38 GMT" (UtcTime.format в Java).
// Возвращает human-friendly "2h ago" / "Yesterday" / "Oct 21".
// Один формат на весь продукт — никаких "GMT" в UI.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(input: string | Date | null | undefined): string {
    if (!input) return '';
    const date = input instanceof Date ? input : parseDate(input);
    if (!date || isNaN(date.getTime())) return '';

    const now = Date.now();
    const diff = now - date.getTime();

    if (diff < MINUTE) return 'just now';
    if (diff < HOUR) {
        const m = Math.floor(diff / MINUTE);
        return `${m}m ago`;
    }
    if (diff < DAY) {
        const h = Math.floor(diff / HOUR);
        return `${h}h ago`;
    }
    if (diff < 2 * DAY) return 'Yesterday';
    if (diff < 7 * DAY) {
        const d = Math.floor(diff / DAY);
        return `${d}d ago`;
    }

    // Для старых — компактная дата: "Oct 21" или "Oct 21, 2025" если не этот год
    const nowDate = new Date(now);
    const sameYear = date.getFullYear() === nowDate.getFullYear();
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: sameYear ? undefined : 'numeric',
    });
}

function parseDate(input: string): Date | null {
    // "Wed, 21 Oct 2026 13:57:38 GMT" — формат UtcTime.format (Java).
    // JS Date.parse не всегда ест, поэтому пробуем сами.
    const direct = new Date(input);
    if (!isNaN(direct.getTime())) return direct;

    // Дополнительный парсинг RFC 1123 с "GMT" суффиксом
    const match = input.match(/^\w{3},\s+(\d{1,2})\s+(\w{3})\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+GMT$/);
    if (match) {
        const [, day, mon, year, hh, mm, ss] = match;
        const months: Record<string, number> = {
            Jan: 0,
            Feb: 1,
            Mar: 2,
            Apr: 3,
            May: 4,
            Jun: 5,
            Jul: 6,
            Aug: 7,
            Sep: 8,
            Oct: 9,
            Nov: 10,
            Dec: 11,
        };
        return new Date(Date.UTC(Number(year), months[mon] ?? 0, Number(day), Number(hh), Number(mm), Number(ss)));
    }
    return null;
}
