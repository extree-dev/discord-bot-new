import { describe, expect, it } from 'vitest';
import {
    addClient,
    addLink,
    canAddClient,
    canAddLink,
    removeClient,
    removeLink,
    toPayload,
    updateClient,
    updateLink,
} from './model';
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

describe('canAddClient / addClient', () => {
    it('позволяет добавить клиента, пока не достигнут maxClients', () => {
        const clients = [{ name: 'A', logoUrl: '', period: '' }];
        expect(canAddClient(clients, 5)).toBe(true);
        expect(addClient(clients, 5)).toHaveLength(2);
    });

    it('не добавляет сверх maxClients', () => {
        const clients = [
            { name: 'A', logoUrl: '', period: '' },
            { name: 'B', logoUrl: '', period: '' },
        ];
        expect(canAddClient(clients, 2)).toBe(false);
        expect(addClient(clients, 2)).toBe(clients);
    });
});

describe('removeClient', () => {
    it('удаляет клиента по индексу, не трогая остальных', () => {
        const clients = [
            { name: 'A', logoUrl: '', period: '' },
            { name: 'B', logoUrl: '', period: '' },
            { name: 'C', logoUrl: '', period: '' },
        ];
        expect(removeClient(clients, 1)).toEqual([
            { name: 'A', logoUrl: '', period: '' },
            { name: 'C', logoUrl: '', period: '' },
        ]);
    });
});

describe('updateClient', () => {
    it('меняет поле только у клиента с нужным индексом', () => {
        const clients = [
            { name: 'A', logoUrl: '', period: '' },
            { name: 'B', logoUrl: '', period: '' },
        ];
        const result = updateClient(clients, 1, { logoUrl: 'https://example.com/b.png' });
        expect(result[0]).toEqual({ name: 'A', logoUrl: '', period: '' });
        expect(result[1]).toEqual({ name: 'B', logoUrl: 'https://example.com/b.png', period: '' });
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
            clients: [],
        };
        expect(toPayload(content)).toEqual({
            name: 'Имя',
            role: 'Роль',
            bio: 'Био',
            links: [{ label: 'Сайт', url: 'https://example.com' }],
            clients: [],
        });
    });

    it('обрезает пробелы и отбрасывает клиентов без названия или без логотипа', () => {
        const content: SiteContent = {
            name: 'Имя',
            role: 'Роль',
            bio: 'Био',
            links: [],
            clients: [
                { name: '  Nebula  ', logoUrl: '  https://example.com/nebula.png  ', period: '  2024 – Present  ' },
                { name: '   ', logoUrl: 'https://example.com/ignored.png', period: '' },
                { name: 'Без логотипа', logoUrl: '', period: '' },
            ],
        };
        expect(toPayload(content).clients).toEqual([
            { name: 'Nebula', logoUrl: 'https://example.com/nebula.png', period: '2024 – Present' },
        ]);
    });

    it('без поля clients в исходном content отдаёт пустой список', () => {
        const content: SiteContent = { name: 'Имя', role: 'Роль', bio: 'Био', links: [] };
        expect(toPayload(content).clients).toEqual([]);
    });
});
