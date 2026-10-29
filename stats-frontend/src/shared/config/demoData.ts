export interface DemoData {
    maps: { map: string; wins: number; losses: number }[];
    agents: { name: string; games: number; wins: number }[];
    rank: { tier: string; rr: number; rrToPromo: number };
    kdTrend: number[];
}

export const DEMO_DATA: Record<string, DemoData> = {
    valorant: {
        maps: [
            { map: 'Haven', wins: 64, losses: 36 },
            { map: 'Ascent', wins: 57, losses: 43 },
            { map: 'Lotus', wins: 55, losses: 45 },
            { map: 'Sunset', wins: 50, losses: 50 },
            { map: 'Bind', wins: 47, losses: 53 },
        ],
        agents: [
            { name: 'Jett', games: 23, wins: 14 },
            { name: 'Omen', games: 14, wins: 8 },
            { name: 'Sova', games: 9, wins: 5 },
        ],
        rank: { tier: 'Diamond 2', rr: 42, rrToPromo: 100 },
        kdTrend: [0.8, 1.1, 0.9, 1.4, 1.2, 1.5, 1.3, 1.6, 1.4],
    },
    cs2: {
        maps: [
            { map: 'Mirage', wins: 70, losses: 30 },
            { map: 'Inferno', wins: 60, losses: 40 },
            { map: 'Dust II', wins: 52, losses: 48 },
            { map: 'Nuke', wins: 45, losses: 55 },
            { map: 'Ancient', wins: 40, losses: 60 },
        ],
        agents: [
            // В CS2 нет агентов, но для визуала можно показать оружие или просто "Top Weapons"
            { name: 'AK-47', games: 50, wins: 30 },
            { name: 'M4A4', games: 30, wins: 18 },
            { name: 'AWP', games: 20, wins: 12 },
        ],
        rank: { tier: 'Global Elite', rr: 15, rrToPromo: 100 },
        kdTrend: [1.0, 1.2, 1.1, 1.3, 1.5, 1.4, 1.6, 1.8, 1.7],
    },
    dota2: {
        maps: [
            { map: 'Safe Lane', wins: 65, losses: 35 },
            { map: 'Mid Lane', wins: 55, losses: 45 },
            { map: 'Off Lane', wins: 48, losses: 52 },
            { map: 'Jungle', wins: 30, losses: 70 },
        ],
        agents: [
            { name: 'Invoker', games: 40, wins: 25 },
            { name: 'Anti-Mage', games: 25, wins: 12 },
            { name: 'Pudge', games: 15, wins: 8 },
        ],
        rank: { tier: 'Divine 5', rr: 80, rrToPromo: 100 },
        kdTrend: [1.5, 1.8, 1.6, 2.1, 1.9, 2.2, 2.0, 2.5, 2.3],
    },
    lol: {
        maps: [
            { map: 'Top', wins: 60, losses: 40 },
            { map: 'Jungle', wins: 55, losses: 45 },
            { map: 'Mid', wins: 58, losses: 42 },
            { map: 'ADC', wins: 62, losses: 38 },
            { map: 'Support', wins: 50, losses: 50 },
        ],
        agents: [
            { name: 'Ahri', games: 30, wins: 18 },
            { name: 'Yasuo', games: 20, wins: 10 },
            { name: 'Lee Sin', games: 15, wins: 9 },
        ],
        rank: { tier: 'Master', rr: 200, rrToPromo: 500 },
        kdTrend: [1.2, 1.5, 1.3, 1.8, 1.6, 2.0, 1.9, 2.2, 2.1],
    },
    apex: {
        maps: [
            { map: "World's Edge", wins: 60, losses: 40 },
            { map: 'Olympus', wins: 55, losses: 45 },
            { map: 'Kings Canyon', wins: 48, losses: 52 },
            { map: 'Broken Moon', wins: 50, losses: 50 },
        ],
        agents: [
            { name: 'Wraith', games: 25, wins: 15 },
            { name: 'Octane', games: 20, wins: 10 },
            { name: 'Bloodhound', games: 15, wins: 8 },
        ],
        rank: { tier: 'Predator', rr: 10000, rrToPromo: 15000 },
        kdTrend: [1.1, 1.4, 1.2, 1.7, 1.5, 1.8, 1.6, 2.1, 1.9],
    },
    fortnite: {
        maps: [
            { map: 'Solos', wins: 10, losses: 90 },
            { map: 'Duos', wins: 15, losses: 85 },
            { map: 'Squads', wins: 20, losses: 80 },
        ],
        agents: [
            // Скины
            { name: 'Peely', games: 100, wins: 10 },
            { name: 'Midas', games: 80, wins: 12 },
            { name: 'Raven', games: 60, wins: 15 },
        ],
        rank: { tier: 'Unreal', rr: 5000, rrToPromo: 10000 },
        kdTrend: [2.0, 2.5, 2.2, 3.1, 2.8, 3.5, 3.0, 3.8, 3.6],
    },
    cod: {
        maps: [
            { map: 'Nuketown', wins: 70, losses: 30 },
            { map: 'Shipment', wins: 65, losses: 35 },
            { map: 'Terminal', wins: 55, losses: 45 },
            { map: 'Rust', wins: 60, losses: 40 },
            { map: 'Highrise', wins: 50, losses: 50 },
        ],
        agents: [
            { name: 'M4', games: 80, wins: 50 },
            { name: 'MP5', games: 50, wins: 30 },
            { name: 'Kar98k', games: 30, wins: 15 },
        ],
        rank: { tier: 'Iridescent', rr: 8500, rrToPromo: 10000 },
        kdTrend: [1.2, 1.5, 1.4, 1.8, 1.6, 2.0, 1.8, 2.2, 2.1],
    },
};
