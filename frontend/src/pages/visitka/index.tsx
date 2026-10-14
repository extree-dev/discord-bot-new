import {
    selectClients,
    selectCommunities,
    selectShowcases,
    selectSocialLinks,
    selectTools,
} from '../../entities/site-content/model/selectors';
import { useSiteContent } from '../../entities/site-content/model/useSiteContent';
import { useDocumentMeta } from '../../shared/lib/useDocumentMeta';
import { AboutSection } from '../../widgets/about-section';
import { ClientsSection } from '../../widgets/clients-section';
import { CommunitiesSection } from '../../widgets/communities-section';
import { ContactSection } from '../../widgets/contact-section';
import { HeroBanner } from '../../widgets/hero-banner';
import { ShowcasesSection } from '../../widgets/showcases-section';
import { SiteFooter } from '../../widgets/site-footer';
import { SiteNav } from '../../widgets/site-nav';
import { ToolsSection } from '../../widgets/tools-section';
import styles from './index.module.scss';

export function VisitkaPage() {
    const content = useSiteContent();

    useDocumentMeta({
        title: content?.name ?? null,
        lang: 'en',
        description: content?.bio,
        ogImage: '/avatar.jpg',
    });

    if (!content) {
        return (
            <div className={styles.page}>
                <div className={styles.skeleton} aria-hidden="true" />
            </div>
        );
    }

    const socialLinks = selectSocialLinks(content);
    const tools = selectTools(content);
    const clients = selectClients(content);
    const communities = selectCommunities(content);
    const showcases = selectShowcases(content);

    return (
        <div className={styles.page}>
            <SiteNav />
            <main className={styles.main}>
                {/* Панель 1: hero + about, белая. */}
                <div className={styles.panel}>
                    <HeroBanner />
                    <AboutSection name={content.name} role={content.role} bio={content.bio} flush />
                </div>

                {/* Панель 2: clients — тонкая, на фоне. */}
                {clients.length > 0 && (
                    <div className={styles.panelAlt}>
                        <ClientsSection items={clients} />
                    </div>
                )}

                {/* Панель 3: tools — белая. */}
                {tools.length > 0 && (
                    <div className={styles.panel}>
                        <ToolsSection items={tools} />
                    </div>
                )}

                {/* Панель 4: communities — на фоне. */}
                {communities.length > 0 && (
                    <div className={styles.panelAlt}>
                        <CommunitiesSection items={communities} />
                    </div>
                )}

                {/* Панель 5: websites — белая. */}
                {showcases.length > 0 && (
                    <div className={styles.panel}>
                        <ShowcasesSection id="websites" label="websites" items={showcases} />
                    </div>
                )}

                {/* Панель 6: contact — на фоне. */}
                <div className={styles.panelAlt}>
                    <ContactSection />
                </div>
            </main>
            <SiteFooter name={content.name} socialLinks={socialLinks} />
        </div>
    );
}
