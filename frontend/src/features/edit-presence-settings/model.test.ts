import { describe, expect, it } from 'vitest';
import { addRotateItem, minutesToMs, msToMinutes, removeRotateItem, toPayload, updateRotateItem } from './model';
import type { ActivityItem, PresenceSettings } from '../../entities/presence-settings/types';

describe('addRotateItem / removeRotateItem / updateRotateItem', () => {
    it('добавляет пустой пункт ротации', () => {
        const items: ActivityItem[] = [];
        const result = addRotateItem(items);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ type: 'playing', text: '', url: null });
    });

    it('удаляет пункт по индексу', () => {
        const items: ActivityItem[] = [
            { type: 'playing', text: 'A', url: null },
            { type: 'watching', text: 'B', url: null },
        ];
        expect(removeRotateItem(items, 0)).toEqual([{ type: 'watching', text: 'B', url: null }]);
    });

    it('меняет поле только у нужного пункта', () => {
        const items: ActivityItem[] = [
            { type: 'playing', text: 'A', url: null },
            { type: 'playing', text: 'B', url: null },
        ];
        const result = updateRotateItem(items, 1, { text: 'B2' });
        expect(result[0].text).toBe('A');
        expect(result[1].text).toBe('B2');
    });
});

describe('msToMinutes / minutesToMs', () => {
    it('конвертирует туда и обратно', () => {
        expect(msToMinutes(600000)).toBe(10);
        expect(minutesToMs(10)).toBe(600000);
    });

    it('minutesToMs подставляет минимум минуту на некорректный ввод', () => {
        expect(minutesToMs(0)).toBe(60000);
        expect(minutesToMs(NaN)).toBe(60000);
    });
});

describe('toPayload', () => {
    it('обрезает пробелы, чистит url для не-streaming и отбрасывает пустые пункты ротации', () => {
        const settings: PresenceSettings = {
            status: 'online',
            rotate: true,
            rotateIntervalMs: 300000,
            activity: { type: 'playing', text: '  Играет  ', url: '  https://ignored.example  ' },
            rotateItems: [
                { type: 'streaming', text: '  Стрим  ', url: '  https://twitch.tv/x  ' },
                { type: 'playing', text: '   ', url: null },
            ],
        };
        expect(toPayload(settings)).toEqual({
            status: 'online',
            rotate: true,
            rotateIntervalMs: 300000,
            activity: { type: 'playing', text: 'Играет', url: null },
            rotateItems: [{ type: 'streaming', text: 'Стрим', url: 'https://twitch.tv/x' }],
        });
    });
});
