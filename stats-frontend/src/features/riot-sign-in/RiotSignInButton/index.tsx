import { useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import styles from './index.module.scss';

// RSO (Riot Sign-On) ещё не подключён — заявка на продукт сама ещё на
// рассмотрении (см. Riot Developer Portal, статус Pending Review), и
// учётные данные OAuth-клиента Riot выдаёт отдельно от API-ключа. Кнопка
// сознательно не редиректит в никуда (это было бы нечестной имитацией
// рабочего флоу) — вместо этого по клику показывает заметку о статусе,
// держа интерфейс интерактивным, а не просто disabled-заглушкой. Когда
// появятся client_id/client_secret — здесь появится реальный редирект на
// authorization-endpoint RSO, тем же паттерном, что и features/discord-auth/
// LoginButton в основном кабинете (frontend/).
export function RiotSignInButton() {
    const [pending, setPending] = useState(false);

    return (
        <div>
            <Button variant="primary" fullWidth onClick={() => setPending(true)} aria-describedby="riot-sign-in-note">
                Sign in with Riot
            </Button>
            {pending && (
                <p id="riot-sign-in-note" className={styles.note} role="status">
                    Riot Sign-On integration is launching soon — this product is still in review.
                </p>
            )}
        </div>
    );
}
