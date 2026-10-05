export interface AutomodSettings {
    enabled: boolean;
    maxMentions: number;
    maxMessagesPerWindow: number;
    messageWindowMs: number;
    allowedInviteCodes: string[];
}

export interface RaidShieldSettings {
    enabled: boolean;
    joinThreshold: number;
    windowMs: number;
    lockdownMs: number;
    kickNewAccounts: boolean;
    newAccountAgeMs: number;
}

export interface AntiNukeSettings {
    enabled: boolean;
    maxActions: number;
    windowMs: number;
}

export interface SecuritySettings {
    automod: AutomodSettings;
    raidShield: RaidShieldSettings;
    antiNuke: AntiNukeSettings;
    bannedWords: string[];
}
