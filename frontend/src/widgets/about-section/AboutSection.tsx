import { LanguagePicker } from '../../features/language-picker/LanguagePicker';
import { Section } from '../../shared/ui/Section/Section';
import styles from './AboutSection.module.css';

interface AboutSectionProps {
    name: string;
    role?: string;
    bio?: string;
    flush?: boolean;
}

export function AboutSection({ name, role, bio, flush }: AboutSectionProps) {
    return (
        <Section id="about" label="about me" flush={flush}>
            <div className={styles.header}>
                <h1 className={styles.name}>{name}</h1>
                {role && <span className={styles.role}>{role}</span>}
            </div>
            {bio && <p className={styles.bio}>{bio}</p>}
            <LanguagePicker />
        </Section>
    );
}