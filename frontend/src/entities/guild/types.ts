export interface ManagedGuild {
    id: string;
    name: string;
    iconUrl: string | null;
}

export interface GuildsResponse {
    guilds: ManagedGuild[];
}
