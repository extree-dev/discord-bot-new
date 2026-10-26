import { useEffect, useState } from 'react';
import { IconCheck, IconX } from '../../shared/ui/Icons';
import { Button } from '../../shared/ui/Button';
import type { AccountUser } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Check {
    label: string;
    detail: string;
    done: boolean;
}

interface SecurityScoreProps {
    user: Pick<AccountUser, 'emailVerified' | 'isTwoFactorEnabled' | 'riotLinked'>;
    onEnable2fa: () => void;
}

// Единственный источник "уровня защиты" аккаунта на странице — сводит в
// одну цифру то, что иначе разбросано по отдельным панелям ниже (email
// verified в Personal Information, 2FA в своей секции), и даёт один клик
// до самого weighty действия (включить 2FA), а не "иди ищи сам". Очки
// считаются только из того, что уже есть в AccountUser — ни одного нового
// запроса к бэкенду.
export function SecurityScore({ user, onEnable2fa }: SecurityScoreProps) {
    const checks: Check[] = [
        {
            label: 'Email verified',
            detail: 'Confirms it\'s really you and lets us reach you about account activity.',
            done: user.emailVerified,
        },
        {
            label: 'Two-factor authentication',
            detail: 'An authenticator app code is required on every new sign-in.',
            done: user.isTwoFactorEnabled,
        },
    ];
    const score = Math.round((checks.filter(c => c.done).length / checks.length) * 100);

    const [displayScore, setDisplayScore] = useState(0);
    useEffect(() => {
        const raf = requestAnimationFrame(() => setDisplayScore(score));
        return () => cancelAnimationFrame(raf);
    }, [score]);

    const tier = score === 100 ? 'max' : score >= 50 ? 'mid' : 'low';
    const offset = CIRCUMFERENCE * (1 - displayScore / 100);

    return (
        <section className={`${styles.card} ${styles[tier]}`}>
            <div className={styles.ring}>
                <svg viewBox="0 0 120 120" className={styles.ringSvg}>
                    <circle className={styles.ringTrack} cx="60" cy="60" r={RADIUS} />
                    <circle
                        className={styles.ringFill}
                        cx="60"
                        cy="60"
                        r={RADIUS}
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset={offset}
                    />
                </svg>
                <div className={styles.ringLabel}>
                    <span className={styles.ringScore}>{displayScore}</span>
                    <span className={styles.ringUnit}>%</span>
                </div>
            </div>

            <div className={styles.body}>
                <h3 className={styles.heading}>
                    {score === 100 ? 'Your account is fully secured' : 'Security score'}
                </h3>
                <p className={styles.subheading}>
                    {score === 100
                        ? 'Email verified and two-factor authentication enabled — nice work.'
                        : 'A couple of quick steps stand between you and a fully locked-down account.'}
                </p>

                <ul className={styles.checklist}>
                    {checks.map(c => (
                        <li key={c.label} className={`${styles.checkItem} ${c.done ? styles.checkDone : ''}`}>
                            <span className={styles.checkIcon}>{c.done ? <IconCheck /> : <IconX />}</span>
                            <div>
                                <div className={styles.checkLabel}>{c.label}</div>
                                <div className={styles.checkDetail}>{c.detail}</div>
                            </div>
                        </li>
                    ))}
                </ul>

                {!user.isTwoFactorEnabled && (
                    <Button variant="ghost" size="sm" onClick={onEnable2fa}>
                        Enable 2FA now
                    </Button>
                )}

                {user.riotLinked && <div className={styles.riotBadge}>Riot account linked</div>}
            </div>
        </section>
    );
}
