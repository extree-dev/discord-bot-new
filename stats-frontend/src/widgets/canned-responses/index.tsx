import { useEffect, useState, type FormEvent } from 'react';
import { Panel } from '../../shared/ui/Panel';
import { TextField } from '../../shared/ui/TextField';
import { TextArea } from '../../shared/ui/TextArea';
import { Button } from '../../shared/ui/Button';
import {
    getCannedResponses,
    createCannedResponse,
    deleteCannedResponse,
    ApiError,
    type CannedResponse,
} from '../../shared/api/statsAuth';
import styles from './index.module.scss';

export function CannedResponsesPanel() {
    const [responses, setResponses] = useState<CannedResponse[] | null>(null);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    function load() {
        getCannedResponses()
            .then(result => setResponses(result.responses))
            .catch(() => setResponses([]));
    }

    useEffect(load, []);

    async function onAdd(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
            await createCannedResponse(title, body);
            setTitle('');
            setBody('');
            load();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
        } finally {
            setPending(false);
        }
    }

    async function onDelete(id: string) {
        await deleteCannedResponse(id);
        load();
    }

    return (
        <Panel title="Canned responses" subtitle="Reusable reply templates, available when replying to a ticket.">
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}

            {responses && responses.length > 0 && (
                <ul className={styles.list}>
                    {responses.map(r => (
                        <li key={r.id} className={styles.item}>
                            <div className={styles.itemTitle}>{r.title}</div>
                            <div className={styles.itemBody}>{r.body}</div>
                            <button type="button" className={styles.deleteBtn} onClick={() => onDelete(r.id)}>
                                Delete
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <form className={styles.form} onSubmit={onAdd}>
                <TextField
                    id="canned-title"
                    label="Title"
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                />
                <TextArea id="canned-body" label="Body" required value={body} onChange={e => setBody(e.target.value)} />
                <Button type="submit" variant="ghost" disabled={pending || !title.trim() || !body.trim()}>
                    {pending ? 'Adding…' : 'Add canned response'}
                </Button>
            </form>
        </Panel>
    );
}
