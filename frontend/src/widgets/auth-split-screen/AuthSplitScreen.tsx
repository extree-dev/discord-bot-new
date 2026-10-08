import { useEffect, useState } from 'react';
import { gateNoticeMessage, type GateNotice } from '../../shared/lib/gateNotice';
import { Notice } from '../../shared/ui/Notice';
import { LoginMethods } from '../login-methods/LoginMethods';
import styles from './AuthSplitScreen.module.css';

interface AuthSplitScreenProps {
    notice?: GateNotice | null;
}

// Экран входа — светлая тема, отдельная от тёмного Liquid Glass
// остального сайта (кабинет/лендинг бота). Переменные темы
// переопределены локально в AuthSplitScreen.module.css (.page), поэтому
// вложенные Card/Button/Field/Notice/Checkbox из shared/ui подхватывают
// светлые цвета автоматически через CSS-переменные — без собственной
// светлой копии каждого компонента.
//
// До первого события колеса мыши видна только левая маркетинговая
// колонка по центру экрана; правая колонка с формой входа существует в
// DOM, но схлопнута (width: 0, opacity: 0) и не занимает места — ровно
// так, как показано на референсе: прокрутка колесом "выезжает" форму
// входа справа налево. На мобильных (узкий viewport) анимация и этот
// хинт отключены медиа-запросом в CSS — колонки просто идут одна под
// другой, сразу обе видимые.
export function AuthSplitScreen({ notice }: AuthSplitScreenProps) {
    const [revealed, setRevealed] = useState(false);

    useEffect(() => {
        if (revealed) return;
        const reveal = () => setRevealed(true);
        window.addEventListener('wheel', reveal, { passive: true });
        window.addEventListener('touchmove', reveal, { passive: true });
        return () => {
            window.removeEventListener('wheel', reveal);
            window.removeEventListener('touchmove', reveal);
        };
    }, [revealed]);

    return (
        <div className={`${styles.page} ${revealed ? styles.revealed : ''}`}>
            <div className={styles.marketing}>
                <div className={styles.brand}>
                    <span className={styles.badge}>E</span>Extree
                </div>
                <h1>Доступ к панели управления ботом.</h1>
                <p className={styles.lead}>
                    Войди через Discord, Telegram или email — права каждый раз проверяются у Discord заново, какой бы
                    способ входа ты ни выбрал.
                </p>
                <div className={styles.stats}>
                    <div className={styles.stat}>
                        <span>Discord OAuth2</span>
                        <small>основной вход</small>
                    </div>
                    <div className={styles.stat}>
                        <span>AES-256</span>
                        <small>шифрование сессии</small>
                    </div>
                    <div className={styles.stat}>
                        <span>3 способа</span>
                        <small>Discord / Telegram / email</small>
                    </div>
                </div>
                <div className={styles.features}>
                    <div className={styles.feature}>
                        <strong>Один аккаунт</strong>
                        <span>Discord обязателен, Telegram и email — опциональные способы входа в тот же кабинет.</span>
                    </div>
                    <div className={styles.feature}>
                        <strong>Права не меняются</strong>
                        <span>Доступ администратора проверяется у Discord по актуальным ролям сервера.</span>
                    </div>
                </div>
                <p className={styles.scrollHint} aria-hidden="true">
                    Прокрути колесо мыши ↓
                </p>
            </div>
            <div className={styles.signInWrap}>
                <div className={styles.signIn}>
                    <h2>Вход</h2>
                    <p>Выбери способ входа в панель управления.</p>
                    {notice && (
                        <Notice variant={gateNoticeMessage(notice).variant}>{gateNoticeMessage(notice).text}</Notice>
                    )}
                    <LoginMethods />
                </div>
            </div>
        </div>
    );
}
