import { useEffect } from 'react';

/**
 * Хук для глобального шортката. Пример: useKeyboardShortcut('k', true, () => open()).
 * modifier: 'ctrl' (Win/Linux) или 'meta' (Mac) — оба работают, если true.
 */
export function useKeyboardShortcut(key: string, withModifier: boolean, handler: () => void) {
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const target = e.target as HTMLElement | null;
            const isInput =
                target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
            if (isInput) return;
            const mod = e.ctrlKey || e.metaKey;
            if (withModifier !== mod) return;
            if (e.key.toLowerCase() !== key.toLowerCase()) return;
            e.preventDefault();
            handler();
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [key, withModifier, handler]);
}
