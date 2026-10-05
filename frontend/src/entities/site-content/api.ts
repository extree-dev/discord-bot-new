import { getJson, putJson } from '../../shared/api/client';
import type { SiteAdminStatus, SiteContent, SiteContentResponse } from './types';

export function getSiteContent(): Promise<SiteContentResponse> {
    return getJson<SiteContentResponse>('/api/site-content');
}

export function getSiteAdminStatus(): Promise<SiteAdminStatus> {
    return getJson<SiteAdminStatus>('/api/site-admin-status');
}

export function updateSiteContent(content: SiteContent): Promise<SiteContentResponse> {
    return putJson<SiteContentResponse>('/api/site-content', content);
}
