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
interface RiotSignInButtonProps {
    // Страницы, где эта кнопка встречается больше одного раза (напр. лендинг
    // повторяет её в hero и в финальном CTA-блоке), должны передать разный
    // noteId — иначе на странице окажется два элемента с одинаковым id, что
    // ломает aria-describedby.
    noteId?: string;
}

export function RiotSignInButton({ noteId = 'riot-sign-in-note' }: RiotSignInButtonProps) {
    const [searchParams] = useSearchParams();
    const hasAuthError = searchParams.get('auth_error') === '1';

    return (
        <div>
            <Button variant="primary" href="/auth/riot/login" aria-describedby={noteId}>
                Sign in with Riot
            </Button>
            {hasAuthError && (
                <p id={noteId} className={styles.note} role="status">
                    Riot Sign-On isn't live yet — this product is still in review with Riot Games.
                </p>
            )}
        </div>
    );
}
