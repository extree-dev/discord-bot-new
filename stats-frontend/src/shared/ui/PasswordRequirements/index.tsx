import { PASSWORD_REQUIREMENTS } from '../../lib/passwordRules';
import { IconCheck, IconX } from '../Icons';
import styles from './index.module.scss';

export function PasswordRequirements({ password }: { password: string }) {
    return (
        <ul className={styles.list}>
            {PASSWORD_REQUIREMENTS.map(req => {
                const met = req.test(password);
                return (
                    <li key={req.label} className={met ? styles.met : styles.unmet}>
                        <span className={styles.icon} aria-hidden="true">
                            {met ? <IconCheck /> : <IconX />}
                        </span>
                        {req.label}
                    </li>
                );
            })}
        </ul>
    );
}
