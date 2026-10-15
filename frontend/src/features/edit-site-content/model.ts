import type { Client, Showcase, SiteContent, SiteLink } from '../../entities/site-content/types';

export const EMPTY_LINK: SiteLink = { label: '', url: '' };
export const EMPTY_CLIENT: Client = { name: '', logoUrl: '', period: '' };
export const EMPTY_SHOWCASE: Showcase = {
    title: '',
    tags: [],
    description: '',
    imageUrl: '',
    url: '',
    nda: false,
    upcoming: false,
};

export function canAddLink(links: SiteLink[], maxLinks: number): boolean {
    return links.length < maxLinks;
}

export function addLink(links: SiteLink[], maxLinks: number): SiteLink[] {
    return canAddLink(links, maxLinks) ? [...links, { ...EMPTY_LINK }] : links;
}

export function removeLink(links: SiteLink[], index: number): SiteLink[] {
    return links.filter((_, i) => i !== index);
}

export function updateLink(links: SiteLink[], index: number, patch: Partial<SiteLink>): SiteLink[] {
    return links.map((link, i) => (i === index ? { ...link, ...patch } : link));
}

export function canAddClient(clients: Client[], maxClients: number): boolean {
    return clients.length < maxClients;
}

export function addClient(clients: Client[], maxClients: number): Client[] {
    return canAddClient(clients, maxClients) ? [...clients, { ...EMPTY_CLIENT }] : clients;
}

export function removeClient(clients: Client[], index: number): Client[] {
    return clients.filter((_, i) => i !== index);
}

export function updateClient(clients: Client[], index: number, patch: Partial<Client>): Client[] {
    return clients.map((client, i) => (i === index ? { ...client, ...patch } : client));
}

export function canAddShowcase(showcases: Showcase[], maxShowcases: number): boolean {
    return showcases.length < maxShowcases;
}

export function addShowcase(showcases: Showcase[], maxShowcases: number): Showcase[] {
    return canAddShowcase(showcases, maxShowcases) ? [...showcases, { ...EMPTY_SHOWCASE }] : showcases;
}

export function removeShowcase(showcases: Showcase[], index: number): Showcase[] {
    return showcases.filter((_, i) => i !== index);
}

export function updateShowcase(showcases: Showcase[], index: number, patch: Partial<Showcase>): Showcase[] {
    return showcases.map((showcase, i) => (i === index ? { ...showcase, ...patch } : showcase));
}

// Та же нормализация, что и на бэкенде (site/model.js normalize()) —
// дублирование оправдано: это не единственный источник истины (сервер
// всё равно перепроверит), а мгновенная обратная связь в форме до
// сетевого запроса — пустые строки-ссылки без label не летят на сервер
// вообще, лишние пробелы обрезаются сразу.
export function toPayload(content: SiteContent): SiteContent {
    return {
        name: content.name.trim(),
        role: content.role.trim(),
        bio: content.bio.trim(),
        links: content.links
            .filter(link => link.label.trim())
            .map(link => ({ label: link.label.trim(), url: link.url.trim() })),
        clients: (content.clients ?? [])
            .filter(client => client.name.trim() && client.logoUrl.trim())
            .map(client => ({
                name: client.name.trim(),
                logoUrl: client.logoUrl.trim(),
                period: client.period.trim(),
            })),
        showcases: (content.showcases ?? [])
            .filter(showcase => showcase.title.trim())
            .map(showcase => ({
                title: showcase.title.trim(),
                tags: showcase.tags.map(tag => tag.trim()).filter(Boolean),
                description: showcase.description.trim(),
                imageUrl: (showcase.imageUrl ?? '').trim(),
                url: (showcase.url ?? '').trim(),
                nda: Boolean(showcase.nda),
                upcoming: Boolean(showcase.upcoming),
            })),
    };
}
