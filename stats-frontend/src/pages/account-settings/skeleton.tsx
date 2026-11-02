import { Skeleton } from '../../shared/ui/Skeleton';
import styles from './skeleton.module.scss';

export function SettingsSkeleton() {
    return (
        <div className={styles.page}>
            <Skeleton width={140} height={14} className={styles.mb16} />
            <Skeleton width={100} height={28} className={styles.mb24} />
            <div className={styles.layoutContent}>
                <div className={styles.panel}>
                    <div className={styles.skeletonRow}>
                        <Skeleton width={64} height={64} radius="50%" />
                        <div className={styles.skeletonCol}>
                            <Skeleton width={160} height={20} />
                            <Skeleton width={200} height={14} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
