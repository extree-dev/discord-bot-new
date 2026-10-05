import { getJson } from '../../shared/api/client';
import type { SiteAdminStatus } from './types';

// "Администратор домена" = Administrator/владелец на сервере бота — один
// и тот же гейт для всего редактируемого с сайта (визитка, настройки
// безопасности и дальше), поэтому отдельная сущность, а не часть
// site-content.
export function getSiteAdminStatus(): Promise<SiteAdminStatus> {
    return getJson<SiteAdminStatus>('/api/site-admin-status');
}
