import { getJson, postForm, putJson } from '../../shared/api/client';
import type { SiteContent, SiteContentResponse } from './types';

export function getSiteContent(): Promise<SiteContentResponse> {
    return getJson<SiteContentResponse>('/api/site-content');
}

export function updateSiteContent(content: SiteContent): Promise<SiteContentResponse> {
    return putJson<SiteContentResponse>('/api/site-content', content);
}

// Возвращает URL уже на нашем же домене (/api/uploads/<id>) — то, что
// нужно логотипам клиентов, чтобы пройти CSP (img-src 'self') и не
// зависеть от доступности внешнего хостинга картинки.
export function uploadImage(file: File): Promise<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    return postForm<{ url: string }>('/api/uploads', form);
}
