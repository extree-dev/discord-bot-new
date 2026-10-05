import { getJson, putJson } from '../../shared/api/client';
import type { SecuritySettings } from './types';

export function getSecuritySettings(): Promise<SecuritySettings> {
    return getJson<SecuritySettings>('/api/security-settings');
}

export function updateSecuritySettings(settings: SecuritySettings): Promise<SecuritySettings> {
    return putJson<SecuritySettings>('/api/security-settings', settings);
}
