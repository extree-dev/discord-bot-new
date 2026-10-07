import { getJson } from '../../shared/api/client';
import type { GuildStats } from './types';

export function getGuildStats(): Promise<GuildStats> {
    return getJson<GuildStats>('/api/guild-stats');
}
