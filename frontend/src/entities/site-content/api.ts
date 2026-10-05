import { getJson, putJson } from '../../shared/api/client';
import type { SiteContent, SiteContentResponse } from './types';

export function getSiteContent(): Promise<SiteContentResponse> {
    return getJson<SiteContentResponse>('/api/site-content');
}

export function updateSiteContent(content: SiteContent): Promise<SiteContentResponse> {
    return putJson<SiteContentResponse>('/api/site-content', content);
}
