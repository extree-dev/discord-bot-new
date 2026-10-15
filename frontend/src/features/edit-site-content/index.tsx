import { useState } from 'react';
import { updateSiteContent, uploadImage } from '../../entities/site-content/api';
import type { SiteContent } from '../../entities/site-content/types';
import { ApiError } from '../../shared/api/client';
import { Button } from '../../shared/ui/Button';
import { Checkbox } from '../../shared/ui/Checkbox';
import { SelectField, TextArea, TextField } from '../../shared/ui/Field';
import { Notice } from '../../shared/ui/Notice';
import { GridIcon, LinkChainIcon, TrashIcon, UserIcon, UsersIcon } from '../../shared/ui/icons';
import {
    addClient,
    addLink,
    addShowcase,
    canAddClient,
    canAddLink,
    canAddShowcase,
    removeClient,
    removeLink,
    removeShowcase,
    toPayload,
    updateClient,
    updateLink,
    updateShowcase,
} from './model';
import styles from './index.module.scss';

interface SiteContentFormProps {
    initial: SiteContent;
    maxLinks: number;
    maxClients: number;
    maxShowcases: number;
}

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

type LogoUploadStatus = { kind: 'uploading' } | { kind: 'error'; message: string };

const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';

// Вкладки секции "work" на визитке (frdg.work) — те же 4 значения,
// что и SHOWCASE_CATEGORIES на бэкенде (site/model.js).
const SHOWCASE_CATEGORY_OPTIONS = [
    { value: 'tools', label: 'Tools' },
    { value: 'communities', label: 'Communities' },
    { value: 'websites', label: 'Websites' },
    { value: 'branding', label: 'Branding' },
];

