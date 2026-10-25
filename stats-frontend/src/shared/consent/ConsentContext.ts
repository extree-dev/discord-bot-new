import { createContext } from 'react';
import type { ConsentCategories } from './storage';

export interface ConsentContextValue {
    /** null — решение ещё не принято, баннер должен быть виден. */
    consent: ConsentCategories | null;
    bannerOpen: boolean;
    acceptAll: () => void;
    rejectNonEssential: () => void;
    savePreferences: (categories: ConsentCategories) => void;
    /** Открыть баннер заново (кнопка "Manage preferences" на /cookies). */
    reopen: () => void;
}

// Контекст отдельным файлом — тот же приём, что у shared/auth
// (AuthContext/AuthProvider/useConsent разнесены, чтобы react-refresh не
// ругался на файл с и компонентом, и неким экспортом).
export const ConsentContext = createContext<ConsentContextValue | null>(null);
