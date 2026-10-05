import { describe, expect, it } from 'vitest';
import { addLink, canAddLink, removeLink, toPayload, updateLink } from './model';
import type { SiteContent } from '../../entities/site-content/types';

describe('canAddLink / addLink', () => {
    it('позволяет добавить ссылку, пока не достигнут maxLinks', () => {
        const links = [{ label: 'A', url: '' }];
        expect(canAddLink(links, 5)).toBe(true);
        expect(addLink(links, 5)).toHaveLength(2);
    });

    it('не добавляет сверх maxLinks', () => {
        const links = [
            { label: 'A', url: '' },
            { label: 'B', url: '' },
        ];
        expect(canAddLink(links, 2)).toBe(false);
        expect(addLink(links, 2)).toBe(links);
    });
});

describe('removeLink', () => {
    it('удаляет ссылку по индексу, не трогая остальные', () => {
        const links = [
            { label: 'A', url: '' },
            { label: 'B', url: '' },
            { label: 'C', url: '' },
        ];
        expect(removeLink(links, 1)).toEqual([
            { label: 'A', url: '' },
            { label: 'C', url: '' },
        ]);
    });
});

describe('updateLink', () => {
    it('меняет поле только у ссылки с нужным индексом', () => {
        const links = [
            { label: 'A', url: '' },
            { label: 'B', url: '' },
        ];
        const result = updateLink(links, 1, { url: 'https://example.com' });
        expect(result[0]).toEqual({ label: 'A', url: '' });
        expect(result[1]).toEqual({ label: 'B', url: 'https://example.com' });
    });
});

describe('toPayload', () => {
    it('обрезает пробелы и отбрасывает ссылки без label', () => {
        const content: SiteContent = {
            name: '  Имя  ',
            role: '  Роль  ',
            bio: '  Био  ',
            links: [
                { label: '  Сайт  ', url: '  https://example.com  ' },
                { label: '   ', url: 'https://ignored.example' },
            ],
        };
        expect(toPayload(content)).toEqual({
            name: 'Имя',
            role: 'Роль',
            bio: 'Био',
            links: [{ label: 'Сайт', url: 'https://example.com' }],
        });
    });
});
