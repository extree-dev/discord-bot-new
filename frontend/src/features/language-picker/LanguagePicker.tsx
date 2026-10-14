import { LANGUAGES } from './languages';
import styles from './LanguagePicker.module.css';

// Декоративные пилюли "talk to me in" в карточке "обо мне".
// Не путать с LanguageToggle (кружок в шапке кабинета) — разные
// задачи, разный вид; пересечений в стилях нет.
export function LanguagePicker() {
    return (
        <div className={styles.wrap}>
            <span className={styles.heading}>talk to me in</span>
            <div className={styles.row}>
                {LANGUAGES.map(lang => (
                    <span key={lang.code} className={styles.pill}>
                        <span className={styles.flag} aria-hidden="true">
                            <lang.Flag />
                        </span>
                        {lang.code}
                    </span>
                ))}
            </div>
        </div>
    );
}
