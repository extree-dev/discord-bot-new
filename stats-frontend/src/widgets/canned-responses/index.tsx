import { useEffect, useRef, useState } from 'react';
import { getCannedResponses, type CannedResponse } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

interface CannedTemplatePickerProps {
    onPick: (body: string) => void;
    disabled?: boolean;
}

// SRP: компонент только выбирает шаблон и отдаёт его через onPick.
// CRUD шаблонов (создание/удаление) — отдельная страница в следующей
// итерации. Здесь же — только "вставить существующий", как в Zendesk/
// Intercom (кнопка Insert template ▾ над textarea).
export function CannedTemplatePicker({ onPick, disabled }: CannedTemplatePickerProps) {
    const [open, setOpen] = useState(false);
    const [templates, setTemplates] = useState<CannedResponse[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open || templates !== null) return;
        getCannedResponses()
            .then(result => setTemplates(result.responses))
            .catch(() => setLoadError('Failed to load templates'));
    }, [open, templates]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [open]);

    function handlePick(body: string) {
        onPick(body);
        setOpen(false);
    }

    return (
        <div className={styles.wrapper} ref={containerRef}>
            <button
                type="button"
                className={styles.trigger}
                onClick={() => setOpen(v => !v)}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span>Insert template</span>
                <svg
                    className={`${styles.caret} ${open ? styles.caretOpen : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {open && (
                <div className={styles.menu} role="listbox">
                    {loadError && <div className={styles.error}>{loadError}</div>}
                    {templates === null && !loadError && <div className={styles.empty}>Loading…</div>}
                    {templates?.length === 0 && <div className={styles.empty}>No templates yet.</div>}
                    {templates && templates.length > 0 && (
                        <ul className={styles.list}>
                            {templates.map(t => (
                                <li key={t.id}>
                                    <button type="button" className={styles.item} onClick={() => handlePick(t.body)}>
                                        <span className={styles.itemTitle}>{t.title}</span>
                                        <span className={styles.itemBody}>{t.body}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