export function SiteContentForm({ initial, maxLinks, maxClients, maxShowcases }: SiteContentFormProps) {
    const [content, setContent] = useState<SiteContent>(initial);
    const [status, setStatus] = useState<Status>({ kind: 'idle' });
    // По индексу клиента — асинхронная загрузка логотипа идёт отдельно
    // от остального состояния формы (не блокирует другие поля/сохранение).
    const [logoUploads, setLogoUploads] = useState<Record<number, LogoUploadStatus>>({});
    const [showcaseImageUploads, setShowcaseImageUploads] = useState<Record<number, LogoUploadStatus>>({});
    // Теги проекта редактируются одной строкой через запятую — пока поле
    // в фокусе, храним сырой текст отдельно (иначе промежуточное "App,"
    // сразу схлопывалось бы в массив ["App"] и съедало бы запятую при
    // наборе следующего тега).
    const [tagsDraft, setTagsDraft] = useState<Record<number, string>>({});

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

    async function handleLogoFile(index: number, file: File) {
        setLogoUploads(prev => ({ ...prev, [index]: { kind: 'uploading' } }));
        try {
            const { url } = await uploadImage(file);
            setContent(prev => ({ ...prev, clients: updateClient(prev.clients ?? [], index, { logoUrl: url }) }));
            setLogoUploads(prev => {
                const next = { ...prev };
                delete next[index];
                return next;
            });
        } catch (err) {
            const message = err instanceof ApiError ? err.message : 'Не удалось загрузить файл.';
            setLogoUploads(prev => ({ ...prev, [index]: { kind: 'error', message } }));
        }
    }

    async function handleShowcaseImageFile(index: number, file: File) {
        setShowcaseImageUploads(prev => ({ ...prev, [index]: { kind: 'uploading' } }));
        try {
            const { url } = await uploadImage(file);
            setContent(prev => ({
                ...prev,
                showcases: updateShowcase(prev.showcases ?? [], index, { imageUrl: url }),
            }));
            setShowcaseImageUploads(prev => {
                const next = { ...prev };
                delete next[index];
                return next;
            });
        } catch (err) {
            const message = err instanceof ApiError ? err.message : 'Не удалось загрузить файл.';
            setShowcaseImageUploads(prev => ({ ...prev, [index]: { kind: 'error', message } }));
        }
    }

    function commitTagsDraft(index: number) {
        const raw = tagsDraft[index];
        if (raw === undefined) return;
        setContent(prev => ({
            ...prev,
            showcases: updateShowcase(prev.showcases ?? [], index, {
                tags: raw
                    .split(',')
                    .map(tag => tag.trim())
                    .filter(Boolean),
            }),
        }));
        setTagsDraft(prev => {
            const next = { ...prev };
            delete next[index];
            return next;
        });
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
                    Бегущая строка логотипов на визитке. Нужны и название, и загруженный файл логотипа — без них клиент
                    не сохранится. Пока список пуст, блок на сайте не показывается.
                </p>

                <div className={styles.links}>
                    {(content.clients ?? []).map((client, index) => {
                        const upload = logoUploads[index];
                        return (
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
                                            label="Период (необязательно) — например, 2024 – Present"
                                            id={`client${index}_period`}
                                            value={client.period}
                                            onChange={e =>
                                                setContent({
                                                    ...content,
                                                    clients: updateClient(content.clients ?? [], index, {
                                                        period: e.target.value,
                                                    }),
                                                })
                                            }
                                            maxLength={40}
                                        />
                                        <div className={styles.logoUploadRow}>
                                            <label className={styles.fileButton} htmlFor={`client${index}_file`}>
                                                {upload?.kind === 'uploading'
                                                    ? 'Загружаю…'
                                                    : client.logoUrl.trim()
                                                      ? 'Заменить логотип'
                                                      : 'Загрузить логотип'}
                                                <input
                                                    className={styles.fileInput}
                                                    type="file"
                                                    id={`client${index}_file`}
                                                    accept={LOGO_ACCEPT}
                                                    disabled={upload?.kind === 'uploading'}
                                                    onChange={e => {
                                                        const file = e.target.files?.[0];
                                                        e.target.value = '';
                                                        if (file) void handleLogoFile(index, file);
                                                    }}
                                                />
                                            </label>
                                            {upload?.kind === 'error' && (
                                                <span className={styles.fileError}>{upload.message}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    icon={<TrashIcon />}
                                    onClick={() =>
                                        setContent({
                                            ...content,
                                            clients: removeClient(content.clients ?? [], index),
                                        })
                                    }
                                >
                                    Удалить клиента
                                </Button>
                            </div>
                        );
                    })}

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

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                    <span className={styles.sectionIcon}>
                        <GridIcon />
                    </span>
                    Проекты (секция «work»)
                    <span className={styles.sectionCount}>
                        {(content.showcases ?? []).length} / {maxShowcases}
                    </span>
                </h2>
                <p className={styles.sectionHint}>
                    Карточки в секции work на визитке. Нужен только заголовок — без него проект не сохранится. Картинка
                    необязательна (карточка без неё просто текстовая), теги — через запятую. Пока список пуст, секция на
                    сайте не показывается.
                </p>

                <div className={styles.links}>
                    {(content.showcases ?? []).map((showcase, index) => {
                        const upload = showcaseImageUploads[index];
                        const imageUrl = showcase.imageUrl ?? '';
                        return (
                            <div className={styles.linkRow} key={index}>
                                <span className={styles.linkIndex}>{index + 1}</span>
                                <div className={styles.clientFields}>
                                    <span className={styles.clientLogoPreview}>
                                        {imageUrl.trim() ? <img src={imageUrl} alt="" /> : <GridIcon />}
                                    </span>
                                    <div className={styles.linkFields}>
                                        <TextField
                                            label={`Проект ${index + 1} — заголовок`}
                                            id={`showcase${index}_title`}
                                            value={showcase.title}
                                            onChange={e =>
                                                setContent({
                                                    ...content,
                                                    showcases: updateShowcase(content.showcases ?? [], index, {
                                                        title: e.target.value,
                                                    }),
                                                })
                                            }
                                            maxLength={80}
                                        />
                                        <SelectField
                                            label="Вкладка в секции work"
                                            id={`showcase${index}_category`}
                                            options={SHOWCASE_CATEGORY_OPTIONS}
                                            value={showcase.category ?? 'websites'}
                                            onChange={e =>
                                                setContent({
                                                    ...content,
                                                    showcases: updateShowcase(content.showcases ?? [], index, {
                                                        category: e.target.value as NonNullable<
                                                            typeof showcase.category
                                                        >,
                                                    }),
                                                })
                                            }
                                        />
                                        <TextArea
                                            label="Описание"
                                            id={`showcase${index}_description`}
                                            rows={2}
                                            value={showcase.description}
                                            onChange={e =>
                                                setContent({
                                                    ...content,
                                                    showcases: updateShowcase(content.showcases ?? [], index, {
                                                        description: e.target.value,
                                                    }),
                                                })
                                            }
                                            maxLength={400}
                                        />
                                        <TextField
                                            label="Теги через запятую — например, Bot, Discord"
                                            id={`showcase${index}_tags`}
                                            value={tagsDraft[index] ?? showcase.tags.join(', ')}
                                            onChange={e => setTagsDraft(prev => ({ ...prev, [index]: e.target.value }))}
                                            onBlur={() => commitTagsDraft(index)}
                                            maxLength={200}
                                        />
                                        <TextField
                                            label="Ссылка «Смотреть проект» (пусто, если не нужна)"
                                            id={`showcase${index}_url`}
                                            type="url"
                                            placeholder="https://..."
                                            value={showcase.url ?? ''}
                                            onChange={e =>
                                                setContent({
                                                    ...content,
                                                    showcases: updateShowcase(content.showcases ?? [], index, {
                                                        url: e.target.value,
                                                    }),
                                                })
                                            }
                                            maxLength={300}
                                        />
                                        <div className={styles.logoUploadRow}>
                                            <label className={styles.fileButton} htmlFor={`showcase${index}_file`}>
                                                {upload?.kind === 'uploading'
                                                    ? 'Загружаю…'
                                                    : imageUrl.trim()
                                                      ? 'Заменить картинку'
                                                      : 'Загрузить картинку'}
                                                <input
                                                    className={styles.fileInput}
                                                    type="file"
                                                    id={`showcase${index}_file`}
                                                    accept={LOGO_ACCEPT}
                                                    disabled={upload?.kind === 'uploading'}
                                                    onChange={e => {
                                                        const file = e.target.files?.[0];
                                                        e.target.value = '';
                                                        if (file) void handleShowcaseImageFile(index, file);
                                                    }}
                                                />
                                            </label>
                                            {upload?.kind === 'error' && (
                                                <span className={styles.fileError}>{upload.message}</span>
                                            )}
                                        </div>
                                        <Checkbox
                                            label="Под NDA — вместо ссылки показывается «Non-disclosure agreement-bound»"
                                            id={`showcase${index}_nda`}
                                            checked={Boolean(showcase.nda)}
                                            onChange={e =>
                                                setContent({
                                                    ...content,
                                                    showcases: updateShowcase(content.showcases ?? [], index, {
                                                        nda: e.target.checked,
                                                    }),
                                                })
                                            }
                                        />
                                        <Checkbox
                                            label="Скоро — вместо ссылки показывается «To be published»"
                                            id={`showcase${index}_upcoming`}
                                            checked={Boolean(showcase.upcoming)}
                                            onChange={e =>
                                                setContent({
                                                    ...content,
                                                    showcases: updateShowcase(content.showcases ?? [], index, {
                                                        upcoming: e.target.checked,
                                                    }),
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    icon={<TrashIcon />}
                                    onClick={() =>
                                        setContent({
                                            ...content,
                                            showcases: removeShowcase(content.showcases ?? [], index),
                                        })
                                    }
                                >
                                    Удалить проект
                                </Button>
                            </div>
                        );
                    })}

                    {canAddShowcase(content.showcases ?? [], maxShowcases) && (
                        <div className={styles.addRow}>
                            <Button
                                type="button"
                                variant="ghost"
                                fullWidth
                                onClick={() =>
                                    setContent({
                                        ...content,
                                        showcases: addShowcase(content.showcases ?? [], maxShowcases),
                                    })
                                }
                            >
                                + Добавить проект
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
