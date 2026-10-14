import { useState } from 'react';
import { updateSiteContent } from '../../entities/site-content/api';
import type { SiteContent } from '../../entities/site-content/types';
import { ApiError } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { TextArea, TextField } from '../../shared/ui/Field';
import { Notice } from '../../shared/ui/Notice';
import { LinkChainIcon, TrashIcon, UserIcon, UsersIcon } from '../../shared/ui/icons';
import {
    addClient,
    addLink,
    canAddClient,
    canAddLink,
    removeClient,
    removeLink,
    toPayload,
    updateClient,
    updateLink,
} from './model';
import styles from './index.module.scss';

interface SiteContentFormProps {
    initial: SiteContent;
    maxLinks: number;
    maxClients: number;
}

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

export function SiteContentForm({ initial, maxLinks, maxClients }: SiteContentFormProps) {
    const [content, setContent] = useState<SiteContent>(initial);
    const [status, setStatus] = useState<Status>({ kind: 'idle' });

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        setStatus({ kind: 'saving' });
        try {
            const saved = await updateSiteContent(toPayload(content));
            setContent(saved);
            setStatus({ kind: 'saved' });
        } catch (err) {
            const message = err instanceof ApiError ? err.message : 'Не удалось сохранить — попробуй ещё раз.';
            setStatus({ kind: 'error', message });
        }
    }

    return (
        <form onSubmit={handleSubmit} className={styles.form}>
            {status.kind === 'saved' && <Notice variant="info">Сохранено.</Notice>}
            {status.kind === 'error' && <Notice variant="error">{status.message}</Notice>}

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    <span className={styles.sectionIcon}>
                        <UserIcon />
                    </span>
                    Профиль
                </h2>

                <div className={styles.profileGrid}>
                    <TextField
                        label="Имя"
                        id="name"
                        value={content.name}
                        onChange={e => setContent({ ...content, name: e.target.value })}
                        maxLength={60}
                        required
                    />
                    <TextField
                        label="Роль / тэглайн"
                        id="role"
                        value={content.role}
                        onChange={e => setContent({ ...content, role: e.target.value })}
                        maxLength={100}
                    />
                </div>
                <TextArea
                    label="Био"
                    id="bio"
                    rows={3}
                    value={content.bio}
                    onChange={e => setContent({ ...content, bio: e.target.value })}
                    maxLength={400}
                />
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    <span className={styles.sectionIcon}>
                        <LinkChainIcon />
                    </span>
                    Ссылки
                    <span className={styles.sectionCount}>
                        {content.links.length} / {maxLinks}
                    </span>
                </h2>

                <div className={styles.links}>
                    {content.links.map((link, index) => (
                        <div className={styles.linkRow} key={index}>
                            <span className={styles.linkIndex}>{index + 1}</span>
                            <div className={styles.linkFields}>
                                <TextField
                                    label={`Ссылка ${index + 1} — текст`}
                                    id={`link${index}_label`}
                                    value={link.label}
                                    onChange={e =>
                                        setContent({
                                            ...content,
                                            links: updateLink(content.links, index, { label: e.target.value }),
                                        })
                                    }
                                    maxLength={80}
                                />
                                <TextField
                                    label="URL (пусто = просто текст, без кнопки)"
                                    id={`link${index}_url`}
                                    type="url"
                                    placeholder="https://..."
                                    value={link.url}
                                    onChange={e =>
                                        setContent({
                                            ...content,
                                            links: updateLink(content.links, index, { url: e.target.value }),
                                        })
                                    }
                                    maxLength={300}
                                />
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                icon={<TrashIcon />}
                                onClick={() => setContent({ ...content, links: removeLink(content.links, index) })}
                            >
                                Удалить ссылку
                            </Button>
                        </div>
                    ))}

                    {canAddLink(content.links, maxLinks) && (
                        <div className={styles.addRow}>
                            <Button
                                type="button"
                                variant="ghost"
                                fullWidth
                                onClick={() => setContent({ ...content, links: addLink(content.links, maxLinks) })}
                            >
                                + Добавить ссылку
                            </Button>
                        </div>
                    )}
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    <span className={styles.sectionIcon}>
                        <UsersIcon />
                    </span>
                    Клиенты
                    <span className={styles.sectionCount}>
                        {(content.clients ?? []).length} / {maxClients}
                    </span>
                </h2>
                <p className={styles.sectionHint}>
                    Бегущая строка логотипов на визитке. Нужны и название, и ссылка на картинку — без них клиент не
                    сохранится. Пока список пуст, блок на сайте не показывается.
                </p>

                <div className={styles.links}>
                    {(content.clients ?? []).map((client, index) => (
                        <div className={styles.linkRow} key={index}>
                            <span className={styles.linkIndex}>{index + 1}</span>
                            <div className={styles.clientFields}>
                                <span className={styles.clientLogoPreview}>
                                    {client.logoUrl.trim() ? <img src={client.logoUrl} alt="" /> : <UsersIcon />}
                                </span>
                                <div className={styles.linkFields}>
                                    <TextField
                                        label={`Клиент ${index + 1} — название`}
                                        id={`client${index}_name`}
                                        value={client.name}
                                        onChange={e =>
                                            setContent({
                                                ...content,
                                                clients: updateClient(content.clients ?? [], index, {
                                                    name: e.target.value,
                                                }),
                                            })
                                        }
                                        maxLength={60}
                                    />
                                    <TextField
                                        label="URL логотипа"
                                        id={`client${index}_logoUrl`}
                                        type="url"
                                        placeholder="https://..."
                                        value={client.logoUrl}
                                        onChange={e =>
                                            setContent({
                                                ...content,
                                                clients: updateClient(content.clients ?? [], index, {
                                                    logoUrl: e.target.value,
                                                }),
                                            })
                                        }
                                        maxLength={300}
                                    />
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                icon={<TrashIcon />}
                                onClick={() =>
                                    setContent({ ...content, clients: removeClient(content.clients ?? [], index) })
                                }
                            >
                                Удалить клиента
                            </Button>
                        </div>
                    ))}

                    {canAddClient(content.clients ?? [], maxClients) && (
                        <div className={styles.addRow}>
                            <Button
                                type="button"
                                variant="ghost"
                                fullWidth
                                onClick={() =>
                                    setContent({ ...content, clients: addClient(content.clients ?? [], maxClients) })
                                }
                            >
                                + Добавить клиента
                            </Button>
                        </div>
                    )}
                </div>
            </section>

            <Button type="submit" variant="primary" fullWidth disabled={status.kind === 'saving'}>
                {status.kind === 'saving' ? 'Сохраняю…' : 'Сохранить'}
            </Button>
        </form>
    );
}
