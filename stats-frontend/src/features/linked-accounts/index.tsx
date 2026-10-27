import { useNavigate } from 'react-router-dom';
import { Panel } from '../../shared/ui/Panel';
import { Button } from '../../shared/ui/Button';
import { LinkIcon } from '../../shared/ui/Icons';
import styles from './index.module.scss';

interface LinkedAccountsProps {
    riotLinked: boolean;
}

// Новый блок на странице аккаунта: раньше статус привязки Riot (user.
// riotLinked) нигде в Settings не был виден — только неявно влиял на
// текст в pages/account (hero-заглушка "Waiting for Riot Approval").
// Тут он получает собственную карточку с реальным действием: перейти к
// уже существующей (и честной насчёт ограничений RSO) странице поиска
// Riot-профиля, не выдумывая данные, которых у бэкенда ещё нет (gameName/
// tagLine для привязанного аккаунта бэкенд не хранит — см. User.java,
// только riot_puuid).
export function LinkedAccounts({ riotLinked }: LinkedAccountsProps) {
    const navigate = useNavigate();

    return (
        <Panel title="Linked Accounts" subtitle="Connect external accounts to unlock more of Extree Stats.">
            <div className={styles.row}>
                <div className={styles.rowLeft}>
                    <div className={`${styles.iconWrap} ${riotLinked ? styles.iconWrapLinked : ''}`}>
                        <LinkIcon />
                    </div>
                    <div>
                        <div className={styles.rowTitle}>Riot Games</div>
                        <div className={styles.rowSubtitle}>
                            {riotLinked
                                ? 'Your Riot account is connected.'
                                : 'Link your Riot account to view match stats once Riot approves full API access.'}
                        </div>
                    </div>
                </div>

                <div className={styles.rowRight}>
                    {riotLinked ? (
                        <>
                            <span className={styles.connectedBadge}>Connected</span>
                            <Button variant="ghost" size="sm" onClick={() => navigate('/riot-lookup')}>
                                View Riot Profile
                            </Button>
                        </>
                    ) : (
                        <Button variant="ghost" size="sm" href="/auth/riot/login">
                            Connect
                        </Button>
                    )}
                </div>
            </div>
        </Panel>
    );
}
