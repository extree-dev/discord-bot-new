import { getJson, putJson } from '../../shared/api/client';
import type { PresenceSettings } from './types';

export function getPresenceSettings(): Promise<PresenceSettings> {
    return getJson<PresenceSettings>('/api/presence-settings');
}

export function updatePresenceSettings(settings: PresenceSettings): Promise<PresenceSettings> {
    return putJson<PresenceSettings>('/api/presence-settings', settings);
}
