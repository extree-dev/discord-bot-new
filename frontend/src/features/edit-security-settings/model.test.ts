import { describe, expect, it } from 'vitest';
import { formatList, parseList, toPayload } from './model';
import type { SecuritySettings } from '../../entities/security-settings/types';

describe('parseList / formatList', () => {
    it('разбивает textarea по строкам, обрезает пробелы и пустые строки', () => {
        expect(parseList('abc\n  def  \n\nghi\n')).toEqual(['abc', 'def', 'ghi']);
    });

    it('formatList — обратная операция', () => {
        expect(formatList(['abc', 'def'])).toBe('abc\ndef');
    });
});

describe('toPayload', () => {
    const base: SecuritySettings = {
        automod: {
            enabled: true,
            maxMentions: 5,
            maxMessagesPerWindow: 6,
            messageWindowMs: 5000,
            allowedInviteCodes: [],
        },
        raidShield: {
            enabled: true,
            joinThreshold: 8,
            windowMs: 10000,
            lockdownMs: 600000,
            kickNewAccounts: true,
            newAccountAgeMs: 604800000,
        },
        antiNuke: { enabled: true, maxActions: 3, windowMs: 10000 },
        bannedWords: [],
    };

    it('отрицательные/NaN числа заменяются на 0', () => {
        const result = toPayload({
            ...base,
            automod: { ...base.automod, maxMentions: -5 },
            antiNuke: { ...base.antiNuke, maxActions: Number.NaN },
        });
        expect(result.automod.maxMentions).toBe(0);
        expect(result.antiNuke.maxActions).toBe(0);
    });

    it('обрезает пробелы в списках и отбрасывает пустые строки', () => {
        const result = toPayload({
            ...base,
            automod: { ...base.automod, allowedInviteCodes: ['  abc123  ', '', '   '] },
            bannedWords: ['  слово  ', ''],
        });
        expect(result.automod.allowedInviteCodes).toEqual(['abc123']);
        expect(result.bannedWords).toEqual(['слово']);
    });

    it('валидные значения проходят без изменений', () => {
        expect(toPayload(base)).toEqual(base);
    });
});
