export type ActivityTypeKey = 'playing' | 'streaming' | 'watching' | 'listening' | 'competing';

export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible';

export interface ActivityItem {
    type: ActivityTypeKey;
    text: string | null;
    url: string | null;
}

export interface PresenceSettings {
    status: PresenceStatus;
    rotate: boolean;
    rotateIntervalMs: number;
    activity: ActivityItem;
    rotateItems: ActivityItem[];
}
