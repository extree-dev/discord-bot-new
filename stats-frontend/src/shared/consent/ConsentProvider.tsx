import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ConsentContext, type ConsentContextValue } from './ConsentContext';
import { loadConsent, saveConsent, type ConsentCategories } from './storage';
import { applyConsent } from './thirdParty';

interface ConsentProviderProps {
    children: ReactNode;
}

export function ConsentProvider({ children }: ConsentProviderProps) {
    // Lazy-инициализатор useState выполняется синхронно на первом рендере,
    // до того как дерево вообще смонтировано — если согласие уже сохранено
    // с прошлого визита, Sentry/Google Fonts включаются здесь же, а не
    // отдельным эффектом после первой отрисовки.
    const [consent, setConsent] = useState<ConsentCategories | null>(() => {
        const stored = loadConsent();
        if (stored) applyConsent(stored);
        return stored;
    });
    const [bannerOpen, setBannerOpen] = useState(consent === null);

    const decide = useCallback((categories: ConsentCategories) => {
        saveConsent(categories);
        applyConsent(categories);
        setConsent(categories);
        setBannerOpen(false);
    }, []);

    const acceptAll = useCallback(() => decide({ analytics: true, preferences: true }), [decide]);
    const rejectNonEssential = useCallback(() => decide({ analytics: false, preferences: false }), [decide]);
    const reopen = useCallback(() => setBannerOpen(true), []);

    const value = useMemo<ConsentContextValue>(
        () => ({ consent, bannerOpen, acceptAll, rejectNonEssential, savePreferences: decide, reopen }),
        [consent, bannerOpen, acceptAll, rejectNonEssential, decide, reopen]
    );

    return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}
