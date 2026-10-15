import { describe, expect, it } from 'vitest';
import {
    addClient,
    addLink,
    addShowcase,
    canAddClient,
    canAddLink,
    canAddShowcase,
    removeClient,
    removeLink,
    removeShowcase,
    toPayload,
    updateClient,
    updateLink,
    updateShowcase,
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
            showcases: [],
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

    it('обрезает пробелы, пустые теги и отбрасывает проекты без title', () => {
        const content: SiteContent = {
            name: 'Имя',
            role: 'Роль',
            bio: 'Био',
            links: [],
            showcases: [
                {
                    title: '  The Kitchen  ',
                    tags: ['  Bot  ', '  ', 'Discord'],
                    description: '  Описание  ',
                    imageUrl: '  https://example.com/kitchen.png  ',
                    url: '  https://example.com  ',
                    nda: true,
                    upcoming: false,
                },
                { title: '   ', tags: [], description: '', imageUrl: '', url: '', nda: false, upcoming: false },
            ],
        };
        expect(toPayload(content).showcases).toEqual([
            {
                title: 'The Kitchen',
                tags: ['Bot', 'Discord'],
                description: 'Описание',
                imageUrl: 'https://example.com/kitchen.png',
                url: 'https://example.com',
                nda: true,
                upcoming: false,
            },
        ]);
    });

    it('без поля showcases в исходном content отдаёт пустой список', () => {
        const content: SiteContent = { name: 'Имя', role: 'Роль', bio: 'Био', links: [] };
        expect(toPayload(content).showcases).toEqual([]);
    });
});

describe('canAddShowcase / addShowcase', () => {
    it('позволяет добавить проект, пока не достигнут maxShowcases', () => {
        const showcases = [
            { title: 'A', tags: [], description: '', imageUrl: '', url: '', nda: false, upcoming: false },
        ];
        expect(canAddShowcase(showcases, 5)).toBe(true);
        expect(addShowcase(showcases, 5)).toHaveLength(2);
    });

    it('не добавляет сверх maxShowcases', () => {
        const showcases = [
            { title: 'A', tags: [], description: '', imageUrl: '', url: '', nda: false, upcoming: false },
            { title: 'B', tags: [], description: '', imageUrl: '', url: '', nda: false, upcoming: false },
        ];
        expect(canAddShowcase(showcases, 2)).toBe(false);
        expect(addShowcase(showcases, 2)).toBe(showcases);
    });
});

describe('removeShowcase', () => {
    it('удаляет проект по индексу, не трогая остальные', () => {
        const showcases = [
            { title: 'A', tags: [], description: '', imageUrl: '', url: '', nda: false, upcoming: false },
            { title: 'B', tags: [], description: '', imageUrl: '', url: '', nda: false, upcoming: false },
            { title: 'C', tags: [], description: '', imageUrl: '', url: '', nda: false, upcoming: false },
        ];
        expect(removeShowcase(showcases, 1)).toEqual([
            { title: 'A', tags: [], description: '', imageUrl: '', url: '', nda: false, upcoming: false },
            { title: 'C', tags: [], description: '', imageUrl: '', url: '', nda: false, upcoming: false },
        ]);
    });
});

describe('updateShowcase', () => {
    it('меняет поле только у проекта с нужным индексом', () => {
        const showcases = [
            { title: 'A', tags: [], description: '', imageUrl: '', url: '', nda: false, upcoming: false },
            { title: 'B', tags: [], description: '', imageUrl: '', url: '', nda: false, upcoming: false },
        ];
        const result = updateShowcase(showcases, 1, { imageUrl: 'https://example.com/b.png' });
        expect(result[0]).toEqual({
            title: 'A',
            tags: [],
            description: '',
            imageUrl: '',
            url: '',
            nda: false,
            upcoming: false,
        });
        expect(result[1]).toEqual({
            title: 'B',
            tags: [],
            description: '',
            imageUrl: 'https://example.com/b.png',
            url: '',
            nda: false,
            upcoming: false,
        });
    });
});
