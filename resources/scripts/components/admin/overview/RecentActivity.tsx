import { View } from '@/views/View';

/**
 * The admin activity log on the overview (Activity has no sidebar entry of its own in Gobia). It is upstream's
 * `activity.log` view, so the active theme draws it and it loads on its own, never holding up the statistics.
 */
export default function RecentActivity() {
    return (
        <section aria-label='Recent Activity'>
            <View name='activity.log' scope='admin' />
        </section>
    );
}
