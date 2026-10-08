export interface GuildMemberRole {
    id: string;
    name: string;
}

export interface GuildMember {
    id: string;
    username: string;
    globalName: string | null;
    avatarUrl: string;
    roles: GuildMemberRole[];
    joinedAt: string | null;
}

export interface GuildMembersResponse {
    members: GuildMember[];
}

export interface MutedMember {
    id: string;
    username: string | null;
    globalName: string | null;
    avatarUrl: string | null;
    reason: string | null;
    mutedBy: string | null;
    mutedAt: number | null;
    expiresAt: number | null;
}

export interface MutedMembersResponse {
    muted: MutedMember[];
}

export interface BannedMember {
    id: string;
    username: string;
    globalName: string | null;
    avatarUrl: string;
    reason: string | null;
    moderatorTag: string | null;
    bannedAt: string | null;
}

export interface BannedMembersResponse {
    banned: BannedMember[];
}

export interface LeaderboardEntry {
    rank: number;
    id: string;
    username: string | null;
    globalName: string | null;
    avatarUrl: string | null;
    score: number;
    messageCount: number;
    voiceMinutes: number;
    prestige: number;
}

export interface LeaderboardResponse {
    leaderboard: LeaderboardEntry[];
}
