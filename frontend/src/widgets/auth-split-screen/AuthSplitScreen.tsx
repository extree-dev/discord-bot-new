import { useEffect, useState } from 'react';
import { gateNoticeMessage, type GateNotice } from '../../shared/lib/gateNotice';
import { useTheme } from '../../shared/lib/useTheme';
import { useLang } from '../../shared/lib/useLang';
import { BrandMark } from '../../shared/ui/BrandMark';
import { Notice } from '../../shared/ui/Notice';
import { ThemeToggle } from '../../shared/ui/ThemeToggle';
import { LanguageToggle } from '../../shared/ui/LanguageToggle';
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
    const { theme, toggleTheme } = useTheme();
    const { lang, toggleLang, t } = useLang();

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
        <div className={`${styles.page} ${revealed ? styles.revealed : ''}`} data-theme={theme}>
            <div className={styles.glow} />
            <div className={styles.themeTools}>
                <ThemeToggle theme={theme} onToggle={toggleTheme} />
                <LanguageToggle lang={lang} onToggle={toggleLang} />
            </div>
            <div className={styles.marketing}>
                <div className={styles.brand}>
                    <BrandMark className={styles.badge} />
                    Extree
                </div>
                <h1>{t('login.headline')}</h1>
                <p className={styles.lead}>{t('login.lead')}</p>
                <div className={styles.stats}>
                    <div className={styles.stat}>
                        <span>{t('login.stat1Value')}</span>
                        <small>{t('login.stat1Label')}</small>
                    </div>
                    <div className={styles.stat}>
                        <span>{t('login.stat2Value')}</span>
                        <small>{t('login.stat2Label')}</small>
                    </div>
                    <div className={styles.stat}>
                        <span>{t('login.stat3Value')}</span>
                        <small>{t('login.stat3Label')}</small>
                    </div>
                </div>
                <div className={styles.features}>
                    <div className={styles.feature}>
                        <strong>{t('login.feature1Title')}</strong>
                        <span>{t('login.feature1Text')}</span>
                    </div>
                    <div className={styles.feature}>
                        <strong>{t('login.feature2Title')}</strong>
                        <span>{t('login.feature2Text')}</span>
                    </div>
                </div>
                <p className={styles.scrollHint} aria-hidden="true">
                    {t('login.scrollHint')}
                </p>
            </div>
            <div className={styles.signInWrap}>
                <div className={styles.signIn}>
                    <h2>{t('login.signInTitle')}</h2>
                    <p>{t('login.signInLead')}</p>
                    {notice && (
                        <Notice variant={gateNoticeMessage(notice).variant}>{gateNoticeMessage(notice).text}</Notice>
                    )}
                    <LoginMethods />
                </div>
            </div>
        </div>
    );
}
