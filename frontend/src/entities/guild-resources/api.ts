import { getJson } from '../../shared/api/client';
import type { GuildChannel, GuildRole } from './types';

export function getGuildChannels(): Promise<{ channels: GuildChannel[] }> {
    return getJson<{ channels: GuildChannel[] }>('/api/guild-channels');
}

export function getGuildRoles(): Promise<{ roles: GuildRole[] }> {
    return getJson<{ roles: GuildRole[] }>('/api/guild-roles');
}
