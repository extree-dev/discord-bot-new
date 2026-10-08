import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'extree-theme';

function readTheme(): Theme {
    try {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'light' || saved === 'dark') return saved;
    } catch {
        // приватный режим и т.п. — просто падаем на системную тему ниже.
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Светлая/тёмная тема кабинета — без React Context: AdminShell и
// AuthSplitScreen никогда не смонтированы одновременно (разные роуты),
// поэтому каждому достаточно своего независимого инстанса этого хука,
// читающего/пишущего один и тот же ключ localStorage — при следующем
// заходе (или просто при смене страницы) оба подхватят выбор друг друга.
export function useTheme() {
    const [theme, setTheme] = useState<Theme>(readTheme);

    useEffect(() => {
        try {
            localStorage.setItem(THEME_KEY, theme);
        } catch {
            // не критично — тема просто не переживёт перезагрузку страницы.
        }
    }, [theme]);

    function toggleTheme() {
        setTheme(t => (t === 'light' ? 'dark' : 'light'));
    }

    return { theme, toggleTheme };
}
