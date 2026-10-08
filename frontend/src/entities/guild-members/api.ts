import { getJson } from '../../shared/api/client';
import type { BannedMembersResponse, GuildMembersResponse, LeaderboardResponse, MutedMembersResponse } from './types';

export function getGuildMembers(): Promise<GuildMembersResponse> {
    return getJson<GuildMembersResponse>('/api/guild-members');
}

export function getMutedMembers(): Promise<MutedMembersResponse> {
    return getJson<MutedMembersResponse>('/api/muted-members');
}

export function getBannedMembers(): Promise<BannedMembersResponse> {
    return getJson<BannedMembersResponse>('/api/banned-members');
}

export function getLeaderboard(): Promise<LeaderboardResponse> {
    return getJson<LeaderboardResponse>('/api/leaderboard');
}
