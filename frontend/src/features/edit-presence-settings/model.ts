import type { ActivityItem, ActivityTypeKey, PresenceSettings } from '../../entities/presence-settings/types';

export const STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: 'online', label: 'Онлайн' },
    { value: 'idle', label: 'Не активен' },
    { value: 'dnd', label: 'Не беспокоить' },
    { value: 'invisible', label: 'Невидимый' },
];

// Те же пункты и подписи, что в commands/moderation/status.js — одна
// функция у двух интерфейсов (слэш-команда и дашборд), ярлыки должны
// совпадать дословно.
export const ACTIVITY_TYPE_OPTIONS: { value: ActivityTypeKey; label: string }[] = [
    { value: 'playing', label: 'Играет в' },
    { value: 'streaming', label: 'Стримит' },
    { value: 'watching', label: 'Смотрит' },
    { value: 'listening', label: 'Слушает' },
    { value: 'competing', label: 'Участвует в' },
];

export const EMPTY_ACTIVITY: ActivityItem = { type: 'playing', text: '', url: null };

export function addRotateItem(items: ActivityItem[]): ActivityItem[] {
    return [...items, { ...EMPTY_ACTIVITY }];
}

export function removeRotateItem(items: ActivityItem[], index: number): ActivityItem[] {
    return items.filter((_, i) => i !== index);
}

export function updateRotateItem(items: ActivityItem[], index: number, patch: Partial<ActivityItem>): ActivityItem[] {
    return items.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

export function msToMinutes(ms: number): number {
    return Math.round(ms / 60000);
}

export function minutesToMs(minutes: number): number {
    const n = Number(minutes);
    return Number.isFinite(n) && n > 0 ? Math.round(n) * 60000 : 60000;
}

function sanitizeActivity(item: ActivityItem): ActivityItem {
    return {
        type: item.type,
        text: (item.text ?? '').trim() || null,
        url: item.type === 'streaming' ? (item.url ?? '').trim() || null : null,
    };
}

// Та же нормализация, что и на бэкенде (dashboard/server.js) — мгновенная
// обратная связь в форме, сервер всё равно перепроверит сам.
export function toPayload(settings: PresenceSettings): PresenceSettings {
    return {
        status: settings.status,
        rotate: settings.rotate,
        rotateIntervalMs: settings.rotateIntervalMs,
        activity: sanitizeActivity(settings.activity),
        rotateItems: settings.rotateItems.map(sanitizeActivity).filter(item => item.text),
    };
}
