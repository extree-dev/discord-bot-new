import { useEffect, useState } from 'react';
import { getPresenceSettings } from '../../entities/presence-settings/api';
import type { PresenceSettings } from '../../entities/presence-settings/types';
import { PresenceSettingsForm } from '../../features/edit-presence-settings/PresenceSettingsForm';
import { useLang } from '../../shared/lib/useLang';
import styles from './BotStatusPage.module.css';

// Гейт — в AdminShell (см. DashboardPage для того же устройства).
export function BotStatusPage() {
    const [settings, setSettings] = useState<PresenceSettings | null>(null);
    const { lang, t } = useLang();

    useEffect(() => {
        document.title = `${t('status.title')} — Extree`;
    }, [lang, t]);

    useEffect(() => {
        let cancelled = false;
        getPresenceSettings().then(s => {
            if (!cancelled) setSettings(s);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    if (!settings) return null;

    return (
        <div className={styles.page}>
            <h1>{t('status.title')}</h1>
            <p className={styles.lead}>{t('status.subtitle')}</p>
            <PresenceSettingsForm initial={settings} />
        </div>
    );
}
