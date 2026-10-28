import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../shared/ui/Modal';
import { TextField } from '../../shared/ui/TextField';
import { PasswordField } from '../../shared/ui/PasswordField';
import { Button } from '../../shared/ui/Button';
import { IconCheck } from '../../shared/ui/Icons';
import { deleteAccount, ApiError } from '../../shared/api/statsAuth';
import styles from './index.module.scss';

const CONFIRM_WORD = 'DELETE';

interface DeleteAccountModalProps {
    open: boolean;
    onClose: () => void;
}

// Единственное по-настоящему необратимое действие во всём приложении —
// остальные опасные действия (бан, разадминивание) обратимы и живут в
// AdminUserController. Подтверждение в два фактора (слово DELETE + пароль)
// и явный список последствий — то, что реально удаляется, не "аккаунт
// исчезнет" общими словами.
export function DeleteAccountModal({ open, onClose }: DeleteAccountModalProps) {
    const navigate = useNavigate();
    const [confirmWord, setConfirmWord] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [deleted, setDeleted] = useState(false);

    const canSubmit = confirmWord === CONFIRM_WORD && password.length > 0;

    function handleClose() {
        if (pending) return;
        setConfirmWord('');
        setPassword('');
        setError(null);
        setDeleted(false);
        onClose();
    }

    async function handleDelete() {
        if (!canSubmit) return;
        setPending(true);
        setError(null);
        try {
            await deleteAccount(password);
            setDeleted(true);
            window.setTimeout(() => navigate('/', { replace: true }), 1400);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong.');
        } finally {
            setPending(false);
        }
    }

    return (
        <Modal open={open} onClose={handleClose} labelledBy="delete-account-title">
            {deleted ? (
                <div className={styles.deletedState}>
                    <span className={styles.deletedIcon} aria-hidden="true">
                        <IconCheck />
                    </span>
                    <h2 className={styles.deletedTitle}>Account deleted</h2>
                    <p className={styles.deletedText}>Taking you back to the homepage…</p>
                </div>
            ) : (
                <>
                    <h2 className={styles.title} id="delete-account-title">
                        Delete account
                    </h2>
                    <p className={styles.lead}>
                        This action is permanent. All your data, match history, and settings will be deleted.
                    </p>
                    <ul className={styles.consequences}>
                        <li>Your profile, email, and password are permanently removed.</li>
                        <li>Linked Riot and Discord connections are unlinked.</li>
                        <li>Open support tickets are closed and your reply history is deleted.</li>
                        <li>This cannot be undone — there is no recovery period.</li>
                    </ul>

                    {error && <p className={styles.error}>{error}</p>}

                    <div className={styles.field}>
                        <TextField
                            id="delete-confirm-word"
                            label={`Type ${CONFIRM_WORD} to confirm`}
                            value={confirmWord}
                            onChange={e => setConfirmWord(e.target.value)}
                            autoComplete="off"
                        />
                    </div>
                    <div className={styles.field}>
                        <PasswordField
                            id="delete-password"
                            label="Password"
                            autoComplete="current-password"
                            value={password}
                            onChange={setPassword}
                        />
                    </div>

                    <div className={styles.actions}>
                        <Button variant="ghost" onClick={handleClose} disabled={pending}>
                            Cancel
                        </Button>
                        <Button
                            variant="flat"
                            className={styles.deleteBtn}
                            onClick={handleDelete}
                            loading={pending}
                            disabled={!canSubmit}
                        >
                            {pending ? 'Deleting…' : 'Delete account'}
                        </Button>
                    </div>
                </>
            )}
        </Modal>
    );
}
