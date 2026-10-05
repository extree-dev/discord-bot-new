import { describe, expect, it } from 'vitest';
import { detectPlatform } from './platform';

describe('detectPlatform', () => {
    it('определяет платформу по домену ссылки', () => {
        expect(detectPlatform({ label: 'Мой канал', url: 'https://t.me/extree' })).toBe('telegram');
        expect(detectPlatform({ label: 'Профиль', url: 'https://www.instagram.com/extree' })).toBe('instagram');
        expect(detectPlatform({ label: 'Твиттер', url: 'https://x.com/extree' })).toBe('twitter');
        expect(detectPlatform({ label: 'Видео', url: 'https://youtu.be/abc123' })).toBe('youtube');
        expect(detectPlatform({ label: 'Код', url: 'https://github.com/extree' })).toBe('github');
        expect(detectPlatform({ label: 'Сервер', url: 'https://discord.gg/abc123' })).toBe('discord');
    });

    it('субдомены домена из списка тоже распознаются', () => {
        expect(detectPlatform({ label: 'x', url: 'https://m.youtube.com/watch?v=1' })).toBe('youtube');
    });

    it('без распознанного домена, но с ключевым словом в label — платформа по label', () => {
        expect(detectPlatform({ label: 'Discord: .extree', url: '' })).toBe('discord');
        expect(detectPlatform({ label: 'Мой Telegram-канал', url: '' })).toBe('telegram');
    });

    it('неизвестный домен и label без ключевых слов — generic', () => {
        expect(detectPlatform({ label: 'Мой сайт', url: 'https://bot.extree.tech' })).toBe('generic');
    });

    it('битый URL не роняет функцию — считается как label-based/generic', () => {
        expect(detectPlatform({ label: 'Ссылка', url: 'not a url' })).toBe('generic');
    });
});
