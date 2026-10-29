export type GameStatus = 'ready' | 'pending_api' | 'coming_soon';

export interface Game {
    slug: string;
    name: string;
    shortName: string;
    description: string;
    accent: string;
    status: GameStatus;
    background: string;
}

export const GAMES: Game[] = [
    {
        slug: 'valorant',
        name: 'VALORANT',
        shortName: 'VAL',
        description: 'Tactical 5v5 character-based shooter.',
        accent: '#caa2f4',
        status: 'pending_api',
        background: '/games/valorant/background.webp',
    },
    {
        slug: 'cs2',
        name: 'Counter-Strike 2',
        shortName: 'CS2',
        description: 'Classic tactical shooter.',
        accent: '#bca07c',
        status: 'pending_api',
        background: '/games/cs2/background.jpg',
    },
    {
        slug: 'dota2',
        name: 'Dota 2',
        shortName: 'DOTA',
        description: 'MOBA with a massive hero pool.',
        accent: '#327ed3',
        status: 'pending_api',
        background: '/games/dota2/background.jpg',
    },
    {
        slug: 'lol',
        name: 'League of Legends',
        shortName: 'LOL',
        description: 'The most popular MOBA in the world.',
        accent: '#cd6194',
        status: 'pending_api',
        background: '/games/lol/background.jpg',
    },
    {
        slug: 'apex',
        name: 'Apex Legends',
        shortName: 'APEX',
        description: 'Hero shooter battle royale.',
        accent: '#f965a2',
        status: 'pending_api',
        background: '/games/apex/background.jpg',
    },
    {
        slug: 'fortnite',
        name: 'Fortnite',
        shortName: 'FN',
        description: 'Battle royale with building mechanics.',
        accent: '#edb46d',
        status: 'pending_api',
        background: '/games/fortnite/background.jpg',
    },
    {
        slug: 'cod',
        name: 'Call of Duty',
        shortName: 'COD',
        description: 'Modern warfare multiplayer and Warzone stats.',
        accent: '#d0d2c4',
        status: 'pending_api',
        background: '/games/cod/background.webp',
    },
];

export function getGame(slug: string): Game | undefined {
    return GAMES.find(g => g.slug === slug);
}
