import type { SiteContent, SiteLink } from '../../entities/site-content/types';

export const EMPTY_LINK: SiteLink = { label: '', url: '' };

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
    };
}
