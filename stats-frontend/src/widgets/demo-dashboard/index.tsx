import { useEffect, useState } from 'react';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { Skeleton } from '../../shared/ui/Skeleton';
import { TrophyIcon } from '../../shared/ui/Icons';
import { MAP_WIN_RATES, KD_TREND, RANK, TOP_AGENTS, winRate } from './data';
import { useCountUp } from './useCountUp';
import styles from './index.module.scss';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function MapBar({ map, wins, losses, loaded, animate }: { map: string; wins: number; losses: number; loaded: boolean; animate: boolean }) {
    const rate = winRate({ map, wins, losses });
    const tooltipId = `maprate-${map.toLowerCase()}`;

    return (
        <div className={styles.barRow}>
            <span className={styles.barLabel}>{map}</span>
            <span className={styles.barTrack}>
                <button
                    type="button"
                    className={styles.barFill}
                    style={{ width: loaded ? `${rate}%` : 0, transitionDuration: animate ? '700ms' : '0ms' }}
                    aria-describedby={tooltipId}
                >
                    <span className={styles.barTooltip} id={tooltipId} role="tooltip">
                        {map} — {rate}% ({wins} wins of {wins + losses})
                    </span>
                </button>
            </span>
            <span className={styles.barValue}>{loaded ? `${rate}%` : ''}</span>
        </div>
    );
}

function KdSparkline({ loaded, animate }: { loaded: boolean; animate: boolean }) {
    const w = 220;
    const h = 56;
    const max = Math.max(...KD_TREND);
    const min = Math.min(...KD_TREND);
    const span = max - min || 1;
    const points = KD_TREND.map((v, i) => {
        const x = (i / (KD_TREND.length - 1)) * w;
        const y = h - ((v - min) / span) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const pathLength = w * 1.4; // приблизительная длина ломаной, достаточно для dash-анимации

    return (
        <svg
            className={styles.kdChart}
            viewBox={`0 0 ${w} ${h}`}
            width={w}
            height={h}
            role="img"
            aria-labelledby="kd-chart-title"
        >
            <title id="kd-chart-title">K/D trend over the last {KD_TREND.length} matches, demo data</title>
            <polyline
                points={points}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                    strokeDasharray: pathLength,
                    strokeDashoffset: loaded ? 0 : pathLength,
                    transition: animate ? 'stroke-dashoffset 900ms ease-out' : 'none',
                }}
            />
        </svg>
    );
}

function AgentCard({ name, games, wins, loaded, animate }: { name: string; games: number; wins: number; loaded: boolean; animate: boolean }) {
    const rate = Math.round((wins / games) * 100);
    const animatedRate = useCountUp(rate, loaded && animate);

    return (
        <div className={styles.agentCard}>
            <span className={styles.agentAvatar} aria-hidden="true">
                {name.slice(0, 1)}
            </span>
            <span className={styles.agentName}>{name}</span>
            <span className={styles.agentRate}>{loaded ? `${animatedRate}%` : ''}</span>
            <span className={styles.agentGames}>{games} games</span>
        </div>
    );
}

// Витрина продукта на лендинге — не иллюстрация, а мини-копия реального
// дашборда с демо-данными (см. data.ts). Загрузка здесь не сетевая (данные
// статические), поэтому "loading" — это только эмуляция первого рендера для
// анимации появления; состояний error/empty нет и быть не может, раз нет
// запроса, который мог бы упасть.
export function DemoDashboard() {
    const [loaded, setLoaded] = useState(false);
    const [showAllAgents, setShowAllAgents] = useState(false);
    const isMobile = useMediaQuery('(max-width: 640px)');
    const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
    const animate = !reducedMotion;

    useEffect(() => {
        if (reducedMotion) {
            setLoaded(true);
            return;
        }
        const t = window.setTimeout(() => setLoaded(true), 450);
        return () => window.clearTimeout(t);
    }, [reducedMotion]);

    const visibleAgents = isMobile && !showAllAgents ? TOP_AGENTS.slice(0, 2) : TOP_AGENTS;

    return (
        <div className={styles.dashboard} id="demo-dashboard">
            <div className={styles.dashboardHead}>
                <span className={styles.dashboardTitle}>Your dashboard</span>
                <span className={styles.demoLabel}>Demo data</span>
            </div>

            <section className={styles.panel} aria-label="Win rate by map">
                <h3 className={styles.panelTitle}>Win rate by map</h3>
                {loaded ? (
                    <div className={styles.barList}>
                        {MAP_WIN_RATES.map(row => (
                            <MapBar key={row.map} {...row} loaded={loaded} animate={animate} />
                        ))}
                    </div>
                ) : (
                    <div className={styles.barList}>
                        {MAP_WIN_RATES.map(row => (
                            <div className={styles.barRow} key={row.map}>
                                <Skeleton width={46} height={12} />
                                <Skeleton width="100%" height={10} radius={999} className={styles.barSkeletonTrack} />
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <div className={styles.panelGrid}>
                <section className={styles.panel} aria-label="K/D trend">
                    <h3 className={styles.panelTitle}>K/D trend</h3>
                    {loaded ? <KdSparkline loaded={loaded} animate={animate} /> : <Skeleton width={220} height={56} />}
                </section>

                <section className={styles.panel} aria-label="Rank progress">
                    <h3 className={styles.panelTitle}>Rank progress</h3>
                    {loaded ? (
                        <div className={styles.rankBlock}>
                            <span className={styles.rankBadge}>
                                <TrophyIcon />
                                {RANK.tier}
                            </span>
                            <div className={styles.rankTrack}>
                                <div
                                    className={styles.rankFill}
                                    style={{
                                        width: `${(RANK.rr / RANK.rrToPromo) * 100}%`,
                                        transitionDuration: animate ? '700ms' : '0ms',
                                    }}
                                />
                            </div>
                            <span className={styles.rankText}>
                                {RANK.rr} / {RANK.rrToPromo} RR to promotion
                            </span>
                        </div>
                    ) : (
                        <div className={styles.rankBlock}>
                            <Skeleton width={120} height={24} radius={999} />
                            <Skeleton width="100%" height={8} radius={999} />
                        </div>
                    )}
                </section>
            </div>

            <section className={styles.panel} aria-label="Top agents">
                <h3 className={styles.panelTitle}>Top agents</h3>
                {loaded ? (
                    <>
                        <div className={styles.agentGrid}>
                            {visibleAgents.map(agent => (
                                <AgentCard key={agent.name} {...agent} loaded={loaded} animate={animate} />
                            ))}
                        </div>
                        {isMobile && !showAllAgents && TOP_AGENTS.length > visibleAgents.length && (
                            <button type="button" className={styles.showMore} onClick={() => setShowAllAgents(true)}>
                                Show {TOP_AGENTS.length - visibleAgents.length} more
                            </button>
                        )}
                    </>
                ) : (
                    <div className={styles.agentGrid}>
                        {TOP_AGENTS.slice(0, isMobile ? 2 : 4).map(agent => (
                            <Skeleton key={agent.name} width="100%" height={84} radius={8} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
