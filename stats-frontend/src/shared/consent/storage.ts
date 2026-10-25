// Чистое хранилище (без React) — отдельно от ConsentProvider.tsx,
// чтобы его можно было звать из thirdParty.ts/ConsentProvider.tsx без
// циклических импортов, тот же приём, что у shared/auth (AuthContext/
// AuthProvider/useAuth разнесены по файлам).
export interface ConsentCategories {
    analytics: boolean;
    preferences: boolean;
}

interface StoredConsent extends ConsentCategories {
    version: number;
    decidedAt: string;
}

const STORAGE_KEY = 'extree_stats_consent';
// Бампнуть при изменении набора категорий (например, добавили новую
// non-essential интеграцию) — несовпадение версии = баннер считает,
// что согласия ещё не было, и показывается заново.
const CONSENT_VERSION = 1;

export function loadConsent(): ConsentCategories | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as StoredConsent;
        if (parsed.version !== CONSENT_VERSION) return null;
        return { analytics: parsed.analytics === true, preferences: parsed.preferences === true };
    } catch {
        // localStorage недоступен (приватный режим, заблокированные cookies
        // и т.п.) или битый JSON — ведём себя так, будто решения ещё не было.
        return null;
    }
}

export function saveConsent(categories: ConsentCategories): void {
    const stored: StoredConsent = { ...categories, version: CONSENT_VERSION, decidedAt: new Date().toISOString() };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
        // Сохранить не получилось — баннер просто покажется заново при
        // следующем визите, функциональность сайта это не ломает.
    }
}
