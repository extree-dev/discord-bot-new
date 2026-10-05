import { getJson } from '../../shared/api/client';
import type { GuildsResponse } from './types';

export function getManagedGuilds(): Promise<GuildsResponse> {
    return getJson<GuildsResponse>('/api/guilds');
}
