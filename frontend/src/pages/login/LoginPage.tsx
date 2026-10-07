import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getSession } from '../../entities/session/api';
import { consumeGateNotice, gateNoticeMessage, type GateNotice } from '../../shared/lib/gateNotice';
import { Card } from '../../shared/ui/Card';
import { Notice } from '../../shared/ui/Notice';
import { LoginMethods } from '../../widgets/login-methods/LoginMethods';
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

    if (state === 'loading') return <div className={styles.page} />;
    if (state === 'logged-in') return <Navigate to="/dashboard" replace />;

    return (
        <div className={styles.page}>
            <div className={styles.glow} aria-hidden="true" />
            <header className={styles.topbar}>
                <a className={styles.brand} href="/">
                    <span className={styles.badge}>E</span>Extree
                </a>
            </header>
            <main className={styles.centered}>
                <Card>
                    <h1>Панель управления</h1>
                    <p>Войди через Discord — доступ есть только у администратора сервера, на котором работает бот.</p>
                    {notice && (
                        <Notice variant={gateNoticeMessage(notice).variant}>{gateNoticeMessage(notice).text}</Notice>
                    )}
                    <LoginMethods />
                </Card>
            </main>
        </div>
    );
}
