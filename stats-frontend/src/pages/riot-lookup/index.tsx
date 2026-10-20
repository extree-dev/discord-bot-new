import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SplitAuthLayout } from '../../widgets/split-auth';
import { TextField } from '../../shared/ui/TextField';
import { Button } from '../../shared/ui/Button';
import { lookupRiotId, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

const RIOT_DISCLAIMER =
    "Extree Stats isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing VALORANT. VALORANT and Riot Games are trademarks or registered trademarks of Riot Games, Inc.";

// Пока показывает только "аккаунт существует" (account-v1) — Match V1
// (сами матчи) этому ключу не отдан, см. stats-backend/riotApi.js.
// Честно говорим об этом в lead и в карточке результата, а не притворяемся
// неработающей фичей или не показываем вовсе.
export function RiotLookupPage() {
    const [riotId, setRiotId] = useState('');
    const [result, setResult] = useState<{ gameName: string; tagLine: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setResult(null);
        setPending(true);
        try {
            const found = await lookupRiotId(riotId);
            setResult({ gameName: found.gameName, tagLine: found.tagLine });
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    return (
        <SplitAuthLayout
            badge="VALORANT API — account lookup"
            heading={
                <>
                    Find your
                    <br />
                    <span className="hl">Riot ID.</span>
                </>
            }
            lead="We can already confirm a Riot account exists through Riot's API. Full match stats — K/D, win rates, maps — are coming once Riot approves full API access for Extree Stats."
            cardTitle="Look up a Riot ID"
            error={error}
            footer={
                <>
                    Looking for something else? <Link to="/">Back to Extree Stats</Link>
                </>
            }
        >
            <form className={styles.form} onSubmit={onSubmit}>
                <TextField
                    id="riotId"
                    label="Riot ID"
                    type="text"
                    placeholder="Name#Tag"
                    required
                    value={riotId}
                    onChange={e => setRiotId(e.target.value)}
                />
                <Button type="submit" variant="flat" fullWidth disabled={pending}>
                    {pending ? 'Looking up…' : 'Look up'}
                </Button>
            </form>

            {result && (
                <div className={styles.result}>
                    <div className={styles.resultTitle}>Account found</div>
                    <div className={styles.resultId}>
                        {result.gameName}
                        <span className={styles.resultTag}>#{result.tagLine}</span>
                    </div>
                    <p className={styles.resultNote}>
                        Match history and stats aren&apos;t available yet — Riot hasn&apos;t approved full API access
                        for Extree Stats.
                    </p>
                </div>
            )}

            <p className={styles.disclaimer}>{RIOT_DISCLAIMER}</p>
        </SplitAuthLayout>
    );
}
