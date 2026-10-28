// Демо-данные для витрины на лендинге (widgets/demo-dashboard). Намеренно
// неравномерные (не "50% везде" на всех картах) — ТЗ прямо требует
// реалистичности, а не плейсхолдеров. Подписаны "Demo data" в самом
// компоненте — это не данные пользователя, реальная статистика появится
// после входа через Riot.

export interface MapWinRate {
    map: string;
    wins: number;
    losses: number;
}

export const MAP_WIN_RATES: MapWinRate[] = [
    { map: 'Haven', wins: 16, losses: 9 },
    { map: 'Ascent', wins: 12, losses: 9 },
    { map: 'Lotus', wins: 11, losses: 9 },
    { map: 'Sunset', wins: 9, losses: 9 },
    { map: 'Bind', wins: 8, losses: 9 },
    { map: 'Icebox', wins: 7, losses: 9 },
    { map: 'Split', wins: 7, losses: 11 },
];

export function winRate({ wins, losses }: MapWinRate): number {
    return Math.round((wins / (wins + losses)) * 100);
}

// K/D за последние матчи, самый свежий — последний элемент.
export const KD_TREND: number[] = [1.1, 1.8, 1.2, 2.4, 0.9, 1.5, 2.1, 1.0, 1.7, 2.6, 1.3, 1.9, 2.2, 1.6];

export const RANK = {
    tier: 'Diamond 2',
    rr: 42,
    rrToPromo: 100,
};

export interface AgentStat {
    name: string;
    games: number;
    wins: number;
}

export const TOP_AGENTS: AgentStat[] = [
    { name: 'Jett', games: 23, wins: 14 },
    { name: 'Omen', games: 14, wins: 8 },
    { name: 'Sova', games: 9, wins: 5 },
    { name: 'Killjoy', games: 6, wins: 3 },
];
