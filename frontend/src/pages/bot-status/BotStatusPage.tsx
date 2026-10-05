import { useEffect, useState } from 'react';
import { getPresenceSettings } from '../../entities/presence-settings/api';
import type { PresenceSettings } from '../../entities/presence-settings/types';
import { PresenceSettingsForm } from '../../features/edit-presence-settings/PresenceSettingsForm';
import { Card } from '../../shared/ui/Card';

// Гейт — в AdminShell (см. DashboardPage для того же устройства).
export function BotStatusPage() {
    const [settings, setSettings] = useState<PresenceSettings | null>(null);

    useEffect(() => {
        document.title = 'Статус бота — Extree';
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
        <Card wide>
            <h1>Статус бота</h1>
            <p>
                Та же настройка, что команда <code>/status</code> в Discord — фиксированный статус или ротация
                нескольких.
            </p>
            <PresenceSettingsForm initial={settings} />
        </Card>
    );
}
