import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { globalSearch, type GlobalSearchResult } from '../../shared/api/statsAuth';
import { useKeyboardShortcut } from '../../shared/lib/useKeyboardShortcut';
import styles from './index.module.scss';

/**
 * Cmd+K палитра. Ctrl+K / Cmd+K открывает, Esc закрывает.
 * Ищет по тикетам и юзерам через /api/admin/search. Enter — переход.
 * Доступна только админам (проверяется на бэке — 403 → пустой результат).
 */
export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const [result, setResult] = useState<GlobalSearchResult>({ tickets: [], users: [] });
    const [loading, setLoading] = useState(false);
    const [activeIdx, setActiveIdx] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    useKeyboardShortcut('k', true, () => setOpen(o => !o));

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 50);
        else setQ('');
    }, [open]);

    useEffect(() => {
        if (q.trim().length < 2) {
            setResult({ tickets: [], users: [] });
            return;
        }
        let cancelled = false;
        setLoading(true);
        const t = setTimeout(() => {
            globalSearch(q)
                .then(r => {
                    if (!cancelled) setResult(r);
                })
                .catch(() => {
                    if (!cancelled) setResult({ tickets: [], users: [] });
                })
                .finally(() => {
                    if (!cancelled) setLoading(false);
                });
        }, 200);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [q]);

    const items = useMemo(() => {
        const list: { label: string; sub: string; to: string }[] = [];
        for (const t of result.tickets) {
            list.push({ label: `#${t.number} ${t.subject}`, sub: t.email, to: `/admin/tickets/${t.number}` });
        }
        for (const u of result.users) {
            list.push({ label: u.name || u.email, sub: u.email, to: `/admin/users?q=${encodeURIComponent(u.email)}` });
        }
        return list;
    }, [result]);

    useEffect(() => {
        setActiveIdx(0);
    }, [items.length]);

    function onPick(to: string) {
        navigate(to);
        setOpen(false);
    }

    if (!open) return null;

    return (
        <div className={styles.backdrop} onClick={() => setOpen(false)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <input
                    ref={inputRef}
                    className={styles.input}
                    placeholder="Search tickets or users…"
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setActiveIdx(i => Math.min(i + 1, items.length - 1));
                        }
                        if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setActiveIdx(i => Math.max(i - 1, 0));
                        }
                        if (e.key === 'Enter' && items[activeIdx]) onPick(items[activeIdx].to);
                    }}
                />
                <div className={styles.results}>
                    {loading && <div className={styles.empty}>Searching…</div>}
                    {!loading && q.length >= 2 && items.length === 0 && (
                        <div className={styles.empty}>No results for "{q}"</div>
                    )}
                    {!loading && q.length < 2 && <div className={styles.empty}>Type at least 2 characters.</div>}
                    {items.map((item, i) => (
                        <button
                            key={i}
                            className={`${styles.item} ${i === activeIdx ? styles.active : ''}`}
                            onMouseEnter={() => setActiveIdx(i)}
                            onClick={() => onPick(item.to)}
                        >
                            <span className={styles.label}>{item.label}</span>
                            <span className={styles.sub}>{item.sub}</span>
                        </button>
                    ))}
                </div>
                <div className={styles.hint}>
                    <kbd>↑↓</kbd> navigate · <kbd>↵</kbd> open · <kbd>esc</kbd> close
                </div>
            </div>
        </div>
    );
}
