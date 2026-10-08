import { useEffect, useState } from 'react';
import { getSecuritySettings } from '../../entities/security-settings/api';
import type { SecuritySettings } from '../../entities/security-settings/types';
import { SecuritySettingsForm } from '../../features/edit-security-settings/SecuritySettingsForm';
import { useLang } from '../../shared/lib/useLang';
import styles from './BotSettingsPage.module.css';

// Гейт — в AdminShell (см. DashboardPage для того же устройства).
export function BotSettingsPage() {
    const [settings, setSettings] = useState<SecuritySettings | null>(null);
    const { lang, t } = useLang();

    useEffect(() => {
        document.title = `${t('security.title')} — Extree`;
    }, [lang, t]);

    useEffect(() => {
        let cancelled = false;
        getSecuritySettings().then(s => {
            if (!cancelled) setSettings(s);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    if (!settings) return null;

    return (
        <div className={styles.page}>
            <h1>{t('security.title')}</h1>
            <p className={styles.lead}>{t('security.subtitle')}</p>
            <SecuritySettingsForm initial={settings} />
        </div>
    );
}
