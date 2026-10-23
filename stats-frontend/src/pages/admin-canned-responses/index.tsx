import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../widgets/dashboard-shell';
import { Panel } from '../../shared/ui/Panel';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { TextArea } from '../../shared/ui/TextArea';
import { EmptyState } from '../../shared/ui/EmptyState';
import {
    getAccount,
    getCannedResponses,
    createCannedResponse,
    deleteCannedResponse,
    ApiError,
    type AccountUser,
    type CannedResponse,
} from '../../shared/api/statsAuth';
import styles from './index.module.scss';

// Отдельная страница для CRUD шаблонов. В форме ответа на тикет —
// только picker (CannedTemplatePicker), здесь — управление списком.
export function AdminCannedResponsesPage() {
    const navigate = useNavigate();
    const [account, setAccount] = useState<AccountUser | null>(null);
    const [checking, setChecking] = useState(true);
    const [responses, setResponses] = useState<CannedResponse[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [newTitle, setNewTitle] = useState('');
    const [newBody, setNewBody] = useState('');
    const [creating, setCreating] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        getAccount().then(({ user, banned }) => {
            if (banned || !user || !user.isAdmin) {
                navigate('/login');
                return;
            }
            setAccount(user);
            setChecking(false);
        });
    }, [navigate]);

    function load() {
        getCannedResponses()
            .then(result => setResponses(result.responses))
            .catch(err => {
                setError(err instanceof ApiError ? err.message : 'Failed to load templates');
                setResponses([]);
            });
    }

    useEffect(() => {
        if (!checking) load();
    }, [checking]);

    async function onCreate(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setCreating(true);
        try {
            await createCannedResponse(newTitle.trim(), newBody.trim());
            setNewTitle('');
            setNewBody('');
            load();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Failed to create template');
        } finally {
            setCreating(false);
        }
    }

    async function onDelete(id: string) {
        if (!confirm('Delete this template?')) return;
        setDeletingId(id);
        try {
            await deleteCannedResponse(id);
            load();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Failed to delete template');
        } finally {
            setDeletingId(null);
        }
    }

    const dashUser = account ? { email: account.email, isAdmin: account.isAdmin } : null;

    return (
        <DashboardShell
            user={dashUser}
            breadcrumb={{ to: '/admin/tickets', label: 'Back to tickets' }}
            title="Canned responses"
            subtitle="Reusable reply templates available in the ticket reply form."
        >
            <Panel title="New template">
                <form className={styles.form} onSubmit={onCreate}>
                    <TextField
                        id="canned-title"
                        label="Title"
                        required
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                    />
                    <TextArea
                        id="canned-body"
                        label="Body"
                        required
                        value={newBody}
                        onChange={e => setNewBody(e.target.value)}
                    />
                    <div className={styles.formActions}>
                        <Button type="submit" variant="flat" disabled={creating || !newTitle.trim() || !newBody.trim()}>
                            {creating ? 'Creating…' : 'Create template'}
                        </Button>
                    </div>
                </form>
            </Panel>

            {error && <p className={styles.error}>{error}</p>}

            {responses === null && <p className={styles.loading}>Loading…</p>}
            {responses && responses.length === 0 && (
                <EmptyState title="No templates yet" description="Create your first reply template above." />
            )}
            {responses && responses.length > 0 && (
                <div className={styles.list}>
                    {responses.map(r => (
                        <Panel key={r.id} title={r.title}>
                            <div className={styles.bodyText}>{r.body}</div>
                            <div className={styles.itemActions}>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onDelete(r.id)}
                                    disabled={deletingId === r.id}
                                >
                                    {deletingId === r.id ? 'Deleting…' : 'Delete'}
                                </Button>
                            </div>
                        </Panel>
                    ))}
                </div>
            )}
        </DashboardShell>
    );
}
