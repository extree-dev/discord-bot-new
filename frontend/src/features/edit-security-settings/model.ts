import type { SecuritySettings } from '../../entities/security-settings/types';

// Списки (разрешённые коды приглашений, бан-слова) редактируются одним
// textarea — по строке на значение, а не через add/remove-кнопки, как у
// ссылок визитки: здесь элементов может быть много и они однотипны
// (просто слова/коды), отдельная кнопка на каждый был бы шумом.
export function parseList(text: string): string[] {
    return text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
}

export function formatList(list: string[]): string {
    return list.join('\n');
}

function toNonNegativeInt(value: number): number {
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

// Та же нормализация, что и на бэкенде (dashboard/server.js) — мгновенная
// обратная связь в форме, сервер всё равно перепроверит сам.
export function toPayload(settings: SecuritySettings): SecuritySettings {
    return {
        automod: {
            enabled: settings.automod.enabled,
            maxMentions: toNonNegativeInt(settings.automod.maxMentions),
            maxMessagesPerWindow: toNonNegativeInt(settings.automod.maxMessagesPerWindow),
            messageWindowMs: toNonNegativeInt(settings.automod.messageWindowMs),
            allowedInviteCodes: settings.automod.allowedInviteCodes.map(c => c.trim()).filter(Boolean),
        },
        raidShield: {
            enabled: settings.raidShield.enabled,
            joinThreshold: toNonNegativeInt(settings.raidShield.joinThreshold),
            windowMs: toNonNegativeInt(settings.raidShield.windowMs),
            lockdownMs: toNonNegativeInt(settings.raidShield.lockdownMs),
            kickNewAccounts: settings.raidShield.kickNewAccounts,
            newAccountAgeMs: toNonNegativeInt(settings.raidShield.newAccountAgeMs),
        },
        antiNuke: {
            enabled: settings.antiNuke.enabled,
            maxActions: toNonNegativeInt(settings.antiNuke.maxActions),
            windowMs: toNonNegativeInt(settings.antiNuke.windowMs),
        },
        bannedWords: settings.bannedWords.map(w => w.trim()).filter(Boolean),
    };
}
