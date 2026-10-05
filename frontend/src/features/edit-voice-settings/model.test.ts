import { describe, expect, it } from 'vitest';
import { CHANNEL_TYPE, toChannelOptions, toPayload } from './model';
import type { GuildChannel } from '../../entities/guild-resources/types';
import type { VoiceSettings } from '../../entities/voice-settings/types';

const CHANNELS: GuildChannel[] = [
    { id: '1', name: 'Общий', type: CHANNEL_TYPE.text, parentId: null, position: 0 },
    { id: '2', name: 'Войс 1', type: CHANNEL_TYPE.voice, parentId: null, position: 1 },
    { id: '3', name: 'Категория', type: CHANNEL_TYPE.category, parentId: null, position: 2 },
    { id: '4', name: 'Войс 2', type: CHANNEL_TYPE.voice, parentId: null, position: 3 },
];

describe('toChannelOptions', () => {
    it('фильтрует по типу и добавляет пустую опцию первой', () => {
        const options = toChannelOptions(CHANNELS, CHANNEL_TYPE.voice);
        expect(options).toEqual([
            { value: '', label: '— не выбран —' },
            { value: '2', label: 'Войс 1' },
            { value: '4', label: 'Войс 2' },
        ]);
    });
});

describe('toPayload', () => {
    it('превращает пустые строки в null и зажимает лимит в 0..99', () => {
        const settings: VoiceSettings = {
            triggerChannelId: '',
            categoryId: '123',
            roomsCategoryId: null,
            controlChannelId: '  456  ',
            defaultLimit: 250,
        };
        expect(toPayload(settings)).toEqual({
            triggerChannelId: null,
            categoryId: '123',
            roomsCategoryId: null,
            controlChannelId: '456',
            defaultLimit: 99,
        });
    });

    it('не уходит в отрицательные значения лимита', () => {
        const settings: VoiceSettings = {
            triggerChannelId: null,
            categoryId: null,
            roomsCategoryId: null,
            controlChannelId: null,
            defaultLimit: -5,
        };
        expect(toPayload(settings).defaultLimit).toBe(0);
    });
});
