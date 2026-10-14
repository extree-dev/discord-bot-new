import { Section } from '../../shared/ui/Section/Section';
import styles from './ContactSection.module.css';

const CONTACT_EMAIL = 'support@extree.tech';

// Как у frdg: contact — такая же секция, как about me.
// Подпись слева, карточка с почтой справа.
export function ContactSection() {
    return (
        <Section id="contact" label="contact">
            <div className={styles.card}>
                <span className={styles.cardLabel}>or reach out via email</span>
                <a className={styles.emailPill} href={`mailto:${CONTACT_EMAIL}`}>
                    {CONTACT_EMAIL}
                </a>
            </div>
        </Section>
    );
}
