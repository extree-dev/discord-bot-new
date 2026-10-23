import { useEffect, useState } from 'react';

// SRP: только отслеживание media-query. Используется везде, где нужно
// знать "мобильный/десктоп" без CSS (например, чтобы не рендерить
// скрытую колонку вообще — так меньше DOM и не грузятся лишние запросы).
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mql = window.matchMedia(query);
        const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
        mql.addEventListener('change', handler);
        setMatches(mql.matches);
        return () => mql.removeEventListener('change', handler);
    }, [query]);

    return matches;
}

// Единственный источник правды "когда переключаемся на мобильный layout".
// Синхронизирован с $breakpoint-tablet (860px) из _variables.scss.
export const MOBILE_BREAKPOINT = '(max-width: 859.98px)';

export function useIsMobile(): boolean {
    return useMediaQuery(MOBILE_BREAKPOINT);
}
