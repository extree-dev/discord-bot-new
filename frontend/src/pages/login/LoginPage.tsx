import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getSession } from '../../entities/session/api';
import { consumeGateNotice, type GateNotice } from '../../shared/lib/gateNotice';
import { AuthSplitScreen } from '../../widgets/auth-split-screen/AuthSplitScreen';
import styles from './LoginPage.module.css';

type ViewState = 'loading' | 'logged-out' | 'logged-in';

// Отдельный URL для входа (bot.extree.tech/login), на который ведёт
// кнопка "Войти" маркетинговой страницы бота — вместо того, чтобы сразу
// открывать /dashboard (тот тоже умеет показать этот же экран логина
// для прямых заходов без сессии, см. AdminShell, но явный /login нужен
// как публичный, независимый от этого URL). После успешного входа
// Discord/Telegram/email сервер (dashboard/server.js) всегда редиректит
// на /dashboard — оттуда уже AdminShell решает admin человек или нет.
export function LoginPage() {
    const [state, setState] = useState<ViewState>('loading');
    const [notice, setNotice] = useState<GateNotice | null>(null);

    useEffect(() => {
        document.title = 'Вход — Extree';
        const gateNotice = consumeGateNotice();
        if (gateNotice) setNotice(gateNotice);

        let cancelled = false;
        getSession()
            .then(({ user }) => {
                if (!cancelled) setState(user ? 'logged-in' : 'logged-out');
            })
            .catch(() => {
                if (!cancelled) setState('logged-out');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (state === 'loading') return <div className={styles.loading} />;
    if (state === 'logged-in') return <Navigate to="/dashboard" replace />;

    return <AuthSplitScreen notice={notice} />;
}
