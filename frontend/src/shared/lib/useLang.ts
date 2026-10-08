import { useEffect, useState } from 'react';
import { en, ru, type TranslationKey } from './i18n/translations';

export type Lang = 'ru' | 'en';

const LANG_KEY = 'extree-lang';

const DICTS: Record<Lang, Record<TranslationKey, string>> = { ru, en };

function readLang(): Lang {
    try {
        const saved = localStorage.getItem(LANG_KEY);
        if (saved === 'ru' || saved === 'en') return saved;
    } catch {
        // приватный режим и т.п. — падаем на русский по умолчанию ниже.
    }
    return 'ru';
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

// Язык кабинета — тот же приём, что useTheme: без React Context (AdminShell
// и AuthSplitScreen не смонтированы одновременно), просто общий ключ
// localStorage, который независимо читает/пишет каждый инстанс хука.
export function useLang() {
    const [lang, setLang] = useState<Lang>(readLang);

    useEffect(() => {
        try {
            localStorage.setItem(LANG_KEY, lang);
        } catch {
            // не критично — язык просто не переживёт перезагрузку страницы.
        }
    }, [lang]);

    function toggleLang() {
        setLang(l => (l === 'ru' ? 'en' : 'ru'));
    }

    function t(key: TranslationKey, vars?: Record<string, string | number>): string {
        return interpolate(DICTS[lang][key], vars);
    }

    return { lang, toggleLang, t };
}
