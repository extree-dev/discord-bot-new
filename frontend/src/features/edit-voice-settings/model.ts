import { CHANNEL_TYPE } from '../../entities/guild-resources/types';
import type { GuildChannel } from '../../entities/guild-resources/types';
import type { VoiceSettings } from '../../entities/voice-settings/types';

const EMPTY_OPTION = { value: '', label: '— не выбран —' };

// value="" представляет null (SelectField — нативный <select>, у него
// нет своего понятия null, пустая строка — стандартная замена).
export function toChannelOptions(channels: GuildChannel[], type: number): { value: string; label: string }[] {
    return [EMPTY_OPTION, ...channels.filter(c => c.type === type).map(c => ({ value: c.id, label: c.name }))];
}

export { CHANNEL_TYPE };

function toChannelIdOrNull(value: string): string | null {
    return value.trim() || null;
}

function clampLimit(value: number): number {
    return Number.isFinite(value) ? Math.min(99, Math.max(0, Math.round(value))) : 0;
}

// Та же нормализация, что и на бэкенде (dashboard/server.js) — мгновенная
// обратная связь в форме, сервер всё равно перепроверит сам.
export function toPayload(settings: VoiceSettings): VoiceSettings {
    return {
        triggerChannelId: toChannelIdOrNull(settings.triggerChannelId ?? ''),
        categoryId: toChannelIdOrNull(settings.categoryId ?? ''),
        roomsCategoryId: toChannelIdOrNull(settings.roomsCategoryId ?? ''),
        controlChannelId: toChannelIdOrNull(settings.controlChannelId ?? ''),
        defaultLimit: clampLimit(settings.defaultLimit),
    };
}
