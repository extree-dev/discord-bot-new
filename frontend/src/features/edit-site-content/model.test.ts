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
        const clients = [{ name: 'A', period: '' }];
        expect(canAddClient(clients, 5)).toBe(true);
        expect(addClient(clients, 5)).toHaveLength(2);
    });

    it('не добавляет сверх maxClients', () => {
        const clients = [
            { name: 'A', period: '' },
            { name: 'B', period: '' },
        ];
        expect(canAddClient(clients, 2)).toBe(false);
        expect(addClient(clients, 2)).toBe(clients);
    });
});

describe('removeClient', () => {
    it('удаляет клиента по индексу, не трогая остальных', () => {
        const clients = [
            { name: 'A', period: '' },
            { name: 'B', period: '' },
            { name: 'C', period: '' },
        ];
        expect(removeClient(clients, 1)).toEqual([
            { name: 'A', period: '' },
            { name: 'C', period: '' },
        ]);
    });
});

describe('updateClient', () => {
    it('меняет поле только у клиента с нужным индексом', () => {
        const clients = [
            { name: 'A', period: '' },
            { name: 'B', period: '' },
        ];
        const result = updateClient(clients, 1, { period: '2023 – Present' });
        expect(result[0]).toEqual({ name: 'A', period: '' });
        expect(result[1]).toEqual({ name: 'B', period: '2023 – Present' });
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

    it('обрезает пробелы и отбрасывает клиентов без названия', () => {
        const content: SiteContent = {
            name: 'Имя',
            role: 'Роль',
            bio: 'Био',
            links: [],
            clients: [
                { name: '  Nebula  ', period: '  2023 – Present  ' },
                { name: '   ', period: '2022' },
            ],
        };
        expect(toPayload(content).clients).toEqual([{ name: 'Nebula', period: '2023 – Present' }]);
    });

    it('без поля clients в исходном content отдаёт пустой список', () => {
        const content: SiteContent = { name: 'Имя', role: 'Роль', bio: 'Био', links: [] };
        expect(toPayload(content).clients).toEqual([]);
    });
});
