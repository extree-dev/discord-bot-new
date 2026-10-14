import { detectPlatform } from '../../../shared/lib/platform';
import type { Client, Community, Showcase, SiteContent, SiteLink, Tool } from '../types';

export function selectSocialLinks(content: SiteContent): SiteLink[] {
    return content.links.filter(link => link.url && detectPlatform(link) !== 'generic');
}

// Селекторы секций: возвращают только непустые массивы (или пустой),
// страница по .length решает, рендерить ли секцию.
export function selectTools(content: SiteContent): Tool[] {
    return content.tools ?? [];
}

export function selectClients(content: SiteContent): Client[] {
    return content.clients ?? [];
}

export function selectCommunities(content: SiteContent): Community[] {
    return content.communities ?? [];
}

export function selectShowcases(content: SiteContent): Showcase[] {
    return content.showcases ?? [];
}
