// Числовые значения типов каналов Discord (ChannelType из discord.js) —
// нужны, чтобы отличать текстовые/голосовые/категории в выпадающих
// списках без импорта всего discord.js на клиент ради одного enum.
export const CHANNEL_TYPE = {
    text: 0,
    voice: 2,
    category: 4,
    announcement: 5,
    stage: 13,
    forum: 15,
} as const;

export interface GuildChannel {
    id: string;
    name: string;
    type: number;
    parentId: string | null;
    position: number;
}

export interface GuildRole {
    id: string;
    name: string;
    position: number;
}
