import { useSearchParams } from 'react-router-dom';
import { Button } from '../../../shared/ui/Button';
import styles from './index.module.scss';

// Настоящая ссылка на stats-backend (см. stats-backend/server.js в корне
// репозитория) — GET /auth/riot/login. RIOT_CLIENT_ID на бэкенде пока не
// задан нигде (Riot ещё не выдал RSO-доступ — заявка на продукт сама
// Pending Review, а RSO Riot открывает отдельным приглашением уже после
// одобрения), поэтому клик реально доходит до настоящего сервера и
// честно возвращается на "/?auth_error=1" вместо похода в Riot с пустым
// client_id (см. stats-backend/server.js, /auth/riot/login) — здесь это
// читается через react-router-dom и показывается статусной заметкой,
// вместо имитации рабочего флоу. Как только Riot выдаст client_id/
// client_secret — ничего в этом компоненте менять не нужно, достаточно
// прописать их в .env на сервере.
export function RiotSignInButton() {
    const [searchParams] = useSearchParams();
    const hasAuthError = searchParams.get('auth_error') === '1';

    return (
        <div>
            <Button variant="primary" fullWidth href="/auth/riot/login" aria-describedby="riot-sign-in-note">
                Sign in with Riot
            </Button>
            {hasAuthError && (
                <p id="riot-sign-in-note" className={styles.note} role="status">
                    Riot Sign-On isn't live yet — this product is still in review with Riot Games.
                </p>
            )}
        </div>
    );
}
