import { PASSWORD_REQUIREMENTS } from '../../lib/passwordRules';
import styles from './index.module.scss';

export function PasswordRequirements({ password }: { password: string }) {
    return (
        <ul className={styles.list}>
            {PASSWORD_REQUIREMENTS.map(req => {
                const met = req.test(password);
                return (
                    <li key={req.label} className={met ? styles.met : styles.unmet}>
                        <span className={styles.dot} aria-hidden="true" />
                        {req.label}
                    </li>
                );
            })}
        </ul>
    );
}
